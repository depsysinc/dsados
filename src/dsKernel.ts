import '@xterm/xterm/css/xterm.css';

import { DSTerminal } from "./dsTerminal";
import { DSProcess } from "./dsProcess";
import { DSShell } from "./process/dsShell"

export class DSKernel {
    static version: string = "V1.0";

    terminal: DSTerminal;
    procstack: DSProcess[] = [];
    nextpid: number = 1;

    constructor(terminalContainer: HTMLDivElement) {
        console.log("DepSysOS KERNEL START");
        console.log("Initializing Terminal")
        this.terminal = new DSTerminal(this, terminalContainer);

        this.terminal.stdout(`BOOTING DepSysOS ${DSKernel.version}...\r\n\r\n`);

        this._boot();
    }

    private async _boot() {
        const t = this.terminal;
        await this.terminal.baudText(
            `term: init\r\n` +
            `  Grid   : ${t.cols} X ${t.rows}\r\n` +
            `  Device : ${navigator.userAgent}\r\n`
        );
        await this.terminal.baudText("exec: init\r\n");
        await this.exec(PRInit);

        // Should never get here
        this.panic("UNEXPECTED INIT EXIT");
    }

    exec<T extends DSProcess>(processType: new (_kernel: DSKernel, _pid: number) => T): Promise<number> {
        // Construct the process 
        // FIXME: ensure no existing process with the next pid
        const newproc = new processType(this, this.nextpid++)
        // Start it running and return the promise
        return newproc.start();
    }

    panic(msg = "UNDEFINED") {
        // TODO: kill all processes

        const t = this.terminal;
        t.reset();
        t.stdout(
            `${'*'.repeat(t.cols - 1)}\n` +
            `${' '.repeat(t.cols / 2 - 8)}>>> PANIC <<<\n` +
            `${'*'.repeat(t.cols - 1)}\n` +
            `\nDepSysOS ${DSKernel.version}\n`)
            try {
                throw new Error(msg);
            } catch (error) {
            this.terminal.stdout(error.stack);
        }
        this.terminal.stdout("\n\nTo Reboot Press [F5]")
    }

    get curproc() : DSProcess {
        if (this.procstack.length == 0)
            return undefined;
        return this.procstack[this.procstack.length - 1];
    }
    handleResize(): void {
        if (!this.curproc)
            return;
        this.curproc.handleResize();
    };
    handleStdin(data: string) {
        if (!this.curproc)
            return;
        this.curproc.handleStdin(data);
    }
}

class PRInit extends DSProcess {
    get procname(): string {
        return "init";
    }

    main(): void {
        this._spawnloop();
    }

    private async _spawnloop() {
        while (true) {
            await this.t.baudText("init: spawning root shell\r\n");
            await this._kernel.exec(DSShell);
        }
    }
}