import { throwIfFalsy, createProgram } from "./renderUtils";

const enum VertexAttribLocations {
    POSITION = 0
}

export class DSScreenRenderer {
    private _program: WebGLProgram;
    private _vertexArrayObject: WebGLVertexArrayObject;
    private _quadBuffer: WebGLBuffer | null;
    private _textureLocation: WebGLUniformLocation;

    readonly vertexShaderSource = `#version 300 es
    layout (location = ${VertexAttribLocations.POSITION}) in vec2 a_position;
    
    out vec2 v_texCoord; // Pass texture coordinates to fragment shader
    
    void main() {
        v_texCoord = a_position * 0.5 + 0.5; // Map from [-1,1] to [0,1]
        gl_Position = vec4(a_position, 0.0, 1.0);
    }`;

    readonly fragmentShaderSource = `#version 300 es
    precision mediump float;
    
    uniform sampler2D u_texture; // Texture sampler
    
    in vec2 v_texCoord;          // Interpolated texture coordinates from vertex shader
    out vec4 outColor;           // Output color for the fragment
    
    void main() {
        outColor = texture(u_texture, v_texCoord);
        // outColor.r = 1.0;
    }`;

    constructor(private gl: WebGL2RenderingContext) {

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

        this._textureLocation = throwIfFalsy(gl.getUniformLocation(this._program, 'u_texture'));

        // Define the vertex attribute pointer for position within the VAO
        gl.enableVertexAttribArray(VertexAttribLocations.POSITION);
        gl.vertexAttribPointer(VertexAttribLocations.POSITION, 2, gl.FLOAT, false, 0, 0);
    }

    public resize(): void {
    }

    public render(texture: WebGLTexture): void {
        const gl = this.gl;
        // Bind the default framebuffer (null)
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);

        // Clear the screen if needed
        gl.clearColor(0.0, 0.0, 0.0, 1.0);
        gl.clear(gl.COLOR_BUFFER_BIT);

        // Use the fullscreen shader program
        gl.useProgram(this._program);

        // Bind the VAO for the fullscreen quad
        gl.bindVertexArray(this._vertexArrayObject);

        // Bind the texture as the active texture
        gl.activeTexture(gl.TEXTURE0);

        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.uniform1i(this._textureLocation, 0); // Set the texture uniform to use texture unit 0

        // Draw the fullscreen quad
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
}
