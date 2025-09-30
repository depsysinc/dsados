import { DSIDirectory } from "../dsFileSystem";
import { DSProcess } from "../dsProcess";
import { DSOptionParser } from "../lib/dsOptionParser";

export class PRFSViewer extends DSProcess {

    private currentdir: DSIDirectory;

    protected async main(): Promise<void> {
        const optparser = new DSOptionParser(
            this.procname,
            true,
            "   view filesystem",
            "<dirname>"
        );
        let nextarg = optparser.parseWithUsageAndHelp(this.argv);

        if (nextarg == -1) {
            this.currentdir = this.cwd
        }
        else {
            this.currentdir = this.cwd.getdir(this.argv[nextarg])
        }

        console.log(this.currentdir);
        return;
    }
}