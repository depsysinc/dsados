import { DSProcess, DSProcessError } from "../dsProcess";
import { DSKernel } from "../dsKernel";
import { DSStream, DSStreamClosedError } from "../dsStream";
import { DSOptionParser } from "../lib/dsOptionParser";

export class DSShellError extends DSProcessError {
    constructor(message: string) {
        super(message);
        Object.setPrototypeOf(this, DSShellError.prototype);
        this.name = this.constructor.name;
    }
}

class IFBlock {
    condition: boolean;
    inelse: boolean = false;
    constructor(condition: boolean) {
        this.condition = condition;
    }
}

export class DSShell extends DSProcess {
    private _prompt: CommandLinePrompt;
    private _ifstack: IFBlock[] = [];
    private _loginshell: boolean = false;

    history: string[] = [];

    protected async main(): Promise<void> {
        const optparser = new DSOptionParser(
            this.procname,
            true,
            "   Deprecated Systems SHell",
        );
        optparser.addoption({
            long: "login",
            short: "l",
            required: false,
            takesArgument: false,
            argName: "",
            description: "Start shell reading autoexec.dssh then prompt"
        });
        let nextarg = optparser.parseWithUsageAndHelp(this.argv);
        this._loginshell = optparser.getLongOption("login").seen;

        this._prompt = new CommandLinePrompt(this);
        return this._commandLoop();
    }

    private async _commandLoop() {
        let linebuffer: string[] = [];
        // autoexecfile: DSInode | undefined = undefined;
        let instream: DSStream;
        if (this._loginshell) {
            // try opening autoexec
            const autoexecfile = this.cwd.getfile("/etc/autoexec.dssh");
            instream = autoexecfile.contentAsText();
        } else {
            instream = this.stdin;
        }

        while (true) {
            try {
                let originput = "";
                if (instream.isatty) {
                    // FIXME: prompt assumes stdin
                    originput = await this._prompt.promptForInput();
                } else {
                    if (linebuffer.length == 0) {
                        let buffer: string;
                        try {
                            buffer = await instream.read();
                        } catch (e) {
                            if (e instanceof DSStreamClosedError) {
                                // if not a loginshell then we're done
                                if (!this._loginshell)
                                    return;
                                // need to swap in stdin
                                instream = this.stdin;
                                continue;
                            }
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
                    const varpos = strippedinput.slice(i).indexOf("$");
                    if (varpos == -1) {
                        interpolatedinput += strippedinput.slice(i);
                        break;
                    }
                    interpolatedinput += strippedinput.slice(i, i + varpos);
                    i += varpos;
                }

                // Parse into tokens
                const tokens = splitRespectingQuotes(interpolatedinput);

                if (/^\s*$/.test(interpolatedinput)) {
                    // Empty line, do nothing

                } else if (tokens[0] == "if") {  // IF
                    const match = interpolatedinput.match(/^\s*if\s*\[([^\]]+)\]\s*$/)
                    if (!match)
                        throw new DSShellError("malformed if statement");
                    const expr = splitRespectingQuotes(match[1]);
                    if (expr.length == 0)
                        throw new DSShellError("malformed if statement");
                    if (this._evaluating())
                        this._ifstack.push(new IFBlock(this._evalExpression(expr)));
                    else
                        this._ifstack.push(new IFBlock(false));

                } else if (tokens[0] == "else") {  // ELSE
                    if (tokens.length != 1)
                        throw new DSShellError("malformed if statement");
                    if (this._ifstack.length == 0)
                        throw new DSShellError("unexpected else, no matching if");
                    const ifblock = this._ifstack[this._ifstack.length - 1];
                    if (ifblock.inelse)
                        throw new DSShellError("unexpected else, already in else body");
                    ifblock.inelse = true;

                } else if (tokens[0] == "endif") {  // ENDIF
                    if (tokens.length != 1)
                        throw new DSShellError("malformed if statement");
                    if (this._ifstack.length == 0)
                        throw new DSShellError("unexpected endif, no matching if");
                    this._ifstack.pop();

                } else if (!this._evaluating()) {
                    // do nothing
                } else if (tokens[0].includes("=")) { // ENV VARIABLES (VAR=VALUE)
                    const lsrs = interpolatedinput.match(/^\s*([^=\s]+)=(?:"([^"]*)"|([^=\s]*))\s*$/);
                    if (!lsrs)
                        throw new DSShellError("badly formed variable assignment");

                    const varname = lsrs[1];
                    const varval = lsrs[2] ? lsrs[2] : lsrs[3];
                    this.envp[varname] = varval;

                } else { // COMMANDS
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
                if (e instanceof DSShellError) {
                    throw e;
                }
            }
        }
    }
    private _evaluating(): boolean {
        if (this._ifstack.length == 0)
            return true;
        for (let i = 0; i < this._ifstack.length; i++) {
            const ifblock = this._ifstack[i];
            if ((!ifblock.condition && !ifblock.inelse) ||
                (ifblock.condition && ifblock.inelse))
                return false;
        }
        return true;
    }

    private _evalExpression(expr: string[]): boolean {
        const op = expr[0];
        switch (op) {
            case "-true":
                return true;
            case "-false":
                return false;
            default:
                throw new DSShellError("invalid if condition");
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
        if (command.startsWith("/") || command.startsWith(".")) {
            try {
                const filepath = this.cwd.path + '/' + command;
                this.cwd.getfile(filepath);
                return DSKernel.exec(filepath, tokens, this.envp);
            } catch (e) {
                return this.stdout.write(`${command}: command not found\n`);
            }
        }
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
        // Check for [tab]
        if (data == "\t") {
            this._shell.stdout.write("\x07");
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