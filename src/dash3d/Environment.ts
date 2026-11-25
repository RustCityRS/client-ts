import { releaseReferences } from '#/util/StaticReferences';
import GlLighting from '#/gl/GlLighting';
import Client from '#/client/Client';
import Preferences from '#/ui/Preferences';
import type PacketT from '#/io/PacketT';
import { arrayAtObj, arrayPutObj, requireNonNull } from '#/util/JavaArray';
import { isJavaRuntimeException } from '#/util/JavaException';
import WrappedException from '#/util/WrappedException';
import AudioEngineClass from '#/sound/AudioEngine';
import ClientClass from '#/client/Client';
import CollisionMapClass from './CollisionMap';
import LocalisedTextClass from '#/ui/LocalisedText';
import JagStringClass from '#/datastruct/JagString';

// li in runescape_gl.jar. Each 8x8 zone has one light and fog environment.
export default class Environment {
    // HD li.a(B)V
    static releaseHdStatics(guard: number): void {
        try {
            const AudioEngine = AudioEngineClass;
            releaseReferences(AudioEngine, 'music');
            const Client = ClientClass;
            releaseReferences(Client, 'rebuildCommand');
            const CollisionMap = CollisionMapClass;
            releaseReferences(CollisionMap, 'levelMaps');
            const LocalisedText = LocalisedTextClass;
            releaseReferences(LocalisedText, 'englishExamine', 'loadingWordpack', 'frenchPleaseWait', 'englishLoadingWordpack');
            releaseReferences(Client, 'masterIndexStore');
            const JagString = JagStringClass;
            releaseReferences(JagString, 'internTable');
            releaseReferences(LocalisedText, 'examine');
            if (guard !== 53) {
                releaseReferences(AudioEngine, 'music');
            }
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'li.C(' + guard + ')');
        }
    }

    static grid: (Environment | null)[][] | null = Array.from({ length: 13 }, () => Array<Environment | null>(13).fill(null)); // ph.b
    static currentSunX = 0; // gl.f
    static currentSunY = 0; // mi.Z
    static currentSunZ = 0; // li.t
    private static transition = 0; // ab.b
    private static targetAmbient = 0; // jm.s
    private static targetDiffuse = 0; // aj.X
    private static targetBack = 0; // be.Vb
    private static targetSunColour = 0; // ig.d
    private static targetFogColour = 0; // nc.a
    private static targetFogDepth = 0; // sf.c
    private static startDiffuse = 0; // ui.mb
    private static startAmbient = 0; // ej.bb
    private static startFogColour = 0; // vh.e
    private static startFogDepth = 0; // ni.h
    private static startSunColour = 0; // kd.ub
    private static startBack = 0; // p.g
    private static ambient = 0; // en.z
    private static diffuse = 0; // ui.T
    private static back = 0; // bm.a
    private static fogColour = 0; // md.S
    static sunColour = 0; // ve.t
    private static fogDepth = 0; // ge.q

    fogColour: number; // li.a
    sunColour: number; // li.c
    sunZ: number; // li.d
    sunY: number; // li.g
    fogDepth: number; // li.j
    sunX: number; // li.k
    ambient: number; // li.n
    back: number; // li.q
    diffuse: number; // li.s

    constructor(packet?: PacketT | null) {
        if (packet === undefined) {
            this.sunColour = GlLighting.defaultSunColour;
            this.back = Math.fround(1.2);
            this.sunZ = -50;
            this.ambient = 1.15234375;
            this.fogColour = GlLighting.defaultFogColour;
            this.sunY = -60;
            this.diffuse = 0.69921875;
            this.fogDepth = 0;
            this.sunX = -50;
            return;
        }
        try {
            const mask = requireNonNull(packet).g1(-92);
            this.sunColour = (mask & 1) === 0 ? GlLighting.defaultSunColour : requireNonNull(packet).g4(-502942936);
            this.ambient = (mask & 2) === 0 ? 1.15234375 : requireNonNull(packet).g2(1) / 256;
            this.diffuse = (mask & 4) === 0 ? 0.69921875 : requireNonNull(packet).g2(1) / 256;
            this.back = (mask & 8) !== 0 ? requireNonNull(packet).g2(1) / 256 : Math.fround(1.2);
            if ((mask & 16) === 0) {
                this.sunZ = -50;
                this.sunX = -50;
                this.sunY = -60;
            } else {
                this.sunX = requireNonNull(packet).g2s(53);
                this.sunY = requireNonNull(packet).g2s(15);
                this.sunZ = requireNonNull(packet).g2s(50);
            }
            this.fogColour = (mask & 32) === 0 ? GlLighting.defaultFogColour : requireNonNull(packet).g4(-502942936);
            this.fogDepth = (mask & 64) === 0 ? 0 : requireNonNull(packet).g2(1);
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'li.<init>(' + (packet === null ? 'null' : '{...}') + ')');
        }
    }

    // g.b(I)V
    static resetGrid(): void {
        const environment = new Environment();
        for (let x = 0; x < 13; x++) {
            for (let z = 0; z < 13; z++) arrayPutObj(arrayAtObj(Environment.grid, x), z, environment);
        }
    }

    // fm.a(ZII)V
    static setCurrent(zoneZ: number, zoneX: number): void {
        try {
            Environment.currentSunX = requireNonNull(arrayAtObj(arrayAtObj(Environment.grid, zoneX), zoneZ)).sunX;
            Environment.currentSunY = requireNonNull(arrayAtObj(arrayAtObj(Environment.grid, zoneX), zoneZ)).sunY;
            Environment.currentSunZ = requireNonNull(arrayAtObj(arrayAtObj(Environment.grid, zoneX), zoneZ)).sunZ;
            GlLighting.setDirection(Environment.currentSunX, Environment.currentSunY, Environment.currentSunZ);
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'fm.C(true,' + zoneZ + ',' + zoneX + ')');
        }
    }

    // i.b(IIIII)I. At the only two call sites the final guard is 1.
    static update(elapsed: number, zoneZ: number, brightness: number, zoneX: number): number {
        try {
            if (Client.forceImmediateEnvironmentUpdate) {
                elapsed = 1000000;
                Client.forceImmediateEnvironmentUpdate = false;
            }
            const env = requireNonNull(arrayAtObj(arrayAtObj(Environment.grid, zoneX), zoneZ));
            const ambient = Math.fround(Math.fround(Math.fround(Math.fround(brightness) * Math.fround(0.1)) + Math.fround(0.7)) * env.ambient);
            const diffuse = env.diffuse;
            const sun = env.sunColour;
            let depth = env.fogDepth;
            const fog = env.fogColour;
            if (!Preferences.graphics.fogEnabled) depth = 0;
            const back = env.back;
            if (sun !== Environment.targetSunColour || Environment.targetAmbient !== ambient || Environment.targetDiffuse !== diffuse || back !== Environment.targetBack || Environment.targetFogColour !== fog || Environment.targetFogDepth !== depth) {
                Environment.targetAmbient = ambient;
                Environment.startDiffuse = Environment.diffuse;
                Environment.startAmbient = Environment.ambient;
                Environment.targetSunColour = sun;
                Environment.startFogColour = Environment.fogColour;
                Environment.startFogDepth = Environment.fogDepth;
                Environment.targetBack = back;
                Environment.transition = 0;
                Environment.startSunColour = Environment.sunColour;
                Environment.targetFogDepth = depth;
                Environment.targetDiffuse = diffuse;
                Environment.targetFogColour = fog;
                Environment.startBack = Environment.back;
            }
            if (Environment.transition < 65536) {
                Environment.transition = (Environment.transition + Math.imul(250, elapsed)) | 0;
                if (Environment.transition >= 65536) Environment.transition = 65536;
                const target = Math.fround(Environment.transition) / 65536;
                const t = Environment.transition >> 8;
                const s = (65536 - Environment.transition) >> 8;
                Environment.fogColour =
                    (((Math.imul(t, Environment.targetFogColour & 0xff00ff) + Math.imul(Environment.startFogColour & 0xff00ff, s)) & 0xff00ff00) +
                        ((Math.imul(s, Environment.startFogColour & 0xff00) + Math.imul(Environment.targetFogColour & 0xff00, t)) & 0xff0000)) >>
                    8;
                const start = Math.fround((65536 - Environment.transition) | 0) / 65536;
                Environment.ambient = Math.fround(Math.fround(start * Environment.startAmbient) + Math.fround(target * Environment.targetAmbient));
                Environment.diffuse = Math.fround(Math.fround(Environment.startDiffuse * start) + Math.fround(target * Environment.targetDiffuse));
                Environment.back = Math.fround(Math.fround(target * Environment.targetBack) + Math.fround(start * Environment.startBack));
                Environment.sunColour =
                    (((Math.imul(Environment.targetSunColour & 0xff00, t) + Math.imul(s, Environment.startSunColour & 0xff00)) & 0xff0000) +
                        ((Math.imul(Environment.startSunColour & 0xff00ff, s) + Math.imul(Environment.targetSunColour & 0xff00ff, t)) & 0xff00ff00)) >>
                    8;
                Environment.fogDepth = (Math.imul(t, Environment.targetFogDepth) + Math.imul(s, Environment.startFogDepth)) >> 8;
            }
            GlLighting.setSun(Environment.sunColour, Environment.ambient, Environment.diffuse, Environment.back);
            GlLighting.setFog(Environment.fogColour, Environment.fogDepth);
            GlLighting.setDirection(Environment.currentSunX, Environment.currentSunY, Environment.currentSunZ);
            GlLighting.applyLightPositions();
            return Environment.fogColour;
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'i.F(' + [elapsed, zoneZ, brightness, zoneX, 1].join(',') + ')');
        }
    }
}
