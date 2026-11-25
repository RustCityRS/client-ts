import { isJavaRuntimeException } from '#/util/JavaException';
import { releaseReferences } from '#/util/StaticReferences';
import WrappedException from '#/util/WrappedException';
import { arrayAtI32, arrayAtObj, arrayPutI32, requireNonNull } from '#/util/JavaArray';
import TextureOp from './TextureOp';
import { loadCookieStatics, loadLocalisedText } from '#/util/GamepackClasses';

// ic
export default class TextureOpMonochrome extends TextureOp {
    // HD fn.a(Z)V
    static releaseTextureOpMonochromeStatics(guard: boolean): void {
        try {
            const LocalisedText = loadLocalisedText();
            releaseReferences(LocalisedText, 'loadedConfig');
            const CookieStatics = loadCookieStatics();
            releaseReferences(CookieStatics, 'dateDaySeparator');
            // eslint-disable-next-line @typescript-eslint/no-require-imports -- SD mc stays deferred until fn.a(Z)V in TextureOpMonochrome.releaseTextureOpMonochromeStatics.
            const Js5RemoteLoader = (require('#/cache/Js5RemoteLoader') as typeof import('#/cache/Js5RemoteLoader')).default;
            releaseReferences(Js5RemoteLoader, 'crc32');
            if (!guard) {
                releaseReferences(LocalisedText, 'loadedConfig');
            }
            releaseReferences(LocalisedText, 'englishLoadedConfig');
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'fn.O(' + guard + ')');
        }
    }

    // ic.<init>()V
    constructor() {
        super(1, true);
    }

    // ic.a(IB)[I
    override getMonochromeOutput(row: number): Int32Array | null {
        const dst = requireNonNull(this.monochromeImageCache).get(row);
        if (requireNonNull(this.monochromeImageCache).invalid) {
            const rgb = this.getChildColourOutput(row, 0);
            const red = arrayAtObj(rgb, 0),
                green = arrayAtObj(rgb, 1),
                blue = arrayAtObj(rgb, 2);
            for (let x = 0; x < TextureOp.width; x++) {
                const total = (arrayAtI32(blue, x) + arrayAtI32(red, x) + arrayAtI32(green, x)) | 0;
                arrayPutI32(dst, x, (total / 3) | 0);
            }
        }
        return dst;
    }
}
