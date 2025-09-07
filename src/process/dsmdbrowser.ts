import { DSProcessError } from "../dsProcess";
import { DSOptionParser } from "../lib/dsOptionParser";
import { DSMDDoc, ImageBlock, DSMDToken, LinkToken } from "../lib/dsMarkdown";
import { DSIDirectory } from "../dsFileSystem";
import { gotoxy, reset, setattr, textattrs } from "../lib/dsCurses";
import { DSKernel } from "../dsKernel";
import { DownArrowAppEvent, DSApp, WheelAppEvent, ResizeAppEvent, TextAppEvent, UpArrowAppEvent, PageUpAppEvent, PageDownAppEvent, TouchStartAppEvent, TouchMoveAppEvent, MouseMoveAppEvent, MouseButtonDownEvent as MouseButtonDownAppEvent, MouseButtonUpEvent as MouseButtonUpAppEvent, TouchEndAppEvent, LeftArrowAppEvent, HistoryAppEvent } from "../dsApp";

export type HistoryState =
    {
        filepath: string;
        row: number;
    }


export class PRDSMDBrowser extends DSApp {

    private _curdoc: DSMDDoc;
    private _rowidx: number = 0;
    private _touchstart: { col: number; row: number; idx: number };
    private _hoverlink: LinkToken;
    private _err404: string;
    private _currentfilename: string;
    private _savedrowsbypage: Map<string, number> = new Map<string, number>();

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

        // Load assets
        this._err404 = await this.cwd.getfile("/data/app/dsmdbrowser/404.dsmd").contentAsText().read();
        // Start up AppEvent processing
        this.init();

        let filename = this.argv[nextarg];
        this._currentfilename = filename;
        history.replaceState({ filepath: filename }, "");
        await this._loadDoc(filename);
        
        const t = DSKernel.terminal;
        while (!this.done) {
            const e = await this.eventQueue.dequeue();
            if (e instanceof ResizeAppEvent) {
                this._curdoc.render(t.cols, t.cellwidth, t.cellheight);
                this._redraw();

            } else if (e instanceof HistoryAppEvent) {
                if (history.state != null) {
                    this._savedrowsbypage.set(this._currentfilename, this._rowidx);
                    this._currentfilename = history.state.filepath;
                    if (this._savedrowsbypage.has(this._currentfilename)) {
                        this._rowidx = this._savedrowsbypage.get(this._currentfilename);
                    }
                    else {
                        this._rowidx = 0;
                    }
                    await this._loadDoc(history.state.filepath);
                } else {
                    console.log("history.state was null. Event: ");
                    console.log(e);
                }

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

            } else if (e instanceof LeftArrowAppEvent) {
                history.back();

            } else if (e instanceof WheelAppEvent) {
                if (Math.abs(e.deltaX) < Math.abs(e.deltaY) && this._changeRowidx(e.deltaY < 0 ? -1 : 1))
                    this._redraw();

            } else if (e instanceof TouchStartAppEvent) { // TOUCH
                t.xterm.blur(); //Prevent keyboard from popping up on Android
                this._touchstart = { col: e.col, row: e.row, idx: this._rowidx };
                const rowidx = e.row + this._rowidx - 1;
                const link = this._curdoc.getlink(e.col, rowidx);
                if (link) {
                    this._hoverlink = link;
                    this.highlightLink(link);
                }

            } else if (e instanceof TouchMoveAppEvent) {
                // If we're moving then forget the hovered link
                this._hoverlink = undefined;
                const rowdelta = - e.row + this._touchstart.row - this._rowidx + this._touchstart.idx;
                if (this._changeRowidx(rowdelta))
                    this._redraw();

            } else if (e instanceof TouchEndAppEvent) {
                // If this is a link click then load
                if (this._hoverlink) {
                    await this.openLink(this._hoverlink.url);
                    this._hoverlink = undefined;
                }

            } else if (e instanceof MouseButtonUpAppEvent) { // MOUSE
                if (this._hoverlink && e.button == 0) {
                    await this.openLink(this._hoverlink.url);
                    this._hoverlink = undefined;
                    DSKernel.terminal.setCursor("default");
                }

            } else if (e instanceof MouseButtonDownAppEvent) {
                if (e.button == 3) {
                    history.back();
                } else if (e.button == 4) {
                    history.forward();
                }

            } else if (e instanceof MouseMoveAppEvent) {
                const rowidx = e.row + this._rowidx - 1;
                const link = this._curdoc.getlink(e.col, rowidx);
                // deal with link unhighlighting
                if (this._hoverlink != undefined) {
                    if ((link == undefined) ||
                        (link != this._hoverlink)) {
                        this._redraw();
                    }
                }

                // deal with link highlighting
                if (link != undefined) {
                    if ((this._hoverlink == undefined) ||
                        (this._hoverlink != link)) {
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

    private async openLink(url: string) {
        // Check for external link
        if (url.startsWith("http")) {
            window.open(url, '_blank');
        } 
        else if (url.startsWith('cmd: ')) {
            let commands = url.split(' ');
            commands.shift(); //remove cmd:
            let process = commands[0];
            await DSKernel.exec(process, commands);
            this._redraw();
        
        } else {
            this._savedrowsbypage.set(this._currentfilename, this._rowidx);
            this._rowidx = 0;
            history.pushState({ filepath: url }, '');
            this._currentfilename = url;
            await this._loadDoc(url);
        }
    }

    private highlightLink(openlink: LinkToken) {
        const closelink = openlink.closingtoken;
        const startrow = this._curdoc.rows.indexOf(openlink.startrow) - this._rowidx + 1;
        const endrow = this._curdoc.rows.indexOf(closelink.startrow) - this._rowidx + 1;

        if (startrow == endrow) {
            if (openlink.startlen == closelink.startlen) {
                return;
            }

            const rowtext = DSKernel.terminal.getRow(startrow);
            const linktext = rowtext.slice(openlink.startlen, closelink.startlen);
            this.stdout.write(
                gotoxy(openlink.startlen + 1, startrow) +
                setattr(textattrs.bg_blue) +
                linktext +
                setattr(this._curdoc.bgcolor)
            );
            return;
        }

        // startrow
        if (startrow > 0) {
            const rowtext = DSKernel.terminal.getRow(startrow);
            const linktext = rowtext.slice(openlink.startlen);
            this.stdout.write(
                gotoxy(openlink.startlen + 1, startrow) +
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
            const linktext = rowtext.slice(0, closelink.startlen);
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

        if (this._curdoc.rows.length == 0) { //Document hasn't been loaded yet, so don't let row updates go through
            this._rowidx = 0;
            return false;
        }
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
        this.stdout.write(setattr(`${this._curdoc.fgcolor};${this._curdoc.bgcolor}`));
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

    private async _loadDoc(filepath: string) {

        // Clear screen place loading message
        DSKernel.terminal.resetSprites();
        this.stdout.write(reset() + `LOADING [${filepath}]\n`);
        try {
            const inode = this.cwd.getfile(filepath);
            const text = await inode.contentAsText().read();
            this._curdoc = new DSMDDoc();
            this._curdoc.parse(text);
            await this._curdoc.loadContent(this.cwd);
        } catch (e) {
            this._curdoc = new DSMDDoc();
            this._curdoc.parse(this._err404 + `\n\n[${e}]`);
        }

        this.eventQueue.enqueue(new ResizeAppEvent());
    }
}