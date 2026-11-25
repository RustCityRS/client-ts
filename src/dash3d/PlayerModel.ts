import { isJavaRuntimeException } from '#/util/JavaException';
import { releaseReferences } from '#/util/StaticReferences';
import WrappedException from '#/util/WrappedException';
import { glJar } from '#/client/ClientVariant';
import type BASType from '#/config/BASType';
import BASTypeList from '#/config/BASTypeList';
import Client from '#/client/Client';
import IdkType from '#/config/IdkType';
import NpcType from '#/config/NpcType';
import ObjType from '#/config/ObjType';
import SeqType from '#/config/SeqType';
import LRUHashCache from '#/datastruct/LRUHashCache';
import { arrayAtI16, arrayAtI32, arrayAtObj, arrayPutI32, arrayPutObj, requireNonNull } from '#/util/JavaArray';
import type ActorSlotAnim from './ActorSlotAnim';
import AnimFrameSet from './AnimFrameSet';
import type ModelLit from './ModelLit';
import ModelUnlit from './ModelUnlit';
import Pix3D from './Pix3D';
import World from './world';
import GlRenderer from '#/gl/GlRenderer';
import { loadGlModel, loadTitleFlames, loadWorldMap } from '#/util/GamepackClasses';

function buildCrc64Table(): BigInt64Array {
    const table = new BigInt64Array(256);
    for (let i = 0; i < 256; i++) {
        let value = BigInt(i);
        for (let bit = 0; bit < 8; bit++) {
            if ((value & 1n) !== 1n) {
                value = BigInt.asIntN(64, BigInt.asUintN(64, value) >> 1n);
            } else {
                value = BigInt.asIntN(64, -3932672073523589310n ^ BigInt.asIntN(64, BigInt.asUintN(64, value) >> 1n));
            }
        }
        table[i] = value;
    }
    return table;
}

// Java long >>> 8 followed by xor with a table entry.
function shiftXor(key: bigint, entry: bigint): bigint {
    return BigInt.asIntN(64, BigInt.asIntN(64, BigInt.asUintN(64, key) >> 8n) ^ entry);
}

// (int)(((long)value ^ key) & 255L)
function crcIndex(value: number, key: bigint): number {
    return Number((BigInt(value | 0) ^ key) & 255n);
}

