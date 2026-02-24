import { DSRAMFileSystem } from "../../../filesystem/dsRAMFileSystem";
import { DSKernel } from "../../../dsKernel";
import { DSProcess, DSProcessError } from "../../../dsProcess";
import { DSIDBFileSystem } from "../../../filesystem/dsIDBFileSystem";
import { DSOptionParser } from "../../../lib/dsOptionParser";


export class PRMount extends DSProcess {

    protected async main(): Promise<void> {
        const optparser = new DSOptionParser(
            this.procname,
            true,
            "   mount a filesystem",
            "<type> <name> <mountpoint>"
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
                    mode = 'ro'
                }
                else {
                    mode = 'rw'
                }
                path = fsinfo.mount.path;
                let string = fsname + ' on ' + path +' of type '+ type + ' ('+mode+')';
                this.stdout.write(string + '\n');

            })
        }
        else {
            if (this.argv.length != 4) {
                throw new DSProcessError(optparser.usage())
            }
            const type = this.argv[nextarg]
            const name = this.argv[nextarg+1]
            const mountpoint = this.argv[nextarg+2]
            if ((type.toLowerCase()) != 'dsidbfs') {
                throw new DSProcessError('Invalid filesystem type')
            }
            let fs = new DSIDBFileSystem(name, 1);
            await fs.open();
            DSKernel.mount(mountpoint, fs)
        }
    }
}