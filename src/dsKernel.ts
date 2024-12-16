import '@xterm/xterm/css/xterm.css';

import { DSTerminal } from "./dsTerminal";
import { DSFileSystem, DSIDirectory } from "./dsFileSystem";
import { DSIProcessFile } from "./filesystem/dsIProcessFile";
import { buildrootfs } from "./dsRootFS";
import { DSProcess } from "./dsProcess";
import { sleep } from './lib/dsLib';

class DSFSTableEntry {
    constructor(
        readonly mount: DSIDirectory,
        readonly fs: DSFileSystem
    ) { }
}

export class DSKernelError extends Error {
    constructor(message: string) {
        super(message);
        this.name = this.constructor.name;
    }
}

export class DSKernelExecError extends DSKernelError {
    constructor(message: string) {
        super(message);
        this.name = this.constructor.name;
    }
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

    static get rootdir(): DSIDirectory {
        return this.fstable[0].mount;
    }

    static async boot(terminalContainer: HTMLDivElement) {
        // Init terminal
        console.log("DepSysOS KERNEL START");
        console.log("Initializing Terminal")
        this.terminal = new DSTerminal(terminalContainer);

        // Boot garbage
        const termsize = this.terminal.cols * this.terminal.rows;
        let randstr = "";
        let randchars = "";
        for (let i = 0x00B7; i < 0x00BE; i++)
            randchars += String.fromCodePoint(i);
        for (let i = 0x00C0; i < 0x00FF; i++)
            randchars += String.fromCodePoint(i);
        for (let i = 0; i < termsize; i++)
            randstr += randchars.charAt(Math.floor(Math.random() * randchars.length));
        this.terminal.stdout("\x1b[7m");
        this.terminal.stdout(randstr);
        this.terminal.stdout("\x1b[27m");
        let bootfactor = 0;
        await sleep(1000 * bootfactor);

        this.terminal.reset();
        await sleep(500 * bootfactor);
        this.terminal.stdout(`BOOTING DepSysOS ${DSKernel.version}...\n\n`);
        await sleep(1000 * bootfactor);
        const t = this.terminal;
        t.baud = 15*bootfactor;

        try {
            await t.baudText(
                `term: init\n` +
                `     grid : ${t.cols} X ${t.rows}\n`);

            // User Agent stuff
            const agentregex = /^([^\/]+\/[0-9.]+).*?\((.+?)\)\s*([^\/]+\/[0-9.]+(?:\s\(.*?\))?)(.*)$/;
            const agentmatch = navigator.userAgent.match(agentregex);
            if (agentmatch) {
                const standard = agentmatch[1] || "UNKNOWN";
                const device = agentmatch[2] || "UNKNOWN";
                const impl = agentmatch[3] || "UNKNOWN";

                await t.baudText(
                    ` standard : ${standard}\n` +
                    `   device : ${device}\n` +
                    `     impl : ${impl}\n`
                );

                const altsregex = /(\s+[^\/]+\/[0-9.]+)/g
                const altsmatch = agentmatch[4].match(altsregex);
                for (let i = 0; i < altsmatch.length; i++)
                    await t.baudText(`             - ${altsmatch[i].trim()}\n`);

            }

            // Init filesystem
            await t.baudText(`fs: mount rootfs\n`)
            const rootfs = buildrootfs();
            this.fstable.push(new DSFSTableEntry(rootfs.root, rootfs));

            // Start init process
            await t.baudText("proc: exec init\n");
            await DSKernel.exec("/bin/init", ["init"]);
        } catch (e) {
            this.panic(e);
            return;
        }

        // Should never get here
        this.panic(new Error("UNEXPECTED INIT EXIT"));
    }

    static async exec(
        path: string,
        argv: string[],
        envp: Record<string, string> = {}
    ): Promise<number> {
        // Find the file
        const execfile = this.rootdir.getfile(path);
        if (!(execfile instanceof DSIProcessFile))
            throw new DSKernelExecError("Unsupported filetype");
        if (!execfile.perms.x)
            throw new DSKernelExecError(`cannot exec '${path}': Permission Denied`);
        const processClass = execfile.getProcessClass();

        // This is a FILO stack based process table so the parent is always
        // the currently running process.  If this is init, then we make PPID 0
        const ppid = this.curproc ? this.curproc.pid : 0;
        const cwd = this.curproc ? this.curproc.cwd : this.fstable[0].mount;
        // TODO: ensure no existing process with the next pid
        const newproc = new processClass(this.nextpid++, ppid, cwd, argv, envp);

        this.procstack.push(newproc);

        try {
            await newproc.start();
        } finally {
            this.procstack.pop();
        }

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