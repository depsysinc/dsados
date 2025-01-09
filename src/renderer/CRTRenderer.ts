import { throwIfFalsy } from 'browser/renderer/shared/RendererUtils';
import { IRenderDimensions } from 'browser/renderer/shared/Types';
import { Disposable, toDisposable } from 'vs/base/common/lifecycle';
import { Terminal } from '@xterm/xterm';
import { IWebGL2RenderingContext, IWebGLVertexArrayObject } from './Types';
import { createProgram } from './WebglUtils';
import { WebglAddon } from 'WebglAddon';

const enum VertexAttribLocations {
  POSITION = 0,
}

const vertexShaderSource = `#version 300 es
layout (location = ${VertexAttribLocations.POSITION}) in vec2 a_position;

out vec2 v_texCoord; // Pass texture coordinates to fragment shader

void main() {
    v_texCoord = a_position * 0.5 + 0.5; // Map from [-1,1] to [0,1]
    gl_Position = vec4(a_position, 0.0, 1.0);
}`;

const fragmentShaderSource = `#version 300 es
precision mediump float;

uniform sampler2D u_texture; // Texture sampler

in vec2 v_texCoord;          // Interpolated texture coordinates from vertex shader
out vec4 outColor;           // Output color for the fragment

void main() {
    outColor = texture(u_texture, v_texCoord);
    // outColor.r = 1.0;
}`;

/*
const fragmentShaderSourcebak = `#version 300 es
precision mediump float;

uniform sampler2D u_texture; // Texture sampler
uniform int u_cellHeight;    // Height of character cell
uniform float u_fadeLevel;   // Fade level from 0.0 to 1.0 (or more for overshoot)

in vec2 v_texCoord;          // Interpolated texture coordinates from vertex shader
out vec4 outColor;           // Output color for the fragment

void main() {
  //
  // Fadein
  //

  // Set up source coords
  vec2 vsize = vec2(gl_FragCoord.x / v_texCoord[0], gl_FragCoord.y / v_texCoord[1]);
  vec2 tsize = vec2(vsize.x * u_fadeLevel, vsize.y * u_fadeLevel);
  vec2 tstart = vec2(vsize.x * 0.5 - tsize.x * 0.5, vsize.y * 0.5 - tsize.y * 0.5);
  vec2 tend = vec2(vsize.x * 0.5 + tsize.x * 0.5, vsize.y * 0.5 + tsize.y * 0.5);

  // Render nothing outside current fade zone
  if ((gl_FragCoord.x < tstart.x)
     || (gl_FragCoord.y < tstart.y)
     || (gl_FragCoord.x > tend.x)
     || (gl_FragCoord.y > tend.y))
  {
      outColor = vec4 (0.0,0.0,0.0,1.0);
      return;
  }

  vec2 adjTexCoord;
  adjTexCoord.x = (gl_FragCoord.x - tstart.x) / tsize.x;
  adjTexCoord.y = (gl_FragCoord.y - tstart.y) / tsize.y;
  vec2 adjFragCoord;
  adjFragCoord.x = adjTexCoord.x * vsize.x;
  adjFragCoord.y = adjTexCoord.y * vsize.y;

  //
  // Blur
  //
  float u_blurRadius = 0.00025;
  vec4 color = vec4(0.0);  // Accumulate sampled colors
  float totalWeight = 0.0; // Accumulate weights for normalization

  // Loop through offsets to sample the surrounding area
  for (int x = -4; x <= 4; x++) {
      for (int y = -4; y <= 4; y++) {
          vec2 offset = vec2(float(x), float(y)) * u_blurRadius;
          vec2 sampleCoord = adjTexCoord + offset;

          // Gaussian weight based on distance from center
          float weight = exp(-dot(offset, offset) / (2.0 * u_blurRadius * u_blurRadius));
          color += texture(u_texture, sampleCoord) * weight;
          totalWeight += weight;
      }
  }
  // Normalize the accumulated color
  outColor = color / totalWeight;

  //
  // Scan Lines
  //

  // Calculate pixel height
  float pixelHeight = float(u_cellHeight) / 16.0;

  // Calculate position within the pixel
  float cellPos = mod(float(adjFragCoord.y), pixelHeight);

  // Calculate normalized distance from the center of the pixel
  float centerDistance = abs(cellPos - pixelHeight * 0.5) / (pixelHeight * 0.5);

  // Apply a non-linear falloff to make the edges fall off faster
  float falloff = pow(centerDistance, 1.5);

  // Adjust intensity, where the center has the highest intensity
  outColor.rgb -= vec3(falloff);

  // Clamp cell colour at fadevalue
  vec3 clampColor = clamp (outColor.rgb, 0.0, u_fadeLevel);

  outColor = vec4(clampColor, 1.0);

}`;

*/

