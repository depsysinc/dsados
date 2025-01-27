import { DSProcessError } from "../dsProcess";
import { DSOptionParser } from "../lib/dsOptionParser";
import { DSMDDoc, ImageBlock, DSMDToken, LinkToken } from "../lib/dsMarkdown";
import { DSIDirectory } from "../dsFileSystem";
import { gotoxy, reset, setattr, textattrs } from "../lib/dsCurses";
import { DSKernel } from "../dsKernel";
import { DownArrowAppEvent, DSApp, WheelAppEvent, ResizeAppEvent, TextAppEvent, UpArrowAppEvent, PageUpAppEvent, PageDownAppEvent, TouchStartAppEvent, TouchMoveAppEvent, MouseMoveAppEvent, MouseButtonDownEvent, MouseButtonUpEvent } from "../dsApp";

export class PRDSMDBrowser extends DSApp {

    private _docdir: DSIDirectory;
    private _curdoc: DSMDDoc;
    private _history: string[] = [];
    private _rowidx: number = 0;
    private _touchstart: { col: number; row: number; idx: number };
    _hoverlink: { open: LinkToken; close: LinkToken; };
    // private _hoverlink: LinkToken;

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

        // Start up AppEvent processing
        this.init();
        // inject an initial resize event
        this.eventQueue.enqueue(new ResizeAppEvent());

        let filename = this.argv[nextarg];
        this._docdir = this.cwd;
        this._curdoc = await this.loadDoc(filename);

