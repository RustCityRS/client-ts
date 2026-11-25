import PacketT from '#/io/PacketT';
import LocType from '#/config/LocType';
import ParticleSystem from '#/dash3d/ParticleSystem';
import GameShell from '#/client/GameShell';
import type Signlink from '#/util/Signlink';
import { glJar } from '#/client/ClientVariant';
import { isJavaRuntimeException } from '#/util/JavaException';
import WrappedException from '#/util/WrappedException';
import { requireNonNull } from '#/util/JavaArray';
import { loadGlRenderer } from '#/util/GamepackClasses';

const key = 'runescape-530-preferences';

// Render-only values for the opt-in HD stress test. The Java settings remain the
// source for scripts, saved preferences and protocol fields throughout the test.
const stressGraphics = {
    highDetailTextures: true,
    highDetailTextures2: true,
    showGroundDecorations: true,
    characterShadows: true,
    sceneryShadows: 2,
    highDetailLighting: true,
    highWaterDetail: true,
    flickeringEffects: true,
    fogEnabled: true,
    currentAntiAliasingMode: 2
};

export default class Preferences {
    static brightness = 3; // dg.w:I
    static allLevelsVisible = true; // rj.l:Z
    static removeRoofsSelectively = true; // oi.j:Z
    static showGroundDecorations = true; // lf.i:Z
    static highDetailTextures = true; // b.E:Z
    static manyIdleAnimations = true; // jh.j:Z
    static flickeringEffects = true; // ai.j:Z
    static highDetailTextures2 = true; // lf.j:Z
    static characterShadows = true; // m.Q:Z
    static sceneryShadows = 2; // rf.x:I
    static highDetailLighting = true; // th.g:Z
    static highWaterDetail = true; // kc.a:Z
    static fogEnabled = true; // uc.k:Z
    static currentAntiAliasingMode = 0; // kf.d:I
    static antiAliasingMode = 0; // kg.A:I
    static stereo = true; // q.b:Z
    static soundEffectVolume = 127; // pd.t:I
    static musicVolume = 255; // sd.N:I
    static areaSoundVolume = 127; // dd.u:I
    static fullscreenWidth = 0; // wa.c:I
    static fullscreenHeight = 0; // ef.E:I
    static windowMode = 0; // aa.h:I
    static steppedCameraKeys = false; // hc.a:Z
    static favouriteWorld = 0; // j.f:I
    static buildArea = 0; // oa.j:I
    static version10Option = false; // lf.c:Z
    static cursorsEnabled = true; // wb.db:Z
    static safeMode = false; // we.y:Z
    static sent = true; // qc.W:Z

    static graphics: Readonly<typeof stressGraphics> = this;

    static setStressGraphics(enabled: boolean): void {
        this.graphics = enabled ? stressGraphics : this;
    }

    static get stressGraphicsEnabled(): boolean {
        return this.graphics === stressGraphics;
    }

    // SD dl.a(Z)Z, HD km.f(I)Z
    static getAllLevelsVisible(): boolean {
        if (glJar && loadGlRenderer().active) return true;
        return this.allLevelsVisible;
    }

    // SD pb.a(BZ)V, HD ec.a(IZ)V
    static setAllLevelsVisible(visible: boolean): void {
        this.allLevelsVisible = visible;
        LocType.m_lowMem = !this.getAllLevelsVisible();
    }

    // SD jd.a(ILfb;)V, HD gf.a(Lll;I)V. The browser supplies the settings file through localStorage.
    static load(useBrowserHdDefaults = false): void {
        if (glJar) {
            this.brightness = 3;
            this.setAllLevelsVisible(true);
            this.removeRoofsSelectively = true;
            this.stereo = true;
            this.highWaterDetail = true;
            this.antiAliasingMode = useBrowserHdDefaults ? 2 : 0;
            this.fullscreenHeight = 0;
            this.showGroundDecorations = true;
            this.flickeringEffects = true;
            this.manyIdleAnimations = true;
            this.areaSoundVolume = 127;
            this.fogEnabled = true;
            this.characterShadows = true;
            this.fullscreenWidth = 0;
            this.sceneryShadows = 2;
            this.highDetailTextures2 = true;
            this.highDetailLighting = true;
            this.musicVolume = 255;
            this.highDetailTextures = true;
            this.currentAntiAliasingMode = useBrowserHdDefaults ? 2 : 0;
            this.soundEffectVolume = 127;
            ParticleSystem.setDetailLevel(GameShell.maxMemory < 96 ? 0 : 2);
            this.favouriteWorld = 0;
            this.buildArea = 0;
            this.steppedCameraKeys = false;
            this.cursorsEnabled = true;
            this.safeMode = false;
            this.version10Option = false;
            this.windowMode = useBrowserHdDefaults ? 2 : 0;
        } else {
            this.brightness = 3;
            this.setAllLevelsVisible(true);
            this.removeRoofsSelectively = true;
            this.fogEnabled = true;
            this.fullscreenHeight = 0;
            this.currentAntiAliasingMode = 0;
            this.highWaterDetail = true;
            this.stereo = true;
            this.characterShadows = true;
            this.soundEffectVolume = 127;
            this.flickeringEffects = true;
            this.sceneryShadows = 2;
            this.highDetailTextures = true;
            this.fullscreenWidth = 0;
            this.musicVolume = 255;
            this.highDetailTextures2 = true;
            this.showGroundDecorations = true;
            this.areaSoundVolume = 127;
            this.highDetailLighting = true;
            this.antiAliasingMode = 0;
            this.manyIdleAnimations = true;
            ParticleSystem.setDetailLevel(GameShell.maxMemory < 96 ? 0 : 2);
            this.version10Option = false;
            this.windowMode = 0;
            this.buildArea = 0;
            this.cursorsEnabled = true;
            this.steppedCameraKeys = false;
            this.safeMode = false;
            this.favouriteWorld = 0;
        }
        try {
            const saved = window.localStorage.getItem(key);
            if (saved === null) return;
            if (saved.trimStart().startsWith('[')) {
                this.decode(migrateBrowserSettings(JSON.parse(saved)));
            } else {
                this.decode(new PacketT(Uint8Array.from(atob(saved), char => char.charCodeAt(0))));
            }
        } catch {
            /* The Java file provider may be unavailable. */
        }
    }

