import Client from '#/client/Client';
import ClientBuild from '#/client/ClientBuild';
import { glJar } from '#/client/ClientVariant';
import FriendChatChannel from '#/client/FriendChatChannel';
import GameShell from '#/client/GameShell';
import OrbitCamera from '#/client/OrbitCamera';
import ReceivePlayerPositions from '#/client/ReceivePlayerPositions';
import LocType from '#/config/LocType';
import MSITypeList from '#/config/MSITypeList';
import type AbstractSprite from '#/graphics/AbstractSprite';
import Pix2D from '#/graphics/Pix2D';
import Pix32 from '#/graphics/Pix32';
import SpriteLoader from '#/graphics/SpriteLoader';
import AudioEngine from '#/sound/AudioEngine';
import type IfType from '#/ui/IfType';
import InterfaceList from '#/ui/InterfaceList';
import WorldMapLabels from '#/ui/WorldMapLabels';
import { doubleToInt, intDivide } from '#/util/IntUtils';
import { arrayAtB64, arrayAtI16, arrayAtI32, arrayAtObj, arrayAtU8, arrayPutI32, arrayPutObj, requireNonNull } from '#/util/JavaArray';
import { mathRandom } from '#/util/JavaRandom';
import { isJavaRuntimeException } from '#/util/JavaException';
import WrappedException from '#/util/WrappedException';
import CollisionMap from './CollisionMap';
import Pix3D from './Pix3D';
import world from './world';
import GlRenderer from '#/gl/GlRenderer';
import { loadGlRaster, loadGlSprite } from '#/util/GamepackClasses';

// tf.w (GlRenderer.active). Only the GL gamepack has the flag; with the software gamepack (glJar false) the GL modules
// are never loaded. They are required lazily because GlRenderer's module graph reaches back into the shared classes.
function glActive(): boolean {
    return glJar && GlRenderer.active;
}

function glSprite(): typeof import('#/gl/GlSprite').default {
    return loadGlSprite();
}

function glRaster(): typeof import('#/gl/GlRaster').default {
    return loadGlRaster();
}

// Minimap image building and drawing, gathered from scattered statics by the member map. The build, draw and compass
// routines carry their NXT names (projects/osclient/minimap/Minimap.cpp): BuildBuffer, Draw and CompassDraw (the member
// map's createMinimap, drawMinimap and drawCompass; Client.GlCheckMinimap already calls BuildBuffer).
// Stripped artifacts: the invocation counters ph.i, fd.N and ke.D, the od.a catch/rethrow wrappers, the client.wb
// opaque branches, and the unloads ek.a(I)V (nulls ek.w), ob.b(B)V (nulls ob.Kb) and Client.unload4 ec.a(I)V (nulls ec.o).
export default class MinimapBuilder {
    // gk.j:I. The level the minimap image was last built for; region rebuilds (bj.a) and login reset it to -1, and hi.b
    // rebuilds through ph.a whenever it differs from the active level.
    static minimapLevel = -1;

    // ek.w:Lvc;. The finished 512x512 minimap image that Draw rotates into the minimap component.
    static minimapImage: AbstractSprite | null = null;

    // ob.Kb:Lrh;. The image BuildBuffer is filling. It survives a failed build (a map-scene sprite not loaded yet), so
    // the next attempt skips straight to the detail pass.
    static pendingImage: Pix32 | null = null;

    // ec.o:[I. Loc ids of the map functions BuildBuffer found, parallel to Client.activeMapFunctionX/Z (ba.h/oh.m),
    // counted by Client.activeMapFunctionCount (qk.C).
    static readonly mapFunctionLocIds = new Int32Array(1000);

