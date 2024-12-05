// Exceptions

export class DSFileSystemError extends Error {
    constructor(message: string) {
        super(message);
        this.name = this.constructor.name;
    }
}

export class DSFileSystemReadonlyError extends DSFileSystemError {
    constructor (action: string) {
        super(`cannot '${action}' on readonly filesystem`);
        this.name = this.constructor.name;
    }
}

export class DSIDirectoryError extends DSFileSystemError {
    constructor(message: string) {
        super(message);
        this.name = this.constructor.name;
    }
}

export class DSIDirectoryIllegalFilenameError extends DSIDirectoryError {
    constructor(filename: string) {
        super(`'${filename}' contains illegal characters`);
        this.name = this.constructor.name;
    }
}

export class DSIDirectoryInvalidPathError extends DSIDirectoryError {
    constructor(dirname: string) {
        super(`'${dirname}' is an invalid path`);
        this.name = this.constructor.name;
    }
}

export class DSIDirectoryAlreadyExistsError extends DSIDirectoryError {
    constructor(dirname: string) {
        super(`directory '${dirname}' already exists`);
        this.name = this.constructor.name;
    }
}

export class DSFilePermsPermissionDeniedError extends DSFileSystemError {
    constructor(message: string) {
        super(message);
        this.name = this.constructor.name;
    }
}

export class DSFilePermsReadError extends DSFilePermsPermissionDeniedError {
    constructor(dirname: string) {
        super(`cannot read '${dirname}': Permission denied`);
        this.name = this.constructor.name;
    }
}

export class DSFilePermsExecError extends DSFilePermsPermissionDeniedError {
    constructor(dirname: string) {
        super(`cannot exec '${dirname}': Permission denied`);
        this.name = this.constructor.name;
    }
}

export class DSFilePermsWriteError extends DSFilePermsPermissionDeniedError {
    constructor(dirname: string) {
        super(`cannot write '${dirname}': Permission denied`);
        this.name = this.constructor.name;
    }
}

// Main classes

export class DSFileSystem {
    private _root: DSIDirectory;
    private _readonly: boolean = false;

    get root(): DSIDirectory {
        return this._root;
    }

    constructor() {
        this._root = new DSIDirectory(this, DSFilePerms.full());
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

    // Factory method for readonly permissions
    static readonly(): DSFilePerms {
        return new DSFilePerms(true, false, false);
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

    protected constructor(
        protected _fs: DSFileSystem,
        private _perms: DSFilePerms) { }

    get perms() {
        return this._perms;
    }

    chmod(fileperms: DSFilePerms) {
        if (this._fs.readonly)
            throw new DSFileSystemReadonlyError('chmod');
        this._perms = fileperms;
    }
}

export class DSFileInfo {
    constructor(
        readonly inode: DSInode,
        private _name: string,
    ) { }

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

    }

    get fileinfo(): DSFileInfo {
        return this.parent.getfileinfo(this);
    }

    get filelist(): DSFileInfo[] {
        if (!this.perms.r)
            throw new DSFilePermsReadError(this.fileinfo.name);
        return this._filelist;
    }

    get path(): string {
        let curdir: DSIDirectory = this;
        if (curdir == this._fs.root)
            return '/';
        let path = "";
        while (curdir.parent != curdir) {
            // Find ourselves in the parent
            let curname = curdir.fileinfo.name;
            path = '/' + curname + path;
            curdir = curdir.parent;
        }
        return path;
    }

    getdir(path: string): DSIDirectory {
        // Check empty root case
        if (/^\/+$/.test(path))
            return this._fs.root;

        const pathRegex = /[^/]+/g;
        const dirs = path.match(pathRegex);
        if (!dirs)
            throw new DSIDirectoryInvalidPathError(path);

        let curdir: DSIDirectory = this;
        for (let i = 0; i < dirs.length; i++) {
            // Check traversal permissions
            if (!curdir.perms.x)
                throw new DSFilePermsExecError(path);
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
        if (!this.perms.w)
            throw new DSFilePermsWriteError(dirname);
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
        return newdir;
    }

}

export class DSIWebFile extends DSInode {
    // local filename
    // URL
}