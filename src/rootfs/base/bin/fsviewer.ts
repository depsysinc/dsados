import { DownArrowAppEvent, DSApp, HistoryAppEvent, LeftArrowAppEvent, MouseButtonDownEvent, MouseButtonUpEvent, MouseMoveAppEvent, ResizeAppEvent, RightArrowAppEvent, TextAppEvent, TouchEndAppEvent, TouchMoveAppEvent, TouchStartAppEvent, UpArrowAppEvent, WheelAppEvent } from "../../../dsApp";
import { DSIDirectory } from "../../../dsFileSystem";
import { DSKernel } from "../../../dsKernel";
import { DSIWebFile } from "../../../filesystem/dsIWebFile";
import { reset_text, set_cursor, setattr, textattrs } from "../../../lib/dsCurses";
import { DSTexture, get_image_textures } from "../../../lib/dsImg";
import { sleep } from "../../../lib/dsLib";
import { DSOptionParser } from "../../../lib/dsOptionParser";
import { getAbsolutePath } from "../../../lib/dsPath";


export class PRFSViewer extends DSApp {

    private currentdir: DSIDirectory;
    private selectedrow: number = 0;
    private rowidx: number = 0;

    private foldertexture: DSTexture[];
    private txttexture: DSTexture[];
    private imgtexture: DSTexture[];

    private historystack: { filepath: string, rowidx: number }[] = [];
    private historystackpoint: number;

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
        history.pushState({ filepath: '/data/app/fsviewer/fsvieweropen.dsmd' }, '')
        await this.init();
        await this.drawdisplay();
        await sleep(50);
        while (!this.done) {
            const e = await this.eventQueue.dequeue();
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
                    await this.opencurrentfile()
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
                this.setactiverow(this.rowidx + e.row - 2);
            }

            else if (e instanceof MouseButtonDownEvent || e instanceof TouchStartAppEvent) {
                this.setactiverow(this.rowidx + e.row - 2);
            }

            else if (e instanceof TouchEndAppEvent) {
                await this.opencurrentfile();
            }

