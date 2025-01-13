import { Terminal } from '@xterm/xterm';
import { WebglAddon } from '@xterm/addon-webgl';
import { FitAddon } from '@xterm/addon-fit';

import { DSKernel } from './dsKernel';
import { DSStream } from './dsStream';

import { DSScreenRenderer } from "./renderer/dsScreenRenderer";
import { DSScanlineRenderer } from "./renderer/dsScanlineRenderer";
import { DSBloomRenderer } from "./renderer/dsBloomRenderer";
import { DSVertHorizRenderer } from "./renderer/dsVertHorizRenderer";
import { DSSpriteRenderer } from "./renderer/dsSpriteRenderer";

import testpng from "./root/data/gorzocrop.png";// "./root/data/32x32_test.png";

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

    private _glInitSuccess: boolean = false;
    private _gl: WebGL2RenderingContext;

    private _screenrender: DSScreenRenderer;
    private _scanlinerenderer: DSScanlineRenderer;
    private _bloomrenderer: DSBloomRenderer;
    private _verthorizrenderer: DSVertHorizRenderer;

    private _pixelWidth: number; // Number of real pixels per terminal pixel
    private _pixelHeight: number;
    private _width: number; // Number of terminal pixels
    private _height: number;
    readonly cellwidth: number = 10; // Number of terminal pixels per cell
    readonly cellheight: number = 16;

    private _warmupStart: number;
    private _warmupDuration: number;
    private _spriterenderer: DSSpriteRenderer;
    private _spritetexture: WebGLTexture;
    private _spriteimage: HTMLImageElement;

    get cols(): number { return this._terminal.cols; }
    get rows(): number { return this._terminal.rows; }
    get width(): number { return this._width; }
    get height(): number { return this._height; }

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
            this._gl = gl;
            this._spriterenderer = new DSSpriteRenderer(gl);
            this._scanlinerenderer = new DSScanlineRenderer(gl);
            this._bloomrenderer = new DSBloomRenderer(gl);
            this._verthorizrenderer = new DSVertHorizRenderer(gl);
            this._screenrender = new DSScreenRenderer(gl);
            this._glInitSuccess = true;

            this._spriteimage = new Image();
            this._spriteimage.src = testpng;
            this._spriteimage.onload = () => {
                const img = this._spriteimage;
                this._spritetexture = gl.createTexture();
                gl.bindTexture(gl.TEXTURE_2D_ARRAY, this._spritetexture);
                gl.texStorage3D(gl.TEXTURE_2D_ARRAY, 1, gl.RGBA8, img.width, img.height, 1);
                gl.texSubImage3D(
                    gl.TEXTURE_2D_ARRAY,  // TARGET
                    0,                    // LEVEL 
                    0,                    // xoffset 
                    0,                    // yoffset
                    0,                    // zoffset
                    img.width,
                    img.height,
                    1,                    // depth
                    gl.RGBA,
                    gl.UNSIGNED_BYTE,
                    img
                );

                gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
                gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
                gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
                gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
            }
        };

        WebglAddon.onResize = (cellwidth: number, cellheight: number) => {
            const t = this._terminal;
            this._pixelWidth = cellwidth / this.cellwidth;
            this._pixelHeight = cellheight / this.cellheight;
            this._width = t.cols * this.cellwidth;
            this._height = t.rows * this.cellheight;

            this._spriterenderer.resize(this._pixelWidth, this._pixelHeight);
            this._scanlinerenderer.resize(cellheight);
            this._bloomrenderer.resize();
            this._verthorizrenderer.resize();
            this._screenrender.resize();
        }

        WebglAddon.onRender = (texture: WebGLTexture) => {
            if (this._warmupStart > 0) {
                const curTime = Date.now() - this._warmupStart;
                if (curTime < this._warmupDuration) {
                    const t = curTime / this._warmupDuration; // Normalize to [0, 1]
                    const vc = oscillatingStep(t / 1000);
                    this._verthorizrenderer.vert = vc;
                    this._verthorizrenderer.horiz = vc;
                } else {
                    this._warmupStart = 0;
                    this._verthorizrenderer.vert = 1.0;
                    this._verthorizrenderer.horiz = 1.0;
                }
                this._terminal.refresh(0, this._terminal.rows - 1);
            }
            // Sprites rendered to shim framebuffer
            const off = { x: 0, y: 0 };
            this._spriterenderer.render(this._spritetexture, off.x, off.y);
            this._scanlinerenderer.render(texture);
            this._bloomrenderer.render(this._scanlinerenderer.texture);
            // OPT: Skip verthoriz if params are 1.0
            this._verthorizrenderer.render(this._bloomrenderer.texture);
            this._screenrender.render(this._verthorizrenderer.texture);
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
        if (!this._glInitSuccess) {
            const err = "HALT: Required terminal capabilities missing\n\n"
                + "DSADOS requires GL functionality";
            this._terminal.write(err);
            throw Error(err);
        }

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

    public startWarmup(duration: number) {
        this._warmupStart = Date.now();
        this._warmupDuration = duration;
        this._terminal.refresh(0, this._terminal.rows - 1);
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

function oscillatingStep(t: number): number {
    // const R = 70; // ohms
    // const L = 0.005; // henries
    // const C = 1e-6; // farads

    // Natural angular frequency

    // const omega0 = 1 / Math.sqrt(L * C);
    const omega0 = 14142.13;

    // Damping factor
    // const zeta = R / (2 * Math.sqrt(L / C));
    const zeta = 0.49497;

    // Damped angular frequency
    // const omegaD = omega0 * Math.sqrt(1 - zeta ** 2);
    const omegaD = 12288.20;

    // Exponential decay factor
    const exponentialDecay = Math.exp(-zeta * omega0 * t);

    // Oscillatory terms
    const cosineTerm = Math.cos(omegaD * t);
    const sineTerm = (zeta / Math.sqrt(1 - zeta ** 2)) * Math.sin(omegaD * t);

    // Voltage across the capacitor
    const vc = (1 - exponentialDecay * (cosineTerm + sineTerm));

    return vc;
}
