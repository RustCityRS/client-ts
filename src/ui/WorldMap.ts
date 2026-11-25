import LocType from '#/config/LocType';
import JagString, { fromLiteral, linkableInitStrings } from '#/datastruct/JagString';
import SharedPtrList from '#/datastruct/SharedPtrList';
import { arrayAtI16, arrayAtI32, arrayAtI8, arrayAtObj, arrayPutI32, requireNonNull } from '#/util/JavaArray';
import { doubleToInt, intDivide } from '#/util/IntUtils';
import type IfType from './IfType';
import MapArea from './MapArea';
import WorldMapLabels from './WorldMapLabels';
import type AbstractSprite from '#/graphics/AbstractSprite';
import Pix32 from '#/graphics/Pix32';
import WorldMapFont from '#/graphics/WorldMapFont';
import MapElementInstance from './MapElementInstance';
import Pix2D from '#/graphics/Pix2D';
import WrappedException from '#/util/WrappedException';
import { isJavaRuntimeException } from '#/util/JavaException';
import { releaseReferences } from '#/util/StaticReferences';
import LocalisedText from './LocalisedText';
import GameVariant from '#/client/GameVariant';
import Client from '#/client/Client';
import { glJar } from '#/client/ClientVariant';

import type Js5 from '#/cache/Js5';
import PacketT from '#/io/PacketT';
import FluType from '#/config/FluType';
import FloType from '#/config/FloType';
import MSITypeList from '#/config/MSITypeList';
import ClientBuild from '#/client/ClientBuild';
import GameShell from '#/client/GameShell';
import world from '#/dash3d/world';
import CollisionMap from '#/dash3d/CollisionMap';
import Pix3D from '#/dash3d/Pix3D';
import { mathRandom } from '#/util/JavaRandom';
import GlRenderer from '#/gl/GlRenderer';
import { loadGlRaster, loadGlSprite } from '#/util/GamepackClasses';

type MapChunks<T> = ((T | null)[] | null)[];

// eg.<init>(IZLjava/awt/Component;)V, supplied by the map font renderer.

// Java's new int[width][height][] allocates each row and leaves its chunks null.
function chunks<T>(width: number, height: number): (T | null)[][] {
    if (width < 0 || height < 0) throw new RangeError('Negative array size');
    return Array.from({ length: width }, () => new Array<T | null>(height).fill(null));
}

function putMapPixel(pixels: Int32Array | null, index: number, colour: number): void {
    if (!Pix2D.spanTarget?.paintPixel(pixels, index, colour)) arrayPutI32(pixels, index, colour);
}

export default class WorldMap {
    static detailsGroup = fromLiteral('details'); // ck.G:Lid;
    private static mapHue = glJar ? undefined : ((mathRandom.nextDouble() * 17.0) | 0) - 8;
    private static mapLightness = glJar ? undefined : ((mathRandom.nextDouble() * 33.0) | 0) - 16;
    // SD cg.i:I, HD kd.rb:I. kd also holds the hitmarks sprite group.
    static get hueOffset(): number {
        return (WorldMap.mapHue ??= ((mathRandom.nextDouble() * 17.0) | 0) - 8);
    }
    static set hueOffset(value: number) {
        if (WorldMap.mapHue === undefined) void WorldMap.hueOffset;
        WorldMap.mapHue = value;
    }
    // SD ok.q:I, HD vk.h:I. vk also holds the game variant.
    static get randomLightness(): number {
        return (WorldMap.mapLightness ??= ((mathRandom.nextDouble() * 33.0) | 0) - 16);
    }
    static set randomLightness(value: number) {
        if (WorldMap.mapLightness === undefined) void WorldMap.randomLightness;
        WorldMap.mapLightness = value;
    }
    static archive: Js5 | null = null; // he.y:Lal;
    static mapFunctions: (Pix32 | null)[] | null = null; // oe.y:[Lrh;
    static disabled: boolean[] | null = null; // gl.w:[Z
    static current: MapArea | null = null; // rk.h:Lgh;
    static sceneArea: MapArea | null = null; // jh.k:Lgh;
    // mc.a(I[Lrh;Lal;)V
    static init(sprites: (Pix32 | null)[] | null, archive: Js5 | null): void {
        this.archive = archive;
        this.mapFunctions = sprites;
        this.disabled = new Array<boolean>(requireNonNull(this.mapFunctions).length).fill(false);
        MapArea.areas.clear();
        const group = requireNonNull(this.archive).GetGroupId(MapArea.details);
        const files = requireNonNull(requireNonNull(this.archive).GetFileList(group));
        for (const file of files) MapArea.areas.push_back(MapArea.decode(new PacketT(requireNonNull(this.archive).GetFile(file, group))));
    }

    // uj.a(BLid;)V
    static select(name: JagString | null): void {
        for (let area = MapArea.areas.head(); area !== null; area = MapArea.areas.next()) {
            if (requireNonNull(area.groupName).equals(name)) {
                this.current = area;
                return;
            }
        }
    }

    // ki.e(I)Lgh;
    static getCurrent(): MapArea | null {
        return this.current;
    }

    static readonly lineBreak = fromLiteral('<br>'); // bc.f:Lid;
    static readonly fpsLabel = fromLiteral('Fps:'); // d.f:Lid;
    static readonly memLabel = fromLiteral('Mem:'); // u.f:Lid;
    static readonly memSuffix = linkableInitStrings.memSuffix; // we.t:Lid;
    static readonly space = fromLiteral(' '); // ai.c:Lid;
    static readonly empty = fromLiteral(''); // ec.q:Lid;
    static readonly teleportCommand = fromLiteral('::tele '); // qc.L:Lid;
    static readonly comma = fromLiteral(')1'); // ff.E:Lid;
    static labels: WorldMapLabels | null = null; // jg.t:Lkc;
    static previousMap: JagString | null = null; // ph.d:Lid;
    static component: IfType | null = null; // mf.h:Laj;
    static overview: AbstractSprite | null = null; // gh.M:Lvc;
    static viewportImage: Pix32 | null = null; // HD mc.S:Lmm;
    static icons = new SharedPtrList<MapElementInstance>(); // rf.v:Lgk;
    static deferredIcons: SharedPtrList<MapElementInstance> | null = new SharedPtrList<MapElementInstance>(); // ad.a:Lgk;
    static progress = 0; // sa.w:I
    static baseX = 0; // oi.a:I
    static baseZ = 0; // od.P:I
    static width = 0; // ki.db:I
    static height = 0; // ml.m:I
    static centerX = 0; // c.C:I
    static centerZ = 0; // sg.b:I
    static displayWidth = 0; // vb.f:I
    static displayHeight = 0; // uj.d:I
    static viewTop = 0; // cl.w:I
    static viewMinX = 0; // rc.g:I
    static labelLines = new Array<JagString | null>(5).fill(null); // sa.A:[Lid;
    static targetX = -1; // e.f:I
    static targetZ = -1; // qi.S:I
    static zoom = 0; // hd.h:F
    static targetZoom = 0; // ug.f:F
    static flashTicks = 0; // hd.n:I
    static flashCount = 0; // hh.sb:I
    static flashingIcon = 0; // ij.l:I
    static dragging = 0; // sb.e:I
    static dragStartX = 0; // we.q:I
    static dragStartZ = 0; // nl.db:I
    static underlayColors: MapChunks<Int32Array> | null = null; // tb.w:[[[I
    static wallTypes: MapChunks<Int8Array> | null = null; // hh.ob:[[[B
    static upperOverlayIds: MapChunks<Int8Array> | null = null; // hc.f:[[[B
    static upperOverlayShapes: MapChunks<Int8Array> | null = null; // fl.g:[[[B
    static overlayShapes: MapChunks<Int8Array> | null = null; // mg.o:[[[B
    static overlayIds: MapChunks<Int8Array> | null = null; // af.J:[[[B
    static mapScenes: MapChunks<Int32Array> | null = null; // ai.a:[[[I
    static locIds: MapChunks<Int32Array> | null = null; // qj.L:[[[I
    static overlayColors: Int32Array | null = null; // pa.wb:[I
    // eg bitmap fonts rasterized by the host in eight point sizes.
    static font11: WorldMapFont | null = null; // lk.E:Leg;
    static font12: WorldMapFont | null = null; // ig.y:Leg;
    static font14: WorldMapFont | null = null; // ia.k:Leg;
    static font17: WorldMapFont | null = null; // rb.b:Leg;
    static font19: WorldMapFont | null = null; // qa.T:Leg;
    static font22: WorldMapFont | null = null; // t.Y:Leg;
    static font26: WorldMapFont | null = null; // ml.Q:Leg;
    static font30: WorldMapFont | null = null; // hj.j:Leg;

