import { DSKernel } from "../dsKernel";
import { DSProcess, DSProcessError } from "../dsProcess";
import { DSPointerEvent } from "../dsTerminal";
import { DSIWebFile } from "../filesystem/dsIWebFile";
import { gotoxy, reset, setattr, textattrs } from "../lib/dsCurses";
import { load_image } from "../lib/dsLib";
import { DSOptionParser } from "../lib/dsOptionParser";

export class PRDemoMouseTouch extends DSProcess {
    sprite: import("/workspaces/depsysweb/src/dsTerminal").DSSprite;
    touchactive: boolean = false;

    protected async main(): Promise<void> {
        const optparser = new DSOptionParser(
            this.procname,
            true,
            "   test mouse and touch input"
        );
        let nextarg = optparser.parseWithUsageAndHelp(this.argv);
        if (nextarg != -1)
            throw new DSProcessError(optparser.usage());
        const w = (str: string) => { this.stdout.write(str); };
        // Load sprites

        w("Loading test images...\n");
        const animdir = this.cwd.getdir("/data/demo/animation");
        const images: HTMLImageElement[] = [];
        for (let i = 0; i < animdir.filelist.length; i++) {
            const file = animdir.filelist[i];
            if (file.inode instanceof DSIWebFile) {
                const webnode = file.inode as DSIWebFile;
                w(`Loading ${file.name}\n  URL: ${webnode.url}...`);
                const img = await load_image(webnode.url);
                w("done\n");
                w(`  Dimensions: ${img.width} x ${img.height}\n`);
                images.push(img);
            }
        };

        // Create the sprite
        this.sprite = DSKernel.terminal.newSprite(images);
        w(reset());

        // Draw border
        let fillstr: string = "+";
        fillstr = fillstr.padEnd(DSKernel.terminal.cols - 1, "-");
        fillstr += "+";

        w(setattr(textattrs.inverted) + gotoxy(1, 1) + fillstr);
        for (let j = 1; j <= DSKernel.terminal.rows; j++) {
            w(gotoxy(1, j + 1) + "|");
            w(gotoxy(DSKernel.terminal.cols, j + 1) + "|");
        }
        w(gotoxy(1, DSKernel.terminal.rows) + fillstr + setattr(textattrs.noninverted));


        let done = false;
        while (!done) {
            const input = await this.stdin.read();
            if (input == 'q')
                done = true;
        }
        return;
    }

    handlePointer(e: DSPointerEvent): void {
        if (e.type == "mousemove") {
            if (this.sprite) {
                this.sprite.x = e.x;
                this.sprite.y = e.y;
                this.sprite.enabled = true;
            }
        }

        if (e.type == "mouseup") {
            this.stdout.write(gotoxy(e.col, e.row) + 'M');
        }
        if (e.type == "touchstart") {
            this.stdout.write(gotoxy(e.col, e.row) + 'T');
            this.touchactive = true;
        }
        if (e.type == "touchmove") {
            if (this.touchactive)
                this.stdout.write(gotoxy(e.col, e.row) + 'D');
            if (this.sprite) {
                this.sprite.x = e.x;
                this.sprite.y = e.y;
                this.sprite.enabled = true;
            }

        }
        if (e.type == "touchend") {
            this.touchactive = false;
        }
        DSKernel.terminal.refresh();
    }
}