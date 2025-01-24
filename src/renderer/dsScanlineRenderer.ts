import { throwIfFalsy, createProgram } from "./renderUtils";

const enum VertexAttribLocations {
    POSITION = 0
}

export class DSScanlineRenderer {
    private _program: WebGLProgram;
    private _vertexArrayObject: WebGLVertexArrayObject;
    private _quadBuffer: WebGLBuffer | null;
    private _textureLocation: WebGLUniformLocation;

    private _framebuffer: WebGLFramebuffer | null;
    private _texture: WebGLTexture | null;

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
    uniform float u_pixelHeight; // The simulated pixel height
    
    in vec2 v_texCoord;          // Interpolated texture coordinates from vertex shader
    out vec4 outColor;           // Output color for the fragment
    
    void main() {
        outColor = texture(u_texture, v_texCoord);

        // Just pass through when less than 2 pixel rows per scan line
        // Readability trumps aesthetics
        if (u_pixelHeight < 2.0) {
            return;
        }
        
        // Below 3 pixels per scanline, everything eles creates weird artifacts
        // and asymmetries, so just fake it with alternating intensity
        if (u_pixelHeight < 3.0) {
            float wholeY = floor(gl_FragCoord.y);
            if (mod(wholeY,2.0) < 0.1) {
                outColor.rgb /= 2.0;
            }
            return;
        }
        // PROS: respects actual center of scanline
        // CONS: ends up being dim when center falls between real pixels
        // NB: Works very well when u_pixelHeight > 3.0

        float pixelPos = mod(float(gl_FragCoord.y), u_pixelHeight);
        float centerDistance = (pixelPos - u_pixelHeight * 0.5) / (u_pixelHeight * 0.5);
        float falloff = pow(abs(centerDistance), 1.5);
        outColor.rgb -= vec3(falloff);
        
        // PROS: Reliably detects when we have passed over the center line of a pixel
        // Guaranteeing at least one line rendered at full intensity
        // CONS: very inconsistent intensity of non center lines

        /*
        float lastPixelPos = mod(float(gl_FragCoord.y - 1.0), u_pixelHeight);
        float lastCenterDistance = (lastPixelPos - u_pixelHeight * 0.5) / (u_pixelHeight * 0.5);
        if ((lastCenterDistance < 0.0) && (centerDistance >= 0.0)) {
            return;
        }
        */

        // PROS: Ensures full brightness for pixel row closest to middle of scanline
        // CONS: Uneven gaps between scanlines

        /*
        if (u_pixelHeight < 30.0) {
            float wholeY = floor(gl_FragCoord.y);
            float startPixel = ceil(floor((wholeY) / u_pixelHeight) * u_pixelHeight);
            float centerDistance = abs(wholeY - startPixel)/u_pixelHeight;
            if (wholeY - startPixel < 0.2)
                return;
            outColor.rgb -= vec3(centerDistance);
            return;
        }
        */

    }`;

    private _pixelheightLocation: WebGLUniformLocation;
    private _pixelheight: number;

    constructor(private gl: WebGL2RenderingContext) {

        // FRAMEBUFFER

        // Create the framebuffer
        this._framebuffer = gl.createFramebuffer();
        this._texture = gl.createTexture();

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

        this._textureLocation = throwIfFalsy(gl.getUniformLocation(this._program, 'u_texture'));
        this._pixelheightLocation = throwIfFalsy(gl.getUniformLocation(this._program, 'u_pixelHeight'));

        // Define the vertex attribute pointer for position within the VAO
        gl.enableVertexAttribArray(VertexAttribLocations.POSITION);
        gl.vertexAttribPointer(VertexAttribLocations.POSITION, 2, gl.FLOAT, false, 0, 0);
    }

    public get texture() {
        return this._texture;
    }

    public resize(cellheight: number): void {
        this._pixelheight = cellheight / 16.0;

        const gl = this.gl;

        gl.bindFramebuffer(gl.FRAMEBUFFER, this._framebuffer);

        // Create a texture to use as the color attachment
        const width = gl.canvas.width;
        const height = gl.canvas.height;

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this._texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

        // Attach the texture to the framebuffer as the color attachment
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this._texture, 0);

        // Unbind the framebuffer for now
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.bindTexture(gl.TEXTURE_2D, null);
    }

    public render(texture: WebGLTexture): void {
        const gl = this.gl;
        
        gl.bindFramebuffer(gl.FRAMEBUFFER, this._framebuffer);

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
        gl.uniform1f(this._pixelheightLocation, this._pixelheight);

        // Draw the fullscreen quad
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
}
