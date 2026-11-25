import type Js5 from '#/cache/Js5';
import LruHashTable from '#/datastruct/LruHashTable';
import { glJar } from '#/client/ClientVariant';
import PacketT from '#/io/PacketT';
import { arrayAtI16, arrayAtI8, arrayAtObj, arrayPutI16, arrayPutI8, arrayPutObj, requireNonNull } from '#/util/JavaArray';
import { isJavaRuntimeException } from '#/util/JavaException';
import WrappedException from '#/util/WrappedException';
import type GlSolidTexture from '#/gl/GlSolidTexture';
import type WebGpuGL from '#/gl/driver/WebGpuGL';
import Texture from './Texture';
import type { HdTextureProvider } from './TextureProvider';
import GlRenderer from '#/gl/GlRenderer';
import MaterialManager from '#/gl/material/MaterialManager';
import { loadGlSolidTexture } from '#/util/GamepackClasses';

let materialClass: typeof import('#/gl/material/MaterialManager').default;

// Java i2l does not allocate. Share the immutable JS long representations of common texture IDs.
// Larger IDs use the same conversion without retaining an ever-growing table.
const smallTextureKeys = new Array<bigint | undefined>(1024);
function textureKey(id: number): bigint {
    return id >= 0 && id < smallTextureKeys.length ? (smallTextureKeys[id] ??= BigInt(id)) : BigInt(id);
}

// tf.w (GlRenderer.active). Only the GL gamepack has the flag; with the software gamepack (glJar false) the GL modules
// are never loaded, so GlRenderer is required lazily (the same pattern as SpriteLoader, MinimapBuilder, PixfontGeneric).
function glActive(): boolean {
    return glJar && GlRenderer.active;
}

