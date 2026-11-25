import { isJavaRuntimeException } from '#/util/JavaException';
import { releaseReferences } from '#/util/StaticReferences';
import WrappedException from '#/util/WrappedException';
import TextureShape from './TextureShape';
import type PacketT from '#/io/PacketT';
import { requireNonNull } from '#/util/JavaArray';
import Pix2D from '#/graphics/Pix2D';
import { loadPlayerModel } from '#/util/GamepackClasses';

// na
export default class TextureShapeLine extends TextureShape {
    // HD ci.a(Z)V
    static releaseTextureShapeLineStatics(guard: boolean): void {
        try {
            // eslint-disable-next-line @typescript-eslint/no-require-imports -- SD ml stays deferred until ci.a(Z)V in TextureShapeLine.releaseTextureShapeLineStatics.
            const ClientLocAnim = (require('./ClientLocAnim') as typeof import('./ClientLocAnim')).default;
            releaseReferences(ClientLocAnim, 'defaultShadow');
            const PlayerModel = loadPlayerModel();
            releaseReferences(PlayerModel, 'recolourDestinations2Alt');
            if (guard) {
                releaseReferences(PlayerModel, 'recolourDestinations2Alt');
            }
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'ci.C(' + guard + ')');
        }
    }

    private x0: number; // na.C:I
    private y0: number; // na.H:I
    private x1: number; // na.A:I
    private y1: number; // na.E:I
    // na.<init>(IIIIII)V
    constructor(x0: number, y0: number, x1: number, y1: number, outlineColour: number, thickness: number) {
        super(-1, outlineColour, thickness);
        this.x0 = x0;
        this.y0 = y0;
        this.x1 = x1;
        this.y1 = y1;
    }
    // SD jb.a(Lgd;Z)Lna; / HD al.a(ILwa;)Lci;
    static decode(packet: PacketT | null): TextureShapeLine;
    static decode(packet: PacketT | null, guard: number): TextureShapeLine | null;
    static decode(packet: PacketT | null, guard = -5232): TextureShapeLine | null {
        if (guard !== -5232) return null;
        const p = requireNonNull(packet);
        return new TextureShapeLine(p.g2s(), p.g2s(), p.g2s(), p.g2s(), p.g3(), p.g1());
    }
    // na.a(BII)V
    override fill(_width: number, _height: number): void {}
    // na.a(IIB)V
    override fillAndOutline(_height: number, _width: number): void {}
    // na.b(BII)V
    override outline(width: number, height: number): void {
        const x0 = Math.imul(this.x0, width) >> 12;
        const y0 = Math.imul(this.y0, height) >> 12;
        const x1 = Math.imul(this.x1, width) >> 12;
        const y1 = Math.imul(this.y1, height) >> 12;
        Pix2D.drawLine(x1, this.outlineColour, y0, y1, x0);
    }
}
