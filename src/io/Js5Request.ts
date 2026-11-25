import SecondaryNode from '#/datastruct/SecondaryNode';
import LocalisedText from '#/ui/LocalisedText';
import { isJavaRuntimeException } from '#/util/JavaException';
import { releaseReferences } from '#/util/StaticReferences';
import WrappedException from '#/util/WrappedException';

export default abstract class Js5Request extends SecondaryNode {
    // HD il.f(B)V
    static releaseHdStatics(guard: number): void {
        try {
            releaseReferences(LocalisedText, 'englishCreatedGameworld', 'frenchLoadedWorldList');
            if (guard !== 120) releaseReferences(LocalisedText, 'frenchLoadedTextures');
            releaseReferences(LocalisedText, 'frenchLoadedTextures', 'createdGameworld');
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'il.C(' + guard + ')');
        }
    }

    // df.D:Z
    incomplete = true;
    // df.E:Z
    urgent = false;
    // df.I:Z
    orphan = false;

    // df.<init>()V
    constructor() {
        super();
    }

    // df.c(B)I
    abstract getPercentage(): number;
    // df.e(I)[B
    abstract getData(): Uint8Array | null;
}
