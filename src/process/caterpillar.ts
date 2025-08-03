import { DSKernel } from "../dsKernel";
import { DSProcess } from "../dsProcess";
import { up, down, left, right, cursordown, cursorleft, cursornextline, cursorright, reset, set_cursor } from "../lib/dsCurses";
import { sleep } from "../lib/dsLib";

class CGameData {
    public static rock: string = 'Θ';
    public static player: string = 'Δ';
    public static bullet: string = '.';
    public static bodytypes: string = '┗━┓┃┏┛'
    public static cantravelthrough = ' '
    public static defaultcaterpillartime: number = 200;
    public static defaultcaterpillarlength: number = 10;
    public static bulletrefreshtime: number = 81;
    public static rows: number = 13;
    public static cols: number = 36;

    public static directions: Record<string, string> = {
        [down + down]: '┃',
        [left + left]: '━',
        [right + right]: '━',
        [left + right]: '━',
        [right + left]: '━',
        [left + down]: '┓',
        [right + down]: '┏',
        [down + right]: '┗',
        [down + left]: '┛'
    }

    public static lastdirections: Record<string, string> = {
        [down]: this.directions[down + down] + this.directions[left + down] + this.directions[right + down],
        [left]: this.directions[down + left] + this.directions[left + left],
        [right]: this.directions[down + right] + this.directions[right + right],
    }

    public static firstdirections: Record<string, string> = {
        [down]: this.directions[down + down] + this.directions[down + left] + this.directions[down + right],
        [left]: this.directions[left + left] + this.directions[left + down],
        [right]: this.directions[right + down] + this.directions[right + right],
    }

    public static numberdirections: Record<string, number> = {
        [left]: -1,
        [right]: 1
    }

    public static opposites: Record<string, string> = {
        [up]: down,
        [down]: up,
        [left]: right,
        [right]: left
    }


}


export class PRCaterpillar extends DSProcess {

    private caterpillar: Caterpillar;

    private leftoffset: number = 1;
    private topoffset: number = 1;

    private score: number = 100;

    private level: number = 1;
    private caterpillartime = CGameData.defaultcaterpillartime;
    private caterpillarlength: number = CGameData.defaultcaterpillarlength;
    private rockcount: number = 22;

    private topleft: string;
    private nextline: string;

    private playerx: number = Math.floor(CGameData.cols / 2)

    private exit: boolean = false;
    private levelend: boolean = false;
    private paused: boolean = false;

    protected async main(): Promise<void> {
        while (!this.screencorrectsize()) {
            this.stdout.write(reset());
            this.stdout.write('Please resize your screen');
            await sleep(50);
        }
        this.stdout.write(set_cursor(false));
        this.caterpillar = new Caterpillar(this);

        this.splash();

        await this.gameloop();

    }
    private splash() {
        this.stdout.write(reset());
        this.writelinecentered('#        ┏┓┏┓┏┳┓┏┓┳┓┏┓┳┓ ┓ ┏┓┳┓         #');
        this.writelinecentered('#        ┃ ┣┫ ┃ ┣ ┣┫┃┃┃┃ ┃ ┣┫┣┫         #');
        this.writelinecentered('#        ┗┛┛┗ ┻ ┗┛┛┗┣┛┻┗┛┗┛┛┗┛┗╸        #');
        this.writelinecentered('#                                       #');
        this.writelinecentered('#         A GAME OF CRAWLY DOOM         #');
        this.writelinecentered('# Θ                         ┏━━━━━━┛    #');
        this.writelinecentered('#             Θ             ┗━━━━━━━━━┓ #');
        this.writelinecentered('#                                 ┏━━━┛ #');
        this.writelinecentered('#       Θ                Θ        .     #');
        this.writelinecentered('#                                       #');
        this.writelinecentered('#                PRESS Y         ≡Δ     #');
        this.writelinecentered('#               q to exit               #');
        this.writelinecentered('#                                       #');

        for (let i = 0; i < DSKernel.terminal.rows - 14; i++) {
            this.stdout.write(cursornextline())
        }
        if (DSKernel.terminal.cols < 56) {
            this.writelinecentered('© 2025 Deprecated Systems')
        }
        else {
            this.writelinecentered('© 2025 Deprecated Systems - Created by Nicholas Waslander');
        }

    }

