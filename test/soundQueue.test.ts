import ProtocolInput from './protocol-input.js';
import { freshGame } from './actor-fixture.js';
import { requireNonNull } from '#/util/JavaArray.js';
import { expect } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, delimiter } from 'node:path';
import { fileURLToPath } from 'node:url';
import ClientApp from '#/client/Client.js';
import HookReq from '#/script/HookReq.js';
import { ClientScript } from '#/script/ClientScript.js';
import ScriptRunner from '#/script/ScriptRunner.js';
import MidiPlayer from '#/sound/MidiPlayer.js';
import MidiManager from '#/sound/MidiManager.js';
import ClientPlayer from '#/dash3d/ClientPlayer.js';
import { loginFixture } from './login-fixture.js';
import AudioEngine from '#/sound/AudioEngine.js';
import PCMPlayer from '#/sound/PCMPlayer.js';
import Mixer from '#/sound/Mixer.js';
import Decimator from '#/sound/Decimator.js';
import SeqType from '#/config/SeqType.js';
import Preferences from '#/ui/Preferences.js';
import SuperPacket from '#/io/SuperPacket.js';
import { localAssets, readGroup } from './cachefile.js';
import { cachePath, gamepackPath } from './reference.js';

loginFixture(
    import.meta.url,
    'the shared effect queue, real sequence and zone sounds and mixed audio match the JAR at each tick',
    async () => {
        const inputStream = new ProtocolInput();
        const saved = { volume: Preferences.soundEffectVolume, area: Preferences.areaSoundVolume, stereo: PCMPlayer.m_stereo, rate: PCMPlayer.m_frequency, effects: AudioEngine.effects, decimator: AudioEngine.decimator };
        const previous = [ClientApp.soundEffectIds.slice(), ClientApp.soundEffectLoops.slice(), ClientApp.soundEffectDelays.slice(), ClientApp.soundEffectPositions.slice()],
            oldCount = ClientApp.soundEffectCount,
            oldEffects = ClientApp.soundEffects.slice();
        const dir = mkdtempSync(join(tmpdir(), 'queue530-'));
        const hash = (a: ArrayLike<number>) => Array.from(a).reduce((s, n) => (Math.imul(s, 31) + n) | 0, 1);
        const assets = localAssets(cachePath, [4]),
            ids = [...requireNonNull(requireNonNull(assets.index(4)).groupIds).slice(0, 12)];
        const encoded = (b: Uint8Array) => Buffer.from(b).toString('base64');
        const archive = [encoded(readGroup(cachePath, 255, 4)), ...ids.map(id => id + ':' + encoded(readGroup(cachePath, 4, id)))].join(' ');
        const cmds = [archive],
            answers: string[] = [];
        try {
            ClientApp.soundEffectCount = 0;
            for (const a of [ClientApp.soundEffectIds, ClientApp.soundEffectLoops, ClientApp.soundEffectDelays, ClientApp.soundEffectPositions]) a.fill(0);
            ClientApp.soundEffects.fill(null);
            const mixer = (AudioEngine.effects = new Mixer());
            AudioEngine.decimator = new Decimator(22050, 22050);
            PCMPlayer.m_stereo = false;
            PCMPlayer.m_frequency = 22050;
            Preferences.soundEffectVolume = 127;
            Preferences.areaSoundVolume = 78;

            const outgoing = new SuperPacket(12);
            outgoing.SetEnc(Int32Array.of(530, 0, 0, 0));
            const original = assets.archive(4);
            ClientApp.m_pMidi = original;
            MidiManager.Init(new MidiPlayer(), original, original, original);
            Preferences.musicVolume = 0;
            freshGame({ outgoing, account: null, rebuild: null });
            await inputStream.read(26, Uint8Array.of(-2, 3));
            let scriptId = 80000;
            async function action(op: string, ...args: number[]) {
                cmds.push([op, ...args].join(' '));
                let error = '';
                try {
                    switch (op) {
                        case 'vol':
                            [Preferences.soundEffectVolume, Preferences.areaSoundVolume] = args;
                            break;
                        case 'synth':
                            ClientApp.PlaySynth(args[0], args[1], args[2]);
                            break;
                        case 'frame': {
                            const seq = new SeqType();
                            seq.sounds = [Int32Array.of(args[0]), null];
                            ClientApp.TriggerSeqSound(seq, args[2], args[1], args[3] !== 0, args[4]);
                            break;
                        }
                        case 'area': {
                            if (ClientApp.localPlayer !== null) {
                                ClientApp.localPlayer.pathX[0] = args[4];
                                ClientApp.localPlayer.pathZ[0] = args[5];
                            }
                            await inputStream.read(97, Uint8Array.of(args[0], args[1] >> 8, args[1], args[2], args[3]));
                            break;
                        }
                        case 'tick':
                            if (ClientApp.localPlayer !== null) {
                                ClientApp.localPlayer.x = args[0];
                                ClientApp.localPlayer.z = args[1];
                            }
                            ClientApp.GlDoSoundsQueue();
                            break;
                        case 'packet': {
                            if (!(await inputStream.read(args[0], Uint8Array.from(args.slice(1))))) throw new Error('unhandled sound packet');
                            break;
                        }
                        case 'script': {
                            const code = new ClientScript();
                            code.opcodes = new Int32Array(args.length + 1);
                            code.intOperands = new Int32Array(args.length + 1);
                            code.stringOperands = new Array(args.length + 1).fill(null);
                            code.intOperands.set(args.slice(1));
                            code.opcodes[args.length - 1] = args[0];
                            code.opcodes[args.length] = 21;
                            const req = new HookReq();
                            req.args = [++scriptId];
                            new ScriptRunner(() => code).run(req);
                            break;
                        }
                        case 'archive':
                            ClientApp.m_pJagFx = args[0] ? original : null;
                            break;
                        case 'self':
                            ClientApp.localPlayer = args[0] ? new ClientPlayer() : null;
                            break;
                        case 'count':
                            ClientApp.soundEffectCount = args[0];
                            break;
                        case 'wire':
                            ClientApp.out = new SuperPacket(args[0]);
                            ClientApp.out.SetEnc(Int32Array.of(530, 0, 0, 0));
                            break;
                        case 'music':
                            ClientApp.midiSong = args[0];
                            ClientApp.jingleActive = args[1] !== 0;
                            MidiManager.status = args[2];
                            Preferences.musicVolume = args[3];
                            break;
                        case 'frameNull':
                            ClientApp.TriggerSeqSound(null, 0, 0, false, 0);
                            break;
                        case 'reset':
                            ClientApp.soundEffectCount = 0;
                            break;
                        default:
                            throw Error(op);
                    }
                } catch {
                    error = 'exception';
                }
                const buf = new Int32Array(22);
                mixer.DoMix(buf, 0, 22);
                const packet = requireNonNull(ClientApp.out.m_data);
                answers.push(
                    error +
                        '|' +
                        [
                            ClientApp.soundEffectCount,
                            hash(ClientApp.soundEffectIds),
                            hash(ClientApp.soundEffectLoops),
                            hash(ClientApp.soundEffectDelays),
                            hash(ClientApp.soundEffectPositions),
                            hash(ClientApp.soundEffects.map(f => +(f !== null))),
                            hash(buf),
                            ClientApp.midiSong,
                            ClientApp.jingleActive,
                            MidiManager.status,
                            MidiManager.trackGroupId,
                            MidiManager.trackFileId,
                            MidiManager.targetVolume,
                            MidiManager.loop,
                            MidiManager.fadeSpeed,
                            MidiManager.trackArchive === original,
                            ClientApp.out.m_pos,
                            hash(new Int8Array(packet.buffer, packet.byteOffset, packet.byteLength))
                        ].join(' ')
                );
            }
            for (let i = 0; i < 55; i++) await action('synth', ids[i % ids.length], (i % 5) - 1, (i % 14) - 7);
            for (let i = 0; i < 18; i++) await action('tick', 0, 0);
            await action('reset');
            await action('synth', -1, 1, 2);
            await action('synth', 65535, 2, 4);
            for (const radius of [0, 1, 7, 31]) for (let i = 0; i < 4; i++) await action('frame', (ids[2] << 8) + (i << 5) + radius, 899 + i * 113, 425 - i * 85, i & 1, i % 3);
            for (const id of [ids[2], ids[8], 65535]) for (const packed of [0, 4, 17, 79]) for (const tile of [2, 84]) await action('area', 1, id, packed, 0, tile, 3);
            for (let i = 0; i < 32; i++) await action('tick', i * 128, i * 64);
            await action('reset');
            await action('vol', 0, 0);
            await action('synth', ids[2], 1, 0);
            await action('frame', (ids[6] << 8) | 2, 123, 456, 0, 0);
            await action('reset');
            await action('packet', 172, ids[0] >> 8, ids[0], 3, 0, 111);
            await action('packet', 172, 255, 255, 3, 0, 111);
            await action('script', 3200, ids[1], 2, 4);
            await action('music', -1, 0, 0, 127);
            await action('packet', 4, 135, 0);
            await action('packet', 208, 0, 1, 2, 7, 0);
            await action('music', 0, 0, 0, 127);
            await action('script', 3201, 7);
            await action('script', 3202, 8, 1234);
            await action('reset');
            await action('music', 777, 0, 0, 127);
            for (let bytes = 0; bytes <= 5; bytes++) {
                await action('wire', bytes);
                await action('tick', 0, 0);
            }
            await action('music', 480, 1, 0, 57);
            await action('tick', 0, 0);
            await action('music', 482, 1, 1, 57);
            await action('tick', 0, 0);
            await action('music', -1, 1, 0, 0);
            await action('tick', 0, 0);
            await action('self', 0);
            await action('area', 0, 65535, 0, 0, 0, 0);
            await action('self', 1);
            await action('count', -1);
            await action('synth', ids[0], 1, 0);
            await action('count', 50);
            await action('frameNull');
            await action('count', 0);
            await action('frameNull');
            await action('archive', 0);
            await action('synth', ids[0], 1, 0);
            await action('tick', 0, 0);
            await action('archive', 1);
            await action('tick', 0, 0);
            const java = (n: string) => fileURLToPath(new URL('./game/' + n + '.java', import.meta.url));
            const build = Bun.spawnSync(['javac', '-cp', gamepackPath, '-d', dir, java('ChatOracle'), java('SoundQueueOracle')]);
            expect(build.stderr.toString()).toBe('');
            const j = Bun.spawnSync(['java', '-Djava.awt.headless=true', '-cp', dir + delimiter + gamepackPath, 'SoundQueueOracle'], { stdin: Buffer.from(cmds.join('\n')), maxBuffer: 1024 * 1024 });
            expect(j.stderr.toString()).toBe('');
            expect(j.exitCode).toBe(0);
            const lines = j.stdout.toString().trimEnd().split(/\r?\n/);
            expect(answers.length).toBe(lines.length);
            for (let i = 0; i < lines.length; i++) expect(answers[i], i + ' ' + cmds[i + 1]).toBe(lines[i]);
        } finally {
            inputStream.restore();
            Preferences.soundEffectVolume = saved.volume;
            Preferences.areaSoundVolume = saved.area;
            ClientApp.soundEffectCount = oldCount;
            ClientApp.soundEffectIds.set(previous[0]);
            ClientApp.soundEffectLoops.set(previous[1]);
            ClientApp.soundEffectDelays.set(previous[2]);
            ClientApp.soundEffectPositions.set(previous[3]);
            ClientApp.soundEffects.splice(0, ClientApp.soundEffects.length, ...oldEffects);
            AudioEngine.effects = saved.effects;
            AudioEngine.decimator = saved.decimator;
            PCMPlayer.m_frequency = saved.rate;
            PCMPlayer.m_stereo = saved.stereo;
            rmSync(dir, { recursive: true, force: true });
        }
    },
    30000
);
