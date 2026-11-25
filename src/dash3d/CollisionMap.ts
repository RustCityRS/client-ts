import { releaseReferences } from '#/util/StaticReferences';
import { arrayAtI32, arrayAtObj, arrayPutI32 } from '#/util/JavaArray';
import { isJavaRuntimeException } from '#/util/JavaException';
import WrappedException from '#/util/WrappedException';
import { loadClient, loadMinimenu, loadPlayerModel, loadWorldMap } from '#/util/GamepackClasses';
// ke
export default class CollisionMap {
    // HD mj.a(B)V
    static releaseHdStatics(guard: number): void {
        try {
            if (guard > -123) {
                CollisionMap.releaseHdStatics(-27);
            }
            const PlayerModel = loadPlayerModel();
            releaseReferences(PlayerModel, 'recolourSources2');
            const Minimenu = loadMinimenu();
            releaseReferences(Minimenu, 'playerOption');
            const Client = loadClient();
            releaseReferences(Client, 'percent3');
            const WorldMap = loadWorldMap();
            releaseReferences(WorldMap, 'font30');
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'mj.R(' + guard + ')');
        }
    }

    static readonly levelMaps = new Array<CollisionMap | null>(4).fill(null); // hc.c:[Lke;
    flags: Int32Array[]; // ke.d:[[I
    private originZ: number; // ke.g:I
    readonly height: number; // ke.u:I
    private originX: number; // ke.x:I
    readonly width: number; // ke.C:I
    // ke.<init>(II)V
    constructor(width: number, height: number) {
        this.width = width;
        this.height = height;
        this.originZ = 0;
        if (width < 0 || height < 0) throw new RangeError('Negative collision map size');
        this.flags = Array.from({ length: width }, () => new Int32Array(height));
        this.originX = 0;
        this.reset();
    }

    // ke.a(IIIIIIIII)Z
    private overlaps(z: number, targetZ: number, width: number, targetHeight: number, targetX: number, targetWidth: number, x: number, height: number): boolean {
        if (((targetWidth + targetX) | 0) > x && targetX < ((x + width) | 0)) {
            return ((targetZ + targetHeight) | 0) > z && ((height + z) | 0) > targetZ;
        } else {
            return false;
        }
    }

    // ke.a(IIBI)V
    private addFlag(mask: number, x: number, z: number): void {
        arrayPutI32(arrayAtObj(this.flags, x), z, arrayAtI32(arrayAtObj(this.flags, x), z) | mask);
    }

    // HD mj.b(IIIII)Z. A collision ray from the occupied tile to a candidate destination.
    canTravelInStraightLine(z: number, targetZ: number, targetX: number, x: number): boolean {
        try {
            if (x === targetX && z === targetZ) return true;
            targetZ = (targetZ - this.originZ) | 0;
            targetX = (targetX - this.originX) | 0;
            if (targetX < 0 || targetX >= this.width || targetZ < 0 || targetZ >= this.height) return false;
            z = (z - this.originZ) | 0;
            x = (x - this.originX) | 0;
            const dx = targetX > x ? (targetX - x) | 0 : (x - targetX) | 0;
            const dz = targetZ > z ? (targetZ - z) | 0 : (z - targetZ) | 0;
            if (dx <= dz) {
                let offset = 32768;
                const step = (Math.imul(65536, dx) / dz) | 0;
                while (z !== targetZ) {
                    if (targetZ > z) {
                        if ((arrayAtI32(arrayAtObj(this.flags, x), z) & 0x12c0102) !== 0) return false;
                        z++;
                    } else if (targetZ < z) {
                        if ((arrayAtI32(arrayAtObj(this.flags, x), z) & 0x12c0120) !== 0) return false;
                        z--;
                    }
                    offset = (offset + step) | 0;
                    if (offset < 65536) continue;
                    offset -= 65536;
                    if (x >= targetX) {
                        if (x <= targetX) continue;
                        if ((arrayAtI32(arrayAtObj(this.flags, x), z) & 0x12c0180) !== 0) return false;
                        x--;
                    } else {
                        if ((arrayAtI32(arrayAtObj(this.flags, x), z) & 0x12c0108) !== 0) return false;
                        x++;
                    }
                }
            } else {
                const step = (Math.imul(65536, dz) / dx) | 0;
                let offset = 32768;
                while (x !== targetX) {
                    if (x < targetX) {
                        if ((arrayAtI32(arrayAtObj(this.flags, x), z) & 0x12c0108) !== 0) return false;
                        x++;
                    } else if (targetX < x) {
                        if ((arrayAtI32(arrayAtObj(this.flags, x), z) & 0x12c0180) !== 0) return false;
                        x--;
                    }
                    offset = (offset + step) | 0;
                    if (offset < 65536) continue;
                    offset -= 65536;
                    if (z < targetZ) {
                        if ((arrayAtI32(arrayAtObj(this.flags, x), z) & 0x12c0102) !== 0) return false;
                        z++;
                    } else if (targetZ < z) {
                        if ((arrayAtI32(arrayAtObj(this.flags, x), z) & 0x12c0120) !== 0) return false;
                        z--;
                    }
                }
            }
            return (arrayAtI32(arrayAtObj(this.flags, targetX), targetZ) & 0x1240100) === 0;
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'mj.G(-2,' + [z, targetZ, targetX, x].join(',') + ')');
        }
    }

    // ke.a(IIIIIZ)V
    delWall(x: number, z: number, shape: number, angle: number, blockRange: boolean): void {
        z = (z - this.originZ) | 0;
        x = (x - this.originX) | 0;

        if (shape === 0) {
            if (angle === 0) {
                this.removeFlag(128, x, z);
                this.removeFlag(8, (x - 1) | 0, z);
            }

            if (angle === 1) {
                this.removeFlag(2, x, z);
                this.removeFlag(32, x, (z + 1) | 0);
            }

            if (angle === 2) {
                this.removeFlag(8, x, z);
                this.removeFlag(128, (x + 1) | 0, z);
            }

            if (angle === 3) {
                this.removeFlag(32, x, z);
                this.removeFlag(2, x, (z - 1) | 0);
            }
        }

        if (shape === 1 || shape === 3) {
            if (angle === 0) {
                this.removeFlag(1, x, z);
                this.removeFlag(16, (x - 1) | 0, (z + 1) | 0);
            }

            if (angle === 1) {
                this.removeFlag(4, x, z);
                this.removeFlag(64, (x + 1) | 0, (z + 1) | 0);
            }

            if (angle === 2) {
                this.removeFlag(16, x, z);
                this.removeFlag(1, (x + 1) | 0, (z - 1) | 0);
            }

            if (angle === 3) {
                this.removeFlag(64, x, z);
                this.removeFlag(4, (x - 1) | 0, (z - 1) | 0);
            }
        }

        if (shape === 2) {
            if (angle === 0) {
                this.removeFlag(130, x, z);
                this.removeFlag(8, (x - 1) | 0, z);
                this.removeFlag(32, x, (z + 1) | 0);
            }

            if (angle === 1) {
                this.removeFlag(10, x, z);
                this.removeFlag(32, x, (z + 1) | 0);
                this.removeFlag(128, (x + 1) | 0, z);
            }

            if (angle === 2) {
                this.removeFlag(40, x, z);
                this.removeFlag(128, (x + 1) | 0, z);
                this.removeFlag(2, x, (z - 1) | 0);
            }

            if (angle === 3) {
                this.removeFlag(160, x, z);
                this.removeFlag(2, x, (z - 1) | 0);
                this.removeFlag(8, (x - 1) | 0, z);
            }
        }

        if (blockRange) {
            if (shape === 0) {
                if (angle === 0) {
                    this.removeFlag(65536, x, z);
                    this.removeFlag(4096, (x - 1) | 0, z);
                }

                if (angle === 1) {
                    this.removeFlag(1024, x, z);
                    this.removeFlag(16384, x, (z + 1) | 0);
                }

                if (angle === 2) {
                    this.removeFlag(4096, x, z);
                    this.removeFlag(65536, (x + 1) | 0, z);
                }

                if (angle === 3) {
                    this.removeFlag(16384, x, z);
                    this.removeFlag(1024, x, (z - 1) | 0);
                }
            }

            if (shape === 1 || shape === 3) {
                if (angle === 0) {
                    this.removeFlag(512, x, z);
                    this.removeFlag(8192, (x - 1) | 0, (z + 1) | 0);
                }

                if (angle === 1) {
                    this.removeFlag(2048, x, z);
                    this.removeFlag(32768, (x + 1) | 0, (z + 1) | 0);
                }

                if (angle === 2) {
                    this.removeFlag(8192, x, z);
                    this.removeFlag(512, (x + 1) | 0, (z - 1) | 0);
                }

                if (angle === 3) {
                    this.removeFlag(32768, x, z);
                    this.removeFlag(2048, (x - 1) | 0, (z - 1) | 0);
                }
            }

            if (shape === 2) {
                if (angle === 0) {
                    this.removeFlag(66560, x, z);
                    this.removeFlag(4096, (x - 1) | 0, z);
                    this.removeFlag(16384, x, (z + 1) | 0);
                }

                if (angle === 1) {
                    this.removeFlag(5120, x, z);
                    this.removeFlag(16384, x, (z + 1) | 0);
                    this.removeFlag(65536, (x + 1) | 0, z);
                }

                if (angle === 2) {
                    this.removeFlag(20480, x, z);
                    this.removeFlag(65536, (x + 1) | 0, z);
                    this.removeFlag(1024, x, (z - 1) | 0);
                }

                if (angle === 3) {
                    this.removeFlag(81920, x, z);
                    this.removeFlag(1024, x, (z - 1) | 0);
                    this.removeFlag(4096, (x - 1) | 0, z);
                    return;
                }
            }
        }
    }

    // ke.a(IIIIIBIIII)Z
    private touches(targetHeight: number, z: number, x: number, targetWidth: number, targetX: number, width: number, sides: number, targetZ: number, height: number): boolean {
        const east = (width + x) | 0;
        const north = (height + z) | 0;
        const targetNorth = (targetZ + targetHeight) | 0;

        const targetEast = (targetX + targetWidth) | 0;
        if (targetX <= x && targetEast > x) {
            if (north === targetZ && (sides & 4) === 0) {
                let i = x;

                for (const end = targetEast < east ? targetEast : east; i < end; ++i) {
                    if ((arrayAtI32(arrayAtObj(this.flags, (i - this.originX) | 0), (north - this.originZ - 1) | 0) & 2) === 0) {
                        return true;
                    }
                }
            } else if (z === targetNorth && (sides & 1) === 0) {
                let i = x;

                for (const end = targetEast >= east ? east : targetEast; end > i; ++i) {
                    if ((arrayAtI32(arrayAtObj(this.flags, (i - this.originX) | 0), (z - this.originZ) | 0) & 32) === 0) {
                        return true;
                    }
                }
            }
        } else if (east > targetX && targetEast >= east) {
            if (north === targetZ && (sides & 4) === 0) {
                for (let i = targetX; east > i; ++i) {
                    if ((arrayAtI32(arrayAtObj(this.flags, (i - this.originX) | 0), (north - this.originZ - 1) | 0) & 2) === 0) {
                        return true;
                    }
                }
            } else if (targetNorth === z && (sides & 1) === 0) {
                for (let i = targetX; i < east; ++i) {
                    if ((arrayAtI32(arrayAtObj(this.flags, (i - this.originX) | 0), (z - this.originZ) | 0) & 32) === 0) {
                        return true;
                    }
                }
            }
        } else if (z >= targetZ && targetNorth > z) {
            if (targetX === east && (sides & 8) === 0) {
                const end = north <= targetNorth ? north : targetNorth;

                for (let i = z; i < end; ++i) {
                    if ((arrayAtI32(arrayAtObj(this.flags, (east - this.originX - 1) | 0), (i - this.originZ) | 0) & 8) === 0) {
                        return true;
                    }
                }
            } else if (targetEast === x && (sides & 2) === 0) {
                const end = north <= targetNorth ? north : targetNorth;

                for (let i = z; i < end; ++i) {
                    if ((arrayAtI32(arrayAtObj(this.flags, (x - this.originX) | 0), (i - this.originZ) | 0) & 128) === 0) {
                        return true;
                    }
                }
            }
        } else if (north > targetZ && north <= targetNorth) {
            if (east === targetX && (sides & 8) === 0) {
                for (let i = targetZ; north > i; ++i) {
                    if ((arrayAtI32(arrayAtObj(this.flags, (east - this.originX - 1) | 0), (i - this.originZ) | 0) & 8) === 0) {
                        return true;
                    }
                }
            } else if (x === targetEast && (sides & 2) === 0) {
                for (let i = targetZ; north > i; ++i) {
                    if ((arrayAtI32(arrayAtObj(this.flags, (x - this.originX) | 0), (i - this.originZ) | 0) & 128) === 0) {
                        return true;
                    }
                }
            }
        }

        return false;
    }

    // ke.b(I)V
    reset(): void {
        for (let x = 0; x < this.width; ++x) {
            for (let z = 0; this.height > z; ++z) {
                if (x !== 0 && z !== 0 && x < ((this.width - 5) | 0) && ((this.height - 5) | 0) > z) {
                    arrayPutI32(arrayAtObj(this.flags, x), z, 16777216);
                } else {
                    arrayPutI32(arrayAtObj(this.flags, x), z, 16777215);
                }
            }
        }
    }

    // ke.a(III)V
    blockGround(x: number, z: number): void {
        z = (z - this.originZ) | 0;
        x = (x - this.originX) | 0;
        arrayPutI32(arrayAtObj(this.flags, x), z, arrayAtI32(arrayAtObj(this.flags, x), z) | 2097152);
    }

    // ke.a(IIIIIIII)Z
    testWall(x: number, z: number, size: number, targetX: number, targetZ: number, shape: number, angle: number): boolean {
        if (size === 1) {
            if (x === targetX && targetZ === z) {
                return true;
            }
        } else if (x <= targetX && targetX <= ((size + x - 1) | 0) && targetZ >= targetZ && ((size + targetZ - 1) | 0) >= targetZ) {
            return true;
        }

        z = (z - this.originZ) | 0;
        x = (x - this.originX) | 0;
        targetX = (targetX - this.originX) | 0;

        targetZ = (targetZ - this.originZ) | 0;
        if (size === 1) {
            if (shape === 0) {
                if (angle === 0) {
                    if (x === ((targetX - 1) | 0) && targetZ === z) {
                        return true;
                    }

                    if (x === targetX && z === ((targetZ + 1) | 0) && (arrayAtI32(arrayAtObj(this.flags, x), z) & 19661088) === 0) {
                        return true;
                    }

                    if (x === targetX && z === ((targetZ - 1) | 0) && (arrayAtI32(arrayAtObj(this.flags, x), z) & 19661058) === 0) {
                        return true;
                    }
                } else if (angle !== 1) {
                    if (angle !== 2) {
                        if (angle === 3) {
                            if (targetX === x && ((targetZ - 1) | 0) === z) {
                                return true;
                            }

                            if (((targetX - 1) | 0) === x && targetZ === z && (arrayAtI32(arrayAtObj(this.flags, x), z) & 19661064) === 0) {
                                return true;
                            }

                            if (((targetX + 1) | 0) === x && targetZ === z && (arrayAtI32(arrayAtObj(this.flags, x), z) & 19661184) === 0) {
                                return true;
                            }
                        }
                    } else {
                        if (((targetX + 1) | 0) === x && z === targetZ) {
                            return true;
                        }

                        if (targetX === x && z === ((targetZ + 1) | 0) && (arrayAtI32(arrayAtObj(this.flags, x), z) & 19661088) === 0) {
                            return true;
                        }

                        if (x === targetX && z === ((targetZ - 1) | 0) && (arrayAtI32(arrayAtObj(this.flags, x), z) & 19661058) === 0) {
                            return true;
                        }
                    }
                } else {
                    if (targetX === x && ((targetZ + 1) | 0) === z) {
                        return true;
                    }

                    if (x === ((targetX - 1) | 0) && targetZ === z && (arrayAtI32(arrayAtObj(this.flags, x), z) & 19661064) === 0) {
                        return true;
                    }

                    if (x === ((targetX + 1) | 0) && targetZ === z && (arrayAtI32(arrayAtObj(this.flags, x), z) & 19661184) === 0) {
                        return true;
                    }
                }
            }

            if (shape === 2) {
                if (angle === 0) {
                    if (x === ((targetX - 1) | 0) && z === targetZ) {
                        return true;
                    }

                    if (x === targetX && z === ((targetZ + 1) | 0)) {
                        return true;
                    }

                    if (x === ((targetX + 1) | 0) && z === targetZ && (arrayAtI32(arrayAtObj(this.flags, x), z) & 19661184) === 0) {
                        return true;
                    }

                    if (x === targetX && ((targetZ - 1) | 0) === z && (arrayAtI32(arrayAtObj(this.flags, x), z) & 19661058) === 0) {
                        return true;
                    }
                } else if (angle === 1) {
                    if (x === ((targetX - 1) | 0) && z === targetZ && (arrayAtI32(arrayAtObj(this.flags, x), z) & 19661064) === 0) {
                        return true;
                    }

                    if (x === targetX && z === ((targetZ + 1) | 0)) {
                        return true;
                    }

                    if (x === ((targetX + 1) | 0) && z === targetZ) {
                        return true;
                    }

                    if (targetX === x && z === ((targetZ - 1) | 0) && (arrayAtI32(arrayAtObj(this.flags, x), z) & 19661058) === 0) {
                        return true;
                    }
                } else if (angle !== 2) {
                    if (angle === 3) {
                        if (x === ((targetX - 1) | 0) && targetZ === z) {
                            return true;
                        }

                        if (x === targetX && z === ((targetZ + 1) | 0) && (arrayAtI32(arrayAtObj(this.flags, x), z) & 19661088) === 0) {
                            return true;
                        }

                        if (((targetX + 1) | 0) === x && targetZ === z && (arrayAtI32(arrayAtObj(this.flags, x), z) & 19661184) === 0) {
                            return true;
                        }

                        if (x === targetX && z === ((targetZ - 1) | 0)) {
                            return true;
                        }
                    }
                } else {
                    if (((targetX - 1) | 0) === x && targetZ === z && (arrayAtI32(arrayAtObj(this.flags, x), z) & 19661064) === 0) {
                        return true;
                    }

                    if (targetX === x && z === ((targetZ + 1) | 0) && (arrayAtI32(arrayAtObj(this.flags, x), z) & 19661088) === 0) {
                        return true;
                    }

                    if (((targetX + 1) | 0) === x && z === targetZ) {
                        return true;
                    }

                    if (targetX === x && z === ((targetZ - 1) | 0)) {
                        return true;
                    }
                }
            }

            if (shape === 9) {
                if (targetX === x && ((targetZ + 1) | 0) === z && (arrayAtI32(arrayAtObj(this.flags, x), z) & 32) === 0) {
                    return true;
                }

                if (targetX === x && z === ((targetZ - 1) | 0) && (arrayAtI32(arrayAtObj(this.flags, x), z) & 2) === 0) {
                    return true;
                }

                if (x === ((targetX - 1) | 0) && z === targetZ && (arrayAtI32(arrayAtObj(this.flags, x), z) & 8) === 0) {
                    return true;
                }

                if (((targetX + 1) | 0) === x && targetZ === z && (arrayAtI32(arrayAtObj(this.flags, x), z) & 128) === 0) {
                    return true;
                }
            }
        } else {
            const east = (x + size - 1) | 0;
            const north = (z + size - 1) | 0;
            if (shape === 0) {
                if (angle !== 0) {
                    if (angle === 1) {
                        if (targetX >= x && targetX <= east && z === ((targetZ + 1) | 0)) {
                            return true;
                        }

                        if (x === ((targetX - size) | 0) && z <= targetZ && targetZ <= north && (arrayAtI32(arrayAtObj(this.flags, east), targetZ) & 19661064) === 0) {
                            return true;
                        }

                        if (x === ((targetX + 1) | 0) && targetZ >= z && targetZ <= north && (arrayAtI32(arrayAtObj(this.flags, x), targetZ) & 19661184) === 0) {
                            return true;
                        }
                    } else if (angle !== 2) {
                        if (angle === 3) {
                            if (targetX >= x && east >= targetX && ((targetZ - size) | 0) === z) {
                                return true;
                            }

                            if (((targetX - size) | 0) === x && z <= targetZ && north >= targetZ && (arrayAtI32(arrayAtObj(this.flags, east), targetZ) & 19661064) === 0) {
                                return true;
                            }

                            if (x === ((targetX + 1) | 0) && targetZ >= z && targetZ <= north && (arrayAtI32(arrayAtObj(this.flags, x), targetZ) & 19661184) === 0) {
                                return true;
                            }
                        }
                    } else {
                        if (x === ((targetX + 1) | 0) && z <= targetZ && north >= targetZ) {
                            return true;
                        }

                        if (x <= targetX && targetX <= east && ((targetZ + 1) | 0) === z && (arrayAtI32(arrayAtObj(this.flags, targetX), z) & 19661088) === 0) {
                            return true;
                        }

                        if (x <= targetX && east >= targetX && z === ((targetZ - size) | 0) && (arrayAtI32(arrayAtObj(this.flags, targetX), north) & 19661058) === 0) {
                            return true;
                        }
                    }
                } else {
                    if (((targetX - size) | 0) === x && z <= targetZ && targetZ <= north) {
                        return true;
                    }

                    if (x <= targetX && targetX <= east && ((targetZ + 1) | 0) === z && (arrayAtI32(arrayAtObj(this.flags, targetX), z) & 19661088) === 0) {
                        return true;
                    }

                    if (x <= targetX && east >= targetX && ((targetZ - size) | 0) === z && (arrayAtI32(arrayAtObj(this.flags, targetX), north) & 19661058) === 0) {
                        return true;
                    }
                }
            }

            if (shape === 2) {
                if (angle !== 0) {
                    if (angle === 1) {
                        if (((targetX - size) | 0) === x && targetZ >= z && targetZ <= north && (arrayAtI32(arrayAtObj(this.flags, east), targetZ) & 19661064) === 0) {
                            return true;
                        }

                        if (x <= targetX && targetX <= east && ((targetZ + 1) | 0) === z) {
                            return true;
                        }

                        if (((targetX + 1) | 0) === x && targetZ >= z && targetZ <= north) {
                            return true;
                        }

                        if (targetX >= x && targetX <= east && z === ((targetZ - size) | 0) && (arrayAtI32(arrayAtObj(this.flags, targetX), north) & 19661058) === 0) {
                            return true;
                        }
                    } else if (angle !== 2) {
                        if (angle === 3) {
                            if (x === ((targetX - size) | 0) && targetZ >= z && targetZ <= north) {
                                return true;
                            }

                            if (x <= targetX && targetX <= east && ((targetZ + 1) | 0) === z && (arrayAtI32(arrayAtObj(this.flags, targetX), z) & 19661088) === 0) {
                                return true;
                            }

                            if (((targetX + 1) | 0) === x && targetZ >= z && north >= targetZ && (arrayAtI32(arrayAtObj(this.flags, x), targetZ) & 19661184) === 0) {
                                return true;
                            }

                            if (x <= targetX && east >= targetX && ((targetZ - size) | 0) === z) {
                                return true;
                            }
                        }
                    } else {
                        if (((targetX - size) | 0) === x && targetZ >= z && north >= targetZ && (arrayAtI32(arrayAtObj(this.flags, east), targetZ) & 19661064) === 0) {
                            return true;
                        }

                        if (x <= targetX && targetX <= east && z === ((targetZ + 1) | 0) && (arrayAtI32(arrayAtObj(this.flags, targetX), z) & 19661088) === 0) {
                            return true;
                        }

                        if (((targetX + 1) | 0) === x && targetZ >= z && north >= targetZ) {
                            return true;
                        }

                        if (x <= targetX && east >= targetX && ((targetZ - size) | 0) === z) {
                            return true;
                        }
                    }
                } else {
                    if (x === ((targetX - size) | 0) && targetZ >= z && targetZ <= north) {
                        return true;
                    }

                    if (x <= targetX && targetX <= east && z === ((targetZ + 1) | 0)) {
                        return true;
                    }

                    if (((targetX + 1) | 0) === x && targetZ >= z && targetZ <= north && (arrayAtI32(arrayAtObj(this.flags, x), targetZ) & 19661184) === 0) {
                        return true;
                    }

                    if (targetX >= x && east >= targetX && ((targetZ - size) | 0) === z && (arrayAtI32(arrayAtObj(this.flags, targetX), north) & 19661058) === 0) {
                        return true;
                    }
                }
            }

            if (shape === 9) {
                if (x <= targetX && targetX <= east && ((targetZ + 1) | 0) === z && (arrayAtI32(arrayAtObj(this.flags, targetX), z) & 19661088) === 0) {
                    return true;
                }

                if (targetX >= x && east >= targetX && z === ((targetZ - size) | 0) && (arrayAtI32(arrayAtObj(this.flags, targetX), north) & 19661058) === 0) {
                    return true;
                }

                if (x === ((targetX - size) | 0) && targetZ >= z && targetZ <= north && (arrayAtI32(arrayAtObj(this.flags, east), targetZ) & 19661064) === 0) {
                    return true;
                }

                if (((targetX + 1) | 0) === x && targetZ >= z && north >= targetZ && (arrayAtI32(arrayAtObj(this.flags, x), targetZ) & 19661184) === 0) {
                    return true;
                }
            }
        }

        return false;
    }

    // ke.a(IBZIII)V
    addLoc(x: number, z: number, width: number, length: number, blockRange: boolean): void {
        x = (x - this.originX) | 0;
        z = (z - this.originZ) | 0;

        let mask = 256;
        if (blockRange) {
            mask = (mask + 131072) | 0;
        }

        for (let i = x; i < ((width + x) | 0); ++i) {
            if (i >= 0 && i < this.width) {
                for (let j = z; ((length + z) | 0) > j; ++j) {
                    if (j >= 0 && j < this.height) {
                        this.addFlag(mask, i, j);
                    }
                }
            }
        }
    }

    // ke.a(ZII)V
    blockGroundDecor(x: number, z: number): void {
        z = (z - this.originZ) | 0;
        x = (x - this.originX) | 0;
        arrayPutI32(arrayAtObj(this.flags, x), z, arrayAtI32(arrayAtObj(this.flags, x), z) | 262144);
    }

    // ke.c(III)V
    unblockGroundDecor(x: number, z: number): void {
        x = (x - this.originX) | 0;

        z = (z - this.originZ) | 0;
        arrayPutI32(arrayAtObj(this.flags, x), z, arrayAtI32(arrayAtObj(this.flags, x), z) & -262145);
    }

    // ke.a(ZBIIIII)V
    delLoc(x: number, z: number, width: number, length: number, angle: number, blockRange: boolean): void {
        x = (x - this.originX) | 0;

        if (angle === 1 || angle === 3) {
            const swap = width;
            width = length;
            length = swap;
        }

        let mask = 256;
        z = (z - this.originZ) | 0;
        if (blockRange) {
            mask = (mask + 131072) | 0;
        }

        for (let i = x; ((x + width) | 0) > i; ++i) {
            if (i >= 0 && this.width > i) {
                for (let j = z; j < ((length + z) | 0); ++j) {
                    if (j >= 0 && j < this.height) {
                        this.removeFlag(mask, i, j);
                    }
                }
            }
        }
    }

    // ke.a(IIIBIIII)Z
    testWallDecor(x: number, z: number, size: number, targetX: number, targetZ: number, shape: number, angle: number): boolean {
        if (size === 1) {
            if (x === targetX && z === targetZ) {
                return true;
            }
        } else if (x <= targetX && ((size + x - 1) | 0) >= targetX && targetZ <= targetZ && targetZ <= ((targetZ + size - 1) | 0)) {
            return true;
        }

        z = (z - this.originZ) | 0;
        targetX = (targetX - this.originX) | 0;
        targetZ = (targetZ - this.originZ) | 0;
        x = (x - this.originX) | 0;
        if (size === 1) {
            if (shape === 6 || shape === 7) {
                if (shape === 7) {
                    angle = ((angle + 2) | 0) & 3;
                }

                if (angle !== 0) {
                    if (angle === 1) {
                        if (x === ((targetX - 1) | 0) && z === targetZ && (arrayAtI32(arrayAtObj(this.flags, x), z) & 8) === 0) {
                            return true;
                        }

                        if (targetX === x && z === ((targetZ - 1) | 0) && (arrayAtI32(arrayAtObj(this.flags, x), z) & 2) === 0) {
                            return true;
                        }
                    } else if (angle === 2) {
                        if (x === ((targetX - 1) | 0) && targetZ === z && (arrayAtI32(arrayAtObj(this.flags, x), z) & 8) === 0) {
                            return true;
                        }

                        if (targetX === x && z === ((targetZ + 1) | 0) && (arrayAtI32(arrayAtObj(this.flags, x), z) & 32) === 0) {
                            return true;
                        }
                    } else if (angle === 3) {
                        if (((targetX + 1) | 0) === x && targetZ === z && (arrayAtI32(arrayAtObj(this.flags, x), z) & 128) === 0) {
                            return true;
                        }

                        if (targetX === x && z === ((targetZ + 1) | 0) && (arrayAtI32(arrayAtObj(this.flags, x), z) & 32) === 0) {
                            return true;
                        }
                    }
                } else {
                    if (x === ((targetX + 1) | 0) && targetZ === z && (arrayAtI32(arrayAtObj(this.flags, x), z) & 128) === 0) {
                        return true;
                    }

                    if (x === targetX && ((targetZ - 1) | 0) === z && (arrayAtI32(arrayAtObj(this.flags, x), z) & 2) === 0) {
                        return true;
                    }
                }
            }

            if (shape === 8) {
                if (targetX === x && ((targetZ + 1) | 0) === z && (arrayAtI32(arrayAtObj(this.flags, x), z) & 32) === 0) {
                    return true;
                }

                if (targetX === x && ((targetZ - 1) | 0) === z && (arrayAtI32(arrayAtObj(this.flags, x), z) & 2) === 0) {
                    return true;
                }

                if (x === ((targetX - 1) | 0) && targetZ === z && (arrayAtI32(arrayAtObj(this.flags, x), z) & 8) === 0) {
                    return true;
                }

                if (x === ((targetX + 1) | 0) && targetZ === z && (arrayAtI32(arrayAtObj(this.flags, x), z) & 128) === 0) {
                    return true;
                }
            }
        } else {
            const east = (size + x - 1) | 0;
            const north = (z + size - 1) | 0;
            if (shape === 6 || shape === 7) {
                if (shape === 7) {
                    angle = ((angle + 2) | 0) & 3;
                }

                if (angle !== 0) {
                    if (angle !== 1) {
                        if (angle !== 2) {
                            if (angle === 3) {
                                if (((targetX + 1) | 0) === x && targetZ >= z && targetZ <= north && (arrayAtI32(arrayAtObj(this.flags, x), targetZ) & 128) === 0) {
                                    return true;
                                }

                                if (x <= targetX && east >= targetX && z === ((targetZ + 1) | 0) && (arrayAtI32(arrayAtObj(this.flags, targetX), z) & 32) === 0) {
                                    return true;
                                }
                            }
                        } else {
                            if (x === ((targetX - size) | 0) && targetZ >= z && targetZ <= north && (arrayAtI32(arrayAtObj(this.flags, east), targetZ) & 8) === 0) {
                                return true;
                            }

                            if (x <= targetX && east >= targetX && ((targetZ + 1) | 0) === z && (arrayAtI32(arrayAtObj(this.flags, targetX), z) & 32) === 0) {
                                return true;
                            }
                        }
                    } else {
                        if (((targetX - size) | 0) === x && z <= targetZ && targetZ <= north && (arrayAtI32(arrayAtObj(this.flags, east), targetZ) & 8) === 0) {
                            return true;
                        }

                        if (targetX >= x && east >= targetX && ((targetZ - size) | 0) === z && (arrayAtI32(arrayAtObj(this.flags, targetX), north) & 2) === 0) {
                            return true;
                        }
                    }
                } else {
                    if (x === ((targetX + 1) | 0) && z <= targetZ && targetZ <= north && (arrayAtI32(arrayAtObj(this.flags, x), targetZ) & 128) === 0) {
                        return true;
                    }

                    if (targetX >= x && east >= targetX && z === ((targetZ - size) | 0) && (arrayAtI32(arrayAtObj(this.flags, targetX), north) & 2) === 0) {
                        return true;
                    }
                }
            }

            if (shape === 8) {
                if (targetX >= x && targetX <= east && z === ((targetZ + 1) | 0) && (arrayAtI32(arrayAtObj(this.flags, targetX), z) & 32) === 0) {
                    return true;
                }

                if (x <= targetX && east >= targetX && ((targetZ - size) | 0) === z && (arrayAtI32(arrayAtObj(this.flags, targetX), north) & 2) === 0) {
                    return true;
                }

                if (((targetX - size) | 0) === x && targetZ >= z && north >= targetZ && (arrayAtI32(arrayAtObj(this.flags, east), targetZ) & 8) === 0) {
                    return true;
                }

                if (((targetX + 1) | 0) === x && z <= targetZ && north >= targetZ && (arrayAtI32(arrayAtObj(this.flags, x), targetZ) & 128) === 0) {
                    return true;
                }
            }
        }

        return false;
    }

    // ke.b(IIIIIIIII)Z
    testLoc(x: number, z: number, size: number, targetX: number, targetZ: number, width: number, length: number, sides: number): boolean {
        if (size > 1) {
            return this.overlaps(z, targetZ, size, length, targetX, width, x, size) || this.touches(length, z, x, width, targetX, size, sides, targetZ, size);
        } else {
            const east = (width + targetX - 1) | 0;
            const north = (targetZ + length - 1) | 0;
            if (targetX <= x && east >= x && z >= targetZ && north >= z) {
                return true;
            } else if (x === ((targetX - 1) | 0) && targetZ <= z && north >= z && (arrayAtI32(arrayAtObj(this.flags, (x - this.originX) | 0), (z - this.originZ) | 0) & 8) === 0 && (sides & 8) === 0) {
                return true;
            } else if (((east + 1) | 0) === x && z >= targetZ && z <= north && (arrayAtI32(arrayAtObj(this.flags, (x - this.originX) | 0), (z - this.originZ) | 0) & 128) === 0 && (sides & 2) === 0) {
                return true;
            } else if (z === ((targetZ - 1) | 0) && x >= targetX && east >= x && (arrayAtI32(arrayAtObj(this.flags, (x - this.originX) | 0), (z - this.originZ) | 0) & 2) === 0 && (sides & 4) === 0) {
                return true;
            } else {
                return z === ((north + 1) | 0) && targetX <= x && x <= east && (arrayAtI32(arrayAtObj(this.flags, (x - this.originX) | 0), (z - this.originZ) | 0) & 32) === 0 && (sides & 1) === 0;
            }
        }
    }

    // ke.b(IIBI)V
    private removeFlag(mask: number, x: number, z: number): void {
        arrayPutI32(arrayAtObj(this.flags, x), z, arrayAtI32(arrayAtObj(this.flags, x), z) & ~mask);
    }

    // ke.a(IZIIZI)V
    addWall(x: number, z: number, shape: number, angle: number, blockRange: boolean): void {
        z = (z - this.originZ) | 0;
        x = (x - this.originX) | 0;

        if (shape === 0) {
            if (angle === 0) {
                this.addFlag(128, x, z);
                this.addFlag(8, (x - 1) | 0, z);
            }

            if (angle === 1) {
                this.addFlag(2, x, z);
                this.addFlag(32, x, (z + 1) | 0);
            }

            if (angle === 2) {
                this.addFlag(8, x, z);
                this.addFlag(128, (x + 1) | 0, z);
            }

            if (angle === 3) {
                this.addFlag(32, x, z);
                this.addFlag(2, x, (z - 1) | 0);
            }
        }

        if (shape === 1 || shape === 3) {
            if (angle === 0) {
                this.addFlag(1, x, z);
                this.addFlag(16, (x - 1) | 0, (z + 1) | 0);
            }

            if (angle === 1) {
                this.addFlag(4, x, z);
                this.addFlag(64, (x + 1) | 0, (z + 1) | 0);
            }

            if (angle === 2) {
                this.addFlag(16, x, z);
                this.addFlag(1, (x + 1) | 0, (z - 1) | 0);
            }

            if (angle === 3) {
                this.addFlag(64, x, z);
                this.addFlag(4, (x - 1) | 0, (z - 1) | 0);
            }
        }

        if (shape === 2) {
            if (angle === 0) {
                this.addFlag(130, x, z);
                this.addFlag(8, (x - 1) | 0, z);
                this.addFlag(32, x, (z + 1) | 0);
            }

            if (angle === 1) {
                this.addFlag(10, x, z);
                this.addFlag(32, x, (z + 1) | 0);
                this.addFlag(128, (x + 1) | 0, z);
            }

            if (angle === 2) {
                this.addFlag(40, x, z);
                this.addFlag(128, (x + 1) | 0, z);
                this.addFlag(2, x, (z - 1) | 0);
            }

            if (angle === 3) {
                this.addFlag(160, x, z);
                this.addFlag(2, x, (z - 1) | 0);
                this.addFlag(8, (x - 1) | 0, z);
            }
        }

        if (blockRange) {
            if (shape === 0) {
                if (angle === 0) {
                    this.addFlag(65536, x, z);
                    this.addFlag(4096, (x - 1) | 0, z);
                }

                if (angle === 1) {
                    this.addFlag(1024, x, z);
                    this.addFlag(16384, x, (z + 1) | 0);
                }

                if (angle === 2) {
                    this.addFlag(4096, x, z);
                    this.addFlag(65536, (x + 1) | 0, z);
                }

                if (angle === 3) {
                    this.addFlag(16384, x, z);
                    this.addFlag(1024, x, (z - 1) | 0);
                }
            }

            if (shape === 1 || shape === 3) {
                if (angle === 0) {
                    this.addFlag(512, x, z);
                    this.addFlag(8192, (x - 1) | 0, (z + 1) | 0);
                }

                if (angle === 1) {
                    this.addFlag(2048, x, z);
                    this.addFlag(32768, (x + 1) | 0, (z + 1) | 0);
                }

                if (angle === 2) {
                    this.addFlag(8192, x, z);
                    this.addFlag(512, (x + 1) | 0, (z - 1) | 0);
                }

                if (angle === 3) {
                    this.addFlag(32768, x, z);
                    this.addFlag(2048, (x - 1) | 0, (z - 1) | 0);
                }
            }

            if (shape === 2) {
                if (angle === 0) {
                    this.addFlag(66560, x, z);
                    this.addFlag(4096, (x - 1) | 0, z);
                    this.addFlag(16384, x, (z + 1) | 0);
                }

                if (angle === 1) {
                    this.addFlag(5120, x, z);
                    this.addFlag(16384, x, (z + 1) | 0);
                    this.addFlag(65536, (x + 1) | 0, z);
                }

                if (angle === 2) {
                    this.addFlag(20480, x, z);
                    this.addFlag(65536, (x + 1) | 0, z);
                    this.addFlag(1024, x, (z - 1) | 0);
                }

                if (angle === 3) {
                    this.addFlag(81920, x, z);
                    this.addFlag(1024, x, (z - 1) | 0);
                    this.addFlag(4096, (x - 1) | 0, z);
                    return;
                }
            }
        }
    }
}
