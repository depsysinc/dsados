import { DSFilePermsError } from "../dsFileSystem";
import { DSKernel } from "../dsKernel";
import { DSProcess, DSProcessError } from "../dsProcess";
import { DSStream, DSStreamClosedError } from "../dsStream";
import { DSTerminal } from "../dsTerminal";
import { sleep } from "../lib/dsLib";
import { DSOptionParser } from "../lib/dsOptionParser";

const up = '\x1b[A'
const down = '\x1b[B'
const right = '\x1b[C'
const left = '\x1b[D'

class CGameData {
    public static rock: string = 'Θ';
    public static player: string = 'Δ';
    public static bullet: string = '.';
    public static bodytypes: string = '┗━┓┃┏┛'
    public static cantravelthrough = ' '
    public static defaultframerefreshtime: number = 200;
    public static defaultcentipedelength: number = 10;
    public static bulletrefreshtime: number = 81;
    public static rows: number = 13;
    public static cols: number = 35;

    public static directions: Record<string, string> = {
        [down + down]: '┃',
        [left + left]: '━',
        [right + right]: '━',
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


export class PRCentipede extends DSProcess {

    private centipedemover: CentipedeMover;

    private leftoffset: number = 1;
    private topoffset: number = 1;

    private score: number = 100;

    private level: number = 1;
    private framerefreshtime = CGameData.defaultframerefreshtime;
    private centipedelength: number = CGameData.defaultcentipedelength;
    private rockcount: number = 22;


    private hidecursor = '\x1b[1000B\x1b[1000C'
    private topleft: string;
    private nextline: string;

    private framespassed: number = 0;
    private playerx: number = Math.floor(CGameData.cols / 2)

    private exit: boolean = false;
    private paused: boolean = false;

    protected async main(): Promise<void> {
        while (!this.screencorrectsize()) {
            this.stdout.write('\x1bc')
            this.stdout.write('Please resize your screen');
            await sleep(50);
        }
        this.refreshscreen();
        this.centipedemover = new CentipedeMover(this);

        await sleep(50);

        await this.startgame();

    }

    private async startgame() {
        this.functionloop(() => this.inputloop(), 0);
        this.functionloop(() => this.bulletloop(), CGameData.bulletrefreshtime);

        await sleep(1000);
        await this.functionloop(() => this.centipedeloop(), this.framerefreshtime);
        await this.exitorrestart();

    }


    private async functionloop(func: () => void, sleeptime: number) {
        while (!this.exit) {
            if (!this.paused) {
                func();
                await sleep(sleeptime)
            }
            else
                await sleep(50);
        }
    }

    private async inputloop() {
        let char;
        try {
            char = await this.stdin.read();
        }
        catch (DSStreamClosedError) {
            return;
        }
        if (this.exit) {
            return
        }
        if (char == right && this.playerx < CGameData.cols - 1) {
            this.replacechar(CGameData.rows - 1, this.playerx, ' ');
            this.playerx++;
            this.stdout.write(CGameData.player);
            this.stdout.write(this.hidecursor);
        }
        if (char == left && this.playerx > 0) {
            this.replacechar(CGameData.rows - 1, this.playerx - 1, CGameData.player);
            this.playerx--;
            this.stdout.write(' ');
            this.stdout.write(this.hidecursor);
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
            this.exit = true;
            this.stdin.write('n'); //Automatically quit instead of playing again (see waitorrestart)
        }

        if (char == 'p') {
            this.paused = true;
            let unpausechar = ' ';
            while (unpausechar != 'p') {
                try {
                    unpausechar = await this.stdin.read();
                }
                catch (DSStreamClosedError) {
                    return;
                }
            }
            this.paused = false;
        }
    }


    private centipedeloop() {
        this.centipedemover.reset()
        for (let i = 0; i < CGameData.rows - 1; i++) {
            this.centipedemover.processnextline();
        }
        this.stdout.write(this.hidecursor)
        if (this.haslost()) {
            this.loseGame();
        }
        else if (!this.centipedemover.hasmoved) {
            this.winGame();
        }
        this.framespassed++;
    }




    private bulletloop() {
        //Clear bullets from top of screen
        const topline = this.getline(0);
        for (let i = 0; i < CGameData.cols; i++) {
            if (topline[i] == CGameData.bullet) {
                this.replacechar(0, i, ' ')
            }
        }

        for (let i = 1; i < CGameData.rows; i++) {
            this.bulletmove(i, this.getline(i), this.getline(i - 1));
        }
        this.updatedisplay();
        this.stdout.write(this.hidecursor)

    }


    private bulletmove(row: number, line: string, lineabove: string) {
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
            let controlcode = `\x1b[${this.leftoffset}C`
            this.topleft += controlcode;
            this.nextline += controlcode;
        }
        if (this.topoffset > 0) {
            let controlcode = `\x1b[${this.topoffset}B`
            this.topleft += controlcode;
        }

    }


    private drawstartingboard() {

        //Clear terminal
        this.stdout.write("\x1bc");

        //Draw the rocks
        for (let i = 0; i < this.rockcount; i++) {
            this.replacechar(this.randInt(0, CGameData.rows - 1), this.randInt(0, CGameData.cols), CGameData.rock) //Possible to optimize
        }

        //Draw centipede
        this.stdout.write(this.topleft);
        for (let i = 0; i < this.centipedelength; i++) {
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
        this.stdout.write(up + up);
        this.stdout.write('LVL ' + this.level.toString())
        this.stdout.write(' '.repeat((CGameData.cols - 9) / 2 - 4 - this.level.toString().length) + 'CENTIPEDE  ')
        this.stdout.write(' '.repeat((CGameData.cols - 9) / 2 - this.score.toString().length - 1));
        this.stdout.write(this.score.toString())
        this.stdout.write(this.topleft);
        this.stdout.write(up + left);
        let borderchar = '#'
        this.stdout.write(borderchar.repeat(CGameData.cols + 2));
        let crossrow = `\x1b[${CGameData.cols}C`
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


    private async loseGame() {
        this.exit = true;
        this.score = 100;
        this.replacechar(2, Math.floor((CGameData.cols - 10) / 2), 'Y')
        this.stdout.write('OU LOSE');
        this.replacechar(3, Math.floor((CGameData.cols - 15) / 2), 'r');
        this.stdout.write('eplay? (y/n)')
    }


    private async winGame() {
        this.exit = true;
        this.setlevel(this.level + 1);
        this.replacechar(2, Math.floor((CGameData.cols - 10) / 2), 'Y')
        this.stdout.write('OU WIN');
        this.replacechar(3, Math.floor((CGameData.cols - 19) / 2), 'n');
        this.stdout.write('ext lvl? (y/n)')
    }


    private setlevel(newval: number) {
        this.level = newval
        this.centipedelength = 8 + 2 * this.level;
        this.framerefreshtime = 200 * 0.95 ^ this.level;
        this.rockcount = Math.min(CGameData.rows * CGameData.cols * 0.3, 22 + this.level)
    }


    private refreshscreen() {
        this.score = 100;
        this.adjustoffsets();
        this.drawstartingboard();
        this.drawdisplay();

    }


    private async exitorrestart() {
        this.stdin.write('~'); //Get rid of listener in inputloop()
        let key = ''
        while (key != 'y' && key != 'n') {
            try {
                key = await this.stdin.read();
            }
            catch (e) {
                console.log(e);
                await sleep(50);
            }
        }
        if (key == 'y') {
            this.refreshscreen();
            this.exit = false;
            await sleep(50);
            await this.startgame();
        }
        else {
            this.replacechar(5, Math.floor((CGameData.cols - 12) / 2), 'E')
            this.stdout.write('xiting...');
            return
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

    public replacechar(row: number, column: number, char: string) {
        if (column >= CGameData.cols ||
            row < 0 || column < 0 ||
            row >= CGameData.rows) {

            throw new RangeError("Indices " + column + ' ' + row + " out of range in replacechar")
        }

        this.stdout.write(this.topleft);
        if (row > 0) {
            this.stdout.write('\x1b[' + row + 'B'); //Down to the correct row
        }

        if (column > 0) {
            this.stdout.write('\x1b[' + column + 'C'); //Right to the correct column
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
        this.exit = true;
        if (DSKernel.terminal.cols < CGameData.cols || DSKernel.terminal.rows < CGameData.rows + 2) {
            this.stdout.write('\x1bc')
            this.stdout.write('Please resize your screen');
        }
        else {
            this.stdin.write('y'); //Restart the game (see waitandrestart)
        }
    }
}


class CentipedeMover {

    public hasmoved: boolean;

    private rownum: number = -1;
    private currentcol: number = 0
    private prevline: string;
    private line: string;
    private nextline: string;

    private length: number;

    private parent: PRCentipede;


    constructor(main: PRCentipede) {
        this.parent = main;
        this.length = CGameData.cols + 2
    }


    public reset() {
        this.hasmoved = false;
        this.rownum = -1;
        this.prevline = '';
        this.line = CGameData.rock.repeat(this.length);
        this.nextline = this.getpaddedline(0);
    }


    public async processnextline() {
        this.currentcol = 1;
        this.rownum++;
        this.prevline = this.line;
        this.line = this.nextline;
        this.nextline = this.getpaddedline(this.rownum + 1);
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
                    else if (newdirection == down) {
                        this.replacecurrentchar(CGameData.directions[CGameData.opposites[this.horizdirection()] + down])
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