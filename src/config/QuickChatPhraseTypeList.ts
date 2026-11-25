import Client from '#/client/Client';
import QuickChatPhraseType from './QuickChatPhraseType';
import type QuickChatCommandDecoder from './QuickChatCommandDecoder';
import JagString from '#/datastruct/JagString';
import LruHashTable from '#/datastruct/LruHashTable';
import type Js5 from '#/cache/Js5';
import PacketT from '#/io/PacketT';
import { arrayAtI16, arrayPutObj, requireNonNull } from '#/util/JavaArray';

export default class QuickChatPhraseTypeList {
    // ke.p:Lvj;
    static readonly phrases = new LruHashTable<QuickChatPhraseType>(64);
    // a.b:Lal;
    static global: Js5 | null = null;
    // s.Y:Lal;
    static local: Js5 | null = null;
    // fe.Z:I
    static localCount = 0;
    // oj.d:I
    static globalCount = 0;
    // lc.y:Ltc;
    static decoder: QuickChatCommandDecoder | null = null;

    // bc.a(Lal;Ltc;ILal;)V
    static init(global: Js5 | null, decoder: QuickChatCommandDecoder | null, local: Js5 | null): void {
        this.local = local;
        this.decoder = decoder;
        this.global = global;
        if (this.local !== null) this.localCount = this.local.GetFileIdLimit(1);
        if (this.global !== null) this.globalCount = this.global.GetFileIdLimit(1);
    }
    // bb.b(II)Lpe;
    static GetQuickChatPhraseType(id: number): QuickChatPhraseType {
        let type = this.phrases.Find(BigInt(id));
        if (type !== null) return type;
        const bytes = id >= 32768 ? requireNonNull(this.global).GetFile(id & 32767, 1) : requireNonNull(this.local).GetFile(id, 1);
        type = new QuickChatPhraseType();
        if (bytes !== null) type.Decode(new PacketT(bytes));
        if (id >= 32768) type.markGlobal();
        this.phrases.Put(BigInt(id), type);
        return type;
    }
    // ff.a(IBJ[I)Lid;
    static GetDynamicText(command: number, value: bigint, params: Int32Array): JagString {
        if (this.decoder !== null) {
            const word = this.decoder.decodeValue(value, command, params);
            if (word !== null) return word;
        }
        return JagString.fromLong(value);
    }
    // vk.a(BLid;Z)V
    static searchPhrases(query: JagString | null, global: boolean): void {
        let count = 0;
        let ids = new Int16Array(16);
        const needle = requireNonNull(query).toLowerCase();
        const begin = global ? 32768 : 0;
        const end = (begin + (global ? QuickChatPhraseTypeList.globalCount : QuickChatPhraseTypeList.localCount)) | 0;
        for (let id = begin; id < end; id++) {
            const phrase = QuickChatPhraseTypeList.GetQuickChatPhraseType(id);
            if (!phrase.m_searchable || phrase.GetTextDisplay().toLowerCase().indexOf(needle) === -1) continue;
            if (count >= 50) {
                Client.searchResults = null;
                Client.resultCount = -1;
                return;
            }
            if (count >= ids.length) {
                const resize = new Int16Array(ids.length * 2);
                for (let i = 0; i < count; i++) resize[i] = ids[i];
                ids = resize;
            }
            ids[count++] = id;
        }
        Client.resultCount = count;
        Client.searchResults = ids;
        Client.searchResultIndex = 0;
        const names: (JagString | null)[] = new Array(Client.resultCount).fill(null);
        for (let i = 0; i < Client.resultCount; i++) arrayPutObj(names, i, QuickChatPhraseTypeList.GetQuickChatPhraseType(arrayAtI16(ids, i)).GetTextDisplay());
        Client.sortSearchResults(Client.searchResults, names);
    }
}