    // gk.a(IIIZIII[IIII)V
    static drawLocShape(foreground: number, shape: number, width: number, fillBackground: boolean, background: number, x: number, rotation: number, pixels: Int32Array | null, height: number, y: number): void {
        try {
            let left = x;
            if (x >= Pix2D.clipMaxX) return;
            if (x < Pix2D.clipMinX) left = Pix2D.clipMinX;
            let right = (width + x) | 0;
            if (Pix2D.clipMinX >= right) return;
            if (right > Pix2D.clipMaxX) right = Pix2D.clipMaxX;
            let top = y;
            if (y >= Pix2D.clipMaxY) return;
            let bottom = (y + height) | 0;
            if (Pix2D.clipMinY > y) top = Pix2D.clipMinY;
            if (bottom <= Pix2D.clipMinY) return;
            if (Pix2D.clipMaxY < bottom) bottom = Pix2D.clipMaxY;
            bottom = (bottom - y) | 0;
            if (shape === 9) {
                shape = 1;
                rotation = (1 + rotation) & 3;
            }
            if (shape === 10) {
                rotation = (3 + rotation) & 3;
                shape = 1;
            }
            if (shape === 11) {
                shape = 8;
                rotation = (3 + rotation) & 3;
            }
            const rowSkip = (left + Pix2D.width - right) | 0;
            let index = (Math.imul(Pix2D.width, top) + left) | 0;
            right = (right - x) | 0;
            left = (left - x) | 0;
            const reverseXEnd = (width - right) | 0;
            const reverseYEnd = (height - bottom) | 0;
            top = (top - y) | 0;
            const reverseXStart = (width - left - 1) | 0;
            const reverseYStart = (height - top - 1) | 0;
            if (shape === 1) {
                if (rotation === 0) {
                    for (let row = top; row < bottom; row = (row + 1) | 0) {
                        for (let column = left; column < right; column = (column + 1) | 0) {
                            if (column <= row) putMapPixel(pixels, index, foreground);
                            else if (fillBackground) putMapPixel(pixels, index, background);
                            index = (index + 1) | 0;
                        }
                        index = (index + rowSkip) | 0;
                    }
                    return;
                }
                if (rotation === 1) {
                    for (let row = reverseYStart; row >= reverseYEnd; row = (row - 1) | 0) {
                        for (let column = left; column < right; column = (column + 1) | 0) {
                            if (column <= row) putMapPixel(pixels, index, foreground);
                            else if (fillBackground) putMapPixel(pixels, index, background);
                            index = (index + 1) | 0;
                        }
                        index = (index + rowSkip) | 0;
                    }
                    return;
                }
                if (rotation === 2) {
                    for (let row = top; row < bottom; row = (row + 1) | 0) {
                        for (let column = left; column < right; column = (column + 1) | 0) {
                            if (column >= row) putMapPixel(pixels, index, foreground);
                            else if (fillBackground) putMapPixel(pixels, index, background);
                            index = (index + 1) | 0;
                        }
                        index = (index + rowSkip) | 0;
                    }
                    return;
                }
                if (rotation === 3) {
                    for (let row = reverseYStart; row >= reverseYEnd; row = (row - 1) | 0) {
                        for (let column = left; column < right; column = (column + 1) | 0) {
                            if (column >= row) putMapPixel(pixels, index, foreground);
                            else if (fillBackground) putMapPixel(pixels, index, background);
                            index = (index + 1) | 0;
                        }
                        index = (index + rowSkip) | 0;
                    }
                    return;
                }
            }
            if (shape === 2) {
                if (rotation === 0) {
                    for (let row = reverseYStart; row >= reverseYEnd; row = (row - 1) | 0) {
                        for (let column = left; column < right; column = (column + 1) | 0) {
                            if (column <= row >> 1) putMapPixel(pixels, index, foreground);
                            else if (fillBackground) putMapPixel(pixels, index, background);
                            index = (index + 1) | 0;
                        }
                        index = (index + rowSkip) | 0;
                    }
                    return;
                }
                if (rotation === 1) {
                    for (let row = top; row < bottom; row = (row + 1) | 0) {
                        for (let column = left; column < right; column = (column + 1) | 0) {
                            if (index < 0 || requireNonNull(pixels).length <= index) {
                                index = (index + 1) | 0;
                                continue;
                            }
                            if (column >= row << 1) putMapPixel(pixels, index, foreground);
                            else if (fillBackground) putMapPixel(pixels, index, background);
                            index = (index + 1) | 0;
                        }
                        index = (index + rowSkip) | 0;
                    }
                    return;
                }
                if (rotation === 2) {
                    for (let row = top; row < bottom; row = (row + 1) | 0) {
                        for (let column = reverseXStart; column >= reverseXEnd; column = (column - 1) | 0) {
                            if (column <= row >> 1) putMapPixel(pixels, index, foreground);
                            else if (fillBackground) putMapPixel(pixels, index, background);
                            index = (index + 1) | 0;
                        }
                        index = (index + rowSkip) | 0;
                    }
                    return;
                }
                if (rotation === 3) {
                    for (let row = reverseYStart; row >= reverseYEnd; row = (row - 1) | 0) {
                        for (let column = reverseXStart; column >= reverseXEnd; column = (column - 1) | 0) {
                            if (column >= row << 1) putMapPixel(pixels, index, foreground);
                            else if (fillBackground) putMapPixel(pixels, index, background);
                            index = (index + 1) | 0;
                        }
                        index = (index + rowSkip) | 0;
                    }
                    return;
                }
            }
            if (shape === 3) {
                if (rotation === 0) {
                    for (let row = reverseYStart; row >= reverseYEnd; row = (row - 1) | 0) {
                        for (let column = reverseXStart; column >= reverseXEnd; column = (column - 1) | 0) {
                            if (column <= row >> 1) putMapPixel(pixels, index, foreground);
                            else if (fillBackground) putMapPixel(pixels, index, background);
                            index = (index + 1) | 0;
                        }
                        index = (index + rowSkip) | 0;
                    }
                    return;
                }
                if (rotation === 1) {
                    for (let row = reverseYStart; row >= reverseYEnd; row = (row - 1) | 0) {
                        for (let column = left; column < right; column = (column + 1) | 0) {
                            if (column >= row << 1) putMapPixel(pixels, index, foreground);
                            else if (fillBackground) putMapPixel(pixels, index, background);
                            index = (index + 1) | 0;
                        }
                        index = (index + rowSkip) | 0;
                    }
                    return;
                }
                if (rotation === 2) {
                    for (let row = top; row < bottom; row = (row + 1) | 0) {
                        for (let column = left; column < right; column = (column + 1) | 0) {
                            if (column <= row >> 1) putMapPixel(pixels, index, foreground);
                            else if (fillBackground) putMapPixel(pixels, index, background);
                            index = (index + 1) | 0;
                        }
                        index = (index + rowSkip) | 0;
                    }
                    return;
                }
                if (rotation === 3) {
                    for (let row = top; row < bottom; row = (row + 1) | 0) {
                        for (let column = reverseXStart; column >= reverseXEnd; column = (column - 1) | 0) {
                            if (column >= row << 1) putMapPixel(pixels, index, foreground);
                            else if (fillBackground) putMapPixel(pixels, index, background);
                            index = (index + 1) | 0;
                        }
                        index = (index + rowSkip) | 0;
                    }
                    return;
                }
            }
            if (shape === 4) {
                if (rotation === 0) {
                    for (let row = reverseYStart; row >= reverseYEnd; row = (row - 1) | 0) {
                        for (let column = left; column < right; column = (column + 1) | 0) {
                            if (column >= row >> 1) putMapPixel(pixels, index, foreground);
                            else if (fillBackground) putMapPixel(pixels, index, background);
                            index = (index + 1) | 0;
                        }
                        index = (index + rowSkip) | 0;
                    }
                    return;
                }
                if (rotation === 1) {
                    for (let row = top; row < bottom; row = (row + 1) | 0) {
                        for (let column = left; column < right; column = (column + 1) | 0) {
                            if (column <= row << 1) putMapPixel(pixels, index, foreground);
                            else if (fillBackground) putMapPixel(pixels, index, background);
                            index = (index + 1) | 0;
                        }
                        index = (index + rowSkip) | 0;
                    }
                    return;
                }
                if (rotation === 2) {
                    for (let row = top; row < bottom; row = (row + 1) | 0) {
                        for (let column = reverseXStart; column >= reverseXEnd; column = (column - 1) | 0) {
                            if (column >= row >> 1) putMapPixel(pixels, index, foreground);
                            else if (fillBackground) putMapPixel(pixels, index, background);
                            index = (index + 1) | 0;
                        }
                        index = (index + rowSkip) | 0;
                    }
                    return;
                }
                if (rotation === 3) {
                    for (let row = reverseYStart; row >= reverseYEnd; row = (row - 1) | 0) {
                        for (let column = reverseXStart; column >= reverseXEnd; column = (column - 1) | 0) {
                            if (column <= row << 1) putMapPixel(pixels, index, foreground);
                            else if (fillBackground) putMapPixel(pixels, index, background);
                            index = (index + 1) | 0;
                        }
                        index = (index + rowSkip) | 0;
                    }
                    return;
                }
            }
            if (shape === 5) {
                if (rotation === 0) {
                    for (let row = reverseYStart; row >= reverseYEnd; row = (row - 1) | 0) {
                        for (let column = reverseXStart; column >= reverseXEnd; column = (column - 1) | 0) {
                            if (column >= row >> 1) putMapPixel(pixels, index, foreground);
                            else if (fillBackground) putMapPixel(pixels, index, background);
                            index = (index + 1) | 0;
                        }
                        index = (index + rowSkip) | 0;
                    }
                    return;
                }
                if (rotation === 1) {
                    for (let row = reverseYStart; row >= reverseYEnd; row = (row - 1) | 0) {
                        for (let column = left; column < right; column = (column + 1) | 0) {
                            if (column <= row << 1) putMapPixel(pixels, index, foreground);
                            else if (fillBackground) putMapPixel(pixels, index, background);
                            index = (index + 1) | 0;
                        }
                        index = (index + rowSkip) | 0;
                    }
                    return;
                }
                if (rotation === 2) {
                    for (let row = top; row < bottom; row = (row + 1) | 0) {
                        for (let column = left; column < right; column = (column + 1) | 0) {
                            if (column >= row >> 1) putMapPixel(pixels, index, foreground);
                            else if (fillBackground) putMapPixel(pixels, index, background);
                            index = (index + 1) | 0;
                        }
                        index = (index + rowSkip) | 0;
                    }
                    return;
                }
                if (rotation === 3) {
                    for (let row = top; row < bottom; row = (row + 1) | 0) {
                        for (let column = reverseXStart; column >= reverseXEnd; column = (column - 1) | 0) {
                            if (column <= row << 1) putMapPixel(pixels, index, foreground);
                            else if (fillBackground) putMapPixel(pixels, index, background);
                            index = (index + 1) | 0;
                        }
                        index = (index + rowSkip) | 0;
                    }
                    return;
                }
            }
            if (shape === 6) {
                if (rotation === 0) {
                    for (let row = top; row < bottom; row = (row + 1) | 0) {
                        for (let column = left; column < right; column = (column + 1) | 0) {
                            if (column <= ((width / 2) | 0)) putMapPixel(pixels, index, foreground);
                            else if (fillBackground) putMapPixel(pixels, index, background);
                            index = (index + 1) | 0;
                        }
                        index = (index + rowSkip) | 0;
                    }
                    return;
                }
                if (rotation === 1) {
                    for (let row = top; row < bottom; row = (row + 1) | 0) {
                        for (let column = left; column < right; column = (column + 1) | 0) {
                            if (row <= ((height / 2) | 0)) putMapPixel(pixels, index, foreground);
                            else if (fillBackground) putMapPixel(pixels, index, background);
                            index = (index + 1) | 0;
                        }
                        index = (index + rowSkip) | 0;
                    }
                    return;
                }
                if (rotation === 2) {
                    for (let row = top; row < bottom; row = (row + 1) | 0) {
                        for (let column = left; column < right; column = (column + 1) | 0) {
                            if (column >= ((width / 2) | 0)) putMapPixel(pixels, index, foreground);
                            else if (fillBackground) putMapPixel(pixels, index, background);
                            index = (index + 1) | 0;
                        }
                        index = (index + rowSkip) | 0;
                    }
                    return;
                }
                if (rotation === 3) {
                    for (let row = top; row < bottom; row = (row + 1) | 0) {
                        for (let column = left; column < right; column = (column + 1) | 0) {
                            if (row >= ((height / 2) | 0)) putMapPixel(pixels, index, foreground);
                            else if (fillBackground) putMapPixel(pixels, index, background);
                            index = (index + 1) | 0;
                        }
                        index = (index + rowSkip) | 0;
                    }
                    return;
                }
            }
            if (shape === 7) {
                if (rotation === 0) {
                    for (let row = top; row < bottom; row = (row + 1) | 0) {
                        for (let column = left; column < right; column = (column + 1) | 0) {
                            if (column <= ((row - ((height / 2) | 0)) | 0)) putMapPixel(pixels, index, foreground);
                            else if (fillBackground) putMapPixel(pixels, index, background);
                            index = (index + 1) | 0;
                        }
                        index = (index + rowSkip) | 0;
                    }
                    return;
                }
                if (rotation === 1) {
                    for (let row = reverseYStart; row >= reverseYEnd; row = (row - 1) | 0) {
                        for (let column = left; column < right; column = (column + 1) | 0) {
                            if (column <= ((row - ((height / 2) | 0)) | 0)) putMapPixel(pixels, index, foreground);
                            else if (fillBackground) putMapPixel(pixels, index, background);
                            index = (index + 1) | 0;
                        }
                        index = (index + rowSkip) | 0;
                    }
                    return;
                }
                if (rotation === 2) {
                    for (let row = reverseYStart; row >= reverseYEnd; row = (row - 1) | 0) {
                        for (let column = reverseXStart; column >= reverseXEnd; column = (column - 1) | 0) {
                            if (column <= ((row - ((height / 2) | 0)) | 0)) putMapPixel(pixels, index, foreground);
                            else if (fillBackground) putMapPixel(pixels, index, background);
                            index = (index + 1) | 0;
                        }
                        index = (index + rowSkip) | 0;
                    }
                    return;
                }
                if (rotation === 3) {
                    for (let row = top; row < bottom; row = (row + 1) | 0) {
                        for (let column = reverseXStart; column >= reverseXEnd; column = (column - 1) | 0) {
                            if (column <= ((row - ((height / 2) | 0)) | 0)) putMapPixel(pixels, index, foreground);
                            else if (fillBackground) putMapPixel(pixels, index, background);
                            index = (index + 1) | 0;
                        }
                        index = (index + rowSkip) | 0;
                    }
                    return;
                }
            }
            if (shape === 8) {
                if (rotation === 0) {
                    for (let row = top; row < bottom; row = (row + 1) | 0) {
                        for (let column = left; column < right; column = (column + 1) | 0) {
                            if (column >= ((row - ((height / 2) | 0)) | 0)) putMapPixel(pixels, index, foreground);
                            else if (fillBackground) putMapPixel(pixels, index, background);
                            index = (index + 1) | 0;
                        }
                        index = (index + rowSkip) | 0;
                    }
                    return;
                }
                if (rotation === 1) {
                    for (let row = reverseYStart; row >= reverseYEnd; row = (row - 1) | 0) {
                        for (let column = left; column < right; column = (column + 1) | 0) {
                            if (column >= ((row - ((height / 2) | 0)) | 0)) putMapPixel(pixels, index, foreground);
                            else if (fillBackground) putMapPixel(pixels, index, background);
                            index = (index + 1) | 0;
                        }
                        index = (index + rowSkip) | 0;
                    }
                    return;
                }
                if (rotation === 2) {
                    for (let row = reverseYStart; row >= reverseYEnd; row = (row - 1) | 0) {
                        for (let column = reverseXStart; column >= reverseXEnd; column = (column - 1) | 0) {
                            if (column >= ((row - ((height / 2) | 0)) | 0)) putMapPixel(pixels, index, foreground);
                            else if (fillBackground) putMapPixel(pixels, index, background);
                            index = (index + 1) | 0;
                        }
                        index = (index + rowSkip) | 0;
                    }
                    return;
                }
                if (rotation === 3) {
                    for (let row = top; row < bottom; row = (row + 1) | 0) {
                        for (let column = reverseXStart; column >= reverseXEnd; column = (column - 1) | 0) {
                            if (column >= ((row - ((height / 2) | 0)) | 0)) putMapPixel(pixels, index, foreground);
                            else if (fillBackground) putMapPixel(pixels, index, background);
                            index = (index + 1) | 0;
                        }
                        index = (index + rowSkip) | 0;
                    }
                    return;
                }
            }
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            if (glJar) throw WrappedException.wrap(error, 'wl.C(' + [pixels === null ? 'null' : '{...}', foreground, x, rotation, background, shape, height, width, y, fillBackground, 21].join(',') + ')');
            throw WrappedException.wrap(error, 'gk.K(' + foreground + ',' + shape + ',' + width + ',' + fillBackground + ',' + background + ',' + x + ',' + rotation + ',' + (pixels === null ? 'null' : '{...}') + ',' + height + ',0,' + y + ')');
        }
    }

