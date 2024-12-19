import { DSProcess, DSProcessError } from "../dsProcess";
import { DSKernel } from "../dsKernel";

export class DSShellError extends DSProcessError {
    constructor(message: string) {
        super(message);
        this.name = this.constructor.name;
    }
}

export class DSShell extends DSProcess {
    private _prompt: CommandLinePrompt;
    history: string[] = [];

    protected async main(): Promise<void> {
        this._prompt = new CommandLinePrompt(this);
        return this._commandLoop();
    }

    private async _commandLoop() {
        let linebuffer: string[] = [];
        while (true) {
            try {
                let originput = "";
                if (this.stdin.isatty) {
                    originput = await this._prompt.promptForInput();
                } else {
                    if (linebuffer.length == 0) {
                        let buffer: string;
                        try {
                            buffer = await this.stdin.read();
                        } catch (e) {
                            // Can't do any type detection as rejects always
                            // end up type Error (sad face) 
                            // Instead we check if the stream has been closed and return
                            // otherwise propagate
                            if (this.stdin.close)
                                return;
                            throw e;
                        }
                        linebuffer = linebuffer.concat(buffer.split(/\r?\n|\r/));
                    }
                    originput = linebuffer.shift();
                }

                // Strip comments
                let strippedinput = originput.split("#")[0];

                // Interpolate variables
                let interpolatedinput = "";
                let i = 0;
                while (true) {
                    // If current character is a '$' then interpolate
                    if (strippedinput[i] === '$') {
                        const match = strippedinput.slice(i + 1).match(/^([A-Za-z_][A-Za-z0-9_]*)/);
                        if (match) {
                            const varname = match[0];
                            if (this.envp.hasOwnProperty(varname)) {
                                interpolatedinput += this.envp[varname];
                            }
                            i += 1 + varname.length;
                        } else {
                            interpolatedinput += '$'
                            i++;
                        }
                    }
                    // Now find the next '$'
                    const varpos=strippedinput.slice(i).indexOf("$");
                    if (varpos == -1) {
                        interpolatedinput += strippedinput.slice(i);
                        break;
                    }
                    interpolatedinput += strippedinput.slice(i,i+varpos);
                    i += varpos;
                }

                // Parse into tokens
                const tokens = splitRespectingQuotes(interpolatedinput);

                if (/^\s*$/.test(interpolatedinput)) {
                    // Empty line, do nothing

                } else if (tokens[0].includes("=")) { // VAR=VALUE
                    const lsrs = interpolatedinput.match(/^([^=\s]+)=(?:"([^"]*)"|([^=\s]*))$/);
                    if (!lsrs)
                        throw new DSShellError("badly formed variable assignment");

                    const varname = lsrs[1];
                    const varval = lsrs[2] ? lsrs[2] : lsrs[3];
                    this.envp[varname] = varval;

                } else { // COMMAND
                    const command = tokens[0];
                    switch (command) {
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
                }
            } catch (e) {
                this.stdout.write(`${e.message}\n`);
            }
        }
    }

    private _usage(cmd: string, args: string[], error: string = undefined) {
        let usagemsg = "";
        if (error)
            usagemsg += `error: ${error}\n`;
        usagemsg += `Usage: ${cmd} ${args.join(" ")}\n`;
        return this.stdout.write(usagemsg);
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
        return this.stdout.write(`${command}: command not found\n`);
    }

    private _commandHistory(tokens: string[]) {
        if (tokens.length != 1)
            return this._usage("history", [], `expected no arguments (${tokens.length - 1} given)\n`);
        let histstr = "";
        const idxwidth = 4;
        this.history.forEach((command, idx) => {
            histstr += `${String(idx).padStart(idxwidth)} ${command}\n`;
        });
        return this.stdout.write(histstr);
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

        const stdout = this._shell.stdout;
        this._prompt = this._promptprefix;
        this._prompt += this._shell.cwd.path;
        this._prompt += "$ ";
        this._shell.stdout.write(this._prompt);

        stdout.write("\x1b[4h"); // Enable insert mode
        this._historyIdx = this._shell.history.length;
        this._shell.history.push("");
        while (true) {
            const data = await this._shell.stdin.read();
            if (this._processInput(data))
                break;
        }
        stdout.write("\x1b[4l"); // Disable insert mode
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
        const stdout = this._shell.stdout;

        stdout.write(`\x1b[${this._prompt.length + 1}G`); // Put cursor at end of prompt
        stdout.write("\x1b[K"); // Clear to EoL
        stdout.write(this._userinput); // write the entry
        this._cursor = this._userinput.length; // set cursor to end of entry
    }

    private _delFromCursor(): void {
        const stdout = this._shell.stdout;

        this._userinput = this._userinput.slice(0, this._cursor) + this._userinput.slice(this._cursor + 1);
        stdout.write("\x1b[s"); // Save cursor position
        stdout.write("\x1b[K"); // Clear to EoL
        stdout.write(this._userinput.slice(this._cursor));
        stdout.write("\x1b[u"); // Restore cursor position
    }

    private _processInput(data: string): boolean {
        // handle DEL
        if (data.charAt(0) == "\x7f") {
            if (this._cursor > 0) {
                this._cursor--;
                this._shell.stdout.write("\x1b[D");
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
                        this._shell.stdout.write(data);
                    }
                    break;
                case "[C": // Right
                    if (this._cursor < this._userinput.length) {
                        this._cursor++;
                        this._shell.stdout.write(data);
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
            this._shell.stdout.write("\n");
            return true;
        }
        // ok add the character at current cursor location and update cursor location
        this._userinput = this._userinput.slice(0, this._cursor)
            + data
            + this._userinput.slice(this._cursor);
        this._cursor++;

        this._shell.stdout.write(data);
        return false;
    }
}