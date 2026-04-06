import { DSKernel } from "../../../dsKernel";
import { DSProcess, DSProcessError } from "../../../dsProcess";
import { DSOptionParser } from "../../../lib/dsOptionParser";

export class PRSetBaud extends DSProcess {

    protected async main(): Promise<void> {
        const optparser = new DSOptionParser(
            this.procname,
            true,
            "   change the terminal baud rate",
            "<baudrate>"
        );
        let nextarg = optparser.parseWithUsageAndHelp(this.argv);
        if (nextarg == -1)
            throw new DSProcessError(optparser.usage());


        const newbaud = parseFloat(this.argv[nextarg]);

        if (isNaN(newbaud)) {
            throw new DSProcessError("setbaud argument not a float")
        }
        DSKernel.terminal.baud = newbaud

        return;
    }
}