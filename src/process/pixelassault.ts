import { DSFilePermsError, DSFileSystemError, DSIDirectory, DSIDirectoryIllegalFilenameError, DSInode } from "../dsFileSystem";
import { DSKernel } from "../dsKernel";
import { DSProcess } from "../dsProcess";
import { DSKeyEvent, DSSprite } from "../dsTerminal";
import { DSIWebFile } from "../filesystem/dsIWebFile";
import { reset, set_cursor } from "../lib/dsCurses";
import { DSTexture, get_image_textures } from "../lib/dsImg";
import { sleep } from "../lib/dsLib";

type BoundingBox = {
    x0: number,
    x1: number,
    y0: number,
    y1: number
}

function transform(box: BoundingBox, amount: Vector2): BoundingBox {
    const box2: BoundingBox = {
        x0: box.x0 + amount.x,
        x1: box.x1 + amount.x,
        y0: box.y0 + amount.y,
        y1: box.y1 + amount.y,
    }
    return box2
}

function topleft(box: BoundingBox): Vector2 {
    return {
        x: box.x0,
        y: box.y0
    }
}

function center(box: BoundingBox): Vector2 {
    return {
        x: (box.x0 + box.x1) / 2,
        y: (box.y0 + box.y1) / 2
    }
}

type Vector2 = {
    x: number,
    y: number
}

export class PRPixelAssault extends DSProcess {

    public paused: Boolean = false;
    public levelend: Boolean = false;
    public exited: Boolean = false;

    public framerate: number = 40;

    public static spritepath: string = "/data/app/pixel_assault/"

    private spaceship: PASpaceship;

    protected async main(): Promise<void> {
        this.stdout.write(reset());
        DSKernel.terminal.resetSprites();
        this.stdout.write(set_cursor(false));

        this.fpsloop(this.framerate);

        this.spaceship = new PASpaceship(this, "Ships/LightningFrames");
        await this.spaceship.initialize();
        this.spaceship.goto({x:500,y:50});

        let a: BoundingBox = { x0: 1, x1: 1, y0: 0, y1: 1 }
        let b: BoundingBox = { x0: 5, x1: 8, y1: 9, y0: 9 }

        await sleep(10000);
        return;
    }

    handleKeyEvent(e: DSKeyEvent): void {

    }

    async load_textures(url: string): Promise<DSTexture[]> {
        const inode = this.cwd.getfile(PRPixelAssault.spritepath + url);
        if (!(inode instanceof DSIWebFile)) {
            throw new DSFileSystemError("Attempt to load a non-webfile");
        }
        const textures: DSTexture[] = await get_image_textures(inode.url);
        return textures;
    }

    //Sprites only update when xterm requests a refresh
    //i.e. when text is written to the terminal
    //Alternatively, could be fixed in DSTerminal, but keeping scope small for now
    async fpsloop(framerate: number) {
        while (!this.exited) {
            this.stdout.write(' ');
            await sleep(1000 / framerate);
            this.stdout.write('\b');
            await sleep(1000 / framerate);

        }
    }
}



abstract class PAGameObject {
    protected sprite: DSSprite;
    public bounds: BoundingBox;
    public velocity: Vector2 = {x:0,y:0};
    constructor(protected parent: PRPixelAssault, protected url: string) {
    }

    async initialize() {
        this.sprite = await this.get_sprite();
        this.bounds = {
            x0: this.sprite.x,
            y0: this.sprite.y,
            x1: this.sprite.x + this.sprite.texture.width,
            y1: this.sprite.y + this.sprite.texture.height
        }
        
    }

    async get_sprite(): Promise<DSSprite> {
        const inode = this.parent.cwd.getfile(PRPixelAssault.spritepath + this.url);
        let textures: DSTexture[] = [];

        //If passed directory, cycle through the filelist and add them all to textures
        if (inode instanceof DSIDirectory) {
            for (let i = 2; i < inode.filelist.length; i++) {
                let childnode = inode.filelist[i].inode
                if (!(childnode instanceof DSIWebFile)) {
                    throw new DSFileSystemError("Directory contents not webfiles");
                }
                textures = textures.concat(await get_image_textures(childnode.url));

            }
        }
        else if (inode instanceof DSIWebFile) {
            textures = await get_image_textures(inode.url);
        }
        else {
            throw new DSFileSystemError("Incorrect sprite type passed")
        }

        let sprite = DSKernel.terminal.newSprite(textures);
        sprite.enabled = true;
        return sprite
    }

    public goto(location: Vector2) {
        const currentpos:Vector2 = center(this.bounds)
        const offset:Vector2 = {x:location.x-currentpos.x, y:location.y-currentpos.y}
        this.bounds = transform(this.bounds, offset);
        this.sprite.x += offset.x;
        this.sprite.y += offset.y;
    }
}

class PASpaceship extends PAGameObject {
    private boosting: Boolean;

    async initialize() {
        await super.initialize();
        this.sprite.paused = true;
    }


}