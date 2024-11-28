import { DSKernel } from "./dsKernel"

// Exceptions

export class DSFilesystemError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "DSFilesystemError";
    }
}

export class DSIDirectoryError extends DSFilesystemError {
    constructor(message: string) {
        super(message);
        this.name = "DSIDirectoryError";
    }
}

export class DSIDirectoryAlreadyExistsError extends DSIDirectoryError {
    constructor(dirname: string) {
        super(`directory '${dirname}' already exists.`);
        this.name = "DirectoryAlreadyExistsError";
    }
}

// Main classes

export class DSFilesystem {
    private _root: DSIDirectory;

    get root(): DSIDirectory {
        return this._root;
    }

    constructor() {
        this._root = new DSIDirectory(this);
    }
}

export abstract class DSInode {
    protected constructor(protected _fs: DSFilesystem) { }
}

export class DSFileInfo {
    constructor(
        readonly inode: DSInode,
        public name: string,
    ) { }
}

export class DSIDirectory extends DSInode {
    public parent: DSIDirectory;
    public filelist: DSFileInfo[] = [];

    constructor(_fs: DSFilesystem, parent: (DSIDirectory | undefined) = undefined) {
        super(_fs);
        if (parent == undefined)
            this.parent = this;
        else
            this.parent = parent;
        // Add . and ..
        this.filelist.push(new DSFileInfo(this, "."));
        this.filelist.push(new DSFileInfo(this.parent, ".."));
    }

    get path(): string {
        let curdir: DSIDirectory = this;
        let path = "";
        while (curdir.parent != curdir) {
            // Find ourselves in the parent
            let curname = curdir.parent.getfileinfo(curdir).name;
            path = curname + '/' + path;
            curdir = curdir.parent;
        }
        path = '/' + path;
        return path;
    }

    // Overload signatures
    getfileinfo(name: string): DSFileInfo | undefined;
    getfileinfo(inode: DSInode): DSFileInfo | undefined;
    // Single implementation
    getfileinfo(identifier: string | DSInode): DSFileInfo | undefined {
        if (typeof identifier === "string") {
            return this.filelist.find(file => file.name === identifier);
        } else {
            console.log(this);
            return this.filelist.find(file => file.inode === identifier);
        }
    }

    mkdir(dirname: string): DSIDirectory {
        // Check for collision
        if (this.getfileinfo(dirname))
            throw new DSIDirectoryAlreadyExistsError(dirname);
        // Create new Directory
        const newdir = new DSIDirectory(this._fs, this);
        this.filelist.push(
            new DSFileInfo(
                newdir,
                dirname
            )
        );
        return newdir;
    }

}