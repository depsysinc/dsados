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
            ""
        );
        let nextarg = optparser.parseWithUsageAndHelp(this.argv);
        if (nextarg == -1) {
            let fsname = ""; let path = ""; let type = "";

            DSKernel.fstable.forEach(fsinfo => {
                if (fsinfo.fs instanceof DSRAMFileSystem) {
                    fsname = 'dsramfs';
                    type = 'Depsys RAM FileSystem';
                }
                else if (fsinfo.fs instanceof DSIDBFileSystem) {
                    fsname = fsinfo.fs.dbname;
                    type = 'Depsys IDB FileSystem'
                }
                path = fsinfo.mount.path;
                let string = fsname + ' at ' + path +' of type '+ type;
                this.stdout.write(string + '\n');

            })
        }
        else {
            throw new DSProcessError('Not implemented')
        }


    }
}