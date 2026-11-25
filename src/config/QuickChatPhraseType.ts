import { isJavaRuntimeException } from '#/util/JavaException';
import { releaseReferences } from '#/util/StaticReferences';
import WrappedException from '#/util/WrappedException';
import QuickChatPhraseTypeList from './QuickChatPhraseTypeList';
import JagString, { fromLiteral } from '#/datastruct/JagString';
import SecondaryNode from '#/datastruct/SecondaryNode';
import type PacketT from '#/io/PacketT';
import { arrayAtI32, arrayAtObj, requireNonNull } from '#/util/JavaArray';
import LocalisedTextClass from '#/ui/LocalisedText';
import ObjTypeClass from './ObjType';
import MidiManagerClass from '#/sound/MidiManager';
import { loadClient, loadMinimenu, loadTitleScreen } from '#/util/GamepackClasses';

export default class QuickChatPhraseType extends SecondaryNode {
    // HD cb.d(I)V
    static releaseQuickChatPhraseTypeStatics(guard: number): void {
        try {
            if (guard !== -2951) {
                const Client = loadClient();
                releaseReferences(Client, 'nameIconsName');
            }
            const LocalisedText = LocalisedTextClass;
            releaseReferences(LocalisedText, 'englishLoadedTitleScreen');
            const ObjType = ObjTypeClass;
            releaseReferences(ObjType, 'types');
            releaseReferences(LocalisedText, 'loadedTitleScreen');
            const TitleScreen = loadTitleScreen();
            releaseReferences(TitleScreen, 'titleBgName');
            const Minimenu = loadMinimenu();
            releaseReferences(Minimenu, 'opIndexSeparator');
            const Client = loadClient();
            releaseReferences(Client, 'nameIconsName');
            releaseReferences(Minimenu, 'locArrow');
            const MidiManager = MidiManagerClass;
            releaseReferences(MidiManager, 'cache');
            releaseReferences(Client, 'changedInvs');
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'cb.F(' + guard + ')');
        }
    }

    // pe.E:[[I
    private params: Int32Array[] | null = null;
    // pe.I:Z
    m_searchable = true;
    // pe.J:[I
    responses: Int32Array | null = null;
    // pe.N:[Lid;
    private fragments: JagString[] | null = null;
    // pe.ab:[I
    private commands: Int32Array | null = null;
    // mj.c:[I
    static readonly paramCounts = Int32Array.of(1, 0, 0, 0, 1, 0, 2, 1, 1, 1, 0, 2, 0, 0, 1, 0);
    // we.s:[I
    static readonly receiveWidths = Int32Array.of(2, 2, 4, 2, 1, 8, 4, 1, 4, 4, 2, 1, 1, 1, 4, 1);
    // vg.N:[I
    static readonly sendWidths = Int32Array.of(2, 2, 4, 0, 1, 8, 0, 0, 0, 0, 2, 0, 0, 0, 0, 0);
    // fe.O:Lid;
    static readonly empty = fromLiteral('');
    // pk.j:Lid;
    static readonly placeholder = fromLiteral(')3)3)3');

    // pe.<init>()V
    constructor() {
        super();
    }

    // pe.a(ILgd;[I)V
    PackTransmitValues(packet: PacketT, values: Int32Array | null): void {
        if (this.commands !== null) {
            for (let i = 0; i < this.commands.length && i < requireNonNull(values).length; i++) {
                const width = arrayAtI32(QuickChatPhraseType.sendWidths, this.GetDynamicCommand(i));
                if (width > 0) packet.pX(width, BigInt(arrayAtI32(values, i)));
            }
        }
    }
    // pe.a(Lgd;II)V
    private DecodeType(packet: PacketT, opcode: number): void {
        if (opcode === 1) this.fragments = packet.gStringNoConversion().split(60);
        else if (opcode === 2) {
            this.responses = new Int32Array(packet.g1());
            for (let i = 0; i < this.responses.length; i++) this.responses[i] = packet.g2();
        } else if (opcode === 3) {
            const count = packet.g1();
            this.commands = new Int32Array(count);
            this.params = new Array(count).fill(null);
            for (let i = 0; i < count; i++) {
                const command = packet.g2();
                this.commands[i] = command;
                const params = (this.params[i] = new Int32Array(arrayAtI32(QuickChatPhraseType.paramCounts, command)));
                for (let p = 0; p < params.length; p++) params[p] = packet.g2();
            }
        } else if (opcode === 4) this.m_searchable = false;
    }
    // pe.b(Z)V
    markGlobal(): void {
        if (this.responses !== null) for (let i = 0; i < this.responses.length; i++) this.responses[i] |= 32768;
    }
    // pe.d(I)I
    commandCount(): number {
        return this.commands === null ? 0 : this.commands.length;
    }
    // pe.c(Z)Lid;
    GetTextDisplay(): JagString {
        const text = JagString.allocate(80);
        if (this.fragments === null) return QuickChatPhraseType.empty;
        text.append(arrayAtObj(this.fragments, 0));
        for (let i = 1; i < this.fragments.length; i++) {
            text.append(QuickChatPhraseType.placeholder);
            text.append(this.fragments[i]);
        }
        return text.trimToLength();
    }
    // pe.a(II)I
    GetDynamicCommand(index: number): number {
        return this.commands === null || index < 0 || index > this.commands.length ? -1 : arrayAtI32(this.commands, index);
    }
    // pe.a(ZLgd;)V
    Decode(packet: PacketT): void {
        while (true) {
            const op = packet.g1();
            if (op === 0) return;
            this.DecodeType(packet, op);
        }
    }
    // pe.a(ILgd;)Lid;
    GetText(packet: PacketT): JagString {
        const text = JagString.allocate(80);
        if (this.commands !== null)
            for (let i = 0; i < this.commands.length; i++) {
                text.append(arrayAtObj(this.fragments, i));
                const command = this.commands[i],
                    value = packet.gX(arrayAtI32(QuickChatPhraseType.receiveWidths, command));
                text.append(QuickChatPhraseTypeList.GetDynamicText(command, value, arrayAtObj(this.params, i)));
            }
        text.append(arrayAtObj(this.fragments, requireNonNull(this.fragments).length - 1));
        return text.trimToLength();
    }
    // pe.a(IZI)I
    GetDynamicCommandParameter(param: number, index: number): number {
        if (this.commands === null || index < 0 || index > this.commands.length) return -1;
        const params = arrayAtObj(this.params, index);
        return params !== null && param >= 0 && param <= params.length ? arrayAtI32(params, param) : -1;
    }
}
