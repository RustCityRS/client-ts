import { releaseReferences } from '#/util/StaticReferences';
import { glJar } from '#/client/ClientVariant';
import SecondaryNode from '#/datastruct/SecondaryNode';
import { isJavaRuntimeException } from '#/util/JavaException';
import WrappedException from '#/util/WrappedException';
import { loadClient, loadLocalisedText, loadMinimenu } from '#/util/GamepackClasses';

// vc: the abstract sprite base. Its statics (G, H, J, K, M, N, P, Q, R, S) belong to other logical classes in
// membermap.json; vc.E and vc.L are invocation counters (stripped).
// HD qf is the same class in runescape_gl.jar: the same six fields and the same seven abstract draws plus the final
// centred rotation, implemented by Pix32 (mm) and by the GL sprite GlSprite (cf, GlAlphaSprite el). qf declares no
// member beyond SD vc's. Its statics (M, N, Q, R, S, U, X and qf.a(BII)Lbe;, qf.f(B)V) belong to other logical
// classes in membermap-hd.json; qf.T and qf.Y are invocation counters (stripped).
export default abstract class AbstractSprite extends SecondaryNode {
    // HD qf.f(B)V
    static releaseAbstractSpriteStatics(guard: number): void {
        try {
            const Minimenu = loadMinimenu();
            releaseReferences(Minimenu, 'tooltipComponent', 'npcArrow');
            const LocalisedText = loadLocalisedText();
            releaseReferences(LocalisedText, 'germanChooseOption');
            if (guard !== 108) {
                return;
            }
            releaseReferences(Minimenu, 'targetArrow');
            const Client = loadClient();
            releaseReferences(Client, 'cardMemoryCommand');
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'qf.R(' + guard + ')');
        }
    }

    // SD vc.A:I / HD qf.I:I
    height = 0;
    // SD vc.B:I / HD qf.W:I
    width = 0;
    // SD vc.C:I / HD qf.K:I
    yOffset = 0;
    // SD vc.D:I / HD qf.V:I
    cropH = 0;
    // SD vc.F:I / HD qf.P:I
    xOffset = 0;
    // SD vc.O:I / HD qf.J:I
    cropW = 0;

    // SD vc.a(III)V / HD qf.a(III)V
    abstract drawAlpha(x: number, y: number, alpha: number): void;

    // vc.c(B)V artifact: unload, nulls Q, M, N, G, S, K and H when the applet shuts down (membermap kind artifact).

    // SD vc.a(IIIIII)V / HD qf.a(IIIIII)V
    abstract drawRotated(anchorX: number, anchorY: number, x: number, y: number, angle: number, scale: number): void;

    // SD vc.a(II)V / HD qf.c(II)V
    abstract drawOpaque(x: number, y: number): void;

    // SD vc.a(IIII)V / HD qf.a(IIII)V
    abstract drawScaled(x: number, y: number, width: number, height: number): void;

    // SD vc.b(II)V / HD qf.d(II)V
    abstract drawHFlip(x: number, y: number): void;

    // SD vc.c(II)V / HD qf.e(II)V
    abstract draw(x: number, y: number): void;

    // SD vc.a(IIIII)V / HD qf.b(IIIII)V
    abstract drawScaledAlpha(x: number, y: number, width: number, height: number, alpha: number): void;

    // SD vc.a(IIZII)V / HD qf.a(IIIII)V (SD: dummy true stripped with its `if (!var3) F = -92` guard: of the two calls
    // in lf.a(I[Laj;IIIIIIZI)V one passes true and one passes lf.a's own boolean, which every caller of lf.a passes as
    // true. HD: the parameters are (y, angle, scale, x, dummy); the dummy -1470985020 is stripped with its early
    // `return` guard, and the computation is the same)
    drawRotatedCentred(angle: number, y: number, x: number, scale: number): void {
        try {
            const anchorX = this.cropW << 3;
            x = ((15 & anchorX) + (x << 4)) | 0;
            const anchorY = this.cropH << 3;
            y = ((y << 4) - -(anchorY & 15)) | 0;
            this.drawRotated(anchorX, anchorY, x, y, angle, scale);
        } catch (error) {
            // HD qf.a(IIIII)V wraps its body: throw gj.a(e, "qf.F(" + y + ',' + angle + ',' + scale + ',' + x + ',' +
            // dummy + ')'), with y and x as reassigned above and the dummy always -1470985020. Its SD counterpart
            // vc.a(IIZII)V also wraps it (vc.DA, bytecode 0-76), but the SD port has never carried that context.
            if (!glJar || !isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'qf.F(' + y + ',' + angle + ',' + scale + ',' + x + ',-1470985020)');
        }
    }

    // SD vc.<init>()V / HD qf.<init>()V
    constructor() {
        super();
    }
}
