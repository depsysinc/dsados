import { throwIfFalsy, createProgram } from "./renderUtils";

const enum VertexAttribLocations {
    POSITION = 0
}

export class DSSpriteRenderer {
    private _program: WebGLProgram;
    private _vertexArrayObject: WebGLVertexArrayObject;
    private _quadBuffer: WebGLBuffer | null;

    readonly vertexShaderSource = `#version 300 es
    layout (location = ${VertexAttribLocations.POSITION}) in vec2 a_position;
    
    void main() {
        gl_Position = vec4(a_position, 0.0, 1.0);
    }`;

    readonly fragmentShaderSource = `#version 300 es
    precision mediump float;
    
    uniform vec2 u_fbDimensions;
    uniform vec2 u_pixelDimensions;
    uniform vec2 u_spriteCoord;
    uniform mediump sampler2DArray u_texture;
    uniform int u_textureIndex;
    
    out vec4 outColor;           // Output color for the fragment
    
    void main() {
        vec2 trueCoord = u_spriteCoord * u_pixelDimensions;
        vec2 fragCoord = vec2(
            gl_FragCoord.x,
            u_fbDimensions.y - gl_FragCoord.y);
        ivec3 textureDimensions = textureSize(u_texture, 0);
        if (
                (fragCoord.x >= trueCoord.x) &&
                (fragCoord.y >= trueCoord.y) &&
                (fragCoord.x <= (trueCoord.x + u_pixelDimensions.x * float(textureDimensions.x))) &&
                (fragCoord.y <= (trueCoord.y + u_pixelDimensions.y * float(textureDimensions.y)))
            ) {
            
            float tx = (fragCoord.x - trueCoord.x)/float(textureDimensions.x)/u_pixelDimensions.x;
            float ty = (fragCoord.y - trueCoord.y)/float(textureDimensions.y)/u_pixelDimensions.y;
            outColor = texture(u_texture, vec3(tx,ty,float(u_textureIndex)));
            // outColor.r += 0.5;
        }
    }`;

    private _fbDimensionsLocation: WebGLUniformLocation;
    private _pixelDimensionsLocation: WebGLUniformLocation;
    private _pixelheight: number;
    private _spritecoordLocation: WebGLUniformLocation;
    private _pixelwidth: number;
    private _textureLocation: WebGLUniformLocation;
    private _textureIndexLocation: WebGLUniformLocation;

    constructor(private gl: WebGL2RenderingContext) {

        // VAO
        this._vertexArrayObject = gl.createVertexArray();
        gl.bindVertexArray(this._vertexArrayObject);

        // Create a buffer for the fullscreen quad's vertices
        const vertices = new Float32Array([
            -1, -1, // Bottom left
            1, -1, // Bottom right
            -1, 1, // Top left
            1, 1 // Top right
        ]);

        this._quadBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this._quadBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

        this._program = throwIfFalsy(
            createProgram(gl, this.vertexShaderSource, this.fragmentShaderSource));

        this._fbDimensionsLocation = throwIfFalsy(gl.getUniformLocation(this._program, 'u_fbDimensions'));
        this._pixelDimensionsLocation = throwIfFalsy(gl.getUniformLocation(this._program, 'u_pixelDimensions'));
        this._spritecoordLocation = throwIfFalsy(gl.getUniformLocation(this._program, 'u_spriteCoord'));
        this._textureLocation = throwIfFalsy(gl.getUniformLocation(this._program, 'u_texture'));
        this._textureIndexLocation = throwIfFalsy(gl.getUniformLocation(this._program, 'u_textureIndex'));

        // Define the vertex attribute pointer for position within the VAO
        gl.enableVertexAttribArray(VertexAttribLocations.POSITION);
        gl.vertexAttribPointer(VertexAttribLocations.POSITION, 2, gl.FLOAT, false, 0, 0);
    }

    public resize(pixelwidth: number, pixelheight: number): void {
        this._pixelwidth = pixelwidth;
        this._pixelheight = pixelheight;
    }

    public render(spritetexture: WebGLTexture, x: number, y: number): void {
        const gl = this.gl;

        // Use the fullscreen shader program
        gl.useProgram(this._program);

        // Bind the VAO for the fullscreen quad
        gl.bindVertexArray(this._vertexArrayObject);

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D_ARRAY, spritetexture);

        gl.uniform2f(this._fbDimensionsLocation, gl.canvas.width, gl.canvas.height);
        gl.uniform1i(this._textureLocation, 0);
        gl.uniform1i(this._textureIndexLocation, 0);
        gl.uniform2f(this._pixelDimensionsLocation, this._pixelwidth, this._pixelheight);
        gl.uniform2f(this._spritecoordLocation, x, y);


        // Draw the fullscreen quad
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
}
