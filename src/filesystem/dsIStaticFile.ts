import { DSFilePerms, DSFileSystem, DSInode } from "../dsFileSystem";
import { DSStream } from "../dsStream";

export abstract class DSIStaticFile extends DSInode {
    protected constructor(fs: DSFileSystem) {
        super(fs, DSFilePerms.readonly());
    }
}

export class DSIStaticTextFile extends DSIStaticFile {
    constructor(fs: DSFileSystem, readonly content: string) {
        super(fs);
    }

    async filetype(): Promise<string> {
        return "text";
    }

    contentAsText(): DSStream {
        const outstream = new DSStream();
        outstream.write(this.content);
        outstream.close();
        
        return outstream;
    }
}