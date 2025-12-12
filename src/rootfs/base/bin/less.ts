import { DownArrowAppEvent, DSApp, MouseButtonDownEvent, MouseButtonUpEvent, MouseMoveAppEvent, PageDownAppEvent, PageUpAppEvent, TextAppEvent, TouchEndAppEvent, TouchMoveAppEvent, TouchStartAppEvent, UpArrowAppEvent, WheelAppEvent } from "../dsApp";
import { DSKernel } from "../dsKernel";
import { DSProcessError } from "../dsProcess";
import { cursornextline, reset_text, right, set_cursor, setattr, textattrs } from "../lib/dsCurses";
import { DSOptionParser } from "../lib/dsOptionParser";
import { getFileName } from "../lib/dsPath";

export class PRLess extends DSApp {

    private lines: string[];
    private text: string;

    private rowidx: number = 0;
    private filepath: string;

    private mouserow:number = null;

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
        let inode;
        try {
            inode = this.cwd.getfile(this.filepath);
        } catch (e) {
            throw new DSProcessError(`'${this.filepath}' not found\n`);
        }

        if (!((await inode.filetype()).includes("text"))) {
            throw new DSProcessError(`'${this.filepath}' not a text file\n`)
        }
        DSKernel.terminal.reset();

        this.init();
        this.text = await inode.contentAsText().read();
        this.display()

        while (!this.done) {
            let e = await this.eventQueue.dequeue();
            if (e instanceof WheelAppEvent) {
                let change = e.deltaY < 0 ? -1 : 1
                this.setrowidx(this.rowidx + change);
                this.display();
            }
            if (e instanceof TextAppEvent) {
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

            if (e instanceof MouseButtonDownEvent || e instanceof TouchStartAppEvent) {
                this.mouserow = e.row;
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


    get maxrowidx() {
        return Math.max(0, this.lines.length - DSKernel.terminal.rows + 2);
    }


    display() {
        this.stdout.write(set_cursor(false));

        let splitbylinebreaks = this.text.split('\n')
        this.lines = []
        splitbylinebreaks.forEach((line) => {
            for (let i = 0; i < line.length + 1; i += DSKernel.terminal.cols) {
                this.lines.push(line.slice(i, i + DSKernel.terminal.cols))
            }
        })

        this.stdout.write(reset_text())
        this.setrowidx(this.rowidx); //Ensure rowidx is on screen

        this.stdout.write(setattr(textattrs.bg_green) + setattr(textattrs.fg_black))
        this.dashlinecentered(getFileName(this.filepath));
        this.stdout.write(setattr(textattrs.bg_default) + setattr(textattrs.fg_default));

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
        this.dashlinecentered(message);
        this.stdout.write(setattr(textattrs.bg_default) + setattr(textattrs.fg_default));
    }


    private dashlinecentered(message: string) {
        let middlecol = DSKernel.terminal.cols / 2;
        this.stdout.write('-'.repeat(Math.floor(middlecol - message.length / 2)));
        this.stdout.write(message);
        this.stdout.write('-'.repeat(Math.ceil(middlecol - message.length / 2)));
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


    handleResize(): void {
        this.display();
    }
}