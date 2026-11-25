import { isJavaRuntimeException } from '#/util/JavaException';
import { releaseReferences } from '#/util/StaticReferences';
import WrappedException from '#/util/WrappedException';
import type PacketT from '#/io/PacketT';
import { intDivide } from '#/util/IntUtils';
import { arrayAtI32, arrayAtObj, arrayPutI32, requireNonNull } from '#/util/JavaArray';
import type { ColourImageRow } from './ColourImageCache';
import TextureOp from './TextureOp';
import { loadClient } from '#/util/GamepackClasses';

// qe
export default class TextureOpHslAdjust extends TextureOp {
    // HD hk.f(B)V
    static releaseTextureOpHslAdjustStatics(guard: number): void {
        try {
            const Client = loadClient();
            releaseReferences(Client, 'sceneMapUnderwaterLandFile');
            // eslint-disable-next-line @typescript-eslint/no-require-imports -- SD ac stays deferred until hk.f(B)V in TextureOpHslAdjust.releaseTextureOpHslAdjustStatics.
            const MapSpotAnim = (require('./MapSpotAnim') as typeof import('./MapSpotAnim')).default;
            releaseReferences(MapSpotAnim, 'active');
            if (guard <= 38) {
                releaseReferences(Client, 'sceneMapUnderwaterLandFile');
            }
            releaseReferences(Client, 'statEffectiveLevel', 'wm3Command');
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'hk.B(' + guard + ')');
        }
    }

    private hue = 0; // qe.P:I
    private green = 0; // qe.Q:I
    private red = 0; // qe.U:I
    private blue = 0; // qe.X:I
    private saturationDelta = 0; // qe.Y:I
    private lightnessDelta = 0; // qe.Z:I
    private hueDelta = 0; // qe.ab:I
    private saturation = 0; // qe.bb:I
    private lightness = 0; // qe.db:I

    // qe.<init>()V
    constructor() {
        super(1, false);
    }

    // qe.a(IIII)V
    private rgbToHsl(blue: number, red: number, minimumLightness: number, green: number): void {
        let max = red > green ? red : green;
        let min = green > red ? red : green;
        max = blue > max ? blue : max;
        min = blue >= min ? min : blue;
        const delta = (max - min) | 0;
        this.lightness = intDivide((max + min) | 0, 2);
        this.saturation = this.lightness > minimumLightness && this.lightness < 4096 ? intDivide(delta << 12, this.lightness <= 2048 ? this.lightness * 2 : 8192 - this.lightness * 2) : 0;
        if (delta > 0) {
            const dg = intDivide((max - green) << 12, delta);
            const dr = intDivide((max - red) << 12, delta);
            const db = intDivide((max - blue) << 12, delta);
            if (red === max) this.hue = green === min ? (20480 + db) | 0 : (4096 - dg) | 0;
            else if (green === max) this.hue = blue === min ? (dr + 4096) | 0 : (12288 - db) | 0;
            else this.hue = min === red ? (dg + 12288) | 0 : (20480 - dr) | 0;
            this.hue = intDivide(this.hue, 6);
        } else {
            this.hue = 0;
        }
    }

    // qe.a(ZI)[[I
    override getColourOutput(row: number): ColourImageRow | null {
        const dest = requireNonNull(this.colourImageCache).get(row);
        if (requireNonNull(this.colourImageCache).invalid) {
            const source = this.getChildColourOutput(row, 0);
            const g = arrayAtObj(source, 1),
                r = arrayAtObj(source, 0);
            const outR = arrayAtObj(dest, 0),
                outB = arrayAtObj(dest, 2),
                outG = arrayAtObj(dest, 1);
            const b = arrayAtObj(source, 2);
            for (let x = 0; x < TextureOp.width; x++) {
                this.rgbToHsl(arrayAtI32(b, x), arrayAtI32(r, x), 0, arrayAtI32(g, x));
                this.lightness = (this.lightness + this.lightnessDelta) | 0;
                if (this.lightness < 0) this.lightness = 0;
                this.hue = (this.hue + this.hueDelta) | 0;
                if (this.lightness > 4096) this.lightness = 4096;
                this.saturation = (this.saturation + this.saturationDelta) | 0;
                if (this.saturation < 0) this.saturation = 0;
                while (this.hue < 0) this.hue = (this.hue + 4096) | 0;
                while (this.hue > 4096) this.hue = (this.hue - 4096) | 0;
                if (this.saturation > 4096) this.saturation = 4096;
                this.hslToRgb(this.saturation, this.hue, this.lightness);
                arrayPutI32(outR, x, this.red);
                arrayPutI32(outG, x, this.green);
                arrayPutI32(outB, x, this.blue);
            }
        }
        return dest;
    }

    // qe.a(Lgd;ZI)V
    override decode(packet: PacketT | null, code: number): void {
        if (code === 0) this.hueDelta = requireNonNull(packet).g2s();
        else if (code === 1) this.saturationDelta = intDivide(requireNonNull(packet).g1s() << 12, 100);
        else if (code === 2) this.lightnessDelta = intDivide(requireNonNull(packet).g1s() << 12, 100);
    }

    // qe.b(IIII)V
    private hslToRgb(saturation: number, hue: number, lightness: number): void {
        const max = lightness <= 2048 ? Math.imul(lightness, saturation + 4096) >> 12 : (saturation + lightness - (Math.imul(lightness, saturation) >> 12)) | 0;
        if (max > 0) {
            const min = (lightness + lightness - max) | 0;
            const span = intDivide((max - min) << 12, max);
            hue = Math.imul(hue, 6);
            const sector = hue >> 12;
            let step = Math.imul(max, span) >> 12;
            const fraction = (hue - (sector << 12)) | 0;
            step = Math.imul(step, fraction) >> 12;
            const falling = (max - step) | 0,
                rising = (min + step) | 0;
            if (sector === 0) {
                this.green = rising;
                this.red = max;
                this.blue = min;
            } else if (sector === 1) {
                this.red = falling;
                this.green = max;
                this.blue = min;
            } else if (sector === 2) {
                this.blue = rising;
                this.red = min;
                this.green = max;
            } else if (sector === 3) {
                this.red = min;
                this.green = falling;
                this.blue = max;
            } else if (sector === 4) {
                this.blue = max;
                this.green = min;
                this.red = rising;
            } else if (sector === 5) {
                this.red = max;
                this.green = min;
                this.blue = falling;
            }
        } else {
            this.blue = lightness;
            this.green = this.blue;
            this.red = this.blue;
        }
    }
}
