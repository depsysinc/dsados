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
        //this.stdout.write(CGameData.centipedeheadright);

        //Player
        this.replacechar(DSKernel.terminal.rows - 1, this.playerx, CGameData.player);

        await sleep(1000);
        this.mainloop();
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

    private async mainloop() {
        while (!this.exit) {
            let a = performance.now()
            await this.update();
            console.log('frame, time =', performance.now() - a)
            this.framespassed++;
            await sleep(this.framerefreshtime);
        }

    }

    private async update() {
        this.centipedemover.reset()
        //this.replacechar(0, this.framespassed, this.centipedebody);
        //this.replacechar(0, this.framespassed + 1, this.centipederight);
        this.stdout.write('\x1b[1000F');
        for (let i = 0; i < DSKernel.terminal.rows - 1; i++) {
            this.centipedemover.processnextline();
            this.stdout.write('\x1b[E')
        }

        this.stdout.write('\x1b[1000F');
        for (let i = 0; i < DSKernel.terminal.rows; i++) {
            this.bulletmove(this.getline(i), this.getline(i - 1));
            this.stdout.write('\x1b[E')
        }
        this.stdout.write('\x1b[1000B\x1b[1000C')


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
                if (i == DSKernel.terminal.cols-1) {
                    this.stdout.write(right);
                }
                if (lineabove[i] == CGameData.rock) {
                    this.stdout.write(' ')
                }
                else if (CGameData.bodytypes.includes(lineabove[i])) {
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

    // // private async centipedemove(row: number) {
    //     let line = CGameData.rock + this.getline(row) + CGameData.rock;
    //     let nextline = CGameData.rock + this.getline(row + 1) + CGameData.rock;
    //     let lineabove = CGameData.rock + this.getline(row - 1) + CGameData.rock;
    //     if (lineabove == undefined) {
    //         lineabove = CGameData.rock.repeat(line.length);
    //     }
    //     else {
    //         lineabove = CGameData.rock + lineabove + CGameData.rock;
    //     }
    //     for (let i = 1; i < line.length - 1; i++) {

    //         if (CGameData.bodytypes.includes(line[i])) {
    //             let from = this.getprevious(line, lineabove, i);


    //             let to = [left, right][row % 2];
    //             let charahead = line[i + CGameData.numberdirections.get(to)]
    //             if (CGameData.bodytypes.includes(charahead)) {
    //                 this.stdout.write(right);
    //                 continue;
    //             }
    //             else if (!CGameData.cantravelthrough.includes(charahead)) {
    //                 to = down;
    //             }
    //             let chartoplace = CGameData.directions.get(from + to);


    //         }
    //         else {
    //             this.stdout.write(right)
    //         }
    //         //await sleep(90);

    //     }
    // }


    // private propagate(tiles: string, isrightedge: boolean) {
    //     let topropagate = tiles[1];
    //     let direction = this.centipededirections.get(topropagate);
    //     let through = this.propagatesthrough.get(topropagate)

    //     if ((this.trails.get(topropagate) + CGameData.rock).includes(tiles[1 - direction])) {
    //         this.stdout.write(this.trails.get(topropagate));
    //     }
    //     else {
    //         this.stdout.write(this.trails.get(topropagate));
    //     }

    //     if (through.includes(tiles[1 + direction])) { //If next tile in your travelling direction is traversable
    //         if (direction == -1) {
    //             this.stdout.write(left)
    //             if (!isrightedge) {
    //                 this.stdout.write(left)
    //             }
    //         }

    //         this.stdout.write(topropagate);

    //         if (direction == -1) {
    //             this.stdout.write(right)
    //         }
    //         else {
    //             this.stdout.write(left)
    //         }
    //     }
    //     else { //Travelling down
    //         this.stdout.write(down)
    //         if (!isrightedge) {
    //             this.stdout.write(left);
    //         }
    //         this.stdout.write(this.inverses.get(topropagate));
    //         this.stdout.write(up)

    //     }
    // }

    private writeOnLineAbove(char: string) {
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

        for (let i = 1; i < this.length - 1; i++) {
            if (CGameData.bodytypes.includes(this.line[i])) {
                if (this.isendofsnake(i)) {
                    console.log(this.rownum, i, 'is the end')
                    this.outstream.write(' ' + left)
                }
                if (this.isheadofsnake(i)) {
                    if (CGameData.cantravelthrough.includes(this.gettileahead(i))) {
                        if (this.line[i] == CGameData.directions.get(down + down))
                            this.outstream.write(CGameData.directions.get(down + this.horizdirection()) + left)
                        else
                            this.outstream.write(CGameData.directions.get(this.horizdirection() + this.horizdirection()) + left)

                        this.outstream.write(this.horizdirection())
                        this.outstream.write(CGameData.directions.get(this.horizdirection() + this.horizdirection()))
                        this.outstream.write(opposites.get(this.horizdirection()) + left)
                    }
                    else {
                        if (this.line[i] == CGameData.directions.get(down + down))
                            this.outstream.write(CGameData.directions.get(down + down) + left)
                        else
                            this.outstream.write(CGameData.directions.get(opposites.get(this.horizdirection()) + down) + left)
                        this.outstream.write(down);
                        this.outstream.write(CGameData.directions.get(down + down));
                        this.outstream.write(up + left)

                    }
                    console.log(this.rownum, i, 'is the start')
                }
            }
            this.outstream.write(right);

        }
    }

    private getpaddedline(index: number) {
        return CGameData.rock + this.parent.getline(index) + CGameData.rock;
    }

    private isendofsnake(index: number): boolean {
        if (CGameData.lastdirections.get(this.horizdirection()).includes(this.gettilebehind(index))) {
            return false
        }
        if (CGameData.lastdirections.get(down).includes(this.prevline[index])) {
            return false
        }
        return true;
    }

    private isheadofsnake(index: number): boolean {
        if (CGameData.firstdirections.get(opposites.get(this.horizdirection())).includes(this.gettileahead(index))) {
            return false;
        }
        if (CGameData.firstdirections.get(down).includes(this.nextline[index])) {
            return false
        }
        return true
    }

    private gettileahead(index: number): string {
        return this.line[index + CGameData.numberdirections.get(this.horizdirection())]
    }

    private gettilebehind(index: number): string {
        return this.line[index - CGameData.numberdirections.get(this.horizdirection())]

    }

    private horizdirection(): string {
        return [right, left][this.rownum % 2]
    }
}