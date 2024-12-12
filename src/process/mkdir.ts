import { DSProcess, DSProcessError } from "../dsProcess";
import { DSKernel } from "../dsKernel";
import { DSOptionParser } from "../lib/dsOptionParser";

export class PRMkdir extends DSProcess {

    protected async main(): Promise<void> {
        const optparser = new DSOptionParser(
            this.procname,
            true,
            "   create a new directory",
            "<dirname>"
        );
        let nextarg = optparser.parseWithUsageAndHelp(this.argv);
        if (nextarg == -1)
            throw new DSProcessError(optparser.usage());
        
        let t = DSKernel.terminal;
        let dirname = this.argv[nextarg];
        this.cwd.mkdir(dirname);
    }
}