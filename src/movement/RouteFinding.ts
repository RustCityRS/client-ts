import Client from '#/client/Client';
import CollisionMap from '#/dash3d/CollisionMap';
import { arrayAtI32, arrayAtObj, arrayPutI32, requireNonNull } from '#/util/JavaArray';

// jag::oldscape::movement::RouteFinding. The 530 search grids are 104 by 104.
export default class RouteFinding {
    static readonly m_dirMap = Array.from({ length: 104 }, () => new Int32Array(104)); // pe.O:[[I
    static readonly m_distMap = Array.from({ length: 104 }, () => new Int32Array(104)); // qd.t:[[I
    static readonly m_listx = new Int32Array(4096); // n.j:[I
    static readonly m_listz = new Int32Array(4096); // u.b:[I

    // hj.a(IIIIBZIIIIII)Z
    static FindRoute(width: number, targetZ: number, targetX: number, height: number, near: boolean, angle: number, sides: number, startZ: number, shape: number, mode: number, startX: number): boolean {
        if (requireNonNull(Client.localPlayer).getSize() !== 2) {
            return requireNonNull(Client.localPlayer).getSize() > 2
                ? this.RouteFindBig(targetZ, startX, near, shape, height, requireNonNull(Client.localPlayer).getSize(), sides, startZ, mode, width, targetX, angle)
                : this.RouteFindSize1(mode, height, targetZ, sides, width, near, startZ, angle, targetX, startX, shape);
        } else {
            return this.RouteFindSize2(near, startZ, shape, targetX, width, startX, targetZ, angle, height, mode, sides);
        }
    }

    // HD hn.a(IIIZIIIIIIII)Z. Preserve its argument order at actor call sites:
    // the JVM reads the local Z, target X, target Z and local X paths in order.
    static FindRouteHd(startZ: number, angle: number, height: number, near: boolean, sides: number, doubleSize: number, targetX: number, width: number, shape: number, mode: number, targetZ: number, startX: number): boolean {
        if (requireNonNull(Client.localPlayer).getSize() !== doubleSize) {
            if (requireNonNull(Client.localPlayer).getSize() > 2) {
                return this.RouteFindBig(targetZ, startX, near, shape, height, requireNonNull(Client.localPlayer).getSize(), sides, startZ, mode, width, targetX, angle);
            }
        } else {
            return this.RouteFindSize2(near, startZ, shape, targetX, width, startX, targetZ, angle, height, mode, sides);
        }
        return this.RouteFindSize1(mode, height, targetZ, sides, width, near, startZ, angle, targetX, startX, shape);
    }

