import { DSFilePermsError, DSFileSystemError, DSIDirectory, DSIDirectoryIllegalFilenameError, DSIDirectoryInvalidPathError, DSInode } from "../dsFileSystem";
import { DSKernel } from "../dsKernel";
import { DSProcess } from "../dsProcess";
import { DSKeyEvent, DSSprite } from "../dsTerminal";
import { DSIWebFile } from "../filesystem/dsIWebFile";
import { cursorright, down, reset, right, set_cursor } from "../lib/dsCurses";
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

    overlaps(other: BoundingBox): boolean {
        if (other.x1 < this.x0 ||
            other.y1 < this.y0 ||
            other.x0 > this.x1 ||
            other.y0 > this.y1) {
            return false;
        }
        return true;
    }
    within(other: BoundingBox): boolean {
        return this.xwithin(other) && this.ywithin(other);
    }

    xwithin(other: BoundingBox): boolean {
        return other.x0 <= this.x0 &&
            other.x1 >= this.x1
    }

    ywithin(other: BoundingBox): boolean {
        return other.y0 <= this.y0 &&
            other.y1 >= this.y1

    }
}

type Vector2 = {
    x: number,
    y: number
}

function scale(vector: Vector2, amount: number): Vector2 {
    return { x: vector.x * amount, y: vector.y * amount }
}

export class PRPixelAssault extends DSProcess {

    public playing: boolean = false;
    public initialized: boolean = false;
    public exited: boolean = false;

    public framerate: number = 40;

    public static spritepath: string = "/data/app/pixel_assault/"

    private spaceship: PASpaceship;
    public objects: PAGameObject[] = [];
    private width = 350;
    private height = 400;
    public gamebounds: BoundingBox = new BoundingBox(0, 500, 0, 500);
    public killlist: PAGameObject[] = [];

    protected async main(): Promise<void> {
        this.reset();
        await this.splash();
        await this.mainloop();
        this.reset();
        return;
    }

    private async createGame() {
        this.reset();
        if (!this.screencorrectsize()) {
            this.splash();
            return;
        }
        this.initialized = true;
        this.playing = true;

        const inode = this.cwd.getfile(PRPixelAssault.spritepath + "pixelbackground.jpg") as DSIWebFile;
        const textures = await get_image_textures(inode.url);
        const background = DSKernel.terminal.newSprite(textures);
        background.x = this.gamebounds.x0;
        background.y = this.gamebounds.y0;
        background.enabled = true;

        this.spaceship = await this.createObject(PASpaceship, "Ships/LightningFrames", { x: 200, y: 350 }) as PASpaceship;
        await this.createObject(PAEnemy, "Ships/NinjaFrames", { x: 50, y: 50 });

    }

    private reset() {
        this.stdout.write(reset());
        DSKernel.terminal.resetSprites();
        this.stdout.write(set_cursor(false));
        this.updateboundingbox();
        this.objects = [];
        this.playing = false;
        this.initialized = false;
    }

    private async splash() {
        this.reset();
        if (!this.screencorrectsize()) {
            this.stdout.write("Resize screen!")
        }
        else {
            this.stdout.write("Splash screen engaged. Y to start.")
        }
    }

    private updateboundingbox() {
        this.gamebounds = new BoundingBox(
            (DSKernel.terminal.width - this.width) / 2,
            (DSKernel.terminal.width + this.width) / 2,
            (DSKernel.terminal.height - this.height) / 2,
            (DSKernel.terminal.height + this.height) / 2
        )
    }

    private screencorrectsize() {
        return DSKernel.terminal.width >= this.width && DSKernel.terminal.height >= this.height;
    }



    async mainloop() {
        while (!this.exited) {
            if (this.playing && !this.initialized) {
                await this.createGame();
            }

            if (this.playing) {
                this.stdout.write(cursorright(1)); //Sprites only update when xterm requests a refresh, when text is written to the terminal

                this.runUpdateFunctions();
                this.sendCollisionMessages();
                this.sendOutOfBoundsMessages();
                this.killObjects();
            }
            await sleep(1000 / this.framerate)
        }


    }

    handleKeyEvent(e: DSKeyEvent): void {
        if (e.key == "KeyQ") {
            console.log("leave")
            this.exited = true;
        }
        if (!this.playing && e.key == "KeyY") {
            this.createGame();
        }
        if (e.key == "KeyP" && e.down) {
            this.playing = !this.playing;
        }

        if (this.playing && e.key in PASpaceship.keyresponses) {
            this.spaceship.onkey(e.key, e.down);
        }
    }

