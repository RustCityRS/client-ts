import { isJavaRuntimeException } from '#/util/JavaException';
import { releaseReferences } from '#/util/StaticReferences';
import WrappedException from '#/util/WrappedException';
import type PacketT from '#/io/PacketT';
import { intDivide, intRemainder } from '#/util/IntUtils';
import { arrayAtI32, arrayAtObj, arrayPutI32, requireNonNull } from '#/util/JavaArray';
import type { ColourImageRow } from './ColourImageCache';
import TextureOp from './TextureOp';
import { loadClient, loadLocalisedText, loadLocType, loadVarpType } from '#/util/GamepackClasses';

// ki
export default class TextureOpTile extends TextureOp {
    // HD gg.h(I)V
    static releaseTextureOpTileStatics(guard: number): void {
        try {
            const LocalisedText = loadLocalisedText();
            releaseReferences(LocalisedText, 'frenchAlreadyIgnored');
            const LocType = loadLocType();
            releaseReferences(LocType, 'defaultName');
            if (guard !== -3) {
                const Client = loadClient();
                Client.findRunesSpriteGroup(null, -114);
            }
            releaseReferences(LocalisedText, 'frenchLoggedIn');
            const VarpType = loadVarpType();
            releaseReferences(VarpType, 'm_pConfigClient');
            const Client = loadClient();
            releaseReferences(Client, 'gcCommand');
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'gg.O(' + guard + ')');
        }
    }

    private horizontalTiles = 4; // ki.Q:I
    private verticalTiles = 4; // ki.Z:I

    // ki.<init>()V
    constructor() {
        super(1, false);
    }

    // ki.a(Lgd;ZI)V
    override decode(packet: PacketT | null, code: number): void {
        if (code === 0) this.horizontalTiles = requireNonNull(packet).g1();
        else if (code === 1) this.verticalTiles = requireNonNull(packet).g1();
    }

    // ki.a(IB)[I
    override getMonochromeOutput(row: number): Int32Array | null {
        const output = requireNonNull(this.monochromeImageCache).get(row);
        if (requireNonNull(this.monochromeImageCache).invalid) {
            const w = intDivide(TextureOp.width, this.horizontalTiles);
            const h = intDivide(TextureOp.height, this.verticalTiles);
            const source = this.getChildMonochromeOutput(0, h > 0 ? intDivide(Math.imul(intRemainder(row, h), TextureOp.height), h) : 0);
            for (let x = 0; x < TextureOp.width; x++) {
                const sample = w > 0 ? intDivide(Math.imul(intRemainder(x, w), TextureOp.width), w) : 0;
                arrayPutI32(output, x, arrayAtI32(source, sample));
            }
        }
        return output;
    }

    // ki.a(ZI)[[I
    override getColourOutput(row: number): ColourImageRow | null {
        const output = requireNonNull(this.colourImageCache).get(row);
        if (requireNonNull(this.colourImageCache).invalid) {
            const w = intDivide(TextureOp.width, this.horizontalTiles);
            const h = intDivide(TextureOp.height, this.verticalTiles);
            const source = this.getChildColourOutput(h > 0 ? intDivide(Math.imul(TextureOp.height, intRemainder(row, h)), h) : 0, 0);
            const r = arrayAtObj(source, 0),
                g = arrayAtObj(source, 1),
                b = arrayAtObj(source, 2);
            const outR = arrayAtObj(output, 0),
                outG = arrayAtObj(output, 1),
                outB = arrayAtObj(output, 2);
            for (let x = 0; x < TextureOp.width; x++) {
                const sample = w > 0 ? intDivide(Math.imul(TextureOp.width, intRemainder(x, w)), w) : 0;
                arrayPutI32(outR, x, arrayAtI32(r, sample));
                arrayPutI32(outG, x, arrayAtI32(g, sample));
                arrayPutI32(outB, x, arrayAtI32(b, sample));
            }
        }
        return output;
    }
}
