import { glJar } from '#/client/ClientVariant';
import SharedPtrList from '#/datastruct/SharedPtrList';
import { JavaError } from '#/util/ClientError';
import { byteAt } from '#/io/JavaByteArray';
import Preferences from '#/ui/Preferences';
import { arrayAtI32, arrayAtObj, arrayPutI32, arrayPutObj, requireNonNull } from '#/util/JavaArray';
import Decor from './Decor';
import Ground from './Ground';
import GroundDecor from './GroundDecor';
import GroundObject from './GroundObject';
import type ModelSource from './ModelSource';
import Occlude from './Occlude';
import Pix3D from './Pix3D';
import QuickGround from './QuickGround';
import Sprite from './Sprite';
import Square from './Square';
import type TerrainBatch from './TerrainBatch';
import type { HdTextureProvider } from './TextureProvider';
import { GL } from '#/jogl/GL';
import Wall from './Wall';
import { loadGlLighting, loadGlModel, loadGlRenderer, loadMaterialManager, loadPointLightManager } from '#/util/GamepackClasses';

// Keep the original variant's HD class initialization at first use.
let rendererClass: (typeof import('#/gl/GlRenderer'))['default'] | undefined;
let materialManagerClass: (typeof import('#/gl/material/MaterialManager'))['default'] | undefined;
let lightingClass: (typeof import('#/gl/GlLighting'))['default'] | undefined;
let pointLightsClass: (typeof import('#/gl/PointLightManager'))['default'] | undefined;

// Only resolve jf on a lighting call. ub still tests the live renderer flag before
// each call, since a model draw can change it between two tiles or entities.
function getPointLights(): (typeof import('#/gl/PointLightManager'))['default'] {
    return (pointLightsClass ??= loadPointLightManager());
}

// The revision 530 scene graph (NXT jag::oldscape::dash3d::world, the rev 225 World). The SD gamepack has no scene
// class: its state and routines are statics scattered over ~60 obfuscated classes, gathered here by the member map.
// It owns the squares of every level, the occluders, the per-frame visibility map and the render traversal:
// world.draw sets the eye and the visibility map, world.CalcOcclude picks the occluders in view, and world.Render marks
// the visible squares and hands them to world.Fill, which draws each square's ground, walls, decor and sprites in the
// painter's order. Method names are the NXT spellings where NXT has the routine, else the member-map names.
//
// Locals keep the decompiler's varN names, so each method can be diffed against its <owner>.java, except
// renderQuickGround (ug.a) and drawTileOverlay (sb.a): the decompiler drops the rotation temporaries' copies there, so
// those two use the bytecode slot numbers. Block layout follows the bytecode where the decompiler restructured it
// (early returns, the order of if/else arms). Int arithmetic is Java's: Math.imul for *, | 0 after + and -,
// (a / b) | 0 for / (each divisor is a constant or provably non-zero), and arrayAt/arrayPut (at2/at3 below) wherever a
// JVM array load or store could throw. Every method here is clean in the jar (no invocation counters, dummy arguments
// or exception wrappers) except wallTypeMask (ob.a(II)I), whose counter, dummy argument and wrapper are stripped.
//
// Not here: fd.a(II)Z, which API.md listed under this class as switchWorld. It is the world-list switch
// (it looks up a qk world entry and either opens its URL or sets the game host and ports), not a scene-graph routine;
// the member map files it under TitleScreen and its port is title/TitleScreen.ts SwitchToWorld.
export default class world {
    // af.O:I. Squares still to be filled this pass; world.Render stops once it reaches 0.
    static fillLeft = 0;
    // ah.i:I
    static dynamicCount = 0;
    // aj.Ub:[I. Per hidden-roof area: the max z (world.draw's var9).
    static roofHideMaxZ: Int32Array | null = null;
    // ak.j:I
    static clickLevel = 0;
    // bf.u:I. The draw radius in tiles.
    static viewRadius = 0;
    // client.hb:[[Z. Per tile corner around the eye: whether the column above it is on screen.
    static cornerVisibility: boolean[][] | null = null;
    // de.w:[I. Per hidden-roof area: the y, or -1000000 for an unused slot (world.draw's var6).
    static hiddenRoofY: Int32Array | null = null;
    // dg.v:[Lec;. world.Fill's scratch list of the sprites it is about to sort.
    static spriteBuffer: (Sprite | null)[] | null = null;
    // ea.l:I
    static cy = 0;
    // ej.d:[I
    static readonly middep64: Int32Array = Int32Array.of(0, 4, 4, 8, 0, 0, 8, 0, 0);
    // ek.i:[I. Per hidden-roof area: the max x (world.draw's var8).
    static hideAreaMaxX: Int32Array | null = null;
    // fa.q:[[I. Per ground shape: which of the 4x4 minimap pixels are overlay (1) or underlay (0).
    static readonly minimapShape: Int32Array[] = [
        new Int32Array(16),
        Int32Array.of(1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1),
        Int32Array.of(1, 0, 0, 0, 1, 1, 0, 0, 1, 1, 1, 0, 1, 1, 1, 1),
        Int32Array.of(1, 1, 0, 0, 1, 1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0),
        Int32Array.of(0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 0, 1, 0, 0, 0, 1),
        Int32Array.of(0, 1, 1, 1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1),
        Int32Array.of(1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 1, 1, 1, 1, 1),
        Int32Array.of(1, 1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0),
        Int32Array.of(0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 1, 0, 0),
        Int32Array.of(1, 1, 1, 1, 1, 1, 1, 1, 0, 1, 1, 1, 0, 0, 1, 1),
        Int32Array.of(1, 1, 1, 1, 1, 1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0),
        Int32Array.of(0, 0, 0, 0, 0, 0, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1),
        Int32Array.of(0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 1, 1, 1, 1)
    ];
    // gf.W:I. The eye's tile z.
    static eyeTileZ = 0;
    // hf.D:[I. Per hidden-roof area: the min x (world.draw's var7).
    static roofMinX: Int32Array | null = null;
    // hh.Z:I. The eye's tile x.
    static gx = 0;
    // hl.Y:I. The tile z of the ground triangle under the mouse, or -1.
    static groundZ = -1;
    // ia.r:I
    static minX = 0;
    // il.P:[[[I. Per level and tile corner: cycleNo when world.GroundoOcluded found it occluded, -cycleNo when not.
    static levelTileOcclusionCycles: Int32Array[][] | null = null;
    // jl.k:I
    static maxZ = 0;
    // ke.o:[[I. Per tile, allocated with the underwater layer. While that layer is active, world.SetSprite copies the
    // last non-zero value under a new sprite into the sprite's zero tiles.
    static waterSpriteKeys: Int32Array[] | null = null;
    // ki.S:[I
    static readonly middep128: Int32Array = Int32Array.of(1, 1, 0, 0, 0, 8, 0, 0, 8);
    // ki.W:I. The level count of the active layer (squares.length).
    static maxLevel = 0;
    // kk.T:[I
    static readonly midTab: Int32Array = Int32Array.of(160, 192, 80, 96, 0, 144, 80, 48, 160);
    // kl.Bb:[[[Lra;. The active layer's squares: mainLevelTiles, or underwaterSquares during the underwater pass.
    static squares: (Square | null)[][][] | null = null;

    static modelsReleased = false; // HD sk.lb

    // HD bf.c(I)V. After the low-memory threshold, upload scene models and release their CPU arrays once.
    static releaseGlModels(): void {
        if (!(rendererClass ??= loadGlRenderer()).active) return;
        if (world.modelsReleased) return;
        const GlModel = loadGlModel();
        const tiles = requireNonNull(world.squares);
        for (let level = 0; level < tiles.length; level++) {
            const plane = arrayAtObj(tiles, level);
            for (let x = 0; x < plane.length; x++) {
                for (let z = 0; z < arrayAtObj(plane, x).length; z++) {
                    const tile = arrayAtObj(arrayAtObj(plane, x), z);
                    if (tile === null) continue;
                    const ground = tile.groundDecor;
                    if (ground !== null && ground.model instanceof GlModel) {
                        const discard = (ground.typecode & 0x8000000000000000n) !== 0n;
                        ground.model.prepareBuffers(discard, true, true, true, discard, true, true);
                    }
                    const decor = tile.decor;
                    if (decor !== null) {
                        if (decor.model instanceof GlModel) {
                            const discard = (decor.typecode & 0x8000000000000000n) !== 0n;
                            decor.model.prepareBuffers(discard, true, true, true, discard, true, true);
                        }
                        if (decor.model2 instanceof GlModel) {
                            const discard = (decor.typecode & 0x8000000000000000n) !== 0n;
                            decor.model2.prepareBuffers(discard, true, true, true, discard, true, true);
                        }
                    }
                    const wall = tile.wall;
                    if (wall !== null) {
                        if (wall.model1 instanceof GlModel) {
                            const discard = (wall.typecode & 0x8000000000000000n) !== 0n;
                            wall.model1.prepareBuffers(discard, true, true, true, discard, true, true);
                        }
                        if (wall.model2 instanceof GlModel) {
                            const discard = (wall.typecode & 0x8000000000000000n) !== 0n;
                            wall.model2.prepareBuffers(discard, true, true, true, discard, true, true);
                        }
                    }
                    for (let i = 0; i < tile.spriteCount; i++) {
                        const sprite = requireNonNull(arrayAtObj(tile.sprites, i));
                        if (sprite.model instanceof GlModel) {
                            const discard = (sprite.typecode & 0x8000000000000000n) !== 0n;
                            sprite.model.prepareBuffers(discard, true, true, true, discard, true, true);
                        }
                    }
                }
            }
        }
        world.modelsReleased = true;
    }
    // l.r:I
    static minLevel = 0;
    // la.kb:I
    static cycleNo = 0;
    // la.nb:[I
    static readonly preTab: Int32Array = Int32Array.of(19, 55, 38, 155, 255, 110, 137, 205, 76);
    // ld.b:[I
    static readonly midDep32: Int32Array = Int32Array.of(2, 0, 0, 2, 0, 0, 0, 4, 4);
    // lf.d:[I
    static readonly midDep16: Int32Array = Int32Array.of(0, 0, 2, 0, 0, 2, 1, 1, 0);
    // lf.g:[[[I. The main layer's corner heights.
    static mainGroundh: Int32Array[][] | null = null;
    // lh.f:I
    static maxX = 0;
    // lk.q:I
    static cx = 0;
    // ll.c:[Ljg;
    static occluders: (Occlude | null)[] | null = null;
    // mc.P:I
    static numOccluders = 0;
    // na.G:[[[Lra;
    static mainLevelTiles: (Square | null)[][][] | null = null;
    // nh.S:[[[I. The underwater layer's corner heights (one level).
    static underwaterHeightmap: Int32Array[][] | null = null;
    // o.O:Z
    static takingInput = false;
    // oh.k:I. Projection-centred, like the camera-space triangle hit tests that compare against it.
    static clickX = 0;
    // pa.xb:[Lec;. The temporary sprites world.RemoveSprites clears each frame.
    static dynamicSprites: (Sprite | null)[] | null = null;
    // pg.E:I
    static minZ = 0;
    // ph.n:I
    static cameraCosY = 0;
    // qf.a:I
    static cameraCosX = 0;
    // qi.Y:I
    static maxTileZ = 0;
    // rc.b:I
    static clickY = 0;
    // rg.q:[[I. Per ground rotation: the order the 4x4 minimap pixels read minimapShape in.
    static readonly minimapRotate: Int32Array[] = [
        Int32Array.of(0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15),
        Int32Array.of(12, 8, 4, 0, 13, 9, 5, 1, 14, 10, 6, 2, 15, 11, 7, 3),
        Int32Array.of(15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0),
        Int32Array.of(3, 7, 11, 15, 2, 6, 10, 14, 1, 5, 9, 13, 0, 4, 8, 12)
    ];
    // rg.t:I
    static cz = 0;
    // rj.p:[I. Per hidden-roof area: the min z (world.draw's var10).
    static roofHideMinZ: Int32Array | null = null;
    // rj.s:I
    static numActiveOccluders = 0;
    // si.t:I. The tile x of the ground triangle under the mouse, or -1.
    static groundX = -1;
    // tb.j:I
    static cameraSinX = 0;
    // tg.x:I
    static maxTileX = 0;
    // tj.j:[[Z. Per tile around the eye: whether any of its four corner columns is on screen.
    static visibilityMap: boolean[][] | null = null;
    // uc.a:[I
    static readonly postTab: Int32Array = Int32Array.of(76, 8, 137, 4, 0, 1, 38, 2, 19);
    // uf.v:[Ljg;
    static activeOccluders: (Occlude | null)[] | null = null;
    // v.F:Lgk;
    static readonly drawTileQueue: SharedPtrList<Square> = new SharedPtrList<Square>();
    // vb.c:[[[B
    static tileCameraClearance: Uint8Array[][] | null = null;
    // ve.q:[[[I. The active layer's corner heights: mainGroundh or underwaterHeightmap.
    static levelHeightmaps: Int32Array[][] | null = null;
    // vf.V:[[[Lra;. The underwater layer's squares (one level), or null when the map has none.
    static underwaterSquares: (Square | null)[][][] | null = null;
    // wa.g:I
    static cameraSinY = 0;

    // HD-only statics (runescape_gl.jar; the SD gamepack has no counterpart). Neither class's <clinit> stores them.
    // HD client.kb:[[Lhg;. The main layer's terrain batches per level: cd.a(IIIIZ)V (HD world.init) allocates the
    // four-level outer array (`new hg[4][]`, rows null until built) while GL is active, and wj.a(Z)V (HD
    // world.setUnderwater) selects it as oj.E for the draw.
    static mainTerrainBatches: ((TerrainBatch | null)[] | null)[] | null = null;
    static terrainBatches: ((TerrainBatch | null)[] | null)[] | null = null; // HD oj.E
    private static waterColour = -1; // HD ma.z
    private static waterDepth = -1; // HD bl.X
    // HD pk.R:[[Lhg;. The underwater layer's terrain batches (`new hg[1][]`), allocated beside underwaterSquares.
    static underwaterTerrainBatches: ((TerrainBatch | null)[] | null)[] | null = null;

    // mc.a(IIIIZ)V
    // var0 = level count, var1 = maxTileX, var2 = maxTileZ, var3 = view radius, var4 = with an underwater layer.
    static init(var0: number, var1: number, var2: number, var3: number, var4: boolean): void {
        world.maxTileX = var1;
        world.maxTileZ = var2;
        world.viewRadius = var3;
        world.mainLevelTiles = newSquareArray3(var0, world.maxTileX, world.maxTileZ);
        world.mainGroundh = newIntArray3(var0, (world.maxTileX + 1) | 0, (world.maxTileZ + 1) | 0);
        const renderer = glJar ? (rendererClass ??= loadGlRenderer()) : null;
        if (renderer?.active) world.mainTerrainBatches = new Array(4).fill(null);
        if (var4) {
            world.underwaterSquares = newSquareArray3(1, world.maxTileX, world.maxTileZ);
            world.waterSpriteKeys = newIntArray2(world.maxTileX, world.maxTileZ);
            world.underwaterHeightmap = newIntArray3(1, (world.maxTileX + 1) | 0, (world.maxTileZ + 1) | 0);
            if (renderer?.active) world.underwaterTerrainBatches = new Array(1).fill(null);
        } else {
            world.underwaterSquares = null;
            world.waterSpriteKeys = null;
            world.underwaterHeightmap = null;
            if (glJar) world.underwaterTerrainBatches = null;
        }

        world.setUnderwater(false);
        world.occluders = new Array<Occlude | null>(500).fill(null);
        world.numOccluders = 0;
        world.activeOccluders = new Array<Occlude | null>(500).fill(null);
        world.numActiveOccluders = 0;
        world.levelTileOcclusionCycles = newIntArray3(var0, (world.maxTileX + 1) | 0, (world.maxTileZ + 1) | 0);
        world.dynamicSprites = new Array<Sprite | null>(5000).fill(null);
        world.dynamicCount = 0;
        world.spriteBuffer = new Array<Sprite | null>(100).fill(null);
        world.visibilityMap = newBooleanArray2((world.viewRadius + world.viewRadius + 1) | 0, (world.viewRadius + world.viewRadius + 1) | 0);
        world.cornerVisibility = newBooleanArray2((world.viewRadius + world.viewRadius + 2) | 0, (world.viewRadius + world.viewRadius + 2) | 0);
        world.tileCameraClearance = newByteArray3(var0, world.maxTileX, world.maxTileZ);
    }

    // SD ng.e()V / HD fc.a()V
    // The HD body is the SD one with two stores added: the terrain batch rows go to null after each layer's square
    // loop. The HD statics are the same fields in the same instruction positions (pm.cb mainLevelTiles, ma.i maxTileX,
    // hk.Y maxTileZ, wh.c underwaterSquares, cd.s numOccluders, hc.O occluders, tk.D dynamicSprites, bl.T dynamicCount,
    // c.bb spriteBuffer). HD callers: pm.a(ZIZIZII)V (before the GL library loads) and lb.a(Z)V (the window rebuild),
    // as well as ag.j(I)V and wj.b(B)V.
    static ResetMap(): void {
        if (world.mainLevelTiles !== null) {
            for (let var0 = 0; var0 < world.mainLevelTiles.length; var0++) {
                for (let var1 = 0; var1 < world.maxTileX; var1++) {
                    for (let var2 = 0; var2 < world.maxTileZ; var2++) {
                        arrayPutObj(at2(world.mainLevelTiles, var0, var1), var2, null);
                    }
                }
            }
        }

        if (glJar) {
            world.mainTerrainBatches = null;
        }

        if (world.underwaterSquares !== null) {
            for (let var3 = 0; var3 < world.underwaterSquares.length; var3++) {
                for (let var7 = 0; var7 < world.maxTileX; var7++) {
                    for (let var8 = 0; var8 < world.maxTileZ; var8++) {
                        arrayPutObj(at2(world.underwaterSquares, var3, var7), var8, null);
                    }
                }
            }
        }

        if (glJar) {
            world.underwaterTerrainBatches = null;
        }

        // numOccluders is zeroed before the loop that should clear the occluders, so the loop never runs (as in Java).
        world.numOccluders = 0;
        if (world.occluders !== null) {
            for (let var4 = 0; var4 < world.numOccluders; var4++) {
                arrayPutObj(world.occluders, var4, null);
            }
        }

        if (world.dynamicSprites !== null) {
            for (let var5 = 0; var5 < world.dynamicCount; var5++) {
                arrayPutObj(world.dynamicSprites, var5, null);
            }

            world.dynamicCount = 0;
        }

        if (world.spriteBuffer !== null) {
            for (let var6 = 0; var6 < world.spriteBuffer.length; var6++) {
                arrayPutObj(world.spriteBuffer, var6, null);
            }
        }
    }

