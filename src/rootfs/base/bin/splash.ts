import { DSKernel } from "../../../dsKernel";
import { DSProcess, DSProcessError } from "../../../dsProcess";
import { sleep } from "../../../lib/dsLib";
import { DSOptionParser } from "../../../lib/dsOptionParser";

export class PRSplash extends DSProcess {

    protected async main(): Promise<void> {
        const optparser = new DSOptionParser(
            this.procname,
            true,
            "   print the depsys splash screen"
        );
        optparser.parseWithUsageAndHelp(this.argv);

        const inode = this.cwd.getfile("/data/depsys.txt")
        const text = await inode.contentAsText().read();

        await DSKernel.terminal.baudWrite("");
        DSKernel.terminal.reset();
        DSKernel.terminal.baud = 2000;
        await DSKernel.terminal.baudWrite(text);
        DSKernel.terminal.baud = 0;

        await sleep(1500)
    }
}