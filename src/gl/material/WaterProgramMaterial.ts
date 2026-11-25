import TextureOp from '#/dash3d/TextureOp';
import TextureOpPerlinNoise from '#/dash3d/TextureOpPerlinNoise';
import PacketT from '#/io/PacketT';
import { GL } from '#/jogl/GL';
import { doubleToInt } from '#/util/IntUtils';
import { arrayAtI32, arrayAtObj, requireNonNull } from '#/util/JavaArray';
import ByteBuffer from '#/util/nio/ByteBuffer';
import ByteOrder from '#/util/nio/ByteOrder';
import type FloatBuffer from '#/util/nio/FloatBuffer';
import GlRenderer from '#/gl/GlRenderer';
import NoiseTextures from '#/gl/NoiseTextures';
import MaterialManager from './MaterialManager';
import type MaterialRenderer from './MaterialRenderer';

// rd in runescape_gl.jar (HD only): material 2, water drawn through the jar's only ARB vertex program. The program
// (PROGRAM_SOURCE, 1,736 bytes) takes texture unit 1's matrix as the view-to-world transform, offsets the unit 0
// texture coordinates by a turbulence-scaled lookup into 64 noise registers (program.local[0..63]) and multiplies the
// vertex colour by the light-model ambient (program.local[66]). bind() loads the camera into unit 1's texture matrix
// and, once per cycle (tf.g), uploads the 64 registers of row (cycle & 255) of a 256 x 64 noise table plus the time
// register 65. The argument selects: bit 7 disables unit 1's noise texture, bit 6 replaces the ambient with white, and
// bits 0-1 pick the turbulence (0.025, 0.05 with 2, 0.1 with 3). Without GL_ARB_vertex_program or a second texture
// unit the constructor leaves listBase at -1 and every method returns at once.
export default class WaterProgramMaterial implements MaterialRenderer {
    // rd.d:[F. The LIGHT_MODEL_AMBIENT read-back of setArgument. rd.<clinit>()V allocates it.
    static ambient: Float32Array | null = new Float32Array(4);

    // rd.<init>()V stores a and e in this order before its body; b and c keep their defaults.
    private uploadedCycle = -1; // rd.a:I
    private noise: FloatBuffer | null = null; // rd.b:Ljava/nio/FloatBuffer;
    private program = 0; // rd.c:I
    private listBase = -1; // rd.e:I

    // The String constant rd.f()V passes to glProgramStringARB (out/530-hd-vertex-program.arb, 1,736 bytes,
    // SHA-256 05b4a0e72fd47dddd64ec397b735a871b1510d8c0cd0693189495d18f6a553ce).
    static readonly PROGRAM_SOURCE: string =
        '!!ARBvp1.0\n' +
        'ATTRIB  iPos         = vertex.position;\n' +
        'ATTRIB  iColour      = vertex.color;\n' +
        'OUTPUT  oPos         = result.position;\n' +
        'OUTPUT  oColour      = result.color;\n' +
        'OUTPUT  oTexCoord0   = result.texcoord[0];\n' +
        'OUTPUT  oTexCoord1   = result.texcoord[1];\n' +
        'OUTPUT  oFogCoord    = result.fogcoord;\n' +
        'PARAM   time         = program.local[65];\n' +
        'PARAM   turbulence   = program.local[64];\n' +
        'PARAM   lightAmbient = program.local[66]; \n' +
        'PARAM   pMatrix[4]   = { state.matrix.projection };\n' +
        'PARAM   mvMatrix[4]  = { state.matrix.modelview };\n' +
        'PARAM   ivMatrix[4]  = { state.matrix.texture[1] };\n' +
        'PARAM   fNoise[64]   = { program.local[0..63] };\n' +
        'TEMP    noise, clipPos, viewPos, worldPos;\n' +
        'ADDRESS noiseAddr;\n' +
        'DP4   viewPos.x, mvMatrix[0], iPos;\n' +
        'DP4   viewPos.y, mvMatrix[1], iPos;\n' +
        'DP4   viewPos.z, mvMatrix[2], iPos;\n' +
        'DP4   viewPos.w, mvMatrix[3], iPos;\n' +
        'DP4   worldPos.x, ivMatrix[0], viewPos;\n' +
        'DP4   worldPos.y, ivMatrix[1], viewPos;\n' +
        'DP4   worldPos.z, ivMatrix[2], viewPos;\n' +
        'DP4   worldPos.w, ivMatrix[3], viewPos;\n' +
        'ADD   noise.x, worldPos.x, worldPos.z;SUB   noise.y, worldPos.z, worldPos.x;MUL   noise, noise, 0.0001220703125;\n' +
        'FRC   noise, noise;\n' +
        'MUL   noise, noise, 64;\n' +
        'ARL   noiseAddr.x, noise.x;\n' +
        'MOV   noise.x, fNoise[noiseAddr.x].x;\n' +
        'ARL   noiseAddr.x, noise.y;\n' +
        'MOV   noise.y, fNoise[noiseAddr.x].y;\n' +
        'MUL   noise, noise, turbulence.x;\n' +
        'MAD   oTexCoord0, worldPos.xzww, 0.0078125, noise;\n' +
        'MOV   oTexCoord0.w, 1;\n' +
        'MUL   oTexCoord1.xy, worldPos.xzww, 0.0009765625;\n' +
        'MOV   oTexCoord1.zw, time.xxxw;\n' +
        'DP4   clipPos.x, pMatrix[0], viewPos;\n' +
        'DP4   clipPos.y, pMatrix[1], viewPos;\n' +
        'DP4   clipPos.z, pMatrix[2], viewPos;\n' +
        'DP4   clipPos.w, pMatrix[3], viewPos;\n' +
        'MUL   oColour.xyz, iColour, lightAmbient;\n' +
        'MOV   oColour.w, 1;\n' +
        'MOV   oFogCoord.x, clipPos.z;\n' +
        'MOV   oPos, clipPos; \n' +
        'END';

