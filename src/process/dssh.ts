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
    private _waitingForDoubleTab: boolean;

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

    private _cursorAtLeftEdge(): boolean {
        const totalchars = this._cursor + this._prompt.length;
        return (totalchars % DSKernel.terminal.cols == 0);
    }

    private _cursorAtRightEdge(): boolean {
        const totalchars = this._cursor + this._prompt.length;
        return ((totalchars + 1) % DSKernel.terminal.cols == 0)
    }

    private _cursorLeft(amount: number) {
        if (amount < 0) {
            throw new DSShellError("Attempt to move negative positions left");
        }
        for (let _ = 0; _ < amount; _++) {
            if (this._cursorAtLeftEdge()) {
                this._shell.stdout.write("\x1b[F\x1b[200000C") //Move cursor up one row and then to the rightmost column
            }
            else {
                this._shell.stdout.write(`\x1b[D`); //Move cursor one space left
            }
            this._cursor--
        }
    }

    private _cursorRight(amount: number) {
        if (amount < 0) {
            throw new DSShellError("Attempt to move negative positions right");
        }
        for (let _ = 0; _ < amount; _++) {
            if (this._cursorAtRightEdge()) {
                this._shell.stdout.write("\x1b[E") //Move the cursor down one row and to the leftmost column
            }
            else {
                this._shell.stdout.write(`\x1b[C`); //Move the cursor one space right
            }
            this._cursor++
        }
    }

    private _updateUserInput(newUserInput: string) {
        const stdout = this._shell.stdout;
        const startcursorpos = this._cursor;

        this._cursorLeft(startcursorpos); //Move cursor to start of line
        stdout.write("\x1b[J"); // Clear to EoF
        stdout.write(newUserInput); // write the entry
        this._cursor += newUserInput.length //Update internal cursor position

        //The xterm terminal handles cursor position differently at end of line - standardize it to avoid weird edge cases
        if (this._cursorAtLeftEdge() && (newUserInput.length + this._prompt.length) % DSKernel.terminal.cols == 0) {
            stdout.write('\n');
        }

        const cursormovement = Math.min(newUserInput.length, this._userinput.length - startcursorpos) //Move cursor to same relative position
        if (cursormovement > 0) {
            this._cursorLeft(cursormovement);
        }
        else if (cursormovement < 0) {
            this._cursorRight(-cursormovement);
        }

        this._userinput = newUserInput;
    }


    private _delAtCursor(): void {
        let newuserinput = this._userinput.slice(0, this._cursor - 1) + this._userinput.slice(this._cursor);
        this._updateUserInput(newuserinput);
    }


    private _getCwdCompletions(): string[] {
        const tokens = splitRespectingQuotes(this._userinput);
        const options: string[] = [];
        const matchtext = tokens[tokens.length - 1];

        for (let i = 0; i < this._shell.cwd.filelist.length; i++) {
            let currentfilename = this._shell.cwd.filelist[i].name
            if (currentfilename.slice(0, matchtext.length) == matchtext &&
                currentfilename[0] != '.') {
                options.push(currentfilename);
            }
        }

        return options
    }

    private _completeUserInput(completion: string) {
        const tokens = splitRespectingQuotes(this._userinput);
        const lengthtoappend = tokens[tokens.length - 1].length
        const appendtext = completion.slice(lengthtoappend);

        let newuserinput = this._userinput + appendtext;
        this._updateUserInput(newuserinput); //Not just stdout.write to avoid issues when cursor isn't at the end of the line

    }

    private _displayAutocompleteOptions(options: string[]) {
        this._shell.stdout.write('\n' + options.toString() + '\n\n');
        this._shell.stdout.write(this._prompt);
        this._shell.stdout.write(this._userinput);

    }

    private _processInput(data: string): boolean {
        //Handle [tab] and autocomplete
        if (data.charAt(0) == '\t') {
            this._shell.stdout.write("\x07");
            if (splitRespectingQuotes(this._userinput).length <= 1) { //autocomplete for commands not implemented yet, so require that at least one argument has been started
                return false;
            }
            const autocompleteOptions = this._getCwdCompletions();

            if (autocompleteOptions.length == 0) {
                return false;
            }
            else if (autocompleteOptions.length == 1) {
                this._completeUserInput(autocompleteOptions[0]);
            }
            else if (!this._waitingForDoubleTab) {
                this._waitingForDoubleTab = true;
            }
            else {
                this._displayAutocompleteOptions(autocompleteOptions);
            }
            return false;
        }
        else {
            this._waitingForDoubleTab = false;
        }

        // handle DEL
        if (data.charAt(0) == "\x7f") {
            if (this._cursor > 0) {
                this._delAtCursor();
            }
            return false;
        }
        // catch escape sequences
        if (data.charAt(0) == "\x1b") {
            switch (data.slice(1)) {
                case "[D": // Left
                    if (this._cursor > 0) {
                        this._cursorLeft(1);
                    }
                    break;

                case "[C": // Right
                    if (this._cursor < this._userinput.length) {
                        this._cursorRight(1);
                    }
                    break;
                case "[3~": // Delete
                    if (this._cursor < this._userinput.length) {
                        this._cursorRight(1);
                        this._delAtCursor();
                    }
                    break;
                case "[A": // Up
                    if (this._historyIdx > 0) {
                        this._shell.history[this._historyIdx] = this._userinput;
                        this._historyIdx--;
                        this._updateUserInput(this._shell.history[this._historyIdx]);
                    }
                    break;
                case "[B": // Down
                    if (this._historyIdx < this._shell.history.length - 1) {
                        this._shell.history[this._historyIdx] = this._userinput;
                        this._historyIdx++;
                        this._updateUserInput(this._shell.history[this._historyIdx]);
                    }
                    break;
                default:
                    console.log(`unknown escape sequence ${data}`);
            }
            return false;
        }

        if (data == '') { //CTRL-V
            navigator.clipboard.readText().then((clipboardcontents) => {
                let text = clipboardcontents.replace('\r','\n'); //Clipboard stores linebreaks as \r, when \n should be displayed
                let newuserinput = this._userinput.slice(0, this._cursor) +
                    text +
                    this._userinput.slice(this._cursor);

                this._updateUserInput(newuserinput);
            })
            return false;
        }

        if (data == '') { //CTRL-C; handled in DSTerminal but needs to be screened from the input
            return false;
        }

        // If LF we're done
        if (data == "\r") {
            this._cursorRight(this._userinput.length - this._cursor);
            this._shell.stdout.write("\n");
            return true;
        }
        // ok add the character at current cursor location and update the text
        let newuserinput = this._userinput.slice(0, this._cursor)
            + data
            + this._userinput.slice(this._cursor);

        this._updateUserInput(newuserinput);
        return false;
    }
}