    runUpdateFunctions() {
        for (let i = 0; i < this.objects.length; i++) {
            this.objects[i].update()
        }

    }

    handleResize(): void {
        this.splash();
    }

    sendCollisionMessages() {
        for (let i = 0; i < this.objects.length; i++) {
            for (let j = i + 1; j < this.objects.length; j++) {
                if (this.objects[i].bounds.overlaps(this.objects[j].bounds)) {
                    this.objects[i].onCollision(this.objects[j]);
                    this.objects[j].onCollision(this.objects[i]);
                }
            }
        }
    }

    sendOutOfBoundsMessages() {
        for (let i = 0; i < this.objects.length; i++) {
            if (!this.objects[i].bounds.within(this.gamebounds)) {
                const touching = this.objects[i].bounds.overlaps(this.gamebounds)
                this.objects[i].onOutOfBounds(touching);
            }
        }
    }

    killObjects() {
        for (let i = 0; i < this.killlist.length; i++) {
            let obj = this.killlist[i];
            this.objects = this.objects.filter((i => i != obj));

        }
    }
    public async createObject(constructor: new (parent: PRPixelAssault, url: string) => PAGameObject, url: string, creator: PAGameObject): Promise<PAGameObject>
    public async createObject(constructor: new (parent: PRPixelAssault, url: string) => PAGameObject, url: string, position: Vector2): Promise<PAGameObject>
    public async createObject(constructor: new (parent: PRPixelAssault, url: string) => PAGameObject, url: string, location: PAGameObject | Vector2): Promise<PAGameObject> {
        const newobj = new constructor(this, url);
        await newobj.initialize();
        if (location instanceof PAGameObject) {
            newobj.goto(location.bounds.center);
        }
        else {
            newobj.goto(location);
            newobj.translate(this.gamebounds.topLeft)

        }
        return newobj;
    }


}


class Explosion {
    static filename = "pixelsplosion.gif";

    constructor(protected parent: PAGameObject) {
        this.explode(parent.bounds.center)
    }

    async explode(coords: Vector2) {
        const inode = this.parent.parent.cwd.getfile(PRPixelAssault.spritepath + Explosion.filename) as DSIWebFile;
        const textures = await get_image_textures(inode.url);
        const texturecount = textures.length;
        const sprite = DSKernel.terminal.newSprite(textures);
        sprite.x = coords.x - sprite.texture.width / 2
        sprite.y = coords.y - sprite.texture.height / 2
        sprite.enabled = true;
        while (sprite.i < texturecount - 1) {
            await sleep(50);
        }
        sprite.enabled = false;
    }
}

abstract class PAGameObject {
    protected sprite: DSSprite;
    public bounds: BoundingBox;
    public velocity: Vector2 = { x: 0, y: 0 };
    constructor(public parent: PRPixelAssault, private url: string) {
    }

    async initialize() {
        this.sprite = await this.get_sprite();
        this.bounds = new BoundingBox(
            this.sprite.x,
            this.sprite.x + this.sprite.texture.width,
            this.sprite.y,
            this.sprite.y + this.sprite.texture.height
        );
        this.parent.objects.push(this);

    }

    private async get_sprite(): Promise<DSSprite> {
        let inode;
        inode = this.parent.cwd.getfile(PRPixelAssault.spritepath + this.url);
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

    public update() {
        const adjustedvelocity: Vector2 = scale(this.velocity, 1 / this.parent.framerate)
        this.translate(adjustedvelocity);
    }

    public kill() {
        this.sprite.enabled = false;
        this.parent.killlist.push(this);
    }

    public onCollision(other: PAGameObject) { }

    public onOutOfBounds(touching: boolean) { }

}

class PABullet extends PAGameObject {
    public onCollision(other: PAGameObject): void {
        if (other instanceof PAShield || other instanceof PABullet) {
            this.kill();
        }
    }
    public onOutOfBounds(touching: boolean): void {
        if (!touching) {
            this.kill();
            this.goto({ x: 200, y: 200 })
        }
    }
}

class PAPlayerBullet extends PABullet {
    private speed = 500;
    public async initialize(): Promise<void> {
        await super.initialize();
        this.velocity = { x: 0, y: -this.speed }
    }

