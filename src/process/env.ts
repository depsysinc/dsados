import { DSProcess, DSProcessError } from "../dsProcess";
import { DSKernel } from "../dsKernel";
import { DSOptionParser } from "../lib/dsOptionParser";

export class PREnv extends DSProcess {

    protected async main(): Promise<void> {
        const optparser = new DSOptionParser(
            this.procname,
            true,
            "   output environment variables"
        );
        let nextarg = optparser.parseWithUsageAndHelp(this.argv);
        if (nextarg != -1)
            throw new DSProcessError(optparser.usage());
        
        let t = DSKernel.terminal;
        let envstr = "";
        Object.entries(this.envp).forEach(([key, value]) => {
            envstr += `${key}=${value}\n`;
        });
        return t.baudText(envstr);
    }
}