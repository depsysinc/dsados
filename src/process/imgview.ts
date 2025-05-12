import { DSProcess, DSProcessError } from "../dsProcess";
import { DSIWebFile } from "../filesystem/dsIWebFile";
import { DSOptionParser } from "../lib/dsOptionParser";
import { load_image } from "../lib/dsLib";
import { DSKernel } from "../dsKernel";
import { DSSprite } from "../dsTerminal";
import { DSInode } from "../dsFileSystem";

export class PRImgview extends DSProcess {

    private optparser: DSOptionParser;

    protected async main(): Promise<void> {
        this.optparser = new DSOptionParser(
            this.procname,
            true,
            "   output an image to the terminal",
            "<filename>"
        );

        const filename = this.getFilename();
        const inode = this.getDSInode(filename);
        const img = await this.getImageData(inode);
        const sprite = this.setupSprite(img);
        this.printWhitespaceBehindImage(sprite);

    }


    private getFilename(): string {
        let nextarg = this.optparser.parseWithUsageAndHelp(this.argv);
        if (nextarg == -1) {
            throw new DSProcessError(this.optparser.usage());
        }
        return this.argv[nextarg];
    }


    private getDSInode(filename: string): DSInode {
        let inode;
        try {
            inode = this.cwd.getfile(filename);
            return inode;
        }
        catch (e) {
            throw new DSProcessError(`'${filename}' not found\n`);
        }
    }


    private async getImageData(inode: DSInode) {
        if (!(inode instanceof DSIWebFile)) {
            throw new DSProcessError(`Not an image file\n`);
        }
        try {
            const img = await load_image(inode.url);
            return img;
        }
        catch (e) {
            throw new DSProcessError(`Not an image file\n`);
        }
    }


    private setupSprite(img: HTMLImageElement) {
        const sprite = DSKernel.terminal.newSprite([{image:img,width:img.width,height:img.height}]);
        const ycoordoflowestrow = DSKernel.terminal.xterm.buffer.active.cursorY * DSKernel.terminal.cellheight;
        sprite.enabled = true;
        sprite.y = ycoordoflowestrow;
        return sprite;
    }


    private printWhitespaceBehindImage(sprite: DSSprite) {
        for (let i = 0; i < sprite.texture.height; i += DSKernel.terminal.cellheight) {
            this.stdout.write('\n')
        }

    }
}