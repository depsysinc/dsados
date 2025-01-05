import { DSInode, DSFileSystem, DSFilePerms, DSFilePermsUnsupportedError } from "../dsFileSystem";
import { DSStream } from "../dsStream";

export class DSIWebFile extends DSInode {
    private _filetype: string;
    private _lasterror: string;

    constructor(fs: DSFileSystem, readonly url: string) {
        super(fs, DSFilePerms.readonly());
    }

    get lasterror(): string {
        return this._lasterror;
    }

    async filetype(): Promise<string> {
        // If we don't have the filetype look it up
        if (this._filetype == undefined) {
            try {
                const response = await fetch(this.url, { method: 'HEAD' });
                if (!response.ok) {
                    throw new Error(`HTTP status ${response.status}`);
                } else {
                    this._filetype = response.headers.get('Content-Type') || "null";
                }
            } catch (e) {
                if (e.cause)
                    e = e.cause;
                this._lasterror = `${e.name} : ${e.message}`;

                this._filetype = "null";
            }
        }
        // return it
        return this._filetype;
    }

    contentAsText(): DSStream {
        this.perms.checkRead();
        const outstream = new DSStream();
        fetch(this.url).then(
            (response) => {
                if (!response.ok)
                    throw new Error(`HTTP status ${response.status}`);
                response.text().then(
                    (text) => { 
                        outstream.write(text);
                        outstream.close();
                     }
                );

            }, (reason) => { 
                // TODO: throw an error instead
                outstream.close();
            })
        return outstream;
    }

    chmod(newperms: DSFilePerms) {
        // Check for illegal permissions
        if (newperms.w || newperms.x)
            throw new DSFilePermsUnsupportedError(newperms.permString());
        super.chmod(newperms);
    }
}
