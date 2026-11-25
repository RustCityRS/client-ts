import { isJavaRuntimeException } from '#/util/JavaException';
import { releaseReferences } from '#/util/StaticReferences';
import WrappedException from '#/util/WrappedException';
import { loadPlayerModel } from '#/util/GamepackClasses';
// u
export default abstract class TextureShape {
    // HD kf.a(B)V
    static releaseTextureShapeStatics(guard: number): void {
        try {
            // eslint-disable-next-line @typescript-eslint/no-require-imports -- LocShape stays deferred until kf.a(B)V in TextureShape.releaseTextureShapeStatics.
            const LocShape = (require('./LocShape') as typeof import('./LocShape')).default;
            releaseReferences(LocShape, 'shapeToLayer');
            const PlayerModel = loadPlayerModel();
            releaseReferences(PlayerModel, 'slotNextFramesets');
            if (guard !== -115) {
                releaseReferences(LocShape, 'shapeToLayer');
            }
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'kf.J(' + guard + ')');
        }
    }

    // u.<init>(III)V. u.o:I, u.h:I, u.l:I.
    constructor(
        public fillColour: number,
        public outlineColour: number,
        public thickness: number
    ) {}
    // u.a(BII)V
    abstract fill(width: number, height: number): void;
    // u.b(BII)V
    abstract outline(width: number, height: number): void;
    // u.a(IIB)V
    abstract fillAndOutline(height: number, width: number): void;
}
