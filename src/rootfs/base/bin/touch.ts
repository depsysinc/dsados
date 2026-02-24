import { DSFilePerms, DSIDirectory, DSIDirectoryInvalidPathError } from "../../../dsFileSystem";
import { DSProcess, DSProcessError } from "../../../dsProcess";
import { DSOptionParser } from "../../../lib/dsOptionParser";

export class PRTouch extends DSProcess {

    protected async main(): Promise<void> {
        const optparser = new DSOptionParser(
            this.procname,
            true,
            "   create a blank text file",
            "<filename>, <directory>"
        );
        let nextarg = optparser.parseWithUsageAndHelp(this.argv);
        if (nextarg == -1)
            throw new DSProcessError(optparser.usage());

        let filename = this.argv[nextarg]
        let directory: DSIDirectory
        if (this.argv.length <= nextarg + 1) {
            directory = this.cwd

        }
        else {
            directory = this.cwd.getdir(this.argv[nextarg + 1]);

        }
        try {
            directory.getfile(filename)
            throw new DSProcessError("File already exists")
        }
        catch (DSIDirectoryInvalidPathError) { }

        if (!filename.includes('.')) {
            throw new DSProcessError("File type not specified");
        }

        directory.perms.checkWrite();
        let file = directory.fs.createInode()
        directory.addfile(filename, file);
        return;
    }
}