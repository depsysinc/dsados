import { DSApp } from "../dsApp";
import { DSKernel } from "../dsKernel";
import { sleep } from "./dsLib";

import { DSOptionParser } from "./dsOptionParser";


export abstract class DSArcadeGame extends DSApp {

    protected playing: boolean = false;

    private fromresize: boolean = false;

    protected async main(): Promise<void> {

        const optparser = new DSOptionParser(
            this.procname,
            true,
            "   play a game of " + this.procname,
        );
        optparser.parseWithUsageAndHelp(this.argv);

        DSKernel.terminal.reset();

        await this.awaitScreenCorrectSize();

        await this.splash();

        console.log("Initializing game");

        while (!this.done) {
            await this.awaitScreenCorrectSize();
            this.fromresize = false;


            await this.waitForLevelStart();
            if (this.done || this.fromresize) {
                continue;
            }
            await this.createGame();

            this.playing = true;
            while (!this.done && this.playing) {
                await this.runFrame();
            }

            if (!this.fromresize && !this.done) {
                await this.onLevelEnd();
            }
        }
        //Sleep to give any async things a chance to finish so they don't appear after exiting
        sleep(10);
        DSKernel.terminal.reset();

        return;
    }

    override handleResize(): void {
        this.playing = false;
        this.fromresize = true;

        if (!this.screenCorrectSize()) {
            DSKernel.terminal.reset();
            this.stdout.write("Resize your screen to play.");
        }
        else {
            this.splash();
        }
    }

    async awaitScreenCorrectSize() {
        if (!this.screenCorrectSize()) {
            DSKernel.terminal.reset();
            this.stdout.write("Resize your screen to play.");

            while (!this.screenCorrectSize()) {
                await sleep(50);
            }
        }


    }

    //Display a static splash screen with the game's title + art
    protected abstract splash(): Promise<void>;

    //Create all the objects + sprites needed for the game
    protected abstract createGame(): Promise<void>;

    //Run a frame
    protected abstract runFrame(): Promise<void>;

    //Check if the screen is the proper size to play the game
    protected abstract screenCorrectSize(): boolean;

    //Wait for the game to begin (on splash screen, usually)
    protected async waitForLevelStart(): Promise<void> {
        while (true) {
            let txt = (await this.stdin.read()).toLowerCase();
            if (txt == 'q' || txt == 'n') {
                this.done = true;
                return
            }
            if (txt == 'y') {
                return
            }
        }
    }

    //Run when the game ends, display scores or the like
    protected async onLevelEnd(): Promise<void> { }
}