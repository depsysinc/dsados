import { DSProcess } from "../dsProcess";
import { DSKernel } from "../dsKernel";
import { DSOptionParser } from "../lib/dsOptionParser";

export class PRPs extends DSProcess {

    get procname(): string {
        return "ps";
    }

    protected async main(): Promise<void> {
        let t = DSKernel.terminal;
        const optparser = new DSOptionParser(
            this.argv[0],
            true,
            "   output current process stack"
        );
        optparser.parseWithUsageAndHelp(this.argv);

        const pidwidth = 6;
        let proclist = `${"PID".padStart(pidwidth)} CMD\n`;
        DSKernel.procstack.forEach((proc, idx) => {
            const active = proc.pid == DSKernel.curproc.pid ? " *" : "";
            proclist += `${String(proc.pid).padStart(pidwidth)} ${proc.procname}${active}\n`;
        });
        return t.baudText(proclist);
    }

}