// kg in the revision 530 SD gamepack: the software texture manager, the only implementation of pc
// (TextureProvider). NXT jag::oldscape::dash3d::TextureCache (TextureCache.h). The constructor decodes the
// per-texture metadata columns from file 0 of group 0 of the metadata archive; textures themselves (qi, Texture)
// are decoded lazily from group <id> file 0 of the textures archive into a capacity-limited LRU (vj).
//
// The pc methods keep TextureProvider's names (the NXT TextureCache virtuals, camelCased in that interface);
// kg's own methods use the NXT names (GetTexture, ClearCache, RunAnims) and setLowMemory for kg.a(IZ)V.
//
// Obfuscator artifacts stripped (constants verified at every call site in the jar):
// - invocation counters kg.w/s/B/v/b/y/j/z/r/F/D and the od.a RuntimeException rethrow wrappers;
// - client.wb opaque branches: every loop below is the wb == 0 path (condition tested first);
// - pc.a(BI)I byte: -124 (lj), -120/-118 (ug), -125 (sb), -118 (al), -120 (dc.a), -121 (dc.b): `> -116 -> -112` dead;
// - pc.a(IB)Z byte: -95 (jd.a(Lpc;BLal;)Z): `!= -95 -> true` dead;
// - pc.a(IFI)[I int: 15964 (dc.a, dc.b): `!= 15964 -> m = null` dead; forwards 15964 + -46777 to qi (see Texture);
// - pc.a(II)Z second int: 0 (fk.f, dc.a, dc.b): its `var2 != 0` arm is constant false;
// - pc.b(II)Z first int: 0 (lj, fc.<init>, al): `!= 0 -> a(-93, 58)` dead;
// - pc.c(II)[I first int: 117 (fk.f): the trap 96 % ((15 - 117) / 36) never throws;
// - pc.d(II)Z first int: 0 (dc.a, dc.b): `!= 0 -> true` dead;
// - kg.a(I)V int: 0 (bf.c(I)V and kg.a(IZ)V): `!= 0 -> g = null` dead; vj.b(I)V gets 0 + 20 (its guard is `!= 20`);
// - kg.a(IZ)V int: gh.a(Lwf;II)V passes its never-reassigned var1 + 22283, and both gh.a callers (li.a, gd.b with
//   byte -89) pass -22368, so -85: the trap 43 % ((-85 + 12) / 61) never throws;
// - kg.b(IB)V byte: -33 (kk.a): the `== -33` body always runs;
// - kg.b(BI)Lqi; byte: 120, 122, 123 (this class only): `<= 59 -> kg.l = null` dead.
// HD runescape_gl.jar's nk is the same class (classmap-hd.json): ClearCache is also nk.b(I)V, and nk.k(II)V
// (setCapacity) is HD only; both members' HD artifacts are listed at the methods. The rest of nk lands with the HD
// texture batches.
// kg's statics belong elsewhere (membermap): kg.a(Z)V unload artifact, kg.b(Z)V Client.GlMoveNpcs, kg.e(II)I
// bitAnd artifact, the fields l/o/x/A/H/K and the localised strings.
export default class TextureCache implements HdTextureProvider {
    // SD kg.q:I / HD nk.J:I. NXT field_56. HD setCapacity replaces it.
    private capacity = 50;
    // kg.G:Z. Forces every texture to 64x64 (GetTextureSmall), set by setLowMemory.
    private lowMemory = false;
    // kg.n:Lal;
    private textures: Js5 | null;
    // kg.C:Lal;. NXT field_80.
    private sprites: Js5 | null;
    // SD kg.k:Lvj; / HD nk.P:Lgn;. NXT field_40. GetTexture's LRU in both jars (SD kg.b(BI)Lqi;, HD nk.i(II)Luh;).
    private recentUse: LruHashTable;
    // SD kg.J:Lvj; / HD nk.G:Lgn;. Only ever null in the SD client; ClearCache resets it when present. HD keeps its
    // 1x1 GL solid-colour textures here (nk.j(II)Lsd;). Both the constructor and setCapacity allocate it while GL is active.
    private secondaryCache: LruHashTable | null;
    // kg.d:[B. Metadata column 5, signed; read but never used by the SD client (HD runescape_gl nk.h, m.a(II)I).
    private byte5: Int8Array;
    // kg.c:[B. Metadata column 8, signed; unused by the SD client (HD nk.Q, m.b(IZ)I).
    private byte8: Int8Array;
    // kg.E:[Z. Metadata column 3: the texture is 64x64 rather than 128x128.
    private small: boolean[];
    // kg.i:[Z. Metadata column 4; unused by the SD client (HD nk.D, m.c(II)Z).
    private flag4: boolean[];
    // kg.a:[Z. Metadata column 2: Pix3D draws texel 0 instead of skipping it (GetTextureSolid).
    private solid: boolean[];
    // kg.m:[B. Metadata column 6, signed; unused by the SD client (HD nk.l, m.h(II)I).
    private byte6: Int8Array;
    // kg.p:[Z. Metadata column 1: models and overlays may use the texture (isAvailable).
    private available: boolean[];
    // kg.h:[Z. Metadata column 0: the texture has a metadata row; every other column is read only for these.
    private exists: boolean[];
    // kg.g:[B. Metadata column 7, signed; unused by the SD client (HD nk.R, m.g(II)I).
    private byte7: Int8Array;
    // kg.t:[S. Metadata column 9: the average HSL colour (GetTextureColour).
    private averageColour: Int16Array;

    // kg.<init>(Lal;Lal;Lal;IZ)V
    // NXT TextureCache(Js5*, Js5*, int, double, int). client.f passes the textures, materials and sprites archives,
    // capacity 20 and the inverted low-memory preference.
    constructor(textures: Js5 | null, meta: Js5 | null, sprites: Js5 | null, capacity: number, lowMemory: boolean) {
        this.lowMemory = lowMemory;
        this.textures = textures;
        this.capacity = capacity;
        this.sprites = sprites;
        this.recentUse = new LruHashTable(this.capacity);
        this.secondaryCache = glActive() ? new LruHashTable(this.capacity) : null;
        const var6 = new PacketT(requireNonNull(meta).GetFile(0, 0));
        const var7 = var6.g2();
        this.byte5 = new Int8Array(var7);
        this.byte8 = new Int8Array(var7);
        this.small = new Array<boolean>(var7).fill(false);
        this.flag4 = new Array<boolean>(var7).fill(false);
        this.solid = new Array<boolean>(var7).fill(false);
        this.byte6 = new Int8Array(var7);
        this.available = new Array<boolean>(var7).fill(false);
        this.exists = new Array<boolean>(var7).fill(false);
        this.byte7 = new Int8Array(var7);
        this.averageColour = new Int16Array(var7);
        for (let var8 = 0; var8 < var7; var8++) {
            arrayPutObj(this.exists, var8, var6.g1() === 1);
        }

        for (let var9 = 0; var9 < var7; var9++) {
            if (arrayAtObj(this.exists, var9)) {
                arrayPutObj(this.available, var9, var6.g1() === 1);
            }
        }

        for (let var10 = 0; var7 > var10; var10++) {
            if (arrayAtObj(this.exists, var10)) {
                arrayPutObj(this.solid, var10, var6.g1() === 1);
            }
        }

        for (let var11 = 0; var11 < var7; var11++) {
            if (arrayAtObj(this.exists, var11)) {
                arrayPutObj(this.small, var11, var6.g1() === 1);
            }
        }

        for (let var12 = 0; var12 < var7; var12++) {
            if (arrayAtObj(this.exists, var12)) {
                arrayPutObj(this.flag4, var12, var6.g1() === 1);
            }
        }

        for (let var13 = 0; var7 > var13; var13++) {
            if (arrayAtObj(this.exists, var13)) {
                arrayPutI8(this.byte5, var13, var6.g1s());
            }
        }

        for (let var14 = 0; var14 < var7; var14++) {
            if (arrayAtObj(this.exists, var14)) {
                arrayPutI8(this.byte6, var14, var6.g1s());
            }
        }

        for (let var15 = 0; var7 > var15; var15++) {
            if (arrayAtObj(this.exists, var15)) {
                arrayPutI8(this.byte7, var15, var6.g1s());
            }
        }

        for (let var16 = 0; var7 > var16; var16++) {
            if (arrayAtObj(this.exists, var16)) {
                arrayPutI8(this.byte8, var16, var6.g1s());
            }
        }

        for (let var17 = 0; var7 > var17; var17++) {
            if (arrayAtObj(this.exists, var17)) {
                arrayPutI16(this.averageColour, var17, (var6.g2() << 16) >> 16);
            }
        }
    }

