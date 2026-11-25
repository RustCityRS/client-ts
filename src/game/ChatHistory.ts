import Client from '#/client/Client';
import { glJar } from '#/client/ClientVariant';
import { arrayAtI32, arrayAtObj, arrayPutI32, arrayPutObj } from '#/util/JavaArray';
import { isJavaRuntimeException } from '#/util/JavaException';
import WrappedException from '#/util/WrappedException';
import type JagString from '#/datastruct/JagString';

// Chat-line storage and access in the revision 530 client.
export default class ChatHistory {
    // de.t:[I
    static types = new Int32Array(100);
    // jg.z:[I
    static phrases = new Int32Array(100);
    // ui.q:[Lid;
    static text: (JagString | null)[] = new Array(100).fill(null);
    // m.T:[Lid;
    static names: (JagString | null)[] = new Array(100).fill(null);
    // ma.j:[Lid;
    static clans: (JagString | null)[] = new Array(100).fill(null);
    // ve.m:I
    static count = 0;
    // jd.a(ILid;Lid;IILid;)V
    static AddChat(phrase: number, text: JagString | null, clan: JagString | null, type: number, name: JagString | null): void {
        try {
            for (let i = 99; i > 0; i--) {
                arrayPutI32(ChatHistory.types, i, arrayAtI32(ChatHistory.types, i - 1));
                arrayPutObj(ChatHistory.names, i, arrayAtObj(ChatHistory.names, i - 1));
                arrayPutObj(ChatHistory.text, i, arrayAtObj(ChatHistory.text, i - 1));
                arrayPutObj(ChatHistory.clans, i, arrayAtObj(ChatHistory.clans, i - 1));
                arrayPutI32(ChatHistory.phrases, i, arrayAtI32(ChatHistory.phrases, i - 1));
            }
            if (glJar) {
                // HD md.a(IILna;Lna;BLna;)V
                ChatHistory.count = (ChatHistory.count + 1) | 0;
                arrayPutI32(ChatHistory.types, 0, type);
                arrayPutObj(ChatHistory.names, 0, name);
                Client.chatTransmitCycle = Client.transmitCycle;
                arrayPutI32(ChatHistory.phrases, 0, phrase);
                arrayPutObj(ChatHistory.text, 0, text);
                arrayPutObj(ChatHistory.clans, 0, clan);
                return;
            }
            arrayPutObj(ChatHistory.names, 0, name);
            ChatHistory.count = (ChatHistory.count + 1) | 0;
            arrayPutI32(ChatHistory.types, 0, type);
            arrayPutI32(ChatHistory.phrases, 0, phrase);
            Client.chatTransmitCycle = Client.transmitCycle;
            arrayPutObj(ChatHistory.text, 0, text);
            arrayPutObj(ChatHistory.clans, 0, clan);
        } catch (error) {
            if (!glJar || !isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'md.D(' + [phrase, type, text === null ? 'null' : '{...}', clan === null ? 'null' : '{...}', 50, name === null ? 'null' : '{...}'].join(',') + ')');
        }
    }
}
