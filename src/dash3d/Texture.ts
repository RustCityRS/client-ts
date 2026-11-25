import { releaseReferences } from '#/util/StaticReferences';
import type Js5 from '#/cache/Js5';
import SecondaryNode from '#/datastruct/SecondaryNode';
import type PacketT from '#/io/PacketT';
import { arrayAtI32, arrayPutI32, requireNonNull } from '#/util/JavaArray';
import Pix3D from './Pix3D';
import ProceduralTexture from './ProceduralTexture';
import type TextureProvider from './TextureProvider';
import { glJar } from '#/client/ClientVariant';
import { GL } from '#/jogl/GL';
import ByteBuffer from '#/util/nio/ByteBuffer';
import { isJavaRuntimeException } from '#/util/JavaException';
import WrappedException from '#/util/WrappedException';
import LocalisedTextClass from '#/ui/LocalisedText';
import MidiManagerClass from '#/sound/MidiManager';
import LRUHashCacheClass from '#/datastruct/LRUHashCache';
import GlCleaner from '#/gl/GlCleaner';
import GlRenderer from '#/gl/GlRenderer';
import MaterialManager from '#/gl/material/MaterialManager';
import GLUClass from '#/jogl/GLU';
import { loadClient } from '#/util/GamepackClasses';

// Keep the software gamepack's lazy module boundary. These class identities are
// constant across binds, while their renderer, material and context state stays live.
let rendererClass: typeof import('#/gl/GlRenderer').default;
let materialClass: typeof import('#/gl/material/MaterialManager').default;

interface TextureAllocation {
    id: number;
    size: number;
    generation: number;
}

// uh.finalize() releases the name in the context generation that allocated it.
const finalizer = new FinalizationRegistry<TextureAllocation>(texture => Texture.release(texture));

