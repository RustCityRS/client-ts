import type Js5 from '#/cache/Js5';
import type Pix8 from '#/graphics/Pix8';
import LRUHashCache from '#/datastruct/LRUHashCache';
import PacketT from '#/io/PacketT';
import { requireNonNull } from '#/util/JavaArray';
import { mathRandom } from '#/util/JavaRandom';
import { glJar } from '#/client/ClientVariant';
import { isJavaRuntimeException } from '#/util/JavaException';
import WrappedException from '#/util/WrappedException';
import MSIType from './MSIType';

export default class MSITypeList {
    // n.g:Lal;
    static archive: Js5 | null = null;
    // mj.d:Lal;
    static spritesArchive: Js5 | null = null;
    // gl.D:I
    static redDelta = 0;
    // hj.h:I
    static greenDelta = 0;
    // pj.E:I
    static blueDelta = 0;
    // hj.f:Lve;
    static readonly types = new LRUHashCache<MSIType>(64);
    // mk.A:Lve;
    static readonly spriteCache = new LRUHashCache<Pix8>(64);

    // SD kh.a(Lal;Lal;B)V, HD og.a(Lve;Lve;B)V (archive, sprites, guard).
    static init(sprites: Js5 | null, archive: Js5 | null, guard = -67): void {
        if (glJar) {
            try {
                MSITypeList.spritesArchive = sprites;
                const green = ((21 * mathRandom.nextDouble()) | 0) - 10;
                MSITypeList.archive = archive;
                const blue = ((21 * mathRandom.nextDouble()) | 0) - 10;
                requireNonNull(MSITypeList.archive).GetFileIdLimit(34);
                const red = ((mathRandom.nextDouble() * 21) | 0) - 10;
                const shared = -20 + ((41 * mathRandom.nextDouble()) | 0);
                MSITypeList.blueDelta = shared + blue;
                if (guard !== -67) return;
                MSITypeList.greenDelta = green + shared;
                MSITypeList.redDelta = shared + red;
            } catch (error) {
                if (!isJavaRuntimeException(error)) throw error;
                throw WrappedException.wrap(error, 'og.F(' + (archive === null ? 'null' : '{...}') + ',' + (sprites === null ? 'null' : '{...}') + ',' + guard + ')');
            }
            return;
        }
        MSITypeList.spritesArchive = sprites;
        const green = ((21 * mathRandom.nextDouble()) | 0) - 10;
        MSITypeList.archive = archive;
        requireNonNull(MSITypeList.archive).GetFileIdLimit(34);
        const shared = ((41 * mathRandom.nextDouble()) | 0) - 20;
        MSITypeList.greenDelta = green + shared;
        const blue = ((mathRandom.nextDouble() * 21) | 0) - 10;
        MSITypeList.blueDelta = blue + shared;
        const red = ((21 * mathRandom.nextDouble()) | 0) - 10;
        MSITypeList.redDelta = shared + red;
    }

    // dl.a(II)Lda;
    static List(id: number, group: number): MSIType {
        let type = MSITypeList.types.Find(BigInt(id));
        if (type !== null) return type;
        const bytes = requireNonNull(MSITypeList.archive).GetFile(id, group);
        type = new MSIType();
        if (bytes !== null) type.Decode(new PacketT(bytes), id);
        MSITypeList.types.Put(BigInt(id), type);
        return type;
    }

    // ki.e(B)V
    static removeSoft(): void {
        MSITypeList.types.removeSoft();
        MSITypeList.spriteCache.removeSoft();
    }

    // m.a(II)V
    static CacheClean(age: number): void {
        MSITypeList.types.Clean(age);
        MSITypeList.spriteCache.Clean(age);
    }

    // wd.a(B)V
    static CacheReset(): void {
        MSITypeList.types.Reset();
        MSITypeList.spriteCache.Reset();
    }
}
