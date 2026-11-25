import { isJavaRuntimeException } from '#/util/JavaException';
import { releaseReferences } from '#/util/StaticReferences';
import WrappedException from '#/util/WrappedException';
import { loadByteArrayPool, loadClient, loadClientBuild, loadLocalisedText, loadTitleFlames } from '#/util/GamepackClasses';
export default class BZip2State {
    // HD bb.b(I)V
    static releaseHdStatics(guard: number): void {
        try {
            const LocalisedText = loadLocalisedText();
            releaseReferences(LocalisedText, 'germanChatcol0');
            if (guard !== 2) {
                return;
            }
            const ByteArrayPool = loadByteArrayPool();
            releaseReferences(ByteArrayPool, 'medium');
            const TitleFlames = loadTitleFlames();
            releaseReferences(TitleFlames, 'runesName');
            const Client = loadClient();
            releaseReferences(Client, 'commandPrefix');
            const ClientBuild = loadClientBuild();
            releaseReferences(ClientBuild, 'm_mapl');
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'bb.B(' + guard + ')');
        }
    }

    // me.b:I
    repeatCount = 0;
    // me.c:I
    blockPos = 0;
    // me.d:[B
    symbols: Int8Array;
    // me.e:[[I
    limits: Int32Array[];
    // me.f:[[B
    codeLengths: Int8Array[];
    // me.h:[I
    minLengths = new Int32Array(6);
    // me.i:I
    blockUsed = 0;
    // me.j:[Z
    groupsInUse: Uint8Array;
    // me.l:[I
    frequencies = new Int32Array(256);
    // me.m:I
    blockLength = 0;
    // me.n:[[I
    bases: Int32Array[];
    // me.o:I
    outputRemaining = 0;
    // me.p:B
    lastByte = 0;
    // me.q:[Z
    inUse = new Uint8Array(256);
    // me.r:[B
    input: Uint8Array | null = null;
    // me.t:[B
    selectors: Int8Array;
    // me.y:[B
    output: Uint8Array | null = null;
    // me.z:I
    liveBits = 0;
    // me.A:[I
    mtfBases: Int32Array;
    // me.B:[[I
    permutations: Int32Array[];
    // me.C:I
    currentByte = 0;
    // me.D:[B
    selectorMtf: Int8Array;
    // me.E:I
    nextInput: number;
    // me.F:I
    blockSize100k = 0;
    // me.G:[B
    mtfBytes: Int8Array;
    // me.H:[I
    cumulative: Int32Array;
    // me.I:I
    outputTotal = 0;
    // me.J:I
    symbolCount = 0;
    // me.M:I
    bitBuffer = 0;
    // me.O:I
    inputTotal = 0;
    // me.Q:I
    originalPointer = 0;
    // me.S:I
    nextOutput: number;

    // me.<init>()V
    constructor() {
        this.bases = Array.from({ length: 6 }, () => new Int32Array(258));
        this.selectorMtf = new Int8Array(18002);
        this.selectors = new Int8Array(18002);
        this.mtfBases = new Int32Array(16);
        this.mtfBytes = new Int8Array(4096);
        this.permutations = Array.from({ length: 6 }, () => new Int32Array(258));
        this.limits = Array.from({ length: 6 }, () => new Int32Array(258));
        this.codeLengths = Array.from({ length: 6 }, () => new Int8Array(258));
        this.nextInput = 0;
        this.groupsInUse = new Uint8Array(16);
        this.symbols = new Int8Array(256);
        this.cumulative = new Int32Array(257);
        this.nextOutput = 0;
    }
}
