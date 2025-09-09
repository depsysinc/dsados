
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