    // pf.a(ZB)V
    static Reset(remember: boolean): void {
        if (glJar) {
            // HD jb.a(IZ)V, including the software backing image of wa.a's GL viewport.
            this.overlayShapes = null;
            this.locIds = null;
            this.component = null;
            this.overlayIds = null;
            this.overlayColors = null;
            this.upperOverlayShapes = null;
            this.previousMap = remember && this.current !== null ? this.current.groupName : null;
            this.wallTypes = null;
            this.upperOverlayIds = null;
            this.mapScenes = null;
            this.underlayColors = null;
            this.progress = 0;
            this.current = null;
            this.icons.clear();
            this.labels = null;
            this.targetZ = -1;
            this.font22 = null;
            this.font30 = null;
            this.font12 = null;
            this.font26 = null;
            this.font11 = null;
            this.font14 = null;
            this.font17 = null;
            this.font19 = null;
            this.overview = null;
            this.targetX = -1;
            this.viewportImage = null;
            return;
        }
        this.locIds = null;
        this.previousMap = remember && this.current !== null ? this.current.groupName : null;
        this.overlayIds = null;
        this.current = null;
        this.upperOverlayShapes = null;
        this.underlayColors = null;
        this.overlayShapes = null;
        this.overlayColors = null;
        this.progress = 0;
        this.mapScenes = null;
        this.upperOverlayIds = null;
        this.wallTypes = null;
        this.component = null;
        this.icons.clear();
        this.targetX = -1;
        this.font14 = null;
        this.font12 = null;
        this.font11 = null;
        this.labels = null;
        this.targetZ = -1;
        this.font22 = null;
        this.font17 = null;
        this.font30 = null;
        this.overview = null;
        this.font26 = null;
        this.font19 = null;
    }

    // e.a(IIIIIIIIIII)V. mj.a always passes 30079 for the obfuscator guard.
    static drawMapFunctions(scaleY: number, offsetX: number, top: number, right: number, screenX: number, left: number, offsetY: number, bottom: number, scaleX: number, screenY: number): void {
        try {
            const width = (right - left) | 0;
            const height = (bottom - top) | 0;
            const marginX = intDivide(983040, scaleX);
            let alpha = -1;
            const marginY = intDivide(983040, scaleY);
            if (this.flashCount > 0) {
                alpha = this.flashTicks > 10 ? (50 - Math.imul(this.flashTicks - 10, 5)) | 0 : Math.imul(5, this.flashTicks);
            }
            for (let x = -marginX | 0; x < ((width + marginX) | 0); x = (x + 1) | 0) {
                const nextX = (Math.imul(x + 1, scaleX) + offsetX) >> 16;
                let px = (offsetX + Math.imul(scaleX, x)) >> 16;
                if (((nextX - px) | 0) <= 0) continue;
                px = (px + screenX) | 0;
                const chunkX = (left + x) >> 6;
                if (chunkX < 0 || chunkX >= requireNonNull(this.locIds).length) continue;
                const column = arrayAtObj(this.locIds, chunkX);
                for (let y = -marginY | 0; y < ((marginY + height) | 0); y = (y + 1) | 0) {
                    let py = (Math.imul(y, scaleY) + offsetY) >> 16;
                    const nextY = (offsetY + Math.imul(scaleY, y + 1)) >> 16;
                    if (((nextY - py) | 0) <= 0) continue;
                    py = (py + screenY) | 0;
                    const chunkY = (top + y) >> 6;
                    if (chunkY < 0 || chunkY >= requireNonNull(column).length || arrayAtObj(column, chunkY) === null) continue;
                    const index = (((top + y) << 6) & 0xfc0) + ((x + left) & 63);
                    const encoded = arrayAtI32(arrayAtObj(column, chunkY), index);
                    if (encoded === 0) continue;
                    const loc = LocType.List((encoded - 1) | 0);
                    if (arrayAtObj(this.disabled, loc.mapFunction)) continue;
                    if (alpha !== -1 && loc.mapFunction === this.flashingIcon) {
                        const icon = new MapElementInstance();
                        icon.mapFunction = loc.mapFunction;
                        icon.x = px;
                        icon.z = py;
                        requireNonNull(this.deferredIcons).push_back(icon);
                    } else {
                        const sprite = arrayAtObj(this.mapFunctions, loc.mapFunction);
                        requireNonNull(sprite).draw((px - 7) | 0, (py - 7) | 0);
                    }
                }
            }
            for (let icon = requireNonNull(this.deferredIcons).head(); icon !== null; icon = requireNonNull(this.deferredIcons).next()) {
                if (!(icon instanceof MapElementInstance)) throw new TypeError('ClassCastException: mi');
                Pix2D.fillCircleTrans(icon.x, icon.z, 15, 0xffff00, alpha);
                Pix2D.fillCircleTrans(icon.x, icon.z, 13, 0xffff00, alpha);
                Pix2D.fillCircleTrans(icon.x, icon.z, 11, 0xffff00, alpha);
                Pix2D.fillCircleTrans(icon.x, icon.z, 9, 0xffff00, alpha);
                const sprite = arrayAtObj(this.mapFunctions, icon.mapFunction);
                const x = (icon.x - 7) | 0,
                    y = (icon.z - 7) | 0;
                requireNonNull(sprite).draw(x, y);
            }
            requireNonNull(this.deferredIcons).clear();
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(
                error,
                glJar ? 'sm.B(' + [screenX, bottom, right, scaleY, left, offsetX, offsetY, 127, scaleX, top, screenY].join(',') + ')' : 'e.C(' + [scaleY, 30079, offsetX, top, right, screenX, left, offsetY, bottom, scaleX, screenY].join(',') + ')'
            );
        }
    }

    // mj.a(IIBIIIIII)V
    static drawScaled(screenY: number, left: number, screenRight: number, bottom: number, top: number, right: number, screenBottom: number, screenX: number): void {
        try {
            const width = (right - left) | 0,
                height = (bottom - top) | 0;
            const scaleX = intDivide((screenRight - screenX) << 16, width);
            const scaleY = intDivide((screenBottom - screenY) << 16, height);
            this.drawMapFunctions(scaleY, 0, top, right, screenX, left, 0, bottom, scaleX, screenY);
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(
                error,
                glJar ? 'dl.B(' + [screenRight, screenX, right, bottom, screenBottom, screenY, 1, left, top].join(',') + ')' : 'mj.A(' + [screenY, left, 97, screenRight, bottom, top, right, screenBottom, screenX].join(',') + ')'
            );
        }
    }