    public onCollision(other: PAGameObject): void {
        super.onCollision(other);
        if (other instanceof PAEnemy) {
            this.kill();
        }
    }
}

class PAEnemyBullet extends PABullet {
    private speed = 300;
    public async initialize(): Promise<void> {
        await super.initialize();
        this.velocity = { x: 0, y: this.speed }
    }
    public onCollision(other: PAGameObject): void {
        super.onCollision(other);
        if (other instanceof PASpaceship) {
            this.kill();
        }
    }
}

class PAEnemy extends PAGameObject {
    private health: number = 1;
    private speed: number = 100; //Units - px/sec
    private downdistace = 25; //Units - px
    private downtravelcountdown: number = 0;
    private shootchance = 1 / 300;

    public async initialize(): Promise<void> {
        await super.initialize();
        this.velocity = { x: this.speed, y: 0 }
    }
    public onCollision(other: PAGameObject): void {
        if (other instanceof PAPlayerBullet ||
            other instanceof PAShield ||
            other instanceof PASpaceship ||
            other instanceof PAEnemy
        ) {
            this.health--;
            if (this.health <= 0) {
                new Explosion(this);
                this.kill();
            }
        }
    }
    public update(): void {
        super.update();
        this.downtravelcountdown--;
        if (this.downtravelcountdown == 0) {
            let direction = this.bounds.x0 < this.parent.gamebounds.x0 + 50 ? 1 : -1
            this.velocity = { x: direction * this.speed, y: 0 }
        }
        if (Math.random() < this.shootchance) {
            this.parent.createObject(PAEnemyBullet, "enemybullet.png", this);
        }
    }

    public onOutOfBounds(touching: boolean): void {
        this.translate(scale(this.velocity, -1 / this.parent.framerate));
        this.velocity = { x: 0, y: this.speed }
        this.downtravelcountdown = Math.ceil(this.downdistace * this.parent.framerate / this.speed)
    }
}

class PAShield extends PAGameObject {

}

class PABonus extends PAGameObject {
    public onOutOfBounds(touching: boolean): void {
        if (!touching) {
            this.kill();
        }
    }
}


class PASpaceship extends PAGameObject {
    private boosting: boolean;
    private speed: number = 300;
    private firing: boolean = false;
    private firingcooldown: number = 0;
    private maxfiringcooldown: number = 200 / this.parent.framerate
    public static keyresponses: Record<string, Vector2> = {
        "KeyW": { x: 0, y: -1 },
        "KeyA": { x: -1, y: 0 },
        "KeyS": { x: 0, y: 1 },
        "KeyD": { x: 1, y: 0 },
        "ArrowUp": { x: 0, y: -1 },
        "ArrowLeft": { x: -1, y: 0 },
        "ArrowRight": { x: 1, y: 0 },
        "ArrowDown": { x: 0, y: 1 },
        "Space": { x: 0, y: 0 }
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
        if (key == "Space") {
            this.firing = down;
            return;
        }
        let factor = (down ? 1 : -1) * this.speed;
        let vector = PASpaceship.keyresponses[key]
        if (PASpaceship.keysdown[key] != down) {
            PASpaceship.keysdown[key] = down;
            this.velocity = { x: this.velocity.x + vector.x * factor, y: this.velocity.y + vector.y * factor }
        }
        if (!this.boosting && (this.velocity.x != 0 || this.velocity.y != 0)) {
            this.booston();
        }
        if (this.boosting && (this.velocity.x == 0 && this.velocity.y == 0)) {
            this.boostoff();
        }
    }

    private async booston() {
        this.boosting = true;
        this.sprite.i = 1;
        await sleep(50);
        this.sprite.i = 2;
    }

    private async boostoff() {
        this.boosting = false;
        this.sprite.i = 3;
        await sleep(50);
        this.sprite.i = 0;
    }


    public update(): void {
        super.update();
        this.firingcooldown--;
        if (this.firing) {
            if (this.firingcooldown <= 0) {
                this.firingcooldown = this.maxfiringcooldown;
                this.parent.createObject(PAPlayerBullet, "bullet.png", this)
            }
        }
    }

    public onOutOfBounds(touching: boolean): void {
        const adjustedvelocity: Vector2 = scale(this.velocity, -1 / this.parent.framerate);
        if (this.bounds.xwithin(this.parent.gamebounds)) {
            adjustedvelocity.x = 0;
        }
        if (this.bounds.ywithin(this.parent.gamebounds)) {
            adjustedvelocity.y = 0;
        }
        this.translate(adjustedvelocity);
    }

}