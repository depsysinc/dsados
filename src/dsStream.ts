export class DSStreamError extends Error {
    constructor(message: string) {
        super(message);
        Object.setPrototypeOf(this, DSStreamError.prototype);
        this.name = this.constructor.name;
    }
}

export class DSStreamClosedError extends DSStreamError {
    constructor(message: string) {
        super(message);
        Object.setPrototypeOf(this, DSStreamClosedError.prototype);
        this.name = this.constructor.name;
    }
}

export class DSStream {
    private _buffer: string[] = [];
    private _resolver: ((value: string | PromiseLike<string>) => void) | undefined;
    private _rejecter: (reason?: any) => void | undefined;
    private _closed: boolean = false;

    constructor(private _isatty = false) { }

    get isatty() { return this._isatty }
    
    get closed(): boolean {
        return this._closed;
    }

    close() {
        this._closed = true;
        // Check if someone's waiting
        if (this._resolver)
            this._rejecter(new DSStreamClosedError("End of Stream"));
    }

    read(): Promise<string> {
        // If there is input in the buffer then return it
        if (this._buffer.length > 0) {
            let data = this._buffer.shift();
            return Promise.resolve(data!);
        }
        // If we're closed then signal that
        if (this._closed)
            return Promise.reject(new DSStreamClosedError("End of Stream"));
        // If there is a resolver, then someones already waiting
        if (this._resolver)
            throw new DSStreamError("Only one blocked reader allowed");
        // If not set up a promise for signalling
        return new Promise<string>((resolve, reject) => {
            this._resolver = resolve;
            this._rejecter = reject;
        });
    }

    write(data: string): void {
        if (this._closed)
            throw new DSStreamClosedError("Cannot write to closed stream");
        // Check if someone's waiting for the input
        if (this._resolver) {
            // NB: If someone's waiting then by definition the buffer is empty 
            this._resolver(data);
            this._resolver = undefined;
            this._rejecter = undefined;
        } else {
            // If nobody's waiting then enqueue the input
            this._buffer.push(data);
        }

    }

    readsPending(): number {
        return this._buffer.length;
    }
}