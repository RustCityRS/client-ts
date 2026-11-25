import JagString, { fromLiteral } from '#/datastruct/JagString';

// The font group names and stage-50 file count, gathered from scattered statics by the member map.
export default class Fonts {
    // gi.p:Lid; (ld.a looks the p11 group up by this name)
    static p11FullName: JagString | null = fromLiteral('p11_full');
    // mk.I:Lid; (ld.a looks the b12 group up by this name)
    static b12FullName: JagString | null = fromLiteral('b12_full');

    // ha.a(B)I. The stage-50 font total; the only caller (client.java:1874) passes -50, which selects 6, so the
    // `var0 > -12 ? -46` arm is the dummy guard (stripped with the counter).
    static getFileCount(): number {
        return 6;
    }
}
