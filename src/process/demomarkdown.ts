import { DSProcess, DSProcessError } from "../dsProcess";
import { DSOptionParser } from "../lib/dsOptionParser";
import { DSMDDoc } from "../lib/dsMarkdown";
import { gotoxy, reset, setattr, textattrs } from "../lib/dsCurses";

export class PRDemoMarkdown extends DSProcess {

    protected async main(): Promise<void> {
        const optparser = new DSOptionParser(
            this.procname,
            true,
            "   run a markdown demo"
        );
        let nextarg = optparser.parseWithUsageAndHelp(this.argv);
        if (nextarg != -1)
            throw new DSProcessError(optparser.usage());

        let filename = "/data/demo/demomarkdown.dsmd";
        const inode = this.cwd.getfile(filename);
        const text = await inode.contentAsText().read();
        const doc = new DSMDDoc();
        doc.parse(text);

        let index = 0;
        let width = 70;
        let height = 23;
        const w = (str: string) => { this.stdout.write(str); };

        while (true) {

            doc.render(width);
            console.log(doc);

            let fillstr: string = "+";
            fillstr = fillstr.padEnd(width + 1, "-");
            fillstr += "+";

            w(reset());
            w(setattr(textattrs.fg_green));

            // Draw border
            w(setattr(textattrs.inverted) + gotoxy(1, 1) + fillstr);
            for (let j = 1; j <= height; j++) {
                w(gotoxy(1, j + 1) + "|");
                w(gotoxy(width + 2, j + 1) + "|");
            }
            w(gotoxy(1, height + 2) + fillstr + setattr(textattrs.noninverted) + "\n");
            w(
                `index: ${index}\n` +
                `width: ${width}\n` +
                `height: ${height}\n`
            )

            for (let j = 0; j < height && j + index < doc.rows.length; j++) {
                const row = doc.rows[j + index];
                w(gotoxy(2, j + 2) + `${row.text}`);
            }

            const char = await this.stdin.read();
            if (char == "\x1b[D") {
                width -= 1;
            } else if (char == "\x1b[C") {
                width += 1;
            } else if (char == "\x1b[A") {
                height -= 1;
            } else if (char == "\x1b[B") {
                height += 1;
            } else if (char == "w") {
                index -= 1;
                if (index < 0)
                    index = 0;
            } else if (char == "s") {
                if (index < doc.rows.length)
                    index += 1;

            } else if (char == "q") {
                break;
            }
        }
        w(reset());
    }
}