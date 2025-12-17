import { DSProcess } from "../../../dsProcess";
import { DSOptionParser } from "../../../lib/dsOptionParser";

export class PREcho extends DSProcess {

    protected async main(): Promise<void> {
        const optparser = new DSOptionParser(
            this.procname,
            true,
            "   echo command line args to the terminal",
            "[...]"
        );
        optparser.parseWithUsageAndHelp(this.argv);

        this.stdout.write(this.argv.slice(1).join(" ") + "\n");
        return;
    }
}