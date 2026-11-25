import { glJar } from '#/client/ClientVariant';
import { doubleToInt } from './IntUtils';

export default class RunetekColour {
    // SD lg.a(BI)I, HD ib.a(II)I. Both HD callers pass zero for the saturation seed.
    static RGBToHSL(rgb: number, initialSaturation = 0): number {
        if (glJar) {
            const red = ((rgb >> 16) & 255) / 256;
            const green = ((rgb >> 8) & 255) / 256;
            let hue = 0;
            const blue = (rgb & 255) / 256;
            let min = red;
            let sat = initialSaturation;
            let max = red;
            if (min > green) min = green;
            if (blue < min) min = blue;
            if (green > max) max = green;
            if (blue > max) max = blue;
            const light = (min + max) / 2;
            if (min !== max) {
                if (light < 0.5) sat = (-min + max) / (min + max);
                if (light >= 0.5) sat = (-min + max) / (2 - max - min);
                if (max === red) hue = (green - blue) / (-min + max);
                else if (green === max) hue = 2 + (-red + blue) / (max - min);
                else if (max === blue) hue = 4 + (-green + red) / (-min + max);
            }
            let saturation = doubleToInt(sat * 256);
            let lightness = (256 * light) | 0;
            hue /= 6;
            if (lightness < 0) lightness = 0;
            else if (lightness > 255) lightness = 255;
            const packedHue = (hue * 256) | 0;
            if (saturation < 0) saturation = 0;
            else if (saturation > 255) saturation = 255;
            if (lightness > 243) saturation >>= 4;
            else if (lightness > 217) saturation >>= 3;
            else if (lightness > 192) saturation >>= 2;
            else if (lightness > 179) saturation >>= 1;
            return ((packedHue >> 2) << 10) + (((saturation >> 5) << 7) + (lightness >> 1));
        }
        const red = ((rgb >> 16) & 255) / 256;
        const blue = (rgb & 255) / 256;
        const green = ((rgb >> 8) & 255) / 256;
        let max = red;
        let min = red;
        if (red > green) min = green;
        if (blue < min) min = blue;
        if (red < green) max = green;
        if (max < blue) max = blue;
        let sat = 0;
        const light = (max + min) / 2;
        let hue = 0;
        let lightness = (256 * light) | 0;
        if (max !== min) {
            if (max === red) hue = (green - blue) / (max - min);
            else if (max === green) hue = 2 + (-red + blue) / (-min + max);
            else if (max === blue) hue = (red - green) / (max - min) + 4;
            if (light < 0.5) sat = (-min + max) / (min + max);
            if (light >= 0.5) sat = (-min + max) / (2 - max - min);
        }
        if (lightness < 0) lightness = 0;
        else if (lightness > 255) lightness = 255;
        hue /= 6;
        let saturation = (sat * 256) | 0;
        if (saturation < 0) saturation = 0;
        else if (saturation > 255) saturation = 255;
        if (lightness > 243) saturation >>= 4;
        else if (lightness > 217) saturation >>= 3;
        else if (lightness > 192) saturation >>= 2;
        else if (lightness > 179) saturation >>= 1;
        const packedHue = (hue * 256) | 0;
        return (lightness >> 1) + ((packedHue >> 2) << 10) + ((saturation >> 5) << 7);
    }
}