    // SD ja.a(Lgd;I)V, HD kk.b(Lwa;I)V
    static decode(packet: PacketT | null): void {
        try {
            packet = requireNonNull(packet);
            const bytes = requireNonNull(packet.m_data);
            if (((bytes.length - packet.m_pos) | 0) < 1) return;
            const version = packet.g1(glJar ? -23 : 100);
            if (version > 11) return;
            let required: number;
            switch (version) {
                case 0:
                    required = 19;
                    break;
                case 1:
                    required = 23;
                    break;
                case 2:
                    required = 22;
                    break;
                case 3:
                    required = 23;
                    break;
                case 4:
                    required = 24;
                    break;
                case 5:
                    required = 28;
                    break;
                case 6:
                    required = 28;
                    break;
                case 7:
                    required = 29;
                    break;
                case 8:
                    required = 30;
                    break;
                case 9:
                    required = 31;
                    break;
                case 10:
                    required = 32;
                    break;
                default:
                    required = 33;
                    break;
            }
            if (((bytes.length - packet.m_pos) | 0) < required) return;
            this.brightness = packet.g1();
            if (this.brightness < 1) this.brightness = 1;
            else if (this.brightness > 4) this.brightness = 4;
            this.setAllLevelsVisible(packet.g1() === 1);
            this.removeRoofsSelectively = packet.g1() === 1;
            this.showGroundDecorations = packet.g1() === 1;
            this.highDetailTextures = packet.g1() === 1;
            this.manyIdleAnimations = packet.g1() === 1;
            this.flickeringEffects = packet.g1() === 1;
            this.highDetailTextures2 = packet.g1() === 1;
            this.characterShadows = packet.g1() === 1;
            this.sceneryShadows = packet.g1();
            if (this.sceneryShadows > 2) this.sceneryShadows = 2;
            this.highDetailLighting = packet.g1() === 1;
            if (version < 2) packet.g1();
            this.highWaterDetail = packet.g1() === 1;
            this.fogEnabled = packet.g1() === 1;
            this.antiAliasingMode = packet.g1();
            if (this.antiAliasingMode > 2) this.antiAliasingMode = 2;
            this.currentAntiAliasingMode = this.antiAliasingMode;
            this.stereo = packet.g1() === 1;
            this.soundEffectVolume = packet.g1();
            if (this.soundEffectVolume > 127) this.soundEffectVolume = 127;
            this.musicVolume = packet.g1();
            this.areaSoundVolume = packet.g1();
            if (this.areaSoundVolume > 127) this.areaSoundVolume = 127;
            if (version >= 1) {
                this.fullscreenWidth = packet.g2();
                this.fullscreenHeight = packet.g2();
            }
            if (version >= 3 && version < 6) packet.g1();
            if (version >= 4) {
                let level = packet.g1();
                if (GameShell.maxMemory < 96) level = 0;
                ParticleSystem.setDetailLevel(level);
            }
            if (version >= 5) this.favouriteWorld = packet.g4();
            if (version >= 6) this.windowMode = packet.g1();
            if (version >= 7) this.safeMode = packet.g1() === 1;
            if (version >= 8) this.steppedCameraKeys = packet.g1() === 1;
            if (version >= 9) this.buildArea = packet.g1();
            if (version >= 10) this.version10Option = packet.g1() !== 0;
            if (version >= 11) this.cursorsEnabled = packet.g1() !== 0;
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            const reference = packet === null ? 'null' : '{...}';
            throw WrappedException.wrap(error, glJar ? 'kk.F(' + reference + ',-1)' : 'ja.F(' + reference + ',93)');
        }
    }

