import { expect } from 'bun:test';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import BASTypeList from '#/config/BASTypeList.js';
import IdkType from '#/config/IdkType.js';
import NpcType from '#/config/NpcType.js';
import ObjType from '#/config/ObjType.js';
import ClientPlayer from '#/dash3d/ClientPlayer.js';
import GlModel from '#/dash3d/GlModel.js';
import type ModelLit from '#/dash3d/ModelLit.js';
import ParticleSystem from '#/dash3d/ParticleSystem.js';
import PlayerModel from '#/dash3d/PlayerModel.js';
import Pix3D from '#/dash3d/Pix3D.js';
import TextureCache from '#/dash3d/TextureCache.js';
import GlRenderer from '#/gl/GlRenderer.js';
import { fromJsString } from '#/datastruct/JagString.js';
import PacketT from '#/io/PacketT.js';
import AreaSoundManager from '#/sound/AreaSoundManager.js';
import { requireNonNull } from '#/util/JavaArray.js';
import { localAssets } from '../cachefile.js';
import { loginFixture } from '../login-fixture.js';
import { cachePath } from '../reference.js';
import { hdGamepackPath, joglPath } from '../render/hd-reference.js';

interface Appearance {
    flags?: number;
    equipment?: number[];
    npc?: number;
    team?: number;
    colours?: number[];
    radius?: number;
    sounds?: number[];
    combatRange?: number;
    skill?: number;
    badName?: boolean;
}

function encode(k: Appearance): Buffer {
    const p = new PacketT(160);
    const flags = k.flags ?? 0;
    p.p1(flags);
    p.p1(-1);
    p.p1(6);
    if (k.npc !== undefined) {
        p.p2(65535);
        p.p2(k.npc);
        p.p1(k.team ?? 0);
    } else {
        for (let i = 0; i < 12; i++) {
            const slot = k.equipment?.[i] ?? 0;
            if (slot === 0) p.p1(0);
            else p.p2(slot);
        }
    }
    for (const colour of k.colours ?? [0, 1, 2, 3, 4]) p.p1(colour);
    p.p2(340);
    p.p8(k.badName ? 0n : fromJsString('Codex Skins').toBase37());
    p.p1(69);
    if (flags & 4) p.p2(k.skill ?? 1422);
    else {
        p.p1(72);
        p.p1(k.combatRange ?? 255);
    }
    p.p1(k.radius ?? 0);
    if (k.radius) for (const sound of k.sounds ?? [110, 118, 114, 109]) p.p2(sound);
    return Buffer.from(requireNonNull(p.m_data).subarray(0, p.m_pos));
}

type Step = 'new' | 'particles' | { name: string; bytes: Buffer };

function steps(): Step[] {
    const wear = (id: number) => {
        const entry = requireNonNull(ObjType.wearables).indexOf(id);
        expect(entry, 'wearable item ' + id).toBeGreaterThanOrEqual(0);
        return 32768 + entry;
    };
    const male = encode({ equipment: [256, 0, 0, 0, 274, 282], combatRange: 12 });
    const teams = encode({ equipment: [wear(1155), wear(4315), wear(4317)], flags: 9, colours: [255, 6, 222, 5, 7], radius: 2 });
    const dragon = encode({ flags: 25, npc: 50, team: 17, radius: 1 });
    const equipped = { equipment: [wear(4317), wear(4315)], flags: 73, radius: 3 };
    const result: Step[] = ['new', { name: 'male-kits', bytes: male }, 'particles', { name: 'two-teams', bytes: teams }];
    const sounds = [101, 102, 103, 104];
    result.push({ name: 'changed-sounds', bytes: encode({ ...equipped, sounds }) }, { name: 'unchanged-sounds', bytes: encode({ ...equipped, sounds }) });
    for (let i = 0; i < sounds.length; i++) {
        sounds[i]++;
        result.push({ name: 'changed-sound-' + i, bytes: encode({ ...equipped, sounds }) });
    }
    result.push(
        { name: 'skill-female', bytes: encode({ flags: 133, equipment: [0, 0, 0, 0, 277, 282], skill: 1542 }) },
        { name: 'dragon', bytes: dragon },
        { name: 'stay-dragon', bytes: encode({ flags: 145, npc: 50, team: 17 }) },
        { name: 'npc-size-one', bytes: encode({ flags: 52, npc: 502, skill: 1800 }) },
        { name: 'back-to-human', bytes: encode({ flags: 192, equipment: [262, 0, 0, 0, wear(4315)] }) },
        { name: 'bare-human', bytes: encode({}) }
    );
    for (const [name, bytes] of [
        ['team', teams],
        ['npc', dragon]
    ] as const) {
        for (let n = 0; n < bytes.length; n++) {
            result.push('new', { name: 'seed-' + name + '-' + n, bytes: male }, { name: 'short-' + name + '-' + n, bytes: bytes.subarray(0, n) });
        }
    }
    result.push('new', { name: 'invalid-name', bytes: encode({ badName: true }) }, 'new', { name: 'invalid-wearable', bytes: encode({ equipment: [65534] }) });
    return result;
}

