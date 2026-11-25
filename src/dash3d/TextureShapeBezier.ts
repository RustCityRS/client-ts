import { isJavaRuntimeException } from '#/util/JavaException';
import { releaseReferences } from '#/util/StaticReferences';
import WrappedException from '#/util/WrappedException';
import TextureShape from './TextureShape';
import type PacketT from '#/io/PacketT';
import { requireNonNull } from '#/util/JavaArray';
import TextureShapeRaster from './TextureShapeRaster';
import Pix2D from '#/graphics/Pix2D';
import { loadClient, loadLocalisedText, loadSpriteLoader } from '#/util/GamepackClasses';

// il
export default class TextureShapeBezier extends TextureShape {
    // HD re.b(B)V
    static releaseTextureShapeBezierStatics(guard: number): void {
        try {
            const Client = loadClient();
            releaseReferences(Client, 'animFramesArchive');
            if (guard !== 100) {
                const SpriteLoader = loadSpriteLoader();
                SpriteLoader.createSprites(-79);
            }
            const LocalisedText = loadLocalisedText();
            releaseReferences(LocalisedText, 'germanWalkHere');
            releaseReferences(Client, 'imageHitmarks');
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 're.C(' + guard + ')');
        }
    }

    private x0: number; // il.F:I
    private y0: number; // il.D:I
    private x1: number; // il.C:I
    private y1: number; // il.E:I
    private x2: number; // il.z:I
    private y2: number; // il.G:I
    private x3: number; // il.y:I
    private y3: number; // il.N:I
    // il.<init>(IIIIIIIIII)V
    constructor(x0: number, y0: number, x1: number, y1: number, x2: number, y2: number, x3: number, y3: number, outlineColour: number, thickness: number) {
        super(-1, outlineColour, thickness);
        this.x0 = x0;
        this.y0 = y0;
        this.x1 = x1;
        this.y1 = y1;
        this.x2 = x2;
        this.y2 = y2;
        this.x3 = x3;
        this.y3 = y3;
    }
    // ak.a(ILgd;)Lil;
    static decode(packet: PacketT | null): TextureShapeBezier {
        const p = requireNonNull(packet);
        return new TextureShapeBezier(p.g2s(), p.g2s(), p.g2s(), p.g2s(), p.g2s(), p.g2s(), p.g2s(), p.g2s(), p.g3(), p.g1());
    }
    // il.a(BII)V
    override fill(_width: number, _height: number): void {}
    // il.a(IIB)V
    override fillAndOutline(_height: number, _width: number): void {}
    // il.b(BII)V
    override outline(width: number, height: number): void {
        const x0 = Math.imul(this.x0, width) >> 12;
        const y0 = Math.imul(this.y0, height) >> 12;
        const x1 = Math.imul(this.x1, width) >> 12;
        const y1 = Math.imul(this.y1, height) >> 12;
        const x2 = Math.imul(this.x2, width) >> 12;
        const y2 = Math.imul(this.y2, height) >> 12;
        const x3 = Math.imul(this.x3, width) >> 12;
        const y3 = Math.imul(this.y3, height) >> 12;
        TextureShapeBezier.drawCurve(y1, x0, x3, this.outlineColour, y3, y2, x1, y0, x2);
    }

    // gh.a(IIIIIIIIII)V
    static drawBezierClipped(x2: number, y1: number, x3: number, y2: number, y0: number, colour: number, x1: number, y3: number, x0: number): void {
        if (x0 === x1 && y1 === y0 && x3 === x2 && y3 === y2) {
            Pix2D.drawLine(x3, colour, y0, y3, x0);
            return;
        }
        let prevX = x0;
        let prevY = y0;
        const startX3 = Math.imul(x0, 3);
        const controlY13 = Math.imul(y1, 3);
        const startY3 = Math.imul(3, y0);
        const controlX13 = Math.imul(3, x1);
        const controlY23 = Math.imul(3, y2);
        const cubicY = (controlY13 + y3 - controlY23 - y0) | 0;
        const controlX23 = Math.imul(3, x2);
        const cubicX = (controlX13 - x0 - controlX23 + x3) | 0;
        const linearX = (controlX13 - startX3) | 0;
        const quadraticY = (startY3 + (controlY23 - controlY13 - controlY13)) | 0;
        const linearY = (controlY13 - startY3) | 0;
        const quadraticX = (startX3 - controlX13 + controlX23 - controlX13) | 0;
        for (let t = 128; t <= 4096; t += 128) {
            const tSquared = Math.imul(t, t) >> 12;
            const tCubed = Math.imul(t, tSquared) >> 12;
            const yCubic = Math.imul(cubicY, tCubed);
            const xCubic = Math.imul(cubicX, tCubed);
            const xQuadratic = Math.imul(tSquared, quadraticX);
            const yQuadratic = Math.imul(tSquared, quadraticY);
            const xLinear = Math.imul(linearX, t);
            const yLinear = Math.imul(linearY, t);
            const nextY = (y0 + (((yQuadratic + yCubic + yLinear) | 0) >> 12)) | 0;
            const nextX = (x0 + (((xCubic + xQuadratic + xLinear) | 0) >> 12)) | 0;
            Pix2D.drawLine(nextX, colour, prevY, nextY, prevX);
            prevX = nextX;
            prevY = nextY;
        }
    }

    // si.a(IIIIIIIIBI)V
    static drawCurve(y1: number, x0: number, x3: number, colour: number, y3: number, y2: number, x1: number, y0: number, x2: number): void {
        if (
            x0 >= TextureShapeRaster.clipMinX &&
            x0 <= TextureShapeRaster.clipMaxX &&
            x1 >= TextureShapeRaster.clipMinX &&
            x1 <= TextureShapeRaster.clipMaxX &&
            x2 >= TextureShapeRaster.clipMinX &&
            TextureShapeRaster.clipMaxX >= x2 &&
            x3 >= TextureShapeRaster.clipMinX &&
            x3 <= TextureShapeRaster.clipMaxX &&
            y0 >= TextureShapeRaster.clipTop &&
            TextureShapeRaster.clipMaxY >= y0 &&
            TextureShapeRaster.clipTop <= y1 &&
            TextureShapeRaster.clipMaxY >= y1 &&
            TextureShapeRaster.clipTop <= y2 &&
            TextureShapeRaster.clipMaxY >= y2 &&
            TextureShapeRaster.clipTop <= y3 &&
            y3 <= TextureShapeRaster.clipMaxY
        ) {
            TextureShapeBezier.drawBezier(y3, x2, y2, x3, x0, y0, x1, colour, y1);
        } else {
            TextureShapeBezier.drawBezierClipped(x2, y1, x3, y2, y0, colour, x1, y3, x0);
        }
    }

    // vi.a(IIIIBIIIII)V
    static drawBezier(y3: number, x2: number, y2: number, x3: number, x0: number, y0: number, x1: number, colour: number, y1: number): void {
        if (x1 === x0 && y1 === y0 && x3 === x2 && y3 === y2) {
            TextureShapeRaster.drawLine(y3, colour, x3, y0, x0);
        } else {
            let prevX = x0;
            let prevY = y0;
            const startX3 = Math.imul(x0, 3);
            const startY3 = Math.imul(3, y0);
            const controlY13 = Math.imul(3, y1);
            const controlX23 = Math.imul(x2, 3);
            const controlY23 = Math.imul(3, y2);
            const controlX13 = Math.imul(x1, 3);
            const cubicX = (x3 - x0 - (controlX23 - controlX13)) | 0;
            const linearX = (controlX13 - startX3) | 0;
            const quadraticX = (startX3 - controlX13 + controlX23 - controlX13) | 0;
            const quadraticY = (startY3 - controlY13 + controlY23 - controlY13) | 0;
            const cubicY = (controlY13 + (y3 - controlY23) - y0) | 0;
            const linearY = (controlY13 - startY3) | 0;
            for (let t = 128; t <= 4096; t += 128) {
                const tSquared = Math.imul(t, t) >> 12;
                const tCubed = Math.imul(tSquared, t) >> 12;
                const xQuadratic = Math.imul(tSquared, quadraticX);
                const xCubic = Math.imul(cubicX, tCubed);
                const yCubic = Math.imul(tCubed, cubicY);
                const yQuadratic = Math.imul(tSquared, quadraticY);
                const xLinear = Math.imul(linearX, t);
                const yLinear = Math.imul(linearY, t);
                const nextX = ((((xLinear + xCubic + xQuadratic) | 0) >> 12) + x0) | 0;
                const nextY = (y0 + (((yQuadratic + yCubic + yLinear) | 0) >> 12)) | 0;
                TextureShapeRaster.drawLine(nextY, colour, nextX, prevY, prevX);
                prevY = nextY;
                prevX = nextX;
            }
        }
    }
}
