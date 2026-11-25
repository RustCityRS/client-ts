import { requireNonNull } from '#/util/JavaArray';
import { toJsString } from '#/datastruct/JagString';
import PacketT from './PacketT';

export default class Packet530 extends PacketT {
    get available(): number {
        return requireNonNull(this.m_data).length - this.m_pos;
    }

    gjstr(): string {
        return toJsString(this.gStringNoConversion());
    }
}