function snapshot(player: ClientPlayer, packet: PacketT, outcome: string, previous: PlayerModel | null): string {
    const m = player.appearance;
    const name = player.username;
    const fields: (string | number | boolean | bigint)[] = [
        outcome,
        packet.m_pos,
        player.x,
        player.z,
        player.getSize(),
        player['baseSize'],
        player.title,
        player.skullIcon,
        player.headIcon,
        player.team,
        player.bas,
        name ? Buffer.from(requireNonNull(name.bytes).subarray(0, name.length)).toString('hex') : '-',
        player.combatLevel,
        player.skillLevel,
        player.combatLevelWithSummoning,
        player.combatRange,
        player.soundRadius,
        player.idleSound,
        player.slowSound,
        player.walkSound,
        player.runSound,
        name !== null && AreaSoundManager.players.get(name.toBase37()) !== null,
        m === previous
    ];
    if (m) fields.push(m.npcId, m['basId'], m.female, m['modelKey'], m['cachedModelKey'], '[' + requireNonNull(m['equipment']).join(',') + ']', '[' + requireNonNull(m['colours']).join(',') + ']');
    else fields.push('-');
    return fields.join(' ');
}

function mesh(result: ModelLit | null, again: ModelLit | null): string {
    if (result === null) return 'null ' + (again === null);
    if (!(result instanceof GlModel)) throw new TypeError('Expected the HD head mesh');
    const hashes = [result.pointX, result.pointY, result.pointZ, result.faceVertexA, result.faceVertexB, result.faceVertexC, result.faceColour, result.faceAlpha].map(data => {
        if (data === null) return 0;
        let hash = 1;
        for (let i = 0; i < data.length; i++) hash = (Math.imul(31, hash) + (data instanceof Uint8Array ? (data[i] << 24) >> 24 : data[i])) | 0;
        return hash;
    });
    return [result === again, result.vertexCount, ...hashes].join(' ');
}

function modelChecks(): string[] {
    const rows: string[] = [];
    GlRenderer.active = true;
    for (const variant of [0, 1]) {
        PlayerModel.modelCache.Reset();
        PlayerModel.recolourDestinations = variant === 0 ? PlayerModel.recolourDestinationsRs : PlayerModel.recolourDestinationsAlt;
        PlayerModel.recolourSources = variant === 0 ? PlayerModel.recolourSourcesRs : PlayerModel.recolourSourcesAlt;
        PlayerModel.recolourDestinations2 = variant === 0 ? PlayerModel.recolourDestinations2Rs : PlayerModel.recolourDestinations2Alt;
        PlayerModel.recolourSources2 = variant === 0 ? PlayerModel.recolourSources2Rs : PlayerModel.recolourSources2Alt;
        for (const npc of [-1, 50]) {
            const model = new PlayerModel();
            model.setAppearance(false, Int32Array.of(2, 3, 4, 1, 3), 340, null, npc);
            for (let step = 0; step < 5; step++) {
                if (step === 1) model.setColour(0, 5);
                if (step === 2) model.setKit(0, 2);
                if (step === 3) model.setFemale(true);
                if (step === 4) model.setKit(3, 18);
                const head = () => model.GetHeadModel(-1, 0, null, 0);
                const kits = () => model.getKitHeadModel(null, 0, 18, 0, 1, 2, -1);
                rows.push(['model', variant, npc, step, model['modelKey'], model.getHeadId(), mesh(head(), head()), mesh(kits(), kits())].join(' '));
            }
        }
    }
    const broken = new PlayerModel();
    broken.setAppearance(false, new Int32Array(5), 0, new Int32Array(12), -1);
    for (const eSize of [-1, 0, 8, 9, 12])
        for (const cSize of [-1, 0, 4, 5]) {
            broken['equipment'] = eSize < 0 ? null : new Int32Array(eSize);
            broken['colours'] = cSize < 0 ? null : new Int32Array(cSize);
            let outcome;
            try {
                outcome = String(broken.getHeadId());
            } catch (e) {
                if (e instanceof TypeError) outcome = 'null';
                else if (e instanceof RangeError && /^array index -?\d+$/.test(e.message)) outcome = e.message.slice(6);
                else throw e;
            }
            rows.push(['head-id', eSize, cSize, outcome].join(' '));
        }
    return rows;
}

