import Js5LocalCache from '#/cache/Js5LocalCache.js';
import { SignlinkThread } from '#/util/Signlink.js';

// Synchronous cache fixtures supply the already-started worker that the Java constructor receives from Signlink.
export function fixtureDiskQueue(): Js5LocalCache {
    const queue: Js5LocalCache = Reflect.construct(Js5LocalCache, []);
    queue['worker'] = new SignlinkThread(queue);
    return queue;
}
