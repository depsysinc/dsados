import { DSFilePermsError } from "../dsFileSystem";
import { DSKernel } from "../dsKernel";
import { DSProcess, DSProcessError } from "../dsProcess";
import { DSTerminal } from "../dsTerminal";
import { sleep } from "../lib/dsLib";
import { DSOptionParser } from "../lib/dsOptionParser";

export class PRCaterpillar extends DSProcess {

    private framerefreshtime:number = 100;

    private framespassed:number = 0;

    protected async main(): Promise<void> {
        const optparser = new DSOptionParser(
            this.procname,
            true,
            "   Play Shoot the Caterpillar",
        );
        this.stdout.write("\x1bc");
        this.stdout.write('hii I am a cat'.repeat(100))
        this.replacechar(6,6,'7')


        while (true) {
            await sleep(this.framerefreshtime);
            this.update();
            this.framespassed++;
        }

    }

    private update() {
        this.replacechar(6,6,'7');
        this.replacechar(this.framespassed,4,'0');
        this.replacechar(this.framespassed+1,4,'☺︎')
        //this.stdout.write('\x1b[D')
        //this.stdout.write("\x1b[P")
        //this.stdout.write("0")
        //this.stdout.write("☺︎");
        console.log();
    }

    private getline(index:number):string {
        return DSKernel.terminal.xterm.buffer.active.getLine(index).translateToString()
    }

    private replacechar(row:number, column:number, char:string) {
        if (this.getline(row).length < column ||
            row < 0 || column < 0 ||
            row > DSKernel.terminal.rows) {
                console.log("hi");
                throw new RangeError("Indices out of range")
        }


        this.stdout.write('\x1b[1000A'); //Up 1000 rows
        this.stdout.write('\x1b[1000D'); //Left 1000 columns
        this.stdout.write('\x1b['+(row-1)+'B'); //Down row rows
        this.stdout.write('\x1b['+column+'C'); //Right column columns
        this.stdout.write('\x1bD'); //Left one column
        //this.stdout.write('\x1b[P'); //Delete next character
        this.stdout.write(char);  //Write the char

    }

}