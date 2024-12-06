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

    main(): void {
        this._spawnloop();
    }

    private async _spawnloop() {
        while (true) {
            await this.t.baudText("init: spawning root shell\n");
            await DSKernel.exec("/bin/dssh");
        }
    }
}