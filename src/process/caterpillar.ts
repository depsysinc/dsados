import { DSFilePermsError } from "../dsFileSystem";
import { DSKernel } from "../dsKernel";
import { DSProcess, DSProcessError } from "../dsProcess";
import { DSStream } from "../dsStream";
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

class CGameData {
    public static rock: string = 'Θ';
    public static player: string = 'Δ';
    public static bullet: string = '.';
    public static centipedebodyleft: string = 'Ε'; //alternatives: ◘ Ǝ Ε
    public static centipedebodyright: string = 'Ǝ'; //∥ ╔ ┗━┓ ┏┃┛ 
    public static centipedeheadleft: string = 'ʕ'; // < ʕ
    public static centipedeheadright: string = 'ʔ'; // > » ʔ
    public static centipedetailleft: string = '(';
    public static centipedetailright: string = ')';

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

    public static symbolstodirections: Map<string, string> = new Map(Array.from(this.directions, a => a.reverse() as [string, string]))
    public static rewritecodes: Map<string, string> = new Map([
        [this.centipedeheadright, right + this.centipedeheadright + left],
        [this.centipedeheadleft, left + left + this.centipedeheadleft + right + right]
    ])
    public static numberdirections: Map<string, number> = new Map([
        [left, -1],
        [right, 1]
    ])

    public static centipededirections: Map<string, string> = new Map([
        [this.centipedeheadright, right],
        [this.centipedeheadleft, left],
        [this.centipedetailleft, right],
        [this.centipedetailright, left]
    ]);
    public static propagatesthrough: Map<string, string> = new Map([
        [this.centipedeheadright, ' '],
        [this.centipedeheadleft, ' '],
        [this.centipedetailleft, this.centipedebodyright + this.centipedeheadright],
        [this.centipedetailright, this.centipedebodyleft + this.centipedeheadleft]
    ]);

    public static inverses: Map<string, string> = new Map([
        [this.centipedeheadright, this.centipedeheadleft],
        [this.centipedeheadleft, this.centipedeheadright],
        [this.centipedetailleft, this.centipedetailright],
        [this.centipedetailright, this.centipedetailleft]
    ]);
    public static trails: Map<string, string> = new Map([
        [this.centipedeheadright, this.centipedebodyright],
        [this.centipedeheadleft, this.centipedebodyleft],
        [this.centipedetailleft, ' '],
        [this.centipedetailright, ' ']
    ])



}

export class PRCaterpillar extends DSProcess {


    private centipedemover: CentipedeMover;

    private framerefreshtime: number = 300;
    private bulletrefreshtime: number = 121;

    private centipedelength: number = 30;

    private rockcount: number = 0.05 * DSKernel.terminal.rows * DSKernel.terminal.cols;
    private playerx: number = Math.floor(DSKernel.terminal.cols / 2)

    private framespassed: number = 0;
    private exit: boolean = false;

    protected async main(): Promise<void> {
        const optparser = new DSOptionParser(
            this.procname,
            true,
            "   Play Shoot the Caterpillar",
        );
        this.centipedemover = new CentipedeMover(this);

        //Clear terminal
        this.stdout.write("\x1bc");
        this.stdout.write(' '.repeat(DSKernel.terminal.rows * DSKernel.terminal.cols));

        //Draw the rocks
        for (let i = 0; i < this.rockcount; i++) {
            this.replacechar(this.randInt(0, DSKernel.terminal.rows - 1), this.randInt(0, DSKernel.terminal.cols), CGameData.rock) //Possible to optimize
        }

        //Draw centipede
        this.replacechar(0, 0, CGameData.directions.get(left + left));
        for (let i = 1; i < this.centipedelength; i++) {
            this.stdout.write(CGameData.directions.get(left + left));
        }

        //Player
        this.replacechar(DSKernel.terminal.rows - 1, this.playerx, CGameData.player);
        await sleep(50);
        this.centipedeloop();
        this.bulletloop();
        await this.inputloop();

    }

