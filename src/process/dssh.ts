import { DSProcess } from "../dsProcess";
import { DSKernel } from "../dsKernel";
import { DSTerminal } from "../dsTerminal";
import { DSIDirectory } from "../dsFileSystem";
import { sleep } from "../lib/dsLib";

export class DSShell extends DSProcess {
    private _prompt: CommandLinePrompt;
    history: string[] = [];
    t: DSTerminal;

    protected async main(): Promise<void> {
        this.t = DSKernel.terminal;
        this._prompt = new CommandLinePrompt(this);
        return this._commandLoop();
    }

    private async _commandLoop() {

        while (true) {
            try {
                const input = await this._prompt.promptForInput();
                const tokens = splitRespectingQuotes(input);
                const command = tokens[0];

                switch (command) {
                    case undefined: // empty command
                        break;
                    case "exit":
                        // Clean exit
                        return;
                    case "cd":
                        await this._commandCd(tokens);
                        break;
                    case "history":
                        await this._commandHistory(tokens);
                        break;
                    default:
                        await this._findAndExec(tokens);

                }
            } catch (e) {
                await this.t.baudText(`${e.message}\n`);
            }
        }
    }

    private _usage(cmd: string, args: string[], error: string = undefined) {
        let usagemsg = "";
        if (error)
            usagemsg += `error: ${error}\n`;
        usagemsg += `Usage: ${cmd} ${args.join(" ")}\n`;
        return this.t.baudText(usagemsg);
    };

    private async _findAndExec(tokens: string[]) {
        const command = tokens[0];
        const path = this.envp['PATH'];
        if (path) {
            const paths = path.split(";");
            for (let i = 0; i < paths.length; i++) {
                // try to find the file
                const filepath = paths[i] + '/' + command;
                try {
                    this.cwd.getfile(filepath);
                    return DSKernel.exec(filepath, tokens, this.envp);
                } catch (e) {
                    // next
                }
            }
        }
        return this.t.baudText(`${command}: command not found\n`);
    }

    private _commandHistory(tokens: string[]) {
        if (tokens.length != 1)
            return this._usage("history", [], `expected no arguments (${tokens.length - 1} given)\n`);
        let histstr = "";
        const idxwidth = 4;
        this.history.forEach((command, idx) => {
            histstr += `${String(idx).padStart(idxwidth)} ${command}\n`;
        });
        return this.t.baudText(histstr);
    };

    private _commandCd(tokens: string[]) {
        if (tokens.length != 2)
            return this._usage("cd", ["<dirname>"], `expected 1 argument (${tokens.length - 1} given)\n`);
        let dirname = tokens[1];

        this.chdir(dirname);
    }
}

function splitRespectingQuotes(input: string): string[] {
    const regex = /"([^"]*)"|'([^']*)'|[^\s]+/g;
    const matches = [];
    let match;

    while ((match = regex.exec(input)) !== null) {
        matches.push(match[1] || match[2] || match[0]);
    }

    return matches;
}

class CommandLinePrompt {
    private _promptprefix: string;
    private _prompt: string;
    private _userinput: string = "";
    private _cursor: number = 0;
    private _historyIdx: number;

    constructor(private _shell: DSShell) {
        this._promptprefix = "depsys.io:";
    }

    async promptForInput(): Promise<string> {
        this._userinput = "";
        this._cursor = 0;

        const t = this._shell.t;
        this._prompt = this._promptprefix;
        this._prompt += this._shell.cwd.path;
        this._prompt += "$ ";
        await t.baudText(this._prompt);

        t.stdout("\x1b[4h"); // Enable insert mode
        this._historyIdx = this._shell.history.length;
        this._shell.history.push("");
        while (true) {
            const data = await this._shell.stdin.read();
            if (this._processInput(data))
                break;
        }
        t.stdout("\x1b[4l"); // Disable insert mode
        // Replace last history entry with final input
        this._shell.history[this._shell.history.length - 1] = this._userinput;
        // If input is empty or a repeat then throw it away
        if (
            (this._userinput == "")
            || (this._userinput == this._shell.history[this._shell.history.length - 2])
        )
            this._shell.history.pop();
        return this._userinput;
    }

    private _rewriteUserInput() {
        this._shell.t.stdout(`\x1b[${this._prompt.length + 1}G`); // Put cursor at end of prompt
        this._shell.t.stdout("\x1b[K"); // Clear to EoL
        this._shell.t.stdout(this._userinput); // write the entry
        this._cursor = this._userinput.length; // set cursor to end of entry
    }

    private _delFromCursor(): void {
        this._userinput = this._userinput.slice(0, this._cursor) + this._userinput.slice(this._cursor + 1);
        this._shell.t.stdout("\x1b[s"); // Save cursor position
        this._shell.t.stdout("\x1b[K"); // Clear to EoL
        this._shell.t.stdout(this._userinput.slice(this._cursor));
        this._shell.t.stdout("\x1b[u"); // Restore cursor position
    }

    private _processInput(data: string): boolean {
        // handle DEL
        if (data.charAt(0) == "\x7f") {
            if (this._cursor > 0) {
                this._cursor--;
                this._shell.t.stdout("\x1b[D");
                this._delFromCursor();
            }
            return false;
        }
        // catch escape sequences
        if (data.charAt(0) == "\x1b") {
            switch (data.slice(1)) {
                case "[D": // Left
                    if (this._cursor > 0) {
                        this._cursor--;
                        this._shell.t.stdout(data);
                    }
                    break;
                case "[C": // Right
                    if (this._cursor < this._userinput.length) {
                        this._cursor++;
                        this._shell.t.stdout(data);
                    }
                    break;
                case "[3~": // Delete
                    if (this._cursor < this._userinput.length)
                        this._delFromCursor();
                    break;
                case "[A": // Up
                    if (this._historyIdx > 0) {
                        this._shell.history[this._historyIdx] = this._userinput;
                        this._historyIdx--;
                        this._userinput = this._shell.history[this._historyIdx];
                        this._rewriteUserInput();
                    }
                    break;
                case "[B": // Down
                    if (this._historyIdx < this._shell.history.length - 1) {
                        this._shell.history[this._historyIdx] = this._userinput;
                        this._historyIdx++;
                        this._userinput = this._shell.history[this._historyIdx];
                        this._rewriteUserInput();
                    }
                    break;
                default:
                    console.log(`unknown escape sequence ${data}`);
            }
            return false;
        }
        // If LF we're done
        if (data == "\r") {
            this._shell.t.stdout("\n");
            return true;
        }
        // ok add the character at current cursor location and update cursor location
        this._userinput = this._userinput.slice(0, this._cursor)
            + data
            + this._userinput.slice(this._cursor);
        this._cursor++;

        this._shell.t.stdout(data);
        return false;
    }
}