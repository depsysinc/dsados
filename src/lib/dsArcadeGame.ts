import { DSKernel } from "../dsKernel";
import { DSApp, HistoryAppEvent, MouseButtonDownEvent, TextAppEvent } from "../lib/dsApp";
import { sleep } from "./dsLib";
import { DSOptionParser } from "./dsOptionParser";


export abstract class DSArcadeGame extends DSApp {

    protected playing: boolean = false;

    protected async main(): Promise<void> {

        const optparser = new DSOptionParser(
            this.procname,
            true,
            "   play a game of " + this.procname,
        );
        optparser.parseWithUsageAndHelp(this.argv);

        DSKernel.terminal.reset();


        while (!this.screenCorrectSize()) {
            DSKernel.terminal.reset();
            this.stdout.write("Resize your screen to play.");
            await sleep(50);
        }

        this.splash();

        while (!this.done) {
            await this.waitForGameStart();
            await this.createGame();
            this.playing = true;
            while (!this.done && this.playing) {
                await this.runFrame();
            }
        }
        console.log("exiting")
        sleep(10);
        DSKernel.terminal.reset();

        return;
    }

    override handleResize(): void {
        console.log("Handled")
        this.playing = false;
        if (!this.screenCorrectSize()) {
            DSKernel.terminal.reset();
            this.stdout.write("Resize your screen to play.");
        }
        else {
            this.splash();
        }
    }

    //Wait for the game to begin (on splash screen, usually)
    protected abstract waitForGameStart(): Promise<void>

    //Check if the screen is the proper size to play the game
    protected abstract screenCorrectSize(): boolean;

    //Display a static splash screen with the game's title + art
    protected abstract splash(): void;

    //Create all the objects + sprites needed for the game
    protected abstract createGame(): Promise<void>;

    //Run a frame
    protected abstract runFrame(): Promise<void>;
}