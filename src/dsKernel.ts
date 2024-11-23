import '@xterm/xterm/css/xterm.css';

import { DSTerminal } from "./dsTerminal";
import { DSFilesystem, DSIDirectory } from "./dsFilesystem";
import { DSProcess } from "./dsProcess";
import { DSShell } from "./process/dsShell"

export class DSKernel {
    static version: string = "V1.0";

    terminal: DSTerminal;

    filesystem: DSFilesystem;

    procstack: DSProcess[] = [];
    nextpid: number = 1;

    bootbaud: number = 0;

    constructor(terminalContainer: HTMLDivElement) {
        console.log("DepSysOS KERNEL START");
        console.log("Initializing Terminal")
        this.terminal = new DSTerminal(this, terminalContainer);

        this.terminal.stdout(`BOOTING DepSysOS ${DSKernel.version}...\r\n\r\n`);

        this._boot();
    }

    private async _boot() {
        // Init terminal
        const t = this.terminal;
        await t.baudText(
            `dsterm: init\n` +
            `  Grid   : ${t.cols} X ${t.rows}\n` +
            `  Device : ${navigator.userAgent}\n`,
            this.bootbaud
        );
        // Init filesystem
        const fs = this.filesystem = new DSFilesystem(this);
        await t.baudText(`dsfs: init\n`, this.bootbaud)

        // Start init process
        await t.baudText("proc: exec init\n", this.bootbaud);
        await this.exec(PRInit);

        // Should never get here
        this.panic("UNEXPECTED INIT EXIT");
    }

    exec<T extends DSProcess>(
        processType: new (
            _kernel: DSKernel, 
            pid: number, 
            ppid: number,
            _cwd: DSIDirectory) => T
        ) : Promise<number> {
        // This is a FILO stack based process table so the parent is always
        // the currently running process.  If this is init, then we make PPID 0
        const ppid = this.curproc ? this.curproc.pid : 0;
        const cwd = this.curproc ? this.curproc.cwd : this.filesystem.root;
        // FIXME: ensure no existing process with the next pid
        const newproc = new processType(this, this.nextpid++, ppid, cwd);
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

    get curproc(): DSProcess {
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