export class CRTRenderer extends Disposable {
  private _program: WebGLProgram;
  private _vertexArrayObject: IWebGLVertexArrayObject;
  private _textureLocation: WebGLUniformLocation;
  // private _cellHeightLocation: WebGLUniformLocation;
  // private _fadeLevelLocation: WebGLUniformLocation;
  private _framebuffer: WebGLFramebuffer | null;
  private _texture: WebGLTexture | null;
  private _quadBuffer: WebGLBuffer | null;
  private _fadeStart: number = 0;
  private _fadeDuration: number = 0;

  constructor(
    private _terminal: Terminal,
    private _gl: IWebGL2RenderingContext,
    private _dimensions: IRenderDimensions
  ) {
    super();

    this._framebuffer = null;
    this._texture = null;
    //
    // Initialize the framebuffer and texture
    //
    const gl = this._gl;

    // Create the framebuffer
    this._framebuffer = gl.createFramebuffer();
    this._texture = gl.createTexture();
    // TODO: proper cleanup with this._register(toDisposable(() =>

    // VAO
    this._vertexArrayObject = gl.createVertexArray();
    gl.bindVertexArray(this._vertexArrayObject);

    // Create a buffer for the fullscreen quad's vertices
    const vertices = new Float32Array([
      -1, -1, // Bottom left
      1, -1, // Bottom right
      -1, 1, // Top left
      1, 1  // Top right
    ]);

    this._quadBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this._quadBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(VertexAttribLocations.POSITION);
    gl.vertexAttribPointer(VertexAttribLocations.POSITION, 2, gl.FLOAT, false, 0, 0);

    // PROGRAM
    this._program = throwIfFalsy(createProgram(gl, vertexShaderSource, fragmentShaderSource));
    this._register(toDisposable(() => gl.deleteProgram(this._program)));

    this._textureLocation = throwIfFalsy(gl.getUniformLocation(this._program, 'u_texture'));
    // this._cellHeightLocation = throwIfFalsy(gl.getUniformLocation(this._program, 'u_cellHeight'));
    // this._fadeLevelLocation = throwIfFalsy(gl.getUniformLocation(this._program, 'u_fadeLevel'));

    WebglAddon.onInit?.(gl);

    this.handleResize();
  }

  public handleResize(): void {
    const gl = this._gl;

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

    WebglAddon.onResize?.();
  }

  public setDimensions(dimensions: IRenderDimensions): void {
    console.log("dimensions");
    this._dimensions = dimensions;
  }

  public beginFrame(): void {
    const gl = this._gl;

    gl.bindFramebuffer(gl.FRAMEBUFFER, this._framebuffer);
  }

  public render(): void {
    const gl = this._gl;

    /*
    let fadeLevel = 1.0;
    if (this._fadeStart > 0) {
      const curTime = Date.now() - this._fadeStart;
      if (curTime < this._fadeDuration) {
        const t = curTime / this._fadeDuration; // Normalize to [0, 1]
        fadeLevel = oscillatingStep(t / 1000);
      } else {
        this._fadeStart = 0;
        fadeLevel = 1.0;
      }
      this._terminal.refresh(0, this._terminal.rows - 1);
    }
      */

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
    const savedTexture = gl.getParameter(gl.TEXTURE_BINDING_2D) as WebGLTexture | null;

    gl.bindTexture(gl.TEXTURE_2D, this._texture);
    gl.uniform1i(this._textureLocation, 0); // Set the texture uniform to use texture unit 0
    // gl.uniform1i(this._cellHeightLocation, this._dimensions.device.cell.height);
    // gl.uniform1f(this._fadeLevelLocation, fadeLevel);

    // Draw the fullscreen quad
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    // Unbind the VAO and texture after rendering
    gl.bindTexture(gl.TEXTURE_2D, savedTexture);
    if (this._texture) {
      WebglAddon.onRender?.(this._texture);
    }
  }

  public startFadeIn(duration: number): void {
    this._fadeStart = Date.now();
    this._fadeDuration = duration;
    this._terminal.refresh(0, this._terminal.rows - 1);
  }

}

function oscillatingStep(t: number): number {
  // const R = 70; // ohms
  // const L = 0.005; // henries
  // const C = 1e-6; // farads

  // Natural angular frequency

  // const omega0 = 1 / Math.sqrt(L * C);
  const omega0 = 14142.13;

  // Damping factor
  // const zeta = R / (2 * Math.sqrt(L / C));
  const zeta = 0.49497;

  // Damped angular frequency
  // const omegaD = omega0 * Math.sqrt(1 - zeta ** 2);
  const omegaD = 12288.20;

  // Exponential decay factor
  const exponentialDecay = Math.exp(-zeta * omega0 * t);

  // Oscillatory terms
  const cosineTerm = Math.cos(omegaD * t);
  const sineTerm = (zeta / Math.sqrt(1 - zeta ** 2)) * Math.sin(omegaD * t);

  // Voltage across the capacitor
  const vc = (1 - exponentialDecay * (cosineTerm + sineTerm));

  return vc;
}
