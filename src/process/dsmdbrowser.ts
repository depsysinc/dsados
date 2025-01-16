import { DSProcess, DSProcessError } from "../dsProcess";
import { reset, setattr, textattrs } from "../lib/dsCurses";
import { DSOptionParser } from "../lib/dsOptionParser";

// TOKENS
abstract class DSMDToken {
    render(word: DSMDWord) { 
        throw new Error(`${this.constructor.name} render unsupported`);
    }
}

class TextToken extends DSMDToken {
    constructor(private text: string) {
        super();
    }

    render(word: DSMDWord): void {
        word.text += this.text;
        word.length += this.text.length;
    }

    toString(): string {
        return `[TextToken] ${this.text}`;
    }
}

class WhiteSpaceToken extends DSMDToken {
    toString(): string {
        return `[WhiteSpaceToken]`;
    }
}

abstract class MatchToken extends DSMDToken {
    public matched = false;
    public opening = false;
    public closing = false;
}

class ItalicToken extends MatchToken {
    render(word: DSMDWord): void {
        if (!this.matched) {
            word.length += 1;
            word.text += "*";
        }
    }

    toString(): string {
        return `[ItalicToken] matched:${this.matched}`;
    }
}

class BoldToken extends MatchToken {
    render(word: DSMDWord): void {
        if (!this.matched) {
            word.length += 2;
            word.text += "**";
        }
    }

    toString(): string {
        return `[BoldToken] matched:${this.matched}`;
    }
}

// BLOCKS

abstract class DSMDBlock {
    protected tokens: DSMDToken[] = [];

    constructor(readonly doc: DSMDDoc) { }

    protected tokenize(line: string): void {
        let unprocessed = line.trim();
        while (unprocessed.length > 0) {
            let match: RegExpMatchArray;
            // Italics/bold/both
            match = unprocessed.match(/^(\*{1,3})/);
            if (match) {
                unprocessed = unprocessed.slice(match[1].length);
                switch (match[1].length) {
                    case (1):
                        this.tokens.push(new ItalicToken());
                        break;
                    case (2):
                        this.tokens.push(new BoldToken());
                        break;
                    case (3):
                        this.tokens.push(new ItalicToken());
                        this.tokens.push(new BoldToken());
                        break;
                }
                continue;
            }
            // Regular text
            match = unprocessed.match(/^([^\*\[\s]+)/);
            if (match) {
                unprocessed = unprocessed.slice(match[1].length);
                this.tokens.push(new TextToken(match[1]));
                continue;
            }
            // Whitespace
            match = unprocessed.match(/^(\s+)/);
            if (match) {
                unprocessed = unprocessed.slice(match[1].length);
                this.tokens.push(new WhiteSpaceToken());
                continue;
            }
            console.log("Unparsable token!");
            console.log(unprocessed);
            break;
        }
        // Append a whitespace token to signal EOL
        this.tokens.push(new WhiteSpaceToken());
    }

    finalize() {
        // Match emphasis tokens
        for (let i = 0; i < this.tokens.length; i++) {
            const token = this.tokens[i];
            if ((token instanceof MatchToken) &&
                (!token.matched) &&
                (i != this.tokens.length - 1)) {
                for (let j = i + 1; j < this.tokens.length; j++) {
                    const matchtoken = this.tokens[j];
                    if (!(matchtoken instanceof MatchToken))
                        continue;
                    if (((token instanceof BoldToken) && (matchtoken instanceof BoldToken)) ||
                        ((token instanceof ItalicToken) && (matchtoken instanceof ItalicToken))) {
                        token.matched = true;
                        token.opening = true;
                        matchtoken.matched = true;
                        matchtoken.closing = true;
                        break;
                    }
                }
            }
        }
        // Compress whitespace
    }

    protected handle_emptyline() { }
    protected handle_text(line: string) { }

    public parse_line(line: string): void {
        let match: RegExpMatchArray;

        // Empty line
        const emptylineregex = /^\s*$/;
        match = line.match(emptylineregex);
        if (match) {
            this.handle_emptyline();
            return;
        }

        // Title
        const titleregex = /^(#{1,3})\s+(.+)/;
        match = line.match(titleregex);
        if (match) {
            const titlelevel = match[1].length;
            const titlestring = match[2];
            this.doc.blocks.push(new TitleBlock(this.doc, titlelevel, titlestring));
            this.doc.blocks.push(new NullBlock(this.doc));
            return;
        }

        // Codeblock
        match = line.match(CodeBlock.coderegex);
        if (match) {
            this.doc.blocks.push(new CodeBlock(this.doc));
            return;
        }

        // List

        // Regular text
        this.handle_text(line);
    }

    render(width: number, rows: DSMDRow[]): void { };

    abstract debugstr(indent: string): string;
}

class CodeBlock extends DSMDBlock {
    static readonly coderegex = /^```[^`]*/;
    rawlines: string[] = [];

    debugstr(indent: string): string {
        let str = `${indent}[CodeBlock] lines: ${this.rawlines.length}\n`;
        this.rawlines.forEach((line, i) => {
            str += `${indent}${i}:${line}\n`;
        });
        return str;
    }

    public parse_line(line: string): void {
        if (line.match(CodeBlock.coderegex)) {
            this.doc.blocks.push(new NullBlock(this.doc));
            return;
        }
        this.rawlines.push(line);
    }
}

class NullBlock extends DSMDBlock {
    debugstr(indent: string): string {
        return `${indent}[NullBlock]\n`;
    }