    // mg.a(IIIIIZIIIBII)Z
    private static RouteFindSize1(mode: number, height: number, targetZ: number, sides: number, width: number, near: boolean, startZ: number, angle: number, targetX: number, startX: number, shape: number): boolean {
        for (let i = 0; i < 104; ++i) {
            for (let j = 0; j < 104; ++j) {
                arrayPutI32(arrayAtObj(this.m_dirMap, i), j, 0);
                arrayPutI32(arrayAtObj(this.m_distMap, i), j, 99999999);
            }
        }

        arrayPutI32(arrayAtObj(this.m_dirMap, startX), startZ, 99);
        arrayPutI32(arrayAtObj(this.m_distMap, startX), startZ, 0);
        let x = startX;
        let z = startZ;
        let tail = 0;
        let head = 0;
        let found = false;
        arrayPutI32(this.m_listx, tail, startX);
        arrayPutI32(this.m_listz, tail++, startZ);
        const flags = requireNonNull(arrayAtObj(CollisionMap.levelMaps, Client.playerLevel)).flags;

        while (tail !== head) {
            z = arrayAtI32(this.m_listz, head);
            x = arrayAtI32(this.m_listx, head);
            head = ((head + 1) | 0) & 4095;
            if (targetX === x && targetZ === z) {
                found = true;
                break;
            }

            if (shape !== 0) {
                if ((shape < 5 || shape === 10) && requireNonNull(arrayAtObj(CollisionMap.levelMaps, Client.playerLevel)).testWall(x, z, 1, targetX, targetZ, (shape - 1) | 0, angle)) {
                    found = true;
                    break;
                }

                if (shape < 10 && requireNonNull(arrayAtObj(CollisionMap.levelMaps, Client.playerLevel)).testWallDecor(x, z, 1, targetX, targetZ, (shape - 1) | 0, angle)) {
                    found = true;
                    break;
                }
            }

            if (width !== 0 && height !== 0 && requireNonNull(arrayAtObj(CollisionMap.levelMaps, Client.playerLevel)).testLoc(x, z, 1, targetX, targetZ, width, height, sides)) {
                found = true;
                break;
            }

            const nextCost = (arrayAtI32(arrayAtObj(this.m_distMap, x), z) + 1) | 0;
            if (x > 0 && arrayAtI32(arrayAtObj(this.m_dirMap, (x - 1) | 0), z) === 0 && (arrayAtI32(arrayAtObj(flags, (x - 1) | 0), z) & 19661064) === 0) {
                arrayPutI32(this.m_listx, tail, (x - 1) | 0);
                arrayPutI32(this.m_listz, tail, z);
                arrayPutI32(arrayAtObj(this.m_dirMap, (x - 1) | 0), z, 2);
                arrayPutI32(arrayAtObj(this.m_distMap, (x - 1) | 0), z, nextCost);
                tail = ((tail + 1) | 0) & 4095;
            }

            if (x < 103 && arrayAtI32(arrayAtObj(this.m_dirMap, (x + 1) | 0), z) === 0 && (arrayAtI32(arrayAtObj(flags, (x + 1) | 0), z) & 19661184) === 0) {
                arrayPutI32(this.m_listx, tail, (x + 1) | 0);
                arrayPutI32(this.m_listz, tail, z);
                tail = ((tail + 1) | 0) & 4095;
                arrayPutI32(arrayAtObj(this.m_dirMap, (x + 1) | 0), z, 8);
                arrayPutI32(arrayAtObj(this.m_distMap, (x + 1) | 0), z, nextCost);
            }

            if (z > 0 && arrayAtI32(arrayAtObj(this.m_dirMap, x), (z - 1) | 0) === 0 && (arrayAtI32(arrayAtObj(flags, x), (z - 1) | 0) & 19661058) === 0) {
                arrayPutI32(this.m_listx, tail, x);
                arrayPutI32(this.m_listz, tail, (z - 1) | 0);
                tail = ((tail + 1) | 0) & 4095;
                arrayPutI32(arrayAtObj(this.m_dirMap, x), (z - 1) | 0, 1);
                arrayPutI32(arrayAtObj(this.m_distMap, x), (z - 1) | 0, nextCost);
            }

            if (z < 103 && arrayAtI32(arrayAtObj(this.m_dirMap, x), (z + 1) | 0) === 0 && (arrayAtI32(arrayAtObj(flags, x), (z + 1) | 0) & 19661088) === 0) {
                arrayPutI32(this.m_listx, tail, x);
                arrayPutI32(this.m_listz, tail, (z + 1) | 0);
                arrayPutI32(arrayAtObj(this.m_dirMap, x), (z + 1) | 0, 4);
                arrayPutI32(arrayAtObj(this.m_distMap, x), (z + 1) | 0, nextCost);
                tail = ((tail + 1) | 0) & 4095;
            }

            if (
                x > 0 &&
                z > 0 &&
                arrayAtI32(arrayAtObj(this.m_dirMap, (x - 1) | 0), (z - 1) | 0) === 0 &&
                (arrayAtI32(arrayAtObj(flags, (x - 1) | 0), (z - 1) | 0) & 19661070) === 0 &&
                (arrayAtI32(arrayAtObj(flags, (x - 1) | 0), z) & 19661064) === 0 &&
                (arrayAtI32(arrayAtObj(flags, x), (z - 1) | 0) & 19661058) === 0
            ) {
                arrayPutI32(this.m_listx, tail, (x - 1) | 0);
                arrayPutI32(this.m_listz, tail, (z - 1) | 0);
                arrayPutI32(arrayAtObj(this.m_dirMap, (x - 1) | 0), (z - 1) | 0, 3);
                tail = ((tail + 1) | 0) & 4095;
                arrayPutI32(arrayAtObj(this.m_distMap, (x - 1) | 0), (z - 1) | 0, nextCost);
            }

            if (
                x < 103 &&
                z > 0 &&
                arrayAtI32(arrayAtObj(this.m_dirMap, (x + 1) | 0), (z - 1) | 0) === 0 &&
                (arrayAtI32(arrayAtObj(flags, (x + 1) | 0), (z - 1) | 0) & 19661187) === 0 &&
                (arrayAtI32(arrayAtObj(flags, (x + 1) | 0), z) & 19661184) === 0 &&
                (arrayAtI32(arrayAtObj(flags, x), (z - 1) | 0) & 19661058) === 0
            ) {
                arrayPutI32(this.m_listx, tail, (x + 1) | 0);
                arrayPutI32(this.m_listz, tail, (z - 1) | 0);
                arrayPutI32(arrayAtObj(this.m_dirMap, (x + 1) | 0), (z - 1) | 0, 9);
                arrayPutI32(arrayAtObj(this.m_distMap, (x + 1) | 0), (z - 1) | 0, nextCost);
                tail = ((tail + 1) | 0) & 4095;
            }

            if (
                x > 0 &&
                z < 103 &&
                arrayAtI32(arrayAtObj(this.m_dirMap, (x - 1) | 0), (z + 1) | 0) === 0 &&
                (arrayAtI32(arrayAtObj(flags, (x - 1) | 0), (z + 1) | 0) & 19661112) === 0 &&
                (arrayAtI32(arrayAtObj(flags, (x - 1) | 0), z) & 19661064) === 0 &&
                (arrayAtI32(arrayAtObj(flags, x), (z + 1) | 0) & 19661088) === 0
            ) {
                arrayPutI32(this.m_listx, tail, (x - 1) | 0);
                arrayPutI32(this.m_listz, tail, (z + 1) | 0);
                tail = ((tail + 1) | 0) & 4095;
                arrayPutI32(arrayAtObj(this.m_dirMap, (x - 1) | 0), (z + 1) | 0, 6);
                arrayPutI32(arrayAtObj(this.m_distMap, (x - 1) | 0), (z + 1) | 0, nextCost);
            }

            if (
                x < 103 &&
                z < 103 &&
                arrayAtI32(arrayAtObj(this.m_dirMap, (x + 1) | 0), (z + 1) | 0) === 0 &&
                (arrayAtI32(arrayAtObj(flags, (x + 1) | 0), (z + 1) | 0) & 19661280) === 0 &&
                (arrayAtI32(arrayAtObj(flags, (x + 1) | 0), z) & 19661184) === 0 &&
                (arrayAtI32(arrayAtObj(flags, x), (z + 1) | 0) & 19661088) === 0
            ) {
                arrayPutI32(this.m_listx, tail, (x + 1) | 0);
                arrayPutI32(this.m_listz, tail, (z + 1) | 0);
                tail = ((tail + 1) | 0) & 4095;
                arrayPutI32(arrayAtObj(this.m_dirMap, (x + 1) | 0), (z + 1) | 0, 12);
                arrayPutI32(arrayAtObj(this.m_distMap, (x + 1) | 0), (z + 1) | 0, nextCost);
            }
        }

        Client.tryMoveNearest = 0;
        if (!found) {
            if (!near) {
                return false;
            }

            let bestCost = 100;
            let bestDistance = 1000;
            const radius = 10;

            for (let candidateX = (targetX - radius) | 0; ((targetX + radius) | 0) >= candidateX; candidateX = (candidateX + 1) | 0) {
                for (let candidateZ = (targetZ - radius) | 0; ((radius + targetZ) | 0) >= candidateZ; candidateZ = (candidateZ + 1) | 0) {
                    if (candidateX >= 0 && candidateZ >= 0 && candidateX < 104 && candidateZ < 104 && arrayAtI32(arrayAtObj(this.m_distMap, candidateX), candidateZ) < 100) {
                        let dx = 0;
                        if (targetX > candidateX) {
                            dx = (targetX - candidateX) | 0;
                        } else if (((targetX + width - 1) | 0) < candidateX) {
                            dx = (candidateX - width - targetX + 1) | 0;
                        }

                        let dz = 0;
                        if (targetZ > candidateZ) {
                            dz = (targetZ - candidateZ) | 0;
                        } else if (((height + targetZ - 1) | 0) < candidateZ) {
                            dz = (candidateZ - height - targetZ + 1) | 0;
                        }

                        const distance = (Math.imul(dz, dz) + Math.imul(dx, dx)) | 0;
                        if (distance < bestDistance || (bestDistance === distance && arrayAtI32(arrayAtObj(this.m_distMap, candidateX), candidateZ) < bestCost)) {
                            x = candidateX;
                            bestDistance = distance;
                            z = candidateZ;
                            bestCost = arrayAtI32(arrayAtObj(this.m_distMap, candidateX), candidateZ);
                        }
                    }
                }
            }

            if (bestDistance === 1000) {
                return false;
            }

            if (x === startX && startZ === z) {
                return false;
            }

            Client.tryMoveNearest = 1;
        }

        head = 0;

        arrayPutI32(this.m_listx, head, x);
        arrayPutI32(this.m_listz, head++, z);

        let previousDirection: number;
        for (let direction = (previousDirection = arrayAtI32(arrayAtObj(this.m_dirMap, x), z)); x !== startX || z !== startZ; direction = arrayAtI32(arrayAtObj(this.m_dirMap, x), z)) {
            if (direction !== previousDirection) {
                previousDirection = direction;
                arrayPutI32(this.m_listx, head, x);
                arrayPutI32(this.m_listz, head++, z);
            }

            if ((direction & 2) === 0) {
                if ((direction & 8) !== 0) {
                    --x;
                }
            } else {
                ++x;
            }

            if ((direction & 1) !== 0) {
                ++z;
            } else if ((direction & 4) !== 0) {
                --z;
            }
        }

        if (head > 0) {
            Client.writeRoute(head, mode);
            return true;
        } else if (mode === 1) {
            return false;
        } else {
            return true;
        }
    }

