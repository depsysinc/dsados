import { DSIDirectory } from "./dsFileSystem";

export abstract class DSProcess {
    protected _exitPromise: Promise<number>;
    protected _exitPromiseResolver: (value: number | PromiseLike<number>) => void;

    get cwd() : DSIDirectory {
        return this._cwd;
    }
    
    constructor(
        readonly pid: number,
        readonly ppid: number,
        private _cwd: DSIDirectory
    ) {
        this._exitPromise = new Promise<number>((resolve) => {
            this._exitPromiseResolver = resolve;
        });
    }
    
    abstract get procname(): string;
    protected abstract main(): void;

    start(): Promise<number> {
        this.main();
        return this._exitPromise;
    }

    protected _exit(retval: number): void {
        this._exitPromiseResolver(retval);
    }

    // Default ignore handlers
    handleResize(): void {} 
    handleStdin(data: string): void {}

    chdir(dirname: string) {
        this._cwd = this._cwd.getdir(dirname);
    }
}