    // SD ph.a(IZ)Z / HD kl.b(II)Z. NXT Minimap::BuildBuffer (projects/osclient/minimap/Minimap.cpp:188), called by hi.b
    // (Client::GlCheckMinimap). The SD boolean is a dummy: hi.b, the only caller, passes true, so its `!arg ->
    // ph.g = null` guard never runs. HD has no dummy guard; its first int is the x offset that SD keeps as the local 0,
    // and its only caller ch.c(I)V passes its own dummy plus 0 (= 0). Unlike NXT, 530 also gathers the map functions
    // between the ground and detail passes and draws walls in a colour jittered per build.
    // HD (tf.w): the image is always a fresh software one, never the previous minimap; the exits clear Pix2D.pixels
    // (kb.i) instead of binding the draw area; and the finished image has its 0 pixels turned to 1 and is uploaded as a
    // cf (GlSprite), which becomes the minimap.
    static BuildBuffer(level: number): boolean {
        try {
            const offsetZ = 0;
            const offsetX = 0;
            if (MinimapBuilder.pendingImage === null) {
                if (!glActive() && MinimapBuilder.minimapImage !== null) {
                    const image = MinimapBuilder.minimapImage;
                    if (!(image instanceof Pix32)) throw new TypeError('ClassCastException: expected Pix32');
                    MinimapBuilder.pendingImage = image;
                } else {
                    MinimapBuilder.pendingImage = new Pix32(512, 512);
                }

                const pixels = MinimapBuilder.pendingImage.pixels;
                const length = requireNonNull(pixels).length;
                for (let i = 0; length > i; i++) {
                    arrayPutI32(pixels, i, 1);
                }

                for (let z = (1 + offsetZ) | 0; ((-offsetZ + 103) | 0) > z; z++) {
                    let pos = (Math.imul(4, Math.imul(512, (-z + 103 - -offsetZ) | 0)) + 24628) | 0;
                    for (let x = (1 + offsetX) | 0; x < ((104 - ((offsetX + 1) | 0)) | 0); x++) {
                        if ((24 & arrayAtU8(arrayAtObj(arrayAtObj(ClientBuild.m_mapl, level), x), z)) === 0) {
                            world.Render2DGround(pixels, pos, 512, level, x, z);
                        }

                        if (level < 3 && (8 & arrayAtU8(arrayAtObj(arrayAtObj(ClientBuild.m_mapl, (1 + level) | 0), x), z)) !== 0) {
                            world.Render2DGround(pixels, pos, 512, (level - -1) | 0, x, z);
                        }

                        pos = (pos + 4) | 0;
                    }
                }

                Client.activeMapFunctionCount = 0;
                for (let x = 0; x < 104; x++) {
                    for (let z = 0; z < 104; z++) {
                        const typecode = world.GdType(Client.playerLevel, (x - -offsetX) | 0, (z + offsetZ) | 0);
                        if (typecode === 0n) {
                            continue;
                        }

                        const type = LocType.List(0x7fffffff & Number(BigInt.asIntN(32, BigInt.asUintN(64, typecode) >> 32n)));
                        let mapFunction = type.mapFunction;
                        if (type.multi !== null) {
                            for (let i = 0; requireNonNull(type.multi).length > i; i++) {
                                if (arrayAtI32(type.multi, i) !== -1) {
                                    const multi = LocType.List(arrayAtI32(type.multi, i));
                                    if (multi.mapFunction >= 0) {
                                        mapFunction = multi.mapFunction;
                                        break;
                                    }
                                }
                            }
                        }

                        if (mapFunction < 0) {
                            continue;
                        }

                        let tileX = (offsetX + x) | 0;
                        let tileZ = (z + offsetZ) | 0;
                        if (mapFunction !== 22 && mapFunction !== 29 && mapFunction !== 34 && mapFunction !== 36 && mapFunction !== 46 && mapFunction !== 47 && mapFunction !== 48) {
                            const flags = requireNonNull(arrayAtObj(CollisionMap.levelMaps, Client.playerLevel)).flags;
                            for (let i = 0; i < 10; i++) {
                                const dir = doubleToInt(mathRandom.nextDouble() * 4.0);
                                if (dir === 0 && tileX > 0 && tileX > ((x - 3) | 0) && (arrayAtI32(arrayAtObj(flags, (tileX - 1) | 0), tileZ) & 19661064) === 0) {
                                    tileX = (tileX - 1) | 0;
                                }

                                if (dir === 1 && tileX < 103 && ((x - -3) | 0) > tileX && (arrayAtI32(arrayAtObj(flags, (1 + tileX) | 0), tileZ) & 19661184) === 0) {
                                    tileX = (tileX + 1) | 0;
                                }

                                if (dir === 2 && tileZ > 0 && tileZ > ((z - 3) | 0) && (19661058 & arrayAtI32(arrayAtObj(flags, tileX), (-1 + tileZ) | 0)) === 0) {
                                    tileZ = (tileZ - 1) | 0;
                                }

                                if (dir === 3 && tileZ < 103 && ((z + 3) | 0) > tileZ && (arrayAtI32(arrayAtObj(flags, tileX), (1 + tileZ) | 0) & 19661088) === 0) {
                                    tileZ = (tileZ + 1) | 0;
                                }
                            }
                        }

                        arrayPutI32(MinimapBuilder.mapFunctionLocIds, Client.activeMapFunctionCount, type.id);
                        arrayPutI32(Client.activeMapFunctionX, Client.activeMapFunctionCount, (tileX - offsetX) | 0);
                        arrayPutI32(Client.activeMapFunctionZ, Client.activeMapFunctionCount, (tileZ - offsetZ) | 0);
                        Client.activeMapFunctionCount = (Client.activeMapFunctionCount + 1) | 0;
                    }
                }
            }

            requireNonNull(MinimapBuilder.pendingImage).bind();
            // The two gamepacks draw the three wall-colour randoms into different channels (outside tf.w): SD blue, green,
            // red (ph.a bytecode 792-843); HD green, red, blue (kl.b bytecode 801-851).
            const wallColour = glJar
                ? ((((doubleToInt(20.0 * mathRandom.nextDouble()) + 238 - 10) | 0) << 8) + ((-10 + ((doubleToInt(mathRandom.nextDouble() * 20.0) + 238) | 0)) << 16) + ((228 - -doubleToInt(20.0 * mathRandom.nextDouble())) | 0)) | 0
                : (((doubleToInt(20.0 * mathRandom.nextDouble()) + 238 + -10) | 0) + ((((-10 + ((doubleToInt(mathRandom.nextDouble() * 20.0) + 238) | 0)) << 8) + ((((-10 + doubleToInt(mathRandom.nextDouble() * 20.0)) | 0) + 238) << 16)) | 0)) | 0;
            const activeColour = (228 + doubleToInt(mathRandom.nextDouble() * 20.0)) << 16;
            for (let z = 1; z < 103; z++) {
                for (let x = 1; x < 103; x++) {
                    if ((arrayAtU8(arrayAtObj(arrayAtObj(ClientBuild.m_mapl, level), (offsetX + x) | 0), (z - -offsetZ) | 0) & 24) === 0 && !Client.DrawDetail(z, offsetX, activeColour, level, x, offsetZ, wallColour)) {
                        if (glActive()) {
                            Pix2D.pixels = null;
                        } else {
                            requireNonNull(GameShell.drawArea).bind();
                        }
                        return false;
                    }

                    if (level < 3 && (8 & arrayAtU8(arrayAtObj(arrayAtObj(ClientBuild.m_mapl, (level + 1) | 0), (offsetX + x) | 0), (offsetZ + z) | 0)) !== 0 && !Client.DrawDetail(z, offsetX, activeColour, (1 + level) | 0, x, offsetZ, wallColour)) {
                        if (!glActive()) {
                            requireNonNull(GameShell.drawArea).bind();
                        } else {
                            Pix2D.pixels = null;
                        }
                        return false;
                    }
                }
            }

            if (glActive()) {
                const pixels = requireNonNull(MinimapBuilder.pendingImage).pixels;
                const length = requireNonNull(pixels).length;
                for (let i = 0; length > i; i++) {
                    if (arrayAtI32(pixels, i) === 0) {
                        arrayPutI32(pixels, i, 1);
                    }
                }
                MinimapBuilder.minimapImage = new (glSprite())(MinimapBuilder.pendingImage);
            } else {
                MinimapBuilder.minimapImage = MinimapBuilder.pendingImage;
            }
            if (!glActive()) {
                requireNonNull(GameShell.drawArea).bind();
            } else {
                Pix2D.pixels = null;
            }
            MinimapBuilder.pendingImage = null;
            return true;
        } catch (error) {
            if (!glJar || !isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'kl.B(0,' + level + ')');
        }
    }