    // wd.a(Z)V
    // var0 = select the underwater layer (true) or the main layer (false).
    static setUnderwater(var0: boolean): void {
        if (var0) {
            world.squares = world.underwaterSquares;
            world.levelHeightmaps = world.underwaterHeightmap;
            if (glJar) world.terrainBatches = world.underwaterTerrainBatches;
        } else {
            world.squares = world.mainLevelTiles;
            world.levelHeightmaps = world.mainGroundh;
            if (glJar) world.terrainBatches = world.mainTerrainBatches;
        }

        world.maxLevel = requireNonNull(world.squares).length;
    }

    // cf.a(I)V
    static FillBaseLevel(var0: number): void {
        world.minLevel = var0;

        for (let var1 = 0; var1 < world.maxTileX; var1++) {
            for (let var2 = 0; var2 < world.maxTileZ; var2++) {
                if (at3(world.squares, var0, var1, var2) === null) {
                    arrayPutObj(at2(world.squares, var0, var1), var2, new Square(var0, var1, var2));
                }
            }
        }
    }

    // fa.a(II)V
    // Moves the column at (var0, var1) down one level (a bridge): level 0 keeps the old ground square as linkedSquare.
    static PushDown(var0: number, var1: number): void {
        const var2 = at3(world.squares, 0, var0, var1);

        for (let var3 = 0; var3 < 3; var3++) {
            // ra var4 = kl.Bb[var3][var0][var1] = kl.Bb[var3 + 1][var0][var1]: the destination row is loaded first.
            let var4: Square | null = null;
            arrayPutObj(at2(world.squares, var3, var0), var1, (var4 = at3(world.squares, var3 + 1, var0, var1)));
            if (var4 !== null) {
                var4.level = (var4.level - 1) | 0;

                for (let var5 = 0; var5 < var4.spriteCount; var5++) {
                    const var6 = requireNonNull(arrayAtObj(var4.sprites, var5));
                    if (((var6.typecode >> 29n) & 3n) === 2n && var6.minTileX === var0 && var6.minTileZ === var1) {
                        var6.level = (var6.level - 1) | 0;
                    }
                }
            }
        }

        if (at3(world.squares, 0, var0, var1) === null) {
            arrayPutObj(at2(world.squares, 0, var0), var1, new Square(0, var0, var1));
        }

        requireNonNull(at3(world.squares, 0, var0, var1)).linkedSquare = var2;
        arrayPutObj(at2(world.squares, 3, var0), var1, null);
    }

    // og.a(IIIIIII)V
    // var0 = type (1 x plane, 2 z plane, 4 horizontal), var1/var2 = min/max x, var3/var4 = min/max z, var5/var6 = min/max y.
    static SetOcclude(var0: number, var1: number, var2: number, var3: number, var4: number, var5: number, var6: number): void {
        const var7 = new Occlude();
        var7.minTileX = (var1 / 128) | 0;
        var7.maxTileX = (var2 / 128) | 0;
        var7.minTileZ = (var3 / 128) | 0;
        var7.maxTileZ = (var4 / 128) | 0;
        var7.type = var0;
        var7.minX = var1;
        var7.maxX = var2;
        var7.minZ = var3;
        var7.maxZ = var4;
        var7.minY = var5;
        var7.maxY = var6;
        // Java's a[i++] = v stores the int-wrapped increment before the array store can throw.
        const index = world.numOccluders;
        world.numOccluders = (index + 1) | 0;
        arrayPutObj(world.occluders, index, var7);
    }

    // uk.a(IIIIIIIIIIIIIIIIIIII)V
    // var0 = level, var1/var2 = tile x/z, var3 = shape (0 plain underlay, 1 full overlay, else a Ground shape),
    // var4 = rotation, var5 = texture, var6..var9 = heights SW/SE/NE/NW, var10..var13 = underlay colours SW/SE/NE/NW,
    // var14..var17 = overlay colours SW/SE/NE/NW, var18/var19 = the two minimap colours (Ground's minimapOverlay and
    // minimapUnderlay; a plain tile takes var18, a full overlay var19).
    // The three arms are in bytecode order (the decompiler swaps the last two).
    static SetGround(
        var0: number,
        var1: number,
        var2: number,
        var3: number,
        var4: number,
        var5: number,
        var6: number,
        var7: number,
        var8: number,
        var9: number,
        var10: number,
        var11: number,
        var12: number,
        var13: number,
        var14: number,
        var15: number,
        var16: number,
        var17: number,
        var18: number,
        var19: number
    ): void {
        if (var3 === 0) {
            const var23 = new QuickGround(var10, var11, var12, var13, -1, var18, false);

            for (let var25 = var0; var25 >= 0; var25--) {
                if (at3(world.squares, var25, var1, var2) === null) {
                    arrayPutObj(at2(world.squares, var25, var1), var2, new Square(var25, var1, var2));
                }
            }

            requireNonNull(at3(world.squares, var0, var1, var2)).quickGround = var23;
            return;
        }

        if (var3 === 1) {
            const var20 = new QuickGround(var14, var15, var16, var17, var5, var19, var6 === var7 && var6 === var8 && var6 === var9);

            for (let var21 = var0; var21 >= 0; var21--) {
                if (at3(world.squares, var21, var1, var2) === null) {
                    arrayPutObj(at2(world.squares, var21, var1), var2, new Square(var21, var1, var2));
                }
            }

            requireNonNull(at3(world.squares, var0, var1, var2)).quickGround = var20;
            return;
        }

        const var22 = new Ground(var3, var4, var5, var1, var2, var6, var7, var8, var9, var10, var11, var12, var13, var14, var15, var16, var17, var18, var19);

        for (let var24 = var0; var24 >= 0; var24--) {
            if (at3(world.squares, var24, var1, var2) === null) {
                arrayPutObj(at2(world.squares, var24, var1), var2, new Square(var24, var1, var2));
            }
        }

        requireNonNull(at3(world.squares, var0, var1, var2)).ground = var22;
    }

    // vf.a(IIIILug;JZ)V
    // var0 = level, var1/var2 = tile x/z, var3 = y, var4 = model, var5 = typecode. var7 (the loc type's jb.P, which
    // the only caller nc.a passes) is not read; it varies per call, so it is kept rather than stripped as a dummy.
    static SetGroundDecor(var0: number, var1: number, var2: number, var3: number, var4: ModelSource | null, var5: bigint, var7: boolean): void {
        if (var4 === null) {
            return;
        }

        const var8 = new GroundDecor();
        var8.model = var4;
        var8.x = (Math.imul(var1, 128) + 64) | 0;
        var8.z = (Math.imul(var2, 128) + 64) | 0;
        var8.y = var3;
        var8.typecode = var5;
        if (glJar) var8.depthOffset = var7;
        if (at3(world.squares, var0, var1, var2) === null) {
            arrayPutObj(at2(world.squares, var0, var1), var2, new Square(var0, var1, var2));
        }

        requireNonNull(at3(world.squares, var0, var1, var2)).groundDecor = var8;
    }

    // d.a(IIIILug;JLug;Lug;)V
    // var0 = level, var1/var2 = tile x/z, var3 = y, var4 = top obj, var5 = typecode, var7 = middle obj, var8 = bottom obj.
    // The stack's height is the negated lowest getMinY of the square's typecode-bit-22 sprites (0 if none).
    static SetObj(var0: number, var1: number, var2: number, var3: number, var4: ModelSource | null, var5: bigint, var7: ModelSource | null, var8: ModelSource | null): void {
        const var9 = new GroundObject();
        var9.topObj = var4;
        var9.x = (Math.imul(var1, 128) + 64) | 0;
        var9.z = (Math.imul(var2, 128) + 64) | 0;
        var9.y = var3;
        var9.typecode = var5;
        var9.middleObj = var7;
        var9.bottomObj = var8;
        let var10 = 0;
        const var11 = at3(world.squares, var0, var1, var2);
        if (var11 !== null) {
            for (let var12 = 0; var12 < var11.spriteCount; var12++) {
                const var13 = requireNonNull(arrayAtObj(var11.sprites, var12));
                if ((var13.typecode & 4194304n) === 4194304n) {
                    const var14 = requireNonNull(var13.model).getMinY();
                    if (var14 !== -32768 && var14 < var10) {
                        var10 = var14;
                    }
                }
            }
        }

        var9.height = -var10 | 0;
        if (at3(world.squares, var0, var1, var2) === null) {
            arrayPutObj(at2(world.squares, var0, var1), var2, new Square(var0, var1, var2));
        }

        requireNonNull(at3(world.squares, var0, var1, var2)).groundObject = var9;
    }

    // ae.a(IIIILug;Lug;IIJ)V
    // var0 = level, var1/var2 = tile x/z, var3 = y, var4/var5 = the two models, var6/var7 = their wall-type masks,
    // var8 = typecode.
    static SetWall(var0: number, var1: number, var2: number, var3: number, var4: ModelSource | null, var5: ModelSource | null, var6: number, var7: number, var8: bigint): void {
        if (var4 === null && var5 === null) {
            return;
        }

        const var10 = new Wall();
        var10.typecode = var8;
        var10.x = (Math.imul(var1, 128) + 64) | 0;
        var10.z = (Math.imul(var2, 128) + 64) | 0;
        var10.y = var3;
        var10.model1 = var4;
        var10.model2 = var5;
        var10.angle1 = var6;
        var10.angle2 = var7;

        for (let var11 = var0; var11 >= 0; var11--) {
            if (at3(world.squares, var11, var1, var2) === null) {
                arrayPutObj(at2(world.squares, var11, var1), var2, new Square(var11, var1, var2));
            }
        }

        requireNonNull(at3(world.squares, var0, var1, var2)).wall = var10;
    }

    // ed.a(IIIILug;Lug;IIIIJ)V
    // var0 = level, var1/var2 = tile x/z, var3 = y, var4 = model, var5 = second (diagonal) model, var6 = wall-type mask,
    // var7 = angle, var8/var9 = x/z offsets, var10 = typecode.
    static SetDecor(var0: number, var1: number, var2: number, var3: number, var4: ModelSource | null, var5: ModelSource | null, var6: number, var7: number, var8: number, var9: number, var10: bigint): void {
        if (var4 === null) {
            return;
        }

        const var12 = new Decor();
        var12.typecode = var10;
        var12.x = (Math.imul(var1, 128) + 64) | 0;
        var12.z = (Math.imul(var2, 128) + 64) | 0;
        var12.y = var3;
        var12.model = var4;
        var12.model2 = var5;
        var12.wshape = var6;
        var12.angle = var7;
        var12.offsetX = var8;
        var12.offsetZ = var9;

        for (let var13 = var0; var13 >= 0; var13--) {
            if (at3(world.squares, var13, var1, var2) === null) {
                arrayPutObj(at2(world.squares, var13, var1), var2, new Square(var13, var1, var2));
            }
        }

        requireNonNull(at3(world.squares, var0, var1, var2)).decor = var12;
    }

    // oe.a(IIIIIILug;IJ)Z
    // var0 = level, var1/var2 = tile x/z, var3 = y, var4/var5 = size in tiles, var6 = model, var7 = yaw, var8 = typecode.
    static AddScenery(var0: number, var1: number, var2: number, var3: number, var4: number, var5: number, var6: ModelSource | null, var7: number, var8: bigint): boolean {
        if (var6 === null) {
            return true;
        }

        const var10 = (Math.imul(var1, 128) + Math.imul(64, var4)) | 0;
        const var11 = (Math.imul(var2, 128) + Math.imul(64, var5)) | 0;
        return world.SetSprite(var0, var1, var2, var4, var5, var10, var11, var3, var6, var7, false, var8);
    }

    // ob.a(IIIIILug;IJZ)Z
    // var0 = level, var1/var2 = fine x/z, var3 = y, var4 = radius, var5 = model, var6 = yaw, var7 = typecode,
    // var9 = extend the bounds one tile towards the facing direction.
    static AddDynamic(var0: number, var1: number, var2: number, var3: number, var4: number, var5: ModelSource | null, var6: number, var7: bigint, var9: boolean): boolean {
        if (var5 === null) {
            return true;
        }

        let var10 = (var1 - var4) | 0;
        let var11 = (var2 - var4) | 0;
        let var12 = (var1 + var4) | 0;
        let var13 = (var2 + var4) | 0;
        if (var9) {
            if (var6 > 640 && var6 < 1408) {
                var13 = (var13 + 128) | 0;
            }

            if (var6 > 1152 && var6 < 1920) {
                var12 = (var12 + 128) | 0;
            }

            if (var6 > 1664 || var6 < 384) {
                var11 = (var11 - 128) | 0;
            }

            if (var6 > 128 && var6 < 896) {
                var10 = (var10 - 128) | 0;
            }
        }

        var10 = (var10 / 128) | 0;
        var11 = (var11 / 128) | 0;
        var12 = (var12 / 128) | 0;
        var13 = (var13 / 128) | 0;
        return world.SetSprite(var0, var10, var11, (var12 - var10 + 1) | 0, (var13 - var11 + 1) | 0, var1, var2, var3, var5, var6, true, var7);
    }

    // pa.a(IIIILug;IJIIII)Z
    // var0 = level, var1/var2 = fine x/z, var3 = y, var4 = model, var5 = yaw, var6 = typecode,
    // var8/var9 = min tile x/z, var10/var11 = max tile x/z.
    static AddDynamic2(var0: number, var1: number, var2: number, var3: number, var4: ModelSource | null, var5: number, var6: bigint, var8: number, var9: number, var10: number, var11: number): boolean {
        if (var4 === null) {
            return true;
        }

        return world.SetSprite(var0, var8, var9, (var10 - var8 + 1) | 0, (var11 - var9 + 1) | 0, var1, var2, var3, var4, var5, true, var6);
    }

    // bc.a(IIIIIIIILug;IZJ)Z
    // var0 = level, var1/var2 = min tile x/z, var3/var4 = size in tiles, var5/var6 = fine x/z, var7 = y, var8 = model,
    // var9 = yaw, var10 = temporary (cleared by world.RemoveSprites), var11 = typecode.
    static SetSprite(var0: number, var1: number, var2: number, var3: number, var4: number, var5: number, var6: number, var7: number, var8: ModelSource | null, var9: number, var10: boolean, var11: bigint): boolean {
        const var13 = world.levelHeightmaps === world.underwaterHeightmap;
        let var14 = 0;

        for (let var15 = var1; var15 < ((var1 + var3) | 0); var15++) {
            for (let var16 = var2; var16 < ((var2 + var4) | 0); var16++) {
                if (var15 < 0 || var16 < 0 || var15 >= world.maxTileX || var16 >= world.maxTileZ) {
                    return false;
                }

                const var17 = at3(world.squares, var0, var15, var16);
                if (var17 !== null && var17.spriteCount >= 5) {
                    return false;
                }
            }
        }

        const var22 = new Sprite();
        var22.typecode = var11;
        var22.level = var0;
        var22.x = var5;
        var22.z = var6;
        var22.y = var7;
        var22.model = var8;
        var22.yaw = var9;
        var22.minTileX = var1;
        var22.minTileZ = var2;
        var22.maxTileX = (var1 + var3 - 1) | 0;
        var22.maxTileZ = (var2 + var4 - 1) | 0;

        for (let var23 = var1; var23 < ((var1 + var3) | 0); var23++) {
            for (let var18 = var2; var18 < ((var2 + var4) | 0); var18++) {
                let var19 = 0;
                if (var23 > var1) {
                    var19++;
                }

                if (var23 < ((var1 + var3 - 1) | 0)) {
                    var19 += 4;
                }

                if (var18 > var2) {
                    var19 += 8;
                }

                if (var18 < ((var2 + var4 - 1) | 0)) {
                    var19 += 2;
                }

                for (let var20 = var0; var20 >= 0; var20--) {
                    if (at3(world.squares, var20, var23, var18) === null) {
                        arrayPutObj(at2(world.squares, var20, var23), var18, new Square(var20, var23, var18));
                    }
                }

                const var21 = requireNonNull(at3(world.squares, var0, var23, var18));
                arrayPutObj(var21.sprites, var21.spriteCount, var22);
                arrayPutI32(var21.spriteSpan, var21.spriteCount, var19);
                var21.spriteSpans |= var19;
                var21.spriteCount = (var21.spriteCount + 1) | 0;
                if (var13 && at2I32(world.waterSpriteKeys, var23, var18) !== 0) {
                    var14 = at2I32(world.waterSpriteKeys, var23, var18);
                }
            }
        }

        if (var13 && var14 !== 0) {
            for (let var24 = var1; var24 < ((var1 + var3) | 0); var24++) {
                for (let var25 = var2; var25 < ((var2 + var4) | 0); var25++) {
                    if (at2I32(world.waterSpriteKeys, var24, var25) === 0) {
                        arrayPutI32(arrayAtObj(world.waterSpriteKeys, var24), var25, var14);
                    }
                }
            }
        }

        if (var10) {
            // Java's a[i++] = v stores the int-wrapped increment before the array store can throw.
            const index = world.dynamicCount;
            world.dynamicCount = (index + 1) | 0;
            arrayPutObj(world.dynamicSprites, index, var22);
        }

        return true;
    }

    // q.a()V
    static RemoveSprites(): void {
        for (let var0 = 0; var0 < world.dynamicCount; var0++) {
            const var1 = arrayAtObj(world.dynamicSprites, var0);
            // bd.a dereferences its argument first, so a null slot throws there.
            world.DelSprite(requireNonNull(var1));
            arrayPutObj(world.dynamicSprites, var0, null);
        }

        world.dynamicCount = 0;
    }

