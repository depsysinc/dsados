import { Terminal } from '@xterm/xterm';
import { WebglAddon } from '@xterm/addon-webgl';
import { FitAddon } from '@xterm/addon-fit';

import { DSKernel } from './dsKernel';

function isMobileDevice(): boolean {
    const userAgent = navigator.userAgent;

    // Check for Android or iOS
    return /android/i.test(userAgent) || /iPad|iPhone|iPod/.test(userAgent);
}

export class DSTerminal {
    private terminal: Terminal;
    private webglAddon: WebglAddon;
    private fitAddon: FitAddon;

    get cols(): number  {
        return this.terminal.cols;
    }

    get rows(): number  {
        return this.terminal.rows;
    }


    // Private constructor to prevent direct instantiation
    constructor(private kernel : DSKernel, terminalContainer: HTMLDivElement) {
        // Initialize the xterm Terminal

        const t = this.terminal = new Terminal(
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
        if (!isMobileDevice()) {
            this.webglAddon = new WebglAddon();
            t.loadAddon(this.webglAddon);
        }

        this.fitAddon = new FitAddon();
        t.loadAddon(this.fitAddon);

        t.open(terminalContainer);

        // Set the font color using the theme property
        t.options.theme = {
            foreground: '#00ff00', // Green font color
            background: '#000000', // Black background
        };

        // Call resize directly (no propagation because we're booting)
        this._resize();
        window.addEventListener('resize', this.handleResize);
        
        // TODO: Add listeners for keystrokes, clicks, and touches
    }

    async baudText(msg: string, delay: number = 5): Promise<void> {
        for (const char of msg) {
            this.terminal.write(char);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }

    directText(msg: string) {
        this.terminal.write(msg);
    }

    handleResize = () => {
        this._resize();
        this.kernel.handleResize();
    }

    private _resize(): void {
        const t = this.terminal;
        const portrait = window.matchMedia("(orientation: portrait)").matches;
        const targetCols = portrait ? 40 : 80;

        t.options.fontSize = 20;
        // Find out what the new dimensions should be
        let newdim = this.fitAddon.proposeDimensions();
        // If they're too far from 80 cols
        while (newdim.cols > targetCols + 1) {
            t.options.fontSize++;
            newdim = this.fitAddon.proposeDimensions();
        }
        while (newdim.cols < targetCols + 1) {
            t.options.fontSize--;
            newdim = this.fitAddon.proposeDimensions();
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