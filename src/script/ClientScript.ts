import { isJavaRuntimeException } from '#/util/JavaException';
import { releaseReferences } from '#/util/StaticReferences';
import WrappedException from '#/util/WrappedException';
import Client from '#/client/Client';
import HashTable from '#/datastruct/HashTable';
import IntNode from '#/datastruct/IntNode';
import type JagString from '#/datastruct/JagString';
import LruHashTable from '#/datastruct/LruHashTable';
import SecondaryNode from '#/datastruct/SecondaryNode';
import PacketT from '#/io/PacketT';
import { bitCeil } from '#/util/IntUtils';
import { arrayPutI32, arrayPutObj, requireNonNull } from '#/util/JavaArray';
import LocalisedTextClass from '#/ui/LocalisedText';
import FriendChatChannelClass from '#/client/FriendChatChannel';
import ClientVarCacheClass from '#/util/ClientVarCache';
import { loadMinimapBuilder } from '#/util/GamepackClasses';

// m extends ei.
export class ClientScript extends SecondaryNode {
    // HD qc.d(I)V
    static releaseClientScriptStatics(guard: number): void {
        try {
            const LocalisedText = LocalisedTextClass;
            releaseReferences(LocalisedText, 'englishMembersObject', 'membersObject');
            const FriendChatChannel = FriendChatChannelClass;
            releaseReferences(FriendChatChannel, 'members');
            const ClientVarCache = ClientVarCacheClass;
            releaseReferences(ClientVarCache, 'changes');
            const MinimapBuilder = loadMinimapBuilder();
            releaseReferences(MinimapBuilder, 'mapFunctionLocIds');
            if (guard !== -30497) {
                releaseReferences(FriendChatChannel, 'members');
            }
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'qc.E(' + guard + ')');
        }
    }

    static m_cache = new LruHashTable<ClientScript>(128); // sf.g:Lvj;
    stringOperands: (JagString | null)[] | null = null; // m.B:[Lid;
    opcodes: Int32Array | null = null; // m.D:[I
    intLocals = 0; // m.E:I
    intOperands: Int32Array | null = null; // m.F:[I
    stringLocals = 0; // m.I:I
    name: JagString | null = null; // m.J:Lid;
    intArgs = 0; // m.K:I
    switches: (HashTable<IntNode> | null)[] | null = null; // m.N:[Lnc;
    stringArgs = 0; // m.R:I

    // m.<init>()V
    constructor() {
        super();
    }

    // j.a(II)Lm; NXT ClientScript::Get(int). In 530 this method also decodes the script.
    static Get(id: number): ClientScript | null {
        const key = BigInt(id);
        const cached = ClientScript.m_cache.Find(key);
        if (cached !== null) {
            if (!(cached instanceof ClientScript)) throw new TypeError('ClassCastException: not a ClientScript');
            return cached;
        }
        const bytes = requireNonNull(Client.m_pClientScripts).GetFile(0, id);
        if (bytes === null) return null;
        const script = new ClientScript();
        const packet = new PacketT(bytes);
        packet.m_pos = (requireNonNull(packet.m_data).length - 2) | 0;
        const trailerSize = packet.g2();
        const end = (requireNonNull(packet.m_data).length - trailerSize - 14) | 0;
        packet.m_pos = end;
        const count = packet.g4();
        script.intLocals = packet.g2();
        script.stringLocals = packet.g2();
        script.intArgs = packet.g2();
        script.stringArgs = packet.g2();
        const tables = packet.g1();
        if (tables > 0) {
            script.switches = new Array<HashTable<IntNode> | null>(tables).fill(null);
            for (let i = 0; i < tables; i++) {
                let cases = packet.g2();
                const table = new HashTable<IntNode>(bitCeil(cases));
                arrayPutObj(script.switches, i, table);
                while (cases-- > 0) {
                    const value = packet.g4();
                    const offset = packet.g4();
                    table.put(new IntNode(offset), BigInt(value));
                }
            }
        }

        let pc = 0;
        packet.m_pos = 0;
        script.name = packet.readNullableJagString();
        script.opcodes = new Int32Array(count);
        script.stringOperands = new Array<JagString | null>(count).fill(null);
        script.intOperands = new Int32Array(count);
        while (packet.m_pos < end) {
            const opcode = packet.g2();
            if (opcode === 3) {
                arrayPutObj(script.stringOperands, pc, packet.gStringNoConversion());
            } else if (opcode < 100 && opcode !== 21 && opcode !== 38 && opcode !== 39) {
                arrayPutI32(script.intOperands, pc, packet.g4());
            } else {
                arrayPutI32(script.intOperands, pc, packet.g1());
            }
            arrayPutI32(script.opcodes, pc++, opcode);
        }
        ClientScript.m_cache.Put(key, script);
        return script;
    }
}
