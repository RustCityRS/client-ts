import { expect } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import Client from '#/client/Client.js';
import ClientBuild from '#/client/ClientBuild.js';
import HintArrow from '#/client/HintArrow.js';
import IdkType from '#/config/IdkType.js';
import ObjType from '#/config/ObjType.js';
import SeqType from '#/config/SeqType.js';
import NpcType from '#/config/NpcType.js';
import SpotType from '#/config/SpotType.js';
import BASTypeList from '#/config/BASTypeList.js';
import ClientNpc from '#/dash3d/ClientNpc.js';
import ClientPlayer from '#/dash3d/ClientPlayer.js';
import Decor from '#/dash3d/Decor.js';
import GlModel from '#/dash3d/GlModel.js';
import GroundDecor from '#/dash3d/GroundDecor.js';
import ModelUnlit from '#/dash3d/ModelUnlit.js';
import Pix3D from '#/dash3d/Pix3D.js';
import PlayerModel from '#/dash3d/PlayerModel.js';
import Sprite from '#/dash3d/Sprite.js';
import Square from '#/dash3d/Square.js';
import TextureCache from '#/dash3d/TextureCache.js';
import world from '#/dash3d/world.js';
import Wall from '#/dash3d/Wall.js';
import GlRenderer from '#/gl/GlRenderer.js';
import Preferences from '#/ui/Preferences.js';
import { requireNonNull } from '#/util/JavaArray.js';
import { localAssets } from '../cachefile.js';
import { loginFixture } from '../login-fixture.js';
import { cachePath } from '../reference.js';
import { hdGamepackPath, joglPath } from '../render/hd-reference.js';
import { digest } from './model-bytes.js';

