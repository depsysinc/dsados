import '@xterm/xterm/css/xterm.css';

import { DSTerminal } from "./dsTerminal";
import { DSFileSystem, DSIDirectory } from "./dsFileSystem";
import { buildrootfs } from "./dsRootFS";
import { DSProcess } from "./dsProcess";
import { DSShell } from "./process/dssh"

class DSFSTableEntry {
    constructor(
        readonly mount: DSIDirectory,
        readonly fs: DSFileSystem
    ) {}
}

export class DSKernel {
    static version: string = "V1.0";

    static terminal: DSTerminal;

    static fstable: DSFSTableEntry[] = [];

    static procstack: DSProcess[] = [];
    static nextpid: number = 1;

    static bootbaud: number = 0;

    private constructor() {
    }

    static async boot(terminalContainer: HTMLDivElement) {
        // Init terminal
        console.log("DepSysOS KERNEL START");
        console.log("Initializing Terminal")
        this.terminal = new DSTerminal(terminalContainer);

        this.terminal.stdout(`BOOTING DepSysOS ${DSKernel.version}...\r\n\r\n`);

        const t = this.terminal;
        t.baud = 0;
        await t.baudText(
            `dsterm: init\n` +
            `  Grid   : ${t.cols} X ${t.rows}\n` +
            `  Device : ${navigator.userAgent}\n`,
        );
        // Init filesystem
        await t.baudText(`fs: mount rootfs\n`)
        const rootfs = buildrootfs();
        this.fstable.push(new DSFSTableEntry(rootfs.root,rootfs));

        // Start init process
        await t.baudText("proc: exec init\n");
        t.baud = 10;
        try {
            await DSKernel.exec(PRInit);
        } catch(e) {
            this.panic(e);
        }

        // Should never get here
        this.panic(new Error("UNEXPECTED INIT EXIT"));
    }

    static async exec<T extends DSProcess>(
        processType: new (
            pid: number, 
            ppid: number,
            _cwd: DSIDirectory) => T
        ) : Promise<number> {
        // This is a FILO stack based process table so the parent is always
        // the currently running process.  If this is init, then we make PPID 0
        const ppid = this.curproc ? this.curproc.pid : 0;
        const cwd = this.curproc ? this.curproc.cwd : this.fstable[0].mount;
        // TODO: ensure no existing process with the next pid
        const newproc = new processType(this.nextpid++, ppid, cwd);
        
        this.procstack.push(newproc);

        await newproc.start();

        this.procstack.pop();

        return;
    }

    static panic(e: Error) {
        // TODO: clear out procstack

        const t = this.terminal;
        t.reset();
        t.stdout(
            `${'*'.repeat(t.cols - 1)}\n` +
            `${' '.repeat(t.cols / 2 - 8)}>>> PANIC <<<\n` +
            `${'*'.repeat(t.cols - 1)}\n` +
            `\nDepSysOS ${DSKernel.version}\n`)
        this.terminal.stdout(e.stack);
        this.terminal.stdout("\n\nReset Required")
    }

    static get curproc(): DSProcess {
        if (this.procstack.length == 0)
            return undefined;
        return this.procstack[this.procstack.length - 1];
    }
    static handleResize(): void {
        if (!this.curproc)
            return;
        this.curproc.handleResize();
    };
    static handleStdin(data: string) {
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
            await DSKernel.terminal.baudText("init: spawning root shell\r\n");
            await DSKernel.exec(DSShell);
        }
    }
}