    // bd.a(Lec;)V
    static DelSprite(var0: Sprite): void {
        for (let var1 = var0.minTileX; var1 <= var0.maxTileX; var1++) {
            for (let var2 = var0.minTileZ; var2 <= var0.maxTileZ; var2++) {
                const var3 = at3(world.squares, var0.level, var1, var2);
                if (var3 !== null) {
                    for (let var4 = 0; var4 < var3.spriteCount; var4++) {
                        if (arrayAtObj(var3.sprites, var4) === var0) {
                            var3.spriteCount = (var3.spriteCount - 1) | 0;

                            for (let var5 = var4; var5 < var3.spriteCount; var5++) {
                                arrayPutObj(var3.sprites, var5, arrayAtObj(var3.sprites, var5 + 1));
                                arrayPutI32(var3.spriteSpan, var5, arrayAtI32(var3.spriteSpan, var5 + 1));
                            }

                            arrayPutObj(var3.sprites, var3.spriteCount, null);
                            break;
                        }
                    }

                    var3.spriteSpans = 0;

                    for (let var6 = 0; var6 < var3.spriteCount; var6++) {
                        var3.spriteSpans = var3.spriteSpans | arrayAtI32(var3.spriteSpan, var6);
                    }
                }
            }
        }
    }

    // al.a(IIII)V
    // Scales the decor offsets on (var0, var1, var2) by var3 / 16.
    static MoveDecor(var0: number, var1: number, var2: number, var3: number): void {
        const var4 = at3(world.squares, var0, var1, var2);
        if (var4 === null) {
            return;
        }

        const var5 = var4.decor;
        if (var5 === null) {
            return;
        }

        var5.offsetX = (Math.imul(var5.offsetX, var3) / 16) | 0;
        var5.offsetZ = (Math.imul(var5.offsetZ, var3) / 16) | 0;
    }

    // wb.a(III)Lhk;
    static DelWall(var0: number, var1: number, var2: number): Wall | null {
        const var3 = at3(world.squares, var0, var1, var2);
        if (var3 === null) {
            return null;
        }

        const var4 = var3.wall;
        var3.wall = null;
        return var4;
    }

    // le.a(III)Lnf;
    static DelDecor(var0: number, var1: number, var2: number): Decor | null {
        const var3 = at3(world.squares, var0, var1, var2);
        if (var3 === null) {
            return null;
        }

        const var4 = var3.decor;
        var3.decor = null;
        return var4;
    }

    // gl.a(III)Lec;
    // NXT's DelLoc is void; 530 returns the removed loc sprite (af.a uses it).
    static DelLoc(var0: number, var1: number, var2: number): Sprite | null {
        const var3 = at3(world.squares, var0, var1, var2);
        if (var3 === null) {
            return null;
        }

        for (let var4 = 0; var4 < var3.spriteCount; var4++) {
            const var5 = requireNonNull(arrayAtObj(var3.sprites, var4));
            if (((var5.typecode >> 29n) & 3n) === 2n && var5.minTileX === var1 && var5.minTileZ === var2) {
                world.DelSprite(var5);
                return var5;
            }
        }

        return null;
    }

    // de.a(III)Lpk;
    static DelGroundDecor(var0: number, var1: number, var2: number): GroundDecor | null {
        const var3 = at3(world.squares, var0, var1, var2);
        if (var3 === null) {
            return null;
        }

        const var4 = var3.groundDecor;
        var3.groundDecor = null;
        return var4;
    }

    // bk.d(III)Lmh;
    static DelObj(var0: number, var1: number, var2: number): GroundObject | null {
        const var3 = at3(world.squares, var0, var1, var2);
        if (var3 === null) {
            return null;
        }

        const var4 = var3.groundObject;
        var3.groundObject = null;
        return var4;
    }

    // oe.a(III)Lhk;
    static GetWall(var0: number, var1: number, var2: number): Wall | null {
        const var3 = at3(world.squares, var0, var1, var2);
        if (var3 === null) {
            return null;
        }

        return var3.wall;
    }

    // la.a(III)Lnf;
    static GetDecor(var0: number, var1: number, var2: number): Decor | null {
        const var3 = at3(world.squares, var0, var1, var2);
        if (var3 === null) {
            return null;
        }

        return var3.decor;
    }

    // pg.a(III)Lpk;
    static GetGroundDecor(var0: number, var1: number, var2: number): GroundDecor | null {
        const var3 = at3(world.squares, var0, var1, var2);
        if (var3 === null || var3.groundDecor === null) {
            return null;
        }

        return var3.groundDecor;
    }

    // qa.a(III)Lec;
    // The loc sprite whose min tile is (var1, var2).
    static GetScene(var0: number, var1: number, var2: number): Sprite | null {
        const var3 = at3(world.squares, var0, var1, var2);
        if (var3 === null) {
            return null;
        }

        for (let var4 = 0; var4 < var3.spriteCount; var4++) {
            const var5 = requireNonNull(arrayAtObj(var3.sprites, var4));
            if (((var5.typecode >> 29n) & 3n) === 2n && var5.minTileX === var1 && var5.minTileZ === var2) {
                return var5;
            }
        }

        return null;
    }

    // ke.b(III)J
    static WallType(var0: number, var1: number, var2: number): bigint {
        const var3 = at3(world.squares, var0, var1, var2);
        if (var3 === null || var3.wall === null) {
            return 0n;
        }

        return var3.wall.typecode;
    }

    // gk.a(III)J
    static DecorType(var0: number, var1: number, var2: number): bigint {
        const var3 = at3(world.squares, var0, var1, var2);
        if (var3 === null || var3.decor === null) {
            return 0n;
        }

        return var3.decor.typecode;
    }

    // j.a(III)J
    static SceneType(var0: number, var1: number, var2: number): bigint {
        const var3 = at3(world.squares, var0, var1, var2);
        if (var3 === null) {
            return 0n;
        }

        for (let var4 = 0; var4 < var3.spriteCount; var4++) {
            const var5 = requireNonNull(arrayAtObj(var3.sprites, var4));
            if (((var5.typecode >> 29n) & 3n) === 2n && var5.minTileX === var1 && var5.minTileZ === var2) {
                return var5.typecode;
            }
        }

        return 0n;
    }

    // dd.a(III)J
    static GdType(var0: number, var1: number, var2: number): bigint {
        const var3 = at3(world.squares, var0, var1, var2);
        if (var3 === null || var3.groundDecor === null) {
            return 0n;
        }

        return var3.groundDecor.typecode;
    }

    // je.a(IIIJ)Z
    // Whether the wall, decor, ground decor or a sprite on the square has typecode var3. NXT's TypeCode2 walks the same
    // layers but returns the matching entity's info byte, so the member-map name is kept.
    static hasTypecode(var0: number, var1: number, var2: number, var3: bigint): boolean {
        const var5 = at3(world.squares, var0, var1, var2);
        if (var5 === null) {
            return false;
        }

        if (var5.wall !== null && var5.wall.typecode === var3) {
            return true;
        }

        if (var5.decor !== null && var5.decor.typecode === var3) {
            return true;
        }

        if (var5.groundDecor !== null && var5.groundDecor.typecode === var3) {
            return true;
        }

        for (let var6 = 0; var6 < var5.spriteCount; var6++) {
            if (requireNonNull(arrayAtObj(var5.sprites, var6)).typecode === var3) {
                return true;
            }
        }

        return false;
    }

    // mk.a(III)V
    // Lights every unlit model in the scene with the light vector (var0, var1, var2), first sharing vertex normals with
    // the neighbouring walls, sprites and ground decor.
    static ShareLight(var0: number, var1: number, var2: number): void {
        for (let var3 = 0; var3 < world.maxLevel; var3++) {
            for (let var4 = 0; var4 < world.maxTileX; var4++) {
                for (let var5 = 0; var5 < world.maxTileZ; var5++) {
                    const var6 = at3(world.squares, var3, var4, var5);
                    if (var6 !== null) {
                        const var7 = var6.wall;
                        if (var7 !== null && requireNonNull(var7.model1).isUnlit()) {
                            world.ShareLightLoc(requireNonNull(var7.model1), var3, var4, var5, 1, 1);
                            if (var7.model2 !== null && var7.model2.isUnlit()) {
                                world.ShareLightLoc(var7.model2, var3, var4, var5, 1, 1);
                                requireNonNull(var7.model1).mergeNormals(var7.model2, 0, 0, 0, false);
                                var7.model2 = var7.model2.light(var0, var1, var2);
                            }

                            var7.model1 = requireNonNull(var7.model1).light(var0, var1, var2);
                        }

                        for (let var8 = 0; var8 < var6.spriteCount; var8++) {
                            const var9 = arrayAtObj(var6.sprites, var8);
                            if (var9 !== null && requireNonNull(var9.model).isUnlit()) {
                                world.ShareLightLoc(requireNonNull(var9.model), var3, var4, var5, (var9.maxTileX - var9.minTileX + 1) | 0, (var9.maxTileZ - var9.minTileZ + 1) | 0);
                                var9.model = requireNonNull(var9.model).light(var0, var1, var2);
                            }
                        }

                        const var10 = var6.groundDecor;
                        if (var10 !== null && requireNonNull(var10.model).isUnlit()) {
                            world.ShareLightGd(requireNonNull(var10.model), var3, var4, var5);
                            var10.model = requireNonNull(var10.model).light(var0, var1, var2);
                        }
                    }
                }
            }
        }
    }

    // pb.a(Lug;IIIII)V
    // var0 = the model, var1 = level, var2/var3 = tile x/z, var4/var5 = size in tiles. Shares normals with the walls
    // and sprites on the tiles around it, on its level and the one above.
    static ShareLightLoc(var0: ModelSource, var1: number, var2: number, var3: number, var4: number, var5: number): void {
        let var6 = true;
        let var7 = var2;
        const var8 = (var2 + var4) | 0;
        const var9 = (var3 - 1) | 0;
        const var10 = (var3 + var5) | 0;

        for (let var11 = var1; var11 <= ((var1 + 1) | 0); var11++) {
            if (var11 !== world.maxLevel) {
                for (let var12 = var7; var12 <= var8; var12++) {
                    if (var12 < 0 || var12 >= world.maxTileX) {
                        continue;
                    }

                    for (let var13 = var9; var13 <= var10; var13++) {
                        if (var13 < 0 || var13 >= world.maxTileZ) {
                            continue;
                        }

                        if (var6 && var12 < var8 && var13 < var10 && (var13 >= var3 || var12 === var2)) {
                            continue;
                        }

                        const var14 = at3(world.squares, var11, var12, var13);
                        if (var14 === null) {
                            continue;
                        }

                        const var15 =
                            (((((at3I32(world.levelHeightmaps, var11, var12, var13) +
                                at3I32(world.levelHeightmaps, var11, var12 + 1, var13) +
                                at3I32(world.levelHeightmaps, var11, var12, var13 + 1) +
                                at3I32(world.levelHeightmaps, var11, var12 + 1, var13 + 1)) |
                                0) /
                                4) |
                                0) -
                                ((((at3I32(world.levelHeightmaps, var1, var2, var3) +
                                    at3I32(world.levelHeightmaps, var1, var2 + 1, var3) +
                                    at3I32(world.levelHeightmaps, var1, var2, var3 + 1) +
                                    at3I32(world.levelHeightmaps, var1, var2 + 1, var3 + 1)) |
                                    0) /
                                    4) |
                                    0)) |
                            0;
                        const var16 = var14.wall;
                        if (var16 !== null) {
                            if (requireNonNull(var16.model1).isUnlit()) {
                                var0.mergeNormals(requireNonNull(var16.model1), (Math.imul((var12 - var2) | 0, 128) + Math.imul((1 - var4) | 0, 64)) | 0, var15, (Math.imul((var13 - var3) | 0, 128) + Math.imul((1 - var5) | 0, 64)) | 0, var6);
                            }

                            if (var16.model2 !== null && var16.model2.isUnlit()) {
                                var0.mergeNormals(var16.model2, (Math.imul((var12 - var2) | 0, 128) + Math.imul((1 - var4) | 0, 64)) | 0, var15, (Math.imul((var13 - var3) | 0, 128) + Math.imul((1 - var5) | 0, 64)) | 0, var6);
                            }
                        }

                        for (let var17 = 0; var17 < var14.spriteCount; var17++) {
                            const var18 = arrayAtObj(var14.sprites, var17);
                            if (var18 === null || !requireNonNull(var18.model).isUnlit()) {
                                continue;
                            }

                            if (var12 !== var18.minTileX && var12 !== var7) {
                                continue;
                            }

                            if (var13 !== var18.minTileZ && var13 !== var9) {
                                continue;
                            }

                            const var19 = (var18.maxTileX - var18.minTileX + 1) | 0;
                            const var20 = (var18.maxTileZ - var18.minTileZ + 1) | 0;
                            var0.mergeNormals(
                                requireNonNull(var18.model),
                                (Math.imul((var18.minTileX - var2) | 0, 128) + Math.imul((var19 - var4) | 0, 64)) | 0,
                                var15,
                                (Math.imul((var18.minTileZ - var3) | 0, 128) + Math.imul((var20 - var5) | 0, 64)) | 0,
                                var6
                            );
                        }
                    }
                }

                var7--;
                var6 = false;
            }
        }
    }

    // qf.a(Lug;III)V
    // var0 = the ground decor model, var1 = level, var2/var3 = tile x/z. The z bound of the second test is maxTileX in
    // the jar too.
    static ShareLightGd(var0: ModelSource, var1: number, var2: number, var3: number): void {
        if (var2 < world.maxTileX) {
            const var4 = at3(world.squares, var1, var2 + 1, var3);
            if (var4 !== null && var4.groundDecor !== null && requireNonNull(var4.groundDecor.model).isUnlit()) {
                var0.mergeNormals(requireNonNull(var4.groundDecor.model), 128, 0, 0, true);
            }
        }

        if (var3 < world.maxTileX) {
            const var5 = at3(world.squares, var1, var2, var3 + 1);
            if (var5 !== null && var5.groundDecor !== null && requireNonNull(var5.groundDecor.model).isUnlit()) {
                var0.mergeNormals(requireNonNull(var5.groundDecor.model), 0, 0, 128, true);
            }
        }

        if (var2 < world.maxTileX && var3 < world.maxTileZ) {
            const var6 = at3(world.squares, var1, var2 + 1, var3 + 1);
            if (var6 !== null && var6.groundDecor !== null && requireNonNull(var6.groundDecor.model).isUnlit()) {
                var0.mergeNormals(requireNonNull(var6.groundDecor.model), 128, 0, 128, true);
            }
        }

        if (var2 < world.maxTileX && var3 > 0) {
            const var7 = at3(world.squares, var1, var2 + 1, var3 - 1);
            if (var7 !== null && var7.groundDecor !== null && requireNonNull(var7.groundDecor.model).isUnlit()) {
                var0.mergeNormals(requireNonNull(var7.groundDecor.model), 128, 0, -128, true);
            }
        }
    }

    // ob.a(II)I
    // The wall-type mask for a packed loc value var0: low 6 bits 18 give the straight-wall masks 1/2/4/8 and 19 or 21 the
    // corner masks 16/32/64/128, picked by bits 6-7. The counter ob.R, the dummy second argument (its three callers in
    // ga all pass -13520) with its guard, and the RuntimeException wrapper are stripped; the ~x == -n tests are written
    // x == n - 1 and the obfuscated shift distance -926622810 as 6.
    static wallTypeMask(var0: number): number {
        const var2 = 63 & var0;
        const var3 = 3 & (var0 >> 6);
        if (var2 !== 18) {
            if (var2 === 19 || var2 === 21) {
                if (var3 === 0) {
                    return 16;
                }

                if (var3 === 1) {
                    return 32;
                }

                if (var3 === 2) {
                    return 64;
                }

                if (var3 === 3) {
                    return 128;
                }
            }
        } else {
            if (var3 === 0) {
                return 1;
            }

            if (var3 === 1) {
                return 2;
            }

            if (var3 === 2) {
                return 4;
            }

            if (var3 === 3) {
                return 8;
            }
        }

        return 0;
    }

    // vg.a([IIIIII)V
    // Draws the 4x4 minimap block of (var3, var4, var5) into var0 at offset var1, row stride var2.
    static Render2DGround(var0: Int32Array | null, var1: number, var2: number, var3: number, var4: number, var5: number): void {
        const var6 = at3(world.squares, var3, var4, var5);
        if (var6 === null) {
            return;
        }

        const var7 = var6.quickGround;
        if (var7 !== null) {
            const var8 = var7.minimapRgb;
            if (var8 === 0) {
                return;
            }

            for (let var9 = 0; var9 < 4; var9++) {
                arrayPutI32(var0, var1, var8);
                arrayPutI32(var0, var1 + 1, var8);
                arrayPutI32(var0, var1 + 2, var8);
                arrayPutI32(var0, var1 + 3, var8);
                var1 = (var1 + var2) | 0;
            }

            return;
        }

        const var17 = var6.ground;
        if (var17 === null) {
            return;
        }

        const var18 = var17.shape;
        const var10 = var17.rotation;
        const var11 = var17.minimapOverlay;
        const var12 = var17.minimapUnderlay;
        const var13 = arrayAtObj(world.minimapShape, var18);
        const var14 = arrayAtObj(world.minimapRotate, var10);
        let var15 = 0;
        if (var11 !== 0) {
            for (let var25 = 0; var25 < 4; var25++) {
                arrayPutI32(var0, var1, arrayAtI32(var13, arrayAtI32(var14, var15++)) === 0 ? var11 : var12);
                arrayPutI32(var0, var1 + 1, arrayAtI32(var13, arrayAtI32(var14, var15++)) === 0 ? var11 : var12);
                arrayPutI32(var0, var1 + 2, arrayAtI32(var13, arrayAtI32(var14, var15++)) === 0 ? var11 : var12);
                arrayPutI32(var0, var1 + 3, arrayAtI32(var13, arrayAtI32(var14, var15++)) === 0 ? var11 : var12);
                var1 = (var1 + var2) | 0;
            }

            return;
        }

        for (let var16 = 0; var16 < 4; var16++) {
            if (arrayAtI32(var13, arrayAtI32(var14, var15++)) !== 0) {
                arrayPutI32(var0, var1, var12);
            }

            if (arrayAtI32(var13, arrayAtI32(var14, var15++)) !== 0) {
                arrayPutI32(var0, var1 + 1, var12);
            }

            if (arrayAtI32(var13, arrayAtI32(var14, var15++)) !== 0) {
                arrayPutI32(var0, var1 + 2, var12);
            }

            if (arrayAtI32(var13, arrayAtI32(var14, var15++)) !== 0) {
                arrayPutI32(var0, var1 + 3, var12);
            }

            var1 = (var1 + var2) | 0;
        }
    }

    // sc.a(III)V
    static updateMousePicking(var0: number, var1: number, var2: number): void {
        world.takingInput = true;
        world.clickLevel = var0;
        world.clickX = var1;
        world.clickY = var2;
        world.groundX = -1;
        world.groundZ = -1;
    }

