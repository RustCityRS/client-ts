import SharedPtrList from '#/datastruct/SharedPtrList';
import HashTable from '#/datastruct/HashTable';
import Client from '#/client/Client';
import type LocType from '#/config/LocType';
import type ClientEntity from '#/dash3d/ClientEntity';
import type ClientPlayer from '#/dash3d/ClientPlayer';
import type ClientNpc from '#/dash3d/ClientNpc';
import Preferences from '#/ui/Preferences';
import { arrayAtI32, requireNonNull } from '#/util/JavaArray';
import { intDivide, doubleToInt } from '#/util/IntUtils';
import { isJavaRuntimeException } from '#/util/JavaException';
import WrappedException from '#/util/WrappedException';
import { mathRandom } from '#/util/JavaRandom';
import bgsound from './bgsound';
import AudioEngine from './AudioEngine';
import JagFX from './JagFX';
import WaveStream from './WaveStream';

export default class AreaSoundManager {
    // nc.j:Lgk;
    static readonly locs = new SharedPtrList<bgsound>();
    // ik.s:Lgk;
    static readonly npcs = new SharedPtrList<bgsound>();
    // jk.A:Lnc;
    static readonly players = new HashTable<bgsound>(16);
    // id.p:I
    static elapsed = 0;
    // da.a(ILjb;IILpb;ILbk;I)V
    static add(z: number, type: LocType | null, plane: number, player: ClientPlayer | null, x: number, npc: ClientNpc | null, angle: number): void {
        const s = new bgsound();
        s.minZ = Math.imul(128, z);
        s.plane = plane;
        s.minX = Math.imul(128, x);
        if (type !== null) {
            s.maxDelay = type.maxDelay;
            s.sound = type.ambientSound;
            s.loc = type;
            s.minDelay = type.minDelay;
            s.randomIds = type.randomSounds;
            s.radius = Math.imul(type.soundRadius, 128);
            const swap = angle === 1 || angle === 3;
            s.maxX = Math.imul(x + (swap ? type.length : type.width), 128);
            s.maxZ = Math.imul(z + (swap ? type.width : type.length), 128);
            if (type.multi !== null) {
                s.multi = true;
                s.refresh();
            }
            if (s.randomIds !== null) s.delay = (s.minDelay + doubleToInt(mathRandom.nextDouble() * ((s.maxDelay - s.minDelay) | 0))) | 0;
            this.locs.push_back(s);
        } else if (npc !== null) {
            s.npc = npc;
            const base = requireNonNull(npc.npcType);
            s.multi = base.multi !== null;
            const t = s.multi ? base.GetMultiNpc() : base;
            if (t !== null) {
                s.maxX = Math.imul(t.m_gridSize + x, 128);
                s.maxZ = Math.imul(t.m_gridSize + z, 128);
                s.sound = bgsound.npcSound(npc);
                s.radius = Math.imul(t.m_backgroundSoundRange, 128);
            }
            this.npcs.push_back(s);
        } else if (player !== null) {
            s.player = player;
            s.maxX = Math.imul(player.getSize() + x, 128);
            s.maxZ = Math.imul(player.getSize() + z, 128);
            s.sound = bgsound.playerSound(player);
            s.radius = Math.imul(128, player.soundRadius);
            this.players.put(s, requireNonNull(player.username).toBase37());
        }
    }
    // cl.a(Lik;IIIII)V
    static updateSource(s: bgsound | null, x: number, elapsed: number, z: number, plane: number): void {
        try {
            s = requireNonNull(s);
            if (s.sound === -1 && s.randomIds === null) return;
            let distance = 0;
            if (x > s.maxX) distance = (x - s.maxX) | 0;
            else if (s.minX > x) distance = (s.minX - x) | 0;
            if (z > s.maxZ) distance = (distance + z - s.maxZ) | 0;
            else if (z < s.minZ) distance = (distance + s.minZ - z) | 0;
            if (s.radius !== 0 && s.radius >= ((distance - 64) | 0) && Preferences.areaSoundVolume !== 0 && plane === s.plane) {
                distance = Math.max(0, (distance - 64) | 0);
                const volume = intDivide(Math.imul(Preferences.areaSoundVolume, s.radius - distance), s.radius);
                if (s.loop !== null) s.loop.ApplyVolume(volume);
                else if (s.sound >= 0) {
                    const effect = JagFX.load(Client.m_pJagFx, s.sound, 0);
                    if (effect !== null) {
                        const sample = effect.toPcm().Decimate(requireNonNull(AudioEngine.decimator));
                        const stream = requireNonNull(WaveStream.NewRatePercent(sample, 100, volume));
                        stream.SetLoopCount(-1);
                        requireNonNull(AudioEngine.effects).PlayStream(stream);
                        s.loop = stream;
                    }
                }
                if (s.random !== null) {
                    s.random.ApplyVolume(volume);
                    if (!s.random.IsLinked()) s.random = null;
                } else if (s.randomIds !== null) {
                    s.delay = (s.delay - elapsed) | 0;
                    if (s.delay <= 0) {
                        const i = doubleToInt(mathRandom.nextDouble() * s.randomIds.length);
                        const effect = JagFX.load(Client.m_pJagFx, arrayAtI32(s.randomIds, i), 0);
                        if (effect !== null) {
                            const sample = effect.toPcm().Decimate(requireNonNull(AudioEngine.decimator));
                            const stream = requireNonNull(WaveStream.NewRatePercent(sample, 100, volume));
                            stream.SetLoopCount(0);
                            requireNonNull(AudioEngine.effects).PlayStream(stream);
                            s.random = stream;
                            s.delay = (doubleToInt(mathRandom.nextDouble() * ((s.maxDelay - s.minDelay) | 0)) + s.minDelay) | 0;
                        }
                    }
                }
            } else {
                if (s.loop !== null) {
                    requireNonNull(AudioEngine.effects).StopStream(s.loop);
                    s.loop = null;
                }
                if (s.random !== null) {
                    requireNonNull(AudioEngine.effects).StopStream(s.random);
                    s.random = null;
                }
            }
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'cl.E(' + (s === null ? 'null' : '{...}') + ',' + x + ',' + elapsed + ',' + z + ',0,' + plane + ')');
        }
    }
    // tk.a(BIIII)V. gf.e(B)V passes 101 at PC 475; tk.a(Lal;B)V's alternate call is behind its never-taken guard.
    static update(plane: number, elapsed: number, x: number, z: number): void {
        try {
            for (let s = this.locs.head(); s !== null; s = this.locs.next()) {
                if (!(s instanceof bgsound)) throw new TypeError('ClassCastException: expected bgsound');
                this.updateSource(s, x, elapsed, z, plane);
            }
            const actorSource = (s: bgsound, a: ClientEntity, npc: boolean) => {
                const mode = bgsound.movementType(a);
                if (mode !== s.movement) {
                    const sound = npc ? bgsound.npcSound(requireNonNull(s.npc)) : bgsound.playerSound(requireNonNull(s.player));
                    if (s.sound !== sound) {
                        if (s.loop !== null) {
                            requireNonNull(AudioEngine.effects).StopStream(s.loop);
                            s.loop = null;
                        }
                        s.sound = sound;
                    }
                    s.movement = mode;
                }
                s.minX = a.x;
                s.maxX = (a.x + Math.imul(64, a.getSize())) | 0;
                s.minZ = a.z;
                s.maxZ = (a.z + Math.imul(64, a.getSize())) | 0;
                this.updateSource(s, x, elapsed, z, plane);
            };
            for (let s = this.npcs.head(); s !== null; s = this.npcs.next()) {
                if (!(s instanceof bgsound)) throw new TypeError('ClassCastException: expected bgsound');
                actorSource(s, requireNonNull(s.npc), true);
            }
            for (let s = this.players.head(); s !== null; s = this.players.next()) {
                if (!(s instanceof bgsound)) throw new TypeError('ClassCastException: expected bgsound');
                actorSource(s, requireNonNull(s.player), false);
            }
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'tk.B(101,' + plane + ',' + elapsed + ',' + x + ',' + z + ')');
        }
    }
    // fa.a(IIIILjb;)V
    static removeLoc(plane: number, z: number, x: number, type: LocType): void {
        for (let s = this.locs.head(); s !== null; s = this.locs.next())
            if (s.plane === plane && s.minX === Math.imul(128, x) && s.minZ === Math.imul(128, z) && requireNonNull(s.loc).id === type.id) {
                if (s.loop !== null) {
                    requireNonNull(AudioEngine.effects).StopStream(s.loop);
                    s.loop = null;
                }
                if (s.random !== null) {
                    requireNonNull(AudioEngine.effects).StopStream(s.random);
                    s.random = null;
                }
                s.Unlink();
                return;
            }
    }
    // sg.a(ILbk;)V
    static removeNpc(npc: ClientNpc): void {
        for (let s = this.npcs.head(); s !== null; s = this.npcs.next())
            if (s.npc === npc) {
                if (s.loop !== null) {
                    requireNonNull(AudioEngine.effects).StopStream(s.loop);
                    s.loop = null;
                }
                s.Unlink();
                return;
            }
    }
    // v.a(ZLpb;)V
    static removePlayer(player: ClientPlayer): void {
        const s = this.players.get(requireNonNull(player.username).toBase37());
        if (s !== null) {
            if (s.loop !== null) {
                requireNonNull(AudioEngine.effects).StopStream(s.loop);
                s.loop = null;
            }
            s.Unlink();
        }
    }
    // sf.a(Lpb;Z)V
    static updatePlayer(player: ClientPlayer, plane: number): void {
        const s = this.players.get(requireNonNull(player.username).toBase37());
        if (s !== null) s.refresh();
        else this.add(player.pathZ[0], null, plane, player, player.pathX[0], null, 0);
    }
    // wh.f(I)V
    static refreshMultis(): void {
        for (let s = this.locs.head(); s !== null; s = this.locs.next()) if (s.multi) s.refresh();
        for (let s = this.npcs.head(); s !== null; s = this.npcs.next()) if (s.multi) s.refresh();
    }
    // oh.a(ZI)V
    static clear(all: boolean): void {
        for (let s = this.locs.head(); s !== null; s = this.locs.next()) {
            if (s.loop !== null) {
                requireNonNull(AudioEngine.effects).StopStream(s.loop);
                s.loop = null;
            }
            if (s.random !== null) {
                requireNonNull(AudioEngine.effects).StopStream(s.random);
                s.random = null;
            }
            s.Unlink();
        }
        if (all) {
            for (let s = this.npcs.head(); s !== null; s = this.npcs.next()) {
                if (s.loop !== null) {
                    requireNonNull(AudioEngine.effects).StopStream(s.loop);
                    s.loop = null;
                }
                s.Unlink();
            }
            for (let s = this.players.head(); s !== null; s = this.players.next()) {
                if (s.loop !== null) {
                    requireNonNull(AudioEngine.effects).StopStream(s.loop);
                    s.loop = null;
                }
                s.Unlink();
            }
        }
    }
}
