import { DSProcess, DSProcessError } from "../../../dsProcess";
import { DSOptionParser } from "../../../lib/dsOptionParser";

export class PRFile extends DSProcess {

    protected async main(): Promise<void> {
        const optparser = new DSOptionParser(
            this.procname,
            true,
            "   output filetype information",
            "<filename>"
        );
        let nextarg = optparser.parseWithUsageAndHelp(this.argv);
        if (nextarg == -1)
            throw new DSProcessError(optparser.usage());

        let filename = this.argv[nextarg];
        try {
            const inode = this.cwd.getfile(filename);
            const filetype = await inode.filetype();
            this.stdout.write(filetype + '\n');
        } catch (e) {
            throw new DSProcessError(`'${filename}' not found\n`);
        }
    }
}