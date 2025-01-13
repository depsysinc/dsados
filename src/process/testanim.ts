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
            "   test sprite subsystem"
        );
        let nextarg = optparser.parseWithUsageAndHelp(this.argv);
        if (nextarg != -1)
            throw new DSProcessError(optparser.usage());
        this.stdout.write("\x1bc");

        // User binary responsible for image loading
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

        // Create the sprite
        const sprite = DSKernel.terminal.newSprite(images);
        sprite.enabled = true;
        let done = false;

        this.stdout.write("\n[PRESS ANY KEY TO EXIT]\n");

        const update = () => {
            if (done) {
                DSKernel.terminal.resetSprites();
                return;
            }
            requestAnimationFrame(update);
            const now = performance.now();

            sprite.i = (now/100) % sprite.texture.length;
            sprite.x = (now/5) % DSKernel.terminal.width;
            sprite.y = (now/10) % DSKernel.terminal.height;
            // Userland responsible for requesting refresh
            // when sprite changes happen
            DSKernel.terminal.refresh();
        }
        requestAnimationFrame(update);
        await this.stdin.read();
        done = true;

        // Userland responsible for resetting sprite subsystem
        // when done (Sprites will stay in last state otherwise!)
        return;
    }
}