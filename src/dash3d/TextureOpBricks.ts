import { isJavaRuntimeException } from '#/util/JavaException';
import { releaseReferences } from '#/util/StaticReferences';
import WrappedException from '#/util/WrappedException';
import type PacketT from '#/io/PacketT';
import ArrayUtils from '#/util/ArrayUtils';
import { intDivide } from '#/util/IntUtils';
import { arrayAtI32, arrayAtObj, arrayPutI32, requireNonNull } from '#/util/JavaArray';
import JavaRandom from '#/util/JavaRandom';
import TextureOp from './TextureOp';
import { loadChatHistory, loadCursorType, loadLocalisedText, loadPlayerModel, loadWorldMap } from '#/util/GamepackClasses';

// hh
export default class TextureOpBricks extends TextureOp {
    // HD mc.h(I)V
    static releaseTextureOpBricksStatics(guard: number): void {
        try {
            intDivide(-31, intDivide((-43 - guard) | 0, 55));
            const CursorType = loadCursorType();
            releaseReferences(CursorType, 'configArchive');
            const LocalisedText = loadLocalisedText();
            LocalisedText['languageCodeDe'] = null;
            LocalisedText['languageCodePt'] = null;
            LocalisedText['languageCodeFr'] = null;
            const WorldMap = loadWorldMap();
            releaseReferences(WorldMap, 'previousMap');
            const PlayerModel = loadPlayerModel();
            releaseReferences(PlayerModel, 'femaleBodyParts');
            releaseReferences(LocalisedText, 'languageCodes');
            const ChatHistory = loadChatHistory();
            releaseReferences(ChatHistory, 'names');
            LocalisedText['languageCodeEn'] = null;
            releaseReferences(WorldMap, 'viewportImage');
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'mc.F(' + guard + ')');
        }
    }

    private yEdges: Int32Array | null = null; // hh.O:[I
    private halfMortar = 0; // hh.T:I
    private mortar = 81; // hh.U:I
    private colours: Int32Array[] | null = null; // hh.V:[[I
    private xEdges: Int32Array[] | null = null; // hh.W:[[I
    private heightVariation = 204; // hh.X:I
    private colourVariation = 1024; // hh.Y:I
    private widthVariation = 409; // hh.db:I
    private columns = 4; // hh.eb:I
    private brickWidth = 0; // hh.gb:I
    private brickHeight = 0; // hh.hb:I
    private rows = 8; // hh.lb:I
    private stagger = 1024; // hh.pb:I
    private yOffset = 0; // hh.rb:I

    // hh.<init>()V
    constructor() {
        super(0, true);
    }

    // hh.a(Lgd;ZI)V
    override decode(packet: PacketT | null, code: number): void {
        switch (code) {
            case 0:
                this.columns = requireNonNull(packet).g1();
                break;
            case 1:
                this.rows = requireNonNull(packet).g1();
                break;
            case 2:
                this.widthVariation = requireNonNull(packet).g2();
                break;
            case 3:
                this.heightVariation = requireNonNull(packet).g2();
                break;
            case 4:
                this.stagger = requireNonNull(packet).g2();
                break;
            case 5:
                this.yOffset = requireNonNull(packet).g2();
                break;
            case 6:
                this.mortar = requireNonNull(packet).g2();
                break;
            case 7:
                this.colourVariation = requireNonNull(packet).g2();
                break;
        }
    }

    // hh.b(I)V
    override postDecode(): void {
        this.prepare();
    }

    // hh.e(B)V
    private prepare(): void {
        const random = new JavaRandom(BigInt(this.rows));
        this.colours = Array.from({ length: this.rows }, () => new Int32Array(this.columns));
        this.brickHeight = intDivide(4096, this.rows);
        this.yEdges = new Int32Array(this.rows + 1);
        this.yEdges[0] = 0;
        const halfHeight = (this.brickHeight / 2) | 0;
        this.halfMortar = (this.mortar / 2) | 0;
        this.xEdges = Array.from({ length: this.rows }, () => new Int32Array(this.columns + 1));
        this.brickWidth = intDivide(4096, this.columns);
        const halfWidth = (this.brickWidth / 2) | 0;
        for (let y = 0; y < this.rows; y++) {
            if (y > 0) {
                const jitter = Math.imul(TextureOp.nextInt(random, 4096) - 2048, this.heightVariation) >> 12;
                this.yEdges[y] = this.yEdges[y - 1] + this.brickHeight + (Math.imul(jitter, halfHeight) >> 12);
            }
            this.xEdges[y][0] = 0;
            for (let x = 0; x < this.columns; x++) {
                if (x > 0) {
                    const jitter = Math.imul(TextureOp.nextInt(random, 4096) - 2048, this.widthVariation) >> 12;
                    this.xEdges[y][x] = this.xEdges[y][x - 1] + this.brickWidth + (Math.imul(halfWidth, jitter) >> 12);
                }
                this.colours[y][x] = this.colourVariation > 0 ? 4096 - TextureOp.nextInt(random, this.colourVariation) : 4096;
            }
            this.xEdges[y][this.columns] = 4096;
        }
        this.yEdges[this.rows] = 4096;
    }

    // hh.a(IB)[I
    override getMonochromeOutput(row: number): Int32Array | null {
        const out = requireNonNull(this.monochromeImageCache).get(row);
        if (requireNonNull(this.monochromeImageCache).invalid) {
            let y = (this.yOffset + arrayAtI32(TextureOp.normalisedY, row)) | 0;
            while (y < 0) y += 4096;
            while (y > 4096) y -= 4096;
            let nextRow = 0;
            while (nextRow < this.rows && y >= arrayAtI32(this.yEdges, nextRow)) nextRow++;
            const prevRow = nextRow - 1;
            const top = arrayAtI32(this.yEdges, prevRow),
                bottom = arrayAtI32(this.yEdges, nextRow);
            if (((this.halfMortar + top) | 0) >= y || ((bottom - this.halfMortar) | 0) <= y) {
                ArrayUtils.fillInts(out, 0, TextureOp.width, 0);
            } else {
                for (let i = 0; i < TextureOp.width; i++) {
                    const offset = (nextRow & 1) === 0 ? this.stagger : -this.stagger;
                    let x = (arrayAtI32(TextureOp.normalisedX, i) + (Math.imul(this.brickWidth, offset) >> 12)) | 0;
                    while (x < 0) x += 4096;
                    while (x > 4096) x -= 4096;
                    let end = 0;
                    while (end < this.columns && arrayAtI32(arrayAtObj(this.xEdges, prevRow), end) <= x) end++;
                    const right = arrayAtI32(arrayAtObj(this.xEdges, prevRow), end);
                    const left = arrayAtI32(arrayAtObj(this.xEdges, prevRow), end - 1);
                    arrayPutI32(out, i, x <= ((left + this.halfMortar) | 0) || ((right - this.halfMortar) | 0) <= x ? 0 : arrayAtI32(arrayAtObj(this.colours, prevRow), end - 1));
                }
            }
        }
        return out;
    }
}
