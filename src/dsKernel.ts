import '@xterm/xterm/css/xterm.css';

import { DSTerminal } from "./dsTerminal";

export class DSKernel {
    terminal: DSTerminal;

    constructor(terminalContainer: HTMLDivElement) {
        console.log("DepSysOS KERNEL START");
        console.log("Initializing Terminal")
        this.terminal = new DSTerminal(this, terminalContainer);

        this.terminal.directText("DepSysOS Booting...");

        this._boot();
    }

    private async _boot() {
        const t = this.terminal;
        t.baudText(
            '\r\n' +
            `Device : ${navigator.userAgent}\r\n` +
            `Grid   : ${t.cols} X ${t.rows}\r\n`
        );

    }

    handleResize(): void {
        // TODO: Send to the attached process
    };
}