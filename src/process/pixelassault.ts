import { DSFilePermsError, DSFileSystemError, DSIDirectoryIllegalFilenameError } from "../dsFileSystem";
import { DSKernel } from "../dsKernel";
import { DSProcess } from "../dsProcess";
import { DSSprite } from "../dsTerminal";
import { DSIWebFile } from "../filesystem/dsIWebFile";
import { reset, set_cursor } from "../lib/dsCurses";
import { DSTexture, get_image_textures } from "../lib/dsImg";
import { sleep } from "../lib/dsLib";



export class PRPixelAssault extends DSProcess {

    public paused: Boolean = false;
    public levelend: Boolean = false;
    public exited: Boolean = false;

    protected async main(): Promise<void> {
        this.stdout.write(reset());
        DSKernel.terminal.resetSprites();
        this.stdout.write(set_cursor(false));

        this.fpsloop(40);

        let sprit = await this.load_sprite("/data/app/pixel_assault/Ships/Turtle.png");
        for (let i = 0; i < 10; i++) {
            sprit.x += 1;
            await sleep(100);
        }

        await sleep(1000);
        return;
    }

    async load_sprite(url: string): Promise<DSSprite> {
        const inode = this.cwd.getfile(url);
        if (!(inode instanceof DSIWebFile)) {
            throw new DSFileSystemError("Attempt to load a non-webfile");
        }
        const textures: DSTexture[] = await get_image_textures(inode.url);
        const sprit = DSKernel.terminal.newSprite(textures);
        sprit.enabled = true;
        return sprit;

    }
    //Sprites only update when xterm requests a refresh
    //i.e. when text is written to the terminal
    //Alternatively, could be fixed in DSTerminal, but keeping scope small for now
    async fpsloop(delay: number) {
        while (!this.exited) {
            this.stdout.write(' ');
            await sleep(delay);
            this.stdout.write('\b');
            await sleep(delay);

        }
    }
}