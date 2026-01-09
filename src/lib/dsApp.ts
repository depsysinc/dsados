import { DSConcurrentQueue } from "../dsConcurrentQueue";
import { DSKernel } from "../dsKernel";
import { DSProcess, DSProcessError } from "../dsProcess";
import { DSKeyEvent, DSPointerEvent } from "../dsTerminal";
import { DSOptionParser } from "./dsOptionParser";

export class DSAppBaseProcess extends DSProcess {

}

export abstract class DSApp extends DSProcess {
    protected eventQueue: DSConcurrentQueue<DSAppEvent> = new DSConcurrentQueue<DSAppEvent>();
    protected done: boolean = false;
    protected currentfilename: string = '';
    protected stdinEventQueue: boolean = true;

    private static baseprocess: DSAppBaseProcess;

    private async main(): Promise<void> {
        const optparser = new DSOptionParser(
            this.procname,
            true,
            "   a markdown browser",
            "<mdfile>"
        );
        let nextarg = optparser.parseWithUsageAndHelp(this.argv);
        if (nextarg == -1)
            throw new DSProcessError(optparser.usage());


        let filename = this.argv[nextarg];
        this.startApp(filename);
        return
    }

    protected abstract run(): Promise<void>;

    get currentstate(): HistoryState {
        return {
            process: this.procname,
            filepath: this.currentfilename
        }
    }

    startApp(filename: string) {
        this.currentfilename = filename
        if (!DSApp.baseprocess) {
            DSKernel.exec("bin/dsappbaseprocess", [''])
        }
    }

    protected init() {
        //Add history entry if none exists
        if (history.state == null)
            history.replaceState(this.currentstate, '');
    }

    protected addNewPage(filename: string) {
        this.currentfilename = filename;
        history.pushState(this.currentstate, '')
    }

    terminate() {
        // Do any cleanup
        this.done = true;
        this.eventQueue.enqueue(new TerminateAppEvent);
    }

    handlePointer(e: DSPointerEvent): void {
        if (e.type == "wheel") {

            this.eventQueue.enqueue(new WheelAppEvent(
                e.x,
                e.y,
                e.col,
                e.row,
                0,
                e.dy
            ));
        } else if (e.type == "touchstart") {
            this.eventQueue.enqueue(new TouchStartAppEvent(
                e.x,
                e.y,
                e.col,
                e.row
            ));
        } else if (e.type == "touchmove") {
            this.eventQueue.enqueue(new TouchMoveAppEvent(
                e.x,
                e.y,
                e.col,
                e.row
            ));
        } else if (e.type == "touchend") {
            this.eventQueue.enqueue(new TouchEndAppEvent(
                e.x,
                e.y,
                e.col,
                e.row
            ));
        } else if (e.type == "mousemove") {
            this.eventQueue.enqueue(new MouseMoveAppEvent(
                e.x,
                e.y,
                e.col,
                e.row
            ));
        } else if (e.type == "mousedown") {
            this.eventQueue.enqueue(new MouseButtonDownEvent(
                e.x,
                e.y,
                e.col,
                e.row,
                0,
                0,
                e.button
            ));
        } else if (e.type == "mouseup") {
            this.eventQueue.enqueue(new MouseButtonUpEvent(
                e.x,
                e.y,
                e.col,
                e.row,
                0,
                0,
                e.button
            ));
        }

        else {
            // console.log(e);
        }
    }

    handleResize(): void {
        this.eventQueue.enqueue(new ResizeAppEvent());
    }

    handleHistory(e: PopStateEvent): void {
        let state: HistoryState = e.state;
        this.terminate();
        DSKernel.exec('/bin/' + state.process, [state.process, state.filepath])
        this.eventQueue.enqueue(new HistoryAppEvent(e));
    }

    handleKeyEvent(e: DSKeyEvent): void {
        const event = createAppEventsFromKeyEvents(e);
        if (event != undefined) {
            this.eventQueue.enqueue(event);
        }
    }

    pushHistory() {
        history.pushState(this.currentstate, '');
    }

}

export abstract class DSAppEvent { }

// History
export class HistoryAppEvent extends DSAppEvent {
    constructor(readonly e: PopStateEvent) {
        super();
    }
}
export type HistoryState =
    {
        process: string;
        filepath: string;
    }

// Keys
export class UpArrowAppEvent extends DSAppEvent { }
export class DownArrowAppEvent extends DSAppEvent { }
export class LeftArrowAppEvent extends DSAppEvent { }
export class RightArrowAppEvent extends DSAppEvent { }
export class PageDownAppEvent extends DSAppEvent { }
export class PageUpAppEvent extends DSAppEvent { }
export class DeleteAppEvent extends DSAppEvent { }
export class BackspaceAppEvent extends DSAppEvent { }
export class KeyUpAppEvent extends DSAppEvent {
    constructor(readonly key: string) {
        super();
    }
}
export class TextAppEvent extends DSAppEvent {
    constructor(readonly text: string) {
        super();
    }
}


export abstract class PointerAppEvent extends DSAppEvent {
    constructor(
        readonly x: number,
        readonly y: number,
        readonly col: number,
        readonly row: number,
        readonly deltaX: number = 0,
        readonly deltaY: number = 0,
        readonly button: number = 0,
    ) {
        super();
    }
}

// Mouse
export class WheelAppEvent extends PointerAppEvent { }
export class MouseMoveAppEvent extends PointerAppEvent { }
export class MouseButtonDownEvent extends PointerAppEvent { }
export class MouseButtonUpEvent extends PointerAppEvent { }

// Touch
export class TouchStartAppEvent extends PointerAppEvent { }
export class TouchEndAppEvent extends PointerAppEvent { }
export class TouchMoveAppEvent extends PointerAppEvent { }

// App
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

export function createAppEventsFromKeyEvents(event: DSKeyEvent): DSAppEvent {
    if (!event.down) {
        return new KeyUpAppEvent(event.key);
    }
    if (event.code == "ArrowLeft") {
        return new LeftArrowAppEvent();
    }
    else if (event.code == "ArrowRight") {
        return new RightArrowAppEvent();
    }
    else if (event.code == "ArrowDown") {
        return new DownArrowAppEvent();
    }
    else if (event.code == "ArrowUp") {
        return new UpArrowAppEvent();
    }
    else if (event.code == "Delete") {
        return new DeleteAppEvent();
    }
    else if (event.code == "PageUp") {
        return new PageUpAppEvent();
    }
    else if (event.code == "PageDown") {
        return new PageUpAppEvent();
    }
    else if (event.code == "Escape") {
    }
    else if (event.code == "Backspace") {
        return new BackspaceAppEvent();
    }
    else {
        return new TextAppEvent(event.key)
    }
}