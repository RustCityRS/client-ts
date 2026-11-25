// pc in the revision 530 SD gamepack: the texture source the rasterizers query
// through Pix3D.textureProvider (dc.r) and gj.P. Its only implementation is kg
// (TextureCache). NXT names: jag::oldscape::dash3d::TextureProvider; the method names
// are the TextureCache virtuals (GetTextureData/GetTextureColour/GetTextureSmall/
// GetTextureSolid) where NXT has a symbol. Every pc method carries one obfuscator dummy
// argument that each call site passes as a constant; it is dropped here (the constant is noted).
interface TextureProvider {
    // pc.a(II)Z
    // Dummy second argument (every caller passes 0). kg: G || E[id]; true selects 64x64 texels.
    getTextureSmall(id: number): boolean;

    // pc.b(II)Z
    // Dummy first argument (every caller passes 0). kg: p[id].
    isAvailable(id: number): boolean;

    // pc.c(II)[I
    // Dummy first argument (117). Texels at brightness 1.0, or null when the texture is missing.
    getPixels(id: number): Int32Array | null;

    // pc.a(IB)Z
    // Dummy byte argument (-95). Whether the texture's procedural inputs are loaded.
    isLoaded(id: number): boolean;

    // pc.a(IFI)[I
    // Dummy third argument (15964). brightness is a Java float. Null when the texture is missing.
    getTextureData(id: number, brightness: number): Int32Array | null;

    // pc.a(BI)I
    // Dummy byte argument (-118..-125). The texture's average HSL colour (kg: t[id] & 0xffff).
    getTextureColour(id: number): number;

    // pc.d(II)Z
    // Dummy first argument (every caller passes 0). kg: a[id]; true draws texel 0 instead of skipping it.
    getTextureSolid(id: number): boolean;
}

// HD m. The software archive only implements the pc members above.
export interface HdTextureProvider extends TextureProvider {
    bindTexture(id: number, bind: boolean): void; // m.a(IZ)V
    materialArgument(id: number): number; // m.b(IZ)I
    materialType(id: number): number; // m.g(II)I
    brightness(id: number): number; // m.a(II)I
    grayscaleFactor(id: number): number; // m.h(II)I
    hasFlag4(id: number): boolean; // m.c(II)Z
}

export type { TextureProvider as default };
