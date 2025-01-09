import { throwIfFalsy, createProgram } from "./renderUtils";

const enum VertexAttribLocations {
    POSITION = 0
}

export class DSBloomRenderer {
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
    uniform float u_bloomIntensity; // Bloom filter intensity
    
    in vec2 v_texCoord;          // Interpolated texture coordinates from vertex shader
    out vec4 outColor;           // Output color for the fragment
    
    void main() {
        // vec3 result = texture(u_texture, v_texCoord);

        float u_blurRadius = 0.002;
        vec4 color = vec4(0.0);  // Accumulate sampled colors
        float totalWeight = 0.0; // Accumulate weights for normalization

        // Loop through offsets to sample the surrounding area
        for (int x = -4; x <= 4; x++) {
            for (int y = -4; y <= 4; y++) {
                vec2 offset = vec2(float(x), float(y)) * u_blurRadius;
                vec2 sampleCoord = clamp(v_texCoord + offset, vec2(0.0), vec2(1.0)); 
                // FIXME: Filter wraps even with the clamp
                // Gaussian weight based on distance from center
                float weight = exp(-dot(offset, offset) / (2.0 * u_blurRadius * u_blurRadius));
                color += texture(u_texture, sampleCoord) * weight;
                totalWeight += weight;
            }
        }
        // Normalize the accumulated color
        outColor = max(texture(u_texture, v_texCoord), color * u_bloomIntensity);

        // outColor.r += u_bloomIntensity * 0.0;
    }`;

    private _bloomIntensityLocation: WebGLUniformLocation;
    private _bloomIntensity: number = 0.15;

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
        this._bloomIntensityLocation = throwIfFalsy(gl.getUniformLocation(this._program, 'u_bloomIntensity'));

        // Define the vertex attribute pointer for position within the VAO
        gl.enableVertexAttribArray(VertexAttribLocations.POSITION);
        gl.vertexAttribPointer(VertexAttribLocations.POSITION, 2, gl.FLOAT, false, 0, 0);
    }

    public get texture() {
        return this._texture;
    }

    public resize(): void {

        const gl = this.gl;

        gl.bindFramebuffer(gl.FRAMEBUFFER, this._framebuffer);

        // Create a texture to use as the color attachment
        const width = gl.canvas.width;
        const height = gl.canvas.height;

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this._texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);

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
        gl.uniform1f(this._bloomIntensityLocation, this._bloomIntensity);

        // Draw the fullscreen quad
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
}
