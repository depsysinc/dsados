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

const opposites = new Map([
    [up, down],
    [down, up],
    [left, right],
    [right, left]
])

enum GameStates {
    Playing,
    Won,
    Lost
}

class CGameData {
    public static rock: string = 'Θ';
    public static player: string = 'Δ';
    public static bullet: string = '.';
    public static bodytypes: string = '┗━┓┃┏┛'
    public static cantravelthrough = ' '

    public static directions: Map<string, string> = new Map([
        [down + down, '┃'],
        [left + left, '━'],
        [right + right, '━'],
        [left + down, '┓'],
        [right + down, '┏'],
        [down + right, '┗'],
        [down + left, '┛'],
    ])

    public static lastdirections: Map<string, string> = new Map([
        [down, this.directions.get(down + down) + this.directions.get(left + down) + this.directions.get(right + down)],
        [left, this.directions.get(down + left) + this.directions.get(left + left)],
        [right, this.directions.get(down + right) + this.directions.get(right + right)],
    ])

    public static firstdirections: Map<string, string> = new Map([
        [down, this.directions.get(down + down) + this.directions.get(down + left) + this.directions.get(down + right)],
        [left, this.directions.get(left + left) + this.directions.get(left + down)],
        [right, this.directions.get(right + down) + this.directions.get(right + right)],
    ])

    public static numberdirections: Map<string, number> = new Map([
        [left, -1],
        [right, 1]
    ])
}

export class PRCaterpillar extends DSProcess {


    private centipedemover: CentipedeMover;

    private framerefreshtime: number = 150;
    private bulletrefreshtime: number = 81;

    private centipedelength: number = 20;

    public rows: number = 13;
    public cols: number = 35;
    public leftoffset: number = 1;
    public topoffset: number = 1;

    private score: number = 100;
    private rockcount: number = 22;
    private playerx: number = Math.floor(this.cols / 2)

    public hidecursor = '\x1b[1000B\x1b[1000C'
    public topleft = '\x1b[1000F';
    public nextline = '\x1b[E';

    private framespassed: number = 0;
    private exit: boolean = false;

    protected async main(): Promise<void> {
        const optparser = new DSOptionParser(
            this.procname,
            true,
            "Play Shoot the Caterpillar",
        );
        while (!this.screencorrectsize()) {
            //c//onsole.log('resize')
            this.stdout.write('\x1bc')
            this.stdout.write('Please resize your screen');
            await sleep(50);
        }
        this.adjustoffsets();

        this.centipedemover = new CentipedeMover(this);

        this.drawstartingboard();
        this.drawdisplay();

        await sleep(50);

        this.inputloop();
        this.bulletloop();
        await this.centipedeloop();

    }

    private screencorrectsize():boolean {
        return DSKernel.terminal.cols > this.cols+2 && DSKernel.terminal.rows > this.rows + 2
    }

    private adjustoffsets() {
        this.leftoffset = Math.ceil((DSKernel.terminal.cols - this.cols) / 2);
        this.topoffset = 2//Math.ceil(DSKernel.terminal.rows - this.rows - 1);
        //console.log(this.topoffset, DSKernel.terminal.rows, this.rows)
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
            this.replacechar(this.randInt(0, this.rows - 1), this.randInt(0, this.cols), CGameData.rock) //Possible to optimize
        }

        //Draw centipede
        this.stdout.write(this.topleft);
        for (let i = 0; i < this.centipedelength; i++) {
            this.stdout.write(CGameData.directions.get(left + left));
        }