    // ik.a(IIIIIIIBI)V. ah.a supplies -127 for the opaque division at return.
    static drawLabels(x: number, left: number, top: number, rightX: number, bottomY: number, bottom: number, right: number, y: number, hdGuard = -100): void {
        try {
            for (let i = 0; i < requireNonNull(this.labels).count; i++) {
                if (!requireNonNull(this.labels).hasFlag8(i)) continue;
                const z = (this.height - (1 - (-arrayAtI16(requireNonNull(this.labels).z, i) + this.baseZ))) | 0;
                let py = (intDivide(Math.imul(z - top, bottomY - y), (bottom - top) | 0) + y) | 0;
                const mapX = (-this.baseX + arrayAtI16(requireNonNull(this.labels).x, i)) | 0;
                let colour = 0xffffff;
                const px = (x + intDivide(Math.imul(mapX - left, rightX - x), (right - left) | 0)) | 0;
                const size = requireNonNull(this.labels).size(i);
                let font: WorldMapFont | null = null;
                if (size === 0) {
                    if (this.zoom === 3) font = this.font11;
                    if (this.zoom === 4) font = this.font12;
                    if (this.zoom === 6) font = this.font14;
                    if (this.zoom >= 8) font = this.font17;
                }
                if (size === 1) {
                    if (this.zoom === 3) font = this.font14;
                    if (this.zoom === 4) font = this.font17;
                    if (this.zoom === 6) font = this.font19;
                    if (this.zoom >= 8) font = this.font22;
                }
                if (size === 2) {
                    if (this.zoom === 3) font = this.font19;
                    colour = 0xffaa00;
                    if (this.zoom === 4) font = this.font22;
                    if (this.zoom === 6) font = this.font26;
                    if (this.zoom >= 8) font = this.font30;
                }
                if (arrayAtI32(requireNonNull(this.labels).colors, i) !== -1) colour = arrayAtI32(requireNonNull(this.labels).colors, i);
                if (font === null) continue;
                const splitter = Client.fontPlain11,
                    text = arrayAtObj(requireNonNull(this.labels).text, i),
                    output = this.labelLines;
                const lines = requireNonNull(splitter).splitParagraph(text, null, output);
                py = (py - intDivide(Math.imul(font.getLineHeight(), lines - 1), 2)) | 0;
                py = (py + intDivide(font.getBaseline(), 2)) | 0;
                for (let line = 0; line < lines; line++) {
                    const label = arrayAtObj(this.labelLines, line);
                    if (line < lines - 1) {
                        const trimmed = requireNonNull(label);
                        const length = (trimmed.getLength() - 4) | 0;
                        trimmed.setLength(length);
                    }
                    font.drawStringCentered(label, px, py, colour, true);
                    py = (py + font.getLineHeight()) | 0;
                }
            }
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, glJar ? 'cn.B(' + [hdGuard, x, y, left, rightX, bottom, top, right, bottomY].join(',') + ')' : 'ik.F(' + [x, left, top, rightX, bottomY, bottom, right, -127, y].join(',') + ')');
        }
    }

    // SD ah.a(IIIII)V (scale 2) / HD wa.a(IIIII)V (guard 64).
    static draw(y: number, scale: number, x: number, height: number, width: number): void {
        try {
            if (this.progress < 100) this.step(true);
            const renderer = glJar ? GlRenderer : null;
            const glRaster = glJar ? loadGlRaster() : null;
            (renderer?.active ? requireNonNull(glRaster) : Pix2D).setClipping(x, y, (x + width) | 0, (height + y) | 0);
            if (this.progress < 100) {
                const center = (x + intDivide(width, 2)) | 0;
                const barY = (y + intDivide(height, 2) - 20 - 18) | 0;
                const raster = renderer?.active ? requireNonNull(glRaster) : Pix2D;
                raster.fillRect(x, y, width, height, 0);
                raster.drawRect((center - 152) | 0, barY, 304, 34, 9179409);
                raster.drawRect((center - 151) | 0, (barY + 1) | 0, 302, 32, 0);
                raster.fillRect((center - 150) | 0, (barY + 2) | 0, Math.imul(this.progress, 3), 30, 9179409);
                raster.fillRect((center - 150 + Math.imul(this.progress, 3)) | 0, (barY + 2) | 0, (300 - Math.imul(3, this.progress)) | 0, 30, 0);
                const font = Client.fontBold12,
                    text = LocalisedText.LOADINGDOTDOTDOT;
                requireNonNull(font).drawCentred(text, center, (barY + 20) | 0, 0xffffff, -1);
                return;
            }
            let left: number, top: number, right: number, bottom: number;
            if (glJar) {
                this.displayHeight = doubleToInt(Math.fround(Math.fround(Math.imul(height, 2)) / this.zoom));
                this.viewMinX = (this.centerX - doubleToInt(Math.fround(Math.fround(width) / this.zoom))) | 0;
                left = (-doubleToInt(Math.fround(Math.fround(width) / this.zoom)) + this.centerX) | 0;
                top = (this.centerZ - doubleToInt(Math.fround(Math.fround(height) / this.zoom))) | 0;
                this.viewTop = (this.centerZ - doubleToInt(Math.fround(Math.fround(height) / this.zoom))) | 0;
                bottom = (this.centerZ + doubleToInt(Math.fround(Math.fround(height) / this.zoom))) | 0;
                right = (doubleToInt(Math.fround(Math.fround(width) / this.zoom)) + this.centerX) | 0;
            } else {
                this.displayHeight = doubleToInt(Math.fround(Math.fround(Math.imul(height, scale)) / this.zoom));
                this.viewTop = (-doubleToInt(Math.fround(Math.fround(height) / this.zoom)) + this.centerZ) | 0;
                left = (this.centerX - doubleToInt(Math.fround(Math.fround(width) / this.zoom))) | 0;
                this.viewMinX = (-doubleToInt(Math.fround(Math.fround(width) / this.zoom)) + this.centerX) | 0;
                top = (-doubleToInt(Math.fround(Math.fround(height) / this.zoom)) + this.centerZ) | 0;
                right = (doubleToInt(Math.fround(Math.fround(width) / this.zoom)) + this.centerX) | 0;
                bottom = (this.centerZ + doubleToInt(Math.fround(Math.fround(height) / this.zoom))) | 0;
            }
            this.displayWidth = doubleToInt(Math.fround(Math.fround(Math.imul(2, width)) / this.zoom));
            if (renderer?.active) {
                if (this.viewportImage === null || this.viewportImage.width !== width || this.viewportImage.height !== height) {
                    this.viewportImage = null;
                    this.viewportImage = new Pix32(width, height);
                }
                Pix2D.setPixels(this.viewportImage.pixels, width, height);
                this.drawTilesHd(width, 0, 0, right, top, 0, bottom, height, left);
                this.drawScaled(0, left, width, bottom, top, right, height, 0);
                this.drawLabels(0, left, top, width, height, bottom, right, 0, -54);
                requireNonNull(glRaster).drawPixels(requireNonNull(this.viewportImage).pixels, x, y, width, height);
                Pix2D.pixels = null;
            } else {
                if (glJar) this.drawTilesHd((x + width) | 0, y, 0, right, top, x, bottom, (height + y) | 0, left);
                else this.drawTiles((x + width) | 0, top, right, (y + height) | 0, bottom, left, y, x, -91);
                this.drawScaled(y, left, (width + x) | 0, bottom, top, right, (height + y) | 0, x);
                this.drawLabels(x, left, top, (width + x) | 0, (height + y) | 0, bottom, right, y);
            }
            if (this.flashCount > 0) {
                this.flashTicks = (this.flashTicks - 1) | 0;
                if (this.flashTicks === 0) {
                    if (!glJar) this.flashCount = (this.flashCount - 1) | 0;
                    this.flashTicks = 20;
                    if (glJar) this.flashCount = (this.flashCount - 1) | 0;
                }
            }
            if (Client.displayFps) {
                const debugX = (x + width - 5) | 0;
                let debugY = (y + height - 8) | 0;
                let colour = 0xffff00;
                const font = Client.p12,
                    fps = JagString.join([this.fpsLabel, JagString.fromInt(GameShell.m_fps)]);
                requireNonNull(font).drawRight(fps, debugX, debugY, 0xffff00, -1);
                const used = Client.usedMemoryKb();
                debugY = (debugY - 15) | 0;
                if (used > 65536) colour = 0xff0000;
                const memoryFont = Client.p12,
                    parts = [this.memLabel, JagString.fromInt(used), this.memSuffix];
                // s.a([Lid;I)Lid; returns null when this call's scale-derived guard exceeds -90.
                const text = !glJar && (scale ^ -116) > -90 ? null : JagString.join(parts);
                requireNonNull(memoryFont).drawRight(text, debugX, debugY, colour, -1);
            }
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, glJar ? 'wa.FA(' + [x, 64, y, height, width].join(',') + ')' : 'ah.D(' + [y, scale, x, height, width].join(',') + ')');
        }
    }

    // SD oc.a(IBIII)V and HD a.a(IIIII)V. A resized HD overview publishes a GL sprite.
    static drawOverview(x: number, y: number, height: number, width: number): void {
        try {
            const renderer = glJar ? GlRenderer : null;
            const glRaster = glJar ? loadGlRaster() : null;
            const raster = renderer?.active ? requireNonNull(glRaster) : Pix2D;
            raster.setClipping(x, y, (x + width) | 0, (y + height) | 0);
            raster.fillRect(x, y, width, height, 0);
            if (this.progress < 100) return;
            if (this.overview === null || width !== this.overview.width || height !== this.overview.height) {
                const sprite = new Pix32(width, height);
                Pix2D.setPixels(sprite.pixels, width, height);
                if (glJar) this.drawTilesHd(width, 0, 0, this.width, 0, 0, this.height, height, 0);
                else this.drawTiles(width, 0, this.width, height, this.height, 0, 0, 0, -70);
                if (renderer?.active) this.overview = new (loadGlSprite())(sprite);
                else this.overview = sprite;
                if (renderer?.active) Pix2D.pixels = null;
                else requireNonNull(GameShell.drawArea).bind();
            }
            requireNonNull(this.overview).drawOpaque(x, y);
            const top = (intDivide(Math.imul(this.viewTop, height), this.height) + y) | 0;
            let left: number, viewWidth: number, viewHeight: number;
            if (glJar) {
                viewHeight = intDivide(Math.imul(this.displayHeight, height), this.height);
                left = (x + intDivide(Math.imul(width, this.viewMinX), this.width)) | 0;
                viewWidth = intDivide(Math.imul(width, this.displayWidth), this.width);
            } else {
                viewWidth = intDivide(Math.imul(width, this.displayWidth), this.width);
                left = (x + intDivide(Math.imul(width, this.viewMinX), this.width)) | 0;
                viewHeight = intDivide(Math.imul(height, this.displayHeight), this.height);
            }
            const colour = GameVariant.id === 1 ? 0xffffff : 0xff0000;
            const viewportRaster = renderer?.active ? requireNonNull(glRaster) : Pix2D;
            viewportRaster.fillRectTrans(left, top, viewWidth, viewHeight, colour, 128);
            viewportRaster.drawRect(left, top, viewWidth, viewHeight, colour);
            if (this.flashCount > 0) {
                const alpha = this.flashTicks > 10 ? (500 - Math.imul(25, this.flashTicks)) | 0 : Math.imul(this.flashTicks, 25);
                for (let icon = requireNonNull(this.icons).head(); icon !== null; icon = requireNonNull(this.icons).next()) {
                    if (!(icon instanceof MapElementInstance)) throw new TypeError('ClassCastException: mi');
                    if (this.flashingIcon === icon.mapFunction) {
                        let px: number, py: number;
                        if (glJar) {
                            py = (y + intDivide(Math.imul(icon.z, height), this.height)) | 0;
                            px = (x + intDivide(Math.imul(width, icon.x), this.width)) | 0;
                        } else {
                            px = (x + intDivide(Math.imul(width, icon.x), this.width)) | 0;
                            py = (y + intDivide(Math.imul(icon.z, height), this.height)) | 0;
                        }
                        (renderer?.active ? requireNonNull(glRaster) : Pix2D).fillRectTrans((px - 2) | 0, (py - 2) | 0, 4, 4, 0xffff00, alpha);
                    }
                }
            }
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, glJar ? 'a.D(' + [x, height, width, 19481, y].join(',') + ')' : 'oc.E(' + [x, 20, y, height, width].join(',') + ')');
        }
    }

    // SD wb.f(I)V, HD af.b(B)V
    static reload(state: number): void {
        try {
            this.Reset(false);
            globalThis.gc?.();
            Client.SetMainState(glJar ? 25 : state);
        } catch (error) {
            if (!glJar || !isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'af.D(-86)');
        }
    }

    // qg.b(IZ)V
    static SetZoomLevel(zoom: number): void {
        this.targetZ = -1;
        if (zoom === 37) this.targetZoom = 3;
        else if (zoom === 50) this.targetZoom = 4;
        else if (zoom === 75) this.targetZoom = 6;
        else if (zoom === 100) this.targetZoom = 8;
        else if (zoom === 200) this.targetZoom = 16;
        this.targetZ = -1;
    }

    // gi.b(I)I
    static GetZoomLevel(): number {
        if (this.targetZoom === 3) return 37;
        if (this.targetZoom === 4) return 50;
        if (this.targetZoom === 6) return 75;
        return this.targetZoom === 8 ? 100 : 200;
    }

    // jf.a(IIIIIIIIB)V
    static drawTiles(right: number, mapMinZ: number, mapMaxX: number, bottom: number, mapMaxZ: number, mapMinX: number, top: number, left: number, guard: number): void {
        try {
            const width = (mapMaxX - mapMinX) | 0;
            if (guard >= -47) LocalisedText.englishStarted3dLibrary = null;
            const height = (mapMaxZ - mapMinZ) | 0;
            const scaleX = intDivide((right - left) << 16, width);
            const scaleZ = intDivide((bottom - top) << 16, height);
            WorldMap.renderArea(mapMaxX, scaleZ, mapMinZ, left, 0xffffff, mapMinX, 0, top, mapMaxZ, scaleX, 0);
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'jf.AC(' + [right, mapMinZ, mapMaxX, bottom, mapMaxZ, mapMinX, top, left, guard].join(',') + ')');
        }
    }

    // HD rg.a(IIIIIIIII)V
    static drawTilesHd(right: number, top: number, offsetZ: number, mapMaxX: number, mapMinZ: number, left: number, mapMaxZ: number, bottom: number, mapMinX: number): void {
        try {
            const width = (mapMaxX - mapMinX) | 0;
            const scaleX = intDivide((right - left) << 16, width);
            const height = (mapMaxZ - mapMinZ) | 0;
            const scaleZ = intDivide((bottom - top) << 16, height);
            WorldMap.renderAreaHd(top, 0, mapMaxZ, mapMinZ, mapMaxX, left, mapMinX, scaleZ, scaleX, offsetZ, -12541);
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'rg.SA(' + [right, top, offsetZ, mapMaxX, mapMinZ, left, mapMaxZ, bottom, mapMinX].join(',') + ')');
        }
    }

    // ob.a(IIIIIIIIIII)V
    static renderArea(mapMaxX: number, scaleZ: number, mapMinZ: number, left: number, guard: number, mapMinX: number, offsetZ: number, top: number, mapMaxZ: number, scaleX: number, offsetX: number): void {
        try {
            let height = (mapMaxZ - mapMinZ) | 0;
            if (mapMaxZ < WorldMap.height) height = (height + 1) | 0;
            let width = (mapMaxX - mapMinX) | 0;
            if (mapMaxX < WorldMap.width) width = (width + 1) | 0;
            if (guard !== 0xffffff) world.AddDynamic(-97, 43, 13, -107, 123, null, 4, -121n, true);
            for (let dx = 0; dx < width; dx = (dx + 1) | 0) {
                let x0 = (offsetX + Math.imul(dx, scaleX)) >> 16;
                let x1 = (Math.imul(dx + 1, scaleX) + offsetX) >> 16;
                const w = (x1 - x0) | 0;
                if (w <= 0) continue;
                const chunkX = (mapMinX + dx) >> 6;
                if (chunkX < 0 || chunkX >= requireNonNull(WorldMap.underlayColors).length) {
                    x1 = (x1 + left) | 0;
                    x0 = (x0 + left) | 0;
                    for (let dz = 0; dz < height; dz = (dz + 1) | 0) {
                        let colour =
                            requireNonNull(WorldMap.current).background === -1
                                ? ((mapMinX + dx) & 4) !== ((dz + mapMinZ) & 4)
                                    ? 4936552
                                    : arrayAtI32(WorldMap.overlayColors, (FloType.m_defaultWater + 1) | 0)
                                : requireNonNull(WorldMap.current).background;
                        if (colour === 0) colour = 1;
                        const y0 = (((Math.imul(dz, scaleZ) + offsetZ) >> 16) + top) | 0;
                        const y1 = (top + ((offsetZ + Math.imul(scaleZ, dz + 1)) >> 16)) | 0;
                        Pix2D.fillRect(x0, y0, w, (y1 - y0) | 0, colour);
                    }
                    continue;
                }
                x1 = (x1 + left) | 0;
                const underlays = arrayAtObj(WorldMap.underlayColors, chunkX);
                x0 = (x0 + left) | 0;
                const overlays = arrayAtObj(WorldMap.overlayIds, chunkX);
                const upper = arrayAtObj(WorldMap.upperOverlayIds, chunkX);
                const shapes = arrayAtObj(WorldMap.overlayShapes, chunkX);
                const upperShapes = arrayAtObj(WorldMap.upperOverlayShapes, chunkX);
                const walls = arrayAtObj(WorldMap.wallTypes, chunkX);
                for (let dz = 0; dz < height; dz = (dz + 1) | 0) {
                    let y0 = (Math.imul(scaleZ, dz) + offsetZ) >> 16;
                    let y1 = (offsetZ + Math.imul(dz + 1, scaleZ)) >> 16;
                    const h = (y1 - y0) | 0;
                    if (h <= 0) continue;
                    const chunkZ = (mapMinZ + dz) >> 6;
                    y0 = (y0 + top) | 0;
                    y1 = (y1 + top) | 0;
                    const tile = ((dx + mapMinX) & 63) + (((mapMinZ + dz) & 63) << 6);
                    let ground: number;
                    if (chunkZ < 0 || chunkZ >= requireNonNull(underlays).length || arrayAtObj(underlays, chunkZ) === null) {
                        if (requireNonNull(WorldMap.current).background !== -1) {
                            ground = requireNonNull(WorldMap.current).background;
                        } else if (((mapMinX + dx) & 4) === ((mapMinZ + dz) & 4)) {
                            ground = arrayAtI32(WorldMap.overlayColors, (1 + FloType.m_defaultWater) | 0);
                        } else {
                            ground = 4936552;
                        }
                        if (chunkZ < 0 || chunkZ >= requireNonNull(underlays).length) {
                            if (ground === 0) ground = 1;
                            Pix2D.fillRect(x0, y0, w, h, ground);
                            continue;
                        }
                    } else ground = arrayAtI32(arrayAtObj(underlays, chunkZ), tile);
                    if (ground === 0) ground = 1;
                    let upperColour = arrayAtObj(upper, chunkZ) === null ? 0 : arrayAtI32(WorldMap.overlayColors, arrayAtI8(arrayAtObj(upper, chunkZ), tile) & 255);
                    let colour = arrayAtObj(overlays, chunkZ) !== null ? arrayAtI32(WorldMap.overlayColors, arrayAtI8(arrayAtObj(overlays, chunkZ), tile) & 255) : 0;
                    if (colour === 0 && upperColour === 0) Pix2D.fillRect(x0, y0, w, h, ground);
                    else {
                        if (colour !== 0) {
                            if (colour === -1) colour = 1;
                            const shape = arrayAtObj(shapes, chunkZ) === null ? 0 : arrayAtI8(arrayAtObj(shapes, chunkZ), tile);
                            if ((shape & 252) !== 0 && w > 1 && h > 1) WorldMap.drawLocShape(colour, (shape & 252) >> 2, w, true, ground, x0, shape & 3, Pix2D.pixels, h, y0);
                            else Pix2D.fillRect(x0, y0, w, h, colour);
                        }
                        if (upperColour !== 0) {
                            if (upperColour === -1) upperColour = ground;
                            const upperShape = arrayAtI8(arrayAtObj(upperShapes, chunkZ), tile);
                            if ((upperShape & 252) === 0 || w <= 1 || h <= 1) Pix2D.fillRect(x0, y0, w, h, upperColour);
                            WorldMap.drawLocShape(upperColour, (upperShape & 252) >> 2, w, colour === 0, 0, x0, upperShape & 3, Pix2D.pixels, h, y0);
                        }
                    }
                    if (arrayAtObj(walls, chunkZ) === null) continue;
                    let wall = arrayAtI8(arrayAtObj(walls, chunkZ), tile) & 255;
                    if (wall === 0) continue;
                    const endX = w === 1 ? x0 : (x1 - 1) | 0;
                    let wallColour = 0xcccccc;
                    const endY = h !== 1 ? (y1 - 1) | 0 : y0;
                    if ((wall >= 5 && wall <= 8) || (wall >= 13 && wall <= 16) || (wall >= 21 && wall <= 24) || wall === 27 || wall === 28) {
                        wallColour = 0xcc0000;
                        wall -= 4;
                    }
                    switch (wall) {
                        case 1:
                            Pix2D.vline(x0, y0, h, wallColour);
                            break;
                        case 2:
                            Pix2D.hline(x0, y0, w, wallColour);
                            break;
                        case 3:
                            Pix2D.vline(endX, y0, h, wallColour);
                            break;
                        case 4:
                            Pix2D.hline(x0, endY, w, wallColour);
                            break;
                        case 9:
                            Pix2D.vline(x0, y0, h, 0xffffff);
                            Pix2D.hline(x0, y0, w, wallColour);
                            break;
                        case 10:
                            Pix2D.vline(endX, y0, h, 0xffffff);
                            Pix2D.hline(x0, y0, w, wallColour);
                            break;
                        case 11:
                            Pix2D.vline(endX, y0, h, 0xffffff);
                            Pix2D.hline(x0, endY, w, wallColour);
                            break;
                        case 12:
                            Pix2D.vline(x0, y0, h, 0xffffff);
                            Pix2D.hline(x0, endY, w, wallColour);
                            break;
                        case 17:
                            Pix2D.hline(x0, y0, 1, wallColour);
                            break;
                        case 18:
                            Pix2D.hline(endX, y0, 1, wallColour);
                            break;
                        case 19:
                            Pix2D.hline(endX, endY, 1, wallColour);
                            break;
                        case 20:
                            Pix2D.hline(x0, endY, 1, wallColour);
                            break;
                        case 25:
                            for (let i = 0; i < h; i++) Pix2D.hline((i + x0) | 0, (endY - i) | 0, 1, wallColour);
                            break;
                        case 26:
                            for (let i = 0; i < h; i++) Pix2D.hline((i + x0) | 0, (y0 + i) | 0, 1, wallColour);
                            break;
                    }
                }
            }
            for (let dx = -2; dx < ((width + 2) | 0); dx = (dx + 1) | 0) {
                let x0 = (Math.imul(scaleX, dx) + offsetX) >> 16;
                let x1 = (Math.imul(scaleX, dx + 1) + offsetX) >> 16;
                const w = (x1 - x0) | 0;
                if (w <= 0) continue;
                x1 = (x1 + left) | 0;
                const chunkX = (dx + mapMinX) >> 6;
                x0 = (x0 + left) | 0;
                if (chunkX < 0 || chunkX >= requireNonNull(WorldMap.mapScenes).length) continue;
                const scenes = arrayAtObj(WorldMap.mapScenes, chunkX);
                for (let dz = -2; dz < ((height + 2) | 0); dz = (dz + 1) | 0) {
                    let y0 = (Math.imul(scaleZ, dz) + offsetZ) >> 16;
                    let y1 = (Math.imul(scaleZ, dz + 1) + offsetZ) >> 16;
                    const h = (y1 - y0) | 0;
                    if (h <= 0) continue;
                    y0 = (y0 + top) | 0;
                    const chunkZ = (mapMinZ + dz) >> 6;
                    y1 = (y1 + top) | 0;
                    if (chunkZ < 0 || chunkZ >= requireNonNull(scenes).length) continue;
                    const tile = ((dx + mapMinX) & 63) + (((mapMinZ + dz) & 63) << 6);
                    if (arrayAtObj(scenes, chunkZ) === null) continue;
                    const packed = arrayAtI32(arrayAtObj(scenes, chunkZ), tile);
                    const id = packed & 0x3fff;
                    if (id === 0) continue;
                    const type = MSITypeList.List(id - 1, 34);
                    const rotation = (packed >> 14) & 3;
                    const sprite = type.GetSprite(rotation);
                    if (sprite === null) continue;
                    let sh = intDivide(Math.imul(sprite.height, h), 4);
                    let sw = intDivide(Math.imul(w, sprite.width), 4);
                    if (type.m_resize) {
                        const sizeX = (packed >> 16) & 15,
                            sizeZ = (packed >> 20) & 15;
                        sw = Math.imul(rotation & 1 ? sizeZ : sizeX, w);
                        sh = Math.imul(rotation & 1 ? sizeX : sizeZ, h);
                    }
                    if (sw === 0 || sh === 0) continue;
                    if (type.m_tint === 0) sprite.drawScaled(x0, (h + y0 - sh) | 0, sw, sh);
                    else sprite.drawScaledTinted(x0, (y0 + h - sh) | 0, sw, sh, type.m_tint);
                }
            }
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'ob.G(' + [mapMaxX, scaleZ, mapMinZ, left, guard, mapMinX, offsetZ, top, mapMaxZ, scaleX, offsetX].join(',') + ')');
        }
    }

    // HD le.a(IIIIIIIIIII)V
    static renderAreaHd(top: number, offsetX: number, mapMaxZ: number, mapMinZ: number, mapMaxX: number, left: number, mapMinX: number, scaleZ: number, scaleX: number, offsetZ: number, guard: number): void {
        try {
            let width = (mapMaxX - mapMinX) | 0;
            let height = (mapMaxZ - mapMinZ) | 0;
            if (WorldMap.width > mapMaxX) width = (width + 1) | 0;
            if (WorldMap.height > mapMaxZ) height = (height + 1) | 0;
            if (guard !== -12541) Client.getWindowMode(-14);
            for (let dx = 0; dx < width; dx = (dx + 1) | 0) {
                let x0 = (offsetX + Math.imul(dx, scaleX)) >> 16;
                let x1 = (Math.imul(dx + 1, scaleX) + offsetX) >> 16;
                const w = (x1 - x0) | 0;
                if (w <= 0) continue;
                const chunkX = (mapMinX + dx) >> 6;
                if (chunkX < 0 || chunkX >= requireNonNull(WorldMap.underlayColors).length) {
                    x0 = (x0 + left) | 0;
                    for (let dz = 0; dz < height; dz = (dz + 1) | 0) {
                        let colour =
                            requireNonNull(WorldMap.current).background === -1
                                ? ((mapMinX + dx) & 4) !== ((dz + mapMinZ) & 4)
                                    ? 4936552
                                    : arrayAtI32(WorldMap.overlayColors, (FloType.m_defaultWater + 1) | 0)
                                : requireNonNull(WorldMap.current).background;
                        if (colour === 0) colour = 1;
                        const y0 = (((Math.imul(dz, scaleZ) + offsetZ) >> 16) + top) | 0;
                        const y1 = (top + ((offsetZ + Math.imul(scaleZ, dz + 1)) >> 16)) | 0;
                        Pix2D.fillRect(x0, y0, w, (y1 - y0) | 0, colour);
                    }
                    continue;
                }
                x0 = (x0 + left) | 0;
                const underlays = arrayAtObj(WorldMap.underlayColors, chunkX);
                const overlays = arrayAtObj(WorldMap.overlayIds, chunkX);
                const shapes = arrayAtObj(WorldMap.overlayShapes, chunkX);
                const walls = arrayAtObj(WorldMap.wallTypes, chunkX);
                const upperShapes = arrayAtObj(WorldMap.upperOverlayShapes, chunkX);
                x1 = (x1 + left) | 0;
                const upper = arrayAtObj(WorldMap.upperOverlayIds, chunkX);
                for (let dz = 0; dz < height; dz = (dz + 1) | 0) {
                    let y0 = (Math.imul(scaleZ, dz) + offsetZ) >> 16;
                    let y1 = (offsetZ + Math.imul(dz + 1, scaleZ)) >> 16;
                    const h = (y1 - y0) | 0;
                    if (h <= 0) continue;
                    y1 = (y1 + top) | 0;
                    const chunkZ = (mapMinZ + dz) >> 6;
                    y0 = (y0 + top) | 0;
                    const tile = ((dx + mapMinX) & 63) + (((mapMinZ + dz) & 63) << 6);
                    let ground: number;
                    if (chunkZ < 0 || chunkZ >= requireNonNull(underlays).length || arrayAtObj(underlays, chunkZ) === null) {
                        if (requireNonNull(WorldMap.current).background !== -1) {
                            ground = requireNonNull(WorldMap.current).background;
                        } else if (((mapMinX + dx) & 4) === ((mapMinZ + dz) & 4)) {
                            ground = arrayAtI32(WorldMap.overlayColors, (1 + FloType.m_defaultWater) | 0);
                        } else {
                            ground = 4936552;
                        }
                        if (chunkZ < 0 || chunkZ >= requireNonNull(underlays).length) {
                            if (ground === 0) ground = 1;
                            Pix2D.fillRect(x0, y0, w, h, ground);
                            continue;
                        }
                    } else ground = arrayAtI32(arrayAtObj(underlays, chunkZ), tile);
                    let colour = arrayAtObj(overlays, chunkZ) === null ? 0 : arrayAtI32(WorldMap.overlayColors, arrayAtI8(arrayAtObj(overlays, chunkZ), tile) & 255);
                    if (ground === 0) ground = 1;
                    let upperColour = arrayAtObj(upper, chunkZ) !== null ? arrayAtI32(WorldMap.overlayColors, arrayAtI8(arrayAtObj(upper, chunkZ), tile) & 255) : 0;
                    if (colour === 0 && upperColour === 0) Pix2D.fillRect(x0, y0, w, h, ground);
                    else {
                        if (colour !== 0) {
                            if (colour === -1) colour = 1;
                            const shape = arrayAtObj(shapes, chunkZ) === null ? 0 : arrayAtI8(arrayAtObj(shapes, chunkZ), tile);
                            if ((shape & 252) !== 0 && w > 1 && h > 1) WorldMap.drawLocShape(colour, (shape & 252) >> 2, w, true, ground, x0, shape & 3, Pix2D.pixels, h, y0);
                            else Pix2D.fillRect(x0, y0, w, h, colour);
                        }
                        if (upperColour !== 0) {
                            if (upperColour === -1) upperColour = ground;
                            const upperShape = arrayAtI8(arrayAtObj(upperShapes, chunkZ), tile);
                            if ((upperShape & 252) === 0 || w <= 1 || h <= 1) Pix2D.fillRect(x0, y0, w, h, upperColour);
                            WorldMap.drawLocShape(upperColour, (upperShape & 252) >> 2, w, colour === 0, 0, x0, upperShape & 3, Pix2D.pixels, h, y0);
                        }
                    }
                    if (arrayAtObj(walls, chunkZ) === null) continue;
                    let wall = arrayAtI8(arrayAtObj(walls, chunkZ), tile) & 255;
                    if (wall === 0) continue;
                    const endX = w === 1 ? x0 : (x1 - 1) | 0;
                    let wallColour = 0xcccccc;
                    const endY = h !== 1 ? (y1 - 1) | 0 : y0;
                    if ((wall >= 5 && wall <= 8) || (wall >= 13 && wall <= 16) || (wall >= 21 && wall <= 24) || wall === 27 || wall === 28) {
                        wallColour = 0xcc0000;
                        wall -= 4;
                    }
                    switch (wall) {
                        case 1:
                            Pix2D.vline(x0, y0, h, wallColour);
                            break;
                        case 2:
                            Pix2D.hline(x0, y0, w, wallColour);
                            break;
                        case 3:
                            Pix2D.vline(endX, y0, h, wallColour);
                            break;
                        case 4:
                            Pix2D.hline(x0, endY, w, wallColour);
                            break;
                        case 9:
                            Pix2D.vline(x0, y0, h, 0xffffff);
                            Pix2D.hline(x0, y0, w, wallColour);
                            break;
                        case 10:
                            Pix2D.vline(endX, y0, h, 0xffffff);
                            Pix2D.hline(x0, y0, w, wallColour);
                            break;
                        case 11:
                            Pix2D.vline(endX, y0, h, 0xffffff);
                            Pix2D.hline(x0, endY, w, wallColour);
                            break;
                        case 12:
                            Pix2D.vline(x0, y0, h, 0xffffff);
                            Pix2D.hline(x0, endY, w, wallColour);
                            break;
                        case 17:
                            Pix2D.hline(x0, y0, 1, wallColour);
                            break;
                        case 18:
                            Pix2D.hline(endX, y0, 1, wallColour);
                            break;
                        case 19:
                            Pix2D.hline(endX, endY, 1, wallColour);
                            break;
                        case 20:
                            Pix2D.hline(x0, endY, 1, wallColour);
                            break;
                        case 25:
                            for (let i = 0; i < h; i++) Pix2D.hline((i + x0) | 0, (endY - i) | 0, 1, wallColour);
                            break;
                        case 26:
                            for (let i = 0; i < h; i++) Pix2D.hline((i + x0) | 0, (y0 + i) | 0, 1, wallColour);
                            break;
                    }
                }
            }
            for (let dx = -2; dx < ((width + 2) | 0); dx = (dx + 1) | 0) {
                let x0 = (Math.imul(scaleX, dx) + offsetX) >> 16;
                let x1 = (Math.imul(scaleX, dx + 1) + offsetX) >> 16;
                const w = (x1 - x0) | 0;
                if (w <= 0) continue;
                x0 = (x0 + left) | 0;
                const chunkX = (dx + mapMinX) >> 6;
                x1 = (x1 + left) | 0;
                if (chunkX < 0 || chunkX >= requireNonNull(WorldMap.mapScenes).length) continue;
                const scenes = arrayAtObj(WorldMap.mapScenes, chunkX);
                for (let dz = -2; dz < ((height + 2) | 0); dz = (dz + 1) | 0) {
                    let y1 = (Math.imul(scaleZ, dz + 1) + offsetZ) >> 16;
                    let y0 = (Math.imul(scaleZ, dz) + offsetZ) >> 16;
                    const h = (y1 - y0) | 0;
                    if (h <= 0) continue;
                    y0 = (y0 + top) | 0;
                    const chunkZ = (mapMinZ + dz) >> 6;
                    y1 = (y1 + top) | 0;
                    if (chunkZ < 0 || chunkZ >= requireNonNull(scenes).length) continue;
                    const tile = ((dx + mapMinX) & 63) + (((mapMinZ + dz) & 63) << 6);
                    if (arrayAtObj(scenes, chunkZ) === null) continue;
                    const packed = arrayAtI32(arrayAtObj(scenes, chunkZ), tile);
                    const id = packed & 0x3fff;
                    if (id === 0) continue;
                    const rotation = (packed & 0xd228) >>> 14;
                    const type = MSITypeList.List(id - 1, 34);
                    const sprite = type.GetSprite(rotation);
                    if (sprite === null) continue;
                    let sh = intDivide(Math.imul(sprite.height, h), 4);
                    let sw = intDivide(Math.imul(w, sprite.width), 4);
                    if (type.m_resize) {
                        const sizeX = (packed >> 16) & 15,
                            sizeZ = (packed >> 20) & 15;
                        sw = Math.imul(rotation & 1 ? sizeZ : sizeX, w);
                        sh = Math.imul(rotation & 1 ? sizeX : sizeZ, h);
                    }
                    if (sw === 0 || sh === 0) continue;
                    if (type.m_tint === 0) sprite.drawScaled(x0, (h + y0 - sh) | 0, sw, sh);
                    else sprite.drawScaledTinted(x0, (y0 + h - sh) | 0, sw, sh, type.m_tint);
                }
            }
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'le.C(' + [top, offsetX, mapMaxZ, mapMinZ, mapMaxX, left, mapMinX, scaleZ, scaleX, offsetZ, guard].join(',') + ')');
        }
    }

    // ci.a(BI)V
    static SetMapElementFlashing(icon: number): void {
        this.flashTicks = 20;
        this.flashCount = 3;
        this.flashingIcon = icon;
    }

    // SD uh.a(III)V, HD gf.a(BII)V.
    static target(z: number, x: number, hd = glJar): void {
        if (hd) {
            try {
                this.targetX = (x - this.baseX) | 0;
                const left = (-doubleToInt(Math.fround(Math.fround(requireNonNull(this.component).width) / this.zoom)) + this.targetX) | 0;
                const right = (this.targetX + doubleToInt(Math.fround(Math.fround(requireNonNull(this.component).width) / this.zoom))) | 0;
                if (left < 0) this.targetX = doubleToInt(Math.fround(Math.fround(requireNonNull(this.component).width) / this.zoom));
                this.targetZ = (this.height + this.baseZ - z - 1) | 0;
                const bottom = (doubleToInt(Math.fround(Math.fround(requireNonNull(this.component).height) / this.zoom)) + this.targetZ) | 0;
                const top = (this.targetZ - doubleToInt(Math.fround(Math.fround(requireNonNull(this.component).height) / this.zoom))) | 0;
                if (right > this.width) this.targetX = (this.width - doubleToInt(Math.fround(Math.fround(requireNonNull(this.component).width) / this.zoom))) | 0;
                if (top < 0) this.targetZ = doubleToInt(Math.fround(Math.fround(requireNonNull(this.component).height) / this.zoom));
                if (bottom > this.height) this.targetZ = (this.height - doubleToInt(Math.fround(Math.fround(requireNonNull(this.component).height) / this.zoom))) | 0;
            } catch (error) {
                if (!isJavaRuntimeException(error)) throw error;
                throw WrappedException.wrap(error, 'gf.E(86,' + x + ',' + z + ')');
            }
            return;
        }
        this.targetX = (x - this.baseX) | 0;
        const component = requireNonNull(this.component);
        const halfWidth = doubleToInt(Math.fround(Math.fround(component.width) / this.zoom));
        const left = (this.targetX - halfWidth) | 0;
        this.targetZ = (this.height - z - 1 + this.baseZ) | 0;
        const halfHeight = doubleToInt(Math.fround(Math.fround(component.height) / this.zoom));
        const top = (this.targetZ - halfHeight) | 0;
        const right = (this.targetX + halfWidth) | 0;
        if (left < 0) this.targetX = halfWidth;
        if (this.width < right) this.targetX = (this.width - halfWidth) | 0;
        const bottom = (this.targetZ + halfHeight) | 0;
        if (top < 0) this.targetZ = halfHeight;
        if (bottom > this.height) this.targetZ = (this.height - halfHeight) | 0;
    }

    // SD ta.a(Lid;I)I, HD ni.a(ILna;)I.
    static findLabel(prefix: JagString | null, hd = glJar): number {
        try {
            if (this.labels !== null && requireNonNull(prefix).length !== 0) {
                for (let i = 0; i < this.labels.count; i++) {
                    if (requireNonNull(arrayAtObj(this.labels.text, i)).replace(WorldMapLabels.lineBreakTag, this.space).startsWithIgnoreCase(requireNonNull(prefix))) return i;
                }
            }
            return -1;
        } catch (error) {
            if (!hd || !isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'ni.G(0,' + (prefix === null ? 'null' : '{...}') + ')');
        }
    }

    // SD pd.a(Lid;B)V, HD ab.a(Lna;I)V.
    static targetLabel(prefix: JagString | null, guard = glJar ? -801 : undefined): void {
        try {
            if (guard !== undefined && guard !== -801) releaseReferences(LocalisedText, 'frenchMembersObject');
            const index = this.findLabel(prefix, guard !== undefined);
            if (index === -1) return;
            const labels = requireNonNull(this.labels);
            if (guard === undefined) {
                this.target(arrayAtI16(labels.z, index), arrayAtI16(labels.x, index));
            } else {
                const x = arrayAtI16(labels.x, index);
                const z = arrayAtI16(labels.z, index);
                this.target(z, x, true);
            }
        } catch (error) {
            if (guard === undefined || !isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'ab.N(' + (prefix === null ? 'null' : '{...}') + ',' + guard + ')');
        }
    }

    // SD t.a(Lid;I)Lid;, HD rc.a(Lna;Z)Lna;.
    static completeLabel(prefix: JagString | null, guard = glJar ? true : undefined): JagString {
        try {
            if (guard === false) GameShell.releaseGameShellStatics(-78);
            const index = this.findLabel(prefix, guard !== undefined);
            return index === -1 ? this.empty : requireNonNull(arrayAtObj(requireNonNull(this.labels).text, index)).replace(WorldMapLabels.lineBreakTag, this.space);
        } catch (error) {
            if (guard === undefined || !isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'rc.V(' + (prefix === null ? 'null' : '{...}') + ',' + guard + ')');
        }
    }

    // fi.b(ILid;)V
    static open(name: JagString | null): void {
        this.Reset(false);
        this.select(name);
    }

    // SD g.a(I)V / HD lb.d(B)V
    static reopen(hdGuard?: number): void {
        try {
            if (hdGuard !== undefined) intDivide(44, intDivide((-2 - hdGuard) | 0, 52));
            if (this.previousMap !== null) {
                this.open(this.previousMap);
                this.previousMap = null;
            }
        } catch (error) {
            if (hdGuard === undefined || !isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'lb.A(' + hdGuard + ')');
        }
    }

    // nl.e(I)I
    static firstLabel(): number {
        WorldMapLabels.labelIndex = 0;
        return this.nextLabel();
    }

    // dd.b(I)I
    static nextLabel(): number {
        if (this.labels === null) return -1;
        while (this.labels.count > WorldMapLabels.labelIndex) {
            if (this.labels.isVisible(WorldMapLabels.labelIndex)) return WorldMapLabels.labelIndex++;
            WorldMapLabels.labelIndex++;
        }
        return -1;
    }

    // th.a(IB)V
    static toggleIcon(icon: number): void {
        if (icon >= 0 && icon < requireNonNull(this.disabled).length) {
            const disabled = requireNonNull(this.disabled);
            disabled[icon] = !disabled[icon];
        }
    }

    // cf.a(ZI)Z
    static iconDisabled(icon: number): boolean {
        return icon >= 0 && icon < requireNonNull(this.disabled).length && requireNonNull(this.disabled)[icon];
    }

    // b.a(ILid;)V
    static targetExactLabel(name: JagString | null): void {
        const index = WorldMapLabels.findExactLabel(name);
        if (index !== -1) {
            const labels = requireNonNull(this.labels);
            this.target(arrayAtI16(labels.z, index), arrayAtI16(labels.x, index));
        }
    }

    // t.b(I)V
    static CheckGridPosition(): void {
        if (this.centerX < 0) {
            this.centerX = 0;
            this.targetX = -1;
            this.targetZ = -1;
        }
        if (this.centerX > this.width) {
            this.targetX = -1;
            this.targetZ = -1;
            this.centerX = this.width;
        }
        if (this.centerZ < 0) {
            this.targetX = -1;
            this.centerZ = 0;
            this.targetZ = -1;
        }
        if (this.height < this.centerZ) {
            this.centerZ = this.height;
            this.targetX = -1;
            this.targetZ = -1;
        }
    }

    // qk.c(Z)V
    static tick(): void {
        if (this.zoom < this.targetZoom) {
            this.zoom = Math.fround(this.zoom + this.zoom / 30);
            if (this.targetZoom < this.zoom) this.zoom = this.targetZoom;
            this.CheckGridPosition();
        } else if (this.zoom > this.targetZoom) {
            this.zoom = Math.fround(this.zoom - this.zoom / 30);
            if (this.targetZoom > this.zoom) this.zoom = this.targetZoom;
            this.CheckGridPosition();
        }
        if (this.targetX !== -1 && this.targetZ !== -1) {
            let dx = (this.targetX - this.centerX) | 0;
            if (dx < 2 || dx > 2) dx >>= 4;
            this.centerX = (this.centerX + dx) | 0;
            let dz = (this.targetZ - this.centerZ) | 0;
            if (dz < 2 || dz > 2) dz >>= 4;
            this.centerZ = (this.centerZ + dz) | 0;
            if (dx === 0 && dz === 0) {
                this.targetX = -1;
                this.targetZ = -1;
            }
            this.CheckGridPosition();
        }
    }

    // la.c(II)V
    static setX(x: number, targetZ: number): void {
        this.targetZ = targetZ;
        this.targetX = -1;
        this.centerX = x;
        this.CheckGridPosition();
    }

    // ig.a(BI)V
    static setZ(z: number): void {
        this.centerZ = z;
        this.targetZ = -1;
        this.targetZ = -1;
        this.CheckGridPosition();
    }

    // lg.a(IIIBI)V
    static scrollOverview(width: number, y: number, x: number, height: number): void {
        this.centerZ = intDivide(Math.imul(this.height, y), height);
        this.centerX = intDivide(Math.imul(this.width, x), width);
        this.targetZ = -1;
        this.targetX = -1;
        this.CheckGridPosition();
    }

    // uh.a(IIII)V
    static teleport(x: number, z: number, plane: number): void {
        const command = JagString.join([this.teleportCommand, JagString.fromInt(plane), this.comma, JagString.fromInt(x >> 6), this.comma, JagString.fromInt(z >> 6), this.comma, JagString.fromInt(x & 63), this.comma, JagString.fromInt(z & 63)]);
        command.print(0);
        Client.DoCheat(command);
    }

    // lj.a(III)V
    static buildOverlayColors(hue: number, light: number): void {
        for (let i = 0; i < FloType.count; i++) {
            const flo = FloType.List(i);
            if (flo === null) continue;
            let texture = flo.m_materialID;
            if (texture >= 0 && !requireNonNull(Pix3D.textureProvider).isAvailable(texture)) texture = -1;
            let rgb: number;
            if (flo.secondaryColour >= 0) {
                const color = flo.secondaryColour;
                const offsetLight = Math.max(0, Math.min(127, ((color & 127) + light) | 0));
                const hsl = ((hue + color) & 64512) + (color & 896) + offsetLight;
                rgb = arrayAtI32(Pix3D.colourTable, ClientBuild.overlayBrightness(hsl, 96));
            } else if (texture >= 0) {
                rgb = arrayAtI32(Pix3D.colourTable, ClientBuild.overlayBrightness(requireNonNull(Pix3D.textureProvider).getTextureColour(texture), 96));
            } else if (flo.colour === -1) {
                rgb = -1;
            } else {
                const color = flo.colour;
                const offsetLight = Math.max(0, Math.min(127, (light + (color & 127)) | 0));
                const hsl = ((color + hue) & 64512) + (color & 896) + offsetLight;
                rgb = arrayAtI32(Pix3D.colourTable, ClientBuild.overlayBrightness(hsl, 96));
            }
            arrayPutI32(this.overlayColors, (i + 1) | 0, rgb);
        }
    }

    // og.b(Lgd;I)V (underlay)
    static readUnderlay(packet: PacketT): void {
        const hue = (this.hueOffset >> 2) << 10,
            light = this.randomLightness >> 1;
        const width = this.width,
            height = this.height;
        if (width < 0 || height < 0) throw new RangeError('Negative array size');
        const ids = Array.from({ length: width }, () => new Int8Array(height));
        while (packet.m_pos < requireNonNull(packet.m_data).length) {
            let partial = false,
                subZ = 0,
                subX = 0;
            if (packet.g1() === 1) {
                partial = true;
                subX = packet.g1();
                subZ = packet.g1();
            }
            const regionX = packet.g1(),
                regionZ = packet.g1();
            const z = (height - 1 - regionZ * 64 + this.baseZ) | 0;
            const x = (regionX * 64 - this.baseX) | 0;
            if (x < 0 || ((z - 63) | 0) < 0 || width <= ((63 + x) | 0) || height <= z) {
                packet.m_pos = (packet.m_pos + (partial ? 64 : 4096)) | 0;
                continue;
            }
            for (let dx = 0; dx < 64; dx++) {
                const column = ids[x + dx];
                for (let dz = 0; dz < 64; dz++) {
                    if (!partial || (dx >= 8 * subX && dx < 8 + subX * 8 && dz >= 8 * subZ && dz < 8 + subZ * 8)) column[z - dz] = packet.g1s();
                }
            }
        }
        const sumHue = new Int32Array(height),
            sumLight = new Int32Array(height),
            sumSat = new Int32Array(height);
        const sumChroma = new Int32Array(height),
            count = new Int32Array(height);
        for (let x = -5; x < width; x++) {
            for (let z = 0; z < height; z++) {
                const add = x + 5;
                if (add < width) {
                    const id = ids[add][z] & 255;
                    if (id > 0) {
                        const flu = FluType.List(id - 1);
                        sumHue[z] += flu.weightedHue;
                        sumSat[z] += flu.saturation;
                        sumLight[z] += flu.lightness;
                        sumChroma[z] += flu.chroma;
                        count[z]++;
                    }
                }
                const remove = x - 5;
                if (remove >= 0) {
                    const id = ids[remove][z] & 255;
                    if (id > 0) {
                        const flu = FluType.List(id - 1);
                        sumHue[z] -= flu.weightedHue;
                        sumSat[z] -= flu.saturation;
                        sumLight[z] -= flu.lightness;
                        sumChroma[z] -= flu.chroma;
                        count[z]--;
                    }
                }
            }
            if (x < 0) continue;
            const regions = requireNonNull(arrayAtObj(this.underlayColors, x >> 6));
            let weightedHue = 0,
                sat = 0,
                luminance = 0,
                chroma = 0,
                n = 0;
            for (let z = -5; z < height; z++) {
                const add = z + 5;
                if (add < height) {
                    sat = (sat + sumSat[add]) | 0;
                    weightedHue = (weightedHue + sumHue[add]) | 0;
                    luminance = (luminance + sumLight[add]) | 0;
                    chroma = (chroma + sumChroma[add]) | 0;
                    n = (n + count[add]) | 0;
                }
                const remove = z - 5;
                if (remove >= 0) {
                    weightedHue = (weightedHue - sumHue[remove]) | 0;
                    luminance = (luminance - sumLight[remove]) | 0;
                    n = (n - count[remove]) | 0;
                    chroma = (chroma - sumChroma[remove]) | 0;
                    sat = (sat - sumSat[remove]) | 0;
                }
                if (z < 0 || n <= 0) continue;
                let region = arrayAtObj(regions, z >> 6);
                const color = chroma !== 0 ? ClientBuild.packHsl(intDivide(weightedHue << 8, chroma), intDivide(luminance, n), intDivide(sat, n)) : 0;
                if (ids[x][z] !== 0) {
                    if (region === null) region = regions[z >> 6] = new Int32Array(4096);
                    const adjusted = Math.max(0, Math.min(127, ((color & 127) + light) | 0));
                    const hsl = ((hue + color) & 64512) + (896 & color) + adjusted;
                    region[((z & 63) << 6) + (x & 63)] = arrayAtI32(Pix3D.colourTable, ClientBuild.underlayBrightness(96, hsl));
                } else if (region !== null) region[(x & 63) + ((z << 6) & 4032)] = 0;
            }
        }
    }

    // gl.a(Lgd;I)V (overlay)
    static readOverlay(packet: PacketT): void {
        while (packet.m_pos < requireNonNull(packet.m_data).length) {
            let partial = false,
                subZ = 0,
                subX = 0;
            if (packet.g1() === 1) {
                subX = packet.g1();
                subZ = packet.g1();
                partial = true;
            }
            const regionX = packet.g1(),
                regionZ = packet.g1();
            const x = (64 * regionX - this.baseX) | 0;
            const z = (this.height - 1 - regionZ * 64 + this.baseZ) | 0;
            if (x < 0 || ((z - 63) | 0) < 0 || this.width <= ((63 + x) | 0) || z >= this.height) {
                for (let i = 0; i < (partial ? 64 : 4096); i++) {
                    if (packet.g1s() !== 0) packet.m_pos = (packet.m_pos + 1) | 0;
                }
                continue;
            }
            const chunkZ = z >> 6,
                chunkX = x >> 6;
            for (let dx = 0; dx < 64; dx++) {
                for (let dz = 0; dz < 64; dz++) {
                    if (!partial || (dx >= subX * 8 && dx < subX * 8 + 8 && dz >= subZ * 8 && dz < subZ * 8 + 8)) {
                        const id = packet.g1s();
                        if (id !== 0) {
                            const ids = requireNonNull(arrayAtObj(this.overlayIds, chunkX));
                            const regionIds = arrayAtObj(ids, chunkZ) ?? (ids[chunkZ] = new Int8Array(4096));
                            regionIds[dx + ((63 - dz) << 6)] = id;
                            const shape = packet.g1s();
                            const shapes = requireNonNull(arrayAtObj(this.overlayShapes, chunkX));
                            const regionShapes = arrayAtObj(shapes, chunkZ) ?? (shapes[chunkZ] = new Int8Array(4096));
                            regionShapes[((63 - dz) << 6) + dx] = shape;
                        }
                    }
                }
            }
        }
    }

    // oc.a(BLgd;)V (overlay2)
    static readUpperOverlay(packet: PacketT): void {
        while (requireNonNull(packet.m_data).length > packet.m_pos) {
            let partial = false,
                subZ = 0,
                subX = 0;
            if (packet.g1() === 1) {
                subX = packet.g1();
                partial = true;
                subZ = packet.g1();
            }
            const regionX = packet.g1(),
                regionZ = packet.g1();
            const x = (64 * regionX - this.baseX) | 0;
            const z = (this.baseZ + this.height - 1 - regionZ * 64) | 0;
            if (x >= 0 && ((z - 63) | 0) >= 0 && ((x + 63) | 0) < this.width && z < this.height) {
                const chunkX = x >> 6,
                    chunkZ = z >> 6;
                for (let dx = 0; dx < 64; dx++) {
                    for (let dz = 0; dz < 64; dz++) {
                        if (partial && (subX * 8 > dx || dx >= 8 + subX * 8 || dz < subZ * 8 || subZ * 8 + 8 <= dz)) continue;
                        const id = packet.g1s();
                        if (id !== 0) {
                            const ids = requireNonNull(arrayAtObj(this.upperOverlayIds, chunkX));
                            const regionIds = arrayAtObj(ids, chunkZ) ?? (ids[chunkZ] = new Int8Array(4096));
                            regionIds[((63 - dz) << 6) + dx] = id;
                            const shape = packet.g1s();
                            const shapes = requireNonNull(arrayAtObj(this.upperOverlayShapes, chunkX));
                            const regionShapes = arrayAtObj(shapes, chunkZ) ?? (shapes[chunkZ] = new Int8Array(4096));
                            regionShapes[((63 - dz) << 6) + dx] = shape;
                        }
                    }
                }
            } else {
                for (let i = 0; i < (partial ? 64 : 4096); i++) {
                    if (packet.g1s() !== 0) packet.m_pos = (packet.m_pos + 1) | 0;
                }
            }
        }
    }

    // sj.b(ILgd;)V (loc)
    static readLocs(packet: PacketT): void {
        while (packet.m_pos < requireNonNull(packet.m_data).length) {
            let partial = false,
                subX = 0,
                subZ = 0;
            if (packet.g1() === 1) {
                subX = packet.g1();
                partial = true;
                subZ = packet.g1();
            }
            const regionX = packet.g1(),
                regionZ = packet.g1();
            const x = (regionX * 64 - this.baseX) | 0;
            const z = (this.baseZ + this.height - regionZ * 64 - 1) | 0;
            if (x >= 0 && ((z - 63) | 0) >= 0 && ((x + 63) | 0) < this.width && z < this.height) {
                const chunkZ = z >> 6,
                    chunkX = x >> 6;
                for (let dx = 0; dx < 64; dx++) {
                    for (let dz = 0; dz < 64; dz++) {
                        if (partial && (dx < subX * 8 || dx >= subX * 8 + 8 || dz < subZ * 8 || dz >= subZ * 8 + 8)) continue;
                        const flags = packet.g1();
                        if (flags === 0) continue;
                        const tile = ((63 - dz) << 6) + dx;
                        if ((flags & 1) === 1) {
                            const wall = packet.g1();
                            const walls = requireNonNull(arrayAtObj(this.wallTypes, chunkX));
                            const region = arrayAtObj(walls, chunkZ) ?? (walls[chunkZ] = new Int8Array(4096));
                            region[tile] = wall;
                        }
                        if ((flags & 2) === 2) {
                            const scene = packet.g3();
                            const scenes = requireNonNull(arrayAtObj(this.mapScenes, chunkX));
                            const region = arrayAtObj(scenes, chunkZ) ?? (scenes[chunkZ] = new Int32Array(4096));
                            region[tile] = scene;
                        }
                        if ((flags & 4) === 4) {
                            const id = packet.g3();
                            const locs = requireNonNull(arrayAtObj(this.locIds, chunkX));
                            const region = arrayAtObj(locs, chunkZ) ?? (locs[chunkZ] = new Int32Array(4096));
                            let loc: LocType | null = LocType.List(id - 1);
                            if (loc.multi !== null) {
                                loc = loc.GetMultiLoc();
                                if (loc === null || loc.mapFunction === -1) continue;
                            }
                            region[tile] = (loc.id + 1) | 0;
                            const icon = new MapElementInstance();
                            icon.mapFunction = loc.mapFunction;
                            icon.z = z;
                            icon.x = x;
                            this.icons.push_back(icon);
                        }
                    }
                }
            } else {
                for (let i = 0; i < (partial ? 64 : 4096); i++) {
                    const flags = packet.g1();
                    if ((flags & 1) === 1) packet.m_pos = (packet.m_pos + 1) | 0;
                    // sj.b advances two bytes for a skipped mapscene. An in-bounds mapscene reads three.
                    if ((flags & 2) === 2) packet.m_pos = (packet.m_pos + 2) | 0;
                    if ((flags & 4) === 4) packet.m_pos = (packet.m_pos + 3) | 0;
                }
            }
        }
    }

    static readonly underlay = fromLiteral('underlay'); // db.u:Lid;
    static readonly overlay = fromLiteral('overlay'); // tb.B:Lid;
    static readonly upper = fromLiteral('overlay2'); // wb.T:Lid;
    static readonly loc = fromLiteral('loc'); // kl.Gb:Lid;
    static readonly labelSuffix = fromLiteral('_labels'); // ah.g:Lid;

    // lk.b(I)V
    static freeSceneMemory(): void {
        try {
            world.ResetMap();
            for (let level = 0; level < 4; level++) requireNonNull(arrayAtObj(CollisionMap.levelMaps, level)).reset();
            globalThis.gc?.();
        } catch (error) {
            if (!glJar || !isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'ag.O(22230)');
        }
    }

    // lg.b(Z)V, called by ah.a while sa.w < 100.
    static step(bold = true): void {
        try {
            if (this.current === null) return;
            if (this.progress < 10) {
                const archive = this.archive;
                const name = requireNonNull(this.current).groupName;
                if (!requireNonNull(archive).RequestGroupDownload2(name)) {
                    const progressArchive = Client.worldMapArchive;
                    const progressName = requireNonNull(this.current).groupName;
                    this.progress = (requireNonNull(progressArchive).GetGroupLoadPercentage2(progressName) / 10) | 0;
                    return;
                }
                this.freeSceneMemory();
                this.progress = 10;
            }
            if (this.progress === 10) {
                this.baseX = (requireNonNull(this.current).minX >> 6) << 6;
                this.width = (-this.baseX + ((requireNonNull(this.current).maxX >> 6) << 6) + 64) | 0;
                let zoom: number;
                if (requireNonNull(this.current).defaultZoom === 37) zoom = 3;
                else if (requireNonNull(this.current).defaultZoom === 50) zoom = 4;
                else if (requireNonNull(this.current).defaultZoom === 75) zoom = 6;
                else if (requireNonNull(this.current).defaultZoom === 100) zoom = 8;
                else if (requireNonNull(this.current).defaultZoom === 200) zoom = 16;
                else zoom = 8;
                this.zoom = zoom;
                this.targetZoom = zoom;
                this.baseZ = (requireNonNull(this.current).minZ >> 6) << 6;
                let playerX = (Client.mapBuildBaseX + (requireNonNull(Client.localPlayer).x >> 7) - this.baseX) | 0;
                playerX = (playerX + ((10 * mathRandom.nextDouble()) | 0) - 5) | 0;
                this.height = (64 - this.baseZ + ((requireNonNull(this.current).maxZ >> 6) << 6)) | 0;
                let playerZ = (-(requireNonNull(Client.localPlayer).z >> 7) + (-Client.mapBuildBaseZ + this.baseZ) + (this.height - 1)) | 0;
                playerZ = (playerZ + ((10 * mathRandom.nextDouble()) | 0) - 5) | 0;
                if (playerX < 0 || playerX >= this.width || playerZ < 0 || playerZ >= this.height) {
                    this.centerZ = (-(requireNonNull(this.current).originZ << 6) + this.baseZ - 1 + this.height) | 0;
                    this.centerX = ((requireNonNull(this.current).originX << 6) - this.baseX) | 0;
                } else {
                    this.centerX = playerX;
                    this.centerZ = playerZ;
                }
                this.CheckGridPosition();
                const light = ClientBuild.m_ligOff >> 1;
                const hue = (ClientBuild.m_hueOff >> 2) << 10;
                const width = this.width >> 6,
                    height = this.height >> 6;
                this.overlayShapes = chunks(width, height);
                this.wallTypes = chunks(width, height);
                this.upperOverlayIds = chunks(width, height);
                this.mapScenes = chunks(width, height);
                this.overlayIds = chunks(width, height);
                this.overlayColors = new Int32Array((1 + FloType.count) | 0);
                this.locIds = chunks(width, height);
                this.upperOverlayShapes = chunks(width, height);
                this.underlayColors = chunks(width, height);
                this.buildOverlayColors(hue, light);
                this.progress = 20;
            } else if (this.progress === 20) {
                const archive = this.archive;
                const file = this.underlay;
                const group = requireNonNull(this.current).groupName;
                this.readUnderlay(new PacketT(requireNonNull(archive).GetFile3(file, group)));
                this.progress = 30;
                Client.PreventTimeout(true);
                GameShell.DoneSlowUpdate();
            } else if (this.progress === 30) {
                const archive = this.archive;
                const file = this.overlay;
                const group = requireNonNull(this.current).groupName;
                this.readOverlay(new PacketT(requireNonNull(archive).GetFile3(file, group)));
                this.progress = 40;
                GameShell.DoneSlowUpdate();
            } else if (this.progress === 40) {
                const archive = this.archive;
                const file = this.upper;
                const group = requireNonNull(this.current).groupName;
                this.readUpperOverlay(new PacketT(requireNonNull(archive).GetFile3(file, group)));
                this.progress = 50;
                GameShell.DoneSlowUpdate();
            } else if (this.progress === 50) {
                const archive = this.archive;
                const file = this.loc;
                const group = requireNonNull(this.current).groupName;
                this.readLocs(new PacketT(requireNonNull(archive).GetFile3(file, group)));
                this.progress = 60;
                Client.PreventTimeout(true);
                GameShell.DoneSlowUpdate();
            } else if (this.progress === 60) {
                const archive = this.archive;
                const name = JagString.join([requireNonNull(this.current).groupName, this.labelSuffix]);
                if (!requireNonNull(archive).containsGroup(name, 0)) {
                    this.labels = new WorldMapLabels(0);
                } else {
                    const readyArchive = this.archive;
                    const readyName = JagString.join([requireNonNull(this.current).groupName, this.labelSuffix]);
                    if (!requireNonNull(readyArchive).RequestGroupDownload2(readyName)) return;
                    this.labels = WorldMapLabels.load(JagString.join([requireNonNull(this.current).groupName, this.labelSuffix]), this.archive);
                }
                this.progress = 70;
                GameShell.DoneSlowUpdate();
            } else if (this.progress === 70) {
                this.font11 = new WorldMapFont(11, true, GameShell.canvas);
                this.progress = 73;
                Client.PreventTimeout(true);
                GameShell.DoneSlowUpdate();
            } else if (this.progress === 73) {
                this.font12 = new WorldMapFont(12, true, GameShell.canvas);
                this.progress = 76;
                Client.PreventTimeout(true);
                GameShell.DoneSlowUpdate();
            } else if (this.progress === 76) {
                this.font14 = new WorldMapFont(14, true, GameShell.canvas);
                this.progress = 79;
                Client.PreventTimeout(true);
                GameShell.DoneSlowUpdate();
            } else if (this.progress === 79) {
                this.font17 = new WorldMapFont(17, true, GameShell.canvas);
                this.progress = 82;
                Client.PreventTimeout(true);
                GameShell.DoneSlowUpdate();
            } else if (this.progress === 82) {
                this.font19 = new WorldMapFont(19, true, GameShell.canvas);
                this.progress = 85;
                Client.PreventTimeout(true);
                GameShell.DoneSlowUpdate();
            } else if (this.progress === 85) {
                this.font22 = new WorldMapFont(22, true, GameShell.canvas);
                this.progress = 88;
                Client.PreventTimeout(true);
                GameShell.DoneSlowUpdate();
            } else if (this.progress === 88) {
                this.font26 = new WorldMapFont(26, true, GameShell.canvas);
                this.progress = 91;
                Client.PreventTimeout(true);
                GameShell.DoneSlowUpdate();
            } else {
                this.font30 = new WorldMapFont(30, bold, GameShell.canvas);
                this.progress = 100;
                Client.PreventTimeout(true);
                GameShell.DoneSlowUpdate();
                globalThis.gc?.();
            }
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'lg.L(' + bold + ')');
        }
    }
}