    // SD db.b(I)Lgd;, HD dl.a(B)Lwa;
    static encode(): PacketT {
        const packet = new PacketT(34);
        packet.p1(11);
        packet.p1(this.brightness);
        packet.p1(+this.allLevelsVisible);
        packet.p1(+this.removeRoofsSelectively);
        packet.p1(+this.showGroundDecorations);
        packet.p1(+this.highDetailTextures);
        packet.p1(+this.manyIdleAnimations);
        packet.p1(+this.flickeringEffects);
        packet.p1(+this.highDetailTextures2);
        packet.p1(+this.characterShadows);
        packet.p1(this.sceneryShadows);
        packet.p1(+this.highDetailLighting);
        packet.p1(+this.highWaterDetail);
        packet.p1(+this.fogEnabled);
        packet.p1(this.antiAliasingMode);
        packet.p1(+this.stereo);
        packet.p1(this.soundEffectVolume);
        packet.p1(this.musicVolume);
        packet.p1(this.areaSoundVolume);
        packet.p2(this.fullscreenWidth);
        packet.p2(this.fullscreenHeight);
        packet.p1(ParticleSystem.getDetailLevel());
        packet.p4(this.favouriteWorld);
        packet.p1(this.windowMode);
        packet.p1(+this.safeMode);
        packet.p1(+this.steppedCameraKeys);
        packet.p1(this.buildArea);
        packet.p1(+this.version10Option);
        packet.p1(+this.cursorsEnabled);
        return packet;
    }

    // b.a(Lfb;B)V
    static write(_provider?: Signlink | null): void {
        try {
            const storage = window.localStorage;
            const packet = this.encode();
            const bytes = requireNonNull(packet.m_data).subarray(0, packet.m_pos);
            storage.setItem(key, btoa(String.fromCharCode(...bytes)));
        } catch {
            /* Keep the live values if the settings file cannot be opened or written. */
        }
    }

    // SD e.a(I)I, HD lf.c(I)I
    static packPreferences(): number {
        if (glJar) {
            return (
                ((+this.stereo << 19) +
                    (+this.fogEnabled << 16) +
                    (+this.highWaterDetail << 15) +
                    (+this.highDetailLighting << 13) +
                    (+this.characterShadows << 10) +
                    (+this.highDetailTextures2 << 9) +
                    (+this.manyIdleAnimations << 7) +
                    (+this.highDetailTextures << 6) +
                    (+this.showGroundDecorations << 5) +
                    (+this.allLevelsVisible << 3) +
                    (this.brightness & 7) +
                    (+this.removeRoofsSelectively << 4) +
                    (+this.flickeringEffects << 8) +
                    ((this.sceneryShadows << 11) & 6144) +
                    (+(this.soundEffectVolume !== 0) << 20) +
                    (+(this.musicVolume !== 0) << 21) +
                    (+(this.areaSoundVolume !== 0) << 22) +
                    (ParticleSystem.getDetailLevel() << 23)) |
                0
            );
        }
        return (
            ((+(this.areaSoundVolume !== 0) << 22) +
                (+(this.soundEffectVolume !== 0) << 20) +
                (+this.fogEnabled << 16) +
                (+this.highDetailLighting << 13) +
                (+this.characterShadows << 10) +
                (+this.manyIdleAnimations << 7) +
                (+this.highDetailTextures << 6) +
                (+this.showGroundDecorations << 5) +
                (this.brightness & 7) +
                (+this.allLevelsVisible << 3) +
                (+this.removeRoofsSelectively << 4) +
                (+this.flickeringEffects << 8) +
                (+this.highDetailTextures2 << 9) +
                ((this.sceneryShadows << 11) & 6144) +
                (+this.highWaterDetail << 15) +
                (+this.stereo << 19) +
                (+(this.musicVolume !== 0) << 21) +
                (ParticleSystem.getDetailLevel() << 23)) |
            0
        );
    }
}

// Earlier browser builds stored CS2 setting indices in JSON. Translate that format once
// at the storage boundary so both file formats go through ja.a.
function migrateBrowserSettings(values: unknown): PacketT {
    const packet = Preferences.encode();
    if (Array.isArray(values)) {
        const bytes = requireNonNull(packet.m_data);
        const indices = [1, 2, 3, 5, 6, 7, 8, 9, 10, 11, 12, 14, 15, 24, 17, 18, 19, 20, 23, 28];
        const offsets = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 23, 33];
        for (let i = 0; i < indices.length; i++) {
            const id = indices[i];
            const value: unknown = values[id];
            if (typeof value !== 'number' || !Number.isInteger(value)) continue;
            let normalized: number;
            switch (id) {
                case 1:
                    normalized = Math.max(1, Math.min(4, value));
                    break;
                case 11:
                case 24:
                    normalized = value >= 0 && value <= 2 ? value : 0;
                    break;
                case 18:
                case 20:
                    normalized = Math.max(0, Math.min(127, value));
                    break;
                case 19:
                    normalized = Math.max(0, Math.min(255, value));
                    break;
                case 23:
                    normalized = Math.max(0, Math.min(2, value));
                    break;
                default:
                    normalized = +(value === 1);
            }
            bytes[offsets[i]] = normalized;
        }
    }
    packet.m_pos = 0;
    return packet;
}
