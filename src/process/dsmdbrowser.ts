import { DSKernel } from "../dsKernel";
import { DSProcess, DSProcessError } from "../dsProcess";
import { DSOptionParser } from "../lib/dsOptionParser";

abstract class MDBlock {
    parseline(line: string): void {
    }
}

class RootBlock extends MDBlock {
}

export class PRDSMDBrowser extends DSProcess {

    protected async main(): Promise<void> {
        const optparser = new DSOptionParser(
            this.procname,
            true,
            "   a markdown browser",
            "<mdfile>"
        );
        let nextarg = optparser.parseWithUsageAndHelp(this.argv);
        if (nextarg == -1)
            throw new DSProcessError(optparser.usage());

        let filename = this.argv[nextarg];
        try {
            const inode = this.cwd.getfile(filename);
            const text = await inode.contentAsText().read();
            const page = this.parse(text);
        } catch (e) {
            throw new DSProcessError(`'${filename}' not found\n`);
        }
        while (true) {
            await this.stdin.read();
            DSKernel.terminal.xterm.scrollToTop();
        }
    }

    parse(text: string) {
        // Break text up into blocks
        const lines = text.split('\n');
        let rootblock: RootBlock;

        lines.forEach((line, index) => {
            console.log(`${index}: ${line}`);
            // Check if this is the beginning of a new block
        });
    }
}