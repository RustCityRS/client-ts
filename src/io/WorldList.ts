import { fromLiteral } from '#/datastruct/JagString';
import PacketT from './PacketT';
import GameWorld from './GameWorld';
import type WorldCountry from './WorldCountry';

export default class WorldList {
    static zero = fromLiteral('0'); // ci.k:Lid;
    static colon = fromLiteral(':'); // de.y:Lid;
    static langParam = fromLiteral(')4l='); // vi.db:Lid;
    static urlJsSegment = fromLiteral(')4j'); // oc.b:Lid;
    static objectTagArg = fromLiteral(')1o'); // de.z:Lid;
    static settingsParamPrefix = fromLiteral(')4p='); // rk.j:Lid;

    static countries: (WorldCountry | null)[] | null = null; // oc.d:[Loa;
    static worlds: (GameWorld | null)[] | null = null; // oc.i:[Lqk;
    static loaded = false; // s.O:Z
    static lastFetchTime = 0n; // kc.i:J
    static fetchAttempts = 0; // rb.a:I
    static fetchStep = 0; // wd.g:I

    // ma.a([BI)Z
    static decode(data: Uint8Array, fullMarker = 1): boolean {
        const packet = new PacketT(data);
        if (packet.g1() !== 1) return false;
        if (packet.g1() === fullMarker) GameWorld.decodeWorldList(packet);
        GameWorld.decodePlayerCounts(packet);
        return true;
    }
}