loginFixture(
    import.meta.url,
    'HD actor draws match the JAR for equipped bodies, spots, shadows and animations',
    async () => {
        const dir = mkdtempSync(join(tmpdir(), 'rs530-actor-model-'));
        try {
            const cp = [dir, hdGamepackPath, joglPath].join(delimiter);
            const asm = '--add-exports=java.base/jdk.internal.org.objectweb.asm=ALL-UNNAMED';
            let rows: string[] = [];
            for (const args of [
                ['javac', asm, '-encoding', 'UTF-8', '-cp', cp, '-sourcepath', import.meta.dir, '-d', dir, join(import.meta.dir, 'HdActorModelsOracle.java')],
                ['java', asm, '-cp', cp, 'HdActorModelsOracle', 'instrument', hdGamepackPath, dir],
                ['java', asm, '--add-opens=java.base/java.lang=ALL-UNNAMED', '-Dgltrace.stacks=false', '-Djava.awt.headless=true', '-Xmx1536m', '-cp', cp, 'HdActorModelsOracle', cachePath, dir, join(import.meta.dir, 'rtx5070.json')]
            ]) {
                const java = Bun.spawnSync(args, { timeout: 30000 });
                expect(java.exitCode, java.stderr.toString()).toBe(0);
                rows = java.stdout
                    .toString()
                    .trim()
                    .split(/\r?\n/)
                    .filter(v => v.startsWith('actor ') || v.startsWith('release '));
            }
            expect(rows.length).toBe(51);
            const assets = localAssets(cachePath, [0, 1, 2, 7, 8, 9, 18, 19, 20, 21, 26]);
            Client.modelsArchive = assets.archive(7);
            IdkType.Init(assets.archive(2), assets.archive(7));
            NpcType.Init(assets.archive(18), assets.archive(7));
            ObjType.Init(assets.archive(19), true, null, assets.archive(7));
            SeqType.Init(assets.archive(20), assets.archive(1), assets.archive(0));
            BASTypeList.init(assets.archive(2));
            SpotType.Init(assets.archive(7), assets.archive(21));
            Pix3D.textureProvider = new TextureCache(assets.archive(9), assets.archive(26), assets.archive(8), 20, false);
            PlayerModel.recolourDestinations = PlayerModel.recolourDestinationsRs;
            PlayerModel.recolourDestinations2 = PlayerModel.recolourDestinations2Rs;
            PlayerModel.recolourSources = PlayerModel.recolourSourcesRs;
            PlayerModel.recolourSources2 = PlayerModel.recolourSources2Rs;
            GlRenderer.active = true;
            GlRenderer.vboSupported = false;
            Preferences.highDetailLighting = true;
            Client.playerLevel = 0;
            ClientBuild.m_mapl = Array.from({ length: 4 }, () => Array.from({ length: 104 }, () => new Uint8Array(104)));
            world.levelHeightmaps = Array.from({ length: 4 }, (_, level) => Array.from({ length: 105 }, (_, x) => Int32Array.from({ length: 105 }, (_, z) => (level === 0 ? -32 - ((x * x + 13 * z - 5 * x * z) & 127) : 0))));
            let commands: string[] = [];
            // Truncate drawing at the same td.WorldRender boundary instrumented in the JAR. Hash the
            // actual model coordinates, face arrays and alpha at that call after all actor transforms.
            GlModel.prototype.draw = function (yaw, _sinPitch, _cosPitch, _sinYaw, _cosYaw, _x, _y, _z, tag, flags, particles) {
                const arrays = [this.pointX, this.pointY, this.pointZ, this.faceVertexA, this.faceVertexB, this.faceVertexC, this.faceColour, this.faceAlpha];
                commands.push('draw(' + [yaw, tag, flags, particles !== null, this.useAABBMouseCheck, this.vertexCount, this.faceCount].join(',') + '):' + arrays.map(digest).join(':'));
            };
            let distance = 0,
                offset = 0;
            GlRenderer.getDepthBiasDistance = () => {
                commands.push('distance');
                return distance;
            };
            GlRenderer.getDepthBias = () => {
                commands.push('offset');
                return offset;
            };
            GlRenderer.disableDepthWrite = () => {
                commands.push('disable');
            };
            GlRenderer.enableDepthWrite = () => {
                commands.push('enable');
            };
            GlRenderer.setDepthBias = (d, o) => {
                commands.push('bias(' + d + ',' + o + ')');
                distance = d;
                offset = o;
            };
            for (let kind = 0; kind < 6; kind++) {
                for (let variant = 0; variant < 8; variant++) {
                    let actor: ClientPlayer | ClientNpc;
                    if (kind === 3) {
                        actor = new ClientNpc();
                        actor.npcType = NpcType.List(1);
                    } else {
                        actor = new ClientPlayer();
                        actor.appearance = new PlayerModel();
                        actor.appearance.setAppearance(kind === 1, Int32Array.of(0, 1, 2, 1, 3), -1, null, kind === 2 ? 1 : -1);
                        if (kind === 5) {
                            const equipment = Int32Array.from(requireNonNull(actor.appearance.equipmentTags));
                            equipment[0] = 0x40000000 | 1155;
                            equipment[3] = 0x40000000 | 1277;
                            equipment[4] = 0x40000000 | 1117;
                            equipment[7] = 0x40000000 | 1067;
                            actor.appearance.setAppearance(false, Int32Array.of(0, 1, 2, 1, 3), -1, equipment, -1);
                        }
                        if (kind === 4) {
                            Client.localPlayer = actor;
                            Client.hintArrows.fill(null);
                            Client.hintArrows[Client.hintArrows.length - 1] = Object.assign(new HintArrow(), { type: 2, model: 731, x: 14, z: 14 });
                            Client.mapBuildBaseX = Client.mapBuildBaseZ = 0;
                            Client.loopCycle = 5;
                            actor.attachment = new GlModel(ModelUnlit.Load(Client.modelsArchive, 731, 0), 64, 768, false);
                            actor.attachmentStart = 4;
                            actor.attachmentEnd = 8;
                            actor.attachmentX = 700;
                            actor.attachmentHeight = 80;
                            actor.attachmentZ = 1300;
                            actor.targetYaw = (variant & 3) * 512;
                        }
                    }
                    Preferences.characterShadows = (variant & 2) !== 0;
                    actor.x = 1460;
                    actor.z = 1530;
                    actor.sceneHeight = -73;
                    actor.bas = -1;
                    actor.seq = (variant & 1) !== 0 ? 808 : -1;
                    actor.seqFrame = 0;
                    actor.seqNext = actor.seqCycle = 1;
                    actor.seqDelay = 0;
                    if ((variant & 4) !== 0) {
                        actor.spotanim = 1;
                        actor.spotFrame = 0;
                        actor.spotNext = actor.spotCycle = 1;
                        actor.spotHeight = 11;
                    }
                    commands = [];
                    actor.draw(384, 0, 65536, 0, 65536, 0, 0, 600, 987654321n, 3, null);
                    if (kind === 4 && actor instanceof ClientPlayer && actor.attachment instanceof GlModel) {
                        for (const a of [actor.attachment.pointX, actor.attachment.pointY, actor.attachment.pointZ]) commands.push('attach:' + digest(a));
                    }
                    expect('actor ' + kind + ' ' + variant + ' ' + actor.modelMinY + ' ' + commands.join(' ')).toBe(rows[kind * 8 + variant]);
                }
            }
            world.squares = Array.from({ length: 2 }, () => Array.from({ length: 2 }, () => new Array<Square | null>(2).fill(null)));
            let nextId = 0;
            function tagged(): GlModel {
                const model = new GlModel(),
                    id = ++nextId;
                const prepare = model.prepareBuffers.bind(model);
                model.prepareBuffers = (...args) => {
                    commands.push(id + ':' + args.map(Number).join(''));
                    prepare(...args);
                };
                return model;
            }
            for (let i = 0; i < 2; i++) {
                const tile = (world.squares[i][1 - i][i] = new Square(i, 1 - i, i));
                const tag = i === 0 ? 23n : -(1n << 63n) + 36n;
                tile.groundDecor = Object.assign(new GroundDecor(), { model: tagged(), typecode: tag });
                tile.decor = Object.assign(new Decor(), { model: tagged(), model2: tagged(), typecode: ~tag });
                tile.wall = Object.assign(new Wall(), { model1: tagged(), model2: tagged(), typecode: tag });
                tile.spriteCount = 2;
                tile.sprites[0] = Object.assign(new Sprite(), { model: tagged(), typecode: tag });
                tile.sprites[1] = Object.assign(new Sprite(), { model: tagged(), typecode: ~tag });
            }
            world.modelsReleased = false;
            let line = 48;
            for (const active of [false, true, true]) {
                GlRenderer.active = active;
                commands = [];
                world.releaseGlModels();
                expect(['release', active, world.modelsReleased, ...commands].join(' ')).toBe(rows[line++]);
            }
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    },
    90000,
    'gl'
);
