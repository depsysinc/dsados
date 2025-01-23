export class DSConcurrentQueueError extends Error {
    constructor(message: string) {
        super(message);
        Object.setPrototypeOf(this, DSConcurrentQueueError.prototype);
        this.name = this.constructor.name;
    }
}

export class DSConcurrentQueue<T> {
    private _queue: T[] = [];
    private _resolver: ((value: T | PromiseLike<T>) => void) | undefined;
    private _rejecter: ((reason?: any) => void) | undefined;

    dequeue(): Promise<T> {
        // If there is input in the buffer then return it
        if (this._queue.length > 0) {
            let data = this._queue.shift();
            return Promise.resolve(data!);
        }
        // If there is a resolver, then someones already waiting
        if (this._resolver)
            throw new DSConcurrentQueueError("Only one blocked reader allowed");
        // If not set up a promise for signalling
        return new Promise<T>((resolve, reject) => {
            this._resolver = resolve;
            this._rejecter = reject;
        });
    }

    enqueue(data: T): void {
        // Check if someone's waiting for the input
        if (this._resolver) {
            // NB: If someone's waiting then by definition the buffer is empty 
            this._resolver(data);
            this._resolver = undefined;
            this._rejecter = undefined;
        } else {
            // If nobody's waiting then enqueue the input
            this._queue.push(data);
        }
    }
}