import { DSIDirectory } from "../dsFileSystem";
import { DSKernel } from "../dsKernel";
import { DSSprite } from "../dsTerminal";
import { DSIWebFile } from "../filesystem/dsIWebFile";
import { setattr, textattrs } from "./dsCurses";
import { load_image } from "./dsLib";

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

class LinkToken extends MatchToken {
    constructor(readonly linktext: string, private url: string) {
        super();
    }

    render(word: DSMDWord): void {
        if (!this.matched) {
            word.length += 2;
            word.text += "[!LINK!]";
        }
        if (this.opening) {
            word.text += setattr(textattrs.curlyunderline);
            word.link_close = true;
        }
        if (this.closing) {
            word.text += setattr(textattrs.nounderline);
            word.link_close = true;
        }
    }
}

class ListItemToken extends DSMDToken {
    constructor(readonly level: number, readonly spaced: boolean) {
        super();
    }
    render(word: DSMDWord): void {
        // NB: no whitespace token in here because ' ' after dash 
        //  is considered part of same word as the dash
        let prefix = `${" ".repeat((this.level - 1) * 2)}- `;
        word.text += prefix;
        word.length += prefix.length;
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
            // Link tag
            if (unprocessed.startsWith("[")) {
                match = unprocessed.match(/^\[([^\]]*)\]\(([^\)]+)\)/);
                if (match) {
                    const linktext = match[1];
                    const url = match[2];
                    this.tokens.push(new LinkToken(linktext, url));
                    const linkwords = linktext.trim().split(" ");
                    linkwords.forEach((word, idx) => {
                        this.tokens.push(new TextToken(word));
                        if (idx != linkwords.length - 1)
                            this.tokens.push(new WhiteSpaceToken());
                    });
                    this.tokens.push(new LinkToken(linktext, url));
                    unprocessed = unprocessed.slice(match[0].length);
                } else {
                    this.tokens.push(new TextToken("["));
                    unprocessed = unprocessed.slice(1);
                }
                continue;
            }

            // Regular text
            match = unprocessed.match(/^([^\*\[\s]+)/); // /^([^\*\[\s]+)/);
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
                        ((token instanceof ItalicToken) && (matchtoken instanceof ItalicToken)) ||
                        ((token instanceof LinkToken) && (matchtoken instanceof LinkToken))) {
                        token.matched = true;
                        token.opening = true;
                        matchtoken.matched = true;
                        matchtoken.closing = true;
                        break;
                    }
                }
            }
        }
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

        // Code
        match = line.match(CodeBlock.coderegex);
        if (match) {
            this.doc.blocks.push(new CodeBlock(this.doc));
            return;
        }

        // List
        match = line.match(ListBlock.listregex);
        if (match) {
            const listblock = new ListBlock(this.doc);
            this.doc.blocks.push(listblock);
            listblock.parse_line(line);

            return;
        }
        // Image
        match = line.match(ImageBlock.imageregex);
        if (match) {
            const imageblock = new ImageBlock(this.doc, line);
            this.doc.blocks.push(imageblock);
            return;
        }


        // Regular text
        this.handle_text(line);
    }

    // Default block renderer
    render(width: number, rows: DSMDRow[]): void {
        const row = new DSMDRow(width, this);
        row.text = `[!${this.constructor.name}!]`;
        row.length = row.text.length;
        rows.push(row);
    };

    abstract debugstr(indent: string): string;
}

