import { isJavaRuntimeException } from '#/util/JavaException';
import { releaseReferences } from '#/util/StaticReferences';
import WrappedException from '#/util/WrappedException';
import type PacketT from '#/io/PacketT';
import { intDivide } from '#/util/IntUtils';
import { arrayAtI32, arrayAtObj, arrayPutI32, requireNonNull } from '#/util/JavaArray';
import JavaRandom from '#/util/JavaRandom';
import TextureOp from './TextureOp';
import { loadClient, loadLocalisedText, loadObjType, loadRouteFinding, loadSpriteLoader } from '#/util/GamepackClasses';

// kk
export default class TextureOpLineNoise extends TextureOp {
    // HD vc.h(I)V
    static releaseTextureOpLineNoiseStatics(guard: number): void {
        try {
            const Client = loadClient();
            releaseReferences(Client, 'recolourPalette');
            const LocalisedText = loadLocalisedText();
            releaseReferences(LocalisedText, 'englishLoadingSprites');
            const SpriteLoader = loadSpriteLoader();
            releaseReferences(SpriteLoader, 'palette');
            if (guard !== -1) {
                return;
            }
            releaseReferences(LocalisedText, 'loadingSprites');
            const ObjType = loadObjType();
            releaseReferences(ObjType, 'recolourPalette');
            // eslint-disable-next-line @typescript-eslint/no-require-imports -- SD nd stays deferred until vc.h(I)V in TextureOpLineNoise.releaseTextureOpLineNoiseStatics.
            const ModelLit = (require('./ModelLit') as typeof import('./ModelLit')).default;
            releaseReferences(ModelLit, 'pickedTypecodes');
            const RouteFinding = loadRouteFinding();
            releaseReferences(RouteFinding, 'm_listx');
            releaseReferences(SpriteLoader, 'mapflagName');
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'vc.B(' + guard + ')');
        }
    }

    private length = 16; // kk.O:I
    private angle = 0; // kk.S:I
    private count = 2000; // kk.V:I
    private angleRange = 4096; // kk.Y:I
    private seed = 0; // kk.Z:I

    // kk.<init>()V
    constructor() {
        super(0, true);
    }

    // kk.a(Lgd;ZI)V
    override decode(packet: PacketT | null, code: number): void {
        switch (code) {
            case 0:
                this.seed = requireNonNull(packet).g1();
                break;
            case 1:
                this.count = requireNonNull(packet).g2();
                break;
            case 2:
                this.length = requireNonNull(packet).g1();
                break;
            case 3:
                this.angle = requireNonNull(packet).g2();
                break;
            case 4:
                this.angleRange = requireNonNull(packet).g2();
                break;
        }
    }

    // kk.b(I)V
    override postDecode(): void {
        TextureOp.initTrigTables();
    }

    // kk.a(IB)[I
    override getMonochromeOutput(row: number): Int32Array | null {
        const out = requireNonNull(this.monochromeImageCache).get(row);
        if (requireNonNull(this.monochromeImageCache).invalid) {
            const halfRange = this.angleRange >> 1;
            const pixels = requireNonNull(this.monochromeImageCache).getAll();
            const random = new JavaRandom(BigInt(this.seed));
            for (let i = 0; i < this.count; i++) {
                let angle = this.angleRange <= 0 ? this.angle : (this.angle - halfRange + TextureOp.nextInt(random, this.angleRange)) | 0;
                angle = (angle >> 4) & 255;
                let x = TextureOp.nextInt(random, TextureOp.width),
                    y = TextureOp.nextInt(random, TextureOp.height);
                let endX = (x + (Math.imul(arrayAtI32(TextureOp.cosine, angle), this.length) >> 12)) | 0;
                let endY = (y + (Math.imul(arrayAtI32(TextureOp.sinTable, angle), this.length) >> 12)) | 0;
                const dx = (endX - x) | 0,
                    dy = (endY - y) | 0;
                if (dx === 0 && dy === 0) continue;
                const steep = Math.abs(dy) > Math.abs(dx);
                if (steep) {
                    [endX, endY] = [endY, endX];
                    [x, y] = [y, x];
                }
                if (endX < x) {
                    [x, endX] = [endX, x];
                    [y, endY] = [endY, y];
                }
                let minor = y;
                const rise = Math.abs((endY - y) | 0),
                    run = (endX - x) | 0;
                const gradient = intDivide(2048, run);
                let error = (-run / 2) | 0;
                const step = endY > y ? 1 : -1;
                const shade = 1024 - (TextureOp.nextInt(random, 4096) >> 2);
                for (let major = x; major < endX; major++) {
                    error += rise;
                    const wrappedX = major & TextureOp.widthMask,
                        wrappedY = minor & TextureOp.heightMask;
                    if (error > 0) {
                        error -= run;
                        minor += step;
                    }
                    const val = (shade + 1024 + Math.imul(gradient, major - x)) | 0;
                    if (steep) arrayPutI32(arrayAtObj(pixels, wrappedY), wrappedX, val);
                    else arrayPutI32(arrayAtObj(pixels, wrappedX), wrappedY, val);
                }
            }
        }
        return out;
    }
}