    // fd.a(ILaj;III)V. NXT Minimap::Draw (projects/osclient/minimap/Minimap.cpp:609), drawn by lf.a for client code
    // 1338 after aj.a(I)Z (IfType.GetMask) succeeds. The fourth Java argument is a dummy: lf.a, the only caller,
    // passes 32, so its `!= 32 -> fd.S = null` guard never runs, and the `arg ^ 52` it forwards as hd.a's own dummy
    // (DrawArrow's stripped 20) is the constant 20.
    // HD ed.a(IBIILbe;)V: the same body with the byte dummy second; its caller passes 59, so the `!= 59` return before
    // the redraw flag never runs. While tf.w is set it clips with GlRaster, draws the minimap cf (GlSprite) and the
    // labels through the component's own graphic (be.a(BZ)Lqf;, cast to cf) as the mask instead of the span mask,
    // draws that graphic in place of the black span fill, and fills the centre dot with GlRaster. The dot and arrow
    // helpers (em.a, hi.a) carry their own tf.w arms.
    static Draw(x: number, component: IfType | null, index: number, y: number): void {
        try {
            AudioEngine.tick();
            const widget = requireNonNull(component);
            if (glActive()) {
                glRaster().setClipping(x, y, (x + widget.width) | 0, (y + widget.height) | 0);
            } else {
                Pix2D.setClipping(x, y, (widget.width + x) | 0, (y + widget.height) | 0);
            }
            if (Client.minimapState === 2 || Client.minimapState === 5 || MinimapBuilder.minimapImage === null) {
                if (!glActive()) {
                    Pix2D.fillSpans(x, y, 0, widget.maskStarts, widget.maskWidths);
                } else {
                    const graphic = widget.GetGraphic(false);
                    if (graphic !== null) {
                        graphic.draw(x, y);
                    }
                }
            } else {
                const angle = glJar ? (OrbitCamera.minimapAngle + OrbitCamera.followYaw) & 2047 : (OrbitCamera.followYaw - -OrbitCamera.minimapAngle) & 2047;
                let anchorX = 0;
                if (glJar) anchorX = (48 + ((requireNonNull(Client.localPlayer).x / 32) | 0)) | 0;
                const anchorZ = (464 + -((requireNonNull(Client.localPlayer).z / 32) | 0)) | 0;
                if (!glJar) anchorX = (48 + ((requireNonNull(Client.localPlayer).x / 32) | 0)) | 0;
                if (!glActive()) {
                    const image = MinimapBuilder.minimapImage;
                    if (image !== null && !(image instanceof Pix32)) throw new TypeError('ClassCastException: expected Pix32');
                    requireNonNull(image).drawRotatedMaskedOpaque(x, y, widget.width, widget.height, anchorX, anchorZ, angle, (OrbitCamera.minimapZoom + 256) | 0, widget.maskStarts, widget.maskWidths);
                } else {
                    const image = MinimapBuilder.minimapImage;
                    const GlSprite = glSprite();
                    if (image !== null && !(image instanceof GlSprite)) throw new TypeError('ClassCastException: expected GlSprite');
                    const width = widget.width;
                    const height = widget.height;
                    const zoom = (OrbitCamera.minimapZoom + 256) | 0;
                    const mask = widget.GetGraphic(false);
                    if (mask !== null && !(mask instanceof GlSprite)) throw new TypeError('ClassCastException: expected GlSprite');
                    requireNonNull(image).drawRotatedMasked(x, y, width, height, anchorX, anchorZ, angle, zoom, mask);
                }

                if (WorldMapLabels.scene !== null) {
                    for (let i = 0; requireNonNull(WorldMapLabels.scene).count > i; i++) {
                        if (!requireNonNull(WorldMapLabels.scene).hasFlag4(i)) {
                            continue;
                        }

                        let labelX: number, labelZ: number, sin: number, cos: number, font: typeof Client.fontPlain11;
                        let screenX = 0;
                        if (glJar) {
                            labelX = (2 + Math.imul(4, arrayAtI16(requireNonNull(WorldMapLabels.scene).x, i) - Client.mapBuildBaseX) - ((requireNonNull(Client.localPlayer).x / 32) | 0)) | 0;
                            sin = arrayAtI32(Pix3D.sinTable, angle);
                            cos = arrayAtI32(Pix3D.cosTable, angle);
                            font = Client.fontPlain11;
                            sin = intDivide(Math.imul(sin, 256), (256 + OrbitCamera.minimapZoom) | 0);
                            labelZ = (2 + Math.imul(4, -Client.mapBuildBaseZ + arrayAtI16(requireNonNull(WorldMapLabels.scene).z, i)) - ((requireNonNull(Client.localPlayer).z / 32) | 0)) | 0;
                            cos = intDivide(Math.imul(cos, 256), (256 + OrbitCamera.minimapZoom) | 0);
                        } else {
                            labelX = (((-((requireNonNull(Client.localPlayer).x / 32) | 0) + 2) | 0) + Math.imul((-Client.mapBuildBaseX + arrayAtI16(requireNonNull(WorldMapLabels.scene).x, i)) | 0, 4)) | 0;
                            sin = arrayAtI32(Pix3D.sinTable, angle);
                            sin = intDivide(Math.imul(256, sin), (256 + OrbitCamera.minimapZoom) | 0);
                            labelZ = (-((requireNonNull(Client.localPlayer).z / 32) | 0) + ((2 + Math.imul(4, (arrayAtI16(requireNonNull(WorldMapLabels.scene).z, i) + -Client.mapBuildBaseZ) | 0)) | 0)) | 0;
                            cos = arrayAtI32(Pix3D.cosTable, angle);
                            cos = intDivide(Math.imul(256, cos), (OrbitCamera.minimapZoom - -256) | 0);
                            screenX = (Math.imul(labelX, cos) + Math.imul(sin, labelZ)) >> 16;
                            font = Client.fontPlain11;
                        }
                        const screenY = (Math.imul(labelZ, cos) + -Math.imul(labelX, sin)) >> 16;
                        if (requireNonNull(WorldMapLabels.scene).size(i) === 1) {
                            font = Client.p12;
                        }

                        if (requireNonNull(WorldMapLabels.scene).size(i) === 2) {
                            font = Client.fontBold12;
                        }

                        if (glJar) screenX = (Math.imul(sin, labelZ) - -Math.imul(cos, labelX)) >> 16;
                        const text = arrayAtObj(requireNonNull(WorldMapLabels.scene).text, i);
                        const labelFont = requireNonNull(font);
                        const textWidth = labelFont.getParagraphWidth(text, 100);
                        screenX = (screenX - ((textWidth / 2) | 0)) | 0;
                        if ((-widget.width | 0) <= screenX && widget.width >= screenX && (-widget.height | 0) <= screenY && widget.height >= screenY) {
                            let colour = 16777215;
                            if (arrayAtI32(requireNonNull(WorldMapLabels.scene).colors, i) !== -1) {
                                colour = arrayAtI32(requireNonNull(WorldMapLabels.scene).colors, i);
                            }

                            if (!glActive()) {
                                Pix2D.setClipMask(widget.maskStarts, widget.maskWidths);
                            } else {
                                const mask = widget.GetGraphic(false);
                                if (mask !== null && !(mask instanceof glSprite())) throw new TypeError('ClassCastException: expected GlSprite');
                                glRaster().setClipMask(mask);
                            }
                            labelFont.drawParagraphAlpha(
                                arrayAtObj(requireNonNull(WorldMapLabels.scene).text, i),
                                (x + screenX - -((widget.width / 2) | 0)) | 0,
                                (((widget.height / 2) | 0) + ((y - screenY) | 0)) | 0,
                                textWidth,
                                50,
                                colour,
                                0,
                                256,
                                1,
                                0,
                                0
                            );
                            if (glActive()) {
                                glRaster().clearClipMask();
                            } else {
                                Pix2D.clearClipMask();
                            }
                        }
                    }
                }

                for (let i = 0; Client.activeMapFunctionCount > i; i++) {
                    const dx = glJar
                        ? (-((requireNonNull(Client.localPlayer).x / 32) | 0) + 2 + Math.imul(4, arrayAtI32(Client.activeMapFunctionX, i))) | 0
                        : (((2 + Math.imul(4, arrayAtI32(Client.activeMapFunctionX, i))) | 0) - ((requireNonNull(Client.localPlayer).x / 32) | 0)) | 0;
                    const dz = glJar
                        ? (-((requireNonNull(Client.localPlayer).z / 32) | 0) + 2 + Math.imul(arrayAtI32(Client.activeMapFunctionZ, i), 4)) | 0
                        : (Math.imul(arrayAtI32(Client.activeMapFunctionZ, i), 4) + ((2 - ((requireNonNull(Client.localPlayer).z / 32) | 0)) | 0)) | 0;
                    let type: LocType | null = LocType.List(arrayAtI32(MinimapBuilder.mapFunctionLocIds, i));
                    if (type.multi !== null) {
                        type = type.GetMultiLoc();
                        if (type === null || type.mapFunction === -1) {
                            continue;
                        }
                    }

                    Client.DrawDot(component, x, arrayAtObj(SpriteLoader.mapfunctionsRecoloured, type.mapFunction), true, dx, y, dz);
                }

                for (let tileX = 0; tileX < 104; tileX++) {
                    for (let tileZ = 0; tileZ < 104; tileZ++) {
                        const objs = arrayAtObj(arrayAtObj(arrayAtObj(Client.groundObj, Client.playerLevel), tileX), tileZ);
                        if (objs !== null) {
                            const dx = (((Math.imul(tileX, 4) + 2) | 0) + -((requireNonNull(Client.localPlayer).x / 32) | 0)) | 0;
                            const dz = (-((requireNonNull(Client.localPlayer).z / 32) | 0) + ((Math.imul(4, tileZ) + 2) | 0)) | 0;
                            Client.DrawDot(component, x, arrayAtObj(Client.imageMapdots, 0), true, dx, y, dz);
                        }
                    }
                }

                for (let i = 0; Client.npcCount > i; i++) {
                    const npc = arrayAtObj(Client.npcs, arrayAtI32(Client.npcIds, i));
                    if (npc !== null && npc.isVisible()) {
                        let type = npc.npcType;
                        if (type !== null && type.multi !== null) {
                            type = type.GetMultiNpc();
                        }

                        if (type !== null && type.drawMapDot && type.interactive) {
                            const dx = (((npc.x / 32) | 0) - ((requireNonNull(Client.localPlayer).x / 32) | 0)) | 0;
                            const dz = (-((requireNonNull(Client.localPlayer).z / 32) | 0) + ((npc.z / 32) | 0)) | 0;
                            if (type.mapIcon === -1) {
                                Client.DrawDot(component, x, arrayAtObj(Client.imageMapdots, 1), true, dx, y, dz);
                            } else {
                                Client.DrawDot(component, x, arrayAtObj(SpriteLoader.mapfunctionsRecoloured, type.mapIcon), true, dx, y, dz);
                            }
                        }
                    }
                }

                for (let i = 0; i < ReceivePlayerPositions.m_lastNum; i++) {
                    const player = arrayAtObj(Client.players, arrayAtI32(ReceivePlayerPositions.m_lastID, i));
                    if (player !== null && player.isVisible()) {
                        const dx = (((player.x / 32) | 0) + -((requireNonNull(Client.localPlayer).x / 32) | 0)) | 0;
                        const dz = (((player.z / 32) | 0) - ((requireNonNull(Client.localPlayer).z / 32) | 0)) | 0;
                        let friend = false;
                        const name37 = requireNonNull(player.username).toBase37();
                        for (let j = 0; Client.friendCount > j; j++) {
                            if (arrayAtB64(Client.friendName37, j) === name37 && arrayAtI32(Client.friendWorld, j) !== 0) {
                                friend = true;
                                break;
                            }
                        }

                        let clan = false;
                        for (let j = 0; FriendChatChannel.memberCount > j; j++) {
                            if (name37 === requireNonNull(arrayAtObj(FriendChatChannel.members, j)).key) {
                                clan = true;
                                break;
                            }
                        }

                        let team = false;
                        if (requireNonNull(Client.localPlayer).team !== 0 && player.team !== 0 && requireNonNull(Client.localPlayer).team === player.team) {
                            team = true;
                        }

                        if (friend) {
                            Client.DrawDot(component, x, arrayAtObj(Client.imageMapdots, 3), true, dx, y, dz);
                        } else if (clan) {
                            Client.DrawDot(component, x, arrayAtObj(Client.imageMapdots, 5), true, dx, y, dz);
                        } else if (team) {
                            Client.DrawDot(component, x, arrayAtObj(Client.imageMapdots, 4), true, dx, y, dz);
                        } else {
                            Client.DrawDot(component, x, arrayAtObj(Client.imageMapdots, 2), true, dx, y, dz);
                        }
                    }
                }

                const arrows = Client.hintArrows;
                for (let i = 0; arrows.length > i; i++) {
                    const arrow = arrayAtObj(arrows, i);
                    if (arrow === null || arrow.type === 0 || Client.loopCycle % 20 >= 10) {
                        continue;
                    }

                    if (arrow.type === 1 && arrow.actor >= 0 && arrow.actor < Client.npcs.length) {
                        const npc = arrayAtObj(Client.npcs, arrow.actor);
                        if (npc !== null) {
                            const dx = (-((requireNonNull(Client.localPlayer).x / 32) | 0) + ((npc.x / 32) | 0)) | 0;
                            const dz = (-((requireNonNull(Client.localPlayer).z / 32) | 0) + ((npc.z / 32) | 0)) | 0;
                            Client.DrawArrow(component, dx, dz, y, x, arrow.icon);
                        }
                    }

                    if (arrow.type === 2) {
                        let dx: number, dz: number;
                        if (glJar) {
                            dx = (Math.imul(-Client.mapBuildBaseX + arrow.x, 4) + 2 - ((requireNonNull(Client.localPlayer).x / 32) | 0)) | 0;
                            dz = (-((requireNonNull(Client.localPlayer).z / 32) | 0) + 2 + Math.imul(-Client.mapBuildBaseZ + arrow.z, 4)) | 0;
                        } else {
                            dz = (((Math.imul((arrow.z + -Client.mapBuildBaseZ) | 0, 4) - -2) | 0) - ((requireNonNull(Client.localPlayer).z / 32) | 0)) | 0;
                            dx = (((2 + Math.imul((arrow.x - Client.mapBuildBaseX) | 0, 4)) | 0) - ((requireNonNull(Client.localPlayer).x / 32) | 0)) | 0;
                        }
                        Client.DrawArrow(component, dx, dz, y, x, arrow.icon);
                    }

                    if (arrow.type === 10 && arrow.actor >= 0 && arrow.actor < Client.players.length) {
                        const player = arrayAtObj(Client.players, arrow.actor);
                        if (player !== null) {
                            const dz = (((player.z / 32) | 0) - ((requireNonNull(Client.localPlayer).z / 32) | 0)) | 0;
                            const dx = (((player.x / 32) | 0) - ((requireNonNull(Client.localPlayer).x / 32) | 0)) | 0;
                            Client.DrawArrow(component, dx, dz, y, x, arrow.icon);
                        }
                    }
                }

                if (Client.destinationX !== 0) {
                    const dx = (Math.imul(Client.destinationX, 4) - ((-2 - -((requireNonNull(Client.localPlayer).x / 32) | 0)) | 0)) | 0;
                    const dz = glJar ? (2 + Math.imul(4, Client.destinationZ) - ((requireNonNull(Client.localPlayer).z / 32) | 0)) | 0 : (-((requireNonNull(Client.localPlayer).z / 32) | 0) + ((2 + Math.imul(4, Client.destinationZ)) | 0)) | 0;
                    Client.DrawDot(component, x, Client.imageMapflag, true, dx, y, dz);
                }

                if (!glActive()) {
                    Pix2D.fillRect((x - ((-((widget.width / 2) | 0) - -1) | 0)) | 0, (-1 + ((((widget.height / 2) | 0) + y) | 0)) | 0, 3, 3, 16777215);
                } else {
                    glRaster().fillRect((-1 + ((x - -((widget.width / 2) | 0)) | 0)) | 0, (-1 + y - -((widget.height / 2) | 0)) | 0, 3, 3, 16777215);
                }
            }

            arrayPutObj(InterfaceList.rectangleRedraw, index, true);
        } catch (error) {
            if (!glJar || !isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'ed.B(' + index + ',59,' + y + ',' + x + ',' + (component === null ? 'null' : '{...}') + ')');
        }
    }

