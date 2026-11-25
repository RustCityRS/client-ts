import type PacketT from '#/io/PacketT';
import type PointLightMesh from './PointLightMesh';
import { arrayAtI32, arrayPutF32, arrayPutI16, requireNonNull } from '#/util/JavaArray';
import { isJavaRuntimeException } from '#/util/JavaException';
import WrappedException from '#/util/WrappedException';
import LocalisedText from '#/ui/LocalisedText';
import { releaseReferences } from '#/util/StaticReferences';
import Pix3D from './Pix3D';
import TextureOpPerlinNoise from './TextureOpPerlinNoise';

// gi in runescape_gl.jar. NXT runetek5/scene/StaticPointLight.cpp retains the level flags,
// influence ranges and all fifteen AssignCalculatedParameters flicker presets.
export default class StaticPointLight {
    // HD gi.a(B)V
    static releaseHdStatics(guard: number): void {
        try {
            releaseReferences(LocalisedText, 'englishUnableToFind', 'frenchLoadingWorldListData', 'frenchChatcol8', 'unableToFind');
            if (guard !== -2) return;
            releaseReferences(LocalisedText, 'germanChatcol3');
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'gi.E(' + guard + ')');
        }
    }

    static mPerlinNoise: Int32Array | null = null; // f.P
    m_lightLevelsBelow = false; // gi.a
    offset = 0; // gi.d
    waveType = 0; // gi.e
    bridge = false; // gi.g
    y = 0; // gi.i
    m_radius = 0; // gi.j
    amplitude = 0; // gi.p
    x = 0; // gi.q
    m_level = 0; // gi.r
    m_flickerType = 0; // gi.t
    influenceRanges: Int16Array | null = null; // gi.u
    m_intensity = 0; // gi.w
    z = 0; // gi.x
    frequency = 0; // gi.y
    attenuation = 0; // gi.z
    m_lightLevelsAbove = false; // gi.A
    mesh: PointLightMesh | null = null; // gi.B:Lfj;
    m_rGB = 0; // gi.C
    m_phase = 0; // gi.E
    readonly diffuse = new Float32Array(4); // gi.I

    constructor(packet?: PacketT | null) {
        try {
            if (StaticPointLight.mPerlinNoise === null) {
                StaticPointLight.mPerlinNoise = TextureOpPerlinNoise.generateLine(true, 8, 2048, 4, Math.fround(0.4), 8, 35);
            }
            if (packet === undefined) {
                this.AssignCalculatedParameters();
                return;
            }
            this.m_level = requireNonNull(packet).g1(-99);
            this.m_lightLevelsBelow = (this.m_level & 16) !== 0;
            this.m_lightLevelsAbove = (this.m_level & 8) !== 0;
            this.m_level &= 7;
            this.x = requireNonNull(packet).g2(1);
            this.z = requireNonNull(packet).g2(1);
            this.y = requireNonNull(packet).g2(1);
            this.m_radius = requireNonNull(packet).g1(-78);
            this.setAttenuation();
            this.influenceRanges = new Int16Array(this.m_radius * 2 + 1);
            for (let i = 0; i < this.influenceRanges.length; i++) {
                arrayPutI16(this.influenceRanges, i, requireNonNull(packet).g2(1));
            }
            this.m_rGB = arrayAtI32(Pix3D.colourTable, requireNonNull(packet).g2(1));
            const flicker = requireNonNull(packet).g1(-95);
            this.m_phase = (flicker << 3) & 0x700;
            this.m_flickerType = flicker & 31;
            if (this.m_flickerType !== 31) this.AssignCalculatedParameters();
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'gi.<init>(' + (packet === undefined ? '' : packet === null ? 'null' : '{...}') + ')');
        }
    }

    // gi.a(I)V
    private setAttenuation(): void {
        const radius = ((this.m_radius << 7) + 64) | 0;
        this.attenuation = Math.fround(1 / Math.fround(Math.imul(radius, radius)));
    }

    // gi.a(BIIII)V
    setFlicker(waveType: number, frequency: number, amplitude: number, offset: number): void {
        this.waveType = waveType;
        this.amplitude = amplitude;
        this.offset = offset;
        this.frequency = frequency;
    }

    // gi.c(I)V
    private AssignCalculatedParameters(): void {
        switch (this.m_flickerType) {
            case 2:
                this.amplitude = 2048;
                this.offset = 0;
                this.waveType = 1;
                this.frequency = 2048;
                break;
            case 3:
                this.offset = 0;
                this.frequency = 4096;
                this.waveType = 1;
                this.amplitude = 2048;
                break;
            case 4:
                this.offset = 0;
                this.amplitude = 2048;
                this.waveType = 4;
                this.frequency = 2048;
                break;
            case 5:
                this.waveType = 4;
                this.amplitude = 2048;
                this.frequency = 8192;
                this.offset = 0;
                break;
            case 12:
                this.amplitude = 2048;
                this.waveType = 2;
                this.frequency = 2048;
                this.offset = 0;
                break;
            case 13:
                this.frequency = 8192;
                this.amplitude = 2048;
                this.waveType = 2;
                this.offset = 0;
                break;
            case 10:
                this.amplitude = 512;
                this.waveType = 3;
                this.offset = 1536;
                this.frequency = 2048;
                break;
            case 11:
                this.waveType = 3;
                this.frequency = 4096;
                this.amplitude = 512;
                this.offset = 1536;
                break;
            case 6:
                this.amplitude = 768;
                this.offset = 1280;
                this.waveType = 3;
                this.frequency = 2048;
                break;
            case 7:
                this.amplitude = 768;
                this.offset = 1280;
                this.frequency = 4096;
                this.waveType = 3;
                break;
            case 8:
                this.frequency = 2048;
                this.waveType = 3;
                this.amplitude = 1024;
                this.offset = 1024;
                break;
            case 9:
                this.frequency = 4096;
                this.offset = 1024;
                this.amplitude = 1024;
                this.waveType = 3;
                break;
            case 14:
                this.frequency = 2048;
                this.offset = 1280;
                this.waveType = 1;
                this.amplitude = 768;
                break;
            case 15:
                this.amplitude = 512;
                this.frequency = 4096;
                this.offset = 1536;
                this.waveType = 1;
                break;
            case 16:
                this.frequency = 8192;
                this.offset = 1792;
                this.waveType = 1;
                this.amplitude = 256;
                break;
            default:
                this.frequency = 2048;
                this.offset = 0;
                this.amplitude = 2048;
                this.waveType = 0;
                break;
        }
    }

    // gi.a(ZII)V
    CalculateIntensity(disableFlicker: boolean, cycle: number): void {
        const phase = (this.m_phase + ((Math.imul(cycle, this.frequency) / 50) | 0)) & 2047;
        let wave: number;
        switch (this.waveType) {
            case 1:
                wave = 1024 + (arrayAtI32(Pix3D.sinTable, phase) >> 6);
                break;
            case 3:
                wave = arrayAtI32(StaticPointLight.mPerlinNoise, phase) >> 1;
                break;
            case 4:
                wave = (phase >> 10) << 11;
                break;
            case 2:
                wave = phase;
                break;
            case 5:
                wave = (phase < 1024 ? phase : 2048 - phase) << 1;
                break;
            default:
                wave = 2048;
        }
        if (disableFlicker) wave = 2048;
        this.m_intensity = Math.fround((this.offset + (Math.imul(wave, this.amplitude) >> 11)) | 0) / 2048;
        const scale = Math.fround(this.m_intensity / 255);
        arrayPutF32(this.diffuse, 0, ((this.m_rGB & 16771365) >> 16) * scale);
        arrayPutF32(this.diffuse, 2, scale * (this.m_rGB & 255));
        arrayPutF32(this.diffuse, 1, ((this.m_rGB & 65511) >> 8) * scale);
    }
}
