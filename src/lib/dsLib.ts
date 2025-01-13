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

export async function load_image(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.src = url;

        img.onload = () => resolve(img);
        img.onerror = (error) => reject(error);
    });
}