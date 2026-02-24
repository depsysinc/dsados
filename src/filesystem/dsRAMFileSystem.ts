import {  DSFilePerms, DSFileSystem, DSIDirectory, DSInode } from "../dsFileSystem";
import { DSIWebFile } from "./dsIWebFile";


export class DSRAMFileSystem extends DSFileSystem {
    constructor() {
        super();
        this._root = new DSIDirectory(this, DSFilePerms.full());
    }

    added(inode: DSInode) { }
    changed(inode: DSInode): void { }

    createInode(url?:string): DSInode {
        const inode = new DSIWebFile(this,url ? url : "")
        return inode
    }
}