    // qc.a(IIIII[[[B[I[I[I[I[IIBII)V
    // The scene draw: var0/var1/var2 = eye x/y/z, var3 = pitch, var4 = yaw, var5 = the per-tile roof level bytes,
    // var6..var10 = the hidden-roof areas (y, min x, max x, max z, min z), var11 = the first level var5 applies to,
    // var12 = the roof level byte that hides a square, var13/var14 = the tile around which locs animate.
    // NXT splits this into PrepRender and Render; this routine is both (plus the visibility map and roof areas), so the
    // member-map name is kept.
    static draw(
        var0: number,
        var1: number,
        var2: number,
        var3: number,
        var4: number,
        var5: Uint8Array[][] | null,
        var6: Int32Array | null,
        var7: Int32Array | null,
        var8: Int32Array | null,
        var9: Int32Array | null,
        var10: Int32Array | null,
        var11: number,
        var12: number,
        var13: number,
        var14: number
    ): void {
        if (var0 < 0) {
            var0 = 0;
        } else if (var0 >= Math.imul(world.maxTileX, 128)) {
            var0 = (Math.imul(world.maxTileX, 128) - 1) | 0;
        }

        if (var2 < 0) {
            var2 = 0;
        } else if (var2 >= Math.imul(world.maxTileZ, 128)) {
            var2 = (Math.imul(world.maxTileZ, 128) - 1) | 0;
        }

        world.cameraSinX = arrayAtI32(Pix3D.sinTable, var3);
        world.cameraCosX = arrayAtI32(Pix3D.cosTable, var3);
        world.cameraSinY = arrayAtI32(Pix3D.sinTable, var4);
        world.cameraCosY = arrayAtI32(Pix3D.cosTable, var4);
        world.cx = var0;
        world.cy = var1;
        world.cz = var2;
        const previousTileX = world.gx;
        const previousTileZ = world.eyeTileZ;
        world.gx = (var0 / 128) | 0;
        world.eyeTileZ = (var2 / 128) | 0;
        world.minX = (world.gx - world.viewRadius) | 0;
        if (world.minX < 0) {
            world.minX = 0;
        }

        world.minZ = (world.eyeTileZ - world.viewRadius) | 0;
        if (world.minZ < 0) {
            world.minZ = 0;
        }

        world.maxX = (world.gx + world.viewRadius) | 0;
        if (world.maxX > world.maxTileX) {
            world.maxX = world.maxTileX;
        }

        world.maxZ = (world.eyeTileZ + world.viewRadius) | 0;
        if (world.maxZ > world.maxTileZ) {
            world.maxZ = world.maxTileZ;
        }

        const renderer = glJar ? (rendererClass ??= loadGlRenderer()) : null;
        const var15 = renderer?.active ? renderer.sceneFar : 3500;

        const corners = (world.viewRadius + world.viewRadius + 2) | 0;
        let firstX = 0,
            firstZ = 0,
            endX = corners,
            endZ = corners;
        if (renderer?.active && Preferences.graphicsMode !== 'standard') {
            // The extended visibility mask is camera-relative. Only the loaded rectangle
            // contains heights; clear the old mask when its position on this grid moves.
            firstX = Math.max(0, world.viewRadius - world.gx);
            firstZ = Math.max(0, world.viewRadius - world.eyeTileZ);
            endX = Math.min(corners, world.viewRadius - world.gx + world.maxTileX);
            endZ = Math.min(corners, world.viewRadius - world.eyeTileZ + world.maxTileZ);
            if (previousTileX !== world.gx || previousTileZ !== world.eyeTileZ) {
                for (const row of requireNonNull(world.cornerVisibility)) row.fill(false);
                for (const row of requireNonNull(world.visibilityMap)) row.fill(false);
            }
        }
        const directRows = renderer?.active && world.testColumn === originalTestColumn;
        const groundPlane = directRows ? (world.underwaterHeightmap ?? world.mainGroundh)?.[0] : null;
        const upperPlane = directRows ? world.mainGroundh?.[3] : null;
        const firstWorldZ = world.eyeTileZ - world.viewRadius + firstZ;
        const endWorldZ = world.eyeTileZ - world.viewRadius + endZ;
        for (let var16 = firstX; var16 < endX; var16++) {
            // On a complete terrain row the native column test only reads the camera and clip.
            // Heights still come from the live arrays, even when the camera stays on the same tile.
            if (directRows && firstWorldZ >= 0 && endWorldZ <= world.maxTileZ) {
                const tileX = world.gx - world.viewRadius + var16;
                const ground = groundPlane?.[tileX];
                const upper = upperPlane?.[tileX];
                const result = world.cornerVisibility?.[var16];
                if (tileX >= 0 && tileX < world.maxTileX && ground instanceof Int32Array && upper instanceof Int32Array && ground.length >= endWorldZ && upper.length >= endWorldZ && result && result.length >= endZ) {
                    const dx = (((var16 - world.viewRadius) << 7) - (world.cx & 127)) | 0;
                    for (let j = firstZ, z = firstWorldZ; j < endZ; j++, z++) {
                        const dz = (((j - world.viewRadius) << 7) - (world.cz & 127)) | 0;
                        const bottom = (ground[z] - world.cy + 128) | 0;
                        const top = (upper[z] - world.cy - 1000) | 0;
                        result[j] = world.testColumn(dx, top, bottom, dz, var15);
                    }
                    continue;
                }
            }
            for (let var17 = firstZ; var17 < endZ; var17++) {
                const var18 = (((var16 - world.viewRadius) << 7) - (world.cx & 127)) | 0;
                const var19 = (((var17 - world.viewRadius) << 7) - (world.cz & 127)) | 0;
                const var20 = (world.gx - world.viewRadius + var16) | 0;
                const var21 = (world.eyeTileZ - world.viewRadius + var17) | 0;
                if (var20 >= 0 && var21 >= 0 && var20 < world.maxTileX && var21 < world.maxTileZ) {
                    let var22: number;
                    if (world.underwaterHeightmap !== null) {
                        var22 = (at3I32(world.underwaterHeightmap, 0, var20, var21) - world.cy + 128) | 0;
                    } else {
                        var22 = (at3I32(world.mainGroundh, 0, var20, var21) - world.cy + 128) | 0;
                    }

                    const var23 = (at3I32(world.mainGroundh, 3, var20, var21) - world.cy - 1000) | 0;
                    arrayPutObj(arrayAtObj(world.cornerVisibility, var16), var17, world.testColumn(var18, var23, var22, var19, var15));
                } else {
                    arrayPutObj(arrayAtObj(world.cornerVisibility, var16), var17, false);
                }
            }
        }

        // Each visible corner also contributes to the tile on its lower-index side.
        const tileEndX = Math.min(corners - 1, endX),
            tileEndZ = Math.min(corners - 1, endZ);
        for (let var24 = Math.max(0, firstX - 1); var24 < tileEndX; var24++) {
            if (directRows) {
                const row = world.cornerVisibility?.[var24];
                const next = world.cornerVisibility?.[var24 + 1];
                const visible = world.visibilityMap?.[var24];
                if (row && row.length > tileEndZ && next && next.length > tileEndZ && visible && visible.length >= tileEndZ) {
                    for (let z = Math.max(0, firstZ - 1); z < tileEndZ; z++) visible[z] = row[z] || next[z] || row[z + 1] || next[z + 1];
                    continue;
                }
            }
            for (let var25 = Math.max(0, firstZ - 1); var25 < tileEndZ; var25++) {
                arrayPutObj(
                    arrayAtObj(world.visibilityMap, var24),
                    var25,
                    at2(world.cornerVisibility, var24, var25) || at2(world.cornerVisibility, var24 + 1, var25) || at2(world.cornerVisibility, var24, var25 + 1) || at2(world.cornerVisibility, var24 + 1, var25 + 1)
                );
            }
        }

        world.hiddenRoofY = var6;
        world.roofMinX = var7;
        world.hideAreaMaxX = var8;
        world.roofHideMaxZ = var9;
        world.roofHideMinZ = var10;
        world.CalcOcclude();
        if (world.underwaterSquares !== null) {
            world.setUnderwater(true);
            world.Render(var0, var1, var2, null, 0, 0, var13, var14);
            if (renderer?.active) {
                const materials = (materialManagerClass ??= loadMaterialManager());
                materials.locked = false;
                materials.setMaterial(0, 0);
                (lightingClass ??= loadGlLighting()).applyFogColour(null);
                (pointLightsClass ??= loadPointLightManager()).clearSlots();
            }
            world.setUnderwater(false);
        }

        world.Render(var0, var1, var2, var5, var11, var12, var13, var14);
    }

    // HD mf.a()V, below-water prepass of the surface's water materials.
    private static drawWaterSurface(): void {
        const renderer = (rendererClass ??= loadGlRenderer());
        const materials = (materialManagerClass ??= loadMaterialManager());
        const gl = renderer.gl;
        requireNonNull(gl).glDisableClientState(GL.GL_COLOR_ARRAY);
        renderer.setLighting(false);
        requireNonNull(gl).glDisable(GL.GL_DEPTH_TEST);
        requireNonNull(gl).glPushAttrib(GL.GL_FOG_BIT);
        requireNonNull(gl).glFogf(GL.GL_FOG_START, renderer.sceneFar - 512);
        renderer.disableDepthWrite();
        for (let i = 0; i < requireNonNull(arrayAtObj(world.mainTerrainBatches, 0)).length; i++) {
            const batch = requireNonNull(arrayAtObj(arrayAtObj(world.mainTerrainBatches, 0), i));
            if (batch.texture < 0 || (requireNonNull(Pix3D.textureProvider) as HdTextureProvider).materialType(batch.texture) !== 4) continue;
            requireNonNull(gl).glColor4fv(materials.waterSurfaceColour(batch.waterColour), 0);
            batch.draw(world.squares, 201.5 - (batch.blend ? 1 : 0.5), true);
        }
        requireNonNull(gl).glEnableClientState(GL.GL_COLOR_ARRAY);
        renderer.applyLightingPreference();
        requireNonNull(gl).glEnable(GL.GL_DEPTH_TEST);
        requireNonNull(gl).glPopAttrib();
        renderer.enableDepthWrite();
    }

    // q.a(IIIII)Z
    // Whether the vertical span (var1 top, var2 bottom) at eye-relative (var0, var3) lands on screen within var4 depth.
    static testColumn(var0: number, var1: number, var2: number, var3: number, var4: number): boolean {
        const var5 = (Math.imul(var3, world.cameraSinY) + Math.imul(var0, world.cameraCosY)) >> 16;
        const var6 = (Math.imul(var3, world.cameraCosY) - Math.imul(var0, world.cameraSinY)) >> 16;
        let var7 = (Math.imul(var1, world.cameraSinX) + Math.imul(var6, world.cameraCosX)) >> 16;
        const var8 = (Math.imul(var1, world.cameraCosX) - Math.imul(var6, world.cameraSinX)) >> 16;
        if (var7 < 1) {
            var7 = 1;
        }

        const var9 = ((var5 << 9) / var7) | 0;
        const var10 = ((var8 << 9) / var7) | 0;
        let var11 = (Math.imul(var2, world.cameraSinX) + Math.imul(var6, world.cameraCosX)) >> 16;
        const var12 = (Math.imul(var2, world.cameraCosX) - Math.imul(var6, world.cameraSinX)) >> 16;
        if (var11 < 1) {
            var11 = 1;
        }

        const var13 = ((var5 << 9) / var11) | 0;
        const var14 = ((var12 << 9) / var11) | 0;
        if (var7 < 50 && var11 < 50) {
            return false;
        }

        if (var7 > var4 && var11 > var4) {
            return false;
        }

        if (var9 < Pix3D.clipMinX && var13 < Pix3D.clipMinX) {
            return false;
        }

        if (var9 > Pix3D.clipMaxX && var13 > Pix3D.clipMaxX) {
            return false;
        }

        if (var10 < Pix3D.clipMinY && var14 < Pix3D.clipMinY) {
            return false;
        }

        if (var10 > Pix3D.clipMaxY && var14 > Pix3D.clipMaxY) {
            return false;
        }

        return true;
    }

    // ke.a()V
    // Picks the occluders that are in view and not inside a hidden-roof area, and computes their per-256 slopes from the eye.
    static CalcOcclude(): void {
        world.numActiveOccluders = 0;

        label190: for (let var0 = 0; var0 < world.numOccluders; var0++) {
            const var1 = requireNonNull(arrayAtObj(world.occluders, var0));
            if (world.hiddenRoofY !== null) {
                for (let var2 = 0; var2 < world.hiddenRoofY.length; var2++) {
                    if (
                        arrayAtI32(world.hiddenRoofY, var2) !== -1000000 &&
                        (var1.minY <= arrayAtI32(world.hiddenRoofY, var2) || var1.maxY <= arrayAtI32(world.hiddenRoofY, var2)) &&
                        (var1.minX <= arrayAtI32(world.hideAreaMaxX, var2) || var1.maxX <= arrayAtI32(world.hideAreaMaxX, var2)) &&
                        (var1.minX >= arrayAtI32(world.roofMinX, var2) || var1.maxX >= arrayAtI32(world.roofMinX, var2)) &&
                        (var1.minZ <= arrayAtI32(world.roofHideMaxZ, var2) || var1.maxZ <= arrayAtI32(world.roofHideMaxZ, var2)) &&
                        (var1.minZ >= arrayAtI32(world.roofHideMinZ, var2) || var1.maxZ >= arrayAtI32(world.roofHideMinZ, var2))
                    ) {
                        continue label190;
                    }
                }
            }

            if (var1.type === 1) {
                const var12 = (var1.minTileX - world.gx + world.viewRadius) | 0;
                if (var12 < 0 || var12 > ((world.viewRadius + world.viewRadius) | 0)) {
                    continue;
                }

                let var14 = (var1.minTileZ - world.eyeTileZ + world.viewRadius) | 0;
                if (var14 < 0) {
                    var14 = 0;
                }

                let var16 = (var1.maxTileZ - world.eyeTileZ + world.viewRadius) | 0;
                if (var16 > ((world.viewRadius + world.viewRadius) | 0)) {
                    var16 = (world.viewRadius + world.viewRadius) | 0;
                }

                let var18 = false;

                while (var14 <= var16) {
                    if (at2(world.visibilityMap, var12, var14++)) {
                        var18 = true;
                        break;
                    }
                }

                if (!var18) {
                    continue;
                }

                let var20 = (world.cx - var1.minX) | 0;
                if (var20 > 32) {
                    var1.mode = 1;
                } else {
                    if (var20 >= -32) {
                        continue;
                    }

                    var1.mode = 2;
                    var20 = -var20 | 0;
                }

                var1.minDeltaZ = (((var1.minZ - world.cz) << 8) / var20) | 0;
                var1.maxDeltaZ = (((var1.maxZ - world.cz) << 8) / var20) | 0;
                var1.minDeltaY = (((var1.minY - world.cy) << 8) / var20) | 0;
                var1.maxDeltaY = (((var1.maxY - world.cy) << 8) / var20) | 0;
                // Java's a[i++] = v stores the int-wrapped increment before the array store can throw.
                const index = world.numActiveOccluders;
                world.numActiveOccluders = (index + 1) | 0;
                arrayPutObj(world.activeOccluders, index, var1);
            } else if (var1.type === 2) {
                const var11 = (var1.minTileZ - world.eyeTileZ + world.viewRadius) | 0;
                if (var11 < 0 || var11 > ((world.viewRadius + world.viewRadius) | 0)) {
                    continue;
                }

                let var13 = (var1.minTileX - world.gx + world.viewRadius) | 0;
                if (var13 < 0) {
                    var13 = 0;
                }

                let var15 = (var1.maxTileX - world.gx + world.viewRadius) | 0;
                if (var15 > ((world.viewRadius + world.viewRadius) | 0)) {
                    var15 = (world.viewRadius + world.viewRadius) | 0;
                }

                let var17 = false;

                while (var13 <= var15) {
                    if (at2(world.visibilityMap, var13++, var11)) {
                        var17 = true;
                        break;
                    }
                }

                if (!var17) {
                    continue;
                }

                let var19 = (world.cz - var1.minZ) | 0;
                if (var19 > 32) {
                    var1.mode = 3;
                } else {
                    if (var19 >= -32) {
                        continue;
                    }

                    var1.mode = 4;
                    var19 = -var19 | 0;
                }

                var1.minDeltaX = (((var1.minX - world.cx) << 8) / var19) | 0;
                var1.maxDeltaX = (((var1.maxX - world.cx) << 8) / var19) | 0;
                var1.minDeltaY = (((var1.minY - world.cy) << 8) / var19) | 0;
                var1.maxDeltaY = (((var1.maxY - world.cy) << 8) / var19) | 0;
                // Java's a[i++] = v stores the int-wrapped increment before the array store can throw.
                const index = world.numActiveOccluders;
                world.numActiveOccluders = (index + 1) | 0;
                arrayPutObj(world.activeOccluders, index, var1);
            } else if (var1.type === 4) {
                const var10 = (var1.minY - world.cy) | 0;
                if (var10 <= 128) {
                    continue;
                }

                let var3 = (var1.minTileZ - world.eyeTileZ + world.viewRadius) | 0;
                if (var3 < 0) {
                    var3 = 0;
                }

                let var4 = (var1.maxTileZ - world.eyeTileZ + world.viewRadius) | 0;
                if (var4 > ((world.viewRadius + world.viewRadius) | 0)) {
                    var4 = (world.viewRadius + world.viewRadius) | 0;
                }

                if (var3 > var4) {
                    continue;
                }

                let var5 = (var1.minTileX - world.gx + world.viewRadius) | 0;
                if (var5 < 0) {
                    var5 = 0;
                }

                let var6 = (var1.maxTileX - world.gx + world.viewRadius) | 0;
                if (var6 > ((world.viewRadius + world.viewRadius) | 0)) {
                    var6 = (world.viewRadius + world.viewRadius) | 0;
                }

                let var7 = false;

                label159: for (let var8 = var5; var8 <= var6; var8++) {
                    for (let var9 = var3; var9 <= var4; var9++) {
                        if (at2(world.visibilityMap, var8, var9)) {
                            var7 = true;
                            break label159;
                        }
                    }
                }

                if (var7) {
                    var1.mode = 5;
                    var1.minDeltaX = (((var1.minX - world.cx) << 8) / var10) | 0;
                    var1.maxDeltaX = (((var1.maxX - world.cx) << 8) / var10) | 0;
                    var1.minDeltaZ = (((var1.minZ - world.cz) << 8) / var10) | 0;
                    var1.maxDeltaZ = (((var1.maxZ - world.cz) << 8) / var10) | 0;
                    // Java's a[i++] = v stores the int-wrapped increment before the array store can throw.
                    const index = world.numActiveOccluders;
                    world.numActiveOccluders = (index + 1) | 0;
                    arrayPutObj(world.activeOccluders, index, var1);
                }
            }
        }
    }

