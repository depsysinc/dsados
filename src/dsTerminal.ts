import { Terminal } from '@xterm/xterm';
import { WebglAddon } from '@xterm/addon-webgl';
import { FitAddon } from '@xterm/addon-fit';

import { DSKernel } from './dsKernel';
import { DSStream } from './dsStream';

function isMobileDevice(): boolean {
    const userAgent = navigator.userAgent;

    // Check for Android or iOS
    return /android/i.test(userAgent) || /iPad|iPhone|iPod/.test(userAgent);
}

export class DSTerminal {
    private _terminal: Terminal;
    private _webglAddon: WebglAddon;
    private _fitAddon: FitAddon;
    baud: number = 1;
    readonly outputstream: DSStream = new DSStream(true);
    readonly inputstream: DSStream = new DSStream(true);

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
        this._webglAddon?.startFadeIn(1500);

        window.addEventListener('resize', () => { this.handleResize() });

        // hook up text io
        t.onData((data): void => { this.outputstream.write(data); });

        this._handleInput();
        // TODO: Add listeners for keystrokes, clicks, and touches

        t.focus();
    }

    private async _handleInput() {
        while (true) {
            const data = await this.inputstream.read();
            await this.baudWrite(data); 
        }
    }

    async baudWrite(msg: string, delay: number = undefined): Promise<void> {
        // Handle default delay case
        if (delay == undefined)
            delay = this.baud;
        // Handle no delay case
        if (delay <= 0) {
            await new Promise<void>((resolve) => {
                this._terminal.write(msg, () => { resolve(); });
            });
            return;
        }
        for (const char of msg) {
            await new Promise<void>((resolve) => {
                const startTime = Date.now();

                // Write the character to the terminal
                this._terminal.write(char, () => {
                    const elapsed = Date.now() - startTime;

                    // If the rendering was faster than the delay, wait the remaining time
                    if (elapsed < delay) {
                        setTimeout(resolve, delay - elapsed);
                    } else {
                        resolve();
                    }
                });
            });
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

        t.resize(newdim.cols - 1, newdim.rows);
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