    // ke.a(ILaj;III)V. NXT Minimap::CompassDraw (projects/osclient/minimap/Minimap.cpp:1127), drawn by lf.a for client
    // code 1339 after aj.a(I)Z (IfType.GetMask) succeeds. lf.a always passes 3 for the third argument, but it is kept:
    // it is the operand of the `3 > ki.R` test (NXT: m_toggle < 3), not a dummy with a guard.
    // HD mj.a(IILbe;IB)V: the 3 is inlined (`3 <= wb.d`) and the trailing byte is a dummy; its caller passes 59, so the
    // leading `!= 59` return never runs. While tf.w is set it first clips to the component with GlRaster, draws the
    // compass cf (GlSprite) through the component's own graphic (be.a(BZ)Lqf;, cast to cf) as the mask, and draws that
    // graphic in place of the black span fill.
    static CompassDraw(index: number, component: IfType | null, minimapStateLimit: number, x: number, y: number): void {
        try {
            if (glActive()) {
                glRaster().setClipping(x, y, (requireNonNull(component).width + x) | 0, (requireNonNull(component).height + y) | 0);
            }
            if ((glJar ? 3 : minimapStateLimit) > Client.minimapState) {
                if (glActive()) {
                    const compass = Client.imageCompass;
                    const GlSprite = glSprite();
                    if (compass !== null && !(compass instanceof GlSprite)) throw new TypeError('ClassCastException: expected GlSprite');
                    const widget = requireNonNull(component);
                    const width = widget.width;
                    const height = widget.height;
                    const anchorX = (requireNonNull(Client.imageCompass).width / 2) | 0;
                    const anchorY = (requireNonNull(Client.imageCompass).height / 2) | 0;
                    const yaw = OrbitCamera.followYaw;
                    const mask = widget.GetGraphic(false);
                    if (mask !== null && !(mask instanceof GlSprite)) throw new TypeError('ClassCastException: expected GlSprite');
                    requireNonNull(compass).drawRotatedMasked(x, y, width, height, anchorX, anchorY, yaw, 256, mask);
                } else {
                    const compass = Client.imageCompass;
                    if (compass !== null && !(compass instanceof Pix32)) throw new TypeError('ClassCastException: expected Pix32');
                    const widget = requireNonNull(component);
                    const width = widget.width;
                    const height = widget.height;
                    const anchorX = (requireNonNull(Client.imageCompass).width / 2) | 0;
                    const anchorY = (requireNonNull(Client.imageCompass).height / 2) | 0;
                    requireNonNull(compass).drawRotatedMasked(x, y, width, height, anchorX, anchorY, OrbitCamera.followYaw, 256, widget.maskStarts, widget.maskWidths);
                }
            } else if (!glActive()) {
                Pix2D.fillSpans(x, y, 0, requireNonNull(component).maskStarts, requireNonNull(component).maskWidths);
            } else {
                const graphic = requireNonNull(component).GetGraphic(false);
                if (graphic !== null) {
                    graphic.draw(x, y);
                }
            }

            arrayPutObj(InterfaceList.rectangleRedraw, index, true);
        } catch (error) {
            if (!glJar || !isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'mj.K(' + x + ',' + y + ',' + (component === null ? 'null' : '{...}') + ',' + index + ',59)');
        }
    }

