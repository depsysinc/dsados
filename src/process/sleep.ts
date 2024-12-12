import { DSProcess, DSProcessError } from "../dsProcess";
import { DSOptionParser } from "../lib/dsOptionParser";
import { sleep } from "../lib/dsLib";

export class PRSleep extends DSProcess {

    protected async main(): Promise<void> {
        const optparser = new DSOptionParser(
            this.procname,
            true,
            "   sleep for <milliseconds> milliseconds",
            "<milliseconds>"
        );
        let nextarg = optparser.parseWithUsageAndHelp(this.argv);
        if (nextarg == -1)
            throw new DSProcessError(optparser.usage());
        
        let delay = Number(this.argv[nextarg]);
        if (isNaN(delay) || !Number.isInteger(delay) || delay <= 0)
            throw new DSProcessError(optparser.usage());
        await sleep(delay);
    }
}