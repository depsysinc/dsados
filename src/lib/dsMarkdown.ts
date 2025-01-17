import { setattr, textattrs } from "./dsCurses";

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
            return;
        }
        if (this.opening) {
            word.text += setattr(textattrs.italic);
            word.italics_open = true;
        }
        if (this.closing) {
            word.text += setattr(textattrs.noitalic);
            word.italics_close = true;
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
        if (this.opening) {
            word.text += setattr(textattrs.bold);
            word.bold_open = true;
        }
        if (this.closing) {
            word.text += setattr(textattrs.normal);
            word.bold_close = true;
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
    bold_at_close: boolean = false;
    italics_at_close: boolean = false;

    constructor(readonly width: number) { }

    addword() {
        this.text += this.word.text;
        this.length += this.word.length;
        if (this.word.bold_open)
            this.bold_at_close = true;
        if (this.word.bold_close)
            this.bold_at_close = false;
        if (this.word.italics_open)
            this.italics_at_close = true;
        if (this.word.italics_close)
            this.italics_at_close = false;
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
                const carryword = this.word;

                // Carry over attributes
                this.word = new DSMDWord();    // The closing word
                newrow.word = new DSMDWord();  // The opening word
                if (this.bold_at_close) {
                    const boldtoken = new BoldToken();
                    boldtoken.matched = true;
                    boldtoken.closing = true;
                    boldtoken.render(this.word);

                    boldtoken.closing = false;
                    boldtoken.opening = true;
                    boldtoken.render(newrow.word);
                }
                if (this.italics_at_close) {
                    const italicstoken = new ItalicToken();
                    italicstoken.matched = true;
                    italicstoken.closing = true;
                    italicstoken.render(this.word);

                    italicstoken.closing = false;
                    italicstoken.opening = true;
                    italicstoken.render(newrow.word);
                }
                this.addword();
                newrow.addword();
                
                // Start the new row with the new word
                newrow.word = carryword;
                newrow.addword();

                this.word = undefined;

                return newrow;
            }
            // this.word = new DSMDWord(); // Maybe don't need this.
        } else {
            token.render(this.word);
        }
        return undefined;
    }
}

export class DSMDDoc {
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
