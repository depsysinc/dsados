import { DSProcess, DSProcessError } from "../dsProcess";
import { DSOptionParser } from "../lib/dsOptionParser";
import { DSMDDoc } from "../lib/dsMarkdown";

export class PRDSMDBrowser extends DSProcess {

    protected async main(): Promise<void> {
        const optparser = new DSOptionParser(
            this.procname,
            true,
            "   a markdown browser",
            "<mdfile>"
        );
        let nextarg = optparser.parseWithUsageAndHelp(this.argv);
        if (nextarg == -1)
            throw new DSProcessError(optparser.usage());

        let filename = this.argv[nextarg];
        const inode = this.cwd.getfile(filename);
        const text = await inode.contentAsText().read();
        const doc = new DSMDDoc();
        doc.parse(text);
    }
}