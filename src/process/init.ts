import { DSProcess } from "../dsProcess";
import { DSKernel } from "../dsKernel";
import { DSTerminal } from "../dsTerminal";
import { DSIDirectory } from "../dsFileSystem";

export class PRInit extends DSProcess {
    t: DSTerminal;

    constructor(
        readonly pid: number,
        readonly ppid: number,
        cwd: DSIDirectory
    ) {
        super(pid, ppid, cwd);
        this.t = DSKernel.terminal;
    }

    get procname(): string {
        return "init";
    }

    protected async main(): Promise<void> {
        while (true) {
            await this.t.baudText("init: spawning root shell\n");
            try {
                await DSKernel.exec("/bin/dssh");
            } catch (e) {
                await this.t.baudText(`init: root shell exception: ${e.message}\n`);
            }
        }
    }
}