import type Js5 from '#/cache/Js5';
import HashTable from '#/datastruct/HashTable';
import { arrayAtI32, arrayPutI32, requireNonNull } from '#/util/JavaArray';
import JagFX from './JagFX';
import type Wave from './Wave';
import JagVorbis from './JagVorbis';

export default class WaveCache {
    // ll.b:Lal;
    private readonly vorbis: Js5 | null;
    // ll.h:Lal;
    private readonly synths: Js5 | null;
    // ll.i:Lnc;
    private readonly compressed = new HashTable<JagVorbis>(256);
    // ll.t:Lnc;
    private readonly decoded = new HashTable<Wave>(256);
    // ll.a(I[II)Lji;
    GetJagFx(id: number, budget: Int32Array | null): Wave | null {
        if (requireNonNull(this.synths).GetGroupIdLimit() === 1) return this.GetJagFx2(0, id, budget);
        if (requireNonNull(this.synths).GetFileIdLimit(id) === 1) return this.GetJagFx2(id, 0, budget);
        throw new Error('Ambiguous synth group');
    }
    // ll.a([IIIB)Lji;
    private GetJagFx2(group: number, file: number, budget: Int32Array | null): Wave | null {
        const id = (file ^ ((group >>> 12) | ((group << 4) & 65521))) | (group << 16),
            key = BigInt(id);
        let sound = this.decoded.get(key);
        if (sound !== null) return sound;
        if (budget !== null && arrayAtI32(budget, 0) <= 0) return null;
        const effect = JagFX.load(requireNonNull(this.synths), group, file);
        if (effect === null) return null;
        sound = effect.toPcm();
        this.decoded.put(sound, key);
        if (budget !== null) arrayPutI32(budget, 0, arrayAtI32(budget, 0) - requireNonNull(sound.samples).length);
        return sound;
    }
    // ll.a(IB[II)Lji;
    private GetJagVorbis2(group: number, file: number, budget: Int32Array | null): Wave | null {
        const id = (file ^ (((group << 4) & 65527) | (group >>> 12))) | (group << 16),
            key = 0x100000000n ^ BigInt(id);
        let sound = this.decoded.get(key);
        if (sound !== null) return sound;
        if (budget !== null && arrayAtI32(budget, 0) <= 0) return null;
        let compressed = this.compressed.get(key);
        if (compressed === null) {
            compressed = JagVorbis.Load(requireNonNull(this.vorbis), group, file);
            if (compressed === null) return null;
            this.compressed.put(compressed, key);
        }
        sound = compressed.ToWaveMultistep(budget);
        if (sound === null) return null;
        compressed.Unlink();
        this.decoded.put(sound, key);
        return sound;
    }
    // ll.a(II[I)Lji;
    GetJagVorbis(id: number, budget: Int32Array | null): Wave | null {
        if (requireNonNull(this.vorbis).GetGroupIdLimit() === 1) return this.GetJagVorbis2(0, id, budget);
        if (requireNonNull(this.vorbis).GetFileIdLimit(id) === 1) return this.GetJagVorbis2(id, 0, budget);
        throw new Error('Ambiguous Vorbis group');
    }
    // ll.<init>(Lal;Lal;)V
    constructor(synths: Js5 | null, vorbis: Js5 | null) {
        this.synths = synths;
        this.vorbis = vorbis;
    }
}