    // kg.a(BI)I
    // NXT TextureCache::GetTextureColour.
    getTextureColour(id: number): number {
        return arrayAtI16(this.averageColour, id) & 65535;
    }

    // kg.a(IZ)V
    // CS2 6006 (gh.a). NXT TextureCache::SetGamma has the same set-then-ClearCache shape for its gamma.
    setLowMemory(lowMemory: boolean): void {
        this.lowMemory = lowMemory;
        this.ClearCache();
    }

    // kg.a(IB)Z
    isLoaded(id: number): boolean {
        const var3 = this.GetTexture(id);
        return var3 === null ? false : var3.isReady(this.sprites, this);
    }

    // kg.b(BI)Lqi;
    // NXT TextureCache::GetTexture. The LRU hit is checkcast to qi; a miss decodes the texture file, or returns
    // null when the textures archive does not have it yet.
    private GetTexture(id: number): Texture | null {
        const hit = this.recentUse.Find(textureKey(id), id);
        if (hit !== null && !(hit instanceof Texture)) throw new TypeError('ClassCastException: not a Texture');
        let var3: Texture | null = hit;
        if (var3 !== null) {
            return var3;
        }
        const var4 = requireNonNull(this.textures).GetFile(0, id);
        if (var4 === null) {
            return null;
        }
        const var5 = new PacketT(var4);
        var3 = new Texture(var5);
        this.recentUse.Put(textureKey(id), var3);
        return var3;
    }

