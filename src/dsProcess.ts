import { DSIDirectory } from "./dsFileSystem";

export class DSProcessError extends Error {
    constructor(message: string) {
        super(message);
        this.name = this.constructor.name;
    }
}

export abstract class DSProcess {

    get cwd() : DSIDirectory {
        return this._cwd;
    }
    
    constructor(
        readonly pid: number,
        readonly ppid: number,
        private _cwd: DSIDirectory,
        readonly argv: string[],
        readonly envp: Record<string, string>
    ) { }
    
    abstract get procname(): string;

    protected async main(): Promise<void> {
        throw new DSProcessError("Illegal base class main() call");
    };

    start(): Promise<void> {
        return this.main();
    }

    // Default ignore handlers
    handleResize(): void {} 
    handleStdin(data: string): void {}

    chdir(dirname: string) {
        this._cwd = this._cwd.getdir(dirname);
    }
}