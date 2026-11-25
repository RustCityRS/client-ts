import TextureShape from './TextureShape';
import type PacketT from '#/io/PacketT';
import { requireNonNull } from '#/util/JavaArray';
import TextureShapeRaster from './TextureShapeRaster';
import Pix2D from '#/graphics/Pix2D';

// v
export default class TextureShapeEllipse extends TextureShape {
    private centreX: number; // v.J:I
    private centreY: number; // v.y:I
    private radiusX: number; // v.H:I
    private radiusY: number; // v.C:I
    // v.<init>(IIIIIII)V
    constructor(centreX: number, centreY: number, radiusX: number, radiusY: number, fillColour: number, outlineColour: number, thickness: number) {
        super(fillColour, outlineColour, thickness);
        this.centreX = centreX;
        this.centreY = centreY;
        this.radiusX = radiusX;
        this.radiusY = radiusY;
    }
    // bf.a(Lgd;B)Lv;
    static decode(packet: PacketT | null): TextureShapeEllipse {
        const p = requireNonNull(packet);
        return new TextureShapeEllipse(p.g2s(), p.g2s(), p.g2s(), p.g2s(), p.g3(), p.g3(), p.g1());
    }
    // v.a(BII)V
    override fill(width: number, height: number): void {
        const centreX = Math.imul(this.centreX, width) >> 12;
        const centreY = Math.imul(this.centreY, height) >> 12;
        const radiusX = Math.imul(this.radiusX, width) >> 12;
        const radiusY = Math.imul(this.radiusY, height) >> 12;
        TextureShapeEllipse.fillEllipse(radiusY, centreY, centreX, this.fillColour, radiusX);
    }
    // v.a(IIB)V
    override fillAndOutline(height: number, width: number): void {
        const centreX = Math.imul(this.centreX, width) >> 12;
        const centreY = Math.imul(this.centreY, height) >> 12;
        const radiusX = Math.imul(this.radiusX, width) >> 12;
        const radiusY = Math.imul(this.radiusY, height) >> 12;
        TextureShapeRaster.drawEllipse(centreX, radiusY, centreY, this.outlineColour, this.thickness, this.fillColour, radiusX);
    }
    // v.b(BII)V
    override outline(_width: number, _height: number): void {}

    // ok.a(IIIZII)V
    static fillEllipse(radiusY: number, y: number, x: number, colour: number, radiusX: number): void {
        if (radiusY === radiusX) {
            TextureShapeRaster.fillCircle(colour, x, y, radiusX);
        } else {
            if (((x - radiusX) | 0) >= TextureShapeRaster.clipMinX && TextureShapeRaster.clipMaxX >= ((radiusX + x) | 0) && TextureShapeRaster.clipTop <= ((y - radiusY) | 0) && TextureShapeRaster.clipMaxY >= ((y + radiusY) | 0)) {
                TextureShapeRaster.fillEllipseUnclipped(colour, x, radiusX, radiusY, y);
            } else {
                Pix2D.fillEllipseClipped(radiusY, y, x, colour, radiusX);
            }
        }
    }
}
