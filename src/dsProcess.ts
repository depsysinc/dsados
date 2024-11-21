import { DSKernel } from "./dsKernel";
import { DSTerminal } from "./dsTerminal";

export abstract class DSProcess {
    protected _t: DSTerminal;
    protected _exitPromise: Promise<number>;
    protected _exitPromiseResolver: (value: number | PromiseLike<number>) => void;

    abstract get procname(): string;

    constructor(protected _kernel: DSKernel, readonly _pid: number) {
        this._t = _kernel.terminal;
        this._exitPromise = new Promise<number>((resolve) => {
            this._exitPromiseResolver = resolve;
        });
    }

    protected abstract run(): void;



    exec(): Promise<number> {
        // Put this in the proctable
        this._kernel.process.set(this._pid,this);
        this.run();
        return this._exitPromise;
    }

    protected _exit(retval: number): void {
        // Pull this out of the proctable
        this._kernel.process.delete(this._pid);
        // Signal term
        this._exitPromiseResolver(retval);
    }
}