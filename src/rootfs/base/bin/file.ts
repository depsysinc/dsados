import { DSProcess, DSProcessError } from "../../../dsProcess";
import { DSOptionParser } from "../../../lib/dsOptionParser";
import { getFileType } from "../../../lib/dsPath";

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
        try { //Still throw error if the file doesn't exist, even though we're just checking the path
            const inode = this.cwd.getfile(filename);
        } catch (e) {
            throw new DSProcessError(`'${filename}' not found\n`);
        }
        const filetype = getFileType(filename);
        this.stdout.write(filetype + '\n');
    }
}