    // HD nk.a(IZ)V
    bindTexture(id: number, bind: boolean): void {
        try {
            const materials = (materialClass ??= MaterialManager);
            materials.setMaterial(arrayAtI8(this.byte8, id) & 255, arrayAtI8(this.byte7, id) & 255);
            if (!bind) return;
            let ready = false;
            const texture = this.GetTexture(id);
            if (texture !== null) ready = texture.bind(this.sprites, this, this.lowMemory || arrayAtObj(this.small, id));
            if (!ready) this.getSolidTexture(id).bind();
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'nk.G(' + id + ',' + bind + ')');
        }
    }

    getShadowCoverage(id: number, gl: WebGpuGL) {
        const texture = this.GetTexture(id);
        if (!texture?.isReady(this.sprites, this)) return null;
        return texture.shadowCoverage(this.getTextureSmall(id), this, this.sprites, gl.textures.get(texture.glTextureName)?.baseImage()?.data);
    }

    // HD nk.j(II)Lsd;
    private getSolidTexture(id: number): GlSolidTexture {
        try {
            const SolidTexture = loadGlSolidTexture();
            const cached = requireNonNull(this.secondaryCache).Find(textureKey(id), id);
            if (cached !== null) {
                if (!(cached instanceof SolidTexture)) throw new TypeError('ClassCastException: not a GlSolidTexture');
                return cached;
            }
            const texture = new SolidTexture(arrayAtI16(this.averageColour, id) & 65535);
            requireNonNull(this.secondaryCache).Put(textureKey(id), texture);
            return texture;
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'nk.U(48,' + id + ')');
        }
    }

    // HD nk.b(IZ)I, nk.g(II)I, nk.a(II)I, nk.h(II)I and nk.c(II)Z.
    materialArgument(id: number): number {
        return arrayAtI8(this.byte8, id) & 255;
    }
    materialType(id: number): number {
        return arrayAtI8(this.byte7, id) & 255;
    }
    brightness(id: number): number {
        return arrayAtI8(this.byte5, id) & 255;
    }
    grayscaleFactor(id: number): number {
        return arrayAtI8(this.byte6, id) & 255;
    }
    hasFlag4(id: number): boolean {
        return arrayAtObj(this.flag4, id);
    }

    // SD kg.a(I)V / HD nk.b(I)V
    // NXT TextureCache::ClearCache. bf.c(I)V calls it on the provider after a checkcast to kg. In HD, rj.f(B)V
    // (Client.clearCaches, while GL is inactive) and lb.a(Z)V (the window rebuild) call it, both with 0, so its guard
    // `if (arg != 0) return`, placed between the two resets, is dead; HD's gn.c(I)V reset takes the dummy 2, whose
    // `!= 2` arm is dead the same way.
    ClearCache(): void {
        this.recentUse.Reset();
        if (this.secondaryCache !== null) {
            this.secondaryCache.Reset();
        }
    }

    // HD nk.k(II)V. No SD counterpart. The HD window-mode switch (pm.a(ZIZIZII)V) calls it with 200 on entering a
    // GL mode and 20 on returning to software: a new, empty LRU of that capacity, plus a second one while GL is
    // active (GlRenderer.active, tf.w). Stripped: the second argument (pm.a's two calls are the only callers and pass
    // -1, so its guard `if (arg != -1) nk.O = null` is dead) and the nk.K invocation counter.
    setCapacity(capacity: number): void {
        this.capacity = capacity;
        this.recentUse = new LruHashTable(this.capacity);
        if (!glActive()) {
            this.secondaryCache = null;
        } else {
            this.secondaryCache = new LruHashTable(this.capacity);
        }
    }

    // kg.d(II)Z
    // NXT TextureCache::GetTextureSolid.
    getTextureSolid(id: number): boolean {
        return arrayAtObj(this.solid, id);
    }

    // kg.c(II)[I
    // Texels at brightness 1.0 for TextureOpTexture (fk.f), uncached.
    getPixels(id: number): Int32Array | null {
        const var3 = this.GetTexture(id);
        return var3 === null ? null : var3.getPixels(this.lowMemory || arrayAtObj(this.small, id), this, this.sprites);
    }

    // kg.a(II)Z
    // NXT TextureCache::GetTextureSmall.
    getTextureSmall(id: number): boolean {
        return this.lowMemory || arrayAtObj(this.small, id) ? true : false;
    }

    // kg.a(IFI)[I
    // NXT TextureCache::GetTextureData. brightness is a Java float. Marks the texture used for RunAnims.
    getTextureData(id: number, brightness: number): Int32Array | null {
        const var4 = this.GetTexture(id);
        if (var4 === null) {
            return null;
        }
        var4.used = true;
        return var4.Construct(this.sprites, this, brightness, this.lowMemory || arrayAtObj(this.small, id));
    }

    // kg.b(IB)V
    // NXT TextureCache::RunAnims. kk.a (Client.drawScene) passes the elapsed cycles id.p (AreaSoundManager.elapsed).
    // Walks the LRU's hash table in bucket order (vj.a(I)Ljf; then vj.a(B)Ljf;), checkcasting each node to qi.
    RunAnims(ticks: number): void {
        const head = this.recentUse.head();
        if (head !== null && !(head instanceof Texture)) throw new TypeError('ClassCastException: not a Texture');
        let var3: Texture | null = head;
        while (var3 !== null) {
            if (var3.used) {
                var3.RunAnim(ticks);
                var3.used = false;
            }

            const next = this.recentUse.next();
            if (next !== null && !(next instanceof Texture)) throw new TypeError('ClassCastException: not a Texture');
            var3 = next;
        }
    }

    // kg.b(II)Z
    isAvailable(id: number): boolean {
        return arrayAtObj(this.available, id);
    }
}
