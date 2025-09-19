import { DSKernel } from "../dsKernel";
import { DSProcess } from "../dsProcess";
import { DSOptionParser } from "../lib/dsOptionParser";

export class PRReset extends DSProcess {

    protected async main(): Promise<void> {
        const optparser = new DSOptionParser(
            this.procname,
            true,
            "   Reset the terminal"
        );
        let nextarg = optparser.parseWithUsageAndHelp(this.argv);

        DSKernel.terminal.reset();
    }
}