export class ImageBlock extends DSMDBlock {
    static readonly imageregex = /^!\[([^\]]*)\]\(([^\)]+)\)(?:\(([^\)]+)\))?/;

    firstrow: number;
    
    alttext: string = undefined;
    imgurl: string = undefined;
    linkurl: string = undefined;

    img: HTMLImageElement = undefined;
    imgcellwidth: number = undefined;
    imgcellheight: number = undefined;
    sprite: DSSprite = undefined;

    constructor(doc: DSMDDoc, line: string) {
        super(doc);
        const match = line.match(ImageBlock.imageregex);
        if (!match)
            throw new Error("ImageBlock parse error");
        this.alttext = match[1];
        this.imgurl = match[2];
        this.linkurl = match[3];

        this.tokenize(line.slice(match[0].length));
    }

    protected handle_emptyline(): void {
        this.doc.blocks.push(new NullBlock(this.doc));
    }

    protected handle_text(line: string): void {
        this.tokenize(line);
    }

    finalize(): void {
        // Trim leading whitespace tokens
        while ((this.tokens.length > 0) && (this.tokens[0] instanceof WhiteSpaceToken))
            this.tokens = this.tokens.slice(1);
        super.finalize();
    }

    render(width: number, rows: DSMDRow[]): void {
        this.firstrow = rows.length;

        if (this.img) {
            const imgrows: DSMDRow[] = [];
            this.imgcellheight = Math.ceil(this.img.height/this.doc.cellheight);
            this.imgcellwidth = Math.ceil(this.img.width/this.doc.cellwidth);
            let currow = new DSMDRow(width,this);
            currow.indent = this.imgcellwidth + 1;
            currow.text = " ".repeat(currow.indent-1);
            currow.length = currow.text.length;
            imgrows.push(currow);
            // Parse paragraph tokens
            this.tokens.forEach((token)=>{
                let newrow = currow.addtoken(token);
                if (newrow) {
                    imgrows.push(newrow);
                    currow = newrow;
                }
            });
            // Fill out any missing rows
            for (let i = imgrows.length; i < this.imgcellheight; i++) {
                const imgrow = new DSMDRow(width,this);
                imgrow.text = " ".repeat(this.imgcellwidth);
                imgrow.length = imgrow.text.length;
                imgrows.push(imgrow);
            }
            rows.push(...imgrows);
            return;
        }
        // Handle the alttext case
        const altrow = new DSMDRow(width,this);
        altrow.text = `[${this.alttext}]`;
        altrow.length = altrow.text.length;
        rows.push(altrow);

        if (this.tokens.length == 0)
            return;

        // Handle trailing text
        let currow = new DSMDRow(width,this);
        currow.indent = 2;
        currow.text = " ";
        currow.length = 1;
        rows.push(currow);
        this.tokens.forEach((token) => {
            let newrow = currow.addtoken(token);
            if (newrow) {
                rows.push(newrow);
                currow = newrow;
            }
        });
    }

    debugstr(indent: string): string {
        let str = `${indent}[ImageBlock] [${this.alttext}](${this.imgurl})(${this.linkurl})\n`;
        return str;
    }
}

class ListBlock extends DSMDBlock {
    static readonly listregex = /^(| {2}| {4})\-\s(.+)/;

    lastlineempty: boolean = false;
    spacedlist: boolean = false;

    constructor(doc: DSMDDoc) {
        super(doc);
    }

    protected handle_emptyline(): void {
        this.lastlineempty = true;
    }

    protected handle_text(line: string): void {
        if (this.lastlineempty) {
            const paragraph = new ParagraphBlock(this.doc);
            this.doc.blocks.push(paragraph);
            paragraph.parse_line(line);
        } else {
            this.lastlineempty = false;
            this.tokenize(line);
        }
    }

    public parse_line(line: string): void {
        // Look for list item
        const match = line.match(ListBlock.listregex);
        if (match) {
            // Create a new list item token
            const level = (match[1].length / 2 + 1);
            const itemtoken = new ListItemToken(level, this.lastlineempty);
            this.lastlineempty = false;
            this.tokens.push(itemtoken);
            this.tokenize(match[2]);
        } else {
            super.parse_line(line);
        }
    }

    render(width: number, rows: DSMDRow[]): DSMDRow[] {
        // start with sacrificial row
        let currow = new DSMDRow(width,this);
        this.tokens.forEach((token) => {
            let newrow = currow.addtoken(token);
            if (newrow) {
                if ((token instanceof ListItemToken) && (token.spaced))
                    rows.push(new DSMDRow(width,this));
                rows.push(newrow);
                currow = newrow;
            }
        });
        return rows;
    }

    debugstr(indent: string): string {
        let str = `${indent}[ListBlock]\n`;
        return str;
    }

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

    // Fully custom line parser
    public parse_line(line: string): void {
        if (line.match(CodeBlock.coderegex)) {
            this.doc.blocks.push(new NullBlock(this.doc));
            return;
        }
        this.rawlines.push(line);
    }

    // Fully custom renderer
    render(width: number, rows: DSMDRow[]): void {
        this.rawlines.forEach((line) => {
            const row = new DSMDRow(width,this);
            row.length = width;
            row.text = line.slice(0, width);
            row.text = row.text.padEnd(width);
            row.text = setattr(`${textattrs.bg_black};${textattrs.dim}`)
                + row.text + setattr(`${textattrs.bg_default};${textattrs.normal}`);
            rows.push(row);
        });
    };
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
        let currow = new DSMDRow(width, this);
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

