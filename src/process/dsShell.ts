import { DSIDirectory } from "../dsFilesystem";
import { DSProcess } from "../dsProcess";
import { DSKernel } from "../dsKernel";
import { DSTerminal } from "../dsTerminal";

export class DSShell extends DSProcess {
    private _prompt: CommandLinePrompt;
    t: DSTerminal;

    constructor(
        readonly pid: number,
        readonly ppid: number,
        cwd: DSIDirectory
    ) {
        super(pid,ppid,cwd);
        this.t = DSKernel.terminal;
    }

    get procname(): string {
        return "dssh";
    }
    protected main(): void {
        this._prompt = new CommandLinePrompt(this);
        this._commandLoop();
    }

    private async _commandLoop() {

        while (true) {
            try {

                const input = await this._prompt.promptForInput();

                // TODO: Handle "" when tokenizing
                const tokens = splitRespectingQuotes(input);
                const command = tokens[0];
                switch (command) {
                    case undefined: // empty command, do nothing
                        break;
                    case "exit":
                        this._exit(0);
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
                    default:
                        await this.t.baudText(`${command}: command not found\n`);
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

    private _commandLs(tokens: string[]) {
        if (tokens.length != 1)
            return this._usage("ls", [], `expected no arguments (${tokens.length - 1} given)\n`);

        // Get the file list
        let fileliststr = "";
        const pidwidth = 6;
        let proclist = `${"PID".padStart(pidwidth)} CMD\n`;

        this.cwd.filelist.forEach((fileinfo) => {
            fileliststr += fileinfo.inode.perms.r ? 'r' : '-';
            fileliststr += fileinfo.inode.perms.w ? 'w' : '-';
            fileliststr += fileinfo.inode.perms.x ? 'x' : '-';
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
    private _userinput: string = "";
    private _cursor: number = 0;

    private _inputbuffer: string[] = [];
    private _inputresolver: (value: string | PromiseLike<string>) => void;

    constructor(private _shell: DSShell) {
        this._promptprefix = "depsys.io:";
    }

    async promptForInput(): Promise<string> {
        this._userinput = "";
        this._cursor = 0;

        const t = this._shell.t;
        let prompt = this._promptprefix;
        prompt += this._shell.cwd.path;
        prompt += "$ ";
        await t.baudText(prompt);

        t.stdout("\x1b[4h"); // Enable insert mode
        while (true) {
            const data = await this._getInput();
            if (this._processInput(data))
                break;
        }
        t.stdout("\x1b[4l"); // Disable insert mode
        // tokenize
        return this._userinput;
    }

    private _processInput(data: string): boolean {
        // catch escape sequences
        if (data.charAt(0) == "\x1b") {
            switch (data.slice(1)) {
                case "":
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