import Linkable from '#/datastruct/Linkable';
import HashTable from '#/datastruct/HashTable';
import PatchNoteSet from '#/datastruct/PatchNoteSet';
import PacketT from '#/io/PacketT';
import { byteAt } from '#/io/JavaByteArray';
import { arrayAtI32, arrayPutU8, requireNonNull } from '#/util/JavaArray';
import type Js5 from '#/cache/Js5';
import MidiParser from './MidiParser';

export default class MidiFile extends Linkable {
    // ee.q:Lnc;
    instruments: HashTable<PatchNoteSet> | null = null;
    // ee.r:[B
    midi: Uint8Array;
    // ee.a(Lal;II)Lee;
    static Load(archive: Js5 | null, group: number, file: number): MidiFile | null {
        const data = requireNonNull(archive).GetFile(file, group);
        return data === null ? null : new MidiFile(new PacketT(data));
    }
    // ee.a()V
    prepare(): void {
        if (this.instruments !== null) return;
        this.instruments = new HashTable<PatchNoteSet>(16);
        const banks = new Int32Array(16),
            programs = new Int32Array(16);
        banks[9] = programs[9] = 128;
        const reader = new MidiParser(this.midi),
            tracks = reader.NumTracks();
        for (let i = 0; i < tracks; i++) {
            reader.SetTrack(i);
            reader.ProcessDeltaTime(i);
            reader.UnsetTrack(i);
        }
        while (true) {
            const track = reader.NextTrackToPlay(),
                tick = arrayAtI32(reader.ticks, track);
            while (arrayAtI32(reader.ticks, track) === tick) {
                reader.SetTrack(track);
                const msg = reader.GetEvent(track);
                if (msg === 1) {
                    reader.FinishTrack();
                    reader.UnsetTrack(track);
                    if (reader.AllTracksFinished()) return;
                    break;
                }
                const type = msg & 240,
                    channel = msg & 15,
                    key = (msg >> 8) & 127,
                    value = (msg >> 16) & 127;
                if (type === 176) {
                    if (key === 0) banks[channel] = (banks[channel] & -2080769) + (value << 14);
                    if (key === 32) banks[channel] = (banks[channel] & -16257) + (value << 7);
                }
                if (type === 192) programs[channel] = banks[channel] + key;
                if (type === 144 && value > 0) {
                    const instrument = BigInt(programs[channel]);
                    let mask = this.instruments.get(instrument);
                    if (mask === null) {
                        mask = new PatchNoteSet(new Uint8Array(128));
                        this.instruments.put(mask, instrument);
                    }
                    arrayPutU8(mask.data, key, 1);
                }
                reader.ProcessDeltaTime(track);
                reader.UnsetTrack(track);
            }
        }
    }
    // ee.b()V
    clear(): void {
        this.instruments = null;
    }
    // ee.<init>(Lgd;)V
    constructor(packed: PacketT) {
        super();
        packed.m_pos = requireNonNull(packed.m_data).length - 3;
        const tracks = packed.g1();
        const division = packed.g2();
        let size = 14 + tracks * 10;
        packed.m_pos = 0;
        let tempos = 0;
        let controllers = 0;
        let ons = 0;
        let offs = 0;
        let wheels = 0;
        let pressure = 0;
        let polyPressure = 0;
        let programs = 0;

        for (let pass = 0; pass < tracks; pass++) {
            let previous = -1;

            while (true) {
                const event = packed.g1();
                if (event !== previous) {
                    size++;
                }

                previous = event & 15;
                if (event === 7) {
                    break;
                }

                if (event === 23) {
                    tempos++;
                } else if (previous === 0) {
                    ons++;
                } else if (previous === 1) {
                    offs++;
                } else if (previous === 2) {
                    controllers++;
                } else if (previous === 3) {
                    wheels++;
                } else if (previous === 4) {
                    pressure++;
                } else if (previous === 5) {
                    polyPressure++;
                } else {
                    if (previous !== 6) {
                        throw new Error('Invalid packed MIDI event');
                    }

                    programs++;
                }
            }
        }

        size = (size + 5 * tempos) | 0;
        size = (size + 2 * (ons + offs + controllers + wheels + polyPressure)) | 0;
        size = (size + pressure + programs) | 0;
        const deltas = packed.m_pos;
        const messages = tracks + tempos + controllers + ons + offs + wheels + pressure + polyPressure + programs;

        for (let skipped = 0; skipped < messages; skipped++) {
            packed.gMidiVarLen();
        }

        size = (size + packed.m_pos - deltas) | 0;
        let ccIndex = packed.m_pos;
        let modMsb = 0;
        let modLsb = 0;
        let volumeMsb = 0;
        let volumeLsb = 0;
        let panMsb = 0;
        let panLsb = 0;
        let nrpnMsb = 0;
        let nrpnLsb = 0;
        let rpnMsb = 0;
        let rpnLsb = 0;
        let switches = 0;
        let other = 0;
        let controller = 0;

        for (let i = 0; i < controllers; i++) {
            controller = (controller + packed.g1()) & 127;
            if (controller === 0 || controller === 32) {
                programs++;
            } else if (controller === 1) {
                modMsb++;
            } else if (controller === 33) {
                modLsb++;
            } else if (controller === 7) {
                volumeMsb++;
            } else if (controller === 39) {
                volumeLsb++;
            } else if (controller === 10) {
                panMsb++;
            } else if (controller === 42) {
                panLsb++;
            } else if (controller === 99) {
                nrpnMsb++;
            } else if (controller === 98) {
                nrpnLsb++;
            } else if (controller === 101) {
                rpnMsb++;
            } else if (controller === 100) {
                rpnLsb++;
            } else if (controller !== 64 && controller !== 65 && controller !== 120 && controller !== 121 && controller !== 123) {
                other++;
            } else {
                switches++;
            }
        }

        let eventsCursor = 0;
        let switchCursor = packed.m_pos;
        packed.m_pos = (packed.m_pos + switches) | 0;
        let polyCursor = packed.m_pos;
        packed.m_pos = (packed.m_pos + polyPressure) | 0;
        let pressureCursor = packed.m_pos;
        packed.m_pos = (packed.m_pos + pressure) | 0;
        let wheelHighCursor = packed.m_pos;
        packed.m_pos = (packed.m_pos + wheels) | 0;
        let modHighCursor = packed.m_pos;
        packed.m_pos = (packed.m_pos + modMsb) | 0;
        let volumeHighCursor = packed.m_pos;
        packed.m_pos = (packed.m_pos + volumeMsb) | 0;
        let panHighCursor = packed.m_pos;
        packed.m_pos = (packed.m_pos + panMsb) | 0;
        let keyCursor = packed.m_pos;
        packed.m_pos = (packed.m_pos + ons + offs + polyPressure) | 0;
        let velocityCursor = packed.m_pos;
        packed.m_pos = (packed.m_pos + ons) | 0;
        let otherCursor = packed.m_pos;
        packed.m_pos = (packed.m_pos + other) | 0;
        let offCursor = packed.m_pos;
        packed.m_pos = (packed.m_pos + offs) | 0;
        let modLowCursor = packed.m_pos;
        packed.m_pos = (packed.m_pos + modLsb) | 0;
        let volumeLowCursor = packed.m_pos;
        packed.m_pos = (packed.m_pos + volumeLsb) | 0;
        let panLowCursor = packed.m_pos;
        packed.m_pos = (packed.m_pos + panLsb) | 0;
        let programCursor = packed.m_pos;
        packed.m_pos = (packed.m_pos + programs) | 0;
        let wheelLowCursor = packed.m_pos;
        packed.m_pos = (packed.m_pos + wheels) | 0;
        let nrpnHighCursor = packed.m_pos;
        packed.m_pos = (packed.m_pos + nrpnMsb) | 0;
        let nrpnLowCursor = packed.m_pos;
        packed.m_pos = (packed.m_pos + nrpnLsb) | 0;
        let rpnHighCursor = packed.m_pos;
        packed.m_pos = (packed.m_pos + rpnMsb) | 0;
        let rpnLowCursor = packed.m_pos;
        packed.m_pos = (packed.m_pos + rpnLsb) | 0;
        let tempoCursor = packed.m_pos;
        packed.m_pos = (packed.m_pos + tempos * 3) | 0;
        this.midi = new Uint8Array(size);
        const out = new PacketT(this.midi);
        out.p4(0x4d546864);
        out.p4(6);
        out.p2(tracks > 1 ? 1 : 0);
        out.p2(tracks);
        out.p2(division);
        packed.m_pos = deltas;
        let channel = 0;
        let key = 0;
        let velocity = 0;
        let offVelocity = 0;
        let wheel = 0;
        let channelPressure = 0;
        let keyPressure = 0;
        const values = new Int32Array(128);
        controller = 0;

        for (let track = 0; track < tracks; track++) {
            out.p4(0x4d54726b);
            out.m_pos = (out.m_pos + 4) | 0;
            const start = out.m_pos;
            let previousEvent = -1;

            while (true) {
                const delta = packed.gMidiVarLen();
                out.pMidiVarLen(delta);
                const type = ((byteAt(packed.m_data, eventsCursor++) << 24) >> 24) & 255;
                const changed = type !== previousEvent;
                previousEvent = type & 15;
                if (type === 7) {
                    if (changed) {
                        out.p1(255);
                    }

                    out.p1(47);
                    out.p1(0);
                    out.pSize4((out.m_pos - start) | 0);
                    break;
                }

                if (type === 23) {
                    if (changed) {
                        out.p1(255);
                    }

                    out.p1(81);
                    out.p1(3);
                    out.p1((byteAt(packed.m_data, tempoCursor++) << 24) >> 24);
                    out.p1((byteAt(packed.m_data, tempoCursor++) << 24) >> 24);
                    out.p1((byteAt(packed.m_data, tempoCursor++) << 24) >> 24);
                } else {
                    channel ^= type >> 4;
                    if (previousEvent === 0) {
                        if (changed) {
                            out.p1(144 + channel);
                        }

                        key = ((key + ((byteAt(packed.m_data, keyCursor++) << 24) >> 24)) << 24) >> 24;
                        velocity = ((velocity + ((byteAt(packed.m_data, velocityCursor++) << 24) >> 24)) << 24) >> 24;
                        out.p1(key & 127);
                        out.p1(velocity & 127);
                    } else if (previousEvent === 1) {
                        if (changed) {
                            out.p1(128 + channel);
                        }

                        key = ((key + ((byteAt(packed.m_data, keyCursor++) << 24) >> 24)) << 24) >> 24;
                        offVelocity = ((offVelocity + ((byteAt(packed.m_data, offCursor++) << 24) >> 24)) << 24) >> 24;
                        out.p1(key & 127);
                        out.p1(offVelocity & 127);
                    } else if (previousEvent === 2) {
                        if (changed) {
                            out.p1(176 + channel);
                        }

                        controller = (controller + ((byteAt(packed.m_data, ccIndex++) << 24) >> 24)) & 127;
                        out.p1(controller);
                        let value: number;
                        if (controller === 0 || controller === 32) {
                            value = (byteAt(packed.m_data, programCursor++) << 24) >> 24;
                        } else if (controller === 1) {
                            value = (byteAt(packed.m_data, modHighCursor++) << 24) >> 24;
                        } else if (controller === 33) {
                            value = (byteAt(packed.m_data, modLowCursor++) << 24) >> 24;
                        } else if (controller === 7) {
                            value = (byteAt(packed.m_data, volumeHighCursor++) << 24) >> 24;
                        } else if (controller === 39) {
                            value = (byteAt(packed.m_data, volumeLowCursor++) << 24) >> 24;
                        } else if (controller === 10) {
                            value = (byteAt(packed.m_data, panHighCursor++) << 24) >> 24;
                        } else if (controller === 42) {
                            value = (byteAt(packed.m_data, panLowCursor++) << 24) >> 24;
                        } else if (controller === 99) {
                            value = (byteAt(packed.m_data, nrpnHighCursor++) << 24) >> 24;
                        } else if (controller === 98) {
                            value = (byteAt(packed.m_data, nrpnLowCursor++) << 24) >> 24;
                        } else if (controller === 101) {
                            value = (byteAt(packed.m_data, rpnHighCursor++) << 24) >> 24;
                        } else if (controller === 100) {
                            value = (byteAt(packed.m_data, rpnLowCursor++) << 24) >> 24;
                        } else if (controller !== 64 && controller !== 65 && controller !== 120 && controller !== 121 && controller !== 123) {
                            value = (byteAt(packed.m_data, otherCursor++) << 24) >> 24;
                        } else {
                            value = (byteAt(packed.m_data, switchCursor++) << 24) >> 24;
                        }

                        value = ((value + values[controller]) << 24) >> 24;
                        values[controller] = value;
                        out.p1(value & 127);
                    } else if (previousEvent === 3) {
                        if (changed) {
                            out.p1(224 + channel);
                        }

                        const wheelLow = wheel + ((byteAt(packed.m_data, wheelLowCursor++) << 24) >> 24);
                        wheel = wheelLow + (((byteAt(packed.m_data, wheelHighCursor++) << 24) >> 24) << 7);
                        out.p1(wheel & 127);
                        out.p1((wheel >> 7) & 127);
                    } else if (previousEvent === 4) {
                        if (changed) {
                            out.p1(208 + channel);
                        }

                        channelPressure = ((channelPressure + ((byteAt(packed.m_data, pressureCursor++) << 24) >> 24)) << 24) >> 24;
                        out.p1(channelPressure & 127);
                    } else if (previousEvent === 5) {
                        if (changed) {
                            out.p1(160 + channel);
                        }

                        key = ((key + ((byteAt(packed.m_data, keyCursor++) << 24) >> 24)) << 24) >> 24;
                        keyPressure = ((keyPressure + ((byteAt(packed.m_data, polyCursor++) << 24) >> 24)) << 24) >> 24;
                        out.p1(key & 127);
                        out.p1(keyPressure & 127);
                    } else {
                        if (previousEvent !== 6) {
                            throw new Error('Invalid packed MIDI event');
                        }

                        if (changed) {
                            out.p1(192 + channel);
                        }

                        out.p1((byteAt(packed.m_data, programCursor++) << 24) >> 24);
                    }
                }
            }
        }
    }
}
