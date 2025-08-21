import { DSFilePermsError, DSFileSystemError, DSIDirectory, DSIDirectoryIllegalFilenameError, DSInode } from "../dsFileSystem";
import { DSKernel } from "../dsKernel";
import { DSProcess } from "../dsProcess";
import { DSKeyEvent, DSSprite } from "../dsTerminal";
import { DSIWebFile } from "../filesystem/dsIWebFile";
import { reset, set_cursor } from "../lib/dsCurses";
import { DSTexture, get_image_textures } from "../lib/dsImg";
import { sleep } from "../lib/dsLib";

class BoundingBox {
    constructor(
        public x0: number,
        public x1: number,
        public y0: number,
        public y1: number
    ) { }

    transform(amount: Vector2): BoundingBox {
        return new BoundingBox(
            this.x0 + amount.x,
            this.x1 + amount.x,
            this.y0 + amount.y,
            this.y1 + amount.y
        );
    }

    get topLeft(): Vector2 {
        return { x: this.x0, y: this.y0 };
    }

    get center(): Vector2 {
        return { x: (this.x0 + this.x1) / 2, y: (this.y0 + this.y1) / 2 };
    }

    get bottomRight(): Vector2 {
        return { x: this.x1, y: this.y1 };
    }

    overlaps(other: BoundingBox) {
        if (other.x1 < this.x0 ||
            other.y1 < this.y0 ||
            other.x0 > this.x1 ||
            other.y0 > this.y1) {
            return false;
        }
        return true;
    }
}

type Vector2 = {
    x: number,
    y: number
}

export class PRPixelAssault extends DSProcess {

    public paused: boolean = false;
    public levelend: boolean = false;
    public exited: boolean = false;

    public framerate: number = 40;

    public static spritepath: string = "/data/app/pixel_assault/"

    private spaceship: PASpaceship;
    public updatefunctions: (() => void)[] = [];

    protected async main(): Promise<void> {
        this.stdout.write(reset());
        DSKernel.terminal.resetSprites();
        this.stdout.write(set_cursor(false));


        this.spaceship = new PASpaceship(this, "Ships/LightningFrames");
        await this.spaceship.initialize();
        this.spaceship.goto({ x: 500, y: 50 });
        this.fpsloop();



        await sleep(10000);
        this.exited = true;
        return;
    }

    handleKeyEvent(e: DSKeyEvent): void {
        if (e.key in PASpaceship.keyresponses) {
            this.spaceship.onkey(e.key, e.down);
        }

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
    async fpsloop() {
        while (!this.exited) {
            for (let i = 0; i < 2; i++) {
                this.stdout.write([' ', '\b'][i]);

                for (let i = 0; i < this.updatefunctions.length; i++) {
                    this.updatefunctions[i]()
                }

                await sleep(1000 / this.framerate)
            }

        }
    }
}



abstract class PAGameObject {
    protected sprite: DSSprite;
    public bounds: BoundingBox;
    public velocity: Vector2 = { x: 0, y: 0 };
    constructor(protected parent: PRPixelAssault, protected url: string) {
    }

    async initialize() {
        this.sprite = await this.get_sprite();
        this.bounds = new BoundingBox(
            this.sprite.x,
            this.sprite.x + this.sprite.texture.width,
            this.sprite.y,
            this.sprite.y + this.sprite.texture.height
        );
        this.parent.updatefunctions.push(() => this.update())
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
                textures[i - 2].duration = 300;
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
        const currentpos: Vector2 = this.bounds.center
        const offset: Vector2 = { x: location.x - currentpos.x, y: location.y - currentpos.y }
        this.translate(offset);
    }

    public translate(offset: Vector2) {
        this.bounds = this.bounds.transform(offset);
        this.sprite.x += offset.x;
        this.sprite.y += offset.y;
    }

    protected update() {
        const adjustedvelocity: Vector2 = { x: this.velocity.x / this.parent.framerate, y: this.velocity.y / this.parent.framerate }
        this.translate(adjustedvelocity);
    }
}

class PASpaceship extends PAGameObject {
    private boosting: boolean;
    private speed: number = 300;

    public static keyresponses: Record<string, Vector2> = {
        "KeyW": { x: 0, y: -1 },
        "KeyA": { x: -1, y: 0 },
        "KeyS": { x: 0, y: 1 },
        "KeyD": { x: 1, y: 0 },
        "ArrowUp": { x: 0, y: -1 },
        "ArrowLeft": { x: -1, y: 0 },
        "ArrowRight": { x: 1, y: 0 },
        "ArrowDown": { x: 0, y: 1 },
    }

    public static keysdown: Record<string, boolean> = {
        "KeyW": false,
        "KeyA": false,
        "KeyS": false,
        "KeyD": false,
        "ArrowUp": false,
        "ArrowLeft": false,
        "ArrowRight": false,
        "ArrowDown": false,
    }
    async initialize() {
        await super.initialize();
        this.sprite.paused = true;
    }

    public onkey(key: string, down: boolean) {
        let factor = (down ? 1 : -1) * this.speed;
        let vector = PASpaceship.keyresponses[key]
        if (PASpaceship.keysdown[key] != down) {
            PASpaceship.keysdown[key] = down;
            this.velocity = { x: this.velocity.x + vector.x * factor, y: this.velocity.y + vector.y * factor }
        }
        if (!this.boosting && down) {
            this.boostanim();
        }
    }

    private async boostanim() {
        console.log("start boost")
        this.boosting = true;
        this.sprite.i += 1;

        await sleep(50);
        this.sprite.i += 1;
        await sleep(150);
        this.sprite.i += 1;
        await sleep(50);
        this.sprite.i = 0
        this.boosting = false;
    }

}