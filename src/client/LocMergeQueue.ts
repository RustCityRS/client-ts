import LocType from '#/config/LocType';
import LocChange from '#/dash3d/LocChange';
import LocShape from '#/dash3d/LocShape';
import PendingLocMerge from '#/dash3d/PendingLocMerge';
import SharedPtrList from '#/datastruct/SharedPtrList';
import Client from './Client';
import { arrayAtI32, arrayAtObj } from '#/util/JavaArray';
import { isJavaRuntimeException } from '#/util/JavaException';
import WrappedException from '#/util/WrappedException';
import world from '#/dash3d/world';
import SceneCutover from '#/scene/SceneCutover';
import type ClientEntity from '#/dash3d/ClientEntity';
import { glJar } from './ClientVariant';

export default class LocMergeQueue {
    static readonly pending = new SharedPtrList<PendingLocMerge>(); // nl.Q:Lgk;

    // g.a(IIIIIIIIBIIII)V
    static enqueue(actor: number, angle: number, endDelay: number, x: number, offsetZ2: number, shape: number, z: number, offsetX2: number, offsetZ1: number, locId: number, offsetX1: number, startDelay: number): void {
        const merge = new PendingLocMerge();
        merge.endDelay = endDelay;
        merge.offsetZ2 = offsetZ2;
        merge.angle = angle;
        merge.z = z;
        merge.actor = actor;
        merge.startDelay = startDelay;
        merge.offsetX2 = offsetX2;
        merge.x = x;
        merge.locId = locId;
        merge.offsetX1 = offsetX1;
        merge.offsetZ1 = offsetZ1;
        merge.shape = shape;
        LocMergeQueue.pending.push_back(merge);
    }

