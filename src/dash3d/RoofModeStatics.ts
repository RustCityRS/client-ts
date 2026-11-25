import Preferences from '#/ui/Preferences';
import RouteFinding from '#/movement/RouteFinding';
import type Square from './Square';
import world from './world';
import { arrayAtI32, arrayAtObj, arrayAtU8, arrayPutI32, arrayPutU8, requireNonNull } from '#/util/JavaArray';
import { intDivide } from '#/util/IntUtils';
import Client from '#/client/Client';
import ClientBuild from '#/client/ClientBuild';
import OrbitCamera from '#/client/OrbitCamera';

export default class RoofModeStatics {
    // kf.n:Z
    static roofRemovalDisabled = false;
    static roofMarks: Uint8Array[][] | null = null; // ac.k:[[[B
    static markStamp = 0; // ai.d:I
    static hideMinZ: Int32Array | null = new Int32Array(2); // sf.j:[I
    static roofMaxZ: Int32Array | null = new Int32Array(2); // ce.G:[I
    static roofMinX: Int32Array | null = new Int32Array(2); // vc.M:[I
    static roofMaxX: Int32Array | null = new Int32Array(2); // gh.L:[I
    static roofMaxY: Int32Array | null = new Int32Array(2); // qa.N:[I

    // ia.c(I)V. All gamepack callers use 512.
    static applyRoofMode(): void {
        const mode = RoofModeStatics.getRoofMode();
        if (mode === 0) {
            RoofModeStatics.roofMarks = null;
            RoofModeStatics.allocRoofBounds(0);
        } else if (mode === 1) {
            RoofModeStatics.fillRoofMarks(0);
            RoofModeStatics.allocRoofBounds(512);
            RoofModeStatics.buildAllRoofBoxes();
        } else {
            RoofModeStatics.fillRoofMarks(((RoofModeStatics.markStamp - 4) << 24) >> 24);
            RoofModeStatics.allocRoofBounds(2);
        }
    }

    // bb.a(IB)V
    static fillRoofMarks(value: number): void {
        if (RoofModeStatics.roofMarks === null) {
            RoofModeStatics.roofMarks = Array.from({ length: 4 }, () => Array.from({ length: 104 }, () => new Uint8Array(104)));
        }
        for (let level = 0; level < 4; level++) {
            for (let x = 0; x < 104; x++) {
                for (let z = 0; z < 104; z++) arrayPutU8(arrayAtObj(arrayAtObj(RoofModeStatics.roofMarks, level), x), z, value);
            }
        }
    }

    // d.a(BI)V. The scene renderer receives these arrays at qc.a; it retains its previous references until then.
    // HD sm.a(II)V
    static allocRoofBounds(count: number, guard = -7): void {
        if (guard !== -7) return;
        RoofModeStatics.hideMinZ = new Int32Array(count);
        RoofModeStatics.roofMaxZ = new Int32Array(count);
        RoofModeStatics.roofMinX = new Int32Array(count);
        RoofModeStatics.roofMaxX = new Int32Array(count);
        RoofModeStatics.roofMaxY = new Int32Array(count);
    }

    // s.f(I)V
    static buildAllRoofBoxes(): void {
        let count = 0;
        for (let x = 0; x < 104; x++) {
            for (let z = 0; z < 104; z++) {
                if (RoofModeStatics.floodRoof(true, z, count, world.squares, x)) count++;
                if (count >= 512) return;
            }
        }
    }

    // sf.a(I)I. Every caller passes 0, so the dummy "var0 != 0 -> 64" guard is stripped.
    static getRoofMode(): number {
        if (RoofModeStatics.roofRemovalDisabled) {
            return 0;
        } else if (!Preferences.getAllLevelsVisible()) {
            return 1;
        } else {
            return Preferences.removeRoofsSelectively ? 2 : 1;
        }
    }

