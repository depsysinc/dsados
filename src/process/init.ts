import { DSProcess, DSProcessError } from "../dsProcess";
import { DSKernel } from "../dsKernel";

export class PRInit extends DSProcess {

    protected async main(): Promise<void> {
        let t = DSKernel.terminal;
        if (this.pid != 1)
            throw new DSProcessError("error: init must be first process");

        t.reset();
        const logofile = this.cwd.getfile('/data/depsys.txt');
        const logotxt = await logofile.contentAsText().read();
        this.stdout.write(logotxt);

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