    // HD ph.a(B)V
    private static processQueueHd(): void {
        try {
            for (;;) {
                const merge = LocMergeQueue.pending.takeFrontAndPop();
                if (merge === null) return;
                if (!(merge instanceof PendingLocMerge)) throw new TypeError('ClassCastException: not a PendingLocMerge');
                let actor: ClientEntity | null;
                if (merge.actor < 0) {
                    const id = (-merge.actor - 1) | 0;
                    actor = id === Client.localPid ? Client.localPlayer : arrayAtObj(Client.players, id);
                } else actor = arrayAtObj(Client.npcs, (merge.actor - 1) | 0);
                if (actor === null) continue;
                const type = LocType.List(merge.locId);
                let width: number, length: number;
                if (merge.angle === 1 || merge.angle === 3) {
                    length = type.width;
                    width = type.length;
                } else {
                    width = type.width;
                    length = type.length;
                }
                const x2 = ((((width + 1) | 0) >> 1) + merge.x) | 0;
                const x1 = ((width >> 1) + merge.x) | 0;
                const z1 = ((length >> 1) + merge.z) | 0;
                const z2 = ((((length + 1) | 0) >> 1) + merge.z) | 0;
                const heights = arrayAtObj(world.levelHeightmaps, Client.playerLevel);
                const height = (arrayAtI32(arrayAtObj(heights, x2), z2) + arrayAtI32(arrayAtObj(heights, x1), z2) + arrayAtI32(arrayAtObj(heights, x1), z1) + arrayAtI32(arrayAtObj(heights, x2), z1)) >> 2;
                let entity: object | null = null;
                const layer = arrayAtI32(LocShape.shapeToLayer, merge.shape);
                if (layer === 0) entity = world.GetWall(Client.playerLevel, merge.x, merge.z)?.model1 ?? null;
                else if (layer === 2) entity = world.GetScene(Client.playerLevel, merge.x, merge.z)?.model ?? null;
                else if (layer === 3) entity = world.GetGroundDecor(Client.playerLevel, merge.x, merge.z)?.model ?? null;
                else if (layer === 1) entity = world.GetDecor(Client.playerLevel, merge.x, merge.z)?.model ?? null;
                if (entity === null) continue;
                Client.LocChangeCreate((merge.startDelay + 1) | 0, 0, merge.x, (merge.endDelay + 1) | 0, merge.z, Client.playerLevel, layer, -1, 0);
                actor.attachmentEnd = (merge.endDelay + Client.loopCycle) | 0;
                actor.attachmentZ = ((length << 6) + (merge.z << 7)) | 0;
                actor.attachmentX = ((width << 6) + (merge.x << 7)) | 0;
                actor.attachment = entity;
                let minX = merge.offsetX1;
                actor.attachmentHeight = height;
                actor.attachmentStart = (Client.loopCycle + merge.startDelay) | 0;
                let maxX = merge.offsetX2;
                let minZ = merge.offsetZ1;
                let maxZ = merge.offsetZ2;
                if (minX > maxX) {
                    const saved = minX;
                    minX = maxX;
                    maxX = saved;
                }
                actor.attachmentMaxX = (merge.x + maxX) | 0;
                if (minZ > maxZ) {
                    const saved = minZ;
                    minZ = maxZ;
                    maxZ = saved;
                }
                actor.attachmentMinZ = (merge.z + minZ) | 0;
                actor.attachmentMaxZ = (maxZ + merge.z) | 0;
                actor.attachmentMinX = (merge.x + minX) | 0;
            }
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'ph.A(-91)');
        }
    }

    // SD sg.a(B)V
    static processQueue(): void {
        if (glJar) return LocMergeQueue.processQueueHd();
        try {
            while (true) {
                const merge = LocMergeQueue.pending.takeFrontAndPop();
                if (merge === null) return;
                if (!(merge instanceof PendingLocMerge)) throw new TypeError('ClassCastException: not a PendingLocMerge');
                let actor: ClientEntity | null;
                if (merge.actor >= 0) {
                    actor = arrayAtObj(Client.npcs, (merge.actor - 1) | 0);
                } else {
                    const id = (-1 - merge.actor) | 0;
                    actor = id === Client.localPid ? Client.localPlayer : arrayAtObj(Client.players, id);
                }
                if (actor === null) continue;
                const type = LocType.List(merge.locId);
                let width: number, length: number;
                if (merge.angle === 1 || merge.angle === 3) {
                    width = type.length;
                    length = type.width;
                } else {
                    length = type.length;
                    width = type.width;
                }
                const x1 = ((width >> 1) + merge.x) | 0;
                const z1 = (merge.z + (length >> 1)) | 0;
                const x2 = (merge.x + (((1 + width) | 0) >> 1)) | 0;
                const heights = arrayAtObj(world.levelHeightmaps, Client.playerLevel);
                const z2 = ((((length + 1) | 0) >> 1) + merge.z) | 0;
                let entity: object | null = null;
                const layer = arrayAtI32(LocShape.shapeToLayer, merge.shape);
                const height = (arrayAtI32(arrayAtObj(heights, x2), z2) + arrayAtI32(arrayAtObj(heights, x2), z1) + arrayAtI32(arrayAtObj(heights, x1), z1) + arrayAtI32(arrayAtObj(heights, x1), z2)) >> 2;
                if (!SceneCutover.active) {
                    entity = LocChange.scene?.getEntity?.(Client.playerLevel, merge.x, merge.z, layer) ?? null;
                } else if (layer !== 0) {
                    if (layer === 1) {
                        const decor = world.GetDecor(Client.playerLevel, merge.x, merge.z);
                        if (decor !== null) entity = decor.model;
                    } else if (layer !== 2) {
                        if (layer === 3) {
                            const decor = world.GetGroundDecor(Client.playerLevel, merge.x, merge.z);
                            if (decor !== null) entity = decor.model;
                        }
                    } else {
                        const loc = world.GetScene(Client.playerLevel, merge.x, merge.z);
                        if (loc !== null) entity = loc.model;
                    }
                } else {
                    const wall = world.GetWall(Client.playerLevel, merge.x, merge.z);
                    if (wall !== null) entity = wall.model1;
                }
                if (entity === null) continue;
                Client.LocChangeCreate((merge.startDelay + 1) | 0, 0, merge.x, (merge.endDelay + 1) | 0, merge.z, Client.playerLevel, layer, -1, 0);
                actor.attachment = entity;
                actor.attachmentEnd = (Client.loopCycle + merge.endDelay) | 0;
                actor.attachmentHeight = height;
                actor.attachmentX = ((merge.x << 7) + (width << 6)) | 0;
                let maxX = merge.offsetX2;
                actor.attachmentStart = (Client.loopCycle + merge.startDelay) | 0;
                let minX = merge.offsetX1;
                actor.attachmentZ = ((length << 6) + (merge.z << 7)) | 0;
                let minZ = merge.offsetZ1;
                if (maxX < minX) {
                    const saved = minX;
                    minX = maxX;
                    maxX = saved;
                }
                let maxZ = merge.offsetZ2;
                if (minZ > maxZ) {
                    const saved = minZ;
                    minZ = maxZ;
                    maxZ = saved;
                }
                actor.attachmentMaxZ = (maxZ + merge.z) | 0;
                actor.attachmentMinX = (minX + merge.x) | 0;
                actor.attachmentMinZ = (minZ + merge.z) | 0;
                actor.attachmentMaxX = (merge.x + maxX) | 0;
            }
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'sg.B(-24)');
        }
    }
}
