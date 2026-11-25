import ClientStream from './ClientStream';
import GameShell from '#/client/GameShell';
import { glJar } from '#/client/ClientVariant';
import TitleScreen from '#/title/TitleScreen';
import JagString from '#/datastruct/JagString';
import { mathRandom } from '#/util/JavaRandom';
import { requireNonNull } from '#/util/JavaArray';
import type { Rebuild } from './GameProtocol';
import PacketT from './PacketT';
import type SuperPacket from './SuperPacket';
import { cancelSocket, discardSocket, SocketIoError } from './SocketPlatform';
import Client from '#/client/Client';
import AudioEngine from '#/sound/AudioEngine';

export interface LoginAccount {
    staffModLevel: number; // mi.E:I
    playerModLevel: number; // tg.r:I
    underage: boolean; // ld.g:Z
    parentalChatConsent: boolean; // d.h:Z
    parentalAdvertConsent: boolean; // aj.Cc:Z
    quickChat: boolean; // qi.Z:Z
    mouseRecorder: boolean; // tj.h:Z
    playerId: number; // mi.y:I
    member: boolean; // da.d:Z
    mapMembers: boolean; // ka.c:Z
}

export interface GameSession {
    outgoing: SuperPacket;
    account: LoginAccount | null;
    rebuild: Rebuild | null;
}

export default class Login {
    static loginType = -1; // fk.cb:I
    static reply = -2; // dg.h:I
    static hopTime = 0; // il.K:I
    static disallowResult = -1; // kl.X:I
    static loops = 0; // nk.U:I
    static worldLookupStep = 0; // pe.P:I
    static worldLookupErrors = 0; // hg.b:I
    static serverKey = 0n; // mh.n:J
    static createRetryCount = 0; // gl.t:I
    static suggestedNames: (JagString | null)[] | null = null; // gj.X:[Lid;
    // Browser socket reads can suspend while the applet is closing.
    generation = 0;
    ticking = false;

    // mg.H:Ljava/math/BigInteger;
    static rsaModulus: bigint | null = BigInt(process.env.LOGIN_RSAN ?? 7162900525229798032761816791230527296329313291232324290237849263501208207972894053929065636522363163621000728841182238772712427862772219676577293600221789n);

    // lg.a(Lid;Lid;II)V
    static requestLogin(username: JagString | null, password: JagString | null, type: number, offset: number): void {
        Login.loginType = type;
        Client.username = username;
        Client.password = password;
        if (requireNonNull(Client.username).equals(JagString.empty) || requireNonNull(Client.password).equals(JagString.empty)) Login.reply = 3;
        else if (Client.selectedWorldId !== -1) Login.beginLogin(0);
        else {
            Login.reply = -3;
            Login.worldLookupStep = 1;
            Client.loginConnectCycles = 0;
            Login.worldLookupErrors = 0;
            const block = new PacketT(128);
            block.p1(10);
            block.p2((99999 * mathRandom.nextDouble()) | 0);
            block.p2(530);
            block.p8(requireNonNull(Client.username).toBase37());
            block.p4((99999999 * mathRandom.nextDouble()) | 0);
            block.pStringNoConversion(requireNonNull(Client.password), 0);
            block.p4((99999999 * mathRandom.nextDouble()) | 0);
            block.rsaEncrypt(Client.rsaExponent, Login.rsaModulus);
            Client.out.m_pos = offset;
            Client.out.p1(210);
            Client.out.p1(block.m_pos);
            Client.out.pArrayBuffer(block.m_data, block.m_pos, 0);
        }
    }

    // ii.b(I)V
    static beginLogin(hopTime: number): void {
        Login.disallowResult = -1;
        Client.socketError = false;
        Client.loginRetryCount = 0;
        Login.reply = -3;
        Login.loops = 0;
        Client.loginStep = 1;
        Login.hopTime = hopTime;
    }

    // wi.d(I)V
    static continueLogin(): void {
        if (Client.loginStep === 5) Client.loginStep = 6;
    }

    static get active(): boolean {
        return Login.worldLookupStep !== 0 || Client.loginStep !== 0;
    }

    // gh.a(Lwf;II)V, opcode 5602
    static clearReply(): void {
        if (Client.loginStep === 0) Login.reply = -2;
    }