    // rd.a()V
    unbind(): void {
        if (this.listBase < 0) {
            return;
        }
        const gl = requireNonNull(GlRenderer.gl);
        gl.glCallList((this.listBase + 1) | 0);
    }

    // rd.c()I
    flags(): number {
        return 0;
    }

    // rd.d()V
    static unload(): void {
        WaterProgramMaterial.ambient = null;
    }

    // rd.b()V
    bind(): void {
        if (this.listBase < 0) {
            return;
        }
        const gl = requireNonNull(GlRenderer.gl);
        gl.glCallList(this.listBase);
        gl.glActiveTexture(GL.GL_TEXTURE1);
        gl.glMatrixMode(GL.GL_TEXTURE);
        gl.glTranslatef(Math.fround(MaterialManager.cameraX), Math.fround(MaterialManager.cameraY), Math.fround(MaterialManager.cameraZ));
        gl.glRotatef(Math.fround(-Math.fround(Math.fround(MaterialManager.cameraYaw) * 360.0) / 2048.0), 0.0, 1.0, 0.0);
        gl.glRotatef(Math.fround(-Math.fround(Math.fround(MaterialManager.cameraPitch) * 360.0) / 2048.0), 1.0, 0.0, 0.0);
        gl.glRotatef(-180.0, 1.0, 0.0, 0.0);
        gl.glMatrixMode(GL.GL_MODELVIEW);
        if (!NoiseTextures.texture3d) {
            gl.glBindTexture(GL.GL_TEXTURE_2D, arrayAtI32(NoiseTextures.ridgedSlices, doubleToInt(Math.fround(Math.fround(Math.imul(GlRenderer.cycle, 64)) * Math.fround(0.005))) % 64));
        }
        gl.glActiveTexture(GL.GL_TEXTURE0);
        if (this.uploadedCycle !== GlRenderer.cycle) {
            let position = Math.imul(GlRenderer.cycle & 255, 256);
            for (let i = 0; i < 64; i++) {
                requireNonNull(this.noise).position(position);
                gl.glProgramLocalParameter4fvARB(GL.GL_VERTEX_PROGRAM_ARB, i, this.noise);
                position = (position + 4) | 0;
            }
            if (NoiseTextures.texture3d) {
                gl.glProgramLocalParameter4fARB(GL.GL_VERTEX_PROGRAM_ARB, 65, Math.fround(Math.fround(GlRenderer.cycle) * Math.fround(0.005)), 0.0, 0.0, 1.0);
            } else {
                gl.glProgramLocalParameter4fARB(GL.GL_VERTEX_PROGRAM_ARB, 65, 0.0, 0.0, 0.0, 1.0);
            }
            this.uploadedCycle = GlRenderer.cycle;
        }
    }

