import { DSProcess, DSProcessError } from "../../../dsProcess";
import { DSOptionParser } from "../../../lib/dsOptionParser";

export class PRLs extends DSProcess {

    protected async main(): Promise<void> {
        const optparser = new DSOptionParser(
            this.procname,
            true,
            "   output contents of directory"
        );
        let nextarg = optparser.parseWithUsageAndHelp(this.argv);
        if (nextarg != -1)
            throw new DSProcessError(optparser.usage());
        
        // Get the file list
        let fileliststr = "";

        this.cwd.filelist.forEach((fileinfo) => {
            fileliststr += fileinfo.inode.perms.permString();
            fileliststr += `  ${fileinfo.name}\n`;
        })
        this.stdout.write(fileliststr);
        return; 
    }

}