import { DSProcess, DSProcessError } from "../../../dsProcess";
import { DSOptionParser } from "../../../lib/dsOptionParser";
import { getDirPath } from "../../../lib/dsPath";

export class PRDel extends DSProcess {

    protected async main(): Promise<void> {
        const optparser = new DSOptionParser(
            this.procname,
            true,
            "   delete a file or directory",
            "<filename>"
        );
        let nextarg = optparser.parseWithUsageAndHelp(this.argv);
        if (nextarg == -1)
            throw new DSProcessError(optparser.usage());

        let inode; let parentdir;
        let filename = this.argv[nextarg];

        try {
            inode = this.cwd.getfile(filename);
        } catch (e) {
            try {
                inode = this.cwd.getdir(filename);
            }
            catch (e) {
                throw new DSProcessError(`'${filename}' not found\n`);
            }
        }

        parentdir = this.cwd.getdir(getDirPath(filename));

        inode.perms.checkWrite();

        //Start at i=2 to avoid deleting . and ..
        for (let i = 2; i < parentdir.filelist.length; i++) {
            if (parentdir.filelist[i].inode == inode) {
                parentdir.filelist.splice(i, 1);
                return;
            }
        }
        throw new DSProcessError("cannot delete "+filename);
    }

}