    // ad.a(III[[[BIBII)V
    // NXT world::Render after its CalcOcclude call (530 makes that call in world.draw, once for both passes; the cycle
    // increment NXT does in PrepRender is here). var0..var2 = eye (unused), var3 = the per-tile roof level bytes or null,
    // var4 = the first level var3 applies to, var5 = the roof level byte that hides a square, var6/var7 = the tile
    // within 16 tiles of which hidden squares still advance their animated models.
    static Render(var0: number, var1: number, var2: number, var3: Uint8Array[][] | null, var4: number, var5: number, var6: number, var7: number): void {
        const enhanced = Preferences.enhancedGraphicsEnabled ? (rendererClass ??= loadGlRenderer()).stressDrawable?.currentTargets()?.worldSunlight : null;
        const sunlight = world.levelHeightmaps !== world.underwaterHeightmap ? enhanced : null;
        const casterClass = sunlight ? loadGlModel() : null;
        world.cycleNo = (world.cycleNo + 1) | 0;
        world.fillLeft = 0;
        const var8 = (var6 - 16) | 0;
        const var9 = (var6 + 16) | 0;
        const var10 = (var7 - 16) | 0;
        const var11 = (var7 + 16) | 0;

        for (let var12 = world.minLevel; var12 < world.maxLevel; var12++) {
            const var13 = arrayAtObj(world.squares, var12);

            for (let var14 = world.minX; var14 < world.maxX; var14++) {
                for (let var15 = world.minZ; var15 < world.maxZ; var15++) {
                    const var16 = at2(var13, var14, var15);
                    if (var16 !== null) {
                        if (sunlight && casterClass) sunlight.collectTile(var16, casterClass);
                        if (!at2(world.visibilityMap, var14 - world.gx + world.viewRadius, var15 - world.eyeTileZ + world.viewRadius) || (var3 !== null && var12 >= var4 && (byteAt(at2(var3, var12, var14), var15) << 24) >> 24 === var5)) {
                            var16.drawFront = false;
                            var16.drawBack = false;
                            var16.cornerSides = 0;
                            if (var14 >= var8 && var14 <= var9 && var15 >= var10 && var15 <= var11) {
                                if (var16.wall !== null) {
                                    const var17 = var16.wall;
                                    requireNonNull(var17.model1).update(0, var12, var17.y, var17.x, var17.z);
                                    if (var17.model2 !== null) {
                                        var17.model2.update(0, var12, var17.y, var17.x, var17.z);
                                    }
                                }

                                if (var16.decor !== null) {
                                    const var30 = var16.decor;
                                    requireNonNull(var30.model).update(var30.angle, var12, var30.y, var30.x, var30.z);
                                    if (var30.model2 !== null) {
                                        var30.model2.update(var30.angle, var12, var30.y, var30.x, var30.z);
                                    }
                                }

                                if (var16.groundDecor !== null) {
                                    const var31 = var16.groundDecor;
                                    requireNonNull(var31.model).update(0, var12, var31.y, var31.x, var31.z);
                                }

                                if (var16.sprites !== null) {
                                    for (let var32 = 0; var32 < var16.spriteCount; var32++) {
                                        const var18 = requireNonNull(arrayAtObj(var16.sprites, var32));
                                        requireNonNull(var18.model).update(var18.yaw, var12, var18.y, var18.x, var18.z);
                                    }
                                }
                            }
                        } else {
                            var16.drawFront = true;
                            var16.drawBack = true;
                            if (var16.spriteCount > 0) {
                                var16.drawSprites = true;
                            } else {
                                var16.drawSprites = false;
                            }

                            world.fillLeft = (world.fillLeft + 1) | 0;
                        }
                    }
                }
            }
        }

        const var24 = world.levelHeightmaps === world.underwaterHeightmap;
        const renderer = glJar ? (rendererClass ??= loadGlRenderer()) : null;
        if (renderer?.active) {
            const gl = renderer.gl;
            const materials = (materialManagerClass ??= loadMaterialManager());
            requireNonNull(gl).glPushMatrix();
            requireNonNull(gl).glTranslatef(-var0 | 0, -var1 | 0, -var2 | 0);
            if (var24) {
                world.drawWaterSurface();
                if (enhanced && world.mainTerrainBatches?.[0]) {
                    enhanced.waterSurface = world.mainGroundh?.[0] ?? null;
                    enhanced.waterBottom = world.underwaterHeightmap?.[0] ?? null;
                    enhanced.prepareBanks(world.mainTerrainBatches[0]);
                }
                materials.setMaterial(-1, 3);
                materials.locked = true;
                // eslint-disable-next-line @typescript-eslint/no-require-imports -- UnderwaterMaterial stays deferred until ad.a(III[[[BIBII)V in world.Render.
                const water = (require('#/gl/material/UnderwaterMaterial') as typeof import('#/gl/material/UnderwaterMaterial')).default;
                water.enableRampCoordArray();
                world.waterColour = -1;
                world.waterDepth = -1;
                for (let i = 0; i < requireNonNull(arrayAtObj(world.terrainBatches, 0)).length; i++) {
                    const batch = requireNonNull(arrayAtObj(arrayAtObj(world.terrainBatches, 0), i));
                    const bias = 251.5 - (batch.blend ? 1 : 0.5);
                    if (batch.waterColour !== world.waterColour) {
                        world.waterColour = batch.waterColour;
                        materials.setUnderwaterColour(batch.waterColour);
                        (lightingClass ??= loadGlLighting()).applyFogColour(materials.underwaterFogColour());
                    }
                    batch.draw(world.squares, bias, false, enhanced?.bankTiles ? enhanced : undefined, true);
                    if (enhanced) enhanced.drawingBed = false;
                }
                if (enhanced) enhanced.waterSurface = enhanced.waterBottom = null;
                water.disableRampCoordArray();
            } else {
                for (let level = world.minLevel; level < world.maxLevel; level++) {
                    if (sunlight && level === 0) {
                        sunlight.waterSurface = world.mainGroundh?.[0] ?? null;
                        sunlight.waterBottom = world.underwaterHeightmap?.[0] ?? null;
                        sunlight.prepareBanks(requireNonNull(arrayAtObj(world.terrainBatches, level)));
                    }
                    for (let i = 0; i < requireNonNull(arrayAtObj(world.terrainBatches, level)).length; i++) {
                        const batch = requireNonNull(arrayAtObj(arrayAtObj(world.terrainBatches, level), i));
                        if (sunlight) batch.collectSunlight(sunlight);
                        const bank = sunlight && level === 0 && sunlight.waterBottom !== null && sunlight.banks.has(batch) ? sunlight : undefined;
                        const bias = 201.5 - 50 * level - (batch.blend ? 1 : 0.5);
                        if (batch.texture !== -1 && (requireNonNull(Pix3D.textureProvider) as HdTextureProvider).materialType(batch.texture) === 4 && Preferences.graphics.highWaterDetail) materials.setUnderwaterColour(batch.waterColour);
                        batch.draw(world.squares, bias, false, bank);
                        if (bank) bank.drawingBank = false;
                    }
                    if (sunlight) {
                        sunlight.drawingBank = false;
                        sunlight.waterSurface = sunlight.waterBottom = null;
                    }
                    if (level === 0 && Preferences.graphics.sceneryShadows > 0 && !sunlight) {
                        renderer.setLevelDepthBias(101.5);
                        // eslint-disable-next-line @typescript-eslint/no-require-imports -- HD tj stays deferred until ad.a(III[[[BIBII)V in world.Render.
                        const shadows = (require('./GroundShadows') as typeof import('./GroundShadows')).default;
                        shadows.draw(world.gx, world.eyeTileZ, world.viewRadius, var1, world.visibilityMap, arrayAtObj(world.levelHeightmaps, 0));
                    }
                }
                (pointLightsClass ??= loadPointLightManager()).drawGroundLights(world.gx, world.eyeTileZ, world.squares);
            }
            requireNonNull(gl).glPopMatrix();
        }

        for (let var25 = world.minLevel; var25 < world.maxLevel; var25++) {
            const var26 = arrayAtObj(world.squares, var25);

            for (let var28 = -world.viewRadius | 0; var28 <= 0; var28++) {
                const var33 = (world.gx + var28) | 0;
                const var35 = (world.gx - var28) | 0;
                if (var33 >= world.minX || var35 < world.maxX) {
                    for (let var19 = -world.viewRadius | 0; var19 <= 0; var19++) {
                        const var20 = (world.eyeTileZ + var19) | 0;
                        const var21 = (world.eyeTileZ - var19) | 0;
                        if (var33 >= world.minX) {
                            if (var20 >= world.minZ) {
                                const var22 = at2(var26, var33, var20);
                                if (var22 !== null && var22.drawFront) {
                                    world.Fill(var22, true);
                                }
                            }

                            if (var21 < world.maxZ) {
                                const var40 = at2(var26, var33, var21);
                                if (var40 !== null && var40.drawFront) {
                                    world.Fill(var40, true);
                                }
                            }
                        }

                        if (var35 < world.maxX) {
                            if (var20 >= world.minZ) {
                                const var41 = at2(var26, var35, var20);
                                if (var41 !== null && var41.drawFront) {
                                    world.Fill(var41, true);
                                }
                            }

                            if (var21 < world.maxZ) {
                                const var42 = at2(var26, var35, var21);
                                if (var42 !== null && var42.drawFront) {
                                    world.Fill(var42, true);
                                }
                            }
                        }

                        if (world.fillLeft === 0) {
                            if (!var24) {
                                world.takingInput = false;
                            }

                            return;
                        }
                    }
                }
            }
        }

        for (let var27 = world.minLevel; var27 < world.maxLevel; var27++) {
            const var29 = arrayAtObj(world.squares, var27);

            for (let var34 = -world.viewRadius | 0; var34 <= 0; var34++) {
                const var36 = (world.gx + var34) | 0;
                const var37 = (world.gx - var34) | 0;
                if (var36 >= world.minX || var37 < world.maxX) {
                    for (let var38 = -world.viewRadius | 0; var38 <= 0; var38++) {
                        const var39 = (world.eyeTileZ + var38) | 0;
                        const var43 = (world.eyeTileZ - var38) | 0;
                        if (var36 >= world.minX) {
                            if (var39 >= world.minZ) {
                                const var23 = at2(var29, var36, var39);
                                if (var23 !== null && var23.drawFront) {
                                    world.Fill(var23, false);
                                }
                            }

                            if (var43 < world.maxZ) {
                                const var44 = at2(var29, var36, var43);
                                if (var44 !== null && var44.drawFront) {
                                    world.Fill(var44, false);
                                }
                            }
                        }

                        if (var37 < world.maxX) {
                            if (var39 >= world.minZ) {
                                const var45 = at2(var29, var37, var39);
                                if (var45 !== null && var45.drawFront) {
                                    world.Fill(var45, false);
                                }
                            }

                            if (var43 < world.maxZ) {
                                const var46 = at2(var29, var37, var43);
                                if (var46 !== null && var46.drawFront) {
                                    world.Fill(var46, false);
                                }
                            }
                        }

                        if (world.fillLeft === 0) {
                            if (!var24) {
                                world.takingInput = false;
                            }

                            return;
                        }
                    }
                }
            }
        }

        world.takingInput = false;
    }

