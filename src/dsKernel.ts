import '@xterm/xterm/css/xterm.css';

import { DSPointerEvent, DSTerminal } from "./dsTerminal";
import { DSFileInfo, DSFileSystem, DSIDirectory } from "./dsFileSystem";
import { DSIDBFileSystem } from "./filesystem/dsIDBFileSystem";
import { DSIProcessFile } from "./filesystem/dsIProcessFile";
import { buildrootfs } from "./dsRootFS";
import { DSProcess } from "./dsProcess";
import { nvram_clear, nvram_get, nvram_set, sleep } from './lib/dsLib';

export class DSKernelError extends Error {
    constructor(message: string) {
        super(message);
        Object.setPrototypeOf(this, DSKernelError.prototype);
        this.name = this.constructor.name;
    }
}

export class DSKernelExecError extends DSKernelError {
    constructor(message: string) {
        super(message);
        Object.setPrototypeOf(this, DSKernelExecError.prototype);
        this.name = this.constructor.name;
    }
}

export class DSKernelMountError extends DSKernelError {
    constructor(message: string) {
        super(message);
        Object.setPrototypeOf(this, DSKernelMountError.prototype);
        this.name = this.constructor.name;
    }
}

class DSFSTableEntry {
    constructor(
        readonly mount: DSIDirectory,
        readonly fs: DSFileSystem
    ) { }
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

    static get rootfs(): DSFileSystem {
        return this.fstable[0].fs;
    }

    static async boot(terminalContainer: HTMLDivElement) {
        // Init terminal
        console.log("DepSysOS KERNEL START");
        const url = new URL(window.location.href);
        const params = new URLSearchParams(url.search);
        if (params.has("wipeall")) {
            console.log("Executing full nvram and local storage wipe");
            nvram_clear();
            await DSIDBFileSystem.delete("depsys_local_fs");
        }
        
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
        this.terminal.write("\x1b[7m");  // Invert video
        this.terminal.write(randstr);
        this.terminal.write("\x1b[27m"); // Regular video
        this.terminal.startWarmup(1000);

        await sleep(1000);
        this.terminal.reset();

        // Read NVRAM
        let bootcount = parseInt(nvram_get("bootcount"));
        if (isNaN(bootcount))
            bootcount = 0;
        nvram_set("bootcount", String(bootcount + 1));

        const fastboot = Boolean(nvram_get("fastboot"));

        let bootfactor = fastboot ? 0 : 1;

        await sleep(500 * bootfactor);
        this.terminal.write(`BOOTING DepSysOS ${DSKernel.version}...\n\n`);
        await sleep(1000 * bootfactor);
        const t = this.terminal;
        t.baud = 1200 * bootfactor;

        try {
            if (bootcount == 0) {
                await t.baudWrite(`New terminal detected, doing first time configuration\n\n`);
            }

            await t.baudWrite(
                `term: init\n` +
                `     grid : ${t.cols} X ${t.rows}\n`);

            // User Agent stuff
            const agentregex = /^([^\/]+\/[0-9.]+).*?\((.+?)\)\s*([^\/]+\/[0-9.]+(?:\s\(.*?\))?)(.*)$/;
            const agentmatch = navigator.userAgent.match(agentregex);
            if (agentmatch) {
                const standard = agentmatch[1] || "UNKNOWN";
                const device = agentmatch[2] || "UNKNOWN";
                const impl = agentmatch[3] || "UNKNOWN";

                await t.baudWrite(
                    ` standard : ${standard}\n` +
                    `   device : ${device}\n` +
                    `     impl : ${impl}\n`
                );

                const altsregex = /(\s+[^\/]+\/[0-9.]+)/g
                const altsmatch = agentmatch[4].match(altsregex);
                for (let i = 0; i < altsmatch.length; i++)
                    await t.baudWrite(`             - ${altsmatch[i].trim()}\n`);

            }

            // Init filesystem
            await t.baudWrite(`fsck: rootfs\n`)
            const rootfs = buildrootfs();
            let fsckresults = rootfs.fsck();
            await t.baudWrite(`  scanned ${fsckresults.inodecount} inodes, ${fsckresults.directorycount} dirs\n`);

            await t.baudWrite(`mount: rootfs\n`)
            DSKernel.mount('/', rootfs);

            await t.baudWrite(`fsck: localfs\n`)
            const localfs = new DSIDBFileSystem("depsys_local_fs", 1);
            await localfs.open();
            fsckresults = localfs.fsck();
            await t.baudWrite(`  scanned ${fsckresults.inodecount} inodes, ${fsckresults.directorycount} dirs\n`);

            await t.baudWrite(`mount: localfs\n`)
            DSKernel.mount('/local', localfs);

            if (bootcount == 0) {
                await t.baudWrite("nvram: enable fastboot");
                const oldbaud = t.baud;
                t.baud = 50;
                await t.baudWrite("...\n");
                nvram_set("fastboot", String(true));
                nvram_set("baud", "0");
                t.baud = oldbaud;
            }
            // Start init process
            await t.baudWrite("exec: init\n");

            t.baud = +nvram_get("baud");
            await DSKernel.exec("/bin/init", ["init"]);
        } catch (e) {
            this.panic(e);
            return;
        }

        // Should never get here
        this.panic(new Error("UNEXPECTED INIT EXIT"));
    }

