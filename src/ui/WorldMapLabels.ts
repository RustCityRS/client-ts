import { isJavaRuntimeException } from '#/util/JavaException';
import { releaseReferences } from '#/util/StaticReferences';
import WrappedException from '#/util/WrappedException';
import WorldMap from './WorldMap';
import type Js5 from '#/cache/Js5';
import JagString, { fromLiteral } from '#/datastruct/JagString';
import PacketT from '#/io/PacketT';
import { arrayAtI8, arrayAtObj, requireNonNull } from '#/util/JavaArray';
import AnimFrameSetClass from '#/dash3d/AnimFrameSet';
import LocalisedTextClass from './LocalisedText';
import { loadMinimenu, loadTitleFlames } from '#/util/GamepackClasses';
import { glJar } from '#/client/ClientVariant';

export default class WorldMapLabels {
    // HD se.b(I)V
    static releaseHdStatics(guard: number): void {
        try {
            const TitleFlames = loadTitleFlames();
            releaseReferences(TitleFlames, 'flameColours');
            if (guard !== 0) {
                return;
            }
            const AnimFrameSet = AnimFrameSetClass;
            releaseReferences(AnimFrameSet, 'basesArchive');
            const LocalisedText = LocalisedTextClass;
            releaseReferences(LocalisedText, 'englishSelect', 'preparedSoundEngine', 'englishPreparedSoundEngine', 'select', 'germanLoadedInputHandler');
            const Minimenu = loadMinimenu();
            releaseReferences(Minimenu, 'groundArrow');
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'se.F(' + guard + ')');
        }
    }

    static scene: WorldMapLabels | null = null; // ug.d:Lkc;
    static readonly suffix = fromLiteral('_labels'); // bi.l:Lid;
    static readonly lineBreakTag = fromLiteral('<br>'); // cg.n:Lid;

    static labelIndex = 0; // le.l:I
    // SD wh.a(Lid;B)I, HD hc.a(Lna;Z)I
    static findExactLabel(name: JagString | null, hdGuard = glJar ? false : undefined): number {
        try {
            if (WorldMap.labels !== null && requireNonNull(name).length !== 0) {
                if (hdGuard === true) return -117;
                for (let i = 0; i < WorldMap.labels.count; i++) {
                    if (requireNonNull(arrayAtObj(WorldMap.labels.text, i)).replace(this.lineBreakTag, WorldMap.space).equals(name)) return i;
                }
            }
            return -1;
        } catch (error) {
            if (hdGuard === undefined || !isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'hc.F(' + (name === null ? 'null' : '{...}') + ',' + hdGuard + ')');
        }
    }

    colors: Int32Array; // kc.b:[I
    flags: Int8Array; // kc.f:[B
    count: number; // kc.h:I
    text: (JagString | null)[]; // kc.j:[Lid;
    z: Int16Array; // kc.l:[S
    x: Int16Array; // kc.m:[S

    // kc.<init>(I)V
    constructor(count: number) {
        this.count = count;
        this.text = new Array<JagString | null>(count).fill(null);
        this.z = new Int16Array(count);
        this.colors = new Int32Array(count);
        this.flags = new Int8Array(count);
        this.x = new Int16Array(count);
    }

    // kc.a(IB)Z
    hasFlag4(index: number): boolean {
        return (arrayAtI8(this.flags, index) & 4) !== 0;
    }

    // kc.b(IB)I
    size(index: number): number {
        return arrayAtI8(this.flags, index) & 3;
    }

    // kc.a(IZ)Z
    isVisible(index: number): boolean {
        return (arrayAtI8(this.flags, index) & 16) === 0;
    }

    // kc.a(II)Z
    hasFlag8(index: number): boolean {
        return (arrayAtI8(this.flags, index) & 8) !== 0;
    }

    // ii.a(ILid;Lal;)Lkc;
    static load(name: JagString | null, archive: Js5 | null): WorldMapLabels {
        archive = requireNonNull(archive);
        const group = archive.GetGroupId(name);
        if (group === -1) return new WorldMapLabels(0);
        const files = requireNonNull(archive.GetFileList(group));
        const labels = new WorldMapLabels(files.length);
        for (let i = 0; i < labels.count; i++) {
            const packet = new PacketT(archive.GetFile(files[i], group));
            labels.text[i] = packet.gStringNoConversion();
            labels.flags[i] = packet.g1s();
            labels.x[i] = packet.g2();
            labels.z[i] = packet.g2();
            labels.colors[i] = packet.g4();
        }
        return labels;
    }
}
