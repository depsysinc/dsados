export function sleep(delay: number) {
    return new Promise((resolve) => setTimeout(resolve, delay));
}

export function nvram_set(key: string, value: string) {
    localStorage.setItem(key, value);
}

export function nvram_get(key: string): string | null {
    return localStorage.getItem(key);
}

export function nvram_clear() {
    localStorage.clear();
}