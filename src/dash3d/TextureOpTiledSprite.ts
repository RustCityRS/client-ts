import { intRemainder } from '#/util/IntUtils';
import { arrayAtI32, arrayAtObj, arrayPutI32, requireNonNull } from '#/util/JavaArray';
import type { ColourImageRow } from './ColourImageCache';
import TextureOp from './TextureOp';
import TextureOpSprite from './TextureOpSprite';

export default class TextureOpTiledSprite extends TextureOpSprite {
    // pa.<init>()V
    constructor() {
        super();
    }

    // pa.a(ZI)[[I
    override getColourOutput(row: number): ColourImageRow | null {
        const output = requireNonNull(this.colourImageCache).get(row);
        if (requireNonNull(this.colourImageCache).invalid && this.loadSprite()) {
            const red = arrayAtObj(output, 0);
            const green = arrayAtObj(output, 1);
            const blue = arrayAtObj(output, 2);
            // The original multiplies by the sprite height here, including for non-square sprites.
            const offset = Math.imul(this.spriteHeight, intRemainder(row, this.spriteHeight));
            for (let x = 0; x < TextureOp.width; x++) {
                const pixel = arrayAtI32(this.pixels, (offset + intRemainder(x, this.spriteWidth)) | 0);
                arrayPutI32(blue, x, (pixel << 4) & 4080);
                arrayPutI32(green, x, (pixel & 0xff00) >> 4);
                arrayPutI32(red, x, (pixel >> 12) & 4080);
            }
        }
        return output;
    }
}