            else if (e instanceof MouseButtonUpEvent) {
                if (e.button == 0) {
                    await this.opencurrentfile();
                }
                else if (e.button == 2) {
                    this.currentdir = this.currentdir.parent;
                    this.drawdisplay();
                }
                else if (e.button == 3) {
                    this.goback()
                }
                else if (e.button == 4) {
                    this.goforward();
                }
            }
            else if (e instanceof HistoryAppEvent) {
                this.done = true;
            }
            else if (e instanceof LeftArrowAppEvent) {
                this.goback();
            }
            else if (e instanceof RightArrowAppEvent) {
                this.goforward();
            }
            else if (e instanceof WheelAppEvent) {
                let amount = Math.floor(e.deltaY / 4 / DSKernel.terminal.cellheight);
                if (this.rowidx + amount <= 0) {
                    this.rowidx = 0
                }
                else if (DSKernel.terminal.rows - 2 + this.rowidx + amount > this.currentdir.filelist.length) {
                    this.rowidx = Math.max(0, this.currentdir.filelist.length - DSKernel.terminal.rows + 2)
                }
                else {
                    this.rowidx += amount
                }
                this.drawdisplay();
            }
        }

        DSKernel.terminal.reset()
        return;
    }

    protected async init() {
        super.init();
        this.foldertexture = await get_image_textures((this.cwd.getfile('/data/app/fsviewer/foldericon.png') as DSIWebFile).url);
        this.txttexture = await get_image_textures((this.cwd.getfile('/data/app/fsviewer/texticon.png') as DSIWebFile).url);
        this.imgtexture = await get_image_textures((this.cwd.getfile('/data/app/fsviewer/imageicon.png') as DSIWebFile).url);
        this.historystack.push({ filepath: this.currentdir.path, rowidx: 0 });
        this.historystackpoint = 0;
    }

    
    private async drawdisplay() {
        DSKernel.terminal.resetSprites();
        this.stdout.write(reset_text() + set_cursor(false));

        this.stdout.write(setattr(textattrs.bold) + setattr(textattrs.bg_green) + setattr(textattrs.fg_black));

        let path = "@ " + this.currentdir.path
        this.stdout.write(path + ' '.repeat(DSKernel.terminal.cols - path.length) + '\n')

        this.stdout.write(setattr(textattrs.normal) + setattr(textattrs.fg_green) + setattr(textattrs.bg_default))

        for (let i = this.rowidx; i < Math.min(this.currentdir.filelist.length, DSKernel.terminal.rows - 2 + this.rowidx); i++) {
            let file = this.currentdir.filelist[i];
            let icon = await this.getIcon(file.inode as DSIWebFile);
            if (icon) {
                let sprite = DSKernel.terminal.newSprite(icon);
                sprite.x = DSKernel.terminal.cellwidth / 4;
                sprite.y = ((i - this.rowidx) + 1.2) * DSKernel.terminal.cellheight;
                sprite.enabled = true;
            }
            if (i == this.selectedrow) {
                this.stdout.write(setattr(textattrs.bg_black))
            }
            this.stdout.write('  ' + file.inode.perms.permString()+' ');
            if (i == this.selectedrow) {
                this.stdout.write(setattr(textattrs.italic))
            }

            this.stdout.write(file.name + '\n');
            this.stdout.write(setattr(textattrs.noitalic)+setattr(textattrs.bg_default))
        }
    }

    private async opencurrentfile() {
        if (this.selectedrow < 0 || this.selectedrow >= this.currentdir.filelist.length)
            return;

        let fileinfo = this.currentdir.filelist[this.selectedrow]
        let inode = fileinfo.inode
        let filepath = getAbsolutePath(this.currentdir, fileinfo.name);

        if (inode instanceof DSIDirectory) {
            this.currentdir = inode;

            this.historystackpoint++;
            this.historystack = this.historystack.slice(0, this.historystackpoint);
            this.historystack.push({ filepath: this.currentdir.path, rowidx: this.rowidx });
            this.rowidx = 0;

            this.drawdisplay();
        }
        else if (inode instanceof DSIWebFile) {
            let filetype = await this.getFileType(inode);

            if (filetype.includes('dsmd')) {
                await DSKernel.exec('bin/dsmdbrowser', ['', filepath])
                this.drawdisplay();
                return
            }
            DSKernel.terminal.reset();
            if (filetype.includes('image')) {
                await DSKernel.exec('bin/imgview', ['', filepath])
            }
            else {
                await DSKernel.exec('bin/cat', ['', filepath])
            }
            while (true) {
                let e = await this.eventQueue.dequeue();
                if (e instanceof HistoryAppEvent) {
                    this.done = true;
                    return;
                }
                if (!(e instanceof MouseMoveAppEvent ||
                    e instanceof WheelAppEvent ||
                    e instanceof ResizeAppEvent ||
                    e instanceof MouseButtonDownEvent ||
                    e instanceof UpArrowAppEvent ||
                    e instanceof DownArrowAppEvent)) {
                    this.drawdisplay();
                    return;
                }
            }
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
        this.selectedrow += amount;
        if (this.selectedrow < 0) {
            this.selectedrow = 0;
        }
        if (this.selectedrow < this.rowidx) {
            this.rowidx = this.selectedrow;
        }
        if (this.selectedrow >= this.currentdir.filelist.length - 1) {
            this.selectedrow = this.currentdir.filelist.length - 1;
        }

        if (this.selectedrow > this.rowidx + DSKernel.terminal.rows - 3) {
            this.rowidx = this.selectedrow - DSKernel.terminal.rows + 3
        }

        this.drawdisplay();

    }

    private goback() {
        if (this.historystackpoint == 0) {
            this.done = true;
            return;
        }
        this.historystackpoint--;
        this.currentdir = this.cwd.getdir(this.historystack[this.historystackpoint].filepath);
        this.rowidx = this.historystack[this.historystackpoint].rowidx;
        this.drawdisplay();
    }

    private goforward() {
        if (this.historystackpoint >= this.historystack.length - 1) {
            return;
        }
        this.historystackpoint++;
        this.currentdir = this.cwd.getdir(this.historystack[this.historystackpoint].filepath);
        this.rowidx = this.historystack[this.historystackpoint].rowidx;
        this.drawdisplay();
    }


    private async getFileType(inode: DSIWebFile): Promise<string> {
        return await inode.filetype();
    }

    private async getIcon(inode: DSIWebFile): Promise<DSTexture[]> {
        let filetype = await this.getFileType(inode)
        let basetype = filetype.split('/')[0]

        if (basetype == 'directory') {
            return this.foldertexture
        }
        else if (basetype == 'text') {
            return this.txttexture
        }
        else if (basetype == 'image') {
            return this.imgtexture
        }
        else {
            return null;
        }

    }
}