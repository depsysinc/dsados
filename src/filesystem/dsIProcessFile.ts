import {
    DSFilePerms,
    DSFilePermsPermissionDeniedError,
    DSFileSystem,
    DSIDirectory,
    DSInode
} from "../dsFileSystem"
import { DSProcess } from "../dsProcess"

export class DSIProcessFile<T extends DSProcess> extends DSInode {
    constructor(
        fs: DSFileSystem,
        private _processClass: new (
            pid: number,
            ppid: number,
            _cwd: DSIDirectory,
            argv: string[],
            envp: Record<string, string>
        ) => T
    ) {
        super(fs, DSFilePerms.execonly())
    }

    getProcessClass() {
        return this._processClass;
    }

    chmod(fileperms: DSFilePerms) {
        throw new DSFilePermsPermissionDeniedError("operation not supported on filetype");
    }
}