loginFixture(
    import.meta.url,
    'HD player appearance updates and packet prefixes match the original e reader',
    async () => {
        const assets = localAssets(cachePath, [2, 7, 8, 9, 18, 19, 26]);
        IdkType.Init(assets.archive(2), assets.archive(7));
        Pix3D.textureProvider = new TextureCache(assets.archive(9), assets.archive(26), assets.archive(8), 20, false);
        ObjType.Init(assets.archive(19), true, null, assets.archive(7));
        NpcType.Init(assets.archive(18), assets.archive(7));
        BASTypeList.init(assets.archive(2));
        ObjType.findWearables();
        PlayerModel.recolourDestinations = PlayerModel.recolourDestinationsRs;
        const cases = steps();
        const dir = mkdtempSync(join(tmpdir(), 'rs530-hd-player-appearance-'));
        try {
            const input = join(dir, 'commands.txt'),
                output = join(dir, 'native.txt');
            // The two original call sites supply these guard values. e.a itself must reset wa.T before the first read.
            writeFileSync(input, cases.map((step, i) => (typeof step === 'string' ? step : [step.name, i % 2 ? -54 : -15, step.bytes.toString('hex')].join(' '))).join('\n'));
            const cp = [dir, hdGamepackPath, joglPath].join(delimiter);
            const sources = ['GlRecorder', 'HdTitleFrameOracle', 'HdGlModelAnimationOracle', 'HdPlayerAppearanceOracle'].map(n => join(import.meta.dir, n + '.java'));
            const build = Bun.spawnSync(['javac', '-encoding', 'UTF-8', '-cp', cp, '-d', dir, ...sources]);
            expect(build.exitCode, build.stderr.toString()).toBe(0);
            const run = Bun.spawnSync([
                'java',
                '--add-opens=java.base/java.lang=ALL-UNNAMED',
                '-Djava.awt.headless=true',
                '-Dgltrace.stacks=false',
                '-cp',
                cp,
                'HdPlayerAppearanceOracle',
                cachePath,
                join(import.meta.dir, 'rtx5070.json'),
                input,
                output
            ]);
            expect(run.exitCode, run.stderr.toString()).toBe(0);
            const native = readFileSync(output, 'utf8').trimEnd().split(/\r?\n/);
            let cursor = 0,
                player = new ClientPlayer();
            for (const step of cases) {
                if (step === 'new') {
                    player = new ClientPlayer();
                    player.pathX[0] = 34;
                    player.pathZ[0] = 65;
                    player.x = 4444;
                    player.z = 5333;
                    continue;
                }
                if (step === 'particles') {
                    player.particles = new ParticleSystem();
                    continue;
                }
                const packet = new PacketT(step.bytes);
                packet.m_pos = 7;
                const previous = player.appearance;
                let outcome = 'ok';
                try {
                    player.readAppearance(packet);
                } catch (e) {
                    if (e instanceof RangeError && /^(byte )?array index /.test(e.message)) outcome = 'bounds';
                    else if (e instanceof TypeError) outcome = 'null';
                    else throw e;
                }
                expect(step.name + ' ' + snapshot(player, packet, outcome, previous), step.name).toBe(native[cursor++]);
                if (step.name === 'two-teams') expect(player.team).toBe(2);
                if (step.name === 'changed-sounds') expect(player.team).toBe(1);
                if (step.name === 'dragon') expect(player.getSize()).toBe(5);
                if (step.name === 'npc-size-one') expect(player.getSize()).toBe(1);
            }
            for (const row of modelChecks()) expect(row).toBe(native[cursor++]);
            expect(cursor).toBe(native.length);
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    },
    60000,
    'gl'
);