        const t = DSKernel.terminal;
        while (!this.done) {
            const e = await this.eventQueue.dequeue();
            if (e instanceof ResizeAppEvent) {
                this._curdoc.render(t.cols, t.cellwidth, t.cellheight);
                this._redraw();
            } else if (e instanceof TextAppEvent) {
                if (e.text == 'r') {
                    this._redraw();
                } else if (e.text == 'q') {
                    this.terminate();
                } else if (e.text == 't') {
                    for (let i = 0; i < 3; i++)
                        this.eventQueue.enqueue(new DownArrowAppEvent());
                }

            } else if (e instanceof UpArrowAppEvent) {  // CURSOR KEYS
                if (this._rowidx > 0) {
                    if (this._changeRowidx(-1))
                        this._redraw();
                }
            } else if (e instanceof DownArrowAppEvent) {
                if (this._changeRowidx(1))
                    this._redraw();

            } else if (e instanceof PageUpAppEvent) {
                if (this._changeRowidx(-t.rows))
                    this._redraw();

            } else if (e instanceof PageDownAppEvent) {
                if (this._changeRowidx(t.rows))
                    this._redraw();

            } else if (e instanceof WheelAppEvent) {
                if (this._changeRowidx(e.deltaY < 0 ? -1 : 1))
                    this._redraw();

            } else if (e instanceof TouchStartAppEvent) { // TOUCH
                this._touchstart = { col: e.col, row: e.row, idx: this._rowidx };

            } else if (e instanceof TouchMoveAppEvent) {
                const rowdelta = - e.row + this._touchstart.row - this._rowidx + this._touchstart.idx;
                if (this._changeRowidx(rowdelta))
                    this._redraw();

            // } else if (e instanceof MouseButtonDownEvent) {

            } else if (e instanceof MouseButtonUpEvent) {
                if (this._hoverlink) {
                    console.log(this._hoverlink.open.url);
                }

            } else if (e instanceof MouseMoveAppEvent) { // MOUSE
                const rowidx = e.row + this._rowidx - 1;
                const link = this._curdoc.getlink(e.col, rowidx);
                // deal with link unhighlighting
                if (this._hoverlink != undefined) {
                    if ((link == undefined) ||
                        (link.open != this._hoverlink.open)) {
                        this._redraw();
                    }
                }

                // deal with link highlighting
                if (link != undefined) {
                    if ((this._hoverlink == undefined) ||
                        (this._hoverlink.open != link.open)) {
                            // TODO: Highlight link
                            this.highlightLink(link);
                        }
                }

                // deal with the cursor
                if ((this._hoverlink == undefined) &&
                    (link != undefined)) {
                    DSKernel.terminal.setCursor("pointer");
                }
                if ((this._hoverlink != undefined) &&
                    (link == undefined)) {
                    DSKernel.terminal.setCursor("default");
                }
                this._hoverlink = link;

            } else {
                console.log(e);
            }
        }
        this.stdout.write(reset());
        t.resetSprites();
    }

    private highlightLink(link: { open: LinkToken; close: LinkToken; }) {
        const startrow = this._curdoc.rows.indexOf(link.open.startrow) - this._rowidx + 1;
        const endrow = this._curdoc.rows.indexOf(link.close.startrow) - this._rowidx + 1;

        if (startrow == endrow) {
            const rowtext = DSKernel.terminal.getRow(startrow);
            const linktext = rowtext.slice(link.open.startlen, link.close.startlen);
            this.stdout.write(
                gotoxy(link.open.startlen + 1, startrow) +
                setattr(textattrs.bg_blue) +
                linktext +
                setattr(this._curdoc.bgcolor)
            );
            return;
        }

        // startrow
        if (startrow > 0) {
            const rowtext = DSKernel.terminal.getRow(startrow);
            const linktext = rowtext.slice(link.open.startlen);
            this.stdout.write(
                gotoxy(link.open.startlen + 1, startrow) +
                setattr(textattrs.bg_blue) +
                linktext +
                setattr(this._curdoc.bgcolor)
            );
        }

        for (let i = startrow + 1; i < endrow; i++) {
            if (i < 1)
                continue;
            const rowtext = DSKernel.terminal.getRow(i);
            this.stdout.write(
                gotoxy(1, i) +
                setattr(textattrs.bg_blue) +
                rowtext +
                setattr(this._curdoc.bgcolor)
            );
        }

        // endrow
        if (endrow < DSKernel.terminal.rows) {
            const rowtext = DSKernel.terminal.getRow(endrow);
            const linktext = rowtext.slice(0, link.close.startlen);
            this.stdout.write(
                gotoxy(1, endrow) +
                setattr(textattrs.bg_blue) +
                linktext +
                setattr(this._curdoc.bgcolor)
            );
        }
    }

    private _changeRowidx(val: number) {
        const startidx = this._rowidx;
        this._rowidx += val;
        if (this._rowidx < 0)
            this._rowidx = 0;
        if (this._rowidx > this._curdoc.rows.length - 1)
            this._rowidx = this._curdoc.rows.length - 1;

        if (this._rowidx != startidx)
            return true;
        else
            return false;
    }

    // Redraw the whole screen
    private _redraw() {
        const t = DSKernel.terminal;
        const doc = this._curdoc;
        this.stdout.write(reset());
        for (let j = 0; j < t.rows && j + this._rowidx < doc.rows.length; j++) {
            const row = doc.rows[this._rowidx + j];
            this.stdout.write(gotoxy(1, j + 1) + `${row.text}`);
        }
        // Update the sprites
        // OPT: Check if sprites are actually on screen before enabling.
        for (let i = 0; i < this._curdoc.blocks.length; i++) {
            const block = doc.blocks[i];
            if ((block instanceof ImageBlock) && block.sprite) {
                const sprite = block.sprite;
                sprite.enabled = true;
                sprite.x = 0;
                sprite.y = (block.firstrow - this._rowidx) * doc.cellheight;
            }
        }

    }

    private async loadDoc(filename: string) {

        // Clear screen place loading message
        this.stdout.write(reset() + "LOADING...\n");
        DSKernel.terminal.resetSprites();
        const doc = new DSMDDoc();
        const inode = this.cwd.getfile(filename);
        const text = await inode.contentAsText().read();
        doc.parse(text);
        await doc.loadContent(this.cwd);
        return doc;
    }
}