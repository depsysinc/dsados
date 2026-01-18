import { DSKernel } from "../../../dsKernel";
import { DSProcess } from "../../../dsProcess";
import { DSApp } from "../../../lib/dsApp";
import { sleep } from "../../../lib/dsLib";



export class DSAppBaseProcess extends DSProcess {

    public done = false;
    protected async main(): Promise<void> {
        while (true) {
            
            let state = history.state
            if (state == DSApp.firsthistorystate) {
                history.back(); //Exit application, because defaulthistorystate must be the first state
                break;
            }
            console.log('Exectuing', state.process)
            await DSKernel.exec('/bin/' + state.process, [state.process, state.filepath]);
            console.log("done exec",DSKernel.procstack);

            await sleep(50);
        }

        return;
    }
}