    private async inputloop() {
        while (!this.exit) {
            let char = await this.stdin.read();
            if (char == right && this.playerx < DSKernel.terminal.cols - 1) {
                this.replacechar(DSKernel.terminal.rows - 1, this.playerx, ' ');
                this.playerx++;
                this.stdout.write(CGameData.player);
                this.stdout.write('\x1b[1000C');
            }
            if (char == left && this.playerx > 0) {
                this.replacechar(DSKernel.terminal.rows - 1, this.playerx - 1, CGameData.player);
                this.playerx--;
                this.stdout.write(' ');
                this.stdout.write('\x1b[1000C');
            }
            if (char == ' ') {
                this.replacechar(DSKernel.terminal.rows - 2, this.playerx, CGameData.bullet);
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
            this.stdout.write('\x1b[1000F');
            for (let i = 0; i < DSKernel.terminal.rows - 1; i++) {
                this.centipedemover.processnextline();
                this.stdout.write('\x1b[E')
            }
            this.stdout.write('\x1b[1000B\x1b[1000C')

            this.framespassed++;
            await sleep(this.framerefreshtime);

        }
    }

    private async bulletloop() {
        while (!this.exit) {
            this.stdout.write('\x1b[1000F');
            for (let i = 0; i < DSKernel.terminal.rows; i++) {
                this.bulletmove(this.getline(i), this.getline(i - 1));
                this.stdout.write('\x1b[E')
            }

            this.stdout.write('\x1b[1000B\x1b[1000C')
            await sleep(this.bulletrefreshtime);
        }
    }



    private bulletmove(line: string, lineabove: string) {
        if (lineabove == '') {
            for (let i = 0; i < line.length; i++) {
                if (line[i] == CGameData.bullet) {
                    this.replacechar(0, i, ' ')
                }
            }
            return;
        }

        lineabove = lineabove;
        line = line;
        for (let i = 0; i < lineabove.length; i++) {
            if (line[i] == CGameData.bullet) {
                this.stdout.write(' ' + up + left)
                if (i == DSKernel.terminal.cols - 1) {
                    this.stdout.write(right);
                }
                if (lineabove[i] == CGameData.rock) {
                    this.stdout.write(' ')
                }
                else if (CGameData.bodytypes.includes(lineabove[i])) {
                    console.log('rockin')
                    this.stdout.write(CGameData.rock);
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


    public getline(index: number): string {
        if (index < 0 || index > DSKernel.terminal.rows) {
            return '';
        }
        return DSKernel.terminal.xterm.buffer.active.getLine(index).translateToString()
    }

    private replacechar(row: number, column: number, char: string) {
        if (column >= DSKernel.terminal.cols ||
            row < 0 || column < 0 ||
            row >= DSKernel.terminal.rows) {

            throw new RangeError("Indices out of range")
        }

        this.stdout.write('\x1b[1000A'); //Up 1000 rows
        if (row > 0) {
            this.stdout.write('\x1b[' + row + 'B'); //Down to the correct row
        }

        this.stdout.write('\x1b[1000D'); //Left 1000 columns
        if (column > 0) {
            this.stdout.write('\x1b[' + column + 'C'); //Right to the correct column
        }

        this.stdout.write(char);  //Write the char

    }
    private replacechartests() {
        this.replacechar(0, 5, '1');
        this.replacechar(1, 6, '2');
        this.replacechar(8, 0, '3');
        this.replacechar(0, 0, '4');
        this.replacechar(0, 1, '5');
        this.replacechar(0, 2, '6');
        this.replacechar(1, 0, '7');
        this.replacechar(DSKernel.terminal.rows - 2, DSKernel.terminal.cols - 2, '8');
        this.replacechar(DSKernel.terminal.rows - 1, DSKernel.terminal.cols - 1, '9');
        //this.replacechar(DSKernel.terminal.rows,DSKernel.terminal.cols-1,'0') //Throws an error

    }
    //Includes a, doesn't include b (99.999999% of the time)
    private randInt(a: number, b: number): number {
        let randval = Math.random();
        let mappedval = randval * (b - a) + a;
        return Math.floor(mappedval);
    }

}


class CentipedeMover {
    private rownum: number = -1;
    private currentcol: number = 0
    private prevline: string;
    private line: string;
    private nextline: string;

    private length: number = DSKernel.terminal.cols + 2;

    private outstream: DSStream;
    private parent: PRCaterpillar;
    constructor(main: PRCaterpillar) {
        this.parent = main;
        this.outstream = this.parent.stdout;
    }

    public reset() {
        this.rownum = -1;
        this.prevline = '';
        this.line = CGameData.rock.repeat(this.length);
        this.nextline = this.getpaddedline(0);
    }

    public processnextline() {
        this.rownum++;
        this.prevline = this.line;
        this.line = this.nextline;
        this.nextline = this.getpaddedline(this.rownum + 1);

        for (this.currentcol = 1; this.currentcol < this.length - 1; this.currentcol++) {
            if (CGameData.bodytypes.includes(this.line[this.currentcol])) {

                if (this.isheadofsnake()) {
                    let newdirection;
                    if (CGameData.cantravelthrough.includes(this.gettileahead())) {
                        newdirection = this.horizdirection();
                    }
                    else {
                        newdirection = down;
                    }

                    if (this.line[this.currentcol] == CGameData.directions.get(down + down))
                        this.replacechar(CGameData.directions.get(down + newdirection))
                    else if (newdirection == down) {
                        this.replacechar(CGameData.directions.get(opposites.get(this.horizdirection()) + down))
                    }

                    this.movecursor(newdirection);
                    this.replacechar(CGameData.directions.get(newdirection + newdirection))
                    this.movecursor(opposites.get(newdirection))
                    console.log(this.rownum, this.currentcol, 'is the start')
                }
                if (this.isendofsnake()) {
                    console.log(this.rownum, this.currentcol, 'is the end')
                    this.replacechar(' ')
                }

            }
            this.outstream.write(right);

        }
    }

    private movecursor(direction: string) {
        this.outstream.write(direction);
        if ((direction == down || direction == up) && this.currentcol == DSKernel.terminal.cols) {
            this.outstream.write(right);
        }
    }

    private replacechar(replacement: string) {
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