import { DSFileInfo, DSFilePerms, DSFileSystem, DSFileSystemError, DSIDirectory, DSInode } from "../dsFileSystem";

export class DSIDBFileSystemError extends DSFileSystemError {
    constructor(message: string) {
        super(message);
        this.name = this.constructor.name;
    }
}

interface SerializedDirectory {
    id: number;
    type: string;
    filelist: {name: string, inodeid: number}[];
}

function isSerializedDirectory(obj: any): obj is SerializedDirectory {
    return obj && typeof obj.id !== undefined && obj.type === "DSIDirectory";
}

export class DSIDBFileSystem extends DSFileSystem {
    private _db: IDBDatabase;
    private _oldVersion: number;
    private _opening: boolean = false;
    private _nextid: number = 1; // For new database case

    constructor(readonly dbname: string, readonly dbversion: number) {
        super();
    }

    added(inode: DSInode): void {
        if (!this._db)
            throw new DSIDBFileSystemError("IndexDB not open");
        // Check that we're not in opening phase
        // but let the root directory creation pass through
        if (this._opening && this._oldVersion > 0) {
            return;
        }
        inode.id = this._nextid++;

        const transaction = this._db.transaction("inodes", "readwrite");
        const store = transaction.objectStore("inodes");

        //console.log("ADDED:", inode.toJSON());
        const request = store.add(inode.toJSON());

        request.onsuccess = (event) => {
            // Nothing to do
        }

        request.onerror = (event) => {
            throw new DSIDBFileSystemError(`DSIDBFileSystem.added error: ${event}`);
        }
    }

    changed(inode: DSInode): void {
        if (!this._db)
            throw new DSIDBFileSystemError("IndexDB not open");
        const transaction = this._db.transaction("inodes", "readwrite");
        const store = transaction.objectStore("inodes");

        // console.log("CHANGED:", inode.toJSON());
        const request = store.put(inode.toJSON());

        request.onsuccess = (event) => {
            // Nothing to do
        }
        request.onerror = (event) => {
            throw new DSIDBFileSystemError(`DSIDBFileSystem.changed error: ${event}`);
        }
    }

    async open() {
        if (this._db)
            throw new DSIDBFileSystemError("IndexDB already open");
        this._opening = true;
        await new Promise<void>((resolve, reject) => {
            const request = indexedDB.open(this.dbname, this.dbversion);
            // On database upgrade or first-time creation
            this._oldVersion = this.dbversion;
            request.onupgradeneeded = (event) => {
                const db = this._db = (event.target as IDBRequest).result;
                this._oldVersion = event.oldVersion;
                if (this._oldVersion < 1) { // New database
                    // Create inode table
                    db.createObjectStore('inodes', { keyPath: 'id' });
                    // Create contents table
                    db.createObjectStore('contents', { keyPath: 'id' });
                }
            };
            request.onerror = (event) => {
                reject(new DSIDBFileSystemError("IDB error: " + (event.target as IDBRequest).error));
            };
            request.onsuccess = (event) => {
                this._db = (event.target as IDBRequest).result;
                resolve();
            };
        });
        if (this._oldVersion < 1) { // New database
            this._root = new DSIDirectory(this, DSFilePerms.full());
        } else {
            // Load in all the inodes into an ID hash map
            let inodemap = new Map<any, object>();
            await new Promise<void>((resolve, reject) => {
                const transaction = this._db.transaction("inodes", "readonly");
                const store = transaction.objectStore("inodes");
                const request = store.openCursor();
                request.onsuccess = (event) => {
                    const cursor = (event.target as IDBRequest).result;
                    if (cursor) {
                        inodemap.set(cursor.key, cursor.value);
                        if (this._nextid <= cursor.key)
                            this._nextid = cursor.key + 1;
                        cursor.continue();
                    } else {
                        resolve();
                    }
                }
                request.onerror = (event) => {
                    reject(new DSIDBFileSystemError("IDB error: " + (event.target as IDBRequest).error));
                }
            });
            // Start with root (id 1) and assemble the fs
            this._root = this._deserialize(inodemap, 1) as DSIDirectory;
        }
        this._opening = false;
    }

    static async delete(dbName: string) {
        return new Promise<void>((resolve, reject)=> {
            const request = indexedDB.deleteDatabase(dbName);

            request.onsuccess = () => { resolve(); }
            request.onerror = () => { reject(request.error); }
            request.onblocked = () => { reject("database delete blocked (do you have open tabs?)"); }
        });
    }

    private _deserialize(
        inodemap: Map<any, object>,
        id: any,
        parent: DSIDirectory | undefined = undefined
    ): DSInode {
        // look up inode
        const inodeobj = inodemap.get(id);
        if (isSerializedDirectory(inodeobj)) {
            const dir = new DSIDirectory(this, DSFilePerms.full(), parent);
            dir.setFromJSON(inodeobj);
            // Go through files
            const filelist = inodeobj.filelist;
            filelist.forEach((fileinfoobj) => {
                dir.filelist.push(new DSFileInfo(
                    this._deserialize(inodemap, fileinfoobj.inodeid, dir),
                    fileinfoobj.name
                ));
            });
            return dir;
        } else {
            throw new DSIDBFileSystemError(`Unknown inode ${inodeobj}`);
        }
    }
}