    // il.b(Z)V. The only caller, kk.a, passes true.
    static updateRoofs(): void {
        if (RoofModeStatics.getRoofMode() !== 2) return;
        const stamp = (RoofModeStatics.markStamp - 4) & 255;
        const column = RoofModeStatics.markStamp % 104;
        for (let plane = 0; plane < 4; plane++) {
            for (let z = 0; z < 104; z++) arrayPutU8(arrayAtObj(arrayAtObj(RoofModeStatics.roofMarks, plane), column), z, stamp);
        }
        if (Client.playerLevel === 3) return;
        for (let i = 0; i < 2; i++) {
            arrayPutI32(RoofModeStatics.roofMaxY, i, -1000000);
            arrayPutI32(RoofModeStatics.roofMinX, i, 1000000);
            arrayPutI32(RoofModeStatics.roofMaxX, i, 0);
            arrayPutI32(RoofModeStatics.hideMinZ, i, 1000000);
            arrayPutI32(RoofModeStatics.roofMaxZ, i, 0);
        }
        if (OrbitCamera.mode !== 1) {
            const level = Client.playerLevel;
            const ground = Client.GetAvH(OrbitCamera.x, OrbitCamera.z, level);
            if (((ground - OrbitCamera.y) | 0) < 800 && (arrayAtU8(arrayAtObj(arrayAtObj(ClientBuild.m_mapl, Client.playerLevel), OrbitCamera.x >> 7), OrbitCamera.z >> 7) & 4) !== 0) {
                RoofModeStatics.floodRoof(false, OrbitCamera.z >> 7, 1, world.squares, OrbitCamera.x >> 7);
            }
            return;
        }
        if ((arrayAtU8(arrayAtObj(arrayAtObj(ClientBuild.m_mapl, Client.playerLevel), requireNonNull(Client.localPlayer).x >> 7), requireNonNull(Client.localPlayer).z >> 7) & 4) !== 0) {
            RoofModeStatics.floodRoof(false, requireNonNull(Client.localPlayer).z >> 7, 0, world.squares, requireNonNull(Client.localPlayer).x >> 7);
        }
        if (OrbitCamera.pitch >= 310) return;
        let x = OrbitCamera.x >> 7;
        let z = OrbitCamera.z >> 7;
        const playerX = requireNonNull(Client.localPlayer).x >> 7;
        const playerZ = requireNonNull(Client.localPlayer).z >> 7;
        const dx = Math.abs(playerX - x);
        const dz = Math.abs(playerZ - z);
        let fraction = 32768;
        if (dx <= dz) {
            const step = intDivide(Math.imul(dx, 65536), dz);
            while (z !== playerZ) {
                z += z < playerZ ? 1 : -1;
                if (hit(x, z)) return;
                fraction = (fraction + step) | 0;
                if (fraction >= 65536) {
                    fraction -= 65536;
                    if (x !== playerX) x += x < playerX ? 1 : -1;
                    if (hit(x, z)) return;
                }
            }
        } else {
            const step = intDivide(Math.imul(dz, 65536), dx);
            while (x !== playerX) {
                x += x < playerX ? 1 : -1;
                if (hit(x, z)) return;
                fraction = (fraction + step) | 0;
                if (fraction >= 65536) {
                    if (z !== playerZ) z += z < playerZ ? 1 : -1;
                    fraction -= 65536;
                    if (hit(x, z)) return;
                }
            }
        }
        function hit(tileX: number, tileZ: number): boolean {
            if ((arrayAtU8(arrayAtObj(arrayAtObj(ClientBuild.m_mapl, Client.playerLevel), tileX), tileZ) & 4) === 0) return false;
            RoofModeStatics.floodRoof(false, tileZ, 1, world.squares, tileX);
            return true;
        }
    }

