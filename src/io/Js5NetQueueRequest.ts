import { isJavaRuntimeException } from '#/util/JavaException';
import { releaseReferences } from '#/util/StaticReferences';
import WrappedException from '#/util/WrappedException';
import { requireNonNull } from '#/util/JavaArray';
import Js5Request from './Js5Request';
import type PacketT from './PacketT';
import LocalisedTextClass from '#/ui/LocalisedText';
import { loadWorld, loadWorldMapLabels } from '#/util/GamepackClasses';

export default class Js5NetQueueRequest extends Js5Request {
    // HD pm.g(B)V
    static releaseJs5NetQueueRequestStatics(guard: number): void {
        try {
            const LocalisedText = LocalisedTextClass;
            releaseReferences(LocalisedText, 'englishFriendFirst');
            const world = loadWorld();
            releaseReferences(world, 'mainLevelTiles');
            const WorldMapLabels = loadWorldMapLabels();
            releaseReferences(WorldMapLabels, 'lineBreakTag');
            if (guard < 91) {
                releaseReferences(world, 'mainLevelTiles');
            }
            releaseReferences(LocalisedText, 'friendFirst');
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'pm.O(' + guard + ')');
        }
    }

    // fd.M:B
    m_footerLength = 0;
    // fd.P:Lgd;
    packet: PacketT | null = null;
    // fd.U:I
    blockPosition = 0;

    // fd.<init>()V
    constructor() {
        super();
    }

    // fd.e(I)[B
    override getData(): Uint8Array {
        if (!this.incomplete) {
            const packet = requireNonNull(this.packet);
            const data = requireNonNull(packet.m_data);
            if (packet.m_pos >= ((data.length - this.m_footerLength) | 0)) return data;
        }
        throw new Error('Incomplete JS5 response');
    }

    // fd.c(B)I
    override getPercentage(): number {
        if (this.packet === null) return 0;
        const position = Math.imul(this.packet.m_pos, 100);
        const size = (requireNonNull(this.packet.m_data).length - this.m_footerLength) | 0;
        if (size === 0) throw new RangeError('/ by zero');
        return (position / size) | 0;
    }
}