// qi in the revision 530 SD gamepack (extends ei, SecondaryNode): one texture entry, decoded from the whole
// per-texture file of the textures archive and cached by id in TextureCache's LRU (kg.k). NXT
// jag::oldscape::dash3d::Texture (Texture.h). It wraps the procedural program (jd, ProceduralTexture) and the
// trailing flag and animation bytes, builds the 64x64 or 128x128 ARGB texels at a brightness on demand
// (optionally smoothed by a 3x3 box filter), and scrolls them per tick through the shared scratch array nk.N.
//
// Obfuscator artifacts stripped (verified at every call site of each method):
// - invocation counters qi.W/R/E/J/C and the od.a RuntimeException rethrow wrappers;
// - client.wb opaque branches: every loop below is the wb == 0 path (condition tested first);
// - kg.e(II)I (a & b) and ok.a(II)I (a | b) outlined helpers, inlined; obfuscated shift counts reduced to & 31;
// - qi.a(Lal;BLpc;)Z byte: only kg.a(IB)Z, passing -105 (guard `>= -34 -> a(true, 97)` dead);
// - qi.a(ZBLpc;Lal;)[I byte: only kg.c(II)[I, passing 120 (guard `< 27 -> K = -42` dead);
// - qi.a(Lal;Lpc;IFZ)[I int: only kg.a(IFI)[I, passing 15964 + -46777 = -30813 (return guard `!= -30813 -> null`
//   dead; it forwards -30813 ^ -30747 = 70 to jd, whose own guard is `< 58`, also dead; getPixels passes it 71);
// - qi.a(ZI)V boolean: kg.b(IB)V passes true (and the dead guard in isReady passes true): `if (!var1) return` dead.
// qi.finalize()V only bumps counter qi.C and calls Object.finalize: not ported (no JS counterpart, no effect).
// qi's statics belong elsewhere (membermap): qi.a(II)Z, qi.a(Lei;ILei;)V, qi.c(B)V, qi.c(I)V and the fields.
export default class Texture extends SecondaryNode {
    // HD uh.d(I)V
    static releaseTextureStatics(guard: number): void {
        try {
            const LocalisedText = LocalisedTextClass;
            releaseReferences(LocalisedText, 'germanLoadedInterfaces');
            const Client = loadClient();
            releaseReferences(Client, 'huffmanGroup');
            releaseReferences(LocalisedText, 'germanLoadingPleaseWait');
            const MidiManager = MidiManagerClass;
            releaseReferences(MidiManager, 'm_pVorbis');
            const LRUHashCache = LRUHashCacheClass;
            releaseReferences(LRUHashCache, 'referenceFactory');
            if (guard !== 20413) {
                releaseReferences(LRUHashCache, 'referenceFactory');
            }
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'uh.C(' + guard + ')');
        }
    }

    // nk.N:[I. Scratch texel array swapped with pixels by RunAnim (nk.<clinit> leaves it null).
    static animBuffer: Int32Array | null = null;

    // qi.P:Z. Set by TextureCache.getTextureData, consumed (animated, then cleared) by TextureCache.RunAnims.
    used = false;
    // qi.D:Ljd;
    private procedural: ProceduralTexture;
    declare private readonly allocation: TextureAllocation;
    declare private repeatS: boolean; // HD uh.Q
    declare private repeatT: boolean; // HD uh.J
    declare private combineMode: number; // HD uh.M
    declare private mipmapMode: number; // HD uh.S
    // qi.Q:Z. First trailing byte == 1: Construct applies the 3x3 box filter.
    private smooth = false;
    // qi.I:Z. Second trailing byte == 1: passed to jd as its column-major (transpose) flag.
    private transposed = false;
    // qi.T:I. Signed byte: texels the image scrolls along a row per tick.
    private scrollX = 0;
    // qi.K:I. Signed byte: rows the image scrolls per tick.
    private scrollY = 0;
    // qi.N:F. The Java float brightness pixels were built at.
    private brightness = 0.0;
    // qi.O:[I
    private pixels: Int32Array | null = null;

    // qi.<init>(Lgd;)V
    // NXT Texture(PacketJ&, ErrorCapture&).
    constructor(packet: PacketT | null) {
        super();
        if (glJar) {
            this.allocation = { id: -1, size: 0, generation: 0 };
            finalizer.register(this, this.allocation);
            try {
                this.procedural = new ProceduralTexture(packet);
                const p = requireNonNull(packet);
                this.smooth = p.g1(-86) === 1;
                this.transposed = p.g1(-80) === 1;
                this.repeatS = p.g1(-67) === 1;
                this.repeatT = p.g1(-114) === 1;
                const mode = p.g1(-35) & 3;
                this.scrollX = p.g1s(false);
                this.scrollY = p.g1s(false);
                const flags = p.g1(-86);
                p.g1(-87);
                this.combineMode = [0, 2, 3, 4][mode];
                this.mipmapMode = (flags & 0xf0) >> 4;
            } catch (error) {
                if (!isJavaRuntimeException(error)) throw error;
                throw WrappedException.wrap(error, 'uh.<init>(' + (packet === null ? 'null' : '{...}') + ')');
            }
            return;
        }
        this.procedural = new ProceduralTexture(packet);
        const p = requireNonNull(packet);
        this.smooth = p.g1() === 1;
        this.transposed = p.g1() === 1;
        p.g1();
        p.g1();
        p.g1(); // 3 & g1() stored to an unused local (var2)
        this.scrollX = p.g1s();
        this.scrollY = p.g1s();
        p.g1();
        p.g1();
    }

    static release(texture: TextureAllocation): void {
        if (texture.id !== -1) {
            const cleaner = GlCleaner;
            cleaner.deleteTexture(texture.id, texture.size, texture.generation);
            texture.size = 0;
            texture.id = -1;
        }
    }

    // HD uh.a(Lve;Lm;IZ)Z. n4 is also the texture scroll divisor after the mipmap loop.
    bind(sprites: Js5 | null, provider: TextureProvider | null, small: boolean): boolean {
        try {
            if (!this.procedural.isReady(provider, sprites)) return false;
            const renderer = (rendererClass ??= GlRenderer);
            const materials = (materialClass ??= MaterialManager);
            const gl = renderer.gl;
            let size = small ? 64 : 128;
            const flags = materials.getMaterialFlags();
            if ((flags & 1) === 0) {
                const texture = this.allocation;
                if (texture.id !== -1) renderer.bindTexture2D(texture.id);
                else {
                    const cleaner = GlCleaner;
                    const name = new Int32Array(1);
                    requireNonNull(gl).glGenTextures(1, name, 0);
                    texture.generation = cleaner.generation;
                    texture.id = name[0];
                    renderer.bindTexture2D(texture.id);
                    let data = ByteBuffer.wrap(this.procedural.getPixelsRgba(size, size, this.transposed, provider, 0.7, sprites));
                    if (this.mipmapMode === 2) {
                        const GLU = GLUClass;
                        new GLU().gluBuild2DMipmaps(GL.GL_TEXTURE_2D, GL.GL_RGBA, size, size, GL.GL_RGBA, GL.GL_UNSIGNED_BYTE, data);
                    } else if (this.mipmapMode === 1) {
                        let level = 0;
                        for (;;) {
                            requireNonNull(gl).glTexImage2D(GL.GL_TEXTURE_2D, level++, GL.GL_RGBA, size, size, 0, GL.GL_RGBA, GL.GL_UNSIGNED_BYTE, data);
                            size >>= 1;
                            if (size === 0) break;
                            data = ByteBuffer.wrap(this.procedural.getPixelsRgba(size, size, this.transposed, provider, 0.7, sprites));
                        }
                    } else {
                        requireNonNull(gl).glTexImage2D(GL.GL_TEXTURE_2D, 0, GL.GL_RGBA, size, size, 0, GL.GL_RGBA, GL.GL_UNSIGNED_BYTE, data);
                    }
                    const mipmaps = this.mipmapMode === 1 || this.mipmapMode === 2;
                    requireNonNull(gl).glTexParameteri(GL.GL_TEXTURE_2D, GL.GL_TEXTURE_MIN_FILTER, mipmaps ? GL.GL_LINEAR_MIPMAP_LINEAR : GL.GL_LINEAR);
                    requireNonNull(gl).glTexParameteri(GL.GL_TEXTURE_2D, GL.GL_TEXTURE_MAG_FILTER, GL.GL_LINEAR);
                    const bytes = mipmaps ? (Math.imul(4, data.limit()) / 3) | 0 : data.limit();
                    cleaner.textureMemory = (cleaner.textureMemory + bytes - texture.size) | 0;
                    texture.size = bytes;
                    requireNonNull(gl).glTexParameteri(GL.GL_TEXTURE_2D, GL.GL_TEXTURE_WRAP_S, this.repeatS ? GL.GL_REPEAT : GL.GL_CLAMP_TO_EDGE);
                    requireNonNull(gl).glTexParameteri(GL.GL_TEXTURE_2D, GL.GL_TEXTURE_WRAP_T, this.repeatT ? GL.GL_REPEAT : GL.GL_CLAMP_TO_EDGE);
                }
            }
            if ((flags & 2) === 0) renderer.setTextureCombineRgb(this.combineMode);
            if ((flags & 4) === 0) renderer.setTextureCombineAlpha(0);
            if ((flags & 8) === 0) {
                if (this.scrollY !== 0 || this.scrollX !== 0) {
                    const y = Math.fround(Math.fround(Math.imul(this.scrollY, renderer.cycle)) / size);
                    const x = Math.fround(Math.fround(Math.imul(this.scrollX, renderer.cycle)) / size);
                    renderer.translateTexture(x, y, 0);
                } else renderer.resetTextureMatrix();
            }
            return true;
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'uh.F(' + (sprites === null ? 'null' : '{...}') + ',' + (provider === null ? 'null' : '{...}') + ',579100487,' + small + ')');
        }
    }

    // qi.a(Lal;BLpc;)Z
    // Whether every sprite and nested texture the program reads is loaded (jd.a(Lpc;BLal;)Z).
    isReady(sprites: Js5 | null, provider: TextureProvider | null): boolean {
        return this.procedural.isReady(provider, sprites);
    }

    // qi.a(ZBLpc;Lal;)[I
    // Uncached texels at brightness 1.0 with jd's horizontal-flip flag clear, or null when not ready.
    getPixels(small: boolean, provider: TextureProvider | null, sprites: Js5 | null): Int32Array | null {
        if (!this.procedural.isReady(provider, sprites)) {
            return null;
        }
        const var5 = small ? 64 : 128;
        return this.procedural.getPixels(provider, sprites, this.transposed, var5, false, 1.0, var5);
    }

    // qi.a(Lal;Lpc;IFZ)[I
    // NXT Texture::Construct. brightness is a Java float. Rebuilds the cached texels when there are none or the
    // brightness changed (fcmpl: NaN never matches), then smooths them when the smooth flag is set.
    Construct(sprites: Js5 | null, provider: TextureProvider | null, brightness: number, small: boolean): Int32Array | null {
        if (this.pixels === null || this.brightness !== brightness) {
            if (!this.procedural.isReady(provider, sprites)) {
                return null;
            }

            const var6 = small ? 64 : 128;
            this.pixels = this.procedural.getPixels(provider, sprites, this.transposed, var6, true, brightness, var6);
            this.brightness = brightness;
            if (this.smooth) {
                const var7 = new Int32Array(var6);
                const var8 = new Int32Array(var6);
                const var9 = new Int32Array(var6);
                const var10 = new Int32Array(Math.imul(var6, var6));
                const var15 = var6;
                let var14 = var15;
                let var13 = var15;
                const var16 = var6;
                const var17 = (-1 + var15) | 0;
                const var18 = (var16 + -1) | 0;
                const var19 = Math.imul(var16, var15);
                let var20 = 2;
                while (var20 >= 0) {
                    let var11 = var17;
                    while (var11 >= 0) {
                        var14 = (var14 - 1) | 0;
                        const var12 = arrayAtI32(this.pixels, var14);
                        arrayPutI32(var7, var11, (arrayAtI32(var7, var11) + ((var12 & 16751932) >> 16)) | 0);
                        arrayPutI32(var8, var11, (arrayAtI32(var8, var11) + ((var12 & 65307) >> 8)) | 0);
                        arrayPutI32(var9, var11, (arrayAtI32(var9, var11) + (255 & var12)) | 0);
                        var11 = (var11 - 1) | 0;
                    }

                    if (var14 === 0) {
                        var14 = var19;
                    }
                    var20 = (var20 - 1) | 0;
                }

                let var26 = var19;
                let var32 = var18;
                while (var32 >= 0) {
                    let var28 = 1;
                    let var27 = 1;
                    let var31 = 0;
                    let var30 = 0;
                    let var29 = 0;
                    let var11 = 2;
                    while (var11 >= 0) {
                        var28 = (var28 - 1) | 0;
                        var29 = (var29 + arrayAtI32(var7, var28)) | 0;
                        var30 = (var30 + arrayAtI32(var9, var28)) | 0;
                        var31 = (var31 + arrayAtI32(var8, var28)) | 0;
                        if (var28 === 0) {
                            var28 = var15;
                        }
                        var11 = (var11 - 1) | 0;
                    }

                    var11 = var17;
                    while (var11 >= 0) {
                        const var22 = (var31 / 9) | 0;
                        const var23 = (var30 / 9) | 0;
                        const var21 = (var29 / 9) | 0;
                        var26 = (var26 - 1) | 0;
                        arrayPutI32(var10, var26, (var22 << 8) | (var21 << 16) | var23);
                        var27 = (var27 - 1) | 0;
                        var28 = (var28 - 1) | 0;
                        var29 = (var29 + (-arrayAtI32(var7, var27) + arrayAtI32(var7, var28))) | 0;
                        var30 = (var30 + (arrayAtI32(var9, var28) - arrayAtI32(var9, var27))) | 0;
                        var31 = (var31 + (-arrayAtI32(var8, var27) + arrayAtI32(var8, var28))) | 0;
                        if (var28 === 0) {
                            var28 = var15;
                        }

                        if (var27 === 0) {
                            var27 = var15;
                        }
                        var11 = (var11 - 1) | 0;
                    }

                    var11 = var17;
                    while (var11 >= 0) {
                        var13 = (var13 - 1) | 0;
                        const var24 = arrayAtI32(this.pixels, var13);
                        var14 = (var14 - 1) | 0;
                        const var25 = arrayAtI32(this.pixels, var14);
                        arrayPutI32(var7, var11, (arrayAtI32(var7, var11) + (-((16739253 & var24) >> 16) + (255 & (var25 >> 16)))) | 0);
                        arrayPutI32(var8, var11, (arrayAtI32(var8, var11) + (((var25 >> 8) & 255) - (255 & (var24 >> 8)))) | 0);
                        arrayPutI32(var9, var11, (arrayAtI32(var9, var11) + (-(255 & var24) + (var25 & 255))) | 0);
                        var11 = (var11 - 1) | 0;
                    }

                    if (var14 === 0) {
                        var14 = var19;
                    }

                    if (var13 === 0) {
                        var13 = var19;
                    }
                    var32 = (var32 - 1) | 0;
                }

                this.pixels = var10;
            }
        }

        return this.pixels;
    }

    // qi.a(ZI)V
    // NXT Texture::RunAnim. Scrolls the cached texels by ticks * (scrollX, scrollY), wrapping inside each row and
    // across the image, through the shared scratch array, which it then swaps in.
    RunAnim(ticks: number): void {
        if (this.pixels === null) {
            return;
        }
        if (this.scrollY !== 0 || this.scrollX !== 0) {
            if (Texture.animBuffer === null || Texture.animBuffer.length < this.pixels.length) {
                Texture.animBuffer = new Int32Array(this.pixels.length);
            }

            Pix3D.spanTarget?.invalidate(Texture.animBuffer);
            const var3 = this.pixels.length === 4096 ? 64 : 128;
            const var4 = this.pixels.length;
            const var6 = (-1 + var3) | 0;
            const var5 = Math.imul(this.scrollX, ticks);
            const var7 = Math.imul(var3, Math.imul(ticks, this.scrollY));
            const var8 = (var4 - 1) | 0;
            let var9 = 0;
            while (var4 > var9) {
                const var10 = ((var7 + var9) | 0) & var8;
                let var11 = 0;
                while (var3 > var11) {
                    const var12 = (var9 + var11) | 0;
                    const var13 = (var10 + (var6 & ((var5 + var11) | 0))) | 0;
                    arrayPutI32(Texture.animBuffer, var12, arrayAtI32(this.pixels, var13));
                    var11 = (var11 + 1) | 0;
                }

                var9 = (var9 + var3) | 0;
            }

            const var16 = this.pixels;
            this.pixels = Texture.animBuffer;
            Texture.animBuffer = var16;
        }
    }
}
