import '@xterm/xterm/css/xterm.css';

import { DSTerminal } from "./dsTerminal";
import { DSProcess } from "./dsProcess";
import { DSShell } from "./process/dsShell"

export class DSKernel {
    static version: string = "V1.0";

    terminal: DSTerminal;
    process: Map<number, DSProcess> = new Map();
    nextpid: number = 1;

    constructor(terminalContainer: HTMLDivElement) {
        console.log("DepSysOS KERNEL START");
        console.log("Initializing Terminal")
        this.terminal = new DSTerminal(this, terminalContainer);

        this.terminal.directText(`BOOTING DepSysOS ${DSKernel.version}...\r\n\r\n`);

        this._boot();
    }

    private async _boot() {
        const t = this.terminal;
        await this.terminal.baudText(
            `Initializing Terminal:\r\n` +
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
        return newproc.exec();
    }

    panic(msg = "UNDEFINED") {
        // TODO: kill all processes

        const t = this.terminal;
        t.reset();
        t.convertEol(true);
        t.directText(
            `${'*'.repeat(t.cols - 1)}\n` +
            `${' '.repeat(t.cols / 2 - 8)}>>> PANIC <<<\n` +
            `${'*'.repeat(t.cols - 1)}\n` +
            `\nDepSysOS ${DSKernel.version}\n`)
            try {
                throw new Error(msg);
            } catch (error) {
            this.terminal.directText(error.stack);
        }
        this.terminal.directText("\n\nTo Reboot Press [F5]")
    }

    handleResize(): void {
        // TODO: Send to the attached process
    };
}

class PRInit extends DSProcess {
    get procname(): string {
        return "init";
    }

    run(): void {
        this._spawnloop();
    }

    private async _spawnloop() {
        while (true) {
            await this._t.baudText("init: spawning root shell\r\n");
            await this._kernel.exec(DSShell);
        }
    }
}