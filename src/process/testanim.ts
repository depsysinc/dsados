import { DSKernel } from "../dsKernel";
import { DSProcess, DSProcessError } from "../dsProcess";
import { DSIWebFile } from "../filesystem/dsIWebFile";
import { load_image, sleep } from "../lib/dsLib";
import { DSOptionParser } from "../lib/dsOptionParser";

export class PRTestAnim extends DSProcess {

    protected async main(): Promise<void> {
        const optparser = new DSOptionParser(
            this.procname,
            true,
            "   test image animation subsystem"
        );
        let nextarg = optparser.parseWithUsageAndHelp(this.argv);
        if (nextarg != -1)
            throw new DSProcessError(optparser.usage());
        this.stdout.write("\x1bc");
        this.stdout.write("Loading test images...\n");
        const animdir = this.cwd.getdir("/data/test/animation");
        const images: HTMLImageElement[] = [];
        for (let i = 0; i < animdir.filelist.length; i++) {
            const file = animdir.filelist[i];
            if (file.inode instanceof DSIWebFile) {
                const webnode = file.inode as DSIWebFile;
                this.stdout.write(`Loading ${file.name}\n  URL: ${webnode.url}...`);
                const img = await load_image(webnode.url);
                this.stdout.write("done\n");
                this.stdout.write(`  Dimensions: ${img.width} x ${img.height}\n`);
                images.push(img);
            }
        };
        const sprite = DSKernel.terminal.newSprite(images);
        sprite.enabled = true;
        let done = false;
        this.stdin.read().then(() => { done = true; });
        this.stdout.write("\n[PRESS ANY KEY TO EXIT]\n");
        while (!done) {
            await sleep(100);
            sprite.i = (sprite.i + 1) % sprite.texture.length;
            DSKernel.terminal.refresh();
        }
        DSKernel.terminal.clearSprites();
        return;
    }
}