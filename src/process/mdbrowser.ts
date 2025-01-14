import { DSKernel } from "../dsKernel";
import { DSProcess, DSProcessError } from "../dsProcess";
import { DSOptionParser } from "../lib/dsOptionParser";

export class PRMDBrowser extends DSProcess {

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
        try {
            const inode = this.cwd.getfile(filename);
            const text = await inode.contentAsText().read();
            // this.stdout.write(text);
        } catch (e) {
            throw new DSProcessError(`'${filename}' not found\n`);
        }
        while (true) {
            await this.stdin.read();
            DSKernel.terminal.xterm.scrollToTop();
        }
    }
}