import { DSProcess } from "../dsProcess";
import { DSKernel } from "../dsKernel";
import { DSTerminal } from "../dsTerminal";
import { DSIDirectory } from "../dsFileSystem";

export class DSShell extends DSProcess {
    private _prompt: CommandLinePrompt;
    history: string[] = [];
    t: DSTerminal;

    constructor(
        readonly pid: number,
        readonly ppid: number,
        cwd: DSIDirectory
    ) {
        super(pid, ppid, cwd);
        this.t = DSKernel.terminal;
    }

    get procname(): string {
        return "dssh";
    }

    protected async main(): Promise<void> {
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
                    case "sleep":
                        await this._commandSleep(tokens);
                        break;
                    case "echo":
                        await this._commandEcho(tokens);
                        break;
                    case "ps":
                        await this._commandPs(tokens);
                        break;
                    case "pwd":
                        await this._commandPwd(tokens);
                        break;
                    case "mkdir":
                        await this._commandMkdir(tokens);
                        break;
                    case "ls":
                        await this._commandLs(tokens);
                        break;
                    case "cd":
                        await this._commandCd(tokens);
                        break;
                    case "history":
                        await this._commandHistory(tokens);
                        break;
                    case "file":
                        await this._commandFile(tokens);
                        break;
                    case "cat":
                        await this._commandCat(tokens);
                        break;
                    default:
                        await this.t.baudText(`${command}: command not found\n`);
                }
            } catch (e) {
                await this.t.baudText(`${e.message}\n`);
            }
        }
    }

    private _commandCat(tokens: string[]) {
        if (tokens.length != 2)
            return this._usage("cat", ["<filename>"], `expected 1 argument (${tokens.length - 1} given)\n`);
        let filename = tokens[1];
        const fileinfo = this.cwd.getfileinfo(filename);
        if (!fileinfo)
            return this.t.baudText(`'${filename}' not found\n`);
        
        return fileinfo.inode.contentAsText().then(text => 
            this.t.baudText(text)
        );
    }

    private _commandFile(tokens: string[]) {
        if (tokens.length != 2)
            return this._usage("file", ["<filename>"], `expected 1 argument (${tokens.length - 1} given)\n`);
        let filename = tokens[1];
        const fileinfo = this.cwd.getfileinfo(filename);
        if (!fileinfo)
            return this.t.baudText(`'${filename}' not found\n`);
        return fileinfo.inode.filetype().then(
            filetype => this.t.baudText(filetype + '\n'));
    }

    private _usage(cmd: string, args: string[], error: string = undefined) {
        let usagemsg = "";
        if (error)
            usagemsg += `error: ${error}\n`;
        usagemsg += `Usage: ${cmd} ${args.join(" ")}\n`;
        return this.t.baudText(usagemsg);
    };

    private _commandHistory(tokens: string[]) {
        if (tokens.length != 1)
            return this._usage("ls", [], `expected no arguments (${tokens.length - 1} given)\n`);
        let histstr = "";
        const idxwidth = 4;
        this.history.forEach((command, idx) => {
            histstr += `${String(idx).padStart(idxwidth)} ${command}\n`;
        });
        return this.t.baudText(histstr);
    };

    private _commandLs(tokens: string[]) {
        if (tokens.length != 1)
            return this._usage("ls", [], `expected no arguments (${tokens.length - 1} given)\n`);

        // Get the file list
        let fileliststr = "";

        this.cwd.filelist.forEach((fileinfo) => {
            fileliststr += fileinfo.inode.perms.permString();
            fileliststr += `  ${fileinfo.name}\n`;
        })
        return this.t.baudText(fileliststr);

    }

    private _commandCd(tokens: string[]) {
        if (tokens.length != 2)
            return this._usage("cd", ["<dirname>"], `expected 1 argument (${tokens.length - 1} given)\n`);
        let dirname = tokens[1];

        this.chdir(dirname);
    }

    private _commandMkdir(tokens: string[]) {
        if (tokens.length != 2)
            return this._usage("mkdir", ["<dirname>"], `expected 1 argument (${tokens.length - 1} given)\n`);
        let dirname = tokens[1];

        this.cwd.mkdir(dirname);
    }

    private _commandPwd(tokens: string[]) {
        if (tokens.length != 1)
            return this._usage("pwd", [], `expected no arguments (${tokens.length - 1} given)\n`);

        return this.t.baudText(this.cwd.path + "\n");
    }

    private _commandPs(tokens: string[]) {
        if (tokens.length != 1)
            return this._usage("ps", [], `expected no arguments (${tokens.length - 1} given)\n`);

        const pidwidth = 6;
        let proclist = `${"PID".padStart(pidwidth)} CMD\n`;
        DSKernel.procstack.forEach((proc, idx) => {
            const active = proc.pid == DSKernel.curproc.pid ? " *" : "";
            proclist += `${String(proc.pid).padStart(pidwidth)} ${proc.procname}${active}\n`;
        });
        return this.t.baudText(proclist);
    }

    private _commandEcho(tokens: string[]) {
        return this.t.baudText(tokens.slice(1).join(" ") + "\n");
    }

    private _commandSleep(tokens: string[]) {
        if (tokens.length != 2)
            return this._usage("sleep", ["<milliseconds>"], `expected 1 argument (${tokens.length - 1} given)\n`);
        let delay = Number(tokens[1]);
        if (isNaN(delay) || !Number.isInteger(delay) || delay <= 0)
            return this._usage("sleep", ["<milliseconds>"], `expected positive whole number argument (${delay})\n`);
        return new Promise((resolve) => setTimeout(resolve, delay));
    }

    // Handlers
    handleStdin(data: string): void {
        if (this._prompt)
            this._prompt.handleStdin(data);
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

    private _inputbuffer: string[] = [];
    private _inputresolver: (value: string | PromiseLike<string>) => void;

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
            const data = await this._getInput();
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

    private _getInput(): Promise<string> {
        // If there is input in the buffer then return it
        if (this._inputbuffer.length > 0)
            return Promise.resolve(this._inputbuffer.shift());
        // If not set up a promise for signalling
        return new Promise<string>((resolve) => {
            this._inputresolver = resolve;
        });
    }

    handleStdin(data: string): void {
        // Check if someone's waiting for the input
        if (this._inputresolver) {
            // NB: If someone's waiting then by definition the buffer is empty 
            this._inputresolver(data);
            this._inputresolver = undefined;
        } else {
            // If nobody's waiting then enqueue the input
            this._inputbuffer.push(data);
        }
    }
}