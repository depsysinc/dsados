export class DSStreamError extends Error {
    constructor(message: string) {
        super(message);
        this.name = this.constructor.name;
    }
}

export class DSStream {
    private _buffer: string[] = [];
    private _resolver: ((value: string | PromiseLike<string>) => void) | undefined;

    read(): Promise<string> {
        // If there is input in the buffer then return it
        if (this._buffer.length > 0){
            let data = this._buffer.shift();
            return Promise.resolve(data!);
        }
        // If there is a resolver, then someones already waiting
        if (this._resolver)
            throw new DSStreamError("Only one blocked reader allowed");
        // If not set up a promise for signalling
        return new Promise<string>((resolve) => {
            this._resolver = resolve;
        });
    }

    write(data: string): void {
        // Check if someone's waiting for the input
        if (this._resolver) {
            // NB: If someone's waiting then by definition the buffer is empty 
            this._resolver(data);
            this._resolver = undefined;
        } else {
            // If nobody's waiting then enqueue the input
            this._buffer.push(data);
        }

    }

    readsPending(): number {
        return this._buffer.length;
    }
}