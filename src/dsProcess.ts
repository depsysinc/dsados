import { DSKernel } from "./dsKernel";
import { DSTerminal } from "./dsTerminal";

export abstract class DSProcess {
    t: DSTerminal;
    protected _exitPromise: Promise<number>;
    protected _exitPromiseResolver: (value: number | PromiseLike<number>) => void;

    
    constructor(protected _kernel: DSKernel, readonly pid: number) {
        this.t = _kernel.terminal;
        this._exitPromise = new Promise<number>((resolve) => {
            this._exitPromiseResolver = resolve;
        });
    }
    
    abstract get procname(): string;
    protected abstract main(): void;

    start(): Promise<number> {
        // Add to top of process stack
        this._kernel.procstack.push(this);
        this.main();
        return this._exitPromise;
    }

    protected _exit(retval: number): void {
        // Pop off the process stack
        this._kernel.procstack.pop();
        // Signal term
        this._exitPromiseResolver(retval);
    }

    // Default ignore handlers
    handleResize(): void {} 
    handleStdin(data: string): void {}
}