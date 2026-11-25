import { isJavaRuntimeException } from '#/util/JavaException';
import { releaseReferences } from '#/util/StaticReferences';
import WrappedException from '#/util/WrappedException';
import { loadClientBuild, loadLocalisedText } from '#/util/GamepackClasses';
import { glJar } from '#/client/ClientVariant';
// si: abstract base of the palette-indexed sprites. Only the instance members live here. Every other static of si
// belongs to another logical class in membermap.json: si.a(IIIIIIIIBI)V is TextureShapeBezier.drawCurve,
// si.a(BLal;Lal;)V is Client.loadFonts, si.b(I)V is Client.lostConnection, si.a(BI)V is VarbitType.cleanCache,
// si.e/si.h are Client.chatPublicMode/username37, si.t is world.groundX, si.u is ClientBuild.ligOff and
// si.d/f/g/i/k/m/p/q/r/s are LocalisedText strings; si.<clinit> initialises only those foreign statics (the strings,
// e, t and u). si.a, si.v, si.w and si.x are invocation counters (stripped).
// HD ok is the same class: the same six instance fields (a width, d yOffset, i cropH, k height, l cropW, m xOffset) and
// the same two abstract draws, implemented by Pix8 (HD ek) and, in the HD jar only, by gl/GlIndexedSprite.ts (HD oh).
// The statics of ok likewise belong to other logical classes (HD member map) and are not declared here.
export default abstract class AbstractIndexedSprite {
    // HD ok.a(I)V
    static releaseHdStatics(guard: number): void {
        try {
            const LocalisedText = loadLocalisedText();
            releaseReferences(LocalisedText, 'germanLoadingTitleScreen');
            if (guard !== 33) {
                const ClientBuild = loadClientBuild();
                ClientBuild.m_ligOff = 15;
            }
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'ok.D(' + guard + ')');
        }
    }

    // SD si.b:I / HD ok.m:I
    xOffset = 0;
    // SD si.c:I / HD ok.i:I
    cropH = 0;
    // SD si.j:I / HD ok.d:I
    yOffset = 0;
    // SD si.l:I / HD ok.a:I
    width = 0;
    // SD si.n:I / HD ok.k:I
    height = 0;
    // SD si.o:I / HD ok.l:I
    cropW = 0;

    // SD si.<init>()V / HD ok.<init>()V
    constructor() {
        if (glJar) void loadClientBuild().m_ligOff; // ok.<clinit> initializes the terrain lightness.
    }

    // si.a(I)V artifact: unload, nulls d, p, r, f, s, k, g, i, m and q when the applet shuts down (the only caller,
    // client.java:1482, passes 0, so the early return between k and g is never taken; membermap kind artifact).

    // SD si.a(II)V / HD ok.a(II)V
    abstract draw(x: number, y: number): void;

    // SD si.a(III)V / HD ok.a(III)V
    abstract drawAlpha(x: number, y: number, alpha: number): void;
}
