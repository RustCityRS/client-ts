import { isJavaRuntimeException } from '#/util/JavaException';
import { releaseReferences } from '#/util/StaticReferences';
import WrappedException from '#/util/WrappedException';
import { loadClient, loadDelayedStateChange, loadLocalisedText, loadScriptRunner } from '#/util/GamepackClasses';
// ma in the revision 530 SD gamepack (NXT jag::oldscape::dash3d::QuickGround): an unshaped tile (the plain underlay,
// or a full overlay), drawn as two triangles. world.SetGround creates it. Field names follow the rev 225 QuickGround.
//
// None of ma's statics belong here: e and k are invocation counters, ma.b(B)V is a null-only unload, and a, b, g, j,
// n, ma.a(B) and ma.a([BI) are placed in other classes by the member map.
export default class QuickGround {
    // HD rh.a(B)V
    static releaseHdStatics(guard: number): void {
        try {
            const DelayedStateChange = loadDelayedStateChange();
            releaseReferences(DelayedStateChange, 'immediate');
            const Client = loadClient();
            releaseReferences(Client, 'activeClient');
            const LocalisedText = loadLocalisedText();
            releaseReferences(LocalisedText, 'frenchOk');
            const ScriptRunner = loadScriptRunner();
            releaseReferences(ScriptRunner, 'intLocals');
            releaseReferences(Client, 'p12');
            if (guard !== -58) {
                releaseReferences(DelayedStateChange, 'immediate');
            }
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'rh.A(' + guard + ')');
        }
    }

    // ma.c:I
    colourSE: number;
    // ma.d:Z
    flat: boolean;
    // ma.f:I
    colourSW: number;
    // ma.h:I
    colourNW: number;
    // ma.i:I
    // 12345678 marks a hidden tile (world.Fill then draws it only for mouse picking).
    colourNE: number;
    // ma.l:I
    // The texture id, or -1.
    texture: number;
    // ma.m:I
    minimapRgb: number;

    // ma.<init>(IIIIIIZ)V
    // var1 = colourSW, var2 = colourSE, var3 = colourNE, var4 = colourNW, var5 = texture, var6 = minimapRgb,
    // var7 = flat. Stores in bytecode order: the d = true field initializer, then f, m, h, l, c, i and d.
    constructor(var1: number, var2: number, var3: number, var4: number, var5: number, var6: number, var7: boolean) {
        this.flat = true;
        this.colourSW = var1;
        this.minimapRgb = var6;
        this.colourNW = var4;
        this.texture = var5;
        this.colourSE = var2;
        this.colourNE = var3;
        this.flat = var7;
    }
}
