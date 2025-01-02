import { DSProcess, DSProcessError } from "../dsProcess";
import { DSOptionParser } from "../lib/dsOptionParser";

export class PRCat extends DSProcess {

    protected async main(): Promise<void> {
        const optparser = new DSOptionParser(
            this.procname,
            true,
            "   output contents of a file to the terminal",
            "<filename>"
        );
        let nextarg = optparser.parseWithUsageAndHelp(this.argv);
        if (nextarg == -1)
            throw new DSProcessError(optparser.usage());

        let filename = this.argv[nextarg];
        try {
            const inode = this.cwd.getfile(filename);
            const text = await inode.contentAsText().read();
            this.stdout.write(text);
        } catch (e) {
            throw new DSProcessError(`'${filename}' not found\n`);
        }



    }

}