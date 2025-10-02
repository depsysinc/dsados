import { DSFileSystemError, DSIDirectory } from "../dsFileSystem";
import { DSKernel } from "../dsKernel";
import { DSProcess } from "../dsProcess";
import { DSKeyEvent, DSSprite } from "../dsTerminal";
import { DSIWebFile } from "../filesystem/dsIWebFile";
import { cursornextline, cursorright, gotoxy, reset_text, right, set_cursor } from "../lib/dsCurses";
import { DSTexture, get_image_textures } from "../lib/dsImg";
import { sleep } from "../lib/dsLib";
import { DSOptionParser } from "../lib/dsOptionParser";

class PAGameData {
    public static framerate: number = 40;

    public static enemyrows: number = 5;
    public static enemycols: number = 8;

    public static spritepath: string = "/data/app/pixel_assault/"

    public static width = 400;
    public static height = 320;

    public static startlives = 3;

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

    public static replacementkeys: Record<string, string> = {
        "KeyW": "ArrowUp",
        "KeyA": "ArrowLeft",
        "KeyS": "ArrowDown",
        "KeyD": "ArrowRight",
        "ArrowUp": "Not a key",
        "ArrowLeft": "Not a key",
        "ArrowRight": "Not a key",
        "ArrowDown": "Not a key",

    }

}




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
        return this.xoverlaps(other) && this.yoverlaps(other);
    }

    xoverlaps(other: BoundingBox): boolean {
        if (other.x1 < this.x0 || other.x0 > this.x1)
            return false
        return true;
    }
    yoverlaps(other: BoundingBox): boolean {
        if (other.y1 < this.y0 || other.y0 > this.y1)
            return false
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

type EnemyType = {
    difficulty: number,
    spriteurl: string,
    health: number,
    scorevalue: number,
    shootchance: number,
    bonuschance: number,
    bulletspeed: number
}

//List of all enemy types; must be sorted from highest difficulty to lowest
const enemy_types: EnemyType[] = [
    {
        difficulty: 23,
        spriteurl: 'Alien1',
        health: 2,
        scorevalue: 810,
        shootchance: 1 / 30,
        bonuschance: 1 / 2,
        bulletspeed: 300
    },
    {
        difficulty: 11,
        spriteurl: 'grab',
        health: 1,
        scorevalue: 270,
        shootchance: 1 / 100,
        bonuschance: 1 / 3,
        bulletspeed: 150
    },

    {
        difficulty: 4.5,
        spriteurl: 'blub',
        health: 2,
        scorevalue: 90,
        shootchance: 1 / 300,
        bonuschance: 1 / 4,
        bulletspeed: 75
    },

    {
        difficulty: 1.2,
        spriteurl: 'paranoid.gif',
        health: 1,
        scorevalue: 30,
        shootchance: 1 / 800,
        bonuschance: 1 / 7,
        bulletspeed: 150
    },
    {
        difficulty: 0,
        spriteurl: 'enemygreen.gif',
        health: 1,
        scorevalue: 10,
        shootchance: 1 / 1500,
        bonuschance: 1 / 14,
        bulletspeed: 51
    }
]

export class PRPixelAssault extends DSProcess {

    public playing: boolean = false;
    public initialized: boolean = false;
    public exited: boolean = false;
    public splashing: boolean = true;


    private enemycount: number = 0;
    private currentwavenumber: number = 1;

    public frameNumber: number = 0;
    public gamebounds: BoundingBox = new BoundingBox(0, 500, 0, 500);

    private spaceship: PASpaceship;
    public objects: PAGameObject[] = [];
    public killlist: PAGameObject[] = [];
    private hearts: PANonInteracting[] = [];
    private scoredigits: PANonInteracting[] = [];

    public score: number = 0;


    protected async main(): Promise<void> {
        const optparser = new DSOptionParser(this.procname,true,"   play a game of Pixel Assault",);
        optparser.parseWithUsageAndHelp(this.argv);

        this.reset();
        this.splash();
        await this.mainloop();
        this.reset();
        return;
    }

    private async splash() {
        this.splashing = true;
        this.reset();
        if (!this.screenCorrectSize()) {
            DSKernel.terminal.resetSprites();
            this.stdout.write("Resize screen!")
        }
        else {
            this.createObject(PANonInteracting, "PixelAssaultSplash2.png", { x: 0, y: 0 })
        }
    }

    private async createGame() {
        this.reset();
        if (!this.screenCorrectSize()) {
            this.splash();
            return;
        }
        this.initialized = true;

        //Background
        await this.createObject(PANonInteracting, "background.jpg", { x: 0, y: 0 });

        //Score display
        for (let i = 0; i < 5; i++) {
            let digit = await this.createObject(PANonInteracting, "numbers", { x: 400 - 20 * (i + 1), y: 3 }) as PANonInteracting;
            this.scoredigits.push(digit);
            digit.sprite.paused = true;
        }

        //Spaceship
        this.spaceship = await this.createObject(PASpaceship, "player", { x: 200, y: 280 }) as PASpaceship;

        //Hearts
        for (let i = 0; i < this.spaceship.lives; i++) {
            await this.createHeart();
        }

        //Enemies
        await this.createEnemyWave(1);

        //Shields
        this.createShield({ x: 300, y: 230 })
        this.createShield({ x: 175, y: 230 })
        this.createShield({ x: 50, y: 230 })


        this.playing = true;

    }

    async mainloop() {
        while (!this.exited) {
            if (this.playing && !this.initialized) {
                await this.createGame();
            }

            if (this.playing) {
                this.stdout.write(cursorright(1)); //Sprites only update when xterm requests a refresh, when text is written to the terminal

                this.frameNumber++;
                this.updatescore();

                this.runUpdateFunctions();
                this.sendCollisionMessages();
                this.sendOutOfBoundsMessages();
                this.killObjects();
            }
            await sleep(1000 / PAGameData.framerate)
        }

    }

    private async createEnemyWave(difficulty: number) {
        PAEnemy.moving = false;
        PAEnemy.resetmotion();
        this.enemycount = PAGameData.enemycols * PAGameData.enemyrows;
        let difficultremaining = difficulty;
        for (let j = 0; j < PAGameData.enemyrows; j++) {
            let rowtype: EnemyType;
            for (let i = 0; i < enemy_types.length; i++) {

                if (enemy_types[i].difficulty <= difficultremaining) {
                    rowtype = enemy_types[i];
                    difficultremaining -= rowtype.difficulty;
                    break;
                }
            }
            for (let i = 0; i < PAGameData.enemycols; i++) {
                this.createObject(PAEnemy, 'Enemies/' + rowtype.spriteurl, { x: 35 * i + 10, y: 25 + j * 25 }).then((enemy) => {
                    (enemy as PAEnemy).setType(rowtype);
                }
                );
            }
        }
        PAEnemy.moving = true;

    }

    public createShield(coords: Vector2) {
        const shieldpiecewidth = 5;
        const shielddrawing =
            `
  111111  
 11111111 
1111111111
1111111111
1111  1111
111    111
        `.split('\n')
        const blockplaces: Vector2[] = []
        for (let i = shielddrawing.length - 1; i >= 0; i--) {
            for (let j = 0; j < shielddrawing[i].length; j++) {
                if (shielddrawing[i][j] != ' ') {
                    blockplaces.push({ x: j, y: i })
                }
            }
        }
        for (let i = 0; i < blockplaces.length; i++) {
            let newcoords = {
                x: blockplaces[i].x * shieldpiecewidth + coords.x,
                y: blockplaces[i].y * shieldpiecewidth + coords.y
            }
            this.createObject(PAShield, "shieldpiece6.png", newcoords)
        }
    }

    public async createRandomBonus(parent: PAGameObject) {
        const bufftypes = ['bulletbonus', 'heartbonus', 'scorebonus', 'shieldbonus', 'speedbonus']
        const buffchoice = bufftypes[Math.floor(Math.random() * bufftypes.length)]
        const obj = await this.createObject(PABonus, "bonuses/" + buffchoice + ".png", parent) as PABonus;
        obj.bufftype = buffchoice;
    }

    public async createHeart() {
        let heart = await this.createObject(PANonInteracting, "heartanim.gif", { x: 30 * this.hearts.length, y: 0 }) as PANonInteracting;
        this.hearts.push(heart);
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
            newobj.translate(this.gamebounds.topLeft);

        }
        return newobj;
    }


    private updatescore() {
        let scorestring = this.score.toString();
        scorestring = '0'.repeat(5 - scorestring.length) + scorestring
        const digits = '0123456789'
        for (let i = 0; i < scorestring.length; i++) {
            let digit = digits.indexOf(scorestring[4 - i])
            this.scoredigits[i].sprite.i = digit
        }
    }

    runUpdateFunctions() {
        for (let i = 0; i < this.objects.length; i++) {
            this.objects[i].update()
        }

    }

    sendCollisionMessages() {
        for (let i = 0; i < this.objects.length; i++) {
            for (let j = i + 1; j < this.objects.length; j++) {
                if (this.objects[i].bounds.overlaps(this.objects[j].bounds)) {
                    this.objects[i].onCollision(this.objects[j]);
                    this.objects[j]?.onCollision(this.objects[i]);
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
            if (obj instanceof PAEnemy) {
                if (!this.killlist.slice(i + 1).includes(obj))
                    this.onEnemyKilled();
            }
        }
        this.killlist = [];
    }



    public async onEnemyKilled() {
        this.enemycount--;
        if (this.enemycount == 0) {
            this.currentwavenumber += 1;
            await sleep(3000);
            this.createEnemyWave(this.currentwavenumber)
        }

    }

    public loseHeart() {
        let lastheart = this.hearts.pop()
        lastheart.kill();
    }

    public async loseGame() {
        let score = this.score;
        this.reset();

        this.stdout.write(gotoxy(0, 4));
        this.writelinecentered("YOU LOSE");
        this.writelinecentered("Your Score: " + score);

        await sleep(5000);
        this.splash();
    }


    private writelinecentered(message: string) {
        if (message.length > DSKernel.terminal.cols) {
            console.warn("Message too long, trimming");
            let trimlength = Math.ceil((message.length - DSKernel.terminal.cols) / 2);
            message = message.slice(trimlength, message.length - trimlength);
        }
        let middlecol = DSKernel.terminal.cols / 2;
        this.stdout.write(cursornextline());
        this.stdout.write(right.repeat(Math.floor(middlecol - message.length / 2)));
        this.stdout.write(message);

    }

    private reset() {
        this.stdout.write(reset_text());
        DSKernel.terminal.resetSprites();
        this.stdout.write(set_cursor(false));
        this.updateGameBounds();
        this.currentwavenumber = 1;
        this.objects = [];
        this.playing = false;
        this.initialized = false;
        this.score = 0;
        this.hearts = [];
        this.enemycount = 0;
        this.killlist = [];
        this.scoredigits = [];
        this.frameNumber = 0;
        PAEnemy.resetmotion();
        PASpaceship.resetkeysdown();

    }

    handleKeyEvent(e: DSKeyEvent): void {
        if (e.key == "KeyQ") {
            console.log("leave")
            this.exited = true;
        }
        if (this.splashing && e.key == "KeyY") {
            this.createGame();
            this.splashing = false;
        }
        if (e.key == "KeyP" && e.down) {
            this.playing = !this.playing;
        }

        if (this.playing && e.key in PAGameData.keyresponses) {
            this.spaceship.onkey(e.key, e.down);
        }
    }

    handleResize(): void {
        this.splash();
    }

    private updateGameBounds() {
        this.gamebounds = new BoundingBox(
            (DSKernel.terminal.width - PAGameData.width) / 2,
            (DSKernel.terminal.width + PAGameData.width) / 2,
            (DSKernel.terminal.height - PAGameData.height) / 2,
            (DSKernel.terminal.height + PAGameData.height) / 2
        )
    }

    private screenCorrectSize() {
        return DSKernel.terminal.width >= PAGameData.width && DSKernel.terminal.height >= PAGameData.height;
    }
}




abstract class PAGameObject {
    protected sprite: DSSprite;
    public bounds: BoundingBox;
    public velocity: Vector2 = { x: 0, y: 0 };

    private static texturehashes: Record<string, DSTexture[]> = {}

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
        let textures: DSTexture[] = [];
        if (this.url in PAGameObject.texturehashes) {
            textures = PAGameObject.texturehashes[this.url];
        }
        else {
            let inode = this.parent.cwd.getfile(PAGameData.spritepath + this.url);

            //If passed directory, cycle through the filelist and add them all to textures
            if (inode instanceof DSIDirectory) {
                for (let i = 2; i < inode.filelist.length; i++) {
                    let childnode = inode.filelist[i].inode
                    if (!(childnode instanceof DSIWebFile)) {
                        throw new DSFileSystemError("Directory contents not webfiles");
                    }
                    textures = textures.concat(await get_image_textures(childnode.url));
                    textures[i - 2].duration = 150000;
                }
            }
            else if (inode instanceof DSIWebFile) {
                textures = await get_image_textures(inode.url);
            }
            else {
                throw new DSFileSystemError("Incorrect sprite type passed")
            }
            PAGameObject.texturehashes[this.url] = textures;
        }

        let sprite = DSKernel.terminal.newSprite(textures);
        sprite.enabled = true;
        return sprite
    }

    public goto(location: Vector2) {
        const currentpos: Vector2 = this.bounds.topLeft
        const offset: Vector2 = { x: location.x - currentpos.x, y: location.y - currentpos.y }
        this.translate(offset);
    }

    public translate(offset: Vector2) {
        this.bounds = this.bounds.transform(offset);
        this.sprite.x += offset.x;
        this.sprite.y += offset.y;
    }

    public update() {
        const adjustedvelocity: Vector2 = scale(this.velocity, 1 / PAGameData.framerate)
        this.translate(adjustedvelocity);
    }

    public kill() {
        this.sprite.enabled = false;
        this.parent.killlist.push(this);
    }

    public explode() {
        new Explosion(this);
    }
    public onCollision(other: PAGameObject) { }

    public onOutOfBounds(touching: boolean) { }

}

class PANonInteracting extends PAGameObject {
    public sprite: DSSprite;


    public async initialize(): Promise<void> {
        await super.initialize();
        let removedself = this.parent.objects.pop()
        if (removedself != this) {
            throw new Error("Something went wrong")
        };
    }
}

class PAShield extends PAGameObject {
    public onCollision(other: PAGameObject): void {
        if (other instanceof PABullet ||
            other instanceof PAEnemy
        ) {
            this.kill();
        }
    }
}

class PABullet extends PAGameObject {
    public onCollision(other: PAGameObject): void {
        if (other instanceof PAShield) {
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

    public setSpeed(newspeed: number) {
        this.speed = newspeed;
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
    private type: EnemyType;

    private static speed: number = 50; //Units - px/sec

    protected static globalhorizontalmotion: Vector2 = { x: this.speed, y: 0 };
    public static moving: boolean = false;

    private static downdistace = 15; //Units - px
    private static downframes: number; //Units - frames
    protected static downstartframe: number = -50;

    public async initialize(): Promise<void> {
        await super.initialize();
        this.velocity = PAEnemy.globalhorizontalmotion;
        PAEnemy.downframes = Math.ceil(PAEnemy.downdistace * PAGameData.framerate / PAEnemy.speed)
    }

    public setType(type: EnemyType) {
        this.type = type;
        this.health = type.health;
    }

    public onCollision(other: PAGameObject): void {
        if (other instanceof PAPlayerBullet ||
            other instanceof PAShield ||
            other instanceof PASpaceship
        ) {
            this.health--;
            if (this.health <= 0) {
                this.explode();
                this.kill();
                if (other instanceof PAPlayerBullet || other instanceof PASpaceship) {
                    this.parent.score += this.type.scorevalue;
                    if (Math.random() < this.type.bonuschance) {
                        this.parent.createRandomBonus(this);
                    }
                }
            }
        }
    }

    public async createBullet() {
        let bullet = await this.parent.createObject(PAEnemyBullet, "enemybullet.png", this) as PAEnemyBullet;
        bullet.setSpeed(this.type.bulletspeed);

    }


    public static resetmotion() {
        this.downstartframe = -50;
        this.globalhorizontalmotion = { x: this.speed, y: 0 };
    }


    public update(): void {
        const framessincedowntravel = this.parent.frameNumber - PAEnemy.downstartframe
        if (framessincedowntravel == 1) {
            this.velocity = scale(PAEnemy.globalhorizontalmotion, -1);
        }
        else if (framessincedowntravel < PAEnemy.downframes) {
            this.velocity = { x: 0, y: PAEnemy.speed }
        }
        else if (framessincedowntravel == PAEnemy.downframes) {
            this.velocity = scale(PAEnemy.globalhorizontalmotion, -1);
        }
        else {
            PAEnemy.globalhorizontalmotion = this.velocity;
        }
        if (PAEnemy.moving) {
            super.update();
        }

        if (Math.random() < this.type.shootchance) {
            this.createBullet();
        }
    }

    public onOutOfBounds(touching: boolean): void {
        PAEnemy.downstartframe = this.parent.frameNumber;
        if (!this.bounds.ywithin(this.parent.gamebounds)) {
            this.parent.loseGame();
        }
    }
}

class PABonus extends PAGameObject {

    public bufftype: string;

    public onOutOfBounds(touching: boolean): void {
        if (!touching) {
            this.kill();
        }
    }

    public onCollision(other: PAGameObject): void {
        if (other instanceof PASpaceship) {
            this.grantbuff(other);
            this.kill();
        }
    }

    public async initialize(): Promise<void> {
        await super.initialize();
        this.velocity.y = 20;
    }

    public update(): void {
        this.velocity.x = 20 * Math.sin(this.parent.frameNumber / 20);
        super.update();
    }

    public grantbuff(spaceship: PASpaceship) {
        switch (this.bufftype) {
            case "bulletbonus":
                spaceship.speedbullets();
                break;

            case "heartbonus":
                if (spaceship.lives < 10) {
                    this.parent.createHeart();
                    spaceship.lives++
                }
                break;

            case "scorebonus":
                this.parent.score += 150 + 10 * Math.floor(Math.random() * 10);
                break;

            case "shieldbonus":
                let ycoord = spaceship.bounds.center.y - 70;
                let xcoord = spaceship.bounds.center.x - 35 + Math.random() * 20
                let clampedycoord = Math.max(this.parent.gamebounds.y0, Math.min(this.parent.gamebounds.y1 - 100, ycoord))
                let clampedxcoord = Math.max(this.parent.gamebounds.x0, Math.min(this.parent.gamebounds.x1, xcoord))
                this.parent.createShield({ x: clampedxcoord - this.parent.gamebounds.x0, y: clampedycoord - this.parent.gamebounds.y0 });
                break;

            case "speedbonus":
                spaceship.speedup();
                break;

            default:
                console.warn("Unknown buff type:", this.bufftype);
                break;
        }
    }
}

class PASpaceship extends PAGameObject {

    public lives: number = PAGameData.startlives;

    private boosting: boolean;
    private speed: number = 200;
    private firing: boolean = false;
    private firingcooldown: number = 0;
    private maxfiringcooldown: number = 500 / PAGameData.framerate

    public static keysdown: Record<string, boolean> = {
        "KeyW": false,
        "KeyA": false,
        "KeyS": false,
        "KeyD": false,
        "ArrowUp": false,
        "ArrowLeft": false,
        "ArrowRight": false,
        "ArrowDown": false,
        "Not a key": false
    }



    public static resetkeysdown() {
        this.keysdown = {
            "KeyW": false,
            "KeyA": false,
            "KeyS": false,
            "KeyD": false,
            "ArrowUp": false,
            "ArrowLeft": false,
            "ArrowRight": false,
            "ArrowDown": false,
            "Not a key": false
        }
    }

    public onkey(key: string, down: boolean) {
        if (key == "Space") {
            this.firing = down;
            return;
        }
        if (PASpaceship.keysdown[key] != down) {
            PASpaceship.keysdown[key] = down;
        }
    }

    async initialize() {
        await super.initialize();
        this.sprite.paused = true;
    }

    public update(): void {

        this.firingcooldown--;
        if (this.firing) {
            if (this.firingcooldown <= 0) {
                this.firingcooldown = this.maxfiringcooldown;
                this.parent.createObject(PAPlayerBullet, "bullet.png", this)
            }
        }
        this.velocity = { x: 0, y: 0 }
        Object.keys(PASpaceship.keysdown).forEach(key => {
            if (PASpaceship.keysdown[key] && !PASpaceship.keysdown[PAGameData.replacementkeys[key]]) {
                this.velocity = {
                    x: this.velocity.x + PAGameData.keyresponses[key].x * this.speed,
                    y: this.velocity.y + PAGameData.keyresponses[key].y * this.speed,
                }
            }
        });

        if (!this.boosting && (this.velocity.x != 0 || this.velocity.y != 0)) {
            this.booston();
        }
        if (this.boosting && (this.velocity.x == 0 && this.velocity.y == 0)) {
            this.boostoff();
        }

        super.update();
    }

    public onOutOfBounds(touching: boolean): void {
        const adjustedvelocity: Vector2 = scale(this.velocity, -1 / PAGameData.framerate);
        if (this.bounds.xwithin(this.parent.gamebounds)) {
            adjustedvelocity.x = 0;
        }
        if (this.bounds.ywithin(this.parent.gamebounds)) {
            adjustedvelocity.y = 0;
        }
        this.translate(adjustedvelocity);
    }

    public onCollision(other: PAGameObject): void {
        if (other instanceof PAEnemyBullet || other instanceof PAEnemy) {
            this.lives -= 1;
            this.parent.loseHeart();
            this.flashanim();

            if (this.lives == 0) {
                this.explode();
                this.parent.loseGame();
            }
        }

        if (other instanceof PAShield) {
            const backupvelocity: Vector2 = scale(this.velocity, -1 / PAGameData.framerate);
            this.translate(backupvelocity);
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

    private async flashanim() {
        for (let i = 0; i < 4; i++) {
            this.sprite.enabled = false;
            await sleep(100);
            this.sprite.enabled = true;
            await sleep(100);
        }
    }

    public async speedbullets() {
        this.maxfiringcooldown /= 2;
        await sleep(5000);
        this.maxfiringcooldown *= 2;
    }

    public async speedup() {
        this.speed *= 2;
        await sleep(5000);
        this.speed /= 2;
    }

}


class Explosion {
    static filename = "pixelsplosion.gif";

    constructor(protected parent: PAGameObject) {
        this.explode(parent.bounds.center)
    }

    async explode(coords: Vector2) {
        const inode = this.parent.parent.cwd.getfile(PAGameData.spritepath + Explosion.filename) as DSIWebFile;
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