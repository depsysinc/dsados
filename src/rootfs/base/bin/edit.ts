import { BackspaceAppEvent, DeleteAppEvent, DownArrowAppEvent, DSApp, LeftArrowAppEvent, MouseButtonDownEvent, MouseButtonUpEvent, MouseMoveAppEvent, PageDownAppEvent, PageUpAppEvent, RightArrowAppEvent, TextAppEvent, TouchEndAppEvent, TouchMoveAppEvent, TouchStartAppEvent, UpArrowAppEvent, WheelAppEvent } from "../../../dsApp";
import { DSKernel } from "../../../dsKernel";
import { DSProcessError } from "../../../dsProcess";
import { cursordown, cursornextline, cursorright, cursorup, reset_text, set_cursor, setattr, textattrs } from "../../../lib/dsCurses";
import { DSOptionParser } from "../../../lib/dsOptionParser";
import { getFileName } from "../../../lib/dsPath";
import { DSIDBFile } from "../../../filesystem/dsIDBFile";
import { sleep } from "../../../lib/dsLib";
import { getDirPath } from "../../../lib/dsPath";


export class PREdit extends DSApp {

    private lines: string[];
    private text: string;

    private rowidx: number = 0;
    private filepath: string;

    private mouserow: number = null;
    private cursorpos: number = 0;

    private editmode: boolean = false;

    private inode: DSIDBFile;

    protected async main(): Promise<void> {
        const optparser = new DSOptionParser(
            this.procname,
            true,
            "  reader for text files",
            "<filename>"
        );
        let nextarg = optparser.parseWithUsageAndHelp(this.argv);
        if (nextarg == -1) {
            throw new DSProcessError(optparser.usage());
        }
        this.filepath = this.argv[nextarg];
        let tempinode
        try {
            tempinode = this.cwd.getfile(this.filepath);
        } catch (e) {
            let filedir = this.cwd.getdir(getDirPath(this.filepath));
            tempinode = filedir.fs.createInode();
            filedir.addfile(getFileName(this.filepath), tempinode)

        }

        tempinode.perms.checkWrite();
        this.inode = tempinode as DSIDBFile;

        DSKernel.terminal.reset();


        this.init();
        this.text = await this.inode.contentAsText().read();
        this.cursorpos = this.text.length;

        this.display()

        while (!this.done) {
            let e = await this.eventQueue.dequeue();
            if (e instanceof WheelAppEvent) {
                let change = e.deltaY < 0 ? -1 : 1
                this.setrowidx(this.rowidx + change);
                this.display();
            }
            if (e instanceof TextAppEvent && !this.editmode) {
                if (e.text == 'q') {
                    DSKernel.terminal.reset();
                    this.done = true;
                }
                if (e.text == 'g') {
                    this.setrowidx(0);
                    this.display();
                }
                if (e.text == 'G') {
                    this.setrowidx(this.maxrowidx);
                    this.display();
                }
                if (e.text == ' ') {
                    this.setrowidx(this.rowidx + 7);
                    this.display();
                }
                if (e.text == '') { //CTRL - e
                    this.enterEditMode()
                }
                if (e.text == '/' || e.text == '?' || e.text == 'h') {
                    await DSKernel.exec('/bin/man', ['', 'edit'])
                    this.display();
                }
            }

            if (e instanceof TextAppEvent && this.editmode) {
                if (e.text == '') { // CTRL-s
                    this.exitEditMode()
                }
                let char
                if (e.text.charCodeAt(0) == 13) { //Enter sends a carriage return, put a linebreak instead
                    char = "\n"
                }
                else {
                    char = e.text;
                }
                let newtext = this.text.slice(0, this.cursorpos) + char + this.text.slice(this.cursorpos);
                this._updateText(newtext);
            }

            if (e instanceof DeleteAppEvent && this.editmode) {
                this._cursorRight(1);
                if (this.cursorpos > 0) {
                    this._delAtCursor();
                }
            }

            if (e instanceof BackspaceAppEvent && this.editmode) {
                if (this.cursorpos > 0) {
                    this._delAtCursor();
                }
            }

            if (e instanceof PageDownAppEvent) {
                this.setrowidx(this.rowidx + DSKernel.terminal.rows - 2);
                this.display();
            }
            if (e instanceof PageUpAppEvent) {
                this.setrowidx(this.rowidx - DSKernel.terminal.rows + 2);
                this.display();
            }
            if (e instanceof DownArrowAppEvent) {
                this.setrowidx(this.rowidx + 1);
                this.display();
            }
            if (e instanceof UpArrowAppEvent) {
                this.setrowidx(this.rowidx - 1);
                this.display();
            }
            if (e instanceof LeftArrowAppEvent && this.editmode) {
                this._cursorLeft(1);
                this.display()
            }
            if (e instanceof RightArrowAppEvent && this.editmode) {
                this._cursorRight(1);
                this.display()
            }

            if (e instanceof MouseButtonDownEvent || e instanceof TouchStartAppEvent) {
                this.mouserow = e.row;
                if (e.row == 1 && e.col < 4) { //If clicking the icon
                    if (this.editmode) {
                        this.exitEditMode()
                    }
                    else {
                        this.enterEditMode()
                    }
                }
            }
            if (e instanceof MouseButtonUpEvent || e instanceof TouchEndAppEvent) {
                this.mouserow = null;
            }
            if (e instanceof MouseMoveAppEvent || e instanceof TouchMoveAppEvent) {
                if (this.mouserow != null) {
                    this.setrowidx(this.rowidx - e.row + this.mouserow);
                    this.mouserow = e.row;
                    this.display();
                }
            }
        }
        return;
    }

