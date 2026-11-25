import JagVorbis from './JagVorbis';

export default class Mapping {
    // fh.a:[I
    floors: Int32Array;
    // fh.b:I
    mux = 0;
    // fh.c:[I
    residues: Int32Array;
    // fh.d:I
    submaps: number;
    // fh.<init>()V
    constructor() {
        JagVorbis.ReadBits(16);
        this.submaps = JagVorbis.ReadBit() !== 0 ? JagVorbis.ReadBits(4) + 1 : 1;
        if (JagVorbis.ReadBit() !== 0) JagVorbis.ReadBits(8);
        JagVorbis.ReadBits(2);
        if (this.submaps > 1) this.mux = JagVorbis.ReadBits(4);
        this.floors = new Int32Array(this.submaps);
        this.residues = new Int32Array(this.submaps);
        for (let i = 0; i < this.submaps; i++) {
            JagVorbis.ReadBits(8);
            this.floors[i] = JagVorbis.ReadBits(8);
            this.residues[i] = JagVorbis.ReadBits(8);
        }
    }
}