    protected handle_text(line: string): void {
        // If we're getting some regular text
        // then it's time to start a paragraph
        const paragraph = new ParagraphBlock(this.doc);
        this.doc.blocks.push(paragraph);
        paragraph.parse_line(line);
    }
}

class ParagraphBlock extends DSMDBlock {
    debugstr(indent: string): string {
        let str = `${indent}[ParagraphBlock] tokens:${this.tokens.length}\n`;
        this.tokens.forEach((token) => {
            str += `${indent}  ${token}\n`;
        });
        return str;
    }

    protected handle_emptyline(): void {
        this.doc.blocks.push(new NullBlock(this.doc));
    }

    protected handle_text(line: string): void {
        this.tokenize(line);
    }
    render(width: number, rows: DSMDRow[]): DSMDRow[] {
        // Paragraph starts with a new row
        let currow = new DSMDRow(width);
        rows.push(currow);
        this.tokens.forEach((token) => {
            let newrow = currow.addtoken(token);
            if (newrow) {
                rows.push(newrow);
                currow = newrow;
            }
        });
        return rows;
    }
}

class TitleBlock extends DSMDBlock {

    constructor(doc: DSMDDoc, readonly level: number, titlestring: string) {
        super(doc);
        this.tokenize(titlestring);
    }

    debugstr(indent: string): string {
        let str = `${indent}[TitleBlock] level:${this.level} tokens:${this.tokens}\n`;
        return str;
    }
}

// DOC

class DSMDWord {
    text: string = "";
    length: number = 0;

    italics_open: boolean = false;
    italics_close: boolean = false;
    bold_open: boolean = false;
    bold_close: boolean = false;
}

class DSMDRow {
    text: string = "";
    length: number = 0;
    word: DSMDWord = new DSMDWord();

    constructor(readonly width: number) {}

    addword() {
        this.text += this.word.text;
        this.length += this.word.length;
        this.word = new DSMDWord();
    }

    addtoken(token: DSMDToken): DSMDRow {
        // console.log(`${token.constructor.name} : ${this.word.length} : ${this.word.text}`);
        if (token instanceof WhiteSpaceToken) {
            // If empty row, then just add it
            if (this.length == 0) {
                this.addword();
            } else if (this.length + this.word.length + 1 <= this.width) {
                this.text += " ";
                this.length += 1;
                this.addword();
            } else {
                // Finalize this row
                const newrow = new DSMDRow(this.width);
                newrow.word = this.word;
                newrow.addword();
                this.word = undefined;
                this.finalize();
                return newrow;
            }
            // this.word = new DSMDWord(); // Maybe don't need this.
        } else {
            token.render(this.word);
        }
        return undefined;
    }
    finalize() {
        // 
        // Close out all the active attributes
    }
}

class DSMDDoc {
    public blocks: DSMDBlock[] = [];
    public rows: DSMDRow[] = [];

    constructor() {
        this.blocks.push(new NullBlock(this));
    }

    parse(text: string): void {
        const lines = text.split('\n');
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (line.match(/^<!ENDDOC!>/))
                break;
            const curblock = this.blocks[this.blocks.length - 1];
            curblock.parse_line(line);
        };
        // Clean out all the NullBlocks
        let cleanblocks: DSMDBlock[] = [];
        this.blocks.forEach((block) => {
            if (!(block instanceof NullBlock))
                cleanblocks.push(block);
        });
        this.blocks = cleanblocks;
        // Finalize the blocks
        this.blocks.forEach((block) => {
            block.finalize();
        });
    }

    render(width: number) {
        this.rows = [];
        this.blocks.forEach((block, idx) => {
            block.render(width, this.rows);
            if (idx != this.blocks.length - 1)
                this.rows.push(new DSMDRow(width));
        });
    }

    debugstr(indent: string): string {
        let str = `${indent}[RootBlock]\n`;
        this.blocks.forEach((block) => {
            str += block.debugstr(indent + "  ");
        });
        return str;
    }
}

export class PRDSMDBrowser extends DSProcess {

    protected async main(): Promise<void> {
        const optparser = new DSOptionParser(
            this.procname,
            true,
            "   a markdown browser",
            "<mdfile>"
        );
        let nextarg = optparser.parseWithUsageAndHelp(this.argv);
        if (nextarg == -1)
            throw new DSProcessError(optparser.usage());

        let filename = this.argv[nextarg];
        const inode = this.cwd.getfile(filename);
        const text = await inode.contentAsText().read();
        const doc = new DSMDDoc();
        doc.parse(text);

        let width = 25;
        while (true) {

            doc.render(width);
    
            let fillstr: string = `${width}`;
            fillstr = fillstr.padEnd(width,"#");
    
            reset(this.stdout);
            setattr(this.stdout, textattrs.fg_green);
            this.stdout.write(fillstr+"\n");
            doc.rows.forEach((row, idx) => {
                this.stdout.write(`${row.text}\n`);
            });
            this.stdout.write(fillstr+"\n");
            // this.stdout.write(doc.debugstr(""));
    
            const char = await this.stdin.read();
            if (char == "\x1b[D") {
                width -= 1;
            } else if (char == "\x1b[C") {
                width += 1;
            }
        }
    }
}