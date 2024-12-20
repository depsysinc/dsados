import { DSIDirectory } from "./dsFileSystem";
import { DSStream } from "./dsStream";

export class DSProcessError extends Error {
    constructor(message: string) {
        super(message);
        Object.setPrototypeOf(this, DSProcessError.prototype);
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
        readonly envp: Record<string, string>,
        readonly stdin: DSStream,
        readonly stdout: DSStream,
    ) { }
    
    get procname(): string {
        return this.argv[0];
    }

    protected async main(): Promise<void> {
        throw new DSProcessError("Illegal base class main() call");
    };

    start(): Promise<void> {
        return this.main();
    }

    // Default ignore handlers
    handleResize(): void {} 

    chdir(dirname: string) {
        this._cwd = this._cwd.getdir(dirname);
    }
}