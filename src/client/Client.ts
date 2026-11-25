import AnimFrame from '#/dash3d/AnimFrame';
import AnimFrameSet from '#/dash3d/AnimFrameSet';
import BZip2Decompressor from '#/cache/BZip2Decompressor';
import ByteArrayPool from '#/io/ByteArrayPool';
import ColourImageCache from '#/dash3d/ColourImageCache';
import CookieStatics from '#/util/CookieStatics';
import Crc32 from '#/io/Crc32';
import Filter from '#/sound/Filter';
import Floor from '#/sound/Floor';
import Ground from '#/dash3d/Ground';
import JagVorbis from '#/sound/JagVorbis';
import MidiParser from '#/sound/MidiParser';
import ModelLit from '#/dash3d/ModelLit';
import ModelLitImpl from '#/dash3d/ModelLitImpl';
import ModelUnlit from '#/dash3d/ModelUnlit';
import MonochromeImageCache from '#/dash3d/MonochromeImageCache';
import NativePcmPlayer from '#/sound/NativePcmPlayer';
import PlayerTask from '#/sound/PlayerTask';
import ProceduralTexture from '#/dash3d/ProceduralTexture';
import QuickChatPhraseType from '#/config/QuickChatPhraseType';
import Texture from '#/dash3d/Texture';
import TextureOp from '#/dash3d/TextureOp';
import TextureOpEmboss from '#/dash3d/TextureOpEmboss';
import TextureOpPerlinNoise from '#/dash3d/TextureOpPerlinNoise';
import TextureOpSprite from '#/dash3d/TextureOpSprite';
import TextureShapeRaster from '#/dash3d/TextureShapeRaster';
import WorldMapFont from '#/graphics/WorldMapFont';
import BrowserControl from '#/util/BrowserControl';
import LocMergeQueue from './LocMergeQueue';
import LocShape from '#/dash3d/LocShape';
import MapSpotAnimNode from '#/dash3d/MapSpotAnimNode';
import FriendChatChannel from './FriendChatChannel';
import GameWorld from '#/io/GameWorld';
import ReceivePlayerPositions from './ReceivePlayerPositions';
import QuickChatCatTypeList from '#/config/QuickChatCatTypeList';
import QuickChatPhraseTypeList from '#/config/QuickChatPhraseTypeList';
import NpcType from '#/config/NpcType';
import LocType from '#/config/LocType';
import ObjType from '#/config/ObjType';
import Protocol from '#/io/Protocol';
import AccountCreation from '#/io/AccountCreation';
import TitleFlames from '#/title/TitleFlames';
import LRUHashCache from '#/datastruct/LRUHashCache';
import IfType from '#/ui/IfType';
import Skill from './Skill';
import BASTypeList from '#/config/BASTypeList';
import FloType from '#/config/FloType';
import FluType from '#/config/FluType';
import IdkType from '#/config/IdkType';
import SpotType from '#/config/SpotType';
import VarBitType from '#/config/VarBitType';
import VarpType from '#/config/VarpType';
import LightType from '#/config/LightType';
import ClientBuild from './ClientBuild';
import { glJar } from './ClientVariant';
import BrowserGlCanvas from './BrowserGlCanvas';
import type GpuDevice from '#/gl/driver/GpuDevice';
import type SdBrowserDisplay from './SdBrowserDisplay';
import CinematicCamera from './CinematicCamera';
import MapArea from '#/ui/MapArea';
import MinimapBuilder from '#/dash3d/MinimapBuilder';
import LocEntity from '#/dash3d/LocEntity';
import LruHashTable from '#/datastruct/LruHashTable';
import MapSpotAnim from '#/dash3d/MapSpotAnim';
import ClientEntity from '#/dash3d/ClientEntity';
import ClientNpc from '#/dash3d/ClientNpc';
import JagFX from '#/sound/JagFX';
import WaveStream from '#/sound/WaveStream';
import HintArrow from './HintArrow';
import type SignlinkRequest from '#/util/SignlinkRequest';
import WordPack from '#/io/WordPack';
import ClientQuickChatCommandDecoder from '#/config/ClientQuickChatCommandDecoder';
import EnumType from '#/config/EnumType';
import InvType from '#/config/InvType';
import ParamType from '#/config/ParamType';
import StructType from '#/config/StructType';
import ClientObjNode from '#/dash3d/ClientObjNode';
import ClientObj from '#/dash3d/ClientObj';
import CursorType from '#/config/CursorType';
import Pix3D from '#/dash3d/Pix3D';
import TextureCache from '#/dash3d/TextureCache';
import { CanvasComponent, type AwtComponent } from '#/graphics/PixScreen';
import GameCanvas from '#/graphics/GameCanvas';
import { doubleToInt, intDivide, isPowerOfTwo } from '#/util/IntUtils';
import PixfontGeneric from '#/graphics/PixfontGeneric';
import SpriteLoader from '#/graphics/SpriteLoader';
import Fonts from '#/graphics/Fonts';
import type AbstractSprite from '#/graphics/AbstractSprite';
import type Pix8 from '#/graphics/Pix8';
import Pix32 from '#/graphics/Pix32';
import { mathRandom } from '#/util/JavaRandom';
import SoftwareFont from '#/graphics/SoftwareFont';
import Pix2D from '#/graphics/Pix2D';
import MouseTracking from './MouseTracking';
import SafeTime from '#/io/SafeTime';
import CollisionMap from '#/dash3d/CollisionMap';
import ParticleSystem from '#/dash3d/ParticleSystem';
import SeqType from '#/config/SeqType';
import WorldList from '#/io/WorldList';
import { parseJavaInt } from '#/io/JavaText';
import ClientPlayer from '#/dash3d/ClientPlayer';
import ClientProj from '#/dash3d/ClientProj';
import ClientProjNode from '#/dash3d/ClientProjNode';
import SharedPtrList from '#/datastruct/SharedPtrList';
import OrbitCamera from './OrbitCamera';
import HashTable from '#/datastruct/HashTable';
import ServerActiveProperties from '#/ui/ServerActiveProperties';
import SubInterface from '#/ui/SubInterface';
import world from '#/dash3d/world';
import ClientLocAnim from '#/dash3d/ClientLocAnim';
import InterfaceView from '#/ui/InterfaceView';
import InterfaceList from '#/ui/InterfaceList';
import MSITypeList from '#/config/MSITypeList';
import Huffman from '#/io/Huffman';
import WorldMap from '#/ui/WorldMap';
import WorldMapLabels from '#/ui/WorldMapLabels';
import GameVariant from './GameVariant';
import GameShell, { gameClient, type ShellContainer } from './GameShell';
import { browserFullscreenHost, type StandaloneFrame } from './StandaloneFrame';
import Signlink from '#/util/Signlink';
import ClientMouseListener, { type MouseSurface } from './ClientMouseListener';
import MouseWheel, { type WheelSurface } from './MouseWheel';
import BrowserMouseSurface from './BrowserMouseSurface';
import BrowserTouchControls from './BrowserTouchControls';
import PlayerModel from '#/dash3d/PlayerModel';
import GlLighting from '#/gl/GlLighting';
import Preferences from '#/ui/Preferences';
import LocChange from '#/dash3d/LocChange';
import ClientInvCache from './ClientInvCache';
import { ClientScript } from '#/script/ClientScript';
import ReflectionCheck from '#/io/ReflectionCheck';
import ClientVarCache from '#/util/ClientVarCache';
import DelayedStateChange from '#/ui/DelayedStateChange';
import StockPlayerOffer from './StockPlayerOffer';
import RoofModeStatics from '#/dash3d/RoofModeStatics';
import Js5 from '#/cache/Js5';
import BrowserJs5Storage from '#/cache/BrowserJs5Storage';
import Js5Resources, { browserDiskStore, openBrowserJs5Database, type Js5Storage } from '#/cache/Js5Resources';
import DataFile from '#/cache/DataFile';
import Js5MasterIndex from '#/cache/Js5MasterIndex';
import Js5RemoteLoader from '#/cache/Js5RemoteLoader';
import type { Js5DiskStore } from '#/cache/Js5DiskRequest';
import BufferedRandomAccessFile from '#/io/BufferedRandomAccessFile';
import { FileIoError } from '#/io/File';
import { isJavaRuntimeException } from '#/util/JavaException';
import JagString, { fromJsString, fromLiteral, hashTableInitStrings, linkableInitStrings, type JagStringApplet } from '#/datastruct/JagString';
import LocalisedText from '#/ui/LocalisedText';
import WrappedException from '#/util/WrappedException';
import { releaseReferences } from '#/util/StaticReferences';
import { clientErrorHost, JavaError, reportClientError } from '#/util/ClientError';
import { arrayAtB64, arrayAtI16, arrayAtI32, arrayAtI8, arrayAtObj, arrayAtU8, arrayPutB64, arrayPutI16, arrayPutI32, arrayPutI8, arrayPutObj, arrayPutU8, requireNonNull } from '#/util/JavaArray';
import PacketT from '#/io/PacketT';
import SuperPacket from '#/io/SuperPacket';
import HookReq from '#/script/HookReq';
import ScriptRunner from '#/script/ScriptRunner';
import { runToCompletion } from '#/script/ScriptContinuation';
import { captureSceneRegion, type Rebuild } from '#/io/GameProtocol';
import RouteFinding from '#/movement/RouteFinding';
import ChatHistory from '#/game/ChatHistory';
import GameState from '#/game/GameState';
import { legacyGroundObjects, legacyLocTypecodes } from '#/game/ZoneState';
import Js5NetQueue from '#/io/Js5NetQueue';
import Js5LocalCache from '#/cache/Js5LocalCache';
import ClientStream from '#/io/ClientStream';
import Login from '#/io/Login';
import type { GameSession } from '#/io/Login';
import { discardSocket, SocketIoError, type SocketHandle, type Js5Stream } from '#/io/SocketPlatform';
import Minimenu from '#/ui/Minimenu';
import MinimenuOps from '#/ui/MinimenuOps';
import ComponentDrag from '#/ui/ComponentDrag';
import BrowserKeyboardSurface from '#/Keyboard';
import ClientKeyboardListener, { type KeyboardSurface } from './ClientKeyboardListener';
import TitleScreen from '#/title/TitleScreen';
import InterfaceSession from '#/ui/InterfaceSession';
import SceneCutover from '#/scene/SceneCutover';
import PcmOutput from '#/audio/PcmOutput';
import DevicePcmPlayer from '#/sound/DevicePcmPlayer';
import PCMPlayer from '#/sound/PCMPlayer';
import MidiPlayer from '#/sound/MidiPlayer';
import Mixer from '#/sound/Mixer';
import Decimator from '#/sound/Decimator';
import AudioEngine from '#/sound/AudioEngine';
import MidiManager from '#/sound/MidiManager';
import AreaSoundManager from '#/sound/AreaSoundManager';
import GlRendererClass, { type GlCanvas } from '#/gl/GlRenderer';
import PointLightManagerClass from '#/gl/PointLightManager';
import MaterialManager from '#/gl/material/MaterialManager';
import GlCleaner from '#/gl/GlCleaner';
import GroundShadowsClass from '#/dash3d/GroundShadows';
import NoiseTextures from '#/gl/NoiseTextures';
import Timer from './Timer';
import PixScreen from '#/graphics/PixScreen';
import DisplayMode from './DisplayMode';
import AbstractSpriteClass from '#/graphics/AbstractSprite';
import FriendChatUser from './FriendChatUser';
import Square from '#/dash3d/Square';
import Linkable from '#/datastruct/Linkable';
import SecondaryLinkedList from '#/datastruct/SecondaryLinkedList';
import ActorSlotAnim from '#/dash3d/ActorSlotAnim';
import SecondaryHashTable from '#/datastruct/SecondaryHashTable';
import Js5DiskRequest from '#/cache/Js5DiskRequest';
import Js5NetQueueRequest from '#/io/Js5NetQueueRequest';
import AbstractIndexedSprite from '#/graphics/AbstractIndexedSprite';
import MidiNote from '#/sound/MidiNote';
import MidiMixer from '#/sound/MidiMixer';
import Patch from '#/sound/Patch';
import StaticPointLight from '#/dash3d/StaticPointLight';
import Js5ResourceProvider from '#/cache/Js5ResourceProvider';
import Js5Index from '#/cache/Js5Index';
import Js5Request from '#/io/Js5Request';
import Js5Compression from '#/cache/Js5Compression';
import SecondaryNode from '#/datastruct/SecondaryNode';
import QuickChatCatType from '#/config/QuickChatCatType';
import WorldCountry from '#/io/WorldCountry';
import ClientGosubFrame from '#/script/ClientGosubFrame';
import ModelSource from '#/dash3d/ModelSource';
import TerrainBatch from '#/dash3d/TerrainBatch';
import Sprite from '#/dash3d/Sprite';
import Occlude from '#/dash3d/Occlude';
import Wall from '#/dash3d/Wall';
import Decor from '#/dash3d/Decor';
import GroundDecor from '#/dash3d/GroundDecor';
import GroundObject from '#/dash3d/GroundObject';
import QuickGround from '#/dash3d/QuickGround';
import GroundShadowBlock from '#/dash3d/GroundShadowBlock';
import LongNode from '#/datastruct/LongNode';
import Bgsound from '#/sound/bgsound';
import PendingLocMerge from '#/dash3d/PendingLocMerge';
import HashTableIterator from '#/datastruct/HashTableIterator';
import StringNode from '#/datastruct/StringNode';
import TerrainBuilder from '#/dash3d/TerrainBuilder';
import IntNode from '#/datastruct/IntNode';
import PointNormal from '#/dash3d/PointNormal';
import IntHashTable from '#/cache/IntHashTable';
import ByteArrayCopier from '#/cache/ByteArrayCopier';
import BZip2State from '#/cache/BZip2State';
import ReferenceNode from '#/datastruct/ReferenceNode';
import HardReferenceNode from '#/datastruct/HardReferenceNode';
import ReferenceNodeFactory from '#/datastruct/ReferenceNodeFactory';
import PatchNoteSet from '#/datastruct/PatchNoteSet';
import EnvelopeSet from '#/sound/EnvelopeSet';
import WaterProgramMaterial from '#/gl/material/WaterProgramMaterial';
import HighDetailWaterMaterial from '#/gl/material/HighDetailWaterMaterial';
import Noise3D from '#/gl/noise/Noise3D';
import EnumStringEntry from '#/datastruct/EnumStringEntry';
import AbstractWorld from '#/io/AbstractWorld';
import RidgedMultifractal3D from '#/gl/noise/RidgedMultifractal3D';
import FractalNoise3D from '#/gl/noise/FractalNoise3D';
import TextureOpMonochromeFill from '#/dash3d/TextureOpMonochromeFill';
import TextureOpColour from '#/dash3d/TextureOpColour';
import TextureOpHorizontalGradient from '#/dash3d/TextureOpHorizontalGradient';
import TextureOpVerticalGradient from '#/dash3d/TextureOpVerticalGradient';
import TextureOpBricks from '#/dash3d/TextureOpBricks';
import TextureOpClamp from '#/dash3d/TextureOpClamp';
import TextureOpCombine from '#/dash3d/TextureOpCombine';
import TextureOpCurve from '#/dash3d/TextureOpCurve';
import TextureOpColourGradient from '#/dash3d/TextureOpColourGradient';
import TextureOpColourize from '#/dash3d/TextureOpColourize';
import TextureOpWaveform from '#/dash3d/TextureOpWaveform';
import TextureOpNoise from '#/dash3d/TextureOpNoise';
import TextureOpWeave from '#/dash3d/TextureOpWeave';
import TextureOpVoronoiNoise from '#/dash3d/TextureOpVoronoiNoise';
import TextureOpHerringbone from '#/dash3d/TextureOpHerringbone';
import TextureOpHslAdjust from '#/dash3d/TextureOpHslAdjust';
import TextureOpPolarDistortion from '#/dash3d/TextureOpPolarDistortion';
import TextureOpTile from '#/dash3d/TextureOpTile';
import TextureOpInvert from '#/dash3d/TextureOpInvert';
import TextureOpKaleidoscope from '#/dash3d/TextureOpKaleidoscope';
import TextureOpMonochrome from '#/dash3d/TextureOpMonochrome';
import TextureOpColourKey from '#/dash3d/TextureOpColourKey';
import TextureOpBinary from '#/dash3d/TextureOpBinary';
import TextureOpStripes from '#/dash3d/TextureOpStripes';
import TextureOpIrregularBricks from '#/dash3d/TextureOpIrregularBricks';
import TextureOpShapes from '#/dash3d/TextureOpShapes';
import TextureOpRange from '#/dash3d/TextureOpRange';
import TextureOpMandelbrot from '#/dash3d/TextureOpMandelbrot';
import TextureOpNormalMap from '#/dash3d/TextureOpNormalMap';
import TextureOpEdgeDetector from '#/dash3d/TextureOpEdgeDetector';
import TextureOpTexture from '#/dash3d/TextureOpTexture';
import TextureOpDiagonalWaves from '#/dash3d/TextureOpDiagonalWaves';
import TextureOpLineNoise from '#/dash3d/TextureOpLineNoise';
import BrokenInputStream from '#/io/BrokenInputStream';
import SecondaryByteArrayNode from '#/datastruct/SecondaryByteArrayNode';
import ColourImageCacheEntry from '#/dash3d/ColourImageCacheEntry';
import MonochromeImageCacheEntry from '#/dash3d/MonochromeImageCacheEntry';
import TextureShape from '#/dash3d/TextureShape';
import TextureShapeLine from '#/dash3d/TextureShapeLine';
import TextureShapeBezier from '#/dash3d/TextureShapeBezier';
import TextureShapeRect from '#/dash3d/TextureShapeRect';
import { loadEnvironment, loadGlModel, loadGlRaster, loadGlSolidTexture, loadGlSprite, loadTone } from '#/util/GamepackClasses';

// The interface loop looks up the same component every tick. Reuse its Java long
// key while both IDs match, and read the current server properties on every lookup.
const activePropertyKeys = new WeakMap<IfType, { id: number; child: number; key: bigint }>();

// JVM shutdown also clears references whose active-client TypeScript types are non-null.
// Only declared static slots are accepted here, including readonly initializers.
export default class Client extends GameShell {
    // HD client.c(Z)V
    static releaseClientStatics(guard: boolean): void {
        try {
            if (!guard) {
                releaseReferences(world, 'mainTerrainBatches');
            }
            releaseReferences(Client, 'mapBuildGroundFile');
            releaseReferences(LocalisedText, 'chatcol3', 'englishChatcol3');
            releaseReferences(DelayedStateChange, 'changes');
            releaseReferences(LocalisedText, 'defaultChatcol3');
            releaseReferences(world, 'mainTerrainBatches');
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'client.O(' + guard + ')');
        }
    }

    static hoveredSlotCom: IfType | null = null; // hg.f:Laj;
    static walkClickStage = 0; // lh.a:I
    static targetTileState = 0; // vi.S:I
    static tileActorCount: (Int32Array | null)[] | null = Array.from({ length: 104 }, () => new Int32Array(104)); // aj.Nb:[[I

    // ie.b(I)V
    static resetTileOccupancy(): void {
        for (let x = 0; x < 104; x++) {
            for (let z = 0; z < 104; z++) arrayPutI32(arrayAtObj(Client.tileActorCount, x), z, 0);
        }
    }

    // nc.a(ZI)V. NXT Client::GdmAddNPCs, projects/osclient/client_entityoverlays.cpp:786.
    static GdmAddNPCs(alwaysOnTop: boolean): void {
        for (let i = 0; i < Client.npcCount; i++) {
            const npc = arrayAtObj(Client.npcs, arrayAtI32(Client.npcIds, i));
            if (npc === null || !npc.isVisible() || requireNonNull(npc.npcType).m_alwaysOnTop !== alwaysOnTop || !requireNonNull(npc.npcType).IsMultiNpcVisible()) continue;
            const size = npc.getSize();
            if (size === 1) {
                if ((npc.x & 127) !== 64 || (npc.z & 127) !== 64) continue;
                const z = npc.z >> 7;
                const x = npc.x >> 7;
                if (x < 0 || x >= 104 || z < 0 || z >= 104) continue;
                const row = arrayAtObj(Client.tileActorCount, x);
                arrayPutI32(row, z, (arrayAtI32(row, z) + 1) | 0);
                continue;
            }
            if ((size & 1) === 0 && ((npc.x & 127) !== 0 || (npc.z & 127) !== 0)) continue;
            if ((size & 1) === 1 && ((npc.x & 127) !== 64 || (npc.z & 127) !== 64)) continue;
            let minX = (-Math.imul(size, 64) + npc.x) >> 7;
            let minZ = (-Math.imul(64, size) + npc.z) >> 7;
            let endX = (minX + npc.getSize()) | 0;
            if (endX > 104) endX = 104;
            if (minX < 0) minX = 0;
            let endZ = (npc.getSize() + minZ) | 0;
            if (minZ < 0) minZ = 0;
            if (endZ > 104) endZ = 104;
            for (let x = minX; x < endX; x++) {
                for (let z = minZ; z < endZ; z++) {
                    const row = arrayAtObj(Client.tileActorCount, x);
                    arrayPutI32(row, z, (arrayAtI32(row, z) + 1) | 0);
                }
            }
        }

        for (let i = 0; i < Client.npcCount; i++) {
            const npc = arrayAtObj(Client.npcs, arrayAtI32(Client.npcIds, i));
            let key = 0x20000000n | (BigInt(arrayAtI32(Client.npcIds, i)) << 32n);
            if (npc === null || !npc.isVisible() || requireNonNull(npc.npcType).m_alwaysOnTop !== alwaysOnTop || !requireNonNull(npc.npcType).IsMultiNpcVisible()) continue;
            const size = npc.getSize();
            if (size !== 1) {
                if (((size & 1) === 0 && (npc.x & 127) === 0 && (npc.z & 127) === 0) || ((size & 1) === 1 && (npc.x & 127) === 64 && (npc.z & 127) === 64)) {
                    let minX = (npc.x - Math.imul(size, 64)) >> 7;
                    let minZ = (npc.z - Math.imul(size, 64)) >> 7;
                    let endZ = (minZ + size) | 0;
                    if (minZ < 0) minZ = 0;
                    let endX = (minX + size) | 0;
                    if (endZ > 104) endZ = 104;
                    let covered = true;
                    if (endX > 104) endX = 104;
                    if (minX < 0) minX = 0;
                    for (let x = minX; x < endX; x++) {
                        for (let z = minZ; z < endZ; z++) {
                            if (arrayAtI32(arrayAtObj(Client.tileActorCount, x), z) <= 1) {
                                covered = false;
                                break;
                            }
                        }
                    }
                    if (covered) {
                        for (let x = minX; x < endX; x++) {
                            for (let z = minZ; z < endZ; z++) {
                                const row = arrayAtObj(Client.tileActorCount, x);
                                arrayPutI32(row, z, (arrayAtI32(row, z) - 1) | 0);
                            }
                        }
                        continue;
                    }
                }
            } else if ((npc.x & 127) === 64 && (npc.z & 127) === 64) {
                const x = npc.x >> 7;
                const z = npc.z >> 7;
                if (x < 0 || x >= 104 || z < 0 || z >= 104) continue;
                if (arrayAtI32(arrayAtObj(Client.tileActorCount, x), z) > 1) {
                    const row = arrayAtObj(Client.tileActorCount, x);
                    arrayPutI32(row, z, (arrayAtI32(row, z) - 1) | 0);
                    continue;
                }
            }
            if (!requireNonNull(npc.npcType).interactive) key |= -0x8000000000000000n;
            const level = Client.playerLevel;
            npc.sceneHeight = Client.GetAvH(npc.x, npc.z, level, -106);
            world.AddDynamic(Client.playerLevel, npc.x, npc.z, npc.sceneHeight, (60 + Math.imul(64, size - 1)) | 0, npc, npc.yaw, key, npc.stretches);
        }
    }

    static readonly FACING_MAP = Int32Array.of(768, 1024, 1280, 512, 1536, 256, 0, 1792); // sg.f:[I
    static members = false; // ka.c:Z
    static dnsRequest: SignlinkRequest<string> | null = null; // dd.e:Ldj;
    static playerLevel = 0; // ah.f:I
    static localPlayer: ClientPlayer | null = null; // te.g:Lpb;
    static readonly players = new Array<ClientPlayer | null>(2048).fill(null); // tf.J:[Lpb;
    static readonly npcs = new Array<ClientNpc | null>(32768).fill(null); // uc.l:[Lbk;
    static loopCycle = 0; // hh.kb:I
    static mapBuildBaseX = 0; // hk.e:I
    static mapBuildBaseZ = 0; // vj.t:I
    static destinationX = 0; // gl.z:I
    static destinationZ = 0; // ic.T:I
    static out = new SuperPacket(5000); // qk.v:Lbe;
    static gameState = 0; // tf.C:I
    static mapFilesMissing = 0; // ah.d:I
    static sceneState = 0; // bc.e:I
    static locsNotReadyCount = 0; // pd.r:I
    static mapLoadingTotal = 1; // th.d:I
    static maxLocModelsMissing = 1; // mf.p:I
    static titleSong = 0; // hi.j:I
    static jingleActive = false; // hj.d:Z
    static midiSong = -1; // dd.n:I

    static readonly statEffectiveLevel = new Int32Array(25); // di.i:[I
    static readonly statBaseLevel = new Int32Array(25); // wa.o:[I
    static readonly statXP = new Int32Array(25); // ll.m:[I
    static readonly levelExperience = new Int32Array(99); // vc.G:[I
    static {
        let sum = 0;
        for (let i = 0; i < 99; i++) {
            const level = i + 1;
            const points = (Math.pow(2, level / 7) * 300 + level) | 0;
            sum = (sum + points) | 0;
            this.levelExperience[i] = (sum / 4) | 0;
        }
    }
    static lastSentFocus = true; // rj.x:Z

    // tb.c(I)V
    static refreshToolbar(): void {
        if (!Client.advertSuppressed && Client.modeWhere !== 2) {
            try {
                BrowserControl.tbrefresh.callScript(Client.activeClient);
            } catch {
                // The original client ignores failures from this host operation.
            }
        }
    }

    // SD te.a(I)V / HD lf.a(I)V
    static rebuildSceneIfIngame(guard = 100): void {
        try {
            if (glJar && Client.gameState === 10 && GlRendererClass.active) Client.SetMainState(28);
            if (Client.gameState === 30) Client.SetMainState(25);
        } catch (error) {
            if (!glJar || !isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'lf.D(' + guard + ')');
        }
    }

    static readonly commandPrefix = fromLiteral('::'); // fi.b:Lid;
    static projectX = -1; // jl.e:I
    static projectY = -1; // tg.z:I

    // da.d:Z
    static playerMember = false;
    static staffModLevel = 0; // mi.E:I
    static blackmarks = 0; // tg.r:I
    static underage = false; // ld.g:Z
    static parentalChatConsent = false; // d.h:Z
    static parentalAdvertConsent = false; // aj.Cc:Z
    static mapQuickChat = false; // qi.Z:Z
    static localPid = -1; // mi.y:I
    static country = 0; // da.e:I
    static friendName37 = new BigInt64Array(200); // jd.m:[J
    static friendUsername: (JagString | null)[] = new Array(200).fill(null); // ck.p:[Lid;
    static friendWorld = new Int32Array(200); // jf.b:[I
    static friendWorldName: (JagString | null)[] = new Array(200).fill(null); // pa.qb:[Lid;
    static friendRank = new Int32Array(200); // sf.e:[I
    static friendSameGame = new Uint8Array(200); // m.L:[Z
    static runenergy = 0; // ie.s:I
    static runWeight = 0; // uj.k:I
    static mouseTracking: MouseTracking | null = null; // ej.p:Lag;
    static mouseTracked = false; // tj.h:Z
    static mouseTrackedX = 0; // se.a:I
    static mouseTrackedY = 0; // mk.K:I
    static mouseRepeatCount = 0; // lk.v:I
    static prevMouseClickTime = 0n; // ea.c:J
    static rebootTimer = 0; // wk.l:I
    static friendState = 0; // ei.u:I
    static friendCount = 0; // sj.L:I
    static ignoreName37 = new BigInt64Array(100); // pi.r:[J
    static ignoreNames: (JagString | null)[] = new Array(100).fill(null); // na.y:[Lid;
    static ignoreCount = 0; // n.h:I
    static friendListTransmitCycle = 0; // uc.b:I
    static clanTransmitCycle = 0; // qe.N:I

    // bd.a(Lid;B)I
    static getFriendIndex(name: JagString | null): number {
        if (name === null) return -1;
        for (let i = 0; i < Client.friendCount; i++) {
            if (name.equalsIgnoreCase(arrayAtObj(Client.friendUsername, i))) return i;
        }
        return -1;
    }

    // pi.a(ZLid;)Z. FriendSystem::IsFriend.
    static IsFriend(name: JagString | null): boolean {
        if (name === null) return false;
        for (let i = 0; i < Client.friendCount; i++) {
            if (name.equalsIgnoreCase(arrayAtObj(Client.friendUsername, i))) return true;
        }
        return name.equalsIgnoreCase(requireNonNull(Client.localPlayer).username);
    }

    // cl.a(ILid;)Z. FriendSystem::IsIgnored.
    static IsIgnored(start: number, name: JagString | null): boolean {
        if (name === null) return false;
        for (let i = start; i < Client.ignoreCount; i++) {
            if (name.equalsIgnoreCase(arrayAtObj(Client.ignoreNames, i))) return true;
        }
        return false;
    }

    // o.a(IJ)V. FriendSystem::AddFriend.
    static AddFriend(id: bigint): void {
        if (id === 0n) return;
        if ((Client.friendCount < 100 || Client.playerMember) && Client.friendCount < 200) {
            const name = requireNonNull(JagString.fromBase37(id)).formatName(0);
            for (let i = 0; i < Client.friendCount; i++) {
                if (arrayAtB64(Client.friendName37, i) === id) {
                    Client.AddChat(JagString.join([name, LocalisedText.alreadyFriend]), JagString.empty, 0);
                    return;
                }
            }
            for (let i = 0; i < Client.ignoreCount; i++) {
                if (arrayAtB64(Client.ignoreName37, i) === id) {
                    Client.AddChat(JagString.join([LocalisedText.removeIgnore, name, LocalisedText.ignoreFirst]), JagString.empty, 0);
                    return;
                }
            }
            if (name.equals(requireNonNull(Client.localPlayer).username)) {
                Client.AddChat(LocalisedText.selfFriend, JagString.empty, 0);
            } else {
                arrayPutObj(Client.friendUsername, Client.friendCount, name);
                arrayPutB64(Client.friendName37, Client.friendCount, id);
                arrayPutI32(Client.friendWorld, Client.friendCount, 0);
                arrayPutObj(Client.friendWorldName, Client.friendCount, JagString.empty);
                arrayPutI32(Client.friendRank, Client.friendCount, 0);
                arrayPutU8(Client.friendSameGame, Client.friendCount, 0);
                Client.friendCount = (Client.friendCount + 1) | 0;
                Client.friendListTransmitCycle = Client.transmitCycle;
                Client.out.pHead(120);
                Client.out.p8(id);
            }
        } else Client.AddChat(LocalisedText.friendsFull, JagString.empty, 0);
    }

    // oc.a(IJ)V. FriendSystem::DelFriend.
    static DelFriend(id: bigint): void {
        if (id === 0n) return;
        for (let i = 0; i < Client.friendCount; i++) {
            if (arrayAtB64(Client.friendName37, i) !== id) continue;
            Client.friendCount = (Client.friendCount - 1) | 0;
            for (let j = i; j < Client.friendCount; j++) {
                arrayPutObj(Client.friendUsername, j, arrayAtObj(Client.friendUsername, j + 1));
                arrayPutI32(Client.friendWorld, j, arrayAtI32(Client.friendWorld, j + 1));
                arrayPutObj(Client.friendWorldName, j, arrayAtObj(Client.friendWorldName, j + 1));
                arrayPutB64(Client.friendName37, j, arrayAtB64(Client.friendName37, j + 1));
                arrayPutI32(Client.friendRank, j, arrayAtI32(Client.friendRank, j + 1));
                arrayPutU8(Client.friendSameGame, j, arrayAtU8(Client.friendSameGame, j + 1));
            }
            Client.friendListTransmitCycle = Client.transmitCycle;
            Client.out.pHead(57);
            Client.out.p8(id);
            return;
        }
    }

    // he.a(JI)V. FriendSystem::AddIgnore. The second argument is the excluded value.
    static AddIgnore(id: bigint, excluded: number): void {
        if (id === BigInt(excluded)) return;
        if (Client.ignoreCount >= 100) {
            Client.AddChat(LocalisedText.ignoresFull, JagString.empty, 0);
            return;
        }
        const name = requireNonNull(JagString.fromBase37(id)).formatName(0);
        for (let i = 0; i < Client.ignoreCount; i++) {
            if (arrayAtB64(Client.ignoreName37, i) === id) {
                Client.AddChat(JagString.join([name, LocalisedText.alreadyIgnored]), JagString.empty, 0);
                return;
            }
        }
        for (let i = 0; i < Client.friendCount; i++) {
            if (arrayAtB64(Client.friendName37, i) === id) {
                Client.AddChat(JagString.join([LocalisedText.removeFriend, name, LocalisedText.friendFirst]), JagString.empty, 0);
                return;
            }
        }
        if (name.equals(requireNonNull(Client.localPlayer).username)) {
            Client.AddChat(LocalisedText.selfIgnore, JagString.empty, 0);
        } else {
            arrayPutB64(Client.ignoreName37, Client.ignoreCount, id);
            const slot = Client.ignoreCount;
            Client.ignoreCount = (slot + 1) | 0;
            arrayPutObj(Client.ignoreNames, slot, JagString.fromBase37(id));
            Client.friendListTransmitCycle = Client.transmitCycle;
            Client.out.pHead(34);
            Client.out.p8(id);
        }
    }

    // jl.a(IJ)V. FriendSystem::DelIgnore.
    static DelIgnore(excluded: number, id: bigint): void {
        if (id === BigInt(excluded)) return;
        for (let i = 0; i < Client.ignoreCount; i++) {
            if (arrayAtB64(Client.ignoreName37, i) !== id) continue;
            Client.ignoreCount = (Client.ignoreCount - 1) | 0;
            for (let j = i; j < Client.ignoreCount; j++) {
                arrayPutB64(Client.ignoreName37, j, arrayAtB64(Client.ignoreName37, j + 1));
                arrayPutObj(Client.ignoreNames, j, arrayAtObj(Client.ignoreNames, j + 1));
            }
            Client.friendListTransmitCycle = Client.transmitCycle;
            Client.out.pHead(213);
            Client.out.p8(id);
            return;
        }
    }

    // fl.a(Lid;BI)V. FriendSystem::SetFriendRank.
    static SetFriendRank(name: JagString | null, rank: number): void {
        Client.out.pHead(188);
        Client.out.p1_alt1(rank);
        Client.out.p8(requireNonNull(name).toBase37());
    }

    // mk.a(ILid;)V. Client::FriendsChatKickUser.
    static FriendsChatKickUser(name: JagString | null): void {
        if (FriendChatChannel.members === null) return;
        let index = 0;
        const id = requireNonNull(name).toBase37();
        if (id === 0n) return;
        while (index < FriendChatChannel.members.length && requireNonNull(arrayAtObj(FriendChatChannel.members, index)).key !== id) index++;
        if (index < FriendChatChannel.members.length && arrayAtObj(FriendChatChannel.members, index) !== null) {
            Client.out.pHead(162);
            Client.out.p8(requireNonNull(arrayAtObj(FriendChatChannel.members, index)).key);
        }
    }

    // li.a(JI)V. Client::FriendsChatJoinChat.
    static FriendsChatJoinChat(id: bigint): void {
        if (id !== 0n) {
            Client.out.pHead(104);
            Client.out.p8(id);
        }
    }

    // nc.b(B)V. Client::FriendsChatLeaveChat.
    static FriendsChatLeaveChat(): void {
        Client.out.pHead(104);
        Client.out.p8(0n);
    }

    // qa.R:[S
    static searchResults: Int16Array | null = null;
    // hc.k:I
    static resultCount = 0;
    // mc.y:I
    static searchResultIndex = 0;

    // qe.a([SI[Lid;)V
    static sortSearchResults(ids: Int16Array | null, names: (JagString | null)[] | null): void {
        Client.sortSearchRange(names, ids, 0, (requireNonNull(names).length - 1) | 0);
    }

    // lf.a([Lid;[SIZI)V
    private static sortSearchRange(names: (JagString | null)[] | null, ids: Int16Array | null, low: number, high: number): void {
        if (high <= low) return;
        const middle = (((high + low) | 0) / 2) | 0;
        let dest = low;
        const pivot = arrayAtObj(names, middle);
        arrayPutObj(names, middle, arrayAtObj(names, high));
        arrayPutObj(names, high, pivot);
        const pivotId = arrayAtI16(ids, middle);
        arrayPutI16(ids, middle, arrayAtI16(ids, high));
        arrayPutI16(ids, high, pivotId);
        for (let i = low; i < high; i++) {
            if (pivot !== null) {
                const current = arrayAtObj(names, i);
                if (current === null || current.compare(pivot) >= (i & 1)) continue;
            }
            const current = arrayAtObj(names, i);
            arrayPutObj(names, i, arrayAtObj(names, dest));
            arrayPutObj(names, dest, current);
            const id = arrayAtI16(ids, i);
            arrayPutI16(ids, i, arrayAtI16(ids, dest));
            arrayPutI16(ids, dest++, id);
        }
        arrayPutObj(names, high, arrayAtObj(names, dest));
        arrayPutObj(names, dest, pivot);
        arrayPutI16(ids, high, arrayAtI16(ids, dest));
        arrayPutI16(ids, dest, pivotId);
        Client.sortSearchRange(names, ids, low, (dest - 1) | 0);
        Client.sortSearchRange(names, ids, (dest + 1) | 0, high);
    }

    // oi.a(Lid;ZI)V
    static FindObjects(query: JagString | null, stockmarketOnly: boolean): void {
        query = requireNonNull(query).toLowerCase();
        let ids = new Int16Array(16);
        let count = 0;
        for (let id = 0; id < ObjType.m_numDefinitions; id++) {
            const type = ObjType.List(id);
            if ((stockmarketOnly && !type.stockmarket) || type.certTemplate !== -1 || type.lentTemplate !== -1 || type.dummyItem !== 0 || requireNonNull(type.name).toLowerCase().indexOf(query) === -1) continue;
            if (count >= 250) {
                Client.searchResults = null;
                Client.resultCount = -1;
                return;
            }
            if (count >= ids.length) {
                const resize = new Int16Array(ids.length * 2);
                for (let i = 0; i < count; i++) resize[i] = ids[i];
                ids = resize;
            }
            ids[count++] = id;
        }
        Client.resultCount = count;
        Client.searchResultIndex = 0;
        const names: (JagString | null)[] = new Array(Client.resultCount).fill(null);
        Client.searchResults = ids;
        for (let i = 0; i < Client.resultCount; i++) arrayPutObj(names, i, ObjType.List(arrayAtI16(ids, i)).name);
        Client.sortSearchResults(Client.searchResults, names);
    }

    // SD sf.a(B)V / HD uf.a(B)V. NXT Client::GlFollowCamera.
    static GlFollowCamera(): void {
        if (glJar) {
            try {
                const tx = (requireNonNull(Client.localPlayer).x + OrbitCamera.followOffsetX) | 0;
                const tz = (requireNonNull(Client.localPlayer).z + OrbitCamera.followOffsetZ) | 0;
                const dx = (OrbitCamera.focusX - tx) | 0;
                const dz = (OrbitCamera.focusZ - tz) | 0;
                if (dx < -500 || dx > 500 || dz < -500 || dz > 500) {
                    OrbitCamera.focusX = tx;
                    OrbitCamera.focusZ = tz;
                }
                if (OrbitCamera.focusZ !== tz) OrbitCamera.focusZ = (OrbitCamera.focusZ + intDivide((tz - OrbitCamera.focusZ) | 0, 16)) | 0;
                if (OrbitCamera.focusX !== tx) OrbitCamera.focusX = (OrbitCamera.focusX + intDivide((tx - OrbitCamera.focusX) | 0, 16)) | 0;
                if (Preferences.steppedCameraKeys) {
                    for (let i = 0; i < ClientKeyboardListener.count; i++) {
                        switch (arrayAtI32(ClientKeyboardListener.codes, i)) {
                            case 98:
                                OrbitCamera.followPitch = (OrbitCamera.followPitch + 47) & -16;
                                break;
                            case 99:
                                OrbitCamera.followPitch = (OrbitCamera.followPitch - 17) & -16;
                                break;
                            case 96:
                                OrbitCamera.followYaw = (OrbitCamera.followYaw - 65) & -128;
                                break;
                            case 97:
                                OrbitCamera.followYaw = (OrbitCamera.followYaw + 191) & -128;
                                break;
                        }
                    }
                } else {
                    if (arrayAtObj(ClientKeyboardListener.pressed, 98)) OrbitCamera.pitchVelocity = (OrbitCamera.pitchVelocity + intDivide((12 - OrbitCamera.pitchVelocity) | 0, 2)) | 0;
                    else if (arrayAtObj(ClientKeyboardListener.pressed, 99)) OrbitCamera.pitchVelocity = (OrbitCamera.pitchVelocity + intDivide((-12 - OrbitCamera.pitchVelocity) | 0, 2)) | 0;
                    else OrbitCamera.pitchVelocity = intDivide(OrbitCamera.pitchVelocity, 2);
                    if (arrayAtObj(ClientKeyboardListener.pressed, 96)) OrbitCamera.yawVelocity = (OrbitCamera.yawVelocity + intDivide((-24 - OrbitCamera.yawVelocity) | 0, 2)) | 0;
                    else if (arrayAtObj(ClientKeyboardListener.pressed, 97)) OrbitCamera.yawVelocity = (OrbitCamera.yawVelocity + intDivide((24 - OrbitCamera.yawVelocity) | 0, 2)) | 0;
                    else OrbitCamera.yawVelocity = intDivide(OrbitCamera.yawVelocity, 2);
                    OrbitCamera.followPitch = (OrbitCamera.followPitch + intDivide(OrbitCamera.pitchVelocity, 2)) | 0;
                    OrbitCamera.followYaw = (OrbitCamera.followYaw + intDivide(OrbitCamera.yawVelocity, 2)) | 0;
                }
                OrbitCamera.clamp();
            } catch (error) {
                if (!isJavaRuntimeException(error)) throw error;
                throw WrappedException.wrap(error, 'uf.B(68)');
            }
            return;
        }
        const tx = (requireNonNull(Client.localPlayer).x + OrbitCamera.followOffsetX) | 0,
            tz = (requireNonNull(Client.localPlayer).z + OrbitCamera.followOffsetZ) | 0;
        const dx = (OrbitCamera.focusX - tx) | 0,
            dz = (OrbitCamera.focusZ - tz) | 0;
        if (dx < -500 || dx > 500 || dz < -500 || dz > 500) {
            OrbitCamera.focusZ = tz;
            OrbitCamera.focusX = tx;
        }
        if (OrbitCamera.focusZ !== tz) OrbitCamera.focusZ = (OrbitCamera.focusZ + intDivide((tz - OrbitCamera.focusZ) | 0, 16)) | 0;
        if (OrbitCamera.focusX !== tx) OrbitCamera.focusX = (OrbitCamera.focusX + intDivide((tx - OrbitCamera.focusX) | 0, 16)) | 0;
        if (Preferences.steppedCameraKeys) {
            for (let i = 0; i < ClientKeyboardListener.count; i++) {
                switch (arrayAtI32(ClientKeyboardListener.codes, i)) {
                    case 98:
                        OrbitCamera.followPitch = (47 + OrbitCamera.followPitch) & -16;
                        break;
                    case 99:
                        OrbitCamera.followPitch = (OrbitCamera.followPitch - 17) & -16;
                        break;
                    case 96:
                        OrbitCamera.followYaw = (OrbitCamera.followYaw - 65) & -128;
                        break;
                    case 97:
                        OrbitCamera.followYaw = (OrbitCamera.followYaw + 191) & -128;
                        break;
                }
            }
        } else {
            if (arrayAtObj(ClientKeyboardListener.pressed, 96)) OrbitCamera.yawVelocity = (OrbitCamera.yawVelocity + intDivide((-24 - OrbitCamera.yawVelocity) | 0, 2)) | 0;
            else if (arrayAtObj(ClientKeyboardListener.pressed, 97)) OrbitCamera.yawVelocity = (OrbitCamera.yawVelocity + intDivide((24 - OrbitCamera.yawVelocity) | 0, 2)) | 0;
            else OrbitCamera.yawVelocity = intDivide(OrbitCamera.yawVelocity, 2);
            if (arrayAtObj(ClientKeyboardListener.pressed, 98)) OrbitCamera.pitchVelocity = (OrbitCamera.pitchVelocity + intDivide((12 - OrbitCamera.pitchVelocity) | 0, 2)) | 0;
            else if (arrayAtObj(ClientKeyboardListener.pressed, 99)) OrbitCamera.pitchVelocity = (OrbitCamera.pitchVelocity + intDivide((-12 - OrbitCamera.pitchVelocity) | 0, 2)) | 0;
            else OrbitCamera.pitchVelocity = intDivide(OrbitCamera.pitchVelocity, 2);
            OrbitCamera.followYaw = (OrbitCamera.followYaw + intDivide(OrbitCamera.yawVelocity, 2)) | 0;
            OrbitCamera.followPitch = (OrbitCamera.followPitch + intDivide(OrbitCamera.pitchVelocity, 2)) | 0;
        }
        OrbitCamera.clamp();
    }

    // SD hj.a(IIIIIIII)V, HD bh.a(IIIIIIII)V. NXT Client::CamFollow.
    static CamFollow(y: number, distance: number, yaw: number, x: number, pitch: number, z: number, height = 334): void {
        if (glJar && GlRendererClass.active) {
            let delta = (height - 334) | 0;
            if (delta < 0) delta = 0;
            else if (delta > 100) delta = 100;
            const scale = (intDivide(Math.imul(delta, -Client.viewportZoomMin + Client.zoomWidth), 100) + Client.viewportZoomMin) | 0;
            distance = Math.imul(scale, distance) >> 8;
        }
        const turn = -yaw & 2047,
            tilt = -pitch & 2047;
        let dx = 0,
            dy = 0,
            dz = distance;
        if (tilt !== 0) {
            const cos = arrayAtI32(Pix3D.cosTable, tilt),
                sin = arrayAtI32(Pix3D.sinTable, tilt);
            dy = Math.imul(sin, -distance) >> 16;
            dz = Math.imul(distance, cos) >> 16;
        }
        if (turn !== 0) {
            dx = Math.imul(arrayAtI32(Pix3D.sinTable, turn), dz) >> 16;
            dz = Math.imul(dz, arrayAtI32(Pix3D.cosTable, turn)) >> 16;
        }
        if (glJar) {
            OrbitCamera.pitch = pitch;
            OrbitCamera.yaw = yaw;
            OrbitCamera.z = (z - dz) | 0;
            OrbitCamera.x = (x - dx) | 0;
            OrbitCamera.y = (y - dy) | 0;
            return;
        }
        OrbitCamera.y = (y - dy) | 0;
        OrbitCamera.yaw = yaw;
        OrbitCamera.x = (x - dx) | 0;
        OrbitCamera.z = (z - dz) | 0;
        OrbitCamera.pitch = pitch;
    }

    // uj.a(B)V. NXT Client::GlCinemaCamera.
    static GlCinemaCamera(): void {
        const z = ((CinematicCamera.tileZ << 7) + 64) | 0,
            x = ((CinematicCamera.tileX << 7) + 64) | 0;
        const y = (Client.GetAvH(x, z, Client.playerLevel, 101) - CinematicCamera.height) | 0;
        if (CinematicCamera.factor >= 100) {
            OrbitCamera.z = ((CinematicCamera.tileZ << 7) + 64) | 0;
            OrbitCamera.x = ((CinematicCamera.tileX << 7) + 64) | 0;
            OrbitCamera.y = (Client.GetAvH(OrbitCamera.x, OrbitCamera.z, Client.playerLevel, 127) - CinematicCamera.height) | 0;
        } else {
            if (z > OrbitCamera.z) {
                OrbitCamera.z = (OrbitCamera.z + CinematicCamera.step + intDivide(Math.imul(z - OrbitCamera.z, CinematicCamera.factor), 1000)) | 0;
                if (OrbitCamera.z > z) OrbitCamera.z = z;
            }
            if (y > OrbitCamera.y) {
                OrbitCamera.y = (OrbitCamera.y + intDivide(Math.imul(y - OrbitCamera.y, CinematicCamera.factor), 1000) + CinematicCamera.step) | 0;
                if (OrbitCamera.y > y) OrbitCamera.y = y;
            }
            if (x > OrbitCamera.x) {
                OrbitCamera.x = (OrbitCamera.x + CinematicCamera.step + intDivide(Math.imul(x - OrbitCamera.x, CinematicCamera.factor), 1000)) | 0;
                if (OrbitCamera.x > x) OrbitCamera.x = x;
            }
            if (y < OrbitCamera.y) {
                OrbitCamera.y = (OrbitCamera.y - intDivide(Math.imul(OrbitCamera.y - y, CinematicCamera.factor), 1000) - CinematicCamera.step) | 0;
                if (OrbitCamera.y < y) OrbitCamera.y = y;
            }
            if (x < OrbitCamera.x) {
                OrbitCamera.x = (OrbitCamera.x - intDivide(Math.imul(OrbitCamera.x - x, CinematicCamera.factor), 1000) - CinematicCamera.step) | 0;
                if (OrbitCamera.x < x) OrbitCamera.x = x;
            }
            if (z < OrbitCamera.z) {
                OrbitCamera.z = (OrbitCamera.z - CinematicCamera.step - intDivide(Math.imul(OrbitCamera.z - z, CinematicCamera.factor), 1000)) | 0;
                if (OrbitCamera.z < z) OrbitCamera.z = z;
            }
        }
        const fineX = ((CinematicCamera.lookX << 7) + 64) | 0,
            fineZ = ((CinematicCamera.lookZ << 7) + 64) | 0;
        const fineY = (Client.GetAvH(fineX, fineZ, Client.playerLevel, -39) - CinematicCamera.lookHeight) | 0;
        const dz = (fineZ - OrbitCamera.z) | 0,
            dx = (fineX - OrbitCamera.x) | 0,
            dy = (fineY - OrbitCamera.y) | 0;
        const distance = doubleToInt(Math.sqrt((Math.imul(dz, dz) + Math.imul(dx, dx)) | 0));
        let pitch = doubleToInt(Math.atan2(dy, distance) * 325.949) & 2047;
        const yaw = doubleToInt(-325.949 * Math.atan2(dx, dz)) & 2047;
        if (pitch < 128) pitch = 128;
        let delta = (yaw - OrbitCamera.yaw) | 0;
        if (pitch > 383) pitch = 383;
        if (delta > 1024) delta = (delta - 2048) | 0;
        if (delta < -1024) delta = (delta + 2048) | 0;
        if (pitch > OrbitCamera.pitch) {
            OrbitCamera.pitch = (OrbitCamera.pitch + CinematicCamera.lookStep + intDivide(Math.imul(CinematicCamera.lookFactor, pitch - OrbitCamera.pitch), 1000)) | 0;
            if (OrbitCamera.pitch > pitch) OrbitCamera.pitch = pitch;
        }
        if (pitch < OrbitCamera.pitch) {
            OrbitCamera.pitch = (OrbitCamera.pitch - intDivide(Math.imul(OrbitCamera.pitch - pitch, CinematicCamera.lookFactor), 1000) - CinematicCamera.lookStep) | 0;
            if (OrbitCamera.pitch < pitch) OrbitCamera.pitch = pitch;
        }
        if (delta > 0) OrbitCamera.yaw = (OrbitCamera.yaw + intDivide(Math.imul(CinematicCamera.lookFactor, delta), 1000) + CinematicCamera.lookStep) & 2047;
        if (delta < 0) OrbitCamera.yaw = (OrbitCamera.yaw - CinematicCamera.lookStep - intDivide(Math.imul(CinematicCamera.lookFactor, -delta), 1000)) & 2047;
        let remaining = (yaw - OrbitCamera.yaw) | 0;
        if (remaining > 1024) remaining = (remaining - 2048) | 0;
        if (remaining < -1024) remaining = (remaining + 2048) | 0;
        if ((remaining < 0 && delta > 0) || (remaining > 0 && delta < 0)) OrbitCamera.yaw = yaw;
    }

    // d.q:I
    static m_usingOneButtonMouse = 0;
    // j.h:I
    static chatEffects = 0;
    // ff.q:I
    static bankArrangeMode = 0;

    // wi.a(II)V. NXT Client::ClientVar.
    static ClientVar(id: number): void {
        Client.LegacyUpdated();
        AreaSoundManager.refreshMultis();
        const option = VarpType.List(id, 16).clientCode;
        if (option !== 0) {
            const value = arrayAtI32(ClientVarCache.m_var, id);
            if (option === 6) Client.chatEffects = value;
            if (option === 5) Client.m_usingOneButtonMouse = value;
            if (option === 9) Client.bankArrangeMode = value;
        }
    }

    // ml.a(IIIB)I. NXT Client::GetAvH, projects/osclient/client.cpp:5652.
    static GetAvH(fineX: number, fineZ: number, level: number, guard?: number): number {
        try {
            if (world.levelHeightmaps === null) return 0;
            const x = fineX >> 7,
                z = fineZ >> 7;
            if (x < 0 || z < 0 || x > 103 || z > 103) return 0;
            let heightLevel = level;
            if (level < 3 && (arrayAtU8(arrayAtObj(arrayAtObj(ClientBuild.m_mapl, 1), x), z) & 2) === 2) heightLevel = (level + 1) | 0;
            if (guard !== undefined && (((49 - guard) / 38) | 0) === 0) throw new RangeError('/ by zero');
            const dx = fineX & 127,
                dz = fineZ & 127;
            const south = (Math.imul(arrayAtI32(arrayAtObj(arrayAtObj(world.levelHeightmaps, heightLevel), x), z), 128 - dx) + Math.imul(arrayAtI32(arrayAtObj(arrayAtObj(world.levelHeightmaps, heightLevel), x + 1), z), dx)) >> 7;
            const north = (Math.imul(dx, arrayAtI32(arrayAtObj(arrayAtObj(world.levelHeightmaps, heightLevel), x + 1), z + 1)) + Math.imul(128 - dx, arrayAtI32(arrayAtObj(arrayAtObj(world.levelHeightmaps, heightLevel), x), z + 1))) >> 7;
            return (Math.imul(south, 128 - dz) + Math.imul(dz, north)) >> 7;
        } catch (error) {
            if (guard === undefined || !isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'ml.C(' + [level, fineX, fineZ, guard].join(',') + ')');
        }
    }

    static privateMessageIds = new BigInt64Array(100); // rj.t:[J
    static privateMessageCount = 0; // tj.e:I
    static withinTutorialIsland = 0; // se.x:I
    static modCrownTag = fromLiteral('<img=1>'); // oa.e:Lid;
    static modIconTag = fromLiteral('<img=0>'); // rf.y:Lid;

    // ma.a(B)V
    static GdmGetSpecialArea(): void {
        const x = (Client.mapBuildBaseX + (requireNonNull(Client.localPlayer).x >> 7)) | 0;
        const z = ((requireNonNull(Client.localPlayer).z >> 7) + Client.mapBuildBaseZ) | 0;
        Client.withinTutorialIsland = 0;
        if (x >= 3053 && x <= 3156 && z >= 3056 && z <= 3136) Client.withinTutorialIsland = 1;
        if (x >= 3072 && x <= 3118 && z >= 9492 && z <= 9535) Client.withinTutorialIsland = 1;
        if (Client.withinTutorialIsland === 1 && x >= 3139 && x <= 3199 && z >= 3008 && z <= 3062) Client.withinTutorialIsland = 0;
    }

    // mi.q:Lgk;. Client::GetHookQueue returns this list in NXT (client.h).
    static m_hookQueue: SharedPtrList<HookReq> | null = new SharedPtrList();
    static timerEvents: SharedPtrList<HookReq> | null = new SharedPtrList(); // db.s:Lgk;
    static mouseExit: SharedPtrList<HookReq> | null = new SharedPtrList(); // ra.r:Lgk;
    static updatedVarcs: Int32Array | null = new Int32Array(32); // e.a:[I
    static varcChanges = 0; // lc.t:I
    static updatedVarcStrings: Int32Array | null = new Int32Array(32); // rg.o:[I
    static varcStrChangeCount = 0; // uc.i:I
    static varpUpdates: Int32Array | null = new Int32Array(32); // ii.c:[I
    static varpTransmitCount = 0; // qg.B:I
    static changedInvs: Int32Array | null = new Int32Array(32); // pa.zb:[I
    static invTransmitCount = 0; // b.I:I
    static statUpdates: Int32Array | null = new Int32Array(32); // ld.d:[I
    static changedStatCount = 0; // od.V:I
    static chatTransmitCycle = 0; // sb.c:I
    static transmitCycle = 1; // bb.e:I
    static chatPublicMode = 0; // si.e:I
    static chatPrivateMode = 0; // nk.gb:I
    static chatTradeMode = 0; // sd.V:I

    static tryMoveNearest = 0; // ba.a:I

    // SD ah.a(BJII)Z / HD t.a(BJII)Z.
    static interactWithLoc(key: bigint, x: number, z: number): boolean {
        if (glJar) {
            try {
                const shape = (Number(BigInt.asIntN(32, key)) >> 14) & 31;
                const angle = (Number(BigInt.asIntN(32, key)) >> 20) & 3;
                const id = Number((key >> 32n) & 0x7fffffffn);
                if (shape === 10 || shape === 11 || shape === 22) {
                    const type = LocType.List(id);
                    let width: number, length: number;
                    if (angle === 0 || angle === 2) {
                        length = type.length;
                        width = type.width;
                    } else {
                        length = type.width;
                        width = type.length;
                    }
                    let sides = type.forceApproach;
                    if (angle !== 0) sides = (((sides << angle) & 15) + (sides >> (4 - angle))) | 0;
                    RouteFinding.FindRouteHd(arrayAtI32(requireNonNull(Client.localPlayer).pathZ, 0), 0, length, true, sides, 2, x, width, 0, 2, z, arrayAtI32(requireNonNull(Client.localPlayer).pathX, 0));
                } else {
                    RouteFinding.FindRouteHd(arrayAtI32(requireNonNull(Client.localPlayer).pathZ, 0), angle, 0, true, 0, 2, x, 0, 1 + shape, 2, z, arrayAtI32(requireNonNull(Client.localPlayer).pathX, 0));
                }
                Minimenu.crossY = ClientMouseListener.clickY;
                Minimenu.crossTicks = 0;
                Minimenu.crossMode = 2;
                Minimenu.crossX = ClientMouseListener.clickX;
                return true;
            } catch (error) {
                if (!isJavaRuntimeException(error)) throw error;
                throw WrappedException.wrap(error, 't.D(39,' + BigInt.asIntN(64, key) + ',' + z + ',' + x + ')');
            }
        }
        const shape = (Number(BigInt.asIntN(32, key)) & 515426) >> 14;
        const angle = (Number(BigInt.asIntN(32, key)) & 3315297) >> 20;
        const id = Number((key >> 32n) & 0x7fffffffn);
        if (shape !== 10 && shape !== 11 && shape !== 22) {
            RouteFinding.FindRoute(0, z, x, 0, true, angle, 0, arrayAtI32(requireNonNull(Client.localPlayer).pathZ, 0), shape + 1, 2, arrayAtI32(requireNonNull(Client.localPlayer).pathX, 0));
        } else {
            const type = LocType.List(id);
            let width: number, length: number;
            if (angle === 0 || angle === 2) {
                width = type.width;
                length = type.length;
            } else {
                width = type.length;
                length = type.width;
            }
            let sides = type.forceApproach;
            if (angle !== 0) sides = (((sides << angle) & 15) + (sides >> (4 - angle))) | 0;
            RouteFinding.FindRoute(width, z, x, length, true, 0, sides, arrayAtI32(requireNonNull(Client.localPlayer).pathZ, 0), 0, 2, arrayAtI32(requireNonNull(Client.localPlayer).pathX, 0));
        }
        Minimenu.crossX = ClientMouseListener.clickX;
        Minimenu.crossMode = 2;
        Minimenu.crossTicks = 0;
        Minimenu.crossY = ClientMouseListener.clickY;
        return true;
    }

    // wk.a(III)V
    static writeRoute(index: number, mode: number): void {
        let count = index--;
        const z = arrayAtI32(RouteFinding.m_listz, index);
        if (count > 25) count = 25;
        const x = arrayAtI32(RouteFinding.m_listx, index);
        if (mode === 0) {
            Client.out.pHead(215);
            Client.out.p1((count + count + 3) | 0);
        }
        if (mode === 1) {
            Client.out.pHead(39);
            Client.out.p1((14 + count + count + 3) | 0);
        }
        if (mode === 2) {
            Client.out.pHead(77);
            Client.out.p1((count + count + 3) | 0);
        }
        Client.out.p1_alt1(arrayAtObj(ClientKeyboardListener.pressed, 82) ? 1 : 0);
        Client.out.p2((Client.mapBuildBaseX + x) | 0);
        Client.out.p2_alt2((Client.mapBuildBaseZ + z) | 0);
        Client.destinationX = arrayAtI32(RouteFinding.m_listx, 0);
        Client.destinationZ = arrayAtI32(RouteFinding.m_listz, 0);
        for (let i = 1; i < count; i++) {
            Client.out.p1_alt1((arrayAtI32(RouteFinding.m_listx, --index) - x) | 0);
            Client.out.p1_alt3((arrayAtI32(RouteFinding.m_listz, index) - z) | 0);
        }
    }

    // ic.e(I)V. Client::LegacyUpdated.
    static LegacyUpdated(): void {
        for (let sub = InterfaceList.subInterfaces.head(); sub !== null; sub = InterfaceList.subInterfaces.next()) {
            const group = sub.group;
            if (IfType.OpenInterface(group)) {
                let if3 = true;
                const components = requireNonNull(arrayAtObj(IfType.m_list, group));
                for (let i = 0; i < components.length; i++) {
                    const component = components[i];
                    if (component !== null) {
                        if3 = component.if3;
                        break;
                    }
                }
                if (!if3) {
                    const id = Number(BigInt.asIntN(32, sub.key));
                    const parent = IfType.Get(id);
                    if (parent !== null) Client.ComponentUpdated(parent);
                }
            }
        }
    }

    // mg.a(ZLid;Lid;I)V. Client::AddChat.
    static AddChat(text: JagString | null, name: JagString | null, type: number): void {
        try {
            ChatHistory.AddChat(-1, text, null, type, name);
        } catch (error) {
            if (!glJar || !isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'i.W(' + [name === null ? 'null' : '{...}', type, text === null ? 'null' : '{...}', -1].join(',') + ')');
        }
    }

    // ah.a(Lid;Lid;Lid;ZI)V. Client::AddChat overload for clan messages.
    static AddChat2(name: JagString | null, text: JagString | null, clan: JagString | null, type: number): void {
        try {
            ChatHistory.AddChat(-1, text, clan, type, name);
        } catch (error) {
            if (!glJar || !isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'fm.F(' + [-1, text === null ? 'null' : '{...}', name === null ? 'null' : '{...}', clan === null ? 'null' : '{...}', type].join(',') + ')');
        }
    }

    // vk.a(BLob;)V
    static GlRouteMove(actor: ClientEntity): void {
        const bas = actor.getBasType();

        actor.walkSeq = bas.ready;
        if (actor.pathLength !== 0) {
            if (actor.seq !== -1 && actor.seqDelay === 0) {
                const sequence = SeqType.List(actor.seq);
                if (actor.seqPathLength > 0 && sequence.m_preanimMove === 0) {
                    actor.movementDelay = (actor.movementDelay + 1) | 0;
                    return;
                }

                if (actor.seqPathLength <= 0 && sequence.m_postanimMove === 0) {
                    actor.movementDelay = (actor.movementDelay + 1) | 0;
                    return;
                }
            }

            const z = actor.z;
            const x = actor.x;
            const targetX = (Math.imul(128, arrayAtI32(actor.pathX, (actor.pathLength - 1) | 0)) + Math.imul(actor.getSize(), 64)) | 0;
            const targetZ = (Math.imul(arrayAtI32(actor.pathZ, (actor.pathLength - 1) | 0), 128) + Math.imul(64, actor.getSize())) | 0;
            if (((targetX - x) | 0) > 256 || ((targetX - x) | 0) < -256 || ((targetZ - z) | 0) > 256 || ((targetZ - z) | 0) < -256) {
                actor.x = targetX;
                actor.z = targetZ;
                return;
            }

            if (targetX > x) {
                if (targetZ <= z) {
                    if (z > targetZ) {
                        actor.targetYaw = 1792;
                    } else {
                        actor.targetYaw = 1536;
                    }
                } else {
                    actor.targetYaw = 1280;
                }
            } else if (targetX < x) {
                if (targetZ > z) {
                    actor.targetYaw = 768;
                } else if (targetZ >= z) {
                    actor.targetYaw = 512;
                } else {
                    actor.targetYaw = 256;
                }
            } else if (z < targetZ) {
                actor.targetYaw = 1024;
            } else if (z > targetZ) {
                actor.targetYaw = 0;
            }

            let walkSeq = bas.m_walkBackward;
            let speed = 4;
            let smooth = true;
            let delta = ((-actor.yaw + actor.targetYaw) | 0) & 2047;
            if (delta > 1024) {
                delta = (delta - 2048) | 0;
            }

            if (delta >= -256 && delta <= 256) {
                walkSeq = bas.m_walkForward;
            } else if (delta >= 256 && delta < 768) {
                walkSeq = bas.m_walkRight;
            } else if (delta >= -768 && delta <= -256) {
                walkSeq = bas.m_walkLeft;
            }

            let mode = 1;
            if (walkSeq === -1) {
                walkSeq = bas.m_walkForward;
            }

            actor.walkSeq = walkSeq;
            if (actor instanceof ClientNpc) {
                smooth = requireNonNull(actor.npcType).m_walkSmoothing;
            }

            if (smooth) {
                if (actor.targetYaw !== actor.yaw && actor.faceEntity === -1 && actor.turnSpeed !== 0) {
                    speed = 2;
                }

                if (actor.pathLength > 2) {
                    speed = 6;
                }

                if (actor.pathLength > 3) {
                    speed = 8;
                }

                if (actor.movementDelay > 0 && actor.pathLength > 1) {
                    actor.movementDelay = (actor.movementDelay - 1) | 0;
                    speed = 8;
                }
            } else {
                if (actor.pathLength > 1) {
                    speed = 6;
                }

                if (actor.pathLength > 2) {
                    speed = 8;
                }

                if (actor.movementDelay > 0 && actor.pathLength > 1) {
                    speed = 8;
                    actor.movementDelay = (actor.movementDelay - 1) | 0;
                }
            }

            if (arrayAtI8(actor.pathSpeed, (actor.pathLength - 1) | 0) !== 2) {
                if (arrayAtI8(actor.pathSpeed, (actor.pathLength - 1) | 0) === 0) {
                    mode = 0;
                    speed >>= 1;
                }
            } else {
                mode = 2;
                speed <<= 1;
            }

            if (speed >= 8 && bas.m_runForward !== -1) {
                if (bas.m_walkBackward === actor.walkSeq && bas.m_runBackward !== -1) {
                    actor.walkSeq = bas.m_runBackward;
                } else if (actor.walkSeq === bas.m_walkLeft && bas.m_runLeft !== -1) {
                    actor.walkSeq = bas.m_runLeft;
                } else if (actor.walkSeq === bas.m_walkRight && bas.m_runRight !== -1) {
                    actor.walkSeq = bas.m_runRight;
                } else {
                    actor.walkSeq = bas.m_runForward;
                }
            } else if (bas.m_crawlForward !== -1 && mode === 0) {
                if (actor.walkSeq === bas.m_walkBackward && bas.m_crawlBackward !== -1) {
                    actor.walkSeq = bas.m_crawlBackward;
                } else if (actor.walkSeq === bas.m_walkLeft && bas.m_crawlLeft !== -1) {
                    actor.walkSeq = bas.m_crawlLeft;
                } else if (bas.m_walkRight === actor.walkSeq && bas.m_crawlRight !== -1) {
                    actor.walkSeq = bas.m_crawlRight;
                } else {
                    actor.walkSeq = bas.m_crawlForward;
                }
            }

            if (bas.walkAcceleration !== -1) {
                speed <<= 7;
                if (actor.pathLength === 1) {
                    const distanceZ = (actor.z > targetZ ? (-targetZ + actor.z) | 0 : (-actor.z + targetZ) | 0) << 7;
                    const distanceX = (actor.x > targetX ? (actor.x - targetX) | 0 : (targetX - actor.x) | 0) << 7;
                    const speedSquared = Math.imul(actor.movementSpeed, actor.movementSpeed);
                    const distance = distanceX > distanceZ ? distanceX : distanceZ;
                    const accelerationDistance = Math.imul(Math.imul(distance, bas.walkAcceleration), 2);
                    if (accelerationDistance >= speedSquared) {
                        if (intDivide(speedSquared, 2) > distance) {
                            actor.movementSpeed = (actor.movementSpeed - bas.walkAcceleration) | 0;
                            if (actor.movementSpeed < 0) {
                                actor.movementSpeed = 0;
                            }
                        } else if (actor.movementSpeed < speed) {
                            actor.movementSpeed = (actor.movementSpeed + bas.walkAcceleration) | 0;
                            if (speed < actor.movementSpeed) {
                                actor.movementSpeed = speed;
                            }
                        }
                    } else {
                        actor.movementSpeed = intDivide(actor.movementSpeed, 2);
                    }
                } else if (actor.movementSpeed < speed) {
                    actor.movementSpeed = (actor.movementSpeed + bas.walkAcceleration) | 0;
                    if (actor.movementSpeed > speed) {
                        actor.movementSpeed = speed;
                    }
                } else if (actor.movementSpeed > 0) {
                    actor.movementSpeed = (actor.movementSpeed - bas.walkAcceleration) | 0;
                    if (actor.movementSpeed < 0) {
                        actor.movementSpeed = 0;
                    }
                }

                speed = actor.movementSpeed >> 7;
                if (speed < 1) {
                    speed = 1;
                }
            }

            if (targetZ > z) {
                actor.z = (actor.z + speed) | 0;
                if (targetZ < actor.z) {
                    actor.z = targetZ;
                }
            } else if (z > targetZ) {
                actor.z = (actor.z - speed) | 0;
                if (targetZ > actor.z) {
                    actor.z = targetZ;
                }
            }

            if (x >= targetX) {
                if (targetX < x) {
                    actor.x = (actor.x - speed) | 0;
                    if (actor.x < targetX) {
                        actor.x = targetX;
                    }
                }
            } else {
                actor.x = (actor.x + speed) | 0;
                if (actor.x > targetX) {
                    actor.x = targetX;
                }
            }

            if (actor.x === targetX && targetZ === actor.z) {
                if (actor.seqPathLength > 0) {
                    actor.seqPathLength = (actor.seqPathLength - 1) | 0;
                }

                actor.pathLength = (actor.pathLength - 1) | 0;
                return;
            }
        } else {
            actor.movementDelay = 0;
        }
    }

    // le.a(ILob;)V
    static GlEntityFace(actor: ClientEntity): void {
        if (actor.turnSpeed !== 0) {
            const bas = actor.getBasType();
            if (actor.faceEntity !== -1 && actor.faceEntity < 32768) {
                const npc = arrayAtObj(Client.npcs, actor.faceEntity);
                if (npc !== null) {
                    const dx = (actor.x - npc.x) | 0;
                    const dz = (-npc.z + actor.z) | 0;
                    if (dx !== 0 || dz !== 0) {
                        actor.targetYaw = doubleToInt(325.949 * Math.atan2(dx, dz)) & 2047;
                    }
                }
            }

            if (actor.faceEntity >= 32768) {
                let playerId = (actor.faceEntity - 32768) | 0;
                if (playerId === Client.localPid) {
                    playerId = 2047;
                }

                const player = arrayAtObj(Client.players, playerId);
                if (player !== null) {
                    const dz = (actor.z - player.z) | 0;
                    const dx = (-player.x + actor.x) | 0;
                    if (dx !== 0 || dz !== 0) {
                        actor.targetYaw = doubleToInt(325.949 * Math.atan2(dx, dz)) & 2047;
                    }
                }
            }

            if ((actor.faceX !== 0 || actor.faceZ !== 0) && (actor.pathLength === 0 || actor.movementDelay > 0)) {
                const dx = (actor.x - Math.imul((actor.faceX - Client.mapBuildBaseX - Client.mapBuildBaseX) | 0, 64)) | 0;
                const dz = (actor.z - Math.imul((-Client.mapBuildBaseZ + actor.faceZ - Client.mapBuildBaseZ) | 0, 64)) | 0;
                if (dx !== 0 || dz !== 0) {
                    actor.targetYaw = doubleToInt(Math.atan2(dx, dz) * 325.949) & 2047;
                }

                actor.faceX = 0;
                actor.faceZ = 0;
            }

            const delta = ((actor.targetYaw - actor.yaw) | 0) & 2047;
            if (delta === 0) {
                actor.turnVelocity = 0;
                actor.turnTicks = 0;
            } else if (bas.turnAcceleration === 0) {
                actor.turnTicks = (actor.turnTicks + 1) | 0;
                if (delta <= 1024) {
                    actor.yaw = (actor.yaw + actor.turnSpeed) | 0;
                    let turning = true;
                    if (delta < actor.turnSpeed || delta > ((-actor.turnSpeed + 2048) | 0)) {
                        actor.yaw = actor.targetYaw;
                        turning = false;
                    }

                    if (bas.ready === actor.walkSeq && (actor.turnTicks > 25 || turning)) {
                        if (bas.m_readyTurnRight !== -1) {
                            actor.walkSeq = bas.m_readyTurnRight;
                        } else {
                            actor.walkSeq = bas.m_walkForward;
                        }
                    }
                } else {
                    actor.yaw = (actor.yaw - actor.turnSpeed) | 0;
                    let turning = true;
                    if (actor.turnSpeed > delta || delta > ((-actor.turnSpeed + 2048) | 0)) {
                        actor.yaw = actor.targetYaw;
                        turning = false;
                    }

                    if (bas.ready === actor.walkSeq && (actor.turnTicks > 25 || turning)) {
                        if (bas.m_readyTurnLeft === -1) {
                            actor.walkSeq = bas.m_walkForward;
                        } else {
                            actor.walkSeq = bas.m_readyTurnLeft;
                        }
                    }
                }

                actor.yaw &= 2047;
            } else {
                if (actor.walkSeq === bas.ready && actor.turnTicks > 25) {
                    if (bas.m_readyTurnRight === -1) {
                        actor.walkSeq = bas.m_walkForward;
                    } else {
                        actor.walkSeq = bas.m_readyTurnRight;
                    }
                }

                const target = actor.targetYaw << 5;
                if (actor.turnTarget !== target) {
                    actor.turnDistance = 0;
                    const distance = ((-actor.fineYaw + target) | 0) & 65535;
                    actor.turnTarget = target;
                    const braking = intDivide(Math.imul(actor.turnVelocity, actor.turnVelocity), Math.imul(2, bas.turnAcceleration));
                    if (actor.turnVelocity > 0 && distance >= braking && ((distance - braking) | 0) < 32768) {
                        actor.turnBrakeAt = intDivide(distance, 2);
                        actor.turnAccelerating = true;
                        let maxBraking = intDivide(Math.imul(bas.turnMax, bas.turnMax), Math.imul(2, bas.turnAcceleration));
                        if (maxBraking > 32767) {
                            maxBraking = 32767;
                        }

                        if (actor.turnBrakeAt > maxBraking) {
                            actor.turnBrakeAt = (distance - maxBraking) | 0;
                        }
                    } else if (actor.turnVelocity < 0 && ((-distance + 65536) | 0) >= braking && ((-braking - distance + 65536) | 0) < 32768) {
                        actor.turnAccelerating = true;
                        actor.turnBrakeAt = intDivide((-distance + 65536) | 0, 2);
                        let maxBraking = intDivide(Math.imul(bas.turnMax, bas.turnMax), Math.imul(2, bas.turnAcceleration));
                        if (maxBraking > 32767) {
                            maxBraking = 32767;
                        }

                        if (maxBraking < actor.turnBrakeAt) {
                            actor.turnBrakeAt = (-distance - maxBraking + 65536) | 0;
                        }
                    } else {
                        actor.turnAccelerating = false;
                    }
                }

                if (actor.turnVelocity === 0) {
                    const distance = ((actor.turnTarget - actor.fineYaw) | 0) & 65535;
                    if (distance >= bas.turnAcceleration) {
                        actor.turnDistance = 0;
                        let maxBraking = intDivide(Math.imul(bas.turnMax, bas.turnMax), Math.imul(bas.turnAcceleration, 2));
                        actor.turnAccelerating = true;
                        if (maxBraking > 32767) {
                            maxBraking = 32767;
                        }

                        if (distance >= 32768) {
                            actor.turnVelocity = -bas.turnAcceleration;
                            actor.turnBrakeAt = intDivide((-distance + 65536) | 0, 2);
                            if (actor.turnBrakeAt > maxBraking) {
                                actor.turnBrakeAt = (-distance - maxBraking + 65536) | 0;
                            }
                        } else {
                            actor.turnVelocity = bas.turnAcceleration;
                            actor.turnBrakeAt = intDivide(distance, 2);
                            if (maxBraking < actor.turnBrakeAt) {
                                actor.turnBrakeAt = (distance - maxBraking) | 0;
                            }
                        }
                    } else {
                        actor.fineYaw = actor.turnTarget;
                    }
                } else if (actor.turnVelocity <= 0) {
                    if (actor.turnBrakeAt <= actor.turnDistance) {
                        actor.turnAccelerating = false;
                    }

                    if (!actor.turnAccelerating) {
                        actor.turnVelocity = (actor.turnVelocity + bas.turnAcceleration) | 0;
                        if (actor.turnVelocity > 0) {
                            actor.turnVelocity = 0;
                        }
                    } else if (-bas.turnMax < actor.turnVelocity) {
                        actor.turnVelocity = (actor.turnVelocity - bas.turnAcceleration) | 0;
                    }
                } else {
                    if (actor.turnDistance >= actor.turnBrakeAt) {
                        actor.turnAccelerating = false;
                    }

                    if (actor.turnAccelerating) {
                        if (actor.turnVelocity < bas.turnMax) {
                            actor.turnVelocity = (actor.turnVelocity + bas.turnAcceleration) | 0;
                        }
                    } else {
                        actor.turnVelocity = (actor.turnVelocity - bas.turnAcceleration) | 0;
                        if (actor.turnVelocity < 0) {
                            actor.turnVelocity = 0;
                        }
                    }
                }

                actor.fineYaw = (actor.fineYaw + actor.turnVelocity) | 0;
                if (actor.turnVelocity > 0) {
                    actor.turnDistance = (actor.turnDistance + actor.turnVelocity) | 0;
                } else {
                    actor.turnDistance = (actor.turnDistance - actor.turnVelocity) | 0;
                }

                actor.fineYaw &= 65535;
                actor.yaw = actor.fineYaw >> 5;
            }
        }
    }

    // ud.a(BLob;)V
    static GlEntityAnim(actor: ClientEntity): void {
        actor.stretches = false;
        if (actor.walkSeq !== -1) {
            const walk = SeqType.List(actor.walkSeq);
            if (walk !== null && walk.frames !== null) {
                actor.walkCycle = (actor.walkCycle + 1) | 0;
                if (actor.walkFrame < walk.frames.length && actor.walkCycle > arrayAtI32(walk.delays, actor.walkFrame)) {
                    actor.walkFrame = (actor.walkFrame + 1) | 0;
                    actor.walkCycle = 1;
                    actor.walkNext = (actor.walkNext + 1) | 0;
                    Client.TriggerSeqSound(walk, actor.z, actor.x, actor === Client.localPlayer, actor.walkFrame);
                }

                if (walk.frames.length <= actor.walkFrame) {
                    actor.walkFrame = 0;
                    actor.walkCycle = 0;
                    Client.TriggerSeqSound(walk, actor.z, actor.x, Client.localPlayer === actor, actor.walkFrame);
                }

                actor.walkNext = (actor.walkFrame + 1) | 0;
                if (actor.walkNext >= walk.frames.length) {
                    actor.walkNext = 0;
                }
            } else {
                actor.walkSeq = -1;
            }
        }

        if (actor.spotanim !== -1 && Client.loopCycle >= actor.spotStart) {
            const spotId = SpotType.List(actor.spotanim).seq;
            if (spotId !== -1) {
                const anim = SeqType.List(spotId);
                if (anim !== null && anim.frames !== null) {
                    if (actor.spotFrame < 0) {
                        actor.spotFrame = 0;
                        Client.TriggerSeqSound(anim, actor.z, actor.x, actor === Client.localPlayer, 0);
                    }

                    actor.spotCycle = (actor.spotCycle + 1) | 0;
                    if (actor.spotFrame < anim.frames.length && actor.spotCycle > arrayAtI32(anim.delays, actor.spotFrame)) {
                        actor.spotCycle = 1;
                        actor.spotFrame = (actor.spotFrame + 1) | 0;
                        Client.TriggerSeqSound(anim, actor.z, actor.x, Client.localPlayer === actor, actor.spotFrame);
                    }

                    if (anim.frames.length <= actor.spotFrame) {
                        actor.spotanim = -1;
                    }

                    actor.spotNext = (actor.spotFrame + 1) | 0;
                    if (actor.spotNext >= anim.frames.length) {
                        actor.spotNext = -1;
                    }
                } else {
                    actor.spotanim = -1;
                }
            } else {
                actor.spotanim = -1;
            }
        }

        if (actor.seq !== -1 && actor.seqDelay <= 1) {
            const preMove = SeqType.List(actor.seq);
            if (preMove.m_preanimMove === 1 && actor.seqPathLength > 0 && Client.loopCycle >= actor.exactStartTick && actor.exactEndTick < Client.loopCycle) {
                actor.seqDelay = 1;
                return;
            }
        }

        if (actor.seq !== -1 && actor.seqDelay === 0) {
            const seq = SeqType.List(actor.seq);
            if (seq !== null && seq.frames !== null) {
                actor.seqCycle = (actor.seqCycle + 1) | 0;
                if (seq.frames.length > actor.seqFrame && arrayAtI32(seq.delays, actor.seqFrame) < actor.seqCycle) {
                    actor.seqCycle = 1;
                    actor.seqFrame = (actor.seqFrame + 1) | 0;
                    Client.TriggerSeqSound(seq, actor.z, actor.x, actor === Client.localPlayer, actor.seqFrame);
                }

                if (actor.seqFrame >= seq.frames.length) {
                    actor.seqFrame = (actor.seqFrame - seq.m_loops) | 0;
                    actor.seqLoops = (actor.seqLoops + 1) | 0;
                    if (seq.m_maxLoops > actor.seqLoops) {
                        if (actor.seqFrame >= 0 && actor.seqFrame < seq.frames.length) {
                            Client.TriggerSeqSound(seq, actor.z, actor.x, actor === Client.localPlayer, actor.seqFrame);
                        } else {
                            actor.seq = -1;
                        }
                    } else {
                        actor.seq = -1;
                    }
                }

                actor.seqNext = (actor.seqFrame + 1) | 0;
                if (seq.frames.length <= actor.seqNext) {
                    actor.seqNext = (actor.seqNext - seq.m_loops) | 0;
                    if (seq.m_maxLoops <= ((actor.seqLoops + 1) | 0)) {
                        actor.seqNext = -1;
                    } else if (actor.seqNext < 0 || actor.seqNext >= seq.frames.length) {
                        actor.seqNext = -1;
                    }
                }

                actor.stretches = seq.stretches;
            } else {
                actor.seq = -1;
            }
        }

        if (actor.seqDelay > 0) {
            actor.seqDelay = (actor.seqDelay - 1) | 0;
        }

        for (let i = 0; actor.modelAnims.length > i; i = (i + 1) | 0) {
            const slot = arrayAtObj(actor.modelAnims, i);
            if (slot !== null) {
                if (slot.delay > 0) {
                    slot.delay = (slot.delay - 1) | 0;
                } else {
                    const sequence = SeqType.List(slot.seq);
                    if (sequence !== null && sequence.frames !== null) {
                        slot.cycle = (slot.cycle + 1) | 0;
                        if (slot.frame < sequence.frames.length && arrayAtI32(sequence.delays, slot.frame) < slot.cycle) {
                            slot.cycle = 1;
                            slot.frame = (slot.frame + 1) | 0;
                            Client.TriggerSeqSound(sequence, actor.z, actor.x, Client.localPlayer === actor, slot.frame);
                        }

                        if (sequence.frames.length <= slot.frame) {
                            slot.frame = (slot.frame - sequence.m_loops) | 0;
                            slot.loops = (slot.loops + 1) | 0;
                            if (slot.loops >= sequence.m_maxLoops) {
                                arrayPutObj(actor.modelAnims, i, null);
                            } else if (slot.frame >= 0 && slot.frame < sequence.frames.length) {
                                Client.TriggerSeqSound(sequence, actor.z, actor.x, Client.localPlayer === actor, slot.frame);
                            } else {
                                arrayPutObj(actor.modelAnims, i, null);
                            }
                        }

                        slot.next = (slot.frame + 1) | 0;
                        if (sequence.frames.length <= slot.next) {
                            slot.next = (slot.next - sequence.m_loops) | 0;
                            if (sequence.m_maxLoops > ((slot.loops + 1) | 0)) {
                                if (slot.next < 0 || slot.next >= sequence.frames.length) {
                                    slot.next = -1;
                                }
                            } else {
                                slot.next = -1;
                            }
                        }
                    } else {
                        arrayPutObj(actor.modelAnims, i, null);
                    }
                }
            }
        }
    }

    // vk.a(Lob;Z)V
    static GlExactMove1(actor: ClientEntity): void {
        const remaining = (-Client.loopCycle + actor.exactStartTick) | 0;

        const targetX = (Math.imul(128, actor.exactStartX) + Math.imul(actor.getSize(), 64)) | 0;
        const targetZ = (Math.imul(actor.exactStartZ, 128) + Math.imul(64, actor.getSize())) | 0;
        actor.movementDelay = 0;
        actor.z = (actor.z + intDivide((targetZ - actor.z) | 0, remaining)) | 0;
        actor.x = (actor.x + intDivide((targetX - actor.x) | 0, remaining)) | 0;
        if (actor.exactDirection === 0) {
            actor.targetYaw = 1024;
        }

        if (actor.exactDirection === 1) {
            actor.targetYaw = 1536;
        }

        if (actor.exactDirection === 2) {
            actor.targetYaw = 0;
        }

        if (actor.exactDirection === 3) {
            actor.targetYaw = 512;
        }
    }

    // rk.a(BLob;)V
    static GlExactMove2(actor: ClientEntity): void {
        if (Client.loopCycle === actor.exactEndTick || actor.seq === -1 || actor.seqDelay !== 0 || ((actor.seqCycle + 1) | 0) > arrayAtI32(SeqType.List(actor.seq).delays, actor.seqFrame)) {
            const elapsed = (-actor.exactStartTick + Client.loopCycle) | 0;
            const duration = (-actor.exactStartTick + actor.exactEndTick) | 0;
            const startX = (Math.imul(actor.exactStartX, 128) + Math.imul(64, actor.getSize())) | 0;
            const startZ = (Math.imul(128, actor.exactStartZ) + Math.imul(actor.getSize(), 64)) | 0;
            const endX = (Math.imul(actor.exactEndX, 128) + Math.imul(actor.getSize(), 64)) | 0;
            const endZ = (Math.imul(actor.exactEndZ, 128) + Math.imul(64, actor.getSize())) | 0;
            actor.x = intDivide((Math.imul(startX, (duration - elapsed) | 0) + Math.imul(elapsed, endX)) | 0, duration);
            actor.z = intDivide((Math.imul((duration - elapsed) | 0, startZ) + Math.imul(elapsed, endZ)) | 0, duration);
        }

        actor.movementDelay = 0;
        if (actor.exactDirection === 0) {
            actor.targetYaw = 1024;
        }

        if (actor.exactDirection === 1) {
            actor.targetYaw = 1536;
        }

        if (actor.exactDirection === 2) {
            actor.targetYaw = 0;
        }

        if (actor.exactDirection === 3) {
            actor.targetYaw = 512;
        }

        actor.yaw = actor.targetYaw;
    }

    // gk.a(IILob;)V
    static GlMoveEntity(_size: number, actor: ClientEntity): void {
        if (actor.exactStartTick > Client.loopCycle) {
            Client.GlExactMove1(actor);
        } else if (actor.exactEndTick < Client.loopCycle) {
            Client.GlRouteMove(actor);
        } else {
            Client.GlExactMove2(actor);
        }

        if (actor.x < 128 || actor.z < 128 || actor.x >= 13184 || actor.z >= 13184) {
            actor.exactStartTick = 0;
            actor.exactEndTick = 0;
            actor.seq = -1;
            actor.spotanim = -1;
            actor.x = (Math.imul(arrayAtI32(actor.pathX, 0), 128) + Math.imul(64, actor.getSize())) | 0;
            actor.z = (Math.imul(128, arrayAtI32(actor.pathZ, 0)) + Math.imul(actor.getSize(), 64)) | 0;
            actor.resetPath(-116);
        }

        if (Client.localPlayer === actor && (actor.x < 1536 || actor.z < 1536 || actor.x >= 11776 || actor.z >= 11776)) {
            actor.spotanim = -1;
            actor.seq = -1;
            actor.exactStartTick = 0;
            actor.exactEndTick = 0;
            actor.x = (Math.imul(128, arrayAtI32(actor.pathX, 0)) + Math.imul(actor.getSize(), 64)) | 0;
            actor.z = (Math.imul(arrayAtI32(actor.pathZ, 0), 128) + Math.imul(actor.getSize(), 64)) | 0;
            actor.resetPath(-98);
        }

        Client.GlEntityFace(actor);
        Client.GlEntityAnim(actor);
    }

    // vg.f(I)V
    static GlMovePlayers(): void {
        for (let i = -1; i < ReceivePlayerPositions.m_lastNum; i++) {
            const id = i === -1 ? 2047 : arrayAtI32(ReceivePlayerPositions.m_lastID, i);
            const p = arrayAtObj(Client.players, id);
            if (p !== null) {
                Client.GlMoveEntity(p.getSize(), p);
            }
        }
    }

    // kg.b(Z)V
    static GlMoveNpcs(): void {
        for (let i = 0; i < Client.npcCount; i++) {
            const id = arrayAtI32(Client.npcIds, i);
            const p = arrayAtObj(Client.npcs, id);
            if (p !== null) {
                Client.GlMoveEntity(requireNonNull(p.npcType).m_gridSize, p);
            }
        }
    }

    // oj.a(Z)V
    static GlTimeoutChat(): void {
        for (let i = -1; i < ReceivePlayerPositions.m_lastNum; i++) {
            const id = i === -1 ? 2047 : arrayAtI32(ReceivePlayerPositions.m_lastID, i);
            const p = arrayAtObj(Client.players, id);
            if (p !== null && p.chatTimer > 0) {
                p.chatTimer = (p.chatTimer - 1) | 0;
                if (p.chatTimer === 0) p.overheadText = null;
            }
        }
        for (let i = 0; i < Client.npcCount; i++) {
            const id = arrayAtI32(Client.npcIds, i);
            const p = arrayAtObj(Client.npcs, id);
            if (p !== null && p.chatTimer > 0) {
                p.chatTimer = (p.chatTimer - 1) | 0;
                if (p.chatTimer === 0) p.overheadText = null;
            }
        }
    }

    static chatCount = 0; // j.i:I
    static maxChats = 50; // ga.N:I
    static chatHeight = new Int32Array(Client.maxChats); // ga.Q:[I
    static chatTimer = new Int32Array(Client.maxChats); // ga.P:[I
    static chatX = new Int32Array(Client.maxChats); // ga.O:[I
    static chatColour = new Int32Array(Client.maxChats); // ga.S:[I
    static chatY = new Int32Array(Client.maxChats); // ga.L:[I
    static chatMessage: (JagString | null)[] | null = new Array<JagString | null>(Client.maxChats).fill(null); // ga.T:[Lid;
    static chatEffect = new Int32Array(Client.maxChats); // ga.U:[I
    static chatWidth = new Int32Array(Client.maxChats); // ga.R:[I
    static chatColours = Int32Array.of(0xffff00, 0xff0000, 0x00ff00, 0x00ffff, 0xff00ff, 0xffffff); // ie.I:[I

    // vj.a(IIIIIII)V. Client::GdmEntityOverlays, projects/osclient/client_entityoverlays.cpp:1251.
    // kk.a supplies 256 for both projection scales and 20 for the guard.
    static GdmEntityOverlays(top: number, left: number, width: number, height: number, scaleX = 256, scaleY = 256): void {
        try {
            const renderer = glJar ? GlRendererClass : null;
            const hdRaster = glJar ? loadGlRaster() : null;
            Client.chatCount = 0;
            for (let i = -1; i < ((ReceivePlayerPositions.m_lastNum + Client.npcCount) | 0); i++) {
                let entity: ClientEntity | null;
                if (i === -1) entity = Client.localPlayer;
                else if (i >= ReceivePlayerPositions.m_lastNum) entity = arrayAtObj(Client.npcs, arrayAtI32(Client.npcIds, (i - ReceivePlayerPositions.m_lastNum) | 0));
                else entity = arrayAtObj(Client.players, arrayAtI32(ReceivePlayerPositions.m_lastID, i));
                if (entity === null || !entity.isVisible()) continue;
                if (entity instanceof ClientNpc) {
                    let type = entity.npcType;
                    if (requireNonNull(type).multi !== null) type = requireNonNull(type).GetMultiNpc();
                    if (type === null) continue;
                }
                if (i >= ReceivePlayerPositions.m_lastNum) {
                    if (!(entity instanceof ClientNpc)) throw new TypeError('ClassCastException: expected ClientNpc');
                    let type = entity.npcType;
                    if (requireNonNull(type).multi !== null) type = requireNonNull(type).GetMultiNpc();
                    const npcType = requireNonNull(type);
                    if (npcType.headIcon >= 0 && requireNonNull(Client.imageHeadiconsPrayer).length > npcType.headIcon) {
                        const head = ((npcType.m_overlayHeight === -1 ? entity.getOverheadHeight() : npcType.m_overlayHeight) + 15) | 0;
                        Client.GetOverlayPos(height >> 1, width >> 1, head, entity, scaleX, scaleY);
                        if (Client.projectX > -1) requireNonNull(arrayAtObj(Client.imageHeadiconsPrayer, npcType.headIcon)).draw((left + Client.projectX - 12) | 0, (Client.projectY + top - 30) | 0);
                    }
                    const arrows = requireNonNull(Client.hintArrows);
                    for (let j = 0; j < arrows.length; j++) {
                        const arrow = arrayAtObj(arrows, j);
                        if (
                            arrow !== null &&
                            arrow.type === 1 &&
                            (glJar ? arrow.actor === arrayAtI32(Client.npcIds, (i - ReceivePlayerPositions.m_lastNum) | 0) : arrayAtI32(Client.npcIds, (i - ReceivePlayerPositions.m_lastNum) | 0) === arrow.actor) &&
                            Client.loopCycle % 20 < 10
                        ) {
                            const head = ((npcType.m_overlayHeight === -1 ? entity.getOverheadHeight() : npcType.m_overlayHeight) + 15) | 0;
                            Client.GetOverlayPos(height >> 1, width >> 1, head, entity, scaleX, scaleY);
                            if (Client.projectX > -1) requireNonNull(arrayAtObj(Client.hintHeadicons, arrow.icon)).draw((Client.projectX + left - 12) | 0, (Client.projectY + top - 28) | 0);
                        }
                    }
                } else {
                    let offset = 30;
                    if (!(entity instanceof ClientPlayer)) throw new TypeError('ClassCastException: expected ClientPlayer');
                    if (entity.skullIcon !== -1 || entity.headIcon !== -1) {
                        Client.GetOverlayPos(height >> 1, width >> 1, (15 + entity.getOverheadHeight()) | 0, entity, scaleX, scaleY);
                        if (Client.projectX > -1) {
                            if (entity.skullIcon !== -1) {
                                requireNonNull(arrayAtObj(Client.headiconsPk, entity.skullIcon)).draw((Client.projectX + left - 12) | 0, (top + Client.projectY - offset) | 0);
                                offset += 25;
                            }
                            if (entity.headIcon !== -1) {
                                requireNonNull(arrayAtObj(Client.imageHeadiconsPrayer, entity.headIcon)).draw((left + Client.projectX - 12) | 0, (top + Client.projectY - offset) | 0);
                                offset += 25;
                            }
                        }
                    }
                    if (i >= 0) {
                        const arrows = requireNonNull(Client.hintArrows);
                        for (let j = 0; j < arrows.length; j++) {
                            const arrow = arrayAtObj(arrows, j);
                            if (arrow !== null && arrow.type === 10 && (glJar ? arrayAtI32(ReceivePlayerPositions.m_lastID, i) === arrow.actor : arrow.actor === arrayAtI32(ReceivePlayerPositions.m_lastID, i))) {
                                Client.GetOverlayPos(height >> 1, width >> 1, (entity.getOverheadHeight() + 15) | 0, entity, scaleX, scaleY);
                                if (Client.projectX > -1) requireNonNull(arrayAtObj(Client.hintHeadicons, arrow.icon)).draw((left + Client.projectX - 12) | 0, (top + Client.projectY - offset) | 0);
                            }
                        }
                    }
                }
                let showChat = false;
                if (entity.overheadText !== null) {
                    if (i >= ReceivePlayerPositions.m_lastNum || Client.chatPublicMode === 0 || Client.chatPublicMode === 3) showChat = true;
                    else if (Client.chatPublicMode === 1) {
                        if (!(entity instanceof ClientPlayer)) throw new TypeError('ClassCastException: expected ClientPlayer');
                        showChat = Client.IsFriend(entity.username);
                    }
                }
                if (showChat) {
                    Client.GetOverlayPos(height >> 1, width >> 1, entity.getOverheadHeight(), entity, scaleX, scaleY);
                    if (Client.projectX > -1 && (glJar ? Client.chatCount < Client.maxChats : Client.maxChats > Client.chatCount)) {
                        arrayPutI32(Client.chatWidth, Client.chatCount, intDivide(requireNonNull(Client.fontBold12).stringWidth(entity.overheadText), 2));
                        arrayPutI32(Client.chatHeight, Client.chatCount, requireNonNull(Client.fontBold12).lineHeight);
                        arrayPutI32(Client.chatX, Client.chatCount, Client.projectX);
                        arrayPutI32(Client.chatY, Client.chatCount, Client.projectY);
                        arrayPutI32(Client.chatColour, Client.chatCount, entity.chatColour);
                        arrayPutI32(Client.chatEffect, Client.chatCount, entity.chatEffect);
                        arrayPutI32(Client.chatTimer, Client.chatCount, entity.chatTimer);
                        arrayPutObj(Client.chatMessage, Client.chatCount, entity.overheadText);
                        Client.chatCount = (Client.chatCount + 1) | 0;
                    }
                }
                if (Client.loopCycle < entity.healthUntil) {
                    let back = arrayAtObj(SpriteLoader.hitbarDefault, 0);
                    let front = arrayAtObj(SpriteLoader.hitbarDefault, 1);
                    let head: number;
                    if (entity instanceof ClientNpc) {
                        let bar = Client.npcHitbarSprites.Find(BigInt(requireNonNull(entity.npcType).hitmarkId));
                        if (bar !== null && !Array.isArray(bar)) throw new TypeError('ClassCastException: expected AbstractSprite[]');
                        if (bar === null) {
                            bar = SpriteLoader.loadSprites(requireNonNull(entity.npcType).hitmarkId, Client.m_pSprites, 0);
                            if (bar !== null) Client.npcHitbarSprites.Put(BigInt(requireNonNull(entity.npcType).hitmarkId), bar);
                        }
                        const type = entity.npcType;
                        if (bar !== null && bar.length === 2) {
                            front = arrayAtObj(bar, 1);
                            back = arrayAtObj(bar, 0);
                        }
                        head = requireNonNull(type).m_overlayHeight !== -1 ? requireNonNull(type).m_overlayHeight : entity.getOverheadHeight();
                    } else {
                        head = entity.getOverheadHeight();
                    }
                    Client.GetOverlayPos(height >> 1, width >> 1, (requireNonNull(back).height + 10 + head) | 0, entity, scaleX, scaleY);
                    if (Client.projectX > -1) {
                        let x: number, y: number;
                        if (glJar) {
                            x = (-(requireNonNull(back).width >> 1) + Client.projectX + left) | 0;
                            y = (Client.projectY + top - 3) | 0;
                        } else {
                            y = (Client.projectY + top - 3) | 0;
                            x = (-(requireNonNull(back).width >> 1) + Client.projectX + left) | 0;
                        }
                        requireNonNull(back).draw(x, y);
                        let barWidth: number, barHeight: number;
                        if (glJar) {
                            barWidth = intDivide(Math.imul(requireNonNull(back).width, entity.health), 255);
                            barHeight = requireNonNull(back).height;
                        } else {
                            barHeight = requireNonNull(back).height;
                            barWidth = intDivide(Math.imul(requireNonNull(back).width, entity.health), 255);
                        }
                        (renderer?.active ? requireNonNull(hdRaster) : Pix2D).intersectClipping(x, y, (barWidth + x) | 0, (barHeight + y) | 0);
                        requireNonNull(front).draw(x, y);
                        (renderer?.active ? requireNonNull(hdRaster) : Pix2D).setClipping(left, top, (width + left) | 0, (top + height) | 0);
                    }
                }
                for (let hit = 0; hit < 4; hit++) {
                    if (arrayAtI32(entity.hitUntil, hit) > Client.loopCycle) {
                        let head: number;
                        if (entity instanceof ClientNpc) {
                            const type = requireNonNull(entity.npcType);
                            head = intDivide(type.m_overlayHeight === -1 ? entity.getOverheadHeight() : type.m_overlayHeight, 2);
                        } else {
                            head = intDivide(entity.getOverheadHeight(), 2);
                        }
                        Client.GetOverlayPos(height >> 1, width >> 1, head, entity, scaleX, scaleY);
                        if (Client.projectX > -1) {
                            if (hit === 1) Client.projectY = (Client.projectY - 20) | 0;
                            if (hit === 2) {
                                if (glJar) {
                                    Client.projectY = (Client.projectY - 10) | 0;
                                    Client.projectX = (Client.projectX - 15) | 0;
                                } else {
                                    Client.projectX = (Client.projectX - 15) | 0;
                                    Client.projectY = (Client.projectY - 10) | 0;
                                }
                            }
                            if (hit === 3) {
                                if (glJar) {
                                    Client.projectY = (Client.projectY - 10) | 0;
                                    Client.projectX = (Client.projectX + 15) | 0;
                                } else {
                                    Client.projectX = (Client.projectX + 15) | 0;
                                    Client.projectY = (Client.projectY - 10) | 0;
                                }
                            }
                            requireNonNull(arrayAtObj(Client.imageHitmarks, arrayAtI32(entity.hitType, hit))).draw((left + Client.projectX - 12) | 0, (top + Client.projectY - 12) | 0);
                            const font = Client.fontPlain11;
                            const damage = JagString.fromInt(arrayAtI32(entity.hitDamage, hit));
                            requireNonNull(font).drawCentred(damage, (Client.projectX + left - 1) | 0, (top + Client.projectY + 3) | 0, 0xffffff, 0);
                        }
                    }
                }
            }
            for (let i = 0; i < Client.chatCount; i++) {
                let x: number;
                let y: number;
                let halfWidth: number;
                let lineHeight: number;
                if (glJar) {
                    y = arrayAtI32(Client.chatY, i);
                    x = arrayAtI32(Client.chatX, i);
                    lineHeight = arrayAtI32(Client.chatHeight, i);
                    halfWidth = arrayAtI32(Client.chatWidth, i);
                } else {
                    x = arrayAtI32(Client.chatX, i);
                    y = arrayAtI32(Client.chatY, i);
                    halfWidth = arrayAtI32(Client.chatWidth, i);
                    lineHeight = arrayAtI32(Client.chatHeight, i);
                }
                let overlaps = true;
                while (overlaps) {
                    overlaps = false;
                    for (let j = 0; j < i; j++) {
                        if (
                            ((arrayAtI32(Client.chatY, j) - arrayAtI32(Client.chatHeight, j)) | 0) < ((2 + y) | 0) &&
                            ((y - lineHeight) | 0) < ((2 + arrayAtI32(Client.chatY, j)) | 0) &&
                            ((x - halfWidth) | 0) < ((arrayAtI32(Client.chatX, j) + arrayAtI32(Client.chatWidth, j)) | 0) &&
                            ((glJar ? arrayAtI32(Client.chatX, j) - arrayAtI32(Client.chatWidth, j) : -arrayAtI32(Client.chatWidth, j) + arrayAtI32(Client.chatX, j)) | 0) < ((halfWidth + x) | 0) &&
                            ((glJar ? -arrayAtI32(Client.chatHeight, j) + arrayAtI32(Client.chatY, j) : arrayAtI32(Client.chatY, j) - arrayAtI32(Client.chatHeight, j)) | 0) < y
                        ) {
                            y = (arrayAtI32(Client.chatY, j) - arrayAtI32(Client.chatHeight, j)) | 0;
                            overlaps = true;
                        }
                    }
                }
                Client.projectX = arrayAtI32(Client.chatX, i);
                arrayPutI32(Client.chatY, i, y);
                Client.projectY = y;
                const message = arrayAtObj(Client.chatMessage, i);
                if (Client.chatEffects === 0) {
                    let colour = 0xffff00;
                    if (arrayAtI32(Client.chatColour, i) < 6) colour = arrayAtI32(Client.chatColours, arrayAtI32(Client.chatColour, i));
                    if (arrayAtI32(Client.chatColour, i) === 6) colour = RoofModeStatics.markStamp % 20 < 10 ? 0xff0000 : 0xffff00;
                    if (arrayAtI32(Client.chatColour, i) === 7) colour = RoofModeStatics.markStamp % 20 < 10 ? 255 : 65535;
                    if (arrayAtI32(Client.chatColour, i) === 8) colour = RoofModeStatics.markStamp % 20 < 10 ? 45056 : 0x80ff80;
                    if (arrayAtI32(Client.chatColour, i) === 9) {
                        const age = (150 - arrayAtI32(Client.chatTimer, i)) | 0;
                        if (age < 50) colour = (Math.imul(1280, age) + 0xff0000) | 0;
                        else if (age < 100) colour = (0xffff00 - Math.imul(age - 50, 327680)) | 0;
                        else if (age < 150) colour = (65280 + Math.imul(age, 5) - 500) | 0;
                    }
                    if (arrayAtI32(Client.chatColour, i) === 10) {
                        const age = (150 - arrayAtI32(Client.chatTimer, i)) | 0;
                        if (age >= 50) {
                            if (age >= 100) {
                                if (age < 150) colour = (255 + Math.imul(327680, age) - 32768000 - Math.imul(age - 100, 5)) | 0;
                            } else colour = (0xff00ff - Math.imul(327680, age - 50)) | 0;
                        } else colour = (Math.imul(5, age) + 0xff0000) | 0;
                    }
                    if (arrayAtI32(Client.chatColour, i) === 11) {
                        const age = (150 - arrayAtI32(Client.chatTimer, i)) | 0;
                        if (age < 50) colour = (0xffffff - Math.imul(327685, age)) | 0;
                        else if (age >= 100) {
                            if (age < 150) colour = (0xffffff - Math.imul(age, 327680) + 32768000) | 0;
                        } else colour = (65280 + Math.imul(age - 50, 327685)) | 0;
                    }
                    if (arrayAtI32(Client.chatEffect, i) === 0) requireNonNull(Client.fontBold12).drawCentred(message, (Client.projectX + left) | 0, (top + Client.projectY) | 0, colour, 0);
                    if (arrayAtI32(Client.chatEffect, i) === 1) requireNonNull(Client.fontBold12).drawCentredWave(message, (left + Client.projectX) | 0, (top + Client.projectY) | 0, colour, 0, RoofModeStatics.markStamp);
                    if (arrayAtI32(Client.chatEffect, i) === 2) requireNonNull(Client.fontBold12).drawCentredWave2(message, (Client.projectX + left) | 0, (Client.projectY + top) | 0, colour, 0, RoofModeStatics.markStamp);
                    if (arrayAtI32(Client.chatEffect, i) === 3) {
                        const font = Client.fontBold12;
                        const drawX = (Client.projectX + left) | 0;
                        const drawY = (Client.projectY + top) | 0;
                        const cycle = RoofModeStatics.markStamp;
                        const age = (150 - arrayAtI32(Client.chatTimer, i)) | 0;
                        requireNonNull(font).drawCentredShake(message, drawX, drawY, colour, 0, cycle, age);
                    }
                    if (arrayAtI32(Client.chatEffect, i) === 4) {
                        const scroll = intDivide(Math.imul(150 - arrayAtI32(Client.chatTimer, i), requireNonNull(Client.fontBold12).stringWidth(message) + 100), 150);
                        (renderer?.active ? requireNonNull(hdRaster) : Pix2D).intersectClipping((left + Client.projectX - 50) | 0, top, (left + Client.projectX + 50) | 0, (top + height) | 0);
                        const font = Client.fontBold12;
                        const drawX = (left + Client.projectX + 50 - scroll) | 0;
                        const drawY = (top + Client.projectY) | 0;
                        requireNonNull(font).drawLeft(message, drawX, drawY, colour, 0);
                        (renderer?.active ? requireNonNull(hdRaster) : Pix2D).setClipping(left, top, (left + width) | 0, (top + height) | 0);
                    }
                    if (arrayAtI32(Client.chatEffect, i) === 5) {
                        const age = (150 - arrayAtI32(Client.chatTimer, i)) | 0;
                        const raster = renderer?.active ? requireNonNull(hdRaster) : Pix2D;
                        const clipTop = glJar ? (-1 - requireNonNull(Client.fontBold12).lineHeight + Client.projectY + top) | 0 : (top + Client.projectY - requireNonNull(Client.fontBold12).lineHeight - 1) | 0;
                        raster.intersectClipping(left, clipTop, (width + left) | 0, (top + Client.projectY + 5) | 0);
                        let offset = 0;
                        if (age < 25) offset = (age - 25) | 0;
                        else if (age > 125) offset = (age - 125) | 0;
                        requireNonNull(Client.fontBold12).drawCentred(message, (left + Client.projectX) | 0, (Client.projectY + top + offset) | 0, colour, 0);
                        (renderer?.active ? requireNonNull(hdRaster) : Pix2D).setClipping(left, top, (left + width) | 0, (top + height) | 0);
                    }
                } else {
                    requireNonNull(Client.fontBold12).drawCentred(message, (left + Client.projectX) | 0, (top + Client.projectY) | 0, 0xffff00, 0);
                }
            }
        } catch (error) {
            if (!glJar || !isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'lc.D(' + top + ',' + width + ',' + left + ',' + scaleX + ',' + height + ',' + scaleY + ',-7397)');
        }
    }

    // al.a(IIIIIII)V. Client::GdmCoordArrow, projects/osclient/client_entityoverlays.cpp:1843.
    // kk.a passes 256 for the unused projection scales and -1 for the guard.
    static GdmCoordArrow(left: number, width: number, height: number, top: number, scaleX = 256, scaleY = 256): void {
        const arrows = requireNonNull(Client.hintArrows);
        for (let i = 0; i < arrows.length; i++) {
            const arrow = arrayAtObj(arrows, i);
            if (arrow !== null && arrow.type === 2) {
                Client.GetOverlayPos2(height >> 1, (((arrow.z - Client.mapBuildBaseZ) << 7) + arrow.offsetZ) | 0, (2 * arrow.height) | 0, width >> 1, (((arrow.x - Client.mapBuildBaseX) << 7) + arrow.offsetX) | 0, scaleX, scaleY);
                if (Client.projectX > -1 && Client.loopCycle % 20 < 10) {
                    const sprite = arrayAtObj(Client.hintHeadicons, arrow.icon);
                    const x = (-12 + Client.projectX + left) | 0;
                    const y = (-28 + Client.projectY + top) | 0;
                    requireNonNull(sprite).draw(x, y);
                }
            }
        }
    }

    // vi.a(IBIIIILob;)V. Client::GetOverlayPos.
    static GetOverlayPos(centerY: number, centerX: number, height: number, entity: ClientEntity, scaleX = 256, scaleY = 256): void {
        Client.GetOverlayPos2(centerY, entity.z, height, centerX, entity.x, scaleX, scaleY);
    }

    // aj.a(IIZIIIII)V. Client::GetOverlayPos coordinate overload.
    static GetOverlayPos2(centerY: number, fineZ: number, height: number, centerX: number, fineX: number, scaleX = 256, scaleY = 256): void {
        if (fineX < 128 || fineZ < 128 || fineX > 13056 || fineZ > 13056) {
            Client.projectY = -1;
            Client.projectX = -1;
            return;
        }
        const groundY = (Client.GetAvH(fineX, fineZ, Client.playerLevel, -20) - height) | 0;
        let z: number;
        let y: number;
        if (glJar) {
            z = (fineZ - OrbitCamera.z) | 0;
            y = (groundY - OrbitCamera.y) | 0;
        } else {
            y = (groundY - OrbitCamera.y) | 0;
            z = (fineZ - OrbitCamera.z) | 0;
        }
        const x = (fineX - OrbitCamera.x) | 0;
        const sinPitch = arrayAtI32(Pix3D.sinTable, OrbitCamera.pitch);
        let cosPitch: number;
        let sinYaw: number;
        if (glJar) {
            cosPitch = arrayAtI32(Pix3D.cosTable, OrbitCamera.pitch);
            sinYaw = arrayAtI32(Pix3D.sinTable, OrbitCamera.yaw);
        } else {
            sinYaw = arrayAtI32(Pix3D.sinTable, OrbitCamera.yaw);
            cosPitch = arrayAtI32(Pix3D.cosTable, OrbitCamera.pitch);
        }
        const cosYaw = arrayAtI32(Pix3D.cosTable, OrbitCamera.yaw);
        const side = (Math.imul(cosYaw, x) + Math.imul(z, sinYaw)) >> 16;
        const forward = (Math.imul(cosYaw, z) - Math.imul(x, sinYaw)) >> 16;
        const up = (Math.imul(cosPitch, y) - Math.imul(sinPitch, forward)) >> 16;
        const depth = (Math.imul(y, sinPitch) + Math.imul(cosPitch, forward)) >> 16;
        if (depth >= 50 && glJar && GlRendererClass.active) {
            // HD q.a(IIIIIIBI)V. Projection scales are calculated from the clipped HD viewport.
            Client.projectX = (intDivide(Math.imul(Math.imul(scaleX, 512) >> 8, side), depth) + centerX) | 0;
            Client.projectY = (intDivide(Math.imul(Math.imul(512, scaleY) >> 8, up), depth) + centerY) | 0;
        } else if (depth >= 50 && glJar) {
            Client.projectX = (intDivide(side << 9, depth) + centerX) | 0;
            Client.projectY = (intDivide(up << 9, depth) + centerY) | 0;
        } else if (depth >= 50) {
            Client.projectY = (intDivide(up << 9, depth) + centerY) | 0;
            Client.projectX = (intDivide(side << 9, depth) + centerX) | 0;
        } else {
            Client.projectY = -1;
            Client.projectX = -1;
        }
    }

    static readonly mapNpcRegionIds = new Int32Array(64); // uf.m:[I
    static npcSpawnRegionCount = 0; // qk.F:I

    // SD vg.e(I)V and HD mh.h(B)V. The HD method writes BAS after the zero-turn-speed yaw reset.
    static spawnMapNpcs(): void {
        try {
            const files = requireNonNull(Client.mapBuildNpcData);
            for (let i = 0; i < files.length; i++) {
                const data = files[i];
                if (data === null) continue;
                let region = -1;
                for (let j = 0; j < Client.npcSpawnRegionCount; j++) {
                    if (arrayAtI32(Client.mapNpcRegionIds, j) === arrayAtI32(Client.mapBuildIndex, i)) {
                        region = j;
                        break;
                    }
                }
                if (region === -1) {
                    arrayPutI32(Client.mapNpcRegionIds, Client.npcSpawnRegionCount, arrayAtI32(Client.mapBuildIndex, i));
                    region = Client.npcSpawnRegionCount;
                    Client.npcSpawnRegionCount = (Client.npcSpawnRegionCount + 1) | 0;
                }
                const packet = new PacketT(data);
                let entry = 0;
                if (data.length <= packet.m_pos) continue;
                while (entry < 511) {
                    const index = region | (entry++ << 6);
                    const position = packet.g2();
                    const level = position >> 14;
                    const localX = 63 & (position >> 7);
                    const localZ = 63 & position;
                    const x = (localX + Math.imul(64, arrayAtI32(Client.mapBuildIndex, i) >> 8) - Client.mapBuildBaseX) | 0;
                    const z = (localZ + Math.imul(64, arrayAtI32(Client.mapBuildIndex, i) & 255) - Client.mapBuildBaseZ) | 0;
                    const type = NpcType.List(packet.g2());
                    if (arrayAtObj(Client.npcs, index) === null && (type.movementFlags & 1) > 0 && level === ClientBuild.buildLevel && x >= 0 && ((x + type.m_gridSize) | 0) < 104 && z >= 0 && ((type.m_gridSize + z) | 0) < 104) {
                        arrayPutObj(Client.npcs, index, new ClientNpc());
                        const npc = requireNonNull(arrayAtObj(Client.npcs, index));
                        const insert = Client.npcCount;
                        Client.npcCount = (Client.npcCount + 1) | 0;
                        arrayPutI32(Client.npcIds, insert, index);
                        npc.lastUpdate = Client.loopCycle;
                        npc.setType(type);
                        npc.setSize(requireNonNull(npc.npcType).m_gridSize);
                        npc.targetYaw = npc.yaw = arrayAtI32(Client.FACING_MAP, requireNonNull(npc.npcType).spawnDirection);
                        npc.turnSpeed = requireNonNull(npc.npcType).m_turnSpeed;
                        if (!glJar) npc.bas = requireNonNull(npc.npcType).m_baseAnimationSet;
                        if (npc.turnSpeed === 0) npc.yaw = 0;
                        if (glJar) npc.bas = requireNonNull(npc.npcType).m_baseAnimationSet;
                        npc.moveSized(npc.getSize(), z, x, true);
                    }
                    if (data.length <= packet.m_pos) break;
                }
            }
        } catch (error) {
            if (!glJar || !isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'mh.E(-124)');
        }
    }
    static readonly percent1 = fromLiteral('(U1'); // li.E:Lid;
    static readonly percent2 = fromLiteral('(U2'); // qk.E:Lid;
    static readonly percent3 = fromLiteral('(U3'); // wa.s:Lid;
    static readonly percent4 = hashTableInitStrings.percent4; // nc.r:Lid;
    static readonly percent5 = fromLiteral('(U5'); // lg.F:Lid;
    static readonly dnsTag = fromLiteral('(Udns'); // ck.w:Lid;
    static readonly infText = fromLiteral('(Z'); // ta.R:Lid;

    static qaOpTest = false; // uc.c:Z
    static scrollGrabbed = false; // aj.sb:Z
    static scrollInputPadding = 0; // gf.eb:I
    static idkDesignButton1 = -1; // ta.P:I
    static genderButtonImage1 = -1; // nl.bb:I

    // we.a(ILaj;)V. NXT Client::ClientComponent.
    static ClientComponent(component: IfType | null): void {
        try {
            const c = requireNonNull(component);
            const code = c.clientCode;
            if (code === 324) {
                if (Client.idkDesignButton1 === -1) {
                    Client.genderButtonImage1 = c.activeSprite;
                    Client.idkDesignButton1 = c.spriteId;
                }
                if (!Client.designAppearance.female) c.spriteId = Client.genderButtonImage1;
                else c.spriteId = Client.idkDesignButton1;
            } else if (code === 325) {
                if (Client.idkDesignButton1 === -1) {
                    Client.genderButtonImage1 = c.activeSprite;
                    Client.idkDesignButton1 = c.spriteId;
                }
                if (Client.designAppearance.female) c.spriteId = Client.genderButtonImage1;
                else c.spriteId = Client.idkDesignButton1;
            } else if (code === 327) {
                c.modelXAngle = 150;
                c.modelYAngle = ((Math.sin(Client.loopCycle / 40.0) * 256.0) | 0) & 2047;
                c.modelType = 5;
                c.modelId = -1;
            } else if (code === 328) {
                if (requireNonNull(Client.localPlayer).username === null) {
                    c.modelId = 0;
                } else {
                    c.modelXAngle = 150;
                    c.modelYAngle = ((256.0 * Math.sin(Client.loopCycle / 40.0)) | 0) & 2047;
                    c.modelType = 5;
                    c.modelId = ((Number(BigInt.asIntN(32, requireNonNull(requireNonNull(Client.localPlayer).username).toBase37())) << 11) + 2047) | 0;
                    c.modelCycle = 0;
                    c.modelFrame = requireNonNull(Client.localPlayer).walkFrame;
                    c.modelNext = requireNonNull(Client.localPlayer).walkNext;
                    c.modelAnim = requireNonNull(Client.localPlayer).walkSeq;
                }
            }
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'we.A(12449,' + (component === null ? 'null' : '{...}') + ')');
        }
    }

    // client.b(Laj;)Z. NXT Client::Hide.
    static Hide(component: IfType): boolean {
        if (Client.qaOpTest && (Client.GetActive(component).events !== 0 || component.type === 0)) return false;
        return component.hidden;
    }

    // ed.a(Laj;I)V. NXT Client::ComponentUpdated.
    static ComponentUpdated(component: IfType | null): void {
        component = requireNonNull(component);
        if (component.drawCycle === InterfaceList.cycle) arrayPutObj(InterfaceList.dirty, component.rootIndex, true);
    }

    // ii.a(IIILaj;IIII)V. NXT Client::DoScrollbar.
    static DoScrollbar(component: IfType, x: number, y: number, height: number, scrollHeight: number, mouseX: number, mouseY: number): void {
        Client.scrollInputPadding = Client.scrollGrabbed ? 32 : 0;
        Client.scrollGrabbed = false;
        if (ClientMouseListener.mouseButton !== 0) {
            if (mouseX >= x && mouseX < ((x + 16) | 0) && mouseY >= y && mouseY < ((y + 16) | 0)) {
                component.scrollY = (component.scrollY - 4) | 0;
                Client.ComponentUpdated(component);
            } else if (mouseX >= x && mouseX < ((x + 16) | 0) && mouseY >= ((height + y - 16) | 0) && mouseY < ((height + y) | 0)) {
                component.scrollY = (component.scrollY + 4) | 0;
                Client.ComponentUpdated(component);
            } else if (mouseX >= ((x - Client.scrollInputPadding) | 0) && mouseX < ((x + 16 + Client.scrollInputPadding) | 0) && mouseY >= ((y + 16) | 0) && mouseY < ((height + y - 16) | 0)) {
                const thumb = Math.max(8, intDivide(Math.imul(height, height - 32), scrollHeight));
                const travel = (height - 32 - thumb) | 0;
                const offset = (mouseY - y - 16 - intDivide(thumb, 2)) | 0;
                component.scrollY = intDivide(Math.imul(scrollHeight - height, offset), travel);
                Client.ComponentUpdated(component);
                Client.scrollGrabbed = true;
            }
        }
        if (MouseWheel.rotation !== 0 && mouseX >= ((x - component.width) | 0) && mouseX < ((x + 16) | 0) && mouseY >= y && mouseY <= ((height + y) | 0)) {
            component.scrollY = (component.scrollY + Math.imul(45, MouseWheel.rotation)) | 0;
            Client.ComponentUpdated(component);
        }
    }

    // gi.a(ILaj;)Lid;. NXT Client::TargetVerb.
    static TargetVerb(component: IfType): JagString | null {
        if (Client.GetActive(component).getTargetMask() === 0) return null;
        if (component.targetVerbValue !== null && component.targetVerbValue.trim().length !== 0) return component.targetVerbValue;
        return Client.qaOpTest ? Minimenu.hiddenUse : null;
    }

    // client.a(Laj;)Ll;. NXT Client::GetActive.
    static GetActive(c: IfType | null): ServerActiveProperties {
        const table = Client.serverActiveProperties;
        const component = requireNonNull(c);
        const id = component.id;
        const child = component.childId;
        let entry = activePropertyKeys.get(component);
        if (!entry || entry.id !== id || entry.child !== child) {
            entry = { id, child, key: BigInt.asIntN(64, (BigInt(id) << 32n) + BigInt(child)) };
            activePropertyKeys.set(component, entry);
        }
        const properties = table.get(entry.key, child);
        if (properties !== null && !(properties instanceof ServerActiveProperties)) throw new TypeError('ClassCastException: not a ServerActiveProperties');
        return properties === null ? component.properties : properties;
    }

    // client.c(Laj;)Laj;. NXT Client::ServerDraggable.
    static ServerDraggable(component: IfType): IfType | null {
        const depth = Client.GetActive(component).ServerDraggable();
        if (depth === 0) return null;
        for (let i = 0; i < depth; i++) {
            const parent = IfType.Get(component.parentId);
            if (parent === null) return null;
            component = parent;
        }
        return component;
    }

    // sd.a(Laj;I)Laj;. NXT Client::GetDragLayer.
    static GetDragLayer(component: IfType): IfType | null {
        return Client.ServerDraggable(component) ?? component.dragParent;
    }

    // client.a(IBLaj;I)V. NXT Client::DragTryPickup, also called by CS2 3108 and 3109.
    static DragTryPickup(x: number, component: IfType | null, y: number): void {
        if (ComponentDrag.component !== null || Minimenu.isOpen || component === null) return;
        if (Client.GetDragLayer(component) === null) return;
        ComponentDrag.component = component;
        ComponentDrag.parent = Client.GetDragLayer(component);
        ComponentDrag.dragMouseY = y;
        ComponentDrag.started = false;
        ComponentDrag.cycles = 0;
        ComponentDrag.dragMouseX = x;
    }

    // bb.a(II)V. NXT Client::IfAnimReset.
    static IfAnimReset(group: number): void {
        if (!IfType.OpenInterface(group)) return;
        const row = requireNonNull(arrayAtObj(IfType.m_list, group));
        for (const c of row) {
            if (c !== null) {
                c.modelNext = 1;
                c.modelFrame = 0;
                c.modelCycle = 0;
            }
        }
    }

    // rj.a(II)V. NXT Client::PurgeServerActive.
    static PurgeServerActive(group: number): void {
        for (let entry = Client.serverActiveProperties.head(); entry !== null; entry = Client.serverActiveProperties.next()) {
            if (((entry.key >> 48n) & 65535n) === BigInt(group)) entry.Unlink();
        }
    }

    // ti.a(IIIB)Lqd;. NXT Client::OpenSubinterface.
    static OpenSubinterface(parent: number, group: number, type: number, ui = Client.activeClient?.ui): SubInterface | Promise<SubInterface> {
        return runToCompletion(
            (function* (): Generator<Promise<void>, SubInterface, void> {
                const sub = new SubInterface();
                sub.type = type;
                sub.group = group;
                InterfaceList.subInterfaces.put(sub, BigInt(parent));
                Client.IfAnimReset(group);
                const c = IfType.Get(parent);
                if (c !== null) Client.ComponentUpdated(c);
                if (InterfaceList.pressedContinue !== null) {
                    Client.ComponentUpdated(InterfaceList.pressedContinue);
                    InterfaceList.pressedContinue = null;
                }
                Minimenu.RemoveInterfaceEntries();
                if (c !== null) Client.InterfaceCalculateSizeAndPosSubcomponents(false, c);
                const loaded = ScriptRunner.OnLoad(group, ui?.runner);
                if (loaded instanceof Promise) yield loaded;
                if (InterfaceList.top !== -1) {
                    const changed = Client.RunHookImmediate(InterfaceList.top, 1, ui?.runner);
                    if (changed instanceof Promise) yield changed;
                }
                ui?.refreshView();
                return sub;
            })()
        );
    }

    // ok.a(Lqd;ZI)V. NXT Client::CloseSubinterface.
    static CloseSubinterface(sub: SubInterface, discard: boolean, ui = Client.activeClient?.ui, runner = ui?.runner): void | Promise<void> {
        const group = sub.group,
            parent = Number(BigInt.asIntN(32, sub.key));
        sub.Unlink();
        if (discard) IfType.CloseInterface(group);
        Client.PurgeServerActive(group);
        const c = IfType.Get(parent);
        if (c !== null) Client.ComponentUpdated(c);
        Minimenu.RemoveInterfaceEntries();
        if (InterfaceList.top !== -1) {
            const hooks = Client.RunHookImmediate(InterfaceList.top, 1, runner);
            if (hooks instanceof Promise) return hooks.then(() => ui?.refreshView());
        }
        ui?.refreshView();
    }

    // a.a(B)V. NXT Client::CloseModal.
    static CloseModal(ui = Client.activeClient?.ui, runner = ui?.runner): void | Promise<void> {
        return runToCompletion(
            (function* (): Generator<Promise<unknown>, void, void> {
                Client.out.pHead(184);
                for (let sub = InterfaceList.subInterfaces.head(); sub !== null; sub = InterfaceList.subInterfaces.next()) {
                    if (sub.type === 0) {
                        const closed = Client.CloseSubinterface(sub, true, ui, runner);
                        if (closed instanceof Promise) yield closed;
                    }
                }
                if (InterfaceList.pressedContinue !== null) {
                    Client.ComponentUpdated(InterfaceList.pressedContinue);
                    InterfaceList.pressedContinue = null;
                }
            })()
        );
    }

    // SD bd.c(II)V / HD i.p(II)V. NXT Client::DoAction in projects/osclient/client_UI.cpp.
    static DoAction(index: number, ui?: InterfaceSession): void | Promise<void> {
        if (index < 0) return;
        const frame = (function* (): Generator<Promise<unknown>, void, void> {
            const slotOrX = arrayAtI32(Minimenu.paramB, index);
            const componentOrZ = arrayAtI32(Minimenu.paramC, index);
            let key: bigint, id: number, action: number;
            if (glJar) {
                action = arrayAtI16(Minimenu.actions, index);
                if (action >= 2000) action -= 2000;
                key = arrayAtB64(Minimenu.keys, index);
                id = Number(BigInt.asIntN(32, arrayAtB64(Minimenu.keys, index)));
            } else {
                key = arrayAtB64(Minimenu.keys, index);
                id = Number(BigInt.asIntN(32, arrayAtB64(Minimenu.keys, index)));
                action = arrayAtI16(Minimenu.actions, index);
                if (action >= 2000) action = ((action - 2000) << 16) >> 16;
            }
            switch (action) {
                case MinimenuOps.INV_BUTTON2: {
                    Client.out.pHead(206);
                    Client.out.p2_alt2(id);
                    Client.out.p2_alt1(slotOrX);
                    Client.out.p4_alt1(componentOrZ);
                    Minimenu.highlightTicks = 0;
                    Minimenu.highlightComponent = IfType.Get(componentOrZ);
                    Minimenu.highlightSlot = slotOrX;
                    break;
                }
                case MinimenuOps.OPPLAYERT: {
                    const actor = arrayAtObj(Client.players, id);
                    if (actor !== null) {
                        if (glJar) {
                            RouteFinding.FindRouteHd(
                                arrayAtI32(requireNonNull(Client.localPlayer).pathZ, 0),
                                0,
                                1,
                                false,
                                0,
                                2,
                                arrayAtI32(actor.pathX, 0),
                                1,
                                0,
                                2,
                                arrayAtI32(actor.pathZ, 0),
                                arrayAtI32(requireNonNull(Client.localPlayer).pathX, 0)
                            );
                        } else {
                            RouteFinding.FindRoute(1, arrayAtI32(actor.pathZ, 0), arrayAtI32(actor.pathX, 0), 1, false, 0, 0, arrayAtI32(requireNonNull(Client.localPlayer).pathZ, 0), 0, 2, arrayAtI32(requireNonNull(Client.localPlayer).pathX, 0));
                        }
                        if (glJar) {
                            Minimenu.crossTicks = 0;
                            Minimenu.crossMode = 2;
                            Minimenu.crossX = ClientMouseListener.clickX;
                            Minimenu.crossY = ClientMouseListener.clickY;
                        } else {
                            Minimenu.crossX = ClientMouseListener.clickX;
                            Minimenu.crossTicks = 0;
                            Minimenu.crossY = ClientMouseListener.clickY;
                            Minimenu.crossMode = 2;
                        }
                        Client.out.pHead(195);
                        Client.out.p2_alt2(Minimenu.targetChild);
                        Client.out.p4_alt1(Minimenu.targetComponent);
                        Client.out.p2_alt3(id);
                    }
                    break;
                }
                case MinimenuOps.OPLOC4: {
                    Client.interactWithLoc(key, slotOrX, componentOrZ);
                    Client.out.pHead(247);
                    Client.out.p2_alt1((componentOrZ + Client.mapBuildBaseZ) | 0);
                    Client.out.p2_alt3((slotOrX + Client.mapBuildBaseX) | 0);
                    Client.out.p2(Number((key >> 32n) & 0x7fffffffn));
                    break;
                }
                case MinimenuOps.OPOBJ4: {
                    if (GameVariant.id === 1) {
                        RouteFinding.FindRoute(1, componentOrZ, slotOrX, 1, false, 0, 0, arrayAtI32(requireNonNull(Client.localPlayer).pathZ, 0), 0, 2, arrayAtI32(requireNonNull(Client.localPlayer).pathX, 0));
                    } else if (!RouteFinding.FindRoute(0, componentOrZ, slotOrX, 0, false, 0, 0, arrayAtI32(requireNonNull(Client.localPlayer).pathZ, 0), 0, 2, arrayAtI32(requireNonNull(Client.localPlayer).pathX, 0))) {
                        RouteFinding.FindRoute(1, componentOrZ, slotOrX, 1, false, 0, 0, arrayAtI32(requireNonNull(Client.localPlayer).pathZ, 0), 0, 2, arrayAtI32(requireNonNull(Client.localPlayer).pathX, 0));
                    }
                    if (glJar) {
                        Minimenu.crossY = ClientMouseListener.clickY;
                        Minimenu.crossTicks = 0;
                        Minimenu.crossX = ClientMouseListener.clickX;
                        Minimenu.crossMode = 2;
                    } else {
                        Minimenu.crossY = ClientMouseListener.clickY;
                        Minimenu.crossTicks = 0;
                        Minimenu.crossMode = 2;
                        Minimenu.crossX = ClientMouseListener.clickX;
                    }
                    Client.out.pHead(33);
                    Client.out.p2(id);
                    Client.out.p2((slotOrX + Client.mapBuildBaseX) | 0);
                    Client.out.p2_alt1((componentOrZ + Client.mapBuildBaseZ) | 0);
                    break;
                }
                case MinimenuOps.OPNPC3: {
                    const actor = arrayAtObj(Client.npcs, id);
                    if (actor !== null) {
                        if (glJar) {
                            RouteFinding.FindRouteHd(
                                arrayAtI32(requireNonNull(Client.localPlayer).pathZ, 0),
                                0,
                                1,
                                false,
                                0,
                                2,
                                arrayAtI32(actor.pathX, 0),
                                1,
                                0,
                                2,
                                arrayAtI32(actor.pathZ, 0),
                                arrayAtI32(requireNonNull(Client.localPlayer).pathX, 0)
                            );
                        } else {
                            RouteFinding.FindRoute(1, arrayAtI32(actor.pathZ, 0), arrayAtI32(actor.pathX, 0), 1, false, 0, 0, arrayAtI32(requireNonNull(Client.localPlayer).pathZ, 0), 0, 2, arrayAtI32(requireNonNull(Client.localPlayer).pathX, 0));
                        }
                        if (glJar) {
                            Minimenu.crossMode = 2;
                            Minimenu.crossTicks = 0;
                            Minimenu.crossY = ClientMouseListener.clickY;
                            Minimenu.crossX = ClientMouseListener.clickX;
                        } else {
                            Minimenu.crossTicks = 0;
                            Minimenu.crossX = ClientMouseListener.clickX;
                            Minimenu.crossY = ClientMouseListener.clickY;
                            Minimenu.crossMode = 2;
                        }
                        Client.out.pHead(148);
                        Client.out.p2_alt2(id);
                    }
                    break;
                }
                case MinimenuOps.OPLOC2: {
                    Client.interactWithLoc(key, slotOrX, componentOrZ);
                    Client.out.pHead(194);
                    Client.out.p2_alt3((componentOrZ + Client.mapBuildBaseZ) | 0);
                    Client.out.p2_alt1((slotOrX + Client.mapBuildBaseX) | 0);
                    Client.out.p2(Number((key >> 32n) & 0x7fffffffn));
                    break;
                }
                case MinimenuOps.OPHELD1: {
                    Client.out.pHead(156);
                    Client.out.p2_alt3(slotOrX);
                    Client.out.p2_alt2(id);
                    Client.out.p4_alt1(componentOrZ);
                    Minimenu.highlightTicks = 0;
                    Minimenu.highlightComponent = IfType.Get(componentOrZ);
                    Minimenu.highlightSlot = slotOrX;
                    break;
                }
                case MinimenuOps.INV_BUTTON4: {
                    Client.out.pHead(85);
                    Client.out.p4_alt2(componentOrZ);
                    Client.out.p2(slotOrX);
                    Client.out.p2_alt2(id);
                    Minimenu.highlightTicks = 0;
                    Minimenu.highlightComponent = IfType.Get(componentOrZ);
                    Minimenu.highlightSlot = slotOrX;
                    break;
                }
                case MinimenuOps.OPLOCT: {
                    if (!Client.interactWithLoc(key, slotOrX, componentOrZ)) break;
                    Client.out.pHead(233);
                    Client.out.p2_alt3((componentOrZ + Client.mapBuildBaseZ) | 0);
                    Client.out.p2_alt2((slotOrX + Client.mapBuildBaseX) | 0);
                    Client.out.p2_alt3(Minimenu.targetChild);
                    Client.out.p4_alt2(Minimenu.targetComponent);
                    Client.out.p2_alt2(Number((key >> 32n) & 0x7fffffffn));
                    break;
                }
                case MinimenuOps.OPOBJ5: {
                    if (GameVariant.id === 1) {
                        RouteFinding.FindRoute(1, componentOrZ, slotOrX, 1, false, 0, 0, arrayAtI32(requireNonNull(Client.localPlayer).pathZ, 0), 0, 2, arrayAtI32(requireNonNull(Client.localPlayer).pathX, 0));
                    } else if (!RouteFinding.FindRoute(0, componentOrZ, slotOrX, 0, false, 0, 0, arrayAtI32(requireNonNull(Client.localPlayer).pathZ, 0), 0, 2, arrayAtI32(requireNonNull(Client.localPlayer).pathX, 0))) {
                        RouteFinding.FindRoute(1, componentOrZ, slotOrX, 1, false, 0, 0, arrayAtI32(requireNonNull(Client.localPlayer).pathZ, 0), 0, 2, arrayAtI32(requireNonNull(Client.localPlayer).pathX, 0));
                    }
                    if (glJar) {
                        Minimenu.crossMode = 2;
                        Minimenu.crossY = ClientMouseListener.clickY;
                        Minimenu.crossX = ClientMouseListener.clickX;
                        Minimenu.crossTicks = 0;
                    } else {
                        Minimenu.crossY = ClientMouseListener.clickY;
                        Minimenu.crossX = ClientMouseListener.clickX;
                        Minimenu.crossMode = 2;
                        Minimenu.crossTicks = 0;
                    }
                    Client.out.pHead(48);
                    Client.out.p2_alt2((slotOrX + Client.mapBuildBaseX) | 0);
                    Client.out.p2_alt3(id);
                    Client.out.p2_alt1((componentOrZ + Client.mapBuildBaseZ) | 0);
                    break;
                }
                case MinimenuOps.INV_BUTTON5: {
                    Client.out.pHead(6);
                    Client.out.p4(componentOrZ);
                    Client.out.p2_alt2(slotOrX);
                    Client.out.p2_alt1(id);
                    Minimenu.highlightTicks = 0;
                    Minimenu.highlightComponent = IfType.Get(componentOrZ);
                    Minimenu.highlightSlot = slotOrX;
                    break;
                }
                case MinimenuOps.IF_SET: {
                    Client.out.pHead(10);
                    Client.out.p4(componentOrZ);
                    const component = requireNonNull(IfType.Get(componentOrZ));
                    if (component.scripts !== null && arrayAtI32(arrayAtObj(component.scripts, 0), 0) === 5) {
                        const varp = arrayAtI32(arrayAtObj(component.scripts, 0), 1);
                        const changed = glJar ? arrayAtI32(ClientVarCache.m_var, varp) !== arrayAtI32(component.comparisonValues, 0) : arrayAtI32(component.comparisonValues, 0) !== arrayAtI32(ClientVarCache.m_var, varp);
                        if (changed) {
                            arrayPutI32(ClientVarCache.m_var, varp, arrayAtI32(component.comparisonValues, 0));
                            Client.ClientVar(varp);
                        }
                    }
                    break;
                }
                case MinimenuOps.OPHELD3: {
                    Client.out.pHead(153);
                    Client.out.p4_alt1(componentOrZ);
                    Client.out.p2_alt1(slotOrX);
                    Client.out.p2_alt1(id);
                    Minimenu.highlightTicks = 0;
                    Minimenu.highlightComponent = IfType.Get(componentOrZ);
                    Minimenu.highlightSlot = slotOrX;
                    break;
                }
                case MinimenuOps.OPHELD4: {
                    Client.out.pHead(161);
                    Client.out.p4_alt1(componentOrZ);
                    Client.out.p2_alt3(id);
                    Client.out.p2_alt3(slotOrX);
                    Minimenu.highlightTicks = 0;
                    Minimenu.highlightComponent = IfType.Get(componentOrZ);
                    Minimenu.highlightSlot = slotOrX;
                    break;
                }
                case MinimenuOps.OPLOC1: {
                    Client.interactWithLoc(key, slotOrX, componentOrZ);
                    Client.out.pHead(254);
                    Client.out.p2_alt1((slotOrX + Client.mapBuildBaseX) | 0);
                    Client.out.p2_alt2(Number((key >> 32n) & 0x7fffffffn));
                    Client.out.p2((componentOrZ + Client.mapBuildBaseZ) | 0);
                    break;
                }
                case MinimenuOps.OPLOC3: {
                    Client.interactWithLoc(key, slotOrX, componentOrZ);
                    Client.out.pHead(84);
                    Client.out.p2_alt3(Number((key >> 32n) & 0x7fffffffn));
                    Client.out.p2_alt3((componentOrZ + Client.mapBuildBaseZ) | 0);
                    Client.out.p2_alt1((slotOrX + Client.mapBuildBaseX) | 0);
                    break;
                }
                case MinimenuOps.OPPLAYER7: {
                    const actor = arrayAtObj(Client.players, id);
                    if (actor !== null) {
                        if (glJar) {
                            RouteFinding.FindRouteHd(
                                arrayAtI32(requireNonNull(Client.localPlayer).pathZ, 0),
                                0,
                                1,
                                false,
                                0,
                                2,
                                arrayAtI32(actor.pathX, 0),
                                1,
                                0,
                                2,
                                arrayAtI32(actor.pathZ, 0),
                                arrayAtI32(requireNonNull(Client.localPlayer).pathX, 0)
                            );
                        } else {
                            RouteFinding.FindRoute(1, arrayAtI32(actor.pathZ, 0), arrayAtI32(actor.pathX, 0), 1, false, 0, 0, arrayAtI32(requireNonNull(Client.localPlayer).pathZ, 0), 0, 2, arrayAtI32(requireNonNull(Client.localPlayer).pathX, 0));
                        }
                        if (glJar) {
                            Minimenu.crossTicks = 0;
                            Minimenu.crossMode = 2;
                            Minimenu.crossY = ClientMouseListener.clickY;
                            Minimenu.crossX = ClientMouseListener.clickX;
                        } else {
                            Minimenu.crossX = ClientMouseListener.clickX;
                            Minimenu.crossY = ClientMouseListener.clickY;
                            Minimenu.crossMode = 2;
                            Minimenu.crossTicks = 0;
                        }
                        Client.out.pHead(114);
                        Client.out.p2_alt3(id);
                    }
                    break;
                }
                case MinimenuOps.IF_BUTTONT: {
                    Client.out.pHead(82);
                    Client.out.p2(Minimenu.targetChild);
                    Client.out.p4_alt2(componentOrZ);
                    Client.out.p4(Minimenu.targetComponent);
                    Client.out.p2_alt3(slotOrX);
                    break;
                }
                case MinimenuOps.FACE_HERE: {
                    if (id !== 0) {
                        if (Client.staffModLevel > 0 && arrayAtObj(ClientKeyboardListener.pressed, 82) && arrayAtObj(ClientKeyboardListener.pressed, 81)) {
                            WorldMap.teleport((slotOrX + Client.mapBuildBaseX) | 0, (componentOrZ + Client.mapBuildBaseZ) | 0, Client.playerLevel);
                        } else {
                            Client.out.pHead(179);
                            Client.out.p2((componentOrZ + Client.mapBuildBaseZ) | 0);
                            Client.out.p2((slotOrX + Client.mapBuildBaseX) | 0);
                        }
                    } else {
                        Client.walkClickStage = 1;
                        world.updateMousePicking(Client.playerLevel, slotOrX, componentOrZ);
                    }
                    break;
                }
                case MinimenuOps.IF_CONTINUE: {
                    if (InterfaceList.pressedContinue === null) {
                        Minimenu.resumePauseButton(slotOrX, componentOrZ);
                        InterfaceList.pressedContinue = InterfaceList.GetComponent(componentOrZ, slotOrX);
                        Client.ComponentUpdated(requireNonNull(InterfaceList.pressedContinue));
                    }
                    break;
                }
                case MinimenuOps.IF_CLOSE: {
                    const close = Client.CloseModal(ui);
                    if (close instanceof Promise) yield close;
                    break;
                }
                case MinimenuOps.WALK_HERE: {
                    if (id === 0) {
                        world.updateMousePicking(Client.playerLevel, slotOrX, componentOrZ);
                    } else if (id === 1) {
                        if (Client.staffModLevel > 0 && arrayAtObj(ClientKeyboardListener.pressed, 82) && arrayAtObj(ClientKeyboardListener.pressed, 81)) {
                            WorldMap.teleport((slotOrX + Client.mapBuildBaseX) | 0, (componentOrZ + Client.mapBuildBaseZ) | 0, Client.playerLevel);
                        } else if (RouteFinding.FindRoute(0, componentOrZ, slotOrX, 0, true, 0, 0, arrayAtI32(requireNonNull(Client.localPlayer).pathZ, 0), 0, 1, arrayAtI32(requireNonNull(Client.localPlayer).pathX, 0))) {
                            Client.out.p1(Client.minimapClickX);
                            Client.out.p1(Client.minimapClickY);
                            Client.out.p2(OrbitCamera.followYaw);
                            Client.out.p1(57);
                            Client.out.p1(OrbitCamera.minimapAngle);
                            Client.out.p1(OrbitCamera.minimapZoom);
                            Client.out.p1(89);
                            Client.out.p2(requireNonNull(Client.localPlayer).x);
                            Client.out.p2(requireNonNull(Client.localPlayer).z);
                            Client.out.p1(Client.tryMoveNearest);
                            Client.out.p1(63);
                        }
                    }
                    break;
                }
                case MinimenuOps.OPPLAYER4: {
                    const actor = arrayAtObj(Client.players, id);
                    if (actor !== null) {
                        if (glJar) {
                            RouteFinding.FindRouteHd(
                                arrayAtI32(requireNonNull(Client.localPlayer).pathZ, 0),
                                0,
                                1,
                                false,
                                0,
                                2,
                                arrayAtI32(actor.pathX, 0),
                                1,
                                0,
                                2,
                                arrayAtI32(actor.pathZ, 0),
                                arrayAtI32(requireNonNull(Client.localPlayer).pathX, 0)
                            );
                        } else {
                            RouteFinding.FindRoute(1, arrayAtI32(actor.pathZ, 0), arrayAtI32(actor.pathX, 0), 1, false, 0, 0, arrayAtI32(requireNonNull(Client.localPlayer).pathZ, 0), 0, 2, arrayAtI32(requireNonNull(Client.localPlayer).pathX, 0));
                        }
                        Minimenu.crossY = ClientMouseListener.clickY;
                        if (glJar) {
                            Minimenu.crossTicks = 0;
                            Minimenu.crossMode = 2;
                            Minimenu.crossX = ClientMouseListener.clickX;
                        } else {
                            Minimenu.crossMode = 2;
                            Minimenu.crossX = ClientMouseListener.clickX;
                            Minimenu.crossTicks = 0;
                        }
                        Client.out.pHead(180);
                        Client.out.p2_alt3(id);
                    }
                    break;
                }
                case MinimenuOps.EXAMINE_OBJ: {
                    if (glJar) {
                        Minimenu.crossMode = 2;
                        Minimenu.crossX = ClientMouseListener.clickX;
                        Minimenu.crossY = ClientMouseListener.clickY;
                        Minimenu.crossTicks = 0;
                    } else {
                        Minimenu.crossY = ClientMouseListener.clickY;
                        Minimenu.crossTicks = 0;
                        Minimenu.crossMode = 2;
                        Minimenu.crossX = ClientMouseListener.clickX;
                    }
                    Client.out.pHead(92);
                    Client.out.p2_alt3(id);
                    break;
                }
                case MinimenuOps.OPPLAYER5: {
                    const actor = arrayAtObj(Client.players, id);
                    if (actor !== null) {
                        if (glJar) {
                            RouteFinding.FindRouteHd(
                                arrayAtI32(requireNonNull(Client.localPlayer).pathZ, 0),
                                0,
                                1,
                                false,
                                0,
                                2,
                                arrayAtI32(actor.pathX, 0),
                                1,
                                0,
                                2,
                                arrayAtI32(actor.pathZ, 0),
                                arrayAtI32(requireNonNull(Client.localPlayer).pathX, 0)
                            );
                        } else {
                            RouteFinding.FindRoute(1, arrayAtI32(actor.pathZ, 0), arrayAtI32(actor.pathX, 0), 1, false, 0, 0, arrayAtI32(requireNonNull(Client.localPlayer).pathZ, 0), 0, 2, arrayAtI32(requireNonNull(Client.localPlayer).pathX, 0));
                        }
                        if (glJar) {
                            Minimenu.crossMode = 2;
                            Minimenu.crossY = ClientMouseListener.clickY;
                            Minimenu.crossX = ClientMouseListener.clickX;
                        } else {
                            Minimenu.crossX = ClientMouseListener.clickX;
                            Minimenu.crossY = ClientMouseListener.clickY;
                            Minimenu.crossMode = 2;
                        }
                        Minimenu.crossTicks = 0;
                        Client.out.pHead(4);
                        Client.out.p2_alt1(id);
                    }
                    break;
                }
                case MinimenuOps.OPNPC2: {
                    const actor = arrayAtObj(Client.npcs, id);
                    if (actor !== null) {
                        if (glJar) {
                            RouteFinding.FindRouteHd(
                                arrayAtI32(requireNonNull(Client.localPlayer).pathZ, 0),
                                0,
                                1,
                                false,
                                0,
                                2,
                                arrayAtI32(actor.pathX, 0),
                                1,
                                0,
                                2,
                                arrayAtI32(actor.pathZ, 0),
                                arrayAtI32(requireNonNull(Client.localPlayer).pathX, 0)
                            );
                        } else {
                            RouteFinding.FindRoute(1, arrayAtI32(actor.pathZ, 0), arrayAtI32(actor.pathX, 0), 1, false, 0, 0, arrayAtI32(requireNonNull(Client.localPlayer).pathZ, 0), 0, 2, arrayAtI32(requireNonNull(Client.localPlayer).pathX, 0));
                        }
                        if (glJar) {
                            Minimenu.crossX = ClientMouseListener.clickX;
                            Minimenu.crossTicks = 0;
                            Minimenu.crossY = ClientMouseListener.clickY;
                            Minimenu.crossMode = 2;
                        } else {
                            Minimenu.crossY = ClientMouseListener.clickY;
                            Minimenu.crossX = ClientMouseListener.clickX;
                            Minimenu.crossMode = 2;
                            Minimenu.crossTicks = 0;
                        }
                        Client.out.pHead(3);
                        Client.out.p2_alt3(id);
                    }
                    break;
                }
                case MinimenuOps.OPLOC5: {
                    Client.interactWithLoc(key, slotOrX, componentOrZ);
                    Client.out.pHead(170);
                    Client.out.p2_alt3(Number((key >> 32n) & 0x7fffffffn));
                    Client.out.p2_alt3((slotOrX + Client.mapBuildBaseX) | 0);
                    Client.out.p2_alt3((componentOrZ + Client.mapBuildBaseZ) | 0);
                    break;
                }
                case MinimenuOps.OPOBJ2: {
                    if (GameVariant.id === 1) {
                        RouteFinding.FindRoute(1, componentOrZ, slotOrX, 1, false, 0, 0, arrayAtI32(requireNonNull(Client.localPlayer).pathZ, 0), 0, 2, arrayAtI32(requireNonNull(Client.localPlayer).pathX, 0));
                    } else if (!RouteFinding.FindRoute(0, componentOrZ, slotOrX, 0, false, 0, 0, arrayAtI32(requireNonNull(Client.localPlayer).pathZ, 0), 0, 2, arrayAtI32(requireNonNull(Client.localPlayer).pathX, 0))) {
                        RouteFinding.FindRoute(1, componentOrZ, slotOrX, 1, false, 0, 0, arrayAtI32(requireNonNull(Client.localPlayer).pathZ, 0), 0, 2, arrayAtI32(requireNonNull(Client.localPlayer).pathX, 0));
                    }
                    if (glJar) {
                        Minimenu.crossX = ClientMouseListener.clickX;
                        Minimenu.crossMode = 2;
                        Minimenu.crossY = ClientMouseListener.clickY;
                        Minimenu.crossTicks = 0;
                    } else {
                        Minimenu.crossY = ClientMouseListener.clickY;
                        Minimenu.crossMode = 2;
                        Minimenu.crossX = ClientMouseListener.clickX;
                        Minimenu.crossTicks = 0;
                    }
                    Client.out.pHead(109);
                    Client.out.p2_alt1((componentOrZ + Client.mapBuildBaseZ) | 0);
                    Client.out.p2((slotOrX + Client.mapBuildBaseX) | 0);
                    Client.out.p2_alt3(id);
                    break;
                }
                case MinimenuOps.OPHELD2: {
                    Client.out.pHead(55);
                    Client.out.p2_alt1(id);
                    Client.out.p2_alt2(slotOrX);
                    Client.out.p4_alt2(componentOrZ);
                    Minimenu.highlightTicks = 0;
                    Minimenu.highlightComponent = IfType.Get(componentOrZ);
                    Minimenu.highlightSlot = slotOrX;
                    break;
                }
                case MinimenuOps.INV_BUTTON3: {
                    Client.out.pHead(154);
                    Client.out.p2_alt1(slotOrX);
                    Client.out.p4_alt2(componentOrZ);
                    Client.out.p2_alt3(id);
                    Minimenu.highlightTicks = 0;
                    Minimenu.highlightComponent = IfType.Get(componentOrZ);
                    Minimenu.highlightSlot = slotOrX;
                    break;
                }
                case MinimenuOps.IF_TOGGLE: {
                    Client.out.pHead(10);
                    Client.out.p4(componentOrZ);
                    const component = requireNonNull(IfType.Get(componentOrZ));
                    if (component.scripts !== null && arrayAtI32(arrayAtObj(component.scripts, 0), 0) === 5) {
                        const varp = arrayAtI32(arrayAtObj(component.scripts, 0), 1);
                        arrayPutI32(ClientVarCache.m_var, varp, (1 - arrayAtI32(ClientVarCache.m_var, varp)) | 0);
                        Client.ClientVar(varp);
                    }
                    break;
                }
                case MinimenuOps.OPNPCT: {
                    const actor = arrayAtObj(Client.npcs, id);
                    if (actor !== null) {
                        if (glJar) {
                            RouteFinding.FindRouteHd(
                                arrayAtI32(requireNonNull(Client.localPlayer).pathZ, 0),
                                0,
                                1,
                                false,
                                0,
                                2,
                                arrayAtI32(actor.pathX, 0),
                                1,
                                0,
                                2,
                                arrayAtI32(actor.pathZ, 0),
                                arrayAtI32(requireNonNull(Client.localPlayer).pathX, 0)
                            );
                        } else {
                            RouteFinding.FindRoute(1, arrayAtI32(actor.pathZ, 0), arrayAtI32(actor.pathX, 0), 1, false, 0, 0, arrayAtI32(requireNonNull(Client.localPlayer).pathZ, 0), 0, 2, arrayAtI32(requireNonNull(Client.localPlayer).pathX, 0));
                        }
                        if (glJar) {
                            Minimenu.crossX = ClientMouseListener.clickX;
                            Minimenu.crossMode = 2;
                            Minimenu.crossTicks = 0;
                            Minimenu.crossY = ClientMouseListener.clickY;
                        } else {
                            Minimenu.crossTicks = 0;
                            Minimenu.crossMode = 2;
                            Minimenu.crossY = ClientMouseListener.clickY;
                            Minimenu.crossX = ClientMouseListener.clickX;
                        }
                        Client.out.pHead(239);
                        Client.out.p4_alt1(Minimenu.targetComponent);
                        Client.out.p2_alt2(Minimenu.targetChild);
                        Client.out.p2_alt3(id);
                    }
                    break;
                }
                case MinimenuOps.OPOBJ3: {
                    if (GameVariant.id === 1) {
                        RouteFinding.FindRoute(1, componentOrZ, slotOrX, 1, false, 0, 0, arrayAtI32(requireNonNull(Client.localPlayer).pathZ, 0), 0, 2, arrayAtI32(requireNonNull(Client.localPlayer).pathX, 0));
                    } else if (!RouteFinding.FindRoute(0, componentOrZ, slotOrX, 0, false, 0, 0, arrayAtI32(requireNonNull(Client.localPlayer).pathZ, 0), 0, 2, arrayAtI32(requireNonNull(Client.localPlayer).pathX, 0))) {
                        RouteFinding.FindRoute(1, componentOrZ, slotOrX, 1, false, 0, 0, arrayAtI32(requireNonNull(Client.localPlayer).pathZ, 0), 0, 2, arrayAtI32(requireNonNull(Client.localPlayer).pathX, 0));
                    }
                    if (glJar) {
                        Minimenu.crossX = ClientMouseListener.clickX;
                        Minimenu.crossTicks = 0;
                        Minimenu.crossMode = 2;
                        Minimenu.crossY = ClientMouseListener.clickY;
                    } else {
                        Minimenu.crossY = ClientMouseListener.clickY;
                        Minimenu.crossX = ClientMouseListener.clickX;
                        Minimenu.crossMode = 2;
                        Minimenu.crossTicks = 0;
                    }
                    Client.out.pHead(66);
                    Client.out.p2_alt1((slotOrX + Client.mapBuildBaseX) | 0);
                    Client.out.p2(id);
                    Client.out.p2_alt3((componentOrZ + Client.mapBuildBaseZ) | 0);
                    break;
                }
                case MinimenuOps.IF_BUTTONX_LOW_PRIORITY:
                case MinimenuOps.IF_BUTTONX: {
                    const pressed = Client.IfButtonX(arrayAtObj(Minimenu.target, index), slotOrX, componentOrZ, id, ui?.runner);
                    if (pressed instanceof Promise) yield pressed;
                    break;
                }
                case MinimenuOps.OPPLAYER1: {
                    const actor = arrayAtObj(Client.players, id);
                    if (actor !== null) {
                        if (glJar) {
                            RouteFinding.FindRouteHd(
                                arrayAtI32(requireNonNull(Client.localPlayer).pathZ, 0),
                                0,
                                1,
                                false,
                                0,
                                2,
                                arrayAtI32(actor.pathX, 0),
                                1,
                                0,
                                2,
                                arrayAtI32(actor.pathZ, 0),
                                arrayAtI32(requireNonNull(Client.localPlayer).pathX, 0)
                            );
                        } else {
                            RouteFinding.FindRoute(1, arrayAtI32(actor.pathZ, 0), arrayAtI32(actor.pathX, 0), 1, false, 0, 0, arrayAtI32(requireNonNull(Client.localPlayer).pathZ, 0), 0, 2, arrayAtI32(requireNonNull(Client.localPlayer).pathX, 0));
                        }
                        if (glJar) {
                            Minimenu.crossTicks = 0;
                            Minimenu.crossX = ClientMouseListener.clickX;
                            Minimenu.crossY = ClientMouseListener.clickY;
                            Minimenu.crossMode = 2;
                        } else {
                            Minimenu.crossMode = 2;
                            Minimenu.crossX = ClientMouseListener.clickX;
                            Minimenu.crossTicks = 0;
                            Minimenu.crossY = ClientMouseListener.clickY;
                        }
                        Client.out.pHead(68);
                        Client.out.p2_alt3(id);
                    }
                    break;
                }
                case MinimenuOps.SELECT_OBJ: {
                    const ended = Minimenu.EndTargetMode(ui?.runner);
                    if (ended instanceof Promise) yield ended;
                    const component = IfType.Get(componentOrZ);
                    if (glJar) {
                        Minimenu.objComponent = componentOrZ;
                        Minimenu.objSlot = slotOrX;
                        Minimenu.objSelected = 1;
                        Minimenu.objId = id;
                    } else {
                        Minimenu.objId = id;
                        Minimenu.objSelected = 1;
                        Minimenu.objSlot = slotOrX;
                        Minimenu.objComponent = componentOrZ;
                    }
                    Client.ComponentUpdated(requireNonNull(component));
                    Minimenu.objName = JagString.join([Minimenu.orange, ObjType.List(id).name, Minimenu.white]);
                    if (Minimenu.objName === null) Minimenu.objName = JagString.nullString;
                    return;
                }
                case MinimenuOps.EXAMINE_NPC: {
                    if (glJar) {
                        Minimenu.crossTicks = 0;
                        Minimenu.crossMode = 2;
                        Minimenu.crossY = ClientMouseListener.clickY;
                        Minimenu.crossX = ClientMouseListener.clickX;
                    } else {
                        Minimenu.crossMode = 2;
                        Minimenu.crossY = ClientMouseListener.clickY;
                        Minimenu.crossX = ClientMouseListener.clickX;
                        Minimenu.crossTicks = 0;
                    }
                    const actor = arrayAtObj(Client.npcs, id);
                    if (actor !== null) {
                        let type: NpcType | null = requireNonNull(actor.npcType);
                        if (type.multi !== null) type = type.GetMultiNpc();
                        if (type !== null) {
                            Client.out.pHead(72);
                            Client.out.p2(type.id);
                        }
                    }
                    break;
                }
                case MinimenuOps.OPLOCU: {
                    if (!Client.interactWithLoc(key, slotOrX, componentOrZ)) break;
                    Client.out.pHead(134);
                    Client.out.p2_alt2((slotOrX + Client.mapBuildBaseX) | 0);
                    Client.out.p2(Minimenu.objId);
                    Client.out.p2_alt1((componentOrZ + Client.mapBuildBaseZ) | 0);
                    Client.out.p2(Minimenu.objSlot);
                    Client.out.p4_alt3(Minimenu.objComponent);
                    Client.out.p2_alt2(Number((key >> 32n) & 0x7fffffffn));
                    break;
                }
                case MinimenuOps.OPOBJU: {
                    if (!RouteFinding.FindRoute(0, componentOrZ, slotOrX, 0, false, 0, 0, arrayAtI32(requireNonNull(Client.localPlayer).pathZ, 0), 0, 2, arrayAtI32(requireNonNull(Client.localPlayer).pathX, 0))) {
                        RouteFinding.FindRoute(1, componentOrZ, slotOrX, 1, false, 0, 0, arrayAtI32(requireNonNull(Client.localPlayer).pathZ, 0), 0, 2, arrayAtI32(requireNonNull(Client.localPlayer).pathX, 0));
                    }
                    if (glJar) {
                        Minimenu.crossX = ClientMouseListener.clickX;
                        Minimenu.crossTicks = 0;
                        Minimenu.crossY = ClientMouseListener.clickY;
                        Minimenu.crossMode = 2;
                    } else {
                        Minimenu.crossMode = 2;
                        Minimenu.crossTicks = 0;
                        Minimenu.crossX = ClientMouseListener.clickX;
                        Minimenu.crossY = ClientMouseListener.clickY;
                    }
                    Client.out.pHead(101);
                    Client.out.p2_alt3((slotOrX + Client.mapBuildBaseX) | 0);
                    Client.out.p2_alt1(Minimenu.objSlot);
                    Client.out.p2_alt1(Minimenu.objId);
                    Client.out.p2_alt1(id);
                    Client.out.p2_alt3((componentOrZ + Client.mapBuildBaseZ) | 0);
                    Client.out.p4_alt3(Minimenu.objComponent);
                    break;
                }
                case MinimenuOps.OPPLAYER3: {
                    const actor = arrayAtObj(Client.players, id);
                    if (actor !== null) {
                        if (glJar) {
                            RouteFinding.FindRouteHd(
                                arrayAtI32(requireNonNull(Client.localPlayer).pathZ, 0),
                                0,
                                1,
                                false,
                                0,
                                2,
                                arrayAtI32(actor.pathX, 0),
                                1,
                                0,
                                2,
                                arrayAtI32(actor.pathZ, 0),
                                arrayAtI32(requireNonNull(Client.localPlayer).pathX, 0)
                            );
                        } else {
                            RouteFinding.FindRoute(1, arrayAtI32(actor.pathZ, 0), arrayAtI32(actor.pathX, 0), 1, false, 0, 0, arrayAtI32(requireNonNull(Client.localPlayer).pathZ, 0), 0, 2, arrayAtI32(requireNonNull(Client.localPlayer).pathX, 0));
                        }
                        if (glJar) {
                            Minimenu.crossMode = 2;
                            Minimenu.crossTicks = 0;
                            Minimenu.crossX = ClientMouseListener.clickX;
                            Minimenu.crossY = ClientMouseListener.clickY;
                        } else {
                            Minimenu.crossX = ClientMouseListener.clickX;
                            Minimenu.crossY = ClientMouseListener.clickY;
                            Minimenu.crossMode = 2;
                            Minimenu.crossTicks = 0;
                        }
                        Client.out.pHead(71);
                        Client.out.p2_alt3(id);
                    }
                    break;
                }
                case MinimenuOps.OPPLAYER8: {
                    const actor = arrayAtObj(Client.players, id);
                    if (actor !== null) {
                        if (glJar) {
                            RouteFinding.FindRouteHd(
                                arrayAtI32(requireNonNull(Client.localPlayer).pathZ, 0),
                                0,
                                1,
                                false,
                                0,
                                2,
                                arrayAtI32(actor.pathX, 0),
                                1,
                                0,
                                2,
                                arrayAtI32(actor.pathZ, 0),
                                arrayAtI32(requireNonNull(Client.localPlayer).pathX, 0)
                            );
                        } else {
                            RouteFinding.FindRoute(1, arrayAtI32(actor.pathZ, 0), arrayAtI32(actor.pathX, 0), 1, false, 0, 0, arrayAtI32(requireNonNull(Client.localPlayer).pathZ, 0), 0, 2, arrayAtI32(requireNonNull(Client.localPlayer).pathX, 0));
                        }
                        if (glJar) {
                            Minimenu.crossMode = 2;
                            Minimenu.crossY = ClientMouseListener.clickY;
                            Minimenu.crossX = ClientMouseListener.clickX;
                            Minimenu.crossTicks = 0;
                        } else {
                            Minimenu.crossY = ClientMouseListener.clickY;
                            Minimenu.crossTicks = 0;
                            Minimenu.crossX = ClientMouseListener.clickX;
                            Minimenu.crossMode = 2;
                        }
                        Client.out.pHead(175);
                        Client.out.p2_alt2(id);
                    }
                    break;
                }
                case MinimenuOps.OPNPC4: {
                    const actor = arrayAtObj(Client.npcs, id);
                    if (actor !== null) {
                        if (glJar) {
                            RouteFinding.FindRouteHd(
                                arrayAtI32(requireNonNull(Client.localPlayer).pathZ, 0),
                                0,
                                1,
                                false,
                                0,
                                2,
                                arrayAtI32(actor.pathX, 0),
                                1,
                                0,
                                2,
                                arrayAtI32(actor.pathZ, 0),
                                arrayAtI32(requireNonNull(Client.localPlayer).pathX, 0)
                            );
                        } else {
                            RouteFinding.FindRoute(1, arrayAtI32(actor.pathZ, 0), arrayAtI32(actor.pathX, 0), 1, false, 0, 0, arrayAtI32(requireNonNull(Client.localPlayer).pathZ, 0), 0, 2, arrayAtI32(requireNonNull(Client.localPlayer).pathX, 0));
                        }
                        Minimenu.crossX = ClientMouseListener.clickX;
                        if (glJar) {
                            Minimenu.crossMode = 2;
                            Minimenu.crossTicks = 0;
                            Minimenu.crossY = ClientMouseListener.clickY;
                        } else {
                            Minimenu.crossTicks = 0;
                            Minimenu.crossY = ClientMouseListener.clickY;
                            Minimenu.crossMode = 2;
                        }
                        Client.out.pHead(30);
                        Client.out.p2(id);
                    }
                    break;
                }
                case MinimenuOps.IF_BUTTON: {
                    let send = true;
                    const component = requireNonNull(IfType.Get(componentOrZ));
                    if (component.clientCode > 0) send = Client.ClientButton(component);
                    if (send) {
                        Client.out.pHead(10);
                        Client.out.p4(componentOrZ);
                    }
                    break;
                }
                case MinimenuOps.OPHELDU: {
                    Client.out.pHead(27);
                    Client.out.p2(Minimenu.objSlot);
                    Client.out.p4_alt1(componentOrZ);
                    Client.out.p2_alt1(slotOrX);
                    Client.out.p4_alt1(Minimenu.objComponent);
                    Client.out.p2_alt3(Minimenu.objId);
                    Client.out.p2_alt3(id);
                    Minimenu.highlightTicks = 0;
                    Minimenu.highlightComponent = IfType.Get(componentOrZ);
                    Minimenu.highlightSlot = slotOrX;
                    break;
                }
                case MinimenuOps.OPHELDT: {
                    Client.out.pHead(253);
                    Client.out.p4_alt1(Minimenu.targetComponent);
                    Client.out.p2_alt3(slotOrX);
                    Client.out.p4_alt1(componentOrZ);
                    Client.out.p2_alt2(id);
                    Client.out.p2_alt1(Minimenu.targetChild);
                    Minimenu.highlightTicks = 0;
                    Minimenu.highlightComponent = IfType.Get(componentOrZ);
                    Minimenu.highlightSlot = slotOrX;
                    break;
                }
                case MinimenuOps.OPNPCU: {
                    const actor = arrayAtObj(Client.npcs, id);
                    if (actor !== null) {
                        if (glJar) {
                            RouteFinding.FindRouteHd(
                                arrayAtI32(requireNonNull(Client.localPlayer).pathZ, 0),
                                0,
                                1,
                                false,
                                0,
                                2,
                                arrayAtI32(actor.pathX, 0),
                                1,
                                0,
                                2,
                                arrayAtI32(actor.pathZ, 0),
                                arrayAtI32(requireNonNull(Client.localPlayer).pathX, 0)
                            );
                        } else {
                            RouteFinding.FindRoute(1, arrayAtI32(actor.pathZ, 0), arrayAtI32(actor.pathX, 0), 1, false, 0, 0, arrayAtI32(requireNonNull(Client.localPlayer).pathZ, 0), 0, 2, arrayAtI32(requireNonNull(Client.localPlayer).pathX, 0));
                        }
                        if (glJar) {
                            Minimenu.crossMode = 2;
                            Minimenu.crossTicks = 0;
                            Minimenu.crossY = ClientMouseListener.clickY;
                            Minimenu.crossX = ClientMouseListener.clickX;
                        } else {
                            Minimenu.crossY = ClientMouseListener.clickY;
                            Minimenu.crossTicks = 0;
                            Minimenu.crossX = ClientMouseListener.clickX;
                            Minimenu.crossMode = 2;
                        }
                        Client.out.pHead(115);
                        Client.out.p4_alt3(Minimenu.objComponent);
                        Client.out.p2_alt1(Minimenu.objSlot);
                        Client.out.p2_alt1(id);
                        Client.out.p2_alt3(Minimenu.objId);
                    }
                    break;
                }
                case MinimenuOps.OPNPC1: {
                    const actor = arrayAtObj(Client.npcs, id);
                    if (actor !== null) {
                        if (glJar) {
                            RouteFinding.FindRouteHd(
                                arrayAtI32(requireNonNull(Client.localPlayer).pathZ, 0),
                                0,
                                1,
                                false,
                                0,
                                2,
                                arrayAtI32(actor.pathX, 0),
                                1,
                                0,
                                2,
                                arrayAtI32(actor.pathZ, 0),
                                arrayAtI32(requireNonNull(Client.localPlayer).pathX, 0)
                            );
                        } else {
                            RouteFinding.FindRoute(1, arrayAtI32(actor.pathZ, 0), arrayAtI32(actor.pathX, 0), 1, false, 0, 0, arrayAtI32(requireNonNull(Client.localPlayer).pathZ, 0), 0, 2, arrayAtI32(requireNonNull(Client.localPlayer).pathX, 0));
                        }
                        if (glJar) {
                            Minimenu.crossX = ClientMouseListener.clickX;
                            Minimenu.crossTicks = 0;
                            Minimenu.crossMode = 2;
                            Minimenu.crossY = ClientMouseListener.clickY;
                        } else {
                            Minimenu.crossMode = 2;
                            Minimenu.crossTicks = 0;
                            Minimenu.crossY = ClientMouseListener.clickY;
                            Minimenu.crossX = ClientMouseListener.clickX;
                        }
                        Client.out.pHead(78);
                        Client.out.p2_alt1(id);
                    }
                    break;
                }
                case MinimenuOps.TARGET_GROUND: {
                    if (id === 0) {
                        Client.targetTileState = 1;
                        world.updateMousePicking(Client.playerLevel, slotOrX, componentOrZ);
                    } else if (id === 1) {
                        Client.out.pHead(131);
                        Client.out.p4_alt3(Minimenu.targetComponent);
                        Client.out.p2_alt2((slotOrX + Client.mapBuildBaseX) | 0);
                        Client.out.p2_alt3(Minimenu.targetChild);
                        Client.out.p2_alt2((componentOrZ + Client.mapBuildBaseZ) | 0);
                    }
                    break;
                }
                case MinimenuOps.OPOBJ1: {
                    if (GameVariant.id === 1) {
                        RouteFinding.FindRoute(1, componentOrZ, slotOrX, 1, false, 0, 0, arrayAtI32(requireNonNull(Client.localPlayer).pathZ, 0), 0, 2, arrayAtI32(requireNonNull(Client.localPlayer).pathX, 0));
                    } else if (!RouteFinding.FindRoute(0, componentOrZ, slotOrX, 0, false, 0, 0, arrayAtI32(requireNonNull(Client.localPlayer).pathZ, 0), 0, 2, arrayAtI32(requireNonNull(Client.localPlayer).pathX, 0))) {
                        RouteFinding.FindRoute(1, componentOrZ, slotOrX, 1, false, 0, 0, arrayAtI32(requireNonNull(Client.localPlayer).pathZ, 0), 0, 2, arrayAtI32(requireNonNull(Client.localPlayer).pathX, 0));
                    }
                    if (glJar) {
                        Minimenu.crossMode = 2;
                        Minimenu.crossX = ClientMouseListener.clickX;
                        Minimenu.crossTicks = 0;
                        Minimenu.crossY = ClientMouseListener.clickY;
                    } else {
                        Minimenu.crossY = ClientMouseListener.clickY;
                        Minimenu.crossX = ClientMouseListener.clickX;
                        Minimenu.crossMode = 2;
                        Minimenu.crossTicks = 0;
                    }
                    Client.out.pHead(228);
                    Client.out.p2(id);
                    Client.out.p2_alt1((slotOrX + Client.mapBuildBaseX) | 0);
                    Client.out.p2_alt3((componentOrZ + Client.mapBuildBaseZ) | 0);
                    break;
                }
                case MinimenuOps.EXAMINE_LOC: {
                    Minimenu.crossTicks = 0;
                    if (glJar) {
                        Minimenu.crossX = ClientMouseListener.clickX;
                        Minimenu.crossMode = 2;
                        Minimenu.crossY = ClientMouseListener.clickY;
                    } else {
                        Minimenu.crossMode = 2;
                        Minimenu.crossY = ClientMouseListener.clickY;
                        Minimenu.crossX = ClientMouseListener.clickX;
                    }
                    Client.out.pHead(94);
                    Client.out.p2_alt3(id);
                    break;
                }
                case MinimenuOps.OPOBJT: {
                    if (!RouteFinding.FindRoute(0, componentOrZ, slotOrX, 0, false, 0, 0, arrayAtI32(requireNonNull(Client.localPlayer).pathZ, 0), 0, 2, arrayAtI32(requireNonNull(Client.localPlayer).pathX, 0))) {
                        RouteFinding.FindRoute(1, componentOrZ, slotOrX, 1, false, 0, 0, arrayAtI32(requireNonNull(Client.localPlayer).pathZ, 0), 0, 2, arrayAtI32(requireNonNull(Client.localPlayer).pathX, 0));
                    }
                    if (glJar) {
                        Minimenu.crossY = ClientMouseListener.clickY;
                        Minimenu.crossX = ClientMouseListener.clickX;
                        Minimenu.crossMode = 2;
                        Minimenu.crossTicks = 0;
                    } else {
                        Minimenu.crossX = ClientMouseListener.clickX;
                        Minimenu.crossMode = 2;
                        Minimenu.crossTicks = 0;
                        Minimenu.crossY = ClientMouseListener.clickY;
                    }
                    Client.out.pHead(73);
                    Client.out.p4_alt2(Minimenu.targetComponent);
                    Client.out.p2((componentOrZ + Client.mapBuildBaseZ) | 0);
                    Client.out.p2_alt3(id);
                    Client.out.p2_alt3((slotOrX + Client.mapBuildBaseX) | 0);
                    Client.out.p2_alt1(Minimenu.targetChild);
                    break;
                }
                case MinimenuOps.OPHELD5: {
                    Client.out.pHead(135);
                    Client.out.p2_alt2(id);
                    Client.out.p2_alt2(slotOrX);
                    Client.out.p4_alt3(componentOrZ);
                    Minimenu.highlightTicks = 0;
                    Minimenu.highlightComponent = IfType.Get(componentOrZ);
                    Minimenu.highlightSlot = slotOrX;
                    break;
                }
                case MinimenuOps.INV_BUTTON1: {
                    Client.out.pHead(81);
                    Client.out.p2_alt2(slotOrX);
                    Client.out.p2(id);
                    Client.out.p4_alt2(componentOrZ);
                    Minimenu.highlightTicks = 0;
                    Minimenu.highlightComponent = IfType.Get(componentOrZ);
                    Minimenu.highlightSlot = slotOrX;
                    break;
                }
                case MinimenuOps.OPPLAYERU: {
                    const actor = arrayAtObj(Client.players, id);
                    if (actor !== null) {
                        if (glJar) {
                            RouteFinding.FindRouteHd(
                                arrayAtI32(requireNonNull(Client.localPlayer).pathZ, 0),
                                0,
                                1,
                                false,
                                0,
                                2,
                                arrayAtI32(actor.pathX, 0),
                                1,
                                0,
                                2,
                                arrayAtI32(actor.pathZ, 0),
                                arrayAtI32(requireNonNull(Client.localPlayer).pathX, 0)
                            );
                        } else {
                            RouteFinding.FindRoute(1, arrayAtI32(actor.pathZ, 0), arrayAtI32(actor.pathX, 0), 1, false, 0, 0, arrayAtI32(requireNonNull(Client.localPlayer).pathZ, 0), 0, 2, arrayAtI32(requireNonNull(Client.localPlayer).pathX, 0));
                        }
                        Minimenu.crossTicks = 0;
                        Minimenu.crossY = ClientMouseListener.clickY;
                        if (glJar) {
                            Minimenu.crossMode = 2;
                            Minimenu.crossX = ClientMouseListener.clickX;
                        } else {
                            Minimenu.crossX = ClientMouseListener.clickX;
                            Minimenu.crossMode = 2;
                        }
                        Client.out.pHead(248);
                        Client.out.p2_alt3(id);
                        Client.out.p2(Minimenu.objId);
                        Client.out.p2(Minimenu.objSlot);
                        Client.out.p4_alt3(Minimenu.objComponent);
                    }
                    break;
                }
                case MinimenuOps.EXAMINE_HELD: {
                    const component = IfType.Get(componentOrZ);
                    if (component === null || arrayAtI32(component.itemCounts, slotOrX) < 100000) {
                        Client.out.pHead(92);
                        Client.out.p2_alt3(id);
                    } else {
                        Client.AddChat(JagString.join([JagString.fromInt(arrayAtI32(component.itemCounts, slotOrX)), Minimenu.countSeparator, ObjType.List(id).name]), JagString.empty, 0);
                    }
                    Minimenu.highlightTicks = 0;
                    Minimenu.highlightComponent = IfType.Get(componentOrZ);
                    Minimenu.highlightSlot = slotOrX;
                    break;
                }
                case MinimenuOps.OPPLAYER6: {
                    const actor = arrayAtObj(Client.players, id);
                    if (actor !== null) {
                        if (glJar) {
                            RouteFinding.FindRouteHd(
                                arrayAtI32(requireNonNull(Client.localPlayer).pathZ, 0),
                                0,
                                1,
                                false,
                                0,
                                2,
                                arrayAtI32(actor.pathX, 0),
                                1,
                                0,
                                2,
                                arrayAtI32(actor.pathZ, 0),
                                arrayAtI32(requireNonNull(Client.localPlayer).pathX, 0)
                            );
                        } else {
                            RouteFinding.FindRoute(1, arrayAtI32(actor.pathZ, 0), arrayAtI32(actor.pathX, 0), 1, false, 0, 0, arrayAtI32(requireNonNull(Client.localPlayer).pathZ, 0), 0, 2, arrayAtI32(requireNonNull(Client.localPlayer).pathX, 0));
                        }
                        if (glJar) {
                            Minimenu.crossX = ClientMouseListener.clickX;
                            Minimenu.crossMode = 2;
                            Minimenu.crossY = ClientMouseListener.clickY;
                            Minimenu.crossTicks = 0;
                        } else {
                            Minimenu.crossTicks = 0;
                            Minimenu.crossMode = 2;
                            Minimenu.crossX = ClientMouseListener.clickX;
                            Minimenu.crossY = ClientMouseListener.clickY;
                        }
                        Client.out.pHead(133);
                        Client.out.p2_alt1(id);
                    }
                    break;
                }
                case MinimenuOps.OPPLAYER2: {
                    const actor = arrayAtObj(Client.players, id);
                    if (actor !== null) {
                        if (glJar) {
                            RouteFinding.FindRouteHd(
                                arrayAtI32(requireNonNull(Client.localPlayer).pathZ, 0),
                                0,
                                1,
                                false,
                                0,
                                2,
                                arrayAtI32(actor.pathX, 0),
                                1,
                                0,
                                2,
                                arrayAtI32(actor.pathZ, 0),
                                arrayAtI32(requireNonNull(Client.localPlayer).pathX, 0)
                            );
                        } else {
                            RouteFinding.FindRoute(1, arrayAtI32(actor.pathZ, 0), arrayAtI32(actor.pathX, 0), 1, false, 0, 0, arrayAtI32(requireNonNull(Client.localPlayer).pathZ, 0), 0, 2, arrayAtI32(requireNonNull(Client.localPlayer).pathX, 0));
                        }
                        Minimenu.crossY = ClientMouseListener.clickY;
                        Minimenu.crossTicks = 0;
                        Minimenu.crossMode = 2;
                        Minimenu.crossX = ClientMouseListener.clickX;
                        Client.out.pHead(106);
                        Client.out.p2(id);
                    }
                    break;
                }
                case MinimenuOps.SELECT_TARGET: {
                    const component = InterfaceList.GetComponent(componentOrZ, slotOrX);
                    if (component === null) return;
                    const ended = Minimenu.EndTargetMode(ui?.runner);
                    if (ended instanceof Promise) yield ended;
                    const props = Client.GetActive(component);
                    let entered: void | Promise<void>;
                    if (glJar) {
                        const flags = props.getTargetMask();
                        const param = props.targetParam;
                        const cursor = component.targetOverCursor;
                        entered = Minimenu.EnterTargetMode(component.targetLeaveCursor, slotOrX, cursor, componentOrZ, param, flags, ui?.runner);
                    } else {
                        entered = Minimenu.EnterTargetMode(component.targetLeaveCursor, slotOrX, component.targetOverCursor, componentOrZ, props.targetParam, props.getTargetMask(), ui?.runner);
                    }
                    if (entered instanceof Promise) yield entered;
                    Minimenu.objSelected = 0;
                    Minimenu.targetVerb = Client.TargetVerb(component);
                    if (Minimenu.targetVerb === null) Minimenu.targetVerb = Minimenu.nullTargetVerb;
                    if (!component.if3) {
                        Minimenu.targetName = JagString.join([Minimenu.green, component.targetTextValue, Minimenu.white]);
                        return;
                    }
                    Minimenu.targetName = JagString.join([component.opBaseValue, Minimenu.white]);
                    return;
                }
                case MinimenuOps.OPNPC5: {
                    const actor = arrayAtObj(Client.npcs, id);
                    if (actor !== null) {
                        if (glJar) {
                            RouteFinding.FindRouteHd(
                                arrayAtI32(requireNonNull(Client.localPlayer).pathZ, 0),
                                0,
                                1,
                                false,
                                0,
                                2,
                                arrayAtI32(actor.pathX, 0),
                                1,
                                0,
                                2,
                                arrayAtI32(actor.pathZ, 0),
                                arrayAtI32(requireNonNull(Client.localPlayer).pathX, 0)
                            );
                        } else {
                            RouteFinding.FindRoute(1, arrayAtI32(actor.pathZ, 0), arrayAtI32(actor.pathX, 0), 1, false, 0, 0, arrayAtI32(requireNonNull(Client.localPlayer).pathZ, 0), 0, 2, arrayAtI32(requireNonNull(Client.localPlayer).pathX, 0));
                        }
                        if (glJar) {
                            Minimenu.crossY = ClientMouseListener.clickY;
                            Minimenu.crossMode = 2;
                            Minimenu.crossX = ClientMouseListener.clickX;
                            Minimenu.crossTicks = 0;
                        } else {
                            Minimenu.crossX = ClientMouseListener.clickX;
                            Minimenu.crossTicks = 0;
                            Minimenu.crossMode = 2;
                            Minimenu.crossY = ClientMouseListener.clickY;
                        }
                        Client.out.pHead(218);
                        Client.out.p2_alt1(id);
                    }
                    break;
                }
            }
            if (Minimenu.objSelected !== 0) {
                Minimenu.objSelected = 0;
                Client.ComponentUpdated(requireNonNull(IfType.Get(Minimenu.objComponent)));
            }
            if (Minimenu.targetMode) {
                const ended = Minimenu.EndTargetMode(ui?.runner);
                if (ended instanceof Promise) yield ended;
            }
            if (Minimenu.highlightComponent !== null && Minimenu.highlightTicks === 0) Client.ComponentUpdated(Minimenu.highlightComponent);
        })();
        if (!glJar) return runToCompletion(frame);
        // i.p blocks through the target/selection callbacks. Its catch covers a resumed browser callback as well.
        const failed = (error: unknown): never => {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'i.E(2597,' + index + ')');
        };
        try {
            const result = runToCompletion(frame);
            if (result instanceof Promise) return result.catch(failed);
        } catch (error) {
            failed(error);
        }
    }

    // kl.a(Laj;I)Z. NXT Client::ClientButton.
    static ClientButton(component: IfType): boolean {
        if (component.clientCode !== 205) return false;
        Client.logoutTimer = 250;
        return true;
    }

    // bd.a(Lid;IIII)V. NXT Client::IfButtonX.
    static IfButtonX(base: JagString | null, child: number, id: number, op: number, runner: Pick<ScriptRunner, 'run'> | undefined = Client.activeClient?.ui?.runner): void | Promise<void> {
        return runToCompletion(
            (function* (): Generator<Promise<void>, void, void> {
                const c = InterfaceList.GetComponent(id, child);
                if (c === null) return;
                if (c.onOp !== null) {
                    const event = new HookReq();
                    event.args = c.onOp;
                    event.component = c;
                    event.opBase = base;
                    event.opIndex = op;
                    const pending = (runner ?? new ScriptRunner(ClientScript.Get)).run(event);
                    if (pending instanceof Promise) yield pending;
                }
                if (Client.activeClient?.standaloneWorldMap) return;
                let send = true;
                if (c.clientCode > 0) send = Client.ClientButton(c);
                if (send && Client.GetActive(c).isOpEnabled((op - 1) | 0)) {
                    if (op === 1) {
                        Client.out.pHead(155);
                        Client.out.p4(id);
                        Client.out.p2(child);
                    }
                    if (op === 2) {
                        Client.out.pHead(196);
                        Client.out.p4(id);
                        Client.out.p2(child);
                    }
                    if (op === 3) {
                        Client.out.pHead(124);
                        Client.out.p4(id);
                        Client.out.p2(child);
                    }
                    if (op === 4) {
                        Client.out.pHead(199);
                        Client.out.p4(id);
                        Client.out.p2(child);
                    }
                    if (op === 5) {
                        Client.out.pHead(234);
                        Client.out.p4(id);
                        Client.out.p2(child);
                    }
                    if (op === 6) {
                        Client.out.pHead(168);
                        Client.out.p4(id);
                        Client.out.p2(child);
                    }
                    if (op === 7) {
                        Client.out.pHead(166);
                        Client.out.p4(id);
                        Client.out.p2(child);
                    }
                    if (op === 8) {
                        Client.out.pHead(64);
                        Client.out.p4(id);
                        Client.out.p2(child);
                    }
                    if (op === 9) {
                        Client.out.pHead(53);
                        Client.out.p4(id);
                        Client.out.p2(child);
                    }
                    if (op === 10) {
                        Client.out.pHead(9);
                        Client.out.p4(id);
                        Client.out.p2(child);
                    }
                }
            })()
        );
    }

    // SD kk.a(BIIIIZ)V.
    private static drawSoftwareScene(height: number, width: number, y: number, x: number, fixed: boolean): void {
        try {
            RoofModeStatics.markStamp = (RoofModeStatics.markStamp + 1) | 0;
            Client.resetTileOccupancy();
            if (!fixed) {
                Client.pushPlayers(true);
                Client.GdmAddNPCs(true);
                Client.pushPlayers(false);
            }
            Client.GdmAddNPCs(false);
            if (!fixed) Client.GdmAddProjectiles();
            Client.GdmAddMapAnim();
            if (OrbitCamera.mode === 1) {
                let pitch = OrbitCamera.followPitch;
                const yaw = (OrbitCamera.followYaw + OrbitCamera.yawOffset) & 2047;
                if (intDivide(OrbitCamera.distance, 256) > pitch) pitch = intDivide(OrbitCamera.distance, 256);
                if (arrayAtObj(OrbitCamera.shake, 4) && pitch < ((arrayAtI32(OrbitCamera.shakeAmplitude, 4) + 128) | 0)) {
                    pitch = (arrayAtI32(OrbitCamera.shakeAmplitude, 4) + 128) | 0;
                }
                const player = requireNonNull(Client.localPlayer);
                Client.CamFollow((Client.GetAvH(player.x, player.z, Client.playerLevel, 98) - 50) | 0, (600 + Math.imul(pitch, 3)) | 0, yaw, OrbitCamera.focusX, pitch, OrbitCamera.focusZ, height);
            }
            const eyeX = OrbitCamera.x,
                eyeY = OrbitCamera.y,
                eyeZ = OrbitCamera.z;
            const pitch = OrbitCamera.pitch,
                yaw = OrbitCamera.yaw;
            for (let axis = 0; axis < 5; axis++) {
                if (!arrayAtObj(OrbitCamera.shake, axis)) continue;
                const delta = doubleToInt(
                    mathRandom.nextDouble() * ((1 + Math.imul(arrayAtI32(OrbitCamera.shakeRandom, axis), 2)) | 0) -
                        arrayAtI32(OrbitCamera.shakeRandom, axis) +
                        Math.sin((arrayAtI32(OrbitCamera.shakeFrequency, axis) / 100) * arrayAtI32(OrbitCamera.shakePhase, axis)) * arrayAtI32(OrbitCamera.shakeAmplitude, axis)
                );
                if (axis === 1) OrbitCamera.y = (OrbitCamera.y + delta) | 0;
                if (axis === 4) {
                    OrbitCamera.pitch = (OrbitCamera.pitch + delta) | 0;
                    if (OrbitCamera.pitch < 128) OrbitCamera.pitch = 128;
                    if (OrbitCamera.pitch > 383) OrbitCamera.pitch = 383;
                }
                if (axis === 0) OrbitCamera.x = (OrbitCamera.x + delta) | 0;
                if (axis === 3) OrbitCamera.yaw = (OrbitCamera.yaw + delta) & 2047;
                if (axis === 2) OrbitCamera.z = (OrbitCamera.z + delta) | 0;
            }
            RoofModeStatics.updateRoofs();
            Pix2D.setClipping(x, y, (x + width) | 0, (y + height) | 0);
            Pix3D.setRenderClipping();
            if (!Minimenu.isOpen && x <= Minimenu.mouseX && Minimenu.mouseX < ((width + x) | 0) && y <= Minimenu.mouseY && ((y + height) | 0) > Minimenu.mouseY) {
                ModelLit.pickedCount = 0;
                const left = Pix3D.clipMinX,
                    right = Pix3D.clipMaxX;
                ModelLitImpl.mouseX = (intDivide(Math.imul(right - left, Minimenu.mouseX - x), width) + left) | 0;
                const top = Pix3D.clipMinY;
                ModelLit.checkHover = true;
                const bottom = Pix3D.clipMaxY;
                ModelLit.mouseY = (top + intDivide(Math.imul(bottom - top, Minimenu.mouseY - y), height)) | 0;
            } else {
                ModelLit.checkHover = false;
                ModelLit.pickedCount = 0;
            }
            AudioEngine.tick();
            const stamp = RoofModeStatics.getRoofMode() !== 2 ? 1 : (RoofModeStatics.markStamp << 24) >> 24;
            Pix2D.fillRect(x, y, width, height, 0);
            world.draw(
                OrbitCamera.x,
                OrbitCamera.y,
                OrbitCamera.z,
                OrbitCamera.pitch,
                OrbitCamera.yaw,
                RoofModeStatics.roofMarks,
                RoofModeStatics.roofMaxY,
                RoofModeStatics.roofMinX,
                RoofModeStatics.roofMaxX,
                RoofModeStatics.roofMaxZ,
                RoofModeStatics.hideMinZ,
                (1 + Client.playerLevel) | 0,
                stamp,
                requireNonNull(Client.localPlayer).x >> 7,
                requireNonNull(Client.localPlayer).z >> 7
            );
            AudioEngine.tick();
            world.RemoveSprites();
            Client.GdmEntityOverlays(y, x, width, height, 256, 256);
            Client.GdmCoordArrow(x, width, height, y, 256, 256);
            const textures = Pix3D.textureProvider;
            if (textures !== null && !(textures instanceof TextureCache)) throw new TypeError('ClassCastException: expected TextureCache');
            requireNonNull(textures).RunAnims(AreaSoundManager.elapsed);
            Client.drawCross();
            OrbitCamera.pitch = pitch;
            OrbitCamera.y = eyeY;
            OrbitCamera.z = eyeZ;
            OrbitCamera.x = eyeX;
            OrbitCamera.yaw = yaw;
            if (Client.showLoadingMessage && requireNonNull(Client.js5NetQueue).GetUrgentQueueSize() === 0) Client.showLoadingMessage = false;
            if (Client.showLoadingMessage) {
                Pix2D.fillRect(x, y, width, height, 0);
                Client.MessageBox(LocalisedText.loadingPleaseWait2, false, -48);
            }
            if (!fixed && !Client.showLoadingMessage && !Minimenu.isOpen && Minimenu.mouseX >= x && ((x + width) | 0) > Minimenu.mouseX && y <= Minimenu.mouseY && Minimenu.mouseY < ((height + y) | 0)) {
                Minimenu.Build(y, Minimenu.mouseX, width, height, Minimenu.mouseY, x);
            }
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'kk.D(118,' + height + ',' + width + ',' + y + ',' + x + ',' + fixed + ')');
        }
    }

    // HD ui.a(IIZIII)V. Client code 1403 is the title-camera viewport.
    static drawScene(height: number, width: number, y: number, x: number, fixed: boolean): void {
        const renderer = glJar ? GlRendererClass : null;
        if (renderer === null) {
            if (SceneCutover.active) return Client.drawSoftwareScene(height, width, y, x, fixed);
            requireNonNull(Client.activeClient?.ui).view.drawViewport(x, y, width, height);
            return;
        }
        try {
            const raster = loadGlRaster();
            const environment = loadEnvironment();
            const lights = PointLightManagerClass;
            const materials = MaterialManager;
            RoofModeStatics.markStamp = (RoofModeStatics.markStamp + 1) | 0;
            Client.resetTileOccupancy();
            if (!fixed) {
                Client.pushPlayers(true);
                Client.GdmAddNPCs(true);
                Client.pushPlayers(false);
            }
            Client.GdmAddNPCs(false);
            if (!fixed) Client.GdmAddProjectiles();
            Client.GdmAddMapAnim();
            if (renderer.active) {
                Client.GdmCalcWindowSize(x, y, width, height, true, 125);
                x = Client.viewportX;
                y = Client.viewportY;
                width = Client.viewportWidth;
                height = Client.viewportHeight;
            }
            if (OrbitCamera.mode === 1) {
                const yaw = (OrbitCamera.yawOffset + OrbitCamera.followYaw) & 2047;
                let pitch = OrbitCamera.followPitch;
                if (pitch < intDivide(OrbitCamera.distance, 256)) pitch = intDivide(OrbitCamera.distance, 256);
                if (arrayAtObj(OrbitCamera.shake, 4) && arrayAtI32(OrbitCamera.shakeAmplitude, 4) + 128 > pitch) {
                    pitch = (arrayAtI32(OrbitCamera.shakeAmplitude, 4) + 128) | 0;
                }
                const focusX = OrbitCamera.focusX;
                const level = Client.playerLevel;
                const playerX = requireNonNull(Client.localPlayer).x;
                const playerZ = requireNonNull(Client.localPlayer).z;
                const followY = (Client.GetAvH(playerX, playerZ, level, 90) - 50) | 0;
                Client.CamFollow(followY, (600 + Math.imul(pitch, 3)) | 0, yaw, focusX, pitch, OrbitCamera.focusZ, height);
            }
            const eyeY = OrbitCamera.y,
                eyeX = OrbitCamera.x,
                eyeZ = OrbitCamera.z;
            const pitch = OrbitCamera.pitch,
                yaw = OrbitCamera.yaw;
            for (let axis = 0; axis < 5; axis++) {
                if (!arrayAtObj(OrbitCamera.shake, axis)) continue;
                const delta = doubleToInt(
                    (-arrayAtI32(OrbitCamera.shakeRandom, axis) | 0) +
                        ((Math.imul(arrayAtI32(OrbitCamera.shakeRandom, axis), 2) + 1) | 0) * mathRandom.nextDouble() +
                        Math.sin(arrayAtI32(OrbitCamera.shakePhase, axis) * (arrayAtI32(OrbitCamera.shakeFrequency, axis) / 100)) * arrayAtI32(OrbitCamera.shakeAmplitude, axis)
                );
                if (axis === 3) OrbitCamera.yaw = (OrbitCamera.yaw + delta) & 2047;
                if (axis === 4) {
                    OrbitCamera.pitch = (OrbitCamera.pitch + delta) | 0;
                    if (OrbitCamera.pitch < 128) OrbitCamera.pitch = 128;
                    if (OrbitCamera.pitch > 383) OrbitCamera.pitch = 383;
                }
                if (axis === 2) OrbitCamera.z = (OrbitCamera.z + delta) | 0;
                if (axis === 1) OrbitCamera.y = (OrbitCamera.y + delta) | 0;
                if (axis === 0) OrbitCamera.x = (OrbitCamera.x + delta) | 0;
            }
            RoofModeStatics.updateRoofs();
            const presentation = GameShell.stressFrame && renderer.active && !fixed ? renderer.stressDrawable?.currentTargets() : null;
            if (renderer.active) {
                raster.setClipping(x, y, (x + width) | 0, (y + height) | 0);
                let pitchDegrees = Math.fround(Math.fround(OrbitCamera.pitch) * 0.17578125);
                let yawDegrees = Math.fround(0.17578125 * Math.fround(OrbitCamera.yaw));
                if (OrbitCamera.mode === 3) {
                    pitchDegrees = Math.fround(Math.fround(360 * CinematicCamera.pitchRadians) / Math.fround(Math.fround(Math.PI) * 2));
                    yawDegrees = Math.fround(Math.fround(CinematicCamera.yawRadians * 360) / Math.fround(Math.fround(Math.PI) * 2));
                }
                renderer.setCamera(x, y, width, height, (intDivide(width, 2) + x) | 0, (y + intDivide(height, 2)) | 0, pitchDegrees, yawDegrees, Client.viewportScale, Client.viewportScale);
                // World.draw clamps the eye to the loaded scene before positioning geometry.
                presentation?.beginWorldView(Math.min(Math.max(0, OrbitCamera.x), world.maxTileX * 128 - 1), OrbitCamera.y, Math.min(Math.max(0, OrbitCamera.z), world.maxTileZ * 128 - 1), pitchDegrees, yawDegrees, Client.loopCycle);
            } else {
                Pix2D.setClipping(x, y, (x + width) | 0, (y + height) | 0);
                Pix3D.setRenderClipping();
            }
            if (Minimenu.isOpen || Minimenu.mouseX < x || Minimenu.mouseX >= ((width + x) | 0) || Minimenu.mouseY < y || Minimenu.mouseY >= ((height + y) | 0)) {
                ModelLit.checkHover = false;
                ModelLit.pickedCount = 0;
            } else {
                ModelLit.checkHover = true;
                ModelLit.pickedCount = 0;
                const maxX = Pix3D.clipMaxX;
                const minY = Pix3D.clipMinY;
                const minX = Pix3D.clipMinX;
                ModelLitImpl.mouseX = (minX + intDivide(Math.imul((maxX - minX) | 0, (Minimenu.mouseX - x) | 0), width)) | 0;
                const maxY = Pix3D.clipMaxY;
                ModelLit.mouseY = (intDivide(Math.imul((maxY - minY) | 0, (Minimenu.mouseY - y) | 0), height) + minY) | 0;
            }
            AudioEngine.tick();
            const stamp = RoofModeStatics.getRoofMode() === 2 ? (RoofModeStatics.markStamp << 24) >> 24 : 1;
            const hardwareScene = renderer.active;
            if (hardwareScene) {
                renderer.applyLightingPreference();
                renderer.setDepthTest(true);
                renderer.setFog(true);
                const colour =
                    Client.gameState === 10
                        ? environment.update(AreaSoundManager.elapsed, OrbitCamera.z >> 10, Preferences.brightness, OrbitCamera.x >> 10)
                        : environment.update(AreaSoundManager.elapsed, arrayAtI32(requireNonNull(Client.localPlayer).pathZ, 0) >> 3, Preferences.brightness, arrayAtI32(requireNonNull(Client.localPlayer).pathX, 0) >> 3);
                lights.update(Client.loopCycle, !Preferences.graphics.flickeringEffects);
                renderer.clear(colour);
                materials.setCamera(OrbitCamera.pitch, OrbitCamera.z, OrbitCamera.y, OrbitCamera.x, OrbitCamera.yaw);
                renderer.cycle = Client.loopCycle;
            } else {
                Pix2D.fillRect(x, y, width, height, 0);
            }
            const drawable = hardwareScene ? renderer.stressDrawable : null;
            drawable?.beginWorldDraw();
            try {
                world.draw(
                    OrbitCamera.x,
                    OrbitCamera.y,
                    OrbitCamera.z,
                    OrbitCamera.pitch,
                    OrbitCamera.yaw,
                    RoofModeStatics.roofMarks,
                    RoofModeStatics.roofMaxY,
                    RoofModeStatics.roofMinX,
                    RoofModeStatics.roofMaxX,
                    RoofModeStatics.roofMaxZ,
                    RoofModeStatics.hideMinZ,
                    (Client.playerLevel + 1) | 0,
                    stamp,
                    requireNonNull(Client.localPlayer).x >> 7,
                    requireNonNull(Client.localPlayer).z >> 7
                );
            } finally {
                drawable?.endWorldDraw();
            }
            if (hardwareScene) {
                presentation?.endWorldView();
                Client.clearInterfaceModelDepth = true;
                lights.clearSlots();
                materials.setCamera(0, 0, 0, 0, 0);
            }
            AudioEngine.tick();
            world.RemoveSprites();
            if (hardwareScene) {
                Client.GdmEntityOverlays(y, x, width, height, Client.viewportScale, Client.viewportScale);
                const arrowScaleY = Client.viewportScale;
                Client.GdmCoordArrow(x, width, height, y, Client.viewportScale, arrowScaleY);
            } else {
                Client.GdmEntityOverlays(y, x, width, height, 256, 256);
                Client.GdmCoordArrow(x, width, height, y, 256, 256);
            }
            const textures = Pix3D.textureProvider;
            if (textures !== null && !(textures instanceof TextureCache)) throw new TypeError('ClassCastException: expected TextureCache');
            requireNonNull(textures).RunAnims(AreaSoundManager.elapsed);
            Client.drawCross();
            OrbitCamera.pitch = pitch;
            OrbitCamera.z = eyeZ;
            OrbitCamera.y = eyeY;
            OrbitCamera.x = eyeX;
            OrbitCamera.yaw = yaw;
            if (Client.showLoadingMessage && requireNonNull(Client.js5NetQueue).GetUrgentQueueSize() === 0) Client.showLoadingMessage = false;
            if (Client.showLoadingMessage) {
                (renderer.active ? raster : Pix2D).fillRect(x, y, width, height, 0);
                Client.MessageBox(LocalisedText.loadingPleaseWait2, false, -52);
            }
            if (!fixed && !Client.showLoadingMessage && !Minimenu.isOpen && x <= Minimenu.mouseX && ((x + width) | 0) > Minimenu.mouseX && y <= Minimenu.mouseY && ((height + y) | 0) > Minimenu.mouseY) {
                const mouseY = Minimenu.mouseY;
                Minimenu.Build(y, Minimenu.mouseX, width, height, mouseY, x);
            }
        } catch (error) {
            if (GameShell.stressFrame) renderer.stressDrawable?.currentTargets()?.stopStress();
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'ui.OA(-6403,' + height + ',' + fixed + ',' + x + ',' + width + ',' + y + ')');
        }
    }

    // SD lf.a(I[Laj;IIIIIIZI)V, HD gn.a(III[Lbe;IIIIBI)V. NXT Client::DrawLayer.
    static DrawLayer(py: number, components: (IfType | null)[] | null, parent: number, bottom: number, top: number, inheritedRoot: number, right: number, px: number, left: number, hdGuard = 119): void {
        try {
            const renderer = glJar ? GlRendererClass : null;
            const hdRaster = glJar ? loadGlRaster() : null;
            if (renderer !== null && renderer.active) {
                requireNonNull(hdRaster).setClipping(left, top, right, bottom);
            } else {
                Pix2D.setClipping(left, top, right, bottom);
                Pix3D.setRenderClipping();
            }
            for (let index = 0; index < requireNonNull(components).length; index++) {
                const c = arrayAtObj(components, index);
                if (c === null || (c.parentId !== parent && (parent !== -1412584499 || c !== ComponentDrag.component))) continue;
                let root = inheritedRoot;
                if (root === -1) {
                    arrayPutI32(InterfaceList.rootX, InterfaceList.rootCount, (px + c.x) | 0);
                    arrayPutI32(InterfaceList.rootY, InterfaceList.rootCount, (py + c.y) | 0);
                    arrayPutI32(InterfaceList.rootWidth, InterfaceList.rootCount, c.width);
                    arrayPutI32(InterfaceList.rootHeight, InterfaceList.rootCount, c.height);
                    root = InterfaceList.rootCount;
                    InterfaceList.rootCount = (root + 1) | 0;
                }
                c.rootIndex = root;
                c.drawCycle = Client.loopCycle;
                if (c.if3 && Client.Hide(c)) continue;
                if (c.clientCode > 0) Client.ClientComponent(c);
                let x = (px + c.x) | 0;
                let transparency = c.transparency;
                let y = (c.y + py) | 0;
                if (Client.qaOpTest && (Client.GetActive(c).events !== 0 || c.type === 0) && transparency > 127) transparency = 127;
                if (ComponentDrag.component === c) {
                    if (parent !== -1412584499 && !c.dragRender) {
                        ComponentDrag.dragLayerX = px;
                        if (glJar) {
                            ComponentDrag.dragLayerY = py;
                            ComponentDrag.dragLayerComponents = components;
                        } else {
                            ComponentDrag.dragLayerComponents = components;
                            ComponentDrag.dragLayerY = py;
                        }
                        continue;
                    }
                    if (!glJar && !c.dragRender) transparency = 128;
                    if (ComponentDrag.started && ComponentDrag.parentVisible) {
                        if (glJar) {
                            const mouseY = ClientMouseListener.mouseY;
                            const mouseX = ClientMouseListener.x;
                            y = (mouseY - ComponentDrag.dragMouseY) | 0;
                            if (y < ComponentDrag.parentY) y = ComponentDrag.parentY;
                            if (((y + c.height) | 0) > ((requireNonNull(ComponentDrag.parent).height + ComponentDrag.parentY) | 0)) {
                                y = (-c.height + requireNonNull(ComponentDrag.parent).height + ComponentDrag.parentY) | 0;
                            }
                            x = (mouseX - ComponentDrag.dragMouseX) | 0;
                            if (ComponentDrag.parentX > x) x = ComponentDrag.parentX;
                            if (((requireNonNull(ComponentDrag.parent).width + ComponentDrag.parentX) | 0) < ((c.width + x) | 0)) {
                                x = (-c.width + (requireNonNull(ComponentDrag.parent).width + ComponentDrag.parentX)) | 0;
                            }
                        } else {
                            x = (ClientMouseListener.x - ComponentDrag.dragMouseX) | 0;
                            if (ComponentDrag.parentX > x) x = ComponentDrag.parentX;
                            if (((ComponentDrag.parentX + requireNonNull(ComponentDrag.parent).width) | 0) < ((c.width + x) | 0)) {
                                x = (-c.width + (requireNonNull(ComponentDrag.parent).width + ComponentDrag.parentX)) | 0;
                            }
                            y = (ClientMouseListener.mouseY - ComponentDrag.dragMouseY) | 0;
                            if (ComponentDrag.parentY > y) y = ComponentDrag.parentY;
                            if (((requireNonNull(ComponentDrag.parent).height + ComponentDrag.parentY) | 0) < ((y + c.height) | 0)) {
                                y = (requireNonNull(ComponentDrag.parent).height + (ComponentDrag.parentY - c.height)) | 0;
                            }
                        }
                    }
                    if (glJar && !c.dragRender) transparency = 128;
                }
                let boundLeft = left,
                    boundTop = top,
                    boundRight = right,
                    boundBottom = bottom;
                if (c.type !== 2) {
                    let componentBottom = (y + c.height) | 0;
                    let componentRight = (c.width + x) | 0;
                    if (c.type === 9) {
                        componentRight = (componentRight + 1) | 0;
                        componentBottom = (componentBottom + 1) | 0;
                    }
                    boundLeft = Math.max(left, x);
                    boundTop = Math.max(top, y);
                    boundRight = Math.min(right, componentRight);
                    boundBottom = Math.min(bottom, componentBottom);
                }
                if (c.if3 && (boundLeft >= boundRight || boundTop >= boundBottom)) continue;
                if (c.clientCode === 1337 || (c.clientCode === 1403 && renderer?.active)) {
                    if (glJar) {
                        InterfaceList.viewportComponent = c;
                        Minimenu.tooltipY = y;
                        Minimenu.tooltipX2 = x;
                    } else {
                        Minimenu.tooltipX2 = x;
                        InterfaceList.viewportComponent = c;
                        Minimenu.tooltipY = y;
                    }
                    Client.drawScene(c.height, c.width, y, x, (c.clientCode | 0) === 1403);
                    (renderer?.active ? requireNonNull(hdRaster) : Pix2D).setClipping(left, top, right, bottom);
                    continue;
                }
                if (c.clientCode === 1338) {
                    if (c.GetMask()) {
                        MinimapBuilder.Draw(x, c, root, y);
                        (renderer?.active ? requireNonNull(hdRaster) : Pix2D).setClipping(left, top, right, bottom);
                        if ((Client.minimapState !== 0 && Client.minimapState !== 3) || Minimenu.isOpen || boundLeft > Minimenu.mouseX || Minimenu.mouseY < boundTop || Minimenu.mouseX >= boundRight || boundBottom <= Minimenu.mouseY) continue;
                        let dx: number, dy: number;
                        if (glJar) {
                            dx = (Minimenu.mouseX - x) | 0;
                            dy = (-y + Minimenu.mouseY) | 0;
                        } else {
                            dy = (Minimenu.mouseY - y) | 0;
                            dx = (Minimenu.mouseX - x) | 0;
                        }
                        const start = arrayAtI32(c.maskStarts, dy);
                        if (start > dx || dx > ((start + arrayAtI32(c.maskWidths, dy)) | 0)) continue;
                        dy = (dy - intDivide(c.height, 2)) | 0;
                        const angle = (OrbitCamera.followYaw + OrbitCamera.minimapAngle) & 2047;
                        dx = (dx - intDivide(c.width, 2)) | 0;
                        let sin: number, cos: number;
                        if (glJar) {
                            sin = arrayAtI32(Pix3D.sinTable, angle);
                            cos = arrayAtI32(Pix3D.cosTable, angle);
                        } else {
                            cos = arrayAtI32(Pix3D.cosTable, angle);
                            sin = arrayAtI32(Pix3D.sinTable, angle);
                        }
                        sin = Math.imul(256 + OrbitCamera.minimapZoom, sin) >> 8;
                        cos = Math.imul(OrbitCamera.minimapZoom + 256, cos) >> 8;
                        const offsetX = (Math.imul(cos, dx) + Math.imul(dy, sin)) >> 11;
                        const offsetZ = (-Math.imul(dx, sin) + Math.imul(dy, cos)) >> 11;
                        const tileX = (offsetX + requireNonNull(Client.localPlayer).x) >> 7;
                        const tileZ = (requireNonNull(Client.localPlayer).z - offsetZ) >> 7;
                        if (Minimenu.targetMode && (Minimenu.targetFlags & 64) !== 0) {
                            const child = Minimenu.targetChild;
                            const target = InterfaceList.GetComponent(Minimenu.targetComponent, child);
                            if (target === null) Minimenu.EndTargetMode();
                            else if (glJar) {
                                const cursor = Minimenu.targetCursor;
                                Minimenu.AddEntry(Minimenu.groundArrow, MinimenuOps.TARGET_GROUND, Minimenu.targetVerb, tileX, tileZ, 1n, cursor);
                            } else Minimenu.AddEntry(Minimenu.groundArrow, MinimenuOps.TARGET_GROUND, Minimenu.targetVerb, tileX, tileZ, 1n, Minimenu.targetCursor);
                        } else {
                            if (GameVariant.id === 1) Minimenu.AddEntry(JagString.empty, MinimenuOps.FACE_HERE, LocalisedText.faceHere, tileX, tileZ, 1n, -1);
                            Minimenu.AddEntry(JagString.empty, MinimenuOps.WALK_HERE, Minimenu.walkHere, tileX, tileZ, 1n, -1);
                        }
                    }
                    continue;
                }
                if (c.clientCode === 1339) {
                    if (c.GetMask()) {
                        MinimapBuilder.CompassDraw(root, c, 3, x, y);
                        (renderer?.active ? requireNonNull(hdRaster) : Pix2D).setClipping(left, top, right, bottom);
                    }
                    continue;
                }
                if (c.clientCode === 1400 || c.clientCode === 1401 || c.clientCode === 1402) {
                    if (c.clientCode === 1400) WorldMap.draw(y, 2, x, c.height, c.width);
                    else if (c.clientCode === 1401) WorldMap.drawOverview(x, y, c.height, c.width);
                    else {
                        if (renderer?.active) continue;
                        TitleFlames.RenderFlames(x, y);
                        arrayPutObj(InterfaceList.dirty, root, true);
                        arrayPutObj(InterfaceList.rectangleRedraw, root, true);
                        continue;
                    }
                    arrayPutObj(InterfaceList.dirty, root, true);
                    arrayPutObj(InterfaceList.rectangleRedraw, root, true);
                    (renderer?.active ? requireNonNull(hdRaster) : Pix2D).setClipping(left, top, right, bottom);
                    continue;
                }
                if (c.clientCode === 1405) {
                    if (!Client.displayFps && !GameShell.stressFrame) continue;
                    const rightX = (x + c.width) | 0;
                    let baseline = (15 + y) | 0;
                    const fpsFont = Client.p12;
                    const fps = JagString.join([Client.fpsLabel, JagString.fromInt(GameShell.stressFrame ? GameShell.stressRenderFps : GameShell.m_fps)]);
                    requireNonNull(fpsFont).drawRight(fps, rightX, baseline, 16776960, -1);
                    if (GameShell.stressFrame) {
                        baseline += 15;
                        const gameDraws = JagString.join([Client.stressGameDrawLabel, JagString.fromInt(GameShell.m_fps)]);
                        requireNonNull(fpsFont).drawRight(gameDraws, rightX, baseline, 16776960, -1);
                    }
                    const used = Client.usedMemoryKb();
                    baseline = (baseline + 15) | 0;
                    const memoryFont = Client.p12;
                    const memory = JagString.join([Client.memLabel, JagString.fromInt(used), Client.kilobytes]);
                    requireNonNull(memoryFont).drawRight(memory, rightX, baseline, used > 65536 ? 16711680 : 16776960, -1);
                    baseline = (baseline + 15) | 0;
                    if (renderer?.active) {
                        // HD gn.a, 1768..1853. fa tracks the original GL texture, geometry and 2D resource sizes.
                        const cleaner = GlCleaner;
                        const card = intDivide((cleaner.textureMemory + ((cleaner.geometryMemory + cleaner.memory2d) | 0)) | 0, 1024);
                        const cardFont = Client.p12;
                        const text = JagString.join([Client.cardLabel, JagString.fromInt(card), Client.kilobytes]);
                        requireNonNull(cardFont).drawRight(text, rightX, baseline, card > 65536 ? 16711680 : 16776960, -1);
                        baseline = (baseline + 15) | 0;
                    }
                    let groups = 0,
                        verified = 0,
                        position = 0;
                    for (let archive = 0; archive < 28; archive++) {
                        groups = (groups + requireNonNull(arrayAtObj(Client.js5Providers, archive)).groupCount()) | 0;
                        verified = (verified + requireNonNull(arrayAtObj(Client.js5Providers, archive)).verifiedCount()) | 0;
                        position = (position + requireNonNull(arrayAtObj(Client.js5Providers, archive)).verificationPosition()) | 0;
                    }
                    const verifiedPercent = intDivide(Math.imul(10000, verified), groups);
                    const scanPercent = intDivide(Math.imul(100, position), groups);
                    const progress = JagString.join([Client.debugCacheLabel, JagString.formatNumber(BigInt(verifiedPercent), 0, 2, true), Client.percentOpenParen, JagString.fromInt(scanPercent), LocalisedText.loadingPercentEnd]);
                    requireNonNull(Client.fontPlain11).drawRight(progress, rightX, baseline, 16776960, -1);
                    arrayPutObj(InterfaceList.dirty, root, true);
                    arrayPutObj(InterfaceList.rectangleRedraw, root, true);
                    continue;
                }
                if (c.clientCode === 1406) {
                    if (glJar) {
                        Minimenu.tooltipY2 = y;
                        Minimenu.tooltipComponent = c;
                        Minimenu.tooltipX = x;
                    } else {
                        Minimenu.tooltipX = x;
                        Minimenu.tooltipY2 = y;
                        Minimenu.tooltipComponent = c;
                    }
                    continue;
                }
                if (!Minimenu.isOpen) {
                    if (c.type === 0 && c.noClickThrough && Minimenu.mouseX >= boundLeft && Minimenu.mouseY >= boundTop && boundRight > Minimenu.mouseX && boundBottom > Minimenu.mouseY && !Client.qaOpTest) {
                        if (glJar) {
                            Minimenu.count = 1;
                            arrayPutI32(Minimenu.cursor, 0, Minimenu.defaultCursor);
                            arrayPutObj(Minimenu.option, 0, LocalisedText.cancel);
                            arrayPutObj(Minimenu.target, 0, JagString.empty);
                            arrayPutI16(Minimenu.actions, 0, MinimenuOps.CANCEL);
                        } else {
                            arrayPutI32(Minimenu.cursor, 0, Minimenu.defaultCursor);
                            arrayPutI16(Minimenu.actions, 0, MinimenuOps.CANCEL);
                            Minimenu.count = 1;
                            arrayPutObj(Minimenu.option, 0, LocalisedText.cancel);
                            arrayPutObj(Minimenu.target, 0, JagString.empty);
                        }
                    }
                    if (boundLeft <= Minimenu.mouseX && Minimenu.mouseY >= boundTop && boundRight > Minimenu.mouseX && boundBottom > Minimenu.mouseY) {
                        Minimenu.AddComponent((Minimenu.mouseY - y) | 0, (Minimenu.mouseX - x) | 0, c);
                    }
                }
                if (c.type === 0) {
                    if (!c.if3 && Client.Hide(c) && c !== InterfaceList.mouseOverComponent) continue;
                    if (!c.if3) {
                        if (c.scrollY > ((c.scrollHeight - c.height) | 0)) c.scrollY = (c.scrollHeight - c.height) | 0;
                        if (c.scrollY < 0) c.scrollY = 0;
                    }
                    if (glJar) Client.DrawLayer((y - c.scrollY) | 0, components, c.id, boundBottom, boundTop, root, boundRight, (x - c.scrollX) | 0, boundLeft, 87);
                    else Client.DrawLayer((y - c.scrollY) | 0, components, c.id, boundBottom, boundTop, root, boundRight, (x - c.scrollX) | 0, boundLeft);
                    if (c.childSlots !== null) {
                        if (glJar) Client.DrawLayer((y - c.scrollY) | 0, c.childSlots, c.id, boundBottom, boundTop, root, boundRight, (x - c.scrollX) | 0, boundLeft, 52);
                        else Client.DrawLayer((y - c.scrollY) | 0, c.childSlots, c.id, boundBottom, boundTop, root, boundRight, (x - c.scrollX) | 0, boundLeft);
                    }
                    const sub = InterfaceList.subInterfaces.get(BigInt(c.id));
                    if (sub !== null && !(sub instanceof SubInterface)) throw new TypeError('ClassCastException: not a SubInterface');
                    if (sub !== null) {
                        if (sub.type === 0 && !Minimenu.isOpen && Minimenu.mouseX >= boundLeft && Minimenu.mouseY >= boundTop && boundRight > Minimenu.mouseX && Minimenu.mouseY < boundBottom && !Client.qaOpTest) {
                            if (glJar) {
                                arrayPutObj(Minimenu.option, 0, LocalisedText.cancel);
                                Minimenu.count = 1;
                                arrayPutI32(Minimenu.cursor, 0, Minimenu.defaultCursor);
                                arrayPutI16(Minimenu.actions, 0, MinimenuOps.CANCEL);
                                arrayPutObj(Minimenu.target, 0, JagString.empty);
                            } else {
                                Minimenu.count = 1;
                                arrayPutI16(Minimenu.actions, 0, MinimenuOps.CANCEL);
                                arrayPutI32(Minimenu.cursor, 0, Minimenu.defaultCursor);
                                arrayPutObj(Minimenu.option, 0, LocalisedText.cancel);
                                arrayPutObj(Minimenu.target, 0, JagString.empty);
                            }
                        }
                        InterfaceList.DrawInterface(boundBottom, y, boundTop, boundRight, boundLeft, root, x, sub.group);
                    }
                    if (renderer?.active) {
                        requireNonNull(hdRaster).setClipping(left, top, right, bottom);
                    } else {
                        Pix2D.setClipping(left, top, right, bottom);
                        Pix3D.setRenderClipping();
                    }
                }
                if (!arrayAtObj(InterfaceList.rectRedrawnLastFrame, root) && Client.rectDebug <= 1) continue;
                if (c.type === 0 && !c.if3 && c.height < c.scrollHeight) Client.DrawScrollbar(c.height, y, c.scrollY, c.scrollHeight, (x + c.width) | 0);
                if (c.type === 2) {
                    // lf.a(I[Laj;IIIIIIZI)V, 094f..0c91.
                    let slot = 0;
                    for (let row = 0; row < c.baseHeight; row++) {
                        for (let column = 0; column < c.baseWidth; column++, slot++) {
                            let slotX = (x + Math.imul((c.itemX + 32) | 0, column)) | 0;
                            let slotY = (y + Math.imul((32 + c.itemY) | 0, row)) | 0;
                            if (slot < 20) {
                                slotX = (slotX + arrayAtI32(c.invSlotOffsetX, slot)) | 0;
                                slotY = (slotY + arrayAtI32(c.invSlotOffsetY, slot)) | 0;
                            }
                            if (arrayAtI32(c.itemIds, slot) <= 0) {
                                if (c.invSlotSprite !== null && slot < 20) {
                                    const background = c.GetInvBackground(slot);
                                    if (background !== null) background.draw(slotX, slotY);
                                    else if (IfType.resourceMissing) Client.ComponentUpdated(c);
                                }
                                continue;
                            }
                            const itemId = (arrayAtI32(c.itemIds, slot) - 1) | 0;
                            if (!(left < ((slotX + 32) | 0) && slotX < right && top < ((slotY + 32) | 0) && slotY < bottom) && (c !== Minimenu.objDragComponent || slot !== Minimenu.objDragSlot)) continue;
                            const selected = Minimenu.objSelected === 1 && slot === Minimenu.objSlot && c.id === Minimenu.objComponent;
                            const sprite = ObjType.GetSprite(itemId, selected ? 2 : 1, c.showItemCount, arrayAtI32(c.itemCounts, slot), selected ? 0 : 3153952);
                            if (Pix3D.textureFallback) arrayPutObj(InterfaceList.dirty, root, true);
                            if (sprite === null) {
                                Client.ComponentUpdated(c);
                                continue;
                            }
                            if (c !== Minimenu.objDragComponent || slot !== Minimenu.objDragSlot) {
                                if (c === Minimenu.highlightComponent && slot === Minimenu.highlightSlot) sprite.drawAlpha(slotX, slotY, 128);
                                else sprite.draw(slotX, slotY);
                                continue;
                            }
                            let dx: number, dy: number;
                            if (glJar) {
                                dx = (ClientMouseListener.x - Minimenu.objGrabX) | 0;
                                dy = (-Minimenu.objGrabY + ClientMouseListener.mouseY) | 0;
                            } else {
                                dy = (-Minimenu.objGrabY + ClientMouseListener.mouseY) | 0;
                                if (dy < 5 && dy > -5) dy = 0;
                                dx = (-Minimenu.objGrabX + ClientMouseListener.x) | 0;
                            }
                            if (glJar && dy < 5 && dy > -5) dy = 0;
                            if (dx < 5 && dx > -5) dx = 0;
                            if (Minimenu.objDragCycles < 5) {
                                dx = 0;
                                dy = 0;
                            }
                            sprite.drawAlpha((slotX + dx) | 0, (slotY + dy) | 0, 128);
                            if (parent === -1) continue;
                            const scroller = arrayAtObj(components, parent & 65535);
                            let clipTop: number, clipBottom: number;
                            if (renderer?.active) {
                                clipBottom = requireNonNull(hdRaster).clipMaxY;
                                clipTop = requireNonNull(hdRaster).clipMinY;
                            } else {
                                clipTop = Pix2D.clipMinY;
                                clipBottom = Pix2D.clipMaxY;
                            }
                            if (((slotY + dy) | 0) < clipTop && requireNonNull(scroller).scrollY > 0) {
                                const widget = requireNonNull(scroller);
                                let distance = intDivide(Math.imul(AreaSoundManager.elapsed, (clipTop - dy - slotY) | 0), 3);
                                if (distance > Math.imul(AreaSoundManager.elapsed, 10)) distance = Math.imul(10, AreaSoundManager.elapsed);
                                if (distance > widget.scrollY) distance = widget.scrollY;
                                if (glJar) {
                                    widget.scrollY = (widget.scrollY - distance) | 0;
                                    Minimenu.objGrabY = (Minimenu.objGrabY + distance) | 0;
                                } else {
                                    Minimenu.objGrabY = (Minimenu.objGrabY + distance) | 0;
                                    widget.scrollY = (widget.scrollY - distance) | 0;
                                }
                                Client.ComponentUpdated(widget);
                            }
                            if (((32 + dy + slotY) | 0) > clipBottom) {
                                const widget = requireNonNull(scroller);
                                if (widget.scrollY < ((glJar ? -widget.height + widget.scrollHeight : widget.scrollHeight - widget.height) | 0)) {
                                    let distance = intDivide(Math.imul((dy + slotY + 32 - clipBottom) | 0, AreaSoundManager.elapsed), 3);
                                    if (distance > Math.imul(AreaSoundManager.elapsed, 10)) distance = Math.imul(10, AreaSoundManager.elapsed);
                                    if (distance > ((-widget.scrollY + (glJar ? widget.scrollHeight - widget.height : -widget.height + widget.scrollHeight)) | 0)) {
                                        distance = (widget.scrollHeight - (widget.height + widget.scrollY)) | 0;
                                    }
                                    widget.scrollY = (widget.scrollY + distance) | 0;
                                    Minimenu.objGrabY = (Minimenu.objGrabY - distance) | 0;
                                    Client.ComponentUpdated(widget);
                                }
                            }
                        }
                    }
                    continue;
                }
                if (c.type === 3) {
                    let colour: number;
                    if (!Client.GetIfActive(c, glJar ? 26 : -70)) {
                        colour = c.colour;
                        if (InterfaceList.mouseOverComponent === c && c.overColour !== 0) colour = c.overColour;
                    } else {
                        colour = c.activeColour;
                        if (InterfaceList.mouseOverComponent === c && c.activeOverColour !== 0) colour = c.activeOverColour;
                    }
                    const raster = renderer?.active ? loadGlRaster() : Pix2D;
                    if (transparency !== 0) {
                        if (c.fill) raster.fillRectTrans(x, y, c.width, c.height, colour, 256 - (transparency & 255));
                        else raster.drawRectTrans(x, y, c.width, c.height, colour, 256 - (transparency & 255));
                    } else if (!c.fill) raster.drawRect(x, y, c.width, c.height, colour);
                    else raster.fillRect(x, y, c.width, c.height, colour);
                    continue;
                }
                if (c.type === 4) {
                    // lf.a(I[Laj;IIIIIIZI)V, 0d7d..0eda.
                    const font = c.GetFont(PixfontGeneric.nameIcons);
                    if (font === null) {
                        if (IfType.resourceMissing) Client.ComponentUpdated(c);
                        continue;
                    }
                    let text = c.textValue;
                    let colour: number;
                    if (Client.GetIfActive(c, glJar ? 97 : 125)) {
                        colour = c.activeColour;
                        if (InterfaceList.mouseOverComponent === c && c.activeOverColour !== 0) colour = c.activeOverColour;
                        if (c.activeTextValue.getLength() > 0) text = c.activeTextValue;
                    } else {
                        colour = c.colour;
                        if (InterfaceList.mouseOverComponent === c && c.overColour !== 0) colour = c.overColour;
                    }
                    if (c.if3 && c.itemId !== -1) {
                        const item = ObjType.List(c.itemId);
                        text = item.name ?? JagString.nullString;
                        if ((item.stackable === 1 || c.itemCount !== 1) && c.itemCount !== -1) {
                            text = JagString.join([Minimenu.orange, text, Client.colEndTimes, Client.NiceNumber(c.itemCount)]);
                        }
                    }
                    if (InterfaceList.pressedContinue === c) {
                        colour = c.colour;
                        text = LocalisedText.PLEASEWAIT;
                    }
                    if (!c.if3) text = Client.SubstituteVars(text, c);
                    font.drawParagraph(text, x, y, c.width, c.height, colour, c.textShadow ? 0 : -1, c.textAlignH, c.textAlignV, c.lineSpacing);
                    continue;
                }
                if (c.type === 5) {
                    // lf.a(I[Laj;IIIIIIZI)V, 0ee0..1123.
                    if (!c.if3) {
                        const sprite = c.GetGraphic(Client.GetIfActive(c, glJar ? 69 : -117));
                        if (sprite !== null) sprite.draw(x, y);
                        else if (IfType.resourceMissing) Client.ComponentUpdated(c);
                        continue;
                    }
                    const sprite = c.itemId === -1 ? c.GetGraphic(false) : ObjType.GetSprite(c.itemId, c.outline, c.showItemCount, c.itemCount, c.spriteShadow);
                    if (sprite === null) {
                        if (IfType.resourceMissing) Client.ComponentUpdated(c);
                        continue;
                    }
                    let cropWidth: number, cropHeight: number;
                    if (glJar) {
                        cropWidth = sprite.cropW;
                        cropHeight = sprite.cropH;
                    } else {
                        cropHeight = sprite.cropH;
                        cropWidth = sprite.cropW;
                    }
                    if (!c.spriteTiling) {
                        const scale = intDivide(Math.imul(4096, c.width), cropWidth);
                        if (c.spriteAngle !== 0) {
                            sprite.drawRotatedCentred(c.spriteAngle, (y + intDivide(c.height, 2)) | 0, (intDivide(c.width, 2) + x) | 0, scale);
                        } else if (transparency === 0) {
                            if (cropWidth === c.width && c.height === cropHeight) sprite.draw(x, y);
                            else sprite.drawScaled(x, y, c.width, c.height);
                        } else sprite.drawScaledAlpha(x, y, c.width, c.height, 256 - (transparency & 255));
                    } else {
                        const columns = intDivide((cropWidth - (1 - c.width)) | 0, cropWidth);
                        const rows = intDivide((cropHeight - 1 + c.height) | 0, cropHeight);
                        if (renderer?.active) {
                            // HD gn.a, tiled IF3 graphic. The repeat test uses the trimmed dimensions.
                            const raster = requireNonNull(hdRaster);
                            raster.intersectClipping(x, y, (c.width + x) | 0, (c.height + y) | 0);
                            const repeatX = isPowerOfTwo(sprite.width);
                            const repeatY = isPowerOfTwo(sprite.height);
                            const GlSprite = loadGlSprite();
                            if (!(sprite instanceof GlSprite)) throw new TypeError('ClassCastException: expected GlSprite');
                            if (repeatX && repeatY) {
                                if (transparency !== 0) sprite.drawTiledAlpha(x, y, 256 - (transparency & 255), columns, rows);
                                else sprite.drawTiled(x, y, columns, rows);
                            } else if (repeatX) {
                                for (let row = 0; row < rows; row++) {
                                    const tileY = (y + Math.imul(row, cropHeight)) | 0;
                                    if (transparency === 0) sprite.drawTiled(x, tileY, columns, 1);
                                    else sprite.drawTiledAlpha(x, tileY, 256 - (transparency & 255), columns, 1);
                                }
                            } else if (!repeatY) {
                                for (let column = 0; column < columns; column++) {
                                    for (let row = 0; row < rows; row++) {
                                        const tileX = (x + Math.imul(column, cropWidth)) | 0;
                                        const tileY = (y + Math.imul(row, cropHeight)) | 0;
                                        if (transparency !== 0) sprite.drawAlpha(tileX, tileY, 256 - (transparency & 255));
                                        else sprite.draw(tileX, tileY);
                                    }
                                }
                            } else {
                                for (let column = 0; column < columns; column++) {
                                    const tileX = (x + Math.imul(column, cropWidth)) | 0;
                                    if (transparency !== 0) sprite.drawTiledAlpha(tileX, y, 256 - (transparency & 255), 1, rows);
                                    else sprite.drawTiled(tileX, y, 1, rows);
                                }
                            }
                            raster.setClipping(left, top, right, bottom);
                            continue;
                        }
                        Pix2D.intersectClipping(x, y, (c.width + x) | 0, (y + c.height) | 0);
                        for (let column = 0; column < columns; column++) {
                            for (let row = 0; row < rows; row++) {
                                if (c.spriteAngle === 0) {
                                    if (transparency === 0) sprite.draw((x + Math.imul(column, cropWidth)) | 0, (Math.imul(row, cropHeight) + y) | 0);
                                    else sprite.drawAlpha((Math.imul(column, cropWidth) + x) | 0, (y + Math.imul(cropHeight, row)) | 0, 256 - (transparency & 255));
                                } else {
                                    sprite.drawRotatedCentred(c.spriteAngle, (y + Math.imul(cropHeight, row) + intDivide(cropHeight, 2)) | 0, (intDivide(cropWidth, 2) + Math.imul(column, cropWidth) + x) | 0, 4096);
                                }
                            }
                        }
                        Pix2D.setClipping(left, top, right, bottom);
                    }
                    continue;
                }
                if (c.type === 6) {
                    // SD lf.a / HD gn.a: model component.
                    const active = Client.GetIfActive(c, glJar ? 110 : -17);
                    const sequenceId = active ? c.activeAnim : c.modelAnim;
                    let model: ModelLit | null = null;
                    let heightOffset = 0;
                    if (c.itemId === -1) {
                        if (c.modelType === 5) {
                            if (c.modelId !== -1) {
                                let index = c.modelId & 2047;
                                if (index === Client.localPid) index = 2047;
                                const player = arrayAtObj(Client.players, index);
                                const seq = sequenceId === -1 ? null : SeqType.List(sequenceId);
                                if (player !== null && Number(BigInt.asIntN(32, requireNonNull(player.username).toBase37())) << 11 === (c.modelId & -2048)) {
                                    model = requireNonNull(player.appearance).GetTempModel(0, -1, seq, c.modelFrame, true, null, 0, 0, true, null, -1);
                                }
                            } else {
                                model = Client.designAppearance.GetTempModel(-1, -1, null, -1, true, null, 0, 0, true, null, -1);
                            }
                        } else {
                            if (sequenceId === -1) {
                                model = c.GetTempModel(requireNonNull(Client.localPlayer).appearance, -1, -1, active, 0, false, null);
                            } else {
                                const seq = SeqType.List(sequenceId);
                                model = c.GetTempModel(requireNonNull(Client.localPlayer).appearance, c.modelNext, c.modelFrame, active, c.modelCycle, false, seq);
                            }
                            if (model === null && IfType.resourceMissing) Client.ComponentUpdated(c);
                        }
                    } else {
                        const item = ObjType.List(c.itemId);
                        if (item !== null) {
                            const variant = item.GetStackSizeAlt(c.itemCount);
                            const seq = sequenceId === -1 ? null : SeqType.List(sequenceId);
                            model = variant.GetModelLit(seq, c.modelFrame, 1, c.modelCycle, c.modelNext);
                            if (model === null) Client.ComponentUpdated(c);
                            else heightOffset = intDivide(-model.getMinY() | 0, 2);
                        }
                    }
                    if (model === null) continue;
                    let scaleX: number;
                    let scaleY: number;
                    if (glJar) {
                        scaleX = c.modelWidth > 0 ? intDivide(c.width << 8, c.modelWidth) : 256;
                        scaleY = c.modelHeight > 0 ? intDivide(c.height << 8, c.modelHeight) : 256;
                    } else {
                        scaleY = c.modelHeight > 0 ? intDivide(c.height << 8, c.modelHeight) : 256;
                        scaleX = c.modelWidth > 0 ? intDivide(c.width << 8, c.modelWidth) : 256;
                    }
                    const originX = ((Math.imul(scaleX, c.modelOriginX) >> 8) + x + intDivide(c.width, 2)) | 0;
                    const originY = ((Math.imul(c.modelOriginY, scaleY) >> 8) + y + intDivide(c.height, 2)) | 0;
                    if (renderer?.active) {
                        if (c.modelOrtho) {
                            renderer.setOrthographic(originX, originY, c.modelZoom, c.Vc, scaleX, scaleY);
                        } else {
                            renderer.setPerspective(originX, originY, scaleX, scaleY);
                            renderer.setDepthBias(c.o, Math.fround(1.5 * c.Vc));
                        }
                        renderer.applyLightingPreference();
                        renderer.setDepthTest(true);
                        renderer.setFog(false);
                        GlLighting.applyWidgetLighting(Preferences.brightness);
                        if (Client.clearInterfaceModelDepth) {
                            const raster = loadGlRaster();
                            raster.resetClipping();
                            renderer.clearDepth();
                            raster.setClipping(left, top, right, bottom);
                            Client.clearInterfaceModelDepth = false;
                        }
                        if (c.md) renderer.disableDepthWrite();
                        const rise = Math.imul(arrayAtI32(Pix3D.sinTable, c.modelXAngle), c.modelZoom) >> 16;
                        const depth = Math.imul(c.modelZoom, arrayAtI32(Pix3D.cosTable, c.modelXAngle)) >> 16;
                        if (c.if3) {
                            model.ObjRender(0, c.modelYAngle, c.modelZAngle, c.modelXAngle, c.modelOffsetX, (c.modelOffsetY + rise + heightOffset) | 0, (c.modelOffsetY + depth) | 0, -1n);
                        } else {
                            model.ObjRender(0, c.modelYAngle, 0, c.modelXAngle, 0, rise, depth, -1n);
                        }
                        if (c.md) renderer.enableDepthWrite();
                        continue;
                    }
                    Pix3D.setOrigin(originX, originY);
                    const rise = Math.imul(arrayAtI32(Pix3D.sinTable, c.modelXAngle), c.modelZoom) >> 16;
                    const depth = Math.imul(arrayAtI32(Pix3D.cosTable, c.modelXAngle), c.modelZoom) >> 16;
                    if (!c.if3) {
                        model.ObjRender(0, c.modelYAngle, 0, c.modelXAngle, 0, rise, depth, -1n);
                    } else if (c.modelOrtho) {
                        if (!(model instanceof ModelLitImpl)) throw new TypeError('ClassCastException: not a ModelLitImpl');
                        model.ObjRenderOrthog(0, c.modelYAngle, c.modelZAngle, c.modelXAngle, c.modelOffsetX, (c.modelOffsetY + heightOffset + rise) | 0, (depth + c.modelOffsetY) | 0, c.modelZoom);
                    } else {
                        model.ObjRender(0, c.modelYAngle, c.modelZAngle, c.modelXAngle, c.modelOffsetX, (heightOffset + rise + c.modelOffsetY) | 0, (c.modelOffsetY + depth) | 0, -1n);
                    }
                    Pix3D.resetOrigin();
                    continue;
                }
                if (c.type === 7) {
                    const font = c.GetFont(PixfontGeneric.nameIcons);
                    if (font === null) {
                        if (IfType.resourceMissing) Client.ComponentUpdated(c);
                        continue;
                    }
                    let slot = 0;
                    for (let row = 0; row < c.baseHeight; row++) {
                        for (let column = 0; column < c.baseWidth; column++) {
                            if (arrayAtI32(c.itemIds, slot) > 0) {
                                const obj = ObjType.List((arrayAtI32(c.itemIds, slot) - 1) | 0);
                                let label: JagString;
                                if (obj.stackable !== 1 && arrayAtI32(c.itemCounts, slot) === 1) {
                                    label = JagString.join([Minimenu.orange, obj.name, Client.colEndTag]);
                                } else {
                                    label = JagString.join([Minimenu.orange, obj.name, Client.colEndTimes, Client.NiceNumber(arrayAtI32(c.itemCounts, slot))]);
                                }
                                const cellX = (x + Math.imul((c.itemX + 115) | 0, column)) | 0;
                                const cellY = (y + Math.imul((12 + c.itemY) | 0, row)) | 0;
                                if (c.textAlignH === 0) font.drawLeft(label, cellX, cellY, c.colour, c.textShadow ? 0 : -1);
                                else if (c.textAlignH === 1) font.drawCentred(label, (cellX + 57) | 0, cellY, c.colour, c.textShadow ? 0 : -1);
                                else font.drawRight(label, (cellX + 114) | 0, cellY, c.colour, c.textShadow ? 0 : -1);
                            }
                            slot = (slot + 1) | 0;
                        }
                    }
                }
                if (c.type === 8 && c === Client.tooltipComponent && InterfaceList.tooltipDelay === Client.tooltipTimer) {
                    let boxWidth = 0;
                    let boxHeight = 0;
                    let text = c.textValue;
                    const font = Client.p12;
                    text = Client.SubstituteVars(text, c);
                    while (text.getLength() > 0) {
                        let line: JagString;
                        const br = text.indexOf(LocalisedText.TAG_BREAK);
                        if (br === -1) {
                            line = text;
                            text = JagString.empty;
                        } else {
                            line = text.substring(0, br);
                            text = text.substringFrom((4 + br) | 0);
                        }
                        const width = requireNonNull(font).stringWidth(line);
                        if (boxWidth < width) boxWidth = width;
                        boxHeight = (boxHeight + 1 + requireNonNull(font).lineHeight) | 0;
                    }
                    boxHeight = (boxHeight + 7) | 0;
                    boxWidth = (boxWidth + 6) | 0;
                    let boxY = (y + c.height + 5) | 0;
                    if (((boxY + boxHeight) | 0) > bottom) boxY = (bottom - boxHeight) | 0;
                    let boxX = (-5 + x + c.width - boxWidth) | 0;
                    if (((5 + x) | 0) > boxX) boxX = (5 + x) | 0;
                    if (((boxX + boxWidth) | 0) > right) boxX = (right - boxWidth) | 0;
                    const raster = renderer?.active ? requireNonNull(hdRaster) : Pix2D;
                    raster.fillRect(boxX, boxY, boxWidth, boxHeight, 16777120);
                    raster.drawRect(boxX, boxY, boxWidth, boxHeight, 0);
                    text = c.textValue;
                    let baseline = (2 + boxY + requireNonNull(font).lineHeight) | 0;
                    text = Client.SubstituteVars(text, c);
                    while (text.getLength() > 0) {
                        let line: JagString;
                        const br = text.indexOf(LocalisedText.TAG_BREAK);
                        if (br !== -1) {
                            line = text.substring(0, br);
                            text = text.substringFrom((4 + br) | 0);
                        } else {
                            line = text;
                            text = JagString.empty;
                        }
                        requireNonNull(font).drawLeft(line, (3 + boxX) | 0, baseline, 0, -1);
                        baseline = (baseline + 1 + requireNonNull(font).lineHeight) | 0;
                    }
                }
                if (c.type === 9) {
                    let endX: number, startY: number, endY: number;
                    if (!c.lineDirection) {
                        endY = (y + c.height) | 0;
                        startY = y;
                        endX = (x + c.width) | 0;
                    } else {
                        endX = (x + c.width) | 0;
                        startY = (y + c.height) | 0;
                        endY = y;
                    }
                    if (renderer?.active) {
                        const raster = loadGlRaster();
                        if (c.lineWidth === 1) raster.drawLine(x, startY, endX, endY, c.colour);
                        else raster.drawThickLine(x, startY, endX, endY, c.colour, c.lineWidth);
                    } else if (c.lineWidth === 1) Pix2D.drawLine2(x, startY, endX, endY, c.colour);
                    else Pix2D.drawThickLine(x, startY, endX, endY, c.colour, c.lineWidth);
                    continue;
                }
            }
            if (glJar && hdGuard <= 31) QuickChatCatTypeList.local = null;
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            if (glJar) {
                throw WrappedException.wrap(error, 'gn.B(' + [left, py, px, components === null ? 'null' : '{...}', right, parent, top, bottom, hdGuard, inheritedRoot].join(',') + ')');
            }
            throw WrappedException.wrap(error, 'lf.F(' + [py, components === null ? 'null' : '{...}', parent, bottom, top, inheritedRoot, right, px, true, left].join(',') + ')');
        }
    }

    // b.c(I)V. In build 216 the deferred drag pass is inside Client::DrawInterface (client.cpp:6965).
    static drawTopLevelInterface(): void {
        try {
            ComponentDrag.dragLayerComponents = null;
            InterfaceList.DrawInterface(GameShell.m_sHei, 0, 0, GameShell.m_sWid, 0, -1, 0, InterfaceList.top);
            if (ComponentDrag.dragLayerComponents !== null) {
                Client.DrawLayer(ComponentDrag.dragLayerY, ComponentDrag.dragLayerComponents, -1412584499, GameShell.m_sHei, 0, requireNonNull(ComponentDrag.parent).rootIndex, GameShell.m_sWid, ComponentDrag.dragLayerX, 0, ...(glJar ? [73] : []));
                ComponentDrag.dragLayerComponents = null;
            }
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'b.I(1)');
        }
    }

    // g.a(II)V. NXT Client::AnimateInterface.
    static AnimateInterface(group: number): void {
        if (IfType.OpenInterface(group)) Client.AnimateLayer(requireNonNull(arrayAtObj(IfType.m_list, group)), -1);
    }

    // fk.a(II[Laj;)V. NXT Client::AnimateLayer.
    static AnimateLayer(components: (IfType | null | undefined)[], parent: number): void {
        for (const c of components) {
            if (!c || c.parentId !== parent || (c.if3 && Client.Hide(c))) continue;
            if (c.type === 0) {
                if (!c.if3 && Client.Hide(c) && InterfaceList.mouseOverComponent !== c) continue;
                Client.AnimateLayer(components, c.id);
                if (c.childSlots !== null) Client.AnimateLayer(c.childSlots, c.id);
                const sub = InterfaceList.subInterfaces.get(BigInt(c.id));
                if (sub !== null) Client.AnimateInterface(sub.group);
            }
            if (c.type !== 6) continue;
            if (c.modelAnim !== -1 || c.activeAnim !== -1) {
                const id = Client.GetIfActive(c, glJar ? 33 : -74) ? c.activeAnim : c.modelAnim;
                if (id !== -1) {
                    const sequence = SeqType.List(id);
                    c.modelCycle = (c.modelCycle + AreaSoundManager.elapsed) | 0;
                    while (arrayAtI32(sequence.delays, c.modelFrame) < c.modelCycle) {
                        c.modelCycle = (c.modelCycle - arrayAtI32(sequence.delays, c.modelFrame)) | 0;
                        c.modelFrame = (c.modelFrame + 1) | 0;
                        const frames = requireNonNull(sequence.frames).length;
                        if (c.modelFrame >= frames) {
                            c.modelFrame = (c.modelFrame - sequence.m_loops) | 0;
                            if (c.modelFrame < 0 || c.modelFrame >= frames) c.modelFrame = 0;
                        }
                        c.modelNext = (c.modelFrame + 1) | 0;
                        if (c.modelNext >= frames) {
                            c.modelNext = (c.modelNext - sequence.m_loops) | 0;
                            if (c.modelNext < 0 || c.modelNext >= frames) c.modelNext = -1;
                        }
                        Client.ComponentUpdated(c);
                    }
                }
            }
            if (c.modelRotationSpeed !== 0 && !c.if3) {
                const x = Math.imul(c.modelRotationSpeed >> 16, AreaSoundManager.elapsed);
                const y = Math.imul((c.modelRotationSpeed << 16) >> 16, AreaSoundManager.elapsed);
                c.modelXAngle = (c.modelXAngle + x) & 2047;
                c.modelYAngle = (c.modelYAngle + y) & 2047;
                Client.ComponentUpdated(c);
            }
        }
    }

    // dk.b(BII)V. NXT Client::RunHookImmediate.
    static RunHookImmediate(group: number, reason: number, runner = Client.activeClient?.ui?.runner ?? new ScriptRunner(ClientScript.Get)): void | Promise<void> {
        if (IfType.OpenInterface(group)) {
            return Client.RunHookLayer(requireNonNull(arrayAtObj(IfType.m_list, group)), reason, runner);
        }
    }

    // ri.a(I[Laj;Z)V. NXT Client::RunHookLayer.
    static RunHookLayer(row: readonly (IfType | null | undefined)[], reason: number, runner = Client.activeClient?.ui?.runner ?? new ScriptRunner(ClientScript.Get)): void | Promise<void> {
        return runToCompletion(
            (function* (): Generator<Promise<void>, void, void> {
                for (const c of row) {
                    if (c == null) continue;
                    if (c.type === 0) {
                        if (c.childSlots !== null) {
                            const children = Client.RunHookLayer(c.childSlots, reason, runner);
                            if (children instanceof Promise) yield children;
                        }
                        const sub = InterfaceList.subInterfaces.get(BigInt(c.id));
                        if (sub !== null) {
                            const mounted = Client.RunHookImmediate(sub.group, reason, runner);
                            if (mounted instanceof Promise) yield mounted;
                        }
                    }
                    if (reason === 0 && c.onDialogAbort !== null) {
                        const event = new HookReq();
                        event.args = c.onDialogAbort;
                        event.component = c;
                        const pending = runner.run(event);
                        if (pending instanceof Promise) yield pending;
                    }
                    if (reason === 1 && c.onSubChange !== null) {
                        if (c.childId >= 0) {
                            const parent = IfType.Get(c.id);
                            if (parent === null || parent.childSlots === null || parent.childSlots.length <= c.childId || arrayAtObj(parent.childSlots, c.childId) !== c) continue;
                        }
                        const event = new HookReq();
                        event.args = c.onSubChange;
                        event.component = c;
                        const pending = runner.run(event);
                        if (pending instanceof Promise) yield pending;
                    }
                }
            })()
        );
    }

    // dd.a(IIIIBIII)V. NXT Client::LoopInterface.
    static LoopInterface(group: number, left: number, top: number, right: number, bottom: number, x: number, y: number): void | Promise<void> {
        if (IfType.OpenInterface(group)) {
            return Client.LoopLayer(requireNonNull(arrayAtObj(IfType.m_list, group)), -1, left, top, right, bottom, x, y);
        }
    }

    // client.a([Laj;IIIIIII)V. NXT Client::LoopLayer.
    static LoopLayer(row: readonly (IfType | null | undefined)[], parent: number, left: number, top: number, right: number, bottom: number, offsetX: number, offsetY: number): void | Promise<void> {
        return runToCompletion(
            (function* (): Generator<Promise<void>, void, void> {
                for (let index = 0; index < row.length; index++) {
                    const c = arrayAtObj(row, index);
                    if (c == null || c.parentId !== parent || (c.if3 && c.type !== 0 && !c.hasHook && Client.GetActive(c).events === 0 && c !== ComponentDrag.parent && c.clientCode !== 1338)) continue;
                    if (c.if3 && Client.Hide(c)) continue;
                    const x = (offsetX + c.x) | 0,
                        y = (offsetY + c.y) | 0;
                    let l = left,
                        t = top,
                        r = right,
                        b = bottom;
                    if (c.type !== 2) {
                        let endX = (x + c.width) | 0;
                        let endY = (y + c.height) | 0;
                        if (c.type === 9) {
                            endX = (endX + 1) | 0;
                            endY = (endY + 1) | 0;
                        }
                        l = Math.max(x, left);
                        t = Math.max(y, top);
                        r = Math.min(endX, right);
                        b = Math.min(endY, bottom);
                    }
                    if (c === ComponentDrag.component) {
                        ComponentDrag.visible = true;
                        ComponentDrag.x = x;
                        ComponentDrag.y = y;
                    }
                    if (c.if3 && (l >= r || t >= b)) continue;
                    if (c.type === 0) {
                        if (!c.if3 && Client.Hide(c) && c !== InterfaceList.mouseOverComponent) continue;
                        if (c.noClickThrough && ClientMouseListener.x >= l && ClientMouseListener.mouseY >= t && ClientMouseListener.x < r && ClientMouseListener.mouseY < b) {
                            for (let event = requireNonNull(Client.m_hookQueue).head(); event !== null; event = requireNonNull(Client.m_hookQueue).next()) {
                                if (!(event instanceof HookReq)) throw new TypeError('ClassCastException: not a HookReq');
                                if (event.mouseInput) {
                                    event.Unlink();
                                    requireNonNull(event.component).mouseOver = false;
                                }
                            }
                            if (ComponentDrag.cycles === 0) {
                                ComponentDrag.component = null;
                                ComponentDrag.parent = null;
                            }
                            WorldMap.dragging = 0;
                        }
                    }
                    if (c.if3) {
                        let inside = ClientMouseListener.x >= l && ClientMouseListener.mouseY >= t && ClientMouseListener.x < r && ClientMouseListener.mouseY < b;
                        let held = ClientMouseListener.mouseButton === 1 && inside;
                        let click = ClientMouseListener.clickButton === 1 && ClientMouseListener.clickX >= l && ClientMouseListener.clickY >= t && ClientMouseListener.clickX < r && ClientMouseListener.clickY < b;
                        if (c.opKeyCode !== null) {
                            for (let slot = 0; slot < c.opKeyCode.length; slot++) {
                                if (!arrayAtObj(ClientKeyboardListener.pressed, arrayAtI8(c.opKeyCode, slot))) {
                                    if (c.keyNextCycles !== null) arrayPutI32(c.keyNextCycles, slot, 0);
                                } else if (c.keyNextCycles === null || Client.loopCycle >= arrayAtI32(c.keyNextCycles, slot)) {
                                    const modifier = arrayAtI8(c.opKeyModifier, slot);
                                    if (
                                        modifier === 0 ||
                                        (((modifier & 2) === 0 || arrayAtObj(ClientKeyboardListener.pressed, 86)) &&
                                            ((modifier & 1) === 0 || arrayAtObj(ClientKeyboardListener.pressed, 82)) &&
                                            ((modifier & 4) === 0 || arrayAtObj(ClientKeyboardListener.pressed, 81)))
                                    ) {
                                        const pending = Client.IfButtonX(JagString.empty, -1, c.id, slot + 1);
                                        if (pending instanceof Promise) yield pending;
                                        const rate = arrayAtI32(c.opKeyRate, slot);
                                        if (c.keyNextCycles === null) c.keyNextCycles = new Int32Array(c.opKeyCode.length);
                                        arrayPutI32(c.keyNextCycles, slot, rate === 0 ? 2147483647 : (Client.loopCycle + rate) | 0);
                                    }
                                }
                            }
                        }
                        if (click) {
                            if (glJar) {
                                const relativeY = (ClientMouseListener.clickY - y) | 0;
                                Client.DragTryPickup((ClientMouseListener.clickX - x) | 0, c, relativeY);
                            } else Client.DragTryPickup((ClientMouseListener.clickX - x) | 0, c, (ClientMouseListener.clickY - y) | 0);
                        }
                        if (ComponentDrag.component !== null && ComponentDrag.component !== c && inside && Client.GetActive(c).isDragTarget()) ComponentDrag.target = c;
                        if (c === ComponentDrag.parent) {
                            ComponentDrag.parentVisible = true;
                            ComponentDrag.parentX = x;
                            ComponentDrag.parentY = y;
                        }
                        if (c.hasHook || c.clientCode !== 0) {
                            if (inside && MouseWheel.rotation !== 0 && c.onScrollWheel !== null) {
                                const event = new HookReq();
                                event.mouseInput = true;
                                event.component = c;
                                event.mouseY = MouseWheel.rotation;
                                event.args = c.onScrollWheel;
                                requireNonNull(Client.m_hookQueue).push_back(event);
                            }
                            if (ComponentDrag.component !== null || Minimenu.objDragComponent !== null || Minimenu.isOpen || (c.clientCode !== 1400 && WorldMap.dragging > 0)) click = held = inside = false;
                            if (c.clientCode === 1337) {
                                InterfaceList.viewportComponent = c;
                                Client.ComponentUpdated(c);
                                continue;
                            }
                            if (c.clientCode === 1338) {
                                if (click) {
                                    Client.minimapClickX = (ClientMouseListener.clickX - x) | 0;
                                    Client.minimapClickY = (ClientMouseListener.clickY - y) | 0;
                                }
                                continue;
                            }
                            if (c.clientCode === 1400) {
                                WorldMap.component = c;
                                if (click) {
                                    if (ClientKeyboardListener.pressed[82] && Client.staffModLevel > 0) {
                                        const dx = doubleToInt((((ClientMouseListener.clickX - x - ((c.width / 2) | 0)) | 0) * 2) / WorldMap.zoom);
                                        const dz = doubleToInt((((ClientMouseListener.clickY - y - ((c.height / 2) | 0)) | 0) * 2) / WorldMap.zoom);
                                        const mapX = (WorldMap.centerX + dx) | 0;
                                        const mapZ = (WorldMap.centerZ + dz) | 0;
                                        WorldMap.teleport((mapX + WorldMap.baseX) | 0, (WorldMap.height - 1 - mapZ + WorldMap.baseZ) | 0, 0);
                                        const closed = Client.CloseModal();
                                        if (closed instanceof Promise) yield closed;
                                        continue;
                                    }
                                    WorldMap.dragging = 1;
                                    ComponentDrag.dragMouseX = ClientMouseListener.x;
                                    ComponentDrag.dragMouseY = ClientMouseListener.mouseY;
                                } else if (held && WorldMap.dragging > 0) {
                                    if (WorldMap.dragging === 1 && (ComponentDrag.dragMouseX !== ClientMouseListener.x || ComponentDrag.dragMouseY !== ClientMouseListener.mouseY)) {
                                        WorldMap.dragStartX = WorldMap.centerX;
                                        WorldMap.dragStartZ = WorldMap.centerZ;
                                        WorldMap.dragging = 2;
                                    }
                                    if (WorldMap.dragging === 2) {
                                        WorldMap.setX((WorldMap.dragStartX + doubleToInt((((ComponentDrag.dragMouseX - ClientMouseListener.x) | 0) * 2) / WorldMap.targetZoom)) | 0, -1);
                                        WorldMap.setZ((WorldMap.dragStartZ + doubleToInt((((ComponentDrag.dragMouseY - ClientMouseListener.mouseY) | 0) * 2) / WorldMap.targetZoom)) | 0);
                                    }
                                } else WorldMap.dragging = 0;
                                continue;
                            }
                            if (c.clientCode === 1401) {
                                if (held) WorldMap.scrollOverview(c.width, (ClientMouseListener.mouseY - y) | 0, (ClientMouseListener.x - x) | 0, c.height);
                                continue;
                            }
                            if (c.clientCode === 1402) {
                                if (!glJar || !GlRendererClass.active) {
                                    Client.ComponentUpdated(c);
                                }
                                continue;
                            }
                            if (!c.pressed && click) {
                                c.pressed = true;
                                if (c.onClick !== null) {
                                    const event = new HookReq();
                                    event.mouseInput = true;
                                    event.component = c;
                                    event.mouseX = (ClientMouseListener.clickX - x) | 0;
                                    event.mouseY = (ClientMouseListener.clickY - y) | 0;
                                    event.args = c.onClick;
                                    requireNonNull(Client.m_hookQueue).push_back(event);
                                }
                            }
                            if (c.pressed && held && c.onClickRepeat !== null) {
                                const event = new HookReq();
                                event.mouseInput = true;
                                event.component = c;
                                event.mouseX = (ClientMouseListener.x - x) | 0;
                                event.mouseY = (ClientMouseListener.mouseY - y) | 0;
                                event.args = c.onClickRepeat;
                                requireNonNull(Client.m_hookQueue).push_back(event);
                            }
                            if (c.pressed && !held) {
                                c.pressed = false;
                                if (c.onRelease !== null) {
                                    const event = new HookReq();
                                    event.mouseInput = true;
                                    event.component = c;
                                    event.mouseX = (ClientMouseListener.x - x) | 0;
                                    event.mouseY = (ClientMouseListener.mouseY - y) | 0;
                                    event.args = c.onRelease;
                                    requireNonNull(Client.mouseExit).push_back(event);
                                }
                            }
                            if (held && c.onHold !== null) {
                                const event = new HookReq();
                                event.mouseInput = true;
                                event.component = c;
                                event.mouseX = (ClientMouseListener.x - x) | 0;
                                event.mouseY = (ClientMouseListener.mouseY - y) | 0;
                                event.args = c.onHold;
                                requireNonNull(Client.m_hookQueue).push_back(event);
                            }
                            if (!c.mouseOver && inside) {
                                c.mouseOver = true;
                                if (c.onMouseOver !== null) {
                                    const event = new HookReq();
                                    event.mouseInput = true;
                                    event.component = c;
                                    event.mouseX = (ClientMouseListener.x - x) | 0;
                                    event.mouseY = (ClientMouseListener.mouseY - y) | 0;
                                    event.args = c.onMouseOver;
                                    requireNonNull(Client.m_hookQueue).push_back(event);
                                }
                            }
                            if (c.mouseOver && inside && c.onMouseRepeat !== null) {
                                const event = new HookReq();
                                event.mouseInput = true;
                                event.component = c;
                                event.mouseX = (ClientMouseListener.x - x) | 0;
                                event.mouseY = (ClientMouseListener.mouseY - y) | 0;
                                event.args = c.onMouseRepeat;
                                requireNonNull(Client.m_hookQueue).push_back(event);
                            }
                            if (c.mouseOver && !inside) {
                                c.mouseOver = false;
                                if (c.onMouseLeave !== null) {
                                    const event = new HookReq();
                                    event.mouseInput = true;
                                    event.component = c;
                                    event.mouseX = (ClientMouseListener.x - x) | 0;
                                    event.mouseY = (ClientMouseListener.mouseY - y) | 0;
                                    event.args = c.onMouseLeave;
                                    requireNonNull(Client.mouseExit).push_back(event);
                                }
                            }
                            if (c.onTimer !== null) {
                                const event = new HookReq();
                                event.component = c;
                                event.args = c.onTimer;
                                requireNonNull(Client.timerEvents).push_back(event);
                            }
                            if (c.onVarcTransmit !== null && Client.varcChanges > c.lastVarcTransmit) {
                                if (c.varcTriggers !== null && ((Client.varcChanges - c.lastVarcTransmit) | 0) <= 32) {
                                    varcTriggersChanged: for (let i = c.lastVarcTransmit; i < Client.varcChanges; i = (i + 1) | 0) {
                                        const changed = arrayAtI32(Client.updatedVarcs, i & 31);
                                        for (let k = 0; k < requireNonNull(c.varcTriggers).length; k++) {
                                            if (arrayAtI32(c.varcTriggers, k) === changed) {
                                                const event = new HookReq();
                                                event.component = c;
                                                event.args = c.onVarcTransmit;
                                                requireNonNull(Client.m_hookQueue).push_back(event);
                                                break varcTriggersChanged;
                                            }
                                        }
                                    }
                                } else {
                                    const event = new HookReq();
                                    event.component = c;
                                    event.args = c.onVarcTransmit;
                                    requireNonNull(Client.m_hookQueue).push_back(event);
                                }
                                c.lastVarcTransmit = Client.varcChanges;
                            }
                            if (c.onVarcstrTransmit !== null && Client.varcStrChangeCount > c.lastVarcStringTransmit) {
                                if (c.varcstrTriggers !== null && ((Client.varcStrChangeCount - c.lastVarcStringTransmit) | 0) <= 32) {
                                    varcstrTriggersChanged: for (let i = c.lastVarcStringTransmit; i < Client.varcStrChangeCount; i = (i + 1) | 0) {
                                        const changed = arrayAtI32(Client.updatedVarcStrings, i & 31);
                                        for (let k = 0; k < requireNonNull(c.varcstrTriggers).length; k++) {
                                            if (arrayAtI32(c.varcstrTriggers, k) === changed) {
                                                const event = new HookReq();
                                                event.component = c;
                                                event.args = c.onVarcstrTransmit;
                                                requireNonNull(Client.m_hookQueue).push_back(event);
                                                break varcstrTriggersChanged;
                                            }
                                        }
                                    }
                                } else {
                                    const event = new HookReq();
                                    event.component = c;
                                    event.args = c.onVarcstrTransmit;
                                    requireNonNull(Client.m_hookQueue).push_back(event);
                                }
                                c.lastVarcStringTransmit = Client.varcStrChangeCount;
                            }
                            if (c.onVarTransmit !== null && Client.varpTransmitCount > c.lastVarTransmit) {
                                if (c.varTriggers !== null && ((Client.varpTransmitCount - c.lastVarTransmit) | 0) <= 32) {
                                    varTriggersChanged: for (let i = c.lastVarTransmit; i < Client.varpTransmitCount; i = (i + 1) | 0) {
                                        const changed = arrayAtI32(Client.varpUpdates, i & 31);
                                        for (let k = 0; k < requireNonNull(c.varTriggers).length; k++) {
                                            if (arrayAtI32(c.varTriggers, k) === changed) {
                                                const event = new HookReq();
                                                event.component = c;
                                                event.args = c.onVarTransmit;
                                                requireNonNull(Client.m_hookQueue).push_back(event);
                                                break varTriggersChanged;
                                            }
                                        }
                                    }
                                } else {
                                    const event = new HookReq();
                                    event.component = c;
                                    event.args = c.onVarTransmit;
                                    requireNonNull(Client.m_hookQueue).push_back(event);
                                }
                                c.lastVarTransmit = Client.varpTransmitCount;
                            }
                            if (c.onInvTransmit !== null && Client.invTransmitCount > c.lastInvTransmit) {
                                if (c.invTriggers !== null && ((Client.invTransmitCount - c.lastInvTransmit) | 0) <= 32) {
                                    invTriggersChanged: for (let i = c.lastInvTransmit; i < Client.invTransmitCount; i = (i + 1) | 0) {
                                        const changed = arrayAtI32(Client.changedInvs, i & 31);
                                        for (let k = 0; k < requireNonNull(c.invTriggers).length; k++) {
                                            if (arrayAtI32(c.invTriggers, k) === changed) {
                                                const event = new HookReq();
                                                event.component = c;
                                                event.args = c.onInvTransmit;
                                                requireNonNull(Client.m_hookQueue).push_back(event);
                                                break invTriggersChanged;
                                            }
                                        }
                                    }
                                } else {
                                    const event = new HookReq();
                                    event.component = c;
                                    event.args = c.onInvTransmit;
                                    requireNonNull(Client.m_hookQueue).push_back(event);
                                }
                                c.lastInvTransmit = Client.invTransmitCount;
                            }
                            if (c.onStatTransmit !== null && Client.changedStatCount > c.lastStatTransmit) {
                                if (c.statTriggers !== null && ((Client.changedStatCount - c.lastStatTransmit) | 0) <= 32) {
                                    statTriggersChanged: for (let i = c.lastStatTransmit; i < Client.changedStatCount; i = (i + 1) | 0) {
                                        const changed = arrayAtI32(Client.statUpdates, i & 31);
                                        for (let k = 0; k < requireNonNull(c.statTriggers).length; k++) {
                                            if (arrayAtI32(c.statTriggers, k) === changed) {
                                                const event = new HookReq();
                                                event.component = c;
                                                event.args = c.onStatTransmit;
                                                requireNonNull(Client.m_hookQueue).push_back(event);
                                                break statTriggersChanged;
                                            }
                                        }
                                    }
                                } else {
                                    const event = new HookReq();
                                    event.component = c;
                                    event.args = c.onStatTransmit;
                                    requireNonNull(Client.m_hookQueue).push_back(event);
                                }
                                c.lastStatTransmit = Client.changedStatCount;
                            }
                            if (Client.chatTransmitCycle > c.lastTransmitCycle && c.onChatTransmit !== null) {
                                const event = new HookReq();
                                event.component = c;
                                event.args = c.onChatTransmit;
                                requireNonNull(Client.m_hookQueue).push_back(event);
                            }
                            if (Client.friendListTransmitCycle > c.lastTransmitCycle && c.onFriendTransmit !== null) {
                                const event = new HookReq();
                                event.component = c;
                                event.args = c.onFriendTransmit;
                                requireNonNull(Client.m_hookQueue).push_back(event);
                            }
                            if (Client.clanTransmitCycle > c.lastTransmitCycle && c.onClanTransmit !== null) {
                                const event = new HookReq();
                                event.component = c;
                                event.args = c.onClanTransmit;
                                requireNonNull(Client.m_hookQueue).push_back(event);
                            }
                            if (Client.stockTransmitCycle > c.lastTransmitCycle && c.onStockTransmit !== null) {
                                const event = new HookReq();
                                event.component = c;
                                event.args = c.onStockTransmit;
                                requireNonNull(Client.m_hookQueue).push_back(event);
                            }
                            if (InterfaceList.miscTransmitAt > c.lastTransmitCycle && c.onMiscTransmit !== null) {
                                const event = new HookReq();
                                event.component = c;
                                event.args = c.onMiscTransmit;
                                requireNonNull(Client.m_hookQueue).push_back(event);
                            }
                            c.lastTransmitCycle = Client.transmitCycle;
                            if (c.onKey !== null) {
                                for (let k = 0; k < ClientKeyboardListener.count; k++) {
                                    const event = new HookReq();
                                    event.component = c;
                                    event.keyCode = arrayAtI32(ClientKeyboardListener.codes, k);
                                    event.keyChar = arrayAtI32(ClientKeyboardListener.chars, k);
                                    event.args = c.onKey;
                                    requireNonNull(Client.m_hookQueue).push_back(event);
                                }
                            }
                            if (CinematicCamera.justEnded && c.onCamFinished !== null) {
                                const event = new HookReq();
                                event.component = c;
                                event.args = c.onCamFinished;
                                requireNonNull(Client.m_hookQueue).push_back(event);
                            }
                        }
                    }
                    if (!c.if3 && ComponentDrag.component === null && Minimenu.objDragComponent === null && !Minimenu.isOpen) {
                        if ((c.overLayer >= 0 || c.overColour !== 0) && ClientMouseListener.x >= l && ClientMouseListener.mouseY >= t && ClientMouseListener.x < r && ClientMouseListener.mouseY < b)
                            InterfaceList.mouseOverComponent = c.overLayer >= 0 ? (arrayAtObj(row, c.overLayer) ?? null) : c;
                        if (c.type === 8 && ClientMouseListener.x >= l && ClientMouseListener.mouseY >= t && ClientMouseListener.x < r && ClientMouseListener.mouseY < b) Client.tooltipComponent = c;
                        if (c.scrollHeight > c.height) Client.DoScrollbar(c, (x + c.width) | 0, y, c.height, c.scrollHeight, ClientMouseListener.x, ClientMouseListener.mouseY);
                    }
                    if (c.type === 0) {
                        const children = Client.LoopLayer(row, c.id, l, t, r, b, (x - c.scrollX) | 0, (y - c.scrollY) | 0);
                        if (children instanceof Promise) yield children;
                        if (c.childSlots !== null) {
                            const dynamic = Client.LoopLayer(c.childSlots, c.id, l, t, r, b, (x - c.scrollX) | 0, (y - c.scrollY) | 0);
                            if (dynamic instanceof Promise) yield dynamic;
                        }
                        const sub = InterfaceList.subInterfaces.get(BigInt(c.id));
                        if (sub !== null && !(sub instanceof SubInterface)) throw new TypeError('ClassCastException: not a SubInterface');
                        if (sub !== null) {
                            const mounted = Client.LoopInterface(sub.group, l, t, r, b, x, y);
                            if (mounted instanceof Promise) yield mounted;
                        }
                    }
                }
            })()
        );
    }

    // fl.b(B)V. NXT Client::LoopIf3Drag.
    static LoopIf3Drag(runner: Pick<ScriptRunner, 'run'> | undefined = Client.activeClient?.ui?.runner, ui?: InterfaceSession): void | Promise<void> {
        return runToCompletion(
            (function* (): Generator<Promise<void>, void, void> {
                const c = requireNonNull(ComponentDrag.component);
                Client.ComponentUpdated(c);
                ComponentDrag.cycles = (ComponentDrag.cycles + 1) | 0;
                if (!ComponentDrag.visible || !ComponentDrag.parentVisible) {
                    if (ComponentDrag.cycles > 1) ComponentDrag.component = null;
                    return;
                }
                let y = (ClientMouseListener.mouseY - ComponentDrag.dragMouseY) | 0;
                let x = (ClientMouseListener.x - ComponentDrag.dragMouseX) | 0;
                const deadZone = c.dragDeadZone;
                if (x < ComponentDrag.parentX) x = ComponentDrag.parentX;
                const p = requireNonNull(ComponentDrag.parent);
                if (((p.width + ComponentDrag.parentX) | 0) < ((x + c.width) | 0)) x = (ComponentDrag.parentX + p.width - c.width) | 0;
                const dx = (x - ComponentDrag.x) | 0;
                const localX = (x + p.scrollX - ComponentDrag.parentX) | 0;
                if (y < ComponentDrag.parentY) y = ComponentDrag.parentY;
                if (((p.height + ComponentDrag.parentY) | 0) < ((y + c.height) | 0)) y = (p.height + ComponentDrag.parentY - c.height) | 0;
                const dy = (y - ComponentDrag.y) | 0;
                const localY = (p.scrollY - ComponentDrag.parentY + y) | 0;
                if (c.dragDeadTime < ComponentDrag.cycles && (dx > deadZone || dx < (-deadZone | 0) || dy > deadZone || dy < (-deadZone | 0))) {
                    ComponentDrag.started = true;
                }
                if (c.onDrag !== null && ComponentDrag.started) {
                    const event = new HookReq();
                    event.component = c;
                    event.args = c.onDrag;
                    event.mouseY = localY;
                    event.mouseX = localX;
                    const pending = requireNonNull(runner).run(event);
                    if (pending instanceof Promise) yield pending;
                }
                if (ClientMouseListener.mouseButton !== 0) return;
                if (ComponentDrag.started) {
                    const source = requireNonNull(ComponentDrag.component);
                    if (source.onDragComplete !== null) {
                        const event = new HookReq();
                        event.mouseY = localY;
                        event.args = source.onDragComplete;
                        event.mouseX = localX;
                        event.component = source;
                        event.dragTarget = ComponentDrag.target;
                        const pending = requireNonNull(runner).run(event);
                        if (pending instanceof Promise) yield pending;
                    }
                    if (ComponentDrag.target !== null && Client.ServerDraggable(requireNonNull(ComponentDrag.component)) !== null) {
                        const out = Client.out;
                        out.pHead(79);
                        out.p4_alt3(requireNonNull(ComponentDrag.component).id);
                        out.p2_alt1(ComponentDrag.target.childId);
                        out.p4(ComponentDrag.target.id);
                        out.p2_alt1(requireNonNull(ComponentDrag.component).childId);
                    }
                } else if ((Client.m_usingOneButtonMouse === 1 || Minimenu.MenuOnly((Minimenu.count - 1) | 0)) && Minimenu.count > 2) {
                    Minimenu.Open();
                } else if (Minimenu.count > 0) {
                    const pending = Minimenu.useTopOption(ui);
                    if (pending instanceof Promise) yield pending;
                }
                ComponentDrag.component = null;
            })()
        );
    }

    // pa.a(Laj;IZII)V
    static InterfaceCalculateSize(c: IfType, width: number, resize: boolean, height: number): void {
        try {
            const oldWidth = c.width,
                oldHeight = c.height;
            if (c.heightMode === 0) c.height = c.baseHeight;
            else if (c.heightMode === 1) c.height = (height - c.baseHeight) | 0;
            else if (c.heightMode === 2) c.height = Math.imul(c.baseHeight, height) >> 14;
            else if (c.heightMode === 3) {
                if (c.type === 2) c.height = (Math.imul(32, c.baseHeight) + Math.imul(c.baseHeight - 1, c.itemY)) | 0;
                else if (c.type === 7) c.height = (Math.imul(c.baseHeight, 12) + Math.imul(c.itemY, c.baseHeight - 1)) | 0;
            }
            if (c.widthMode === 0) c.width = c.baseWidth;
            else if (c.widthMode === 1) c.width = (width - c.baseWidth) | 0;
            else if (c.widthMode === 2) c.width = Math.imul(c.baseWidth, width) >> 14;
            else if (c.widthMode === 3) {
                if (c.type === 2) c.width = (Math.imul(32, c.baseWidth) + Math.imul(c.baseWidth - 1, c.itemX)) | 0;
                else if (c.type === 7) c.width = (Math.imul(c.baseWidth, 115) + Math.imul(c.itemX, c.baseWidth - 1)) | 0;
            }
            if (c.widthMode === 4) c.width = intDivide(Math.imul(c.aspectWidth, c.height), c.aspectHeight);
            if (c.heightMode === 4) c.height = intDivide(Math.imul(c.aspectHeight, c.width), c.aspectWidth);

            if (Client.qaOpTest && (Client.GetActive(c).events !== 0 || c.type === 0)) {
                if (c.height < 5 && c.width < 5) {
                    c.height = 5;
                    c.width = 5;
                } else {
                    if (c.height <= 0) c.height = 5;
                    if (c.width <= 0) c.width = 5;
                }
            }
            if (c.clientCode === 1337) InterfaceList.viewportComponent = c;
            if (resize && c.onResize !== null && (oldWidth !== c.width || oldHeight !== c.height)) {
                const event = new HookReq();
                event.component = c;
                event.args = c.onResize;
                requireNonNull(Client.m_hookQueue).push_back(event);
            }
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'pa.FA(' + (c === null ? 'null' : '{...}') + ',' + width + ',' + resize + ',' + height + ',2)');
        }
    }

    // gh.a(Laj;BII)V
    static InterfaceCalculatePosition(c: IfType, guard: number, width: number, height: number): void {
        try {
            if (c.xMode === 0) c.x = c.baseX;
            else if (c.xMode === 1) c.x = (c.baseX + intDivide((width - c.width) | 0, 2)) | 0;
            else if (c.xMode === 2) c.x = (width - c.width - c.baseX) | 0;
            else if (c.xMode === 3) c.x = Math.imul(width, c.baseX) >> 14;
            else if (c.xMode === 4) c.x = (intDivide((width - c.width) | 0, 2) + (Math.imul(c.baseX, width) >> 14)) | 0;
            else c.x = (-(Math.imul(c.baseX, width) >> 14) + width - c.width) | 0;
            if (c.yMode === 0) c.y = c.baseY;
            else if (c.yMode === 1) c.y = (c.baseY + intDivide((-c.height + height) | 0, 2)) | 0;
            else if (c.yMode === 2) c.y = (height - c.height - c.baseY) | 0;
            else if (c.yMode === 3) c.y = Math.imul(height, c.baseY) >> 14;
            else if (c.yMode === 4) c.y = ((Math.imul(c.baseY, height) >> 14) + intDivide((-c.height + height) | 0, 2)) | 0;
            else c.y = (height - c.height - (Math.imul(height, c.baseY) >> 14)) | 0;
            if (Client.qaOpTest && (Client.GetActive(c).events !== 0 || c.type === 0)) {
                if (c.y < 0) c.y = 0;
                else if (((c.y + c.height) | 0) > height) c.y = (height - c.height) | 0;
                if (c.x < 0) c.x = 0;
                else if (((c.x + c.width) | 0) > width) c.x = (width - c.width) | 0;
            }
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'gh.F(' + (c === null ? 'null' : '{...}') + ',' + guard + ',' + width + ',' + height + ')');
        }
    }

    // ik.a(ILaj;)V
    static InterfaceCalculateSizeAndPosComponent(c: IfType): void {
        const parent = InterfaceList.getParent(c);
        let width: number, height: number;
        if (parent === null) {
            height = GameShell.m_sHei;
            width = GameShell.m_sWid;
        } else {
            width = parent.width;
            height = parent.height;
        }
        Client.InterfaceCalculateSize(c, width, false, height);
        Client.InterfaceCalculatePosition(c, -76, width, height);
    }

    // hf.a(IIIB[Laj;Z)V
    static InterfaceCalculateSizeAndPosArray(width: number, height: number, parent: number, components: (IfType | undefined | null)[] | null, resize: boolean): void {
        try {
            for (let i = 0; i < requireNonNull(components).length; i++) {
                const c = arrayAtObj(components, i);
                if (!c || c.parentId !== parent) continue;
                Client.InterfaceCalculateSize(c, width, resize, height);
                Client.InterfaceCalculatePosition(c, -116, width, height);
                if (((-c.width + c.scrollWidth) | 0) < c.scrollX) c.scrollX = (-c.width + c.scrollWidth) | 0;
                if (c.scrollY > ((c.scrollHeight - c.height) | 0)) c.scrollY = (-c.height + c.scrollHeight) | 0;
                if (c.scrollY < 0) c.scrollY = 0;
                if (c.scrollX < 0) c.scrollX = 0;
                if (c.type === 0) Client.InterfaceCalculateSizeAndPosSubcomponents(resize, c);
            }
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'hf.B(' + width + ',' + height + ',' + parent + ',100,' + (components === null ? 'null' : '{...}') + ',' + resize + ')');
        }
    }

    // mi.a(ZLaj;I)V
    static InterfaceCalculateSizeAndPosSubcomponents(resize: boolean, c: IfType): void {
        const width = c.scrollWidth !== 0 ? c.scrollWidth : c.width;
        const height = c.scrollHeight !== 0 ? c.scrollHeight : c.height;
        Client.InterfaceCalculateSizeAndPosArray(width, height, c.id, arrayAtObj(IfType.m_list, c.id >> 16), resize);
        if (c.childSlots !== null) Client.InterfaceCalculateSizeAndPosArray(width, height, c.id, c.childSlots, resize);
        const table = InterfaceList.subInterfaces,
            key = BigInt(c.id);
        const sub = table.get(key);
        if (sub !== null) {
            if (!(sub instanceof SubInterface)) throw new TypeError('ClassCastException: not a SubInterface');
            Client.InterfaceCalculateSizeAndPosInterface(resize, height, width, sub.group);
        }
    }

    // rb.a(ZIBII)V
    static InterfaceCalculateSizeAndPosInterface(resize: boolean, height: number, width: number, id: number): void {
        if (IfType.OpenInterface(id, false)) {
            Client.InterfaceCalculateSizeAndPosArray(width, height, -1, arrayAtObj(IfType.m_list, id), resize);
        }
    }

    // ik.a(ZZ)V
    static InterfaceCalculateSizeAndPosAll(resize: boolean): void {
        Client.InterfaceCalculateSizeAndPosInterface(resize, GameShell.m_sHei, GameShell.m_sWid, InterfaceList.top);
    }

    // mj.a(Laj;IB)I. NXT Client::GetIfVar.
    static GetIfVar(component: IfType, index: number): number {
        if (component.scripts === null || index >= component.scripts.length) return -2;
        try {
            const script = arrayAtObj(component.scripts, index);
            let pc = 0,
                value = 0,
                operation = 0;
            const read = () => arrayAtI32(script, pc++);
            for (;;) {
                const opcode = read();
                let operand = 0;
                switch (opcode) {
                    case 0:
                        return value;
                    case 1:
                        operand = arrayAtI32(Client.statEffectiveLevel, read());
                        break;
                    case 2:
                        operand = arrayAtI32(Client.statBaseLevel, read());
                        break;
                    case 3:
                        operand = arrayAtI32(Client.statXP, read());
                        break;
                    case 4:
                    case 10: {
                        const container = IfType.Get(((read() << 16) + read()) | 0);
                        const obj = read();
                        if (obj !== -1 && (!ObjType.List(obj).members || Client.members)) {
                            const ids = requireNonNull(requireNonNull(container).itemIds);
                            for (let slot = 0; slot < ids.length; slot++) {
                                if (ids[slot] !== ((obj + 1) | 0)) continue;
                                if (opcode === 10) {
                                    operand = 999999999;
                                    break;
                                }
                                operand = (operand + arrayAtI32(requireNonNull(container).itemCounts, slot)) | 0;
                            }
                        }
                        break;
                    }
                    case 5:
                        operand = arrayAtI32(ClientVarCache.m_var, read());
                        break;
                    case 6:
                        operand = arrayAtI32(Client.levelExperience, (arrayAtI32(Client.statBaseLevel, read()) - 1) | 0);
                        break;
                    case 7:
                        operand = intDivide(Math.imul(arrayAtI32(ClientVarCache.m_var, read()), 100), 46875);
                        break;
                    case 8:
                        operand = requireNonNull(Client.localPlayer).combatLevel;
                        break;
                    case 9:
                        for (let skill = 0; skill < 25; skill++) {
                            if (Skill.used[skill]) operand = (operand + Client.statBaseLevel[skill]) | 0;
                        }
                        break;
                    case 11:
                        operand = Client.runenergy;
                        break;
                    case 12:
                        operand = Client.runWeight;
                        break;
                    case 13:
                        operand = Number((arrayAtI32(ClientVarCache.m_var, read()) & (1 << read())) !== 0);
                        break;
                    case 14:
                        operand = ClientVarCache.GetVarbit(read());
                        break;
                    case 15:
                        operation = 1;
                        continue;
                    case 16:
                        operation = 2;
                        continue;
                    case 17:
                        operation = 3;
                        continue;
                    case 18:
                        operand = (Client.mapBuildBaseX + (requireNonNull(Client.localPlayer).x >> 7)) | 0;
                        break;
                    case 19:
                        operand = ((requireNonNull(Client.localPlayer).z >> 7) + Client.mapBuildBaseZ) | 0;
                        break;
                    case 20:
                        operand = read();
                        break;
                }
                switch (operation) {
                    case 0:
                        value = (value + operand) | 0;
                        break;
                    case 1:
                        value = (value - operand) | 0;
                        break;
                    case 2:
                        if (operand !== 0) value = intDivide(value, operand);
                        break;
                    case 3:
                        value = Math.imul(value, operand);
                        break;
                }
                operation = 0;
            }
        } catch (error) {
            if (error instanceof Error && !(error instanceof JavaError)) return -1;
            throw error;
        }
    }

    // SD e.a(Laj;B)Z / HD md.a(Lbe;I)Z. NXT Client::GetIfActive.
    static GetIfActive(component: IfType | null, guard: number): boolean {
        try {
            const c = requireNonNull(component);
            if (c.comparisonOps === null) return false;
            for (let i = 0; i < requireNonNull(c.comparisonOps).length; i++) {
                const result = Client.GetIfVar(c, i);
                const target = arrayAtI32(c.comparisonValues, i);
                if (arrayAtI32(c.comparisonOps, i) === 2) {
                    if (result >= target) return false;
                } else if (arrayAtI32(c.comparisonOps, i) === 3) {
                    if (result <= target) return false;
                } else if (arrayAtI32(c.comparisonOps, i) === 4) {
                    if (result === target) return false;
                } else if (result !== target) return false;
            }
            return true;
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, (glJar ? 'md.C(' : 'e.G(') + (component === null ? 'null' : '{...}') + ',' + guard + ')');
        }
    }

    // qf.a(IB)Lid;. NXT Client::Inf.
    static Inf(value: number): JagString {
        return value < 999999999 ? JagString.fromInt(value) : Client.infText;
    }

    // client.a(Lid;Laj;B)Lid;. NXT Client::SubstituteVars.
    static SubstituteVars(text: JagString, component: IfType): JagString {
        if (text.indexOf(Client.percentSign) === -1) return text;
        const tags = [Client.percent1, Client.percent2, Client.percent3, Client.percent4, Client.percent5];
        for (let i = 0; i < tags.length; i++) {
            for (let index = text.indexOf(tags[i]); index !== -1; index = text.indexOf(tags[i])) {
                text = JagString.join([text.substring(0, index), Client.Inf(Client.GetIfVar(component, i)), text.substringFrom((index + 2) | 0)]);
            }
        }
        for (let index = text.indexOf(Client.dnsTag); index !== -1; index = text.indexOf(Client.dnsTag)) {
            let value = JagString.empty;
            const request = Client.dnsRequest;
            if (request !== null) {
                value = JagString.formatIpv4(request.intArg);
                if (request.result !== null) value = fromJsString(request.result);
            }
            text = JagString.join([text.substring(0, index), value, text.substringFrom((index + 4) | 0)]);
        }
        return text;
    }

    static readonly niceNumberGreen = fromLiteral(' <col=00ff80>'); // rb.j:Lid;
    static readonly objCountWhiteTag = fromLiteral(' <col=ffffff>'); // la.ib:Lid;
    static readonly countColourYellow = fromLiteral(' <col=ffff00>'); // aa.b:Lid;
    static readonly niceNumberSuffix = fromLiteral('(Y<)4col>'); // ra.W:Lid;
    static readonly colEndTag = fromLiteral('<)4col>'); // ui.y:Lid;

    // gf.c(II)Lid;. NXT Client::NiceNumber, projects/osclient/client_UI.cpp.
    static NiceNumber(count: number): JagString {
        let text = JagString.fromInt(count);
        for (let split = text.length - 3; split > 0; split -= 3) {
            text = JagString.join([text.substring(0, split), WorldMap.comma, text.substringFrom(split)]);
        }
        if (text.length > 9) {
            return JagString.join([Client.niceNumberGreen, text.substring(0, text.length - 8), LocalisedText.millionSuffixAmount, Minimenu.openParen, text, Client.niceNumberSuffix]);
        }
        if (text.length > 6) {
            return JagString.join([Client.objCountWhiteTag, text.substring(0, text.length - 4), LocalisedText.thousandsSuffix, Minimenu.openParen, text, Client.niceNumberSuffix]);
        }
        return JagString.join([Client.countColourYellow, text, Client.colEndTag]);
    }

    // qa.a(IIIII)V
    static drawCross(): void {
        if (Minimenu.crossMode === 1) {
            requireNonNull(arrayAtObj(SpriteLoader.cross, intDivide(Minimenu.crossTicks, 100))).draw((Minimenu.crossX - 8) | 0, (Minimenu.crossY - 8) | 0);
        }
        if (Minimenu.crossMode === 2) {
            requireNonNull(arrayAtObj(SpriteLoader.cross, 4 + intDivide(Minimenu.crossTicks, 100))).draw((Minimenu.crossX - 8) | 0, (Minimenu.crossY - 8) | 0);
        }
        Client.GdmGetSpecialArea();
    }
    static displayFps = false; // jg.C:Z
    static readonly fpsLabel = fromLiteral('Fps:'); // ak.g:Lid;
    private static readonly stressGameDrawLabel = fromJsString('Game draws/s:');
    private static readonly stressCommand = fromJsString('::stress');
    private static readonly stressOnCommand = fromJsString('::stress on');
    private static readonly stressOffCommand = fromJsString('::stress off');

    private static async toggleStress(enabled: boolean): Promise<void> {
        if (Preferences.stressGraphicsEnabled === enabled) return;
        if (enabled && (!glJar || !GlRendererClass.active || !GlRendererClass.stressDrawable || Client.gameState !== 30)) {
            Client.AddChat(fromJsString('Stress mode requires an active HD game viewport.'), null, 0);
            return;
        }
        GameShell.stressFrame = null;
        GlRendererClass.stressDrawable?.currentTargets()?.stopStress();
        try {
            await Client.setStressGraphics(enabled);
            if (enabled && GlRendererClass.active && GlRendererClass.stressDrawable) {
                GameShell.stressFrame = (gameDrawn, time) => Client.gameState === 30 && (GlRendererClass.stressDrawable?.replayStress(gameDrawn, time) ?? false);
            } else if (enabled) {
                await Client.setStressGraphics(false);
            }
        } catch (error) {
            if (enabled) await Client.setStressGraphics(false);
            throw error;
        }
        Client.AddChat(fromJsString(GameShell.stressFrame ? 'HD stress on. Frame rate unlocked.' : 'HD stress off.'), null, 0);
    }
    static readonly memLabel = fromLiteral('Mem:'); // fa.a:Lid;
    static readonly cardLabel = glJar ? fromLiteral('Card:') : null; // HD q.h:Lna;
    static readonly debugCacheLabel = fromLiteral('Cache:'); // gd.bb:Lid;
    static readonly percentOpenParen = fromLiteral('(U (X'); // rf.u:Lid;
    static readonly colEndTimes = fromLiteral('<)4col> x'); // vc.Q:Lid;
    static rectDebug = 0; // ml.T:I
    static readonly gcCommand = fromLiteral('::gc'); // wj.a:Lid;
    static readonly gcPrefix = fromLiteral('mem='); // ec.h:Lid;
    static readonly kilobytes = fromLiteral('k'); // mf.o:Lid;
    static readonly memoryCommand = fromLiteral('::mm'); // sj.N:Lid;
    static readonly cardMemoryCommand = glJar ? fromLiteral('::cardmem') : null; // HD qf.N:Lna;
    static readonly beforeCleanup = fromLiteral('Memory before cleanup='); // ii.n:Lid;
    static readonly afterCleanup = fromLiteral('Memory after cleanup='); // hj.c:Lid;
    static readonly playerCacheCommand = hashTableInitStrings.playerCacheCommand; // gk.a:Lid;
    static readonly playerCachePrefix = fromLiteral('Number of player models in cache:'); // mf.n:Lid;
    static readonly clientDropCommand = fromLiteral('::clientdrop'); // hg.e:Lid;
    static readonly clientJs5DropCommand = fromLiteral('::clientjs5drop'); // ek.u:Lid;
    static readonly serverJs5DropCommand = fromLiteral('::serverjs5drop'); // di.d:Lid;
    static readonly breakconCommand = fromLiteral('::breakcon'); // rj.a:Lid;
    static readonly replaceCanvasCommand = fromLiteral('::replacecanvas'); // ek.B:Lid;
    static readonly rebuildCommand = fromLiteral('::rebuild'); // ag.c:Lid;
    static readonly fpsOnCommand = fromLiteral('::fpson'); // ic.N:Lid;
    static readonly fpsOffCommand = fromLiteral('::fpsoff'); // wj.c:Lid;
    static readonly wm0Command = fromLiteral('::wm0'); // HD hh.k:Lna;
    static readonly wm1Command = fromLiteral('::wm1'); // HD oi.j:Lna;
    static readonly wm2Command = fromLiteral('::wm2'); // HD ql.i:Lna;
    static readonly wm3Command = fromLiteral('::wm3'); // HD hk.db:Lna;
    static readonly noClipCommand = fromLiteral('::noclip'); // pg.N:Lid;
    static readonly setParticlesCommand = fromLiteral('::setparticles'); // re.c:Lid;
    static readonly fpsCommand = fromLiteral('::fps '); // rf.q:Lid;
    static readonly errorTestCommand = fromLiteral('::errortest'); // rg.r:Lid;
    static readonly rectDebugCommand = fromLiteral('::rect_debug'); // va.N:Lid;
    static readonly rectDebugPrefix = fromLiteral('rect_debug='); // dl.b:Lid;
    static readonly qaOpTestCommand = fromLiteral('::qa_op_test'); // ph.f:Lid;
    static readonly tweenCommand = fromLiteral('::tween'); // wj.h:Lid;
    static readonly tweenEnabled = fromLiteral('Forced tweening ENABLED(Q'); // re.g:Lid;
    static readonly tweenDisabled = fromLiteral('Forced tweening disabled)3'); // hh.fb:Lid;
    static readonly shiftClickCommand = fromLiteral('::shiftclick'); // ki.N:Lid;
    static readonly shiftClickEnabled = fromLiteral('Shift)2click ENABLED(Q'); // ek.z:Lid;
    static readonly shiftClickDisabled = linkableInitStrings.shiftClickDisabled; // jf.f:Lid;

    // SD ig.a(Lid;I)V / HD k.a(Lna;Z)V. jag::oldscape::Client::DoCheat.
    static DoCheat(command: JagString): void | Promise<void> {
        if (command?.equalsIgnoreCase(Client.stressCommand)) return Client.toggleStress(!Preferences.stressGraphicsEnabled);
        if (command?.equalsIgnoreCase(Client.stressOnCommand)) return Client.toggleStress(true);
        if (command?.equalsIgnoreCase(Client.stressOffCommand)) return Client.toggleStress(false);
        return runToCompletion(
            (function* (): Generator<Promise<void>, void, void> {
                try {
                    if (Client.staffModLevel >= 2) {
                        if (command.equalsIgnoreCase(Client.gcCommand)) {
                            Client.removeSoftCaches();
                            for (let i = 0; i < 10; i++) globalThis.gc?.();
                            Client.AddChat(JagString.join([Client.gcPrefix, JagString.fromInt(Client.usedMemoryKb()), Client.kilobytes]), null, 0);
                        }
                        if (command.equalsIgnoreCase(Client.memoryCommand)) {
                            Client.removeSoftCaches();
                            for (let i = 0; i < 10; i++) globalThis.gc?.();
                            Client.AddChat(JagString.join([Client.beforeCleanup, JagString.fromInt(Client.usedMemoryKb()), Client.kilobytes]), null, 0);
                            if (glJar) world.releaseGlModels();
                            Client.removeSoftCaches();
                            for (let i = 0; i < 10; i++) globalThis.gc?.();
                            Client.AddChat(JagString.join([Client.afterCleanup, JagString.fromInt(Client.usedMemoryKb()), Client.kilobytes]), null, 0);
                        }
                        if (command.equalsIgnoreCase(Client.playerCacheCommand)) {
                            Client.AddChat(JagString.join([Client.playerCachePrefix, JagString.fromInt(PlayerModel.modelCache2.countHard())]), null, 0);
                        }
                        if (glJar && GlRendererClass.active && command.equalsIgnoreCase(Client.cardMemoryCommand)) {
                            const cleaner = GlCleaner;
                            console.log('oncard_geometry:' + cleaner.geometryMemory);
                            console.log('oncard_2d:' + cleaner.memory2d);
                            console.log('oncard_texture:' + cleaner.textureMemory);
                        }
                        if (command.equalsIgnoreCase(Client.clientDropCommand)) {
                            const lost = Client.LostCon();
                            if (lost instanceof Promise) yield lost;
                        }
                        if (command.equalsIgnoreCase(Client.clientJs5DropCommand)) void requireNonNull(Client.js5NetQueue).close();
                        if (command.equalsIgnoreCase(Client.serverJs5DropCommand)) requireNonNull(Client.js5NetQueue).RequestServerDrop();
                        if (command.equalsIgnoreCase(Client.breakconCommand)) {
                            requireNonNull(GameShell.signlink).breakConnection();
                            const stream = requireNonNull(Client.stream);
                            requireNonNull(stream.breakConnection).call(stream);
                            requireNonNull(Client.js5NetQueue).breakConnection();
                        }
                        if (command.equalsIgnoreCase(Client.replaceCanvasCommand)) GameShell.canvasInvalid = true;
                        if (command.equalsIgnoreCase(Client.rebuildCommand)) Client.SetMainState(25);
                        if (command.equalsIgnoreCase(Client.fpsOnCommand)) Client.displayFps = true;
                        if (command.equalsIgnoreCase(Client.fpsOffCommand)) Client.displayFps = false;
                        if (glJar) {
                            if (command.equalsIgnoreCase(Client.wm0Command)) {
                                const change = Client.setWindowMode(-1, true, 0, false, -1);
                                if (change instanceof Promise) yield change;
                            }
                            if (command.equalsIgnoreCase(Client.wm1Command)) {
                                const change = Client.setWindowMode(-1, true, 1, false, -1);
                                if (change instanceof Promise) yield change;
                            }
                            if (command.equalsIgnoreCase(Client.wm2Command)) {
                                const change = Client.setWindowMode(-1, true, 2, false, -1);
                                if (change instanceof Promise) yield change;
                            }
                            if (command.equalsIgnoreCase(Client.wm3Command)) {
                                const change = Client.setWindowMode(1024, true, 3, false, 768);
                                if (change instanceof Promise) yield change;
                            }
                        }
                        if (command.equalsIgnoreCase(Client.noClipCommand)) {
                            for (let level = 0; level < 4; level++) {
                                for (let x = 1; x < 103; x++) {
                                    for (let z = 1; z < 103; z++) arrayPutI32(arrayAtObj(requireNonNull(arrayAtObj(CollisionMap.levelMaps, level)).flags, x), z, 0);
                                }
                            }
                        }
                        if (command.startsWith(Client.setParticlesCommand)) {
                            ParticleSystem.setDetailLevel(command.substringFrom(15).decimal());
                            Preferences.write(GameShell.signlink);
                            Preferences.sent = false;
                        }
                        if (command.startsWith(Client.fpsCommand) && Client.modewhat !== 0) GameShell.SetFrameRate(command.substringFrom(6).decimal());
                        if (command.equalsIgnoreCase(Client.errorTestCommand)) throw new Error();
                        if (command.startsWith(Client.rectDebugCommand)) {
                            Client.rectDebug = command.substringFrom(12).trim().decimal();
                            Client.AddChat(JagString.join([Client.rectDebugPrefix, JagString.fromInt(Client.rectDebug)]), null, 0);
                        }
                        if (command.equalsIgnoreCase(Client.qaOpTestCommand)) Client.qaOpTest = true;
                        if (command.equalsIgnoreCase(Client.tweenCommand)) {
                            if (!SeqType.forceTween) {
                                SeqType.forceTween = true;
                                Client.AddChat(Client.tweenEnabled, null, 0);
                            } else {
                                SeqType.forceTween = false;
                                Client.AddChat(Client.tweenDisabled, null, 0);
                            }
                        }
                        if (command.equalsIgnoreCase(Client.shiftClickCommand)) {
                            if (!Minimenu.shiftClick) {
                                Client.shiftClickEnabled.print(0);
                                Minimenu.shiftClick = true;
                            } else {
                                Client.shiftClickDisabled.print(0);
                                Minimenu.shiftClick = false;
                            }
                        }
                    }
                    requireNonNull(Client.out).pHead(44);
                    const lengthPacket = Client.out;
                    const length = (command.getLength() - 1) | 0;
                    requireNonNull(lengthPacket).p1(length);
                    const textPacket = Client.out;
                    const text = command.substringFrom(2);
                    requireNonNull(textPacket).pStringNoConversion(text, 0);
                } catch (error) {
                    if (!isJavaRuntimeException(error)) throw error;
                    const value = command === null ? 'null' : '{...}';
                    throw WrappedException.wrap(error, glJar ? 'k.H(' + value + ',false)' : 'ig.I(' + value + ',12)');
                }
            })()
        );
    }

    // Runtime.totalMemory() - Runtime.freeMemory(), in KiB. Chromium includes
    // V8 external memory (such as ArrayBuffer backing stores) in usedJSHeapSize.
    static usedMemoryKb(): number {
        const memory = (globalThis.performance as Performance & { memory?: { usedJSHeapSize: number } })?.memory;
        return ((memory?.usedJSHeapSize ?? 0) / 1024) | 0;
    }
    static logoutTimer = 0; // ia.l:I
    // f.b:Lcl; f.<clinit> allocates cl on the first active use of f.
    static designAppearanceInstance: PlayerModel | null | undefined;
    static get designAppearance(): PlayerModel {
        const appearance = Client.designAppearanceInstance;
        if (appearance === undefined) return (Client.designAppearanceInstance = new PlayerModel());
        return requireNonNull(appearance);
    }
    static showLoadingMessage = true; // ja.W:Z

    // tj.a(I)V, entered between le.a's completed region read and ac.a's first packet decode.
    static resetGame(): void | Promise<void> {
        if (glJar) {
            Client.mouseRepeatCount = 0;
            Client.lastSentFocus = true;
            Client.prevMouseClickTime = 0n;
            ScriptRunner.quickChatPacketsSent = 0;
            requireNonNull(Client.mouseTracking).count = 0;
            GameShell.m_focus = true;
            ReflectionCheck.resetQueue();
            Protocol.ptype2 = -1;
            Protocol.ptype1 = -1;
            Protocol.packetType = -1;
            Client.logoutTimer = 0;
            Client.rebootTimer = 0;
            Client.out.m_pos = 0;
            Protocol.lastPacketType0 = -1;
            Protocol.idleReads = 0;
            Protocol.inPacket.m_pos = 0;
        } else {
            Client.lastSentFocus = true;
            requireNonNull(Client.mouseTracking).count = 0;
            GameShell.m_focus = true;
            Client.prevMouseClickTime = 0n;
            Client.mouseRepeatCount = 0;
            ReflectionCheck.resetQueue();
            Client.rebootTimer = 0;
            Protocol.lastPacketType0 = -1;
            Client.out.m_pos = 0;
            Protocol.idleReads = 0;
            Protocol.packetType = -1;
            Client.logoutTimer = 0;
            ScriptRunner.quickChatPacketsSent = 0;
            Protocol.inPacket.m_pos = 0;
            Protocol.ptype2 = -1;
            Protocol.ptype1 = -1;
        }
        for (let i = 0; i < Client.hintArrows.length; i++) arrayPutObj(Client.hintArrows, i, null);
        if (glJar) {
            Minimenu.count = 0;
            Minimenu.isOpen = false;
        } else {
            Minimenu.isOpen = false;
            Minimenu.count = 0;
        }
        ClientMouseListener.setIdleCycles(0);
        for (let i = 0; i < 100; i++) arrayPutObj(ChatHistory.text, i, null);
        if (glJar) {
            // tk.a(Z)V
            Minimenu.objSelected = 0;
            OrbitCamera.followOffsetX = ((mathRandom.nextDouble() * 100) | 0) - 50;
            Client.destinationZ = 0;
            OrbitCamera.followYaw = (((mathRandom.nextDouble() * 20) | 0) - 10) & 2047;
            MinimapBuilder.minimapLevel = -1;
            ReceivePlayerPositions.m_lastNum = 0;
            Client.minimapState = 0;
            OrbitCamera.followOffsetZ = ((110 * mathRandom.nextDouble()) | 0) - 55;
            Minimenu.targetMode = false;
            OrbitCamera.minimapZoom = -20 + ((30 * mathRandom.nextDouble()) | 0);
            Client.soundEffectCount = 0;
            Client.destinationX = 0;
            OrbitCamera.minimapAngle = -60 + ((mathRandom.nextDouble() * 120) | 0);
            ChatHistory.count = 0;
            OrbitCamera.yawOffset = ((80 * mathRandom.nextDouble()) | 0) - 40;
            Client.npcCount = 0;
        } else {
            ReceivePlayerPositions.m_lastNum = 0;
            OrbitCamera.followOffsetX = ((mathRandom.nextDouble() * 100) | 0) - 50;
            MinimapBuilder.minimapLevel = -1;
            OrbitCamera.yawOffset = ((80 * mathRandom.nextDouble()) | 0) - 40;
            Client.destinationZ = 0;
            OrbitCamera.followYaw = (((mathRandom.nextDouble() * 20) | 0) - 10) & 2047;
            OrbitCamera.minimapZoom = ((mathRandom.nextDouble() * 30) | 0) - 20;
            Client.minimapState = 0;
            OrbitCamera.followOffsetZ = ((110 * mathRandom.nextDouble()) | 0) - 55;
            Client.npcCount = 0;
            ChatHistory.count = 0;
            OrbitCamera.minimapAngle = -60 + ((mathRandom.nextDouble() * 120) | 0);
            Minimenu.targetMode = false;
            Minimenu.objSelected = 0;
            Client.soundEffectCount = 0;
            Client.destinationX = 0;
        }
        for (let i = 0; i < 2048; i++) {
            arrayPutObj(Client.players, i, null);
            arrayPutObj(ReceivePlayerPositions.m_apCache, i, null);
        }
        for (let i = 0; i < 32768; i++) arrayPutObj(Client.npcs, i, null);
        const players = Client.players;
        const localPlayer = new ClientPlayer();
        arrayPutObj(players, 2047, localPlayer);
        Client.localPlayer = localPlayer;
        Client.projectiles.clear();
        MapSpotAnim.active.clear();
        if (Client.groundObj !== null) {
            for (let plane = 0; plane < 4; plane++) {
                for (let x = 0; x < 104; x++) {
                    for (let z = 0; z < 104; z++) Client.groundObj[plane][x][z] = null;
                }
            }
        }
        Client.locChanges = new SharedPtrList<LocChange>(); // wh.S:Lgk;, tj.a(I)V
        LocChange.scene = null;
        if (glJar) {
            Client.friendState = 0;
            Client.friendCount = 0;
        } else {
            Client.friendCount = 0;
            Client.friendState = 0;
        }
        ClientVarCache.reset();
        DelayedStateChange.clear();
        if (glJar) {
            CinematicCamera.lookStep = 0;
            CinematicCamera.lookFactor = 0;
            CinematicCamera.lookZ = 0;
            CinematicCamera.height = 0;
            CinematicCamera.tileZ = 0;
            CinematicCamera.tileX = 0;
            CinematicCamera.lookHeight = 0;
            CinematicCamera.lookX = 0;
            CinematicCamera.factor = 0;
            CinematicCamera.step = 0;
        } else {
            CinematicCamera.tileX = CinematicCamera.lookZ = CinematicCamera.lookHeight = 0;
            CinematicCamera.step = CinematicCamera.lookX = CinematicCamera.factor = 0;
            CinematicCamera.tileZ = CinematicCamera.height = CinematicCamera.lookFactor = CinematicCamera.lookStep = 0;
        }
        for (let i = 0; i < DelayedStateChange.varcs.length; i++) arrayPutI32(DelayedStateChange.varcs, i, -1);
        if (InterfaceList.top !== -1) IfType.CloseInterface(InterfaceList.top);
        return runToCompletion(
            (function* (): Generator<Promise<void>, void, void> {
                for (let sub = InterfaceList.subInterfaces.head(); sub !== null; sub = InterfaceList.subInterfaces.next()) {
                    const closed = Client.CloseSubinterface(sub, true);
                    if (closed instanceof Promise) yield closed;
                }
                InterfaceList.top = -1;
                InterfaceList.subInterfaces = new HashTable<SubInterface>(8);
                InterfaceList.reset();
                InterfaceList.pressedContinue = null;
                if (glJar) {
                    Minimenu.isOpen = false;
                    Minimenu.count = 0;
                } else {
                    Minimenu.count = 0;
                    Minimenu.isOpen = false;
                }
                Client.designAppearance.setAppearance(false, new Int32Array(5), -1, null, -1);
                for (let slot = 0; slot < 8; slot++) {
                    Minimenu.playerOption[slot] = null;
                    Minimenu.playerSecondary[slot] = false;
                    Minimenu.playerCursor[slot] = -1;
                }
                ClientInvCache.DeleteAll();
                Client.showLoadingMessage = true;
                for (let i = 0; i < 100; i++) arrayPutObj(InterfaceList.dirty, i, true);
                FriendChatChannel.memberCount = 0;
                FriendChatChannel.members = null;
                FriendChatChannel.channelName = null;
                for (let slot = 0; slot < 6; slot++) arrayPutObj(Client.grandExchangeOffers, slot, new StockPlayerOffer());
                for (let stat = 0; stat < 25; stat++) {
                    arrayPutI32(Client.statEffectiveLevel, stat, 0);
                    arrayPutI32(Client.statBaseLevel, stat, 0);
                    arrayPutI32(Client.statXP, stat, 0);
                }
                if (glJar) {
                    if (GlRendererClass.active) Client.forceImmediateEnvironmentUpdate = true;
                    OrbitCamera.reportPending = true;
                }
                Client.verifyId = 0;
                if (!glJar) OrbitCamera.reportPending = true;
                Minimenu.walkHere = LocalisedText.walkHere;
                RoofModeStatics.roofRemovalDisabled = false;
                if (glJar) {
                    ObjType.recolourPalette = new Int16Array(256);
                    NpcType.clientPalette = ObjType.recolourPalette;
                    LocType.recolPalette = ObjType.recolourPalette;
                    Client.recolourPalette = ObjType.recolourPalette;
                } else {
                    Client.recolourPalette = LocType.recolPalette = NpcType.clientPalette = ObjType.recolourPalette = new Int16Array(256);
                }
                Minimenu.clearSprites();
                Minimenu.spriteStyle = false;
                Client.sendWindowStatus();
            })()
        );
    }
    // a.e:I
    static minimapClickX = 0;
    // ca.n:I
    static minimapClickY = 0;
    // gh.C:Laj;
    static tooltipComponent: IfType | null = null;
    // gh.A:I
    static tooltipTimer = 0;
    static minimapState = 0; // ki.R:I

    static username: JagString | null = fromLiteral(''); // ga.G:Lid; initially ga.J
    static password: JagString | null = fromLiteral(''); // ga.F:Lid; initially ga.J
    static loginStep = 0; // od.O:I
    static loginRetryCount = 0; // tk.d:I
    static accountConnectCycles = 0; // ge.Q:I
    static loginConnectCycles = 0; // g.f:I
    static loginout = new SuperPacket(5000); // wd.e:Lbe;
    static socketRequest: SignlinkRequest<SocketHandle> | null = null; // f.k:Ldj;
    static grandExchangeOffers: (StockPlayerOffer | null)[] | null = Array<StockPlayerOffer | null>(6).fill(null); // rb.h:[Lea;
    static stockTransmitCycle = 0; // pi.p:I
    static stream: Js5Stream | null = null; // ek.s:Lse;
    static socketError = false; // sc.V:Z
    static m_ticksSinceNoTimeOutPacket = 0; // mc.U:I, ServerConnection::m_ticksSinceNoTimeOutPacket in NXT.

    // ph.a(ZI)V. Client::PreventTimeout in projects/osclient/client.cpp.
    static PreventTimeout(force: boolean): void {
        AudioEngine.tick();
        if (Client.gameState !== 30 && Client.gameState !== 25) return;
        Client.m_ticksSinceNoTimeOutPacket = (Client.m_ticksSinceNoTimeOutPacket + 1) | 0;
        if (Client.m_ticksSinceNoTimeOutPacket < 50 && !force) return;
        Client.m_ticksSinceNoTimeOutPacket = 0;
        const stream = Client.stream;
        if (!Client.socketError && stream !== null) {
            const out = Client.out;
            out.pHead(93);
            try {
                stream.Write(0, out.m_data, out.m_pos);
                out.m_pos = 0;
            } catch (error) {
                if (!(error instanceof SocketIoError)) throw error;
                Client.socketError = true;
            }
        }
        AudioEngine.tick();
    }

    // ej.a(II)V. Client::SetMainState, projects/osclient/client.cpp.
    static SetMainState(next: number): void {
        try {
            if (Client.gameState === next) return;
            if (Client.gameState === 0) GameShell.ShowBasicPercentTidy();
            if (next === 40) Login.beginLogin(0);
            if (next !== 40 && Protocol.oldSocket !== null) {
                Protocol.oldSocket.Close();
                Protocol.oldSocket = null;
            }
            const atTitle = next === 5 || next === 10 || next === 28;
            if (next === 25 || next === 28) {
                Client.locsNotReadyCount = 0;
                if (glJar) {
                    Client.mapLoadingTotal = 1;
                    Client.sceneState = 0;
                    Client.maxLocModelsMissing = 1;
                    Client.mapFilesMissing = 0;
                } else {
                    Client.mapFilesMissing = 0;
                    Client.mapLoadingTotal = 1;
                    Client.maxLocModelsMissing = 1;
                    Client.sceneState = 0;
                }
                WorldMap.Reset(true);
            }
            if (next === 25 || next === 10) Client.refreshToolbar();
            if (next === 5) TitleScreen.Open(Client.m_pSprites);
            else TitleScreen.Close();
            const wasAtTitle = Client.gameState === 5 || Client.gameState === 10 || Client.gameState === 28;
            if (atTitle !== wasAtTitle) {
                if (atTitle && !Client.activeClient?.standaloneWorldMap) {
                    Client.midiSong = Client.titleSong;
                    if (Preferences.musicVolume !== 0) {
                        if (glJar) {
                            const song = Client.titleSong;
                            MidiManager.Play(255, 2, Client.m_pMidi, false, song, 0);
                        } else MidiManager.Play(255, 2, Client.m_pMidi, false, Client.titleSong, 0);
                    } else MidiManager.Stop(2);
                } else if (!atTitle) MidiManager.Stop(2);
                requireNonNull(Client.js5NetQueue).setLoggedIn(!atTitle);
            }
            if (glJar) {
                const renderer = GlRendererClass;
                if (renderer.active && (next === 25 || next === 28 || next === 40)) renderer.copyFrontToBack();
            }
            Client.gameState = next;
        } catch (error) {
            if (!glJar || !isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'pl.C(' + next + ',5)');
        }
    }

    // ig.b(I)V. Client::Logout, projects/osclient/client_network.cpp.
    static Logout(game = Client.activeClient?.game): void | Promise<void> {
        if (Client.stream !== null) {
            Client.stream.Close();
            Client.stream = null;
        }
        Client.ResetCache();
        world.ResetMap();
        if (game) game.rebuild = null;
        for (let level = 0; level < 4; level++) requireNonNull(CollisionMap.levelMaps[level]).reset();
        WorldMap.Reset(false);
        globalThis.gc?.();
        MidiManager.Stop(2);
        Client.jingleActive = false;
        Client.midiSong = -1;
        AreaSoundManager.clear(true);
        Client.mapBuildCentreZoneX = 0;
        Client.mapBuildBaseX = 0;
        Client.mapBuildCentreZoneZ = 0;
        Client.mapBuildBaseZ = 0;
        Client.dynamicRegion = false;
        Client.hintArrows.fill(null);
        Client.npcCount = 0;
        ReceivePlayerPositions.m_lastNum = 0;
        for (let i = 0; i < 2048; i++) {
            Client.players[i] = null;
            ReceivePlayerPositions.m_apCache[i] = null;
        }
        Client.npcs.fill(null);
        for (let level = 0; level < 4; level++) {
            for (let x = 0; x < 104; x++) Client.groundObj[level][x].fill(null);
        }
        OrbitCamera.reset();
        Client.verifyId = 0;
        ClientVarCache.reset();
        if (game) {
            const title = game.resetToTitle();
            if (title instanceof Promise)
                return title.then(() => {
                    game.loggedOut = true;
                });
            game.loggedOut = true;
        } else Client.SetMainState(10);
    }

    // si.b(I)V. jag::oldscape::Client::LostCon.
    static LostCon(game = Client.activeClient?.game): void | Promise<void> {
        if (Client.logoutTimer > 0) return Client.Logout(game);
        else {
            Protocol.oldSocket = Client.stream;
            Client.stream = null;
            Client.SetMainState(40);
        }
    }

    // SD bf.c(I)V, HD rj.f(B)V. Client::ResetCache, projects/osclient/client.cpp.
    static ResetCache(): void {
        FloType.clear();
        FluType.clear();
        IdkType.ResetCache();
        LocType.ResetCache();
        NpcType.ResetCache();
        ObjType.ResetCache();
        SeqType.ResetCache();
        SpotType.ResetCache();
        VarBitType.ResetCache();
        VarpType.ResetCache();
        BASTypeList.CacheReset();
        MSITypeList.CacheReset();
        LightType.clear();
        CursorType.clear();
        PlayerModel.clearCaches();
        IfType.ResetCache();
        if (Client.modewhat !== 0) {
            for (let i = 0; i < requireNonNull(ClientPlayer.debugBallast).length; i++) arrayPutObj(ClientPlayer.debugBallast, i, null);
            ClientPlayer.memoryPaddingCount = 0;
        }
        HintArrow.clearModelCache();
        ClientEntity.clearShadowModelCache();
        SoftwareFont.cache.Reset();
        if (!glJar || !GlRendererClass.active) {
            const textures = Pix3D.textureProvider;
            if (textures !== null && !(textures instanceof TextureCache)) throw new TypeError('ClassCastException: expected TextureCache');
            requireNonNull(textures).ClearCache();
        }
        ClientScript.m_cache.Reset();
        requireNonNull(Client.animFramesArchive).DiscardAllFiles();
        requireNonNull(Client.basesArchive).DiscardAllFiles();
        requireNonNull(Client.interfacesArchive).DiscardAllFiles();
        requireNonNull(Client.m_pJagFx).DiscardAllFiles();
        requireNonNull(Client.mapsArchive).DiscardAllFiles();
        requireNonNull(Client.m_pMidi).DiscardAllFiles();
        requireNonNull(Client.modelsArchive).DiscardAllFiles();
        requireNonNull(Client.m_pSprites).DiscardAllFiles();
        requireNonNull(Client.binaryArchive).DiscardAllFiles();
        requireNonNull(Client.jingleArchive).DiscardAllFiles();
        requireNonNull(Client.m_pClientScripts).DiscardAllFiles();
        Client.npcHitbarSprites.Reset();
    }

    // SD hg.a(true), HD dh.a(false). Client::ReconnectDone, projects/osclient/client.cpp.
    static ReconnectDone(): void {
        try {
            if (glJar) {
                Client.out.m_pos = 0;
                Protocol.ptype1 = -1;
                Minimenu.isOpen = false;
                Protocol.packetSize = 0;
                Client.destinationX = 0;
                Minimenu.count = 0;
                Protocol.lastPacketType0 = -1;
                Client.minimapState = 0;
                Client.rebootTimer = 0;
                Protocol.ptype2 = -1;
                Protocol.inPacket.m_pos = 0;
                Protocol.idleReads = 0;
                Protocol.packetType = -1;
            } else {
                Protocol.idleReads = 0;
                Protocol.ptype1 = -1;
                Client.minimapState = 0;
                Minimenu.count = 0;
                Client.out.m_pos = 0;
                Protocol.packetType = -1;
                Minimenu.isOpen = false;
                Client.rebootTimer = 0;
                Client.destinationX = 0;
                Protocol.inPacket.m_pos = 0;
                Protocol.lastPacketType0 = -1;
                Protocol.ptype2 = -1;
                Protocol.packetSize = 0;
            }
            for (const player of Client.players) if (player !== null) player.faceEntity = -1;
            for (const npc of Client.npcs) if (npc !== null) npc.faceEntity = -1;
            ClientInvCache.DeleteAll();
            OrbitCamera.mode = 1;
            Client.SetMainState(30);
            for (let i = 0; i < 100; i++) arrayPutObj(InterfaceList.dirty, i, true);
            Client.sendWindowStatus();
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, glJar ? 'dh.F(false)' : 'hg.B(true)');
        }
    }
    static dynamicRegion = false; // qg.G:Z
    static readonly dynamicChunks = Array.from({ length: 4 }, () => Array.from({ length: 13 }, () => new Int32Array(13))); // ag.d:[[[I
    static mapBuildKeys: Int32Array[] | null = null; // jg.w:[[I
    static mapBuildIndex: Int32Array | null = null; // rb.i:[I
    static mapBuildGroundFile: Int32Array | null = null; // fd.X:[I
    static mapBuildLocationFile: Int32Array | null = null; // hh.qb:[I
    static sceneMapUnderwaterLandFile: Int32Array | null = null; // nk.X:[I
    static sceneMapUnderwaterLocFile: Int32Array | null = null; // p.J:[I
    static sceneMapLocData: (Uint8Array | null)[] | null = null; // lk.x:[[B
    static sceneMapLandData: (Uint8Array | null)[] | null = null; // mk.G:[[B
    static mapBuildNpcData: (Uint8Array | null)[] | null = null; // kg.o:[[B
    static npcSpawnGroupIds: Int32Array | null = null; // ae.c:[I

    static mapFilePrefix: JagString | null = fromLiteral('m'); // ah.h:Lid;
    static loadingDoneSuffix: JagString | null = fromLiteral('<br>(X100(U(Y'); // vi.W:Lid;
    static locMapPrefix: JagString | null = fromLiteral('l'); // hj.g:Lid;
    static umMapPrefix: JagString | null = fromLiteral('um'); // id.K:Lid;
    static underwaterLocPrefix: JagString | null = fromLiteral('ul'); // ei.w:Lid;
    static mapNameSeparator: JagString | null = fromLiteral('_'); // qc.M:Lid;

    // ac.a(ZZ)V. Client::RebuildPacket, projects/osclient/client.cpp.
    static RebuildPacket(dynamic: boolean): void {
        Client.dynamicRegion = dynamic;
        if (Client.dynamicRegion) {
            const localX = Protocol.inPacket.g2_alt3();
            const zoneX = Protocol.inPacket.g2_alt3();
            const level = Protocol.inPacket.g1_alt3();
            const localZ = Protocol.inPacket.g2_alt3();
            Protocol.inPacket.GBitStart();
            for (let plane = 0; plane < 4; plane++) {
                for (let x = 0; x < 13; x++) {
                    for (let z = 0; z < 13; z++) {
                        const present = Protocol.inPacket.gBit(1);
                        if (present !== 1) {
                            arrayPutI32(arrayAtObj(arrayAtObj(Client.dynamicChunks, plane), x), z, -1);
                        } else {
                            const row = arrayAtObj(arrayAtObj(Client.dynamicChunks, plane), x);
                            arrayPutI32(row, z, Protocol.inPacket.gBit(26));
                        }
                    }
                }
            }
            Protocol.inPacket.GBitEnd();
            const count = (((Protocol.packetSize - Protocol.inPacket.m_pos) | 0) / 16) | 0;
            Client.mapBuildKeys = Array.from(new Array(count), () => new Int32Array(4));
            for (let region = 0; region < count; region++) {
                for (let word = 0; word < 4; word++) arrayPutI32(arrayAtObj(Client.mapBuildKeys, region), word, Protocol.inPacket.g4_alt3());
            }
            const zoneZ = Protocol.inPacket.g2();
            Client.sceneMapUnderwaterLocFile = new Int32Array(count);
            Client.mapBuildNpcData = null;
            Client.mapBuildIndex = new Int32Array(count);
            Client.sceneMapLandData = new Array<Uint8Array | null>(count).fill(null);
            Client.mapBuildGroundFile = new Int32Array(count);
            Client.npcSpawnGroupIds = null;
            Client.mapBuildLocationFile = new Int32Array(count);
            Client.sceneMapUnderwaterLandFile = new Int32Array(count);
            Client.sceneMapLocData = new Array<Uint8Array | null>(count).fill(null);
            if (glJar) {
                Client.sceneMapUnderwaterLocData = new Array<Uint8Array | null>(count).fill(null);
                Client.sceneMapUnderwaterLandData = new Array<Uint8Array | null>(count).fill(null);
            }
            let region = 0;
            for (let plane = 0; plane < 4; plane++) {
                for (let x = 0; x < 13; x++) {
                    for (let z = 0; z < 13; z++) {
                        const chunk = arrayAtI32(arrayAtObj(arrayAtObj(Client.dynamicChunks, plane), x), z);
                        if (chunk === -1) continue;
                        const sourceX = (chunk & 16764072) >> 14;
                        const sourceZ = (chunk & 16382) >> 3;
                        let square = (((sourceX / 8) | 0) << 8) + ((sourceZ / 8) | 0);
                        for (let i = 0; i < region; i++) {
                            if (square === arrayAtI32(Client.mapBuildIndex, i)) {
                                square = -1;
                                break;
                            }
                        }
                        if (square === -1) continue;
                        arrayPutI32(Client.mapBuildIndex, region, square);
                        const squareX = (square & 65503) >> 8,
                            squareZ = square & 255;
                        const groundIds = Client.mapBuildGroundFile,
                            groundArchive = Client.mapsArchive;
                        const groundName = JagString.join([Client.mapFilePrefix, JagString.fromInt(squareX), Client.mapNameSeparator, JagString.fromInt(squareZ)]);
                        arrayPutI32(groundIds, region, requireNonNull(groundArchive).GetGroupId(groundName));
                        const locIds = Client.mapBuildLocationFile,
                            locArchive = Client.mapsArchive;
                        const locName = JagString.join([Client.locMapPrefix, JagString.fromInt(squareX), Client.mapNameSeparator, JagString.fromInt(squareZ)]);
                        arrayPutI32(locIds, region, requireNonNull(locArchive).GetGroupId(locName));
                        const underwaterGroundIds = Client.sceneMapUnderwaterLandFile,
                            underwaterGroundArchive = Client.mapsArchive;
                        const underwaterGroundName = JagString.join([Client.umMapPrefix, JagString.fromInt(squareX), Client.mapNameSeparator, JagString.fromInt(squareZ)]);
                        arrayPutI32(underwaterGroundIds, region, requireNonNull(underwaterGroundArchive).GetGroupId(underwaterGroundName));
                        const underwaterLocIds = Client.sceneMapUnderwaterLocFile,
                            underwaterLocArchive = Client.mapsArchive;
                        const underwaterLocName = JagString.join([Client.underwaterLocPrefix, JagString.fromInt(squareX), Client.mapNameSeparator, JagString.fromInt(squareZ)]);
                        arrayPutI32(underwaterLocIds, region, requireNonNull(underwaterLocArchive).GetGroupId(underwaterLocName));
                        region++;
                    }
                }
            }
            Client.StartRebuild(level, zoneZ, localX, zoneX, localZ, false);
            return;
        }
        const localX = Protocol.inPacket.g2_alt2();
        const count = (((Protocol.packetSize - Protocol.inPacket.m_pos) | 0) / 16) | 0;
        Client.mapBuildKeys = Array.from(new Array(count), () => new Int32Array(4));
        for (let region = 0; region < count; region++) {
            for (let word = 0; word < 4; word++) arrayPutI32(arrayAtObj(Client.mapBuildKeys, region), word, Protocol.inPacket.g4_alt3());
        }
        const level = Protocol.inPacket.g1_alt3();
        const zoneX = Protocol.inPacket.g2();
        const zoneZ = Protocol.inPacket.g2_alt2();
        const localZ = Protocol.inPacket.g2_alt2();
        Client.mapBuildGroundFile = new Int32Array(count);
        Client.mapBuildLocationFile = new Int32Array(count);
        Client.mapBuildNpcData = null;
        Client.sceneMapLandData = new Array<Uint8Array | null>(count).fill(null);
        Client.sceneMapUnderwaterLandFile = new Int32Array(count);
        Client.sceneMapLocData = new Array<Uint8Array | null>(count).fill(null);
        Client.npcSpawnGroupIds = null;
        Client.sceneMapUnderwaterLocFile = new Int32Array(count);
        Client.mapBuildIndex = new Int32Array(count);
        if (glJar) {
            Client.sceneMapUnderwaterLocData = new Array<Uint8Array | null>(count).fill(null);
            Client.sceneMapUnderwaterLandData = new Array<Uint8Array | null>(count).fill(null);
        }
        let tutorial = (((zoneX / 8) | 0) === 48 || ((zoneX / 8) | 0) === 49) && ((zoneZ / 8) | 0) === 48;
        if (((zoneX / 8) | 0) === 48 && ((zoneZ / 8) | 0) === 148) tutorial = true;
        let region = 0;
        for (let x = ((zoneX - 6) / 8) | 0; x <= (((zoneX + 6) / 8) | 0); x++) {
            for (let z = ((zoneZ - 6) / 8) | 0; z <= (((zoneZ + 6) / 8) | 0); z++) {
                const square = (x << 8) + z;
                if (tutorial && (z === 49 || z === 149 || z === 147 || x === 50 || (x === 49 && z === 47))) {
                    arrayPutI32(Client.mapBuildIndex, region, square);
                    arrayPutI32(Client.mapBuildGroundFile, region, -1);
                    arrayPutI32(Client.mapBuildLocationFile, region, -1);
                    arrayPutI32(Client.sceneMapUnderwaterLandFile, region, -1);
                    arrayPutI32(Client.sceneMapUnderwaterLocFile, region, -1);
                } else {
                    arrayPutI32(Client.mapBuildIndex, region, square);
                    const groundIds = Client.mapBuildGroundFile,
                        groundArchive = Client.mapsArchive;
                    const groundName = JagString.join([Client.mapFilePrefix, JagString.fromInt(x), Client.mapNameSeparator, JagString.fromInt(z)]);
                    arrayPutI32(groundIds, region, requireNonNull(groundArchive).GetGroupId(groundName));
                    const locIds = Client.mapBuildLocationFile,
                        locArchive = Client.mapsArchive;
                    const locName = JagString.join([Client.locMapPrefix, JagString.fromInt(x), Client.mapNameSeparator, JagString.fromInt(z)]);
                    arrayPutI32(locIds, region, requireNonNull(locArchive).GetGroupId(locName));
                    const underwaterGroundIds = Client.sceneMapUnderwaterLandFile,
                        underwaterGroundArchive = Client.mapsArchive;
                    const underwaterGroundName = JagString.join([Client.umMapPrefix, JagString.fromInt(x), Client.mapNameSeparator, JagString.fromInt(z)]);
                    arrayPutI32(underwaterGroundIds, region, requireNonNull(underwaterGroundArchive).GetGroupId(underwaterGroundName));
                    const underwaterLocIds = Client.sceneMapUnderwaterLocFile,
                        underwaterLocArchive = Client.mapsArchive;
                    const underwaterLocName = JagString.join([Client.underwaterLocPrefix, JagString.fromInt(x), Client.mapNameSeparator, JagString.fromInt(z)]);
                    arrayPutI32(underwaterLocIds, region, requireNonNull(underwaterLocArchive).GetGroupId(underwaterLocName));
                }
                region++;
            }
        }
        Client.StartRebuild(level, zoneZ, localX, zoneX, localZ, false);
    }

    // hi.b(I)V. Client::GlCheckMinimap in NXT's projects/osclient/client.cpp.
    static GlCheckMinimap(buildBuffer: (level: number) => boolean = MinimapBuilder.BuildBuffer): void {
        try {
            if (!Preferences.getAllLevelsVisible() && ClientBuild.buildLevel !== Client.playerLevel) {
                if (glJar) {
                    const level = Client.playerLevel;
                    const centreZ = Client.mapBuildCentreZoneZ;
                    const centreX = Client.mapBuildCentreZoneX;
                    const localZ = arrayAtI32(requireNonNull(Client.localPlayer).pathZ, 0);
                    const localX = arrayAtI32(requireNonNull(Client.localPlayer).pathX, 0);
                    Client.StartRebuild(level, centreZ, localX, centreX, localZ, false);
                } else {
                    Client.StartRebuild(Client.playerLevel, Client.mapBuildCentreZoneZ, arrayAtI32(requireNonNull(Client.localPlayer).pathX, 0), Client.mapBuildCentreZoneX, arrayAtI32(requireNonNull(Client.localPlayer).pathZ, 0), false);
                }
            } else if (MinimapBuilder.minimapLevel !== Client.playerLevel && buildBuffer(Client.playerLevel)) {
                MinimapBuilder.minimapLevel = Client.playerLevel;
                RoofModeStatics.applyRoofMode();
            }
        } catch (error) {
            if (!glJar || !isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'ch.E(0)');
        }
    }
    static fontPlain11: PixfontGeneric | null = null; // ma.b:Lmb;
    static p11Software: SoftwareFont | null = null; // rg.h:Lfg;
    static p12: PixfontGeneric | null = null; // wj.g:Lmb;
    static fontBold12: PixfontGeneric | null = null; // uf.b:Lmb;
    static imageMapfunction: (Pix32 | null)[] | null = null; // vb.d:[Lrh;
    static readonly activeMapFunctionX = new Int32Array(1000); // ba.h:[I
    static readonly activeMapFunctionZ = new Int32Array(1000); // oh.m:[I
    static activeMapFunctionCount = 0; // qk.C:I
    static imageHitmarks: (AbstractSprite | null)[] | null = null; // pe.B:[Lvc;
    static headiconsPk: (AbstractSprite | null)[] | null = null; // oa.c:[Lvc;
    static imageHeadiconsPrayer: (AbstractSprite | null)[] | null = null; // ph.m:[Lvc;
    static hintMapMarkers: (AbstractSprite | null)[] | null = null; // cf.e:[Lvc;
    static imageMapflag: AbstractSprite | null = null; // fe.Y:Lvc;
    static imageMapdots: (AbstractSprite | null)[] | null = null; // ll.r:[Lvc;
    static imageCompass: AbstractSprite | null = null; // ff.u:Lvc;

    // ld.a(Lal;I)V
    static lookupSpriteGroupIds(sprites: Js5 | null): void {
        sprites = requireNonNull(sprites);
        Client.fontPlain11Id = sprites.GetGroupId(Fonts.p11FullName);
        Client.p12FullGroup = sprites.GetGroupId(Client.p12FullName);
        Client.fontBold12Id = sprites.GetGroupId(Fonts.b12FullName);
        Client.mapfunctionSpriteGroup = sprites.GetGroupId(Client.mapfunctionName);
        SpriteLoader.hitmarksId = sprites.GetGroupId(Client.hitmarksSpriteName);
        if (glJar) void WorldMap.hueOffset; // g.a:65 putstatic kd.Cb initializes kd.rb.
        Client.hitbarDefaultId = sprites.GetGroupId(SpriteLoader.hitbarDefaultName);
        SpriteLoader.headiconsPkId = sprites.GetGroupId(Client.headiconsPkName);
        Client.headiconsPrayerGroup = sprites.GetGroupId(Client.headiconsPrayerName);
        Client.hintHeadiconsGroup = sprites.GetGroupId(Client.hintHeadiconsName);
        Client.hintMapmarkersSpriteGroup = sprites.GetGroupId(Client.hintMapmarkersName);
        Client.mapflagGroupId = sprites.GetGroupId(SpriteLoader.mapflagName);
        Client.crossGroup = sprites.GetGroupId(Client.crossName);
        SpriteLoader.mapdotsGroupId = sprites.GetGroupId(SpriteLoader.mapdotsName);
        Client.scrollbarGroupId = sprites.GetGroupId(Client.scrollbarSpriteName);
        Client.nameIconsGroup = sprites.GetGroupId(Client.nameIconsName);
        SpriteLoader.floorShadowsId = sprites.GetGroupId(Client.floorshadowsSpriteName);
        SpriteLoader.compassId = sprites.GetGroupId(SpriteLoader.compassName);
        Client.hintMapEdgeSpriteId = sprites.GetGroupId(Client.hintMapedgeSpriteName);
    }

    // g.a(ILal;)V
    static loadTitleGroupIds(sprites: Js5 | null): void {
        sprites = requireNonNull(sprites);
        TitleScreen.backgroundId = sprites.GetGroupId(TitleScreen.titleBgName);
        TitleScreen.logoGroup = sprites.GetGroupId(TitleScreen.logoName);
    }

    // SD pf.a(Lal;I)V / HD gg.a(ILve;)V
    static findRunesSpriteGroup(sprites: Js5 | null, hdGuard?: number): void {
        try {
            if (hdGuard !== undefined && hdGuard !== 28280) VarpType.m_pConfigClient = null;
            TitleFlames.runesGroup = requireNonNull(sprites).GetGroupId(TitleFlames.runesName);
        } catch (error) {
            if (hdGuard === undefined || !isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'gg.R(' + hdGuard + ',' + (sprites === null ? 'null' : '{...}') + ')');
        }
    }

    // nh.a(Lal;Lal;I)I
    static countFontsReady(sprites: Js5 | null, metrics: Js5 | null): number {
        let count = 0;
        sprites = requireNonNull(sprites);
        if (sprites.RequestDownload2(Client.fontPlain11Id)) count++;
        if (sprites.RequestDownload2(Client.p12FullGroup)) count++;
        if (sprites.RequestDownload2(Client.fontBold12Id)) count++;
        if (requireNonNull(metrics).RequestDownload2(Client.fontPlain11Id)) count++;
        if (requireNonNull(metrics).RequestDownload2(Client.p12FullGroup)) count++;
        if (requireNonNull(metrics).RequestDownload2(Client.fontBold12Id)) count++;
        return count;
    }

    // ka.a(Lal;Z)I
    static getGameSpritesLoaded(sprites: Js5 | null, partial: boolean): number {
        let count = 0;
        sprites = requireNonNull(sprites);
        if (sprites.RequestDownload2(Client.mapfunctionSpriteGroup)) count++;
        if (sprites.RequestDownload2(SpriteLoader.hitmarksId, !partial)) count++;
        if (sprites.RequestDownload2(Client.hitbarDefaultId)) count++;
        if (sprites.RequestDownload2(SpriteLoader.headiconsPkId)) count++;
        if (sprites.RequestDownload2(Client.headiconsPrayerGroup)) count++;
        if (sprites.RequestDownload2(Client.hintHeadiconsGroup)) count++;
        if (sprites.RequestDownload2(Client.hintMapmarkersSpriteGroup, !partial)) count++;
        if (partial) return -54;
        if (sprites.RequestDownload2(Client.mapflagGroupId, !partial)) count++;
        if (sprites.RequestDownload2(Client.crossGroup, !partial)) count++;
        if (sprites.RequestDownload2(SpriteLoader.mapdotsGroupId, !partial)) count++;
        if (sprites.RequestDownload2(Client.scrollbarGroupId, !partial)) count++;
        if (sprites.RequestDownload2(Client.nameIconsGroup)) count++;
        if (sprites.RequestDownload2(SpriteLoader.floorShadowsId)) count++;
        if (sprites.RequestDownload2(SpriteLoader.compassId)) count++;
        if (sprites.RequestDownload2(Client.hintMapEdgeSpriteId)) count++;
        return count;
    }

    // HD cg.a(ZILve;I)[Lek;. Its only caller passes true.
    private static loadFloorShadowSprites(group: number, archive: Js5 | null, file: number): (Pix8 | null)[] | null {
        if (!SpriteLoader.load(file, group, archive)) return null;
        return SpriteLoader.createIndexedSprites();
    }

    // SD uf.a(Lal;I)V, HD cg.a(ILve;)V. NXT inlines the setup in Client::MainLoad.
    static loadSprites(archive: Js5 | null): void {
        Client.imageMapfunction = SpriteLoader.loadSoftwareSprites(Client.mapfunctionSpriteGroup, archive, 0);
        Client.imageHitmarks = SpriteLoader.loadSprites(SpriteLoader.hitmarksId, archive, 0);
        SpriteLoader.hitbarDefault = SpriteLoader.loadSprites(Client.hitbarDefaultId, archive, 0);
        Client.headiconsPk = SpriteLoader.loadSprites(SpriteLoader.headiconsPkId, archive, 0);
        Client.imageHeadiconsPrayer = SpriteLoader.loadSprites(Client.headiconsPrayerGroup, archive, 0);
        Client.hintHeadicons = SpriteLoader.loadSprites(Client.hintHeadiconsGroup, archive, 0);
        Client.hintMapMarkers = SpriteLoader.loadSprites(Client.hintMapmarkersSpriteGroup, archive, 0);
        Client.imageMapflag = SpriteLoader.loadSprite2(archive, Client.mapflagGroupId, 0);
        SpriteLoader.cross = SpriteLoader.loadSprites2(0, archive, Client.crossGroup);
        Client.imageMapdots = SpriteLoader.loadSprites2(0, archive, SpriteLoader.mapdotsGroupId);
        SpriteLoader.scrollbars = SpriteLoader.loadIndexedSprites2(Client.scrollbarGroupId, 0, archive);
        PixfontGeneric.nameIcons = SpriteLoader.loadIndexedSprites2(Client.nameIconsGroup, 0, archive);
        requireNonNull(Client.fontPlain11).setNameIcons(PixfontGeneric.nameIcons, null);
        requireNonNull(Client.p12).setNameIcons(PixfontGeneric.nameIcons, null);
        requireNonNull(Client.fontBold12).setNameIcons(PixfontGeneric.nameIcons, null);
        const renderer = glJar ? GlRendererClass : null;
        if (renderer !== null && renderer.active) {
            const GroundShadows = GroundShadowsClass;
            GroundShadows.shadowSprites = Client.loadFloorShadowSprites(SpriteLoader.floorShadowsId, archive, 0);
            for (let i = 0; i < requireNonNull(GroundShadows.shadowSprites).length; i++) {
                requireNonNull(arrayAtObj(GroundShadows.shadowSprites, i)).trim();
            }
        }
        const compass = SpriteLoader.loadSoftwareSprite(archive, SpriteLoader.compassId, 0);
        requireNonNull(compass).trim();
        if (renderer !== null && renderer.active) {
            const GlSprite = loadGlSprite();
            Client.imageCompass = new GlSprite(compass);
        } else Client.imageCompass = compass;
        const edges = SpriteLoader.loadSoftwareSprites(Client.hintMapEdgeSpriteId, archive, 0);
        for (const edge of requireNonNull(edges)) requireNonNull(edge).trim();
        if (renderer !== null && renderer.active) {
            const GlSprite = loadGlSprite();
            SpriteLoader.hintMapEdge = new Array<AbstractSprite | null>(requireNonNull(edges).length).fill(null);
            for (let i = 0; i < requireNonNull(edges).length; i++) {
                arrayPutObj(SpriteLoader.hintMapEdge, i, new GlSprite(arrayAtObj(edges, i)));
            }
        } else SpriteLoader.hintMapEdge = edges;
        if (glJar) {
            const green = ((21 * mathRandom.nextDouble()) | 0) - 10;
            const red = ((21 * mathRandom.nextDouble()) | 0) - 10;
            const blue = -10 + ((21 * mathRandom.nextDouble()) | 0);
            const common = -20 + ((mathRandom.nextDouble() * 41) | 0);
            for (let i = 0; i < requireNonNull(Client.imageMapfunction).length; i++) {
                requireNonNull(arrayAtObj(Client.imageMapfunction, i)).rgbAdjust(red + common, common + green, common + blue);
            }
        } else {
            const blue = ((21 * mathRandom.nextDouble()) | 0) - 10;
            const red = ((mathRandom.nextDouble() * 21) | 0) - 10;
            const common = ((41 * mathRandom.nextDouble()) | 0) - 20;
            const green = ((21 * mathRandom.nextDouble()) | 0) - 10;
            for (let i = 0; i < requireNonNull(Client.imageMapfunction).length; i++) {
                requireNonNull(arrayAtObj(Client.imageMapfunction, i)).rgbAdjust(common + red, green + common, blue + common);
            }
        }
        if (renderer !== null && renderer.active) {
            const GlSprite = loadGlSprite();
            SpriteLoader.mapfunctionsRecoloured = new Array<AbstractSprite | null>(requireNonNull(Client.imageMapfunction).length).fill(null);
            for (let i = 0; i < requireNonNull(Client.imageMapfunction).length; i++) {
                arrayPutObj(SpriteLoader.mapfunctionsRecoloured, i, new GlSprite(arrayAtObj(Client.imageMapfunction, i)));
            }
        } else SpriteLoader.mapfunctionsRecoloured = Client.imageMapfunction;
    }

    // HD ul.I:Lgn;. The gamepack only constructs, resets and releases this four-entry cache.
    static windowResourceCache = glJar ? new LruHashTable(4) : null;

    // HD lb.a(Z)V, called with false by pm.a.
    reloadWindowResources(): void | Promise<void> {
        return runToCompletion(
            (function* (client: Client): Generator<Promise<void>, void, void> {
                try {
                    world.ResetMap();
                    MinimapBuilder.minimapImage = null;
                    MinimapBuilder.minimapLevel = -1;
                    Client.ResetCache();
                    requireNonNull(Client.windowResourceCache).Reset();
                    LocType.modelResult = new LocEntity();
                    const textures = Pix3D.textureProvider;
                    if (textures !== null && !(textures instanceof TextureCache)) throw new TypeError('ClassCastException: expected TextureCache');
                    requireNonNull(textures).ClearCache();
                    const PointLightManager = PointLightManagerClass;
                    PointLightManager.lightCount = 0;
                    PointLightManager.lights = new Array(255).fill(null);
                    const GlModel = loadGlModel();
                    GlModel.resetTempModels();
                    const GroundShadows = GroundShadowsClass;
                    GroundShadows.unload();
                    Client.clearWindowSprites();
                    WorldMap.Reset(false);
                    TitleScreen.Close();
                    for (let i = 0; i < 2048; i++) {
                        const player = arrayAtObj(Client.players, i);
                        if (player !== null) player.attachment = null;
                    }
                    const GlRenderer = GlRendererClass;
                    if (GlRenderer.active) {
                        GroundShadows.init(104, 104);
                        GlRenderer.initPointParameters();
                    }
                    const metrics = Client.fontMetricsArchive;
                    Client.loadFonts(Client.m_pSprites, metrics);
                    Client.loadSprites(Client.m_pSprites);
                    Minimenu.spriteBottomCorner = null;
                    Minimenu.titleBarSprite = null;
                    Minimenu.styleSideSprite = null;
                    Minimenu.bottomEdgeSprite = null;
                    Minimenu.skinTitleEndSprite2 = null;
                    if (Client.gameState === 5) TitleScreen.Open(Client.m_pSprites);
                    if (Client.gameState === 10) {
                        const reset = client.resetToTitle(false);
                        if (reset instanceof Promise) yield reset;
                    }
                    if (Client.gameState === 30) Client.SetMainState(25);
                } catch (error) {
                    if (!isJavaRuntimeException(error)) throw error;
                    throw WrappedException.wrap(error, 'lb.C(false)');
                }
            })(this)
        );
    }

    // HD ja.a(false)V, called by lb.a when the window resources are replaced.
    static clearWindowSprites(): void {
        Client.p12 = null;
        Client.imageHitmarks = null;
        SpriteLoader.cross = null;
        PixfontGeneric.nameIcons = null;
        Client.p11Software = null;
        Client.imageMapfunction = null;
        SpriteLoader.mapfunctionsRecoloured = null;
        Client.hintMapMarkers = null;
        Client.imageHeadiconsPrayer = null;
        Client.fontBold12 = null;
        Client.imageCompass = null;
        Client.imageMapdots = null;
        Client.fontPlain11 = null;
        Client.imageMapflag = null;
        SpriteLoader.hitbarDefault = null;
        SpriteLoader.hintMapEdge = null;
        Client.hintHeadicons = null;
        Client.headiconsPk = null;
        SpriteLoader.scrollbars = null;
    }

    // HD j.a([BI)Ldd;. Unlike ce.a, this factory always builds a dd. Its caller passes 25208.
    private static createSoftwareFont(data: Uint8Array | null): SoftwareFont | null {
        if (data === null) return null;
        const font = new SoftwareFont(data, SpriteLoader.xOffsets, SpriteLoader.yOffsets, SpriteLoader.widths, SpriteLoader.innerHeights, SpriteLoader.pixels);
        SpriteLoader.clear();
        return font;
    }

    // HD jh.a(IILve;Lve;I)Ldd;. hn.a passes -1 as the guard and reads p11's data a second time.
    private static loadSoftwareFont(group: number, file: number, metrics: Js5 | null, sprites: Js5 | null): SoftwareFont | null {
        if (!SpriteLoader.load(file, group, sprites)) return null;
        return Client.createSoftwareFont(requireNonNull(metrics).GetFile(file, group));
    }

    // SD si.a(BLal;Lal;)V, HD hn.a(Lve;ILve;)V. In HD its int is the p12 file ID.
    static loadFonts(sprites: Js5 | null, metrics: Js5 | null, p12File = 0): void {
        Client.fontPlain11 = SpriteLoader.loadFont(sprites, Client.fontPlain11Id, 0, metrics);
        if (glJar && GlRendererClass.active) {
            Client.p11Software = Client.loadSoftwareFont(Client.fontPlain11Id, 0, metrics, sprites);
        } else {
            const plain11 = Client.fontPlain11;
            if (plain11 !== null && !(plain11 instanceof SoftwareFont)) throw new TypeError('ClassCastException: expected SoftwareFont');
            Client.p11Software = plain11;
        }
        Client.p12 = SpriteLoader.loadFont(sprites, Client.p12FullGroup, glJar ? p12File : 0, metrics);
        Client.fontBold12 = SpriteLoader.loadFont(sprites, Client.fontBold12Id, 0, metrics);
    }

    // SD vg.a(Lid;ZB)V, HD j.a(BZLna;)V. Client::MessageBox in NXT's projects/osclient/client_network.cpp.
    static MessageBox(text: JagString | null, immediate: boolean, hdGuard = -125): void {
        if (glJar) {
            try {
                if (hdGuard > -11) return;
                const renderer = GlRendererClass;
                const padding = 4,
                    x = 10,
                    y = 10;
                const width = requireNonNull(Client.p12).getParagraphWidth(text, 250);
                const height = Math.imul(requireNonNull(Client.p12).getParagraphLineCount(text, 250), 13);
                if (renderer.active) {
                    const raster = loadGlRaster();
                    raster.fillRect(x - padding, y - padding, (width + padding + padding) | 0, (padding + padding + height) | 0, 0);
                    raster.drawRect(x - padding, y - padding, (width + padding + padding) | 0, (padding + height + padding) | 0, 0xffffff);
                } else {
                    Pix2D.fillRect(x - padding, y - padding, (padding + width + padding) | 0, (padding + padding + height) | 0, 0);
                    Pix2D.drawRect(x - padding, y - padding, (padding + padding + width) | 0, (padding + padding + height) | 0, 0xffffff);
                }
                requireNonNull(Client.p12).drawParagraph(text, x, y, width, height, 0xffffff, -1, 1, 1, 0);
                InterfaceList.invalidateArea((padding + height + padding) | 0, x - padding, (width + padding + padding) | 0, y - padding);
                if (immediate) {
                    if (renderer.active) {
                        renderer.swapBuffers();
                    } else {
                        try {
                            const canvas = requireNonNull(GameShell.canvas);
                            const graphics = 'getGraphics' in canvas ? (canvas as AwtComponent).getGraphics() : requireNonNull(Client.activeClient).getSoftwareCanvasComponent().getGraphics();
                            requireNonNull(GameShell.drawArea).draw(0, 0, graphics);
                        } catch (error) {
                            if (!(error instanceof Error) || error instanceof JavaError) throw error;
                            const canvas = requireNonNull(GameShell.canvas);
                            if ('repaint' in canvas) (canvas as { repaint(): void }).repaint();
                            else {
                                const host = Client.activeClient?.host;
                                if (host && canvas === host.canvas) {
                                    const component = host.component;
                                    requestAnimationFrame(() => component.update(component.getGraphics()));
                                } else GameShell.fullRedraw = true;
                            }
                        }
                    }
                } else {
                    InterfaceList.redrawArea(y, height, width, x);
                }
            } catch (error) {
                if (!isJavaRuntimeException(error)) throw error;
                throw WrappedException.wrap(error, 'j.TA(' + hdGuard + ',' + immediate + ',' + (text === null ? 'null' : '{...}') + ')');
            }
            return;
        }
        const padding = 4,
            x = padding + 6,
            y = 6 + padding;
        const font = requireNonNull(Client.p12);
        const width = font.getParagraphWidth(text, 250);
        const height = Math.imul(font.getParagraphLineCount(text, 250), 13);
        Pix2D.fillRect(x - padding, y - padding, (width + padding + padding) | 0, (padding + padding + height) | 0, 0);
        Pix2D.drawRect(x - padding, y - padding, (padding + width + padding) | 0, (padding + padding + height) | 0, 0xffffff);
        font.drawParagraph(text, x, y, width, height, 0xffffff, -1, 1, 1, 0);
        InterfaceList.invalidateArea((padding + padding + height) | 0, x - padding, (padding + width + padding) | 0, y - padding);
        if (!immediate) InterfaceList.redrawArea(y, height, width, x);
        else {
            try {
                const host = requireNonNull(requireNonNull(Client.activeClient).host);
                requireNonNull(GameShell.drawArea).draw(0, 0, host.component.getGraphics());
            } catch {
                GameShell.fullRedraw = true;
            }
        }
    }
    // bj.a(IIIIIIZ)V. NXT Client::StartRebuild, client.cpp:7671. The fourth Java argument is zero at all callers.
    static StartRebuild(level: number, centreZoneZ: number, localX: number, centreZoneX: number, localZ: number, title: boolean): void {
        try {
            Client.startRebuildBody(level, centreZoneZ, localX, centreZoneX, localZ, title);
        } catch (error) {
            if (!glJar || !isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'k.D(' + [level, centreZoneZ, centreZoneX, localZ, title, localX, true].join(',') + ')');
        }
    }

    private static startRebuildBody(level: number, centreZoneZ: number, localX: number, centreZoneX: number, localZ: number, title: boolean): void {
        if (Client.mapBuildCentreZoneX === centreZoneX && Client.mapBuildCentreZoneZ === centreZoneZ && (ClientBuild.buildLevel === level || Preferences.getAllLevelsVisible())) return;
        Client.mapBuildCentreZoneX = centreZoneX;
        Client.mapBuildCentreZoneZ = centreZoneZ;
        ClientBuild.buildLevel = level;
        if (Preferences.getAllLevelsVisible()) ClientBuild.buildLevel = 0;
        Client.SetMainState(title ? 28 : 25);
        Client.MessageBox(LocalisedText.loadingPleaseWait2, true);
        const oldZ = Client.mapBuildBaseZ,
            oldX = Client.mapBuildBaseX;
        if (glJar) {
            Client.mapBuildBaseZ = (Math.imul(centreZoneZ, 8) - 48) | 0;
            Client.mapBuildBaseX = Math.imul(8, centreZoneX - 6);
        } else {
            Client.mapBuildBaseX = Math.imul(8, centreZoneX - 6);
            Client.mapBuildBaseZ = Math.imul(8, centreZoneZ - 6);
        }
        WorldMap.sceneArea = MapArea.at(Math.imul(8, Client.mapBuildCentreZoneX), Math.imul(8, Client.mapBuildCentreZoneZ));
        if (!glJar) WorldMapLabels.scene = null;
        const dz = (Client.mapBuildBaseZ - oldZ) | 0,
            dx = (Client.mapBuildBaseX - oldX) | 0;
        // k.a and bj.a reload the two coordinates into unused locals after computing the deltas.
        if (glJar) {
            void Client.mapBuildBaseX;
            void Client.mapBuildBaseZ;
            WorldMapLabels.scene = null;
        } else {
            void Client.mapBuildBaseZ;
            void Client.mapBuildBaseX;
        }
        if (title) {
            Client.npcCount = 0;
            for (let i = 0; i < 32768; i++) {
                const npc = arrayAtObj(Client.npcs, i);
                if (npc === null) continue;
                if (glJar) {
                    npc.x = (npc.x - Math.imul(128, dx)) | 0;
                    npc.z = (npc.z - Math.imul(128, dz)) | 0;
                } else {
                    npc.z = (npc.z - Math.imul(128, dz)) | 0;
                    npc.x = (npc.x - Math.imul(dx, 128)) | 0;
                }
                if (npc.x >= 0 && npc.x <= 13184 && npc.z >= 0 && npc.z <= 13184) {
                    for (let j = 0; j < 10; j++) {
                        const x = npc.pathX;
                        arrayPutI32(x, j, (arrayAtI32(x, j) - dx) | 0);
                        const z = npc.pathZ;
                        arrayPutI32(z, j, (arrayAtI32(z, j) - dz) | 0);
                    }
                    const ids = Client.npcIds;
                    const count = Client.npcCount;
                    Client.npcCount = (count + 1) | 0;
                    arrayPutI32(ids, count, i);
                } else {
                    requireNonNull(arrayAtObj(Client.npcs, i)).setType(null);
                    arrayPutObj(Client.npcs, i, null);
                }
            }
        } else {
            for (let i = 0; i < 32768; i++) {
                const npc = arrayAtObj(Client.npcs, i);
                if (npc === null) continue;
                for (let j = 0; j < 10; j++) {
                    const x = npc.pathX;
                    arrayPutI32(x, j, (arrayAtI32(x, j) - dx) | 0);
                    const z = npc.pathZ;
                    arrayPutI32(z, j, (arrayAtI32(z, j) - dz) | 0);
                }
                if (glJar) {
                    npc.x = (npc.x - Math.imul(128, dx)) | 0;
                    npc.z = (npc.z - Math.imul(128, dz)) | 0;
                } else {
                    npc.z = (npc.z - Math.imul(128, dz)) | 0;
                    npc.x = (npc.x - Math.imul(128, dx)) | 0;
                }
            }
        }
        for (let i = 0; i < 2048; i++) {
            const player = arrayAtObj(Client.players, i);
            if (player === null) continue;
            for (let j = 0; j < 10; j++) {
                const x = player.pathX;
                arrayPutI32(x, j, (arrayAtI32(x, j) - dx) | 0);
                const z = player.pathZ;
                arrayPutI32(z, j, (arrayAtI32(z, j) - dz) | 0);
            }
            if (glJar) {
                player.x = (player.x - Math.imul(128, dx)) | 0;
                player.z = (player.z - Math.imul(128, dz)) | 0;
            } else {
                player.z = (player.z - Math.imul(dz, 128)) | 0;
                player.x = (player.x - Math.imul(128, dx)) | 0;
            }
        }
        Client.playerLevel = level;
        requireNonNull(Client.localPlayer).move(false, localZ, localX);

        let firstX = 0,
            lastX = 104,
            stepX = 1;
        if (dx < 0) {
            lastX = -1;
            firstX = 103;
            stepX = -1;
        }
        let stepZ = 1,
            firstZ = 0,
            lastZ = 104;
        if (dz < 0) {
            lastZ = -1;
            firstZ = 103;
            stepZ = -1;
        }
        for (let destX = firstX; destX !== lastX; destX += stepX) {
            for (let destZ = firstZ; destZ !== lastZ; destZ += stepZ) {
                const sourceX = (destX + dx) | 0;
                const sourceZ = (dz + destZ) | 0;
                for (let plane = 0; plane < 4; plane++) {
                    if (sourceX >= 0 && sourceZ >= 0 && sourceX < 104 && sourceZ < 104) {
                        const dest = arrayAtObj(arrayAtObj(Client.groundObj, plane), destX);
                        const source = arrayAtObj(arrayAtObj(Client.groundObj, plane), sourceX);
                        arrayPutObj(dest, destZ, arrayAtObj(source, sourceZ));
                    } else {
                        arrayPutObj(arrayAtObj(arrayAtObj(Client.groundObj, plane), destX), destZ, null);
                    }
                }
            }
        }
        for (let loc = Client.locChanges.head(); loc !== null; loc = Client.locChanges.next()) {
            if (!(loc instanceof LocChange)) throw new TypeError('ClassCastException: not a LocChange');
            loc.z = (loc.z - dz) | 0;
            loc.x = (loc.x - dx) | 0;
            if (loc.x < 0 || loc.z < 0 || loc.x >= 104 || loc.z >= 104) loc.Unlink();
        }
        if (glJar) {
            if (title) {
                OrbitCamera.x = (OrbitCamera.x - Math.imul(128, dx)) | 0;
                OrbitCamera.z = (OrbitCamera.z - Math.imul(128, dz)) | 0;
                CinematicCamera.tileZ = (CinematicCamera.tileZ - dz) | 0;
                CinematicCamera.lookX = (CinematicCamera.lookX - dx) | 0;
                CinematicCamera.lookZ = (CinematicCamera.lookZ - dz) | 0;
                CinematicCamera.tileX = (CinematicCamera.tileX - dx) | 0;
            } else OrbitCamera.mode = 1;
            Client.soundEffectCount = 0;
            if (Client.destinationX !== 0) {
                Client.destinationZ = (Client.destinationZ - dz) | 0;
                Client.destinationX = (Client.destinationX - dx) | 0;
            }
            if (GlRendererClass.active && title && ((Math.abs(dx) | 0) > 104 || (Math.abs(dz) | 0) > 104)) Client.forceImmediateEnvironmentUpdate = true;
            MinimapBuilder.minimapLevel = -1;
        } else {
            Client.soundEffectCount = 0;
            MinimapBuilder.minimapLevel = -1;
            if (title) {
                CinematicCamera.tileX = (CinematicCamera.tileX - dx) | 0;
                OrbitCamera.x = (OrbitCamera.x - Math.imul(dx, 128)) | 0;
                CinematicCamera.lookZ = (CinematicCamera.lookZ - dz) | 0;
                CinematicCamera.lookX = (CinematicCamera.lookX - dx) | 0;
                CinematicCamera.tileZ = (CinematicCamera.tileZ - dz) | 0;
                OrbitCamera.z = (OrbitCamera.z - Math.imul(128, dz)) | 0;
            } else OrbitCamera.mode = 1;
            if (Client.destinationX !== 0) {
                Client.destinationX = (Client.destinationX - dx) | 0;
                Client.destinationZ = (Client.destinationZ - dz) | 0;
            }
        }
        MapSpotAnim.active.clear();
        Client.projectiles.clear();
    }

    static locChanges = new SharedPtrList<LocChange>(); // wh.S:Lgk;

    // de.a(Lff;I)V. Client::LocChangeSetOld, projects/osclient/client_utils.cpp:1266. Both callers pass zero for the initial angle.
    static LocChangeSetOld(change: LocChange, initialAngle = 0, scene: Pick<typeof world, 'WallType' | 'DecorType' | 'SceneType' | 'GdType'> = world): void {
        let key = 0n;
        if (change.layer === 0) key = scene.WallType(change.plane, change.x, change.z);
        if (change.layer === 1) key = scene.DecorType(change.plane, change.x, change.z);
        let id = -1;
        if (change.layer === 2) key = scene.SceneType(change.plane, change.x, change.z);
        let angle = initialAngle;
        let shape = 0;
        if (change.layer === 3) key = scene.GdType(change.plane, change.x, change.z);
        if (key !== 0n) {
            id = Number((key >> 32n) & 0x7fffffffn);
            const low = Number(BigInt.asIntN(32, key));
            angle = (3747088 & low) >> 20;
            shape = (low >> 14) & 31;
        }
        change.oldAngle = angle;
        change.oldShape = shape;
        change.oldId = id;
    }

    // b.a(IZIIIIIIII)V
    static LocChangeCreate(delay: number, shape: number, x: number, remaining: number, z: number, plane: number, layer: number, id: number, angle: number): void {
        let change = null;
        for (let entry = Client.locChanges.head(); entry !== null; entry = Client.locChanges.next()) {
            if (!(entry instanceof LocChange)) throw new TypeError('ClassCastException: not a LocChange');
            if (entry.plane === plane && entry.x === x && entry.z === z && layer === entry.layer) {
                change = entry;
                break;
            }
        }
        if (change === null) {
            change = new LocChange();
            change.z = z;
            change.x = x;
            change.plane = plane;
            change.layer = layer;
            Client.LocChangeSetOld(change, 0, SceneCutover.active ? world : legacyLocTypecodes);
            Client.locChanges.push_back(change);
        }
        change.delay = delay;
        change.angle = angle;
        change.remaining = remaining;
        change.shape = shape;
        change.id = id;
    }

    // o.a(IIIBIIII)V. Client::LocChangeUnchecked, projects/osclient/client_utils.cpp:1367.
    static LocChangeUnchecked(shape: number, plane: number, id: number, layer: number, x: number, angle: number, z: number): void {
        if (x < 1 || z < 1 || x > 102 || z > 102) return;
        if (!Preferences.getAllLevelsVisible() && (arrayAtU8(arrayAtObj(arrayAtObj(ClientBuild.m_mapl, 0), x), z) & 2) === 0) {
            let visibleLevel = plane;
            if ((arrayAtU8(arrayAtObj(arrayAtObj(ClientBuild.m_mapl, plane), x), z) & 8) !== 0) visibleLevel = 0;
            if (ClientBuild.buildLevel !== visibleLevel) return;
        }
        let heightLevel = plane;
        if (plane < 3 && (arrayAtU8(arrayAtObj(arrayAtObj(ClientBuild.m_mapl, 1), x), z) & 2) === 2) heightLevel = (plane + 1) | 0;
        LocChange.removeUnchecked(arrayAtObj(CollisionMap.levelMaps, plane), x, heightLevel, plane, z, layer);
        if (id >= 0) {
            const previous = Preferences.showGroundDecorations;
            Preferences.showGroundDecorations = true;
            const collision = arrayAtObj(CollisionMap.levelMaps, plane);
            ClientBuild.AddLoc(false, plane, id, heightLevel, angle, shape, x, z, false, collision);
            Preferences.showGroundDecorations = previous;
        }
    }

    // od.e(B)V
    static LocChangeDoQueue(): void {
        for (let change = Client.locChanges.head(); change !== null; change = Client.locChanges.next()) {
            if (!(change instanceof LocChange)) throw new TypeError('ClassCastException: not a LocChange');
            if (change.remaining > 0) change.remaining = (change.remaining - 1) | 0;
            if (change.remaining !== 0) {
                if (change.delay > 0) change.delay = (change.delay - 1) | 0;
                if (change.delay !== 0 || change.x < 1 || change.z < 1 || change.x > 102 || change.z > 102 || (change.id >= 0 && !ClientBuild.ChangeLocAvailable(change.id, change.shape))) continue;
                const shape = change.shape,
                    plane = change.plane,
                    id = change.id,
                    layer = change.layer;
                const x = change.x,
                    angle = change.angle,
                    z = change.z;
                if (SceneCutover.active) Client.LocChangeUnchecked(shape, plane, id, layer, x, angle, z);
                else LocChange.scene?.setLoc(plane, x, z, layer, id, shape, angle);
                change.delay = -1;
                if (change.id === change.oldId && change.oldId === -1) change.Unlink();
                else if (change.oldId === change.id && change.angle === change.oldAngle && change.shape === change.oldShape) change.Unlink();
            } else if (change.oldId < 0 || ClientBuild.ChangeLocAvailable(change.oldId, change.oldShape)) {
                const shape = change.oldShape,
                    plane = change.plane,
                    id = change.oldId,
                    layer = change.layer;
                const x = change.x,
                    angle = change.oldAngle,
                    z = change.z;
                if (SceneCutover.active) Client.LocChangeUnchecked(shape, plane, id, layer, x, angle, z);
                else LocChange.scene?.setLoc(plane, x, z, layer, id, shape, angle);
                change.Unlink();
            }
        }
    }

    // l.b(Z)V
    static LocChangePostBuildCorrect(): void {
        for (let change = Client.locChanges.head(); change !== null; change = Client.locChanges.next()) {
            if (!(change instanceof LocChange)) throw new TypeError('ClassCastException: not a LocChange');
            if (change.remaining === -1) {
                change.delay = 0;
                Client.LocChangeSetOld(change, 0, SceneCutover.active ? world : legacyLocTypecodes);
            } else change.Unlink();
        }
    }
    // wk.o:Lve;
    static readonly npcHitbarSprites = new LRUHashCache<(AbstractSprite | null)[]>(4);

    // gf.f(I)V
    static removeSoftCaches(): void {
        FloType.removeSoft();
        FluType.removeSoft();
        IdkType.removeSoft();
        LocType.removeSoft();
        NpcType.removeSoft();
        ObjType.removeSoft();
        SeqType.removeSoft();
        SpotType.removeSoft();
        VarBitType.removeSoft();
        VarpType.removeSoft();
        BASTypeList.removeSoft();
        MSITypeList.removeSoft();
        LightType.removeSoft();
        CursorType.removeSoft();
        PlayerModel.removeSoft();
        IfType.removeSoft();
        HintArrow.removeSoft();
        ClientEntity.removeSoft();
        Client.npcHitbarSprites.removeSoft();
        SoftwareFont.cache.removeSoft();
    }

    // ea.a(Z)V
    static cleanCaches(): void {
        FloType.clean(5);
        FluType.clean(5);
        IdkType.clean(5);
        LocType.clean(5);
        NpcType.clean(5);
        ObjType.clean(5);
        SeqType.clean(5);
        SpotType.clean(5);
        VarBitType.cleanCache(5);
        VarpType.cleanCache(5);
        BASTypeList.CacheClean(5);
        MSITypeList.CacheClean(5);
        LightType.clean(5);
        CursorType.clean(5);
        PlayerModel.cleanModelCaches(5);
        IfType.cleanCaches(50);
        HintArrow.cleanModelCache(5);
        ClientEntity.cleanShadowModelCache(5);
        Client.npcHitbarSprites.Clean(5);
        SoftwareFont.cache.Clean(5);
    }

    // b.H:[[[Lgk;
    static groundObj = Array.from({ length: 4 }, () => Array.from({ length: 104 }, () => new Array<SharedPtrList<ClientObjNode> | null>(104).fill(null)));

    // SD qk.a(IIIIIIII)V uses 2047. HD hd.a uses 110 in TcpIn and 125 in ZonePacket.
    static attachLocAnim(x: number, angle: number, seq: number, z: number, shape: number, level: number, layer: number, guard = glJar ? 125 : 2047): void {
        try {
            if (x < 0 || z < 0 || x >= 103 || z >= 103) return;
            if (layer === 0) {
                const wall = world.GetWall(level, x, z);
                if (wall !== null) {
                    const id = Number((wall.typecode >> 32n) & 0x7fffffffn);
                    if (shape !== 2) {
                        wall.model1 = new ClientLocAnim(id, shape, angle, level, x, z, seq, false, wall.model1);
                    } else {
                        wall.model1 = new ClientLocAnim(id, 2, (angle + 4) | 0, level, x, z, seq, false, wall.model1);
                        wall.model2 = new ClientLocAnim(id, 2, (angle + 1) & 3, level, x, z, seq, false, wall.model2);
                    }
                }
            }
            if (layer === 1) {
                const decor = world.GetDecor(level, x, z);
                if (decor !== null) {
                    const id = Number((decor.typecode >> 32n) & 0x7fffffffn);
                    if (shape === 4 || shape === 5) {
                        decor.model = new ClientLocAnim(id, 4, angle, level, x, z, seq, false, decor.model);
                    } else if (shape === 6) {
                        decor.model = new ClientLocAnim(id, 4, (angle + 4) | 0, level, x, z, seq, false, decor.model);
                    } else if (shape === 7) {
                        decor.model = new ClientLocAnim(id, 4, ((angle + 2) & 3) + 4, level, x, z, seq, false, decor.model);
                    } else if (shape === 8) {
                        decor.model = new ClientLocAnim(id, 4, (angle + 4) | 0, level, x, z, seq, false, decor.model);
                        decor.model2 = new ClientLocAnim(id, 4, ((angle + 2) & 3) + 4, level, x, z, seq, false, decor.model2);
                    }
                }
            }
            if (layer === 2) {
                if (glJar && shape === 11) shape = 10;
                const sprite = world.GetScene(level, x, z);
                if (!glJar && shape === 11) shape = 10;
                if (sprite !== null) {
                    sprite.model = new ClientLocAnim(Number((sprite.typecode >> 32n) & 0x7fffffffn), shape, angle, level, x, z, seq, false, sprite.model);
                }
            }
            if (layer === 3) {
                const ground = world.GetGroundDecor(level, x, z);
                if (ground !== null) {
                    ground.model = new ClientLocAnim(Number((ground.typecode >> 32n) & 0x7fffffffn), 22, angle, level, x, z, seq, false, ground.model);
                }
            }
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(
                error,
                glJar ? 'hd.B(' + level + ',' + guard + ',' + angle + ',' + shape + ',' + z + ',' + layer + ',' + x + ',' + seq + ')' : 'qk.J(' + guard + ',' + x + ',' + angle + ',' + seq + ',' + z + ',' + shape + ',' + level + ',' + layer + ')'
            );
        }
    }

    // ng.b(III)V. Client::ShowObject, projects/osclient/client.cpp:7959.
    static ShowObject(z: number, x: number, scene = SceneCutover.active ? world : legacyGroundObjects, guard = 72): void {
        try {
            const list = arrayAtObj(arrayAtObj(arrayAtObj(Client.groundObj, Client.playerLevel), x), z);
            if (list === null) {
                scene.DelObj(Client.playerLevel, x, z);
                return;
            }
            let value = -99999999;
            let top: ClientObjNode | null = null;
            for (let node = list.head(); node !== null; node = list.next()) {
                if (!(node instanceof ClientObjNode)) throw new TypeError('ClassCastException: not a ClientObjNode');
                const type = ObjType.List(node.obj.id);
                let cost = type.cost;
                if (type.stackable === 1) cost = Math.imul(cost, (1 + node.obj.count) | 0);
                if (value < cost) {
                    top = node;
                    value = cost;
                }
            }
            if (top === null) {
                scene.DelObj(Client.playerLevel, x, z);
                return;
            }
            list.push_front(top);
            let node = list.head();
            let bottom: ClientObj | null = null;
            let middle: ClientObj | null = null;
            for (; node !== null; node = list.next()) {
                if (!(node instanceof ClientObjNode)) throw new TypeError('ClassCastException: not a ClientObjNode');
                const obj = node.obj;
                if (obj.id !== top.obj.id) {
                    if (middle === null) middle = obj;
                    if (middle.id !== obj.id && bottom === null) bottom = obj;
                }
            }
            const key = BigInt((0x60000000 + (z << 7) + x) | 0);
            const plane = Client.playerLevel;
            const height = Client.GetAvH((Math.imul(x, 128) + 64) | 0, (Math.imul(128, z) + 64) | 0, Client.playerLevel, 94);
            scene.SetObj(plane, x, z, height, top.obj, key, middle, bottom);
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'ng.CA(' + guard + ',' + z + ',' + x + ')');
        }
    }

    // dg.B:Lclient;
    static get activeClient(): Client | null {
        return gameClient.instance;
    }
    static set activeClient(client: Client | null) {
        gameClient.instance = client;
    }
    static serverActiveProperties = new HashTable<ServerActiveProperties>(512); // fd.W:Lnc;
    static verifyId = 0; // jd.i:I

    // aj.b(I)V
    static sendVerifyId(): void {
        try {
            Client.out.pHead(177);
            Client.out.p2(Client.verifyId);
        } catch (error) {
            if (!glJar || !isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'fk.D(0)');
        }
    }

    static readonly hintArrows = new Array<HintArrow | null>(4).fill(null); // ve.t:[Lkf;
    // qd.a(I)V. Client::ZonePacket in projects/osclient/client_network.cpp.
    private static ZonePacketSd(): void {
        try {
            if (Protocol.packetType === 16) {
                const pos = Protocol.inPacket.g1(92);
                let x = (Protocol.zoneUpdateX + ((pos >> 4) & 7)) | 0;
                let z = (Protocol.zoneBaseZ + (pos & 7)) | 0;
                let endX = (x + Protocol.inPacket.g1s(1)) | 0;
                let endZ = (z + Protocol.inPacket.g1s(1)) | 0;
                const target = Protocol.inPacket.g2s(122),
                    id = Protocol.inPacket.g2(-2386);
                const startHeight = Protocol.inPacket.g1(-112) * 4;
                const endHeight = Protocol.inPacket.g1(-100) * 4;
                const start = Protocol.inPacket.g2(-2386),
                    end = Protocol.inPacket.g2(-2386);
                let pitch = Protocol.inPacket.g1(-99);
                if (pitch === 255) pitch = -1;
                const distance = Protocol.inPacket.g1(-42);
                if (x >= 0 && z >= 0 && x < 104 && z < 104 && endX >= 0 && endZ >= 0 && endX < 104 && endZ < 104 && id !== 65535) {
                    endZ = (64 + Math.imul(endZ, 128)) | 0;
                    z = (64 + Math.imul(z, 128)) | 0;
                    endX = (64 + Math.imul(endX, 128)) | 0;
                    x = (64 + Math.imul(x, 128)) | 0;
                    const projectile = new ClientProj(id, Client.playerLevel, x, z, (Client.GetAvH(x, z, Client.playerLevel, -25) - startHeight) | 0, (Client.loopCycle + start) | 0, (Client.loopCycle + end) | 0, pitch, distance, target, endHeight);
                    projectile.setTarget(endX, (Client.GetAvH(endX, endZ, Client.playerLevel, 120) - endHeight) | 0, endZ, (Client.loopCycle + start) | 0);
                    Client.projectiles.push_back(new ClientProjNode(projectile));
                }
                return;
            }
            if (Protocol.packetType === 121) {
                const pos = Protocol.inPacket.g1(-33);
                let x = ((Protocol.zoneUpdateX << 1) + ((pos >> 4) & 15)) | 0;
                let z = ((Protocol.zoneBaseZ << 1) + (pos & 15)) | 0;
                let endX = (x + Protocol.inPacket.g1s(1)) | 0;
                let endZ = (z + Protocol.inPacket.g1s(1)) | 0;
                const target = Protocol.inPacket.g2s(112),
                    id = Protocol.inPacket.g2(-2386);
                const startHeight = Protocol.inPacket.g1(117) * 4;
                const endHeight = Protocol.inPacket.g1(119) * 4;
                const start = Protocol.inPacket.g2(-2386),
                    end = Protocol.inPacket.g2(-2386);
                let pitch = Protocol.inPacket.g1(101);
                const distance = Protocol.inPacket.g1(-25);
                if (pitch === 255) pitch = -1;
                if (x >= 0 && z >= 0 && x < 208 && z < 208 && endX >= 0 && endZ >= 0 && endX < 208 && endZ < 208 && id !== 65535) {
                    x = Math.imul(x, 64);
                    z = Math.imul(z, 64);
                    endX = Math.imul(endX, 64);
                    const projectile = new ClientProj(id, Client.playerLevel, x, z, (Client.GetAvH(x, z, Client.playerLevel, -6) - startHeight) | 0, (Client.loopCycle + start) | 0, (Client.loopCycle + end) | 0, pitch, distance, target, endHeight);
                    endZ = Math.imul(endZ, 64);
                    projectile.setTarget(endX, (Client.GetAvH(endX, endZ, Client.playerLevel, 115) - endHeight) | 0, endZ, (Client.loopCycle + start) | 0);
                    Client.projectiles.push_back(new ClientProjNode(projectile));
                }
                return;
            }
            if (Protocol.packetType === 33) {
                const id = Protocol.inPacket.g2_alt1(122);
                const pos = Protocol.inPacket.g1(89);
                const z = (Protocol.zoneBaseZ + (pos & 7)) | 0;
                const x = (Protocol.zoneUpdateX + ((pos >> 4) & 7)) | 0;
                const count = Protocol.inPacket.g2_alt2(22);
                if (x >= 0 && z >= 0 && x < 104 && z < 104) {
                    const obj = new ClientObj();
                    obj.id = id;
                    obj.count = count;
                    if (arrayAtObj(arrayAtObj(arrayAtObj(Client.groundObj, Client.playerLevel), x), z) === null) {
                        arrayPutObj(arrayAtObj(arrayAtObj(Client.groundObj, Client.playerLevel), x), z, new SharedPtrList<ClientObjNode>());
                    }
                    const list = arrayAtObj(arrayAtObj(arrayAtObj(Client.groundObj, Client.playerLevel), x), z);
                    const node = new ClientObjNode(obj);
                    requireNonNull(list).push_back(node);
                    Client.ShowObject(z, x, undefined, 106);
                }
                return;
            }
            if (Protocol.packetType === 14) {
                const pos = Protocol.inPacket.g1(-44);
                const x = (Protocol.zoneUpdateX + ((pos >> 4) & 7)) | 0;
                const z = (Protocol.zoneBaseZ + (pos & 7)) | 0;
                const id = Protocol.inPacket.g2(-2386),
                    oldCount = Protocol.inPacket.g2(-2386),
                    count = Protocol.inPacket.g2(-2386);
                if (x >= 0 && z >= 0 && x < 104 && z < 104) {
                    const list = arrayAtObj(arrayAtObj(arrayAtObj(Client.groundObj, Client.playerLevel), x), z);
                    if (list !== null) {
                        for (let node = list.head(); node !== null; node = list.next()) {
                            if (!(node instanceof ClientObjNode)) throw new TypeError('ClassCastException: not a ClientObjNode');
                            const item = node.obj;
                            if (item.id === (id & 32767) && item.count === oldCount) {
                                item.count = count;
                                break;
                            }
                        }
                        Client.ShowObject(z, x, undefined, -126);
                    }
                }
                return;
            }
            if (Protocol.packetType === 97) {
                const pos = Protocol.inPacket.g1(-11);
                const x = (Protocol.zoneUpdateX + ((pos >> 4) & 7)) | 0;
                const z = (Protocol.zoneBaseZ + (pos & 7)) | 0;
                let id = Protocol.inPacket.g2(-2386);
                if (id === 65535) id = -1;
                const packed = Protocol.inPacket.g1(-78),
                    range = (packed >> 4) & 15;
                const delay = Protocol.inPacket.g1(88),
                    loops = packed & 7;
                if (x >= 0 && z >= 0 && x < 104 && z < 104) {
                    const radius = range + 1;
                    if (
                        arrayAtI32(requireNonNull(Client.localPlayer).pathX, 0) >= x - radius &&
                        arrayAtI32(requireNonNull(Client.localPlayer).pathX, 0) <= x + radius &&
                        arrayAtI32(requireNonNull(Client.localPlayer).pathZ, 0) >= z - radius &&
                        arrayAtI32(requireNonNull(Client.localPlayer).pathZ, 0) <= z + radius &&
                        Preferences.areaSoundVolume !== 0 &&
                        loops > 0 &&
                        Client.soundEffectCount < 50 &&
                        id !== -1
                    ) {
                        arrayPutI32(Client.soundEffectIds, Client.soundEffectCount, id);
                        arrayPutI32(Client.soundEffectLoops, Client.soundEffectCount, loops);
                        arrayPutI32(Client.soundEffectDelays, Client.soundEffectCount, delay);
                        arrayPutObj(Client.soundEffects, Client.soundEffectCount, null);
                        arrayPutI32(Client.soundEffectPositions, Client.soundEffectCount, ((x << 16) + (z << 8) + range) | 0);
                        Client.soundEffectCount = (Client.soundEffectCount + 1) | 0;
                    }
                }
                return;
            }
            if (Protocol.packetType === 240) {
                const pos = Protocol.inPacket.g1_alt3(128);
                const x = (Protocol.zoneUpdateX + ((pos >> 4) & 7)) | 0;
                const z = (Protocol.zoneBaseZ + (pos & 7)) | 0;
                const id = Protocol.inPacket.g2(-2386);
                if (x >= 0 && z >= 0 && x < 104 && z < 104) {
                    const list = arrayAtObj(arrayAtObj(arrayAtObj(Client.groundObj, Client.playerLevel), x), z);
                    if (list !== null) {
                        for (let node = list.head(); node !== null; node = list.next()) {
                            if (!(node instanceof ClientObjNode)) throw new TypeError('ClassCastException: not a ClientObjNode');
                            if (node.obj.id === (id & 32767)) {
                                node.Unlink();
                                break;
                            }
                        }
                        if (list.head() === null) arrayPutObj(arrayAtObj(arrayAtObj(Client.groundObj, Client.playerLevel), x), z, null);
                        Client.ShowObject(z, x, undefined, -110);
                    }
                }
                return;
            }
            if (Protocol.packetType === 135) {
                const receiver = Protocol.inPacket.g2_alt3(-88);
                const pos = Protocol.inPacket.g1_alt2(-80);
                const z = (Protocol.zoneBaseZ + (pos & 7)) | 0;
                const x = (Protocol.zoneUpdateX + ((pos >> 4) & 7)) | 0;
                const count = Protocol.inPacket.g2_alt1(114),
                    id = Protocol.inPacket.g2_alt1(88);
                if (x >= 0 && z >= 0 && x < 104 && z < 104 && receiver !== Client.localPid) {
                    const obj = new ClientObj();
                    obj.count = count;
                    obj.id = id;
                    if (arrayAtObj(arrayAtObj(arrayAtObj(Client.groundObj, Client.playerLevel), x), z) === null) {
                        arrayPutObj(arrayAtObj(arrayAtObj(Client.groundObj, Client.playerLevel), x), z, new SharedPtrList<ClientObjNode>());
                    }
                    const list = arrayAtObj(arrayAtObj(arrayAtObj(Client.groundObj, Client.playerLevel), x), z);
                    const node = new ClientObjNode(obj);
                    requireNonNull(list).push_back(node);
                    Client.ShowObject(z, x, undefined, -103);
                }
                return;
            }
            if (Protocol.packetType === 17) {
                const pos = Protocol.inPacket.g1(81);
                let x = (Protocol.zoneUpdateX + ((pos >> 4) & 7)) | 0;
                let z = (Protocol.zoneBaseZ + (pos & 7)) | 0;
                const id = Protocol.inPacket.g2(-2386),
                    height = Protocol.inPacket.g1(108),
                    delay = Protocol.inPacket.g2(-2386);
                if (x >= 0 && z >= 0 && x < 104 && z < 104) {
                    x = (64 + Math.imul(x, 128)) | 0;
                    z = (64 + Math.imul(z, 128)) | 0;
                    const spot = new MapSpotAnim(id, Client.playerLevel, x, z, (Client.GetAvH(x, z, Client.playerLevel, -74) - height) | 0, delay, Client.loopCycle);
                    MapSpotAnim.active.push_back(new MapSpotAnimNode(spot));
                }
                return;
            }
            if (Protocol.packetType === 195) {
                const info = Protocol.inPacket.g1_alt2(-80),
                    shape = info >> 2;
                const layer = arrayAtI32(LocShape.shapeToLayer, shape),
                    angle = info & 3;
                const pos = Protocol.inPacket.g1(101);
                const x = (Protocol.zoneUpdateX + ((pos >> 4) & 7)) | 0;
                const z = (Protocol.zoneBaseZ + (pos & 7)) | 0;
                if (x >= 0 && z >= 0 && x < 104 && z < 104) Client.LocChangeCreate(0, shape, x, -1, z, Client.playerLevel, layer, -1, angle);
                return;
            }
            if (Protocol.packetType === 104) {
                const pos = Protocol.inPacket.g1(98);
                let x = ((Protocol.zoneUpdateX << 1) + ((pos >> 4) & 15)) | 0;
                let z = ((Protocol.zoneBaseZ << 1) + (pos & 15)) | 0;
                let endX = (x + Protocol.inPacket.g1s(1)) | 0;
                let endZ = (z + Protocol.inPacket.g1s(1)) | 0;
                const source = Protocol.inPacket.g2s(70);
                const target = Protocol.inPacket.g2s(126),
                    id = Protocol.inPacket.g2(-2386);
                let startHeight = Protocol.inPacket.g1s(1);
                const endHeight = Protocol.inPacket.g1(-82) * 4;
                const start = Protocol.inPacket.g2(-2386),
                    end = Protocol.inPacket.g2(-2386);
                let pitch = Protocol.inPacket.g1(100);
                const distance = Protocol.inPacket.g1(79);
                if (pitch === 255) pitch = -1;
                if (x >= 0 && z >= 0 && x < 208 && z < 208 && endX >= 0 && endZ >= 0 && endX < 208 && endZ < 208 && id !== 65535) {
                    x = Math.imul(x, 64);
                    endX = Math.imul(endX, 64);
                    z = Math.imul(z, 64);
                    endZ = Math.imul(endZ, 64);
                    if (source !== 0) {
                        let slot: number;
                        let actor: ClientPlayer | ClientNpc | null;
                        if (source >= 0) {
                            const packed = (source - 1) | 0;
                            slot = (packed >> 11) & 15;
                            actor = arrayAtObj(Client.npcs, packed & 2047);
                        } else {
                            const packed = (-source - 1) | 0;
                            slot = (packed >> 11) & 15;
                            const index = packed & 2047;
                            actor = index === Client.localPid ? Client.localPlayer : arrayAtObj(Client.players, index);
                        }
                        if (actor !== null) {
                            const bas = actor.getBasType();
                            if (bas.transforms !== null && arrayAtObj(bas.transforms, slot) !== null) {
                                startHeight = (startHeight - arrayAtI32(arrayAtObj(bas.transforms, slot), 1)) | 0;
                                const dx = arrayAtI32(arrayAtObj(bas.transforms, slot), 0);
                                let dz = arrayAtI32(arrayAtObj(bas.transforms, slot), 2);
                                const sin = arrayAtI32(Pix3D.sinTable, actor.yaw);
                                const cos = arrayAtI32(Pix3D.cosTable, actor.yaw);
                                const rx = (Math.imul(dx, cos) + Math.imul(dz, sin)) >> 16;
                                dz = (Math.imul(cos, dz) - Math.imul(sin, dx)) >> 16;
                                z = (z + dz) | 0;
                                x = (x + rx) | 0;
                            }
                        }
                    }
                    const projectile = new ClientProj(id, Client.playerLevel, x, z, (Client.GetAvH(x, z, Client.playerLevel, -46) - startHeight) | 0, (Client.loopCycle + start) | 0, (Client.loopCycle + end) | 0, pitch, distance, target, endHeight);
                    projectile.setTarget(endX, (Client.GetAvH(endX, endZ, Client.playerLevel, 115) - endHeight) | 0, endZ, (Client.loopCycle + start) | 0);
                    Client.projectiles.push_back(new ClientProjNode(projectile));
                }
                return;
            }
            if (Protocol.packetType === 202) {
                const info = Protocol.inPacket.g1(127),
                    angle = info & 3,
                    shape = info >> 2;
                const pos = Protocol.inPacket.g1(-93);
                const z = (Protocol.zoneBaseZ + (pos & 7)) | 0;
                const x = (Protocol.zoneUpdateX + ((pos >> 4) & 7)) | 0;
                const x1 = Protocol.inPacket.g1s_alt1(111),
                    z1 = Protocol.inPacket.g1s_alt1(111),
                    z2 = Protocol.inPacket.g1s_alt3(127),
                    loc = Protocol.inPacket.g2_alt2(22);
                const end = Protocol.inPacket.g2_alt1(-118),
                    x2 = Protocol.inPacket.g1s(1),
                    start = Protocol.inPacket.g2(-2386),
                    actor = Protocol.inPacket.ig2bAdd(-19);
                if (!glJar || !GlRendererClass.active) {
                    LocMergeQueue.enqueue(actor, angle, end, x, z2, shape, z, x2, z1, loc, x1, start);
                }
            }
            if (Protocol.packetType === 179) {
                const info = Protocol.inPacket.g1_alt1(118),
                    shape = info >> 2;
                const layer = arrayAtI32(LocShape.shapeToLayer, shape);
                const pos = Protocol.inPacket.g1(-120);
                const x = (Protocol.zoneUpdateX + ((pos >> 4) & 7)) | 0;
                const angle = info & 3;
                const z = (Protocol.zoneBaseZ + (pos & 7)) | 0;
                const id = Protocol.inPacket.g2_alt2(22);
                if (x >= 0 && z >= 0 && x < 104 && z < 104) Client.LocChangeCreate(0, shape, x, -1, z, Client.playerLevel, layer, id, angle);
                return;
            }
            if (Protocol.packetType === 20) {
                const pos = Protocol.inPacket.g1_alt3(128);
                const x = (Protocol.zoneUpdateX + ((pos >> 4) & 7)) | 0;
                const z = (Protocol.zoneBaseZ + (pos & 7)) | 0;
                const info = Protocol.inPacket.g1_alt3(128);
                const angle = info & 3,
                    shape = info >> 2;
                const layer = arrayAtI32(LocShape.shapeToLayer, shape);
                let seq = Protocol.inPacket.g2_alt1(-44);
                if (seq === 65535) seq = -1;
                if (SceneCutover.active) Client.attachLocAnim(x, angle, seq, z, shape, Client.playerLevel, layer);
                else if (x >= 0 && z >= 0 && x < 103 && z < 103) requireNonNull(LocChange.scene).animateLoc?.(Client.playerLevel, x, z, layer, shape, angle, seq);
                return;
            }
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'qd.A(64)');
        }
    }

    static readonly projectiles = new SharedPtrList<ClientProjNode>(); // cg.f:Lgk;
    static mapBuildCentreZoneX = 0; // ic.V:I
    static mapBuildCentreZoneZ = 0; // ah.k:I

    // mf.a(I)V. NXT Client::GdmAddMapAnim, projects/osclient/client_entityoverlays.cpp:941.
    static GdmAddMapAnim(): void {
        for (let node = MapSpotAnim.active.head(); node !== null; node = MapSpotAnim.active.next()) {
            if (!(node instanceof MapSpotAnimNode)) throw new TypeError('ClassCastException: expected MapSpotAnimNode');
            const spot = node.spot;
            if (Client.playerLevel !== spot.plane || spot.finished) {
                node.Unlink();
                continue;
            }
            if (Client.loopCycle < spot.startCycle) continue;
            spot.advance(AreaSoundManager.elapsed);
            if (spot.finished) node.Unlink();
            else world.AddDynamic(spot.plane, spot.x, spot.z, spot.y, 60, spot, 0, -1n, false);
        }
    }

    // pk.a(I)V. NXT Client::GdmAddProjectiles, projects/osclient/client_entityoverlays.cpp:936.
    static GdmAddProjectiles(): void {
        for (let node = Client.projectiles.head(); node !== null; node = Client.projectiles.next()) {
            if (!(node instanceof ClientProjNode)) throw new TypeError('ClassCastException: expected ClientProjNode');
            const projectile = node.projectile;
            if (Client.playerLevel !== projectile.plane || projectile.endCycle < Client.loopCycle) {
                node.Unlink();
                continue;
            }
            if (Client.loopCycle < projectile.startCycle) continue;
            if (projectile.target > 0) {
                const npc = arrayAtObj(Client.npcs, (projectile.target - 1) | 0);
                if (npc !== null && npc.x >= 0 && npc.x < 13312 && npc.z >= 0 && npc.z < 13312) {
                    const x = npc.x;
                    const level = projectile.plane;
                    const height = Client.GetAvH(npc.x, npc.z, level, -51);
                    projectile.setTarget(x, (height - projectile.endHeight) | 0, npc.z, Client.loopCycle);
                }
            }
            if (projectile.target < 0) {
                const index = (-projectile.target - 1) | 0;
                const player = Client.localPid === index ? Client.localPlayer : arrayAtObj(Client.players, index);
                if (player !== null && player.x >= 0 && player.x < 13312 && player.z >= 0 && player.z < 13312) {
                    const x = player.x;
                    const level = projectile.plane;
                    const height = Client.GetAvH(player.x, player.z, level, 121);
                    projectile.setTarget(x, (height - projectile.endHeight) | 0, player.z, Client.loopCycle);
                }
            }
            projectile.advance(AreaSoundManager.elapsed);
            world.AddDynamic(Client.playerLevel, doubleToInt(projectile.x), doubleToInt(projectile.z), doubleToInt(projectile.y), 60, projectile, projectile.yaw, -1n, false);
        }
    }

    // pk.a(I)V. The callback submits the entity to ob.a(IIIIILug;IJZ)Z.
    static pushProjectiles(add: (projectile: ClientProj) => void): void {
        for (let node = Client.projectiles.head(); node !== null; node = Client.projectiles.next()) {
            const projectile = node.projectile;
            const cycle = Client.loopCycle;
            if (projectile.plane !== Client.playerLevel || projectile.endCycle < cycle) {
                node.Unlink();
                continue;
            }
            if (cycle < projectile.startCycle) continue;
            let actor = null;
            let heightGuard = -51;
            if (projectile.target > 0) actor = arrayAtObj(Client.npcs, projectile.target - 1);
            if (projectile.target < 0) {
                heightGuard = 121;
                const player = -projectile.target - 1;
                actor = player === Client.localPid ? Client.localPlayer : arrayAtObj(Client.players, player);
            }
            if (actor !== null && actor.x >= 0 && actor.x < 13312 && actor.z >= 0 && actor.z < 13312) {
                const y = Client.GetAvH(actor.x, actor.z, projectile.plane, heightGuard);
                projectile.setTarget(actor.x, (y - projectile.endHeight) | 0, actor.z, cycle);
            }
            projectile.advance(AreaSoundManager.elapsed);
            add(projectile);
        }
    }
    static hintHeadicons: (AbstractSprite | null)[] | null = null; // wa.a:[Lvc;
    static openUrlRequest: SignlinkRequest | null = null; // b.L:Ldj;
    static urlNewWindow = false; // pa.tb:Z
    static pendingUrl: JagString | null = null; // client.sb:Lid;
    static haveIe6 = false; // vk.kb:Z
    static recolourPalette: Int16Array | null = null; // rc.h:[S
    static viewportFovLow = 256; // ja.Z:S
    static zoomWidth2 = 205; // lg.G:S
    static viewportZoomMin = 256; // ib.db:S
    static zoomWidth = 320; // gi.m:S
    static fovClampMinWidth = 1; // ae.j:S
    static viewportMaxZoom = 32767; // ri.V:S
    static zoomWidthMin = 1; // od.N:S
    static fovClampMaxHeight = 32767; // ae.b:S
    static viewportWidth = 0; // rk.i:I
    static viewportHeight = 0; // sb.g:I
    static viewportX = 0; // HD ah.n:I
    static viewportY = 0; // HD bn.eb:I
    static viewportScale = 0; // HD sc.p:I

    // th.a(IZ)V. The 530 client counts and submits either te.g or the active player list.
    static pushPlayers(local: boolean): void {
        let count = ReceivePlayerPositions.m_lastNum;
        Client.GdmCheckRemoveMapFlag();
        if (local) count = 1;
        for (let i = 0; i < count; i++) {
            const player = local ? Client.localPlayer : arrayAtObj(Client.players, arrayAtI32(ReceivePlayerPositions.m_lastID, i));
            if (player === null || !player.isVisible()) continue;
            const size = player.getSize();
            if (size !== 1) {
                if ((size & 1) === 0 && ((player.x & 127) !== 0 || (player.z & 127) !== 0)) continue;
                if ((size & 1) === 1 && ((player.x & 127) !== 64 || (player.z & 127) !== 64)) continue;
                let minZ = (player.z - Math.imul(64, size)) >> 7;
                let minX = (player.x - Math.imul(size, 64)) >> 7;
                let endX = (minX + player.getSize()) | 0;
                let endZ = (player.getSize() + minZ) | 0;
                if (endX > 104) endX = 104;
                if (minX < 0) minX = 0;
                if (endZ > 104) endZ = 104;
                if (minZ < 0) minZ = 0;
                for (let x = minX; x < endX; x++) {
                    for (let z = minZ; z < endZ; z++) {
                        const row = arrayAtObj(Client.tileActorCount, x);
                        arrayPutI32(row, z, (arrayAtI32(row, z) + 1) | 0);
                    }
                }
            } else if ((player.x & 127) === 64 && (player.z & 127) === 64) {
                const z = player.z >> 7;
                const x = player.x >> 7;
                if (x >= 0 && x < 104 && z >= 0 && z < 104) {
                    const row = arrayAtObj(Client.tileActorCount, x);
                    arrayPutI32(row, z, (arrayAtI32(row, z) + 1) | 0);
                }
            }
        }
        for (let i = 0; i < count; i++) {
            let player: ClientPlayer | null;
            let key: bigint;
            if (local) {
                player = Client.localPlayer;
                key = 0x7ff00000000n;
            } else {
                player = arrayAtObj(Client.players, arrayAtI32(ReceivePlayerPositions.m_lastID, i));
                key = BigInt(arrayAtI32(ReceivePlayerPositions.m_lastID, i)) << 32n;
            }
            if (player === null || !player.isVisible()) continue;
            player.lowDetail = false;
            if (((Preferences.manyIdleAnimations && ReceivePlayerPositions.m_lastNum > 200) || ReceivePlayerPositions.m_lastNum > 50) && !local && player.walkSeq === player.getBasType().ready) player.lowDetail = true;
            const size = player.getSize();
            if (size !== 1) {
                if (((size & 1) === 0 && (player.x & 127) === 0 && (player.z & 127) === 0) || ((size & 1) === 1 && (player.x & 127) === 64 && (player.z & 127) === 0)) {
                    let minX = (player.x - Math.imul(size, 64)) >> 7;
                    let endX = (size + minX) | 0;
                    let minZ = (player.z - Math.imul(64, size)) >> 7;
                    if (endX > 104) endX = 104;
                    if (minX < 0) minX = 0;
                    let covered = true;
                    let endZ = (minZ + size) | 0;
                    if (minZ < 0) minZ = 0;
                    if (endZ > 104) endZ = 104;
                    for (let x = minX; x < endX; x++) {
                        for (let z = minZ; z < endZ; z++) {
                            if (arrayAtI32(arrayAtObj(Client.tileActorCount, x), z) <= 1) {
                                covered = false;
                                break;
                            }
                        }
                    }
                    if (covered) {
                        for (let x = minX; x < endX; x++) {
                            for (let z = minZ; z < endZ; z++) {
                                const row = arrayAtObj(Client.tileActorCount, x);
                                arrayPutI32(row, z, (arrayAtI32(row, z) - 1) | 0);
                            }
                        }
                        continue;
                    }
                }
            } else if ((player.x & 127) === 64 && (player.z & 127) === 64) {
                const x = player.x >> 7;
                const z = player.z >> 7;
                if (x < 0 || x >= 104 || z < 0 || z >= 104) continue;
                if (arrayAtI32(arrayAtObj(Client.tileActorCount, x), z) > 1) {
                    const row = arrayAtObj(Client.tileActorCount, x);
                    arrayPutI32(row, z, (arrayAtI32(row, z) - 1) | 0);
                    continue;
                }
            }
            if (player.attachment !== null && Client.loopCycle >= player.attachmentStart && player.attachmentEnd > Client.loopCycle) {
                player.lowDetail = false;
                const level = Client.playerLevel;
                player.sceneHeight = Client.GetAvH(player.x, player.z, level, -71);
                world.AddDynamic2(Client.playerLevel, player.x, player.z, player.sceneHeight, player, player.yaw, key, player.attachmentMinX, player.attachmentMinZ, player.attachmentMaxX, player.attachmentMaxZ);
            } else {
                const level = Client.playerLevel;
                player.sceneHeight = Client.GetAvH(player.x, player.z, level, 117);
                world.AddDynamic(Client.playerLevel, player.x, player.z, player.sceneHeight, (60 + Math.imul(64, size) - 64) | 0, player, player.yaw, key, player.stretches);
            }
        }
    }

    // SD ig.a(IIIIIIII)Z, HD na.a(IIIIIIIZ)Z. NXT Minimap::DrawDetail, projects/osclient/minimap/Minimap.cpp:263.
    static DrawDetail(z: number, offsetX: number, activeColour: number, level: number, x: number, offsetZ: number, wallColour: number): boolean {
        try {
            let key = world.WallType(level, (offsetX + x) | 0, (offsetZ + z) | 0);
            if (key !== 0n) {
                const low = Number(BigInt.asIntN(32, key));
                const angle = (low & 3692188) >> 20;
                const shape = (low >> 14) & 31;
                const id = Number((key >> 32n) & 0x7fffffffn);
                const type = LocType.List(id);
                if (type.mapScene !== -1) {
                    if (!MinimapBuilder.drawMapScene(type, z, x, angle, offsetZ, offsetX)) return false;
                } else {
                    let colour = wallColour;
                    if (key > 0n) colour = activeColour;
                    const pixels = Pix2D.pixels;
                    const pos = (Math.imul(4, x) + 24624 + Math.imul(2048, 103 - z)) | 0;
                    if (shape === 0 || shape === 2) {
                        if (angle === 0) {
                            arrayPutI32(pixels, pos, colour);
                            arrayPutI32(pixels, (pos + 512) | 0, colour);
                            arrayPutI32(pixels, (pos + 1024) | 0, colour);
                            arrayPutI32(pixels, (pos + 1536) | 0, colour);
                        } else if (angle === 1) {
                            arrayPutI32(pixels, pos, colour);
                            arrayPutI32(pixels, (pos + 1) | 0, colour);
                            arrayPutI32(pixels, (pos + 2) | 0, colour);
                            arrayPutI32(pixels, (pos + 3) | 0, colour);
                        } else if (angle === 2) {
                            arrayPutI32(pixels, (pos + 3) | 0, colour);
                            arrayPutI32(pixels, (pos + 515) | 0, colour);
                            arrayPutI32(pixels, (pos + 1027) | 0, colour);
                            arrayPutI32(pixels, (pos + 1539) | 0, colour);
                        } else if (angle === 3) {
                            arrayPutI32(pixels, (pos + 1536) | 0, colour);
                            arrayPutI32(pixels, (pos + 1537) | 0, colour);
                            arrayPutI32(pixels, (pos + 1538) | 0, colour);
                            arrayPutI32(pixels, (pos + 1539) | 0, colour);
                        }
                    }
                    if (shape === 3) {
                        if (angle === 0) arrayPutI32(pixels, pos, colour);
                        else if (angle === 1) arrayPutI32(pixels, (pos + 3) | 0, colour);
                        else if (angle === 2) arrayPutI32(pixels, (pos + 1539) | 0, colour);
                        else if (angle === 3) arrayPutI32(pixels, (pos + 1536) | 0, colour);
                    }
                    if (shape === 2) {
                        if (angle === 3) {
                            arrayPutI32(pixels, pos, colour);
                            arrayPutI32(pixels, (pos + 512) | 0, colour);
                            arrayPutI32(pixels, (pos + 1024) | 0, colour);
                            arrayPutI32(pixels, (pos + 1536) | 0, colour);
                        } else if (angle === 0) {
                            arrayPutI32(pixels, pos, colour);
                            arrayPutI32(pixels, (pos + 1) | 0, colour);
                            arrayPutI32(pixels, (pos + 2) | 0, colour);
                            arrayPutI32(pixels, (pos + 3) | 0, colour);
                        } else if (angle === 1) {
                            arrayPutI32(pixels, (pos + 3) | 0, colour);
                            arrayPutI32(pixels, (pos + 515) | 0, colour);
                            arrayPutI32(pixels, (pos + 1027) | 0, colour);
                            arrayPutI32(pixels, (pos + 1539) | 0, colour);
                        } else if (angle === 2) {
                            arrayPutI32(pixels, (pos + 1536) | 0, colour);
                            arrayPutI32(pixels, (pos + 1537) | 0, colour);
                            arrayPutI32(pixels, (pos + 1538) | 0, colour);
                            arrayPutI32(pixels, (pos + 1539) | 0, colour);
                        }
                    }
                }
            }
            key = world.SceneType(level, (offsetX + x) | 0, (offsetZ + z) | 0);
            if (key !== 0n) {
                const low = Number(BigInt.asIntN(32, key));
                const angle = (low >> 20) & 3;
                const id = Number((key >> 32n) & 0x7fffffffn);
                const shape = (low >> 14) & 31;
                const type = LocType.List(id);
                if (type.mapScene !== -1) {
                    if (!MinimapBuilder.drawMapScene(type, z, x, angle, offsetZ, offsetX)) return false;
                } else if (shape === 9) {
                    const pixels = Pix2D.pixels;
                    const pos = (Math.imul(x, 4) + 24624 + Math.imul(2048, 103 - z)) | 0;
                    let colour = 15658734;
                    if (key > 0n) colour = 15597568;
                    if (angle !== 0 && angle !== 2) {
                        arrayPutI32(pixels, pos, colour);
                        arrayPutI32(pixels, (pos + 513) | 0, colour);
                        arrayPutI32(pixels, (pos + 1026) | 0, colour);
                        arrayPutI32(pixels, (pos + 1539) | 0, colour);
                    } else {
                        arrayPutI32(pixels, (pos + 1536) | 0, colour);
                        arrayPutI32(pixels, (pos + 1025) | 0, colour);
                        arrayPutI32(pixels, (pos + 514) | 0, colour);
                        arrayPutI32(pixels, (pos + 3) | 0, colour);
                    }
                }
            }
            key = world.GdType(level, (x + offsetX) | 0, (offsetZ + z) | 0);
            if (key !== 0n) {
                const id = Number((key >> 32n) & 0x7fffffffn);
                const angle = (Number(BigInt.asIntN(32, key)) >> 20) & 3;
                const type = LocType.List(id);
                if (type.mapScene !== -1 && !MinimapBuilder.drawMapScene(type, z, x, angle, offsetZ, offsetX)) return false;
            }
            return true;
        } catch (error) {
            if (!glJar || !isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'na.N(' + offsetZ + ',' + x + ',' + wallColour + ',' + z + ',' + activeColour + ',' + offsetX + ',' + level + ',true)');
        }
    }

    // hd.a(Laj;IIIIII)V. NXT Minimap::DrawArrow, projects/osclient/minimap/Minimap.cpp:1087.
    static DrawArrow(component: IfType | null, dx: number, dz: number, y: number, x: number, marker: number, hdGuard = false): void {
        if (glJar) {
            // HD hi.a(IIIIILbe;Z)V
            try {
                const distance = (Math.imul(dx, dx) + Math.imul(dz, dz)) | 0;
                if (distance > 360000) return;
                const w = requireNonNull(component);
                let radius = Math.min(intDivide(w.width, 2), intDivide(w.height, 2));
                if (hdGuard) Minimenu.tooltipX2 = -79;
                if (Math.imul(radius, radius) >= distance) {
                    Client.DrawDot(w, x, arrayAtObj(Client.hintMapMarkers, marker), true, dx, y, dz);
                    return;
                }
                radius = (radius - 10) | 0;
                const angle = (OrbitCamera.minimapAngle + OrbitCamera.followYaw) & 2047;
                let cos = arrayAtI32(Pix3D.cosTable, angle);
                let sin = arrayAtI32(Pix3D.sinTable, angle);
                sin = intDivide(Math.imul(sin, 256), (256 + OrbitCamera.minimapZoom) | 0);
                cos = intDivide(Math.imul(cos, 256), (OrbitCamera.minimapZoom + 256) | 0);
                const u = (Math.imul(dz, sin) + Math.imul(cos, dx)) >> 16;
                const v = (-Math.imul(sin, dx) + Math.imul(dz, cos)) >> 16;
                const radians = Math.atan2(u, v);
                const edgeX = doubleToInt(Math.sin(radians) * radius);
                const edgeZ = doubleToInt(Math.cos(radians) * radius);
                if (GlRendererClass.active) {
                    const GlSprite = loadGlSprite();
                    const sprite = arrayAtObj(SpriteLoader.hintMapEdge, marker);
                    if (sprite !== null && !(sprite instanceof GlSprite)) throw new TypeError('ClassCastException: expected GlSprite');
                    const left = Math.imul(intDivide(w.width, 2) + x + edgeX, 16);
                    const top = Math.imul(16, -edgeZ + intDivide(w.height, 2) + y);
                    const rotation = doubleToInt(10430.378 * radians);
                    requireNonNull(sprite).drawRotatedReversed(240, 240, left, top, rotation, 4096);
                } else {
                    const sprite = arrayAtObj(SpriteLoader.hintMapEdge, marker);
                    if (sprite !== null && !(sprite instanceof Pix32)) throw new TypeError('ClassCastException: expected Pix32');
                    const left = (-10 + edgeX + intDivide(w.width, 2) + x) | 0;
                    const top = (-10 + intDivide(w.height, 2) + y - edgeZ) | 0;
                    requireNonNull(sprite).drawRotatedRadians(left, top, 20, 20, 15, 15, radians, 256);
                }
            } catch (error) {
                if (!isJavaRuntimeException(error)) throw error;
                throw WrappedException.wrap(error, 'hi.D(' + marker + ',' + y + ',' + x + ',' + dx + ',' + dz + ',' + (component === null ? 'null' : '{...}') + ',' + hdGuard + ')');
            }
            return;
        }
        const distance = (Math.imul(dx, dx) + Math.imul(dz, dz)) | 0;
        if (distance > 360000) return;
        const widget = requireNonNull(component);
        let radius = Math.min((widget.width / 2) | 0, (widget.height / 2) | 0);
        if (Math.imul(radius, radius) >= distance) {
            Client.DrawDot(widget, x, arrayAtObj(Client.hintMapMarkers, marker), true, dx, y, dz);
            return;
        }
        radius = (radius - 10) | 0;
        const angle = (OrbitCamera.followYaw + OrbitCamera.minimapAngle) & 2047;
        let cos = arrayAtI32(Pix3D.cosTable, angle);
        cos = intDivide(Math.imul(256, cos), (256 + OrbitCamera.minimapZoom) | 0);
        let sin = arrayAtI32(Pix3D.sinTable, angle);
        sin = intDivide(Math.imul(sin, 256), (OrbitCamera.minimapZoom + 256) | 0);
        const v = (-Math.imul(sin, dx) + Math.imul(cos, dz)) >> 16;
        const u = (Math.imul(sin, dz) + Math.imul(cos, dx)) >> 16;
        const radians = Math.atan2(u, v);
        const edgeX = doubleToInt(Math.sin(radians) * radius);
        const edgeZ = doubleToInt(radius * Math.cos(radians));
        const sprite = arrayAtObj(SpriteLoader.hintMapEdge, marker);
        if (sprite !== null && !(sprite instanceof Pix32)) throw new TypeError('ClassCastException: expected Pix32');
        const left = (-10 + edgeX + ((widget.width / 2) | 0) + x) | 0;
        const top = (-10 - edgeZ + y + ((widget.height / 2) | 0)) | 0;
        requireNonNull(sprite).drawRotatedRadians(left, top, 20, 20, 15, 15, radians, 256);
    }

    // wa.a(Laj;ILvc;ZIII)V. NXT Minimap::DrawDot, projects/osclient/minimap/Minimap.cpp:1038.
    static DrawDot(component: IfType | null, x: number, sprite: AbstractSprite | null, draw: boolean, dx: number, y: number, dz: number): void {
        if (glJar) {
            // HD em.a(Lbe;Lqf;IIIBI)V
            try {
                if (sprite === null) return;
                const distance = (Math.imul(dx, dx) + Math.imul(dz, dz)) | 0;
                const angle = (OrbitCamera.minimapAngle + OrbitCamera.followYaw) & 2047;
                const w = requireNonNull(component);
                const radius = (Math.max(intDivide(w.width, 2), intDivide(w.height, 2)) + 10) | 0;
                if (Math.imul(radius, radius) < distance) return;
                let sin = arrayAtI32(Pix3D.sinTable, angle);
                sin = intDivide(Math.imul(sin, 256), (OrbitCamera.minimapZoom + 256) | 0);
                let cos = arrayAtI32(Pix3D.cosTable, angle);
                cos = intDivide(Math.imul(256, cos), (256 + OrbitCamera.minimapZoom) | 0);
                const u = (Math.imul(sin, dz) + Math.imul(dx, cos)) >> 16;
                const v = (Math.imul(cos, dz) - Math.imul(dx, sin)) >> 16;
                if (!GlRendererClass.active) {
                    if (!(sprite instanceof Pix32)) throw new TypeError('ClassCastException: expected Pix32');
                    sprite.drawMasked((intDivide(w.width, 2) + x + u - intDivide(sprite.cropW, 2)) | 0, (-intDivide(sprite.cropH, 2) + intDivide(w.height, 2) + y - v) | 0, w.maskStarts, w.maskWidths);
                } else {
                    const GlSprite = loadGlSprite();
                    if (!(sprite instanceof GlSprite)) throw new TypeError('ClassCastException: expected GlSprite');
                    const left = (intDivide(w.width, 2) + x + u - intDivide(sprite.cropW, 2)) | 0;
                    const top = (intDivide(w.height, 2) + y - (v + intDivide(sprite.cropH, 2))) | 0;
                    const mask = w.GetGraphic(false);
                    if (mask !== null && !(mask instanceof GlSprite)) throw new TypeError('ClassCastException: expected GlSprite');
                    sprite.drawMasked(left, top, mask);
                }
            } catch (error) {
                if (!isJavaRuntimeException(error)) throw error;
                throw WrappedException.wrap(error, 'em.B(' + (component === null ? 'null' : '{...}') + ',' + (sprite === null ? 'null' : '{...}') + ',' + dz + ',' + dx + ',' + y + ',11,' + x + ')');
            }
            return;
        }
        if (sprite === null) return;
        const angle = (OrbitCamera.minimapAngle + OrbitCamera.followYaw) & 2047;
        const distance = (Math.imul(dz, dz) + Math.imul(dx, dx)) | 0;
        const widget = requireNonNull(component);
        const radius = (Math.max((widget.width / 2) | 0, (widget.height / 2) | 0) + 10) | 0;
        if (Math.imul(radius, radius) < distance) return;
        let sin = arrayAtI32(Pix3D.sinTable, angle);
        if (!draw) return;
        let cos = arrayAtI32(Pix3D.cosTable, angle);
        sin = intDivide(Math.imul(256, sin), (256 + OrbitCamera.minimapZoom) | 0);
        cos = intDivide(Math.imul(cos, 256), (OrbitCamera.minimapZoom + 256) | 0);
        const u = (Math.imul(cos, dx) + Math.imul(sin, dz)) >> 16;
        const v = (Math.imul(dz, cos) - Math.imul(dx, sin)) >> 16;
        if (!(sprite instanceof Pix32)) throw new TypeError('ClassCastException: expected Pix32');
        sprite.drawMasked((x + ((widget.width / 2) | 0) + u - ((sprite.cropW / 2) | 0)) | 0, (-v + ((widget.height / 2) | 0) + y - ((sprite.cropH / 2) | 0)) | 0, widget.maskStarts, widget.maskWidths);
    }

    // th.a(IZ)V, before each player pass.
    static GdmCheckRemoveMapFlag(): void {
        if (Client.destinationX === requireNonNull(Client.localPlayer).x >> 7 && Client.destinationZ === requireNonNull(Client.localPlayer).z >> 7) {
            Client.destinationX = 0;
        }
    }

    // SD bi.a(IIIIZI)V, HD ja.a(IIIIIZ)V. NXT Client::GdmCalcWindowSize.
    static GdmCalcWindowSize(x: number, y: number, width: number, height: number, drawBars: boolean, hdGuard = 81): void {
        if (glJar) {
            try {
                if (width < 1) width = 1;
                if (height < 1) height = 1;
                const renderer = GlRendererClass;
                if (renderer.active) {
                    const raster = loadGlRaster();
                    let delta = (height - 334) | 0;
                    if (delta < 0) delta = 0;
                    else if (delta > 100) delta = 100;
                    let scale = (intDivide(Math.imul(delta, Client.zoomWidth2 - Client.viewportFovLow), 100) + Client.viewportFovLow) | 0;
                    if (scale < Client.fovClampMinWidth) scale = Client.fovClampMinWidth;
                    else if (scale > Client.viewportMaxZoom) scale = Client.viewportMaxZoom;
                    let aspect = intDivide(Math.imul(Math.imul(scale, height), 512), Math.imul(width, 334));
                    if (aspect < Client.zoomWidthMin) {
                        aspect = Client.zoomWidthMin;
                        scale = intDivide(Math.imul(334, Math.imul(width, aspect)), Math.imul(512, height));
                        if (scale > Client.viewportMaxZoom) {
                            scale = Client.viewportMaxZoom;
                            const visible = intDivide(Math.imul(Math.imul(512, height), scale), Math.imul(334, aspect));
                            const bar = intDivide((width - visible) | 0, 2);
                            if (drawBars) {
                                raster.resetClipping();
                                raster.fillRect(x, y, bar, height, 0);
                                raster.fillRect((width + x - bar) | 0, y, bar, height, 0);
                            }
                            x = (x + bar) | 0;
                            width = (width - Math.imul(2, bar)) | 0;
                        }
                    } else if (aspect > Client.fovClampMaxHeight) {
                        aspect = Client.fovClampMaxHeight;
                        scale = intDivide(Math.imul(Math.imul(aspect, width), 334), Math.imul(height, 512));
                        if (scale < Client.fovClampMinWidth) {
                            scale = Client.fovClampMinWidth;
                            const visible = intDivide(Math.imul(aspect, Math.imul(width, 334)), Math.imul(512, scale));
                            const bar = intDivide((height - visible) | 0, 2);
                            if (drawBars) {
                                raster.resetClipping();
                                raster.fillRect(x, y, width, bar, 0);
                                raster.fillRect(x, (y + height - bar) | 0, width, bar, 0);
                            }
                            height = (height - Math.imul(bar, 2)) | 0;
                            y = (y + bar) | 0;
                        }
                    }
                    Client.viewportScale = intDivide(Math.imul(scale, height), 334);
                }
                Client.viewportWidth = (width << 16) >> 16;
                Client.viewportHeight = (height << 16) >> 16;
                Client.viewportY = y;
                Client.viewportX = x;
            } catch (error) {
                if (!isJavaRuntimeException(error)) throw error;
                throw WrappedException.wrap(error, 'ja.C(' + width + ',' + hdGuard + ',' + y + ',' + height + ',' + x + ',' + drawBars + ')');
            }
            return;
        }
        if (height < 1) height = 1;
        if (width < 1) width = 1;
        Client.viewportWidth = (width << 16) >> 16;
        Client.viewportHeight = (height << 16) >> 16;
    }

    static javascript = false; // client.L:Z
    static objectTag = false; // lk.z:Z
    static advertSuppressed = false; // uj.l:Z
    static modeWhere = 0; // d.c:I
    // bi.g:Ljava/math/BigInteger;
    static rsaExponent: bigint | null = BigInt(process.env.LOGIN_RSAE ?? 58778699976184461502525193738213253649000149147835990136706041084440742975821n);
    static affiliateId = 0; // ce.F:I
    static settings: JagString | null = null; // oj.k:Lid;
    static selectedWorldId = -1; // qj.C:I
    static gameHost: string | null = null; // sd.T:Ljava/lang/String;
    static primaryPort = 0; // ag.f:I
    static secondaryPort = 0; // aa.a:I
    static currentPort = 0; // ie.r:I
    static worldListHost: string | null = null; // pg.S:Ljava/lang/String;
    static worldListPrimaryPort = 0; // th.h:I
    static worldListSecondaryPort = 0; // bh.g:I
    static worldListPort = 0; // aj.Cb:I
    static signlinkMode = 0; // nl.ab:I
    static urlProtocol = fromLiteral('http:)4)4'); // ke.c:Lid;
    static urlHostWww = fromLiteral('www'); // jl.d:Lid;
    static wtqaHost = fromLiteral('www)2wtqa'); // uf.f:Lid;
    static urlDomainSuffix = fromLiteral(')3runescape)3com)4l='); // ff.y:Lid;
    static urlAffidPart = fromLiteral(')4a='); // qa.V:Lid;
    static urlSettingsParam = fromLiteral(')4p='); // ef.H:Lid;
    static urlSlash = fromLiteral(')4'); // se.r:Lid;
    static emptyString = fromLiteral(''); // ak.h:Lid;
    static urlAffiliatePart = fromLiteral(')4a='); // ai.m:Lid;
    static paramTrue = fromLiteral('1'); // ki.eb:Lid;
    static worldUrlAdvertFlag = fromLiteral(')1a2)1m'); // v.L:Lid;

    // ce.c(I)Lid;
    static getWebsiteUrlPrefix(): JagString {
        let host = Client.urlHostWww;
        if (Client.modeWhere !== 0) host = Client.wtqaHost;
        let settings = JagString.empty;
        if (Client.settings !== null) settings = JagString.join([Client.urlSettingsParam, Client.settings]);
        return JagString.join([Client.urlProtocol, host, Client.urlDomainSuffix, JagString.fromInt(LocalisedText.language), Client.urlAffidPart, JagString.fromInt(Client.affiliateId), settings, Client.urlSlash]);
    }

    // Browser host for JSObject.getWindow(this).call(name, null).
    call(name: string | null, args: unknown[] | null = null): unknown {
        const hook = Reflect.get(window, requireNonNull(name));
        if (typeof hook !== 'function') throw new TypeError(String(name));
        return Reflect.apply(hook, window, args ?? []);
    }
    // LiveConnect evaluated this one assignment in a non-strict page script. Decode
    // its ES3 string literal as data and deliver it to the host cookie setter.
    evaluate(script: string | null): void {
        if (script === null) throw new TypeError('Null cookie script');
        const prefix = 'document.cookie="';
        const end = script.length - 1;
        if (!script.startsWith(prefix) || script[end] !== '"') return;
        let value = '';
        for (let i = prefix.length; i < end; i++) {
            const c = script[i];
            if (c === '"' || c === '\r' || c === '\n' || c === '\u2028' || c === '\u2029') return;
            if (c !== '\\') {
                value += c;
                continue;
            }
            if (++i === end) return;
            const escape = script[i];
            switch (escape) {
                case '\r':
                    if (script[i + 1] === '\n') i++;
                    break;
                case '\n':
                case '\u2028':
                case '\u2029':
                    break;
                case 'b':
                    value += '\b';
                    break;
                case 'f':
                    value += '\f';
                    break;
                case 'n':
                    value += '\n';
                    break;
                case 'r':
                    value += '\r';
                    break;
                case 't':
                    value += '\t';
                    break;
                case 'v':
                    value += '\v';
                    break;
                case 'x':
                case 'u': {
                    const digits = escape === 'x' ? 2 : 4;
                    const hex = script.slice(i + 1, i + 1 + digits);
                    if (hex.length !== digits || /[^0-9a-f]/i.test(hex)) return;
                    value += String.fromCharCode(parseInt(hex, 16));
                    i += digits;
                    break;
                }
                default:
                    if (escape >= '0' && escape <= '7') {
                        const last = Math.min(end - 1, i + (escape <= '3' ? 2 : 1));
                        let code = escape.charCodeAt(0) - 48;
                        while (i < last && script[i + 1] >= '0' && script[i + 1] <= '7') {
                            code = (code << 3) + script.charCodeAt(++i) - 48;
                        }
                        value += String.fromCharCode(code);
                    } else value += escape;
            }
        }
        this.setCookie(value);
    }
    setCookie(value: string): void {
        document.cookie = value;
    }

    // t.c(I)V and client.g(B)V poll b.L after input processing.
    static pollUrlRequest(title: boolean): void {
        if (this.openUrlRequest === null || requireNonNull(this.openUrlRequest).status !== 1) return;
        if (requireNonNull(this.openUrlRequest).result !== null) {
            if (glJar) {
                const address = this.pendingUrl;
                GameShell.openUrl(this.urlNewWindow, address);
            } else GameShell.openUrl(this.urlNewWindow, this.pendingUrl);
        }
        if (glJar) {
            if (title) this.urlNewWindow = false;
            this.pendingUrl = null;
            this.openUrlRequest = null;
            if (!title) this.urlNewWindow = false;
        } else {
            this.openUrlRequest = null;
            if (!title) this.urlNewWindow = false;
            this.pendingUrl = null;
            if (title) this.urlNewWindow = false;
        }
    }
    static defaultCursor = -1; // ig.t:I
    static currentCursor = -1; // qh.c:I

    // sc.a(IZ)V
    static setCursor(id: number): void {
        if (!Preferences.cursorsEnabled) id = -1;
        if (id !== Client.currentCursor) {
            if (id !== -1) {
                const type = CursorType.get(id);
                const sprite = type.getSprite();
                if (sprite !== null) {
                    requireNonNull(GameShell.signlink).setCursor(sprite.cropW, sprite.cropH, GameShell.canvas, sprite.toArgb(), { x: type.hotspotX, y: type.hotspotY });
                    Client.currentCursor = id;
                } else id = -1;
            }
            if (id === -1 && Client.currentCursor !== -1) {
                requireNonNull(GameShell.signlink).setCursor(-1, -1, GameShell.canvas, null, { x: 0, y: 0 });
                Client.currentCursor = -1;
            }
        }
    }
    // vi.a(Lid;II)V
    static opPlayerByName(name: JagString, option: number): void {
        const displayName = name.normalizeName().formatName(0);
        for (let i = 0; i < ReceivePlayerPositions.m_lastNum; i++) {
            const index = arrayAtI32(ReceivePlayerPositions.m_lastID, i),
                player = arrayAtObj(Client.players, index);
            if (player === null || player.username === null || !player.username.equalsIgnoreCase(displayName)) continue;
            const self = requireNonNull(Client.localPlayer);
            RouteFinding.FindRoute(1, player.pathZ[0], player.pathX[0], 1, false, 0, 0, self.pathZ[0], 0, 2, self.pathX[0]);
            const out = Client.out;
            switch (option) {
                case 1:
                    out.pHead(68);
                    out.p2_alt3(index);
                    break;
                case 4:
                    out.pHead(180);
                    out.p2_alt3(index);
                    break;
                case 5:
                    out.pHead(4);
                    out.p2_alt1(index);
                    break;
                case 6:
                    out.pHead(133);
                    out.p2_alt1(index);
                    break;
                case 7:
                    out.pHead(114);
                    out.p2_alt3(index);
                    break;
            }
            return;
        }
        Client.AddChat(JagString.join([LocalisedText.unableToFind, displayName]), JagString.empty, 0);
    }
    static loadingMemoryCheckStart = 0n; // kj.S:J
    static lastGcTime = 0n; // jk.H:J
    static animFramesArchive: Js5 | null = null; // uh.O:Lal;
    static basesArchive: Js5 | null = null; // bc.c:Lal;
    static configArchive: Js5 | null = null; // sf.b:Lal;
    static interfacesArchive: Js5 | null = null; // dd.l:Lal;
    static soundEffectCount = 0; // ag.l:I
    static readonly soundEffectIds = new Int32Array(50); // ff.J:[I
    static readonly soundEffectLoops = new Int32Array(50); // uh.Q:[I
    static readonly soundEffectDelays = new Int32Array(50); // u.r:[I
    static readonly soundEffectPositions = new Int32Array(50); // gk.e:[I
    static readonly soundEffects: (JagFX | null)[] = new Array(50).fill(null); // pi.o:[Lvd;

    // uj.a(ZIII)V. NXT Client::PlaySynth in projects/osclient/client.cpp.
    static PlaySynth(id: number, loops: number, delay: number): void {
        try {
            if (Preferences.soundEffectVolume !== 0 && loops !== 0 && Client.soundEffectCount < 50 && id !== -1) {
                arrayPutI32(Client.soundEffectIds, Client.soundEffectCount, id);
                arrayPutI32(Client.soundEffectLoops, Client.soundEffectCount, loops);
                arrayPutI32(Client.soundEffectDelays, Client.soundEffectCount, delay);
                arrayPutObj(Client.soundEffects, Client.soundEffectCount, null);
                arrayPutI32(Client.soundEffectPositions, Client.soundEffectCount, 0);
                Client.soundEffectCount = (Client.soundEffectCount + 1) | 0;
            }
        } catch (error) {
            if (!glJar || !isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'ca.C(' + [loops, id, delay, -799].join(',') + ')');
        }
    }

    // sf.a(Lek;IIIZI)V. The 530 Client::TriggerSeqSound also receives the local-player flag.
    static TriggerSeqSound(seq: SeqType | null, z: number, x: number, local: boolean, frame: number): void {
        if (Client.soundEffectCount >= 50) return;
        const sounds = requireNonNull(seq).sounds;
        if (sounds === null || sounds.length <= frame) return;
        const choices = arrayAtObj(sounds, frame);
        if (choices === null) return;
        const packed = arrayAtI32(choices, 0);
        let id = packed >> 8;
        const range = packed & 31;
        if (choices.length > 1) {
            const index = (mathRandom.nextDouble() * choices.length) | 0;
            if (index > 0) id = arrayAtI32(choices, index);
        }
        const loops = (packed >> 5) & 7;
        if (range === 0) {
            if (local) Client.PlaySynth(id, loops, 0);
        } else if (Preferences.areaSoundVolume !== 0) {
            const tileZ = (((z - 64) | 0) / 128) | 0;
            const tileX = (((x - 64) | 0) / 128) | 0;
            arrayPutI32(Client.soundEffectIds, Client.soundEffectCount, id);
            arrayPutI32(Client.soundEffectLoops, Client.soundEffectCount, loops);
            arrayPutI32(Client.soundEffectDelays, Client.soundEffectCount, 0);
            arrayPutObj(Client.soundEffects, Client.soundEffectCount, null);
            arrayPutI32(Client.soundEffectPositions, Client.soundEffectCount, (range + (tileX << 16) + (tileZ << 8)) | 0);
            Client.soundEffectCount = (Client.soundEffectCount + 1) | 0;
        }
    }

    // og.a(BI)V. Client::PlaySong.
    static PlaySong(group: number): void {
        if (group === -1 && !Client.jingleActive) MidiManager.stopImmediate();
        else if (group !== -1 && (Client.midiSong !== group || !MidiManager.IsPlaying()) && Preferences.musicVolume !== 0 && !Client.jingleActive) {
            MidiManager.Play(Preferences.musicVolume, 2, Client.m_pMidi, false, group, 0);
        }
        Client.midiSong = group;
    }

    // af.b(III)V. Client::PlayJingle.
    static PlayJingle(group: number, _delay: number): void {
        if (Preferences.musicVolume !== 0 && group !== -1) {
            MidiManager.queue(0, false, group, Client.jingleArchive, Preferences.musicVolume);
            Client.jingleActive = true;
        }
    }

    // dk.f(I)V. Client::GlDoSoundsQueue in projects/osclient/client.cpp.
    static GlDoSoundsQueue(): void {
        for (let i = 0; i < Client.soundEffectCount; i++) {
            const delay = (arrayAtI32(Client.soundEffectDelays, i) - 1) | 0;
            arrayPutI32(Client.soundEffectDelays, i, delay);
            if (delay < -10) {
                Client.soundEffectCount = (Client.soundEffectCount - 1) | 0;
                for (let j = i; j < Client.soundEffectCount; j++) {
                    arrayPutI32(Client.soundEffectIds, j, arrayAtI32(Client.soundEffectIds, j + 1));
                    arrayPutObj(Client.soundEffects, j, arrayAtObj(Client.soundEffects, j + 1));
                    arrayPutI32(Client.soundEffectLoops, j, arrayAtI32(Client.soundEffectLoops, j + 1));
                    arrayPutI32(Client.soundEffectDelays, j, arrayAtI32(Client.soundEffectDelays, j + 1));
                    arrayPutI32(Client.soundEffectPositions, j, arrayAtI32(Client.soundEffectPositions, j + 1));
                }
                i--;
                continue;
            }
            let sound = arrayAtObj(Client.soundEffects, i);
            if (sound === null) {
                sound = JagFX.load(Client.m_pJagFx, arrayAtI32(Client.soundEffectIds, i), 0);
                if (sound === null) continue;
                arrayPutI32(Client.soundEffectDelays, i, (arrayAtI32(Client.soundEffectDelays, i) + sound.trimDelay()) | 0);
                arrayPutObj(Client.soundEffects, i, sound);
            }
            if (arrayAtI32(Client.soundEffectDelays, i) >= 0) continue;
            const position = arrayAtI32(Client.soundEffectPositions, i);
            let volume: number;
            if (position !== 0) {
                const range = (position & 255) * 128;
                let dx = (((position & 16739447) >> 16) * 128 + 64 - requireNonNull(Client.localPlayer).x) | 0;
                if (dx < 0) dx = -dx | 0;
                let dz = (((position >> 8) & 255) * 128 + 64 - requireNonNull(Client.localPlayer).z) | 0;
                if (dz < 0) dz = -dz | 0;
                let distance = (-128 + dx + dz) | 0;
                if (range < distance) {
                    arrayPutI32(Client.soundEffectDelays, i, -100);
                    continue;
                }
                if (distance < 0) distance = 0;
                volume = intDivide(Math.imul(range - distance, Preferences.areaSoundVolume), range);
            } else {
                volume = Preferences.soundEffectVolume;
            }
            if (volume > 0) {
                const raw = sound.toPcm().Decimate(requireNonNull(AudioEngine.decimator));
                const stream = WaveStream.NewRatePercent(raw, 100, volume);
                const repeats = (arrayAtI32(Client.soundEffectLoops, i) - 1) | 0;
                const voice = requireNonNull(stream);
                voice.SetLoopCount(repeats);
                requireNonNull(AudioEngine.effects).PlayStream(voice);
            }
            arrayPutI32(Client.soundEffectDelays, i, -100);
        }
        if (Client.jingleActive && !MidiManager.IsPlaying()) {
            if (Preferences.musicVolume !== 0 && Client.midiSong !== -1) MidiManager.queue(0, false, Client.midiSong, Client.m_pMidi, Preferences.musicVolume);
            Client.jingleActive = false;
        } else if (Preferences.musicVolume !== 0 && Client.midiSong !== -1 && !MidiManager.IsPlaying()) {
            Client.out.pHead(137);
            Client.out.p4(Client.midiSong);
            Client.midiSong = -1;
        }
    }

    static m_pJagFx: Js5 | null = null; // rg.m:Lal;
    static mapsArchive: Js5 | null = null; // re.d:Lal;
    static m_pMidi: Js5 | null = null; // al.l:Lal;
    static modelsArchive: Js5 | null = null; // rk.k:Lal;
    static m_pSprites: Js5 | null = null; // h.i:Lal;
    static texturesArchive: Js5 | null = null; // ha.b:Lal;
    static binaryArchive: Js5 | null = null; // ek.D:Lal;
    static jingleArchive: Js5 | null = null; // gd.E:Lal;
    static m_pClientScripts: Js5 | null = null; // il.B:Lal;
    static fontMetricsArchive: Js5 | null = null; // nf.j:Lal;
    static vorbisArchive: Js5 | null = null; // f.f:Lal;
    static instrumentsArchive: Js5 | null = null; // gj.Z:Lal;
    static locConfigArchive: Js5 | null = null; // fk.db:Lal;
    static enumsArchive: Js5 | null = null; // bh.c:Lal;
    static npcConfigArchive: Js5 | null = null; // ve.e:Lal;
    static objConfigArchive: Js5 | null = null; // ok.t:Lal;
    static seqConfigArchive: Js5 | null = null; // ml.t:Lal;
    static spotTypeArchive: Js5 | null = null; // ta.M:Lal;
    static varBitArchive: Js5 | null = null; // jl.f:Lal;
    static worldMapArchive: Js5 | null = null; // aa.d:Lal;
    static quickChatArchive: Js5 | null = null; // kh.B:Lal;
    static quickChatGlobalArchive: Js5 | null = null; // wf.u:Lal;
    static materialsArchive: Js5 | null = null; // wh.X:Lal;
    static js5Archive27: Js5 | null = null; // ll.g:Lal;

    static percentSign = fromLiteral('(U'); // me.x:Lid;
    static zeroPercent = fromLiteral('0(U'); // aj.ed:Lid;
    static loginScreenName = fromLiteral('loginscreen'); // vf.U:Lid;
    static huffmanGroup = fromLiteral('huffman'); // mc.v:Lid;
    static archiveLoadWeights = Int32Array.of(4, 4, 1, 2, 6, 4, 2, 49, 2, 2, 2, 2, 2, 2, 2, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1); // cl.x:[I
    static js5MasterIndex: Js5MasterIndex | null = null; // mi.v:Lwi;
    static js5Providers: (Js5RemoteLoader | null)[] = new Array(28).fill(null); // lj.h:[Lmc;
    static cacheData: BufferedRandomAccessFile | null = null; // ik.O:Lsa;
    static cacheIndexFiles: (BufferedRandomAccessFile | null)[] = new Array(28).fill(null); // f.g:[Lsa;
    static masterIndexStore: Js5DiskStore | null = null; // va.O:Lcg;
    static uidFile: BufferedRandomAccessFile | null = null; // ei.q:Lsa;

    // nk.a(ILgd;)V
    static updateUid(advance: number, packet: PacketT | null): void {
        if (Client.uidFile !== null) {
            try {
                Client.uidFile.seek(0n);
                Client.uidFile.Write(requireNonNull(packet).m_pos, requireNonNull(packet).m_data, 24);
            } catch (error) {
                if (!(error instanceof Error) || error instanceof JavaError) throw error;
            }
        }
        requireNonNull(packet).m_pos = (requireNonNull(packet).m_pos + advance) | 0;
    }

    // tj.a(Lgd;B)V
    static writeUid(packet: PacketT | null): void {
        const bytes = new Uint8Array(24);
        if (Client.uidFile !== null) {
            try {
                Client.uidFile.seek(0n);
                Client.uidFile.readFully(bytes);
                let i = 0;
                while (i < 24 && bytes[i] === 0) i++;
                if (i >= 24) throw new FileIoError();
            } catch (error) {
                if (!(error instanceof Error) || error instanceof JavaError) throw error;
                bytes.fill(255);
            }
        }
        requireNonNull(packet).pArrayBuffer(bytes, 24, 0);
    }
    static browserCache: Js5Storage | null = null;
    static js5DiskQueue: Js5LocalCache | null = null; // ud.a:Lca;
    static js5NetQueue: Js5NetQueue | null = null; // wk.d:Lej;
    static js5ConnectStage = 0; // je.T:I
    static js5ConnectStream: ClientStream | null = null; // hl.H:Lse;
    static js5ConnectTime = 0n; // ha.c:J
    static js5RetryDelay = 0; // mc.X:I
    static js5LastErrorCount = 0; // sj.M:I
    static js5SocketRequest: SignlinkRequest<SocketHandle> | null = null; // te.f:Ldj;
    private events = new AbortController();
    private glCanvas: BrowserGlCanvas | null = null;
    private sdDevice: GpuDevice | null = null;
    private sdDisplay: SdBrowserDisplay | null = null;

    protected attachSdDevice(device: GpuDevice): void {
        this.sdDevice = device;
    }

    leaveSdDisplay(): Promise<void> | undefined {
        const display = this.sdDisplay;
        this.sdDisplay = null;
        if (display) return display.leave(!this.sdDevice?.lost);
    }

    private host: {
        canvas: HTMLCanvasElement;
        canvas2d: CanvasRenderingContext2D;
        component: GameCanvas;
        mouseSurface: BrowserMouseSurface;
        keyboardSurface: BrowserKeyboardSurface;
        touchControls: BrowserTouchControls;
    } | null = null;
    private readonly audio = new PcmOutput();
    private readonly login = new Login();
    private pendingLoginSession: GameSession | null = null;
    ui?: InterfaceSession;
    protected standaloneWorldMap = false;
    static loadingStage = 0; // bh.b:I
    static loadingComplete = false; // qf.f:Z
    static windowModeRefreshTime = 0n; // oa.a:J
    static loginScreenInterface = 0; // ah.n:I
    private assets?: Js5Resources;
    private disk?: IDBDatabase;
    game?: GameState;
    private viewport?: {
        menu: Minimenu;
        minimap: { prepareNativeBuffer(level: number): void };
        load(rebuildReadyScene?: boolean): boolean;
        tick(): void;
        select(x: number, y: number, ctrl: boolean, right: boolean): void | Promise<void>;
    };

    // client.<init>()V
    constructor() {
        super();
    }

    static m_worldId = 1; // ik.R:I
    static modewhat = 0; // oi.e:I
    static fontPlain11Id = 0; // ce.I:I
    static p12FullGroup = 0; // vi.T:I
    static fontBold12Id = 0; // bj.i:I
    static mapfunctionSpriteGroup = 0; // jk.F:I
    static hitbarDefaultId = 0; // bj.k:I
    static headiconsPrayerGroup = 0; // vj.s:I
    static hintHeadiconsGroup = 0; // ij.o:I
    static hintMapmarkersSpriteGroup = 0; // l.I:I
    static mapflagGroupId = 0; // qe.jb:I
    static crossGroup = 0; // ej.f:I
    static scrollbarGroupId = 0; // q.j:I
    static scrollbarTrack = 2301979; // ae.e:I
    static scrollbarGripForeground = 5063219; // mh.c:I
    static scrollbarGripHighlight = 7759444; // pa.yb:I
    static scrollbarGripLowlight = 3353893; // ui.D:I

    // ta.a(IIIIIB)V. Client::DrawScrollbar, projects/osclient/client_UI.cpp:5480. lf.a supplies 122.
    static DrawScrollbar(height: number, y: number, scroll: number, contentHeight: number, x: number): void {
        try {
            requireNonNull(arrayAtObj(SpriteLoader.scrollbars, 0)).draw(x, y);
            requireNonNull(arrayAtObj(SpriteLoader.scrollbars, 1)).draw(x, (height + y - 16) | 0);
            let grip = intDivide(Math.imul((height - 32) | 0, height), contentHeight);
            if (grip < 8) grip = 8;
            const offset = intDivide(Math.imul(scroll, (height - grip - 32) | 0), (contentHeight - height) | 0);
            const top = (y + offset + 16) | 0;
            // HD fn.a(BIIIII)V selects dj for the active hardware surface after both cap sprites and grip arithmetic.
            const raster = glJar && GlRendererClass.active ? loadGlRaster() : Pix2D;
            raster.fillRect(x, (y + 16) | 0, 16, (height - 32) | 0, Client.scrollbarTrack);
            raster.fillRect(x, top, 16, grip, Client.scrollbarGripForeground);
            raster.vline(x, top, grip, Client.scrollbarGripHighlight);
            raster.vline((x + 1) | 0, top, grip, Client.scrollbarGripHighlight);
            raster.hline(x, top, 16, Client.scrollbarGripHighlight);
            raster.hline(x, (top + 1) | 0, 16, Client.scrollbarGripHighlight);
            raster.vline((x + 15) | 0, top, grip, Client.scrollbarGripLowlight);
            raster.vline((x + 14) | 0, (top + 1) | 0, (grip - 1) | 0, Client.scrollbarGripLowlight);
            raster.hline(x, (top + grip - 1) | 0, 16, Client.scrollbarGripLowlight);
            raster.hline((x + 1) | 0, (top + grip - 2) | 0, 15, Client.scrollbarGripLowlight);
        } catch (error) {
            if (!glJar || !isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'fn.E(' + [120, scroll, contentHeight, x, y, height].join(',') + ')');
        }
    }
    static nameIconsGroup = 0; // ik.X:I
    static hintMapEdgeSpriteId = 0; // tj.l:I
    static crossName: JagString | null = fromLiteral('cross'); // je.jb:Lid;
    static p12FullName: JagString | null = fromLiteral('p12_full'); // oe.t:Lid;
    static mapfunctionName: JagString | null = fromLiteral('mapfunction'); // sc.U:Lid;
    static hitmarksSpriteName: JagString | null = fromLiteral('hitmarks'); // uh.R:Lid;
    static headiconsPkName: JagString | null = fromLiteral('headicons_pk'); // fk.U:Lid;
    static headiconsPrayerName: JagString | null = fromLiteral('headicons_prayer'); // rj.h:Lid;
    static hintHeadiconsName: JagString | null = fromLiteral('hint_headicons'); // rc.e:Lid;
    static hintMapmarkersName: JagString | null = fromLiteral('hint_mapmarkers'); // vg.cb:Lid;
    static scrollbarSpriteName: JagString | null = fromLiteral('scrollbar'); // bf.H:Lid;
    static nameIconsName: JagString | null = fromLiteral('name_icons'); // sj.J:Lid;
    static floorshadowsSpriteName: JagString | null = fromLiteral('floorshadows'); // kf.c:Lid;
    static hintMapedgeSpriteName: JagString | null = fromLiteral('hint_mapedge'); // be.Ib:Lid;
    static titleSongName: JagString | null = fromLiteral('scape main'); // ja.h:Lid;
    static readonly settingsParam = fromLiteral('settings'); // sk.Q:Lid;

    // ef.a(BLjava/lang/String;)V
    static printUsageError(argument: string): void {
        console.log('Bad ' + argument + ', Usage: worldid, <live/rc/wip>, <english/german>, <game0/game1>');
        GameShell.standaloneHost.exit(1);
    }

    // client.main([Ljava/lang/String;)V
    static async Main(args: readonly (string | null)[] | null): Promise<void> {
        try {
            const values = requireNonNull(args);
            if (values.length !== 4) return Client.printUsageError('argument count');
            Client.m_worldId = parseJavaInt(values[0]);

            Client.modeWhere = 2;
            switch (requireNonNull(values[1])) {
                case 'live':
                    Client.modewhat = 0;
                    break;
                case 'rc':
                    Client.modewhat = 1;
                    break;
                case 'wip':
                    Client.modewhat = 2;
                    break;
                default:
                    return Client.printUsageError('modewhat');
            }
            Client.advertSuppressed = false;
            let language = -1;
            try {
                language = LocalisedText.getLanguageId(0, fromJsString(requireNonNull(values[2])));
            } catch (error) {
                if (!(error instanceof Error) || error instanceof JavaError) throw error;
            }
            if (language === -1) {
                switch (requireNonNull(values[2])) {
                    case 'english':
                        language = 0;
                        break;
                    case 'german':
                        language = 1;
                        break;
                    default:
                        return Client.printUsageError('language');
                }
            }
            LocalisedText.language = language;
            LocalisedText.setLanguage(language);
            Client.objectTag = false;
            Client.javascript = false;
            switch (requireNonNull(values[3])) {
                case 'game0':
                    GameVariant.id = 0;
                    break;
                case 'game1':
                    GameVariant.id = 1;
                    break;
                default:
                    return Client.printUsageError('game');
            }
            Client.haveIe6 = false;
            Client.affiliateId = 0;
            Client.country = 0;
            Client.settings = JagString.empty;
            const game = (Client.activeClient = new Client());
            await game.StartStandalone(1024, (Client.modewhat + 32) | 0, 28, 530, 'runescape', 768);
            requireNonNull(GameShell.frame as StandaloneFrame | null).setLocation(40, 40);
        } catch (error) {
            if (!(error instanceof Error) || error instanceof JavaError) throw error;
            await reportClientError(error, null);
        }
    }

    protected override createStandaloneFrame(): StandaloneFrame {
        const frame = super.createStandaloneFrame();
        if (frame.canvas !== undefined) this.attachBrowser(frame.canvas, requireNonNull(frame.canvas.getContext('2d')));
        return frame;
    }

    // client.init()V
    async init(): Promise<void> {
        try {
            if (this.CheckHost()) {
                this.ReadJavConfigParameters();
                Client.activeClient = this;
                await this.StartApp(765, (Client.modewhat + 32) | 0, glJar ? 1530 : 530, 503);
            }
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'client.init()');
        }
    }

    // client.init()V, applet configuration. The standalone launcher shares the optional applet parameters.
    protected ReadJavConfigParameters(): void {
        Client.m_worldId = parseJavaInt(this.getParameter('worldid'));
        Client.modeWhere = parseJavaInt(this.getParameter('modewhere'));
        if (Client.modeWhere < 0 || Client.modeWhere > 1) Client.modeWhere = 0;
        Client.modewhat = parseJavaInt(this.getParameter('modewhat'));
        if (Client.modewhat < 0 || Client.modewhat > 2) Client.modewhat = 0;
        Client.advertSuppressed = this.getParameter('advertsuppressed') === '1';
        try {
            LocalisedText.language = parseJavaInt(this.getParameter('lang'));
        } catch (error) {
            if (!(error instanceof Error) || error instanceof JavaError) throw error;
            LocalisedText.language = 0;
        }
        LocalisedText.setLanguage(LocalisedText.language);
        Client.objectTag = this.getParameter('objecttag') === '1';
        Client.javascript = this.getParameter('js') === '1';
        GameVariant.id = this.getParameter('game') === '1' ? 1 : 0;
        try {
            Client.affiliateId = parseJavaInt(this.getParameter('affid'));
        } catch (error) {
            if (!(error instanceof Error) || error instanceof JavaError) throw error;
            Client.affiliateId = 0;
        }
        Client.settings = Client.settingsParam.getParameter(this);
        if (Client.settings === null) Client.settings = JagString.empty;
        const country = this.getParameter('country');
        if (country !== null) {
            try {
                Client.country = parseJavaInt(country);
            } catch (error) {
                if (!(error instanceof Error) || error instanceof JavaError) throw error;
                Client.country = 0;
            }
        }
        Client.haveIe6 = this.getParameter('haveie6') === '1';
    }

    protected attachBrowser(canvas: HTMLCanvasElement, canvas2d: CanvasRenderingContext2D): void {
        clientErrorHost.base = new URL('.', location.href);
        if (glJar) this.signlinkHost.fullscreen = browserFullscreenHost(canvas.ownerDocument);
        const component = new GameCanvas(this);
        component.attachSurface(canvas2d);
        this.host = { canvas, canvas2d, component, ...this.browserInputs(canvas) };
    }

    private browserInputs(canvas: HTMLCanvasElement) {
        const keyboardSurface = new BrowserKeyboardSurface(canvas, this.events.signal);
        const touchControls = new BrowserTouchControls(this, keyboardSurface);
        return { mouseSurface: new BrowserMouseSurface(canvas, touchControls, this.events.signal), keyboardSurface, touchControls };
    }

    // SD client.a(II)V / HD client.a(ZI)V
    private js5Error(site: number, code: number): void {
        try {
            const queue = requireNonNull(Client.js5NetQueue);
            queue.errors = (queue.errors + 1) | 0;
            if (glJar) {
                Client.js5SocketRequest = null;
                requireNonNull(Client.js5NetQueue).response = code;
                Client.js5ConnectStream = null;
            } else {
                Client.js5ConnectStream = null;
                Client.js5SocketRequest = null;
                requireNonNull(Client.js5NetQueue).response = code;
            }
            Client.js5ConnectStage = 0;
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, glJar ? 'client.P(true,' + code + ')' : 'client.CA(' + site + ',' + code + ')');
        }
    }

    // SD client.b(Z)V / HD client.h(I)V
    private async js5Connect(): Promise<void> {
        try {
            if (Client.js5LastErrorCount < requireNonNull(Client.js5NetQueue).errors) {
                Client.js5RetryDelay = Math.imul(Math.imul(50, (requireNonNull(Client.js5NetQueue).errors - 1) | 0), 5);

                Client.currentPort = Client.currentPort === Client.primaryPort ? Client.secondaryPort : Client.primaryPort;
                if (Client.js5RetryDelay > 3000) Client.js5RetryDelay = 3000;
                if (requireNonNull(Client.js5NetQueue).errors >= 2 && requireNonNull(Client.js5NetQueue).response === 6) {
                    this.ShowError('js5connect_outofdate');
                    Client.gameState = 1000;
                    return;
                }
                if (requireNonNull(Client.js5NetQueue).errors >= 4 && requireNonNull(Client.js5NetQueue).response === -1) {
                    this.ShowError('js5crc');
                    Client.gameState = 1000;
                    return;
                }
                if (requireNonNull(Client.js5NetQueue).errors >= 4 && (Client.gameState === 0 || Client.gameState === 5)) {
                    if (requireNonNull(Client.js5NetQueue).response === 7 || requireNonNull(Client.js5NetQueue).response === 9) this.ShowError('js5connect_full');
                    else if (requireNonNull(Client.js5NetQueue).response <= 0) this.ShowError('js5io');
                    else this.ShowError('js5connect');
                    Client.gameState = 1000;
                    return;
                }
            }
            Client.js5LastErrorCount = requireNonNull(Client.js5NetQueue).errors;
            if (Client.js5RetryDelay > 0) {
                Client.js5RetryDelay = (Client.js5RetryDelay - 1) | 0;
                return;
            }
            try {
                if (Client.js5ConnectStage === 0) {
                    const signlink = GameShell.signlink;
                    const port = Client.currentPort;
                    const host = Client.gameHost;
                    Client.js5SocketRequest = requireNonNull(signlink).openSocket(host, port);
                    Client.js5ConnectStage = (Client.js5ConnectStage + 1) | 0;
                }
                if (Client.js5ConnectStage === 1) {
                    if (requireNonNull(Client.js5SocketRequest).status === 2) {
                        this.js5Error(-102, 1000);
                        return;
                    }
                    if (requireNonNull(Client.js5SocketRequest).status === 1) Client.js5ConnectStage = (Client.js5ConnectStage + 1) | 0;
                }
                if (Client.js5ConnectStage === 2) {
                    const socket = requireNonNull(Client.js5SocketRequest).result;
                    if (socket !== null && ((typeof socket !== 'object' && typeof socket !== 'function') || !('input' in socket) || !('output' in socket) || !('close' in socket))) {
                        throw new TypeError('ClassCastException: expected java.net.Socket');
                    }
                    Client.js5ConnectStream = new ClientStream(socket, GameShell.signlink);
                    const handshake = new PacketT(5);
                    handshake.p1(15);
                    handshake.p4(530);
                    Client.js5ConnectStream.Write(0, handshake.m_data, 5);
                    Client.js5ConnectStage = (Client.js5ConnectStage + 1) | 0;
                    Client.js5ConnectTime = SafeTime.CurrentTimeMillis();
                }
                if (Client.js5ConnectStage === 3) {
                    if (Client.gameState !== 0 && Client.gameState !== 5 && requireNonNull(Client.js5ConnectStream).GetAvailable(1) <= 0) {
                        if (BigInt.asIntN(64, -Client.js5ConnectTime + SafeTime.CurrentTimeMillis()) > 30000n) {
                            this.js5Error(-112, 1001);
                            return;
                        }
                    } else {
                        const status = await requireNonNull(Client.js5ConnectStream).read();
                        if (this.closed) return;
                        if (status !== 0) {
                            this.js5Error(-103, status);
                            return;
                        }
                        Client.js5ConnectStage = (Client.js5ConnectStage + 1) | 0;
                    }
                }
                if (Client.js5ConnectStage === 4) {
                    const loggedOut = Client.gameState === 5 || Client.gameState === 10 || Client.gameState === 28;
                    const queue = Client.js5NetQueue;
                    const stream = Client.js5ConnectStream;
                    requireNonNull(queue).ProvideConnection(!loggedOut, stream);
                    Client.js5ConnectStream = null;
                    Client.js5SocketRequest = null;
                    Client.js5ConnectStage = 0;
                }
            } catch (error) {
                if (!(error instanceof SocketIoError) && !(error instanceof FileIoError)) throw error;
                if (!this.closed) this.js5Error(-111, 1002);
            }
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, glJar ? 'client.E(-31379)' : 'client.U(false)');
        }
    }

    // SD client.g(I)V, HD client.d(Z)V
    private async js5Tick(): Promise<void> {
        try {
            const complete = await requireNonNull(Client.js5NetQueue).Service(0);
            if (!complete && !this.closed) await this.js5Connect();
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, glJar ? 'client.J(true)' : 'client.EA(3524)');
        }
    }

    // Browser-only socket work can outlive its applet while a Signlink dial or a read is pending.
    private async releaseBrowserConnections(gameStream: Js5Stream | null): Promise<void> {
        if (Client.socketRequest !== null) discardSocket(Client.socketRequest);
        if (Client.js5SocketRequest !== null && Client.js5ConnectStream === null) discardSocket(Client.js5SocketRequest);
        const pending = Client.js5ConnectStream;
        if (pending !== null && pending !== gameStream) await pending.Close();
        const previous = Protocol.oldSocket;
        if (previous !== null && previous !== gameStream && previous !== pending) await previous.Close();
    }

    // ra.a(ZZIZI)Lal;
    static OpenJs5(discardPacked: boolean, prefetch: boolean, id: number, discardUnpacked: boolean): Js5 {
        const groupStore = Client.cacheData !== null ? new DataFile(id, Client.cacheData, arrayAtObj(Client.cacheIndexFiles, id), 1000000) : browserDiskStore(Client.browserCache, id);
        arrayPutObj(Client.js5Providers, id, requireNonNull(Client.js5MasterIndex).getProvider(id, Client.masterIndexStore, groupStore));
        if (prefetch && !Client.activeClient?.standaloneWorldMap) requireNonNull(arrayAtObj(Client.js5Providers, id)).prefetchAll();
        return new Js5(requireNonNull(arrayAtObj(Client.js5Providers, id)), discardPacked, discardUnpacked);
    }

    // client.b(B)V
    protected async MainInit(useBrowserHdDefaults = false): Promise<void> {
        Client.resizeCanvas();
        DevicePcmPlayer.audioSystem = this.audio;
        const { mouseSurface, keyboardSurface } = requireNonNull(this.host);
        let openedDisk: IDBDatabase | undefined;
        try {
            if (GameShell.signlink?.cacheData == null) openedDisk = await openBrowserJs5Database();
        } catch {
            // The Java client can run entirely from the network.
        }
        if (this.closed) {
            openedDisk?.close();
            return;
        }
        this.disk = openedDisk;
        const diskQueue = await Js5LocalCache.create();
        if (this.closed) {
            await diskQueue.EndAndJoin();
            return;
        }
        Client.js5DiskQueue = diskQueue;
        if (glJar) void ClientBuild.m_hueOff; // client.g:23 putstatic gm.T initializes gm.R.
        Client.js5NetQueue = new Js5NetQueue();
        if (Client.modewhat !== 0) ClientPlayer.debugBallast = new Array<Uint8Array | null>(50).fill(null);
        Client.browserCache = this.disk ? new BrowserJs5Storage(this.disk) : null;
        if (Client.browserCache !== null) Client.masterIndexStore = browserDiskStore(Client.browserCache, 255);
        this.assets = new Js5Resources(Client.js5DiskQueue);
        Preferences.load(useBrowserHdDefaults);
        if (Client.modeWhere === 0) {
            Client.worldListHost = requireNonNull(this.getCodeBase()).getHost();
            Client.worldListPrimaryPort = 43594;
            Client.worldListSecondaryPort = 443;
        } else if (Client.modeWhere === 1) {
            Client.worldListHost = requireNonNull(this.getCodeBase()).getHost();
            Client.worldListSecondaryPort = (Client.m_worldId + 50000) | 0;
            Client.worldListPrimaryPort = (40000 + Client.m_worldId) | 0;
        } else if (Client.modeWhere === 2) {
            Client.worldListPrimaryPort = (Client.m_worldId + 40000) | 0;
            Client.worldListHost = '127.0.0.1';
            Client.worldListSecondaryPort = (Client.m_worldId + 50000) | 0;
        }
        Client.primaryPort = Client.worldListPrimaryPort;
        Client.gameHost = Client.worldListHost;
        if (glJar) {
            // runescape_gl.jar client.g(I)V
            void WorldMap.randomLightness; // client.g:164 getstatic vk.n initializes vk.h.
            if (GameVariant.id !== 1) {
                PlayerModel.recolourDestinations = PlayerModel.recolourDestinationsRs;
                PlayerModel.recolourSources2 = PlayerModel.recolourSources2Rs;
                PlayerModel.recolourDestinations2 = PlayerModel.recolourDestinations2Rs;
                PlayerModel.recolourSources = PlayerModel.recolourSourcesRs;
            } else {
                Minimenu.shiftClick = true;
                GlLighting.defaultSunColour = 0xffffff;
                GlLighting.defaultFogColour = 0;
                PlayerModel.recolourDestinations = PlayerModel.recolourDestinationsAlt;
                PlayerModel.recolourDestinations2 = PlayerModel.recolourDestinations2Alt;
                PlayerModel.recolourSources = PlayerModel.recolourSourcesAlt;
                PlayerModel.recolourSources2 = PlayerModel.recolourSources2Alt;
            }
        } else if (GameVariant.id === 1) {
            PlayerModel.recolourSources2 = PlayerModel.recolourSources2Alt;
            Minimenu.shiftClick = true;
            PlayerModel.recolourDestinations2 = PlayerModel.recolourDestinations2Alt;
            PlayerModel.recolourSources = PlayerModel.recolourSourcesAlt;
            PlayerModel.recolourDestinations = PlayerModel.recolourDestinationsAlt;
        } else {
            PlayerModel.recolourDestinations2 = PlayerModel.recolourDestinations2Rs;
            PlayerModel.recolourSources = PlayerModel.recolourSourcesRs;
            PlayerModel.recolourSources2 = PlayerModel.recolourSources2Rs;
            PlayerModel.recolourDestinations = PlayerModel.recolourDestinationsRs;
        }
        Client.secondaryPort = Client.worldListSecondaryPort;
        Client.worldListPort = Client.worldListPrimaryPort;
        Client.recolourPalette = LocType.recolPalette = NpcType.clientPalette = ObjType.recolourPalette = new Int16Array(256);
        if (Signlink.platform === 3 && Client.modeWhere !== 2) Client.selectedWorldId = Client.m_worldId;
        Client.currentPort = Client.worldListPort;
        // The browser adapter emits the VK codes of the modern (non-Microsoft) AWT mapping.
        ClientKeyboardListener.init(requireNonNull(Signlink.javaVendor), Signlink.setFocusTraversalKeysEnabled !== null);
        if (ClientKeyboardListener.instance === null) ClientKeyboardListener.instance = new ClientKeyboardListener();
        ClientKeyboardListener.addListeners(keyboardSurface);
        if (ClientMouseListener.instance === null) ClientMouseListener.instance = new ClientMouseListener();
        ClientMouseListener.addListeners(mouseSurface);
        const wheel = await MouseWheel.create();
        if (this.closed) return;
        MouseWheel.instance = wheel;
        if (MouseWheel.instance !== null) MouseWheel.instance.start(mouseSurface);
        Client.signlinkMode = Signlink.platform;
        try {
            if (requireNonNull(GameShell.signlink).cacheData !== null) {
                Client.cacheData = new BufferedRandomAccessFile(requireNonNull(requireNonNull(GameShell.signlink).cacheData), 5200, 0);
                for (let id = 0; id < 28; id++) {
                    arrayPutObj(Client.cacheIndexFiles, id, new BufferedRandomAccessFile(requireNonNull(arrayAtObj(requireNonNull(GameShell.signlink).cacheIndexes, id)), 6000, 0));
                }
                DataFile.masterIndexFile = new BufferedRandomAccessFile(requireNonNull(requireNonNull(GameShell.signlink).masterIndex), 6000, 0);
                Client.masterIndexStore = new DataFile(255, Client.cacheData, DataFile.masterIndexFile, 500000);
                Client.uidFile = new BufferedRandomAccessFile(requireNonNull(requireNonNull(GameShell.signlink).randomFile), 24, 0);
                requireNonNull(GameShell.signlink).cacheIndexes = null;
                requireNonNull(GameShell.signlink).masterIndex = null;
                requireNonNull(GameShell.signlink).randomFile = null;
                requireNonNull(GameShell.signlink).cacheData = null;
            }
        } catch (error) {
            if (!(error instanceof FileIoError)) throw error;
            Client.cacheData = null;
            Client.uidFile = null;
            DataFile.masterIndexFile = null;
            Client.masterIndexStore = null;
        }
        if (Client.modeWhere !== 0) Client.displayFps = true;
        GameShell.progressTitle = LocalisedText.loadingPleaseWait;
    }

    private bindInput(): void {
        const { canvas, keyboardSurface, touchControls } = requireNonNull(this.host);
        const options = { signal: this.events.signal };
        const fullscreen = this.signlinkHost.fullscreen;
        if (fullscreen) {
            let mode = fullscreen.getDisplayModes();
            window.addEventListener(
                'resize',
                () => {
                    const next = fullscreen.getDisplayModes();
                    if (next[0] !== mode[0] || next[1] !== mode[1] || next[2] !== mode[2]) DisplayMode.available = null;
                    mode = next;
                },
                options
            );
        }
        canvas.addEventListener(
            'pointerdown',
            event => {
                if (!this.standaloneWorldMap) this.audio.unlock();
                if (event.pointerType === 'mouse') touchControls.mouseDown();
                if (!keyboardSurface.isMobileKeyboardDisplayed()) canvas.focus({ preventScroll: true });
            },
            options
        );
        window.addEventListener('focus', () => this.focusGained(), options);
        window.addEventListener('blur', () => this.focusLost(), options);
        if (!this.standaloneWorldMap) canvas.addEventListener('keydown', () => this.audio.unlock(), options);
        window.addEventListener(
            'pagehide',
            event => {
                if (event.persisted) this.stop();
                else void this.Shutdown(false);
            },
            options
        );
        window.addEventListener(
            'pageshow',
            event => {
                if (event.persisted) this.start();
            },
            options
        );
    }

    private enterGame(session: GameSession, assets: Js5Resources, ui: InterfaceSession): void {
        this.game = new GameState(session, assets);
        this.game.resetToTitle = () => this.resetToTitle(true);
        ui.beginGame(this.game);
    }

    static forceImmediateEnvironmentUpdate = glJar; // HD sa.W:Z, consumed by i.b(IIIII)I
    static sceneMapUnderwaterLandData: (Uint8Array | null)[] | null = null; // HD pa.L:[[B
    static sceneMapUnderwaterLocData: (Uint8Array | null)[] | null = null; // HD bi.Y:[[B
    static npcMapPrefix: JagString | null = fromLiteral('n'); // HD oe.o:Lna;

    // HD ca.h(I)V. Prepare the title-camera maps, including the NPC spawn archive required by each square.
    static setupTitleRegion(): void {
        try {
            const zoneX = ((OrbitCamera.x >> 10) + (Client.mapBuildBaseX >> 3)) | 0;
            const zoneZ = ((OrbitCamera.z >> 10) + (Client.mapBuildBaseZ >> 3)) | 0;
            Client.sceneMapLocData = new Array<Uint8Array | null>(18).fill(null);
            Client.sceneMapUnderwaterLocFile = new Int32Array(18);
            Client.mapBuildNpcData = new Array<Uint8Array | null>(18).fill(null);
            Client.mapBuildGroundFile = new Int32Array(18);
            Client.mapBuildKeys = Array.from({ length: 18 }, () => new Int32Array(4));
            Client.sceneMapUnderwaterLandData = new Array<Uint8Array | null>(18).fill(null);
            Client.mapBuildIndex = new Int32Array(18);
            Client.sceneMapLandData = new Array<Uint8Array | null>(18).fill(null);
            Client.npcSpawnGroupIds = new Int32Array(18);
            Client.sceneMapUnderwaterLandFile = new Int32Array(18);
            Client.mapBuildLocationFile = new Int32Array(18);
            Client.sceneMapUnderwaterLocData = new Array<Uint8Array | null>(18).fill(null);
            let n = 0;
            for (let x = ((zoneX - 6) / 8) | 0; x <= (((zoneX + 6) / 8) | 0); x++) {
                for (let z = ((zoneZ - 6) / 8) | 0; z <= (((zoneZ + 6) / 8) | 0); z++) {
                    arrayPutI32(Client.mapBuildIndex, n, ((x << 8) + z) | 0);
                    const ground = Client.mapBuildGroundFile,
                        groundArchive = Client.mapsArchive;
                    const groundName = JagString.join([Client.mapFilePrefix, JagString.fromInt(x), Client.mapNameSeparator, JagString.fromInt(z)]);
                    arrayPutI32(ground, n, requireNonNull(groundArchive).GetGroupId(groundName));
                    const loc = Client.mapBuildLocationFile,
                        locArchive = Client.mapsArchive;
                    const locName = JagString.join([Client.locMapPrefix, JagString.fromInt(x), Client.mapNameSeparator, JagString.fromInt(z)]);
                    arrayPutI32(loc, n, requireNonNull(locArchive).GetGroupId(locName));
                    const npcs = Client.npcSpawnGroupIds,
                        npcArchive = Client.mapsArchive;
                    const npcName = JagString.join([Client.npcMapPrefix, JagString.fromInt(x), Client.mapNameSeparator, JagString.fromInt(z)]);
                    arrayPutI32(npcs, n, requireNonNull(npcArchive).GetGroupId(npcName));
                    const underlay = Client.sceneMapUnderwaterLandFile,
                        underlayArchive = Client.mapsArchive;
                    const underlayName = JagString.join([Client.umMapPrefix, JagString.fromInt(x), Client.mapNameSeparator, JagString.fromInt(z)]);
                    arrayPutI32(underlay, n, requireNonNull(underlayArchive).GetGroupId(underlayName));
                    const underwaterLoc = Client.sceneMapUnderwaterLocFile,
                        underwaterLocArchive = Client.mapsArchive;
                    const underwaterLocName = JagString.join([Client.underwaterLocPrefix, JagString.fromInt(x), Client.mapNameSeparator, JagString.fromInt(z)]);
                    arrayPutI32(underwaterLoc, n, requireNonNull(underwaterLocArchive).GetGroupId(underwaterLocName));
                    if (arrayAtI32(Client.npcSpawnGroupIds, n) === -1) {
                        arrayPutI32(Client.mapBuildGroundFile, n, -1);
                        arrayPutI32(Client.mapBuildLocationFile, n, -1);
                        arrayPutI32(Client.sceneMapUnderwaterLandFile, n, -1);
                        arrayPutI32(Client.sceneMapUnderwaterLocFile, n, -1);
                    }
                    n++;
                }
            }
            for (let i = n; i < requireNonNull(Client.npcSpawnGroupIds).length; i++) {
                arrayPutI32(Client.npcSpawnGroupIds, i, -1);
                arrayPutI32(Client.mapBuildGroundFile, i, -1);
                arrayPutI32(Client.mapBuildLocationFile, i, -1);
                arrayPutI32(Client.sceneMapUnderwaterLandFile, i, -1);
                arrayPutI32(Client.sceneMapUnderwaterLocFile, i, -1);
            }
            Client.StartRebuild(0, zoneZ, 8, zoneX, 8, true);
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'ca.F(20479)');
        }
    }

    // SD vb.a(IZ)V, HD fm.a(ZI)V
    resetToTitle(openInterfaces: boolean): void | Promise<void> {
        return runToCompletion(
            (function* (client: Client): Generator<Promise<unknown>, void, void> {
                try {
                    if (openInterfaces) {
                        if (InterfaceList.top !== -1) IfType.CloseInterface(InterfaceList.top);
                        for (let sub = InterfaceList.subInterfaces.head(); sub !== null; sub = InterfaceList.subInterfaces.next()) {
                            if (!(sub instanceof SubInterface)) throw new TypeError('ClassCastException: not a SubInterface');
                            const closed = Client.CloseSubinterface(sub, true, client.ui);
                            if (closed instanceof Promise) yield closed;
                        }
                        InterfaceList.top = -1;
                        InterfaceList.subInterfaces = new HashTable<SubInterface>(8);
                        InterfaceList.reset();
                        const assets = requireNonNull(client.assets);
                        const view = new InterfaceView([]);
                        client.ui = new InterfaceSession(view, assets);
                        InterfaceList.top = client.standaloneWorldMap ? requireNonNull(Client.interfacesArchive).GetGroupId(fromLiteral('worldmap')) : Client.loginScreenInterface;
                        Client.InterfaceCalculateSizeAndPosAll(false);
                        InterfaceList.redrawAll();
                        const loaded = ScriptRunner.OnLoad(InterfaceList.top, client.ui.runner);
                        if (loaded instanceof Promise) yield loaded;
                        client.ui.refreshView();
                    }
                    Minimenu.defaultCursor = -1;
                    Client.setCursor(Client.defaultCursor);
                    Client.localPlayer = new ClientPlayer();
                    if (glJar) {
                        requireNonNull(Client.localPlayer).z = 3000;
                        requireNonNull(Client.localPlayer).x = 3000;
                    } else {
                        requireNonNull(Client.localPlayer).x = 3000;
                        requireNonNull(Client.localPlayer).z = 3000;
                    }
                    if (client.standaloneWorldMap) {
                        // This control sends IF_CLOSE to the world in a logged-in session.
                        requireNonNull(IfType.Get((InterfaceList.top << 16) | 3)).hidden = true;
                        Client.SetMainState(10);
                        return;
                    }
                    if (glJar && GlRendererClass.active) {
                        if (OrbitCamera.mode === 2) {
                            OrbitCamera.x = CinematicCamera.tileX << 7;
                            OrbitCamera.z = CinematicCamera.tileZ << 7;
                        } else {
                            CinematicCamera.spline();
                        }
                        Client.forceImmediateEnvironmentUpdate = true;
                        Client.setupTitleRegion();
                        Client.SetMainState(28);
                        return;
                    }
                    TitleFlames.SetupFire(Client.m_pSprites);
                    Client.SetMainState(10);
                } catch (error) {
                    if (!glJar || !isJavaRuntimeException(error)) throw error;
                    throw WrappedException.wrap(error, 'fm.E(' + openInterfaces + ',3000)');
                }
            })(this)
        );
    }

    // rk.a(IIILpb;)V
    static TriggerPlayerAnim(seq: number, delay: number, p: ClientPlayer): void {
        if (seq === p.seq && seq !== -1) {
            const type = SeqType.List(seq);
            if (type.m_duplicateBehaviour === 1) {
                p.seqLoops = 0;
                p.seqFrame = 0;
                p.seqNext = 1;
                p.seqDelay = delay;
                p.seqCycle = 0;
                Client.TriggerSeqSound(type, p.z, p.x, Client.localPlayer === p, p.seqFrame);
            }
            if (type.m_duplicateBehaviour === 2) p.seqLoops = 0;
        } else if (seq === -1 || p.seq === -1 || SeqType.List(seq).m_priority >= SeqType.List(p.seq).m_priority) {
            p.seqLoops = 0;
            p.seqCycle = 0;
            p.seqDelay = delay;
            p.seqNext = 1;
            p.seqPathLength = p.pathLength;
            p.seq = seq;
            p.seqFrame = 0;
            if (p.seq !== -1) Client.TriggerSeqSound(SeqType.List(p.seq), p.z, p.x, Client.localPlayer === p, p.seqFrame);
        }
    }

    static readonly npcIds = new Int32Array(32768); // fi.n:[I
    static npcCount = 0; // ed.d:I
    static readonly entityRemovalIds = new Int32Array(1000); // bd.O:[I
    static readonly entityUpdateIds = new Int32Array(2048); // ii.j:[I
    static entityRemovalCount = 0; // jh.i:I
    static entityUpdateCount = 0; // il.L:I

    // da.b(B)V
    static GetNPCPos(): void {
        Client.entityUpdateCount = 0;
        Client.entityRemovalCount = 0;
        Client.GetNPCPosOldVis();
        Client.GetNPCPosNewVis();
        Client.GetNPCPosExtended();
        for (let i = 0; i < Client.entityRemovalCount; i++) {
            const id = arrayAtI32(Client.entityRemovalIds, i);
            const npc = requireNonNull(arrayAtObj(Client.npcs, id));
            if (npc.lastUpdate !== Client.loopCycle) {
                if (requireNonNull(npc.npcType).HasBackgroundMovementSound()) AreaSoundManager.removeNpc(npc);
                npc.setType(null);
                arrayPutObj(Client.npcs, id, null);
            }
        }
        if (Protocol.packetSize !== Protocol.inPacket.m_pos) throw Error('gnp1 pos:' + Protocol.inPacket.m_pos + ' psize:' + Protocol.packetSize);
        for (let i = 0; i < Client.npcCount; i++) {
            if (arrayAtObj(Client.npcs, arrayAtI32(Client.npcIds, i)) === null) throw Error('gnp2 pos:' + i + ' size:' + Client.npcCount);
        }
    }

    // ob.e(B)V
    private static GetNPCPosOldVis(): void {
        Protocol.inPacket.GBitStart();
        const count = Protocol.inPacket.gBit(8);
        if (Client.npcCount > count) {
            for (let i = count; i < Client.npcCount; i++) arrayPutI32(Client.entityRemovalIds, Client.entityRemovalCount++, arrayAtI32(Client.npcIds, i));
        }
        if (count > Client.npcCount) throw Error('gnpov1');
        Client.npcCount = 0;
        for (let i = 0; i < count; i++) {
            const id = arrayAtI32(Client.npcIds, i);
            const npc = arrayAtObj(Client.npcs, id);
            if (Protocol.inPacket.gBit(1) === 0) {
                arrayPutI32(Client.npcIds, Client.npcCount++, id);
                requireNonNull(npc).lastUpdate = Client.loopCycle;
            } else {
                const type = Protocol.inPacket.gBit(2);
                if (type === 0) {
                    arrayPutI32(Client.npcIds, Client.npcCount++, id);
                    requireNonNull(npc).lastUpdate = Client.loopCycle;
                    arrayPutI32(Client.entityUpdateIds, Client.entityUpdateCount++, id);
                } else if (type === 1) {
                    arrayPutI32(Client.npcIds, Client.npcCount++, id);
                    requireNonNull(npc).lastUpdate = Client.loopCycle;
                    const dir = Protocol.inPacket.gBit(3);
                    requireNonNull(npc).step(dir, 1, 3, 32);
                    if (Protocol.inPacket.gBit(1) === 1) arrayPutI32(Client.entityUpdateIds, Client.entityUpdateCount++, id);
                } else if (type === 2) {
                    arrayPutI32(Client.npcIds, Client.npcCount++, id);
                    requireNonNull(npc).lastUpdate = Client.loopCycle;
                    if (Protocol.inPacket.gBit(1) !== 1) {
                        const dir = Protocol.inPacket.gBit(3);
                        requireNonNull(npc).step(dir, 0, 3, -80);
                    } else {
                        const first = Protocol.inPacket.gBit(3);
                        requireNonNull(npc).step(first, 2, 3, -122);
                        const second = Protocol.inPacket.gBit(3);
                        requireNonNull(npc).step(second, 2, 3, 85);
                    }
                    if (Protocol.inPacket.gBit(1) === 1) arrayPutI32(Client.entityUpdateIds, Client.entityUpdateCount++, id);
                } else if (type === 3) arrayPutI32(Client.entityRemovalIds, Client.entityRemovalCount++, id);
            }
        }
    }

    // oc.b(I)V
    private static GetNPCPosNewVis(): void {
        while (Protocol.inPacket.BitsLeft(Protocol.packetSize) >= 27) {
            const id = Protocol.inPacket.gBit(15);
            if (id === 32767) break;
            let created = false;
            if (arrayAtObj(Client.npcs, id) === null) {
                created = true;
                arrayPutObj(Client.npcs, id, new ClientNpc());
            }
            const npc = requireNonNull(arrayAtObj(Client.npcs, id));
            arrayPutI32(Client.npcIds, Client.npcCount++, id);
            npc.lastUpdate = Client.loopCycle;
            if (npc.npcType !== null && npc.npcType.HasBackgroundMovementSound()) AreaSoundManager.removeNpc(npc);
            const jump = Protocol.inPacket.gBit(1);
            const yaw = arrayAtI32(Client.FACING_MAP, Protocol.inPacket.gBit(3));
            if (created) npc.targetYaw = npc.yaw = yaw;
            if (Protocol.inPacket.gBit(1) === 1) arrayPutI32(Client.entityUpdateIds, Client.entityUpdateCount++, id);
            let dz = Protocol.inPacket.gBit(5);
            npc.setType(NpcType.List(Protocol.inPacket.gBit(14)));
            let dx = Protocol.inPacket.gBit(5);
            if (dz > 15) dz -= 32;
            if (dx > 15) dx -= 32;
            const type = requireNonNull(npc.npcType);
            npc.setSize(type.m_gridSize);
            npc.turnSpeed = type.m_turnSpeed;
            npc.bas = type.m_baseAnimationSet;
            if (npc.turnSpeed === 0) npc.yaw = 0;
            const self = requireNonNull(Client.localPlayer);
            npc.moveSized(npc.getSize(), (dz + arrayAtI32(self.pathZ, 0)) | 0, (arrayAtI32(self.pathX, 0) + dx) | 0, jump === 1);
            if (type.HasBackgroundMovementSound()) AreaSoundManager.add(arrayAtI32(npc.pathZ, 0), null, Client.playerLevel, null, arrayAtI32(npc.pathX, 0), npc, 0);
        }
        Protocol.inPacket.GBitEnd();
    }

    // wd.a(I)V
    private static GetNPCPosExtended(): void {
        for (let i = 0; i < Client.entityUpdateCount; i++) {
            const id = arrayAtI32(Client.entityUpdateIds, i),
                npc = arrayAtObj(Client.npcs, id);
            let mask = Protocol.inPacket.g1();
            if ((mask & 8) !== 0) mask = (mask + (Protocol.inPacket.g1() << 8)) | 0;
            if ((mask & 64) !== 0) {
                const damage = Protocol.inPacket.g1(),
                    type = Protocol.inPacket.g1_alt2();
                requireNonNull(npc).addHit(damage, Client.loopCycle, type);
                requireNonNull(npc).healthUntil = (300 + Client.loopCycle) | 0;
                requireNonNull(npc).health = Protocol.inPacket.g1_alt3();
            }
            if ((mask & 2) !== 0) {
                const damage = Protocol.inPacket.g1_alt2(),
                    type = Protocol.inPacket.g1_alt3();
                requireNonNull(npc).addHit(damage, Client.loopCycle, type);
            }
            if ((mask & 16) !== 0) {
                let seq = Protocol.inPacket.g2();
                if (seq === 65535) seq = -1;
                const delay = Protocol.inPacket.g1();
                ClientNpc.setPrimarySeq(delay, seq, requireNonNull(npc));
            }
            if ((mask & 4) !== 0) {
                const face = Protocol.inPacket.g2_alt2();
                requireNonNull(npc).faceEntity = face;
                if (face === 65535) requireNonNull(npc).faceEntity = -1;
            }
            if ((mask & 128) !== 0) {
                let accept = true;
                let spot = Protocol.inPacket.g2_alt2();
                const packed = Protocol.inPacket.g4_alt1(glJar ? -46 : 4);
                if (spot === 65535) spot = -1;
                const p = requireNonNull(npc);
                if (spot !== -1 && p.spotanim !== -1 && SeqType.List(SpotType.List(spot).seq).m_priority < SeqType.List(SpotType.List(p.spotanim).seq).m_priority) accept = false;
                if (accept) {
                    p.spotanim = spot;
                    p.spotFrame = 0;
                    p.spotCycle = 0;
                    p.spotNext = 1;
                    p.spotStart = (Client.loopCycle + (packed & 65535)) | 0;
                    p.spotHeight = packed >> 16;
                    if (p.spotStart > Client.loopCycle) p.spotFrame = -1;
                    if (p.spotanim !== -1 && Client.loopCycle === p.spotStart) {
                        const seq = SpotType.List(p.spotanim).seq;
                        if (seq !== -1) {
                            const type = SeqType.List(seq);
                            if (type.frames !== null) Client.TriggerSeqSound(type, p.z, p.x, false, 0);
                        }
                    }
                }
            }
            if ((mask & 1) !== 0) {
                const p = requireNonNull(npc);
                if (requireNonNull(p.npcType).HasBackgroundMovementSound()) AreaSoundManager.removeNpc(p);
                p.setType(NpcType.List(Protocol.inPacket.g2_alt1()));
                p.setSize(requireNonNull(p.npcType).m_gridSize);
                p.bas = requireNonNull(p.npcType).m_baseAnimationSet;
                if (requireNonNull(p.npcType).HasBackgroundMovementSound()) AreaSoundManager.add(arrayAtI32(p.pathZ, 0), null, Client.playerLevel, null, arrayAtI32(p.pathX, 0), p, 0);
            }
            if ((mask & 32) !== 0) {
                const text = Protocol.inPacket.gStringNoConversion();
                requireNonNull(npc).overheadText = text;
                requireNonNull(npc).chatTimer = 100;
            }
            if ((mask & 256) !== 0) {
                const count = Protocol.inPacket.g1_alt2(),
                    seqs = new Int32Array(count),
                    delays = new Int32Array(count),
                    slots = new Int32Array(count);
                for (let i = 0; i < count; i++) {
                    let id = Protocol.inPacket.g2_alt1();
                    if (id === 65535) id = -1;
                    seqs[i] = id;
                    delays[i] = Protocol.inPacket.g1_alt3();
                    slots[i] = Protocol.inPacket.g2();
                }
                ClientNpc.applySlotAnims(npc, delays, 0, slots, seqs);
            }
            if ((mask & 512) !== 0) {
                const x = Protocol.inPacket.g2_alt2();
                requireNonNull(npc).faceX = x;
                requireNonNull(npc).faceZ = Protocol.inPacket.g2();
            }
        }
    }

    // client.f(B)V
    private async MainLoad(): Promise<void> {
        if (!Preferences.safeMode) {
            while (ClientKeyboardListener.next()) {
                if (ClientKeyboardListener.keyChar === 115 || ClientKeyboardListener.keyChar === 83) Preferences.safeMode = true;
            }
        }
        switch (true) {
            case Client.loadingStage === 0: {
                const usedKb = Client.usedMemoryKb();
                const now = SafeTime.CurrentTimeMillis();
                if (Client.loadingMemoryCheckStart === 0n) Client.loadingMemoryCheckStart = now;
                if (usedKb > 16384 && BigInt.asIntN(64, now - Client.loadingMemoryCheckStart) < 5000n) {
                    if (BigInt.asIntN(64, now - Client.lastGcTime) > 1000n) {
                        globalThis.gc?.();
                        Client.lastGcTime = now;
                    }
                    if (!glJar) TitleScreen.m_loadString = LocalisedText.allocatingMemory;
                    TitleScreen.m_loadPos = 5;
                    if (glJar) TitleScreen.m_loadString = LocalisedText.allocatingMemory;
                } else {
                    TitleScreen.m_loadString = LocalisedText.allocatedMemory;
                    if (!glJar) TitleScreen.m_loadPos = 5;
                    Client.loadingStage = 10;
                    if (glJar) TitleScreen.m_loadPos = 5;
                }
                break;
            }
            case Client.loadingStage === 10:
                if (glJar) PointLightManagerClass.setDimensions(4, 104, 104);
                for (let plane = 0; plane < 4; plane++) CollisionMap.levelMaps[plane] = new CollisionMap(104, 104);
                TitleScreen.m_loadPos = 10;
                if (!glJar) TitleScreen.m_loadString = LocalisedText.createdGameworld;
                Client.loadingStage = 30;
                if (glJar) TitleScreen.m_loadString = LocalisedText.createdGameworld;
                break;
            case Client.loadingStage === 30:
                if (Client.js5MasterIndex === null) Client.js5MasterIndex = new Js5MasterIndex(requireNonNull(Client.js5NetQueue), requireNonNull(Client.js5DiskQueue));
                if (!Client.js5MasterIndex.load()) {
                    if (!glJar) TitleScreen.m_loadPos = 12;
                    TitleScreen.m_loadString = LocalisedText.connectingToUpdateServer;
                    if (glJar) TitleScreen.m_loadPos = 12;
                } else {
                    Client.animFramesArchive = Client.OpenJs5(false, true, 0, true);
                    Client.basesArchive = Client.OpenJs5(false, true, 1, true);
                    Client.configArchive = Client.OpenJs5(true, true, 2, false);
                    Client.interfacesArchive = Client.OpenJs5(false, true, 3, true);
                    Client.m_pJagFx = Client.OpenJs5(false, true, 4, true);
                    Client.mapsArchive = Client.OpenJs5(true, true, 5, true);
                    Client.m_pMidi = Client.OpenJs5(true, false, 6, true);
                    Client.modelsArchive = Client.OpenJs5(false, true, 7, true);
                    Client.m_pSprites = Client.OpenJs5(false, true, 8, true);
                    Client.texturesArchive = Client.OpenJs5(false, true, 9, true);
                    Client.binaryArchive = Client.OpenJs5(false, true, 10, true);
                    Client.jingleArchive = Client.OpenJs5(false, true, 11, true);
                    Client.m_pClientScripts = Client.OpenJs5(false, true, 12, true);
                    Client.fontMetricsArchive = Client.OpenJs5(false, true, 13, true);
                    Client.vorbisArchive = Client.OpenJs5(false, false, 14, true);
                    Client.instrumentsArchive = Client.OpenJs5(false, true, 15, true);
                    Client.locConfigArchive = Client.OpenJs5(false, true, 16, true);
                    Client.enumsArchive = Client.OpenJs5(false, true, 17, true);
                    Client.npcConfigArchive = Client.OpenJs5(false, true, 18, true);
                    Client.objConfigArchive = Client.OpenJs5(false, true, 19, true);
                    Client.seqConfigArchive = Client.OpenJs5(false, true, 20, true);
                    Client.spotTypeArchive = Client.OpenJs5(false, true, 21, true);
                    Client.varBitArchive = Client.OpenJs5(false, true, 22, true);
                    Client.worldMapArchive = Client.OpenJs5(true, true, 23, true);
                    Client.quickChatArchive = Client.OpenJs5(false, true, 24, true);
                    Client.quickChatGlobalArchive = Client.OpenJs5(false, true, 25, true);
                    Client.materialsArchive = Client.OpenJs5(true, true, 26, true);
                    Client.js5Archive27 = Client.OpenJs5(false, true, 27, true);
                    if (glJar) TitleScreen.m_loadPos = 15;
                    else Client.loadingStage = 40;
                    TitleScreen.m_loadString = LocalisedText.connectedToUpdateServer;
                    if (glJar) Client.loadingStage = 40;
                    else TitleScreen.m_loadPos = 15;
                }
                break;
            case Client.loadingStage === 40: {
                let total = 0;
                for (let id = 0; id < 28; id++) {
                    const loaded = requireNonNull(arrayAtObj(Client.js5Providers, id)).GetIndexPercentage();
                    total = (total + ((Math.imul(loaded, arrayAtI32(Client.archiveLoadWeights, id)) / 100) | 0)) | 0;
                }
                if (total !== 100) {
                    if (total !== 0) TitleScreen.m_loadString = JagString.join([LocalisedText.checkingForUpdates, JagString.fromInt(total), Client.percentSign]);
                    TitleScreen.m_loadPos = 20;
                } else {
                    TitleScreen.m_loadPos = 20;
                    TitleScreen.m_loadString = LocalisedText.loadedUpdateList;
                    Client.lookupSpriteGroupIds(Client.m_pSprites);
                    if (this.standaloneWorldMap) {
                        Client.loadingStage = 50;
                        break;
                    }
                    Client.loadTitleGroupIds(Client.m_pSprites);
                    Client.findRunesSpriteGroup(Client.m_pSprites);
                    Client.loadingStage = 45;
                }
                break;
            }
            case Client.loadingStage === 45:
                PCMPlayer.Init(2, Preferences.stereo, 22050);
                AudioEngine.music = new MidiPlayer();
                AudioEngine.music.QueueSetDefInst(128, 9);
                AudioEngine.musicPlayer = PCMPlayer.GetPlayer(22050, GameShell.signlink, 0, GameShell.canvas);
                AudioEngine.musicPlayer.SetInput(AudioEngine.music);
                if (glJar) {
                    const music = AudioEngine.music;
                    const instruments = Client.instrumentsArchive;
                    MidiManager.Init(music, Client.vorbisArchive, instruments, Client.m_pJagFx);
                } else MidiManager.Init(AudioEngine.music, Client.vorbisArchive, Client.instrumentsArchive, Client.m_pJagFx);
                AudioEngine.effectsPlayer = PCMPlayer.GetPlayer(2048, GameShell.signlink, 1, GameShell.canvas);
                AudioEngine.effects = new Mixer();
                AudioEngine.effectsPlayer.SetInput(AudioEngine.effects);
                AudioEngine.decimator = new Decimator(22050, PCMPlayer.m_frequency);
                Client.titleSong = requireNonNull(Client.m_pMidi).GetGroupId(Client.titleSongName);
                TitleScreen.m_loadPos = 30;
                if (!glJar) TitleScreen.m_loadString = LocalisedText.preparedSoundEngine;
                Client.loadingStage = 50;
                if (glJar) TitleScreen.m_loadString = LocalisedText.preparedSoundEngine;
                break;
            case Client.loadingStage === 50: {
                const n = Client.countFontsReady(Client.m_pSprites, Client.fontMetricsArchive);
                const total = Fonts.getFileCount();
                if (n < total) {
                    TitleScreen.m_loadString = JagString.join([LocalisedText.loadingFonts, JagString.fromInt((Math.imul(100, n) / total) | 0), Client.percentSign]);
                    TitleScreen.m_loadPos = 35;
                } else {
                    if (glJar) TitleScreen.m_loadString = LocalisedText.loadedFonts;
                    TitleScreen.m_loadPos = 35;
                    Client.loadingStage = this.standaloneWorldMap ? 65 : 60;
                    if (!glJar) TitleScreen.m_loadString = LocalisedText.loadedFonts;
                }
                break;
            }
            case Client.loadingStage === 60: {
                const n = TitleScreen.Ready(Client.m_pSprites);
                const total = TitleScreen.ReadyMax();
                if (n < total) {
                    TitleScreen.m_loadString = JagString.join([LocalisedText.loadingTitleScreen, JagString.fromInt((Math.imul(100, n) / total) | 0), Client.percentSign]);
                    TitleScreen.m_loadPos = 40;
                } else {
                    TitleScreen.m_loadString = LocalisedText.loadedTitleScreen;
                    Client.loadingStage = 65;
                    TitleScreen.m_loadPos = 40;
                }
                break;
            }
            case Client.loadingStage === 65: {
                if (glJar) {
                    const metrics = Client.fontMetricsArchive;
                    Client.loadFonts(Client.m_pSprites, metrics);
                } else Client.loadFonts(Client.m_pSprites, Client.fontMetricsArchive);
                if (!glJar) TitleScreen.m_loadString = LocalisedText.openedTitleScreen;
                TitleScreen.m_loadPos = 45;
                if (glJar) TitleScreen.m_loadString = LocalisedText.openedTitleScreen;
                if (!this.standaloneWorldMap) Client.SetMainState(5);
                Client.loadingStage = 70;
                break;
            }
            case Client.loadingStage === 70: {
                requireNonNull(Client.configArchive).RequestFullDownload();
                let total = requireNonNull(Client.configArchive).GetDataPercent(0);
                requireNonNull(Client.locConfigArchive).RequestFullDownload();
                total = (total + requireNonNull(Client.locConfigArchive).GetDataPercent(0)) | 0;
                requireNonNull(Client.enumsArchive).RequestFullDownload();
                total = (total + requireNonNull(Client.enumsArchive).GetDataPercent(0)) | 0;
                requireNonNull(Client.npcConfigArchive).RequestFullDownload();
                total = (total + requireNonNull(Client.npcConfigArchive).GetDataPercent(0)) | 0;
                requireNonNull(Client.objConfigArchive).RequestFullDownload();
                total = (total + requireNonNull(Client.objConfigArchive).GetDataPercent(0)) | 0;
                requireNonNull(Client.seqConfigArchive).RequestFullDownload();
                total = (total + requireNonNull(Client.seqConfigArchive).GetDataPercent(0)) | 0;
                requireNonNull(Client.spotTypeArchive).RequestFullDownload();
                total = (total + requireNonNull(Client.spotTypeArchive).GetDataPercent(0)) | 0;
                requireNonNull(Client.varBitArchive).RequestFullDownload();
                total = (total + requireNonNull(Client.varBitArchive).GetDataPercent(0)) | 0;
                requireNonNull(Client.quickChatArchive).RequestFullDownload();
                total = (total + requireNonNull(Client.quickChatArchive).GetDataPercent(0)) | 0;
                requireNonNull(Client.quickChatGlobalArchive).RequestFullDownload();
                total = (total + requireNonNull(Client.quickChatGlobalArchive).GetDataPercent(0)) | 0;
                requireNonNull(Client.js5Archive27).RequestFullDownload();
                total = (total + requireNonNull(Client.js5Archive27).GetDataPercent(0)) | 0;
                if (total < 1100) {
                    TitleScreen.m_loadString = JagString.join([LocalisedText.loadingConfig, JagString.fromInt((total / 11) | 0), Client.percentSign]);
                    TitleScreen.m_loadPos = 50;
                } else {
                    ParamType.Init(Client.configArchive);
                    FloType.Init(Client.configArchive);
                    FluType.Init(Client.configArchive);
                    if (glJar) {
                        const idkModels = Client.modelsArchive;
                        IdkType.Init(Client.configArchive, idkModels);
                        const locs = Client.locConfigArchive;
                        LocType.Init(Client.modelsArchive, locs, true);
                        const npcModels = Client.modelsArchive;
                        NpcType.Init(Client.npcConfigArchive, npcModels);
                    } else {
                        IdkType.Init(Client.configArchive, Client.modelsArchive);
                        LocType.Init(Client.modelsArchive, Client.locConfigArchive, true);
                        NpcType.Init(Client.npcConfigArchive, Client.modelsArchive);
                    }
                    ObjType.Init(Client.objConfigArchive, true, Client.p11Software, Client.modelsArchive);
                    StructType.Init(Client.configArchive);
                    if (glJar) {
                        const bases = Client.basesArchive;
                        SeqType.Init(Client.seqConfigArchive, bases, Client.animFramesArchive);
                    } else SeqType.Init(Client.seqConfigArchive, Client.basesArchive, Client.animFramesArchive);
                    BASTypeList.init(Client.configArchive);
                    SpotType.Init(Client.modelsArchive, Client.spotTypeArchive);
                    VarBitType.Init(Client.varBitArchive);
                    VarpType.Init(Client.configArchive);
                    if (glJar) {
                        const fonts = Client.fontMetricsArchive,
                            sprites = Client.m_pSprites,
                            interfaces = Client.interfacesArchive;
                        IfType.Init(fonts, sprites, Client.modelsArchive, interfaces);
                    } else IfType.Init(Client.fontMetricsArchive, Client.m_pSprites, Client.modelsArchive, Client.interfacesArchive);
                    InvType.Init(Client.configArchive);
                    EnumType.Init(Client.enumsArchive);
                    if (glJar) {
                        const globalPhrases = Client.quickChatGlobalArchive,
                            phrases = Client.quickChatArchive;
                        QuickChatPhraseTypeList.init(globalPhrases, new ClientQuickChatCommandDecoder(), phrases);
                        const globalCategories = Client.quickChatGlobalArchive;
                        QuickChatCatTypeList.init(Client.quickChatArchive, globalCategories);
                    } else {
                        QuickChatPhraseTypeList.init(Client.quickChatGlobalArchive, new ClientQuickChatCommandDecoder(), Client.quickChatArchive);
                        QuickChatCatTypeList.init(Client.quickChatArchive, Client.quickChatGlobalArchive);
                    }
                    // HD id.a(Lve;B)V. SD fl.a(Lal;Z)V has only an obfuscator counter.
                    if (glJar) LightType.Init(Client.configArchive);
                    CursorType.init(Client.configArchive, Client.m_pSprites);
                    if (glJar) {
                        const configs = Client.configArchive;
                        MSITypeList.init(Client.m_pSprites, configs);
                    } else MSITypeList.init(Client.m_pSprites, Client.configArchive);
                    if (!glJar) TitleScreen.m_loadString = LocalisedText.loadedConfig;
                    TitleScreen.m_loadPos = 50;
                    if (glJar) TitleScreen.m_loadString = LocalisedText.loadedConfig;
                    ObjType.findWearables();
                    Client.loadingStage = 80;
                }
                break;
            }
            case Client.loadingStage === 80: {
                const n = Client.getGameSpritesLoaded(Client.m_pSprites, false);
                const total = SpriteLoader.total();
                if (n < total) {
                    TitleScreen.m_loadString = JagString.join([LocalisedText.loadingSprites, JagString.fromInt((Math.imul(100, n) / total) | 0), Client.percentSign]);
                    TitleScreen.m_loadPos = 60;
                } else {
                    Client.loadSprites(Client.m_pSprites);
                    if (!glJar) TitleScreen.m_loadPos = 60;
                    Client.loadingStage = 90;
                    if (glJar) TitleScreen.m_loadPos = 60;
                    TitleScreen.m_loadString = LocalisedText.loadedSprites;
                }
                break;
            }
            case Client.loadingStage === 90: {
                if (!requireNonNull(Client.materialsArchive).RequestFullDownload()) {
                    TitleScreen.m_loadString = JagString.join([LocalisedText.loadingTextures, JagString.fromInt(requireNonNull(Client.materialsArchive).GetDataPercent(0)), Client.percentSign]);
                    TitleScreen.m_loadPos = 70;
                } else {
                    const textures = new TextureCache(Client.texturesArchive, Client.materialsArchive, Client.m_pSprites, 20, !Preferences.graphics.highDetailTextures);
                    Pix3D.setTextures(textures);
                    if (Preferences.brightness === 1) Pix3D.setBrightness(0.9);
                    if (Preferences.brightness === 2) Pix3D.setBrightness(0.8);
                    if (Preferences.brightness === 3) Pix3D.setBrightness(0.7);
                    if (Preferences.brightness === 4) Pix3D.setBrightness(0.6);
                    TitleScreen.m_loadString = LocalisedText.loadedTextures;
                    Client.loadingStage = this.standaloneWorldMap ? 130 : 100;
                    TitleScreen.m_loadPos = 70;
                }
                break;
            }
            case Client.loadingStage === 100:
                if (TitleScreen.isRunesReady(Client.m_pSprites)) Client.loadingStage = 110;
                break;
            case Client.loadingStage === 110:
                Client.mouseTracking = new MouseTracking();
                requireNonNull(GameShell.signlink).startThread(Client.mouseTracking, 10);
                TitleScreen.m_loadString = LocalisedText.loadedInputHandler;
                if (!glJar) Client.loadingStage = 120;
                TitleScreen.m_loadPos = 75;
                if (glJar) Client.loadingStage = 120;
                break;
            case Client.loadingStage === 120:
                if (!requireNonNull(Client.binaryArchive).RequestDownload3(JagString.empty, Client.huffmanGroup)) {
                    TitleScreen.m_loadString = JagString.join([LocalisedText.loadingWordpack, Client.zeroPercent]);
                    TitleScreen.m_loadPos = 80;
                } else {
                    const codec = new Huffman(requireNonNull(requireNonNull(Client.binaryArchive).GetFile3(JagString.empty, Client.huffmanGroup)));
                    WordPack.setCodec(codec);
                    if (!glJar) TitleScreen.m_loadPos = 80;
                    TitleScreen.m_loadString = LocalisedText.loadedWordpack;
                    Client.loadingStage = 130;
                    if (glJar) TitleScreen.m_loadPos = 80;
                }
                break;
            case Client.loadingStage === 130:
                if (!requireNonNull(Client.interfacesArchive).RequestFullDownload()) {
                    TitleScreen.m_loadString = JagString.join([LocalisedText.loadingInterfaces, JagString.fromInt((Math.imul(requireNonNull(Client.interfacesArchive).GetDataPercent(0), 3) / 4) | 0), Client.percentSign]);
                    TitleScreen.m_loadPos = 85;
                } else if (!requireNonNull(Client.m_pClientScripts).RequestFullDownload()) {
                    TitleScreen.m_loadString = JagString.join([LocalisedText.loadingInterfaces, JagString.fromInt((((requireNonNull(Client.m_pClientScripts).GetDataPercent(0) / 10) | 0) + 75) | 0), Client.percentSign]);
                    TitleScreen.m_loadPos = 85;
                } else if (!requireNonNull(Client.fontMetricsArchive).RequestFullDownload()) {
                    TitleScreen.m_loadString = JagString.join([LocalisedText.loadingInterfaces, JagString.fromInt((((requireNonNull(Client.fontMetricsArchive).GetDataPercent(0) / 20) | 0) + 85) | 0), Client.percentSign]);
                    TitleScreen.m_loadPos = 85;
                } else if (!requireNonNull(Client.worldMapArchive).RequestGroupDownload2(WorldMap.detailsGroup)) {
                    TitleScreen.m_loadString = JagString.join([LocalisedText.loadingInterfaces, JagString.fromInt((((requireNonNull(Client.worldMapArchive).GetGroupLoadPercentage2(WorldMap.detailsGroup) / 10) | 0) + 90) | 0), Client.percentSign]);
                    TitleScreen.m_loadPos = 85;
                } else {
                    WorldMap.init(Client.imageMapfunction, Client.worldMapArchive);
                    if (this.standaloneWorldMap) {
                        // Supply worldmap_focus to the map's onload using the surface map's own origin.
                        const surface = requireNonNull(MapArea.get(fromLiteral('main')));
                        DelayedStateChange.varcs[622] = ((surface.originX << 6) << 14) | (surface.originZ << 6);
                        await this.resetToTitle(true);
                        break;
                    }
                    TitleScreen.m_loadPos = 95;
                    if (!glJar) Client.loadingStage = 135;
                    TitleScreen.m_loadString = LocalisedText.loadedInterfaces;
                    if (glJar) Client.loadingStage = 135;
                }
                break;
            case Client.loadingStage === 135: {
                const code = await GameWorld.ListFetch();
                if (code === -1) {
                    TitleScreen.m_loadPos = 95;
                    TitleScreen.m_loadString = LocalisedText.loadingWorldListData;
                } else if (code !== 7 && code !== 9 && WorldList.loaded) {
                    if (!glJar) Client.loadingStage = 140;
                    TitleScreen.m_loadString = LocalisedText.loadedWorldList;
                    if (glJar) Client.loadingStage = 140;
                    TitleScreen.m_loadPos = 96;
                } else {
                    this.ShowError(code === 7 || code === 9 ? 'worldlistfull' : 'worldlistio_' + code);
                    Client.SetMainState(1000);
                }
                break;
            }
            case Client.loadingStage === 140:
                Client.loginScreenInterface = requireNonNull(Client.interfacesArchive).GetGroupId(Client.loginScreenName);
                requireNonNull(Client.mapsArchive).discardNames(true, false);
                requireNonNull(Client.m_pMidi).discardNames(true, true);
                requireNonNull(Client.m_pSprites).discardNames(true, true);
                requireNonNull(Client.fontMetricsArchive).discardNames(true, true);
                requireNonNull(Client.binaryArchive).discardNames(true, true);
                requireNonNull(Client.interfacesArchive).discardNames(true, true);
                TitleScreen.m_loadPos = 97;
                if (!glJar) Client.loadingStage = 150;
                TitleScreen.m_loadString = LocalisedText.starting3dLibrary;
                if (glJar) Client.loadingStage = 150;
                Client.loadingComplete = true;
                break;
            case Client.loadingStage === 150:
                if (glJar) NoiseTextures.buildVolumes();
                if (Preferences.safeMode) {
                    if (!glJar) Preferences.buildArea = 0;
                    Preferences.antiAliasingMode = 0;
                    Preferences.currentAntiAliasingMode = 0;
                    Preferences.windowMode = 0;
                    if (glJar) Preferences.buildArea = 0;
                }
                Preferences.safeMode = true;
                Preferences.write();
                {
                    const change = Client.setWindowMode(-1, true, Preferences.windowMode, false, -1);
                    if (change instanceof Promise) await change;
                }
                if (!glJar) TitleScreen.m_loadString = LocalisedText.started3dLibrary;
                TitleScreen.m_loadPos = 100;
                Client.loadingStage = 160;
                if (glJar) TitleScreen.m_loadString = LocalisedText.started3dLibrary;
                break;
            case Client.loadingStage === 160: {
                const title = this.resetToTitle(true);
                if (title instanceof Promise) await title;
                break;
            }
        }
    }

    // dg.a(ZZ)V. gj.e calls dg.a(true,false) for a normal rebuild.
    static loadAllLocs(underwater: boolean): void {
        const softwareLocations = glJar ? null : Client.sceneMapLocData;
        const count = requireNonNull(Client.sceneMapLandData).length;
        const locations = glJar ? (GlRendererClass.active && underwater ? Client.sceneMapUnderwaterLocData : Client.sceneMapLocData) : softwareLocations;
        for (let i = 0; i < count; i++) {
            const bytes = arrayAtObj(locations, i);
            if (bytes !== null) {
                const x = glJar ? (-Client.mapBuildBaseX + (arrayAtI32(Client.mapBuildIndex, i) >> 8) * 64) | 0 : ((arrayAtI32(Client.mapBuildIndex, i) >> 8) * 64 - Client.mapBuildBaseX) | 0;
                const z = glJar ? ((arrayAtI32(Client.mapBuildIndex, i) & 255) * 64 - Client.mapBuildBaseZ) | 0 : (-Client.mapBuildBaseZ + (arrayAtI32(Client.mapBuildIndex, i) & 255) * 64) | 0;
                AudioEngine.tick();
                ClientBuild.LoadLocations(x, CollisionMap.levelMaps, bytes, z, underwater);
            }
        }
    }

    // jh.a(BZ)V. gj.e passes -50 for a dynamic rebuild.
    static mapBuildLocsDynamic(underwater: boolean): void {
        const underwaterLayer = glJar && GlRendererClass.active && underwater;
        const locations = underwaterLayer ? Client.sceneMapUnderwaterLocData : Client.sceneMapLocData;
        for (let level = 0; level < (underwaterLayer ? 1 : 4); level++) {
            AudioEngine.tick();
            for (let x = 0; x < 13; x++) {
                for (let z = 0; z < 13; z++) {
                    const template = arrayAtI32(arrayAtObj(arrayAtObj(Client.dynamicChunks, level), x), z);
                    if (template === -1) continue;
                    const sourceLevel = (template >> 24) & 3;
                    if (underwater && sourceLevel !== 0) continue;
                    const rotation = (template & 7) >> 1;
                    const sourceX = (template >> 14) & 1023;
                    const sourceZ = (template >> 3) & 2047;
                    const region = (sourceZ >> 3) + ((sourceX >> 3) << 8);
                    for (let i = 0; i < requireNonNull(Client.mapBuildIndex).length; i++) {
                        if (region === arrayAtI32(Client.mapBuildIndex, i) && arrayAtObj(locations, i) !== null) {
                            ClientBuild.LoadLocationsRegion(x * 8, (sourceX & 7) * 8, CollisionMap.levelMaps, rotation, sourceLevel, arrayAtObj(locations, i), z * 8, underwater, level, (sourceZ & 7) * 8);
                            break;
                        }
                    }
                }
            }
        }
    }

    // g.a(BZ)V. The normal terrain passes are inline in NXT Client::MapBuildLoop.
    static loadGroundRegions(underwater: boolean): void {
        const underwaterLayer = glJar && GlRendererClass.active && underwater;
        const land = underwaterLayer ? Client.sceneMapUnderwaterLandData : Client.sceneMapLandData;
        const count = requireNonNull(land).length;
        for (let i = 0; i < count; i++) {
            const x = (-Client.mapBuildBaseX + (arrayAtI32(Client.mapBuildIndex, i) >> 8) * 64) | 0;
            const z = glJar ? (-Client.mapBuildBaseZ + (arrayAtI32(Client.mapBuildIndex, i) & 255) * 64) | 0 : ((arrayAtI32(Client.mapBuildIndex, i) & 255) * 64 - Client.mapBuildBaseZ) | 0;
            const data = arrayAtObj(land, i);
            if (data !== null) {
                AudioEngine.tick();
                if (glJar) {
                    const maps = CollisionMap.levelMaps;
                    const baseX = (8 * Client.mapBuildCentreZoneX - 48) | 0;
                    const baseZ = ((Client.mapBuildCentreZoneZ - 6) * 8) | 0;
                    ClientBuild.LoadGround(z, underwater, baseZ, x, data, baseX, maps);
                } else ClientBuild.LoadGround(z, underwater, (8 * Client.mapBuildCentreZoneZ - 48) | 0, x, data, ((Client.mapBuildCentreZoneX - 6) * 8) | 0, CollisionMap.levelMaps);
            }
        }
        for (let i = 0; i < count; i++) {
            const x = glJar ? (-Client.mapBuildBaseX + (arrayAtI32(Client.mapBuildIndex, i) >> 8) * 64) | 0 : ((arrayAtI32(Client.mapBuildIndex, i) >> 8) * 64 - Client.mapBuildBaseX) | 0;
            const z = (-Client.mapBuildBaseZ + (arrayAtI32(Client.mapBuildIndex, i) & 255) * 64) | 0;
            const data = arrayAtObj(land, i);
            if (data === null && Client.mapBuildCentreZoneZ < 800) {
                AudioEngine.tick();
                for (let level = 0; level < (underwaterLayer ? 1 : 4); level++) ClientBuild.clearMapArea(x, 64, z, 64, level);
            }
        }
    }

    // gj.e(I)V. Client::MapBuildLoop in projects/osclient/client.cpp.
    private MapBuildLoop(): void {
        try {
            this.mapBuildLoopBody();
        } catch (error) {
            if (!glJar || !isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'gd.F(-117)');
        }
    }

    private mapBuildLoopBody(): void {
        const renderer = glJar ? GlRendererClass : null;
        let ready: boolean;
        if (glJar) {
            Client.PreventTimeout(false);
            Client.mapFilesMissing = 0;
            ready = true;
        } else {
            ready = true;
            Client.PreventTimeout(false);
            Client.mapFilesMissing = 0;
        }
        for (let i = 0; i < requireNonNull(Client.sceneMapLandData).length; i++) {
            if (arrayAtI32(Client.mapBuildGroundFile, i) !== -1 && arrayAtObj(Client.sceneMapLandData, i) === null) {
                const destination = Client.sceneMapLandData;
                const archive = Client.mapsArchive;
                const group = arrayAtI32(Client.mapBuildGroundFile, i);
                arrayPutObj(destination, i, requireNonNull(archive).GetFile(0, group));
                if (arrayAtObj(Client.sceneMapLandData, i) === null) {
                    Client.mapFilesMissing = (Client.mapFilesMissing + 1) | 0;
                    ready = false;
                }
            }
            if (arrayAtI32(Client.mapBuildLocationFile, i) !== -1 && arrayAtObj(Client.sceneMapLocData, i) === null) {
                const destination = Client.sceneMapLocData;
                const archive = Client.mapsArchive;
                let group = glJar ? arrayAtI32(Client.mapBuildLocationFile, i) : 0;
                const key = arrayAtObj(Client.mapBuildKeys, i);
                if (!glJar) group = arrayAtI32(Client.mapBuildLocationFile, i);
                arrayPutObj(destination, i, requireNonNull(archive).FetchFile(0, key, group));
                if (arrayAtObj(Client.sceneMapLocData, i) === null) {
                    ready = false;
                    Client.mapFilesMissing = (Client.mapFilesMissing + 1) | 0;
                }
            }
            if (renderer?.active) {
                if (arrayAtI32(Client.sceneMapUnderwaterLandFile, i) !== -1 && arrayAtObj(Client.sceneMapUnderwaterLandData, i) === null) {
                    const destination = Client.sceneMapUnderwaterLandData,
                        archive = Client.mapsArchive;
                    const group = arrayAtI32(Client.sceneMapUnderwaterLandFile, i);
                    arrayPutObj(destination, i, requireNonNull(archive).GetFile(0, group));
                    if (arrayAtObj(Client.sceneMapUnderwaterLandData, i) === null) {
                        ready = false;
                        Client.mapFilesMissing = (Client.mapFilesMissing + 1) | 0;
                    }
                }
                if (arrayAtI32(Client.sceneMapUnderwaterLocFile, i) !== -1 && arrayAtObj(Client.sceneMapUnderwaterLocData, i) === null) {
                    const destination = Client.sceneMapUnderwaterLocData,
                        archive = Client.mapsArchive;
                    const group = arrayAtI32(Client.sceneMapUnderwaterLocFile, i);
                    arrayPutObj(destination, i, requireNonNull(archive).GetFile(0, group));
                    if (arrayAtObj(Client.sceneMapUnderwaterLocData, i) === null) {
                        Client.mapFilesMissing = (Client.mapFilesMissing + 1) | 0;
                        ready = false;
                    }
                }
            }
            if (Client.npcSpawnGroupIds !== null && arrayAtObj(Client.mapBuildNpcData, i) === null && arrayAtI32(Client.npcSpawnGroupIds, i) !== -1) {
                const destination = Client.mapBuildNpcData;
                const archive = Client.mapsArchive;
                let group = glJar ? arrayAtI32(Client.npcSpawnGroupIds, i) : 0;
                const key = arrayAtObj(Client.mapBuildKeys, i);
                if (!glJar) group = arrayAtI32(Client.npcSpawnGroupIds, i);
                arrayPutObj(destination, i, requireNonNull(archive).FetchFile(0, key, group));
                if (arrayAtObj(Client.mapBuildNpcData, i) === null) {
                    ready = false;
                    Client.mapFilesMissing = (Client.mapFilesMissing + 1) | 0;
                }
            }
        }
        if (WorldMapLabels.scene === null) {
            let exists = false;
            if (WorldMap.sceneArea !== null) {
                const archive = Client.worldMapArchive;
                const name = JagString.join([WorldMap.sceneArea.groupName, WorldMapLabels.suffix]);
                exists = requireNonNull(archive).containsGroup(name, 0);
            }
            if (exists) {
                const archive = Client.worldMapArchive;
                const name = JagString.join([requireNonNull(WorldMap.sceneArea).groupName, WorldMapLabels.suffix]);
                if (requireNonNull(archive).RequestGroupDownload2(name)) {
                    const labels = JagString.join([requireNonNull(WorldMap.sceneArea).groupName, WorldMapLabels.suffix]);
                    WorldMapLabels.scene = WorldMapLabels.load(labels, Client.worldMapArchive);
                } else if (glJar) {
                    ready = false;
                    Client.mapFilesMissing = (Client.mapFilesMissing + 1) | 0;
                } else {
                    Client.mapFilesMissing = (Client.mapFilesMissing + 1) | 0;
                    ready = false;
                }
            } else {
                WorldMapLabels.scene = new WorldMapLabels(0);
            }
        }
        if (!ready) {
            Client.sceneState = 1;
            return;
        }
        Client.locsNotReadyCount = 0;
        ready = true;
        for (let i = 0; i < requireNonNull(Client.sceneMapLandData).length; i++) {
            const locs = arrayAtObj(Client.sceneMapLocData, i);
            if (locs !== null) {
                let z = glJar ? (-Client.mapBuildBaseZ + Math.imul(arrayAtI32(Client.mapBuildIndex, i) & 255, 64)) | 0 : (Math.imul(arrayAtI32(Client.mapBuildIndex, i) & 255, 64) - Client.mapBuildBaseZ) | 0;
                let x = (-Client.mapBuildBaseX + Math.imul(arrayAtI32(Client.mapBuildIndex, i) >> 8, 64)) | 0;
                if (Client.dynamicRegion) {
                    z = 10;
                    x = 10;
                }
                if (!ClientBuild.CheckLocations(x, locs, z)) ready = false;
            }
            if (renderer?.active) {
                const under = arrayAtObj(Client.sceneMapUnderwaterLocData, i);
                if (under !== null) {
                    let x = (-Client.mapBuildBaseX + Math.imul(arrayAtI32(Client.mapBuildIndex, i) >> 8, 64)) | 0;
                    let z = (-Client.mapBuildBaseZ + Math.imul(arrayAtI32(Client.mapBuildIndex, i) & 255, 64)) | 0;
                    if (Client.dynamicRegion) {
                        z = 10;
                        x = 10;
                    }
                    if (!ClientBuild.CheckLocations(x, under, z)) ready = false;
                }
            }
        }
        if (!ready) {
            Client.sceneState = 2;
            return;
        }
        if (Client.sceneState !== 0) Client.MessageBox(JagString.join([LocalisedText.loadingPleaseWait2, Client.loadingDoneSuffix]), true, -24);
        if (SceneCutover.active) {
            AudioEngine.tick();
            Client.ResetCache();
            let underwater = false;
            if (renderer?.active && Preferences.graphics.highWaterDetail) {
                for (let i = 0; i < requireNonNull(Client.sceneMapLandData).length; i++) {
                    if (arrayAtObj(Client.sceneMapUnderwaterLocData, i) !== null || arrayAtObj(Client.sceneMapUnderwaterLandData, i) !== null) {
                        underwater = true;
                        break;
                    }
                }
            }
            world.init(4, 104, 104, renderer?.active ? renderer.sceneRadius : 25, underwater);
            for (let level = 0; level < 4; level++) requireNonNull(arrayAtObj(CollisionMap.levelMaps, level)).reset();
            for (let level = 0; level < 4; level++) {
                for (let x = 0; x < 104; x++) {
                    for (let z = 0; z < 104; z++) arrayPutU8(arrayAtObj(arrayAtObj(ClientBuild.m_mapl, level), x), z, 0);
                }
            }
            AreaSoundManager.clear(false);
            if (renderer?.active) {
                const shadows = GroundShadowsClass;
                requireNonNull(shadows.shadowMap).clear();
                for (let x = 0; x < 13; x++) {
                    for (let z = 0; z < 13; z++) requireNonNull(arrayAtObj(arrayAtObj(shadows.blocks, x), z)).dirty = true;
                }
            }
            if (renderer?.active) PointLightManagerClass.clear();
            if (renderer?.active) loadEnvironment().resetGrid();
            AudioEngine.tick();
            globalThis.gc?.();
            Client.PreventTimeout(true);
            ClientBuild.Init(false);
            if (!Client.dynamicRegion) {
                Client.loadGroundRegions(false);
                Client.PreventTimeout(true);
                if (renderer?.active) {
                    const Environment = loadEnvironment();
                    const zoneX = arrayAtI32(requireNonNull(Client.localPlayer).pathX, 0) >> 3;
                    const zoneZ = arrayAtI32(requireNonNull(Client.localPlayer).pathZ, 0) >> 3;
                    Environment.setCurrent(zoneZ, zoneX);
                }
                Client.loadAllLocs(false);
                if (Client.mapBuildNpcData !== null) Client.spawnMapNpcs();
            }
            if (Client.dynamicRegion) {
                ClientBuild.loadDynamicGround(false);
                Client.PreventTimeout(true);
                if (renderer?.active) {
                    const Environment = loadEnvironment();
                    const zoneX = arrayAtI32(requireNonNull(Client.localPlayer).pathX, 0) >> 3;
                    const zoneZ = arrayAtI32(requireNonNull(Client.localPlayer).pathZ, 0) >> 3;
                    Environment.setCurrent(zoneZ, zoneX);
                }
                Client.mapBuildLocsDynamic(false);
            }
            Client.ResetCache();
            Client.PreventTimeout(true);
            ClientBuild.FinishBuild(CollisionMap.levelMaps, false);
            if (renderer?.active) PointLightManagerClass.buildGrid();
            Client.PreventTimeout(true);
            if (glJar) {
                let candidate = ClientBuild.minusedlevel;
                if (candidate > Client.playerLevel) candidate = Client.playerLevel;
                if (candidate < Client.playerLevel - 1) void Client.playerLevel;
            }
            world.FillBaseLevel(Preferences.getAllLevelsVisible() ? 0 : ClientBuild.minusedlevel);
            ClientBuild.Quit();
            if (renderer?.active && underwater) {
                world.setUnderwater(true);
                ClientBuild.Init(true);
                if (!Client.dynamicRegion) {
                    Client.loadGroundRegions(true);
                    Client.PreventTimeout(true);
                    Client.loadAllLocs(true);
                }
                if (Client.dynamicRegion) {
                    ClientBuild.loadDynamicGround(true);
                    Client.PreventTimeout(true);
                    Client.mapBuildLocsDynamic(true);
                }
                Client.ResetCache();
                Client.PreventTimeout(true);
                ClientBuild.FinishBuild(CollisionMap.levelMaps, true);
                Client.PreventTimeout(true);
                ClientBuild.Quit();
                world.setUnderwater(false);
            }
            if (renderer?.active) {
                const shadows = GroundShadowsClass;
                for (let x = 0; x < 13; x++) {
                    for (let z = 0; z < 13; z++) {
                        const block = arrayAtObj(arrayAtObj(shadows.blocks, x), z);
                        const heights = arrayAtObj(world.levelHeightmaps, 0);
                        requireNonNull(block).buildMesh(heights, x * 8, z * 8);
                    }
                }
            }
        } else {
            if (!requireNonNull(this.viewport).load(true)) return;
            ClientBuild.Quit();
        }
        for (let x = 0; x < 104; x++) {
            for (let z = 0; z < 104; z++) Client.ShowObject(z, x, glJar ? world : undefined, glJar ? 65 : 72);
        }
        if (SceneCutover.active) RoofModeStatics.applyRoofMode();
        AudioEngine.tick();
        Client.LocChangePostBuildCorrect();
        Client.ResetCache();
        if (glJar) world.modelsReleased = false;
        if (GameShell.frame !== null && Client.stream !== null && Client.gameState === 25) {
            Client.out.pHead(20);
            Client.out.p4(1057001181);
        }
        if (!Client.dynamicRegion) {
            let firstX: number, lastX: number, firstZ: number, lastZ: number;
            if (glJar) {
                lastZ = intDivide((Client.mapBuildCentreZoneZ + 6) | 0, 8);
                firstZ = intDivide((Client.mapBuildCentreZoneZ - 6) | 0, 8);
                firstX = intDivide((Client.mapBuildCentreZoneX - 6) | 0, 8);
                lastX = intDivide((Client.mapBuildCentreZoneX + 6) | 0, 8);
            } else {
                firstX = intDivide((Client.mapBuildCentreZoneX - 6) | 0, 8);
                lastX = intDivide((Client.mapBuildCentreZoneX + 6) | 0, 8);
                firstZ = intDivide((Client.mapBuildCentreZoneZ - 6) | 0, 8);
                lastZ = intDivide((Client.mapBuildCentreZoneZ + 6) | 0, 8);
            }
            for (let x = firstX - 1; x <= lastX + 1; x++) {
                for (let z = firstZ - 1; z <= lastZ + 1; z++) {
                    if (x >= firstX && x <= lastX && z >= firstZ && z <= lastZ) continue;
                    const groundArchive = Client.mapsArchive;
                    const groundName = JagString.join([Client.mapFilePrefix, JagString.fromInt(x), Client.mapNameSeparator, JagString.fromInt(z)]);
                    requireNonNull(groundArchive).UpdateCacheHint2(groundName);
                    const locArchive = Client.mapsArchive;
                    const locName = JagString.join([Client.locMapPrefix, JagString.fromInt(x), Client.mapNameSeparator, JagString.fromInt(z)]);
                    requireNonNull(locArchive).UpdateCacheHint2(locName);
                }
            }
        }
        if (Client.gameState === 28) Client.SetMainState(10);
        else {
            Client.SetMainState(30);
            if (Client.stream !== null) Client.out.pHead(110);
        }
        WorldMap.reopen();
        AudioEngine.tick();
        GameShell.DoneSlowUpdate();
    }

    // t.c(I)V. Client::GameLoop.
    async GameLoop(): Promise<void> {
        const game = this.game;
        if (Client.logoutTimer > 0) Client.logoutTimer--;
        if (Client.rebootTimer > 1) {
            Client.rebootTimer--;
            InterfaceList.miscTransmitAt = Client.transmitCycle;
        }
        if (Client.socketError) {
            Client.socketError = false;
            return Client.LostCon(game);
        }
        for (let i = 0; i < 100; i++) {
            const zoneX = Client.mapBuildCentreZoneX,
                zoneZ = Client.mapBuildCentreZoneZ,
                level = ClientBuild.buildLevel;
            if (!(await Protocol.tryReadPacket())) break;
            // The browser scene consumes the published region after each successful rebuild packet.
            if (game !== undefined && (glJar || this.viewport !== undefined) && (Protocol.lastPacketType0 === 162 || Protocol.lastPacketType0 === 214)) {
                const changed = zoneX !== Client.mapBuildCentreZoneX || zoneZ !== Client.mapBuildCentreZoneZ || level !== ClientBuild.buildLevel;
                game.refreshSceneRegion(changed);
            }
        }
        if (Client.gameState !== 30) return;
        ReflectionCheck.processChecks(163, Client.out);
        // t.c(I)V, 0x7c-0x403. There is no await inside the Java recorder's monitor.
        requireNonNull(requireNonNull(Client.mouseTracking).lock);
        if (!Client.mouseTracked) {
            requireNonNull(Client.mouseTracking).count = 0;
        } else if (ClientMouseListener.clickButton !== 0 || requireNonNull(Client.mouseTracking).count >= 40) {
            Client.out.pHead(123);
            Client.out.p1(0);
            const start = Client.out.m_pos;
            let processed = 0;
            for (let i = 0; i < requireNonNull(Client.mouseTracking).count; i++) {
                if (((Client.out.m_pos - start) | 0) >= 240) break;
                processed++;
                let y = arrayAtI32(requireNonNull(Client.mouseTracking).samplesY, i);
                if (y < 0) y = 0;
                else if (y > 65534) y = 65534;
                let x = arrayAtI32(requireNonNull(Client.mouseTracking).samplesX, i);
                let outside = false;
                if (x < 0) x = 0;
                else if (x > 65534) x = 65534;
                if (arrayAtI32(requireNonNull(Client.mouseTracking).samplesY, i) === -1 && arrayAtI32(requireNonNull(Client.mouseTracking).samplesX, i) === -1) {
                    y = -1;
                    x = -1;
                    outside = true;
                }
                if (Client.mouseTrackedX === x && Client.mouseTrackedY === y) {
                    if (Client.mouseRepeatCount < 2047) Client.mouseRepeatCount = (Client.mouseRepeatCount + 1) | 0;
                } else {
                    let dx = (x - Client.mouseTrackedX) | 0;
                    let dy = (y - Client.mouseTrackedY) | 0;
                    Client.mouseTrackedY = y;
                    Client.mouseTrackedX = x;
                    if (Client.mouseRepeatCount < 8 && dx >= -32 && dx <= 31 && dy >= -32 && dy <= 31) {
                        dx += 32;
                        dy += 32;
                        Client.out.p2(dy + (dx << 6) + (Client.mouseRepeatCount << 12));
                        Client.mouseRepeatCount = 0;
                    } else if (Client.mouseRepeatCount < 32 && dx >= -128 && dx <= 127 && dy >= -128 && dy <= 127) {
                        dx += 128;
                        dy += 128;
                        Client.out.p1(128 + Client.mouseRepeatCount);
                        Client.out.p2((dx << 8) + dy);
                        Client.mouseRepeatCount = 0;
                    } else if (Client.mouseRepeatCount < 32) {
                        Client.out.p1(Client.mouseRepeatCount + 192);
                        Client.out.p4(outside ? -2147483648 : (y << 16) | x);
                        Client.mouseRepeatCount = 0;
                    } else {
                        Client.out.p2(Client.mouseRepeatCount + 57344);
                        Client.out.p4(outside ? -2147483648 : (y << 16) | x);
                        Client.mouseRepeatCount = 0;
                    }
                }
            }
            const packet = Client.out;
            const size = (Client.out.m_pos - start) | 0;
            packet.pSize1(size);
            if (requireNonNull(Client.mouseTracking).count > processed) {
                const recorder = requireNonNull(Client.mouseTracking);
                recorder.count = (recorder.count - processed) | 0;
                for (let i = 0; i < requireNonNull(Client.mouseTracking).count; i++) {
                    arrayPutI32(requireNonNull(Client.mouseTracking).samplesX, i, arrayAtI32(requireNonNull(Client.mouseTracking).samplesX, (processed + i) | 0));
                    arrayPutI32(requireNonNull(Client.mouseTracking).samplesY, i, arrayAtI32(requireNonNull(Client.mouseTracking).samplesY, (processed + i) | 0));
                }
            } else requireNonNull(Client.mouseTracking).count = 0;
        }
        if (ClientMouseListener.clickButton !== 0) {
            let elapsed = BigInt.asIntN(64, -Client.prevMouseClickTime + ClientMouseListener.clickTime) / 50n;
            if (elapsed > 32767n) elapsed = 32767n;
            let x = ClientMouseListener.clickX;
            Client.prevMouseClickTime = ClientMouseListener.clickTime;
            if (x < 0) x = 0;
            else if (x > 65535) x = 65535;
            let y = ClientMouseListener.clickY;
            let right = 0;
            if (y < 0) y = 0;
            else if (y > 65535) y = 65535;
            const ticks = Number(BigInt.asIntN(32, elapsed));
            if (ClientMouseListener.clickButton === 2) right = 1;
            Client.out.pHead(75);
            Client.out.p2_alt3(ticks | (right << 15));
            Client.out.p4_alt3(x | (y << 16));
        }
        if (OrbitCamera.reportDelay > 0) OrbitCamera.reportDelay--;
        if (Preferences.steppedCameraKeys) {
            for (let i = 0; i < ClientKeyboardListener.count; i++) {
                const code = arrayAtI32(ClientKeyboardListener.codes, i);
                if (code === 98 || code === 99 || code === 96 || code === 97) {
                    OrbitCamera.reportPending = true;
                    break;
                }
            }
        } else if (arrayAtObj(ClientKeyboardListener.pressed, 96) || arrayAtObj(ClientKeyboardListener.pressed, 97) || arrayAtObj(ClientKeyboardListener.pressed, 98) || arrayAtObj(ClientKeyboardListener.pressed, 99)) {
            OrbitCamera.reportPending = true;
        }
        if (OrbitCamera.reportPending && OrbitCamera.reportDelay <= 0) {
            OrbitCamera.reportDelay = 20;
            OrbitCamera.reportPending = false;
            Client.out.pHead(21);
            Client.out.p2_alt2(OrbitCamera.followPitch);
            Client.out.p2_alt1(OrbitCamera.followYaw);
        }
        // t.c(I)V, 0x4c7-0x525.
        if (GameShell.m_focus && !Client.lastSentFocus) {
            Client.lastSentFocus = true;
            Client.out.pHead(22);
            Client.out.p1(1);
        }
        if (!GameShell.m_focus && Client.lastSentFocus) {
            Client.lastSentFocus = false;
            Client.out.pHead(22);
            Client.out.p1(0);
        }
        if (!Preferences.sent) {
            Client.out.pHead(98);
            Client.out.p4(Preferences.packPreferences());
            Preferences.sent = true;
        }
        if (SceneCutover.active) Client.GlCheckMinimap();
        else
            Client.GlCheckMinimap(level => {
                this.viewport?.minimap?.prepareNativeBuffer(level);
                return false;
            });
        if (Client.gameState !== 30) {
            if (game !== undefined) {
                if (game.rebuild !== null) game.rebuild = { ...game.rebuild, level: Client.playerLevel, localX: game.actors.self.pathX[0], localZ: game.actors.self.pathZ[0] };
                game.zone.clearScene();
            }
            return;
        }
        Client.LocChangeDoQueue();
        LocMergeQueue.processQueue();
        Client.GlDoSoundsQueue();
        Protocol.idleReads = (Protocol.idleReads + 1) | 0;
        if (Protocol.idleReads > 750) {
            return Client.LostCon(game);
        }
        Client.GlMovePlayers();
        Client.GlMoveNpcs();
        Client.GlTimeoutChat();
        if (WorldMap.component !== null) WorldMap.tick();
        for (let id = ClientVarCache.poll(true); id !== -1; id = ClientVarCache.poll(false)) {
            Client.ClientVar(id);
            const ring = Client.varpUpdates;
            const index = Client.varpTransmitCount;
            Client.varpTransmitCount = (index + 1) | 0;
            arrayPutI32(ring, index & 31, id);
        }
        for (let change = DelayedStateChange.poll(); change !== null; change = DelayedStateChange.poll()) {
            const type = change.type(),
                id = change.id();
            switch (type) {
                case 1: {
                    arrayPutI32(DelayedStateChange.varcs, id, change.value);
                    const ring = Client.updatedVarcs,
                        index = Client.varcChanges;
                    Client.varcChanges = (index + 1) | 0;
                    arrayPutI32(ring, index & 31, id);
                    break;
                }
                case 2: {
                    arrayPutObj(DelayedStateChange.varcStrings, id, change.text);
                    const ring = Client.updatedVarcStrings,
                        index = Client.varcStrChangeCount;
                    Client.varcStrChangeCount = (index + 1) | 0;
                    arrayPutI32(ring, index & 31, id);
                    break;
                }
                case 3: {
                    const component = IfType.Get(id);
                    const text = change.text;
                    const current = requireNonNull(component).textValue;
                    if (!requireNonNull(text).equals(current)) {
                        requireNonNull(component).textValue = requireNonNull(change.text);
                        Client.ComponentUpdated(requireNonNull(component));
                    }
                    break;
                }
                case 4: {
                    const component = IfType.Get(id);
                    const modelType = change.value,
                        modelId = change.value2,
                        thirdKit = change.value3;
                    const c = requireNonNull(component);
                    if (c.modelType !== modelType || c.modelId !== modelId || c.modelThirdKit !== thirdKit) {
                        c.modelThirdKit = thirdKit;
                        c.modelType = modelType;
                        c.modelId = modelId;
                        Client.ComponentUpdated(c);
                    }
                    break;
                }
                case 5: {
                    const c = requireNonNull(IfType.Get(id));
                    if (change.value !== c.modelAnim || change.value === -1) {
                        c.modelAnim = change.value;
                        c.modelNext = 1;
                        c.modelCycle = 0;
                        c.modelFrame = 0;
                        Client.ComponentUpdated(c);
                    }
                    break;
                }
                case 6: {
                    const value = change.value;
                    const red = (value >> 10) & 31,
                        green = (value & 1006) >> 5,
                        blue = value & 31;
                    const c = requireNonNull(IfType.Get(id));
                    const rgb = (blue << 3) + (red << 19) + (green << 11);
                    if (rgb !== c.colour) {
                        c.colour = rgb;
                        Client.ComponentUpdated(c);
                    }
                    break;
                }
                case 7: {
                    const c = requireNonNull(IfType.Get(id));
                    const hidden = change.value === 1;
                    if (c.hidden !== hidden) {
                        c.hidden = hidden;
                        Client.ComponentUpdated(c);
                    }
                    break;
                }
                case 8: {
                    const c = requireNonNull(IfType.Get(id));
                    if (change.value !== c.modelXAngle || change.value2 !== c.modelYAngle || c.modelZoom !== change.value3) {
                        c.modelYAngle = change.value2;
                        c.modelXAngle = change.value;
                        c.modelZoom = change.value3;
                        if (c.itemId !== -1) {
                            if (c.modelWidth > 0) c.modelZoom = ((c.modelZoom << 5) / c.modelWidth) | 0;
                            else if (c.baseWidth > 0) c.modelZoom = ((c.modelZoom << 5) / c.baseWidth) | 0;
                        }
                        Client.ComponentUpdated(c);
                    }
                    break;
                }
                case 9: {
                    const c = requireNonNull(IfType.Get(id));
                    if (c.itemId !== change.value || c.itemCount !== change.value2) {
                        c.itemId = change.value;
                        c.itemCount = change.value2;
                        Client.ComponentUpdated(c);
                    }
                    break;
                }
                case 10: {
                    const c = requireNonNull(IfType.Get(id));
                    if (c.modelOffsetX !== change.value || c.modelOffsetY !== change.value2 || change.value3 !== c.modelZAngle) {
                        c.modelOffsetX = change.value;
                        c.modelOffsetY = change.value2;
                        c.modelZAngle = change.value3;
                        Client.ComponentUpdated(c);
                    }
                    break;
                }
                case 11: {
                    const c = requireNonNull(IfType.Get(id));
                    c.y = c.baseY = change.value2;
                    c.x = c.baseX = change.value;
                    c.xMode = 0;
                    c.yMode = 0;
                    Client.ComponentUpdated(c);
                    break;
                }
                case 12: {
                    const c = IfType.Get(id);
                    let value = change.value;
                    if (c !== null && c.type === 0) {
                        if (value > ((c.scrollHeight - c.height) | 0)) value = (c.scrollHeight - c.height) | 0;
                        if (value < 0) value = 0;
                        if (value !== c.scrollY) {
                            c.scrollY = value;
                            Client.ComponentUpdated(c);
                        }
                    }
                    break;
                }
                case 13: {
                    requireNonNull(IfType.Get(id)).modelRotationSpeed = change.value;
                    break;
                }
            }
        }
        if (Minimenu.crossMode !== 0) {
            Minimenu.crossTicks = (Minimenu.crossTicks + 20) | 0;
            if (Minimenu.crossTicks >= 400) Minimenu.crossMode = 0;
        }
        AreaSoundManager.elapsed = (AreaSoundManager.elapsed + 1) | 0;
        if (Minimenu.highlightComponent !== null) {
            Minimenu.highlightTicks = (Minimenu.highlightTicks + 1) | 0;
            if (Minimenu.highlightTicks >= 15) {
                Client.ComponentUpdated(Minimenu.highlightComponent);
                Minimenu.highlightComponent = null;
            }
        }
        const ui = this.ui;
        const viewport = SceneCutover.active ? undefined : this.viewport;
        // A subinterface change can close a scene menu before a drag release opens a native one.
        if (viewport !== undefined && !Minimenu.isOpen) viewport.menu.showNative();
        const dragging = ComponentDrag.component !== null || Minimenu.objDragComponent !== null;
        if (Minimenu.objDragComponent !== null) {
            Client.ComponentUpdated(Minimenu.objDragComponent);
            if (
                ClientMouseListener.x > ((Minimenu.objGrabX + 5) | 0) ||
                ((Minimenu.objGrabX - 5) | 0) > ClientMouseListener.x ||
                ClientMouseListener.mouseY > ((Minimenu.objGrabY + 5) | 0) ||
                ((Minimenu.objGrabY - 5) | 0) > ClientMouseListener.mouseY
            ) {
                Minimenu.objDragMoved = true;
            }
            Minimenu.objDragCycles = (Minimenu.objDragCycles + 1) | 0;
            if (ClientMouseListener.mouseButton === 0) {
                if (Minimenu.objDragMoved && Minimenu.objDragCycles >= 5) {
                    if (Minimenu.objDragComponent === Client.hoveredSlotCom && Minimenu.hoverSlot !== Minimenu.objDragSlot) {
                        const component = requireNonNull(Minimenu.objDragComponent);
                        let insert = 0;
                        if (Client.bankArrangeMode === 1 && component.clientCode === 206) insert = 1;
                        if (arrayAtI32(component.itemIds, Minimenu.hoverSlot) <= 0) insert = 0;
                        if (Client.GetActive(component).canReplaceObj()) {
                            const from = Minimenu.objDragSlot,
                                to = Minimenu.hoverSlot;
                            arrayPutI32(component.itemIds, to, arrayAtI32(component.itemIds, from));
                            arrayPutI32(component.itemCounts, to, arrayAtI32(component.itemCounts, from));
                            arrayPutI32(component.itemIds, from, -1);
                            arrayPutI32(component.itemCounts, from, 0);
                        } else if (insert === 1) {
                            let from = Minimenu.objDragSlot;
                            const to = Minimenu.hoverSlot;
                            while (from !== to) {
                                if (to < from) {
                                    component.SwapSlots((from - 1) | 0, from);
                                    from = (from - 1) | 0;
                                } else if (to > from) {
                                    component.SwapSlots((from + 1) | 0, from);
                                    from = (from + 1) | 0;
                                }
                            }
                        } else {
                            component.SwapSlots(Minimenu.hoverSlot, Minimenu.objDragSlot);
                        }
                        Client.out.pHead(231);
                        Client.out.p2(Minimenu.objDragSlot);
                        Client.out.p4_alt1(requireNonNull(Minimenu.objDragComponent).id);
                        Client.out.p2_alt2(Minimenu.hoverSlot);
                        Client.out.p1_alt3(insert);
                    }
                } else if ((Client.m_usingOneButtonMouse === 1 || Minimenu.MenuOnly((Minimenu.count - 1) | 0)) && Minimenu.count > 2) {
                    Minimenu.Open();
                } else if (Minimenu.count > 0) {
                    const action = Minimenu.useTopOption(ui);
                    if (action instanceof Promise) await action;
                }
                Minimenu.highlightTicks = 10;
                Minimenu.objDragComponent = null;
                ClientMouseListener.clickButton = 0;
            }
        }
        ComponentDrag.visible = false;
        ComponentDrag.parentVisible = false;
        const oldHover = InterfaceList.mouseOverComponent;
        InterfaceList.mouseOverComponent = null;
        const oldTooltip = Client.tooltipComponent;
        ComponentDrag.target = null;
        Client.tooltipComponent = null;
        ClientKeyboardListener.count = 0;
        while (ClientKeyboardListener.next() && ClientKeyboardListener.count < 128) {
            arrayPutI32(ClientKeyboardListener.codes, ClientKeyboardListener.count, ClientKeyboardListener.keyCode);
            arrayPutI32(ClientKeyboardListener.chars, ClientKeyboardListener.count, ClientKeyboardListener.keyChar);
            ClientKeyboardListener.count = (ClientKeyboardListener.count + 1) | 0;
        }
        WorldMap.component = null;
        if (InterfaceList.top !== -1) {
            const traversal = Client.LoopInterface(InterfaceList.top, 0, 0, GameShell.m_sWid, GameShell.m_sHei, 0, 0);
            if (traversal instanceof Promise) await traversal;
        }
        Client.transmitCycle = (Client.transmitCycle + 1) | 0;
        for (let event = requireNonNull(Client.timerEvents).takeFrontAndPop(); event !== null; event = requireNonNull(Client.timerEvents).takeFrontAndPop()) {
            if (!(event instanceof HookReq)) throw new TypeError('ClassCastException: not a HookReq');
            const component = requireNonNull(event.component);
            if (component.childId >= 0) {
                const parent = IfType.Get(component.parentId);
                if (parent === null || parent.childSlots === null || component.childId >= parent.childSlots.length || arrayAtObj(parent.childSlots, component.childId) !== component) continue;
            }
            const hook = (this.ui?.runner ?? new ScriptRunner(ClientScript.Get)).run(event);
            if (hook instanceof Promise) await hook;
        }
        for (let event = requireNonNull(Client.mouseExit).takeFrontAndPop(); event !== null; event = requireNonNull(Client.mouseExit).takeFrontAndPop()) {
            if (!(event instanceof HookReq)) throw new TypeError('ClassCastException: not a HookReq');
            const component = requireNonNull(event.component);
            if (component.childId >= 0) {
                const parent = IfType.Get(component.parentId);
                if (parent === null || parent.childSlots === null || component.childId >= parent.childSlots.length || arrayAtObj(parent.childSlots, component.childId) !== component) continue;
            }
            const hook = (this.ui?.runner ?? new ScriptRunner(ClientScript.Get)).run(event);
            if (hook instanceof Promise) await hook;
        }
        for (let event = requireNonNull(Client.m_hookQueue).takeFrontAndPop(); event !== null; event = requireNonNull(Client.m_hookQueue).takeFrontAndPop()) {
            if (!(event instanceof HookReq)) throw new TypeError('ClassCastException: not a HookReq');
            const component = requireNonNull(event.component);
            if (component.childId >= 0) {
                const parent = IfType.Get(component.parentId);
                if (parent === null || parent.childSlots === null || component.childId >= parent.childSlots.length || arrayAtObj(parent.childSlots, component.childId) !== component) continue;
            }
            const hook = (this.ui?.runner ?? new ScriptRunner(ClientScript.Get)).run(event);
            if (hook instanceof Promise) await hook;
        }
        if (WorldMap.component === null) WorldMap.dragging = 0;
        if (ComponentDrag.component !== null) {
            const drag = Client.LoopIf3Drag(ui?.runner, ui);
            if (drag instanceof Promise) await drag;
        }
        // t.c(I)V, 0xe07..0xfd7.
        if (Client.staffModLevel > 0 && arrayAtObj(ClientKeyboardListener.pressed, 82) && arrayAtObj(ClientKeyboardListener.pressed, 81) && MouseWheel.rotation !== 0) {
            let level = (Client.playerLevel - MouseWheel.rotation) | 0;
            if (level < 0) level = 0;
            else if (level > 3) level = 3;
            WorldMap.teleport((Client.mapBuildBaseX + arrayAtI32(requireNonNull(Client.localPlayer).pathX, 0)) | 0, (arrayAtI32(requireNonNull(Client.localPlayer).pathZ, 0) + Client.mapBuildBaseZ) | 0, level);
        }
        if (Client.staffModLevel > 0 && arrayAtObj(ClientKeyboardListener.pressed, 82) && arrayAtObj(ClientKeyboardListener.pressed, 81)) {
            if (world.groundX !== -1) {
                WorldMap.teleport((Client.mapBuildBaseX + world.groundX) | 0, (Client.mapBuildBaseZ + world.groundZ) | 0, Client.playerLevel);
            }
            Client.walkClickStage = 0;
            Client.targetTileState = 0;
        } else if (Client.targetTileState === 2) {
            if (world.groundX !== -1) {
                Client.out.pHead(131);
                Client.out.p4_alt3(Minimenu.targetComponent);
                Client.out.p2_alt2((Client.mapBuildBaseX + world.groundX) | 0);
                Client.out.p2_alt3(Minimenu.targetChild);
                Client.out.p2_alt2((Client.mapBuildBaseZ + world.groundZ) | 0);
                Minimenu.crossMode = 1;
                Minimenu.crossTicks = 0;
                Minimenu.crossX = ClientMouseListener.clickX;
                Minimenu.crossY = ClientMouseListener.clickY;
            }
            Client.targetTileState = 0;
        } else if (Client.walkClickStage === 2) {
            if (world.groundX !== -1) {
                Client.out.pHead(179);
                Client.out.p2((world.groundZ + Client.mapBuildBaseZ) | 0);
                Client.out.p2((Client.mapBuildBaseX + world.groundX) | 0);
                Minimenu.crossTicks = 0;
                Minimenu.crossY = ClientMouseListener.clickY;
                Minimenu.crossMode = 1;
                Minimenu.crossX = ClientMouseListener.clickX;
            }
            Client.walkClickStage = 0;
        } else if (world.groundX !== -1 && Client.targetTileState === 0 && Client.walkClickStage === 0) {
            if (RouteFinding.FindRoute(0, world.groundZ, world.groundX, 0, true, 0, 0, arrayAtI32(requireNonNull(Client.localPlayer).pathZ, 0), 0, 0, arrayAtI32(requireNonNull(Client.localPlayer).pathX, 0))) {
                Minimenu.crossY = ClientMouseListener.clickY;
                Minimenu.crossX = ClientMouseListener.clickX;
                Minimenu.crossMode = 1;
                Minimenu.crossTicks = 0;
            }
        }
        world.groundX = -1;
        viewport?.tick();
        const button = ClientMouseListener.clickButton;
        let menu: void | Promise<void> = undefined;
        if (viewport?.menu.sceneMenuOpen) {
            if (button !== 1) menu = viewport.menu.checkBounds(ClientMouseListener.x, ClientMouseListener.mouseY);
            else if (!dragging && ComponentDrag.component === null) menu = viewport.menu.click(ClientMouseListener.clickX, ClientMouseListener.clickY);
        } else if (viewport !== undefined && !Minimenu.isOpen && (button === 1 || button === 2) && !dragging && ComponentDrag.component === null && Minimenu.deferred === 0 && ui?.isSceneClick(ClientMouseListener.clickX, ClientMouseListener.clickY)) {
            menu = viewport.select(ClientMouseListener.clickX, ClientMouseListener.clickY, arrayAtObj(ClientKeyboardListener.pressed, 82), button === 2);
        } else {
            menu = Minimenu.GameLoop(ui);
        }
        if (menu instanceof Promise) await menu;
        if (InterfaceList.mouseOverComponent !== oldHover) {
            if (oldHover !== null) Client.ComponentUpdated(oldHover);
            if (InterfaceList.mouseOverComponent !== null) Client.ComponentUpdated(InterfaceList.mouseOverComponent);
        }
        if (Client.tooltipComponent !== oldTooltip && Client.tooltipTimer === InterfaceList.tooltipDelay) {
            if (oldTooltip !== null) Client.ComponentUpdated(oldTooltip);
            if (Client.tooltipComponent !== null) Client.ComponentUpdated(Client.tooltipComponent);
        }
        if (Client.tooltipComponent === null) {
            if (Client.tooltipTimer > 0) Client.tooltipTimer = (Client.tooltipTimer - 1) | 0;
        } else if (Client.tooltipTimer < InterfaceList.tooltipDelay) {
            Client.tooltipTimer = (Client.tooltipTimer + 1) | 0;
            if (Client.tooltipTimer === InterfaceList.tooltipDelay) Client.ComponentUpdated(Client.tooltipComponent);
        }
        if (OrbitCamera.mode === 1) Client.GlFollowCamera();
        else if (OrbitCamera.mode === 2) Client.GlCinemaCamera();
        else CinematicCamera.spline();
        for (let axis = 0; axis < 5; axis++) {
            arrayPutI32(OrbitCamera.shakePhase, axis, (arrayAtI32(OrbitCamera.shakePhase, axis) + 1) | 0);
        }
        // t.c(I)V, 0x10b5..0x10f6
        const mouseIdle = ClientMouseListener.getIdleCycles();
        const keyIdle = ClientKeyboardListener.getIdleCycles();
        if (mouseIdle > 15000 && keyIdle > 15000) {
            Client.logoutTimer = 250;
            ClientMouseListener.setIdleCycles(14500);
            Client.out.pHead(245);
        }
        Client.pollUrlRequest(false);
        Client.m_ticksSinceNoTimeOutPacket = (Client.m_ticksSinceNoTimeOutPacket + 1) | 0;
        OrbitCamera.driftTicks = (OrbitCamera.driftTicks + 1) | 0;
        OrbitCamera.minimapTicks = (OrbitCamera.minimapTicks + 1) | 0;
        if (OrbitCamera.driftTicks > 500) {
            const mask = (mathRandom.nextDouble() * 8) | 0;
            if (mask & 2) OrbitCamera.followOffsetZ = (OrbitCamera.followOffsetZ + OrbitCamera.driftZ) | 0;
            OrbitCamera.driftTicks = 0;
            if (mask & 1) OrbitCamera.followOffsetX = (OrbitCamera.followOffsetX + OrbitCamera.driftX) | 0;
            if (mask & 4) OrbitCamera.yawOffset = (OrbitCamera.yawOffset + OrbitCamera.driftYaw) | 0;
        }
        if (OrbitCamera.followOffsetX < -50) OrbitCamera.driftX = 2;
        if (OrbitCamera.followOffsetX > 50) OrbitCamera.driftX = -2;
        if (OrbitCamera.minimapTicks > 500) {
            const mask = (8 * mathRandom.nextDouble()) | 0;
            if (mask & 1) OrbitCamera.minimapAngle = (OrbitCamera.minimapAngle + OrbitCamera.driftAngle) | 0;
            OrbitCamera.minimapTicks = 0;
            if (mask & 2) OrbitCamera.minimapZoom = (OrbitCamera.minimapZoom + OrbitCamera.driftZoom) | 0;
        }
        if (OrbitCamera.yawOffset < -40) OrbitCamera.driftYaw = 1;
        if (OrbitCamera.minimapAngle < -60) OrbitCamera.driftAngle = 2;
        if (OrbitCamera.yawOffset > 40) OrbitCamera.driftYaw = -1;
        if (OrbitCamera.minimapZoom < -20) OrbitCamera.driftZoom = 1;
        if (OrbitCamera.followOffsetZ < -55) OrbitCamera.driftZ = 2;
        if (OrbitCamera.followOffsetZ > 55) OrbitCamera.driftZ = -2;
        if (OrbitCamera.minimapZoom > 10) OrbitCamera.driftZoom = -1;
        if (OrbitCamera.minimapAngle > 60) OrbitCamera.driftAngle = -2;
        if (Client.m_ticksSinceNoTimeOutPacket > 50) Client.out.pHead(93);
        if (Protocol.sequenceAckPending) {
            Client.sendVerifyId();
            Protocol.sequenceAckPending = false;
        }
        const stream = Client.stream;
        if (stream !== null && Client.out.m_pos > 0) {
            try {
                stream.Write(0, Client.out.m_data, Client.out.m_pos);
                Client.out.m_pos = 0;
                Client.m_ticksSinceNoTimeOutPacket = 0;
            } catch (error) {
                if (!(error instanceof SocketIoError)) throw error;
                return Client.LostCon(game);
            }
        }
    }

    // client.g(B)V. TitleScreen::Loop in NXT.
    private titleLoop(): void | Promise<void> {
        return runToCompletion(
            (function* (client: Client): Generator<Promise<void>, void, void> {
                ClientKeyboardListener.count = 0;
                while (ClientKeyboardListener.next() && ClientKeyboardListener.count < 128) {
                    arrayPutI32(ClientKeyboardListener.codes, ClientKeyboardListener.count, ClientKeyboardListener.keyCode);
                    arrayPutI32(ClientKeyboardListener.chars, ClientKeyboardListener.count, ClientKeyboardListener.keyChar);
                    ClientKeyboardListener.count = (ClientKeyboardListener.count + 1) | 0;
                }
                AreaSoundManager.elapsed = (AreaSoundManager.elapsed + 1) | 0;
                if (InterfaceList.top !== -1) {
                    let height: number, width: number, top: number;
                    if (glJar) {
                        width = GameShell.m_sWid;
                        top = InterfaceList.top;
                        height = GameShell.m_sHei;
                    } else {
                        height = GameShell.m_sHei;
                        width = GameShell.m_sWid;
                        top = InterfaceList.top;
                    }
                    const traversal = Client.LoopInterface(top, 0, 0, width, height, 0, 0);
                    if (traversal instanceof Promise) yield traversal;
                }
                Client.transmitCycle = (Client.transmitCycle + 1) | 0;
                // HD client.d(B)V @ the title, before queued interface hooks.
                if (client.standaloneWorldMap) {
                    if (WorldMap.component !== null) WorldMap.tick();
                } else if (glJar && GlRendererClass.active) {
                    const blocked = 19137023;
                    npcs: for (let i = 0; i < 32768; i++) {
                        const npc = arrayAtObj(Client.npcs, i);
                        if (npc === null) continue;
                        const flags = requireNonNull(npc.npcType).movementFlags;
                        if ((flags & 2) > 0 && npc.pathLength === 0 && 10 > mathRandom.nextDouble() * 1000) {
                            const dx = Math.round(-1 + 2 * mathRandom.nextDouble()) | 0;
                            const dz = Math.round(mathRandom.nextDouble() * 2 - 1) | 0;
                            if (dx !== 0 || dz !== 0) {
                                arrayPutI8(npc.pathSpeed, 0, 1);
                                arrayPutI32(npc.pathX, 0, (dx + (npc.x >> 7)) | 0);
                                arrayPutI32(npc.pathZ, 0, (dz + (npc.z >> 7)) | 0);
                                const removal = arrayAtObj(CollisionMap.levelMaps, Client.playerLevel);
                                const oldX = npc.x >> 7,
                                    width = npc.getSize(),
                                    length = npc.getSize(),
                                    oldZ = npc.z >> 7;
                                requireNonNull(removal).delLoc(oldX, oldZ, width, length, 0, false);
                                if (arrayAtI32(npc.pathX, 0) >= 0 && arrayAtI32(npc.pathX, 0) <= ((104 - npc.getSize()) | 0) && arrayAtI32(npc.pathZ, 0) >= 0 && arrayAtI32(npc.pathZ, 0) <= ((104 - npc.getSize()) | 0)) {
                                    const route = arrayAtObj(CollisionMap.levelMaps, Client.playerLevel);
                                    const z = npc.z >> 7,
                                        targetZ = arrayAtI32(npc.pathZ, 0),
                                        targetX = arrayAtI32(npc.pathX, 0),
                                        x = npc.x >> 7;
                                    if (requireNonNull(route).canTravelInStraightLine(z, targetZ, targetX, x)) {
                                        if (npc.getSize() > 1) {
                                            for (let x = arrayAtI32(npc.pathX, 0); x < ((arrayAtI32(npc.pathX, 0) + npc.getSize()) | 0); x++) {
                                                for (let z = arrayAtI32(npc.pathZ, 0); z < ((arrayAtI32(npc.pathZ, 0) + npc.getSize()) | 0); z++) {
                                                    if ((blocked & arrayAtI32(arrayAtObj(requireNonNull(arrayAtObj(CollisionMap.levelMaps, Client.playerLevel)).flags, x), z)) !== 0) continue npcs;
                                                }
                                            }
                                        }
                                        npc.pathLength = 1;
                                    }
                                }
                            }
                        }
                        Client.GlRouteMove(npc);
                        Client.GlEntityFace(npc);
                        Client.GlEntityAnim(npc);
                        const placement = arrayAtObj(CollisionMap.levelMaps, Client.playerLevel);
                        const x = npc.x >> 7,
                            z = npc.z >> 7,
                            width = npc.getSize(),
                            length = npc.getSize();
                        requireNonNull(placement).addLoc(x, z, width, length, false);
                    }
                }
                if (glJar && GlRendererClass.active) {
                    if (Client.loginStep === 0 && AccountCreation.step === 0) {
                        if (OrbitCamera.mode === 2) Client.GlCinemaCamera();
                        else CinematicCamera.spline();
                        if (OrbitCamera.x >> 7 < 14 || OrbitCamera.x >> 7 >= 90 || OrbitCamera.z >> 7 < 14 || OrbitCamera.z >> 7 >= 90) Client.setupTitleRegion();
                    }
                } else {
                    TitleFlames.tick();
                }
                for (let event = requireNonNull(Client.timerEvents).takeFrontAndPop(); event !== null; event = requireNonNull(Client.timerEvents).takeFrontAndPop()) {
                    if (!(event instanceof HookReq)) throw new TypeError('ClassCastException: not a HookReq');
                    const component = requireNonNull(event.component);
                    if (component.childId >= 0) {
                        const parent = IfType.Get(component.parentId);
                        if (parent === null || parent.childSlots === null || component.childId >= parent.childSlots.length || arrayAtObj(parent.childSlots, component.childId) !== component) continue;
                    }
                    const hook = (client.ui?.runner ?? new ScriptRunner(ClientScript.Get)).run(event);
                    if (hook instanceof Promise) yield hook;
                }
                for (let event = requireNonNull(Client.mouseExit).takeFrontAndPop(); event !== null; event = requireNonNull(Client.mouseExit).takeFrontAndPop()) {
                    if (!(event instanceof HookReq)) throw new TypeError('ClassCastException: not a HookReq');
                    const component = requireNonNull(event.component);
                    if (component.childId >= 0) {
                        const parent = IfType.Get(component.parentId);
                        if (parent === null || parent.childSlots === null || component.childId >= parent.childSlots.length || arrayAtObj(parent.childSlots, component.childId) !== component) continue;
                    }
                    const hook = (client.ui?.runner ?? new ScriptRunner(ClientScript.Get)).run(event);
                    if (hook instanceof Promise) yield hook;
                }
                for (let event = requireNonNull(Client.m_hookQueue).takeFrontAndPop(); event !== null; event = requireNonNull(Client.m_hookQueue).takeFrontAndPop()) {
                    if (!(event instanceof HookReq)) throw new TypeError('ClassCastException: not a HookReq');
                    const component = requireNonNull(event.component);
                    if (component.childId >= 0) {
                        const parent = IfType.Get(component.parentId);
                        if (parent === null || parent.childSlots === null || component.childId >= parent.childSlots.length || arrayAtObj(parent.childSlots, component.childId) !== component) continue;
                    }
                    const hook = (client.ui?.runner ?? new ScriptRunner(ClientScript.Get)).run(event);
                    if (hook instanceof Promise) yield hook;
                }
                if (ComponentDrag.component !== null) {
                    const drag = Client.LoopIf3Drag(client.ui?.runner, client.ui);
                    if (drag instanceof Promise) yield drag;
                }
                Client.pollUrlRequest(true);
                if (Client.loopCycle % 1500 === 0) Client.refreshToolbar();
            })(this)
        );
    }

    static readonly jsZap = fromLiteral('zap'); // gf.bb:Lid;
    static readonly jsUnzap = fromLiteral('unzap'); // fl.a:Lid;

    private completeLogin(rebuild: Rebuild | null): void {
        let account: GameSession['account'];
        if (rebuild === null) {
            account = null;
        } else {
            account = {
                staffModLevel: Client.staffModLevel,
                playerModLevel: Client.blackmarks,
                underage: Client.underage,
                parentalChatConsent: Client.parentalChatConsent,
                parentalAdvertConsent: Client.parentalAdvertConsent,
                quickChat: Client.mapQuickChat,
                mouseRecorder: Client.mouseTracked,
                playerId: Client.localPid,
                member: Client.playerMember,
                mapMembers: Client.members
            };
        }
        this.pendingLoginSession = { outgoing: Client.out, account, rebuild };
    }

    // le.a(I)V. Client::LoginPoll in projects/osclient/client_network.cpp:9.
    async LoginPoll(): Promise<void> {
        if (this.login.ticking || Client.loginStep === 0 || Client.loginStep === 5) return;
        this.login.ticking = true;
        const generation = this.login.generation;
        try {
            Login.loops = (Login.loops + 1) | 0;
            if (Login.loops > 2000) {
                if (Client.stream !== null) {
                    Client.stream.Close();
                    Client.stream = null;
                }
                if (Client.loginRetryCount >= 1) {
                    Client.loginStep = 0;
                    Login.reply = -5;
                    return;
                }
                Client.currentPort = Client.currentPort === Client.primaryPort ? Client.secondaryPort : Client.primaryPort;
                Client.loginStep = 1;
                Login.loops = 0;
                Client.loginRetryCount = (Client.loginRetryCount + 1) | 0;
            }
            if (Client.loginStep === 1) {
                if (Client.socketRequest !== null) discardSocket(Client.socketRequest);
                Client.socketRequest = requireNonNull(GameShell.signlink).openSocket(Client.gameHost, Client.currentPort);
                Client.loginStep = 2;
            }
            if (Client.loginStep === 2) {
                if (requireNonNull(Client.socketRequest).status === 2) throw new SocketIoError('Socket open failed');
                if (requireNonNull(Client.socketRequest).status !== 1) return;
                Client.stream = new ClientStream(requireNonNull(requireNonNull(Client.socketRequest).result), GameShell.signlink);
                Client.socketRequest = null;
                const name = (clientErrorHost.username = requireNonNull(Client.username).toBase37());
                Client.out.m_pos = 0;
                Client.out.p1(14);
                Client.out.p1(Number((name >> 16n) & 31n));
                requireNonNull(Client.stream).Write(0, Client.out.m_data, 2);
                AudioEngine.musicPlayer?.DoneUpdate();
                AudioEngine.effectsPlayer?.DoneUpdate();
                const status = await requireNonNull(Client.stream).read();
                if (generation !== this.login.generation) return;
                AudioEngine.musicPlayer?.DoneUpdate();
                AudioEngine.effectsPlayer?.DoneUpdate();
                if (status !== 0) {
                    Login.reply = status;
                    Client.loginStep = 0;
                    requireNonNull(Client.stream).Close();
                    Client.stream = null;
                    return;
                }
                Client.loginStep = 3;
            }
            if (Client.loginStep === 3) {
                if (requireNonNull(Client.stream).GetAvailable(-84) < 8) return;
                await requireNonNull(Client.stream).Read(Protocol.inPacket.m_data, 0, 8);
                if (generation !== this.login.generation) return;
                Protocol.inPacket.m_pos = 0;
                Login.serverKey = Protocol.inPacket.g8();
                const seed = Int32Array.of(0, 0, Number(BigInt.asIntN(32, Login.serverKey >> 32n)), Number(BigInt.asIntN(32, Login.serverKey)));
                if (glJar) {
                    seed[1] = (mathRandom.nextDouble() * 99999999) | 0;
                    seed[0] = (mathRandom.nextDouble() * 99999999) | 0;
                } else {
                    seed[0] = (mathRandom.nextDouble() * 99999999) | 0;
                    seed[1] = (mathRandom.nextDouble() * 99999999) | 0;
                }
                Client.out.m_pos = 0;
                Client.out.p1(10);
                Client.out.p4(seed[0]);
                Client.out.p4(seed[1]);
                Client.out.p4(seed[2]);
                Client.out.p4(seed[3]);
                Client.out.p8(requireNonNull(Client.username).toBase37());
                Client.out.pStringNoConversion(requireNonNull(Client.password), 0);
                Client.out.rsaEncrypt(Client.rsaExponent, Login.rsaModulus);
                Client.loginout.m_pos = 0;
                Client.loginout.p1(Client.gameState === 40 ? 18 : 16);
                Client.loginout.p2((159 + Client.out.m_pos + PacketT.pjstrLength(requireNonNull(Client.settings))) | 0);
                Client.loginout.p4(530);
                Client.loginout.p1(Login.loginType);
                Client.loginout.p1(Client.advertSuppressed ? 1 : 0);
                // SD le.a(I)V writes 0; HD ri.a(B)V writes 1 in every window mode.
                Client.loginout.p1(glJar ? 1 : 0);
                Client.loginout.p1(Client.getWindowMode());
                Client.loginout.p2(GameShell.m_sWid);
                Client.loginout.p2(GameShell.m_sHei);
                Client.loginout.p1(Preferences.currentAntiAliasingMode);
                Client.writeUid(Client.loginout);
                Client.loginout.pStringNoConversion(requireNonNull(Client.settings), 0);
                Client.loginout.p4(Client.affiliateId);
                Client.loginout.p4(Preferences.packPreferences());
                Preferences.sent = true;
                Client.loginout.p2(Client.verifyId);
                Client.loginout.p4(requireNonNull(Client.animFramesArchive).GetIndexCrc());
                Client.loginout.p4(requireNonNull(Client.basesArchive).GetIndexCrc());
                Client.loginout.p4(requireNonNull(Client.configArchive).GetIndexCrc());
                Client.loginout.p4(requireNonNull(Client.interfacesArchive).GetIndexCrc());
                Client.loginout.p4(requireNonNull(Client.m_pJagFx).GetIndexCrc());
                Client.loginout.p4(requireNonNull(Client.mapsArchive).GetIndexCrc());
                Client.loginout.p4(requireNonNull(Client.m_pMidi).GetIndexCrc());
                Client.loginout.p4(requireNonNull(Client.modelsArchive).GetIndexCrc());
                Client.loginout.p4(requireNonNull(Client.m_pSprites).GetIndexCrc());
                Client.loginout.p4(requireNonNull(Client.texturesArchive).GetIndexCrc());
                Client.loginout.p4(requireNonNull(Client.binaryArchive).GetIndexCrc());
                Client.loginout.p4(requireNonNull(Client.jingleArchive).GetIndexCrc());
                Client.loginout.p4(requireNonNull(Client.m_pClientScripts).GetIndexCrc());
                Client.loginout.p4(requireNonNull(Client.fontMetricsArchive).GetIndexCrc());
                Client.loginout.p4(requireNonNull(Client.vorbisArchive).GetIndexCrc());
                Client.loginout.p4(requireNonNull(Client.instrumentsArchive).GetIndexCrc());
                Client.loginout.p4(requireNonNull(Client.locConfigArchive).GetIndexCrc());
                Client.loginout.p4(requireNonNull(Client.enumsArchive).GetIndexCrc());
                Client.loginout.p4(requireNonNull(Client.npcConfigArchive).GetIndexCrc());
                Client.loginout.p4(requireNonNull(Client.objConfigArchive).GetIndexCrc());
                Client.loginout.p4(requireNonNull(Client.seqConfigArchive).GetIndexCrc());
                Client.loginout.p4(requireNonNull(Client.spotTypeArchive).GetIndexCrc());
                Client.loginout.p4(requireNonNull(Client.varBitArchive).GetIndexCrc());
                Client.loginout.p4(requireNonNull(Client.worldMapArchive).GetIndexCrc());
                Client.loginout.p4(requireNonNull(Client.quickChatArchive).GetIndexCrc());
                Client.loginout.p4(requireNonNull(Client.quickChatGlobalArchive).GetIndexCrc());
                Client.loginout.p4(requireNonNull(Client.materialsArchive).GetIndexCrc());
                Client.loginout.p4(requireNonNull(Client.js5Archive27).GetIndexCrc());
                Client.loginout.pArrayBuffer(Client.out.m_data, Client.out.m_pos, 0);
                requireNonNull(Client.stream).Write(0, Client.loginout.m_data, Client.loginout.m_pos);
                Client.out.SetEnc(seed);
                for (let i = 0; i < 4; i++) seed[i] = (seed[i] + 50) | 0;
                Protocol.inPacket.SetEnc(seed);
                Client.loginStep = 4;
            }
            if (Client.loginStep === 4) {
                if (requireNonNull(Client.stream).GetAvailable(-60) < 1) return;
                const response = await requireNonNull(Client.stream).read();
                if (generation !== this.login.generation) return;
                if (response === 21) Client.loginStep = 7;
                else if (response === 29) Client.loginStep = 10;
                else if (response === 1) {
                    Client.loginStep = 5;
                    Login.reply = 1;
                    return;
                } else if (response === 2) Client.loginStep = 8;
                else if (response === 15) {
                    Client.loginStep = 0;
                    Login.reply = response;
                    if (Client.gameState === 40) this.completeLogin(null);
                    return;
                } else if (response === 23 && Client.loginRetryCount < 1) {
                    Client.loginRetryCount = (Client.loginRetryCount + 1) | 0;
                    Login.loops = 0;
                    Client.loginStep = 1;
                    requireNonNull(Client.stream).Close();
                    Client.stream = null;
                    return;
                } else {
                    Login.reply = response;
                    Client.loginStep = 0;
                    requireNonNull(Client.stream).Close();
                    Client.stream = null;
                    return;
                }
            }
            if (Client.loginStep === 6) {
                Client.out.m_pos = 0;
                Client.out.pHead(17);
                requireNonNull(Client.stream).Write(0, Client.out.m_data, Client.out.m_pos);
                Client.loginStep = 4;
                return;
            }
            if (Client.loginStep === 7) {
                if (requireNonNull(Client.stream).GetAvailable(125) < 1) return;
                const delay = await requireNonNull(Client.stream).read();
                if (generation !== this.login.generation) return;
                Login.hopTime = (Math.imul(delay, 60) + 180) | 0;
                Client.loginStep = 0;
                Login.reply = 21;
                requireNonNull(Client.stream).Close();
                Client.stream = null;
                return;
            }
            if (Client.loginStep === 10) {
                if (requireNonNull(Client.stream).GetAvailable(-21) < 1) return;
                const reason = await requireNonNull(Client.stream).read();
                if (generation !== this.login.generation) return;
                Login.disallowResult = reason;
                Login.reply = 29;
                Client.loginStep = 0;
                requireNonNull(Client.stream).Close();
                Client.stream = null;
                return;
            }
            if (Client.loginStep === 8) {
                if (requireNonNull(Client.stream).GetAvailable(-91) < 14) return;
                await requireNonNull(Client.stream).Read(Protocol.inPacket.m_data, 0, 14);
                if (generation !== this.login.generation) return;
                Protocol.inPacket.m_pos = 0;
                Client.staffModLevel = Protocol.inPacket.g1();
                Client.blackmarks = Protocol.inPacket.g1();
                Client.underage = Protocol.inPacket.g1() === 1;
                Client.parentalChatConsent = Protocol.inPacket.g1() === 1;
                Client.parentalAdvertConsent = Protocol.inPacket.g1() === 1;
                Client.mapQuickChat = Protocol.inPacket.g1() === 1;
                Client.mouseTracked = Protocol.inPacket.g1() === 1;
                Client.localPid = Protocol.inPacket.g2();
                Client.playerMember = Protocol.inPacket.g1() === 1;
                Client.members = Protocol.inPacket.g1() === 1;
                LocType.setMembers(Client.members);
                ObjType.SwitchMembers(Client.members);
                if (!Client.advertSuppressed) {
                    const unzap = (!Client.underage || Client.parentalAdvertConsent) && !Client.playerMember;
                    try {
                        const applet = requireNonNull(GameShell.signlink).applet as Pick<JagStringApplet, 'call'> | null;
                        if (unzap) Client.jsUnzap.callScript(applet, glJar ? -1857 : -119);
                        else Client.jsZap.callScript(applet, glJar ? -1857 : -90);
                    } catch {
                        // The original client ignores failures from this host operation.
                    }
                }
                Protocol.packetType = Protocol.inPacket.g1Enc();
                Protocol.packetSize = Protocol.inPacket.g2();
                Client.loginStep = 9;
            }
            if (Client.loginStep === 9) {
                if (requireNonNull(Client.stream).GetAvailable(-94) < Protocol.packetSize) return;
                Protocol.inPacket.m_pos = 0;
                await requireNonNull(Client.stream).Read(Protocol.inPacket.m_data, 0, Protocol.packetSize);
                if (generation !== this.login.generation) return;
                Login.reply = 2;
                Client.loginStep = 0;
                const reset = Client.resetGame();
                if (reset instanceof Promise) await reset;
                Client.mapBuildCentreZoneX = -1; // le.a(I)V, before the first ac.a(ZZ)V call
                Client.RebuildPacket(false);
                Protocol.packetType = -1;
                this.completeLogin(captureSceneRegion());
            }
        } catch (error) {
            if (generation !== this.login.generation) return;
            if (!(error instanceof SocketIoError)) throw error;
            if (Client.stream !== null) {
                Client.stream.Close();
                Client.stream = null;
            }
            if (Client.loginRetryCount >= 1) {
                Login.reply = -4;
                Client.loginStep = 0;
            } else {
                Client.currentPort = Client.currentPort === Client.primaryPort ? Client.secondaryPort : Client.primaryPort;
                Login.loops = 0;
                Client.loginStep = 1;
                Client.loginRetryCount = (Client.loginRetryCount + 1) | 0;
            }
        } finally {
            this.login.ticking = false;
        }
    }

    // SD client.a(I)V / HD client.a(B)V.
    protected async MainLoop(): Promise<void> {
        if (this.closed || Client.gameState === 1000) return;
        try {
            Client.loopCycle = (Client.loopCycle + 1) | 0;
            if (Client.loopCycle % 1000 === 1) {
                const calendar = new Date();
                Minimenu.tooltipSeed = calendar.getHours() * 600 + 10 * calendar.getMinutes() + ((calendar.getSeconds() / 6) | 0);
                Minimenu.tooltipRandom.setSeed(BigInt(Minimenu.tooltipSeed));
            }
            await this.js5Tick();
            if (this.closed) return;
            Client.js5MasterIndex?.tick();
            MidiManager.fade();
            AudioEngine.tick();
            ClientKeyboardListener.poll();
            ClientMouseListener.poll();
            if (glJar && GlRendererClass.active) {
                GlCleaner.flush();
            }
            if (MouseWheel.instance !== null) MouseWheel.rotation = MouseWheel.instance.poll();
            switch (Client.gameState) {
                case 0:
                case 5:
                    await this.MainLoad();
                    GameShell.DoneSlowUpdate();
                    break;
                case 25:
                case 28:
                    this.MapBuildLoop();
                    break;
            }
            // These dispatches read tf.C separately. Both loading and map building can change it.
            switch (Client.gameState) {
                case 10: {
                    const hooks = this.titleLoop();
                    if (hooks instanceof Promise) await hooks;
                    if (this.standaloneWorldMap) {
                        const menu = Minimenu.GameLoop(this.ui);
                        if (menu instanceof Promise) await menu;
                        break;
                    }
                    if (this.closed) return;
                    await AccountCreation.loop(); // hi.a(I)V
                    if (this.closed) return;
                    await this.login.selectLoginWorld(); // ig.a(I)V
                    if (this.closed) return;
                    await this.LoginPoll(); // le.a(I)V
                    if (this.closed) return;
                    if (this.pendingLoginSession !== null) {
                        this.enterGame(this.pendingLoginSession, requireNonNull(this.assets), requireNonNull(this.ui));
                        this.pendingLoginSession = null;
                    }
                    break;
                }
                case 30: {
                    const game = this.game;
                    await this.GameLoop();
                    if (this.closed) return;
                    if (game?.loggedOut) this.game = this.viewport = undefined;
                    break;
                }
                case 40: {
                    await this.LoginPoll();
                    if (this.closed) return;
                    if (Login.reply === 15) {
                        Client.ReconnectDone();
                        const session = requireNonNull(this.pendingLoginSession);
                        requireNonNull(this.game).session = session;
                        this.pendingLoginSession = null;
                    } else if (Login.reply === 2) {
                        // le.a has already applied the fresh-login rebuild; publish its browser session.
                        if (this.pendingLoginSession) {
                            const ui = requireNonNull(this.ui);
                            this.enterGame(this.pendingLoginSession, requireNonNull(this.assets), ui);
                            this.pendingLoginSession = null;
                        }
                    } else if (Login.reply !== -3) {
                        const title = Client.Logout(requireNonNull(this.game));
                        if (title instanceof Promise) await title;
                        this.game = this.viewport = undefined;
                    }
                    break;
                }
            }
            this.host?.touchControls.updatePrompt();
        } catch (error) {
            if (this.closed) return;
            // si.b(I)V
            if (error instanceof SocketIoError && this.game && Client.gameState !== 40) {
                const lost = Client.LostCon(this.game);
                if (lost instanceof Promise) await lost;
                if (this.game.loggedOut) {
                    this.game = this.viewport = undefined;
                }
                return;
            }
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, glJar ? 'client.N(107)' : 'client.L(121)');
        }
    }

    // qj.c(B)V
    static sendWindowStatus(): void {
        const packet = Client.out;
        packet.pHead(243);
        packet.p1(Client.getWindowMode());
        packet.p2(GameShell.m_sWid);
        packet.p2(GameShell.m_sHei);
        packet.p1(Preferences.currentAntiAliasingMode);
    }

    // SD ld.b(I)I, HD le.a(I)I
    static getWindowMode(guard = 0): number {
        if (!glJar) return 0;
        try {
            if (GameShell.fullScreenFrame !== null) return 3;
            const GlRenderer = GlRendererClass;
            if (GlRenderer.active && GameShell.resizable) return 2;
            if (guard !== 0) Client.jingleActive = false;
            if (GlRenderer.active && !GameShell.resizable) return 1;
            return 0;
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'le.D(' + guard + ')');
        }
    }

    private static stressPalette: { value: number; lighting: boolean; setting: number } | null = null;

    private static applyStressQuality(enabled: boolean): void {
        const before = Preferences.graphics;
        if (GlRendererClass.active) MaterialManager.setMaterial(0, 0);
        if (enabled) Client.stressPalette = { value: Pix3D.legacyBrightness, lighting: Preferences.highDetailLighting, setting: Preferences.brightness };
        Preferences.setStressGraphics(enabled);
        const after = Preferences.graphics;
        if (before.highDetailTextures !== after.highDetailTextures && Pix3D.textureProvider instanceof TextureCache) Pix3D.textureProvider.setLowMemory(!after.highDetailTextures);
        if (enabled) {
            if (!before.highDetailLighting) Pix3D.setRenderBrightness(0.7);
        } else if (Client.stressPalette) {
            const saved = Client.stressPalette;
            Client.stressPalette = null;
            if (saved.lighting === after.highDetailLighting && saved.setting === Preferences.brightness) Pix3D.setRenderBrightness(saved.value);
            else Pix3D.setRenderBrightness(after.highDetailLighting ? 0.7 : (10 - Preferences.brightness) / 10);
        }
        Client.forceImmediateEnvironmentUpdate = true;
        ObjType.ResetSpriteCache();
    }

    private static async setStressGraphics(enabled: boolean): Promise<void> {
        if (enabled === Preferences.stressGraphicsEnabled) return;
        const previousAA = Preferences.graphics.currentAntiAliasingMode;
        Client.applyStressQuality(enabled);
        if (GlRendererClass.active && previousAA !== Preferences.graphics.currentAntiAliasingMode) {
            const mode = Client.getWindowMode();
            await Client.setWindowMode(Preferences.fullscreenWidth, true, mode, true, Preferences.fullscreenHeight);
        }
        Client.rebuildSceneIfIngame();
    }

    // SD ui.a(IZIZI)V / HD th.a(ZIIII)V (guard -8914).
    static setWindowMode(height: number, apply: boolean, mode: number, replaceCanvas: boolean, width: number): void | Promise<void> {
        return runToCompletion(
            (function* (): Generator<Promise<void>, void, void> {
                try {
                    Client.windowModeRefreshTime = 0n;
                    const current = Client.getWindowMode();
                    if (mode === 0 && Preferences.stressGraphicsEnabled) {
                        GameShell.stressFrame = null;
                        GlRendererClass.stressDrawable?.currentTargets()?.stopStress();
                        Client.applyStressQuality(false);
                    }
                    if (mode === 3 || current === 3) replaceCanvas = true;
                    if (requireNonNull(Signlink.osNameLower).startsWith('mac') && mode > 0) replaceCanvas = true;
                    let rebuild = false;
                    if (mode > 0 !== current > 0) rebuild = true;
                    if (replaceCanvas && mode > 0) rebuild = true;
                    if (glJar || apply) {
                        const change: void | Promise<void> = GameShell.applyWindowMode(mode, height, current, rebuild, replaceCanvas, width);
                        if (change instanceof Promise) yield change;
                        if (Preferences.stressGraphicsEnabled && !GlRendererClass.active) {
                            // A failed HD context can select software mode inside applyWindowMode.
                            GameShell.stressFrame = null;
                            Client.applyStressQuality(false);
                        }
                    }
                } catch (error) {
                    if (!isJavaRuntimeException(error)) throw error;
                    throw WrappedException.wrap(error, glJar ? 'th.EC(' + replaceCanvas + ',' + mode + ',-8914,' + height + ',' + width + ')' : 'ui.E(' + height + ',' + apply + ',' + mode + ',' + replaceCanvas + ',' + width + ')');
                }
            })()
        );
    }

    getSize(): { width: number; height: number } {
        const { canvas } = requireNonNull(this.host);
        const parent = requireNonNull(canvas.parentElement);
        // The standalone applet fills the browser viewport. Measuring the auto-sized body
        // would feed the previous fixed canvas height back into the resizable HD mode.
        if (parent === canvas.ownerDocument.body) {
            const root = canvas.ownerDocument.documentElement;
            return { width: root.clientWidth, height: root.clientHeight };
        }
        return { width: parent.clientWidth, height: parent.clientHeight };
    }

    get preferredWindowMode(): number {
        return Preferences.windowMode;
    }

    getGraphics(): { fillBlackRect(x: number, y: number, width: number, height: number): void } {
        const parent = requireNonNull(requireNonNull(this.host).canvas.parentElement);
        const margins: string[] = [];
        return {
            fillBlackRect(x, y, width, height) {
                margins.push('linear-gradient(black,black) ' + x + 'px ' + y + 'px / ' + width + 'px ' + height + 'px no-repeat');
                parent.style.background = margins.join(',');
            }
        };
    }

    // ek.c(I)V
    static resizeCanvas(): void {
        if (glJar) {
            // HD qh.a(true)V. The drawable changes size before the AWT canvas.
            try {
                const container = GameShell.fullScreenFrame !== null ? GameShell.fullScreenFrame : GameShell.frame !== null ? GameShell.frame : (requireNonNull(GameShell.signlink).applet as ShellContainer);
                GameShell.m_frameWidth = container.getSize().width;
                GameShell.m_frameHeight = container.getSize().height;
                if (container === GameShell.frame) {
                    const insets = GameShell.frame.getInsets();
                    GameShell.m_frameHeight = (GameShell.m_frameHeight - (insets.bottom + insets.top)) | 0;
                    GameShell.m_frameWidth = (GameShell.m_frameWidth - (insets.right + insets.left)) | 0;
                }
                if (Client.getWindowMode() >= 2) {
                    GameShell.m_sWid = GameShell.m_frameWidth;
                    GameShell.leftMargin = 0;
                    GameShell.topMargin = 0;
                    GameShell.m_sHei = GameShell.m_frameHeight;
                } else {
                    GameShell.topMargin = 0;
                    GameShell.leftMargin = (((GameShell.m_frameWidth - 765) | 0) / 2) | 0;
                    GameShell.m_sHei = 503;
                    GameShell.m_sWid = 765;
                }
                const GlRenderer = GlRendererClass;
                if (GlRenderer.active) GlRenderer.resize(GameShell.m_sWid, GameShell.m_sHei);
                const canvas = requireNonNull(GameShell.canvas);
                if ('setSize' in canvas) (canvas as { setSize(w: number, h: number): void }).setSize(GameShell.m_sWid, GameShell.m_sHei);
                else requireNonNull(Client.activeClient).setCanvasSize(GameShell.m_sWid, GameShell.m_sHei, canvas as HTMLCanvasElement);
                const insets = container === GameShell.frame ? GameShell.frame.getInsets() : null;
                const target = requireNonNull(GameShell.canvas);
                const left = insets === null ? GameShell.leftMargin : (insets.left + GameShell.leftMargin) | 0;
                const top = insets === null ? GameShell.topMargin : (GameShell.topMargin + insets.top) | 0;
                if ('setLocation' in target) (target as { setLocation(x: number, y: number): void }).setLocation(left, top);
                else requireNonNull(Client.activeClient).setCanvasLocation(left, top, target as HTMLCanvasElement);
                if (InterfaceList.top !== -1) Client.InterfaceCalculateSizeAndPosAll(true);
                GameShell.clearCanvasMargins();
            } catch (error) {
                if (!isJavaRuntimeException(error)) throw error;
                throw WrappedException.wrap(error, 'qh.C(true)');
            }
            return;
        }
        const container = GameShell.fullScreenFrame ?? GameShell.frame ?? (requireNonNull(GameShell.signlink).applet as ShellContainer);
        GameShell.m_frameWidth = container.getSize().width;
        GameShell.m_frameHeight = container.getSize().height;
        if (container === GameShell.frame) {
            const insets = GameShell.frame.getInsets();
            GameShell.m_frameHeight = (GameShell.m_frameHeight - insets.top - insets.bottom) | 0;
            GameShell.m_frameWidth = (GameShell.m_frameWidth - insets.left - insets.right) | 0;
        }
        if (Client.getWindowMode() >= 2) {
            GameShell.m_sHei = GameShell.m_frameHeight;
            GameShell.topMargin = GameShell.leftMargin = 0;
            GameShell.m_sWid = GameShell.m_frameWidth;
        } else {
            GameShell.leftMargin = (((GameShell.m_frameWidth - 765) | 0) / 2) | 0;
            GameShell.topMargin = 0;
            GameShell.m_sHei = 503;
            GameShell.m_sWid = 765;
        }
        const client = requireNonNull(Client.activeClient);
        client.setCanvasSize(GameShell.m_sWid, GameShell.m_sHei);
        if (container === GameShell.frame) {
            const insets = GameShell.frame.getInsets();
            client.setCanvasLocation((GameShell.leftMargin + insets.left) | 0, (insets.top + GameShell.topMargin) | 0);
        } else {
            client.setCanvasLocation(GameShell.leftMargin, GameShell.topMargin);
        }
        if (InterfaceList.top !== -1) Client.InterfaceCalculateSizeAndPosAll(true);
        GameShell.clearCanvasMargins();
    }

    setCanvasSize(width: number, height: number, canvas = requireNonNull(this.host).canvas): void {
        if (canvas.width === width && canvas.height === height) return;
        canvas.width = width;
        canvas.height = height;
        this.glCanvas?.sync();
    }

    setCanvasLocation(x: number, y: number, canvas = requireNonNull(this.host).canvas): void {
        canvas.style.marginLeft = x + 'px';
        canvas.style.marginTop = y + 'px';
        this.glCanvas?.sync();
    }

    getGlCanvas(): BrowserGlCanvas;
    getGlCanvas(canvas: object | null): GlCanvas | null;
    getGlCanvas(canvas: object | null = requireNonNull(this.host).canvas): GlCanvas | null {
        if (canvas === null) return null;
        if ('isDisplayable' in canvas) return canvas as GlCanvas;
        if (this.glCanvas === null) this.glCanvas = new BrowserGlCanvas(canvas as HTMLCanvasElement);
        else this.glCanvas.setInput(canvas as HTMLCanvasElement);
        return this.glCanvas;
    }

    getSoftwareCanvasComponent(): AwtComponent;
    getSoftwareCanvasComponent(canvas: object | null): AwtComponent | null;
    getSoftwareCanvasComponent(canvas: object | null = requireNonNull(GameShell.canvas)): AwtComponent | null {
        if (canvas === null) return null;
        if (this.host !== null && canvas === this.host.canvas) return this.host.component;
        if ('getGraphics' in canvas) return canvas as AwtComponent;
        return new CanvasComponent(requireNonNull((canvas as HTMLCanvasElement).getContext('2d')));
    }

    releaseGlCanvas(): void {
        this.glCanvas?.dispose();
        this.glCanvas = null;
    }

    replaceGameCanvas(): void {
        const keyboardSurface = (): KeyboardSurface => {
            const canvas = GameShell.canvas;
            return this.host !== null && this.host.canvas === canvas ? this.host.keyboardSurface : (canvas as KeyboardSurface);
        };
        const mouseSurface = (): MouseSurface & WheelSurface => {
            const canvas = GameShell.canvas;
            return this.host !== null && this.host.canvas === canvas ? this.host.mouseSurface : (canvas as MouseSurface & WheelSurface);
        };
        ClientKeyboardListener.stop(-1, keyboardSurface());
        ClientMouseListener.stop(mouseSurface(), 0);
        if (MouseWheel.instance !== null) {
            const wheel = MouseWheel.instance;
            const surface = mouseSurface();
            requireNonNull(wheel).stop(surface);
        }
        requireNonNull(Client.activeClient).recreateCanvas();
        ClientKeyboardListener.addListeners(keyboardSurface());
        ClientMouseListener.addListeners(mouseSurface());
        if (MouseWheel.instance !== null) {
            const wheel = MouseWheel.instance;
            const surface = mouseSurface();
            requireNonNull(wheel).start(surface);
        }
    }

    // DOM counterpart of the AWT component changes in p.c(B)V.
    protected mountCanvas(): CanvasComponent {
        const host = requireNonNull(this.host);
        this.events.abort();
        this.events = new AbortController();
        const canvas = host.canvas.cloneNode(false) as HTMLCanvasElement;
        host.canvas.replaceWith(canvas);
        GameShell.canvas = host.canvas = canvas;
        this.glCanvas?.setInput(canvas);
        canvas.width = GameShell.m_sWid;
        canvas.height = GameShell.m_sHei;
        canvas.tabIndex = 0;
        canvas.hidden = false;
        const insets = GameShell.fullScreenFrame === null ? GameShell.frame?.getInsets() : null;
        this.setCanvasLocation((GameShell.leftMargin + (insets?.left ?? 0)) | 0, (GameShell.topMargin + (insets?.top ?? 0)) | 0);
        host.canvas2d = requireNonNull(canvas.getContext('2d'));
        host.component = new GameCanvas(this);
        host.component.attachSurface(host.canvas2d);
        Object.assign(host, this.browserInputs(canvas));
        this.bindInput();
        canvas.focus();
        return host.component;
    }

    protected removeCanvas(): void {
        // p.a(IZ)V reads pe.S again after removeFocusListener and again after getParent.
        let canvas = requireNonNull(GameShell.canvas);
        if ('removeFocusListener' in canvas) {
            (canvas as { removeFocusListener(shell: GameShell): void }).removeFocusListener(this);
        } else {
            this.events.abort();
        }
        canvas = requireNonNull(GameShell.canvas);
        if ('getParent' in canvas) {
            const parent = (canvas as { getParent(): { remove(child: object | null): void } | null }).getParent();
            const child = GameShell.canvas;
            requireNonNull(parent).remove(child);
        } else {
            const parent = (canvas as HTMLCanvasElement).parentNode;
            const child = GameShell.canvas;
            requireNonNull(parent).removeChild(child as Node);
        }
    }

    resizeInterfacesAndReport(updateLowMem = true): void {
        if (updateLowMem) LocType.m_lowMem = !Preferences.getAllLevelsVisible();
        if (InterfaceList.top !== -1) Client.InterfaceCalculateSizeAndPosAll(true);
        if (Client.stream !== null && (Client.gameState === 30 || Client.gameState === 25)) {
            Client.sendWindowStatus();
        }
        for (let i = 0; i < 100; i++) InterfaceList.dirty[i] = true;
    }

    protected refreshCanvas(): void {
        // p.e(I)V after ka.k crosses 50. Each AWT call rereads the live canvas.
        let canvas = GameShell.canvas;
        const width = GameShell.m_sWid,
            height = GameShell.m_sHei;
        if ('setSize' in requireNonNull(canvas)) {
            (canvas as { setSize(w: number, h: number): void }).setSize(width, height);
        } else this.setCanvasSize(width, height, canvas as HTMLCanvasElement);
        canvas = requireNonNull(GameShell.canvas);
        if ('setVisible' in canvas) (canvas as { setVisible(visible: boolean): void }).setVisible(true);
        else (canvas as HTMLCanvasElement).hidden = false;
        const framed = GameShell.frame !== null && GameShell.fullScreenFrame === null;
        const insets = framed ? requireNonNull(GameShell.frame).getInsets() : null;
        canvas = GameShell.canvas;
        const x = framed ? (GameShell.leftMargin + requireNonNull(insets).left) | 0 : GameShell.leftMargin;
        const y = framed ? (requireNonNull(insets).top + GameShell.topMargin) | 0 : GameShell.topMargin;
        if ('setLocation' in requireNonNull(canvas)) {
            (canvas as { setLocation(x: number, y: number): void }).setLocation(x, y);
        } else this.setCanvasLocation(x, y, canvas as HTMLCanvasElement);
    }

    static clearInterfaceModelDepth = false; // HD vg.c:Z, consumed before the next model widget

    // SD db.a(I)V, HD jm.a(Z)V. Both callers draw the title interface in state 10.
    static drawGame(guard: number): void {
        try {
            if (InterfaceList.top !== -1) Client.AnimateInterface(InterfaceList.top);
            for (let i = 0; i < InterfaceList.rootCount; i++) {
                if (arrayAtObj(InterfaceList.dirty, i)) arrayPutObj(InterfaceList.rectangleRedraw, i, true);
                arrayPutObj(InterfaceList.rectRedrawnLastFrame, i, arrayAtObj(InterfaceList.dirty, i));
                arrayPutObj(InterfaceList.dirty, i, false);
            }
            const renderer = glJar ? GlRendererClass : null;
            if (glJar) {
                Minimenu.tooltipX2 = -1;
                Client.hoveredSlotCom = null;
                InterfaceList.cycle = Client.loopCycle;
                if (requireNonNull(renderer).active) Client.clearInterfaceModelDepth = true;
                Minimenu.tooltipY = -1;
            } else {
                Client.hoveredSlotCom = null;
                Minimenu.tooltipY = -1;
                InterfaceList.cycle = Client.loopCycle;
                Minimenu.tooltipX2 = -1;
            }
            if (InterfaceList.top !== -1) {
                InterfaceList.rootCount = 0;
                Client.drawTopLevelInterface();
            }
            if (renderer?.active) {
                const raster = loadGlRaster();
                raster.resetClipping();
            } else {
                Pix2D.resetClipping();
            }
            AreaSoundManager.elapsed = 0;
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, glJar ? 'jm.A(true)' : 'db.D(' + guard + ')');
        }
    }

    // SD gf.e(B)V, HD ha.a(I)V. Client::GameDraw, projects/osclient/client_network.cpp:850.
    static GameDraw(guard: number): void {
        try {
            Minimenu.ResetMinimenu();
            if (InterfaceList.top !== -1) Client.AnimateInterface(InterfaceList.top);
            if (glJar && guard !== 0) return;
            for (let i = 0; i < InterfaceList.rootCount; i++) {
                if (arrayAtObj(InterfaceList.dirty, i)) arrayPutObj(InterfaceList.rectangleRedraw, i, true);
                arrayPutObj(InterfaceList.rectRedrawnLastFrame, i, arrayAtObj(InterfaceList.dirty, i));
                arrayPutObj(InterfaceList.dirty, i, false);
            }
            const renderer = glJar ? GlRendererClass : null;
            const hdRaster = glJar ? loadGlRaster() : null;
            if (glJar) {
                Minimenu.tooltipComponent = null;
                Minimenu.tooltipX2 = -1;
                Minimenu.tooltipY = -1;
                Client.hoveredSlotCom = null;
                if (requireNonNull(renderer).active) Client.clearInterfaceModelDepth = true;
                InterfaceList.cycle = Client.loopCycle;
            } else {
                InterfaceList.cycle = Client.loopCycle;
                Minimenu.tooltipY = -1;
                Minimenu.tooltipComponent = null;
                Minimenu.tooltipX2 = -1;
                Client.hoveredSlotCom = null;
            }
            if (InterfaceList.top !== -1) {
                InterfaceList.rootCount = 0;
                Client.drawTopLevelInterface();
            }
            (renderer?.active ? requireNonNull(hdRaster) : Pix2D).resetClipping();
            Minimenu.Sort();
            if (!Minimenu.isOpen) {
                if (glJar) {
                    if (Minimenu.tooltipComponent !== null) {
                        const component = Minimenu.tooltipComponent;
                        const y = Minimenu.tooltipY2;
                        Minimenu.DrawFeedbackText(Minimenu.tooltipX, component, y, -120);
                    } else if (Minimenu.tooltipX2 !== -1) {
                        const y = Minimenu.tooltipY;
                        Minimenu.DrawFeedbackText(Minimenu.tooltipX2, null, y, -86);
                    }
                } else if (Minimenu.tooltipComponent === null) {
                    if (Minimenu.tooltipX2 !== -1) Minimenu.DrawFeedbackText(Minimenu.tooltipX2, null, Minimenu.tooltipY);
                } else {
                    Minimenu.DrawFeedbackText(Minimenu.tooltipX, Minimenu.tooltipComponent, Minimenu.tooltipY2);
                }
            } else if (!glJar && !SceneCutover.active && Client.activeClient?.viewport?.menu.sceneMenuOpen) {
                Client.activeClient.viewport.menu.draw(ClientMouseListener.x, ClientMouseListener.mouseY);
            } else if (!Minimenu.spriteStyle) {
                Minimenu.Draw();
            } else {
                Minimenu.DrawSpriteMenu();
            }
            let cursor = Minimenu.isOpen ? -1 : Minimenu.topCursor();
            if (cursor === -1) cursor = Client.defaultCursor;
            Client.setCursor(cursor);
            if (glJar) {
                if (Client.targetTileState === 1) Client.targetTileState = 2;
                if (Client.walkClickStage === 1) Client.walkClickStage = 2;
            } else {
                if (Client.walkClickStage === 1) Client.walkClickStage = 2;
                if (Client.targetTileState === 1) Client.targetTileState = 2;
            }
            if (Client.rectDebug === 3) {
                for (let i = 0; i < InterfaceList.rootCount; i++) {
                    if (arrayAtObj(InterfaceList.rectRedrawnLastFrame, i)) {
                        (renderer?.active ? requireNonNull(hdRaster) : Pix2D).fillRectTrans(
                            arrayAtI32(InterfaceList.rootX, i),
                            arrayAtI32(InterfaceList.rootY, i),
                            arrayAtI32(InterfaceList.rootWidth, i),
                            arrayAtI32(InterfaceList.rootHeight, i),
                            0xff00ff,
                            128
                        );
                    } else if (arrayAtObj(InterfaceList.rectangleRedraw, i)) {
                        (renderer?.active ? requireNonNull(hdRaster) : Pix2D).fillRectTrans(
                            arrayAtI32(InterfaceList.rootX, i),
                            arrayAtI32(InterfaceList.rootY, i),
                            arrayAtI32(InterfaceList.rootWidth, i),
                            arrayAtI32(InterfaceList.rootHeight, i),
                            0xff0000,
                            128
                        );
                    }
                }
            }
            if (glJar) {
                const elapsed = AreaSoundManager.elapsed;
                const x = requireNonNull(Client.localPlayer).x;
                const z = requireNonNull(Client.localPlayer).z;
                AreaSoundManager.update(Client.playerLevel, elapsed, x, z);
            } else {
                AreaSoundManager.update(Client.playerLevel, AreaSoundManager.elapsed, requireNonNull(Client.localPlayer).x, requireNonNull(Client.localPlayer).z);
            }
            AreaSoundManager.elapsed = 0;
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, (glJar ? 'ha.G(' : 'gf.C(') + guard + ')');
        }
    }

    // SD client.d(I)V, HD client.f(I)V
    protected MainRedraw(): void | Promise<void> {
        if (this.standaloneWorldMap && Client.gameState === 0) return;
        return runToCompletion(this.redraw());
    }

    private *redraw(): Generator<Promise<void>, void, void> {
        try {
            if (Client.gameState === 1000) return;
            if (MidiManager.load() && Client.jingleActive && AudioEngine.musicPlayer !== null) {
                requireNonNull(AudioEngine.musicPlayer).QueueDiscardBuffer();
            }
            if ((Client.gameState === 30 || Client.gameState === 10) && (GameShell.canvasInvalid || (Client.windowModeRefreshTime !== 0n && Client.windowModeRefreshTime < SafeTime.CurrentTimeMillis()))) {
                let change: void | Promise<void>;
                if (glJar) {
                    const replaceCanvas = GameShell.canvasInvalid;
                    const mode = Client.getWindowMode();
                    change = Client.setWindowMode(Preferences.fullscreenWidth, true, mode, replaceCanvas, Preferences.fullscreenHeight);
                } else {
                    change = Client.setWindowMode(Preferences.fullscreenHeight, true, Client.getWindowMode(), GameShell.canvasInvalid, Preferences.fullscreenWidth);
                }
                if (change instanceof Promise) yield change;
            }
            if (GameShell.fullScreenFrame === null) {
                const container: ShellContainer = GameShell.fullScreenFrame !== null ? GameShell.fullScreenFrame : GameShell.frame !== null ? GameShell.frame : (requireNonNull(GameShell.signlink).applet as ShellContainer);
                let width = container.getSize().width,
                    height = container.getSize().height;
                if (container === GameShell.frame) {
                    const insets = GameShell.frame.getInsets();
                    if (glJar) {
                        width = (width - (insets.right + insets.left)) | 0;
                        height = (height - (insets.top + insets.bottom)) | 0;
                    } else {
                        height = (height - insets.bottom - insets.top) | 0;
                        width = (width - insets.right - insets.left) | 0;
                    }
                }
                if (GameShell.m_frameWidth !== width || height !== GameShell.m_frameHeight) {
                    if (requireNonNull(Signlink.osNameLower).startsWith('mac')) {
                        if (glJar) {
                            GameShell.m_frameWidth = width;
                            GameShell.m_frameHeight = height;
                        } else {
                            GameShell.m_frameHeight = height;
                            GameShell.m_frameWidth = width;
                        }
                    } else {
                        Client.resizeCanvas();
                    }
                    Client.windowModeRefreshTime = BigInt.asIntN(64, 500n + SafeTime.CurrentTimeMillis());
                }
            }
            if (glJar && GameShell.fullScreenFrame !== null && (!GameShell.m_focus || GameShell.fullScreenFrame.isVisible?.() === false) && (Client.gameState === 30 || Client.gameState === 10)) {
                const change = Client.setWindowMode(-1, true, Preferences.windowMode, false, -1);
                if (change instanceof Promise) yield change;
            }
            const fullRedraw = GameShell.fullRedraw;
            if (fullRedraw) {
                GameShell.fullRedraw = false;
                GameShell.clearCanvasMargins();
            }
            const renderer = glJar ? GlRendererClass : null;
            if (renderer !== null && renderer.active) {
                for (let i = 0; i < 100; i++) arrayPutObj(InterfaceList.dirty, i, true);
            }
            const browserSd = glJar && this.host !== null && this.sdDevice !== null && !this.sdDevice.lost;
            const screen = browserSd && !renderer?.active && Client.gameState !== 0 ? GameShell.drawArea : null;
            const useGpu = screen?.pixels != null;
            if (this.sdDisplay && (!useGpu || this.sdDisplay.screen !== screen || this.sdDisplay.component !== this.host?.component)) {
                yield requireNonNull(this.leaveSdDisplay());
                if (!useGpu && !renderer?.active) {
                    this.releaseGlCanvas();
                    GameShell.fullRedraw = true;
                }
            }
            if (useGpu && !this.sdDisplay) {
                const context = requireNonNull(this.getGlCanvas().getContext('webgpu'));
                // eslint-disable-next-line @typescript-eslint/no-require-imports -- SdBrowserDisplay stays deferred until Client.redraw.
                const Display = (require('./SdBrowserDisplay') as typeof import('./SdBrowserDisplay')).default;
                const display = new Display(requireNonNull(this.sdDevice), context, requireNonNull(screen), requireNonNull(this.host).component);
                try {
                    yield display.bind();
                    this.sdDisplay = display;
                } catch (error) {
                    yield display.leave(false);
                    this.releaseGlCanvas();
                    throw error;
                }
            }
            this.sdDisplay?.beginFrame();
            if (Client.gameState === 0) {
                if (glJar) {
                    const message = TitleScreen.m_loadString;
                    GameShell.drawProgress(TitleScreen.m_loadPos, fullRedraw, message, null);
                } else {
                    GameShell.drawProgress(TitleScreen.m_loadPos, fullRedraw, TitleScreen.m_loadString, null);
                }
            } else if (Client.gameState === 5) {
                TitleScreen.Draw(-1, Client.fontBold12, false);
            } else if (Client.gameState === 10) {
                if (this.standaloneWorldMap) Client.GameDraw(glJar ? 0 : 120);
                else Client.drawGame(-54);
            } else if (Client.gameState === 25 || Client.gameState === 28) {
                if (Client.sceneState === 1) {
                    if (Client.mapLoadingTotal < Client.mapFilesMissing) Client.mapLoadingTotal = Client.mapFilesMissing;
                    const loaded = glJar ? Client.mapLoadingTotal - Client.mapFilesMissing : -Client.mapFilesMissing + Client.mapLoadingTotal;
                    const percent = intDivide(Math.imul(50, loaded), Client.mapLoadingTotal);
                    Client.MessageBox(JagString.join([LocalisedText.loadingPleaseWait2, LocalisedText.loadingPercentStart, JagString.fromInt(percent), LocalisedText.loadingPercentEnd]), false, -71);
                } else if (Client.sceneState === 2) {
                    if (Client.maxLocModelsMissing < Client.locsNotReadyCount) Client.maxLocModelsMissing = Client.locsNotReadyCount;
                    const loaded = glJar ? -Client.locsNotReadyCount + Client.maxLocModelsMissing : Client.maxLocModelsMissing - Client.locsNotReadyCount;
                    const percent = (intDivide(Math.imul(50, loaded), Client.maxLocModelsMissing) + 50) | 0;
                    Client.MessageBox(JagString.join([LocalisedText.loadingPleaseWait2, LocalisedText.loadingPercentStart, JagString.fromInt(percent), LocalisedText.loadingPercentEnd]), false, -41);
                } else Client.MessageBox(LocalisedText.loadingPleaseWait2, false, -73);
            } else if (Client.gameState === 30) {
                if (GameShell.stressFrame && renderer?.active) renderer.stressDrawable?.currentTargets()?.startStress();
                Client.GameDraw(glJar ? 0 : 120);
            } else if (Client.gameState === 40) {
                Client.MessageBox(JagString.join([LocalisedText.conlost, LocalisedText.TAG_BREAK, LocalisedText.attempt_to_reestablish]), false, -95);
            }
            if (renderer !== null && renderer.active && Client.gameState !== 0) {
                renderer.swapBuffers(GameShell.displayPaced && Client.gameState === 30 && !globalThis.document?.hidden);
                for (let i = 0; i < InterfaceList.rootCount; i++) arrayPutObj(InterfaceList.rectangleRedraw, i, false);
            } else {
                const partial = (Client.gameState === 30 || Client.gameState === 10) && Client.rectDebug === 0 && !fullRedraw;
                if (partial || Client.gameState !== 0) {
                    try {
                        const graphics = this.getSoftwareCanvasComponent().getGraphics();
                        if (partial) {
                            for (let i = 0; i < InterfaceList.rootCount; i++) {
                                if (arrayAtObj(InterfaceList.rectangleRedraw, i)) {
                                    const area = GameShell.drawArea;
                                    let height: number, width: number, x: number;
                                    if (glJar) {
                                        width = arrayAtI32(InterfaceList.rootWidth, i);
                                        x = arrayAtI32(InterfaceList.rootX, i);
                                        height = arrayAtI32(InterfaceList.rootHeight, i);
                                    } else {
                                        height = arrayAtI32(InterfaceList.rootHeight, i);
                                        width = arrayAtI32(InterfaceList.rootWidth, i);
                                        x = arrayAtI32(InterfaceList.rootX, i);
                                    }
                                    const y = arrayAtI32(InterfaceList.rootY, i);
                                    requireNonNull(area).drawClipped(height, width, x, y, graphics);
                                    arrayPutObj(InterfaceList.rectangleRedraw, i, false);
                                }
                            }
                        } else {
                            requireNonNull(GameShell.drawArea).draw(0, 0, graphics);
                            for (let i = 0; i < InterfaceList.rootCount; i++) arrayPutObj(InterfaceList.rectangleRedraw, i, false);
                        }
                    } catch (err) {
                        if (!(err instanceof Error) || err instanceof JavaError) throw err;
                        const canvas = requireNonNull(GameShell.canvas);
                        if ('repaint' in canvas) (canvas as { repaint(): void }).repaint();
                        else if (this.host !== null && canvas === this.host.canvas) {
                            const component = this.host.component;
                            requestAnimationFrame(() => component.update(component.getGraphics()));
                        } else GameShell.fullRedraw = true;
                    }
                }
            }
            this.sdDisplay?.finishFrame();
            if (Client.loadingComplete) Client.cleanCaches();
            if (Preferences.safeMode && Client.gameState === 10 && InterfaceList.top !== -1) {
                Preferences.safeMode = false;
                Preferences.write();
            }
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, glJar ? 'client.K(40)' : 'client.P(0)');
        }
    }

    // HD client.c(I)V, rc.a(IZ)V supplies 126.
    private static releaseHdStatics(): void {
        // The original cleanup helpers attach their own context to a RuntimeException.
        let helperContext: string | null = null;
        try {
            helperContext = null;
            Client.releaseClientStatics(true); // client.c(Z)V
            helperContext = null;
            JagString.releaseHdStatics(-8635); // na.e(I)V
            helperContext = 'fk.E(21474)';
            // fk.a(I)V
            releaseReferences(LocalisedText, 'englishRemoveFriend', 'frenchChateffect2');
            releaseReferences(NpcType, 'slotFrameDelays');
            TextureShapeRaster.raster = null;
            MouseWheel.instance = null;
            GameShell.signlink = null;
            releaseReferences(LocalisedText, 'frenchCheckingForUpdates', 'removeIgnore', 'removeFriend');
            helperContext = null;
            MapArea.releaseMapAreaStatics(-46); // bn.g(B)V
            helperContext = null;
            WorldMapLabels.releaseHdStatics(0); // se.b(I)V
            helperContext = null;
            GameShell.releaseGameShellStatics(113); // rc.a(I)V
            helperContext = null;
            GlRendererClass.unload(); // tf.k()V
            helperContext = null;
            Timer.releaseTimerStatics(24241); // s.a(I)V
            helperContext = null;
            PixScreen.releasePixScreenStatics(false); // vk.a(Z)V
            helperContext = null;
            MouseTracking.releaseHdStatics(25951); // jd.a(I)V
            helperContext = null;
            HintArrow.releaseHdStatics(106); // nc.a(B)V
            helperContext = null;
            PacketT.releasePacketTStatics(0); // wa.j(I)V
            helperContext = null;
            ClientStream.releaseHdStatics(0); // ma.b(I)V
            helperContext = 'jb.G(-88)';
            // jb.a(B)V
            SpriteLoader.hitbarDefault = null;
            releaseReferences(Client, 'niceNumberSuffix');
            helperContext = null;
            Js5LocalCache.releaseHdStatics(-16222); // k.b(I)V
            helperContext = null;
            Js5MasterIndex.releaseHdStatics(-114); // al.a(I)V
            helperContext = null;
            Js5RemoteLoader.releaseJs5RemoteLoaderStatics(false); // bg.b(Z)V
            helperContext = null;
            Js5.releaseHdStatics(100); // ve.a(I)V
            helperContext = null;
            BufferedRandomAccessFile.releaseHdStatics(true); // en.a(Z)V
            helperContext = null;
            DataFile.releaseHdStatics(true); // ge.a(Z)V
            helperContext = null;
            LRUHashCache.releaseHdStatics(3101); // n.b(I)V
            helperContext = null;
            ClientNpc.releaseClientNpcStatics(-3); // km.e(I)V
            helperContext = null;
            SuperPacket.releaseSuperPacketStatics(1); // i.q(I)V
            helperContext = null;
            CollisionMap.releaseHdStatics(-124); // mj.a(B)V
            helperContext = null;
            IfType.releaseHdStatics(126); // be.b(I)V
            helperContext = null;
            DisplayMode.releaseHdStatics(121); // od.a(B)V
            helperContext = null;
            ClientPlayer.releaseClientPlayerStatics(121); // e.d(B)V
            helperContext = null;
            SharedPtrList.releaseHdStatics(0); // ih.c(I)V
            helperContext = null;
            AbstractSpriteClass.releaseAbstractSpriteStatics(108); // qf.f(B)V
            helperContext = 'sc.H(103)';
            // sc.b(I)V
            releaseReferences(CookieStatics, 'cookieSuffix');
            releaseReferences(LocalisedText, 'loadedSprites');
            releaseReferences(InterfaceList, 'rectRedrawnLastFrame');
            releaseReferences(LocalisedText, 'germanFaceHere');
            IfType.m_open = null;
            releaseReferences(Minimenu, 'objArrow', 'orangeRed');
            releaseReferences(LocalisedText, 'englishLoadedSprites');
            helperContext = null;
            MouseWheel.releaseHdStatics(0); // uc.b(I)V
            helperContext = null;
            FriendChatUser.releaseFriendChatUserStatics(103); // kl.c(I)V
            helperContext = null;
            StockPlayerOffer.releaseHdStatics(25); // sg.a(I)V
            helperContext = null;
            MidiPlayer.releaseMidiPlayerStatics(85); // va.e(B)V
            helperContext = null;
            PCMPlayer.releasePCMPlayerStatics(0); // vh.c(I)V
            helperContext = null;
            Decimator.releaseHdStatics(-110); // vj.a(B)V
            helperContext = null;
            PlayerModel.releaseHdStatics(8160); // hh.c(I)V
            helperContext = null;
            SeqType.releaseHdStatics(-108); // tk.a(B)V
            helperContext = null;
            ClientEntity.releaseClientEntityStatics(-116); // fe.b(B)V
            helperContext = null;
            Square.releaseSquareStatics(3353893); // bj.c(I)V
            helperContext = null;
            LocType.releaseHdStatics(-11); // pb.b(I)V
            helperContext = null;
            LocChange.releaseLocChangeStatics(2); // cd.c(I)V
            helperContext = null;
            NpcType.releaseHdStatics(103); // me.c(B)V
            helperContext = null;
            SubInterface.releaseSubInterfaceStatics(26971); // wk.c(I)V
            helperContext = 'bf.P(120)';
            // bf.d(B)V
            releaseReferences(Client, 'chatColours');
            Client.m_pClientScripts = null;
            releaseReferences(QuickChatPhraseType, 'receiveWidths');
            releaseReferences(LocalisedText, 'englishChatcol5', 'chatcol5', 'frenchChatcol10', 'defaultChatcol5');
            helperContext = null;
            Linkable.releaseLinkableStatics(30); // ab.a(B)V
            helperContext = null;
            SecondaryLinkedList.releaseHdStatics(106); // ce.a(B)V
            helperContext = 'ij.D(119)';
            // ij.c(I)V
            releaseReferences(LocalisedText, 'frenchIgnoreFirst');
            releaseReferences(Protocol, 'duelFriendTag');
            helperContext = 'nb.D(3)';
            // nb.a(I)V
            releaseReferences(LocalisedText, 'selfIgnore');
            Minimenu.bottomEdgeSprite = null;
            releaseReferences(WorldMap, 'detailsGroup');
            Client.umMapPrefix = null;
            TitleScreen.logoName = null;
            releaseReferences(LocalisedText, 'englishSelfIgnore');
            releaseReferences(Client, 'breakconCommand');
            helperContext = null;
            AnimFrameSet.releaseAnimFrameSetStatics(-29679); // cl.d(I)V
            helperContext = null;
            ActorSlotAnim.releaseHdStatics(59); // ub.a(B)V
            helperContext = 'gl.B(-1)';
            // gl.a(I)V
            releaseReferences(LocalisedText, 'frenchCreatedGameworld');
            LightType.m_pConfigClient = null;
            helperContext = 'sf.A(104)';
            // sf.a(B)V
            releaseReferences(DelayedStateChange, 'varcStrings');
            releaseReferences(Minimenu, 'yellow');
            Client.js5Archive27 = null;
            helperContext = 'cg.B(35)';
            // cg.a(B)V
            releaseReferences(LocalisedText, 'germanDiscard');
            releaseReferences(Client, 'paramTrue');
            releaseReferences(JagString, 'period2');
            helperContext = 'qh.B(-14256)';
            // qh.a(I)V
            WorldMap.font19 = null;
            WorldMap.labels = null;
            WorldList.countries = null;
            releaseReferences(WorldMap, 'memLabel');
            IfType.m_pModels = null;
            releaseReferences(Client, 'beforeCleanup');
            helperContext = 'ri.B(-79)';
            // ri.a(I)V
            IdkType.m_pConfigClient = null;
            releaseReferences(PlayerModel, 'slotNextFrames');
            TitleFlames.flameBuffer = null;
            helperContext = 'cm.B(-24912)';
            // cm.a(I)V
            TextureOp.textureProvider = null;
            releaseReferences(LocalisedText, 'germanConlost', 'frenchSkill', 'frenchSelfFriend');
            Client.js5SocketRequest = null;
            GameShell.gameThread = null;
            helperContext = null;
            SecondaryHashTable.releaseHdStatics(-55); // rm.a(B)V
            helperContext = null;
            WrappedException.releaseHdStatics(false); // ld.a(Z)V
            helperContext = 'dg.A(5157)';
            // dg.a(I)V
            Client.tooltipComponent = null;
            releaseReferences(Client, 'debugCacheLabel', 'shiftClickEnabled');
            releaseReferences(PlayerModel, 'recolourDestinations2Rs');
            helperContext = 'wj.F(126)';
            // wj.a(B)V
            GameShell.progressTitle = null;
            releaseReferences(LocalisedText, 'frenchContinue');
            releaseReferences(Client, 'countColourYellow');
            Client.underwaterLocPrefix = null;
            helperContext = null;
            Js5DiskRequest.releaseJs5DiskRequestStatics(38); // c.g(B)V
            helperContext = null;
            Js5NetQueueRequest.releaseJs5NetQueueRequestStatics(108); // pm.g(B)V
            helperContext = 'nf.B(-126)';
            // nf.a(I)V
            Client.searchResults = null;
            Client.hoveredSlotCom = null;
            releaseReferences(LocType, 'm_mc1');
            WorldMap.font14 = null;
            helperContext = 'lf.B(24)';
            // lf.a(B)V
            releaseReferences(RouteFinding, 'm_dirMap');
            WorldMap.overlayColors = null;
            releaseReferences(WorldMap, 'icons');
            releaseReferences(Client, 'activeMapFunctionX');
            helperContext = null;
            GlLighting.unload(); // mk.c()V
            helperContext = 'gd.A(true)';
            // gd.a(Z)V
            MidiManager.m_pJagFX = null;
            Minimenu.targetName = null;
            ObjType.defaultName = null;
            releaseReferences(ClientBuild, 'WSHAPE1');
            releaseReferences(Minimenu, 'plus');
            TitleScreen.m_titleBack = null;
            helperContext = null;
            ModelUnlit.unload(); // gb.d()V
            helperContext = null;
            LocEntity.releaseHdStatics(-45); // sm.a(B)V
            helperContext = null;
            loadGlModel().unload(); // td.r()V
            helperContext = null;
            ObjType.releaseHdStatics(3327); // h.b(I)V
            helperContext = null;
            ModelLitImpl.unload(); // w.q()V
            helperContext = null;
            ClientKeyboardListener.releaseHdStatics(118); // uf.a(I)V
            helperContext = null;
            ClientMouseListener.releaseHdStatics(true); // ug.a(Z)V
            helperContext = 'dl.A(0)';
            // dl.a(I)V
            world.visibilityMap = null;
            releaseReferences(LocalisedText, 'englishOpenedTitleScreen', 'openedTitleScreen');
            helperContext = 'le.E(90)';
            // le.b(I)V
            MidiManager.track = null;
            helperContext = null;
            GlCleaner.unload(); // fa.a()V
            helperContext = null;
            PlayerTask.releaseHdStatics(100); // cj.b(I)V
            helperContext = 'oe.C(0)';
            // oe.a(I)V
            releaseReferences(LocType, 'm_recentUse');
            releaseReferences(LocalisedText, 'frenchLoadingPleaseWait', 'germanChatcol11');
            releaseReferences(ScriptRunner, 'arrays');
            Client.npcMapPrefix = null;
            helperContext = 'wc.C(-17413)';
            // wc.a(I)V
            releaseReferences(world, 'minimapRotate');
            DataFile.sectorBuffer = null;
            helperContext = null;
            AbstractIndexedSprite.releaseHdStatics(33); // ok.a(I)V
            helperContext = null;
            PixfontGeneric.unload(); // rk.a()V
            helperContext = 'lg.B(-25247)';
            // lg.b(I)V
            LocType.m_pConfigClient = null;
            releaseReferences(LocalisedText, 'germanChatcol2');
            releaseReferences(NpcType, 'slotSeqs');
            helperContext = null;
            MidiNote.releaseMidiNoteStatics(186); // mf.c(I)V
            helperContext = null;
            MidiParser.unload(); // ki.a()V
            helperContext = null;
            MidiMixer.releaseMidiMixerStatics(-28918); // te.d(I)V
            helperContext = null;
            Patch.releasePatchStatics(true); // jk.a(Z)V
            helperContext = 'em.A(false)';
            // em.a(Z)V
            ClientBuild.m_mapo = null;
            Client.gameHost = null;
            releaseReferences(LocalisedText, 'germanChatcol8');
            releaseReferences(WorldList, 'objectTagArg');
            PlayerTask.active = null;
            helperContext = null;
            WorldMapFont.unload(); // fd.b()V
            PointLightManagerClass.unload(); // jf.d()V
            StaticPointLight.releaseHdStatics(-2); // gi.a(B)V
            helperContext = null;
            Js5ResourceProvider.releaseJs5ResourceProviderStatics(1); // v.a(I)V
            helperContext = null;
            Js5Index.releaseHdStatics(0); // ii.a(I)V
            helperContext = null;
            Js5Request.releaseHdStatics(120); // il.f(B)V
            helperContext = 'tl.A(0)';
            // tl.a(I)V
            releaseReferences(LocalisedText, 'frenchChateffect3');
            releaseReferences(ObjType, 'modelCache');
            releaseReferences(JagString, 'comma');
            releaseReferences(Protocol, 'assistRequestSuffix');
            releaseReferences(LocalisedText, 'englishLoadedFonts', 'loadedFonts');
            helperContext = null;
            Pix2D.unload(); // kb.d()V
            helperContext = 'ac.A(-90)';
            // ac.a(I)V
            releaseReferences(BASTypeList, 'defaultType');
            ClientBuild.m_floorr = null;
            releaseReferences(WorldMap, 'overlay');
            Client.timerEvents = null;
            ComponentDrag.parent = null;
            helperContext = null;
            Js5Compression.releaseHdStatics(99); // ha.b(I)V
            helperContext = 'hn.F(0)';
            // hn.e(I)V
            releaseReferences(ScriptRunner, 'calendar');
            Minimenu.targetVerb = null;
            helperContext = null;
            SecondaryNode.releaseSecondaryNodeStatics(-3); // rg.c(I)V
            helperContext = 'gn.G(89)';
            // gn.a(B)V
            QuickChatCatTypeList.local = null;
            EnumType.nullText = null;
            releaseReferences(IfType, 'm_fontCache');
            helperContext = null;
            FloType.releaseHdStatics(-2); // wl.a(I)V
            helperContext = 'tg.A(-17124)';
            // tg.a(I)V
            releaseReferences(Client, 'playerCacheCommand');
            ClientBuild.m_floort2 = null;
            GameShell.progressFontMetrics = null;
            releaseReferences(Minimenu, 'locColour');
            SpriteLoader.cross = null;
            helperContext = null;
            FluType.releaseHdStatics(-48); // ni.a(B)V
            helperContext = null;
            IdkType.releaseHdStatics(-9893); // dm.b(I)V
            helperContext = 'lk.D(221301966)';
            // lk.d(I)V
            releaseReferences(Client, 'urlSettingsParam');
            releaseReferences(LocalisedText, 'englishLoadingFonts', 'englishAlreadyFriend', 'loadingFonts', 'alreadyFriend');
            helperContext = 'pl.D(true)';
            // pl.a(Z)V
            releaseReferences(LocalisedText, 'englishLoadedWordpack');
            releaseReferences(ClientKeyboardListener, 'm_keycodeMap');
            releaseReferences(LocalisedText, 'frenchRating');
            releaseReferences(Protocol, 'tradeReqSuffix');
            WorldList.worlds = null;
            releaseReferences(Minimenu, 'paramB');
            releaseReferences(LocalisedText, 'loadedWordpack');
            helperContext = 'ph.B(69)';
            // ph.a(I)V
            loadEnvironment().grid = null;
            releaseReferences(LocalisedText, 'ok', 'englishOk');
            helperContext = 'ck.A(true)';
            // ck.a(Z)V
            releaseReferences(ScriptRunner, 'monthDec');
            releaseReferences(LocalisedText, 'loadedWorldList');
            releaseReferences(ScriptRunner, 'monthJan', 'monthJun');
            releaseReferences(LocalisedText, 'germanLoadingConfig');
            releaseReferences(ScriptRunner, 'monthJul', 'monthNov');
            releaseReferences(ClientBuild, 'DECORXOF');
            releaseReferences(LocalisedText, 'englishLoadedWorldList');
            releaseReferences(ScriptRunner, 'months');
            Minimenu.objName = null;
            releaseReferences(LocalisedText, 'englishDiscard');
            releaseReferences(ScriptRunner, 'monthMay', 'monthSep');
            releaseReferences(LocalisedText, 'discard');
            releaseReferences(ScriptRunner, 'monthOct', 'monthApr', 'monthFeb', 'monthAug');
            WorldMap.overlayIds = null;
            releaseReferences(ScriptRunner, 'monthMar');
            helperContext = null;
            SpotType.releaseHdStatics(6); // eg.a(I)V
            helperContext = null;
            VarBitType.releaseHdStatics(true); // kk.a(Z)V
            helperContext = null;
            VarpType.releaseHdStatics(62); // eh.a(B)V
            helperContext = null;
            InvType.releaseInvTypeStatics(119); // md.d(I)V
            helperContext = 'ml.P(-1)';
            // ml.f(I)V
            releaseReferences(LocalisedText, 'germanThousandsSuffix2');
            helperContext = null;
            QuickChatPhraseType.releaseQuickChatPhraseTypeStatics(-2951); // cb.d(I)V
            helperContext = null;
            ClientQuickChatCommandDecoder.releaseHdStatics(126); // af.a(B)V
            helperContext = null;
            QuickChatCatType.releaseQuickChatCatTypeStatics(-1667); // bc.e(I)V
            helperContext = null;
            LightType.releaseHdStatics(-86); // ic.a(B)V
            helperContext = null;
            CursorType.releaseHdStatics(-118); // ia.b(B)V
            helperContext = null;
            // eslint-disable-next-line @typescript-eslint/no-require-imports -- SD da stays deferred until client.c(I)V in Client.releaseHdStatics.
            (require('#/config/MSIType') as typeof import('#/config/MSIType')).default.releaseHdStatics(-27401); // aa.a(I)V
            helperContext = 'nk.W(-11565)';
            // nk.a(I)V
            Client.localPlayer = null;
            TextureOp.normalisedX = null;
            releaseReferences(LocalisedText, 'germanOpenedTitleScreen');
            Client.imageMapfunction = null;
            releaseReferences(Client, 'soundEffects');
            helperContext = null;
            Texture.releaseTextureStatics(20413); // uh.d(I)V
            helperContext = null;
            loadGlSolidTexture().releaseGlSolidTextureStatics(1); // sd.d(I)V
            helperContext = null;
            Pix3D.unload(); // hf.e()V
            helperContext = null;
            Huffman.releaseHdStatics(127); // fi.b(B)V
            helperContext = 'a.C(-124)';
            // a.a(B)V
            releaseReferences(Minimenu, 'playerSecondary');
            Client.titleSongName = null;
            releaseReferences(Minimenu, 'tooltipMoreSeparator');
            TextureOpPerlinNoise.fadeTable = null;
            helperContext = 'nj.A(110)';
            // nj.a(B)V
            Client.npcConfigArchive = null;
            WorldMap.deferredIcons = null;
            PlayerModel.recolourDestinations2 = null;
            Client.mapBuildLocationFile = null;
            MidiManager.stream = null;
            Client.cacheData = null;
            MidiManager.trackArchive = null;
            VarBitType.m_pConfigClient = null;
            helperContext = 'hi.C(false)';
            // hi.a(Z)V
            releaseReferences(LocalisedText, 'frenchLoadingTitleScreen');
            helperContext = null;
            GameWorld.releaseGameWorldStatics(0); // ba.f(I)V
            helperContext = null;
            WorldCountry.releaseHdStatics(31); // ee.a(I)V
            helperContext = null;
            NoiseTextures.unload(); // lm.d()V
            helperContext = 'tc.C(false)';
            // tc.a(Z)V
            releaseReferences(LocalisedText, 'frenchTake', 'frenchFriendFirst');
            helperContext = null;
            ClientGosubFrame.releaseHdStatics(-93); // hj.a(B)V
            helperContext = null;
            // eslint-disable-next-line @typescript-eslint/no-require-imports -- SD d stays deferred until client.c(I)V in Client.releaseHdStatics.
            (require('./QuickChatPhrase') as typeof import('./QuickChatPhrase')).default.releaseHdStatics(0); // bd.a(I)V
            helperContext = 'jl.E(false)';
            // jl.a(Z)V
            releaseReferences(NpcType, 'm_modelCache');
            WorldMap.upperOverlayShapes = null;
            releaseReferences(VarBitType, 'm_recentUse');
            helperContext = null;
            ModelSource.releaseModelSourceStatics(0); // th.a(I)V
            helperContext = null;
            loadEnvironment().releaseHdStatics(53); // li.a(B)V
            helperContext = null;
            TerrainBatch.release(); // hg.c()V
            helperContext = null;
            Sprite.releaseHdStatics(128); // ec.a(I)V
            helperContext = null;
            Occlude.releaseHdStatics(10967); // pe.a(I)V
            helperContext = null;
            Wall.releaseHdStatics(-87); // jh.a(B)V
            helperContext = null;
            Decor.releaseHdStatics(112); // df.a(B)V
            helperContext = null;
            GroundDecor.releaseHdStatics(115); // bm.a(B)V
            helperContext = null;
            GroundObject.releaseHdStatics(1); // jj.a(I)V
            helperContext = null;
            QuickGround.releaseHdStatics(-58); // rh.a(B)V
            helperContext = null;
            Ground.unload(); // fg.a()V
            helperContext = 'jm.B(-29113)';
            // jm.c(I)V
            releaseReferences(TitleScreen, 'm_loadString');
            releaseReferences(LocalisedText, 'frenchLoadedWordpack');
            TitleScreen['loadingTextDefault'] = null;
            releaseReferences(LocalisedText, 'germanStarted3dLibrary');
            helperContext = 'ib.B(30351)';
            // ib.a(I)V
            releaseReferences(LocalisedText, 'walkHere');
            releaseReferences(Minimenu, 'playerArrow');
            ComponentDrag.component = null;
            releaseReferences(ReceivePlayerPositions, 'm_lastID');
            releaseReferences(LocalisedText, 'englishWalkHere');
            releaseReferences(ObjType, 'iconCountYellow');
            releaseReferences(ClientScript, 'm_cache');
            DisplayMode.available = null;
            MonochromeImageCache.dummy = null;
            helperContext = 'id.C(-26723)';
            // id.a(I)V
            QuickChatPhraseTypeList.decoder = null;
            releaseReferences(CinematicCamera, 'paths');
            world.mainGroundh = null;
            Client.js5NetQueue = null;
            releaseReferences(NpcType, 'layerFrameIds');
            releaseReferences(Client, 'fpsOnCommand');
            helperContext = null;
            AnimFrame.unload(); // ne.a()V
            helperContext = 'r.A(false)';
            // r.a(Z)V
            releaseReferences(LocalisedText, 'englishLoadingWorldListData');
            releaseReferences(PlayerModel, 'layerSeqs');
            releaseReferences(LocalisedText, 'loadingWorldListData');
            helperContext = null;
            // ul.a()V
            Client.windowResourceCache = null;
            helperContext = null;
            // eslint-disable-next-line @typescript-eslint/no-require-imports -- HD ql stays deferred until client.c(I)V in Client.releaseHdStatics.
            (require('#/dash3d/GlModelStream') as typeof import('#/dash3d/GlModelStream')).default.releaseHdStatics(-17148); // ql.a(I)V
            helperContext = null;
            GroundShadowsClass.release(); // tj.b()V
            GroundShadowBlock.unload(); // wm.a()V
            helperContext = 'kh.E(119)';
            // kh.a(I)V
            Client.designAppearanceInstance = null;
            releaseReferences(LocalisedText, 'frenchAttack');
            helperContext = 'p.C(-82)';
            // p.b(I)V
            releaseReferences(Client, 'serverJs5DropCommand');
            Client.m_hookQueue = null;
            helperContext = null;
            LongNode.releaseLongNodeStatics(1000); // eb.c(I)V
            helperContext = null;
            DelayedStateChange.releaseHdStatics(3); // da.f(I)V
            helperContext = null;
            ClientInvCache.releaseClientInvCacheStatics(-128); // qe.c(I)V
            helperContext = null;
            Bgsound.releasebgsoundStatics(-3); // fl.d(I)V
            helperContext = 'g.B(8642)';
            // g.a(I)V
            releaseReferences(LocalisedText, 'germanFriendsFull');
            helperContext = null;
            ClientScript.releaseClientScriptStatics(-30497); // qc.d(I)V
            helperContext = null;
            loadTone().clear(); // pj.a()V
            helperContext = 'wb.B(-196)';
            // wb.a(I)V
            releaseReferences(LocalisedText, 'cancel');
            releaseReferences(CookieStatics, 'dateDash');
            releaseReferences(Client, 'afterCleanup');
            releaseReferences(ReceivePlayerPositions, 'm_tempP');
            TitleFlames.flameBuffer0 = null;
            WorldMap.font26 = null;
            Client.locMapPrefix = null;
            FriendChatChannel.ownerName = null;
            releaseReferences(LocalisedText, 'englishCancel');
            helperContext = 'la.F(73)';
            // la.a(B)V
            releaseReferences(DelayedStateChange, 'delayed');
            world.levelTileOcclusionCycles = null;
            releaseReferences(LocalisedText, 'frenchLoadingWordpack', 'germanAlreadyIgnored');
            helperContext = null;
            loadGlRaster().unload(); // dj.b()V
            helperContext = 'gk.E(81)';
            // gk.a(B)V
            Client.imageMapflag = null;
            releaseReferences(RouteFinding, 'm_listz');
            releaseReferences(LocalisedText, 'germanChatcol10');
            EnumType.m_pConfigClient = null;
            helperContext = null;
            ClientProj.releaseHdStatics(true); // ra.b(Z)V
            helperContext = null;
            MapSpotAnim.releaseMapSpotAnimStatics(0); // bh.b(I)V
            helperContext = 'og.E(true)';
            // og.a(Z)V
            releaseReferences(LocalisedText, 'germanLoggedOut');
            ScriptRunner.stringLocals = null;
            InterfaceList.mouseOverComponent = null;
            helperContext = 'uj.C(83)';
            // uj.a(B)V
            releaseReferences(ScriptRunner, 'intStack');
            SpriteLoader.widths = null;
            releaseReferences(world, 'midDep32');
            releaseReferences(Minimenu, 'option');
            releaseReferences(ScriptRunner, 'nullString');
            Client.quickChatArchive = null;
            helperContext = null;
            PendingLocMerge.releasePendingLocMergeStatics(-120); // cn.d(B)V
            helperContext = null;
            ClientLocAnim.releaseClientLocAnimStatics(2); // dc.b(I)V
            helperContext = 'rb.A(true)';
            // rb.a(Z)V
            releaseReferences(Client, 'serverActiveProperties');
            MidiManager.m_pPatches = null;
            releaseReferences(LocalisedText, 'germanHidden');
            helperContext = null;
            HashTableIterator.releaseHdStatics(-94); // l.b(B)V
            helperContext = null;
            StringNode.releaseStringNodeStatics(-22749); // sj.d(I)V
            helperContext = 'sh.D(3846)';
            // sh.a(I)V
            Client.headiconsPrayerName = null;
            releaseReferences(MapArea, 'areas');
            releaseReferences(TerrainBuilder, 'overlayShapes');
            releaseReferences(GameShell, 'm_updateTime');
            releaseReferences(JagString, 'empty2');
            helperContext = null;
            IntNode.releaseIntNodeStatics(1); // ka.c(I)V
            helperContext = 'lh.B(0)';
            // lh.c(I)V
            AudioEngine.effectsPlayer = null;
            releaseReferences(Client, 'percentOpenParen');
            releaseReferences(LocalisedText, 'germanChateffect4');
            helperContext = null;
            GameCanvas.releaseHdStatics(-87); // tm.a(B)V
            helperContext = 'oi.A(13123)';
            // oi.c(I)V
            Minimenu.skinTitleEndSprite2 = null;
            releaseReferences(Client, 'wm1Command', 'qaOpTestCommand');
            releaseReferences(LocalisedText, 'frenchChatcol3');
            helperContext = null;
            // eslint-disable-next-line @typescript-eslint/no-require-imports -- SD gl stays deferred until client.c(I)V in Client.releaseHdStatics.
            (require('./MillisTimer') as typeof import('./MillisTimer')).default.releaseMillisTimerStatics(14635); // lj.c(I)V
            helperContext = null;
            // eslint-disable-next-line @typescript-eslint/no-require-imports -- SD ck stays deferred until client.c(I)V in Client.releaseHdStatics.
            (require('#/graphics/ImageProducerPixMap') as typeof import('#/graphics/ImageProducerPixMap')).default.releaseImageProducerPixMapStatics(27316); // di.b(I)V
            helperContext = 'qj.A(12881)';
            // qj.a(I)V
            releaseReferences(ClientKeyboardListener, 'chars');
            releaseReferences(LocalisedText, 'germanLoadedTextures', 'frenchChatcol1');
            releaseReferences(PlayerModel, 'crc64Table');
            helperContext = null;
            PointNormal.releaseHdStatics(81); // hd.a(B)V
            helperContext = null;
            IntHashTable.releaseHdStatics(122); // jg.a(B)V
            helperContext = null;
            ByteArrayCopier.releaseHdStatics(67); // u.a(B)V
            helperContext = null;
            BZip2Decompressor.clear(); // oc.a()V
            helperContext = null;
            BZip2State.releaseHdStatics(2); // bb.b(I)V
            helperContext = null;
            ReferenceNode.releaseReferenceNodeStatics(3); // gf.d(I)V
            helperContext = null;
            HardReferenceNode.releaseHardReferenceNodeStatics(-119); // he.f(I)V
            helperContext = null;
            ReferenceNodeFactory.releaseHdStatics(0); // q.a(I)V
            helperContext = null;
            PatchNoteSet.releasePatchNoteSetStatics(2); // ea.c(I)V
            helperContext = null;
            EnvelopeSet.releaseHdStatics(-128); // wh.a(B)V
            helperContext = null;
            NativePcmPlayer.clear(); // hl.e()V
            Filter.clear(); // nl.a()V
            helperContext = 'dh.B(26)';
            // dh.a(I)V
            releaseReferences(Client, 'entityUpdateIds', 'modCrownTag', 'playerCachePrefix');
            helperContext = 'vf.A(-69)';
            // vf.a(B)V
            releaseReferences(BASTypeList, 'types');
            releaseReferences(LocalisedText, 'chatcol10', 'attempt_to_reestablish', 'englishAttemptToReestablish', 'englishChatcol10');
            releaseReferences(PlayerModel, 'layerFrameDelays');
            QuickChatPhraseTypeList.global = null;
            releaseReferences(LocType, 'm_mc3');
            releaseReferences(LocalisedText, 'defaultChatcol10');
            releaseReferences(NpcType, 'headModelCache');
            helperContext = null;
            WaterProgramMaterial.unload(); // rd.d()V
            HighDetailWaterMaterial.unload(); // pd.e()V
            helperContext = 'ob.J(-113)';
            // ob.b(B)V
            releaseReferences(IfType, 'emptyString');
            TextureOpSprite.spriteArchive = null;
            releaseReferences(OrbitCamera, 'shake');
            releaseReferences(ScriptRunner, 'gosubErrorPrefix');
            releaseReferences(LocalisedText, 'germanSkill');
            releaseReferences(Client, 'urlAffiliatePart');
            helperContext = 'ja.B(-112)';
            // ja.a(I)V
            releaseReferences(GameWorld, 'httpPrefix');
            releaseReferences(LocalisedText, 'frenchTradeRequest');
            Client.mouseExit = null;
            releaseReferences(LocalisedText, 'frenchAlreadyFriend');
            releaseReferences(WorldMap, 'fpsLabel');
            releaseReferences(LocalisedText, 'frenchSelect');
            releaseReferences(ReceivePlayerPositions, 'm_apCache');
            releaseReferences(LocalisedText, 'frenchLevel');
            helperContext = null;
            JagVorbis.clear(); // jc.a()V
            Floor.clear(); // ie.a()V
            helperContext = null;
            TextureOpPerlinNoise.releaseTextureOpPerlinNoiseStatics(false); // bi.a(Z)V
            helperContext = 'vl.C(true)';
            // vl.a(Z)V
            RoofModeStatics.roofMaxX = null;
            releaseReferences(WordPack, 'cabbage');
            releaseReferences(ClientBuild, 'WSHAPE0');
            Client.modelsArchive = null;
            releaseReferences(AnimFrameSet, 'cache');
            helperContext = null;
            TextureOp.releaseTextureOpStatics(2); // j.d(I)V
            helperContext = null;
            Noise3D.releaseNoise3DStatics(4); // wf.b(I)V
            helperContext = null;
            ColourImageCache.releaseHdStatics(102); // nd.c(B)V
            helperContext = null;
            MonochromeImageCache.releaseHdStatics(65536); // pf.a(I)V
            helperContext = null;
            EnumStringEntry.releaseEnumStringEntryStatics(-46); // hb.d(I)V
            helperContext = null;
            ProceduralTexture.releaseHdStatics(false); // lc.a(Z)V
            helperContext = null;
            AbstractWorld.releaseAbstractWorldStatics(-115); // gj.a(B)V
            helperContext = null;
            RidgedMultifractal3D.releaseRidgedMultifractal3DStatics(-74); // we.c(B)V
            helperContext = null;
            FractalNoise3D.releaseFractalNoise3DStatics(128); // vd.d(I)V
            helperContext = 'ef.A(-67)';
            // ef.a(B)V
            releaseReferences(LocalisedText, 'defaultChateffect4', 'chateffect4', 'level');
            releaseReferences(Minimenu, 'paramC');
            releaseReferences(LocalisedText, 'englishLevel', 'frenchLoadingInterfaces');
            MinimapBuilder.pendingImage = null;
            ComponentDrag.target = null;
            releaseReferences(Client, 'FACING_MAP');
            releaseReferences(LocalisedText, 'skill', 'englishChateffect4');
            releaseReferences(Protocol, 'duelStakeTag');
            releaseReferences(Client, 'jsUnzap');
            releaseReferences(LocalisedText, 'englishSkill');
            AudioEngine.decimator = null;
            releaseReferences(SpotType, 'm_modelCache');
            helperContext = 'ed.Q(-109)';
            // ed.d(I)V
            releaseReferences(LocalisedText, 'germanLoadedWordpack');
            releaseReferences(MapArea, 'details');
            releaseReferences(Client, 'colEndTimes');
            helperContext = 'fc.A(37821)';
            // fc.a(I)V
            releaseReferences(LocalisedText, 'germanLoadingInterfaces');
            releaseReferences(Client, 'modIconTag');
            releaseReferences(LocalisedText, 'frenchUse');
            helperContext = 'ig.C(26)';
            // ig.a(B)V
            releaseReferences(LocalisedText, 'englishContinue', 'germanLoadingPleaseWait2', 'continue');
            helperContext = null;
            TextureOpMonochromeFill.releaseTextureOpMonochromeFillStatics(-2); // mi.h(I)V
            helperContext = null;
            TextureOpColour.releaseTextureOpColourStatics(1); // fm.h(I)V
            helperContext = null;
            TextureOpHorizontalGradient.releaseTextureOpHorizontalGradientStatics(7759444); // rl.h(I)V
            helperContext = null;
            TextureOpVerticalGradient.releaseTextureOpVerticalGradientStatics(true); // qg.a(Z)V
            helperContext = null;
            TextureOpBricks.releaseTextureOpBricksStatics(-125); // mc.h(I)V
            helperContext = 'nm.C(110)';
            // nm.f(B)V
            Client.npcSpawnGroupIds = null;
            releaseReferences(Minimenu, 'red');
            releaseReferences(LocalisedText, 'germanClose');
            releaseReferences(Client, 'npcs');
            Client.pendingUrl = null;
            helperContext = null;
            TextureOpClamp.releaseTextureOpClampStatics(11597); // aj.h(I)V
            helperContext = null;
            TextureOpCombine.releaseTextureOpCombineStatics(-107); // pi.f(B)V
            helperContext = null;
            TextureOpCurve.releaseTextureOpCurveStatics(false); // wi.b(Z)V
            helperContext = 'ej.O(true)';
            // ej.a(Z)V
            releaseReferences(LocalisedText, 'frenchChatcol7');
            helperContext = null;
            TextureOpColourGradient.releaseTextureOpColourGradientStatics(48); // um.i(I)V
            helperContext = null;
            TextureOpColourize.releaseTextureOpColourizeStatics(-1443422260); // mg.h(I)V
            helperContext = null;
            TextureOpWaveform.releaseTextureOpWaveformStatics(-1771542303); // ag.i(I)V
            helperContext = null;
            TextureOpNoise.releaseTextureOpNoiseStatics(-15028); // rj.h(I)V
            helperContext = null;
            TextureOpWeave.releaseTextureOpWeaveStatics(-21136); // sa.h(I)V
            helperContext = null;
            TextureOpVoronoiNoise.releaseTextureOpVoronoiNoiseStatics(0); // hm.h(I)V
            helperContext = null;
            TextureOpHerringbone.releaseTextureOpHerringboneStatics(79); // f.f(B)V
            helperContext = null;
            TextureOpHslAdjust.releaseTextureOpHslAdjustStatics(74); // hk.f(B)V
            helperContext = 'kd.E(false)';
            // kd.a(Z)V
            releaseReferences(LocalisedText, 'englishAllocatingMemory', 'frenchConnectedToUpdateServer', 'allocatingMemory');
            releaseReferences(world, 'middep128');
            releaseReferences(NpcType, 'slotNextFramesets');
            helperContext = null;
            TextureOpSprite.releaseTextureOpSpriteStatics(-41); // nh.f(B)V
            helperContext = null;
            TextureOpPolarDistortion.releaseTextureOpPolarDistortionStatics(-97); // ke.h(I)V
            helperContext = null;
            TextureOpTile.releaseTextureOpTileStatics(-3); // gg.h(I)V
            helperContext = null;
            TextureOpInvert.releaseTextureOpInvertStatics(2); // tb.i(I)V
            helperContext = null;
            TextureOpKaleidoscope.releaseTextureOpKaleidoscopeStatics(-127); // je.i(I)V
            helperContext = null;
            TextureOpMonochrome.releaseTextureOpMonochromeStatics(true); // fn.a(Z)V
            helperContext = null;
            TextureOpColourKey.releaseTextureOpColourKeyStatics(-54); // sk.f(B)V
            helperContext = null;
            TextureOpBinary.releaseTextureOpBinaryStatics(1); // ca.i(I)V
            helperContext = null;
            TextureOpStripes.releaseTextureOpStripesStatics(122); // d.f(B)V
            helperContext = null;
            TextureOpIrregularBricks.releaseTextureOpIrregularBricksStatics(-9); // ol.h(I)V
            helperContext = null;
            TextureOpShapes.releaseTextureOpShapesStatics(0); // si.h(I)V
            helperContext = null;
            TextureOpRange.releaseTextureOpRangeStatics(1024); // fh.h(I)V
            helperContext = null;
            TextureOpMandelbrot.releaseTextureOpMandelbrotStatics(9423); // gm.i(I)V
            helperContext = null;
            TextureOpEmboss.releaseTextureOpEmbossStatics(103); // pk.h(I)V
            helperContext = null;
            TextureOpNormalMap.releaseTextureOpNormalMapStatics(119); // an.f(B)V
            helperContext = null;
            TextureOpEdgeDetector.releaseTextureOpEdgeDetectorStatics(30); // pg.f(B)V
            helperContext = null;
            TextureOpTexture.releaseTextureOpTextureStatics(85); // ui.f(B)V
            helperContext = null;
            TextureOpDiagonalWaves.releaseTextureOpDiagonalWavesStatics(-91); // mh.g(B)V
            helperContext = null;
            TextureOpLineNoise.releaseTextureOpLineNoiseStatics(-1); // vc.h(I)V
            helperContext = 'dk.B(-83)';
            // dk.a(B)V
            Client.settings = null;
            releaseReferences(LocalisedText, 'germanChatcol6');
            releaseReferences(Client, 'cacheIndexFiles');
            helperContext = 'wd.L(30358)';
            // wd.a(I)V
            releaseReferences(ParamType, 'm_recentUse');
            releaseReferences(PlayerModel, 'partToSlot');
            releaseReferences(Client, 'errorTestCommand');
            releaseReferences(CookieStatics, 'cookiePrefixParam');
            releaseReferences(LocalisedText, 'germanUnableToFind');
            helperContext = 't.F(-120)';
            // t.c(B)V
            Protocol.oldSocket = null;
            releaseReferences(LocalisedText, 'friendsFull');
            TitleFlames.runeSprites = null;
            Client.updatedVarcStrings = null;
            releaseReferences(Minimenu, 'target');
            releaseReferences(FloType, 'm_list');
            releaseReferences(Client, 'privateMessageIds');
            releaseReferences(LocalisedText, 'englishFriendsFull');
            releaseReferences(JagString, 'period');
            helperContext = 'fb.A(37)';
            // fb.a(B)V
            releaseReferences(Minimenu, 'redOrange');
            releaseReferences(ClientBuild, 'DECORZOF2');
            releaseReferences(ChatHistory, 'clans');
            SpriteLoader.alphas = null;
            releaseReferences(LocalisedText, 'germanMillionSuffixAmount');
            releaseReferences(CookieStatics, 'maxAgeAttribute');
            TextureOp.normalisedY = null;
            helperContext = 'ch.F(104)';
            // ch.a(B)V
            releaseReferences(OrbitCamera, 'shakePhase');
            releaseReferences(JagString, 'base37Alphabet');
            releaseReferences(InterfaceList, 'rectangleRedraw');
            releaseReferences(WorldList, 'colon');
            Client.tileActorCount = null;
            helperContext = 'ah.C(false)';
            // ah.a(Z)V
            releaseReferences(ClientVarCache, 'm_var');
            releaseReferences(LocalisedText, 'englishChatcol11');
            releaseReferences(CursorType, 'spriteCache');
            releaseReferences(world, 'drawTileQueue');
            releaseReferences(GameShell, 'm_drawTime');
            releaseReferences(LocalisedText, 'defaultChatcol11');
            SpriteLoader.pixels = null;
            releaseReferences(LocalisedText, 'frenchRemoveFriend', 'chatcol11');
            helperContext = null;
            ClientObjNode.releaseClientObjNodeStatics(-122); // pa.f(B)V
            helperContext = null;
            ClientProjNode.releaseClientProjNodeStatics(109); // ud.e(I)V
            helperContext = null;
            MapSpotAnimNode.releaseMapSpotAnimNodeStatics(99); // bk.d(I)V
            helperContext = 'oj.B(true)';
            // oj.a(Z)V
            FluType.m_pConfigClient = null;
            Texture.animBuffer = null;
            world.terrainBatches = null;
            releaseReferences(Skill, 'used');
            helperContext = null;
            BrokenInputStream.releaseHdStatics(-93); // qk.a(I)V
            helperContext = null;
            // eslint-disable-next-line @typescript-eslint/no-require-imports -- SD sf stays deferred until client.c(I)V in Client.releaseHdStatics.
            (require('#/io/BrokenOutputStream') as typeof import('#/io/BrokenOutputStream')).default.releaseHdStatics(true); // vg.a(Z)V
            helperContext = null;
            SecondaryByteArrayNode.releaseSecondaryByteArrayNodeStatics(-11346); // hc.e(I)V
            helperContext = null;
            ColourImageCacheEntry.releaseColourImageCacheEntryStatics(25); // lb.c(I)V
            helperContext = null;
            MonochromeImageCacheEntry.releaseMonochromeImageCacheEntryStatics(121); // qi.d(B)V
            helperContext = null;
            TextureShape.releaseTextureShapeStatics(-115); // kf.a(B)V
            helperContext = null;
            TextureShapeLine.releaseTextureShapeLineStatics(false); // ci.a(Z)V
            helperContext = null;
            TextureShapeBezier.releaseTextureShapeBezierStatics(100); // re.b(B)V
            helperContext = null;
            TextureShapeRect.releaseTextureShapeRectStatics(75); // ta.b(B)V
            helperContext = 'kc.B(-71)';
            // kc.a(I)V
            releaseReferences(LocalisedText, 'frenchThousandsSuffix2');
            releaseReferences(TerrainBuilder, 'shapeEdges');
            world.squares = null;
            WorldMap.font22 = null;
            WorldMap.font17 = null;
            Client.m_pMidi = null;
            TextureOp.cosine = null;
        } catch (error) {
            if (helperContext === null || !isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, helperContext);
        }
    }

    // client.a(Z)V. p.a(IZ)V always supplies true. Each group preserves the
    // order of the corresponding original shutdown call and its reference stores.
    protected releaseStatics(): void {
        try {
            if (glJar) return Client.releaseHdStatics();
            // client.e(B)V
            Client.pendingUrl = null;
            releaseReferences(LocalisedText, 'tradeRequest');
            world.cornerVisibility = null;
            releaseReferences(LocalisedText, 'englishTradeRequest');
            // id.e(I)V
            releaseReferences(ClientKeyboardListener, 'changes');
            releaseReferences(LocalisedText, 'frenchAlreadyFriend');
            Client.umMapPrefix = null;
            // oc.a(I)V
            releaseReferences(WorldList, 'urlJsSegment');
            WorldList.worlds = null;
            WorldList.countries = null;
            releaseReferences(ClientVarCache, 'm_varServ');
            // gh.d(I)V
            Client.tooltipComponent = null;
            releaseReferences(IfType, 'emptyString');
            releaseReferences(ClientBuild, 'WSHAPE0');
            RoofModeStatics.roofMaxX = null;
            WorldMap.overview = null;
            SpriteLoader.mapfunctionsRecoloured = null;
            releaseReferences(LocalisedText, 'germanChatcol3');
            GameShell.timer = null;
            // kc.a(Z)V
            releaseReferences(ScriptRunner, 'frames');
            releaseReferences(LocalisedText, 'examine');
            releaseReferences(CookieStatics, 'maxAgeAttribute');
            releaseReferences(LocalisedText, 'englishExamine');
            // p.b(I)V
            releaseReferences(CookieStatics, 'nov');
            releaseReferences(LocalisedText, 'defaultChatcol1');
            releaseReferences(CookieStatics, 'sep', 'jan');
            releaseReferences(LocalisedText, 'chatcol1');
            releaseReferences(CookieStatics, 'oct');
            CookieStatics.monthNames = null;
            releaseReferences(CookieStatics, 'jul', 'mar');
            Client.sceneMapUnderwaterLocFile = null;
            releaseReferences(CookieStatics, 'jun');
            releaseReferences(LocalisedText, 'germanHidden');
            releaseReferences(CookieStatics, 'may');
            releaseReferences(Minimenu, 'actions');
            releaseReferences(CookieStatics, 'dec');
            releaseReferences(LocalisedText, 'englishChatcol1');
            releaseReferences(CookieStatics, 'apr', 'aug', 'feb');
            // e.c(I)V
            releaseReferences(LocalisedText, 'germanFriendFirst');
            Client.updatedVarcs = null;
            PixScreen.unload(1000); // oh.a(I)V
            // ag.a(I)V
            releaseReferences(Client, 'rebuildCommand');
            SeqType.m_pConfigClient = null;
            releaseReferences(Client, 'dynamicChunks');
            PixfontGeneric.nameIcons = null;
            GameWorld.worldListBuffer = null;
            // kf.a(Z)V
            releaseReferences(LocalisedText, 'englishAllocatingMemory', 'allocatingMemory');
            Client.floorshadowsSpriteName = null;
            releaseReferences(PlayerModel, 'femaleBodyParts');
            // gd.f(I)V
            releaseReferences(LocalisedText, 'englishLoadingWordpack', 'loadingWordpack');
            LocType.m_pConfigClient = null;
            releaseReferences(Client, 'debugCacheLabel');
            Client.jingleArchive = null;
            // se.e(I)V
            releaseReferences(LocalisedText, 'frenchStarted3dLibrary', 'germanAttack');
            releaseReferences(Client, 'urlSlash');
            releaseReferences(LocalisedText, 'frenchLoadedSprites', 'germanChatcol8');
            // ej.b(I)V
            releaseReferences(LocalisedText, 'germanMenuSeparator', 'germanChatcol4');
            Client.mouseTracking = null;
            releaseReferences(world, 'middep64');
            // ca.a(I)V
            InterfaceList.pressedContinue = null;
            releaseReferences(LocalisedText, 'frenchLoadingSprites', 'frenchLoadedInterfaces');
            GameShell.errorSignlink = null;
            // wi.c(I)V
            releaseReferences(LocalisedText, 'frenchSelfIgnore');
            // mc.d(I)V
            releaseReferences(JagString, 'empty2');
            releaseReferences(CookieStatics, 'timeSeparator');
            releaseReferences(Client, 'huffmanGroup');
            // al.a(I)V
            Client.m_pMidi = null;
            Minimenu.targetName = null;
            ClientLocAnim.defaultShadow = null;
            MidiManager.cache = null;
            ScriptRunner.activeComponent = null;
            releaseReferences(ObjType, 'recolourPalette');
            // sa.b(B)V
            LRUHashCache.referenceFactory = null;
            releaseReferences(WorldMap, 'labelLines');
            releaseReferences(Minimenu, 'keys');
            PlayerModel.recolourSources = null;
            // cg.a(B)V
            releaseReferences(LocalisedText, 'germanLoadingFonts');
            releaseReferences(WorldMapLabels, 'lineBreakTag');
            releaseReferences(ClientPlayer, 'nameAffixSlotCounts');
            releaseReferences(Client, 'projectiles');
            // ve.a(Z)V
            MidiManager.stream = null;
            Client.npcConfigArchive = null;
            releaseReferences(LocalisedText, 'PLEASEWAIT');
            releaseReferences(Client, 'hintArrows');
            releaseReferences(LocalisedText, 'englishPleaseWait');
            world.levelHeightmaps = null;
            releaseReferences(LocalisedText, 'frenchHidden');
            // bk.a(Z)V
            releaseReferences(LocalisedText, 'germanExamine');
            releaseReferences(Minimenu, 'playerOption');
            // be.u(B)V
            Client.hintMapedgeSpriteName = null;
            // ke.a(B)V
            releaseReferences(Client, 'urlProtocol');
            CursorType.configArchive = null;
            world.waterSpriteKeys = null;
            ClientBuild.m_shadow = null;
            releaseReferences(QuickChatPhraseTypeList, 'phrases');
            SpriteLoader.palette = null;
            releaseReferences(GameWorld, 'm_list');
            // aj.a(B)V
            FluType.m_pConfigClient = null;
            world.roofHideMaxZ = null;
            Client.tileActorCount = null;
            releaseReferences(Client, 'zeroPercent');
            GameShell.fullScreenFrame = null;
            // pb.h(B)V
            releaseReferences(NpcType, 'headModelCache');
            IfType.m_pFontMetrics = null;
            // gk.b(I)V
            releaseReferences(PlayerModel, 'recolourDestinationsAlt');
            releaseReferences(InterfaceList, 'rootWidth');
            releaseReferences(LocalisedText, 'germanUnableToFind');
            releaseReferences(PlayerModel, 'recolourDestinations2Alt');
            releaseReferences(Client, 'soundEffectPositions', 'playerCacheCommand');
            releaseReferences(Minimenu, 'lime');
            // vc.c(B)V
            releaseReferences(Client, 'colEndTimes');
            RoofModeStatics.roofMinX = null;
            releaseReferences(LocalisedText, 'loadedTitleScreen');
            releaseReferences(Client, 'levelExperience');
            releaseReferences(LocalisedText, 'englishMembersObject', 'membersObject', 'englishLoadedTitleScreen');
            // nc.c(I)V
            releaseReferences(LocalisedText, 'englishDiscard', 'loadingConfig', 'discard');
            releaseReferences(AreaSoundManager, 'locs');
            releaseReferences(LocalisedText, 'englishLoadingConfig');
            releaseReferences(Client, 'percent4');
            // le.b(I)V
            releaseReferences(LocalisedText, 'preparedSoundEngine');
            DataFile.sectorBuffer = null;
            releaseReferences(LocalisedText, 'TAG_BREAK', 'use', 'englishUse', 'englishPreparedSoundEngine');
            // rf.a(I)V
            releaseReferences(WorldMap, 'icons');
            releaseReferences(Client, 'percentOpenParen', 'modIconTag', 'fpsCommand');
            // ea.a(I)V
            releaseReferences(LocalisedText, 'continue');
            TitleScreen.logoName = null;
            TitleFlames.flameBuffer = null;
            releaseReferences(LocalisedText, 'englishContinue');
            // dg.e(I)V
            world.spriteBuffer = null;
            releaseReferences(LocalisedText, 'loadingFonts');
            Client.activeClient = null;
            releaseReferences(LocalisedText, 'englishLoadingFonts');
            // hd.a(I)V
            releaseReferences(ClientKeyboardListener, 'chars');
            releaseReferences(Minimenu, 'locColour');
            releaseReferences(Protocol, 'inPacket');
            // cl.a(I)V
            releaseReferences(Client, 'archiveLoadWeights');
            releaseReferences(LocalisedText, 'frenchContinue');
            // ek.a(I)V
            releaseReferences(Client, 'shiftClickEnabled');
            releaseReferences(CookieStatics, 'dateDaySeparator');
            releaseReferences(Client, 'clientJs5DropCommand', 'replaceCanvasCommand');
            world.hideAreaMaxX = null;
            releaseReferences(LocalisedText, 'frenchExamine');
            Client.binaryArchive = null;
            MinimapBuilder.minimapImage = null;
            TitleFlames.runesName = null;
            Client.stream = null;
            // ob.b(B)V
            releaseReferences(LocalisedText, 'germanLoadedTextures');
            releaseReferences(ClientKeyboardListener, 'pressed');
            releaseReferences(PlayerModel, 'slotNextFrames');
            MinimapBuilder.pendingImage = null;
            // ra.a(I)V
            releaseReferences(LocalisedText, 'loadedFonts', 'englishFriendsFull');
            Client.mouseExit = null;
            releaseReferences(LocalisedText, 'friendsFull');
            releaseReferences(Client, 'niceNumberSuffix');
            releaseReferences(ObjType, 'modelCache');
            IdkType.m_pConfigClient = null;
            Minimenu.styleSideSprite = null;
            releaseReferences(LocalisedText, 'englishLoadedFonts');
            // jb.a(I)V
            ClientPlayer.titlePrefixes = null;
            releaseReferences(LocalisedText, 'germanRemoveFriend');
            // ff.a(I)V
            releaseReferences(LocalisedText, 'englishWalkHere', 'germanOk', 'frenchChateffect1', 'walkHere');
            releaseReferences(Client, 'soundEffectIds');
            SpriteLoader.yOffsets = null;
            releaseReferences(WorldMap, 'comma');
            releaseReferences(Client, 'urlDomainSuffix');
            Js5RemoteLoader.crc32 = null;
            Client.imageCompass = null;
            // ja.c(B)V
            releaseReferences(PlayerModel, 'crc64Table');
            Client.titleSongName = null;
            releaseReferences(LocalisedText, 'germanChatcol10');
            // qd.b(Z)V
            releaseReferences(LocalisedText, 'englishLoadingPleaseWait2', 'loadingPleaseWait2');
            releaseReferences(RouteFinding, 'm_distMap');
            // l.a(I)V
            releaseReferences(LocalisedText, 'defaultChateffect1', 'englishChateffect1', 'chateffect1', 'frenchLoadingInterfaces');
            // jf.a(Z)V
            releaseReferences(LocalisedText, 'loadedTextures', 'englishLoadedTextures');
            releaseReferences(Client, 'shiftClickDisabled');
            releaseReferences(LocalisedText, 'started3dLibrary');
            releaseReferences(Client, 'friendWorld');
            releaseReferences(LocalisedText, 'englishStarted3dLibrary');
            TextureOpSprite.spriteArchive = null;
            releaseReferences(LocalisedText, 'loadedConfig', 'englishLoadedConfig');
            // tb.d(I)V
            ClientBuild.m_mapl = null;
            GameShell.frame = null;
            SpriteLoader.alphas = null;
            releaseReferences(LocalisedText, 'germanChateffect4', 'frenchLoggedOut');
            releaseReferences(NpcType, 'slotFrameDelays');
            WorldMap.underlayColors = null;
            releaseReferences(Minimenu, 'yellowGreen');
            releaseReferences(WorldMap, 'overlay');
            releaseReferences(Minimenu, 'closeParen');
            releaseReferences(BASTypeList, 'defaultType');
            // ij.a(B)V
            PlayerModel.recolourDestinations2 = null;
            TitleFlames.runeSprites = null;
            BZip2Decompressor.block = null;
            // wg.a(B)V
            releaseReferences(LocalisedText, 'germanChateffect1');
            GameShell.progressFontMetrics = null;
            PlayerModel.recolourSources2 = null;
            releaseReferences(ByteArrayPool, 'small');
            // hf.c(B)V
            world.roofMinX = null;
            releaseReferences(ScriptRunner, 'lengths');
            // ci.a(I)V
            releaseReferences(WorldList, 'zero');
            releaseReferences(BrowserControl, 'tbrefresh');
            GameShell.progressImage = null;
            // ae.a(B)V
            ObjType.m_countFont = null;
            releaseReferences(LocalisedText, 'MOREOPTIONS');
            Client.npcSpawnGroupIds = null;
            EnumType.m_pConfigClient = null;
            releaseReferences(LocalisedText, 'englishMoreOptions');
            // h.a(B)V
            IfType.m_pSprites = null;
            Client.m_pSprites = null;
            TextureOp.sinTable = null;
            releaseReferences(CookieStatics, 'cookiePathDomain');
            // sg.b(I)V
            releaseReferences(LocalisedText, 'frenchChatcol6', 'frenchLoading', 'frenchLoadedConfig');
            releaseReferences(Client, 'FACING_MAP');
            releaseReferences(LocalisedText, 'germanSelect');
            // ii.a(I)V
            releaseReferences(CursorType, 'spriteCache');
            releaseReferences(Client, 'beforeCleanup');
            Client.varpUpdates = null;
            releaseReferences(ClientBuild, 'DECORZOF2');
            releaseReferences(Client, 'entityUpdateIds');
            releaseReferences(LocalisedText, 'frenchPleaseWait');
            // n.a(I)V
            releaseReferences(LocalisedText, 'frenchLoadedFonts');
            MSITypeList.archive = null;
            LocType.defaultName = null;
            releaseReferences(LocalisedText, 'frenchLoadingPleaseWait');
            releaseReferences(RouteFinding, 'm_listx');
            releaseReferences(Minimenu, 'tooltipMoreSeparator');
            releaseReferences(DelayedStateChange, 'immediate');
            releaseReferences(LocalisedText, 'germanLoading');
            releaseReferences(CookieStatics, 'expiredCookieSuffix');
            releaseReferences(InterfaceList, 'rectRedrawnLastFrame');
            // q.a(B)V
            releaseReferences(LocalisedText, 'selfIgnore', 'englishSelfIgnore');
            ScriptRunner.crownTag0 = null;
            releaseReferences(LocalisedText, 'germanLoadingTextures');
            DataFile.masterIndexFile = null;
            // g.a(Z)V
            releaseReferences(CookieStatics, 'dateDash');
            MidiManager.m_pVorbis = null;
            releaseReferences(LocType, 'modelResult');
            releaseReferences(ScriptRunner, 'stringStack');
            // ai.a(I)V
            releaseReferences(Client, 'urlAffiliatePart');
            ScriptRunner.activeComponent2 = null;
            releaseReferences(WorldMap, 'space');
            TitleScreen.m_titleBack = null;
            releaseReferences(LocalisedText, 'germanUse');
            WorldMap.mapScenes = null;
            ClientMouseListener.instance = null;
            // tj.b(I)V
            GameShell.signlink = null;
            releaseReferences(GameShell, 'm_updateTime');
            releaseReferences(ClientBuild, 'DECORXOF');
            world.visibilityMap = null;
            // qc.f(I)V
            releaseReferences(WorldMap, 'teleportCommand');
            Client.mapNameSeparator = null;
            releaseReferences(LocalisedText, 'frenchFaceHere');
            // fd.f(I)V
            releaseReferences(LocalisedText, 'frenchLoadingPleaseWait2', 'germanCreatedGameworld');
            releaseReferences(Minimenu, 'hidden');
            Client.mapBuildGroundFile = null;
            releaseReferences(Client, 'serverActiveProperties');
            releaseReferences(LocalisedText, 'englishAttack', 'frenchLoadingFonts', 'attack');
            // uj.b(B)V
            releaseReferences(LocalisedText, 'frenchLoadedUpdateList');
            releaseReferences(ScriptRunner, 'emptyString');
            releaseReferences(LocType, 'm_mc3');
            // qh.a(B)V
            releaseReferences(LocalisedText, 'germanWalkHere');
            IdkType.m_pModels = null;
            releaseReferences(LocalisedText, 'frenchLoadingConfig');
            releaseReferences(NpcType, 'layerFramesets');
            releaseReferences(OrbitCamera, 'shake');
            // bh.b(I)V
            InterfaceList.viewportComponent = null;
            releaseReferences(LocalisedText, 'frenchChatcol9', 'frenchChatcol4');
            Client.enumsArchive = null;
            releaseReferences(ScriptRunner, 'scriptErrorMessage');
            ScriptRunner.activeQuickChatMessage = null;
            ModelUnlit.unload(); // cb.l()V
            // wj.a(B)V
            releaseReferences(Client, 'gcCommand', 'fpsOffCommand');
            releaseReferences(Minimenu, 'amber');
            releaseReferences(Client, 'tweenCommand');
            Client.p12 = null;
            GameShell.progressFont = null;
            // kl.a(I)V
            releaseReferences(LocalisedText, 'englishUnableToFind');
            releaseReferences(WorldMap, 'loc');
            world.squares = null;
            releaseReferences(ServerActiveProperties, 'DEFAULT');
            releaseReferences(LocalisedText, 'unableToFind', 'germanSelfFriend');
            ModelLitImpl.unload(); // fc.m()V
            // vb.a(Z)V
            releaseReferences(Minimenu, 'objArrow');
            world.tileCameraClearance = null;
            Client.imageMapfunction = null;
            TextureOp.permutationCache = null;
            // uk.a(I)V
            releaseReferences(NpcType, 'm_modelCache');
            releaseReferences(LocalisedText, 'englishFriendFirst', 'friendFirst');
            AnimFrameSet.basesArchive = null;
            // ed.a(B)V
            releaseReferences(InvType, 'm_recentUse');
            releaseReferences(LocalisedText, 'frenchLoadedTitleScreen');
            releaseReferences(SpriteLoader, 'compassName');
            TitleFlames.flameLineOffset = null;
            releaseReferences(Protocol, 'allyReqSuffix');
            releaseReferences(Minimenu, 'tooltipBounds');
            // ll.b(B)V
            releaseReferences(LocalisedText, 'germanLoadingPleaseWait2');
            world.occluders = null;
            releaseReferences(Client, 'statXP');
            releaseReferences(OrbitCamera, 'shakeFrequency');
            releaseReferences(ReceivePlayerPositions, 'm_tempP');
            releaseReferences(LocType, 'temp');
            Client.js5Archive27 = null;
            Client.imageMapdots = null;
            // ld.a(I)V
            releaseReferences(LocalisedText, 'englishAttemptToReestablish');
            AudioEngine.effectsPlayer = null;
            releaseReferences(LocalisedText, 'attempt_to_reestablish');
            releaseReferences(world, 'midDep32');
            Client.statUpdates = null;
            // te.a(B)V
            releaseReferences(LocalisedText, 'englishSelfFriend', 'selfFriend');
            releaseReferences(HintArrow, 'modelCache');
            Client.js5SocketRequest = null;
            Client.localPlayer = null;
            releaseReferences(LocalisedText, 'germanChatcol2');
            // si.a(I)V
            releaseReferences(LocalisedText, 'chateffect4', 'defaultChateffect4', 'englishChateffect4', 'englishChooseOption');
            releaseReferences(LocalisedText, 'germanAllocatingMemory', 'frenchThousandsSuffix2', 'englishFaceHere', 'frenchSkill', 'faceHere');
            releaseReferences(LocalisedText, 'chooseOption');
            PixfontGeneric.unload(); // mb.a()V
            // rg.a(I)V
            Client.p11Software = null;
            releaseReferences(LocalisedText, 'germanChatcol5');
            Client.m_pJagFx = null;
            releaseReferences(LocalisedText, 'chatcol7');
            releaseReferences(Client, 'errorTestCommand');
            Client.updatedVarcStrings = null;
            releaseReferences(LocalisedText, 'frenchLoadingTitleScreen');
            releaseReferences(Protocol, 'serverPacketSizes');
            releaseReferences(LocalisedText, 'englishChatcol7');
            IfType.m_open = null;
            releaseReferences(world, 'minimapRotate');
            releaseReferences(LocalisedText, 'defaultChatcol7');
            GameShell.drawArea = null;
            releaseReferences(LocalisedText, 'germanStarted3dLibrary');
            // t.a(I)V
            TitleFlames.flameGradient = null;
            releaseReferences(Minimenu, 'groundArrow');
            Minimenu.targetVerb = null;
            ClientBuild.m_huetot = null;
            WorldMap.font22 = null;
            releaseReferences(LocalisedText, 'frenchChateffect5');
            releaseReferences(EnumType, 'm_recentUse');
            MidiParser.unload(); // el.c()V
            // ef.c(B)V
            AnimFrameSet.framesArchive = null;
            releaseReferences(Client, 'urlSettingsParam');
            // tg.b(Z)V
            releaseReferences(ScriptRunner, 'intStack');
            releaseReferences(LocalisedText, 'loadingPercentEnd', 'englishLevel', 'frenchSelect', 'level', 'germanChatcol1');
            // gb.c(I)V
            releaseReferences(LocalisedText, 'chatcol0');
            releaseReferences(ObjType, 'spriteCache');
            releaseReferences(LocalisedText, 'englishChatcol0', 'defaultChatcol0');
            WorldMapFont.unload(); // eg.c()V
            // ud.c(I)V
            releaseReferences(LocalisedText, 'frenchAttack');
            Client.js5DiskQueue = null;
            releaseReferences(LocalisedText, 'frenchSelfFriend', 'connectedToUpdateServer', 'englishConnectedToUpdateServer');
            releaseReferences(ObjType, 'objCountThousandsColTag');
            // db.c(I)V
            releaseReferences(LocalisedText, 'germanTake');
            releaseReferences(WorldMap, 'underlay');
            Client.timerEvents = null;
            releaseReferences(ClientVarCache, 'changes');
            // df.d(I)V
            releaseReferences(LocalisedText, 'frenchAlreadyIgnored');
            SpriteLoader.innerHeights = null;
            releaseReferences(CookieStatics, 'cookieSuffix');
            // ak.a(I)V
            releaseReferences(LocalisedText, 'frenchChatcol0');
            releaseReferences(Client, 'fpsLabel');
            releaseReferences(LightType, 'cache');
            releaseReferences(Client, 'emptyString');
            releaseReferences(ClientKeyboardListener, 'eventChars');
            releaseReferences(Minimenu, 'option');
            Pix2D.unload(); // td.a()V
            // lj.a(I)V
            releaseReferences(ClientBuild, 'DECORXOF2');
            releaseReferences(Minimenu, 'orangeRed');
            releaseReferences(LocType, 'm_mc1');
            ScriptRunner.img1Tag = null;
            releaseReferences(ScriptRunner, 'eventOpbase');
            MouseWheel.instance = null;
            releaseReferences(Client, 'js5Providers');
            releaseReferences(OrbitCamera, 'shakeRandom');
            // bi.b(I)V
            releaseReferences(WorldMapLabels, 'suffix');
            releaseReferences(Minimenu, 'tooltipRandom');
            Client.rsaExponent = null;
            // sj.b(Z)V
            releaseReferences(LocalisedText, 'germanChateffect5');
            releaseReferences(ScriptRunner, 'errorInLabel');
            releaseReferences(Client, 'memoryCommand');
            releaseReferences(LocalisedText, 'frenchLoadingTextures');
            Client.nameIconsName = null;
            // ei.a(I)V
            PlayerTask.active = null;
            Client.underwaterLocPrefix = null;
            Client.uidFile = null;
            // vj.a(Z)V
            releaseReferences(LocalisedText, 'frenchChatcol7', 'chateffect5');
            releaseReferences(ClientVarCache, 'm_var');
            releaseReferences(LocalisedText, 'defaultChateffect5', 'germanConnectingToUpdateServer');
            releaseReferences(Minimenu, 'playerAction');
            releaseReferences(LocalisedText, 'englishChateffect5');
            releaseReferences(FluType, 'm_list');
            // wa.a(Z)V
            releaseReferences(Client, 'percent3', 'statBaseLevel');
            Client.hintHeadicons = null;
            releaseReferences(LocalisedText, 'defaultChatcol6', 'chatcol6', 'frenchOpenedTitleScreen', 'englishChatcol6');
            // tk.a(I)V
            ObjType.wearables = null;
            GameShell.progressTitle = null;
            releaseReferences(LocalisedText, 'germanChatcol7');
            // rj.a(B)V
            releaseReferences(CookieStatics, 'mon');
            releaseReferences(Client, 'breakconCommand');
            releaseReferences(CookieStatics, 'wed', 'sat');
            releaseReferences(Client, 'privateMessageIds');
            releaseReferences(LocalisedText, 'germanMembersObject');
            releaseReferences(CookieStatics, 'thu');
            CookieStatics.dayNames = null;
            releaseReferences(CookieStatics, 'sun');
            world.roofHideMinZ = null;
            releaseReferences(CookieStatics, 'fri', 'tue');
            Client.headiconsPrayerName = null;
            // fi.b(B)V
            releaseReferences(Client, 'npcIds', 'commandPrefix');
            releaseReferences(CookieStatics, 'cookiePrefixParam');
            // af.c(I)V
            releaseReferences(Minimenu, 'countSeparator');
            WorldMap.overlayIds = null;
            releaseReferences(LocalisedText, 'englishChatcol5', 'defaultChatcol5', 'chatcol5');
            // hj.a(I)V
            releaseReferences(MSITypeList, 'types');
            WorldMap.font30 = null;
            CursorType.spriteArchive = null;
            Client.locMapPrefix = null;
            releaseReferences(Client, 'afterCleanup');
            // nb.a(I)V
            releaseReferences(LocalisedText, 'loadingSprites', 'englishLoadingSprites');
            releaseReferences(ByteArrayPool, 'large');
            // mg.b(B)V
            releaseReferences(LocalisedText, 'chatcol9');
            Login.rsaModulus = null;
            releaseReferences(LocalisedText, 'frenchCancel', 'defaultChatcol9', 'englishChatcol9', 'frenchAttemptToReestablish');
            WorldMap.overlayShapes = null;
            releaseReferences(ParamType, 'm_recentUse');
            // li.a(B)V
            releaseReferences(LocalisedText, 'frenchStarting3dLibrary');
            releaseReferences(Client, 'percent1');
            ClientKeyboardListener.instance = null;
            releaseReferences(LocalisedText, 'germanChooseOption', 'chatcol8', 'englishChatcol8');
            ClientBuild.m_comtot = null;
            releaseReferences(LocalisedText, 'defaultChatcol8');
            releaseReferences(ScriptRunner, 'dateSeparator');
            releaseReferences(Minimenu, 'red');
            // og.a(I)V
            releaseReferences(BrowserControl, 'showVideoAd');
            releaseReferences(LocalisedText, 'frenchLoadedTextures', 'germanRating');
            // bb.a(I)V
            releaseReferences(DelayedStateChange, 'delayed');
            StructType.m_pConfigClient = null;
            // pj.d(I)V
            releaseReferences(NpcType, 'slotNextFramesets');
            releaseReferences(LocalisedText, 'englishIgnoreFirst', 'ignoreFirst', 'englishLoggedIn', 'loggedIn');
            releaseReferences(Minimenu, 'yellow');
            // lg.c(I)V
            releaseReferences(CookieStatics, 'settingsCookieKey');
            ClientBuild.m_floorr = null;
            releaseReferences(Client, 'percent5');
            releaseReferences(JagString, 'zero');
            // pe.c(I)V
            GameShell.canvas = null;
            releaseReferences(LocalisedText, 'englishRemoveFriend');
            Client.imageHitmarks = null;
            releaseReferences(RouteFinding, 'm_dirMap');
            ComponentDrag.component = null;
            releaseReferences(LocalisedText, 'removeIgnore', 'germanFriendsFull', 'removeFriend', 'frenchUse');
            // cd.a(B)V
            releaseReferences(GameWorld, 'noActivity');
            releaseReferences(LocalisedText, 'frenchLoadedWordpack');
            releaseReferences(VarBitType, 'm_recentUse');
            releaseReferences(OrbitCamera, 'shakePhase');
            // pg.c(B)V
            releaseReferences(NpcType, 'slotFrameCycles');
            releaseReferences(Client, 'noClipCommand');
            releaseReferences(LocalisedText, 'frenchChatcol1', 'frenchMillionSuffixAmount', 'englishAllocatedMemory');
            Client.worldListHost = null;
            releaseReferences(LocalisedText, 'allocatedMemory');
            // sb.a(I)V
            releaseReferences(LocalisedText, 'germanMoreOptions', 'frenchLoadingWorldListData');
            releaseReferences(NpcType, 'slotSeqs');
            ObjType.groundOps = null;
            // dl.a(B)V
            LocalisedText['languageCodePt'] = null;
            LocalisedText['languageCodeFr'] = null;
            releaseReferences(LocalisedText, 'frenchAllocatedMemory', 'languageCodes');
            LocalisedText['languageCodeEn'] = null;
            LocalisedText['languageCodeDe'] = null;
            releaseReferences(LocalisedText, 'frenchDiscard');
            releaseReferences(Client, 'rectDebugPrefix');
            // da.a(B)V
            releaseReferences(LocalisedText, 'germanConnectedToUpdateServer');
            // kg.a(Z)V
            releaseReferences(LocalisedText, 'englishLoadedInputHandler');
            Client.mapBuildNpcData = null;
            releaseReferences(LocalisedText, 'loadedInputHandler');
            ProceduralTexture.gammaTable = null;
            releaseReferences(LocalisedText, 'germanAttemptToReestablish');
            releaseReferences(CinematicCamera, 'paths');
            // qi.c(I)V
            releaseReferences(StructType, 'm_recentUse');
            releaseReferences(LocalisedText, 'openedTitleScreen', 'englishOpenedTitleScreen', 'germanLoadedConfig');
            Pix3D.unload(); // dc.b()V
            // dd.a(B)V
            releaseReferences(LocalisedText, 'englishCancel', 'cancel', 'frenchUnableToFind');
            Minimenu.spriteBottomCorner = null;
            Client.dnsRequest = null;
            releaseReferences(LocalisedText, 'defaultChatcol4');
            Client.interfacesArchive = null;
            releaseReferences(LocalisedText, 'chatcol4', 'englishChatcol4');
            // a.a(I)V
            releaseReferences(Crc32, 'CRCTable32');
            QuickChatPhraseTypeList.global = null;
            // hc.a(I)V
            releaseReferences(LocalisedText, 'englishLoadingTitleScreen');
            releaseReferences(CollisionMap, 'levelMaps');
            releaseReferences(LocalisedText, 'loadingTitleScreen');
            WorldMap.upperOverlayIds = null;
            releaseReferences(LocalisedText, 'loadingTextures', 'englishLoadingTextures');
            CookieStatics.gmtCalendar = null;
            // hi.a(B)V
            releaseReferences(LocalisedText, 'frenchChatcol3', 'loggedOut', 'englishLoggedOut');
            // qk.e(I)V
            releaseReferences(Client, 'percent2', 'out');
            // oa.a(Z)V
            releaseReferences(Client, 'modCrownTag');
            Client.headiconsPk = null;
            releaseReferences(LocalisedText, 'germanLoggedOut', 'frenchConlost');
            // th.a(Z)V
            releaseReferences(Protocol, 'chalReqTag');
            releaseReferences(LocalisedText, 'loadedWorldList');
            releaseReferences(Minimenu, 'chartreuse');
            releaseReferences(LocalisedText, 'englishLoadedWorldList');
            releaseReferences(LocShape, 'shapeToLayer');
            // qf.a(B)V
            releaseReferences(LocalisedText, 'germanLoadingConfig');
            MidiManager.track = null;
            // d.a(I)V
            releaseReferences(LocalisedText, 'frenchIgnoreFirst');
            releaseReferences(ReceivePlayerPositions, 'm_apCache');
            releaseReferences(LocalisedText, 'germanTradeRequest');
            releaseReferences(Minimenu, 'locArrow');
            releaseReferences(LocalisedText, 'germanOpenedTitleScreen');
            releaseReferences(WorldMap, 'fpsLabel');
            // wf.a(I)V
            releaseReferences(LocalisedText, 'frenchChateffect4');
            EnumType.nullText = null;
            releaseReferences(LocalisedText, 'frenchWalkHere');
            Client.quickChatGlobalArchive = null;
            releaseReferences(LocalisedText, 'englishRating', 'rating');
            // ug.a(B)V
            WorldMapLabels.scene = null;
            // ec.a(I)V
            releaseReferences(LocalisedText, 'frenchRemoveFriend');
            releaseReferences(Client, 'gcPrefix');
            releaseReferences(MinimapBuilder, 'mapFunctionLocIds');
            Minimenu.objDragComponent = null;
            releaseReferences(PlayerModel, 'layerFrameIds');
            releaseReferences(WorldMap, 'empty');
            SpotType.m_pModels = null;
            // jg.a(I)V
            releaseReferences(ChatHistory, 'phrases');
            ComponentDrag.dragLayerComponents = null;
            Client.mapBuildKeys = null;
            releaseReferences(LocalisedText, 'germanAlreadyFriend');
            WorldMap.labels = null;
            // hk.a(Z)V
            releaseReferences(LocalisedText, 'connectingToUpdateServer', 'englishConnectingToUpdateServer');
            // nf.a(I)V
            Client.fontMetricsArchive = null;
            releaseReferences(ClientBuild, 'WSHAPE1');
            ObjType.m_pModels = null;
            // pk.c(I)V
            releaseReferences(PlayerModel, 'recolourDestinationsRs');
            releaseReferences(CookieStatics, 'space');
            releaseReferences(QuickChatPhraseType, 'placeholder');
            // mh.a(B)V
            releaseReferences(Minimenu, 'paramB');
            releaseReferences(Protocol, 'tradeTag');
            // ma.b(B)V
            VarBitType.m_pConfigClient = null;
            releaseReferences(LocalisedText, 'germanLoadedInterfaces');
            Client.fontPlain11 = null;
            releaseReferences(ChatHistory, 'clans');
            Ground.unload(); // kb.a()V
            // ok.c(B)V
            releaseReferences(ScriptRunner, 'calendar');
            Client.objConfigArchive = null;
            releaseReferences(LocalisedText, 'germanLoadedFonts');
            // bj.a(I)V
            releaseReferences(JagString, 'comma');
            releaseReferences(IfType, 'm_spriteCache');
            releaseReferences(LocalisedText, 'englishSelect', 'select');
            // uc.a(Z)V
            releaseReferences(Client, 'npcs');
            releaseReferences(LocalisedText, 'germanLoadedInputHandler');
            releaseReferences(world, 'postTab');
            releaseReferences(Minimenu, 'white');
            AnimFrame.unload(); // of.a()V
            // ph.a(I)V
            releaseReferences(Minimenu, 'target');
            releaseReferences(PlayerModel, 'maleKitBodyParts');
            releaseReferences(MapSpotAnim, 'active');
            releaseReferences(Client, 'qaOpTestCommand');
            WorldMap.previousMap = null;
            Client.imageHeadiconsPrayer = null;
            // re.b(I)V
            releaseReferences(Client, 'setParticlesCommand', 'tweenEnabled');
            Client.mapsArchive = null;
            // rc.b(I)V
            TitleFlames.flameBuffer0 = null;
            Client.recolourPalette = null;
            Client.hintHeadiconsName = null;
            // ui.c(B)V
            releaseReferences(LocalisedText, 'frenchRating');
            releaseReferences(Client, 'colEndTag');
            releaseReferences(LocalisedText, 'millionSuffix', 'frenchChatcol11', 'englishMillionSuffixAmount', 'millionSuffixAmount');
            releaseReferences(ChatHistory, 'text');
            // ce.e(B)V
            releaseReferences(LocalisedText, 'englishClose', 'close');
            releaseReferences(InterfaceList, 'rectangleRedraw');
            RoofModeStatics.roofMaxZ = null;
            // he.c(B)V
            WorldMap.archive = null;
            releaseReferences(LocType, 'm_recentUse');
            // ik.b(I)V
            releaseReferences(FloType, 'm_list');
            releaseReferences(ObjType, 'countColourMillions');
            releaseReferences(PlayerModel, 'recolourSourcesRs');
            releaseReferences(AreaSoundManager, 'npcs');
            Client.cacheData = null;
            LocType.m_pModels = null;
            releaseReferences(InterfaceList, 'rootHeight');
            FloType.m_pConfigClient = null;
            // ad.a(I)V
            TitleScreen.m_logo = null;
            releaseReferences(ReceivePlayerPositions, 'm_lastID');
            TitleScreen.titleBgName = null;
            WorldMap.deferredIcons = null;
            // m.c(I)V
            releaseReferences(ChatHistory, 'names');
            releaseReferences(Client, 'friendSameGame');
            ComponentDrag.target = null;
            releaseReferences(LocalisedText, 'frenchFriendFirst');
            Minimenu.highlightComponent = null;
            AudioEngine.musicPlayer = null;
            PlayerModel.recolourDestinations = null;
            releaseReferences(SpotType, 'm_modelCache');
            loadTone().clear(); // fj.a()V
            // bc.a(I)V
            Client.basesArchive = null;
            releaseReferences(WorldMap, 'lineBreak');
            // ba.a(I)V
            AudioEngine.decimator = null;
            releaseReferences(MapArea, 'areas');
            VarpType.m_pConfigClient = null;
            releaseReferences(Client, 'activeMapFunctionX');
            releaseReferences(LocalisedText, 'frenchChatcol10');
            // aa.a(I)V
            releaseReferences(Client, 'countColourYellow');
            releaseReferences(LocalisedText, 'germanPreparedSoundEngine', 'frenchTradeRequest');
            Client.worldMapArchive = null;
            // hl.b(B)V
            releaseReferences(LocalisedText, 'germanChateffect3');
            Client.js5ConnectStream = null;
            releaseReferences(MapArea, 'details');
            releaseReferences(LocalisedText, 'frenchConnectingToUpdateServer');
            // ac.a(I)V
            releaseReferences(CookieStatics, 'paramCookieHost');
            RoofModeStatics.roofMarks = null;
            releaseReferences(LocalisedText, 'germanMillionSuffixAmount');
            // fl.a(B)V
            releaseReferences(LocalisedText, 'frenchLoadedWorldList');
            WorldMap.upperOverlayShapes = null;
            releaseReferences(LocalisedText, 'germanDiscard');
            releaseReferences(Client, 'jsUnzap');
            // ig.d(I)V
            releaseReferences(BASTypeList, 'types');
            releaseReferences(LocalisedText, 'germanLoadedWorldList');
            SpotType.m_pConfigClient = null;
            WorldMap.font12 = null;
            // jk.b(Z)V
            releaseReferences(PlayerModel, 'layerFrameDelays');
            releaseReferences(AreaSoundManager, 'players');
            releaseReferences(LocalisedText, 'frenchLoggedIn');
            // ml.a(I)V
            releaseReferences(LocalisedText, 'englishStarting3dLibrary', 'starting3dLibrary');
            releaseReferences(Minimenu, 'paramC');
            releaseReferences(LocalisedText, 'englishLoadingInterfaces');
            Client.seqConfigArchive = null;
            releaseReferences(ClientEntity, 'shadowModelCache');
            releaseReferences(LocalisedText, 'loadingInterfaces');
            WorldMap.font26 = null;
            // rk.a(I)V
            releaseReferences(WorldList, 'settingsParamPrefix');
            MidiManager.m_pPatches = null;
            releaseReferences(ObjType, 'colourEndTag');
            WorldMap.current = null;
            releaseReferences(LocalisedText, 'germanLoadedSprites');
            Client.modelsArchive = null;
            // oj.b(Z)V
            Client.settings = null;
            // we.b(I)V
            releaseReferences(LocalisedText, 'germanClose');
            releaseReferences(WorldMap, 'memSuffix');
            releaseReferences(QuickChatPhraseType, 'receiveWidths');
            TextureShapeRaster.raster = null;
            // oi.a(Z)V
            releaseReferences(Minimenu, 'opIndexSeparator');
            // oe.d(B)V
            releaseReferences(LocalisedText, 'germanDrop');
            Client.p12FullName = null;
            releaseReferences(Minimenu, 'playerSecondary');
            WorldMap.mapFunctions = null;
            // ie.a(I)V
            releaseReferences(Client, 'chatColours');
            releaseReferences(Protocol, 'clanRequestSuffix');
            releaseReferences(LocalisedText, 'englishLoadingWorldListData');
            releaseReferences(ScriptRunner, 'arrays');
            releaseReferences(TitleScreen, 'm_loadString');
            releaseReferences(PlayerModel, 'recolourDestinations2Rs');
            TitleScreen['loadingTextDefault'] = null;
            releaseReferences(LocalisedText, 'loadingWorldListData');
            // ah.a(I)V
            Client.mapFilePrefix = null;
            releaseReferences(WorldMap, 'labelSuffix');
            releaseReferences(Protocol, 'duelFriendTag');
            // j.a(I)V
            releaseReferences(LocalisedText, 'frenchChateffect3', 'germanLoggedIn');
            releaseReferences(JagString, 'nullString');
            // gl.b(B)V
            releaseReferences(PlayerModel, 'modelCache');
            releaseReferences(LocalisedText, 'germanChatcol11');
            WorldMap.disabled = null;
            releaseReferences(AnimFrameSet, 'cache');
            // ck.a(B)V
            releaseReferences(Client, 'friendUsername', 'dnsTag');
            releaseReferences(WorldMap, 'detailsGroup');
            releaseReferences(LocalisedText, 'skill', 'englishSkill', 'germanLoadingInterfaces');
            // ha.a(Z)V
            Client.texturesArchive = null;
            ObjType.defaultName = null;
            // fa.b(B)V
            releaseReferences(world, 'minimapShape');
            releaseReferences(OrbitCamera, 'shakeAmplitude');
            releaseReferences(ObjType, 'types');
            releaseReferences(SoftwareFont, 'cache');
            releaseReferences(Client, 'memLabel');
            releaseReferences(LocalisedText, 'frenchLevel');
            // mf.a(B)V
            WorldMap.component = null;
            releaseReferences(ClientInvCache, 'm_invList');
            Protocol.oldSocket = null;
            releaseReferences(Client, 'kilobytes', 'playerCachePrefix');
            NpcType.m_pConfigClient = null;
            WordPack.codec = null;
            // rb.a(B)V
            Client.grandExchangeOffers = null;
            releaseReferences(JagString, 'base37Alphabet');
            releaseReferences(Client, 'niceNumberGreen');
            WorldMap.font17 = null;
            Client.mapBuildIndex = null;
            releaseReferences(PlayerModel, 'partToSlot');
            BZip2Decompressor.clear(); // rd.a()V
            // me.a(I)V
            releaseReferences(LocalisedText, 'englishLoadingPleaseWait', 'frenchMoreOptions');
            releaseReferences(Client, 'percentSign');
            releaseReferences(DelayedStateChange, 'varcStrings');
            releaseReferences(LocalisedText, 'loadingPleaseWait');
            releaseReferences(SpriteLoader, 'mapflagName');
            SpriteLoader.scrollbars = null;
            // mk.c(I)V
            Client.sceneMapLandData = null;
            ScriptRunner.intLocals = null;
            releaseReferences(WordPack, 'cabbage');
            releaseReferences(JagString, 'period2');
            releaseReferences(MSITypeList, 'spriteCache');
            Fonts.b12FullName = null;
            // ta.c(B)V
            Client.spotTypeArchive = null;
            releaseReferences(Client, 'infText');
            releaseReferences(LocalisedText, 'frenchMenuSeparator');
            // lh.a(B)V
            ColourImageCache.residentSentinel = null;
            releaseReferences(PlayerModel, 'recolourSources2Rs');
            // lk.a(I)V
            Client.sceneMapLocData = null;
            ScriptRunner.stringLocals = null;
            releaseReferences(LocalisedText, 'frenchIgnoresFull');
            WorldMap.font11 = null;
            // uf.a(I)V
            releaseReferences(LocalisedText, 'englishAlreadyIgnored');
            TitleFlames.flameSprite = null;
            releaseReferences(LocalisedText, 'germanContinue');
            ParamType.m_pConfigClient = null;
            world.activeOccluders = null;
            releaseReferences(Client, 'wtqaHost');
            Client.fontBold12 = null;
            releaseReferences(Client, 'mapNpcRegionIds');
            releaseReferences(LocalisedText, 'alreadyIgnored');
            NativePcmPlayer.clear(); // qb.e()V
            Filter.clear(); // ub.a()V
            // cf.a(B)V
            releaseReferences(PlayerModel, 'layerSeqs');
            releaseReferences(LocalisedText, 'germanChatcol9');
            Client.hintMapMarkers = null;
            TextureOp.normalisedY = null;
            releaseReferences(ClientKeyboardListener, 'm_keycodeMap');
            releaseReferences(LocalisedText, 'frenchChatcol8');
            releaseReferences(CookieStatics, 'expiresAttribute');
            releaseReferences(ClientBuild, 'DECORZOF');
            releaseReferences(IfType, 'm_fontCache');
            // di.a(B)V
            releaseReferences(LocalisedText, 'chatcol10', 'englishChatcol10');
            releaseReferences(SpriteLoader, 'mapdotsName');
            SpriteLoader.cross = null;
            InterfaceList.mouseOverComponent = null;
            releaseReferences(LocalisedText, 'defaultChatcol10');
            releaseReferences(Client, 'statEffectiveLevel', 'serverJs5DropCommand');
            releaseReferences(ReflectionCheck, 'queue');
            JagVorbis.clear(); // ni.a()V
            Floor.clear(); // lb.b()V
            // vk.b(Z)V
            releaseReferences(LocalisedText, 'loadedUpdateList', 'englishLoadedUpdateList', 'englishDrop');
            releaseReferences(PlayerModel, 'modelCache2');
            releaseReferences(LocalisedText, 'drop');
            ClientBuild.m_ligtot = null;
            // f.a(B)V
            Client.socketRequest = null;
            releaseReferences(Minimenu, 'orange');
            Client.vorbisArchive = null;
            releaseReferences(Client, 'cacheIndexFiles');
            TitleFlames.flameBuffer1 = null;
            Client.designAppearanceInstance = null;
            // bf.d(I)V
            releaseReferences(Minimenu, 'hiddenUse');
            Client.scrollbarSpriteName = null;
            // wd.b(B)V
            ObjType.m_pConfigClient = null;
            releaseReferences(LocalisedText, 'englishLoading');
            releaseReferences(Client, 'loginout');
            releaseReferences(LocalisedText, 'LOADINGDOTDOTDOT', 'frenchCreatedGameworld');
            if (glJar) LightType.m_pConfigClient = null; // HD gl.a(I)V, after gl.c
            // pi.a(I)V
            releaseReferences(Client, 'ignoreName37');
            releaseReferences(LocalisedText, 'englishChatcol11', 'chatcol11');
            releaseReferences(Client, 'soundEffects');
            releaseReferences(LocalisedText, 'defaultChatcol11');
            // wk.b(I)V
            releaseReferences(PlayerModel, 'slotFramesets');
            Js5.gzipDecompressor = null;
            releaseReferences(LocalisedText, 'ignoresFull', 'englishIgnoresFull');
            releaseReferences(ByteArrayPool, 'medium');
            releaseReferences(Client, 'npcHitbarSprites');
            releaseReferences(LocalisedText, 'germanChatcol6');
            Client.js5NetQueue = null;
            // pd.a(I)V
            releaseReferences(LocalisedText, 'germanConlost');
            // jd.a(I)V
            releaseReferences(LocalisedText, 'alreadyFriend', 'englishAlreadyFriend');
            releaseReferences(Client, 'friendName37');
            releaseReferences(DelayedStateChange, 'changes');
            // ka.b(B)V
            releaseReferences(LocalisedText, 'germanLoadingPleaseWait');
            ClientBuild.m_floort2 = null;
            // mj.b(I)V
            ObjType.inventoryOps = null;
            releaseReferences(LocalisedText, 'loadedInterfaces', 'englishLoadedInterfaces');
            releaseReferences(QuickChatPhraseType, 'paramCounts');
            MSITypeList.spritesArchive = null;
            // qj.d(B)V
            AudioEngine.music = null;
            SpriteLoader.xOffsets = null;
            WorldMap.locIds = null;
            releaseReferences(ObjType, 'iconCountYellow');
            releaseReferences(PlayerModel, 'layerFrameCycles');
            TitleFlames.blurBuffer = null;
            // jl.a(Z)V
            Client.varBitArchive = null;
            releaseReferences(LocalisedText, 'germanLevel');
            releaseReferences(NpcType, 'layerFrameIds');
            releaseReferences(Client, 'urlHostWww');
            FriendChatChannel.members = null;
            // ri.e(I)V
            releaseReferences(LocalisedText, 'englishCreatedGameworld', 'createdGameworld');
            MonochromeImageCache.dummy = null;
            // gf.f(B)V
            releaseReferences(NpcType, 'm_recentUse');
            releaseReferences(Client, 'jsZap');
            releaseReferences(IfType, 'm_modelCache');
            SpriteLoader.hintMapEdge = null;
            InvType.m_pConfigClient = null;
            // sc.e(B)V
            Client.mapfunctionName = null;
            TitleFlames.flameColours = null;
            releaseReferences(QuickChatCatTypeList, 'types');
            Minimenu.bottomEdgeSprite = null;
            releaseReferences(ClientKeyboardListener, 'codes');
            // dk.e(I)V
            releaseReferences(LocalisedText, 'defaultChateffect2', 'englishChateffect2');
            FriendChatChannel.channelName = null;
            releaseReferences(CookieStatics, 'cookiePrefix');
            releaseReferences(LocalisedText, 'chateffect2');
            // hh.e(I)V
            Client.mapBuildLocationFile = null;
            releaseReferences(LocalisedText, 'germanCheckingForUpdates', 'germanLoadingWordpack');
            ClientPlayer.nameSuffixes = null;
            releaseReferences(Client, 'tweenDisabled');
            WorldMap.wallTypes = null;
            releaseReferences(LocalisedText, 'frenchPreparedSoundEngine');
            releaseReferences(IdkType, 'm_recentUse');
            releaseReferences(LocalisedText, 'frenchOk');
            if (glJar) WorldMap.viewportImage = null; // HD mc.h(-125), final store before nm.f(110).
            // wh.e(I)V
            Client.materialsArchive = null;
            releaseReferences(LocalisedText, 'germanStarting3dLibrary');
            releaseReferences(Client, 'locChanges');
            releaseReferences(ScriptRunner, 'space');
            // nl.f(I)V
            releaseReferences(LocalisedText, 'germanLoadingSprites');
            releaseReferences(Minimenu, 'nullTargetVerb');
            releaseReferences(LocMergeQueue, 'pending');
            NpcType.m_pModels = null;
            // o.e(I)V
            releaseReferences(LocalisedText, 'germanSkill');
            Minimenu.titleBarSprite = null;
            AudioEngine.effects = null;
            // kj.b(Z)V
            TextureOpPerlinNoise.fadeTable = null;
            releaseReferences(PlayerModel, 'slotNextFramesets');
            // bd.e(I)V
            releaseReferences(Client, 'entityRemovalIds');
            // nk.e(B)V
            releaseReferences(Minimenu, 'green');
            Minimenu.tooltipComponent = null;
            MidiManager.trackArchive = null;
            releaseReferences(LocalisedText, 'germanLoadingTitleScreen');
            Texture.animBuffer = null;
            Client.sceneMapUnderwaterLandFile = null;
            // s.e(I)V
            BASTypeList.archive = null;
            QuickChatPhraseTypeList.local = null;
            // nh.e(I)V
            world.underwaterHeightmap = null;
            releaseReferences(LocalisedText, 'germanLoadedTitleScreen');
            QuickChatCatTypeList.local = null;
            Minimenu.walkHere = null;
            releaseReferences(Protocol, 'clanTag');
            releaseReferences(InterfaceList, 'rootX');
            // sk.e(B)V
            releaseReferences(Client, 'settingsParam');
            releaseReferences(LocalisedText, 'germanAlreadyIgnored');
            // od.e(I)V
            releaseReferences(LocalisedText, 'germanLoadedUpdateList');
            releaseReferences(DelayedStateChange, 'varcs');
            // je.e(B)V
            TextureOpEmboss.inverseNormalLength = null;
            releaseReferences(JagString, 'period');
            releaseReferences(LocalisedText, 'hidden', 'englishHidden');
            releaseReferences(SuperPacket, 'bitMasks');
            Client.crossName = null;
            // vi.e(B)V
            releaseReferences(LocalisedText, 'ok');
            releaseReferences(WorldList, 'langParam');
            releaseReferences(LocalisedText, 'germanIgnoreFirst', 'englishOk');
            Client.loadingDoneSuffix = null;
            // qe.e(I)V
            releaseReferences(LocalisedText, 'frenchAllocatingMemory');
            releaseReferences(ScriptRunner, 'scriptErrorPrefix');
            ClientBuild.m_floort1 = null;
            releaseReferences(BrowserControl, 'jsShowingVideoAd');
            releaseReferences(Protocol, 'duelStakeTag');
            releaseReferences(Minimenu, 'plus');
            // pa.h(I)V
            releaseReferences(LocalisedText, 'englishMenuSeparator');
            WorldMap.overlayColors = null;
            releaseReferences(Client, 'friendWorldName');
            world.dynamicSprites = null;
            releaseReferences(LocalisedText, 'MINISEPERATOR');
            Client.changedInvs = null;
            releaseReferences(ScriptRunner, 'nullString');
            // la.g(I)V
            releaseReferences(JagString, 'minusSign');
            releaseReferences(LocalisedText, 'chatcol3', 'defaultChatcol3');
            releaseReferences(Client, 'objCountWhiteTag');
            releaseReferences(NpcType, 'clientPalette');
            releaseReferences(world, 'preTab');
            releaseReferences(Minimenu, 'playerCursor');
            releaseReferences(LocalisedText, 'frenchChatcol2', 'englishChatcol3');
            // sd.f(I)V
            Client.gameHost = null;
            releaseReferences(JagString, 'nullString2');
            // ki.b(Z)V
            releaseReferences(Client, 'shiftClickCommand');
            releaseReferences(world, 'middep128');
            releaseReferences(Client, 'paramTrue');
            // qa.e(I)V
            RoofModeStatics.roofMaxY = null;
            Client.searchResults = null;
            releaseReferences(Client, 'urlAffidPart');
            WorldMap.font19 = null;
            // pf.g(I)V
            releaseReferences(ScriptRunner, 'viaScript');
            ModelLit.pickedTypecodes = null;
            // ti.g(I)V
            ClientBuild.m_mapo = null;
            releaseReferences(ClientKeyboardListener, 'eventCodes');
            releaseReferences(LocalisedText, 'loadingPercentStart');
            releaseReferences(Minimenu, 'playerArrow');
            // ic.f(I)V
            releaseReferences(Minimenu, 'redOrange');
            releaseReferences(Client, 'fpsOnCommand');
            // va.e(I)V
            releaseReferences(Protocol, 'tradeReqSuffix');
            Client.masterIndexStore = null;
            releaseReferences(Client, 'rectDebugCommand');
            releaseReferences(InterfaceList, 'subInterfaces');
            // uh.e(I)V
            releaseReferences(LocalisedText, 'chateffect3', 'defaultChateffect3');
            Client.animFramesArchive = null;
            releaseReferences(PlayerModel, 'recolourSourcesAlt');
            releaseReferences(LocalisedText, 'germanLoadingWorldListData');
            releaseReferences(Client, 'soundEffectLoops');
            Client.hitmarksSpriteName = null;
            releaseReferences(LocalisedText, 'germanLoadedWordpack', 'englishChateffect3');
            // vg.h(I)V
            SpriteLoader.pixels = null;
            releaseReferences(QuickChatPhraseType, 'sendWidths');
            releaseReferences(LocalisedText, 'frenchMembersObject', 'frenchLoadedInputHandler');
            TextureOp.normalisedX = null;
            Client.hintMapmarkersName = null;
            TextureShapeRaster.circleWidths = null;
            // wb.e(I)V
            releaseReferences(WorldMap, 'upper');
            // gj.f(I)V
            QuickChatCatTypeList.global = null;
            releaseReferences(PlayerModel, 'recolourSources2Alt');
            Login.suggestedNames = null;
            releaseReferences(LocalisedText, 'defaultChatcol2');
            Client.instrumentsArchive = null;
            releaseReferences(LocalisedText, 'englishChatcol2');
            TextureOp.textureProvider = null;
            releaseReferences(LocalisedText, 'chatcol2');
            // ge.f(I)V
            releaseReferences(NpcType, 'layerNextFrames');
            Minimenu.objName = null;
            // fe.e(I)V
            releaseReferences(LocalisedText, 'englishCheckingForUpdates', 'checkingForUpdates');
            releaseReferences(QuickChatPhraseType, 'empty');
            Client.imageMapflag = null;
            // ab.e(I)V
            MidiManager.m_pJagFX = null;
            releaseReferences(LocalisedText, 'frenchClose');
            releaseReferences(GameShell, 'm_drawTime');
            releaseReferences(Minimenu, 'npcArrow');
            // vf.e(I)V
            releaseReferences(Client, 'loginScreenName');
            releaseReferences(VarpType, 'm_recentUse');
            world.underwaterSquares = null;
            ComponentDrag.parent = null;
            releaseReferences(Protocol, 'assistReqSuffix');
            releaseReferences(LocType, 'm_mc2');
            // r.b(Z)V
            releaseReferences(CursorType, 'types');
            releaseReferences(SpotType, 'm_recentUse');
            releaseReferences(LocalisedText, 'frenchChatcol5', 'germanPleaseWait');
            releaseReferences(InterfaceList, 'rootY');
            // fk.e(I)V
            Client.locConfigArchive = null;
            Client.headiconsPkName = null;
            releaseReferences(Minimenu, 'targetArrow');
            IfType.m_list = null;
            // ib.f(I)V
            ClientBuild.m_floors = null;
            releaseReferences(LocalisedText, 'germanFaceHere', 'loadedWordpack');
            releaseReferences(Protocol, 'assistRequestSuffix');
            releaseReferences(LocalisedText, 'englishLoadedWordpack', 'germanAllocatedMemory');
            // kk.e(B)V
            releaseReferences(world, 'midTab');
            releaseReferences(CookieStatics, 'gmtSuffix');
            releaseReferences(VarBitType, 'm_maskLookUp');
            IfType.m_pModels = null;
            // ia.b(I)V
            releaseReferences(Minimenu, 'openParen', 'cursor');
            releaseReferences(LocalisedText, 'germanSelfIgnore');
            WorldMap.font14 = null;
            // hg.a(I)V
            Client.hoveredSlotCom = null;
            releaseReferences(Client, 'clientDropCommand');
            releaseReferences(LocalisedText, 'frenchDrop');
            FriendChatChannel.ownerName = null;
            // de.d(I)V
            releaseReferences(ChatHistory, 'types');
            releaseReferences(LocalisedText, 'germanChatcol0');
            releaseReferences(WorldList, 'colon');
            releaseReferences(LocType, 'recolPalette');
            releaseReferences(WorldList, 'objectTagArg');
            world.hiddenRoofY = null;
            // gi.c(I)V
            JagString.internTable = null;
            Fonts.p11FullName = null;
            releaseReferences(GameWorld, 'httpPrefix');
            releaseReferences(SpriteLoader, 'hitbarDefaultName');
            // kh.b(I)V
            IfType.m_pInterfaces = null;
            Client.quickChatArchive = null;
            releaseReferences(LocalisedText, 'germanCancel');
            releaseReferences(JagString, 'nbsp');
            releaseReferences(LocalisedText, 'take', 'englishTake');
            // jh.a(B)V
            WorldMap.sceneArea = null;
            SpriteLoader.widths = null;
            // b.c(B)V
            Client.openUrlRequest = null;
            releaseReferences(LocalisedText, 'englishConlost', 'germanChateffect2', 'frenchCheckingForUpdates', 'conlost');
            releaseReferences(Client, 'groundObj');
            // tf.c(I)V
            releaseReferences(JagString, 'collationOrder');
            ClientBuild.m_sattot = null;
            releaseReferences(Client, 'players');
            // qg.d(I)V
            NpcType.defaultName = null;
            releaseReferences(LocalisedText, 'frenchTake', 'frenchLoadingWordpack');
            // mi.a(I)V
            Client.js5MasterIndex = null;
            Client.m_hookQueue = null;
            // lf.a(I)V
            releaseReferences(LocalisedText, 'frenchChateffect2');
            releaseReferences(world, 'midDep16');
            world.mainGroundh = null;
            // sf.b(B)V
            releaseReferences(Client, 'friendRank');
            releaseReferences(LocalisedText, 'frenchConnectedToUpdateServer');
            Client.configArchive = null;
            releaseReferences(InterfaceList, 'dirty');
            RoofModeStatics.hideMinZ = null;
            releaseReferences(ClientScript, 'm_cache');
            // ga.b(Z)V
            releaseReferences(Client, 'chatEffect');
            releaseReferences(JagString, 'empty');
            releaseReferences(Client, 'chatColour', 'chatHeight', 'chatTimer');
            releaseReferences(SeqType, 'm_recentUse');
            Client.chatMessage = null;
            Client.username = null;
            releaseReferences(Client, 'chatWidth', 'chatX', 'chatY');
            Client.password = null;
            // c.b(I)V
            TextureOp.cosine = null;
            SpriteLoader.hasAlpha = null;
            releaseReferences(LocalisedText, 'thousandsSuffix2');
            Minimenu.skinTitleEndSprite2 = null;
            releaseReferences(LocalisedText, 'germanThousandsSuffix2', 'thousandsSuffix', 'englishThousandsSuffix2');
            // lc.a(I)V
            QuickChatPhraseTypeList.decoder = null;
            ClientBuild.m_tot = null;
            // u.a(B)V
            releaseReferences(ScriptRunner, 'monthOct', 'monthApr', 'months', 'monthJun');
            releaseReferences(RouteFinding, 'm_listz');
            releaseReferences(ScriptRunner, 'monthJan', 'monthSep', 'monthNov', 'monthMay', 'monthMar', 'monthJul');
            releaseReferences(LocalisedText, 'frenchChooseOption');
            releaseReferences(Client, 'soundEffectDelays');
            releaseReferences(WorldMap, 'memLabel');
            releaseReferences(ScriptRunner, 'monthFeb', 'monthDec', 'monthAug');
            // na.a(Z)V
            releaseReferences(Client, 'ignoreNames');
            releaseReferences(ScriptRunner, 'gosubErrorPrefix');
            world.mainLevelTiles = null;
            releaseReferences(LocalisedText, 'frenchFriendsFull');
            // il.a(I)V
            world.levelTileOcclusionCycles = null;
            Client.m_pClientScripts = null;
            // gg.a(I)V
            SpriteLoader.hitbarDefault = null;
            // v.b(B)V
            releaseReferences(LocalisedText, 'englishLoadedSprites', 'loadedSprites');
            releaseReferences(Client, 'worldUrlAdvertFlag');
            releaseReferences(world, 'drawTileQueue');
            releaseReferences(Skill, 'used');
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, glJar ? 'client.C(126)' : 'client.A(true)');
        }
    }

    // SD client.c(I)V, HD client.c(B)V. NXT Client::MainQuit, projects/osclient/client.cpp.
    protected async MainQuit(): Promise<void> {
        if (Preferences.stressGraphicsEnabled) {
            GameShell.stressFrame = null;
            GlRendererClass.stressDrawable?.currentTargets()?.stopStress();
            Preferences.setStressGraphics(false);
            Client.stressPalette = null;
        }
        let gameStream: Js5Stream | null = null;
        let diskJoinStarted = false;
        if (this.closed) {
            this.login.generation++;
            GameWorld.fetchGeneration++;
            AccountCreation.generation++;
        }
        try {
            if (glJar) {
                const renderer = GlRendererClass;
                if (renderer.active) renderer.shutdown();
                if (GameShell.fullScreenFrame !== null) {
                    await GameShell.exitFullscreen(GameShell.fullScreenFrame);
                    GameShell.fullScreenFrame = null;
                }
                if (GameShell.signlink !== null) requireNonNull(GameShell.signlink).releaseGlLibrary(this.constructor);
            }
            if (Client.mouseTracking !== null) requireNonNull(Client.mouseTracking).running = false;
            Client.mouseTracking = null;
            if (Client.stream !== null) {
                gameStream = requireNonNull(Client.stream);
                const close = gameStream.Close();
                if (close instanceof Promise) await close;
                Client.stream = null;
            }

            let canvas = GameShell.canvas;
            ClientKeyboardListener.stop(-1, (this.host !== null && canvas === this.host.canvas ? this.host.keyboardSurface : canvas) as KeyboardSurface);
            canvas = GameShell.canvas;
            ClientMouseListener.stop((this.host !== null && canvas === this.host.canvas ? this.host.mouseSurface : canvas) as MouseSurface, 0);
            if (MouseWheel.instance !== null) {
                const wheel = MouseWheel.instance;
                canvas = GameShell.canvas;
                requireNonNull(wheel).stop((this.host !== null && canvas === this.host.canvas ? this.host.mouseSurface : canvas) as WheelSurface);
            }
            ClientKeyboardListener.dispose();
            ClientMouseListener.dispose();
            MouseWheel.instance = null;
            if (AudioEngine.musicPlayer !== null) requireNonNull(AudioEngine.musicPlayer).QueueQuit();
            if (AudioEngine.effectsPlayer !== null) requireNonNull(AudioEngine.effectsPlayer).QueueQuit();

            const netClose = requireNonNull(Client.js5NetQueue).close();
            if (netClose instanceof Promise) await netClose;
            const diskQueue = requireNonNull(Client.js5DiskQueue);
            diskJoinStarted = true;
            await diskQueue.EndAndJoin();

            try {
                if (Client.cacheData !== null) requireNonNull(Client.cacheData).Close();
                if (Client.cacheIndexFiles !== null) {
                    for (let i = 0; i < requireNonNull(Client.cacheIndexFiles).length; i++) {
                        if (arrayAtObj(Client.cacheIndexFiles, i) !== null) requireNonNull(arrayAtObj(Client.cacheIndexFiles, i)).Close();
                    }
                }
                if (DataFile.masterIndexFile !== null) requireNonNull(DataFile.masterIndexFile).Close();
                if (Client.uidFile !== null) requireNonNull(Client.uidFile).Close();
            } catch (error) {
                if (!(error instanceof FileIoError) && !(error instanceof SocketIoError)) throw error;
            }
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, glJar ? 'client.F(23)' : 'client.N(0)');
        } finally {
            if (this.closed) {
                if (this.sdDisplay) await this.sdDisplay.leave(false);
                this.sdDisplay = null;
                this.sdDevice = null;
                this.releaseGlCanvas();
                this.events.abort();
                if (DevicePcmPlayer.audioSystem === this.audio) DevicePcmPlayer.audioSystem = null;
                this.audio.close();
                try {
                    await this.releaseBrowserConnections(gameStream);
                } finally {
                    try {
                        if (!diskJoinStarted && this.assets !== undefined) await this.assets.stop();
                    } finally {
                        this.disk?.close();
                    }
                }
            }
        }
    }

    // HD g.b(B)V. ac.a uses -82 for enclosed updates and -99 for individual messages.
    static ZonePacket(guard = -99): void {
        if (!glJar) return Client.ZonePacketSd();
        try {
            if (Protocol.packetType === 195) {
                const info = Protocol.inPacket.g1_alt2(true);
                const angle = info & 3;
                const shape = info >> 2;
                const layer = arrayAtI32(LocShape.shapeToLayer, shape);
                const pos = Protocol.inPacket.g1(-85);
                const x = (Protocol.zoneUpdateX + ((pos >> 4) & 7)) | 0;
                const z = (Protocol.zoneBaseZ + (pos & 7)) | 0;
                if (x >= 0 && z >= 0 && x < 104 && z < 104) Client.LocChangeCreate(0, shape, x, -1, z, Client.playerLevel, layer, -1, angle);
                return;
            }
            if (Protocol.packetType === 33) {
                const id = Protocol.inPacket.g2_alt1(-58);
                const pos = Protocol.inPacket.g1(-63);
                const z = (Protocol.zoneBaseZ + (pos & 7)) | 0;
                const x = (Protocol.zoneUpdateX + ((pos >> 4) & 7)) | 0;
                const count = Protocol.inPacket.g2_alt2(-108);
                if (x >= 0 && z >= 0 && x < 104 && z < 104) {
                    const obj = new ClientObj();
                    obj.count = count;
                    obj.id = id;
                    if (arrayAtObj(arrayAtObj(arrayAtObj(Client.groundObj, Client.playerLevel), x), z) === null) {
                        arrayPutObj(arrayAtObj(arrayAtObj(Client.groundObj, Client.playerLevel), x), z, new SharedPtrList<ClientObjNode>());
                    }
                    const list = arrayAtObj(arrayAtObj(arrayAtObj(Client.groundObj, Client.playerLevel), x), z);
                    const node = new ClientObjNode(obj);
                    requireNonNull(list).push_back(node);
                    Client.ShowObject(z, x, undefined, 65);
                }
                return;
            }
            if (Protocol.packetType === 121) {
                const pos = Protocol.inPacket.g1(-102);
                let x = ((Protocol.zoneUpdateX << 1) + ((pos >> 4) & 15)) | 0;
                let z = ((Protocol.zoneBaseZ << 1) + (pos & 15)) | 0;
                let endX = (x + Protocol.inPacket.g1s(false)) | 0;
                let endZ = (z + Protocol.inPacket.g1s(false)) | 0;
                const target = Protocol.inPacket.g2s(73),
                    id = Protocol.inPacket.g2(1);
                const startHeight = Protocol.inPacket.g1(-56) * 4;
                const endHeight = Protocol.inPacket.g1(-97) * 4;
                const start = Protocol.inPacket.g2(1),
                    end = Protocol.inPacket.g2(1);
                let pitch = Protocol.inPacket.g1(-90);
                if (pitch === 255) pitch = -1;
                const distance = Protocol.inPacket.g1(-51);
                if (x >= 0 && z >= 0 && x < 208 && z < 208 && endX >= 0 && endZ >= 0 && endX < 208 && endZ < 208 && id !== 65535) {
                    endX = Math.imul(endX, 64);
                    z = Math.imul(z, 64);
                    x = Math.imul(x, 64);
                    const projectile = new ClientProj(id, Client.playerLevel, x, z, (Client.GetAvHHd(Client.playerLevel, 1, x, z) - startHeight) | 0, (Client.loopCycle + start) | 0, (Client.loopCycle + end) | 0, pitch, distance, target, endHeight);
                    endZ = Math.imul(endZ, 64);
                    const targetCycle = (Client.loopCycle + start) | 0;
                    projectile.setTarget(endX, (Client.GetAvHHd(Client.playerLevel, 1, endX, endZ) - endHeight) | 0, endZ, targetCycle);
                    Client.projectiles.push_back(new ClientProjNode(projectile));
                }
                return;
            }
            if (Protocol.packetType === 17) {
                const pos = Protocol.inPacket.g1(-116);
                let x = (Protocol.zoneUpdateX + ((pos >> 4) & 7)) | 0;
                let z = (Protocol.zoneBaseZ + (pos & 7)) | 0;
                const id = Protocol.inPacket.g2(1),
                    height = Protocol.inPacket.g1(-109),
                    delay = Protocol.inPacket.g2(1);
                if (x >= 0 && z >= 0 && x < 104 && z < 104) {
                    x = (64 + Math.imul(x, 128)) | 0;
                    z = (64 + Math.imul(z, 128)) | 0;
                    const spot = new MapSpotAnim(id, Client.playerLevel, x, z, (Client.GetAvHHd(Client.playerLevel, 1, x, z) - height) | 0, delay, Client.loopCycle);
                    MapSpotAnim.active.push_back(new MapSpotAnimNode(spot));
                }
                return;
            }
            if (Protocol.packetType === 179) {
                const info = Protocol.inPacket.g1_alt1(-111),
                    shape = info >> 2;
                const angle = info & 3;
                const layer = arrayAtI32(LocShape.shapeToLayer, shape);
                const pos = Protocol.inPacket.g1(-113);
                const x = (Protocol.zoneUpdateX + ((pos >> 4) & 7)) | 0;
                const z = (Protocol.zoneBaseZ + (pos & 7)) | 0;
                const id = Protocol.inPacket.g2_alt2(117);
                if (x >= 0 && z >= 0 && x < 104 && z < 104) Client.LocChangeCreate(0, shape, x, -1, z, Client.playerLevel, layer, id, angle);
                return;
            }
            if (Protocol.packetType === 20) {
                const pos = Protocol.inPacket.g1_alt3(true);
                const x = (Protocol.zoneUpdateX + ((pos >> 4) & 7)) | 0;
                const z = (Protocol.zoneBaseZ + (pos & 7)) | 0;
                const info = Protocol.inPacket.g1_alt3(true);
                const shape = info >> 2,
                    angle = info & 3;
                const layer = arrayAtI32(LocShape.shapeToLayer, shape);
                let seq = Protocol.inPacket.g2_alt1(-104);
                if (seq === 65535) seq = -1;
                if (SceneCutover.active) Client.attachLocAnim(x, angle, seq, z, shape, Client.playerLevel, layer);
                else if (x >= 0 && z >= 0 && x < 103 && z < 103) requireNonNull(LocChange.scene).animateLoc?.(Client.playerLevel, x, z, layer, shape, angle, seq);
                return;
            }
            if (Protocol.packetType === 202) {
                const info = Protocol.inPacket.g1(-99),
                    shape = info >> 2,
                    angle = info & 3;
                const pos = Protocol.inPacket.g1(-90);
                const x = (Protocol.zoneUpdateX + ((pos >> 4) & 7)) | 0;
                const z = (Protocol.zoneBaseZ + (pos & 7)) | 0;
                const x1 = Protocol.inPacket.g1s_alt1(0),
                    z1 = Protocol.inPacket.g1s_alt1(0),
                    z2 = Protocol.inPacket.g1s_alt3(false),
                    loc = Protocol.inPacket.g2_alt2(-106);
                const end = Protocol.inPacket.g2_alt1(-116),
                    x2 = Protocol.inPacket.g1s(false),
                    start = Protocol.inPacket.g2(1),
                    actor = Protocol.inPacket.ig2bAdd(-1741292848);
                if (!GlRendererClass.active) {
                    LocMergeQueue.enqueue(actor, angle, end, x, z2, shape, z, x2, z1, loc, x1, start);
                }
            }
            if (Protocol.packetType === 14) {
                const pos = Protocol.inPacket.g1(-28);
                const z = (Protocol.zoneBaseZ + (pos & 7)) | 0;
                const x = (Protocol.zoneUpdateX + ((pos >> 4) & 7)) | 0;
                const id = Protocol.inPacket.g2(1),
                    oldCount = Protocol.inPacket.g2(1),
                    count = Protocol.inPacket.g2(1);
                if (x >= 0 && z >= 0 && x < 104 && z < 104) {
                    const list = arrayAtObj(arrayAtObj(arrayAtObj(Client.groundObj, Client.playerLevel), x), z);
                    if (list !== null) {
                        for (let node = list.head(); node !== null; node = list.next()) {
                            if (!(node instanceof ClientObjNode)) throw new TypeError('ClassCastException: not a ClientObjNode');
                            const item = node.obj;
                            if (item.id === (id & 32767) && item.count === oldCount) {
                                item.count = count;
                                break;
                            }
                        }
                        Client.ShowObject(z, x, undefined, 65);
                    }
                }
                return;
            }
            if (Protocol.packetType === 135) {
                const receiver = Protocol.inPacket.g2_alt3(-113);
                const pos = Protocol.inPacket.g1_alt2(true);
                const z = (Protocol.zoneBaseZ + (pos & 7)) | 0;
                const x = (Protocol.zoneUpdateX + ((pos >> 4) & 7)) | 0;
                const count = Protocol.inPacket.g2_alt1(-66),
                    id = Protocol.inPacket.g2_alt1(-96);
                if (x >= 0 && z >= 0 && x < 104 && z < 104 && receiver !== Client.localPid) {
                    const obj = new ClientObj();
                    obj.count = count;
                    obj.id = id;
                    if (arrayAtObj(arrayAtObj(arrayAtObj(Client.groundObj, Client.playerLevel), x), z) === null) {
                        arrayPutObj(arrayAtObj(arrayAtObj(Client.groundObj, Client.playerLevel), x), z, new SharedPtrList<ClientObjNode>());
                    }
                    const list = arrayAtObj(arrayAtObj(arrayAtObj(Client.groundObj, Client.playerLevel), x), z);
                    const node = new ClientObjNode(obj);
                    requireNonNull(list).push_back(node);
                    Client.ShowObject(z, x, undefined, 65);
                }
                return;
            }
            if (guard > -67) return;
            if (Protocol.packetType === 16) {
                const pos = Protocol.inPacket.g1(-71);
                let x = (Protocol.zoneUpdateX + ((pos >> 4) & 7)) | 0;
                let z = (Protocol.zoneBaseZ + (pos & 7)) | 0;
                let endX = (x + Protocol.inPacket.g1s(false)) | 0;
                let endZ = (z + Protocol.inPacket.g1s(false)) | 0;
                const target = Protocol.inPacket.g2s(67),
                    id = Protocol.inPacket.g2(1);
                const startHeight = Protocol.inPacket.g1(-109) * 4;
                const endHeight = Protocol.inPacket.g1(-50) * 4;
                const start = Protocol.inPacket.g2(1),
                    end = Protocol.inPacket.g2(1);
                let pitch = Protocol.inPacket.g1(-48);
                if (pitch === 255) pitch = -1;
                const distance = Protocol.inPacket.g1(-35);
                if (x >= 0 && z >= 0 && x < 104 && z < 104 && endX >= 0 && endZ >= 0 && endX < 104 && endZ < 104 && id !== 65535) {
                    endZ = (64 + Math.imul(endZ, 128)) | 0;
                    z = (64 + Math.imul(z, 128)) | 0;
                    endX = (64 + Math.imul(endX, 128)) | 0;
                    x = (64 + Math.imul(x, 128)) | 0;
                    const projectile = new ClientProj(id, Client.playerLevel, x, z, (Client.GetAvHHd(Client.playerLevel, 1, x, z) - startHeight) | 0, (Client.loopCycle + start) | 0, (Client.loopCycle + end) | 0, pitch, distance, target, endHeight);
                    const targetCycle = (Client.loopCycle + start) | 0;
                    projectile.setTarget(endX, (Client.GetAvHHd(Client.playerLevel, 1, endX, endZ) - endHeight) | 0, endZ, targetCycle);
                    Client.projectiles.push_back(new ClientProjNode(projectile));
                }
                return;
            }
            if (Protocol.packetType === 104) {
                const pos = Protocol.inPacket.g1(-80);
                let z = ((Protocol.zoneBaseZ << 1) + (pos & 15)) | 0;
                let x = ((Protocol.zoneUpdateX << 1) + ((pos >> 4) & 15)) | 0;
                let endX = (x + Protocol.inPacket.g1s(false)) | 0;
                let endZ = (z + Protocol.inPacket.g1s(false)) | 0;
                const source = Protocol.inPacket.g2s(93);
                const target = Protocol.inPacket.g2s(12),
                    id = Protocol.inPacket.g2(1);
                let startHeight = Protocol.inPacket.g1s(false);
                const endHeight = Protocol.inPacket.g1(-67) * 4;
                const start = Protocol.inPacket.g2(1),
                    end = Protocol.inPacket.g2(1);
                let pitch = Protocol.inPacket.g1(-35);
                const distance = Protocol.inPacket.g1(-105);
                if (pitch === 255) pitch = -1;
                if (x >= 0 && z >= 0 && x < 208 && z < 208 && endX >= 0 && endZ >= 0 && endX < 208 && endZ < 208 && id !== 65535) {
                    endX = Math.imul(endX, 64);
                    x = Math.imul(x, 64);
                    endZ = Math.imul(endZ, 64);
                    z = Math.imul(z, 64);
                    if (source !== 0) {
                        let slot: number;
                        let actor: ClientPlayer | ClientNpc | null;
                        if (source >= 0) {
                            const packed = (source - 1) | 0;
                            slot = (packed >> 11) & 15;
                            actor = arrayAtObj(Client.npcs, packed & 2047);
                        } else {
                            const packed = (-source - 1) | 0;
                            slot = (packed >> 11) & 15;
                            const index = packed & 2047;
                            actor = index === Client.localPid ? Client.localPlayer : arrayAtObj(Client.players, index);
                        }
                        if (actor !== null) {
                            const bas = actor.getBasType();
                            if (bas.transforms !== null && arrayAtObj(bas.transforms, slot) !== null) {
                                const dx = arrayAtI32(arrayAtObj(bas.transforms, slot), 0);
                                startHeight = (startHeight - arrayAtI32(arrayAtObj(bas.transforms, slot), 1)) | 0;
                                let dz = arrayAtI32(arrayAtObj(bas.transforms, slot), 2);
                                const sin = arrayAtI32(Pix3D.sinTable, actor.yaw);
                                const cos = arrayAtI32(Pix3D.cosTable, actor.yaw);
                                const rx = (Math.imul(dx, cos) + Math.imul(dz, sin)) >> 16;
                                dz = (Math.imul(cos, dz) - Math.imul(sin, dx)) >> 16;
                                z = (z + dz) | 0;
                                x = (x + rx) | 0;
                            }
                        }
                    }
                    const projectile = new ClientProj(id, Client.playerLevel, x, z, (Client.GetAvHHd(Client.playerLevel, 1, x, z) - startHeight) | 0, (Client.loopCycle + start) | 0, (Client.loopCycle + end) | 0, pitch, distance, target, endHeight);
                    const targetCycle = (Client.loopCycle + start) | 0;
                    projectile.setTarget(endX, (Client.GetAvHHd(Client.playerLevel, 1, endX, endZ) - endHeight) | 0, endZ, targetCycle);
                    Client.projectiles.push_back(new ClientProjNode(projectile));
                }
                return;
            }
            if (Protocol.packetType === 97) {
                const pos = Protocol.inPacket.g1(-34);
                const x = (Protocol.zoneUpdateX + ((pos >> 4) & 7)) | 0;
                const z = (Protocol.zoneBaseZ + (pos & 7)) | 0;
                let id = Protocol.inPacket.g2(1);
                if (id === 65535) id = -1;
                const packed = Protocol.inPacket.g1(-84),
                    range = (packed >> 4) & 15;
                const delay = Protocol.inPacket.g1(-54),
                    loops = packed & 7;
                if (x >= 0 && z >= 0 && x < 104 && z < 104) {
                    const radius = range + 1;
                    if (
                        arrayAtI32(requireNonNull(Client.localPlayer).pathX, 0) >= x - radius &&
                        arrayAtI32(requireNonNull(Client.localPlayer).pathX, 0) <= x + radius &&
                        arrayAtI32(requireNonNull(Client.localPlayer).pathZ, 0) >= z - radius &&
                        arrayAtI32(requireNonNull(Client.localPlayer).pathZ, 0) <= z + radius &&
                        Preferences.areaSoundVolume !== 0 &&
                        loops > 0 &&
                        Client.soundEffectCount < 50 &&
                        id !== -1
                    ) {
                        arrayPutI32(Client.soundEffectIds, Client.soundEffectCount, id);
                        arrayPutI32(Client.soundEffectLoops, Client.soundEffectCount, loops);
                        arrayPutI32(Client.soundEffectDelays, Client.soundEffectCount, delay);
                        arrayPutObj(Client.soundEffects, Client.soundEffectCount, null);
                        arrayPutI32(Client.soundEffectPositions, Client.soundEffectCount, ((x << 16) + (z << 8) + range) | 0);
                        Client.soundEffectCount = (Client.soundEffectCount + 1) | 0;
                    }
                }
                return;
            }
            if (Protocol.packetType === 240) {
                const pos = Protocol.inPacket.g1_alt3(true);
                const z = (Protocol.zoneBaseZ + (pos & 7)) | 0;
                const x = (Protocol.zoneUpdateX + ((pos >> 4) & 7)) | 0;
                const id = Protocol.inPacket.g2(1);
                if (x >= 0 && z >= 0 && x < 104 && z < 104) {
                    const list = arrayAtObj(arrayAtObj(arrayAtObj(Client.groundObj, Client.playerLevel), x), z);
                    if (list !== null) {
                        for (let node = list.head(); node !== null; node = list.next()) {
                            if (!(node instanceof ClientObjNode)) throw new TypeError('ClassCastException: not a ClientObjNode');
                            if (node.obj.id === (id & 32767)) {
                                node.Unlink();
                                break;
                            }
                        }
                        if (list.head() === null) arrayPutObj(arrayAtObj(arrayAtObj(Client.groundObj, Client.playerLevel), x), z, null);
                        Client.ShowObject(z, x, undefined, 65);
                    }
                }
                return;
            }
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'g.G(' + guard + ')');
        }
    }

    // HD ql.a(IIII)I. The second operand selects the far corner's X offset.
    static GetAvHHd(level: number, corner: number, fineX: number, fineZ: number): number {
        try {
            if (world.levelHeightmaps === null) return 0;
            const x = fineX >> 7;
            const z = fineZ >> 7;
            if (x < 0 || z < 0 || x > 103 || z > 103) return 0;
            const dx = fineX & 127;
            const dz = fineZ & 127;
            let plane = level;
            if (plane < 3 && (arrayAtU8(arrayAtObj(arrayAtObj(ClientBuild.m_mapl, 1), x), z) & 2) === 2) plane = (plane + 1) | 0;
            const north = (Math.imul(dx, arrayAtI32(arrayAtObj(arrayAtObj(world.levelHeightmaps, plane), (corner + x) | 0), z + 1)) + Math.imul(arrayAtI32(arrayAtObj(arrayAtObj(world.levelHeightmaps, plane), x), z + 1), 128 - dx)) >> 7;
            const south = (Math.imul(dx, arrayAtI32(arrayAtObj(arrayAtObj(world.levelHeightmaps, plane), x + 1), z)) + Math.imul(128 - dx, arrayAtI32(arrayAtObj(arrayAtObj(world.levelHeightmaps, plane), x), z))) >> 7;
            return (Math.imul(dz, north) + Math.imul(128 - dz, south)) >> 7;
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'ql.B(' + [level, corner, fineX, fineZ].join(',') + ')');
        }
    }
}
