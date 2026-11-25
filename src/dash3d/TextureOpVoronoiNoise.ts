import { isJavaRuntimeException } from '#/util/JavaException';
import { releaseReferences } from '#/util/StaticReferences';
import WrappedException from '#/util/WrappedException';
import type PacketT from '#/io/PacketT';
import { doubleToInt } from '#/util/IntUtils';
import { arrayAtI16, arrayAtI32, arrayAtU8, arrayPutI32, requireNonNull } from '#/util/JavaArray';
import JavaRandom from '#/util/JavaRandom';
import TextureOp from './TextureOp';
import { loadClient, loadGameWorld, loadLocalisedText, loadScriptRunner, loadWorldMap } from '#/util/GamepackClasses';

// je
export default class TextureOpVoronoiNoise extends TextureOp {
    // HD hm.h(I)V
    static releaseTextureOpVoronoiNoiseStatics(guard: number): void {
        try {
            const GameWorld = loadGameWorld();
            releaseReferences(GameWorld, 'm_list');
            const WorldMap = loadWorldMap();
            releaseReferences(WorldMap, 'space');
            const LocalisedText = loadLocalisedText();
            releaseReferences(LocalisedText, 'frenchPreparedSoundEngine');
            if (guard !== 0) {
                TextureOpVoronoiNoise.releaseTextureOpVoronoiNoiseStatics(111);
            }
            const ScriptRunner = loadScriptRunner();
            releaseReferences(ScriptRunner, 'img1Tag');
            const Client = loadClient();
            releaseReferences(Client, 'fpsLabel');
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'hm.B(' + guard + ')');
        }
    }

    private jitter = 2048; // je.N:I
    private xCells = 5; // je.O:I
    private offsets: Int16Array | null = new Int16Array(512); // je.P:[S
    private yCells = 5; // je.W:I
    private permutation: Uint8Array | null = new Uint8Array(512); // je.Y:[B
    private seed = 0; // je.eb:I
    private output = 2; // je.fb:I
    private metric = 1; // je.gb:I
    static nearestDistance = 0; // b.O:I
    static secondDistance = 0; // bh.i:I
    static thirdDistance = 0; // u.k:I
    static fourthNearest = 0; // jk.G:I

    // The nine neighbouring sites remain the same across adjacent samples in one cell.
    // This synchronous, callback-free loop shares 18 words of scratch across all operators.
    private static readonly cellSites = new Int32Array(18);

    // je.<init>()V
    constructor() {
        super(0, true);
    }

    // je.a(Lgd;ZI)V
    override decode(packet: PacketT | null, code: number): void {
        switch (code) {
            case 0:
                this.xCells = this.yCells = requireNonNull(packet).g1();
                break;
            case 1:
                this.seed = requireNonNull(packet).g1();
                break;
            case 2:
                this.jitter = requireNonNull(packet).g2();
                break;
            case 3:
                this.output = requireNonNull(packet).g1();
                break;
            case 4:
                this.metric = requireNonNull(packet).g1();
                break;
            case 5:
                this.xCells = requireNonNull(packet).g1();
                break;
            case 6:
                this.yCells = requireNonNull(packet).g1();
                break;
        }
    }

    // je.b(I)V
    override postDecode(): void {
        this.permutation = TextureOp.getPermutation(this.seed);
        this.prepareOffsets();
    }

    // je.f(B)V
    private prepareOffsets(): void {
        const random = new JavaRandom(BigInt(this.seed));
        this.offsets = new Int16Array(512);
        if (this.jitter > 0) {
            for (let i = 0; i < 512; i++) this.offsets[i] = TextureOp.nextInt(random, this.jitter);
        }
    }

    // je.a(IB)[I / HD hm.a(IB)[I. Keep the original scan for short tables and destinations,
    // where Java exposes the four distances computed before an exception.
    private renderCells(dst: Int32Array | null, y: number, cellY: number): boolean {
        const xs = TextureOp.normalisedX;
        const permutation = this.permutation;
        const offsets = this.offsets;
        const width = TextureOp.width;
        const metric = this.metric;
        if (
            (metric !== 0 && metric !== 1 && metric !== 3) ||
            xs === null ||
            xs.length < width ||
            dst === null ||
            dst.length < width ||
            permutation === null ||
            permutation.length < 256 ||
            offsets === null ||
            offsets.length < 512 ||
            dst.buffer === permutation.buffer ||
            dst.buffer === offsets.buffer
        )
            return false;
        const sites = TextureOpVoronoiNoise.cellSites;
        let lastCell = -2147483648;
        for (let i = 0; i < width; i++) {
            const x = (Math.imul(this.xCells, xs[i]) + 2048) | 0;
            const cellX = x >> 12;
            if (cellX !== lastCell) {
                lastCell = cellX;
                let site = 0;
                for (let cy = cellY - 1; cy <= cellY + 1; cy++) {
                    const py = permutation[(cy >= this.yCells ? cy - this.yCells : cy) & 255];
                    for (let cx = cellX - 1; cx <= cellX + 1; cx++) {
                        const index = permutation[((cx >= this.xCells ? cx - this.xCells : cx) + py) & 255] << 1;
                        sites[site++] = (cx << 12) + offsets[index];
                        const dy = (y - offsets[index + 1] - (cy << 12)) | 0;
                        sites[site++] = metric === 3 ? Math.abs(dy) | 0 : Math.imul(dy, dy);
                    }
                }
            }
            // Once the bounds above hold, only the last column's four scratch distances
            // escape this scanline. The common outputs use the nearest one or two sites.
            if (i + 1 < width && this.output >= 0 && this.output <= 2) {
                let first = 2147483647,
                    second = 2147483647;
                for (let site = 0; site < 18; site += 2) {
                    const dx = (x - sites[site]) | 0;
                    let distance = metric === 3 ? Math.max(Math.abs(dx) | 0, sites[site + 1]) : (Math.imul(dx, dx) + sites[site + 1]) | 0;
                    // Java casts sqrt of a negative (overflowed) square to zero.
                    if (metric === 0 && distance < 0) distance = 0;
                    second = Math.min(second, Math.max(distance, first));
                    first = Math.min(first, distance);
                }
                // Shifting or taking sqrt after ranking gives the same distances at ties.
                if (metric === 1) {
                    first >>= 12;
                    second >>= 12;
                } else if (metric === 0) {
                    first = Math.sqrt(Math.fround(first)) | 0;
                    second = Math.sqrt(Math.fround(second)) | 0;
                }
                dst[i] = this.output === 2 ? second - first : this.output === 0 ? first : second;
                continue;
            }
            let first = 2147483647,
                second = 2147483647,
                third = 2147483647,
                fourth = 2147483647;
            for (let site = 0; site < 18; site += 2) {
                const dx = (x - sites[site]) | 0;
                const yTerm = sites[site + 1];
                let distance: number;
                if (metric === 3) {
                    distance = Math.max(Math.abs(dx) | 0, yTerm);
                } else {
                    const square = (Math.imul(dx, dx) + yTerm) | 0;
                    distance = metric === 1 ? square >> 12 : doubleToInt(4096 * Math.sqrt(Math.fround(square) / 16777216));
                }
                if (distance < first) {
                    fourth = third;
                    third = second;
                    second = first;
                    first = distance;
                } else if (distance < second) {
                    fourth = third;
                    third = second;
                    second = distance;
                } else if (distance < third) {
                    fourth = third;
                    third = distance;
                } else if (distance < fourth) {
                    fourth = distance;
                }
            }
            TextureOpVoronoiNoise.nearestDistance = first;
            TextureOpVoronoiNoise.secondDistance = second;
            TextureOpVoronoiNoise.thirdDistance = third;
            TextureOpVoronoiNoise.fourthNearest = fourth;
            switch (this.output) {
                case 0:
                    dst[i] = first;
                    break;
                case 1:
                    dst[i] = second;
                    break;
                case 2:
                    dst[i] = second - first;
                    break;
                case 3:
                    dst[i] = third;
                    break;
                case 4:
                    dst[i] = fourth;
                    break;
            }
        }
        return true;
    }

    // je.a(IB)[I
    override getMonochromeOutput(row: number): Int32Array | null {
        const dst = requireNonNull(this.monochromeImageCache).get(row);
        if (requireNonNull(this.monochromeImageCache).invalid) {
            const y = (2048 + Math.imul(arrayAtI32(TextureOp.normalisedY, row), this.yCells)) | 0;
            const cellY = y >> 12;
            if (this.renderCells(dst, y, cellY)) return dst;
            for (let i = 0; i < TextureOp.width; i++) {
                TextureOpVoronoiNoise.fourthNearest = 2147483647;
                TextureOpVoronoiNoise.thirdDistance = 2147483647;
                TextureOpVoronoiNoise.secondDistance = 2147483647;
                TextureOpVoronoiNoise.nearestDistance = 2147483647;
                const x = (Math.imul(this.xCells, arrayAtI32(TextureOp.normalisedX, i)) + 2048) | 0;
                const cellX = x >> 12;
                for (let cy = cellY - 1; cy <= cellY + 1; cy++) {
                    const py = arrayAtU8(this.permutation, (cy >= this.yCells ? cy - this.yCells : cy) & 255);
                    for (let cx = cellX - 1; cx <= cellX + 1; cx++) {
                        const index = 2 * arrayAtU8(this.permutation, ((cx >= this.xCells ? cx - this.xCells : cx) + py) & 255);
                        const dx = (x - arrayAtI16(this.offsets, index) - (cx << 12)) | 0;
                        const dy = (y - arrayAtI16(this.offsets, index + 1) - (cy << 12)) | 0;
                        let d: number;
                        switch (this.metric) {
                            case 1:
                                d = (Math.imul(dx, dx) + Math.imul(dy, dy)) >> 12;
                                break;
                            case 2:
                                d = (Math.abs(dx) + Math.abs(dy)) | 0;
                                break;
                            case 3:
                                d = Math.max(Math.abs(dx) | 0, Math.abs(dy) | 0);
                                break;
                            case 4: {
                                const rootX = doubleToInt(4096 * Math.sqrt(Math.fround(Math.abs(dx) | 0) / 4096));
                                const rootY = doubleToInt(4096 * Math.sqrt(Math.fround(Math.abs(dy) | 0) / 4096));
                                const sum = (rootX + rootY) | 0;
                                d = Math.imul(sum, sum) >> 12;
                                break;
                            }
                            case 5:
                                d = doubleToInt(4096 * Math.sqrt(Math.sqrt(Math.fround((Math.imul(dy, dy) + Math.imul(dx, dx)) | 0) / 16777216)));
                                break;
                            default:
                                d = doubleToInt(4096 * Math.sqrt(Math.fround((Math.imul(dy, dy) + Math.imul(dx, dx)) | 0) / 16777216));
                        }
                        if (d < TextureOpVoronoiNoise.nearestDistance) {
                            TextureOpVoronoiNoise.fourthNearest = TextureOpVoronoiNoise.thirdDistance;
                            TextureOpVoronoiNoise.thirdDistance = TextureOpVoronoiNoise.secondDistance;
                            TextureOpVoronoiNoise.secondDistance = TextureOpVoronoiNoise.nearestDistance;
                            TextureOpVoronoiNoise.nearestDistance = d;
                        } else if (d < TextureOpVoronoiNoise.secondDistance) {
                            TextureOpVoronoiNoise.fourthNearest = TextureOpVoronoiNoise.thirdDistance;
                            TextureOpVoronoiNoise.thirdDistance = TextureOpVoronoiNoise.secondDistance;
                            TextureOpVoronoiNoise.secondDistance = d;
                        } else if (d < TextureOpVoronoiNoise.thirdDistance) {
                            TextureOpVoronoiNoise.fourthNearest = TextureOpVoronoiNoise.thirdDistance;
                            TextureOpVoronoiNoise.thirdDistance = d;
                        } else if (d < TextureOpVoronoiNoise.fourthNearest) {
                            TextureOpVoronoiNoise.fourthNearest = d;
                        }
                    }
                }
                switch (this.output) {
                    case 0:
                        arrayPutI32(dst, i, TextureOpVoronoiNoise.nearestDistance);
                        break;
                    case 1:
                        arrayPutI32(dst, i, TextureOpVoronoiNoise.secondDistance);
                        break;
                    case 2:
                        arrayPutI32(dst, i, (TextureOpVoronoiNoise.secondDistance - TextureOpVoronoiNoise.nearestDistance) | 0);
                        break;
                    case 3:
                        arrayPutI32(dst, i, TextureOpVoronoiNoise.thirdDistance);
                        break;
                    case 4:
                        arrayPutI32(dst, i, TextureOpVoronoiNoise.fourthNearest);
                        break;
                }
            }
        }
        return dst;
    }
}