    private async gameloop() {
        while (!this.exit) {

            this.exit = await this.exitorrestart();

            if (this.exit) {
                return;
            }

            this.refreshscreen();
            await sleep(50); //Make sure the splash screen is cleared before letting the gameplay start

            let time = performance.now(); 
            let deltatime;
            let time_since_caterpillar = -1000; //-1000 so the caterpillar will pause at the start
            let time_since_bullet = 0;

            while (!this.levelend) {
                deltatime = performance.now() - time;
                time = performance.now();
                time_since_caterpillar += deltatime;
                time_since_bullet += deltatime;

                if (time_since_caterpillar > this.caterpillartime) {
                    time_since_caterpillar = 0;
                    this.caterpillar.processscreen();
                }

                if (time_since_bullet > CGameData.bulletrefreshtime) {
                    time_since_bullet = 0;
                    this.processbullet();
                }

                this.inputloop();

                if (this.haslost()) {
                    this.loseGame();

                }
                else if (this.haswon()) {
                    this.winGame();
                }

                await sleep(5);

            }
        }
    }


    private async inputloop() {
        for (let i = 0; i < this.stdin.readsPending(); i++) {
            let char;
            try {
                char = await this.stdin.read();
            }
            catch (DSStreamClosedError) {
                return;
            }
            if (this.levelend) {
                return
            }
            if (char == right && this.playerx < CGameData.cols - 1) {
                this.replacechar(CGameData.rows - 1, this.playerx, ' ');
                this.playerx++;
                this.stdout.write(CGameData.player);
            }
            if (char == left && this.playerx > 0) {
                this.replacechar(CGameData.rows - 1, this.playerx - 1, CGameData.player);
                this.playerx--;
                this.stdout.write(' ');
            }
            if (char == ' ') {
                let prevline = this.getline(CGameData.rows - 2);
                if (prevline[this.playerx] == CGameData.bullet) {
                    return;
                }
                else if (prevline[this.playerx] == ' ') {
                    this.replacechar(CGameData.rows - 2, this.playerx, CGameData.bullet);
                }
                else if (CGameData.bodytypes.includes(prevline[this.playerx])) {
                    this.replacechar(CGameData.rows - 2, this.playerx, CGameData.rock);
                }
                else if (prevline[this.playerx] == CGameData.rock) {
                    this.replacechar(CGameData.rows - 2, this.playerx, ' ')
                }
                this.score -= 1;
            }
            if (char == 'q') {
                this.levelend = true;
                this.exit = true;
                this.exitscreen();
            }

            if (char == 'p') {
                this.paused = true;
                let unpausechar = ' ';
                while (unpausechar != 'p') {
                    try {
                        unpausechar = await this.stdin.read();
                        if (unpausechar == 'q') {
                            this.levelend = true;
                            this.exit = true;
                            this.exitscreen();

                        }
                    }
                    catch (DSStreamClosedError) {
                        return;
                    }
                }
                this.paused = false;
            }
        }
    }


    private processbullet() {
        //Clear bullets from top of screen
        const topline = this.getline(0);
        for (let i = 0; i < CGameData.cols; i++) {
            if (topline[i] == CGameData.bullet) {
                this.replacechar(0, i, ' ')
            }
        }

        for (let i = 1; i < CGameData.rows; i++) {
            this.bulletmoveline(i, this.getline(i), this.getline(i - 1));
        }
        this.updatedisplay();

    }


    private bulletmoveline(row: number, line: string, lineabove: string) {
        lineabove = lineabove;
        line = line;
        for (let col = 0; col < CGameData.cols; col++) {
            if (line[col] == CGameData.bullet) {
                this.replacechar(row, col, ' ')
                if (lineabove[col] == CGameData.rock) {
                    this.replacechar(row - 1, col, ' ')
                    this.score += 2;
                }
                else if (CGameData.bodytypes.includes(lineabove[col])) {
                    this.replacechar(row - 1, col, CGameData.rock)
                    this.score += 10;

                }
                else {
                    this.replacechar(row - 1, col, CGameData.bullet);
                }
            }
        }
    }


    private adjustoffsets() {
        this.leftoffset = Math.ceil((DSKernel.terminal.cols - CGameData.cols) / 2);
        this.topoffset = 2
        this.topleft = '\x1b[1000F';
        this.nextline = '\x1b[E';
        if (this.leftoffset > 0) {
            let controlcode = cursorright(this.leftoffset);
            this.topleft += controlcode;
            this.nextline += controlcode;
        }
        if (this.topoffset > 0) {
            let controlcode = cursordown(this.topoffset);
            this.topleft += controlcode;
        }

    }


