import { DSFilePerms, DSIDirectory } from "../../../dsFileSystem";
import { DSProcess, DSProcessError } from "../../../dsProcess";
import { DSIDBFile } from "../../../filesystem/dsIDBFile";
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
            directory = this.cwd.getdir(this.argv[nextarg+1]);

        }
        //Add checks for - valid filename, no overlap
        directory.perms.checkWrite();
        //Parameterize filetype at some point?
        let file = directory.fs.createInode()
        directory.addfile(filename+'.txt',file);
        return;
    }
}