// cl in the revision 530 SD gamepack (NXT jag::oldscape::rs2lib::PlayerModel): a player's appearance (12 part slots,
// 5 colours, gender, BAS id, optional NPC transform), its model cache key, and the three model builders: the animated
// body (GetTempModel), the chathead (GetHeadModel) and the three-kit chathead of interface model type 7
// (getKitHeadModel, no NXT counterpart).
//
// The builders read the per-game recolour tables the client selects at startup: recolourSources (sa.u) ->
// recolourDestinations (m.C), then recolourSources2 (wg.b) -> recolourDestinations2 (ij.j); NXT m_recol1s/m_recol1d and
// m_recol2s/m_recol2d. A part slot holds 0x40000000 | obj id (ObjType wear/head mesh) or 0x80000000 | kit id (IdkType).
//
// Stripped from the builders: the invocation counters (cl.d, cl.f, cl.q), the od.a wrappers, the client.wb arms and the
// dummies of their callees (hk.a 8629, rg.a -28322, uk.a -36/123, ja.a -90/82, tb.b -32, af.a false, gb.a, hf.a,
// fi.a/fi.c, kl.b(ZI)Z 0, kl.a(IZ)Z -13617, kl.a(ZZ)Lcb; false, ve.a false/-71, ek.a -20002). kl.a(ZI)Lcb;'s 0 is a
// real file id and is passed to GetHeadModelNoCheck.
export default class PlayerModel {
    // HD hh.c(I)V
    static releaseHdStatics(guard: number): void {
        try {
            const WorldMap = loadWorldMap();
            releaseReferences(WorldMap, 'teleportCommand');
            releaseReferences(Client, 'percent4');
            if (guard !== 8160) {
                return;
            }
            const world = World;
            releaseReferences(world, 'hideAreaMaxX');
            releaseReferences(Client, 'wm0Command');
            const TitleFlames = loadTitleFlames();
            releaseReferences(TitleFlames, 'flameGradient');
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'hh.H(' + guard + ')');
        }
    }

    // ja.g:[J (filled by ja.<clinit>)
    static readonly crc64Table: BigInt64Array = buildCrc64Table();
    // kf.p:[I
    static readonly femaleBodyParts: Int32Array = Int32Array.of(7, 8, 9, 10, 11, 12, 13, 15);
    // ph.k:[I
    static readonly maleKitBodyParts: Int32Array = Int32Array.of(0, 1, 2, 3, 4, 5, 6, 14);
    // rb.g:[I
    static readonly partToSlot: Int32Array = Int32Array.of(8, 11, 4, 6, 9, 7, 10, 0);
    // gl.u:Lve;. Chathead models (GetHeadModel by modelKey, getKitHeadModel by the three kit ids).
    static readonly modelCache = new LRUHashCache<ModelLit>(5);
    // vk.S:Lve;. Body models by key (NXT m_modelCache).
    static readonly modelCache2 = new LRUHashCache<ModelLit>(260);

    // cf.j:[Lek;. GetTempModel's per-slot-animation scratch (14 entries), cleared after each build.
    static readonly layerSeqs: (SeqType | null)[] = new Array<SeqType | null>(14).fill(null);
    // wk.b:[Lhf;
    static readonly slotFramesets: (AnimFrameSet | null)[] = new Array<AnimFrameSet | null>(14).fill(null);
    // ec.x:[I
    static readonly layerFrameIds: Int32Array = new Int32Array(14);
    // kj.Y:[Lhf;
    static readonly slotNextFramesets: (AnimFrameSet | null)[] = new Array<AnimFrameSet | null>(14).fill(null);
    // ob.Hb:[I
    static readonly slotNextFrames: Int32Array = new Int32Array(14);
    // jk.r:[I
    static readonly layerFrameDelays: Int32Array = new Int32Array(14);
    // qj.r:[I
    static readonly layerFrameCycles: Int32Array = new Int32Array(14);

    // pf.f(I)V. bf.c's hard purge: ve.a(I)V (clear) on vk.S then gl.u; its only caller passes -19933, so both
    // computed arguments are 0 (the counter is stripped).
    static clearCaches(): void {
        PlayerModel.modelCache2.Reset();
        PlayerModel.modelCache.Reset();
    }

    // oe.c(B)V. gf.f's soft-cache sweep: ve.a(B)V (removeSoft) on vk.S then gl.u, so hard references survive. Its only
    // caller passes -115, so the dummy `-62 / ((-50 - var0) / 61)` divides by 1 and never throws (stripped with the counter).
    static removeSoft(): void {
        PlayerModel.modelCache2.removeSoft();
        PlayerModel.modelCache.removeSoft();
    }
    // SD d.a(II)V, HD wk.b(II)V.
    static cleanModelCaches(age: number, guard = glJar ? 64 : undefined): void {
        try {
            requireNonNull(PlayerModel.modelCache2).Clean(age, guard === undefined ? undefined : -127);
            if (guard !== undefined && guard !== 64) return;
            requireNonNull(PlayerModel.modelCache).Clean(age, guard === undefined ? undefined : -126);
        } catch (error) {
            if (guard === undefined || !isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'wk.C(' + age + ',' + guard + ')');
        }
    }

    // uf.a(Z)I. The number of hard (non-soft) body models in vk.S. The boolean is a stripped dummy: both callers
    // (pb.a(IIIIIIIIJILue;)V at offset 155 and the ig debug-command dispatcher at offset 326) pass false, so the guard
    // `if (var0) uf.a(null, -53)` never runs; ve.b(B)I's own dummy byte is -14.
    static modelCacheCount(): number {
        return PlayerModel.modelCache2.countHard();
    }

    // m.C:[[S. client points it at one of the two palettes below for the running game.
    static recolourDestinations: Int16Array[] | null = null;
    // pk.c:[[S
    static readonly recolourDestinationsRs: Int16Array[] = [
        Int16Array.of(6798, 107, 10283, 16, 4797, 7744, 5799, 4634, -31839, 22433, 2983, -11343, 8, 5281, 10438, 3650, -27322, -21845, 200, 571, 908, 21830, 28946, -15701, -14010),
        Int16Array.of(8741, 12, -1506, -22374, 7735, 8404, 1701, -27106, 24094, 10153, -8915, 4783, 1341, 16578, -30533, 25239, 8, 5281, 10438, 3650, -27322, -21845, 200, 571, 908, 21830, 28946, -15701, -14010),
        Int16Array.of(25238, 8742, 12, -1506, -22374, 7735, 8404, 1701, -27106, 24094, 10153, -8915, 4783, 1341, 16578, -30533, 8, 5281, 10438, 3650, -27322, -21845, 200, 571, 908, 21830, 28946, -15701, -14010),
        Int16Array.of(4626, 11146, 6439, 12, 4758, 10270),
        Int16Array.of(4550, 4537, 5681, 5673, 5790, 6806, 8076, 4574)
    ];
    // gk.b:[[S
    static readonly recolourDestinationsAlt: Int16Array[] = [
        Int16Array.of(
            10,
            30,
            50,
            70,
            90,
            110,
            310,
            684,
            704,
            556,
            940,
            960,
            6454,
            6952,
            6972,
            2358,
            2732,
            2752,
            10550,
            10924,
            10944,
            10310,
            10556,
            10576,
            14646,
            15020,
            15040,
            19766,
            20140,
            20160,
            -29386,
            -29012,
            -28992,
            31030,
            31276,
            31296,
            -24266,
            -23892,
            -23872,
            -19146,
            -18772,
            -18752,
            -14026,
            -13652,
            -13632,
            -6858,
            -6484,
            -6464,
            522,
            542,
            6794,
            6814,
            11018,
            11038,
            14986,
            15006,
            21130,
            21150,
            -28918,
            -28898,
            -22006,
            -21986,
            -12918,
            -12898,
            10,
            30,
            50,
            70,
            90,
            110,
            310,
            684,
            704,
            556,
            940,
            960,
            6454,
            6952,
            6972,
            2358,
            2732,
            2752,
            10550,
            10924,
            10944,
            10310,
            10556,
            10576,
            14646,
            15020,
            15040,
            19766,
            20140,
            20160,
            -29386,
            -29012,
            -28992,
            31030,
            31276,
            31296,
            -24266,
            -23892,
            -23872,
            -19146,
            -18772,
            -18752,
            -14026,
            -13652,
            -13632,
            -6858,
            -6484,
            -6464,
            522,
            542,
            6794,
            6814,
            11018,
            11038,
            14986,
            15006,
            21130,
            21150,
            -28918,
            -28898,
            -22006,
            -21986,
            -12918,
            -12898,
            10,
            30,
            50,
            70,
            90,
            110,
            310,
            684,
            704,
            556,
            940,
            960,
            6454,
            6952,
            6972,
            2358,
            2732,
            2752,
            10550,
            10924,
            10944,
            10310,
            10556,
            10576,
            14646,
            15020,
            15040,
            19766,
            20140,
            20160,
            -29386,
            -29012,
            -28992,
            31030,
            31276,
            31296,
            -24266,
            -23892,
            -23872,
            -19146,
            -18772,
            -18752,
            -14026,
            -13652,
            -13632,
            -6858,
            -6484,
            -6464,
            522,
            542,
            6794,
            6814,
            11018,
            11038,
            14986,
            15006,
            21130,
            21150,
            -28918,
            -28898,
            -22006,
            -21986,
            -12918,
            -12898,
            10,
            30,
            50,
            70,
            90,
            110,
            310,
            684,
            704,
            556,
            940,
            960,
            6454,
            6952,
            6972,
            2358,
            2732,
            2752,
            10550,
            10924,
            10944,
            10310,
            10556,
            10576,
            14646,
            15020,
            15040,
            19766,
            20140,
            20160,
            -29386,
            -29012,
            -28992,
            31030,
            31276,
            31296,
            -24266,
            -23892,
            -23872,
            -19146,
            -18772,
            -18752,
            -14026,
            -13652,
            -13632,
            -6858,
            -6484,
            -6464,
            522,
            542,
            6794,
            6814,
            11018,
            11038,
            14986,
            15006,
            21130,
            21150,
            -28918,
            -28898,
            -22006,
            -21986,
            -12918,
            -12898
        ),
        Int16Array.of(
            10,
            30,
            50,
            70,
            90,
            110,
            310,
            684,
            704,
            556,
            940,
            960,
            6454,
            6952,
            6972,
            2358,
            2732,
            2752,
            10550,
            10924,
            10944,
            10310,
            10556,
            10576,
            14646,
            15020,
            15040,
            19766,
            20140,
            20160,
            -29386,
            -29012,
            -28992,
            31030,
            31276,
            31296,
            -24266,
            -23892,
            -23872,
            -19146,
            -18772,
            -18752,
            -14026,
            -13652,
            -13632,
            -6858,
            -6484,
            -6464,
            522,
            542,
            6794,
            6814,
            11018,
            11038,
            14986,
            15006,
            21130,
            21150,
            -28918,
            -28898,
            -22006,
            -21986,
            -12918,
            -12898,
            10,
            30,
            50,
            70,
            90,
            110,
            310,
            684,
            704,
            556,
            940,
            960,
            6454,
            6952,
            6972,
            2358,
            2732,
            2752,
            10550,
            10924,
            10944,
            10310,
            10556,
            10576,
            14646,
            15020,
            15040,
            19766,
            20140,
            20160,
            -29386,
            -29012,
            -28992,
            31030,
            31276,
            31296,
            -24266,
            -23892,
            -23872,
            -19146,
            -18772,
            -18752,
            -14026,
            -13652,
            -13632,
            -6858,
            -6484,
            -6464,
            522,
            542,
            6794,
            6814,
            11018,
            11038,
            14986,
            15006,
            21130,
            21150,
            -28918,
            -28898,
            -22006,
            -21986,
            -12918,
            -12898,
            10,
            30,
            50,
            70,
            90,
            110,
            310,
            684,
            704,
            556,
            940,
            960,
            6454,
            6952,
            6972,
            2358,
            2732,
            2752,
            10550,
            10924,
            10944,
            10310,
            10556,
            10576,
            14646,
            15020,
            15040,
            19766,
            20140,
            20160,
            -29386,
            -29012,
            -28992,
            31030,
            31276,
            31296,
            -24266,
            -23892,
            -23872,
            -19146,
            -18772,
            -18752,
            -14026,
            -13652,
            -13632,
            -6858,
            -6484,
            -6464,
            522,
            542,
            6794,
            6814,
            11018,
            11038,
            14986,
            15006,
            21130,
            21150,
            -28918,
            -28898,
            -22006,
            -21986,
            -12918,
            -12898,
            10347,
            10582,
            10429,
            10407,
            10359,
            8414,
            9540,
            10456,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0
        ),
        Int16Array.of(
            10,
            30,
            50,
            70,
            90,
            110,
            310,
            684,
            704,
            556,
            940,
            960,
            6454,
            6952,
            6972,
            2358,
            2732,
            2752,
            10550,
            10924,
            10944,
            10310,
            10556,
            10576,
            14646,
            15020,
            15040,
            19766,
            20140,
            20160,
            -29386,
            -29012,
            -28992,
            31030,
            31276,
            31296,
            -24266,
            -23892,
            -23872,
            -19146,
            -18772,
            -18752,
            -14026,
            -13652,
            -13632,
            -6858,
            -6484,
            -6464,
            522,
            542,
            6794,
            6814,
            11018,
            11038,
            14986,
            15006,
            21130,
            21150,
            -28918,
            -28898,
            -22006,
            -21986,
            -12918,
            -12898,
            10,
            30,
            50,
            70,
            90,
            110,
            310,
            684,
            704,
            556,
            940,
            960,
            6454,
            6952,
            6972,
            2358,
            2732,
            2752,
            10550,
            10924,
            10944,
            10310,
            10556,
            10576,
            14646,
            15020,
            15040,
            19766,
            20140,
            20160,
            -29386,
            -29012,
            -28992,
            31030,
            31276,
            31296,
            -24266,
            -23892,
            -23872,
            -19146,
            -18772,
            -18752,
            -14026,
            -13652,
            -13632,
            -6858,
            -6484,
            -6464,
            522,
            542,
            6794,
            6814,
            11018,
            11038,
            14986,
            15006,
            21130,
            21150,
            -28918,
            -28898,
            -22006,
            -21986,
            -12918,
            -12898,
            10,
            30,
            50,
            70,
            90,
            110,
            310,
            684,
            704,
            556,
            940,
            960,
            6454,
            6952,
            6972,
            2358,
            2732,
            2752,
            10550,
            10924,
            10944,
            10310,
            10556,
            10576,
            14646,
            15020,
            15040,
            19766,
            20140,
            20160,
            -29386,
            -29012,
            -28992,
            31030,
            31276,
            31296,
            -24266,
            -23892,
            -23872,
            -19146,
            -18772,
            -18752,
            -14026,
            -13652,
            -13632,
            -6858,
            -6484,
            -6464,
            522,
            542,
            6794,
            6814,
            11018,
            11038,
            14986,
            15006,
            21130,
            21150,
            -28918,
            -28898,
            -22006,
            -21986,
            -12918,
            -12898,
            10,
            30,
            50,
            70,
            90,
            110,
            310,
            684,
            704,
            556,
            940,
            960,
            6454,
            6952,
            6972,
            2358,
            2732,
            2752,
            10550,
            10924,
            10944,
            10310,
            10556,
            10576,
            14646,
            15020,
            15040,
            19766,
            20140,
            20160,
            -29386,
            -29012,
            -28992,
            31030,
            31276,
            31296,
            -24266,
            -23892,
            -23872,
            -19146,
            -18772,
            -18752,
            -14026,
            -13652,
            -13632,
            -6858,
            -6484,
            -6464,
            522,
            542,
            6794,
            6814,
            11018,
            11038,
            14986,
            15006,
            21130,
            21150,
            -28918,
            -28898,
            -22006,
            -21986,
            -12918,
            -12898
        ),
        Int16Array.of(
            4300,
            3294,
            3303,
            3264,
            4506,
            4382,
            4387,
            5293,
            7622,
            7384,
            8412,
            7496,
            86,
            123,
            111,
            99,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            10,
            30,
            50,
            70,
            90,
            110,
            310,
            684,
            704,
            556,
            940,
            960,
            6454,
            6952,
            6972,
            2358,
            2732,
            2752,
            10550,
            10924,
            10944,
            10310,
            10556,
            10576,
            14646,
            15020,
            15040,
            19766,
            20140,
            20160,
            -29386,
            -29012,
            -28992,
            31030,
            31276,
            31296,
            -24266,
            -23892,
            -23872,
            -19146,
            -18772,
            -18752,
            -14026,
            -13652,
            -13632,
            -6858,
            -6484,
            -6464,
            522,
            542,
            6794,
            6814,
            11018,
            11038,
            14986,
            15006,
            21130,
            21150,
            -28918,
            -28898,
            -22006,
            -21986,
            -12918,
            -12898,
            10,
            30,
            50,
            70,
            90,
            110,
            310,
            684,
            704,
            556,
            940,
            960,
            6454,
            6952,
            6972,
            2358,
            2732,
            2752,
            10550,
            10924,
            10944,
            10310,
            10556,
            10576,
            14646,
            15020,
            15040,
            19766,
            20140,
            20160,
            -29386,
            -29012,
            -28992,
            31030,
            31276,
            31296,
            -24266,
            -23892,
            -23872,
            -19146,
            -18772,
            -18752,
            -14026,
            -13652,
            -13632,
            -6858,
            -6484,
            -6464,
            522,
            542,
            6794,
            6814,
            11018,
            11038,
            14986,
            15006,
            21130,
            21150,
            -28918,
            -28898,
            -22006,
            -21986,
            -12918,
            -12898,
            13766,
            13745,
            13726,
            13890,
            13743,
            13852,
            17602,
            18605,
            21660,
            24000,
            24997,
            24088,
            27972,
            25903,
            26904,
            27193,
            27175,
            27156,
            30020,
            28975,
            29976,
            12482,
            13485,
            10392,
            10692,
            10669,
            10776,
            6717,
            6695,
            7830,
            6971,
            6951,
            5910,
            3389,
            3369,
            3356,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0
        ),
        Int16Array.of(
            10,
            30,
            50,
            70,
            90,
            110,
            310,
            684,
            704,
            556,
            940,
            960,
            6454,
            6952,
            6972,
            2358,
            2732,
            2752,
            10550,
            10924,
            10944,
            10310,
            10556,
            10576,
            14646,
            15020,
            15040,
            19766,
            20140,
            20160,
            -29386,
            -29012,
            -28992,
            31030,
            31276,
            31296,
            -24266,
            -23892,
            -23872,
            -19146,
            -18772,
            -18752,
            -14026,
            -13652,
            -13632,
            -6858,
            -6484,
            -6464,
            522,
            542,
            6794,
            6814,
            11018,
            11038,
            14986,
            15006,
            21130,
            21150,
            -28918,
            -28898,
            -22006,
            -21986,
            -12918,
            -12898,
            10,
            30,
            50,
            70,
            90,
            110,
            310,
            684,
            704,
            556,
            940,
            960,
            6454,
            6952,
            6972,
            2358,
            2732,
            2752,
            10550,
            10924,
            10944,
            10310,
            10556,
            10576,
            14646,
            15020,
            15040,
            19766,
            20140,
            20160,
            -29386,
            -29012,
            -28992,
            31030,
            31276,
            31296,
            -24266,
            -23892,
            -23872,
            -19146,
            -18772,
            -18752,
            -14026,
            -13652,
            -13632,
            -6858,
            -6484,
            -6464,
            522,
            542,
            6794,
            6814,
            11018,
            11038,
            14986,
            15006,
            21130,
            21150,
            -28918,
            -28898,
            -22006,
            -21986,
            -12918,
            -12898,
            10,
            30,
            50,
            70,
            90,
            110,
            310,
            684,
            704,
            556,
            940,
            960,
            6454,
            6952,
            6972,
            2358,
            2732,
            2752,
            10550,
            10924,
            10944,
            10310,
            10556,
            10576,
            14646,
            15020,
            15040,
            19766,
            20140,
            20160,
            -29386,
            -29012,
            -28992,
            31030,
            31276,
            31296,
            -24266,
            -23892,
            -23872,
            -19146,
            -18772,
            -18752,
            -14026,
            -13652,
            -13632,
            -6858,
            -6484,
            -6464,
            522,
            542,
            6794,
            6814,
            11018,
            11038,
            14986,
            15006,
            21130,
            21150,
            -28918,
            -28898,
            -22006,
            -21986,
            -12918,
            -12898,
            10,
            30,
            50,
            70,
            90,
            110,
            310,
            684,
            704,
            556,
            940,
            960,
            6454,
            6952,
            6972,
            2358,
            2732,
            2752,
            10550,
            10924,
            10944,
            10310,
            10556,
            10576,
            14646,
            15020,
            15040,
            19766,
            20140,
            20160,
            -29386,
            -29012,
            -28992,
            31030,
            31276,
            31296,
            -24266,
            -23892,
            -23872,
            -19146,
            -18772,
            -18752,
            -14026,
            -13652,
            -13632,
            -6858,
            -6484,
            -6464,
            522,
            542,
            6794,
            6814,
            11018,
            11038,
            14986,
            15006,
            21130,
            21150,
            -28918,
            -28898,
            -22006,
            -21986,
            -12918,
            -12898
        )
    ];

    // sa.u:[S (NXT m_recol1s). The client points it at recolourSourcesRs or recolourSourcesAlt with recolourDestinations.
    static recolourSources: Int16Array | null = null;
    // ik.Z:[S
    static readonly recolourSourcesRs: Int16Array = Int16Array.of(6798, 8741, 25238, 4626, 4550);
    // uh.Y:[S
    static readonly recolourSourcesAlt: Int16Array = Int16Array.of(960, 957, -21568, -21571, 22464);
    // wg.b:[S (NXT m_recol2s). The client points it at recolourSources2Rs or recolourSources2Alt.
    static recolourSources2: Int16Array | null = null;
    // lh.e:[S
    static readonly recolourSources2Rs: Int16Array = Int16Array.of(-10304, 9104, -1, -1, -1);
    // gj.U:[S
    static readonly recolourSources2Alt: Int16Array = Int16Array.of(-4160, -4163, -8256, -8259, 22461);
    // ij.j:[[S (NXT m_recol2d). The client points it at recolourDestinations2Rs or recolourDestinations2Alt.
    static recolourDestinations2: Int16Array[] | null = null;
    // ie.J:[[S
    static readonly recolourDestinations2Rs: Int16Array[] = [
        Int16Array.of(6554, 115, 10304, 28, 5702, 7756, 5681, 4510, -31835, 22437, 2859, -11339, 16, 5157, 10446, 3658, -27314, -21965, 472, 580, 784, 21966, 28950, -15697, -14002),
        Int16Array.of(9104, 10275, 7595, 3610, 7975, 8526, 918, -26734, 24466, 10145, -6882, 5027, 1457, 16565, -30545, 25486, 24, 5392, 10429, 3673, -27335, -21957, 192, 687, 412, 21821, 28835, -15460, -14019),
        new Int16Array(0),
        new Int16Array(0),
        new Int16Array(0)
    ];
    // gk.o:[[S
    static readonly recolourDestinations2Alt: Int16Array[] = [
        Int16Array.of(
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            4,
            24,
            44,
            64,
            84,
            104,
            304,
            678,
            698,
            550,
            934,
            954,
            6448,
            6946,
            6966,
            2352,
            2726,
            2746,
            10544,
            10918,
            10938,
            10304,
            10550,
            10570,
            14640,
            15014,
            15034,
            19760,
            20134,
            20154,
            -29392,
            -29018,
            -28998,
            31024,
            31270,
            31290,
            -24272,
            -23898,
            -23878,
            -19152,
            -18778,
            -18758,
            -14032,
            -13658,
            -13638,
            -6864,
            -6490,
            -6470,
            516,
            536,
            6788,
            6808,
            11012,
            11032,
            14980,
            15000,
            21124,
            21144,
            -28924,
            -28904,
            -22012,
            -21992,
            -12924,
            -12904
        ),
        Int16Array.of(
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            10339,
            10574,
            10425,
            10398,
            10345,
            7512,
            8507,
            7378,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0
        ),
        Int16Array.of(
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            4,
            24,
            44,
            64,
            84,
            104,
            304,
            678,
            698,
            550,
            934,
            954,
            6448,
            6946,
            6966,
            2352,
            2726,
            2746,
            10544,
            10918,
            10938,
            10304,
            10550,
            10570,
            14640,
            15014,
            15034,
            19760,
            20134,
            20154,
            -29392,
            -29018,
            -28998,
            31024,
            31270,
            31290,
            -24272,
            -23898,
            -23878,
            -19152,
            -18778,
            -18758,
            -14032,
            -13658,
            -13638,
            -6864,
            -6490,
            -6470,
            516,
            536,
            6788,
            6808,
            11012,
            11032,
            14980,
            15000,
            21124,
            21144,
            -28924,
            -28904,
            -22012,
            -21992,
            -12924,
            -12904
        ),
        Int16Array.of(
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            13753,
            13737,
            13719,
            13883,
            13863,
            13974,
            19643,
            18601,
            16532,
            23993,
            25121,
            24980,
            26944,
            26921,
            24854,
            27191,
            27171,
            26130,
            26941,
            28696,
            30100,
            12477,
            10407,
            10388,
            10685,
            10665,
            10646,
            6711,
            6693,
            6674,
            6965,
            7073,
            7056,
            2361,
            4387,
            3346,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0
        ),
        Int16Array.of(
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            4,
            24,
            44,
            64,
            84,
            104,
            304,
            678,
            698,
            550,
            934,
            954,
            6448,
            6946,
            6966,
            2352,
            2726,
            2746,
            10544,
            10918,
            10938,
            10304,
            10550,
            10570,
            14640,
            15014,
            15034,
            19760,
            20134,
            20154,
            -29392,
            -29018,
            -28998,
            31024,
            31270,
            31290,
            -24272,
            -23898,
            -23878,
            -19152,
            -18778,
            -18758,
            -14032,
            -13658,
            -13638,
            -6864,
            -6490,
            -6470,
            516,
            536,
            6788,
            6808,
            11012,
            11032,
            14980,
            15000,
            21124,
            21144,
            -28924,
            -28904,
            -22012,
            -21992,
            -12924,
            -12904
        )
    ];

    // cl.b:[I
    private equipment: Int32Array | null = null;
    // cl.i:I
    private basId = 0;
    // cl.k:I
    npcId = 0;
    // cl.m:Z
    female = false;
    // cl.o:J
    private modelKey = 0n;
    // cl.t:J
    private cachedModelKey = 0n;
    // cl.y:[[I
    private basTransforms: (Int32Array | null)[] | null = null;
    // cl.z:[I
    private colours: Int32Array | null = null;

    // Read access for the legacy renderer bridge (model/LegacyActorBridge.ts). Not in cl; cl.b stays private.
    get equipmentTags(): ArrayLike<number> | null {
        return this.equipment;
    }

    // Read access for the legacy renderer bridge (model/LegacyActorBridge.ts). Not in cl; cl.z stays private.
    get colourIndices(): ArrayLike<number> | null {
        return this.colours;
    }

    // cl.<init>()V
    constructor() {}

    // cl.a(Z[II[III)V. The fifth Java parameter is a dummy (only used for the hk.a dummy and its own guard).
    setAppearance(female: boolean, colours: Int32Array, basId: number, equipment: Int32Array | null, npcId: number): void {
        if (basId !== this.basId) {
            this.basTransforms = null;
            this.basId = basId;
        }
        if (equipment === null) {
            equipment = new Int32Array(12);
            for (let part = 0; part < 8; part++) {
                for (let kit = 0; kit < IdkType.m_numDefinitions; kit++) {
                    const type = IdkType.List(kit);
                    if (type !== null && !type.nonSelectable && type.bodyPart === (female ? PlayerModel.femaleBodyParts[part] : PlayerModel.maleKitBodyParts[part])) {
                        equipment[PlayerModel.partToSlot[part]] = -2147483648 | kit;
                        break;
                    }
                }
            }
        }
        this.npcId = npcId;
        this.colours = colours;
        this.equipment = equipment;
        this.female = female;
        this.updateModelKey();
    }

    // cl.a(III)V. Every CS2 entry reaches gh.a with local 1 = -22368 (li.a directly; gd.b as -89 - 22279), and the
    // female branch passes it XOR -30654, so both branches deliver 8418: the "t = -13" guard is dead and stripped.
    setKit(part: number, kit: number): void {
        const slot = arrayAtI32(PlayerModel.partToSlot, part);
        if (arrayAtI32(requireNonNull(this.equipment), slot) === 0) return;
        if (IdkType.List(kit) === null) return;
        arrayPutI32(requireNonNull(this.equipment), slot, kit | -2147483648);
        this.updateModelKey();
    }

    // cl.b(III)V. Every caller passes 1, so the key update always runs and the junk-call guard is stripped.
    setColour(index: number, colour: number): void {
        arrayPutI32(requireNonNull(this.colours), index, colour);
        this.updateModelKey();
    }

    // cl.a(ZB)V. Every caller passes -10, so the guard that nulls the static cl.x is stripped.
    setFemale(female: boolean): void {
        this.female = female;
        this.updateModelKey();
    }

    // cl.b(I)I. The dummy argument (28544) and its junk-call guard are stripped. Shifts are the reduced
    // distances of the obfuscated literals (5, 25, 20, 15, 10); the sum wraps like Java int arithmetic.
    getHeadId(): number {
        if (this.npcId === -1) {
            if (glJar) {
                // hh.b(I)I reads slot 8 and both colours before slots 0, 11 and 1.
                const left = ((arrayAtI32(this.equipment, 8) << 10) + ((arrayAtI32(this.colours, 0) << 25) - (-(arrayAtI32(this.colours, 4) << 20) | 0))) | 0;
                const right = (-(arrayAtI32(this.equipment, 0) << 15) - ((arrayAtI32(this.equipment, 11) << 5) + arrayAtI32(this.equipment, 1))) | 0;
                return (left - right) | 0;
            }
            const equipment = requireNonNull(this.equipment);
            const colours = requireNonNull(this.colours);
            let value = ((arrayAtI32(equipment, 11) << 5) + (arrayAtI32(colours, 0) << 25)) | 0;
            value = (value - (-(arrayAtI32(colours, 4) << 20) | 0)) | 0;
            value = (value + (arrayAtI32(equipment, 0) << 15)) | 0;
            value = (value - (-(arrayAtI32(equipment, 8) << 10) | 0)) | 0;
            return (value + arrayAtI32(equipment, 1)) | 0;
        }
        return (NpcType.List(this.npcId).id + 305419896) | 0;
    }

    // cl.c(I)V. Every caller passes 1, so the dummy guard around the body is stripped.
    private updateModelKey(): void {
        const old = this.modelKey;
        const table = PlayerModel.crc64Table;
        this.modelKey = -1n;
        this.modelKey = shiftXor(this.modelKey, table[crcIndex(this.basId >> 8, this.modelKey)]);
        this.modelKey = shiftXor(this.modelKey, table[crcIndex(this.basId, this.modelKey)]);
        for (let slot = 0; slot < 12; slot++) {
            this.modelKey = shiftXor(this.modelKey, table[crcIndex(requireNonNull(this.equipment)[slot] >> 24, this.modelKey)]);
            this.modelKey = shiftXor(this.modelKey, table[crcIndex(requireNonNull(this.equipment)[slot] >> 16, this.modelKey)]);
            this.modelKey = shiftXor(this.modelKey, table[crcIndex(requireNonNull(this.equipment)[slot] >> 8, this.modelKey)]);
            this.modelKey = shiftXor(this.modelKey, table[crcIndex(requireNonNull(this.equipment)[slot], this.modelKey)]);
        }
        for (let i = 0; i < 5; i++) {
            this.modelKey = shiftXor(this.modelKey, table[crcIndex(requireNonNull(this.colours)[i], this.modelKey)]);
        }
        this.modelKey = shiftXor(this.modelKey, table[crcIndex(this.female ? 1 : 0, this.modelKey)]);
        if (old !== 0n && this.modelKey !== old) PlayerModel.modelCache2.Remove(old);
    }

    // cl.a(IILek;IZ[Lci;IIZLek;I)Lnd; (NXT PlayerModel::GetTempModel)
    // Java parameters: var1 walkFrame, var2 seqNext, var3 seq, var4 seqFrame, var5 check, var6 slotAnims, var7 walkCycle,
    // var8 seqCycle, var9 cache, var10 walkSeq, var11 walkNext. The primary seq's held-item overrides (ek.I -> slot 5,
    // ek.r -> slot 3; 65535 empties the slot) change the parts and the key. On a cache miss the body is merged from the
    // 12 part meshes, each rotated and offset by its BAS transform (whose 15-int matrix is built once into
    // basTransforms), recoloured, lit and, when cache is set, stored as cachedModelKey. While a part mesh is loading the
    // build falls back to the cachedModelKey model, or returns null. The slot animations, then seq and walkSeq
    // (SplitAnimate when both resolve) are applied to a CopyForAnimActor copy.
    // Kept: var5 is IdkType.CheckModel's real argument (lf.a passes its own boolean), and var9 is a real flag (all three
    // callers, pb.a and lf.a twice, happen to pass iconst_1). Also kept: `if (!var5) cl.a(-48, null)` at 0x734, the
    // discarded call to Client.IsIgnored (cl.a(ILid;)Z). It returns false on its null name, but its guard tests the real
    // var5, so it is not a dummy-guard branch and stays in bytecode order.
    // Kept as in the bytecode: a tween frameset whose group differs from the frame's is fetched with
    // `nextFrameId >>> 16` after nextFrameId was masked to 16 bits, i.e. group 0. `x |= f()` is written `x = f() || x`
    // so f always runs.
    GetTempModel(
        walkFrame: number,
        seqNext: number,
        seq: SeqType | null,
        seqFrame: number,
        check: boolean,
        slotAnims: (ActorSlotAnim | null)[] | null,
        walkCycle: number,
        seqCycle: number,
        cache: boolean,
        walkSeq: SeqType | null,
        walkNext: number
    ): ModelLit | null {
        if (this.npcId !== -1) {
            return NpcType.List(this.npcId).GetTempModel(slotAnims, seqFrame, seq, walkCycle, seqNext, seqCycle, walkNext, walkFrame, walkSeq);
        }

        let parts = this.equipment; // var14
        let key = this.modelKey; // var12
        if (seq !== null && (seq.m_replaceHeldLeft >= 0 || seq.m_replaceHeldRight >= 0)) {
            parts = new Int32Array(12);
            for (let i = 0; i < 12; i++) {
                parts[i] = arrayAtI32(this.equipment, i);
            }

            if (seq.m_replaceHeldLeft >= 0) {
                if (seq.m_replaceHeldLeft !== 65535) {
                    parts[5] = 1073741824 | seq.m_replaceHeldLeft;
                    key ^= BigInt(parts[5]) << 32n;
                } else {
                    key ^= -4294967296n;
                    parts[5] = 0;
                }
            }

            if (seq.m_replaceHeldRight >= 0) {
                if (seq.m_replaceHeldRight === 65535) {
                    key ^= 4294967295n;
                    parts[3] = 0;
                } else {
                    parts[3] = seq.m_replaceHeldRight | 1073741824;
                    key ^= BigInt(parts[3]);
                }
            }
        }

        let model = PlayerModel.modelCache2.Find(key); // var15
        if (model === null) {
            let loading = false; // var16
            for (let i = 0; i < 12; i++) {
                const part = arrayAtI32(parts, i); // var18
                if ((part & 1073741824) === 0) {
                    if ((-2147483648 & part) !== 0 && !IdkType.List(part & 1073741823).CheckModel(check)) {
                        loading = true;
                    }
                } else if (!ObjType.List(1073741823 & part).CheckWearModel(this.female)) {
                    loading = true;
                }
            }

            if (loading) {
                if (this.cachedModelKey !== -1n) {
                    model = PlayerModel.modelCache2.Find(this.cachedModelKey);
                }

                if (model === null) {
                    return null;
                }
            }

            if (model === null) {
                const meshes = new Array<ModelUnlit | null>(12).fill(null); // var18
                for (let i = 0; i < 12; i++) {
                    const part = arrayAtI32(parts, i); // var20
                    if ((1073741824 & part) === 0) {
                        if ((part & -2147483648) !== 0) {
                            const mesh = IdkType.List(part & 1073741823).GetModelNoCheck(); // var21
                            if (mesh !== null) {
                                meshes[i] = mesh;
                            }
                        }
                    } else {
                        const mesh = ObjType.List(part & 1073741823).GetWearModelNoCheck(this.female);
                        if (mesh !== null) {
                            meshes[i] = mesh;
                        }
                    }
                }

                let bas: BASType | null = null; // var20
                if (this.basId !== -1) {
                    bas = BASTypeList.List(this.basId);
                }

                if (bas !== null && bas.transforms !== null) {
                    for (let i = 0; bas.transforms.length > i; i++) {
                        if (arrayAtObj(bas.transforms, i) === null || arrayAtObj(meshes, i) === null) {
                            continue;
                        }

                        let offsetX: number;
                        let offsetZ: number;
                        let pitch: number;
                        let yaw: number;
                        let offsetY: number;
                        let roll: number;
                        if (glJar) {
                            offsetX = arrayAtI32(arrayAtObj(bas.transforms, i), 0);
                            offsetY = arrayAtI32(arrayAtObj(bas.transforms, i), 1);
                            offsetZ = arrayAtI32(arrayAtObj(bas.transforms, i), 2);
                            yaw = arrayAtI32(arrayAtObj(bas.transforms, i), 4);
                            pitch = arrayAtI32(arrayAtObj(bas.transforms, i), 3);
                            roll = arrayAtI32(arrayAtObj(bas.transforms, i), 5);
                        } else {
                            offsetX = arrayAtI32(arrayAtObj(bas.transforms, i), 0);
                            offsetZ = arrayAtI32(arrayAtObj(bas.transforms, i), 2);
                            pitch = arrayAtI32(arrayAtObj(bas.transforms, i), 3);
                            yaw = arrayAtI32(arrayAtObj(bas.transforms, i), 4);
                            offsetY = arrayAtI32(arrayAtObj(bas.transforms, i), 1);
                            roll = arrayAtI32(arrayAtObj(bas.transforms, i), 5);
                        }
                        if (this.basTransforms === null) {
                            this.basTransforms = new Array<Int32Array | null>(bas.transforms.length).fill(null);
                        }

                        if (arrayAtObj(this.basTransforms, i) === null) {
                            const matrix = new Int32Array(15); // var28
                            arrayPutObj(this.basTransforms, i, matrix);
                            if (pitch === 0 && yaw === 0 && roll === 0) {
                                matrix[12] = -offsetX;
                                matrix[8] = 32768;
                                matrix[4] = 32768;
                                matrix[0] = 32768;
                                matrix[14] = -offsetZ;
                                matrix[13] = -offsetY;
                            } else {
                                let cosYaw: number;
                                let sinPitch: number;
                                let cosPitch: number;
                                let sinYaw: number;
                                let sinRoll: number;
                                let cosRoll: number;
                                if (glJar) {
                                    cosPitch = arrayAtI32(Pix3D.cosTable, pitch) >> 1;
                                    sinPitch = arrayAtI32(Pix3D.sinTable, pitch) >> 1;
                                    cosYaw = arrayAtI32(Pix3D.cosTable, yaw) >> 1;
                                    sinYaw = arrayAtI32(Pix3D.sinTable, yaw) >> 1;
                                    cosRoll = arrayAtI32(Pix3D.cosTable, roll) >> 1;
                                    sinRoll = arrayAtI32(Pix3D.sinTable, roll) >> 1;
                                } else {
                                    cosYaw = arrayAtI32(Pix3D.cosTable, yaw) >> 1;
                                    sinPitch = arrayAtI32(Pix3D.sinTable, pitch) >> 1;
                                    cosPitch = arrayAtI32(Pix3D.cosTable, pitch) >> 1;
                                    sinYaw = arrayAtI32(Pix3D.sinTable, yaw) >> 1;
                                    sinRoll = arrayAtI32(Pix3D.sinTable, roll) >> 1;
                                    cosRoll = arrayAtI32(Pix3D.cosTable, roll) >> 1;
                                }
                                matrix[2] = (Math.imul(cosPitch, sinYaw) - -16384) >> 15;
                                matrix[8] = (16384 + Math.imul(cosPitch, cosYaw)) >> 15;
                                const var35 = (16384 + Math.imul(cosRoll, sinPitch)) >> 15;
                                matrix[1] = (16384 + Math.imul(-sinRoll, cosYaw) + Math.imul(sinYaw, var35)) >> 15;
                                matrix[7] = (Math.imul(cosYaw, var35) + (Math.imul(-sinYaw, -sinRoll) + 16384)) >> 15;
                                matrix[3] = (Math.imul(cosPitch, sinRoll) - -16384) >> 15;
                                const var36 = (Math.imul(sinRoll, sinPitch) + 16384) >> 15;
                                matrix[6] = (16384 + Math.imul(var36, cosYaw) + Math.imul(cosRoll, -sinYaw)) >> 15;
                                matrix[5] = -sinPitch;
                                matrix[4] = (Math.imul(cosRoll, cosPitch) - -16384) >> 15;
                                matrix[14] = (16384 + (Math.imul(-offsetY, matrix[5]) + (Math.imul(matrix[2], -offsetX) - -Math.imul(matrix[8], -offsetZ)))) >> 15;
                                matrix[13] = (Math.imul(matrix[7], -offsetZ) + (Math.imul(-offsetX, matrix[1]) + Math.imul(matrix[4], -offsetY)) - -16384) >> 15;
                                matrix[0] = (Math.imul(cosYaw, cosRoll) - -Math.imul(var36, sinYaw) + 16384) >> 15;
                                matrix[12] = (Math.imul(-offsetX, matrix[0]) - (-Math.imul(-offsetY, matrix[3]) + (-Math.imul(-offsetZ, matrix[6]) + -16384))) >> 15;
                            }

                            matrix[11] = offsetZ;
                            matrix[10] = offsetY;
                            matrix[9] = offsetX;
                        }

                        if (pitch !== 0 || yaw !== 0 || roll !== 0) {
                            requireNonNull(arrayAtObj(meshes, i)).rotate(pitch, yaw, roll);
                        }

                        if (offsetX !== 0 || offsetY !== 0 || offsetZ !== 0) {
                            requireNonNull(arrayAtObj(meshes, i)).Translate(offsetX, offsetY, offsetZ);
                        }
                    }
                }

                const merged = new ModelUnlit(meshes, meshes.length); // var21
                for (let i = 0; i < 5; i++) {
                    if (arrayAtI32(this.colours, i) < arrayAtObj(PlayerModel.recolourDestinations, i).length) {
                        merged.Recolour(arrayAtI16(PlayerModel.recolourSources, i), arrayAtI16(arrayAtObj(PlayerModel.recolourDestinations, i), arrayAtI32(this.colours, i)));
                    }

                    if (arrayAtI32(this.colours, i) < arrayAtObj(PlayerModel.recolourDestinations2, i).length) {
                        merged.Recolour(arrayAtI16(PlayerModel.recolourSources2, i), arrayAtI16(arrayAtObj(PlayerModel.recolourDestinations2, i), arrayAtI32(this.colours, i)));
                    }
                }

                model = merged.Light(64, 850, -30, -50, -30);
                // HD hh.a: upload the normal and UV streams of the cached body.
                if (glJar && GlRenderer.active) {
                    const GlModel = loadGlModel();
                    if (!(model instanceof GlModel)) throw new TypeError('ClassCastException: not a GlModel');
                    model.prepareBuffers(false, false, true, true, false, false, true);
                }
                if (cache) {
                    PlayerModel.modelCache2.Put(key, model);
                    this.cachedModelKey = key;
                }
            }
        }

        let transparencies = false; // var17
        let slotAnimated = false; // var16
        let colours = false; // var18
        let special = false; // var19
        const slotCount = slotAnims === null ? 0 : slotAnims.length; // var20
        for (let slot = 0; slot < slotCount; slot++) {
            const anim = arrayAtObj(slotAnims, slot);
            if (anim === null) {
                continue;
            }

            const slotSeq = SeqType.List(anim.seq); // var22
            if (slotSeq.frames === null) {
                continue;
            }

            slotAnimated = true;
            arrayPutObj(PlayerModel.layerSeqs, slot, slotSeq);
            const next = anim.next; // var24
            const frame = anim.frame; // var23
            let frameId = arrayAtI32(slotSeq.frames, frame); // var25
            arrayPutObj(PlayerModel.slotFramesets, slot, AnimFrameSet.get(frameId >>> 16));
            frameId &= 65535;
            arrayPutI32(PlayerModel.layerFrameIds, slot, frameId);
            const frameset = arrayAtObj(PlayerModel.slotFramesets, slot);
            if (frameset !== null) {
                colours = frameset.getAnimateColours(frameId) || colours;
                transparencies = frameset.GetAnimateTransparencies(frameId) || transparencies;
                special = slotSeq.special || special;
            }

            if ((slotSeq.tween || SeqType.forceTween) && next !== -1 && next < slotSeq.frames.length) {
                arrayPutI32(PlayerModel.layerFrameDelays, slot, arrayAtI32(slotSeq.delays, frame));
                arrayPutI32(PlayerModel.layerFrameCycles, slot, anim.cycle);
                let nextFrameId = arrayAtI32(slotSeq.frames, next); // var26
                arrayPutObj(PlayerModel.slotNextFramesets, slot, AnimFrameSet.get(nextFrameId >>> 16));
                nextFrameId &= 65535;
                arrayPutI32(PlayerModel.slotNextFrames, slot, nextFrameId);
                const nextFrameset = arrayAtObj(PlayerModel.slotNextFramesets, slot);
                if (nextFrameset !== null) {
                    colours = nextFrameset.getAnimateColours(nextFrameId) || colours;
                    transparencies = nextFrameset.GetAnimateTransparencies(nextFrameId) || transparencies;
                }
            } else {
                arrayPutI32(PlayerModel.layerFrameDelays, slot, 0);
                arrayPutI32(PlayerModel.layerFrameCycles, slot, 0);
                arrayPutObj(PlayerModel.slotNextFramesets, slot, null);
                arrayPutI32(PlayerModel.slotNextFrames, slot, -1);
            }
        }

        if (!slotAnimated && seq === null && walkSeq === null) {
            return model;
        }

        let seqFrameId = -1; // var22
        let seqDelay = 0; // var24
        let seqNextFrameId = -1; // var23
        let seqFrameset: AnimFrameSet | null = null; // var25
        let seqNextFrameset: AnimFrameSet | null = null; // var26
        if (!check) {
            Client.IsIgnored(-48, null);
        }

        if (seq !== null) {
            seqFrameId = arrayAtI32(seq.frames, seqFrame);
            const seqGroup = seqFrameId >>> 16; // var27
            seqFrameset = AnimFrameSet.get(seqGroup);
            seqFrameId &= 65535;
            if (seqFrameset !== null) {
                colours = seqFrameset.getAnimateColours(seqFrameId) || colours;
                transparencies = seqFrameset.GetAnimateTransparencies(seqFrameId) || transparencies;
                special = seq.special || special;
            }

            if ((seq.tween || SeqType.forceTween) && seqNext !== -1 && seqNext < requireNonNull(seq.frames).length) {
                seqDelay = arrayAtI32(seq.delays, seqFrame);
                seqNextFrameId = arrayAtI32(seq.frames, seqNext);
                const seqNextGroup = seqNextFrameId >>> 16; // var28
                seqNextFrameId &= 65535;
                if (seqNextGroup === seqGroup) {
                    seqNextFrameset = seqFrameset;
                } else {
                    seqNextFrameset = AnimFrameSet.get(seqNextFrameId >>> 16);
                }

                if (seqNextFrameset !== null) {
                    colours = seqNextFrameset.getAnimateColours(seqNextFrameId) || colours;
                    transparencies = seqNextFrameset.GetAnimateTransparencies(seqNextFrameId) || transparencies;
                }
            }
        }

        let walkFrameset: AnimFrameSet | null = null; // var30
        let walkDelay = 0; // var29
        let walkFrameId = -1; // var27
        let walkNextFrameId = -1; // var28
        let walkNextFrameset: AnimFrameSet | null = null; // var31
        if (walkSeq !== null) {
            walkFrameId = arrayAtI32(walkSeq.frames, walkFrame);
            const walkGroup = walkFrameId >>> 16; // var32
            walkFrameId &= 65535;
            walkFrameset = AnimFrameSet.get(walkGroup);
            if (walkFrameset !== null) {
                colours = walkFrameset.getAnimateColours(walkFrameId) || colours;
                transparencies = walkFrameset.GetAnimateTransparencies(walkFrameId) || transparencies;
                special = walkSeq.special || special;
            }

            if ((walkSeq.tween || SeqType.forceTween) && walkNext !== -1 && walkNext < requireNonNull(walkSeq.frames).length) {
                walkDelay = arrayAtI32(walkSeq.delays, walkFrame);
                walkNextFrameId = arrayAtI32(walkSeq.frames, walkNext);
                const walkNextGroup = walkNextFrameId >>> 16; // var33
                walkNextFrameId &= 65535;
                if (walkGroup === walkNextGroup) {
                    walkNextFrameset = walkFrameset;
                } else {
                    walkNextFrameset = AnimFrameSet.get(walkNextFrameId >>> 16);
                }

                if (walkNextFrameset !== null) {
                    colours = walkNextFrameset.getAnimateColours(walkNextFrameId) || colours;
                    transparencies = walkNextFrameset.GetAnimateTransparencies(walkNextFrameId) || transparencies;
                }
            }
        }

        const animated = model.CopyForAnimActor(!transparencies, !colours, !special); // var32
        let mask = 1; // var34
        for (let slot = 0; slot < slotCount; slot++) {
            if (arrayAtObj(PlayerModel.slotFramesets, slot) !== null) {
                animated.animateMasked(
                    arrayAtObj(PlayerModel.slotFramesets, slot),
                    arrayAtI32(PlayerModel.layerFrameIds, slot),
                    arrayAtObj(PlayerModel.slotNextFramesets, slot),
                    arrayAtI32(PlayerModel.slotNextFrames, slot),
                    (arrayAtI32(PlayerModel.layerFrameCycles, slot) - 1) | 0,
                    arrayAtI32(PlayerModel.layerFrameDelays, slot),
                    mask,
                    requireNonNull(arrayAtObj(PlayerModel.layerSeqs, slot)).special,
                    arrayAtObj(this.basTransforms, slot)
                );
            }

            mask <<= 1;
        }

        if (seqFrameset === null || walkFrameset === null) {
            if (seqFrameset !== null) {
                animated.Animate(seqFrameset, seqFrameId, seqNextFrameset, seqNextFrameId, (-1 + seqCycle) | 0, seqDelay, requireNonNull(seq).special);
            } else if (walkFrameset !== null) {
                animated.Animate(walkFrameset, walkFrameId, walkNextFrameset, walkNextFrameId, (-1 + walkCycle) | 0, walkDelay, requireNonNull(walkSeq).special);
            }
        } else {
            animated.SplitAnimate(
                seqFrameset,
                seqFrameId,
                seqNextFrameset,
                seqNextFrameId,
                (-1 + seqCycle) | 0,
                seqDelay,
                walkFrameset,
                walkFrameId,
                walkNextFrameset,
                walkNextFrameId,
                (walkCycle - 1) | 0,
                walkDelay,
                requireNonNull(seq).mask,
                requireNonNull(walkSeq).special || requireNonNull(seq).special
            );
        }

        for (let slot = 0; slot < slotCount; slot++) {
            arrayPutObj(PlayerModel.slotFramesets, slot, null);
            arrayPutObj(PlayerModel.slotNextFramesets, slot, null);
            arrayPutObj(PlayerModel.layerSeqs, slot, null);
        }

        return animated;
    }

    // cl.a(IILek;II)Lnd; (NXT PlayerModel::GetHeadModel)
    // Java parameters: var1 seqNext, var2 seqCycle, var3 seq, var4 seqFrame. The chathead: the obj head meshes and kit
    // heads of the 12 parts merged in slot order, recoloured, lit and cached by modelKey, then animated by seq
    // (AnimateModelWithExtra). Returns null while a head mesh is loading. Stripped: the int dummy var5. Its only caller,
    // aj.a(Lcl;IIZIZLek;)Lnd; at 0xfb, passes bipush -123, so `54 % ((1 - var5) / 39)` is 54 % 3 and never throws.
    GetHeadModel(seqNext: number, seqCycle: number, seq: SeqType | null, seqFrame: number): ModelLit | null {
        if (this.npcId !== -1) {
            return NpcType.List(this.npcId).GetHeadModel(seq, seqNext, seqFrame, seqCycle);
        }

        let model = PlayerModel.modelCache.Find(this.modelKey); // var6
        if (model === null) {
            let loading = false; // var7
            for (let i = 0; i < 12; i++) {
                const part = arrayAtI32(this.equipment, i); // var9
                if ((1073741824 & part) !== 0) {
                    if (!ObjType.List(part & 1073741823).CheckHeadModel(this.female)) {
                        loading = true;
                    }
                } else if ((part & -2147483648) !== 0 && !IdkType.List(part & 1073741823).CheckHead()) {
                    loading = true;
                }
            }

            if (loading) {
                return null;
            }

            const meshes = new Array<ModelUnlit | null>(12).fill(null); // var9
            let count = 0; // var10
            for (let i = 0; i < 12; i++) {
                const part = arrayAtI32(this.equipment, i); // var12
                if ((part & 1073741824) !== 0) {
                    const mesh = ObjType.List(part & 1073741823).GetHeadModelNoCheck(this.female, 0); // var13
                    if (mesh !== null) {
                        meshes[count++] = mesh;
                    }
                } else if ((-2147483648 & part) !== 0) {
                    const mesh = IdkType.List(1073741823 & part).GetHeadNoCheck();
                    if (mesh !== null) {
                        meshes[count++] = mesh;
                    }
                }
            }

            const merged = new ModelUnlit(meshes, count); // var12
            for (let i = 0; i < 5; i++) {
                if (arrayAtI32(this.colours, i) < arrayAtObj(PlayerModel.recolourDestinations, i).length) {
                    merged.Recolour(arrayAtI16(PlayerModel.recolourSources, i), arrayAtI16(arrayAtObj(PlayerModel.recolourDestinations, i), arrayAtI32(this.colours, i)));
                }

                if (arrayAtI32(this.colours, i) < arrayAtObj(PlayerModel.recolourDestinations2, i).length) {
                    merged.Recolour(arrayAtI16(PlayerModel.recolourSources2, i), arrayAtI16(arrayAtObj(PlayerModel.recolourDestinations2, i), arrayAtI32(this.colours, i)));
                }
            }

            model = merged.Light(64, 768, -50, -10, -50);
            PlayerModel.modelCache.Put(this.modelKey, model);
        }

        if (seq !== null) {
            model = seq.AnimateModelWithExtra(seqFrame, seqNext, model, seqCycle);
        }

        return model;
    }

    // cl.a(Lek;IIIIIBI)Lnd; (no NXT counterpart: playermodel.h has only GetTempModel/GetHeadModel, and oldscape IfType
    // has no model type 7, this method's only caller)
    // Java parameters: var1 seq, var2 seqCycle, var3 kit3, var4 seqFrame, var5 kit2, var6 kit1, var8 seqNext; aj passes
    // kit1 = w >>> 16, kit2 = w & 65535, kit3 = kc. The kit heads of three IdkTypes in this player's colours, lit and
    // cached under (long) kit1 | (long) (kit2 << 16) | (long) kit3 << 32 (the middle term is sign-extended from int),
    // then animated by seq. Returns null while a kit head is loading. Stripped: the byte dummy var7. Its only caller,
    // aj.a(Lcl;IIZIZLek;)Lnd; at 0x19f, passes bipush -119, so `if (var7 > -102) this.a(false, null, 54, null, 63, 38)`
    // is dead.
    getKitHeadModel(seq: SeqType | null, seqCycle: number, kit3: number, seqFrame: number, kit2: number, kit1: number, seqNext: number): ModelLit | null {
        const key = BigInt(kit1) | BigInt(kit2 << 16) | (BigInt(kit3) << 32n); // var9
        let model = PlayerModel.modelCache.Find(key); // var11
        if (model === null) {
            const meshes = new Array<ModelUnlit | null>(3).fill(null); // var12
            let count = 0; // var13
            if (!IdkType.List(kit1).CheckHead() || !IdkType.List(kit2).CheckHead() || !IdkType.List(kit3).CheckHead()) {
                return null;
            }

            let mesh: ModelUnlit | null = IdkType.List(kit1).GetHeadNoCheck(); // var14
            if (mesh !== null) {
                meshes[count++] = mesh;
            }

            mesh = IdkType.List(kit2).GetHeadNoCheck();
            if (mesh !== null) {
                meshes[count++] = mesh;
            }

            mesh = IdkType.List(kit3).GetHeadNoCheck();
            if (mesh !== null) {
                meshes[count++] = mesh;
            }

            const merged = new ModelUnlit(meshes, count); // var14
            for (let i = 0; i < 5; i++) {
                if (arrayAtI32(this.colours, i) < arrayAtObj(PlayerModel.recolourDestinations, i).length) {
                    merged.Recolour(arrayAtI16(PlayerModel.recolourSources, i), arrayAtI16(arrayAtObj(PlayerModel.recolourDestinations, i), arrayAtI32(this.colours, i)));
                }

                if (arrayAtObj(PlayerModel.recolourDestinations2, i).length > arrayAtI32(this.colours, i)) {
                    merged.Recolour(arrayAtI16(PlayerModel.recolourSources2, i), arrayAtI16(arrayAtObj(PlayerModel.recolourDestinations2, i), arrayAtI32(this.colours, i)));
                }
            }

            model = merged.Light(64, 768, -50, -10, -50);
            PlayerModel.modelCache.Put(key, model);
        }

        if (seq !== null) {
            model = seq.AnimateModelWithExtra(seqFrame, seqNext, model, seqCycle);
        }

        return model;
    }
}
