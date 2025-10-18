import { DSRAMFileSystem } from "../dsFileSystem";
import { DSKernel } from "../dsKernel";
import { DSProcess, DSProcessError } from "../dsProcess";
import { DSIDBFileSystem } from "../filesystem/dsIDBFileSystem";
import { DSOptionParser } from "../lib/dsOptionParser";


export class PRMount extends DSProcess {

    protected async main(): Promise<void> {
        const optparser = new DSOptionParser(
            this.procname,
            true,
            "   mount a filesystem",
            "<path> <fs>"
        );
        let nextarg = optparser.parseWithUsageAndHelp(this.argv);
        if (nextarg == -1) {
            let fsname = ""; let path = ""; let type = ""; let mode = "";

            DSKernel.fstable.forEach(fsinfo => {
                if (fsinfo.fs instanceof DSRAMFileSystem) {
                    fsname = 'dsramfs';
                    type = 'DSRAM Filesystem';
                }
                else if (fsinfo.fs instanceof DSIDBFileSystem) {
                    fsname = fsinfo.fs.dbname;
                    type = 'DSIDB Filesystem'
                }
                if (fsinfo.fs.readonly) {
                    mode = 'rw'
                }
                else {
                    mode = 'ro'
                }
                path = fsinfo.mount.path;
                let string = fsname + ' on ' + path +' of type '+ type + ' ('+mode+')';
                this.stdout.write(string + '\n');

            })
        }
        else {
            throw new DSProcessError('Not implemented')
        }


    }
}