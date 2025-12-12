import { DSProcess, DSProcessError } from "../dsProcess";
import { DSKernel } from "../dsKernel";
import { DSOptionParser } from "../lib/dsOptionParser";

export class PRPs extends DSProcess {

    protected async main(): Promise<void> {
        const optparser = new DSOptionParser(
            this.procname,
            true,
            "   output current process stack"
        );
        let nextarg = optparser.parseWithUsageAndHelp(this.argv);
        if (nextarg != -1)
            throw new DSProcessError(optparser.usage());
        
        const pidwidth = 6;
        let proclist = `${"PID".padStart(pidwidth)} CMD\n`;
        DSKernel.procstack.forEach((proc, idx) => {
            const active = proc.pid == DSKernel.curproc.pid ? " *" : "";
            proclist += `${String(proc.pid).padStart(pidwidth)} ${proc.procname}${active}\n`;
        });
        this.stdout.write(proclist);
        return;
    }

}