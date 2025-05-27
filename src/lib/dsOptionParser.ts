export class DSOptionParserError extends Error {
    constructor(message: string) {
        super(message);
        Object.setPrototypeOf(this, DSOptionParserError.prototype); 
        this.name = this.constructor.name;
    }
}

export type DSOption = {
    long: string;
    short: string;
    required: boolean;
    takesArgument: boolean;
    argName: string;
    description: string;
}

export type DSParsedOption = {
    option: DSOption;
    seen: boolean;
    argument: string;
}

export class DSOptionParser {
    options: DSOption[] = [];
    parsed: DSParsedOption[] = [];

    constructor(
        readonly command: string,
        addhelp: boolean = true,
        readonly description: string = undefined,
        readonly args: string = undefined
    ) {
        if (addhelp)
            this.addoption({
                long: "help",
                short: "h",
                required: false,
                takesArgument: false,
                argName: "",
                description: "output usage information and exit"
            });
    }

    addoption(opt: DSOption): void {
        // TODO: check for duplicate options
        this.options.push(opt);
    }

    getShortOption(opt: string): DSParsedOption {
        return this.parsed.find(po => po.option.short === opt);
    }

    getLongOption(opt: string): DSParsedOption {
        return this.parsed.find(po => po.option.long === opt);
    }

    usage(): string {
        let usagestr = `usage: ${this.command} `;
        let optlist = "";
        // build options strings
        let usagereq = "<-";
        let usagereqargs = "";
        let usageopt = "[-";
        let usageoptargs = "";
        this.options.forEach((opt) => {
            if (opt.short.length > 0) {
                if (opt.takesArgument) {
                    if (opt.required)
                        usagereqargs += `<-${opt.short} ${opt.argName}> `;
                    else
                        usageoptargs += `[-${opt.short} ${opt.argName}] `;
                } else {
                    if (opt.required)
                        usagereq += opt.short;
                    else
                        usageopt += opt.short;
                }

                optlist += ` -${opt.short}`;
                optlist += (opt.long.length > 0) ? ", " : "  "

            } else
                optlist += "     ";

            if (opt.long.length > 0) {
                optlist += `--${opt.long.padEnd(10)} `;
            } else
                optlist += "".padEnd(13);

            optlist += opt.description + "\n";
        });

        if (usagereq.length > 2)
            usagestr += usagereq + "> ";
        if (usageopt.length > 2)
            usagestr += usageopt + "] ";
        // TODO: add arg taking options
        usagestr += usagereqargs + usageoptargs;
        if (this.args)
            usagestr += this.args
        usagestr += "\n";
        if (this.description)
            usagestr += "\n" + this.description + "\n\n";
        usagestr += optlist;
        return usagestr;
    }

    // return index of first non option arg
    parse(argv: string[]): number {
        // Check empty array case
        if (argv.length == 0)
            return -1;

        // Initialize the parsed options list
        this.parsed = [];
        this.options.forEach((opt) => {
            this.parsed.push({
                option: opt,
                seen: false,
                argument: ""
            })
        });

        // Walk the options
        let i = 1;
        while (i < argv.length) {
            const curarg = argv[i];
            // Check the non-opt-arg case
            if (!curarg.startsWith("-")) {
                break;
            }
            let opt: DSParsedOption = undefined;

            if (curarg.startsWith("--")) { // Long opt
                // TODO handle bare --
                opt = this.getLongOption(curarg.slice(2));
            } else if (curarg.startsWith("-")) { // Short opt
                if (curarg.length != 2) // bad opt length
                    throw new DSOptionParserError("invalid option");
                opt = this.getShortOption(curarg.charAt(1));
            } else { // non-opt arg
                break;
            }

            if (!opt)
                throw new DSOptionParserError("unknown option");
            if (opt.seen)
                throw new DSOptionParserError("duplicate option")
            opt.seen = true;

            if (opt.option.takesArgument) {
                i++;
                if (i >= argv.length)
                    throw new DSOptionParserError("missing argument");
                opt.argument = argv[i];
            }

            i++; // next arg
        }
        // Check that all requred args given
        this.parsed.forEach((parsedopt) => {
            if (parsedopt.option.required && !parsedopt.seen)
                throw new DSOptionParserError("required option missing");
        });
        if (i >= argv.length)
            return -1;
        return i;
    }

    // Convenience method to catch parse errors
    // and rethrow with usage info
    parseWithUsageAndHelp(argv: string[]): number {
        let nextarg: number;
        try {
            nextarg = this.parse(argv);
        } catch (e) {
            throw new DSOptionParserError(e.message + "\n" + this.usage());
        }
        const helpopt = this.getShortOption("h");
        if (helpopt.seen)
            throw new DSOptionParserError(this.usage());

        return nextarg;
    }

}