    // rd.e()V. Two display lists: listBase binds the program and unit 1's noise texture, listBase + 1 undoes both.
    private compileLists(): void {
        const gl = requireNonNull(GlRenderer.gl);
        this.listBase = gl.glGenLists(2);
        gl.glNewList(this.listBase, GL.GL_COMPILE);
        gl.glActiveTexture(GL.GL_TEXTURE1);
        if (NoiseTextures.texture3d) {
            gl.glBindTexture(GL.GL_TEXTURE_3D, NoiseTextures.ridgedTexture);
        }
        gl.glTexEnvi(GL.GL_TEXTURE_ENV, GL.GL_COMBINE_RGB, GL.GL_ADD);
        gl.glTexEnvi(GL.GL_TEXTURE_ENV, GL.GL_COMBINE_ALPHA, GL.GL_REPLACE);
        gl.glTexEnvi(GL.GL_TEXTURE_ENV, GL.GL_SOURCE0_ALPHA, GL.GL_PREVIOUS);
        gl.glActiveTexture(GL.GL_TEXTURE0);
        gl.glBindProgramARB(GL.GL_VERTEX_PROGRAM_ARB, this.program);
        gl.glEnable(GL.GL_VERTEX_PROGRAM_ARB);
        gl.glEndList();
        gl.glNewList((this.listBase + 1) | 0, GL.GL_COMPILE);
        gl.glActiveTexture(GL.GL_TEXTURE1);
        gl.glMatrixMode(GL.GL_TEXTURE);
        gl.glLoadIdentity();
        gl.glMatrixMode(GL.GL_MODELVIEW);
        gl.glTexEnvi(GL.GL_TEXTURE_ENV, GL.GL_COMBINE_RGB, GL.GL_MODULATE);
        gl.glTexEnvi(GL.GL_TEXTURE_ENV, GL.GL_COMBINE_ALPHA, GL.GL_MODULATE);
        gl.glTexEnvi(GL.GL_TEXTURE_ENV, GL.GL_SOURCE0_ALPHA, GL.GL_TEXTURE);
        gl.glDisable(NoiseTextures.texture3d ? GL.GL_TEXTURE_3D : GL.GL_TEXTURE_2D);
        gl.glActiveTexture(GL.GL_TEXTURE0);
        gl.glBindProgramARB(GL.GL_VERTEX_PROGRAM_ARB, 0);
        gl.glDisable(GL.GL_VERTEX_PROGRAM_ARB);
        gl.glDisable(GL.GL_FRAGMENT_PROGRAM_ARB);
        gl.glEndList();
    }

    // rd.f()V. The error position is read back and not acted on: both outcomes return.
    private loadProgram(): void {
        if (this.listBase >= 0) {
            const gl = requireNonNull(GlRenderer.gl);
            const errorPosition = new Int32Array(1);
            gl.glBindProgramARB(GL.GL_VERTEX_PROGRAM_ARB, this.program);
            gl.glProgramStringARB(GL.GL_VERTEX_PROGRAM_ARB, GL.GL_PROGRAM_FORMAT_ASCII_ARB, WaterProgramMaterial.PROGRAM_SOURCE.length, WaterProgramMaterial.PROGRAM_SOURCE);
            gl.glGetIntegerv(GL.GL_PROGRAM_ERROR_POSITION_ARB, errorPosition, 0);
            if (arrayAtI32(errorPosition, 0) !== -1) {
                return;
            }
        }
    }

    // rd.a(I)V
    setArgument(argument: number): void {
        if (this.listBase < 0) {
            return;
        }
        const gl = requireNonNull(GlRenderer.gl);
        gl.glActiveTexture(GL.GL_TEXTURE1);
        if ((argument & 0x80) === 0) {
            gl.glEnable(NoiseTextures.texture3d ? GL.GL_TEXTURE_3D : GL.GL_TEXTURE_2D);
        } else {
            gl.glDisable(NoiseTextures.texture3d ? GL.GL_TEXTURE_3D : GL.GL_TEXTURE_2D);
        }
        gl.glActiveTexture(GL.GL_TEXTURE0);
        if ((argument & 0x40) === 0) {
            gl.glGetFloatv(GL.GL_LIGHT_MODEL_AMBIENT, WaterProgramMaterial.ambient, 0);
            gl.glProgramLocalParameter4fvARB(GL.GL_VERTEX_PROGRAM_ARB, 66, WaterProgramMaterial.ambient, 0);
        } else {
            gl.glProgramLocalParameter4fARB(GL.GL_VERTEX_PROGRAM_ARB, 66, 1.0, 1.0, 1.0, 1.0);
        }
        const turbulence = argument & 3;
        if (turbulence === 2) {
            gl.glProgramLocalParameter4fARB(GL.GL_VERTEX_PROGRAM_ARB, 64, Math.fround(0.05), 1.0, 1.0, 1.0);
        } else if (turbulence === 3) {
            gl.glProgramLocalParameter4fARB(GL.GL_VERTEX_PROGRAM_ARB, 64, Math.fround(0.1), 1.0, 1.0, 1.0);
        } else {
            gl.glProgramLocalParameter4fARB(GL.GL_VERTEX_PROGRAM_ARB, 64, Math.fround(0.025), 1.0, 1.0, 1.0);
        }
    }

