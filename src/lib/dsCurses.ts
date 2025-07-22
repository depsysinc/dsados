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
    fg_default: '39',

    bg_black: '40',
    bg_red: '41',
    bg_green: '42',
    bg_yellow: '43',
    bg_blue: '44',
    bg_magenta: '45',
    bg_cyan: '46',
    bg_white: '47',
    bg_default: '49'
}

export function set_cursor(visible: boolean): string {
    if (visible)
        return ("\x1b[?25h");
    else
        return ("\x1b[?25l");
}

export function reset(): string {
    return ("\x1bc");     // RESET
}
export function gotoxy(x: number, y: number): string {
    return (`\x1b[${y};${x}H`);
}

export function scrolldown(rows: number): string {
    return (`\x1b[${rows}T`);
}

export function scrollup(rows: number): string {
    return (`\x1b[${rows}S`);
}

export function setattr(attr: string): string {
    return (`\x1b[${attr}m`);
}

export const up = '\x1b[A'
export const down = '\x1b[B'
export const right = '\x1b[C'
export const left = '\x1b[D'

export function cursorup(rows: number): string {
    return (`\x1b[${rows}A`)
}
export function cursordown(rows: number): string {
    return (`\x1b[${rows}B`)
}
export function cursorright(cols: number): string {
    return (`\x1b[${cols}C`)
}
export function cursorleft(cols: number): string {
    return (`\x1b[${cols}D`)
}
export function cursornextline(): string {
    return (`\x1b[E`)
}

