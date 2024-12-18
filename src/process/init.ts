import { DSProcess, DSProcessError } from "../dsProcess";
import { DSKernel } from "../dsKernel";

export class PRInit extends DSProcess {

    protected async main(): Promise<void> {
        let t = DSKernel.terminal;
        if (this.pid != 1)
            throw new DSProcessError("error: init must be first process");
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
        const procpath = "/bin/dssh";
        this.stdout.write(`init: exec ${procpath}\n`);
        while (true) {
            try {
                await DSKernel.exec(procpath, ["dssh"], { PATH: "/bin" });
            } catch (e) {
                this.stdout.write(`init: root shell exception: ${e.message}\n`);
            }
        }
    }
}