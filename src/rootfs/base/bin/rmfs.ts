import { DSFileSystem } from "../../../dsFileSystem";
import { DSKernel } from "../../../dsKernel";
import { DSProcess, DSProcessError } from "../../../dsProcess";
import { DSIDBFileSystem } from "../../../filesystem/dsIDBFileSystem";
import { DSOptionParser } from "../../../lib/dsOptionParser";

export class PRRMFS extends DSProcess {

    protected async main(): Promise<void> {
        const optparser = new DSOptionParser(
            this.procname,
            true,
            "   Delete a (local) filesystem",
            "<mountpoint>"
        );

        optparser.addoption({
            long: "mountpoint",
            short: "m",
            required: false,
            takesArgument: true,
            argName: "",
            description: "delete the filesystem at the given mountpoint; for use if already mounted"
        });
        optparser.addoption({
            long: "fsname",
            short: "n",
            required: false,
            takesArgument: true,
            argName: "",
            description: "delete the filesystem with the given name; for use if not yet mounted"
        });



        let nextarg = optparser.parseWithUsageAndHelp(this.argv);
        if (nextarg != -1)
            throw new DSProcessError(optparser.usage());

        const fsname = optparser.getLongOption('fsname').argument;
        const mountpoint = optparser.getLongOption('mountpoint').argument;

        if ((fsname != '' && mountpoint != '')) {
            throw new DSProcessError("both filesystem name or mount point provided");
        }

        let nametodelete = '';

        if (mountpoint != '') {
            const mountdir = this.cwd.getdir(mountpoint);
            const fs = mountdir.fs;

            //Delete the mountdir; there isn't a delete command for directories
            for (let i = 1; i < mountdir.parent.filelist.length; i++) {
                if (mountdir.parent.filelist[i].inode == mountdir) {
                    mountdir.parent.filelist.splice(i, 1);
                    return;
                }
            }

            if (mountdir != fs.root) {
                throw new DSProcessError("mountpoint must be root of filesystem");
            }

            if (!(fs instanceof DSIDBFileSystem))
                throw new DSProcessError("non-DSIDB filesystem cannot be deleted")
            else {
                nametodelete = fs.dbname
            }
        }
        else if (fsname != '') {
            //Alternatively, just find the mountpoint and delete it, same as before
            DSKernel.fstable.forEach(mountedfs => {
                if (mountedfs.fs instanceof DSIDBFileSystem && mountedfs.fs.dbname == fsname) {
                    throw new DSProcessError("Cannot delete already mounted fs with the -fsname argument")
                }
            })
            nametodelete = fsname;
        }

        try {
            await DSIDBFileSystem.delete(nametodelete);
        }
        catch (e) {
            //These errors seem to pop up no matter what + don't affect whether it deletes, so ignore them?
            if (e == "database delete blocked (do you have open tabs?)") { }
            else { throw e }
        }



    }
}