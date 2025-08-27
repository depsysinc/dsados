import {
    DSFilePerms,
    DSFilePermsPermissionDeniedError,
    DSFileSystem,
    DSIDirectory,
    DSInode
} from "../dsFileSystem"
import { DSProcess } from "../dsProcess"
import { DSStream } from "../dsStream";

export class DSIProcessFile<T extends DSProcess> extends DSInode {
    constructor(
        fs: DSFileSystem,
        private _processClass: new (
            pid: number,
            ppid: number,
            _cwd: DSIDirectory,
            argv: string[],
            envp: Record<string, string>,
            stdin: DSStream,
            stdout: DSStream
        ) => T
    ) {
        super(fs, DSFilePerms.execonly())
    }

    get inodeType(): string {
        return "DSProcessFile"
    }

    getProcessClass() {
        return this._processClass;
    }

    async filetype(): Promise<string> {
        return 'program';
    }

    chmod(fileperms: DSFilePerms) {
        throw new DSFilePermsPermissionDeniedError("operation not supported on filetype");
    }
}