    save() {
        this.inode.write(this.text);
    }

    get maxrowidx() {
        return Math.max(0, this.lines.length - DSKernel.terminal.rows + 2);
    }


    enterEditMode() {
        this.stdout.write("\x1b[4h"); // Enable insert mode
        this.stdout.write(set_cursor(true));
        this.editmode = true;
        this.display();

    }

    exitEditMode() {
        this.save();
        this.stdout.write("\x1b[4l"); // Disable insert mode
        this.stdout.write(set_cursor(false));
        this.editmode = false;
        this.display();

    }

    async display() {
        this.stdout.write(set_cursor(this.editmode));

        let splitbylinebreaks = this.text.split('\n')
        this.lines = []

        let charspassed = 0;
        let linespassed = 0;
        let checkforcursor = this.editmode;
        let cursorpos = { x: 0, y: 0 };

        splitbylinebreaks.forEach((line) => {
            for (let i = 0; i < line.length + 1; i += DSKernel.terminal.cols) {
                let nextline = line.slice(i, i + DSKernel.terminal.cols)
                this.lines.push(nextline);

                let charsadded = nextline.length;
                if (checkforcursor && charspassed + charsadded + 1 > this.cursorpos) {
                    if (linespassed < this.rowidx) {
                        this.rowidx = linespassed;
                    }
                    if (linespassed - (DSKernel.terminal.rows - 2) >= this.rowidx) {
                        this.rowidx = linespassed - (DSKernel.terminal.rows - 2) + 1;
                    }
                    cursorpos.y = linespassed - this.rowidx;
                    cursorpos.x = this.cursorpos - charspassed
                    checkforcursor = false;
                }
                charspassed += charsadded;
                linespassed++;
            }
            charspassed++;
        })

        this.stdout.write(reset_text())
        this.setrowidx(this.rowidx); //Ensure rowidx is on screen

        this.stdout.write(setattr(textattrs.bg_green) + setattr(textattrs.fg_black))
        let title = this.dashlinecentered(getFileName(this.filepath));
        if (this.editmode) {
            title = ' ✎  ' + title.slice(4)
        }
        else {
            title = ' 👁  ' + title.slice(4)
        }
        this.stdout.write(title);
        this.stdout.write(setattr(textattrs.bg_default) + setattr(textattrs.fg_default));

        //Write the actual text
        let outtext = ""
        for (let i = 0; i < DSKernel.terminal.rows - 2; i++) {
            let line = this.lines[this.rowidx + i];
            if (line == undefined) {
                break;
            }
            outtext += '\n' + line
        }
        this.stdout.write(outtext);

        this.stdout.write(cursornextline())
        let percent;
        if (this.maxrowidx != 0) {
            percent = (this.rowidx) / (this.maxrowidx) * 100;
        }
        else {
            percent = 100;
        }
        let message = `${this.rowidx}/${this.maxrowidx} (${Math.floor(percent)}%)`;
        this.stdout.write(setattr(textattrs.bg_green) + setattr(textattrs.fg_black));
        this.stdout.write(this.dashlinecentered(message));
        this.stdout.write(setattr(textattrs.bg_default) + setattr(textattrs.fg_default));

        if (this.editmode) {
            this.setcursorlocation(cursorpos.x, cursorpos.y);
        }

    }