    // ld.a(ZIIIIIIIIIII)Z
    private static RouteFindSize2(near: boolean, startZ: number, shape: number, targetX: number, width: number, startX: number, targetZ: number, angle: number, height: number, mode: number, sides: number): boolean {
        for (let i = 0; i < 104; ++i) {
            for (let j = 0; j < 104; ++j) {
                arrayPutI32(arrayAtObj(this.m_dirMap, i), j, 0);
                arrayPutI32(arrayAtObj(this.m_distMap, i), j, 99999999);
            }
        }

        arrayPutI32(arrayAtObj(this.m_dirMap, startX), startZ, 99);
        let x = startX;
        arrayPutI32(arrayAtObj(this.m_distMap, startX), startZ, 0);
        let z = startZ;
        let tail = 0;
        arrayPutI32(this.m_listx, tail, startX);
        arrayPutI32(this.m_listz, tail++, startZ);
        let head = 0;
        let found = false;
        const flags = requireNonNull(arrayAtObj(CollisionMap.levelMaps, Client.playerLevel)).flags;

        while (head !== tail) {
            x = arrayAtI32(this.m_listx, head);
            z = arrayAtI32(this.m_listz, head);
            head = ((head + 1) | 0) & 4095;
            if (targetX === x && z === targetZ) {
                found = true;
                break;
            }

            if (shape !== 0) {
                if ((shape < 5 || shape === 10) && requireNonNull(arrayAtObj(CollisionMap.levelMaps, Client.playerLevel)).testWall(x, z, 2, targetX, targetZ, (shape - 1) | 0, angle)) {
                    found = true;
                    break;
                }

                if (shape < 10 && requireNonNull(arrayAtObj(CollisionMap.levelMaps, Client.playerLevel)).testWallDecor(x, z, 2, targetX, targetZ, (shape - 1) | 0, angle)) {
                    found = true;
                    break;
                }
            }

            if (width !== 0 && height !== 0 && requireNonNull(arrayAtObj(CollisionMap.levelMaps, Client.playerLevel)).testLoc(x, z, 2, targetX, targetZ, width, height, sides)) {
                found = true;
                break;
            }

            const nextCost = (arrayAtI32(arrayAtObj(this.m_distMap, x), z) + 1) | 0;
            if (x > 0 && arrayAtI32(arrayAtObj(this.m_dirMap, (x - 1) | 0), z) === 0 && (arrayAtI32(arrayAtObj(flags, (x - 1) | 0), z) & 19661070) === 0 && (arrayAtI32(arrayAtObj(flags, (x - 1) | 0), (z + 1) | 0) & 19661112) === 0) {
                arrayPutI32(this.m_listx, tail, (x - 1) | 0);
                arrayPutI32(this.m_listz, tail, z);
                arrayPutI32(arrayAtObj(this.m_dirMap, (x - 1) | 0), z, 2);
                tail = ((tail + 1) | 0) & 4095;
                arrayPutI32(arrayAtObj(this.m_distMap, (x - 1) | 0), z, nextCost);
            }

            if (x < 102 && arrayAtI32(arrayAtObj(this.m_dirMap, (x + 1) | 0), z) === 0 && (arrayAtI32(arrayAtObj(flags, (x + 2) | 0), z) & 19661187) === 0 && (arrayAtI32(arrayAtObj(flags, (x + 2) | 0), (z + 1) | 0) & 19661280) === 0) {
                arrayPutI32(this.m_listx, tail, (x + 1) | 0);
                arrayPutI32(this.m_listz, tail, z);
                arrayPutI32(arrayAtObj(this.m_dirMap, (x + 1) | 0), z, 8);
                arrayPutI32(arrayAtObj(this.m_distMap, (x + 1) | 0), z, nextCost);
                tail = ((tail + 1) | 0) & 4095;
            }

            if (z > 0 && arrayAtI32(arrayAtObj(this.m_dirMap, x), (z - 1) | 0) === 0 && (arrayAtI32(arrayAtObj(flags, x), (z - 1) | 0) & 19661070) === 0 && (arrayAtI32(arrayAtObj(flags, (x + 1) | 0), (z - 1) | 0) & 19661187) === 0) {
                arrayPutI32(this.m_listx, tail, x);
                arrayPutI32(this.m_listz, tail, (z - 1) | 0);
                arrayPutI32(arrayAtObj(this.m_dirMap, x), (z - 1) | 0, 1);
                arrayPutI32(arrayAtObj(this.m_distMap, x), (z - 1) | 0, nextCost);
                tail = ((tail + 1) | 0) & 4095;
            }

            if (z < 102 && arrayAtI32(arrayAtObj(this.m_dirMap, x), (z + 1) | 0) === 0 && (arrayAtI32(arrayAtObj(flags, x), (z + 2) | 0) & 19661112) === 0 && (arrayAtI32(arrayAtObj(flags, (x + 1) | 0), (z + 2) | 0) & 19661280) === 0) {
                arrayPutI32(this.m_listx, tail, x);
                arrayPutI32(this.m_listz, tail, (z + 1) | 0);
                arrayPutI32(arrayAtObj(this.m_dirMap, x), (z + 1) | 0, 4);
                tail = ((tail + 1) | 0) & 4095;
                arrayPutI32(arrayAtObj(this.m_distMap, x), (z + 1) | 0, nextCost);
            }

            if (
                x > 0 &&
                z > 0 &&
                arrayAtI32(arrayAtObj(this.m_dirMap, (x - 1) | 0), (z - 1) | 0) === 0 &&
                (arrayAtI32(arrayAtObj(flags, (x - 1) | 0), z) & 19661112) === 0 &&
                (arrayAtI32(arrayAtObj(flags, (x - 1) | 0), (z - 1) | 0) & 19661070) === 0 &&
                (arrayAtI32(arrayAtObj(flags, x), (z - 1) | 0) & 19661187) === 0
            ) {
                arrayPutI32(this.m_listx, tail, (x - 1) | 0);
                arrayPutI32(this.m_listz, tail, (z - 1) | 0);
                tail = ((tail + 1) | 0) & 4095;
                arrayPutI32(arrayAtObj(this.m_dirMap, (x - 1) | 0), (z - 1) | 0, 3);
                arrayPutI32(arrayAtObj(this.m_distMap, (x - 1) | 0), (z - 1) | 0, nextCost);
            }

            if (
                x < 102 &&
                z > 0 &&
                arrayAtI32(arrayAtObj(this.m_dirMap, (x + 1) | 0), (z - 1) | 0) === 0 &&
                (arrayAtI32(arrayAtObj(flags, (x + 1) | 0), (z - 1) | 0) & 19661070) === 0 &&
                (arrayAtI32(arrayAtObj(flags, (x + 2) | 0), (z - 1) | 0) & 19661187) === 0 &&
                (arrayAtI32(arrayAtObj(flags, (x + 2) | 0), z) & 19661280) === 0
            ) {
                arrayPutI32(this.m_listx, tail, (x + 1) | 0);
                arrayPutI32(this.m_listz, tail, (z - 1) | 0);
                arrayPutI32(arrayAtObj(this.m_dirMap, (x + 1) | 0), (z - 1) | 0, 9);
                tail = ((tail + 1) | 0) & 4095;
                arrayPutI32(arrayAtObj(this.m_distMap, (x + 1) | 0), (z - 1) | 0, nextCost);
            }

            if (
                x > 0 &&
                z < 102 &&
                arrayAtI32(arrayAtObj(this.m_dirMap, (x - 1) | 0), (z + 1) | 0) === 0 &&
                (arrayAtI32(arrayAtObj(flags, (x - 1) | 0), (z + 1) | 0) & 19661070) === 0 &&
                (arrayAtI32(arrayAtObj(flags, (x - 1) | 0), (z + 2) | 0) & 19661112) === 0 &&
                (arrayAtI32(arrayAtObj(flags, x), (z + 2) | 0) & 19661280) === 0
            ) {
                arrayPutI32(this.m_listx, tail, (x - 1) | 0);
                arrayPutI32(this.m_listz, tail, (z + 1) | 0);
                tail = ((tail + 1) | 0) & 4095;
                arrayPutI32(arrayAtObj(this.m_dirMap, (x - 1) | 0), (z + 1) | 0, 6);
                arrayPutI32(arrayAtObj(this.m_distMap, (x - 1) | 0), (z + 1) | 0, nextCost);
            }

            if (
                x < 102 &&
                z < 102 &&
                arrayAtI32(arrayAtObj(this.m_dirMap, (x + 1) | 0), (z + 1) | 0) === 0 &&
                (arrayAtI32(arrayAtObj(flags, (x + 1) | 0), (z + 2) | 0) & 19661112) === 0 &&
                (arrayAtI32(arrayAtObj(flags, (x + 2) | 0), (z + 2) | 0) & 19661280) === 0 &&
                (arrayAtI32(arrayAtObj(flags, (x + 2) | 0), (z + 1) | 0) & 19661187) === 0
            ) {
                arrayPutI32(this.m_listx, tail, (x + 1) | 0);
                arrayPutI32(this.m_listz, tail, (z + 1) | 0);
                tail = ((tail + 1) | 0) & 4095;
                arrayPutI32(arrayAtObj(this.m_dirMap, (x + 1) | 0), (z + 1) | 0, 12);
                arrayPutI32(arrayAtObj(this.m_distMap, (x + 1) | 0), (z + 1) | 0, nextCost);
            }
        }

        Client.tryMoveNearest = 0;
        if (!found) {
            if (!near) {
                return false;
            }

            let bestCost = 100;
            let bestDistance = 1000;
            const radius = 10;

            for (let candidateX = (targetX - radius) | 0; candidateX <= ((radius + targetX) | 0); candidateX = (candidateX + 1) | 0) {
                for (let candidateZ = (targetZ - radius) | 0; candidateZ <= ((radius + targetZ) | 0); candidateZ = (candidateZ + 1) | 0) {
                    if (candidateX >= 0 && candidateZ >= 0 && candidateX < 104 && candidateZ < 104 && arrayAtI32(arrayAtObj(this.m_distMap, candidateX), candidateZ) < 100) {
                        let dx = 0;
                        if (targetX > candidateX) {
                            dx = (targetX - candidateX) | 0;
                        } else if (candidateX > ((targetX + width - 1) | 0)) {
                            dx = (candidateX - targetX - width + 1) | 0;
                        }

                        let dz = 0;
                        if (targetZ > candidateZ) {
                            dz = (targetZ - candidateZ) | 0;
                        } else if (candidateZ > ((targetZ + height - 1) | 0)) {
                            dz = (candidateZ - height - targetZ + 1) | 0;
                        }

                        const distance = (Math.imul(dz, dz) + Math.imul(dx, dx)) | 0;
                        if (distance < bestDistance || (distance === bestDistance && bestCost > arrayAtI32(arrayAtObj(this.m_distMap, candidateX), candidateZ))) {
                            x = candidateX;
                            bestDistance = distance;
                            z = candidateZ;
                            bestCost = arrayAtI32(arrayAtObj(this.m_distMap, candidateX), candidateZ);
                        }
                    }
                }
            }

            if (bestDistance === 1000) {
                return false;
            }

            if (x === startX && startZ === z) {
                return false;
            }

            Client.tryMoveNearest = 1;
        }

        head = 0;
        arrayPutI32(this.m_listx, head, x);
        arrayPutI32(this.m_listz, head++, z);

        let previousDirection: number;
        for (let direction = (previousDirection = arrayAtI32(arrayAtObj(this.m_dirMap, x), z)); x !== startX || startZ !== z; direction = arrayAtI32(arrayAtObj(this.m_dirMap, x), z)) {
            if (previousDirection !== direction) {
                arrayPutI32(this.m_listx, head, x);
                previousDirection = direction;
                arrayPutI32(this.m_listz, head++, z);
            }

            if ((direction & 2) === 0) {
                if ((direction & 8) !== 0) {
                    --x;
                }
            } else {
                ++x;
            }

            if ((direction & 1) === 0) {
                if ((direction & 4) !== 0) {
                    --z;
                }
            } else {
                ++z;
            }
        }

        if (head > 0) {
            Client.writeRoute(head, mode);
            return true;
        } else if (mode === 1) {
            return false;
        } else {
            return true;
        }
    }

