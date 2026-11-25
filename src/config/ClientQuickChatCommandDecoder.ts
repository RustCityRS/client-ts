import { intDivide } from '#/util/IntUtils';
import { isJavaRuntimeException } from '#/util/JavaException';
import { releaseReferences } from '#/util/StaticReferences';
import WrappedException from '#/util/WrappedException';
import type JagString from '#/datastruct/JagString';
import { arrayAtI32 } from '#/util/JavaArray';
import type QuickChatCommandDecoder from './QuickChatCommandDecoder';
import EnumType from './EnumType';
import ObjType from './ObjType';
import LocalisedTextClass from '#/ui/LocalisedText';
import { loadClient, loadMinimenu, loadWorldMap } from '#/util/GamepackClasses';

export default class ClientQuickChatCommandDecoder implements QuickChatCommandDecoder {
    // HD af.a(B)V
    static releaseHdStatics(guard: number): void {
        try {
            const Minimenu = loadMinimenu();
            releaseReferences(Minimenu, 'playerAction');
            // eslint-disable-next-line @typescript-eslint/no-require-imports -- SD hf stays deferred until af.a(B)V in ClientQuickChatCommandDecoder.releaseHdStatics.
            const AnimFrameSet = (require('#/dash3d/AnimFrameSet') as typeof import('#/dash3d/AnimFrameSet')).default;
            releaseReferences(AnimFrameSet, 'framesArchive');
            const Client = loadClient();
            releaseReferences(Client, 'hintMapedgeSpriteName');
            const WorldMap = loadWorldMap();
            releaseReferences(WorldMap, 'lineBreak');
            intDivide(124, intDivide((guard - 28) | 0, 41));
            const LocalisedText = LocalisedTextClass;
            releaseReferences(LocalisedText, 'germanMembersObject');
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'af.E(' + guard + ')');
        }
    }

    // cd.<init>()V
    constructor() {}
    // cd.a(BJI[I)Lid;
    decodeValue(value: bigint, command: number, params: Int32Array): JagString | null {
        const key = Number(BigInt.asIntN(32, value));
        if (command === 0) return EnumType.List(arrayAtI32(params, 0)).GetOutputString(key);
        if (command === 1 || command === 10) return ObjType.List(key).name;
        if (command === 6 || command === 7 || command === 11) return EnumType.List(arrayAtI32(params, 0)).GetOutputString(key);
        return null;
    }
}
