// Exceptions

import { DSStream } from "./dsStream";
import { getDirPath, getFileName } from "./lib/dsPath";

export class DSFileSystemError extends Error {
    constructor(message: string) {
        super(message);
        Object.setPrototypeOf(this, DSFileSystemError.prototype);
        this.name = this.constructor.name;
    }
}

export class DSFileSystemReadonlyError extends DSFileSystemError {
    constructor(action: string) {
        super(`cannot '${action}' on readonly filesystem`);
        Object.setPrototypeOf(this, DSFileSystemReadonlyError.prototype);
        this.name = this.constructor.name;
    }
}

// Inode errors

export class DSIFileError extends DSFileSystemError {
    constructor(message: string) {
        super(message);
        Object.setPrototypeOf(this, DSIFileError.prototype);
        this.name = this.constructor.name;
    }
}

export class DSIFileAlreadyExistsError extends DSIFileError {
    constructor(filename: string) {
        super(`file '${filename}' already exists`);
        Object.setPrototypeOf(this, DSIFileAlreadyExistsError.prototype);
        this.name = this.constructor.name;
    }
}

// Directory errors

export class DSIDirectoryError extends DSIFileError {
    constructor(message: string) {
        super(message);
        Object.setPrototypeOf(this, DSIDirectoryError.prototype);
        this.name = this.constructor.name;
    }
}

export class DSIDirectoryIllegalFilenameError extends DSIDirectoryError {
    constructor(filename: string) {
        super(`'${filename}' contains illegal characters`);
        Object.setPrototypeOf(this, DSIDirectoryIllegalFilenameError.prototype);
        this.name = this.constructor.name;
    }
}

export class DSIDirectoryInvalidPathError extends DSIDirectoryError {
    constructor(dirname: string) {
        super(`'${dirname}' is an invalid path`);
        Object.setPrototypeOf(this, DSIDirectoryInvalidPathError.prototype);
        this.name = this.constructor.name;
    }
}

export class DSIDirectoryAlreadyExistsError extends DSIDirectoryError {
    constructor(dirname: string) {
        super(`directory '${dirname}' already exists`);
        Object.setPrototypeOf(this, DSIDirectoryAlreadyExistsError.prototype);
        this.name = this.constructor.name;
    }
}

export class DSIDirectoryIllegalAddfileError extends DSIDirectoryError {
    constructor(reason: string) {
        super(`cannot add file: ${reason}`);
        Object.setPrototypeOf(this, DSIDirectoryIllegalAddfileError.prototype);
        this.name = this.constructor.name;
    }
}

// FilePerms errors

export class DSFilePermsError extends DSFileSystemError {
    constructor(message: string) {
        super(message);
        Object.setPrototypeOf(this, DSFilePermsError.prototype);
        this.name = this.constructor.name;
    }
}

export class DSFilePermsUnsupportedError extends DSFilePermsError {
    constructor(permissions: string) {
        super(`permissions '${permissions}' not supported on this filetype`);
        Object.setPrototypeOf(this, DSFilePermsUnsupportedError.prototype);
        this.name = this.constructor.name;
    }
}

export class DSFilePermsPermissionDeniedError extends DSFilePermsError {
    constructor(message: string) {
        super(message);
        Object.setPrototypeOf(this, DSFilePermsPermissionDeniedError.prototype);
        this.name = this.constructor.name;
    }
}

export class DSFilePermsReadError extends DSFilePermsPermissionDeniedError {
    constructor() {
        super(`cannot read file: Permission denied`);
        Object.setPrototypeOf(this, DSFilePermsReadError.prototype);
        this.name = this.constructor.name;
    }
}

export class DSFilePermsExecError extends DSFilePermsPermissionDeniedError {
    constructor() {
        super(`cannot exec file: Permission denied`);
        Object.setPrototypeOf(this, DSFilePermsExecError.prototype);
        this.name = this.constructor.name;
    }
}

export class DSFilePermsWriteError extends DSFilePermsPermissionDeniedError {
    constructor() {
        super(`cannot write file: Permission denied`);
        Object.setPrototypeOf(this, DSFilePermsWriteError.prototype);
        this.name = this.constructor.name;
    }
}

// Main classes
interface FSCKResults {
    inodecount: number;
    directorycount: number;
}

export abstract class DSFileSystem {
    protected _root: DSIDirectory;
    protected _readonly: boolean = false;

    get root(): DSIDirectory {
        return this._root;
    }

    protected constructor() { }

    abstract added(inode: DSInode): void;

    abstract changed(inode: DSInode): void;

    abstract createInode(): DSInode;

    fsck(): FSCKResults {
        const results: FSCKResults = {
            inodecount: 1,    // Include root directory
            directorycount: 1
        };
        this.root.checkDir(results);
        return results;
    }

    get readonly(): boolean {
        return this._readonly;
    }

    set readonly(readonly: boolean) {
        this._readonly = readonly;
    }
}


