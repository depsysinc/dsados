import { DSFilePerms, DSInode } from "../dsFileSystem";
import { DSKernel } from "../dsKernel";
import { DSProcess } from "../dsProcess";
import { DSIDBFileSystem } from "../filesystem/dsIDBFileSystem";
import { DSIWebFile } from "../filesystem/dsIWebFile";
import { reset } from "../lib/dsCurses";
import { sleep } from "../lib/dsLib";

export class FileWritingTests extends DSProcess {

    protected async main(): Promise<void> {
        try {
        this.stdout.write(reset());
        this.p("File writing test go!");
        console.log("File writing test go!");

        const localfs = new DSIDBFileSystem("little_test_filesystem", 1);
        await localfs.open();



        this.p(`mount: localfs`)
        DSKernel.mount('/local', localfs);
        this.p(`\nfsck: localfs\n`)

        let file = new DSIWebFile(localfs, "");
        localfs.root.addfile('iexist',file);
        file.id = 0;
        file.chmod(DSFilePerms.full())
        this.p(await file.filetype());
        this.p(await file.contentAsText().read());
        
        console.log(localfs.root.getfile("iexist"));

        let fsckresults = localfs.fsck();
        this.p(` scanned ${fsckresults.inodecount} inodes, ${fsckresults.directorycount} dirs`);

        }
        catch (e) {
            console.log(e);
        }

        await sleep(100000);
        return;
    }

    private p(message: any) {
        this.stdout.write(message + '\n');
    }
}