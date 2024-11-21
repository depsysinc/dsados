import { DSProcess } from "../dsProcess";

export class DSShell extends DSProcess {
    get procname(): string {
        return "dssh";
    }
    protected main(): void {
        this._t.baudText("$ ");
    }
    handleResize(): void {
        console.log("RESIZE!");
    }
    handleStdin(data: string): void {
        console.log(data);
    }
}