    render(width: number, rows: DSMDRow[]): DSMDRow[] {
        // Title starts with new row
        let maxlength = 0;
        let currow = new DSMDRow(width,this);
        rows.push(currow);
        this.tokens.forEach((token) => {
            let newrow = currow.addtoken(token);
            if (newrow) {
                rows.push(newrow);
                maxlength = currow.length > maxlength ? currow.length : maxlength;
                currow = newrow;
            }
        });
        // Pad out the last row to the max length
        for (let i = currow.length; i < maxlength; i++) {
            currow.text += " ";
            currow.length += 1;
        }
        // Now add attrs to last row
        let openattr = "";
        let closeattr = setattr(textattrs.nounderline);
        if (this.level == 1) {
            openattr = setattr(textattrs.doubleunderline);
        } else if (this.level == 2) {
            openattr = setattr(textattrs.underline);
        } else if (this.level == 3) {
            openattr = setattr(textattrs.dottedunderline);
        }
        currow.text = openattr + currow.text + closeattr;
        return rows;
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
    link_open: boolean = false;
    link_close: boolean = false;
}

class DSMDRow {
    text: string = "";
    length: number = 0;
    indent: number = 0;
    word: DSMDWord = new DSMDWord();
    bold_at_close: boolean = false;
    italics_at_close: boolean = false;
    link_at_close: boolean = false;

    constructor(readonly width: number, readonly block: DSMDBlock) { }

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

        if (this.word.link_open)
            this.link_at_close = true;
        if (this.word.link_close)
            this.link_at_close = false;
        this.word = new DSMDWord();

    }

    addtoken(token: DSMDToken): DSMDRow {
        // console.log(`${token.constructor.name} : ${this.word.length} : ${this.word.text}`);
        if (token instanceof ListItemToken) {
            // Reset indent
            this.indent = 0;
            const newrow = this.finalize();
            newrow.indent = token.level * 2;
            token.render(newrow.word);
            return newrow;
        } else if (token instanceof WhiteSpaceToken) {
            // If empty row, then just add it
            if (this.length == 0) {
                this.addword();
            } else if (this.length + this.word.length + 1 <= this.width) {
                this.text += " ";
                this.length += 1;
                this.addword();
            } else {
                return this.finalize();
            }
        } else {
            token.render(this.word);
        }
        return undefined;
    }

    finalize(): DSMDRow {
        // Finalize this row
        const carryword = this.word;
        const newrow = new DSMDRow(this.width,this.block);

        // Carry over attributes
        this.word = new DSMDWord();    // The closing word
        newrow.word = new DSMDWord();  // The opening word
        let termtokens: MatchToken[] = [];
        if (this.bold_at_close)
            termtokens.push(new BoldToken());

        if (this.italics_at_close)
            termtokens.push(new ItalicToken());

        termtokens.forEach((matchtoken) => {
            matchtoken.matched = true;
            matchtoken.closing = true;
            matchtoken.render(this.word);

            matchtoken.closing = false;
            matchtoken.opening = true;
            matchtoken.render(newrow.word);
        });

        this.addword();
        newrow.addword();
        if (this.indent > 0) {
            newrow.indent = this.indent;
            const indentword = new DSMDWord();
            indentword.text = " ".repeat(newrow.indent);
            indentword.length = indentword.text.length;
            newrow.word = indentword;
            newrow.addword();
        }

        // Start the new row with the new word
        newrow.word = carryword;
        newrow.addword();

        return newrow;

    }
}

export class DSMDDoc {
    public blocks: DSMDBlock[] = [];
    public rows: DSMDRow[] = [];
    public cellwidth: number;
    public cellheight: number;

    parse(text: string): void {
        this.blocks = [new NullBlock(this)];

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

    async loadContent(dir: DSIDirectory) {
        for(let i = 0; i < this.blocks.length; i++) {
            const block = this.blocks[i];
            if (block instanceof ImageBlock) {
                try{
                    // Look up the file
                    const inode = dir.getfile(block.imgurl);
                    if (!(inode instanceof DSIWebFile))
                        continue;
                    // Do the img load
                    block.img = await load_image(inode.url);
                    // Create the sprite
                    block.sprite = DSKernel.terminal.newSprite([block.img]);
                } catch (e) {
                    
                }
            }
        };
    }

    render(width: number, cellwidth: number, cellheight: number) {
        this.cellwidth = cellwidth;
        this.cellheight = cellheight;
        this.rows = [];
        this.blocks.forEach((block, idx) => {
            block.render(width, this.rows);
            if (idx != this.blocks.length - 1)
                this.rows.push(new DSMDRow(width,undefined));
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
