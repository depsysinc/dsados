import { DSFilePerms } from "../dsFileSystem";
import { DSProcess, DSProcessError } from "../dsProcess";
import { DSOptionParser } from "../lib/dsOptionParser";

export class PRCHMod extends DSProcess {

    protected async main(): Promise<void> {
        const optparser = new DSOptionParser(
            this.procname,
            true,
            "   change permissions of a file",
            "<filename> <perms>"
        );
        let nextarg = optparser.parseWithUsageAndHelp(this.argv);
        if (nextarg == -1)
            throw new DSProcessError(optparser.usage());

        let filename = this.argv[nextarg]; 
        //Todo - use the optparser to find this
        let filepermsstring = this.argv[nextarg+1];

        let inode;

        try {
            inode = this.cwd.getfile(filename);}
        catch (e) {
            throw new DSProcessError(`'${filename}' not found\n`);
        }
        let fileperms = DSFilePerms.parsePermString(filepermsstring);

        inode.chmod(fileperms)
        return;
    }
}