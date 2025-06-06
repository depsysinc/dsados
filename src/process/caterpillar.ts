import { DSFilePermsError } from "../dsFileSystem";
import { DSKernel } from "../dsKernel";
import { DSProcess, DSProcessError } from "../dsProcess";
import { DSTerminal } from "../dsTerminal";
import { sleep } from "../lib/dsLib";
import { DSOptionParser } from "../lib/dsOptionParser";

const up = '\x1b[A'
const down = '\x1b[B'
const right = '\x1b[C'
const left = '\x1b[D'

export class PRCaterpillar extends DSProcess {

    private framerefreshtime: number = 300;
    private rock: string = 'Θ';
    private player: string = 'Δ';
    private bullet: string = '.';
    private centipedebodyleft: string = 'Ε'; //alternatives: ◘ Ǝ E
    private centipedebodyright: string = 'Ǝ'; //∥
    private centipedeheadleft: string = 'ʕ'; // <
    private centipedeheadright: string = 'ʔ'; // > »
    private centipedetailleft: string = '(';
    private centipedetailright: string = ')';

    private centipededirections: Map<string, number> = new Map([
        [this.centipedeheadright, 1],
        [this.centipedeheadleft, -1],
        [this.centipedetailleft, 1],
        [this.centipedetailright, -1]
    ]);
    private propagatesthrough: Map<string, string> = new Map([
        [this.centipedeheadright, ' '],
        [this.centipedeheadleft, ' '],
        [this.centipedetailleft, this.centipedebodyright],
        [this.centipedetailright, this.centipedebodyleft]
    ]);

    private inverses: Map<string, string> = new Map([
        [this.centipedeheadright, this.centipedeheadleft],
        [this.centipedeheadleft, this.centipedeheadright],
        [this.centipedetailleft, this.centipedetailright],
        [this.centipedetailright, this.centipedetailleft]
    ]);
    private trails: Map<string, string> = new Map([
        [this.centipedeheadright, this.centipedebodyright],
        [this.centipedeheadleft, this.centipedebodyleft],
        [this.centipedetailleft, ' '],
        [this.centipedetailright, ' ']
    ])






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
        //Clear terminal
        this.stdout.write("\x1bc");
        this.stdout.write(' '.repeat(DSKernel.terminal.rows * DSKernel.terminal.cols));

        //Draw the rocks
        for (let i = 0; i < this.rockcount; i++) {
            this.replacechar(this.randInt(0, DSKernel.terminal.rows - 1), this.randInt(0, DSKernel.terminal.cols), this.rock) //Possible to optimize
        }

        //Draw centipede
        this.replacechar(0, 0, this.centipedetailleft);
        for (let i = 1; i < this.centipedelength; i++) {
            this.stdout.write(this.centipedebodyright);
        }
        this.stdout.write(this.centipedeheadright);

        //Player
        this.replacechar(DSKernel.terminal.rows - 1, this.playerx, this.player);

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
                this.stdout.write(this.player);
                this.stdout.write('\x1b[1000C');
            }
            if (char == left && this.playerx > 0) {
                this.replacechar(DSKernel.terminal.rows - 1, this.playerx - 1, this.player);
                this.playerx--;
                this.stdout.write(' ');
                this.stdout.write('\x1b[1000C');
            }
            if (char == ' ') {
                this.replacechar(DSKernel.terminal.rows - 2, this.playerx, this.bullet);
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

        //this.replacechar(0, this.framespassed, this.centipedebody);
        //this.replacechar(0, this.framespassed + 1, this.centipederight);
        this.stdout.write('\x1b[1000F');
        for (let i = 0; i < DSKernel.terminal.rows - 1; i++) {
            await this.centipedemove(this.getline(i), this.getline(i + 1));
            this.stdout.write('\x1b[E')
        }
        this.stdout.write('\x1b[1000B\x1b[1000C')
    }

    private async centipedemove(line: string, nextline: string) {
        line = this.rock + line + this.rock;
        nextline = this.rock + nextline + this.rock;
        for (let i = 1; i < line.length - 1; i++) {
            if (this.centipededirections.has(line[i])) {
                let tiles = line.slice(i - 1, i + 2);
                this.propagate(tiles, i == DSKernel.terminal.cols)

            }
            else if (nextline[i] == this.bullet) {
                this.stdout.write(down + ' '+ up + left)
                if (line[i] == this.rock) {
                    this.stdout.write(' ')
                }
                else if (line[i] == this.centipedebodyleft) {
                    this.stdout.write(left + this.centipedetailright +this.rock+this.centipedeheadleft)
                }
                else if (line[i] == this.centipedebodyright) {
                    this.stdout.write(left + this.centipedeheadright+this.rock+this.centipedetailleft)
                }
                else {
                    this.stdout.write(this.bullet)
                }
            }
            else {
                this.stdout.write(right)
            }
            //await sleep(90);

        }
    }

    //Assumes cursor is positioned in the middle of tiles
    //Note - inconsistent behaviour at right edge requires flag argument
    private propagate(tiles: string, isrightedge: boolean) {
        let topropagate = tiles[1];
        let direction = this.centipededirections.get(topropagate);
        let through = this.propagatesthrough.get(topropagate)

        this.stdout.write(this.trails.get(topropagate));

        if (tiles[1 + direction] == through) { //Travelling horizontally
            if (direction == -1) {
                this.stdout.write(left)
                if (!isrightedge) {
                    this.stdout.write(left)
                }
            }

            this.stdout.write(topropagate);

            if (direction == -1) {
                this.stdout.write(right)
            }
            else {
                this.stdout.write(left)
            }
        }
        else { //Travelling down
            this.stdout.write(down)
            if (!isrightedge) {
                this.stdout.write(left);
            }
            this.stdout.write(this.inverses.get(topropagate));
            this.stdout.write(up)

        }
    }

    private writeOnLineAbove(char: string) {
    }


    private getline(index: number): string {
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