import { DSProcess, DSProcessError } from "../dsProcess";
import { DSOptionParser } from "../lib/dsOptionParser";
import { gotoxy, reset_text, scrolldown, scrollup, set_cursor, setattr, textattrs } from "../lib/dsCurses";
import { DSKernel } from "../dsKernel";

export class PRDemoCurses extends DSProcess {

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
        const w = (str: string) => { stdout.write(str); };

        DSKernel.terminal.reset();
        w(set_cursor(false));

        const cols = DSKernel.terminal.cols;
        const rows = DSKernel.terminal.rows;

        // TEST character attributes
        w(setattr(textattrs.reset));
        stdout.write("DEFAULT text\n");
        w(setattr(textattrs.fg_green));
        stdout.write("GREEN text\n");
        w(setattr(textattrs.bold));
        stdout.write("BOLD text\n");
        w(setattr(textattrs.dim));
        stdout.write("DIM text\n");
        w(setattr(textattrs.normal));

        w(setattr(textattrs.italic));
        stdout.write("ITALIC text\n");
        w(setattr(textattrs.noitalic));

        w(setattr(textattrs.underline));
        stdout.write("UNDERLINED text\n");
        w(setattr(textattrs.doubleunderline));
        stdout.write("DOUBLE UNDERLINED text\n");
        w(setattr(textattrs.curlyunderline));
        stdout.write("CURLY UNDERLINED text\n");
        w(setattr(textattrs.dottedunderline));
        stdout.write("DOTTED UNDERLINED text\n");
        w(setattr(textattrs.dashedunderline));
        stdout.write("DASHED UNDERLINED text\n");
        w(setattr(textattrs.nounderline));

        w(setattr(textattrs.inverted));
        stdout.write("INVERTED text\n");
        w(setattr(textattrs.noninverted));

        w(setattr(textattrs.reset));
        await this._wait("[PRESS TO CONTINUE]", rows);

        // TEST writing to corners
        w(reset_text());
        w(gotoxy(1, 1));
        stdout.write("T");
        w(gotoxy(cols, 1));
        stdout.write("T");
        w(gotoxy(1, rows));
        stdout.write("T");
        w(gotoxy(cols, rows));
        stdout.write("T");
        await this._wait("[PRESS TO CONTINUE]");

        // TEST SCROLLUP
        w(reset_text());
        this.fillViewport();

        for (let i = 1; i < 4; i++) {
            await this._wait(`[PRESS TO SCROLLUP ${i}]`, 1);
            w(scrollup(i));
        }
        await this._wait("[PRESS TO CONTINUE]");

        // TEST SCROLLDOWN
        w(reset_text());
        this.fillViewport();

        for (let i = 1; i < 4; i++) {
            await this._wait(`[PRESS TO SCROLLDOWN ${i}]`, rows);
            w(scrolldown(i));
        }
        await this._wait("[PRESS TO EXIT]");

        // All done, clean up
        DSKernel.terminal.reset();
    }

    private fillViewport() {
        const stdout = this.stdout;
        const cols = DSKernel.terminal.cols;
        const rows = DSKernel.terminal.rows;

        for (let y = 1; y <= rows; y++) {
            stdout.write(gotoxy(1, y));
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

        this.stdout.write(gotoxy(x, y));
        this.stdout.write(setattr(textattrs.inverted));
        this.stdout.write(msg);
        this.stdout.write(setattr(textattrs.noninverted));
        return this.stdin.read();
    }
}