    private dashlinecentered(message: string): string {
        let middlecol = DSKernel.terminal.cols / 2;
        let outstring = ''
        outstring += '-'.repeat(Math.floor(middlecol - message.length / 2));
        outstring += message;
        outstring += '-'.repeat(Math.ceil(middlecol - message.length / 2));
        return outstring
    }


    private setrowidx(row: number) {
        let maxrow = this.maxrowidx;
        row = Math.floor(row);
        if (row > maxrow) {
            row = maxrow;
        }
        if (row < 0) {
            row = 0;
        }
        this.rowidx = row;
    }

    private setcursorlocation(x: number, y: number) {
        this.stdout.write(cursorup(DSKernel.terminal.cols + 10));
        if (y > 0) {
            this.stdout.write(cursordown(y));
        }
        this.stdout.write(cursornextline());
        if (x > 0) {
            this.stdout.write(cursorright(x));
        }
    }


    handleResize(): void {
        this.display();
    }

    private _cursorAtLeftEdge(): boolean {
        const totalchars = this.cursorpos;
        return (totalchars % DSKernel.terminal.cols == 0);
    }

    private _cursorAtRightEdge(): boolean {
        const totalchars = this.cursorpos;
        return ((totalchars + 1) % DSKernel.terminal.cols == 0)
    }

    private _cursorLeft(amount: number) {
        if (amount < 0) {
            throw new DSProcessError("Attempt to move negative positions left");
        }
        this.cursorpos -= amount

        if (this.cursorpos < 0) {
            this.cursorpos = 0;
        }
    }

    private _cursorRight(amount: number) {
        if (amount < 0) {
            throw new DSProcessError("Attempt to move negative positions right");
        }
        this.cursorpos += amount

        if (this.cursorpos > this.text.length) {
            this.cursorpos = this.text.length;
        }
    }

    private _updateText(newText: string) {
        const stdout = this.stdout;
        const startcursorpos = this.cursorpos;

        this._cursorLeft(startcursorpos); //Move cursor to start of line
        stdout.write("\x1b[J"); // Clear to EoF
        this.cursorpos += newText.length //Update internal cursor position

        //The xterm terminal handles cursor position differently at end of line - standardize it to avoid weird edge cases
        if (this._cursorAtLeftEdge() && (newText.length) % DSKernel.terminal.cols == 0) {
            stdout.write('\n');
        }

        const cursormovement = Math.min(newText.length, this.text.length - startcursorpos) //Move cursor to same relative position
        if (cursormovement > 0) {
            this._cursorLeft(cursormovement);
        }
        else if (cursormovement < 0) {
            this._cursorRight(-cursormovement);
        }

        this.text = newText;
        this.display();
    }

    private _delAtCursor(): void {
        let newuserinput = this.text.slice(0, this.cursorpos - 1) + this.text.slice(this.cursorpos);
        this._updateText(newuserinput);
    }

}