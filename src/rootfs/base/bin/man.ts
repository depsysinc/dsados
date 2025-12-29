import { DSKernel } from "../../../dsKernel";
import { DSProcess, DSProcessError } from "../../../dsProcess";
import { DSOptionParser } from "../../../lib/dsOptionParser";

export class PRMan extends DSProcess {

    protected async main(): Promise<void> {
        const optparser = new DSOptionParser(
            this.procname,
            true,
            "   display the documentation for a process",
            "<procname>"
        );
        let nextarg = optparser.parseWithUsageAndHelp(this.argv);
        if (nextarg == -1)
            throw new DSProcessError(optparser.usage());


        const filepath = '/data/man/' + this.argv[nextarg] + '.dsmd'
        try {
            this.cwd.getfile(filepath);
        }
        catch (DSIDirectoryInvalidPathError) {
            throw new DSProcessError(optparser.usage())
        }

        await DSKernel.exec('bin/dsmdbrowser', ['', filepath])


        return;
    }
}