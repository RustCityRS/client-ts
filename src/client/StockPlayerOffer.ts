import { isJavaRuntimeException } from '#/util/JavaException';
import { releaseReferences } from '#/util/StaticReferences';
import WrappedException from '#/util/WrappedException';
import type PacketT from '#/io/PacketT';
import { loadClient, loadClientKeyboardListener, loadScriptRunner } from '#/util/GamepackClasses';

// ea
export default class StockPlayerOffer {
    // HD sg.a(I)V
    static releaseHdStatics(guard: number): void {
        try {
            const Client = loadClient();
            releaseReferences(Client, 'settingsParam', 'statXP');
            const ClientKeyboardListener = loadClientKeyboardListener();
            releaseReferences(ClientKeyboardListener, 'codes');
            releaseReferences(Client, 'worldMapArchive');
            const ScriptRunner = loadScriptRunner();
            releaseReferences(ScriptRunner, 'activeComponent');
            if (guard !== 25) {
                releaseReferences(Client, 'worldMapArchive');
            }
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'sg.A(' + guard + ')');
        }
    }

    m_completedGold = 0; // ea.a:I
    m_price = 0; // ea.e:I
    m_addedCount = 0; // ea.g:I
    private flags = 0; // ea.h:B
    m_item = 0; // ea.o:I
    m_completedCount = 0; // ea.r:I

    // ea.<init>()V
    constructor();
    // ea.<init>(Lgd;)V
    constructor(packet: PacketT);
    constructor(packet?: PacketT) {
        if (packet === undefined) return;
        this.flags = packet.g1s();
        this.m_item = packet.g2();
        this.m_price = packet.g4();
        this.m_addedCount = packet.g4();
        this.m_completedCount = packet.g4();
        this.m_completedGold = packet.g4();
    }

    // ea.a(B)I
    GetOfferStatus(): number {
        return this.flags & 7;
    }

    // ea.b(I)I
    GetOfferType(): number {
        return (this.flags & 8) === 8 ? 1 : 0;
    }
}
