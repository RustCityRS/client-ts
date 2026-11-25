import { intDivide, intRemainder } from '#/util/IntUtils';
import { isJavaRuntimeException } from '#/util/JavaException';
import { releaseReferences } from '#/util/StaticReferences';
import WrappedException from '#/util/WrappedException';
import Linkable from '#/datastruct/Linkable';
import type JagString from '#/datastruct/JagString';
import { loadClient, loadObjType } from '#/util/GamepackClasses';

export default class FriendChatUser extends Linkable {
    // HD kl.c(I)V
    static releaseFriendChatUserStatics(guard: number): void {
        try {
            intRemainder(41, intDivide((guard + 70) | 0, 32));
            const ObjType = loadObjType();
            releaseReferences(ObjType, 'objCountThousandsColTag');
            const Client = loadClient();
            releaseReferences(Client, 'vorbisArchive');
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'kl.A(' + guard + ')');
        }
    }

    // rf.r:B
    rank = 0;
    // rf.t:Lid;
    name: JagString | null = null;
    // rf.w:Lid;
    worldName: JagString | null = null;
    // rf.z:I
    world = 0;
    // rf.<init>()V
    constructor() {
        super();
    }
}
