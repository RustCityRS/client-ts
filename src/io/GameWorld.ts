import { isJavaRuntimeException } from '#/util/JavaException';
import { releaseReferences } from '#/util/StaticReferences';
import WrappedException from '#/util/WrappedException';
import Client from '#/client/Client';
import SafeTime from './SafeTime';
import ClientStream from './ClientStream';
import GameShell from '#/client/GameShell';
import AudioEngine from '#/sound/AudioEngine';
import { runToCompletion } from '#/script/ScriptContinuation';
import { SocketIoError, cancelSocket, discardSocket } from './SocketPlatform';
import type PacketT from './PacketT';
import WorldList from './WorldList';
import JagString, { fromLiteral } from '#/datastruct/JagString';
import { arrayAtObj, arrayPutObj, requireNonNull } from '#/util/JavaArray';
import AbstractWorld from './AbstractWorld';
import WorldCountry from './WorldCountry';
import LocalisedTextClass from '#/ui/LocalisedText';

// qk
export default class GameWorld extends AbstractWorld {
    // HD ba.f(I)V
    static releaseGameWorldStatics(guard: number): void {
        try {
            const LocalisedText = LocalisedTextClass;
            releaseReferences(LocalisedText, 'englishLoadedUpdateList', 'loadedUpdateList');
            releaseReferences(AudioEngine, 'musicPlayer');
            if (guard !== 0) {
                GameShell.m_delTime = 89;
            }
            releaseReferences(LocalisedText, 'germanLevel');
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'ba.A(' + guard + ')');
        }
    }

    static httpPrefix = fromLiteral('http:)4)4'); // gi.q:Lid;

    static noActivity = fromLiteral(')2'); // cd.a:Lid;
    static minId = 0; // ph.j:I
    static maxId = 0; // dg.a:I
    static m_list: (GameWorld | null)[] = []; // ke.y:[Lqk;
    static fetchGeneration = 0; // Browser shutdown cancels any suspended socket read.
    static m_num = 0; // ff.v:I
    static listChecksum = 0; // qa.U:I
    static m_next = 1; // tf.K:I
    static fetchStartTime = 0n; // ga.I:J
    static fetchLength = 0; // ec.i:I
    static worldListBufferPos = 0; // bc.b:I
    static worldListBuffer: Uint8Array | null = null; // ag.j:[B

    id = 0; // qk.w:I
    activity: JagString | null = null; // qk.y:Lid;
    host: JagString | null = null; // qk.D:Lid;

    // qk.<init>()V
    constructor() {
        super();
    }

    // qk.d(I)Loa;
    getCountry(): WorldCountry | null {
        return arrayAtObj(WorldList.countries, this.country);
    }

    // lg.a(ILgd;)V
    static decodeWorldList(packet: PacketT): void {
        const size = packet.gSmart1or2();
        WorldList.countries = new Array<WorldCountry | null>(size).fill(null);
        for (let i = 0; i < size; i++) {
            const country = (WorldList.countries[i] = new WorldCountry());
            country.flag = packet.gSmart1or2();
            country.name = packet.readVersionedJagString();
        }
        GameWorld.minId = packet.gSmart1or2();
        GameWorld.maxId = packet.gSmart1or2();
        GameWorld.m_num = packet.gSmart1or2();
        WorldList.worlds = new Array<GameWorld | null>((1 - GameWorld.minId + GameWorld.maxId) | 0).fill(null);
        for (let i = 0; i < GameWorld.m_num; i++) {
            const offset = packet.gSmart1or2();
            const world = new GameWorld();
            arrayPutObj(WorldList.worlds, offset, world);
            world.country = packet.g1();
            world.flags = packet.g4();
            world.id = (offset + GameWorld.minId) | 0;
            world.activity = packet.readVersionedJagString();
            world.host = packet.readVersionedJagString();
        }
        GameWorld.listChecksum = packet.g4();
        WorldList.loaded = true;
    }

    // uf.a(Lgd;I)V
    static decodePlayerCounts(packet: PacketT): void {
        for (let i = 0; i < GameWorld.m_num; i++) {
            const offset = packet.gSmart1or2();
            let players = packet.g2();
            if (players === 65535) players = -1;
            const world = arrayAtObj(WorldList.worlds, offset);
            if (world !== null) world.players = players;
        }
    }

    // ii.b(II)Lqk;
    static GetByID(id: number): GameWorld | null {
        return WorldList.loaded && id >= GameWorld.minId && GameWorld.maxId >= id ? arrayAtObj(WorldList.worlds, (id - GameWorld.minId) | 0) : null;
    }

    // ti.e(B)Lqk;
    static ListStart(): GameWorld | null {
        GameWorld.m_next = 0;
        return GameWorld.ListNext();
    }

    // bj.b(I)Lqk;
    static ListNext(): GameWorld | null {
        return GameWorld.m_list.length > GameWorld.m_next ? arrayAtObj(GameWorld.m_list, GameWorld.m_next++) : null;
    }

    // se.a(ZBIIZ)V. GameWorld::ListSort(int, bool, int, bool).
    static ListSort(primary: number, reversePrimary: boolean, secondary: number, reverseSecondary: boolean): void {
        GameWorld.ListSort2(0, (GameWorld.m_list.length - 1) | 0, primary, reversePrimary, secondary, reverseSecondary);
    }
    // la.a(IIIIZZZ)V. GameWorld::ListSort(int, int, int, bool, int, bool).
    static ListSort2(low: number, high: number, primary: number, reversePrimary: boolean, secondary: number, reverseSecondary: boolean): void {
        if (high > low) {
            const midpoint = (((high + low) | 0) / 2) | 0;
            let tail = low;
            const pivot = arrayAtObj(GameWorld.m_list, midpoint);
            arrayPutObj(GameWorld.m_list, midpoint, arrayAtObj(GameWorld.m_list, high));
            arrayPutObj(GameWorld.m_list, high, pivot);
            for (let i = low; i < high; i++) {
                if (GameWorld.CompareTo2(arrayAtObj(GameWorld.m_list, i), pivot, primary, reversePrimary, secondary, reverseSecondary) <= 0) {
                    const entry = arrayAtObj(GameWorld.m_list, i);
                    arrayPutObj(GameWorld.m_list, i, arrayAtObj(GameWorld.m_list, tail));
                    arrayPutObj(GameWorld.m_list, tail++, entry);
                }
            }
            arrayPutObj(GameWorld.m_list, high, arrayAtObj(GameWorld.m_list, tail));
            arrayPutObj(GameWorld.m_list, tail, pivot);
            GameWorld.ListSort2(low, (tail - 1) | 0, primary, reversePrimary, secondary, reverseSecondary);
            GameWorld.ListSort2((tail + 1) | 0, high, primary, reversePrimary, secondary, reverseSecondary);
        }
    }

    // jb.c(I)I. The browser socket returns a promise when the Java method blocks on input.
    static ListFetch(): number | Promise<number> {
        const generation = GameWorld.fetchGeneration;
        const result = runToCompletion(
            (function* (): Generator<Promise<unknown>, number | Promise<number>, void> {
                try {
                    if (WorldList.fetchStep === 0) {
                        if (BigInt.asIntN(64, SafeTime.CurrentTimeMillis() - 5000n) < WorldList.lastFetchTime) return 0;
                        if (Client.socketRequest !== null) discardSocket(Client.socketRequest);
                        Client.socketRequest = requireNonNull(GameShell.signlink).openSocket(Client.worldListHost, Client.worldListPort);
                        GameWorld.fetchStartTime = SafeTime.CurrentTimeMillis();
                        WorldList.fetchStep = 1;
                    }
                    if (BigInt.asIntN(64, GameWorld.fetchStartTime + 30000n) < SafeTime.CurrentTimeMillis()) {
                        return GameWorld.onWorldListFetchError(1000);
                    }
                    if (WorldList.fetchStep === 1) {
                        if (requireNonNull(Client.socketRequest).status === 2) return GameWorld.onWorldListFetchError(1001);
                        if (requireNonNull(Client.socketRequest).status !== 1) return -1;
                        Client.stream = new ClientStream(requireNonNull(requireNonNull(Client.socketRequest).result), GameShell.signlink);
                        Client.out.m_pos = 0;
                        Client.socketRequest = null;
                        Client.out.p1(255);
                        Client.out.p4(WorldList.loaded ? GameWorld.listChecksum : 0);
                        requireNonNull(Client.stream).Write(0, Client.out.m_data, Client.out.m_pos);
                        AudioEngine.musicPlayer?.DoneUpdate();
                        AudioEngine.effectsPlayer?.DoneUpdate();
                        let status = 0;
                        yield requireNonNull(Client.stream)
                            .read()
                            .then(value => {
                                status = value;
                            });
                        if (generation !== GameWorld.fetchGeneration) return -1;
                        AudioEngine.musicPlayer?.DoneUpdate();
                        AudioEngine.effectsPlayer?.DoneUpdate();
                        if (status !== 0) return GameWorld.onWorldListFetchError(status);
                        WorldList.fetchStep = 2;
                    }
                    if (WorldList.fetchStep === 2) {
                        if (requireNonNull(Client.stream).GetAvailable(-37) < 2) return -1;
                        let high = 0;
                        yield requireNonNull(Client.stream)
                            .read()
                            .then(value => {
                                high = value;
                            });
                        if (generation !== GameWorld.fetchGeneration) return -1;
                        GameWorld.fetchLength = high << 8;
                        const partialLength = GameWorld.fetchLength;
                        let low = 0;
                        yield requireNonNull(Client.stream)
                            .read()
                            .then(value => {
                                low = value;
                            });
                        if (generation !== GameWorld.fetchGeneration) return -1;
                        GameWorld.fetchLength = (partialLength + low) | 0;
                        GameWorld.worldListBuffer = new Uint8Array(GameWorld.fetchLength);
                        GameWorld.worldListBufferPos = 0;
                        WorldList.fetchStep = 3;
                    }
                    if (WorldList.fetchStep !== 3) return -1;
                    let available = requireNonNull(Client.stream).GetAvailable(-95);
                    if (available < 1) return -1;
                    const remaining = (GameWorld.fetchLength - GameWorld.worldListBufferPos) | 0;
                    if (remaining < available) available = remaining;
                    yield requireNonNull(Client.stream).Read(GameWorld.worldListBuffer, GameWorld.worldListBufferPos, available);
                    if (generation !== GameWorld.fetchGeneration) return -1;
                    GameWorld.worldListBufferPos = (GameWorld.worldListBufferPos + available) | 0;
                    if (GameWorld.worldListBufferPos < GameWorld.fetchLength) return -1;
                    if (!WorldList.decode(requireNonNull(GameWorld.worldListBuffer))) return GameWorld.onWorldListFetchError(1002);
                    GameWorld.m_list = new Array<GameWorld | null>(GameWorld.m_num).fill(null);
                    let next = 0;
                    for (let id = GameWorld.minId; id <= GameWorld.maxId; id++) {
                        const world = GameWorld.GetByID(id);
                        if (world !== null) arrayPutObj(GameWorld.m_list, next++, world);
                    }
                    const closing = requireNonNull(Client.stream).Close();
                    if (closing instanceof Promise) yield closing;
                    if (generation !== GameWorld.fetchGeneration) return -1;
                    GameWorld.worldListBuffer = null;
                    Client.stream = null;
                    WorldList.fetchStep = 0;
                    WorldList.fetchAttempts = 0;
                    WorldList.lastFetchTime = SafeTime.CurrentTimeMillis();
                    return 0;
                } catch (error) {
                    if (!(error instanceof SocketIoError)) throw error;
                    return generation === GameWorld.fetchGeneration ? GameWorld.onWorldListFetchError(1003) : -1;
                }
            })()
        );
        return result instanceof Promise ? Promise.resolve(result) : result;
    }

    static close(): void | Promise<void> {
        GameWorld.fetchGeneration++;
        const closed = cancelSocket();
        WorldList.fetchStep = 0;
        return closed;
    }

    // ka.a(ZLqk;IZILqk;B)I. GameWorld::CompareTo(world, world, int, bool, int, bool).
    static CompareTo2(a: GameWorld | null, b: GameWorld | null, field: number, descending: boolean, secondary: number, reverseSecondary: boolean): number {
        const first = GameWorld.CompareTo(a, b, field, descending);
        if (first !== 0) return descending ? -first | 0 : first;
        if (secondary === -1) return 0;
        const second = GameWorld.CompareTo(a, b, secondary, reverseSecondary);
        return reverseSecondary ? -second | 0 : second;
    }

    // ek.a(BLqk;ZILqk;)I. GameWorld::CompareTo(world, world, int, bool).
    static CompareTo(a: GameWorld | null, b: GameWorld | null, field: number, descending: boolean): number {
        if (field === 1) {
            let left = requireNonNull(a).players;
            let right = requireNonNull(b).players;
            if (!descending) {
                if (right === -1) right = 2001;
                if (left === -1) left = 2001;
            }
            return (left - right) | 0;
        }
        if (field === 2) {
            const left = requireNonNull(requireNonNull(a).getCountry()).name;
            const right = requireNonNull(requireNonNull(b).getCountry()).name;
            return requireNonNull(left).compareCollated(requireNonNull(right));
        }
        if (field === 3) {
            if (requireNonNull(requireNonNull(a).activity).equals(GameWorld.noActivity)) {
                if (requireNonNull(requireNonNull(b).activity).equals(GameWorld.noActivity)) return 0;
                return descending ? -1 : 1;
            }
            if (requireNonNull(requireNonNull(b).activity).equals(GameWorld.noActivity)) return descending ? 1 : -1;
            return requireNonNull(requireNonNull(a).activity).compareCollated(requireNonNull(requireNonNull(b).activity));
        }
        if (field === 4) {
            if (requireNonNull(a).IsLootShare()) return requireNonNull(b).IsLootShare() ? 0 : 1;
            return requireNonNull(b).IsLootShare() ? -1 : 0;
        }
        if (field === 5) {
            if (requireNonNull(a).IsQuickChat()) return requireNonNull(b).IsQuickChat() ? 0 : 1;
            return requireNonNull(b).IsQuickChat() ? -1 : 0;
        }
        if (field === 6) {
            if (requireNonNull(a).IsPVP()) return requireNonNull(b).IsPVP() ? 0 : 1;
            return requireNonNull(b).IsPVP() ? -1 : 0;
        }
        if (field === 7) {
            if (!requireNonNull(a).IsMembers()) return requireNonNull(b).IsMembers() ? -1 : 0;
            return requireNonNull(b).IsMembers() ? 0 : 1;
        }
        return (-requireNonNull(b).id + requireNonNull(a).id) | 0;
    }

    // l.a(IB)I
    static onWorldListFetchError(code: number): number | Promise<number> {
        const stream = Client.stream;
        const finish = (): number => {
            if (stream !== Client.stream) return -1;
            Client.stream = null;
            WorldList.fetchAttempts = (WorldList.fetchAttempts + 1) | 0;
            WorldList.fetchStep = 0;
            if (WorldList.fetchAttempts > 4) {
                WorldList.fetchAttempts = 0;
                return code;
            }
            Client.worldListPort = Client.worldListPort === Client.worldListPrimaryPort ? Client.worldListSecondaryPort : Client.worldListPrimaryPort;
            return -1;
        };
        const closing = stream?.Close();
        return closing instanceof Promise ? closing.then(finish) : finish();
    }
}
