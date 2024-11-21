import { DSProcess } from "../dsProcess";

export class DSShell extends DSProcess {
    private _prompt: CommandLinePrompt;

    get procname(): string {
        return "dssh";
    }
    protected main(): void {
        this._prompt = new CommandLinePrompt(this);
        this._commandLoop();
    }

    private async _commandLoop() {

        while (true) {
            const input = await this._prompt.promptForInput();

            // TODO: Handle "" when tokenizing
            const tokens = splitRespectingQuotes(input);
            const command = tokens[0];
            switch (command) {
                case "": // empty command, do nothing
                    break;
                case "exit":
                    this._exit(0);
                    return;
                default:
                    await this.t.baudText(`${command}: command not found\n`);
            }
        }
    }

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
    private _prompt: string;
    private _userinput: string = "";
    private _cursor: number = 0;

    private _inputbuffer: string[] = [];
    private _inputresolver: (value: string | PromiseLike<string>) => void;

    constructor(private _shell: DSShell) {
        this._prompt = "guest@depsys.io:/$ ";
    }

    async promptForInput(): Promise<string> {
        this._userinput = "";
        this._cursor = 0;

        const t = this._shell.t;
        await t.baudText(this._prompt);

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