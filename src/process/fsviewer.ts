import { DownArrowAppEvent, DSApp, LeftArrowAppEvent, MouseButtonDownEvent, MouseButtonUpEvent, MouseMoveAppEvent, ResizeAppEvent, RightArrowAppEvent, TextAppEvent, TouchEndAppEvent, TouchMoveAppEvent, TouchStartAppEvent, UpArrowAppEvent } from "../dsApp";
import { DSIDirectory } from "../dsFileSystem";
import { DSKernel } from "../dsKernel";
import { reset_text, set_cursor, setattr, textattrs } from "../lib/dsCurses";
import { sleep } from "../lib/dsLib";
import { DSOptionParser } from "../lib/dsOptionParser";

//TODO
//support for lists longer than the screen is tall
//File type checking + opening
//Icons based on file type
//History queue
//Renaming
//Copy paste

export class PRFSViewer extends DSApp {

    private currentdir: DSIDirectory;
    private selectedrow: number = 0;
    private topmost: number = 0;

    protected async main(): Promise<void> {
        const optparser = new DSOptionParser(
            this.procname,
            true,
            "   view filesystem",
            "<dirname>"
        );
        let nextarg = optparser.parseWithUsageAndHelp(this.argv);

        if (nextarg == -1) {
            this.currentdir = this.cwd
        }
        else {
            this.currentdir = this.cwd.getdir(this.argv[nextarg])
        }
        DSKernel.terminal.reset();
        this.init();
        this.drawdisplay();
        await sleep(50)
        while (!this.done) {
            const e = await this.eventQueue.dequeue();
            console.log(e)
            if (e instanceof ResizeAppEvent) {
                this.drawdisplay()
            }
            else if (e instanceof TextAppEvent) {
                if (e.text == 'q') {
                    this.done = true;
                }
                else if (e.text == 't') {
                    this.changeactiverow(3);
                }
                else if (e.text == '\r') {
                    this.opencurrentfile()
                }
                else if (e.text == '\t') {
                    this.changeactiverow(1)
                }
            }
            else if (e instanceof DownArrowAppEvent) {
                this.changeactiverow(1)
            }
            else if (e instanceof UpArrowAppEvent) {
                this.changeactiverow(-1);
            }
            else if (e instanceof MouseMoveAppEvent || e instanceof TouchMoveAppEvent) {
                this.setactiverow(e.row - 2);
            }

            else if (e instanceof MouseButtonDownEvent || e instanceof TouchStartAppEvent) {
                this.setactiverow(e.row - 2);
            }

            else if (e instanceof TouchEndAppEvent) {
                this.opencurrentfile();
            }

            else if (e instanceof MouseButtonUpEvent) {
                if (e.button == 0) {
                    this.opencurrentfile();
                }
                else if (e.button == 2) {
                    this.currentdir = this.currentdir.parent;
                    this.drawdisplay();
                }
            }
            else if (e instanceof LeftArrowAppEvent) {
                this.goback()
            }
            else if (e instanceof RightArrowAppEvent) {
                this.opencurrentfile();
            }

        }

        DSKernel.terminal.reset()
        return;
    }

    private drawdisplay() {
        this.stdout.write(reset_text() + set_cursor(false));

        this.stdout.write(setattr(textattrs.bold) + setattr(textattrs.bg_green) + setattr(textattrs.fg_black));

        let path = "@ " + this.currentdir.path
        this.stdout.write(path + ' '.repeat(DSKernel.terminal.cols - path.length) + '\n')

        this.stdout.write(setattr(textattrs.normal) + setattr(textattrs.fg_green) + setattr(textattrs.bg_default))

        for (let i = this.topmost; i < Math.min(this.currentdir.filelist.length, DSKernel.terminal.rows - 2); i++) {
            let file = this.currentdir.filelist[i];

            if (i == this.selectedrow) {
                this.stdout.write(setattr(textattrs.italic))
            }
            this.stdout.write('  ' + file.name + '\n');
            this.stdout.write(setattr(textattrs.noitalic))

        }
    }

    private opencurrentfile() {
        if (this.selectedrow < 0 || this.selectedrow >= this.currentdir.filelist.length)
            return;

        let inode = this.currentdir.filelist[this.selectedrow].inode
        if (inode instanceof DSIDirectory) {
            this.currentdir = inode;
            this.drawdisplay();
        }
    }

    private setactiverow(row: number) {
        if (row < 0) {
            this.selectedrow = -1;
        }
        else if (row >= this.currentdir.filelist.length) {
            this.selectedrow = this.currentdir.filelist.length
        }
        else {
            this.selectedrow = row;
        }
        this.drawdisplay();
    }

    private changeactiverow(amount: number) {
        if (this.selectedrow + amount < 0) {
            this.selectedrow = 0;
        }
        else if (this.selectedrow + amount >= this.currentdir.filelist.length) {
            this.selectedrow = this.currentdir.filelist.length - 1;
        }
        else {
            this.selectedrow += amount;
        }

        this.drawdisplay();

    }

    //Add history system and change implementation of this
    private goback() {
        this.currentdir = this.currentdir.parent;
        this.drawdisplay();
    }

}