    // p.a(Lra;Z)V
    // Draws var0 and every square it unblocks, in the painter's order. var1 = false lets the first square skip its
    // "a nearer neighbour is still to draw" checks (world.Render's second pass).
    static Fill(var0: Square, var1: boolean): void {
        const renderer = glJar ? (rendererClass ??= loadGlRenderer()) : null;
        world.drawTileQueue.push_back(var0);

        while (true) {
            const var2 = world.drawTileQueue.takeFrontAndPop();
            if (var2 === null) {
                return;
            }

            if (!var2.drawBack) {
                continue;
            }

            const var3 = var2.x;
            const var4 = var2.z;
            const var5 = var2.level;
            const var6 = var2.originalLevel;
            const var7 = arrayAtObj(world.squares, var5);
            let bias = 0;
            if (renderer?.active) {
                if (world.underwaterHeightmap === world.levelHeightmaps) {
                    const water = at2I32(world.waterSpriteKeys, var3, var4);
                    const colour = water & 0xffffff;
                    const materials = (materialManagerClass ??= loadMaterialManager());
                    if (colour !== world.waterColour) {
                        world.waterColour = colour;
                        materials.setUnderwaterColour(colour);
                        (lightingClass ??= loadGlLighting()).applyFogColour(materials.underwaterFogColour());
                    }
                    const depth = (water >>> 24) << 3;
                    if (depth !== world.waterDepth) {
                        world.waterDepth = depth;
                        materials.setUnderwaterDepth(depth);
                    }
                    const y = (at3I32(world.mainGroundh, 0, var3, var4) + at3I32(world.mainGroundh, 0, var3 + 1, var4) + at3I32(world.mainGroundh, 0, var3, var4 + 1) + at3I32(world.mainGroundh, 0, var3 + 1, var4 + 1)) >> 2;
                    materials.setMaterial(-y, 3);
                    bias = 201.5;
                } else bias = 201.5 - 50 * (var6 + 1);
                renderer.setLevelDepthBias(bias);
            }
            if (var2.drawFront) {
                if (var1) {
                    if (var5 > 0) {
                        const var8 = at3(world.squares, var5 - 1, var3, var4);
                        if (var8 !== null && var8.drawBack) {
                            continue;
                        }
                    }

                    if (var3 <= world.gx && var3 > world.minX) {
                        const var20 = at2(var7, var3 - 1, var4);
                        if (var20 !== null && var20.drawBack && (var20.drawFront || (var2.spriteSpans & 1) === 0)) {
                            continue;
                        }
                    }

                    if (var3 >= world.gx && var3 < ((world.maxX - 1) | 0)) {
                        const var21 = at2(var7, var3 + 1, var4);
                        if (var21 !== null && var21.drawBack && (var21.drawFront || (var2.spriteSpans & 4) === 0)) {
                            continue;
                        }
                    }

                    if (var4 <= world.eyeTileZ && var4 > world.minZ) {
                        const var22 = at2(var7, var3, var4 - 1);
                        if (var22 !== null && var22.drawBack && (var22.drawFront || (var2.spriteSpans & 8) === 0)) {
                            continue;
                        }
                    }

                    if (var4 >= world.eyeTileZ && var4 < ((world.maxZ - 1) | 0)) {
                        const var23 = at2(var7, var3, var4 + 1);
                        if (var23 !== null && var23.drawBack && (var23.drawFront || (var2.spriteSpans & 2) === 0)) {
                            continue;
                        }
                    }
                } else {
                    var1 = true;
                }

                var2.drawFront = false;
                if (var2.linkedSquare !== null) {
                    const var24 = var2.linkedSquare;
                    if (renderer?.active) renderer.setLevelDepthBias(201.5 - 50 * (var24.originalLevel + 1));
                    if (var24.quickGround !== null) {
                        if (!world.GroundoOcluded(0, var3, var4)) {
                            world.renderQuickGround(var24.quickGround, 0, world.cameraSinX, world.cameraCosX, world.cameraSinY, world.cameraCosY, var3, var4, false);
                        } else {
                            world.renderQuickGround(var24.quickGround, 0, world.cameraSinX, world.cameraCosX, world.cameraSinY, world.cameraCosY, var3, var4, true);
                        }
                    } else if (var24.ground !== null) {
                        if (!world.GroundoOcluded(0, var3, var4)) {
                            world.drawTileOverlay(var24.ground, world.cameraSinX, world.cameraCosX, world.cameraSinY, world.cameraCosY, var3, var4, false);
                        } else {
                            world.drawTileOverlay(var24.ground, world.cameraSinX, world.cameraCosX, world.cameraSinY, world.cameraCosY, var3, var4, true);
                        }
                    }

                    const var9 = var24.wall;
                    if (var9 !== null) {
                        if (renderer?.active) {
                            const lights = getPointLights();
                            if ((var9.angle1 & var2.backWallTypes) !== 0) lights.selectNeighbour(var9.angle1, world.cx, world.cy, world.cz, var6, var3, var4);
                            else lights.selectTile(world.cx, world.cy, world.cz, var5, var3, var4);
                        }
                        requireNonNull(var9.model1).draw(0, world.cameraSinX, world.cameraCosX, world.cameraSinY, world.cameraCosY, (var9.x - world.cx) | 0, (var9.y - world.cy) | 0, (var9.z - world.cz) | 0, var9.typecode, var5, null);
                    }

                    for (let var10 = 0; var10 < var24.spriteCount; var10++) {
                        const var11 = arrayAtObj(var24.sprites, var10);
                        if (var11 !== null) {
                            if (renderer?.active) getPointLights().selectTile(world.cx, world.cy, world.cz, var5, var3, var4);
                            requireNonNull(var11.model).draw(var11.yaw, world.cameraSinX, world.cameraCosX, world.cameraSinY, world.cameraCosY, (var11.x - world.cx) | 0, (var11.y - world.cy) | 0, (var11.z - world.cz) | 0, var11.typecode, var5, null);
                        }
                    }
                    if (renderer?.active) renderer.setLevelDepthBias(bias);
                }

                let var25 = false;
                if (var2.quickGround !== null) {
                    if (!world.GroundoOcluded(var6, var3, var4)) {
                        var25 = true;
                        if (var2.quickGround.colourNE !== 12345678 || (world.takingInput && var5 <= world.clickLevel)) {
                            world.renderQuickGround(var2.quickGround, var6, world.cameraSinX, world.cameraCosX, world.cameraSinY, world.cameraCosY, var3, var4, false);
                        }
                    } else {
                        world.renderQuickGround(var2.quickGround, var6, world.cameraSinX, world.cameraCosX, world.cameraSinY, world.cameraCosY, var3, var4, true);
                    }
                } else if (var2.ground !== null) {
                    if (!world.GroundoOcluded(var6, var3, var4)) {
                        var25 = true;
                        world.drawTileOverlay(var2.ground, world.cameraSinX, world.cameraCosX, world.cameraSinY, world.cameraCosY, var3, var4, false);
                    } else {
                        world.drawTileOverlay(var2.ground, world.cameraSinX, world.cameraCosX, world.cameraSinY, world.cameraCosY, var3, var4, true);
                    }
                }

                if (var25) {
                    const var33 = var2.groundDecor;
                    if (var33 !== null && (var33.typecode & 2147483648n) !== 0n) {
                        if (renderer?.active && var33.depthOffset) renderer.setLevelDepthBias(bias + 50 - 1.5);
                        if (renderer?.active) getPointLights().selectTile(world.cx, world.cy, world.cz, var5, var3, var4);
                        requireNonNull(var33.model).draw(0, world.cameraSinX, world.cameraCosX, world.cameraSinY, world.cameraCosY, (var33.x - world.cx) | 0, (var33.y - world.cy) | 0, (var33.z - world.cz) | 0, var33.typecode, var5, null);
                        if (renderer?.active && var33.depthOffset) renderer.setLevelDepthBias(bias);
                    }
                }

                let var34 = 0;
                let var43 = 0;
                const var48 = var2.wall;
                const var12 = var2.decor;
                if (var48 !== null || var12 !== null) {
                    if (world.gx === var3) {
                        var34++;
                    } else if (world.gx < var3) {
                        var34 += 2;
                    }

                    if (world.eyeTileZ === var4) {
                        var34 += 3;
                    } else if (world.eyeTileZ > var4) {
                        var34 += 6;
                    }

                    var43 = arrayAtI32(world.preTab, var34);
                    var2.backWallTypes = arrayAtI32(world.postTab, var34);
                }

                if (var48 !== null) {
                    if ((var48.angle1 & arrayAtI32(world.midTab, var34)) !== 0) {
                        if (var48.angle1 === 16) {
                            var2.cornerSides = 3;
                            var2.sidesBeforeCorner = arrayAtI32(world.midDep16, var34);
                            var2.sidesAfterCorner = (3 - var2.sidesBeforeCorner) | 0;
                        } else if (var48.angle1 === 32) {
                            var2.cornerSides = 6;
                            var2.sidesBeforeCorner = arrayAtI32(world.midDep32, var34);
                            var2.sidesAfterCorner = (6 - var2.sidesBeforeCorner) | 0;
                        } else if (var48.angle1 === 64) {
                            var2.cornerSides = 12;
                            var2.sidesBeforeCorner = arrayAtI32(world.middep64, var34);
                            var2.sidesAfterCorner = (12 - var2.sidesBeforeCorner) | 0;
                        } else {
                            var2.cornerSides = 9;
                            var2.sidesBeforeCorner = arrayAtI32(world.middep128, var34);
                            var2.sidesAfterCorner = (9 - var2.sidesBeforeCorner) | 0;
                        }
                    } else {
                        var2.cornerSides = 0;
                    }

                    if ((var48.angle1 & var43) !== 0 && !world.WallOccluded(var6, var3, var4, var48.angle1)) {
                        if (renderer?.active) getPointLights().selectTile(world.cx, world.cy, world.cz, var5, var3, var4);
                        requireNonNull(var48.model1).draw(0, world.cameraSinX, world.cameraCosX, world.cameraSinY, world.cameraCosY, (var48.x - world.cx) | 0, (var48.y - world.cy) | 0, (var48.z - world.cz) | 0, var48.typecode, var5, null);
                    }

                    if ((var48.angle2 & var43) !== 0 && !world.WallOccluded(var6, var3, var4, var48.angle2)) {
                        if (renderer?.active) getPointLights().selectTile(world.cx, world.cy, world.cz, var5, var3, var4);
                        requireNonNull(var48.model2).draw(0, world.cameraSinX, world.cameraCosX, world.cameraSinY, world.cameraCosY, (var48.x - world.cx) | 0, (var48.y - world.cy) | 0, (var48.z - world.cz) | 0, var48.typecode, var5, null);
                    }
                }

                if (var12 !== null && !world.SpriteOccluded(var6, var3, var4, requireNonNull(var12.model).getMinY())) {
                    if (renderer?.active) renderer.setLevelDepthBias(bias - 0.5);
                    if ((var12.wshape & var43) !== 0) {
                        if (renderer?.active) getPointLights().selectTile(world.cx, world.cy, world.cz, var5, var3, var4);
                        requireNonNull(var12.model).draw(
                            0,
                            world.cameraSinX,
                            world.cameraCosX,
                            world.cameraSinY,
                            world.cameraCosY,
                            (var12.x - world.cx + var12.offsetX) | 0,
                            (var12.y - world.cy) | 0,
                            (var12.z - world.cz + var12.offsetZ) | 0,
                            var12.typecode,
                            var5,
                            null
                        );
                    } else if (var12.wshape === 256) {
                        const var13 = (var12.x - world.cx) | 0;
                        const var14 = (var12.y - world.cy) | 0;
                        const var15 = (var12.z - world.cz) | 0;
                        const var16 = var12.angle;
                        let var17: number;
                        if (var16 !== 1 && var16 !== 2) {
                            var17 = var13;
                        } else {
                            var17 = -var13 | 0;
                        }

                        let var18: number;
                        if (var16 !== 2 && var16 !== 3) {
                            var18 = var15;
                        } else {
                            var18 = -var15 | 0;
                        }

                        if (var18 < var17) {
                            if (renderer?.active) getPointLights().selectTile(world.cx, world.cy, world.cz, var5, var3, var4);
                            requireNonNull(var12.model).draw(0, world.cameraSinX, world.cameraCosX, world.cameraSinY, world.cameraCosY, (var13 + var12.offsetX) | 0, var14, (var15 + var12.offsetZ) | 0, var12.typecode, var5, null);
                        } else if (var12.model2 !== null) {
                            if (renderer?.active) getPointLights().selectTile(world.cx, world.cy, world.cz, var5, var3, var4);
                            var12.model2.draw(0, world.cameraSinX, world.cameraCosX, world.cameraSinY, world.cameraCosY, var13, var14, var15, var12.typecode, var5, null);
                        }
                    }
                    if (renderer?.active) renderer.setLevelDepthBias(bias);
                }

                if (var25) {
                    const var55 = var2.groundDecor;
                    if (var55 !== null && (var55.typecode & 2147483648n) === 0n) {
                        if (renderer?.active && var55.depthOffset) renderer.setLevelDepthBias(bias + 50 - 1.5);
                        if (renderer?.active) getPointLights().selectTile(world.cx, world.cy, world.cz, var5, var3, var4);
                        requireNonNull(var55.model).draw(0, world.cameraSinX, world.cameraCosX, world.cameraSinY, world.cameraCosY, (var55.x - world.cx) | 0, (var55.y - world.cy) | 0, (var55.z - world.cz) | 0, var55.typecode, var5, null);
                        if (renderer?.active && var55.depthOffset) renderer.setLevelDepthBias(bias);
                    }

                    const var61 = var2.groundObject;
                    if (var61 !== null && var61.height === 0) {
                        if (renderer?.active) getPointLights().selectTile(world.cx, world.cy, world.cz, var5, var3, var4);
                        if (var61.middleObj !== null) {
                            var61.middleObj.draw(0, world.cameraSinX, world.cameraCosX, world.cameraSinY, world.cameraCosY, (var61.x - world.cx) | 0, (var61.y - world.cy) | 0, (var61.z - world.cz) | 0, var61.typecode, var5, null);
                        }

                        if (var61.bottomObj !== null) {
                            var61.bottomObj.draw(0, world.cameraSinX, world.cameraCosX, world.cameraSinY, world.cameraCosY, (var61.x - world.cx) | 0, (var61.y - world.cy) | 0, (var61.z - world.cz) | 0, var61.typecode, var5, null);
                        }

                        if (var61.topObj !== null) {
                            var61.topObj.draw(0, world.cameraSinX, world.cameraCosX, world.cameraSinY, world.cameraCosY, (var61.x - world.cx) | 0, (var61.y - world.cy) | 0, (var61.z - world.cz) | 0, var61.typecode, var5, null);
                        }
                    }
                }

                const var56 = var2.spriteSpans;
                if (var56 !== 0) {
                    if (var3 < world.gx && (var56 & 4) !== 0) {
                        const var62 = at2(var7, var3 + 1, var4);
                        if (var62 !== null && var62.drawBack) {
                            world.drawTileQueue.push_back(var62);
                        }
                    }

                    if (var4 < world.eyeTileZ && (var56 & 2) !== 0) {
                        const var63 = at2(var7, var3, var4 + 1);
                        if (var63 !== null && var63.drawBack) {
                            world.drawTileQueue.push_back(var63);
                        }
                    }

                    if (var3 > world.gx && (var56 & 1) !== 0) {
                        const var64 = at2(var7, var3 - 1, var4);
                        if (var64 !== null && var64.drawBack) {
                            world.drawTileQueue.push_back(var64);
                        }
                    }

                    if (var4 > world.eyeTileZ && (var56 & 8) !== 0) {
                        const var65 = at2(var7, var3, var4 - 1);
                        if (var65 !== null && var65.drawBack) {
                            world.drawTileQueue.push_back(var65);
                        }
                    }
                }
            }

            if (var2.cornerSides !== 0) {
                let var26 = true;

                for (let var35 = 0; var35 < var2.spriteCount; var35++) {
                    if (requireNonNull(arrayAtObj(var2.sprites, var35)).cycle !== world.cycleNo && (arrayAtI32(var2.spriteSpan, var35) & var2.cornerSides) === var2.sidesBeforeCorner) {
                        var26 = false;
                        break;
                    }
                }

                if (var26) {
                    const var44 = requireNonNull(var2.wall);
                    if (!world.WallOccluded(var6, var3, var4, var44.angle1)) {
                        if (renderer?.active) {
                            const lights = getPointLights();
                            const dx = (var44.x - world.cx) | 0,
                                dz = (var44.z - world.cz) | 0;
                            const angle = Number((var44.typecode >> 20n) & 3n);
                            if (angle === 0 && ((dz + 64) | 0) < ((dx - 64) | 0) && var3 > 0 && var4 < world.maxTileZ - 1) {
                                lights.selectTile(world.cx, world.cy, world.cz, var5, var3 - 1, var4 + 1);
                            } else if (angle === 1 && ((dz + 64) | 0) < (-(dx + 64) | 0) && var3 < world.maxTileX - 1 && var4 < world.maxTileZ - 1) {
                                lights.selectTile(world.cx, world.cy, world.cz, var5, var3 + 1, var4 + 1);
                            } else if (angle === 2 && ((dz - 64) | 0) > ((dx + 64) | 0) && var3 < world.maxTileX - 1 && var4 > 0) {
                                lights.selectTile(world.cx, world.cy, world.cz, var5, var3 + 1, var4 - 1);
                            } else if (angle === 3 && ((dz - 64) | 0) > (-(dx - 64) | 0) && var3 > 0 && var4 > 0) {
                                lights.selectTile(world.cx, world.cy, world.cz, var5, var3 - 1, var4 - 1);
                            } else lights.selectTile(world.cx, world.cy, world.cz, var5, var3, var4);
                        }
                        requireNonNull(var44.model1).draw(0, world.cameraSinX, world.cameraCosX, world.cameraSinY, world.cameraCosY, (var44.x - world.cx) | 0, (var44.y - world.cy) | 0, (var44.z - world.cz) | 0, var44.typecode, var5, null);
                    }

                    var2.cornerSides = 0;
                }
            }

            if (var2.drawSprites) {
                // The jar's catch (Exception) around the sprite pass: any failure drops the square's sprites for the frame.
                try {
                    const var27 = var2.spriteCount;
                    var2.drawSprites = false;
                    let var36 = 0;

                    label572: for (let var45 = 0; var45 < var27; var45++) {
                        const var49 = requireNonNull(arrayAtObj(var2.sprites, var45));
                        if (var49.cycle !== world.cycleNo) {
                            for (let var52 = var49.minTileX; var52 <= var49.maxTileX; var52++) {
                                for (let var57 = var49.minTileZ; var57 <= var49.maxTileZ; var57++) {
                                    const var66 = requireNonNull(at2(var7, var52, var57));
                                    if (var66.drawFront) {
                                        var2.drawSprites = true;
                                        continue label572;
                                    }

                                    if (var66.cornerSides !== 0) {
                                        let var71 = 0;
                                        if (var52 > var49.minTileX) {
                                            var71++;
                                        }

                                        if (var52 < var49.maxTileX) {
                                            var71 += 4;
                                        }

                                        if (var57 > var49.minTileZ) {
                                            var71 += 8;
                                        }

                                        if (var57 < var49.maxTileZ) {
                                            var71 += 2;
                                        }

                                        if ((var71 & var66.cornerSides) === var2.sidesAfterCorner) {
                                            var2.drawSprites = true;
                                            continue label572;
                                        }
                                    }
                                }
                            }

                            arrayPutObj(world.spriteBuffer, var36++, var49);
                            let var58 = (world.gx - var49.minTileX) | 0;
                            const var67 = (var49.maxTileX - world.gx) | 0;
                            if (var67 > var58) {
                                var58 = var67;
                            }

                            const var72 = (world.eyeTileZ - var49.minTileZ) | 0;
                            const var76 = (var49.maxTileZ - world.eyeTileZ) | 0;
                            if (var76 > var72) {
                                var49.distance = (var58 + var76) | 0;
                            } else {
                                var49.distance = (var58 + var72) | 0;
                            }
                        }
                    }

                    while (var36 > 0) {
                        let var50 = -50;
                        let var53 = -1;

                        for (let var59 = 0; var59 < var36; var59++) {
                            const var68 = requireNonNull(arrayAtObj(world.spriteBuffer, var59));
                            if (var68.cycle !== world.cycleNo) {
                                if (var68.distance > var50) {
                                    var50 = var68.distance;
                                    var53 = var59;
                                } else if (var68.distance === var50) {
                                    const var73 = (var68.x - world.cx) | 0;
                                    const var77 = (var68.z - world.cz) | 0;
                                    const var79 = (requireNonNull(arrayAtObj(world.spriteBuffer, var53)).x - world.cx) | 0;
                                    const var81 = (requireNonNull(arrayAtObj(world.spriteBuffer, var53)).z - world.cz) | 0;
                                    if (((Math.imul(var73, var73) + Math.imul(var77, var77)) | 0) > ((Math.imul(var79, var79) + Math.imul(var81, var81)) | 0)) {
                                        var53 = var59;
                                    }
                                }
                            }
                        }

                        if (var53 === -1) {
                            break;
                        }

                        const var69 = requireNonNull(arrayAtObj(world.spriteBuffer, var53));
                        var69.cycle = world.cycleNo;
                        if (!world.SpriteOccluded2(var6, var69.minTileX, var69.maxTileX, var69.minTileZ, var69.maxTileZ, requireNonNull(var69.model).getMinY())) {
                            if (renderer?.active) {
                                const lights = getPointLights();
                                if ((var69.typecode & 1032192n) === 147456n) {
                                    lights.selectTile(world.cx, world.cy, world.cz, var5, var3, var4);
                                    const dx = (var69.x - world.cx) | 0,
                                        dz = (var69.z - world.cz) | 0;
                                    const angle = Number((var69.typecode >> 20n) & 3n);
                                    if (angle === 1 || angle === 3) {
                                        if (dz > (-dx | 0)) lights.retainBetween(var5, var3, var4 - 1, var3 - 1, var4);
                                        else lights.retainBetween(var5, var3, var4 + 1, var3 + 1, var4);
                                    } else if (dz > dx) lights.retainBetween(var5, var3, var4 - 1, var3 + 1, var4);
                                    else lights.retainBetween(var5, var3, var4 + 1, var3 - 1, var4);
                                } else lights.selectArea(world.cx, world.cy, world.cz, var5, var69.minTileX, var69.minTileZ, var69.maxTileX, var69.maxTileZ);
                            }
                            requireNonNull(var69.model).draw(var69.yaw, world.cameraSinX, world.cameraCosX, world.cameraSinY, world.cameraCosY, (var69.x - world.cx) | 0, (var69.y - world.cy) | 0, (var69.z - world.cz) | 0, var69.typecode, var5, null);
                        }

                        for (let var74 = var69.minTileX; var74 <= var69.maxTileX; var74++) {
                            for (let var78 = var69.minTileZ; var78 <= var69.maxTileZ; var78++) {
                                const var80 = requireNonNull(at2(var7, var74, var78));
                                if (var80.cornerSides !== 0) {
                                    world.drawTileQueue.push_back(var80);
                                } else if ((var74 !== var3 || var78 !== var4) && var80.drawBack) {
                                    world.drawTileQueue.push_back(var80);
                                }
                            }
                        }
                    }

                    if (var2.drawSprites) {
                        continue;
                    }
                } catch (e) {
                    // p.a catches Exception only: a java.lang.Error (JavaError) escapes Fill.
                    if (e instanceof JavaError) throw e;
                    var2.drawSprites = false;
                }
            }

            if (var2.drawBack && var2.cornerSides === 0) {
                if (var3 <= world.gx && var3 > world.minX) {
                    const var28 = at2(var7, var3 - 1, var4);
                    if (var28 !== null && var28.drawBack) {
                        continue;
                    }
                }

                if (var3 >= world.gx && var3 < ((world.maxX - 1) | 0)) {
                    const var29 = at2(var7, var3 + 1, var4);
                    if (var29 !== null && var29.drawBack) {
                        continue;
                    }
                }

                if (var4 <= world.eyeTileZ && var4 > world.minZ) {
                    const var30 = at2(var7, var3, var4 - 1);
                    if (var30 !== null && var30.drawBack) {
                        continue;
                    }
                }

                if (var4 >= world.eyeTileZ && var4 < ((world.maxZ - 1) | 0)) {
                    const var31 = at2(var7, var3, var4 + 1);
                    if (var31 !== null && var31.drawBack) {
                        continue;
                    }
                }

                var2.drawBack = false;
                world.fillLeft = (world.fillLeft - 1) | 0;
                const var32 = var2.groundObject;
                if (var32 !== null && var32.height !== 0) {
                    if (renderer?.active) getPointLights().selectTile(world.cx, world.cy, world.cz, var5, var3, var4);
                    if (var32.middleObj !== null) {
                        var32.middleObj.draw(0, world.cameraSinX, world.cameraCosX, world.cameraSinY, world.cameraCosY, (var32.x - world.cx) | 0, (var32.y - world.cy - var32.height) | 0, (var32.z - world.cz) | 0, var32.typecode, var5, null);
                    }

                    if (var32.bottomObj !== null) {
                        var32.bottomObj.draw(0, world.cameraSinX, world.cameraCosX, world.cameraSinY, world.cameraCosY, (var32.x - world.cx) | 0, (var32.y - world.cy - var32.height) | 0, (var32.z - world.cz) | 0, var32.typecode, var5, null);
                    }

                    if (var32.topObj !== null) {
                        var32.topObj.draw(0, world.cameraSinX, world.cameraCosX, world.cameraSinY, world.cameraCosY, (var32.x - world.cx) | 0, (var32.y - world.cy - var32.height) | 0, (var32.z - world.cz) | 0, var32.typecode, var5, null);
                    }
                }

                if (var2.backWallTypes !== 0) {
                    const var37 = var2.decor;
                    if (var37 !== null && !world.SpriteOccluded(var6, var3, var4, requireNonNull(var37.model).getMinY())) {
                        if ((var37.wshape & var2.backWallTypes) !== 0) {
                            if (renderer?.active) getPointLights().selectTile(world.cx, world.cy, world.cz, var5, var3, var4);
                            requireNonNull(var37.model).draw(
                                0,
                                world.cameraSinX,
                                world.cameraCosX,
                                world.cameraSinY,
                                world.cameraCosY,
                                (var37.x - world.cx + var37.offsetX) | 0,
                                (var37.y - world.cy) | 0,
                                (var37.z - world.cz + var37.offsetZ) | 0,
                                var37.typecode,
                                var5,
                                null
                            );
                        } else if (var37.wshape === 256) {
                            const var46 = (var37.x - world.cx) | 0;
                            const var51 = (var37.y - world.cy) | 0;
                            const var54 = (var37.z - world.cz) | 0;
                            const var60 = var37.angle;
                            let var70: number;
                            if (var60 !== 1 && var60 !== 2) {
                                var70 = var46;
                            } else {
                                var70 = -var46 | 0;
                            }

                            let var75: number;
                            if (var60 !== 2 && var60 !== 3) {
                                var75 = var54;
                            } else {
                                var75 = -var54 | 0;
                            }

                            if (var75 >= var70) {
                                if (renderer?.active) getPointLights().selectTile(world.cx, world.cy, world.cz, var5, var3, var4);
                                requireNonNull(var37.model).draw(0, world.cameraSinX, world.cameraCosX, world.cameraSinY, world.cameraCosY, (var46 + var37.offsetX) | 0, var51, (var54 + var37.offsetZ) | 0, var37.typecode, var5, null);
                            } else if (var37.model2 !== null) {
                                if (renderer?.active) getPointLights().selectTile(world.cx, world.cy, world.cz, var5, var3, var4);
                                var37.model2.draw(0, world.cameraSinX, world.cameraCosX, world.cameraSinY, world.cameraCosY, var46, var51, var54, var37.typecode, var5, null);
                            }
                        }
                    }

                    const var47 = var2.wall;
                    if (var47 !== null) {
                        if ((var47.angle2 & var2.backWallTypes) !== 0 && !world.WallOccluded(var6, var3, var4, var47.angle2)) {
                            if (renderer?.active) getPointLights().selectNeighbour(var47.angle2, world.cx, world.cy, world.cz, var6, var3, var4);
                            requireNonNull(var47.model2).draw(0, world.cameraSinX, world.cameraCosX, world.cameraSinY, world.cameraCosY, (var47.x - world.cx) | 0, (var47.y - world.cy) | 0, (var47.z - world.cz) | 0, var47.typecode, var5, null);
                        }

                        if ((var47.angle1 & var2.backWallTypes) !== 0 && !world.WallOccluded(var6, var3, var4, var47.angle1)) {
                            if (renderer?.active) getPointLights().selectNeighbour(var47.angle1, world.cx, world.cy, world.cz, var6, var3, var4);
                            requireNonNull(var47.model1).draw(0, world.cameraSinX, world.cameraCosX, world.cameraSinY, world.cameraCosY, (var47.x - world.cx) | 0, (var47.y - world.cy) | 0, (var47.z - world.cz) | 0, var47.typecode, var5, null);
                        }
                    }
                }

                if (var5 < ((world.maxLevel - 1) | 0)) {
                    const var38 = at3(world.squares, var5 + 1, var3, var4);
                    if (var38 !== null && var38.drawBack) {
                        world.drawTileQueue.push_back(var38);
                    }
                }

                if (var3 < world.gx) {
                    const var39 = at2(var7, var3 + 1, var4);
                    if (var39 !== null && var39.drawBack) {
                        world.drawTileQueue.push_back(var39);
                    }
                }

                if (var4 < world.eyeTileZ) {
                    const var40 = at2(var7, var3, var4 + 1);
                    if (var40 !== null && var40.drawBack) {
                        world.drawTileQueue.push_back(var40);
                    }
                }

                if (var3 > world.gx) {
                    const var41 = at2(var7, var3 - 1, var4);
                    if (var41 !== null && var41.drawBack) {
                        world.drawTileQueue.push_back(var41);
                    }
                }

                if (var4 > world.eyeTileZ) {
                    const var42 = at2(var7, var3, var4 - 1);
                    if (var42 !== null && var42.drawBack) {
                        world.drawTileQueue.push_back(var42);
                    }
                }
            }
        }
    }

