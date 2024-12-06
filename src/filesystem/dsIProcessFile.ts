import { DSFilePerms, DSFileSystem, DSInode } from "../dsFileSystem"
import { DSProcess } from "../dsProcess"

export class DSIProcessFile extends DSInode {
    constructor(fs: DSFileSystem, private _process: DSProcess) {
        super(fs, DSFilePerms.execonly())
    }
}