    // ga.a(ZIBI[[[Lra;I)Z. Both callers pass 79 for the byte guard.
    static floodRoof(rebuild: boolean, z: number, index: number, squares: (Square | null)[][][] | null, x: number): boolean {
        const stamp = rebuild ? 1 : RoofModeStatics.markStamp & 255;
        if (arrayAtU8(arrayAtObj(arrayAtObj(RoofModeStatics.roofMarks, Client.playerLevel), x), z) === stamp) return false;
        if ((arrayAtU8(arrayAtObj(arrayAtObj(ClientBuild.m_mapl, Client.playerLevel), x), z) & 4) === 0) return false;
        let tail = 0;
        let head = 0;
        arrayPutI32(RouteFinding.m_listx, tail, x);
        arrayPutI32(RouteFinding.m_listz, tail++, z);
        arrayPutU8(arrayAtObj(arrayAtObj(RoofModeStatics.roofMarks, Client.playerLevel), x), z, stamp);
        while (head !== tail) {
            const tileX = arrayAtI32(RouteFinding.m_listx, head) & 65535;
            const first = (arrayAtI32(RouteFinding.m_listx, head) >>> 16) & 255;
            const second = arrayAtI32(RouteFinding.m_listx, head) >>> 24;
            const third = (arrayAtI32(RouteFinding.m_listz, head) >>> 16) & 255;
            let tileZ = arrayAtI32(RouteFinding.m_listz, head) & 65535;
            const boundary = (arrayAtU8(arrayAtObj(arrayAtObj(ClientBuild.m_mapl, Client.playerLevel), tileX), tileZ) & 4) === 0;
            head = (head + 1) & 4095;
            let marked = false;
            upper: for (let level = (Client.playerLevel + 1) | 0; level <= 3; level++) {
                if ((arrayAtU8(arrayAtObj(arrayAtObj(ClientBuild.m_mapl, level), tileX), tileZ) & 8) !== 0) continue;
                if (boundary && arrayAtObj(arrayAtObj(arrayAtObj(squares, level), tileX), tileZ) !== null) {
                    if (requireNonNull(arrayAtObj(arrayAtObj(arrayAtObj(squares, level), tileX), tileZ)).wall !== null) {
                        let mask = world.wallTypeMask(first);
                        if (requireNonNull(requireNonNull(arrayAtObj(arrayAtObj(arrayAtObj(squares, level), tileX), tileZ)).wall).angle1 === mask) continue;
                        if (requireNonNull(requireNonNull(arrayAtObj(arrayAtObj(arrayAtObj(squares, level), tileX), tileZ)).wall).angle2 === mask) continue;
                        if (second !== 0) {
                            mask = world.wallTypeMask(second);
                            if (requireNonNull(requireNonNull(arrayAtObj(arrayAtObj(arrayAtObj(squares, level), tileX), tileZ)).wall).angle1 === mask) continue;
                            if (requireNonNull(requireNonNull(arrayAtObj(arrayAtObj(arrayAtObj(squares, level), tileX), tileZ)).wall).angle2 === mask) continue;
                        }
                        if (third !== 0) {
                            mask = world.wallTypeMask(third);
                            if (requireNonNull(requireNonNull(arrayAtObj(arrayAtObj(arrayAtObj(squares, level), tileX), tileZ)).wall).angle1 === mask) continue;
                            if (requireNonNull(requireNonNull(arrayAtObj(arrayAtObj(arrayAtObj(squares, level), tileX), tileZ)).wall).angle2 === mask) continue;
                        }
                    }
                    if (requireNonNull(arrayAtObj(arrayAtObj(arrayAtObj(squares, level), tileX), tileZ)).sprites !== null) {
                        for (let i = 0; i < requireNonNull(arrayAtObj(arrayAtObj(arrayAtObj(squares, level), tileX), tileZ)).spriteCount; i++) {
                            const shapeSquare = requireNonNull(arrayAtObj(arrayAtObj(arrayAtObj(squares, level), tileX), tileZ));
                            let shape = Number((requireNonNull(arrayAtObj(shapeSquare.sprites, i)).typecode >> 14n) & 63n);
                            if (shape === 21) shape = 19;
                            const angleSquare = requireNonNull(arrayAtObj(arrayAtObj(arrayAtObj(squares, level), tileX), tileZ));
                            const angle = Number((requireNonNull(arrayAtObj(angleSquare.sprites, i)).typecode >> 20n) & 3n);
                            const code = shape | (angle << 6);
                            if (code === first || (second !== 0 && code === second) || (third !== 0 && code === third)) continue upper;
                        }
                    }
                }
                marked = true;
                const square = arrayAtObj(arrayAtObj(arrayAtObj(squares, level), tileX), tileZ);
                if (square !== null && square.spriteCount > 0) {
                    for (let i = 0; i < square.spriteCount; i++) {
                        const sprite = requireNonNull(arrayAtObj(square.sprites, i));
                        if (sprite.maxTileX !== sprite.minTileX || sprite.minTileZ !== sprite.maxTileZ) {
                            for (let sx = sprite.minTileX; sx <= sprite.maxTileX; sx = (sx + 1) | 0) {
                                for (let sz = sprite.minTileZ; sz <= sprite.maxTileZ; sz = (sz + 1) | 0) {
                                    arrayPutU8(arrayAtObj(arrayAtObj(RoofModeStatics.roofMarks, level), sx), sz, stamp);
                                }
                            }
                        }
                    }
                }
                arrayPutU8(arrayAtObj(arrayAtObj(RoofModeStatics.roofMarks, level), tileX), tileZ, stamp);
            }
            if (marked) {
                if (arrayAtI32(RoofModeStatics.roofMaxY, index) < arrayAtI32(arrayAtObj(arrayAtObj(world.levelHeightmaps, (Client.playerLevel + 1) | 0), tileX), tileZ)) {
                    arrayPutI32(RoofModeStatics.roofMaxY, index, arrayAtI32(arrayAtObj(arrayAtObj(world.levelHeightmaps, (Client.playerLevel + 1) | 0), tileX), tileZ));
                }
                const fineZ = tileZ << 7;
                const fineX = tileX << 7;
                if (arrayAtI32(RoofModeStatics.roofMinX, index) > fineX) arrayPutI32(RoofModeStatics.roofMinX, index, fineX);
                else if (arrayAtI32(RoofModeStatics.roofMaxX, index) < fineX) arrayPutI32(RoofModeStatics.roofMaxX, index, fineX);
                if (arrayAtI32(RoofModeStatics.hideMinZ, index) > fineZ) arrayPutI32(RoofModeStatics.hideMinZ, index, fineZ);
                else if (arrayAtI32(RoofModeStatics.roofMaxZ, index) < fineZ) arrayPutI32(RoofModeStatics.roofMaxZ, index, fineZ);
            }
            if (boundary) continue;
            if (tileX >= 1 && arrayAtU8(arrayAtObj(arrayAtObj(RoofModeStatics.roofMarks, Client.playerLevel), tileX - 1), tileZ) !== stamp) {
                arrayPutI32(RouteFinding.m_listx, tail, (tileX - 1) | 0xd3120000);
                arrayPutI32(RouteFinding.m_listz, tail, tileZ | 0x130000);
                tail = (tail + 1) & 4095;
                arrayPutU8(arrayAtObj(arrayAtObj(RoofModeStatics.roofMarks, Client.playerLevel), tileX - 1), tileZ, stamp);
            }
            tileZ++;
            if (tileZ < 104) {
                if (
                    tileX >= 1 &&
                    arrayAtU8(arrayAtObj(arrayAtObj(RoofModeStatics.roofMarks, Client.playerLevel), tileX - 1), tileZ) !== stamp &&
                    (arrayAtU8(arrayAtObj(arrayAtObj(ClientBuild.m_mapl, Client.playerLevel), tileX), tileZ) & 4) === 0 &&
                    (arrayAtU8(arrayAtObj(arrayAtObj(ClientBuild.m_mapl, Client.playerLevel), tileX - 1), tileZ - 1) & 4) === 0
                ) {
                    arrayPutI32(RouteFinding.m_listx, tail, (tileX - 1) | 0x52120000);
                    arrayPutI32(RouteFinding.m_listz, tail, tileZ | 0x130000);
                    tail = (tail + 1) & 4095;
                    arrayPutU8(arrayAtObj(arrayAtObj(RoofModeStatics.roofMarks, Client.playerLevel), tileX - 1), tileZ, stamp);
                }
                if (arrayAtU8(arrayAtObj(arrayAtObj(RoofModeStatics.roofMarks, Client.playerLevel), tileX), tileZ) !== stamp) {
                    arrayPutI32(RouteFinding.m_listx, tail, tileX | 0x13520000);
                    arrayPutI32(RouteFinding.m_listz, tail, tileZ | 0x530000);
                    arrayPutU8(arrayAtObj(arrayAtObj(RoofModeStatics.roofMarks, Client.playerLevel), tileX), tileZ, stamp);
                    tail = (tail + 1) & 4095;
                }
                if (
                    tileX + 1 < 104 &&
                    arrayAtU8(arrayAtObj(arrayAtObj(RoofModeStatics.roofMarks, Client.playerLevel), tileX + 1), tileZ) !== stamp &&
                    (arrayAtU8(arrayAtObj(arrayAtObj(ClientBuild.m_mapl, Client.playerLevel), tileX), tileZ) & 4) === 0 &&
                    (arrayAtU8(arrayAtObj(arrayAtObj(ClientBuild.m_mapl, Client.playerLevel), tileX + 1), tileZ - 1) & 4) === 0
                ) {
                    arrayPutI32(RouteFinding.m_listx, tail, (tileX + 1) | 0x92520000);
                    arrayPutI32(RouteFinding.m_listz, tail, tileZ | 0x530000);
                    arrayPutU8(arrayAtObj(arrayAtObj(RoofModeStatics.roofMarks, Client.playerLevel), tileX + 1), tileZ, stamp);
                    tail = (tail + 1) & 4095;
                }
            }
            tileZ--;
            if (tileX + 1 < 104 && arrayAtU8(arrayAtObj(arrayAtObj(RoofModeStatics.roofMarks, Client.playerLevel), tileX + 1), tileZ) !== stamp) {
                arrayPutI32(RouteFinding.m_listx, tail, (tileX + 1) | 0x53920000);
                arrayPutI32(RouteFinding.m_listz, tail, tileZ | 0x930000);
                tail = (tail + 1) & 4095;
                arrayPutU8(arrayAtObj(arrayAtObj(RoofModeStatics.roofMarks, Client.playerLevel), tileX + 1), tileZ, stamp);
            }
            tileZ--;
            if (tileZ >= 0) {
                if (
                    tileX >= 1 &&
                    arrayAtU8(arrayAtObj(arrayAtObj(RoofModeStatics.roofMarks, Client.playerLevel), tileX - 1), tileZ) !== stamp &&
                    (arrayAtU8(arrayAtObj(arrayAtObj(ClientBuild.m_mapl, Client.playerLevel), tileX), tileZ) & 4) === 0 &&
                    (arrayAtU8(arrayAtObj(arrayAtObj(ClientBuild.m_mapl, Client.playerLevel), tileX - 1), tileZ + 1) & 4) === 0
                ) {
                    arrayPutI32(RouteFinding.m_listx, tail, (tileX - 1) | 0x12d20000);
                    arrayPutI32(RouteFinding.m_listz, tail, tileZ | 0xd30000);
                    arrayPutU8(arrayAtObj(arrayAtObj(RoofModeStatics.roofMarks, Client.playerLevel), tileX - 1), tileZ, stamp);
                    tail = (tail + 1) & 4095;
                }
                if (arrayAtU8(arrayAtObj(arrayAtObj(RoofModeStatics.roofMarks, Client.playerLevel), tileX), tileZ) !== stamp) {
                    arrayPutI32(RouteFinding.m_listx, tail, tileX | 0x93d20000);
                    arrayPutI32(RouteFinding.m_listz, tail, tileZ | 0xd30000);
                    arrayPutU8(arrayAtObj(arrayAtObj(RoofModeStatics.roofMarks, Client.playerLevel), tileX), tileZ, stamp);
                    tail = (tail + 1) & 4095;
                }
                if (
                    tileX + 1 < 104 &&
                    arrayAtU8(arrayAtObj(arrayAtObj(RoofModeStatics.roofMarks, Client.playerLevel), tileX + 1), tileZ) !== stamp &&
                    (arrayAtU8(arrayAtObj(arrayAtObj(ClientBuild.m_mapl, Client.playerLevel), tileX), tileZ) & 4) === 0 &&
                    (arrayAtU8(arrayAtObj(arrayAtObj(ClientBuild.m_mapl, Client.playerLevel), tileX + 1), tileZ + 1) & 4) === 0
                ) {
                    arrayPutI32(RouteFinding.m_listx, tail, (tileX + 1) | 0xd2920000);
                    arrayPutI32(RouteFinding.m_listz, tail, tileZ | 0x930000);
                    arrayPutU8(arrayAtObj(arrayAtObj(RoofModeStatics.roofMarks, Client.playerLevel), tileX + 1), tileZ, stamp);
                    tail = (tail + 1) & 4095;
                }
            }
        }
        if (arrayAtI32(RoofModeStatics.roofMaxY, index) !== -1000000) {
            const ys = RoofModeStatics.roofMaxY;
            arrayPutI32(ys, index, (arrayAtI32(ys, index) + 10) | 0);
            const minXs = RoofModeStatics.roofMinX;
            arrayPutI32(minXs, index, (arrayAtI32(minXs, index) - 50) | 0);
            const maxXs = RoofModeStatics.roofMaxX;
            arrayPutI32(maxXs, index, (arrayAtI32(maxXs, index) + 50) | 0);
            const maxZs = RoofModeStatics.roofMaxZ;
            arrayPutI32(maxZs, index, (arrayAtI32(maxZs, index) + 50) | 0);
            const minZs = RoofModeStatics.hideMinZ;
            arrayPutI32(minZs, index, (arrayAtI32(minZs, index) - 50) | 0);
        }
        return true;
    }
}
