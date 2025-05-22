
export type DSTexture = {
    image: HTMLImageElement | VideoFrame;
    width: number;
    height: number;
    duration?: number;
}


export async function load_image(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.src = url;

        img.onload = () => resolve(img);
        img.onerror = (error) => reject(error);
    });
}


export function isgif(url: string): boolean {
    const gifregex = `\.gif$`
    return Boolean(url.match(gifregex))
}


export async function getGifFrames(url: string): Promise<DSTexture[]> {
    const frames: DSTexture[] = [];
    let response = await fetch(url)

    const imagedecoder = new ImageDecoder({ data: response.body, type: "image/gif" })
    let k = 0
    while (true) {
        try {
            let result = await imagedecoder.decode({ frameIndex: k })
            frames.push({
                image: result.image,
                width: result.image.codedWidth,
                height: result.image.codedHeight,
                duration: result.image.duration
            })
            k++;
        }
        catch (e) {
            if (e instanceof RangeError) { //Thrown when reaching end of file 
                return frames;
            }
        }
    }
}

export async function get_image_textures(url: string): Promise<DSTexture[]> {
    if (isgif(url)) {
        const images = await getGifFrames(url);
        return images;
    }
    else {
        const img = await load_image(url);
        return [{ image: img, width: img.width, height: img.height }];
    }

}