        //Player
        this.replacechar(this.rows - 1, this.playerx, CGameData.player);
    }

    handleResize(): void {
        if (DSKernel.terminal.cols < this.cols || DSKernel.terminal.rows < this.rows + 2) {
            this.stdout.write('\x1bc')
            this.stdout.write('Please resize your screen');
        }
        else {

        this.refresh();}
    }

    private refresh() {
            this.score = 100;
            this.drawstartingboard();
            this.drawdisplay();
        
    }

    private drawdisplay() {
        this.stdout.write(this.topleft);
        this.stdout.write(up + up);
        this.stdout.write(' '.repeat((this.cols - 9) / 2) + 'CENTIPEDE  ')
        this.stdout.write(' '.repeat((this.cols - 9) / 2 - this.score.toString().length - 1));
        this.stdout.write(this.score.toString())
        this.stdout.write(this.topleft);
        this.stdout.write(up + left);
        let borderchar = 'x'
        this.stdout.write(borderchar.repeat(this.cols + 2));
        let crossrow = `\x1b[${this.cols}C`
        for (let i = 0; i < this.rows; i++) {
            this.stdout.write(this.nextline + left);
            this.stdout.write(borderchar)
            this.stdout.write(crossrow);
            this.stdout.write(borderchar)
        }
        this.stdout.write(this.nextline + left);
        this.stdout.write(borderchar.repeat(this.cols + 2))
    }

    private updatedisplay() {
        this.stdout.write(this.topleft);
        this.stdout.write(up + up + right.repeat(this.cols - this.score.toString().length + 1));
        this.stdout.write(this.score.toString());
    }

    private async inputloop() {
        let char;
        while (!this.exit) {
            try {
                char = await this.stdin.read();
            }
            catch (DSStreamClosedError) {
                break;
            }
            if (this.exit) {
                break;
            }
            if (char == right && this.playerx < this.cols - 1) {
                this.replacechar(this.rows - 1, this.playerx, ' ');
                this.playerx++;
                this.stdout.write(CGameData.player);
                this.stdout.write(this.hidecursor);
            }
            if (char == left && this.playerx > 0) {
                this.replacechar(this.rows - 1, this.playerx - 1, CGameData.player);
                this.playerx--;
                this.stdout.write(' ');
                this.stdout.write(this.hidecursor);
            }
            if (char == ' ') {
                this.replacechar(this.rows - 2, this.playerx, CGameData.bullet);
                this.score -= 1;
            }
            if (char == 'q') {
                this.exit = true;
            }
        }


    }

    private async centipedeloop() {
        await sleep(1000);
        while (!this.exit) {
            this.centipedemover.reset()
            this.stdout.write(this.topleft);
            for (let i = 0; i < this.rows - 1; i++) {
                this.centipedemover.processnextline();
                this.stdout.write(this.nextline)
            }
            this.stdout.write(this.hidecursor)
            if (!this.centipedemover.hasmoved) {
                this.winGame();
            }
            if (this.haslost()) {
                this.loseGame();
            }
            this.framespassed++;
            await sleep(this.framerefreshtime);

        }
        await sleep(1000);
    }

    private haslost(): Boolean {
        let lastline = this.getline(this.rows - 1);
        for (let i = 0; i < lastline.length; i++) {
            if (CGameData.bodytypes.includes(lastline[i])) {
                return true;
            }
        }
        return false;
    }

    private async bulletloop() {
        while (!this.exit) {

            //Clear bullets from top of screen
            const topline = this.getline(0);
            for (let i = 0; i < this.cols; i++) {
                if (topline[i] == CGameData.bullet) {
                    this.replacechar(0, i, ' ')
                }
            }
            //Cycle through, moving bullets in each row
            this.stdout.write(this.topleft);
            this.stdout.write(this.nextline);
            for (let i = 1; i < this.rows; i++) {
                this.bulletmove(this.getline(i), this.getline(i - 1));
                this.stdout.write(this.nextline)
            }
            this.updatedisplay();
            this.stdout.write(this.hidecursor)
            await sleep(this.bulletrefreshtime);
        }
    }



    private bulletmove(line: string, lineabove: string) {
        lineabove = lineabove;
        line = line;
        for (let i = 0; i < this.cols; i++) {
            if (line[i] == CGameData.bullet) {
                this.stdout.write(' ' + up + left)
                if (i == DSKernel.terminal.cols - 1) {
                    this.stdout.write(right);
                }
                if (lineabove[i] == CGameData.rock) {
                    this.stdout.write(' ')
                    this.score += 2;
                }
                else if (CGameData.bodytypes.includes(lineabove[i])) {
                    this.stdout.write(CGameData.rock);
                    this.score += 10;

                }
                else {
                    this.stdout.write(CGameData.bullet)
                }
                this.stdout.write(down)
            }
            else {
                this.stdout.write(right);
            }
        }
    }

    public async loseGame() {
        this.exit = true;
        this.stdout.write('\x1bc');
        this.stdout.write('you lose');
    }

    public async winGame() {
        this.exit = true;
        this.stdout.write('\x1bc');
        this.stdout.write('you win');

    }

    public getline(index: number): string {
        if (index < 0 || index - this.topoffset > this.rows) {
            return '';
        }
        const line = DSKernel.terminal.xterm.buffer.active.getLine(index + this.topoffset).translateToString();
        const gamesection = line.slice(this.leftoffset, this.cols + this.leftoffset);
        return gamesection
    }

    private replacechar(row: number, column: number, char: string) {
        if (column >= this.cols ||
            row < 0 || column < 0 ||
            row >= this.rows) {

            throw new RangeError("Indices out of range")
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

}


class CentipedeMover {

    public hasmoved: boolean;

    private rownum: number = -1;
    private currentcol: number = 0
    private prevline: string;
    private line: string;
    private nextline: string;

    private length: number;

    private outstream: DSStream;
    private parent: PRCaterpillar;
    constructor(main: PRCaterpillar) {
        this.parent = main;
        this.outstream = this.parent.stdout;
        this.length = this.parent.cols + 2
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

                    if (this.line[this.currentcol] == CGameData.directions.get(down + down))
                        this.replacecurrentchar(CGameData.directions.get(down + newdirection))
                    else if (newdirection == down) {
                        this.replacecurrentchar(CGameData.directions.get(opposites.get(this.horizdirection()) + down))
                    }

                    this.movecursor(newdirection);
                    this.replacecurrentchar(CGameData.directions.get(newdirection + newdirection))
                    this.movecursor(opposites.get(newdirection))
                }

                if (this.isendofsnake()) {
                    this.replacecurrentchar(' ')
                }

            }
            this.outstream.write(right);

        }
    }

    private movecursor(direction: string) {
        this.outstream.write(direction);
        if (direction == left || direction == right) {
            this.currentcol += CGameData.numberdirections.get(direction);
        }
        if ((direction == down || direction == up) && this.currentcol == DSKernel.terminal.cols) {
            this.outstream.write(right);
        }
    }

    private replacecurrentchar(replacement: string) {
        if (replacement.length > 1) {
            throw new Error("Attempt to use a multi-character sprite")
        }
        this.outstream.write(replacement)
        if (this.currentcol < DSKernel.terminal.cols)
            this.outstream.write(left);
    }

    private getpaddedline(index: number) {
        return CGameData.rock + this.parent.getline(index) + CGameData.rock;
    }

    private isendofsnake(): boolean {
        if (CGameData.lastdirections.get(this.horizdirection()).includes(this.gettilebehind())) {
            return false
        }
        if (CGameData.lastdirections.get(down).includes(this.prevline[this.currentcol])) {
            return false
        }
        return true;
    }

    private isheadofsnake(): boolean {
        if (CGameData.firstdirections.get(opposites.get(this.horizdirection())).includes(this.gettileahead())) {
            return false;
        }
        if (CGameData.firstdirections.get(down).includes(this.nextline[this.currentcol])) {
            return false
        }
        return true
    }

    private gettileahead(): string {
        return this.line[this.currentcol + CGameData.numberdirections.get(this.horizdirection())]
    }

    private gettilebehind(): string {
        return this.line[this.currentcol - CGameData.numberdirections.get(this.horizdirection())]

    }

    private horizdirection(): string {
        return [right, left][this.rownum % 2]
    }
}