/*
    File Permission Meanings
    [Directories]
    r	Read:   List directory contents (ls).
    w	Write:  Create/delete files in the directory.
    x	Exec:   Traverse the directory (cd).
*/

export class DSFilePerms {
    constructor(
        private _r: boolean,
        private _w: boolean,
        private _x: boolean
    ) { }
    get r() { return this._r; }
    get w() { return this._w; }
    get x() { return this._x; }

    toJSON(): object {
        return {
            r: this._r,
            w: this._w,
            x: this._x,
        }
    }

    setFromJSON(perms: any) {
        this._r = perms.r;
        this._w = perms.w;
        this._x = perms.x;
    }

    permString(): string {
        let permstr = this.r ? 'r' : '-';
        permstr += this.w ? 'w' : '-';
        permstr += this.x ? 'x' : '-';
        return permstr;
    }

    checkRead() {
        if (!this._r)
            throw new DSFilePermsReadError();
    }

    checkWrite() {
        if (!this._w)
            throw new DSFilePermsWriteError();
    }

    checkExec() {
        if (!this._x)
            throw new DSFilePermsExecError();
    }

    static parsePermString(permstring: String): DSFilePerms {
        try {
            let r = permstring[0] == 'r';
            let w = permstring[1] == 'w';
            let x = permstring[2] == 'x';
            return new DSFilePerms(r, w, x);
        }
        catch (e) {
            throw new DSFilePermsError("Invalid permission string");
        }
    }

    // Factory method for readonly permissions
    static readonly(): DSFilePerms {
        return new DSFilePerms(true, false, false);
    }

    static execonly(): DSFilePerms {
        return new DSFilePerms(false, false, true);
    }

    // Factory method for read-execute permissions
    static rx(): DSFilePerms {
        return new DSFilePerms(true, false, true);
    }

    // Factory method for full permissions
    static full(): DSFilePerms {
        return new DSFilePerms(true, true, true);
    }

    // Factory method for no permissions
    static none(): DSFilePerms {
        return new DSFilePerms(false, false, false);
    }
}

export abstract class DSInode {
    id: number = undefined;

    get inodeType(): string {
        return undefined
    }

    protected constructor(
        protected _fs: DSFileSystem,
        private _perms: DSFilePerms
    ) { }

    toJSON(): object {
        return {
            id: this.id,
            type: this.inodeType,
            perms: this._perms.toJSON()
        };
    }

    protected setFromJSON(object: any) {
        this.id = object.id;
        this._perms.setFromJSON(object.perms);
    }

    get perms() {
        return this._perms;
    }

    get fs() {
        return this._fs;
    }

    contentAsText(): DSStream {
        throw new DSIFileError("operation not supported on filetype");
    }

    chmod(fileperms: DSFilePerms) {
        if (this._fs.readonly)
            throw new DSFileSystemReadonlyError('chmod');
        this._perms = fileperms;

        this.fs.changed(this); // DSIDBFS hook
    }
}

export class DSFileInfo {
    constructor(
        private _inode: DSInode,
        private _name: string,
    ) { }

    get inode(): DSInode {
        return this._inode;
    }

    set inode(inode: DSInode) {
        this._inode = inode
    }

    toJSON() {
        return {
            name: this._name,
            inodeid: this.inode.id
        }
    }

    get name() {
        return this._name;
    }
}

export class DSIDirectory extends DSInode {
    public parent: DSIDirectory;
    private _filelist: DSFileInfo[] = [];

    constructor(
        fs: DSFileSystem,
        perms: DSFilePerms,
        parent: (DSIDirectory | undefined) = undefined) {

        super(fs, perms);

        if (parent == undefined)
            this.parent = this;
        else
            this.parent = parent;
        // Add . and ..

        this._filelist.push(new DSFileInfo(this, "."));
        this._filelist.push(new DSFileInfo(this.parent, ".."));

        this._fs.added(this);  // DSIDBFS hook
    }

    setFromJSON(json: any): void {
        super.setFromJSON(json);
    }

    toJSON(): object {
        let filelist: { name: string; inodeid: number; }[] = [];
        this._filelist.forEach((fileinfo) => {
            // Skip special dirs '.' and '..'
            if ((fileinfo.name != '.') && (fileinfo.name != '..'))
                filelist.push(fileinfo.toJSON())
        });
        return Object.assign({
            filelist: filelist,
        }, super.toJSON());
    }

    checkDir(results: FSCKResults) {
        this._filelist.forEach((fileinfo) => {
            if (fileinfo.inode instanceof DSIDirectory) {
                if (fileinfo.inode.fs != this.fs) {
                    // SKIP: Don't leave the current filesystem
                } else if (fileinfo.name == '.') {
                    if (fileinfo.inode != this)
                        throw new DSFileSystemError("Bad '.' link");
                } else if (fileinfo.name == '..') {
                    if (fileinfo.inode != this.parent)
                        throw new DSFileSystemError("Bad '..' link");
                } else {
                    results.inodecount++;
                    results.directorycount++;
                    // Check .. link of child
                    const childdir: DSIDirectory = fileinfo.inode;
                    if (childdir.getfileinfo('..').inode != this)
                        throw new DSFileSystemError("Bad child '..' link");
                    // Now enter child
                    childdir.checkDir(results);
                }
            } else {
                results.inodecount++;
            }
        });
    }