    // tg.a(IIZIIIIIIIIIB)Z
    private static RouteFindBig(targetZ: number, startX: number, near: boolean, shape: number, height: number, size: number, sides: number, startZ: number, mode: number, width: number, targetX: number, angle: number): boolean {
        for (let i = 0; i < 104; ++i) {
            for (let j = 0; j < 104; ++j) {
                arrayPutI32(arrayAtObj(this.m_dirMap, i), j, 0);
                arrayPutI32(arrayAtObj(this.m_distMap, i), j, 99999999);
            }
        }

        arrayPutI32(arrayAtObj(this.m_dirMap, startX), startZ, 99);
        arrayPutI32(arrayAtObj(this.m_distMap, startX), startZ, 0);
        let x = startX;
        let z = startZ;
        let tail = 0;
        arrayPutI32(this.m_listx, tail, startX);
        arrayPutI32(this.m_listz, tail++, startZ);
        let head = 0;
        const flags = requireNonNull(arrayAtObj(CollisionMap.levelMaps, Client.playerLevel)).flags;
        let found = false;

        search: while (tail !== head) {
            z = arrayAtI32(this.m_listz, head);
            x = arrayAtI32(this.m_listx, head);
            head = ((head + 1) | 0) & 4095;
            if (x === targetX && targetZ === z) {
                found = true;
                break;
            }

            if (shape !== 0) {
                if ((shape < 5 || shape === 10) && requireNonNull(arrayAtObj(CollisionMap.levelMaps, Client.playerLevel)).testWall(x, z, size, targetX, targetZ, (shape - 1) | 0, angle)) {
                    found = true;
                    break;
                }

                if (shape < 10 && requireNonNull(arrayAtObj(CollisionMap.levelMaps, Client.playerLevel)).testWallDecor(x, z, size, targetX, targetZ, (shape - 1) | 0, angle)) {
                    found = true;
                    break;
                }
            }

            if (width !== 0 && height !== 0 && requireNonNull(arrayAtObj(CollisionMap.levelMaps, Client.playerLevel)).testLoc(x, z, size, targetX, targetZ, width, height, sides)) {
                found = true;
                break;
            }

            const nextCost = (arrayAtI32(arrayAtObj(this.m_distMap, x), z) + 1) | 0;
            if (x > 0 && arrayAtI32(arrayAtObj(this.m_dirMap, (x - 1) | 0), z) === 0 && (arrayAtI32(arrayAtObj(flags, (x - 1) | 0), z) & 19661070) === 0 && (arrayAtI32(arrayAtObj(flags, (x - 1) | 0), (size + z - 1) | 0) & 19661112) === 0) {
                let offset = 1;

                while (true) {
                    if (offset >= ((size - 1) | 0)) {
                        arrayPutI32(this.m_listx, tail, (x - 1) | 0);
                        arrayPutI32(this.m_listz, tail, z);
                        tail = ((tail + 1) | 0) & 4095;
                        arrayPutI32(arrayAtObj(this.m_dirMap, (x - 1) | 0), z, 2);
                        arrayPutI32(arrayAtObj(this.m_distMap, (x - 1) | 0), z, nextCost);
                        break;
                    }

                    if ((arrayAtI32(arrayAtObj(flags, (x - 1) | 0), (z + offset) | 0) & 19661118) !== 0) {
                        break;
                    }

                    ++offset;
                }
            }

            if (x < 102 && arrayAtI32(arrayAtObj(this.m_dirMap, (x + 1) | 0), z) === 0 && (arrayAtI32(arrayAtObj(flags, (size + x) | 0), z) & 19661187) === 0 && (arrayAtI32(arrayAtObj(flags, (x + size) | 0), (z + size - 1) | 0) & 19661280) === 0) {
                let offset = 1;

                while (true) {
                    if (((size - 1) | 0) <= offset) {
                        arrayPutI32(this.m_listx, tail, (x + 1) | 0);
                        arrayPutI32(this.m_listz, tail, z);
                        arrayPutI32(arrayAtObj(this.m_dirMap, (x + 1) | 0), z, 8);
                        arrayPutI32(arrayAtObj(this.m_distMap, (x + 1) | 0), z, nextCost);
                        tail = ((tail + 1) | 0) & 4095;
                        break;
                    }

                    if ((arrayAtI32(arrayAtObj(flags, (size + x) | 0), (z + offset) | 0) & 19661283) !== 0) {
                        break;
                    }

                    ++offset;
                }
            }

            if (z > 0 && arrayAtI32(arrayAtObj(this.m_dirMap, x), (z - 1) | 0) === 0 && (arrayAtI32(arrayAtObj(flags, x), (z - 1) | 0) & 19661070) === 0 && (arrayAtI32(arrayAtObj(flags, (size + x - 1) | 0), (z - 1) | 0) & 19661187) === 0) {
                let offset = 1;

                while (true) {
                    if (offset >= ((size - 1) | 0)) {
                        arrayPutI32(this.m_listx, tail, x);
                        arrayPutI32(this.m_listz, tail, (z - 1) | 0);
                        arrayPutI32(arrayAtObj(this.m_dirMap, x), (z - 1) | 0, 1);
                        tail = ((tail + 1) | 0) & 4095;
                        arrayPutI32(arrayAtObj(this.m_distMap, x), (z - 1) | 0, nextCost);
                        break;
                    }

                    if ((arrayAtI32(arrayAtObj(flags, (x + offset) | 0), (z - 1) | 0) & 19661199) !== 0) {
                        break;
                    }

                    ++offset;
                }
            }

            if (z < 102 && arrayAtI32(arrayAtObj(this.m_dirMap, x), (z + 1) | 0) === 0 && (arrayAtI32(arrayAtObj(flags, x), (size + z) | 0) & 19661112) === 0 && (arrayAtI32(arrayAtObj(flags, (x + size - 1) | 0), (z + size) | 0) & 19661280) === 0) {
                let offset = 1;

                while (true) {
                    if (((size - 1) | 0) <= offset) {
                        arrayPutI32(this.m_listx, tail, x);
                        arrayPutI32(this.m_listz, tail, (z + 1) | 0);
                        tail = ((tail + 1) | 0) & 4095;
                        arrayPutI32(arrayAtObj(this.m_dirMap, x), (z + 1) | 0, 4);
                        arrayPutI32(arrayAtObj(this.m_distMap, x), (z + 1) | 0, nextCost);
                        break;
                    }

                    if ((arrayAtI32(arrayAtObj(flags, (x + offset) | 0), (z + size) | 0) & 19661304) !== 0) {
                        break;
                    }

                    ++offset;
                }
            }

            if (
                x > 0 &&
                z > 0 &&
                arrayAtI32(arrayAtObj(this.m_dirMap, (x - 1) | 0), (z - 1) | 0) === 0 &&
                (arrayAtI32(arrayAtObj(flags, (x - 1) | 0), (z + size - 2) | 0) & 19661112) === 0 &&
                (arrayAtI32(arrayAtObj(flags, (x - 1) | 0), (z - 1) | 0) & 19661070) === 0 &&
                (arrayAtI32(arrayAtObj(flags, (size + x - 2) | 0), (z - 1) | 0) & 19661187) === 0
            ) {
                let offset = 1;

                while (true) {
                    if (((size - 1) | 0) <= offset) {
                        arrayPutI32(this.m_listx, tail, (x - 1) | 0);
                        arrayPutI32(this.m_listz, tail, (z - 1) | 0);
                        tail = ((tail + 1) | 0) & 4095;
                        arrayPutI32(arrayAtObj(this.m_dirMap, (x - 1) | 0), (z - 1) | 0, 3);
                        arrayPutI32(arrayAtObj(this.m_distMap, (x - 1) | 0), (z - 1) | 0, nextCost);
                        break;
                    }

                    if ((arrayAtI32(arrayAtObj(flags, (x - 1) | 0), (offset + z - 1) | 0) & 19661118) !== 0 || (arrayAtI32(arrayAtObj(flags, (offset + x - 1) | 0), (z - 1) | 0) & 19661199) !== 0) {
                        break;
                    }

                    ++offset;
                }
            }

            if (
                x < 102 &&
                z > 0 &&
                arrayAtI32(arrayAtObj(this.m_dirMap, (x + 1) | 0), (z - 1) | 0) === 0 &&
                (arrayAtI32(arrayAtObj(flags, (x + 1) | 0), (z - 1) | 0) & 19661070) === 0 &&
                (arrayAtI32(arrayAtObj(flags, (x + size) | 0), (z - 1) | 0) & 19661187) === 0 &&
                (arrayAtI32(arrayAtObj(flags, (size + x) | 0), (z + size - 2) | 0) & 19661280) === 0
            ) {
                let offset = 1;

                while (true) {
                    if (offset >= ((size - 1) | 0)) {
                        arrayPutI32(this.m_listx, tail, (x + 1) | 0);
                        arrayPutI32(this.m_listz, tail, (z - 1) | 0);
                        arrayPutI32(arrayAtObj(this.m_dirMap, (x + 1) | 0), (z - 1) | 0, 9);
                        tail = ((tail + 1) | 0) & 4095;
                        arrayPutI32(arrayAtObj(this.m_distMap, (x + 1) | 0), (z - 1) | 0, nextCost);
                        break;
                    }

                    if ((arrayAtI32(arrayAtObj(flags, (x + size) | 0), (z + offset - 1) | 0) & 19661283) !== 0 || (arrayAtI32(arrayAtObj(flags, (x + offset + 1) | 0), (z - 1) | 0) & 19661199) !== 0) {
                        break;
                    }

                    ++offset;
                }
            }

            if (
                x > 0 &&
                z < 102 &&
                arrayAtI32(arrayAtObj(this.m_dirMap, (x - 1) | 0), (z + 1) | 0) === 0 &&
                (arrayAtI32(arrayAtObj(flags, (x - 1) | 0), (z + 1) | 0) & 19661070) === 0 &&
                (arrayAtI32(arrayAtObj(flags, (x - 1) | 0), (size + z) | 0) & 19661112) === 0 &&
                (arrayAtI32(arrayAtObj(flags, x), (z + size) | 0) & 19661280) === 0
            ) {
                let offset = 1;

                while (true) {
                    if (offset >= ((size - 1) | 0)) {
                        arrayPutI32(this.m_listx, tail, (x - 1) | 0);
                        arrayPutI32(this.m_listz, tail, (z + 1) | 0);
                        arrayPutI32(arrayAtObj(this.m_dirMap, (x - 1) | 0), (z + 1) | 0, 6);
                        tail = ((tail + 1) | 0) & 4095;
                        arrayPutI32(arrayAtObj(this.m_distMap, (x - 1) | 0), (z + 1) | 0, nextCost);
                        break;
                    }

                    if ((arrayAtI32(arrayAtObj(flags, (x - 1) | 0), (offset + z + 1) | 0) & 19661118) !== 0 || (arrayAtI32(arrayAtObj(flags, (offset + x - 1) | 0), (z + size) | 0) & 19661304) !== 0) {
                        break;
                    }

                    ++offset;
                }
            }

            if (
                x < 102 &&
                z < 102 &&
                arrayAtI32(arrayAtObj(this.m_dirMap, (x + 1) | 0), (z + 1) | 0) === 0 &&
                (arrayAtI32(arrayAtObj(flags, (x + 1) | 0), (size + z) | 0) & 19661112) === 0 &&
                (arrayAtI32(arrayAtObj(flags, (size + x) | 0), (z + size) | 0) & 19661280) === 0 &&
                (arrayAtI32(arrayAtObj(flags, (size + x) | 0), (z + 1) | 0) & 19661187) === 0
            ) {
                for (let offset = 1; offset < ((size - 1) | 0); ++offset) {
                    if ((arrayAtI32(arrayAtObj(flags, (offset + x + 1) | 0), (z + size) | 0) & 19661304) !== 0 || (arrayAtI32(arrayAtObj(flags, (size + x) | 0), (z + offset + 1) | 0) & 19661283) !== 0) {
                        continue search;
                    }
                }

                arrayPutI32(this.m_listx, tail, (x + 1) | 0);
                arrayPutI32(this.m_listz, tail, (z + 1) | 0);
                arrayPutI32(arrayAtObj(this.m_dirMap, (x + 1) | 0), (z + 1) | 0, 12);
                arrayPutI32(arrayAtObj(this.m_distMap, (x + 1) | 0), (z + 1) | 0, nextCost);
                tail = ((tail + 1) | 0) & 4095;
            }
        }

        Client.tryMoveNearest = 0;
        if (!found) {
            if (!near) {
                return false;
            }

            let bestDistance = 1000;
            let bestCost = 100;
            const radius = 10;

            for (let candidateX = (targetX - radius) | 0; ((radius + targetX) | 0) >= candidateX; candidateX = (candidateX + 1) | 0) {
                for (let candidateZ = (targetZ - radius) | 0; candidateZ <= ((targetZ + radius) | 0); candidateZ = (candidateZ + 1) | 0) {
                    if (candidateX >= 0 && candidateZ >= 0 && candidateX < 104 && candidateZ < 104 && arrayAtI32(arrayAtObj(this.m_distMap, candidateX), candidateZ) < 100) {
                        let dx = 0;
                        if (candidateX >= targetX) {
                            if (candidateX > ((width + targetX - 1) | 0)) {
                                dx = (candidateX - targetX - width + 1) | 0;
                            }
                        } else {
                            dx = (targetX - candidateX) | 0;
                        }

                        let dz = 0;
                        if (targetZ <= candidateZ) {
                            if (candidateZ > ((targetZ + height - 1) | 0)) {
                                dz = (candidateZ - targetZ - height + 1) | 0;
                            }
                        } else {
                            dz = (targetZ - candidateZ) | 0;
                        }

                        const distance = (Math.imul(dz, dz) + Math.imul(dx, dx)) | 0;
                        if (bestDistance > distance || (bestDistance === distance && bestCost > arrayAtI32(arrayAtObj(this.m_distMap, candidateX), candidateZ))) {
                            bestCost = arrayAtI32(arrayAtObj(this.m_distMap, candidateX), candidateZ);
                            x = candidateX;
                            bestDistance = distance;
                            z = candidateZ;
                        }
                    }
                }
            }

            if (bestDistance === 1000) {
                return false;
            }

            if (startX === x && startZ === z) {
                return false;
            }

            Client.tryMoveNearest = 1;
        }

        head = 0;
        arrayPutI32(this.m_listx, head, x);
        arrayPutI32(this.m_listz, head++, z);

        let previousDirection: number;
        for (let direction = (previousDirection = arrayAtI32(arrayAtObj(this.m_dirMap, x), z)); startX !== x || z !== startZ; direction = arrayAtI32(arrayAtObj(this.m_dirMap, x), z)) {
            if (direction !== previousDirection) {
                arrayPutI32(this.m_listx, head, x);
                arrayPutI32(this.m_listz, head++, z);
                previousDirection = direction;
            }

            if ((direction & 2) !== 0) {
                ++x;
            } else if ((direction & 8) !== 0) {
                --x;
            }

            if ((direction & 1) !== 0) {
                ++z;
            } else if ((direction & 4) !== 0) {
                --z;
            }
        }

        if (head > 0) {
            Client.writeRoute(head, mode);
            return true;
        } else if (mode === 1) {
            return false;
        } else {
            return true;
        }
    }
}
