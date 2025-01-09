import { Terminal } from '@xterm/xterm';
import { WebglAddon } from '@xterm/addon-webgl';
import { FitAddon } from '@xterm/addon-fit';

import { DSKernel } from './dsKernel';
import { DSStream } from './dsStream';

import { DSScreenRenderer } from "./renderer/dsScreenRenderer";
import { DSScanlineRenderer } from "./renderer/dsScanlineRenderer";
import { DSBloomRenderer } from "./renderer/dsBloomRenderer";

function isMobileDevice(): boolean {
    const userAgent = navigator.userAgent;

    // Check for Android or iOS
    return /android/i.test(userAgent) || /iPad|iPhone|iPod/.test(userAgent);
}

export class DSTerminal {
    private _terminal: Terminal;
    private _webglAddon: WebglAddon;
    private _fitAddon: FitAddon;

    readonly outputstream: DSStream = new DSStream(true);
    readonly inputstream: DSStream = new DSStream(true);

    baud: number = 1;
    private _baudLastWriteTime: number;
    private _baudPromise: Promise<void> | undefined;
    private _baudBuffer: string;
    private _baudResolver: (value: void | PromiseLike<void>) => void;

    private _screenrender: DSScreenRenderer;
    private _scanlinerenderer: DSScanlineRenderer;
    private _bloomrenderer: DSBloomRenderer;

    get cols(): number {
        return this._terminal.cols;
    }

    get rows(): number {
        return this._terminal.rows;
    }

    constructor(terminalContainer: HTMLDivElement) {

        const t = this._terminal = new Terminal(
            {
                cols: 20,              // Set the number of columns (width)
                rows: 10,              // Set the number of rows (height)
                fontFamily: 'CRTFont, monospace', // Set the font family
                fontSize: 32,          // Set the font size
                fontWeight: 'normal',  // Optional: font weight
                cursorBlink: true,
                scrollback: 0,
            }
        );

        // Open the terminal in the specified container
        this._webglAddon = new WebglAddon();
        WebglAddon.onInit = (gl: WebGL2RenderingContext) => {
            this._bloomrenderer = new DSBloomRenderer(gl);
            this._scanlinerenderer = new DSScanlineRenderer(gl);
            this._screenrender = new DSScreenRenderer(gl);
        };

        WebglAddon.onResize = (cellwidth: number, cellheight: number) => {
            this._bloomrenderer.resize();
            this._scanlinerenderer.resize(cellheight);
            this._screenrender.resize();
        }

        WebglAddon.onRender = (texture: WebGLTexture) => {
            this._scanlinerenderer.render(texture);
            this._bloomrenderer.render(this._scanlinerenderer.texture)
            this._screenrender.render(this._bloomrenderer.texture);
        }

        t.loadAddon(this._webglAddon);

        this._fitAddon = new FitAddon();
        t.loadAddon(this._fitAddon);

        t.open(terminalContainer);

        this._terminal.options.convertEol = true;

        // Set the font color using the theme property
        t.options.theme = {
            foreground: '#00ff00', // Green font color
            background: '#000000', // Black background
        };

        // Call resize directly (no propagation because we're booting)
        this._resize();

        window.addEventListener('resize', () => { this.handleResize() });

        // hook up text io
        t.onData((data): void => { this.outputstream.write(data); });

        this._handleInput();

        // Hook up per frame processing
        this._baudBuffer = "";
        requestAnimationFrame(() => { this._baudFrame() });

        // TODO: Add listeners for keystrokes, clicks, and touches

        t.focus();
    }

    private async _handleInput() {
        while (true) {
            const data = await this.inputstream.read();
            this.baudWrite(data);
        }
    }

    async baudWrite(msg: string): Promise<void> {
        // Check if we're done writing and need to store a new frame time
        if (this._baudBuffer.length <= 0)
            this._baudLastWriteTime = performance.now();
        // write output to buffer
        this._baudBuffer = this._baudBuffer + msg;
        // return existing promise if it exists
        if (!this._baudPromise)
            this._baudPromise = new Promise<void>((resolver) => {
                this._baudResolver = resolver;
            });
        return this._baudPromise;
    }

    private _baudFrame() {
        // Always set up the next frame first
        requestAnimationFrame(() => { this._baudFrame() });
        if (this._baudBuffer.length <= 0)
            return;
        if (this.baud == 0) {
            this._terminal.write(this._baudBuffer,
                () => { this._baudCheckDone() });
            this._baudBuffer = "";
        } else {
            const delta = (performance.now() - this._baudLastWriteTime) / 1000.0;
            const charsPerSec = this.baud / 10.0;
            const charsToPrint = Math.floor(charsPerSec * delta);

            if (charsToPrint < 1.0)
                return;

            const chars = this._baudBuffer.slice(0, charsToPrint);
            this._baudBuffer = this._baudBuffer.slice(charsToPrint);
            this._terminal.write(chars,
                () => { this._baudCheckDone() });
        }
        this._baudLastWriteTime = performance.now();
    }

    private _baudCheckDone() {
        if (this._baudBuffer.length <= 0) {
            this._baudPromise = undefined;
            this._baudResolver();
        }
    }

    write(msg: string) {
        this._terminal.write(msg);
    }

    reset() {
        this._terminal.reset();
    }

    handleResize() {
        this._resize();
        DSKernel.handleResize();
    }


    private _resize(): void {
        const t = this._terminal;
        const portrait = window.matchMedia("(orientation: portrait)").matches;
        const targetCols = portrait ? 40 : 80;

        t.options.fontSize = 20;
        // Find out what the new dimensions should be
        let newdim = this._fitAddon.proposeDimensions();
        // If they're too far from 80 cols
        while (newdim.cols > targetCols + 1) {
            t.options.fontSize++;
            newdim = this._fitAddon.proposeDimensions();
        }
        while (newdim.cols < targetCols + 1) {
            t.options.fontSize--;
            newdim = this._fitAddon.proposeDimensions();
        }
        t.resize(newdim.cols, newdim.rows);
    }

    /*
for (let i = 0; i < t.cols; i++) {
    t.write(String(i % 10));
}
t.writeln("");
for (let i = 0; i < t.cols; i++) {
    t.write(String(i / 10).charAt(0));
}
*/

}