    // ug.a(Lma;IIIIIIIZ)V
    // var0 = the tile, var1 = level, var2..var5 = camera sin/cos pitch and sin/cos yaw, var6/var7 = tile x/z,
    // var8 = occluded (pick only, draw nothing). Locals are bytecode slots: 9/10 = x of corners 3/0, 11/12 = z of
    // corners 1/0, 13/14 = x of corners 2/1, 15/16 = z of corners 3/2, 17..20 = y of corners 0..3 (SW, SE, NE, NW),
    // 21 = the rotation temporary, 22..29 = the projected screen x/y of corners 0..3.
    static renderQuickGround(var0: QuickGround, var1: number, var2: number, var3: number, var4: number, var5: number, var6: number, var7: number, var8: boolean): void {
        const renderer = glJar ? (rendererClass ??= loadGlRenderer()) : null;
        let var9 = ((var6 << 7) - world.cx) | 0;
        let var10 = var9;
        let var11 = ((var7 << 7) - world.cz) | 0;
        let var12 = var11;
        let var13 = (var10 + 128) | 0;
        let var14 = var13;
        let var15 = (var12 + 128) | 0;
        let var16 = var15;
        const plane = arrayAtObj(world.levelHeightmaps, var1);
        const west = arrayAtObj(plane, var6);
        let var17 = (arrayAtI32(west, var7) - world.cy) | 0;
        const east = arrayAtObj(plane, var6 + 1);
        let var18 = (arrayAtI32(east, var7) - world.cy) | 0;
        let var19 = (arrayAtI32(east, var7 + 1) - world.cy) | 0;
        let var20 = (arrayAtI32(west, var7 + 1) - world.cy) | 0;
        // Past the four checked reads, projection can only pick, rasterize, or clear trans.
        if ((renderer?.active || var8) && !world.takingInput && Pix3D.trans === 0) {
            return;
        }
        let var21 = (Math.imul(var12, var4) + Math.imul(var10, var5)) >> 16;
        var12 = (Math.imul(var12, var5) - Math.imul(var10, var4)) >> 16;
        var10 = var21;
        var21 = (Math.imul(var17, var3) - Math.imul(var12, var2)) >> 16;
        var12 = (Math.imul(var17, var2) + Math.imul(var12, var3)) >> 16;
        var17 = var21;
        if (var12 < 50) {
            return;
        }

        var21 = (Math.imul(var11, var4) + Math.imul(var14, var5)) >> 16;
        var11 = (Math.imul(var11, var5) - Math.imul(var14, var4)) >> 16;
        var14 = var21;
        var21 = (Math.imul(var18, var3) - Math.imul(var11, var2)) >> 16;
        var11 = (Math.imul(var18, var2) + Math.imul(var11, var3)) >> 16;
        var18 = var21;
        if (var11 < 50) {
            return;
        }

        var21 = (Math.imul(var16, var4) + Math.imul(var13, var5)) >> 16;
        var16 = (Math.imul(var16, var5) - Math.imul(var13, var4)) >> 16;
        var13 = var21;
        var21 = (Math.imul(var19, var3) - Math.imul(var16, var2)) >> 16;
        var16 = (Math.imul(var19, var2) + Math.imul(var16, var3)) >> 16;
        var19 = var21;
        if (var16 < 50) {
            return;
        }

        var21 = (Math.imul(var15, var4) + Math.imul(var9, var5)) >> 16;
        var15 = (Math.imul(var15, var5) - Math.imul(var9, var4)) >> 16;
        var9 = var21;
        var21 = (Math.imul(var20, var3) - Math.imul(var15, var2)) >> 16;
        var15 = (Math.imul(var20, var2) + Math.imul(var15, var3)) >> 16;
        var20 = var21;
        if (var15 < 50) {
            return;
        }

        const var22 = (Pix3D.originX + (((var10 << 9) / var12) | 0)) | 0;
        const var23 = (Pix3D.originY + (((var17 << 9) / var12) | 0)) | 0;
        const var24 = (Pix3D.originX + (((var14 << 9) / var11) | 0)) | 0;
        const var25 = (Pix3D.originY + (((var18 << 9) / var11) | 0)) | 0;
        const var26 = (Pix3D.originX + (((var13 << 9) / var16) | 0)) | 0;
        const var27 = (Pix3D.originY + (((var19 << 9) / var16) | 0)) | 0;
        const var28 = (Pix3D.originX + (((var9 << 9) / var15) | 0)) | 0;
        const var29 = (Pix3D.originY + (((var20 << 9) / var15) | 0)) | 0;
        Pix3D.trans = 0;
        if (((Math.imul(var26 - var28, var25 - var29) - Math.imul(var27 - var29, var24 - var28)) | 0) > 0) {
            if (world.takingInput && world.InsideTriangle((world.clickX + Pix3D.originX) | 0, (world.clickY + Pix3D.originY) | 0, var27, var29, var25, var26, var28, var24)) {
                world.groundX = var6;
                world.groundZ = var7;
            }

            if (!renderer?.active && !var8) {
                Pix3D.hclip = false;
                if (var26 < 0 || var28 < 0 || var24 < 0 || var26 > Pix3D.width || var28 > Pix3D.width || var24 > Pix3D.width) {
                    Pix3D.hclip = true;
                }

                if (var0.texture === -1) {
                    if (var0.colourNE !== 12345678) {
                        Pix3D.gouraudTriangle(var27, var29, var25, var26, var28, var24, var0.colourNE, var0.colourNW, var0.colourSE);
                    }
                } else if (Preferences.graphics.highDetailTextures2) {
                    if (var0.flat) {
                        Pix3D.terrainTextureTriangle(var27, var29, var25, var26, var28, var24, var0.colourNE, var0.colourNW, var0.colourSE, var10, var14, var9, var17, var18, var20, var12, var11, var15, var0.texture);
                    } else {
                        Pix3D.terrainTextureTriangle(var27, var29, var25, var26, var28, var24, var0.colourNE, var0.colourNW, var0.colourSE, var13, var9, var14, var19, var20, var18, var16, var15, var11, var0.texture);
                    }
                } else {
                    const var30 = requireNonNull(Pix3D.textureProvider).getTextureColour(var0.texture);
                    Pix3D.gouraudTriangle(var27, var29, var25, var26, var28, var24, world.TextureLightCol(var30, var0.colourNE), world.TextureLightCol(var30, var0.colourNW), world.TextureLightCol(var30, var0.colourSE));
                }
            }
        }

        if (((Math.imul(var22 - var24, var29 - var25) - Math.imul(var23 - var25, var28 - var24)) | 0) > 0) {
            if (world.takingInput && world.InsideTriangle((world.clickX + Pix3D.originX) | 0, (world.clickY + Pix3D.originY) | 0, var23, var25, var29, var22, var24, var28)) {
                world.groundX = var6;
                world.groundZ = var7;
            }

            if (!renderer?.active && !var8) {
                Pix3D.hclip = false;
                if (var22 < 0 || var24 < 0 || var28 < 0 || var22 > Pix3D.width || var24 > Pix3D.width || var28 > Pix3D.width) {
                    Pix3D.hclip = true;
                }

                if (var0.texture === -1) {
                    if (var0.colourSW !== 12345678) {
                        Pix3D.gouraudTriangle(var23, var25, var29, var22, var24, var28, var0.colourSW, var0.colourSE, var0.colourNW);
                        return;
                    }
                } else {
                    if (Preferences.graphics.highDetailTextures2) {
                        Pix3D.terrainTextureTriangle(var23, var25, var29, var22, var24, var28, var0.colourSW, var0.colourSE, var0.colourNW, var10, var14, var9, var17, var18, var20, var12, var11, var15, var0.texture);
                        return;
                    }

                    const var30 = requireNonNull(Pix3D.textureProvider).getTextureColour(var0.texture);
                    Pix3D.gouraudTriangle(var23, var25, var29, var22, var24, var28, world.TextureLightCol(var30, var0.colourSW), world.TextureLightCol(var30, var0.colourSE), world.TextureLightCol(var30, var0.colourNW));
                }
            }
        }
    }

    // sb.a(Lkb;IIIIIIZ)V
    // var0 = the tile, var1..var4 = camera sin/cos pitch and sin/cos yaw, var5/var6 = tile x/z, var7 = occluded (pick
    // only). Locals are bytecode slots (the decompiler drops the rotation temporaries' copies): in the vertex loop
    // 10/11/12 = camera-space x/y/z and 13 the temporary; in the face loop 11/12/13 = the face's vertex indices and
    // 14..19 = their screen x then y.
    static drawTileOverlay(var0: Ground, var1: number, var2: number, var3: number, var4: number, var5: number, var6: number, var7: boolean): void {
        const renderer = glJar ? (rendererClass ??= loadGlRenderer()) : null;
        let var8 = var0.vertexX.length;

        for (let var9 = 0; var9 < var8; var9++) {
            let var10 = (arrayAtI32(var0.vertexX, var9) - world.cx) | 0;
            let var11 = (arrayAtI32(var0.vertexY, var9) - world.cy) | 0;
            let var12 = (arrayAtI32(var0.vertexZ, var9) - world.cz) | 0;
            let var13 = (Math.imul(var12, var3) + Math.imul(var10, var4)) >> 16;
            var12 = (Math.imul(var12, var4) - Math.imul(var10, var3)) >> 16;
            var10 = var13;
            var13 = (Math.imul(var11, var2) - Math.imul(var12, var1)) >> 16;
            var12 = (Math.imul(var11, var1) + Math.imul(var12, var2)) >> 16;
            var11 = var13;
            if (var12 < 50) {
                return;
            }

            if (var0.faceTexture !== null) {
                arrayPutI32(Ground.drawTextureVertexX, var9, var10);
                arrayPutI32(Ground.drawTextureVertexY, var9, var11);
                arrayPutI32(Ground.drawTextureVertexZ, var9, var12);
            }

            arrayPutI32(Ground.drawVertexX, var9, (Pix3D.originX + (((var10 << 9) / var12) | 0)) | 0);
            arrayPutI32(Ground.drawVertexY, var9, (Pix3D.originY + (((var11 << 9) / var12) | 0)) | 0);
        }

        Pix3D.trans = 0;
        var8 = var0.faceVertexA.length;

        for (let var10 = 0; var10 < var8; var10++) {
            const var11 = arrayAtI32(var0.faceVertexA, var10);
            const var12 = arrayAtI32(var0.faceVertexB, var10);
            const var13 = arrayAtI32(var0.faceVertexC, var10);
            const var14 = arrayAtI32(Ground.drawVertexX, var11);
            const var15 = arrayAtI32(Ground.drawVertexX, var12);
            const var16 = arrayAtI32(Ground.drawVertexX, var13);
            const var17 = arrayAtI32(Ground.drawVertexY, var11);
            const var18 = arrayAtI32(Ground.drawVertexY, var12);
            const var19 = arrayAtI32(Ground.drawVertexY, var13);
            if (((Math.imul(var14 - var15, var19 - var18) - Math.imul(var17 - var18, var16 - var15)) | 0) > 0) {
                if (world.takingInput && world.InsideTriangle((world.clickX + Pix3D.originX) | 0, (world.clickY + Pix3D.originY) | 0, var17, var18, var19, var14, var15, var16)) {
                    world.groundX = var5;
                    world.groundZ = var6;
                }

                if (!renderer?.active && !var7) {
                    Pix3D.hclip = false;
                    if (var14 < 0 || var15 < 0 || var16 < 0 || var14 > Pix3D.width || var15 > Pix3D.width || var16 > Pix3D.width) {
                        Pix3D.hclip = true;
                    }

                    if (var0.faceTexture === null || arrayAtI32(var0.faceTexture, var10) === -1) {
                        if (arrayAtI32(var0.faceColourA, var10) !== 12345678) {
                            Pix3D.gouraudTriangle(var17, var18, var19, var14, var15, var16, arrayAtI32(var0.faceColourA, var10), arrayAtI32(var0.faceColourB, var10), arrayAtI32(var0.faceColourC, var10));
                        }
                    } else if (Preferences.graphics.highDetailTextures2) {
                        if (var0.flat) {
                            Pix3D.terrainTextureTriangle(
                                var17,
                                var18,
                                var19,
                                var14,
                                var15,
                                var16,
                                arrayAtI32(var0.faceColourA, var10),
                                arrayAtI32(var0.faceColourB, var10),
                                arrayAtI32(var0.faceColourC, var10),
                                arrayAtI32(Ground.drawTextureVertexX, 0),
                                arrayAtI32(Ground.drawTextureVertexX, 1),
                                arrayAtI32(Ground.drawTextureVertexX, 3),
                                arrayAtI32(Ground.drawTextureVertexY, 0),
                                arrayAtI32(Ground.drawTextureVertexY, 1),
                                arrayAtI32(Ground.drawTextureVertexY, 3),
                                arrayAtI32(Ground.drawTextureVertexZ, 0),
                                arrayAtI32(Ground.drawTextureVertexZ, 1),
                                arrayAtI32(Ground.drawTextureVertexZ, 3),
                                arrayAtI32(var0.faceTexture, var10)
                            );
                        } else {
                            Pix3D.terrainTextureTriangle(
                                var17,
                                var18,
                                var19,
                                var14,
                                var15,
                                var16,
                                arrayAtI32(var0.faceColourA, var10),
                                arrayAtI32(var0.faceColourB, var10),
                                arrayAtI32(var0.faceColourC, var10),
                                arrayAtI32(Ground.drawTextureVertexX, var11),
                                arrayAtI32(Ground.drawTextureVertexX, var12),
                                arrayAtI32(Ground.drawTextureVertexX, var13),
                                arrayAtI32(Ground.drawTextureVertexY, var11),
                                arrayAtI32(Ground.drawTextureVertexY, var12),
                                arrayAtI32(Ground.drawTextureVertexY, var13),
                                arrayAtI32(Ground.drawTextureVertexZ, var11),
                                arrayAtI32(Ground.drawTextureVertexZ, var12),
                                arrayAtI32(Ground.drawTextureVertexZ, var13),
                                arrayAtI32(var0.faceTexture, var10)
                            );
                        }
                    } else {
                        const var20 = requireNonNull(Pix3D.textureProvider).getTextureColour(arrayAtI32(var0.faceTexture, var10));
                        Pix3D.gouraudTriangle(
                            var17,
                            var18,
                            var19,
                            var14,
                            var15,
                            var16,
                            world.TextureLightCol(var20, arrayAtI32(var0.faceColourA, var10)),
                            world.TextureLightCol(var20, arrayAtI32(var0.faceColourB, var10)),
                            world.TextureLightCol(var20, arrayAtI32(var0.faceColourC, var10))
                        );
                    }
                }
            }
        }
    }