    // vi.a(Ljb;IIIIII)Z. ig.a passes 23279 for the guard, selecting MSI group 34.
    static drawMapScene(type: LocType, z: number, x: number, angle: number, offsetZ = 0, offsetX = 0): boolean {
        try {
            const mapScene = MSITypeList.List(type.mapScene, 34);
            if (mapScene.m_spriteID === -1) return true;
            if (!type.msiRotate) angle = 0;
            else angle = (angle + type.msiAngle) & 3;
            const sprite = mapScene.GetSprite(angle);
            if (sprite === null) return false;
            let width = type.width;
            let length = type.length;
            if ((angle & 1) === 1) {
                length = type.width;
                width = type.length;
            }
            let drawWidth = sprite.cropW;
            let drawHeight = sprite.cropH;
            if (mapScene.m_resize) {
                drawHeight = Math.imul(4, length);
                drawWidth = Math.imul(4, width);
            }
            if (mapScene.m_tint === 0) {
                sprite.drawScaled((Math.imul(x, 4) + 48) | 0, (48 + Math.imul(104 - (z + length), 4)) | 0, drawWidth, drawHeight);
            } else {
                sprite.drawScaledTinted((48 + Math.imul(4, x)) | 0, (Math.imul(104 - (z + length), 4) + 48) | 0, drawWidth, drawHeight, mapScene.m_tint);
            }
            return true;
        } catch (error) {
            if (!glJar || !isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'cj.D(' + [x, type === null ? 'null' : '{...}', false, offsetZ, offsetX, z, angle].join(',') + ')');
        }
    }
}
