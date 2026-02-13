import { DSInode, DSFileSystem, DSFilePerms, DSFilePermsUnsupportedError } from "../dsFileSystem";
import { DSStream } from "../dsStream";

export class DSIDBFile extends DSInode {

    private _text: string = "";

    constructor(fs: DSFileSystem) {
        super(fs, DSFilePerms.full());
        this.fs.added(this);
    }

    get inodeType(): string {
        return "DSIDBFile"
    }

    contentAsText(): DSStream {
        this.perms.checkRead();
        const outstream = new DSStream();
        outstream.write(this._text)
        return outstream;

    }

    toJSON(): object {
        return {
            id: this.id,
            type: this.inodeType,
            perms: this.perms,
            text: this._text,
        }
    }
    protected setFromJSON(object: any) {
        super.setFromJSON(object);
        if (object.text) {
            this._text = object.text
        }

    }

    write(text:string, update_fs:boolean = true) {
        this.perms.checkWrite()
        this._text = text;
        if (update_fs) {
            this.fs.changed(this);
        }
    }

    append(text:string) {
        this.write(this._text+text)
    }

}
