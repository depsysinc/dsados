import { DSConcurrentQueue } from "./dsConcurrentQueue";
import { DSProcess } from "./dsProcess";
import { DSPointerEvent } from "./dsTerminal";


export abstract class DSApp extends DSProcess {
    protected eventQueue: DSConcurrentQueue<DSAppEvent> = new DSConcurrentQueue<DSAppEvent>();
    protected done: boolean = false;

    protected init() {
        // start keystroke handling
        this._startStdinHandler();
    }

    private async _startStdinHandler() {
        while (!this.done) {
            try {
                const str = await this.stdin.read();
                const events = createAppEventsFromStdin(str);
                while (events.length > 0)
                    this.eventQueue.enqueue(events.shift());
            } catch (e) {
                this.terminate();
            }
        }
    }

    terminate() {
        // Do any cleanup
        this.done = true;
        this.eventQueue.enqueue(new TerminateAppEvent);
    }

    handlePointer(e: DSPointerEvent): void {
        if (e.type == "wheel")
            this.eventQueue.enqueue(new WheelAppEvent(e.dy));
    }

    handleResize(): void {
        this.eventQueue.enqueue(new ResizeAppEvent());
    }

}

export abstract class DSAppEvent { }

// Keys
export class UpArrowAppEvent extends DSAppEvent { }
export class DownArrowAppEvent extends DSAppEvent { }
export class LeftArrowAppEvent extends DSAppEvent { }
export class RightArrowAppEvent extends DSAppEvent { }
export class PageDownAppEvent extends DSAppEvent {}
export class PageUpAppEvent extends DSAppEvent {}
export class DeleteAppEvent extends DSAppEvent { }
export class BackspaceAppEvent extends DSAppEvent { }
export class TextAppEvent extends DSAppEvent {
    constructor(readonly text: string) {
        super();
    }
}

// Mouse
export class WheelAppEvent extends DSAppEvent { 
    constructor(readonly deltaY: number) {
        super();
    }
}

export class ResizeAppEvent extends DSAppEvent { }
export class TerminateAppEvent extends DSAppEvent { }

export function createAppEventsFromStdin(str: string): DSAppEvent[] {
    const events: DSAppEvent[] = [];
    let unprocessed = str;
    while (unprocessed.length > 0) {
        if (unprocessed.charAt(0) == "\x1b") {

            if (unprocessed.startsWith("\x1b[D")) { // Left Arrow
                events.push(new LeftArrowAppEvent());
                unprocessed = unprocessed.slice(3);

            } else if (unprocessed.startsWith("\x1b[C")) { // Right Arrow
                events.push(new RightArrowAppEvent());
                unprocessed = unprocessed.slice(3);

            } else if (unprocessed.startsWith("\x1b[A")) { // Up Arrow
                events.push(new UpArrowAppEvent());
                unprocessed = unprocessed.slice(3);

            } else if (unprocessed.startsWith("\x1b[B")) { // Down Arrow
                events.push(new DownArrowAppEvent());
                unprocessed = unprocessed.slice(3);

            } else if (unprocessed.startsWith("\x1b[3~")) { // Delete
                events.push(new DeleteAppEvent());
                unprocessed = unprocessed.slice(4);

            } else if (unprocessed.startsWith("\x1b[5~")) { // PgUp
                events.push(new PageUpAppEvent());
                unprocessed = unprocessed.slice(4);

            } else if (unprocessed.startsWith("\x1b[6~")) { // PgDown
                events.push(new PageDownAppEvent());
                unprocessed = unprocessed.slice(4);
            
            } else {  // Slice off the escape
                console.log("unknown escape sequence: " + unprocessed);
                unprocessed = unprocessed.slice(1);
            }
        } else if (unprocessed.charAt(0) == "\x7f") {
            events.push(new BackspaceAppEvent());
            unprocessed = unprocessed.slice(1);
        } else {
            const match = unprocessed.match(/^([^\x1b\x7f]+)\x1b|\x7f/);
            if (match) {
                const text = match[1];
                events.push(new TextAppEvent(text));
                unprocessed = unprocessed.slice(text.length);
            } else {
                events.push(new TextAppEvent(unprocessed));
                unprocessed = "";
            }

        }
    }
    return events;
}