    get fileinfo(): DSFileInfo {
        return this.parent.getfileinfo(this);
    }

    get inodeType() {
        return "DSIDirectory"
    }

    get filelist(): DSFileInfo[] {
        this.perms.checkRead();
        return this._filelist;
    }

    get path(): string {
        if (this == this.parent)
            return '/';
        let curdir: DSIDirectory = this;
        let path = "";
        while (curdir.parent != curdir) {
            // Find ourselves in the parent
            let curname = curdir.fileinfo.name;
            path = '/' + curname + path;
            curdir = curdir.parent;
        }
        return path;
    }

    get rootdir(): DSIDirectory {
        let curdir: DSIDirectory = this;
        while (curdir.parent != curdir) {
            curdir = curdir.parent;
        }
        return curdir;
    }

    getfile(path: string): DSInode {
        // Separate file from directory
        const sepIdx = path.lastIndexOf('/');
        let fileinfo: DSFileInfo;
        if (sepIdx == -1) {
            fileinfo = this.getfileinfo(path);
        } else {
            const filename = path.slice(sepIdx + 1);
            const dirname = path.slice(0, sepIdx);
            if (dirname == "") // Handle "/" root dir case
                fileinfo = this.getfileinfo(filename);
            else
                fileinfo = this.getdir(dirname).getfileinfo(filename);
        }
        if (!fileinfo)
            throw new DSIDirectoryInvalidPathError(path);
        return fileinfo.inode;
    }

    getdir(path: string): DSIDirectory {
        // Check empty root case
        if (/^\/+$/.test(path))
            return this.rootdir;

        const pathRegex = /[^/]+/g;
        const dirs = path.match(pathRegex);
        if (!dirs)
            throw new DSIDirectoryInvalidPathError(path);

        let curdir: DSIDirectory;
        if (path.startsWith('/'))
            curdir = this.rootdir;
        else
            curdir = this;
        for (let i = 0; i < dirs.length; i++) {
            // Check traversal permissions
            curdir.perms.checkExec();
            // Try to find the directory
            const dirname = dirs[i];
            const fileinfo = curdir.getfileinfo(dirname);
            if (!fileinfo)
                throw new DSIDirectoryInvalidPathError(path);
            if (!(fileinfo.inode instanceof DSIDirectory))
                throw new DSIDirectoryInvalidPathError(path);
            curdir = fileinfo.inode;
        }
        return curdir;
    }    

    // Overload signatures
    getfileinfo(name: string): DSFileInfo | undefined;
    getfileinfo(inode: DSInode): DSFileInfo | undefined;
    // Single implementation
    getfileinfo(identifier: string | DSInode): DSFileInfo | undefined {
        // TODO Check permissions
        if (typeof identifier === "string") {
            return this._filelist.find(file => file.name === identifier);
        } else {
            return this._filelist.find(file => file.inode === identifier);
        }
    }

    private _checkfilename(filename: string) {
        const badchars = "/";
        if (badchars.split('').some(char => filename.includes(char))) {
            throw new DSIDirectoryIllegalFilenameError(filename);
        }
    }
    // Hmmm, default full permissions is a bad smell
    mkdir(dirname: string, fileperms = DSFilePerms.full()): DSIDirectory {
        // TODO use getdir to handle traversal
        this._checkfilename(dirname);
        // Check permissions
        this.perms.checkWrite();
        if (this._fs.readonly)
            throw new DSFileSystemReadonlyError('mkdir');
        // Check for collision
        if (this.getfileinfo(dirname))
            throw new DSIDirectoryAlreadyExistsError(dirname);
        // Create new Directory
        const newdir = new DSIDirectory(this._fs, fileperms, this);
        this._filelist.push(
            new DSFileInfo(newdir, dirname)
        );
        this._fs.changed(this);  // DSIDBFS hook
        return newdir;
    }

    addfile(filename: string, newfile: DSInode) {
        // Check that this isn't a directory
        if (newfile instanceof DSIDirectory)
            throw new DSIDirectoryIllegalAddfileError("file is directory");
        // Check that the directory and file are in the same fs
        if (newfile.fs != this.fs)
            throw new DSIDirectoryIllegalAddfileError("filesystem mismatch");
        // Check for collision
        if (this.getfileinfo(filename))
            throw new DSIFileAlreadyExistsError(filename);
        // OK, add the file
        this._filelist.push(
            new DSFileInfo(newfile, filename)
        );
        this._fs.changed(this); //DSIDBFS hook
        return newfile;
    }
}

