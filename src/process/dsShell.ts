import { DSProcess } from "../dsProcess";

export class DSShell extends DSProcess {
    get procname(): string {
        return "dssh";
    }
    protected run(): void {
        this._t.baudText("$ ");
    }
}