import { DSProcess, DSProcessError } from "../dsProcess";
import { DSOptionParser } from "../lib/dsOptionParser";

export class PRPwd extends DSProcess {

    protected async main(): Promise<void> {
        const optparser = new DSOptionParser(
            this.procname,
            true,
            "   print working directory"
        );
        let nextarg = optparser.parseWithUsageAndHelp(this.argv);
        if (nextarg != -1)
            throw new DSProcessError(optparser.usage());

        this.stdout.write(this.cwd.path + "\n");
        return; 
    }
}