    static mount(mountpath: string, fs: DSFileSystem) {
        // Check rootfs case
        if (this.fstable.length == 0) {
            if (mountpath != "/")
                throw new DSKernelMountError("First fs must have '/' mountpath");
            this.fstable.push(new DSFSTableEntry(fs.root, fs));
        } else {
            this.fstable.push(new DSFSTableEntry(fs.root, fs));
            if (!mountpath.startsWith("/"))
                throw new DSKernelMountError("Must be absolute path");
            const sepIdx = mountpath.lastIndexOf('/');
            const newdirname = mountpath.slice(sepIdx + 1);
            const parentpath = mountpath.slice(0, sepIdx + 1);
            if (newdirname.length == 0)
                throw new DSKernelMountError("Cannot have zero length mount directory");
            const parent = this.rootdir.getdir(parentpath);
            if (parent.getfileinfo(newdirname))
                throw new DSKernelMountError("Directory entry already exists");

            parent.filelist.push(new DSFileInfo(fs.root, newdirname));
            fs.root.getfileinfo("..").inode = parent;
            fs.root.parent = parent;
        }
    }

    static async exec(
        path: string,
        argv: string[],
        envp: Record<string, string> = {}
    ): Promise<void> {
        // Find the file
        const execfile = this.rootdir.getfile(path);
        if (!execfile.perms.x)
            throw new DSKernelExecError(`cannot exec '${path}': Permission Denied`);

        // This is a FILO stack based process table so the parent is always
        // the currently running process.  If this is init, then we make PPID 0

        const ppid = this.curproc ? this.curproc.pid : 0;
        const cwd = this.curproc ? this.curproc.cwd : this.fstable[0].mount;
        let stdin = this.curproc ? this.curproc.stdin : this.terminal.outputstream;
        const stdout = this.curproc ? this.curproc.stdout : this.terminal.inputstream;
        let processClass;

        if (execfile instanceof DSIProcessFile) {
            processClass = execfile.getProcessClass();
        } else {
            // Check if this is a script
            const filetext = await execfile.contentAsText().read();
            const match = filetext.match(/^#!(\/.+)\s/);
            if (!match)
                throw new DSKernelExecError("Not an executable or script");
            const interpreterpath = match[1];
            const interpreterfile = DSKernel.rootdir.getfile(interpreterpath);
            interpreterfile.perms.checkExec();

            if (!(interpreterfile instanceof DSIProcessFile))
                throw new DSKernelExecError("Interpreter is not a binary executable");

            processClass = interpreterfile.getProcessClass();
            stdin = execfile.contentAsText();
        }

        // TODO: ensure no existing process with the next pid
        const newproc = new processClass(
            this.nextpid++,
            ppid,
            cwd,
            argv,
            { ...envp }, // Copy the passed in env
            stdin,
            stdout
        );

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
        t.write(
            `${'*'.repeat(t.cols - 1)}\n` +
            `${' '.repeat(t.cols / 2 - 8)}>>> PANIC <<<\n` +
            `${'*'.repeat(t.cols - 1)}\n` +
            `\nDepSysOS ${DSKernel.version}\n`)
        this.terminal.write(e.stack);
        this.terminal.write("\n\nReset Required")
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

    static handlePointer(e: DSPointerEvent): void {
        if (!this.curproc)
            return;
        this.curproc.handlePointer(e);
    }
}