    // rd.<init>()V. The noise table holds, per row r < 256 and register k < 64, the floats (x/4096, y/4096, 1, 1) of
    // two 256 x 64 Perlin tables, written through PacketT in the byte order tf.f names and read back in native order.
    constructor() {
        if (this.listBase >= 0) {
            return;
        }
        if (GlRenderer.vertexProgramSupported && GlRenderer.maxTextureUnits >= 2) {
            const programs = new Int32Array(1);
            const gl = requireNonNull(GlRenderer.gl);
            gl.glGenProgramsARB(1, programs, 0);
            this.program = arrayAtI32(programs, 0);
            const noiseX = WaterProgramMaterial.perlinTable(false, 3, 64, 256, 0, 4, 8, Math.fround(0.4));
            const noiseY = WaterProgramMaterial.perlinTable(false, 3, 64, 256, 8, 4, 8, Math.fround(0.4));
            const packet = new PacketT(262144);
            for (let row = 0; row < 256; row++) {
                const x = arrayAtObj(noiseX, row);
                const y = arrayAtObj(noiseY, row);
                for (let k = 0; k < 64; k++) {
                    if (GlRenderer.bigEndian) {
                        packet.pFloat(Math.fround(Math.fround(arrayAtI32(x, k)) / 4096.0));
                        packet.pFloat(Math.fround(Math.fround(arrayAtI32(y, k)) / 4096.0));
                        packet.pFloat(1.0);
                        packet.pFloat(1.0);
                        continue;
                    }
                    packet.pFloatPlatformEndian(Math.fround(Math.fround(arrayAtI32(x, k)) / 4096.0));
                    packet.pFloatPlatformEndian(Math.fround(Math.fround(arrayAtI32(y, k)) / 4096.0));
                    packet.pFloatPlatformEndian(1.0);
                    packet.pFloatPlatformEndian(1.0);
                }
            }
            const bytes = ByteBuffer.allocateDirect(packet.m_pos).order(ByteOrder.nativeOrder());
            bytes.put(packet.m_data, 0, packet.m_pos);
            bytes.flip();
            this.noise = bytes.asFloatBuffer().asReadOnlyBuffer();
            this.compileLists();
            this.loadProgram();
        }
    }

    // cj.a(ZIIIIIIFB)[[I, a static of the HD holder class cj with no target in membermap-hd.json; rd.<init>()V is its
    // only caller, so it lives here. Renders `height` rows of `width` monochrome samples of a TextureOpPerlinNoise
    // (HD bi) with the given bias, octaves, persistence and x/y scales. `_unused` (0 and 8 at the two calls) is
    // never read. The trailing dummy byte and its guard (by >= -52, false at both calls) are stripped.
    static perlinTable(bias: boolean, octaves: number, width: number, height: number, _unused: number, yScale: number, xScale: number, persistence: number): Int32Array[] {
        const table = Array.from({ length: height }, () => new Int32Array(width));
        const noise = new TextureOpPerlinNoise();
        // HD bi.gb, Z, X, kb and eb are TextureOpPerlinNoise's private persistence, octaves, yScale, bias and xScale
        // (SD vk.nb, W, ob, Q and cb). Element access reaches them until that class exposes them.
        noise['persistence'] = doubleToInt(Math.fround(persistence * 4096.0));
        noise['octaves'] = octaves;
        noise['yScale'] = yScale;
        noise['bias'] = bias;
        noise['xScale'] = xScale;
        noise.postDecode();
        // HD an.c(III)V: its second argument (height) fills fb.h, its third (width) pe.r and nk.d.
        TextureOp.setSize(width, height);
        for (let row = 0; row < height; row++) {
            noise['renderRow'](arrayAtObj(table, row), row);
        }
        return table;
    }
}
