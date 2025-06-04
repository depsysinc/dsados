import { DSFilePermsError } from "../dsFileSystem";
import { DSKernel } from "../dsKernel";
import { DSProcess, DSProcessError } from "../dsProcess";
import { DSTerminal } from "../dsTerminal";
import { sleep } from "../lib/dsLib";
import { DSOptionParser } from "../lib/dsOptionParser";


export class PRCaterpillar extends DSProcess {

    private framerefreshtime: number = 100;
    private rock: string = 'Θ';
    private player: string = 'Δ'
    private centipedebody: string = '∥'; //alternatives: ◘
    private centipedeleft: string = 'ʕ'; // <
    private centipederight: string = 'ʔ'; // >
    private centipedelength: number = 10;

    private rockcount: number = 0.05 * DSKernel.terminal.rows * DSKernel.terminal.cols;
    private playerx: number = Math.floor(DSKernel.terminal.cols / 2)

    private framespassed: number = 0;

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
        this.replacechar(0, 0, this.centipedebody);
        for (let i = 1; i < this.centipedelength; i++) {
            this.stdout.write(this.centipedebody);
        }
        this.stdout.write(this.centipederight);

        //Player
        this.replacechar(DSKernel.terminal.rows - 1, this.playerx, this.player);

        this.mainloop();
        await this.inputloop();

    }

    private async inputloop() {
        while (true) {
            console.log(this.stdin.closed);
            let char = await this.stdin.read();
            if (char == '\x1b[C' && this.playerx < DSKernel.terminal.cols - 1) {
                this.replacechar(DSKernel.terminal.rows - 1, this.playerx, ' ');//Possible optimization - instead of replacechar, 
                this.playerx++;                                                 //use control sequences manually
                this.replacechar(DSKernel.terminal.rows - 1, this.playerx, this.player);
                this.stdout.write('\x1b[1000C');
            }
            if (char == '\x1b[D' && this.playerx > 0) {
                this.replacechar(DSKernel.terminal.rows - 1, this.playerx, ' ');
                this.playerx--;
                this.replacechar(DSKernel.terminal.rows - 1, this.playerx, this.player);
                this.stdout.write('\x1b[1000C');
            }
            if (char == 'q') {
                return;
            }
        }

    }

    private async mainloop() {
        while (true) {
            let a = (performance.now())
            this.update();
            //console.log(performance.now()-a)
            this.framespassed++;
            await sleep(this.framerefreshtime);
        }

    }

    private update() {
        //this.replacechar(0, this.framespassed, this.centipedebody);
        //this.replacechar(0, this.framespassed + 1, this.centipederight);
        for (let i = 0; i < DSKernel.terminal.rows; i++) {
            this.centipedemove(this.getline(i));
        }
        this.stdout.write('\x1b[1000B\x1b[1000C')
    }

    private centipedemove(line: string) {
        line = this.rock + line + this.rock;
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
    private tests() {
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