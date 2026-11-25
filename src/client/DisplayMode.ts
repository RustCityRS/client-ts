import { releaseReferences } from '#/util/StaticReferences';
import type Signlink from '#/util/Signlink';
import ThreadUtils from '#/util/ThreadUtils';
import { arrayAtI32, requireNonNull } from '#/util/JavaArray';
import { isJavaRuntimeException } from '#/util/JavaException';
import WrappedException from '#/util/WrappedException';
import { loadClient, loadLocalisedText } from '#/util/GamepackClasses';

// HD od. The display mode records are returned in Signlink provider order.
export default class DisplayMode {
    // HD od.a(B)V
    static releaseHdStatics(guard: number): void {
        try {
            const Client = loadClient();
            releaseReferences(Client, 'mouseTracking');
            if (guard !== 121) {
                releaseReferences(Client, 'mouseTracking');
            }
            const LocalisedText = loadLocalisedText();
            releaseReferences(LocalisedText, 'connectedToUpdateServer', 'englishConnectedToUpdateServer');
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'od.A(' + guard + ')');
        }
    }

    static available: DisplayMode[] | null = null; // ib.i:[Lod;

    width = 0; // od.j:I
    height = 0; // od.l:I
    depth = 0; // od.m:I
    refresh = 0; // od.k:I

    // pm.a(ILll;)[Lod;
    static *read(link: Signlink | null): Generator<Promise<void>, DisplayMode[], void> {
        try {
            if (!requireNonNull(link).supportsFullscreen()) return [];
            const request = requireNonNull(link).getDisplayModes();
            while (request.status === 0) yield ThreadUtils.sleep(10n);
            if (request.status === 2) return [];
            const result = request.result;
            if (result !== null && !(result instanceof Int32Array)) throw new TypeError('ClassCastException: expected int[]');
            const words = requireNonNull(result);
            const modes = new Array<DisplayMode>(words.length >> 2);
            for (let i = 0; i < modes.length; i++) {
                const mode = (modes[i] = new DisplayMode());
                mode.width = arrayAtI32(words, i << 2);
                mode.height = arrayAtI32(words, (i << 2) + 1);
                mode.depth = arrayAtI32(words, (i << 2) + 2);
                mode.refresh = arrayAtI32(words, (i << 2) + 3);
            }
            return modes;
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'pm.P(10,' + (link === null ? 'null' : '{...}') + ')');
        }
    }

    // ab.c(B)[Lod;
    static *getAvailable(link: Signlink | null): Generator<Promise<void>, DisplayMode[], void> {
        try {
            if (DisplayMode.available === null) {
                const modes = yield* DisplayMode.read(link);
                const filtered = new Array<DisplayMode>(modes.length);
                let count = 0;
                nextMode: for (const mode of modes) {
                    if ((mode.depth > 0 && mode.depth < 24) || mode.width < 800 || mode.height < 600) continue;
                    for (let j = 0; j < count; j++) {
                        const previous = filtered[j];
                        if (mode.width !== previous.width || mode.height !== previous.height) continue;
                        if (mode.depth > previous.depth) filtered[j] = mode;
                        continue nextMode;
                    }
                    filtered[count++] = mode;
                }
                DisplayMode.available = filtered.slice(0, count);
                const areas = new Int32Array(count);
                for (let i = 0; i < count; i++) {
                    const mode = DisplayMode.available[i];
                    areas[i] = Math.imul(mode.height, mode.width);
                }
                DisplayMode.sort(areas, DisplayMode.available, 0, count - 1);
            }
            return DisplayMode.available;
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'ab.M(28)');
        }
    }

    // oi.a(I[I[Ljava/lang/Object;)V calls ec.a([Ljava/lang/Object;I[III)V.
    private static sort(areas: Int32Array, modes: DisplayMode[], left: number, right: number): void {
        if (left >= right) return;
        const middle = (((left + right) | 0) / 2) | 0;
        const pivot = areas[middle];
        let insert = left;
        areas[middle] = areas[right];
        areas[right] = pivot;
        const mode = modes[middle];
        modes[middle] = modes[right];
        modes[right] = mode;
        for (let i = left; i < right; i++) {
            if (areas[i] >= ((pivot + (i & 1)) | 0)) continue;
            const area = areas[i];
            areas[i] = areas[insert];
            areas[insert] = area;
            const value = modes[i];
            modes[i] = modes[insert];
            modes[insert++] = value;
        }
        areas[right] = areas[insert];
        areas[insert] = pivot;
        modes[right] = modes[insert];
        modes[insert] = mode;
        DisplayMode.sort(areas, modes, left, insert - 1);
        DisplayMode.sort(areas, modes, insert + 1, right);
    }
}
