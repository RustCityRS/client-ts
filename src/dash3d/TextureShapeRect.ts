import { isJavaRuntimeException } from '#/util/JavaException';
import { releaseReferences } from '#/util/StaticReferences';
import WrappedException from '#/util/WrappedException';
import TextureShape from './TextureShape';
import type PacketT from '#/io/PacketT';
import { requireNonNull } from '#/util/JavaArray';
import TextureShapeRaster from './TextureShapeRaster';
import { loadLocalisedText, loadObjType, loadProtocol, loadWorld } from '#/util/GamepackClasses';

// gg
export default class TextureShapeRect extends TextureShape {
    // HD ta.b(B)V
    static releaseTextureShapeRectStatics(guard: number): void {
        try {
            const ObjType = loadObjType();
            releaseReferences(ObjType, 'wearables');
            const LocalisedText = loadLocalisedText();
            releaseReferences(LocalisedText, 'germanAllocatedMemory', 'englishChooseOption');
            if (guard !== 75) {
                TextureShapeRect.releaseTextureShapeRectStatics(-116);
            }
            releaseReferences(LocalisedText, 'chooseOption');
            const Protocol = loadProtocol();
            releaseReferences(Protocol, 'serverPacketSizes');
            const world = loadWorld();
            releaseReferences(world, 'roofHideMaxZ');
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'ta.C(' + guard + ')');
        }
    }

    private x0: number; // gg.z:I
    private y0: number; // gg.x:I
    private x1: number; // gg.D:I
    private y1: number; // gg.J:I
    // gg.<init>(IIIIIII)V
    constructor(x0: number, y0: number, x1: number, y1: number, fillColour: number, outlineColour: number, thickness: number) {
        super(fillColour, outlineColour, thickness);
        this.x0 = x0;
        this.y0 = y0;
        this.x1 = x1;
        this.y1 = y1;
    }
    // vg.a(Lgd;I)Lgg;
    static decode(packet: PacketT | null): TextureShapeRect {
        const p = requireNonNull(packet);
        return new TextureShapeRect(p.g2s(), p.g2s(), p.g2s(), p.g2s(), p.g3(), p.g3(), p.g1());
    }
    // gg.a(BII)V
    override fill(width: number, height: number): void {
        const x0 = Math.imul(this.x0, width) >> 12;
        const y0 = Math.imul(this.y0, height) >> 12;
        const x1 = Math.imul(this.x1, width) >> 12;
        const y1 = Math.imul(this.y1, height) >> 12;
        TextureShapeRaster.fillRect(x0, y1, y0, x1, this.fillColour);
    }
    // gg.a(IIB)V
    override fillAndOutline(height: number, width: number): void {
        const x0 = Math.imul(this.x0, width) >> 12;
        const y0 = Math.imul(this.y0, height) >> 12;
        const x1 = Math.imul(this.x1, width) >> 12;
        const y1 = Math.imul(this.y1, height) >> 12;
        TextureShapeRaster.fillRectBordered(this.outlineColour, x1, y1, this.fillColour, this.thickness, y0, x0);
    }
    // gg.b(BII)V
    override outline(width: number, height: number): void {
        const x0 = Math.imul(this.x0, width) >> 12;
        const y0 = Math.imul(this.y0, height) >> 12;
        const x1 = Math.imul(this.x1, width) >> 12;
        const y1 = Math.imul(this.y1, height) >> 12;
        TextureShapeRaster.drawRectOutline(x1, y0, this.thickness, x0, y1, this.outlineColour);
    }
}
