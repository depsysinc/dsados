import { DSProcess } from "../dsProcess";
import { DSKernel } from "../dsKernel";

export class PRInit extends DSProcess {

    get procname(): string {
        return "init";
    }

    protected async main(): Promise<void> {
        let t = DSKernel.terminal;
        if (this.pid != 1)
            throw new Error("error: init must be first process");
        /*
        await t.baudText("renegotiating baud ", 70);
        for (let i = 1; i <= 4; i++) {
            await t.stdout('.');
            await new Promise((resolve) => setTimeout(resolve, 500));
        }

        t.reset();
        const logofile = this.cwd.getfile('/data/depsys.txt');
        const logotxt = await logofile.contentAsText();
        await t.baudText(logotxt, 1);
        */
        await t.baudText("init: exec root shell\n");
        while (true) {
            try {
                await DSKernel.exec("/bin/dssh", [], { PATH: "/bin" });
            } catch (e) {
                await t.baudText(`init: root shell exception: ${e.message}\n`);
            }
        }
    }
}