    private drawstartingboard() {

        this.stdout.write(reset());

        //Draw the rocks
        for (let i = 0; i < this.rockcount; i++) {
            this.replacechar(this.randInt(0, CGameData.rows - 1), this.randInt(0, CGameData.cols), CGameData.rock)
        }

        //Draw caterpillar
        this.stdout.write(this.topleft);
        for (let i = 0; i < this.caterpillarlength; i++) {
            this.stdout.write(CGameData.directions[left + left]);
            if (i % CGameData.cols == CGameData.cols - 1) {
                this.stdout.write(this.topleft);
                this.stdout.write(this.nextline.repeat(Math.floor(i / CGameData.cols) + 1))
            }
        }

        //Player
        this.replacechar(CGameData.rows - 1, this.playerx, CGameData.player);
    }


    private drawdisplay() {
        this.stdout.write(this.topleft);
        this.stdout.write(up + up + left);
        this.stdout.write('LVL ' + this.level.toString())
        this.stdout.write(' '.repeat((CGameData.cols - 11) / 2 - 3 - this.level.toString().length) + 'CATERPILLAR  ')
        this.stdout.write(' '.repeat((CGameData.cols - 11) / 2 - this.score.toString().length));
        this.stdout.write(this.score.toString())
        this.stdout.write(this.topleft);
        this.stdout.write(up + left);
        let borderchar = '#'
        this.stdout.write(borderchar.repeat(CGameData.cols + 2));
        let crossrow = cursorright(CGameData.cols);
        for (let i = 0; i < CGameData.rows; i++) {
            this.stdout.write(this.nextline + left);
            this.stdout.write(borderchar)
            this.stdout.write(crossrow);
            this.stdout.write(borderchar)
        }
        this.stdout.write(this.nextline + left);
        this.stdout.write(borderchar.repeat(CGameData.cols + 2))
    }


    private updatedisplay() {
        this.stdout.write(this.topleft);
        this.stdout.write(up + up + right.repeat(CGameData.cols - this.score.toString().length));
        this.stdout.write(' ' + this.score.toString());
    }


    private haslost(): Boolean {
        let lastline = this.getline(CGameData.rows - 1);
        for (let i = 0; i < lastline.length; i++) {
            if (CGameData.bodytypes.includes(lastline[i])) {
                return true;
            }
        }
        return false;
    }


    private haswon(): Boolean {
        return !this.caterpillar.iscaterpillarremaining;
    }


    private async loseGame() {
        this.levelend = true;
        this.score = 100;
        this.replacechar(1, 0, ''); //Move cursor to first row
        this.writelinecentered('YOU LOSE')
        this.writelinecentered('replay? (y/n)');
    }


    private async winGame() {
        this.levelend = true;
        this.setlevel(this.level + 1);
        this.replacechar(1, 0, ''); //Move cursor to first row
        this.writelinecentered('YOU WIN')
        this.writelinecentered('next lvl? (y/n)');
    }


    private setlevel(newval: number) {
        this.level = newval
        this.caterpillarlength = CGameData.defaultcaterpillarlength + 2 * (this.level - 1);
        this.caterpillartime = CGameData.defaultcaterpillartime * (1 - 1 / 2 * Math.tanh(this.level / 10));
        this.rockcount = Math.min(CGameData.rows * CGameData.cols * 0.3, 22 + this.level)
    }


    private refreshscreen() {
        this.adjustoffsets();
        this.drawstartingboard();
        this.drawdisplay();
        this.caterpillar.reset();
    }

    private exitscreen() {
        this.stdout.write(reset());
        this.stdout.write('Exiting...');
    }


    private async exitorrestart(): Promise<boolean> {
        this.stdin.write('~'); //Get rid of listener in inputloop()
        let key = ''
        while (key != 'y' && key != 'n' && key != 'q') {
            key = await this.stdin.read();
        }

        if (key == 'y') {
            this.levelend = false;
            return false;
        }
        else {
            this.exitscreen();
            return true;
        }
    }

    private screencorrectsize(): boolean {
        return DSKernel.terminal.cols > CGameData.cols + 2 && DSKernel.terminal.rows > CGameData.rows + 2
    }