    // ig.a(I)V
    async selectLoginWorld(): Promise<void> {
        if (this.ticking || Login.worldLookupStep === 0) return;
        this.ticking = true;
        const generation = this.generation;
        try {
            const cycles = (Client.loginConnectCycles + 1) | 0;
            Client.loginConnectCycles = cycles;
            if (cycles > 1500) {
                if (Client.stream !== null) {
                    Client.stream.Close();
                    Client.stream = null;
                }
                if (Login.worldLookupErrors >= 1) {
                    Login.reply = -5;
                    Login.worldLookupStep = 0;
                    return;
                }
                if (glJar) {
                    Client.loginConnectCycles = 0;
                    Login.worldLookupErrors = (Login.worldLookupErrors + 1) | 0;
                    Login.worldLookupStep = 1;
                    Client.worldListPort = Client.worldListPort === Client.worldListPrimaryPort ? Client.worldListSecondaryPort : Client.worldListPrimaryPort;
                } else {
                    Login.worldLookupErrors = (Login.worldLookupErrors + 1) | 0;
                    Login.worldLookupStep = 1;
                    Client.worldListPort = Client.worldListPrimaryPort === Client.worldListPort ? Client.worldListSecondaryPort : Client.worldListPrimaryPort;
                    Client.loginConnectCycles = 0;
                }
            }
            if (Login.worldLookupStep === 1) {
                if (Client.socketRequest !== null) discardSocket(Client.socketRequest);
                const link = GameShell.signlink;
                if (glJar) {
                    const host = Client.worldListHost;
                    const port = Client.worldListPort;
                    Client.socketRequest = requireNonNull(link).openSocket(host, port);
                } else {
                    const port = Client.worldListPort;
                    const host = Client.worldListHost;
                    Client.socketRequest = requireNonNull(link).openSocket(host, port);
                }
                Login.worldLookupStep = 2;
            }
            if (Login.worldLookupStep === 2) {
                if (requireNonNull(Client.socketRequest).status === 2) throw new SocketIoError('Socket open failed');
                if (requireNonNull(Client.socketRequest).status !== 1) return;
                Client.stream = new ClientStream(requireNonNull(requireNonNull(Client.socketRequest).result), GameShell.signlink);
                Client.socketRequest = null;
                requireNonNull(Client.stream).Write(0, Client.out.m_data, Client.out.m_pos);
                AudioEngine.musicPlayer?.DoneUpdate();
                AudioEngine.effectsPlayer?.DoneUpdate();
                const status = await requireNonNull(Client.stream).read();
                if (generation !== this.generation) return;
                AudioEngine.musicPlayer?.DoneUpdate();
                AudioEngine.effectsPlayer?.DoneUpdate();
                if (status !== 101) {
                    if (glJar) {
                        Login.reply = status;
                        Login.worldLookupStep = 0;
                    } else {
                        Login.worldLookupStep = 0;
                        Login.reply = status;
                    }
                    requireNonNull(Client.stream).Close();
                    Client.stream = null;
                    return;
                }
                Login.worldLookupStep = 3;
            }
            if (Login.worldLookupStep === 3) {
                if (requireNonNull(Client.stream).GetAvailable(-19) < 2) return;
                const high = await requireNonNull(Client.stream).read();
                if (generation !== this.generation) return;
                const low = await requireNonNull(Client.stream).read();
                if (generation !== this.generation) return;
                TitleScreen.SwitchToWorld((high << 8) | low);
                if (Client.selectedWorldId === -1) {
                    Login.worldLookupStep = 0;
                    Login.reply = 6;
                    requireNonNull(Client.stream).Close();
                    Client.stream = null;
                } else {
                    Login.worldLookupStep = 0;
                    requireNonNull(Client.stream).Close();
                    Client.stream = null;
                    Login.beginLogin(0);
                }
            }
        } catch (error) {
            if (generation !== this.generation) return;
            if (!(error instanceof SocketIoError)) throw error;
            if (Client.stream !== null) {
                Client.stream.Close();
                Client.stream = null;
            }
            if (Login.worldLookupErrors >= 1) {
                Login.reply = -4;
                Login.worldLookupStep = 0;
            } else if (glJar) {
                Client.worldListPort = Client.worldListPort === Client.worldListPrimaryPort ? Client.worldListSecondaryPort : Client.worldListPrimaryPort;
                Login.worldLookupStep = 1;
                Client.loginConnectCycles = 0;
                Login.worldLookupErrors = (Login.worldLookupErrors + 1) | 0;
            } else {
                Login.worldLookupErrors = (Login.worldLookupErrors + 1) | 0;
                Client.worldListPort = Client.worldListPrimaryPort === Client.worldListPort ? Client.worldListSecondaryPort : Client.worldListPrimaryPort;
                Login.worldLookupStep = 1;
                Client.loginConnectCycles = 0;
            }
        } finally {
            this.ticking = false;
        }
    }

    close(): void | Promise<void> {
        this.generation++;
        const closed = cancelSocket();
        Client.loginStep = Login.worldLookupStep = 0;
        return closed;
    }
}
