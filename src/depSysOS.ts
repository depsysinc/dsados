import { FitAddon } from "@xterm/addon-fit";
import { WebglAddon } from "@xterm/addon-webgl";
import { Terminal } from "@xterm/xterm";
import '@xterm/xterm/css/xterm.css';

function isMobileDevice(): boolean {
    const userAgent = navigator.userAgent;
  
    // Check for Android or iOS
    return /android/i.test(userAgent) || /iPad|iPhone|iPod/.test(userAgent);
}

export class DepSysOS {
    private terminal: Terminal;
    private webglAddon: WebglAddon;
    private fitAddon: FitAddon;

    private handleResize = () => {
        this._resizeTerminal();
        const t = this.terminal;
        t.writeln(`Resize: ${t.cols} x ${t.rows}`);
    };

    constructor(terminalContainer: HTMLDivElement) {
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
        this.webglAddon = new WebglAddon();
        if (!isMobileDevice()) {
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
        console.log("DepSys terminal firmware initialized");

        console.log("Booting DepSysOS...");

        t.writeln("DepSysOS Booting...");

        this._resizeTerminal();

        t.writeln('');
        t.writeln(`Device : ${navigator.userAgent}`);
        t.writeln(`Grid   : ${t.cols} X ${t.rows}`);
        /*
        for (let i = 0; i < t.cols; i++) {
            t.write(String(i % 10));
        }
        t.writeln("");
        for (let i = 0; i < t.cols; i++) {
            t.write(String(i / 10).charAt(0));
        }
        */
        window.addEventListener('resize', this.handleResize);
    }

    private _resizeTerminal(): void {
        const t = this.terminal;
        const portrait = window.matchMedia("(orientation: portrait)").matches;
        const targetCols = portrait ? 40 : 80;

        t.options.fontSize = 20;
        // Find out what the new dimensions should be
        let newdim = this.fitAddon.proposeDimensions();
        // If they're too far from 80 cols
        while (newdim.cols > targetCols+1) {
            t.options.fontSize++;
            newdim = this.fitAddon.proposeDimensions();
        }
        while (newdim.cols < targetCols+1) {
            t.options.fontSize--;
            newdim = this.fitAddon.proposeDimensions();
        }

        t.resize(newdim.cols - 1, newdim.rows);
    }
}