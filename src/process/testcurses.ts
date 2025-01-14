import { DSProcess, DSProcessError } from "../dsProcess";
import { DSOptionParser } from "../lib/dsOptionParser";
import { gotoxy, reset, scrolldown, scrollup, set_cursor, setattr, textattrs } from "../lib/dsCurses";
import { DSKernel } from "../dsKernel";

export class PRTestCurses extends DSProcess {

    protected async main(): Promise<void> {
        const optparser = new DSOptionParser(
            this.procname,
            true,
            "   a markdown browser",
        );
        let nextarg = optparser.parseWithUsageAndHelp(this.argv);
        if (nextarg != -1)
            throw new DSProcessError(optparser.usage());
        const stdout = this.stdout;

        reset(stdout);
        set_cursor(stdout, false);
        
        const cols = DSKernel.terminal.cols;
        const rows = DSKernel.terminal.rows;

        // TEST character attributes
        setattr(stdout, textattrs.reset);
        stdout.write("DEFAULT text\n");
        setattr(stdout, textattrs.fg_green);
        stdout.write("GREEN text\n");
        setattr(stdout, textattrs.bold);
        stdout.write("BOLD text\n");
        setattr(stdout, textattrs.dim);
        stdout.write("DIM text\n");
        setattr(stdout, textattrs.normal);

        setattr(stdout, textattrs.italic);
        stdout.write("ITALIC text\n");
        setattr(stdout, textattrs.noitalic);

        setattr(stdout, textattrs.underline);
        stdout.write("UNDERLINED text\n");
        setattr(stdout, textattrs.doubleunderline);
        stdout.write("DOUBLE UNDERLINED text\n");
        setattr(stdout, textattrs.curlyunderline);
        stdout.write("CURLY UNDERLINED text\n");
        setattr(stdout, textattrs.dottedunderline);
        stdout.write("DOTTED UNDERLINED text\n");
        setattr(stdout, textattrs.dashedunderline);
        stdout.write("DASHED UNDERLINED text\n");
        setattr(stdout, textattrs.nounderline);

        setattr(stdout, textattrs.inverted);
        stdout.write("INVERTED text\n");
        setattr(stdout, textattrs.noninverted);

        setattr(stdout, textattrs.reset);
        await this._wait("[PRESS TO CONTINUE]", rows);

        // TEST writing to corners
        reset(stdout);
        gotoxy(stdout, 1, 1);
        stdout.write("T");
        gotoxy(stdout, cols, 1);
        stdout.write("T");
        gotoxy(stdout, 1, rows);
        stdout.write("T");
        gotoxy(stdout, cols, rows);
        stdout.write("T");
        await this._wait("[PRESS TO CONTINUE]");

        // TEST SCROLLUP
        reset(stdout);
        this.fillViewport();

        for (let i = 1; i < 4; i++) {
            await this._wait(`[PRESS TO SCROLLUP ${i}]`, 1);
            scrollup(stdout, i);
        }
        await this._wait("[PRESS TO CONTINUE]");

        // TEST SCROLLDOWN
        reset(stdout);
        this.fillViewport();

        for (let i = 1; i < 4; i++) {
            await this._wait(`[PRESS TO SCROLLDOWN ${i}]`, rows);
            scrolldown(stdout, i);
        }
        await this._wait("[PRESS TO EXIT]");

        // All done, clean up
        set_cursor(stdout, true);
        reset(stdout);
    }

    private fillViewport() {
        const stdout = this.stdout;
        const cols = DSKernel.terminal.cols;
        const rows = DSKernel.terminal.rows;

        for (let y = 1; y <= rows; y++) {
            gotoxy(stdout, 1, y);
            let linestr = "";
            for (let i = 0; i < cols; i++)
                linestr += String.fromCharCode(64 + y);
            stdout.write(linestr);
        }
    }
    
    private _wait(msg: string, y = -1) {
        const x = Math.floor((DSKernel.terminal.cols - msg.length) / 2);
        if (y < 0)
            y = Math.floor(DSKernel.terminal.rows / 2);
        
        gotoxy(this.stdout, x, y);
        setattr(this.stdout, textattrs.inverted);
        this.stdout.write(msg);
        setattr(this.stdout, textattrs.noninverted);
        return this.stdin.read();
    }
}

