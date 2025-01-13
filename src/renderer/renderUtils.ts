import { Terminal } from "@xterm/xterm";
import { WebglAddon } from '@xterm/addon-webgl';


export function throwIfFalsy<T>(value: T | undefined | null): T {
    if (!value) {
        console.log("error");
        throw new Error('value must not be falsy');
    }
    return value;
}

export function createProgram(gl: WebGL2RenderingContext, vertexSource: string, fragmentSource: string): WebGLProgram | undefined {
    const program = throwIfFalsy(gl.createProgram());
    gl.attachShader(program, throwIfFalsy(createShader(gl, gl.VERTEX_SHADER, vertexSource)));
    gl.attachShader(program, throwIfFalsy(createShader(gl, gl.FRAGMENT_SHADER, fragmentSource)));
    gl.linkProgram(program);
    const success = gl.getProgramParameter(program, gl.LINK_STATUS);
    if (success) {
        return program;
    }

    console.error(gl.getProgramInfoLog(program));
    gl.deleteProgram(program);
}

export function createShader(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader | undefined {
    const shader = throwIfFalsy(gl.createShader(type));
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    const success = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
    if (success) {
        return shader;
    }

    console.error(gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
}

export type TextureArray = {
    glid: WebGLTexture;
    length: number;
    width: number;
    height: number;
}

export function createTexture(gl: WebGL2RenderingContext, images: HTMLImageElement[]): TextureArray {
    const texarray = {
        glid: gl.createTexture(),
        length: images.length,
        width: images[0].width,
        height: images[0].height
    }
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, texarray.glid);

    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

    gl.texStorage3D(gl.TEXTURE_2D_ARRAY, 1, gl.RGBA8, texarray.width, texarray.height, texarray.length);

    for (let i = 0; i < texarray.length; i++) {
        const img = images[i];
        if ((img.width != texarray.width) || (img.height != texarray.height))
            throw new Error("Images must have matching dimensions");
        gl.texSubImage3D(
            gl.TEXTURE_2D_ARRAY,  // TARGET
            0,                    // LEVEL 
            0,                    // xoffset 
            0,                    // yoffset
            i,                    // zoffset
            img.width,
            img.height,
            1,                    // depth
            gl.RGBA,
            gl.UNSIGNED_BYTE,
            img
        );

    }
    return texarray;
}

export function deleteTexture(gl: WebGL2RenderingContext, texarray: TextureArray) {
    gl.deleteTexture(texarray.glid);
}