    public getline(index: number): string {
        if (index < 0 || index - this.topoffset > CGameData.rows) {
            return '';
        }
        const line = DSKernel.terminal.xterm.buffer.active.getLine(index + this.topoffset).translateToString();
        const gamesection = line.slice(this.leftoffset, CGameData.cols + this.leftoffset);
        return gamesection
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


    public replacechar(row: number, column: number, char: string) {
        if (column >= CGameData.cols ||
            row < 0 || column < 0 ||
            row >= CGameData.rows) {

            throw new RangeError("Indices " + column + ' ' + row + " out of range in replacechar")
        }

        this.stdout.write(this.topleft);
        if (row > 0) {
            this.stdout.write(cursordown(row)); //Down to the correct row
        }

        if (column > 0) {
            this.stdout.write(cursorright(column)); //Right to the correct column
        }

        this.stdout.write(char);

    }
    //Includes a, doesn't include b 
    private randInt(a: number, b: number): number {
        let randval = Math.random();
        let mappedval = randval * (b - a) + a;
        return Math.floor(mappedval);
    }

    handleResize(): void {
        this.levelend = true;
        if (DSKernel.terminal.cols < CGameData.cols || DSKernel.terminal.rows < CGameData.rows + 2) {
            this.stdout.write(reset());
            this.stdout.write('Please resize your screen');
        }
        else {
            this.score = 100;
            this.splash();
        }
    }
}


class Caterpillar {

    public iscaterpillarremaining: boolean = true;
    private hasmoved: boolean;

    private rownum: number = -1;
    private currentcol: number = 0
    private prevline: string;
    private line: string;
    private nextline: string;

    private length: number;

    private parent: PRCaterpillar;


    constructor(main: PRCaterpillar) {
        this.parent = main;
        this.length = CGameData.cols + 2
    }


    public reset() {
        this.hasmoved = false;
        this.rownum = -1;
        this.prevline = '';
        this.line = CGameData.rock.repeat(this.length);
        this.nextline = this.getpaddedline(0);
        this.iscaterpillarremaining = true;
    }


    public async processscreen() {
        this.reset();
        for (this.rownum = 0; this.rownum < CGameData.rows - 1; this.rownum++) {
            this.updatelines();
            for (this.currentcol = 1; this.currentcol < this.length - 1; this.currentcol++) {
                if (CGameData.bodytypes.includes(this.line[this.currentcol])) {
                    this.hasmoved = true;
                    if (this.isheadofsnake()) {
                        let newdirection;
                        if (CGameData.cantravelthrough.includes(this.gettileahead())) {
                            newdirection = this.horizdirection();
                        }
                        else {
                            newdirection = down;
                        }

                        if (this.line[this.currentcol] == CGameData.directions[down + down])
                            this.replacecurrentchar(CGameData.directions[down + newdirection])
                        else {
                            this.replacecurrentchar(CGameData.directions[CGameData.opposites[this.horizdirection()] + newdirection])
                        }
                        this.movecursor(newdirection);
                        this.replacecurrentchar(CGameData.directions[newdirection + newdirection])
                        this.movecursor(CGameData.opposites[newdirection])
                    }

                    if (this.isendofsnake()) {
                        this.replacecurrentchar(' ')
                    }

                }
            }

        }
        this.iscaterpillarremaining = this.hasmoved;
    }

    private updatelines() {
        this.prevline = this.line;
        this.line = this.nextline;
        this.nextline = this.getpaddedline(this.rownum + 1);

    }


    private movecursor(direction: string) {
        switch (direction) {
            case left:
                this.currentcol -= 1
                break;
            case right:
                this.currentcol += 1;
                break;
            case down:
                this.rownum += 1
                break;
            case up:
                this.rownum -= 1
                break;
        }
    }


    private replacecurrentchar(replacement: string) {
        if (replacement.length > 1) {
            throw new Error("Attempt to use a multi-character sprite")
        }
        this.parent.replacechar(this.rownum, this.currentcol - 1, replacement)
    }


    private isendofsnake(): boolean {
        if (CGameData.lastdirections[this.horizdirection()].includes(this.gettilebehind())) {
            return false
        }
        if (CGameData.lastdirections[down].includes(this.prevline[this.currentcol])) {
            return false
        }
        return true;
    }


    private isheadofsnake(): boolean {
        if (CGameData.firstdirections[CGameData.opposites[this.horizdirection()]].includes(this.gettileahead())) {
            return false;
        }
        if (CGameData.firstdirections[down].includes(this.nextline[this.currentcol])) {
            return false
        }
        return true
    }


    private gettileahead(): string {
        return this.line[this.currentcol + CGameData.numberdirections[this.horizdirection()]]
    }


    private gettilebehind(): string {
        return this.line[this.currentcol - CGameData.numberdirections[this.horizdirection()]]

    }


    private getpaddedline(index: number) {
        return CGameData.rock + this.parent.getline(index) + CGameData.rock;
    }


    private horizdirection(): string {
        return [right, left][this.rownum % 2]
    }
}