    // nf.a(II)I
    // Scales the lightness (low 7 bits) of HSL colour var0 by var1 / 128, clamped to 2..126.
    static TextureLightCol(var0: number, var1: number): number {
        var1 = Math.imul(var1, var0 & 127) >> 7;
        if (var1 < 2) {
            var1 = 2;
        } else if (var1 > 126) {
            var1 = 126;
        }

        return ((var0 & 65408) + var1) | 0;
    }

    // le.a(IIIIIIII)Z
    // Whether the screen point (var0 = x, var1 = y) lies inside the triangle whose y are (var2, var3, var4) and whose x
    // are (var5, var6, var7).
    static InsideTriangle(var0: number, var1: number, var2: number, var3: number, var4: number, var5: number, var6: number, var7: number): boolean {
        if (var1 < var2 && var1 < var3 && var1 < var4) {
            return false;
        }

        if (var1 > var2 && var1 > var3 && var1 > var4) {
            return false;
        }

        if (var0 < var5 && var0 < var6 && var0 < var7) {
            return false;
        }

        if (var0 > var5 && var0 > var6 && var0 > var7) {
            return false;
        }

        const var8 = (Math.imul(var1 - var2, var6 - var5) - Math.imul(var0 - var5, var3 - var2)) | 0;
        const var9 = (Math.imul(var1 - var4, var5 - var7) - Math.imul(var0 - var7, var2 - var4)) | 0;
        const var10 = (Math.imul(var1 - var3, var7 - var6) - Math.imul(var0 - var6, var4 - var3)) | 0;
        return Math.imul(var8, var10) > 0 && Math.imul(var10, var9) > 0;
    }

    // bh.a(III)Z
    // Whether the ground of (var0, var1, var2) is fully hidden by an active occluder; cached per tile for the frame.
    static GroundoOcluded(var0: number, var1: number, var2: number): boolean {
        const var3 = at3I32(world.levelTileOcclusionCycles, var0, var1, var2);
        if (var3 === (-world.cycleNo | 0)) {
            return false;
        }

        if (var3 === world.cycleNo) {
            return true;
        }

        const var4 = var1 << 7;
        const var5 = var2 << 7;
        if (
            world.Occluded((var4 + 1) | 0, at3I32(world.levelHeightmaps, var0, var1, var2), (var5 + 1) | 0) &&
            world.Occluded((var4 + 128 - 1) | 0, at3I32(world.levelHeightmaps, var0, var1 + 1, var2), (var5 + 1) | 0) &&
            world.Occluded((var4 + 128 - 1) | 0, at3I32(world.levelHeightmaps, var0, var1 + 1, var2 + 1), (var5 + 128 - 1) | 0) &&
            world.Occluded((var4 + 1) | 0, at3I32(world.levelHeightmaps, var0, var1, var2 + 1), (var5 + 128 - 1) | 0)
        ) {
            arrayPutI32(at2(world.levelTileOcclusionCycles, var0, var1), var2, world.cycleNo);
            return true;
        }

        arrayPutI32(at2(world.levelTileOcclusionCycles, var0, var1), var2, -world.cycleNo | 0);
        return false;
    }

    // wk.a(IIII)Z
    // Whether the wall of type mask var3 on (var0, var1, var2) is fully hidden by an active occluder.
    static WallOccluded(var0: number, var1: number, var2: number, var3: number): boolean {
        if (!world.GroundoOcluded(var0, var1, var2)) {
            return false;
        }

        const var4 = var1 << 7;
        const var5 = var2 << 7;
        const var6 = (at3I32(world.levelHeightmaps, var0, var1, var2) - 1) | 0;
        const var7 = (var6 - 120) | 0;
        const var8 = (var6 - 230) | 0;
        const var9 = (var6 - 238) | 0;
        if (var3 < 16) {
            if (var3 === 1) {
                if (var4 > world.cx) {
                    if (!world.Occluded(var4, var6, var5)) {
                        return false;
                    }

                    if (!world.Occluded(var4, var6, (var5 + 128) | 0)) {
                        return false;
                    }
                }

                if (var0 > 0) {
                    if (!world.Occluded(var4, var7, var5)) {
                        return false;
                    }

                    if (!world.Occluded(var4, var7, (var5 + 128) | 0)) {
                        return false;
                    }
                }

                if (!world.Occluded(var4, var8, var5)) {
                    return false;
                }

                if (!world.Occluded(var4, var8, (var5 + 128) | 0)) {
                    return false;
                }

                return true;
            }

            if (var3 === 2) {
                if (var5 < world.cz) {
                    if (!world.Occluded(var4, var6, (var5 + 128) | 0)) {
                        return false;
                    }

                    if (!world.Occluded((var4 + 128) | 0, var6, (var5 + 128) | 0)) {
                        return false;
                    }
                }

                if (var0 > 0) {
                    if (!world.Occluded(var4, var7, (var5 + 128) | 0)) {
                        return false;
                    }

                    if (!world.Occluded((var4 + 128) | 0, var7, (var5 + 128) | 0)) {
                        return false;
                    }
                }

                if (!world.Occluded(var4, var8, (var5 + 128) | 0)) {
                    return false;
                }

                if (!world.Occluded((var4 + 128) | 0, var8, (var5 + 128) | 0)) {
                    return false;
                }

                return true;
            }

            if (var3 === 4) {
                if (var4 < world.cx) {
                    if (!world.Occluded((var4 + 128) | 0, var6, var5)) {
                        return false;
                    }

                    if (!world.Occluded((var4 + 128) | 0, var6, (var5 + 128) | 0)) {
                        return false;
                    }
                }

                if (var0 > 0) {
                    if (!world.Occluded((var4 + 128) | 0, var7, var5)) {
                        return false;
                    }

                    if (!world.Occluded((var4 + 128) | 0, var7, (var5 + 128) | 0)) {
                        return false;
                    }
                }

                if (!world.Occluded((var4 + 128) | 0, var8, var5)) {
                    return false;
                }

                if (!world.Occluded((var4 + 128) | 0, var8, (var5 + 128) | 0)) {
                    return false;
                }

                return true;
            }

            if (var3 === 8) {
                if (var5 > world.cz) {
                    if (!world.Occluded(var4, var6, var5)) {
                        return false;
                    }

                    if (!world.Occluded((var4 + 128) | 0, var6, var5)) {
                        return false;
                    }
                }

                if (var0 > 0) {
                    if (!world.Occluded(var4, var7, var5)) {
                        return false;
                    }

                    if (!world.Occluded((var4 + 128) | 0, var7, var5)) {
                        return false;
                    }
                }

                if (!world.Occluded(var4, var8, var5)) {
                    return false;
                }

                if (!world.Occluded((var4 + 128) | 0, var8, var5)) {
                    return false;
                }

                return true;
            }
        }

        if (!world.Occluded((var4 + 64) | 0, var9, (var5 + 64) | 0)) {
            return false;
        }

        if (var3 === 16) {
            if (!world.Occluded(var4, var8, (var5 + 128) | 0)) {
                return false;
            }

            return true;
        }

        if (var3 === 32) {
            if (!world.Occluded((var4 + 128) | 0, var8, (var5 + 128) | 0)) {
                return false;
            }

            return true;
        }

        if (var3 === 64) {
            if (!world.Occluded((var4 + 128) | 0, var8, var5)) {
                return false;
            }

            return true;
        }

        if (var3 === 128) {
            if (!world.Occluded(var4, var8, var5)) {
                return false;
            }

            return true;
        }

        return true;
    }

    // cf.a(IIII)Z
    // Whether a one-tile model on (var0, var1, var2) whose lowest point is var3 above the ground is fully hidden.
    static SpriteOccluded(var0: number, var1: number, var2: number, var3: number): boolean {
        if (!world.GroundoOcluded(var0, var1, var2)) {
            return false;
        }

        const var4 = var1 << 7;
        const var5 = var2 << 7;
        return (
            world.Occluded((var4 + 1) | 0, (at3I32(world.levelHeightmaps, var0, var1, var2) + var3) | 0, (var5 + 1) | 0) &&
            world.Occluded((var4 + 128 - 1) | 0, (at3I32(world.levelHeightmaps, var0, var1 + 1, var2) + var3) | 0, (var5 + 1) | 0) &&
            world.Occluded((var4 + 128 - 1) | 0, (at3I32(world.levelHeightmaps, var0, var1 + 1, var2 + 1) + var3) | 0, (var5 + 128 - 1) | 0) &&
            world.Occluded((var4 + 1) | 0, (at3I32(world.levelHeightmaps, var0, var1, var2 + 1) + var3) | 0, (var5 + 128 - 1) | 0)
        );
    }

    // pe.a(IIIIII)Z
    // NXT's six-argument SpriteOccluded overload: whether a sprite on level var0 spanning tiles var1..var2 x var3..var4,
    // whose lowest point is var5 above the ground, is fully hidden. (The member-map name reads inverted: true = hidden.)
    static SpriteOccluded2(var0: number, var1: number, var2: number, var3: number, var4: number, var5: number): boolean {
        if (var1 === var2 && var3 === var4) {
            if (!world.GroundoOcluded(var0, var1, var3)) {
                return false;
            }

            const var12 = var1 << 7;
            const var14 = var3 << 7;
            return (
                world.Occluded((var12 + 1) | 0, (at3I32(world.levelHeightmaps, var0, var1, var3) + var5) | 0, (var14 + 1) | 0) &&
                world.Occluded((var12 + 128 - 1) | 0, (at3I32(world.levelHeightmaps, var0, var1 + 1, var3) + var5) | 0, (var14 + 1) | 0) &&
                world.Occluded((var12 + 128 - 1) | 0, (at3I32(world.levelHeightmaps, var0, var1 + 1, var3 + 1) + var5) | 0, (var14 + 128 - 1) | 0) &&
                world.Occluded((var12 + 1) | 0, (at3I32(world.levelHeightmaps, var0, var1, var3 + 1) + var5) | 0, (var14 + 128 - 1) | 0)
            );
        }

        for (let var6 = var1; var6 <= var2; var6++) {
            for (let var7 = var3; var7 <= var4; var7++) {
                if (at3I32(world.levelTileOcclusionCycles, var0, var6, var7) === (-world.cycleNo | 0)) {
                    return false;
                }
            }
        }

        const var13 = ((var1 << 7) + 1) | 0;
        const var8 = ((var3 << 7) + 2) | 0;
        const var9 = (at3I32(world.levelHeightmaps, var0, var1, var3) + var5) | 0;
        if (!world.Occluded(var13, var9, var8)) {
            return false;
        }

        const var10 = ((var2 << 7) - 1) | 0;
        if (!world.Occluded(var10, var9, var8)) {
            return false;
        }

        const var11 = ((var4 << 7) - 1) | 0;
        if (!world.Occluded(var13, var9, var11)) {
            return false;
        }

        if (!world.Occluded(var10, var9, var11)) {
            return false;
        }

        return true;
    }

    // tj.a(III)Z
    // Whether the world point (var0, var1, var2) is behind an active occluder.
    static Occluded(var0: number, var1: number, var2: number): boolean {
        const active = world.activeOccluders,
            count = world.numActiveOccluders;
        const complete = active !== null && count <= active.length;
        for (let var3 = 0; var3 < count; var3++) {
            const var4 = requireNonNull(complete ? active[var3] : arrayAtObj(active, var3));
            if (var4.mode === 1) {
                const var5 = (var4.minX - var0) | 0;
                if (var5 > 0) {
                    const var6 = (var4.minZ + (Math.imul(var4.minDeltaZ, var5) >> 8)) | 0;
                    const var7 = (var4.maxZ + (Math.imul(var4.maxDeltaZ, var5) >> 8)) | 0;
                    const var8 = (var4.minY + (Math.imul(var4.minDeltaY, var5) >> 8)) | 0;
                    const var9 = (var4.maxY + (Math.imul(var4.maxDeltaY, var5) >> 8)) | 0;
                    if (var2 >= var6 && var2 <= var7 && var1 >= var8 && var1 <= var9) {
                        return true;
                    }
                }
            } else if (var4.mode === 2) {
                const var10 = (var0 - var4.minX) | 0;
                if (var10 > 0) {
                    const var14 = (var4.minZ + (Math.imul(var4.minDeltaZ, var10) >> 8)) | 0;
                    const var18 = (var4.maxZ + (Math.imul(var4.maxDeltaZ, var10) >> 8)) | 0;
                    const var22 = (var4.minY + (Math.imul(var4.minDeltaY, var10) >> 8)) | 0;
                    const var26 = (var4.maxY + (Math.imul(var4.maxDeltaY, var10) >> 8)) | 0;
                    if (var2 >= var14 && var2 <= var18 && var1 >= var22 && var1 <= var26) {
                        return true;
                    }
                }
            } else if (var4.mode === 3) {
                const var11 = (var4.minZ - var2) | 0;
                if (var11 > 0) {
                    const var15 = (var4.minX + (Math.imul(var4.minDeltaX, var11) >> 8)) | 0;
                    const var19 = (var4.maxX + (Math.imul(var4.maxDeltaX, var11) >> 8)) | 0;
                    const var23 = (var4.minY + (Math.imul(var4.minDeltaY, var11) >> 8)) | 0;
                    const var27 = (var4.maxY + (Math.imul(var4.maxDeltaY, var11) >> 8)) | 0;
                    if (var0 >= var15 && var0 <= var19 && var1 >= var23 && var1 <= var27) {
                        return true;
                    }
                }
            } else if (var4.mode === 4) {
                const var12 = (var2 - var4.minZ) | 0;
                if (var12 > 0) {
                    const var16 = (var4.minX + (Math.imul(var4.minDeltaX, var12) >> 8)) | 0;
                    const var20 = (var4.maxX + (Math.imul(var4.maxDeltaX, var12) >> 8)) | 0;
                    const var24 = (var4.minY + (Math.imul(var4.minDeltaY, var12) >> 8)) | 0;
                    const var28 = (var4.maxY + (Math.imul(var4.maxDeltaY, var12) >> 8)) | 0;
                    if (var0 >= var16 && var0 <= var20 && var1 >= var24 && var1 <= var28) {
                        return true;
                    }
                }
            } else if (var4.mode === 5) {
                const var13 = (var1 - var4.minY) | 0;
                if (var13 > 0) {
                    const var17 = (var4.minX + (Math.imul(var4.minDeltaX, var13) >> 8)) | 0;
                    const var21 = (var4.maxX + (Math.imul(var4.maxDeltaX, var13) >> 8)) | 0;
                    const var25 = (var4.minZ + (Math.imul(var4.minDeltaZ, var13) >> 8)) | 0;
                    const var29 = (var4.maxZ + (Math.imul(var4.maxDeltaZ, var13) >> 8)) | 0;
                    if (var0 >= var17 && var0 <= var21 && var2 >= var25 && var2 <= var29) {
                        return true;
                    }
                }
            }
        }

        return false;
    }
}

const originalTestColumn = world.testColumn;

// Each access performs its JVM null and bounds checks in the original order. The
// outer arrays contain references. Only the height, occlusion and water rows contain ints.
function at2<T>(array: T[][] | null, i: number, j: number): T {
    return arrayAtObj(arrayAtObj(array, i), j);
}

function at3<T>(array: T[][][] | null, i: number, j: number, k: number): T {
    return arrayAtObj(at2(array, i, j), k);
}

function at2I32(array: Int32Array[] | null, i: number, j: number): number {
    return arrayAtI32(arrayAtObj(array, i), j);
}

function at3I32(array: Int32Array[][] | null, i: number, j: number, k: number): number {
    return arrayAtI32(at2(array, i, j), k);
}

// JVM multianewarray: every dimension is checked for a negative count before anything is allocated.
function checkDimensions(...dimensions: number[]): void {
    for (const dimension of dimensions) {
        if (dimension < 0) throw new RangeError('NegativeArraySizeException ' + dimension);
    }
}

// new ra[d0][d1][d2]
function newSquareArray3(d0: number, d1: number, d2: number): (Square | null)[][][] {
    checkDimensions(d0, d1, d2);
    return Array.from({ length: d0 }, () => Array.from({ length: d1 }, () => new Array<Square | null>(d2).fill(null)));
}

// new int[d0][d1][d2]
function newIntArray3(d0: number, d1: number, d2: number): Int32Array[][] {
    checkDimensions(d0, d1, d2);
    return Array.from({ length: d0 }, () => Array.from({ length: d1 }, () => new Int32Array(d2)));
}

// new int[d0][d1]
function newIntArray2(d0: number, d1: number): Int32Array[] {
    checkDimensions(d0, d1);
    return Array.from({ length: d0 }, () => new Int32Array(d1));
}

// new boolean[d0][d1]
function newBooleanArray2(d0: number, d1: number): boolean[][] {
    checkDimensions(d0, d1);
    return Array.from({ length: d0 }, () => new Array<boolean>(d1).fill(false));
}

// new byte[d0][d1][d2]
function newByteArray3(d0: number, d1: number, d2: number): Uint8Array[][] {
    checkDimensions(d0, d1, d2);
    return Array.from({ length: d0 }, () => Array.from({ length: d1 }, () => new Uint8Array(d2)));
}
