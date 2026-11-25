import GameShell from '#/client/GameShell';
import ClientStream from './ClientStream';
import Protocol from './Protocol';
import JagString from '#/datastruct/JagString';
import { arrayPutObj, requireNonNull } from '#/util/JavaArray';
import { mathRandom } from '#/util/JavaRandom';
import PacketT from './PacketT';
import Client from '#/client/Client';
import AudioEngine from '#/sound/AudioEngine';
import Login from './Login';
import { cancelSocket, discardSocket, SocketIoError } from './SocketPlatform';

export default class AccountCreation {
    static reply = -2; // nb.e:I
    static step = 0; // t.L:I
    static generation = 0;

    // wi.a(IIIII)V
    static checkDateOfBirth(month: number, country: number, year: number, day: number): void {
        Client.out.m_pos = 0;
        Client.out.p1(147);
        Client.out.p1(day);
        Client.out.p1(month);
        Client.out.p2(year);
        Client.out.p2(country);
        Login.createRetryCount = 0;
        AccountCreation.reply = -3;
        AccountCreation.step = 1;
        Client.accountConnectCycles = 0;
    }

    // hh.a(JI)V
    static checkName(name: bigint): void {
        Client.out.m_pos = 0;
        Client.out.p1(186);
        Client.out.p8(name);
        Client.accountConnectCycles = 0;
        AccountCreation.step = 1;
        Login.createRetryCount = 0;
        AccountCreation.reply = -3;
    }

    // me.a(JIIILid;II)V
    static createAccount(name: bigint, country: number, year: number, day: number, password: JagString | null, month: number): void {
        const block = new PacketT(128);
        block.p1(10);
        block.p2((99999 * mathRandom.nextDouble()) | 0);
        block.p2(530);
        block.p8(name);
        block.p4((99999999 * mathRandom.nextDouble()) | 0);
        block.pStringNoConversion(requireNonNull(password), 0);
        block.p4((99999999 * mathRandom.nextDouble()) | 0);
        block.p2(Client.affiliateId);
        block.p1(day);
        block.p1(month);
        block.p4((mathRandom.nextDouble() * 99999999) | 0);
        block.p2(year);
        block.p2(country);
        block.p4((mathRandom.nextDouble() * 99999999) | 0);
        block.rsaEncrypt(Client.rsaExponent, Login.rsaModulus);
        Client.out.m_pos = 0;
        Client.out.p1(36);
        Client.out.p1(block.m_pos);
        Client.out.pArrayBuffer(block.m_data, block.m_pos, 0);
        AccountCreation.step = 1;
        Client.accountConnectCycles = 0;
        AccountCreation.reply = -3;
        Login.createRetryCount = 0;
    }

    // hi.a(I)V
    static async loop(): Promise<void> {
        if (AccountCreation.step === 0) return;
        const generation = AccountCreation.generation;
        try {
            Client.accountConnectCycles = (Client.accountConnectCycles + 1) | 0;
            if (Client.accountConnectCycles > 2000) {
                if (Client.stream !== null) {
                    Client.stream.Close();
                    Client.stream = null;
                }
                if (Login.createRetryCount >= 1) {
                    AccountCreation.step = 0;
                    AccountCreation.reply = -5;
                    return;
                }
                Client.currentPort = Client.currentPort === Client.primaryPort ? Client.secondaryPort : Client.primaryPort;
                Login.createRetryCount = (Login.createRetryCount + 1) | 0;
                Client.accountConnectCycles = 0;
                AccountCreation.step = 1;
            }
            if (AccountCreation.step === 1) {
                if (Client.socketRequest !== null) discardSocket(Client.socketRequest);
                Client.socketRequest = requireNonNull(GameShell.signlink).openSocket(Client.gameHost, Client.currentPort);
                AccountCreation.step = 2;
            }
            if (AccountCreation.step === 2) {
                if (requireNonNull(Client.socketRequest).status === 2) throw new SocketIoError('Socket open failed');
                if (requireNonNull(Client.socketRequest).status !== 1) return;
                Client.stream = new ClientStream(requireNonNull(requireNonNull(Client.socketRequest).result), GameShell.signlink);
                Client.socketRequest = null;
                requireNonNull(Client.stream).Write(0, Client.out.m_data, Client.out.m_pos);
                AudioEngine.musicPlayer?.DoneUpdate();
                AudioEngine.effectsPlayer?.DoneUpdate();
                const status = await requireNonNull(Client.stream).read();
                if (generation !== AccountCreation.generation) return;
                AudioEngine.musicPlayer?.DoneUpdate();
                AudioEngine.effectsPlayer?.DoneUpdate();
                if (status !== 21) {
                    AccountCreation.reply = status;
                    AccountCreation.step = 0;
                    requireNonNull(Client.stream).Close();
                    Client.stream = null;
                    return;
                }
                AccountCreation.step = 3;
            }
            if (AccountCreation.step === 3) {
                if (requireNonNull(Client.stream).GetAvailable(-59) < 1) return;
                const count = await requireNonNull(Client.stream).read();
                if (generation !== AccountCreation.generation) return;
                Login.suggestedNames = new Array<JagString | null>(count).fill(null);
                AccountCreation.step = 4;
            }
            if (AccountCreation.step === 4) {
                if (requireNonNull(Client.stream).GetAvailable(99) < Math.imul(8, requireNonNull(Login.suggestedNames).length)) return;
                Protocol.inPacket.m_pos = 0;
                await requireNonNull(Client.stream).Read(Protocol.inPacket.m_data, 0, Math.imul(8, requireNonNull(Login.suggestedNames).length));
                if (generation !== AccountCreation.generation) return;
                for (let i = 0; i < requireNonNull(Login.suggestedNames).length; i++) {
                    arrayPutObj(Login.suggestedNames, i, JagString.fromBase37(Protocol.inPacket.g8()));
                }
                AccountCreation.step = 0;
                AccountCreation.reply = 21;
                requireNonNull(Client.stream).Close();
                Client.stream = null;
            }
        } catch (error) {
            if (generation !== AccountCreation.generation) return;
            if (!(error instanceof SocketIoError)) throw error;
            if (Client.stream !== null) {
                Client.stream.Close();
                Client.stream = null;
            }
            if (Login.createRetryCount >= 1) {
                AccountCreation.step = 0;
                AccountCreation.reply = -4;
            } else {
                AccountCreation.step = 1;
                Client.accountConnectCycles = 0;
                Login.createRetryCount = (Login.createRetryCount + 1) | 0;
                Client.currentPort = Client.currentPort === Client.primaryPort ? Client.secondaryPort : Client.primaryPort;
            }
        }
    }

    static close(): void | Promise<void> {
        AccountCreation.generation++;
        const closed = AccountCreation.step !== 0 ? cancelSocket() : undefined;
        AccountCreation.step = 0;
        return closed;
    }
}
