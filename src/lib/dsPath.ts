import { DSIDirectory } from "../dsFileSystem";

export function getDirPath(filepath: string): string {
    if (filepath.lastIndexOf('/') != -1) {
        return filepath.slice(0, filepath.lastIndexOf('/'));
    }
    else {
        return '.'
    }
}

export function getFileName(filepath: string): string {
        if (filepath.lastIndexOf('/') != -1) {
            return filepath.slice(filepath.lastIndexOf('/') + 1);
        }
        else {
            return filepath
        }
    }

export function getAbsolutePath(localdir:DSIDirectory, path: string) {
        const dirpath = getDirPath(path);
        const globaldirpath = localdir.getdir(dirpath).path;
        const filename = getFileName(path);
        
        if (globaldirpath == '/') {
            return '/' + filename;
        }
        return globaldirpath + '/' + filename;
    }

    export function getFileType(path:string) {
        if (!path.includes(".")) {
            return "directory"
        }
        else {
            let split = path.split(".");
            return split[split.length-1];
        }
    }