import { DSStream } from "../dsStream";

/* Super poor man's terminal control sequence support.
 * Shouldn't really be called curses but whatever.
 * TODO: Need to save existing settings and restore
 * rather than assuming
 */

export const textattrs = {
    reset: '0',
    bold: '1',
    dim: '2',
    normal: '22',

    italic: '3',
    noitalic: '23',

    underline: '4',
    doubleunderline: '4:2',
    curlyunderline: '4:3',
    dottedunderline: '4:4',
    dashedunderline: '4:5',
    nounderline: '24',

    inverted: '7',
    noninverted: '27',

    fg_black: '30',
    fg_red: '31',
    fg_green: '32',
    fg_yellow: '33',
    fg_blue: '34',
    fg_magenta: '35',
    fg_cyan: '36',
    fg_white: '37',

    bg_black: '40', 
    bg_red: '41', 
    bg_green: '42', 
    bg_yellow: '43', 
    bg_blue: '44', 
    bg_magenta: '45', 
    bg_cyan: '46', 
    bg_white: '47', 
}

export function set_cursor(stdout: DSStream, visible: boolean) {
    const w = (str: string) => { stdout.write(str); };
    if (visible)
        w("\x1b[?25h");
    else
        w("\x1b[?25l");
}

export function reset(stdout: DSStream) {
    const w = (str: string) => { stdout.write(str); };
    w("\x1bc");     // RESET
}
export function gotoxy(stdout: DSStream, x: number, y: number) {
    const w = (str: string) => { stdout.write(str); };
    w(`\x1b[${y};${x}H`);
}

export function scrolldown(stdout: DSStream, rows: number) {
    const w = (str: string) => { stdout.write(str); };
    w(`\x1b[${rows}T`);
}

export function scrollup(stdout: DSStream, rows: number) {
    const w = (str: string) => { stdout.write(str); };
    w(`\x1b[${rows}S`);
}

export function setattr(stdout: DSStream, attr: string) {
    const w = (str: string) => { stdout.write(str); };
        w(`\x1b[${attr}m`);
}
