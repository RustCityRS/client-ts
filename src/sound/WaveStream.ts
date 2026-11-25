import PCMStream from './PCMStream';
import Wave from './Wave';
import PCMPlayer from './PCMPlayer';
import { arrayAtI32, arrayAtI8, arrayPutI32, requireNonNull } from '#/util/JavaArray';
import { intDivide, intRemainder, doubleToInt } from '#/util/IntUtils';

export default class WaveStream extends PCMStream {
    // jc.u:I
    private rightStep = 0;
    // jc.v:I
    private gain = 0;
    // jc.w:I
    private loopStart = 0;
    // jc.x:Z
    private pingPong = false;
    // jc.y:I
    private loopEnd = 0;
    // jc.z:I
    private pan = 0;
    // jc.A:I
    private rampRemaining = 0;
    // jc.B:I
    private step = 0;
    // jc.C:I
    private targetGain = 0;
    // jc.D:I
    private loops = 0;
    // jc.E:I
    private leftGain = 0;
    // jc.F:I
    private leftStep = 0;
    // jc.G:I
    private gainStep = 0;
    // jc.H:I
    private rightGain = 0;
    // jc.I:I
    private position = 0;

    // jc.b(I)V
    SetLoopCount(loops: number): void {
        this.loops = loops;
    }

    // jc.c(I)V
    SetPositionFine(position: number): void {
        const end = requireNonNull((requireNonNull(this.sound) as Wave).samples).length << 8;
        if (position < -1) {
            position = -1;
        }

        if (position > end) {
            position = end;
        }

        this.position = position;
    }

    // jc.a(II)I
    private static GetRVol(gain: number, pan: number): number {
        return pan < 0 ? -gain | 0 : doubleToInt(gain * Math.sqrt(pan / 8192) + 0.5);
    }

    // jc.e()Z
    Isfinished(): boolean {
        return this.position < 0 || this.position >= requireNonNull((requireNonNull(this.sound) as Wave).samples).length << 8;
    }

    // jc.b([III)V
    DoMix(buffer: Int32Array | null, offset: number, count: number): void {
        if (this.targetGain === 0 && this.rampRemaining === 0) {
            this.PretendToMix(count);
        } else {
            const sound = requireNonNull(this.sound) as Wave;
            const loopStart = this.loopStart << 8;
            const loopEnd = this.loopEnd << 8;
            const end = requireNonNull(sound.samples).length << 8;
            const span = (loopEnd - loopStart) | 0;
            if (span <= 0) {
                this.loops = 0;
            }

            let cursor = offset;
            count = (count + offset) | 0;
            if (this.position < 0) {
                if (this.step <= 0) {
                    this.SkipRampNounLink();
                    this.Unlink();
                    return;
                }

                this.position = 0;
            }

            if (this.position >= end) {
                if (this.step >= 0) {
                    this.SkipRampNounLink();
                    this.Unlink();
                    return;
                }

                this.position = (end - 1) | 0;
            }

            if (this.loops < 0) {
                if (this.pingPong) {
                    if (this.step < 0) {
                        cursor = this.MixBackwardSto(buffer, offset, loopStart, count, arrayAtI8(sound.samples, this.loopStart));
                        if (this.position >= loopStart) {
                            return;
                        }

                        this.position = (loopStart + loopStart - 1 - this.position) | 0;
                        this.step = -this.step | 0;
                    }

                    while (true) {
                        cursor = this.MixForwardSto(buffer, cursor, loopEnd, count, arrayAtI8(sound.samples, (this.loopEnd - 1) | 0));
                        if (this.position < loopEnd) {
                            return;
                        }

                        this.position = (loopEnd + loopEnd - 1 - this.position) | 0;
                        this.step = -this.step | 0;
                        cursor = this.MixBackwardSto(buffer, cursor, loopStart, count, arrayAtI8(sound.samples, this.loopStart));
                        if (this.position >= loopStart) {
                            return;
                        }

                        this.position = (loopStart + loopStart - 1 - this.position) | 0;
                        this.step = -this.step | 0;
                    }
                } else if (this.step < 0) {
                    while (true) {
                        cursor = this.MixBackwardSto(buffer, cursor, loopStart, count, arrayAtI8(sound.samples, (this.loopEnd - 1) | 0));
                        if (this.position >= loopStart) {
                            return;
                        }

                        this.position = (loopEnd - 1 - intRemainder((loopEnd - 1 - this.position) | 0, span)) | 0;
                    }
                } else {
                    while (true) {
                        cursor = this.MixForwardSto(buffer, cursor, loopEnd, count, arrayAtI8(sound.samples, this.loopStart));
                        if (this.position < loopEnd) {
                            return;
                        }

                        this.position = (loopStart + intRemainder((this.position - loopStart) | 0, span)) | 0;
                    }
                }
            } else {
                if (this.loops > 0) {
                    finiteLoops: if (this.pingPong) {
                        if (this.step < 0) {
                            cursor = this.MixBackwardSto(buffer, offset, loopStart, count, arrayAtI8(sound.samples, this.loopStart));
                            if (this.position >= loopStart) {
                                return;
                            }

                            this.position = (loopStart + loopStart - 1 - this.position) | 0;
                            this.step = -this.step | 0;
                            if (--this.loops === 0) {
                                break finiteLoops;
                            }
                        }

                        do {
                            cursor = this.MixForwardSto(buffer, cursor, loopEnd, count, arrayAtI8(sound.samples, (this.loopEnd - 1) | 0));
                            if (this.position < loopEnd) {
                                return;
                            }

                            this.position = (loopEnd + loopEnd - 1 - this.position) | 0;
                            this.step = -this.step | 0;
                            if (--this.loops === 0) {
                                break;
                            }

                            cursor = this.MixBackwardSto(buffer, cursor, loopStart, count, arrayAtI8(sound.samples, this.loopStart));
                            if (this.position >= loopStart) {
                                return;
                            }

                            this.position = (loopStart + loopStart - 1 - this.position) | 0;
                            this.step = -this.step | 0;
                        } while (--this.loops !== 0);
                    } else if (this.step < 0) {
                        while (true) {
                            cursor = this.MixBackwardSto(buffer, cursor, loopStart, count, arrayAtI8(sound.samples, (this.loopEnd - 1) | 0));
                            if (this.position >= loopStart) {
                                return;
                            }

                            const reverseLoops = intDivide((loopEnd - 1 - this.position) | 0, span);
                            if (reverseLoops >= this.loops) {
                                this.position = (this.position + Math.imul(span, this.loops)) | 0;
                                this.loops = 0;
                                break;
                            }

                            this.position = (this.position + Math.imul(span, reverseLoops)) | 0;
                            this.loops = (this.loops - reverseLoops) | 0;
                        }
                    } else {
                        while (true) {
                            cursor = this.MixForwardSto(buffer, cursor, loopEnd, count, arrayAtI8(sound.samples, this.loopStart));
                            if (this.position < loopEnd) {
                                return;
                            }

                            const passedLoops = intDivide((this.position - loopStart) | 0, span);
                            if (passedLoops >= this.loops) {
                                this.position = (this.position - Math.imul(span, this.loops)) | 0;
                                this.loops = 0;
                                break;
                            }

                            this.position = (this.position - Math.imul(span, passedLoops)) | 0;
                            this.loops = (this.loops - passedLoops) | 0;
                        }
                    }
                }

                if (this.step < 0) {
                    this.MixBackwardSto(buffer, cursor, 0, count, 0);
                    if (this.position < 0) {
                        this.position = -1;
                        this.SkipRampNounLink();
                        this.Unlink();
                        return;
                    }
                } else {
                    this.MixForwardSto(buffer, cursor, end, count, 0);
                    if (this.position >= end) {
                        this.position = end;
                        this.SkipRampNounLink();
                        this.Unlink();
                    }
                }
            }
        }
    }

    // jc.a([B[IIIIIIILjc;)I
    private static DoMixForwards1To1Mono(samples: Int8Array | null, buffer: Int32Array | null, position: number, cursor: number, gain: number, limit: number, end: number, boundary: number, stream: WaveStream): number {
        position >>= 8;
        boundary >>= 8;
        gain <<= 2;
        if ((limit = (cursor + boundary - position) | 0) > end) {
            limit = end;
        }

        limit = (limit - 3) | 0;

        while (cursor < limit) {
            arrayPutI32(buffer, cursor, arrayAtI32(buffer, cursor) + Math.imul(arrayAtI8(samples, position++), gain));
            cursor++;
            arrayPutI32(buffer, cursor, arrayAtI32(buffer, cursor) + Math.imul(arrayAtI8(samples, position++), gain));
            cursor++;
            arrayPutI32(buffer, cursor, arrayAtI32(buffer, cursor) + Math.imul(arrayAtI8(samples, position++), gain));
            cursor++;
            arrayPutI32(buffer, cursor, arrayAtI32(buffer, cursor) + Math.imul(arrayAtI8(samples, position++), gain));
            cursor++;
        }

        limit = (limit + 3) | 0;

        while (cursor < limit) {
            arrayPutI32(buffer, cursor, arrayAtI32(buffer, cursor) + Math.imul(arrayAtI8(samples, position++), gain));
            cursor++;
        }

        stream.position = position << 8;
        return cursor;
    }

    // jc.a(Lji;II)Ljc;
    static NewRatePercent(source: Wave, percent: number, volume: number): WaveStream | null {
        if (source.samples === null || source.samples.length === 0) return null;
        const numerator = BigInt.asIntN(64, BigInt(source.rate) * 256n * BigInt(percent));
        const step = Number(BigInt.asIntN(32, numerator / BigInt(Math.imul(100, PCMPlayer.m_frequency))));
        return new WaveStream(source, step, volume << 6);
    }

    // jc.d(I)V
    RampOut(frames: number): void {
        if (frames === 0) {
            this.SetVolumeFine(0);
            this.Unlink();
        } else if (this.leftGain === 0 && this.rightGain === 0) {
            this.rampRemaining = 0;
            this.targetGain = 0;
            this.gain = 0;
            this.Unlink();
        } else {
            let max = -this.gain | 0;
            if (this.gain > max) {
                max = this.gain;
            }

            if ((-this.leftGain | 0) > max) {
                max = -this.leftGain | 0;
            }

            if (this.leftGain > max) {
                max = this.leftGain;
            }

            if ((-this.rightGain | 0) > max) {
                max = -this.rightGain | 0;
            }

            if (this.rightGain > max) {
                max = this.rightGain;
            }

            if (frames > max) {
                frames = max;
            }

            this.rampRemaining = frames;
            this.targetGain = -2147483648;
            this.gainStep = intDivide(-this.gain | 0, frames);
            this.leftStep = intDivide(-this.leftGain | 0, frames);
            this.rightStep = intDivide(-this.rightGain | 0, frames);
        }
    }

    // jc.b(II)I
    private static GetLVol(gain: number, pan: number): number {
        return pan < 0 ? gain : doubleToInt(gain * Math.sqrt(((16384 - pan) | 0) / 8192) + 0.5);
    }

    // jc.f()Z
    private FinaliseRamp(): boolean {
        let gain = this.targetGain;
        let left: number;
        let right: number;
        if (gain === -2147483648) {
            right = 0;
            left = 0;
            gain = 0;
        } else {
            left = WaveStream.GetLVol(gain, this.pan);
            right = WaveStream.GetRVol(gain, this.pan);
        }

        if (this.gain === gain && this.leftGain === left && this.rightGain === right) {
            if (this.targetGain === -2147483648) {
                this.targetGain = 0;
                this.gain = this.leftGain = this.rightGain = 0;
                this.Unlink();
                return true;
            } else {
                this.SetMLRVol();
                return false;
            }
        } else {
            if (this.gain < gain) {
                this.gainStep = 1;
                this.rampRemaining = (gain - this.gain) | 0;
            } else if (this.gain > gain) {
                this.gainStep = -1;
                this.rampRemaining = (this.gain - gain) | 0;
            } else {
                this.gainStep = 0;
            }

            if (this.leftGain < left) {
                this.leftStep = 1;
                if (this.rampRemaining === 0 || this.rampRemaining > ((left - this.leftGain) | 0)) {
                    this.rampRemaining = (left - this.leftGain) | 0;
                }
            } else if (this.leftGain > left) {
                this.leftStep = -1;
                if (this.rampRemaining === 0 || this.rampRemaining > ((this.leftGain - left) | 0)) {
                    this.rampRemaining = (this.leftGain - left) | 0;
                }
            } else {
                this.leftStep = 0;
            }

            if (this.rightGain < right) {
                this.rightStep = 1;
                if (this.rampRemaining === 0 || this.rampRemaining > ((right - this.rightGain) | 0)) {
                    this.rampRemaining = (right - this.rightGain) | 0;
                }
            } else if (this.rightGain > right) {
                this.rightStep = -1;
                if (this.rampRemaining === 0 || this.rampRemaining > ((this.rightGain - right) | 0)) {
                    this.rampRemaining = (this.rightGain - right) | 0;
                }
            } else {
                this.rightStep = 0;
            }

            return false;
        }
    }

    // jc.b([B[IIIIIIILjc;)I
    private static DoMixBackwards1To1Mono(samples: Int8Array | null, buffer: Int32Array | null, position: number, cursor: number, gain: number, limit: number, end: number, boundary: number, stream: WaveStream): number {
        position >>= 8;
        boundary >>= 8;
        gain <<= 2;
        if ((limit = (cursor + position - (boundary - 1)) | 0) > end) {
            limit = end;
        }

        limit = (limit - 3) | 0;

        while (cursor < limit) {
            arrayPutI32(buffer, cursor, arrayAtI32(buffer, cursor) + Math.imul(arrayAtI8(samples, position--), gain));
            cursor++;
            arrayPutI32(buffer, cursor, arrayAtI32(buffer, cursor) + Math.imul(arrayAtI8(samples, position--), gain));
            cursor++;
            arrayPutI32(buffer, cursor, arrayAtI32(buffer, cursor) + Math.imul(arrayAtI8(samples, position--), gain));
            cursor++;
            arrayPutI32(buffer, cursor, arrayAtI32(buffer, cursor) + Math.imul(arrayAtI8(samples, position--), gain));
            cursor++;
        }

        limit = (limit + 3) | 0;

        while (cursor < limit) {
            arrayPutI32(buffer, cursor, arrayAtI32(buffer, cursor) + Math.imul(arrayAtI8(samples, position--), gain));
            cursor++;
        }

        stream.position = position << 8;
        return cursor;
    }

    // jc.a(I[B[IIIIIIIILjc;)I
    private static DoMixBackwards1To1Stereo(
        _sample: number,
        samples: Int8Array | null,
        buffer: Int32Array | null,
        position: number,
        cursor: number,
        left: number,
        right: number,
        limit: number,
        end: number,
        boundary: number,
        stream: WaveStream
    ): number {
        position >>= 8;
        boundary >>= 8;
        left <<= 2;
        right <<= 2;
        if ((limit = (cursor + position - (boundary - 1)) | 0) > end) {
            limit = end;
        }

        cursor <<= 1;
        limit <<= 1;
        limit = (limit - 6) | 0;

        while (cursor < limit) {
            let sample = arrayAtI8(samples, position--);
            arrayPutI32(buffer, cursor, arrayAtI32(buffer, cursor) + Math.imul(sample, left));
            cursor++;
            arrayPutI32(buffer, cursor, arrayAtI32(buffer, cursor) + Math.imul(sample, right));
            cursor++;
            sample = arrayAtI8(samples, position--);
            arrayPutI32(buffer, cursor, arrayAtI32(buffer, cursor) + Math.imul(sample, left));
            cursor++;
            arrayPutI32(buffer, cursor, arrayAtI32(buffer, cursor) + Math.imul(sample, right));
            cursor++;
            sample = arrayAtI8(samples, position--);
            arrayPutI32(buffer, cursor, arrayAtI32(buffer, cursor) + Math.imul(sample, left));
            cursor++;
            arrayPutI32(buffer, cursor, arrayAtI32(buffer, cursor) + Math.imul(sample, right));
            cursor++;
            sample = arrayAtI8(samples, position--);
            arrayPutI32(buffer, cursor, arrayAtI32(buffer, cursor) + Math.imul(sample, left));
            cursor++;
            arrayPutI32(buffer, cursor, arrayAtI32(buffer, cursor) + Math.imul(sample, right));
            cursor++;
        }

        limit = (limit + 6) | 0;

        while (cursor < limit) {
            const sample = arrayAtI8(samples, position--);
            arrayPutI32(buffer, cursor, arrayAtI32(buffer, cursor) + Math.imul(sample, left));
            cursor++;
            arrayPutI32(buffer, cursor, arrayAtI32(buffer, cursor) + Math.imul(sample, right));
            cursor++;
        }

        stream.position = position << 8;
        return cursor >> 1;
    }

    // jc.b()Ljj;
    SubstreamNext(): PCMStream | null {
        return null;
    }

    // jc.c(II)V
    RampVolumeFine(frames: number, gain: number): void {
        this.RampVolPanFine(frames, gain, this.GetPanFine());
    }

    // jc.a()Ljj;
    SubstreamStart(): PCMStream | null {
        return null;
    }

    // jc.a([B[IIIIIIIILjc;)I
    private static DoMixForwards1To1RampMono(samples: Int8Array | null, buffer: Int32Array | null, position: number, cursor: number, gain: number, gainStep: number, limit: number, end: number, boundary: number, stream: WaveStream): number {
        position >>= 8;
        boundary >>= 8;
        gain <<= 2;
        gainStep <<= 2;
        if ((limit = (cursor + boundary - position) | 0) > end) {
            limit = end;
        }

        stream.leftGain = (stream.leftGain + Math.imul(stream.leftStep, limit - cursor)) | 0;
        stream.rightGain = (stream.rightGain + Math.imul(stream.rightStep, limit - cursor)) | 0;
        limit = (limit - 3) | 0;

        while (cursor < limit) {
            arrayPutI32(buffer, cursor, arrayAtI32(buffer, cursor) + Math.imul(arrayAtI8(samples, position++), gain));
            cursor++;
            gain = (gain + gainStep) | 0;
            arrayPutI32(buffer, cursor, arrayAtI32(buffer, cursor) + Math.imul(arrayAtI8(samples, position++), gain));
            cursor++;
            gain = (gain + gainStep) | 0;
            arrayPutI32(buffer, cursor, arrayAtI32(buffer, cursor) + Math.imul(arrayAtI8(samples, position++), gain));
            cursor++;
            gain = (gain + gainStep) | 0;
            arrayPutI32(buffer, cursor, arrayAtI32(buffer, cursor) + Math.imul(arrayAtI8(samples, position++), gain));
            cursor++;
            gain = (gain + gainStep) | 0;
        }

        for (let stop = (limit + 3) | 0; cursor < stop; gain = (gain + gainStep) | 0) {
            arrayPutI32(buffer, cursor, arrayAtI32(buffer, cursor) + Math.imul(arrayAtI8(samples, position++), gain));
            cursor++;
        }

        stream.gain = gain >> 2;
        stream.position = position << 8;
        return cursor;
    }

    // jc.e(I)V
    private SetVolumeFine(gain: number): void {
        this.SetVolPanFine(gain, this.GetPanFine());
    }

    // jc.g()V
    private SetMLRVol(): void {
        this.gain = this.targetGain;
        this.leftGain = WaveStream.GetLVol(this.targetGain, this.pan);
        this.rightGain = WaveStream.GetRVol(this.targetGain, this.pan);
    }

    // jc.a(III)V
    RampVolPanFine(frames: number, gain: number, pan: number): void {
        if (frames === 0) {
            this.SetVolPanFine(gain, pan);
        } else {
            const left = WaveStream.GetLVol(gain, pan);
            const right = WaveStream.GetRVol(gain, pan);
            if (this.leftGain === left && this.rightGain === right) {
                this.rampRemaining = 0;
            } else {
                let max = (gain - this.gain) | 0;
                if (((this.gain - gain) | 0) > max) {
                    max = (this.gain - gain) | 0;
                }

                if (((left - this.leftGain) | 0) > max) {
                    max = (left - this.leftGain) | 0;
                }

                if (((this.leftGain - left) | 0) > max) {
                    max = (this.leftGain - left) | 0;
                }

                if (((right - this.rightGain) | 0) > max) {
                    max = (right - this.rightGain) | 0;
                }

                if (((this.rightGain - right) | 0) > max) {
                    max = (this.rightGain - right) | 0;
                }

                if (frames > max) {
                    frames = max;
                }

                this.rampRemaining = frames;
                this.targetGain = gain;
                this.pan = pan;
                this.gainStep = intDivide((gain - this.gain) | 0, frames);
                this.leftStep = intDivide((left - this.leftGain) | 0, frames);
                this.rightStep = intDivide((right - this.rightGain) | 0, frames);
            }
        }
    }

    // jc.a(II[B[IIIIIIIILjc;II)I
    private static DoMixBackwardsStereo(
        interpolated: number,
        index: number,
        samples: Int8Array | null,
        buffer: Int32Array | null,
        position: number,
        cursor: number,
        left: number,
        right: number,
        limit: number,
        end: number,
        boundary: number,
        stream: WaveStream,
        step: number,
        adjacent: number
    ): number {
        if (step === 0 || (limit = (cursor + intDivide((boundary + 256 - position + step) | 0, step)) | 0) > end) {
            limit = end;
        }

        cursor <<= 1;

        for (let stop = limit << 1; cursor < stop; position = (position + step) | 0) {
            index = position >> 8;
            let sample = arrayAtI8(samples, (index - 1) | 0);
            sample = ((sample << 8) + Math.imul(arrayAtI8(samples, index) - sample, position & 0xff)) | 0;
            arrayPutI32(buffer, cursor, arrayAtI32(buffer, cursor) + (Math.imul(sample, left) >> 6));
            cursor++;
            arrayPutI32(buffer, cursor, arrayAtI32(buffer, cursor) + (Math.imul(sample, right) >> 6));
            cursor++;
        }

        if (step === 0 || (limit = ((cursor >> 1) + intDivide((boundary - position + step) | 0, step)) | 0) > end) {
            limit = end;
        }

        limit <<= 1;

        for (let edgeSample = adjacent; cursor < limit; position = (position + step) | 0) {
            interpolated = ((edgeSample << 8) + Math.imul(arrayAtI8(samples, position >> 8) - edgeSample, position & 0xff)) | 0;
            arrayPutI32(buffer, cursor, arrayAtI32(buffer, cursor) + (Math.imul(interpolated, left) >> 6));
            cursor++;
            arrayPutI32(buffer, cursor, arrayAtI32(buffer, cursor) + (Math.imul(interpolated, right) >> 6));
            cursor++;
        }

        stream.position = position;
        return cursor >> 1;
    }

    // jc.a(I[B[IIIIIIIIIILjc;)I
    private static DoMixBackwards1To1RampStereo(
        _sample: number,
        samples: Int8Array | null,
        buffer: Int32Array | null,
        position: number,
        cursor: number,
        left: number,
        right: number,
        leftStep: number,
        rightStep: number,
        limit: number,
        end: number,
        boundary: number,
        stream: WaveStream
    ): number {
        position >>= 8;
        boundary >>= 8;
        left <<= 2;
        right <<= 2;
        leftStep <<= 2;
        rightStep <<= 2;
        if ((limit = (cursor + position - (boundary - 1)) | 0) > end) {
            limit = end;
        }

        stream.gain = (stream.gain + Math.imul(stream.gainStep, limit - cursor)) | 0;
        cursor <<= 1;
        limit <<= 1;
        limit = (limit - 6) | 0;

        while (cursor < limit) {
            let sample = arrayAtI8(samples, position--);
            arrayPutI32(buffer, cursor, arrayAtI32(buffer, cursor) + Math.imul(sample, left));
            cursor++;
            left = (left + leftStep) | 0;
            arrayPutI32(buffer, cursor, arrayAtI32(buffer, cursor) + Math.imul(sample, right));
            cursor++;
            right = (right + rightStep) | 0;
            sample = arrayAtI8(samples, position--);
            arrayPutI32(buffer, cursor, arrayAtI32(buffer, cursor) + Math.imul(sample, left));
            cursor++;
            left = (left + leftStep) | 0;
            arrayPutI32(buffer, cursor, arrayAtI32(buffer, cursor) + Math.imul(sample, right));
            cursor++;
            right = (right + rightStep) | 0;
            sample = arrayAtI8(samples, position--);
            arrayPutI32(buffer, cursor, arrayAtI32(buffer, cursor) + Math.imul(sample, left));
            cursor++;
            left = (left + leftStep) | 0;
            arrayPutI32(buffer, cursor, arrayAtI32(buffer, cursor) + Math.imul(sample, right));
            cursor++;
            right = (right + rightStep) | 0;
            sample = arrayAtI8(samples, position--);
            arrayPutI32(buffer, cursor, arrayAtI32(buffer, cursor) + Math.imul(sample, left));
            cursor++;
            left = (left + leftStep) | 0;
            arrayPutI32(buffer, cursor, arrayAtI32(buffer, cursor) + Math.imul(sample, right));
            cursor++;
            right = (right + rightStep) | 0;
        }

        for (let stop = (limit + 6) | 0; cursor < stop; right = (right + rightStep) | 0) {
            const sample = arrayAtI8(samples, position--);
            arrayPutI32(buffer, cursor, arrayAtI32(buffer, cursor) + Math.imul(sample, left));
            cursor++;
            left = (left + leftStep) | 0;
            arrayPutI32(buffer, cursor, arrayAtI32(buffer, cursor) + Math.imul(sample, right));
            cursor++;
        }

        stream.leftGain = left >> 2;
        stream.rightGain = right >> 2;
        stream.position = position << 8;
        return cursor >> 1;
    }

    // jc.b(I[B[IIIIIIIILjc;)I
    private static DoMixForwards1To1Stereo(
        _sample: number,
        samples: Int8Array | null,
        buffer: Int32Array | null,
        position: number,
        cursor: number,
        left: number,
        right: number,
        limit: number,
        end: number,
        boundary: number,
        stream: WaveStream
    ): number {
        position >>= 8;
        boundary >>= 8;
        left <<= 2;
        right <<= 2;
        if ((limit = (cursor + boundary - position) | 0) > end) {
            limit = end;
        }

        cursor <<= 1;
        limit <<= 1;
        limit = (limit - 6) | 0;

        while (cursor < limit) {
            let sample = arrayAtI8(samples, position++);
            arrayPutI32(buffer, cursor, arrayAtI32(buffer, cursor) + Math.imul(sample, left));
            cursor++;
            arrayPutI32(buffer, cursor, arrayAtI32(buffer, cursor) + Math.imul(sample, right));
            cursor++;
            sample = arrayAtI8(samples, position++);
            arrayPutI32(buffer, cursor, arrayAtI32(buffer, cursor) + Math.imul(sample, left));
            cursor++;
            arrayPutI32(buffer, cursor, arrayAtI32(buffer, cursor) + Math.imul(sample, right));
            cursor++;
            sample = arrayAtI8(samples, position++);
            arrayPutI32(buffer, cursor, arrayAtI32(buffer, cursor) + Math.imul(sample, left));
            cursor++;
            arrayPutI32(buffer, cursor, arrayAtI32(buffer, cursor) + Math.imul(sample, right));
            cursor++;
            sample = arrayAtI8(samples, position++);
            arrayPutI32(buffer, cursor, arrayAtI32(buffer, cursor) + Math.imul(sample, left));
            cursor++;
            arrayPutI32(buffer, cursor, arrayAtI32(buffer, cursor) + Math.imul(sample, right));
            cursor++;
        }

        limit = (limit + 6) | 0;

        while (cursor < limit) {
            const sample = arrayAtI8(samples, position++);
            arrayPutI32(buffer, cursor, arrayAtI32(buffer, cursor) + Math.imul(sample, left));
            cursor++;
            arrayPutI32(buffer, cursor, arrayAtI32(buffer, cursor) + Math.imul(sample, right));
            cursor++;
        }

        stream.position = position << 8;
        return cursor >> 1;
    }

    // jc.a(II[B[IIIIIIIIIILjc;II)I
    private static DoMixForwardsRampStereo(
        _interpolated: number,
        index: number,
        samples: Int8Array | null,
        buffer: Int32Array | null,
        position: number,
        cursor: number,
        left: number,
        right: number,
        leftStep: number,
        rightStep: number,
        limit: number,
        end: number,
        boundary: number,
        stream: WaveStream,
        step: number,
        adjacent: number
    ): number {
        stream.gain = (stream.gain - Math.imul(stream.gainStep, cursor)) | 0;
        if (step === 0 || (limit = (cursor + intDivide((boundary - position + step - 257) | 0, step)) | 0) > end) {
            limit = end;
        }

        cursor <<= 1;

        for (let stop = limit << 1; cursor < stop; position = (position + step) | 0) {
            index = position >> 8;
            let sample = arrayAtI8(samples, index);
            sample = ((sample << 8) + Math.imul(arrayAtI8(samples, (index + 1) | 0) - sample, position & 0xff)) | 0;
            arrayPutI32(buffer, cursor, arrayAtI32(buffer, cursor) + (Math.imul(sample, left) >> 6));
            cursor++;
            left = (left + leftStep) | 0;
            arrayPutI32(buffer, cursor, arrayAtI32(buffer, cursor) + (Math.imul(sample, right) >> 6));
            cursor++;
            right = (right + rightStep) | 0;
        }

        if (step === 0 || (limit = ((cursor >> 1) + intDivide((boundary - position + step - 1) | 0, step)) | 0) > end) {
            limit = end;
        }

        limit <<= 1;

        for (let edgeSample = adjacent; cursor < limit; position = (position + step) | 0) {
            let sample = arrayAtI8(samples, position >> 8);
            sample = ((sample << 8) + Math.imul(edgeSample - sample, position & 0xff)) | 0;
            arrayPutI32(buffer, cursor, arrayAtI32(buffer, cursor) + (Math.imul(sample, left) >> 6));
            cursor++;
            left = (left + leftStep) | 0;
            arrayPutI32(buffer, cursor, arrayAtI32(buffer, cursor) + (Math.imul(sample, right) >> 6));
            cursor++;
            right = (right + rightStep) | 0;
        }

        cursor >>= 1;
        stream.gain = (stream.gain + Math.imul(stream.gainStep, cursor)) | 0;
        stream.leftGain = left;
        stream.rightGain = right;
        stream.position = position;
        return cursor;
    }

    // jc.b(I[B[IIIIIIIIIILjc;)I
    private static DoMixForwards1To1RampStereo(
        _sample: number,
        samples: Int8Array | null,
        buffer: Int32Array | null,
        position: number,
        cursor: number,
        left: number,
        right: number,
        leftStep: number,
        rightStep: number,
        limit: number,
        end: number,
        boundary: number,
        stream: WaveStream
    ): number {
        position >>= 8;
        boundary >>= 8;
        left <<= 2;
        right <<= 2;
        leftStep <<= 2;
        rightStep <<= 2;
        if ((limit = (cursor + boundary - position) | 0) > end) {
            limit = end;
        }

        stream.gain = (stream.gain + Math.imul(stream.gainStep, limit - cursor)) | 0;
        cursor <<= 1;
        limit <<= 1;
        limit = (limit - 6) | 0;

        while (cursor < limit) {
            let sample = arrayAtI8(samples, position++);
            arrayPutI32(buffer, cursor, arrayAtI32(buffer, cursor) + Math.imul(sample, left));
            cursor++;
            left = (left + leftStep) | 0;
            arrayPutI32(buffer, cursor, arrayAtI32(buffer, cursor) + Math.imul(sample, right));
            cursor++;
            right = (right + rightStep) | 0;
            sample = arrayAtI8(samples, position++);
            arrayPutI32(buffer, cursor, arrayAtI32(buffer, cursor) + Math.imul(sample, left));
            cursor++;
            left = (left + leftStep) | 0;
            arrayPutI32(buffer, cursor, arrayAtI32(buffer, cursor) + Math.imul(sample, right));
            cursor++;
            right = (right + rightStep) | 0;
            sample = arrayAtI8(samples, position++);
            arrayPutI32(buffer, cursor, arrayAtI32(buffer, cursor) + Math.imul(sample, left));
            cursor++;
            left = (left + leftStep) | 0;
            arrayPutI32(buffer, cursor, arrayAtI32(buffer, cursor) + Math.imul(sample, right));
            cursor++;
            right = (right + rightStep) | 0;
            sample = arrayAtI8(samples, position++);
            arrayPutI32(buffer, cursor, arrayAtI32(buffer, cursor) + Math.imul(sample, left));
            cursor++;
            left = (left + leftStep) | 0;
            arrayPutI32(buffer, cursor, arrayAtI32(buffer, cursor) + Math.imul(sample, right));
            cursor++;
            right = (right + rightStep) | 0;
        }

        for (let stop = (limit + 6) | 0; cursor < stop; right = (right + rightStep) | 0) {
            const sample = arrayAtI8(samples, position++);
            arrayPutI32(buffer, cursor, arrayAtI32(buffer, cursor) + Math.imul(sample, left));
            cursor++;
            left = (left + leftStep) | 0;
            arrayPutI32(buffer, cursor, arrayAtI32(buffer, cursor) + Math.imul(sample, right));
            cursor++;
        }

        stream.leftGain = left >> 2;
        stream.rightGain = right >> 2;
        stream.position = position << 8;
        return cursor >> 1;
    }

    // jc.f(I)V
    SetRateRaw(speed: number): void {
        if (this.step < 0) {
            this.step = -speed | 0;
        } else {
            this.step = speed;
        }
    }

    // jc.h()V
    private SkipRampNounLink(): void {
        if (this.rampRemaining !== 0) {
            if (this.targetGain === -2147483648) {
                this.targetGain = 0;
            }

            this.rampRemaining = 0;
            this.SetMLRVol();
        }
    }

    // jc.b(II[B[IIIIIIIIIILjc;II)I
    private static DoMixBackwardsRampStereo(
        interpolated: number,
        index: number,
        samples: Int8Array | null,
        buffer: Int32Array | null,
        position: number,
        cursor: number,
        left: number,
        right: number,
        leftStep: number,
        rightStep: number,
        limit: number,
        end: number,
        boundary: number,
        stream: WaveStream,
        step: number,
        adjacent: number
    ): number {
        stream.gain = (stream.gain - Math.imul(stream.gainStep, cursor)) | 0;
        if (step === 0 || (limit = (cursor + intDivide((boundary + 256 - position + step) | 0, step)) | 0) > end) {
            limit = end;
        }

        cursor <<= 1;

        for (let stop = limit << 1; cursor < stop; position = (position + step) | 0) {
            index = position >> 8;
            let sample = arrayAtI8(samples, (index - 1) | 0);
            sample = ((sample << 8) + Math.imul(arrayAtI8(samples, index) - sample, position & 0xff)) | 0;
            arrayPutI32(buffer, cursor, arrayAtI32(buffer, cursor) + (Math.imul(sample, left) >> 6));
            cursor++;
            left = (left + leftStep) | 0;
            arrayPutI32(buffer, cursor, arrayAtI32(buffer, cursor) + (Math.imul(sample, right) >> 6));
            cursor++;
            right = (right + rightStep) | 0;
        }

        if (step === 0 || (limit = ((cursor >> 1) + intDivide((boundary - position + step) | 0, step)) | 0) > end) {
            limit = end;
        }

        limit <<= 1;

        for (let edgeSample = adjacent; cursor < limit; position = (position + step) | 0) {
            interpolated = ((edgeSample << 8) + Math.imul(arrayAtI8(samples, position >> 8) - edgeSample, position & 0xff)) | 0;
            arrayPutI32(buffer, cursor, arrayAtI32(buffer, cursor) + (Math.imul(interpolated, left) >> 6));
            cursor++;
            left = (left + leftStep) | 0;
            arrayPutI32(buffer, cursor, arrayAtI32(buffer, cursor) + (Math.imul(interpolated, right) >> 6));
            cursor++;
            right = (right + rightStep) | 0;
        }

        cursor >>= 1;
        stream.gain = (stream.gain + Math.imul(stream.gainStep, cursor)) | 0;
        stream.leftGain = left;
        stream.rightGain = right;
        stream.position = position;
        return cursor;
    }

    // jc.a(I)V
    PretendToMix(frames: number): void {
        if (this.rampRemaining > 0) {
            if (frames >= this.rampRemaining) {
                if (this.targetGain === -2147483648) {
                    this.targetGain = 0;
                    this.gain = this.leftGain = this.rightGain = 0;
                    this.Unlink();
                    frames = this.rampRemaining;
                }

                this.rampRemaining = 0;
                this.SetMLRVol();
            } else {
                this.gain = (this.gain + Math.imul(this.gainStep, frames)) | 0;
                this.leftGain = (this.leftGain + Math.imul(this.leftStep, frames)) | 0;
                this.rightGain = (this.rightGain + Math.imul(this.rightStep, frames)) | 0;
                this.rampRemaining = (this.rampRemaining - frames) | 0;
            }
        }

        const sound = requireNonNull(this.sound) as Wave;
        const loopStart = this.loopStart << 8;
        const loopEnd = this.loopEnd << 8;
        const end = requireNonNull(sound.samples).length << 8;
        const span = (loopEnd - loopStart) | 0;
        if (span <= 0) {
            this.loops = 0;
        }

        if (this.position < 0) {
            if (this.step <= 0) {
                this.SkipRampNounLink();
                this.Unlink();
                return;
            }

            this.position = 0;
        }

        if (this.position >= end) {
            if (this.step >= 0) {
                this.SkipRampNounLink();
                this.Unlink();
                return;
            }

            this.position = (end - 1) | 0;
        }

        this.position = (this.position + Math.imul(this.step, frames)) | 0;
        if (this.loops < 0) {
            if (!this.pingPong) {
                if (this.step < 0) {
                    if (this.position < loopStart) {
                        this.position = (loopEnd - 1 - intRemainder((loopEnd - 1 - this.position) | 0, span)) | 0;
                    }
                } else if (this.position >= loopEnd) {
                    this.position = (loopStart + intRemainder((this.position - loopStart) | 0, span)) | 0;
                }
            } else {
                if (this.step < 0) {
                    if (this.position >= loopStart) {
                        return;
                    }

                    this.position = (loopStart + loopStart - 1 - this.position) | 0;
                    this.step = -this.step | 0;
                }

                while (this.position >= loopEnd) {
                    this.position = (loopEnd + loopEnd - 1 - this.position) | 0;
                    this.step = -this.step | 0;
                    if (this.position >= loopStart) {
                        return;
                    }

                    this.position = (loopStart + loopStart - 1 - this.position) | 0;
                    this.step = -this.step | 0;
                }
            }
        } else {
            if (this.loops > 0) {
                finiteLoops: if (this.pingPong) {
                    if (this.step < 0) {
                        if (this.position >= loopStart) {
                            return;
                        }

                        this.position = (loopStart + loopStart - 1 - this.position) | 0;
                        this.step = -this.step | 0;
                        if (--this.loops === 0) {
                            break finiteLoops;
                        }
                    }

                    do {
                        if (this.position < loopEnd) {
                            return;
                        }

                        this.position = (loopEnd + loopEnd - 1 - this.position) | 0;
                        this.step = -this.step | 0;
                        if (--this.loops === 0) {
                            break;
                        }

                        if (this.position >= loopStart) {
                            return;
                        }

                        this.position = (loopStart + loopStart - 1 - this.position) | 0;
                        this.step = -this.step | 0;
                    } while (--this.loops !== 0);
                } else if (this.step < 0) {
                    if (this.position >= loopStart) {
                        return;
                    }

                    const reverseLoops = intDivide((loopEnd - 1 - this.position) | 0, span);
                    if (reverseLoops < this.loops) {
                        this.position = (this.position + Math.imul(span, reverseLoops)) | 0;
                        this.loops = (this.loops - reverseLoops) | 0;
                        return;
                    }

                    this.position = (this.position + Math.imul(span, this.loops)) | 0;
                    this.loops = 0;
                } else {
                    if (this.position < loopEnd) {
                        return;
                    }

                    const forwardLoops = intDivide((this.position - loopStart) | 0, span);
                    if (forwardLoops < this.loops) {
                        this.position = (this.position - Math.imul(span, forwardLoops)) | 0;
                        this.loops = (this.loops - forwardLoops) | 0;
                        return;
                    }

                    this.position = (this.position - Math.imul(span, this.loops)) | 0;
                    this.loops = 0;
                }
            }

            if (this.step < 0) {
                if (this.position < 0) {
                    this.position = -1;
                    this.SkipRampNounLink();
                    this.Unlink();
                    return;
                }
            } else if (this.position >= end) {
                this.position = end;
                this.SkipRampNounLink();
                this.Unlink();
            }
        }
    }

    // jc.g(I)V
    ApplyVolume(volume: number): void {
        this.SetVolPanFine(volume << 6, this.GetPanFine());
    }

    // jc.b([B[IIIIIIIILjc;)I
    private static DoMixBackwards1To1RampMono(samples: Int8Array | null, buffer: Int32Array | null, position: number, cursor: number, gain: number, gainStep: number, limit: number, end: number, boundary: number, stream: WaveStream): number {
        position >>= 8;
        boundary >>= 8;
        gain <<= 2;
        gainStep <<= 2;
        if ((limit = (cursor + position - (boundary - 1)) | 0) > end) {
            limit = end;
        }

        stream.leftGain = (stream.leftGain + Math.imul(stream.leftStep, limit - cursor)) | 0;
        stream.rightGain = (stream.rightGain + Math.imul(stream.rightStep, limit - cursor)) | 0;
        limit = (limit - 3) | 0;

        while (cursor < limit) {
            arrayPutI32(buffer, cursor, arrayAtI32(buffer, cursor) + Math.imul(arrayAtI8(samples, position--), gain));
            cursor++;
            gain = (gain + gainStep) | 0;
            arrayPutI32(buffer, cursor, arrayAtI32(buffer, cursor) + Math.imul(arrayAtI8(samples, position--), gain));
            cursor++;
            gain = (gain + gainStep) | 0;
            arrayPutI32(buffer, cursor, arrayAtI32(buffer, cursor) + Math.imul(arrayAtI8(samples, position--), gain));
            cursor++;
            gain = (gain + gainStep) | 0;
            arrayPutI32(buffer, cursor, arrayAtI32(buffer, cursor) + Math.imul(arrayAtI8(samples, position--), gain));
            cursor++;
            gain = (gain + gainStep) | 0;
        }

        for (let stop = (limit + 3) | 0; cursor < stop; gain = (gain + gainStep) | 0) {
            arrayPutI32(buffer, cursor, arrayAtI32(buffer, cursor) + Math.imul(arrayAtI8(samples, position--), gain));
            cursor++;
        }

        stream.gain = gain >> 2;
        stream.position = position << 8;
        return cursor;
    }

    // jc.b(II[B[IIIIIIIILjc;II)I
    private static DoMixBackwardsRampMono(
        interpolated: number,
        index: number,
        samples: Int8Array | null,
        buffer: Int32Array | null,
        position: number,
        cursor: number,
        gain: number,
        gainStep: number,
        limit: number,
        end: number,
        boundary: number,
        stream: WaveStream,
        step: number,
        adjacent: number
    ): number {
        stream.leftGain = (stream.leftGain - Math.imul(stream.leftStep, cursor)) | 0;
        stream.rightGain = (stream.rightGain - Math.imul(stream.rightStep, cursor)) | 0;
        if (step === 0 || (limit = (cursor + intDivide((boundary + 256 - position + step) | 0, step)) | 0) > end) {
            limit = end;
        }

        while (cursor < limit) {
            index = position >> 8;
            const sample = arrayAtI8(samples, (index - 1) | 0);
            arrayPutI32(buffer, cursor, arrayAtI32(buffer, cursor) + (Math.imul((sample << 8) + Math.imul(arrayAtI8(samples, index) - sample, position & 0xff), gain) >> 6));
            cursor++;
            gain = (gain + gainStep) | 0;
            position = (position + step) | 0;
        }

        if (step === 0 || (limit = (cursor + intDivide((boundary - position + step) | 0, step)) | 0) > end) {
            limit = end;
        }

        interpolated = adjacent;

        for (let stride = step; cursor < limit; position = (position + stride) | 0) {
            arrayPutI32(buffer, cursor, arrayAtI32(buffer, cursor) + (Math.imul((interpolated << 8) + Math.imul(arrayAtI8(samples, position >> 8) - interpolated, position & 0xff), gain) >> 6));
            cursor++;
            gain = (gain + gainStep) | 0;
        }

        stream.leftGain = (stream.leftGain + Math.imul(stream.leftStep, cursor)) | 0;
        stream.rightGain = (stream.rightGain + Math.imul(stream.rightStep, cursor)) | 0;
        stream.gain = gain;
        stream.position = position;
        return cursor;
    }

    // jc.i()Z
    Isramping(): boolean {
        return this.rampRemaining !== 0;
    }

    // jc.j()I
    GetVolumeFine(): number {
        return this.targetGain === -2147483648 ? 0 : this.targetGain;
    }

    // jc.c(II[B[IIIIIIIILjc;II)I
    private static DoMixForwardsRampMono(
        _interpolated: number,
        index: number,
        samples: Int8Array | null,
        buffer: Int32Array | null,
        position: number,
        cursor: number,
        gain: number,
        gainStep: number,
        limit: number,
        end: number,
        boundary: number,
        stream: WaveStream,
        step: number,
        adjacent: number
    ): number {
        stream.leftGain = (stream.leftGain - Math.imul(stream.leftStep, cursor)) | 0;
        stream.rightGain = (stream.rightGain - Math.imul(stream.rightStep, cursor)) | 0;
        if (step === 0 || (limit = (cursor + intDivide((boundary - position + step - 257) | 0, step)) | 0) > end) {
            limit = end;
        }

        while (cursor < limit) {
            index = position >> 8;
            const sample = arrayAtI8(samples, index);
            arrayPutI32(buffer, cursor, arrayAtI32(buffer, cursor) + (Math.imul((sample << 8) + Math.imul(arrayAtI8(samples, (index + 1) | 0) - sample, position & 0xff), gain) >> 6));
            cursor++;
            gain = (gain + gainStep) | 0;
            position = (position + step) | 0;
        }

        if (step === 0 || (limit = (cursor + intDivide((boundary - position + step - 1) | 0, step)) | 0) > end) {
            limit = end;
        }

        for (let edgeSample = adjacent; cursor < limit; position = (position + step) | 0) {
            const sample = arrayAtI8(samples, position >> 8);
            arrayPutI32(buffer, cursor, arrayAtI32(buffer, cursor) + (Math.imul((sample << 8) + Math.imul(edgeSample - sample, position & 0xff), gain) >> 6));
            cursor++;
            gain = (gain + gainStep) | 0;
        }

        stream.leftGain = (stream.leftGain + Math.imul(stream.leftStep, cursor)) | 0;
        stream.rightGain = (stream.rightGain + Math.imul(stream.rightStep, cursor)) | 0;
        stream.gain = gain;
        stream.position = position;
        return cursor;
    }

    // jc.a(Lji;III)Ljc;
    static NewRateRawFineVolPan(source: Wave, step: number, gain: number, pan: number): WaveStream | null {
        return source.samples !== null && source.samples.length !== 0 ? new WaveStream(source, step, gain, pan) : null;
    }

    // jc.d(II[B[IIIIIIIILjc;II)I
    private static DoMixForwardsStereo(
        _interpolated: number,
        index: number,
        samples: Int8Array | null,
        buffer: Int32Array | null,
        position: number,
        cursor: number,
        left: number,
        right: number,
        limit: number,
        end: number,
        boundary: number,
        stream: WaveStream,
        step: number,
        adjacent: number
    ): number {
        if (step === 0 || (limit = (cursor + intDivide((boundary - position + step - 257) | 0, step)) | 0) > end) {
            limit = end;
        }

        cursor <<= 1;

        for (let stop = limit << 1; cursor < stop; position = (position + step) | 0) {
            index = position >> 8;
            let sample = arrayAtI8(samples, index);
            sample = ((sample << 8) + Math.imul(arrayAtI8(samples, (index + 1) | 0) - sample, position & 0xff)) | 0;
            arrayPutI32(buffer, cursor, arrayAtI32(buffer, cursor) + (Math.imul(sample, left) >> 6));
            cursor++;
            arrayPutI32(buffer, cursor, arrayAtI32(buffer, cursor) + (Math.imul(sample, right) >> 6));
            cursor++;
        }

        if (step === 0 || (limit = ((cursor >> 1) + intDivide((boundary - position + step - 1) | 0, step)) | 0) > end) {
            limit = end;
        }

        limit <<= 1;

        for (let edgeSample = adjacent; cursor < limit; position = (position + step) | 0) {
            let sample = arrayAtI8(samples, position >> 8);
            sample = ((sample << 8) + Math.imul(edgeSample - sample, position & 0xff)) | 0;
            arrayPutI32(buffer, cursor, arrayAtI32(buffer, cursor) + (Math.imul(sample, left) >> 6));
            cursor++;
            arrayPutI32(buffer, cursor, arrayAtI32(buffer, cursor) + (Math.imul(sample, right) >> 6));
            cursor++;
        }

        stream.position = position;
        return cursor >> 1;
    }

    // jc.a(II[B[IIIIIIILjc;II)I
    private static DoMixForwardsMono(
        _interpolated: number,
        index: number,
        samples: Int8Array | null,
        buffer: Int32Array | null,
        position: number,
        cursor: number,
        gain: number,
        limit: number,
        end: number,
        boundary: number,
        stream: WaveStream,
        step: number,
        adjacent: number
    ): number {
        if (step === 0 || (limit = (cursor + intDivide((boundary - position + step - 257) | 0, step)) | 0) > end) {
            limit = end;
        }

        while (cursor < limit) {
            index = position >> 8;
            const sample = arrayAtI8(samples, index);
            arrayPutI32(buffer, cursor, arrayAtI32(buffer, cursor) + (Math.imul((sample << 8) + Math.imul(arrayAtI8(samples, (index + 1) | 0) - sample, position & 0xff), gain) >> 6));
            cursor++;
            position = (position + step) | 0;
        }

        if (step === 0 || (limit = (cursor + intDivide((boundary - position + step - 1) | 0, step)) | 0) > end) {
            limit = end;
        }

        for (let edgeSample = adjacent; cursor < limit; position = (position + step) | 0) {
            const sample = arrayAtI8(samples, position >> 8);
            arrayPutI32(buffer, cursor, arrayAtI32(buffer, cursor) + (Math.imul((sample << 8) + Math.imul(edgeSample - sample, position & 0xff), gain) >> 6));
            cursor++;
        }

        stream.position = position;
        return cursor;
    }

    // jc.a([IIIII)I
    private MixForwardSto(buffer: Int32Array | null, cursor: number, boundary: number, end: number, adjacent: number): number {
        while (this.rampRemaining > 0) {
            let limit = (cursor + this.rampRemaining) | 0;
            if (limit > end) {
                limit = end;
            }

            this.rampRemaining = (this.rampRemaining + cursor) | 0;
            if (this.step === 256 && (this.position & 0xff) === 0) {
                if (PCMPlayer.m_stereo) {
                    cursor = WaveStream.DoMixForwards1To1RampStereo(0, (requireNonNull(this.sound) as Wave).samples, buffer, this.position, cursor, this.leftGain, this.rightGain, this.leftStep, this.rightStep, 0, limit, boundary, this);
                } else {
                    cursor = WaveStream.DoMixForwards1To1RampMono((requireNonNull(this.sound) as Wave).samples, buffer, this.position, cursor, this.gain, this.gainStep, 0, limit, boundary, this);
                }
            } else if (PCMPlayer.m_stereo) {
                cursor = WaveStream.DoMixForwardsRampStereo(
                    0,
                    0,
                    (requireNonNull(this.sound) as Wave).samples,
                    buffer,
                    this.position,
                    cursor,
                    this.leftGain,
                    this.rightGain,
                    this.leftStep,
                    this.rightStep,
                    0,
                    limit,
                    boundary,
                    this,
                    this.step,
                    adjacent
                );
            } else {
                cursor = WaveStream.DoMixForwardsRampMono(0, 0, (requireNonNull(this.sound) as Wave).samples, buffer, this.position, cursor, this.gain, this.gainStep, 0, limit, boundary, this, this.step, adjacent);
            }

            this.rampRemaining = (this.rampRemaining - cursor) | 0;
            if (this.rampRemaining !== 0) {
                return cursor;
            }

            if (this.FinaliseRamp()) {
                return end;
            }
        }

        if (this.step === 256 && (this.position & 0xff) === 0) {
            return PCMPlayer.m_stereo
                ? WaveStream.DoMixForwards1To1Stereo(0, (requireNonNull(this.sound) as Wave).samples, buffer, this.position, cursor, this.leftGain, this.rightGain, 0, end, boundary, this)
                : WaveStream.DoMixForwards1To1Mono((requireNonNull(this.sound) as Wave).samples, buffer, this.position, cursor, this.gain, 0, end, boundary, this);
        } else {
            return PCMPlayer.m_stereo
                ? WaveStream.DoMixForwardsStereo(0, 0, (requireNonNull(this.sound) as Wave).samples, buffer, this.position, cursor, this.leftGain, this.rightGain, 0, end, boundary, this, this.step, adjacent)
                : WaveStream.DoMixForwardsMono(0, 0, (requireNonNull(this.sound) as Wave).samples, buffer, this.position, cursor, this.gain, 0, end, boundary, this, this.step, adjacent);
        }
    }

    // jc.b([IIIII)I
    private MixBackwardSto(buffer: Int32Array | null, cursor: number, boundary: number, end: number, adjacent: number): number {
        while (this.rampRemaining > 0) {
            let limit = (cursor + this.rampRemaining) | 0;
            if (limit > end) {
                limit = end;
            }

            this.rampRemaining = (this.rampRemaining + cursor) | 0;
            if (this.step === -256 && (this.position & 0xff) === 0) {
                if (PCMPlayer.m_stereo) {
                    cursor = WaveStream.DoMixBackwards1To1RampStereo(0, (requireNonNull(this.sound) as Wave).samples, buffer, this.position, cursor, this.leftGain, this.rightGain, this.leftStep, this.rightStep, 0, limit, boundary, this);
                } else {
                    cursor = WaveStream.DoMixBackwards1To1RampMono((requireNonNull(this.sound) as Wave).samples, buffer, this.position, cursor, this.gain, this.gainStep, 0, limit, boundary, this);
                }
            } else if (PCMPlayer.m_stereo) {
                cursor = WaveStream.DoMixBackwardsRampStereo(
                    0,
                    0,
                    (requireNonNull(this.sound) as Wave).samples,
                    buffer,
                    this.position,
                    cursor,
                    this.leftGain,
                    this.rightGain,
                    this.leftStep,
                    this.rightStep,
                    0,
                    limit,
                    boundary,
                    this,
                    this.step,
                    adjacent
                );
            } else {
                cursor = WaveStream.DoMixBackwardsRampMono(0, 0, (requireNonNull(this.sound) as Wave).samples, buffer, this.position, cursor, this.gain, this.gainStep, 0, limit, boundary, this, this.step, adjacent);
            }

            this.rampRemaining = (this.rampRemaining - cursor) | 0;
            if (this.rampRemaining !== 0) {
                return cursor;
            }

            if (this.FinaliseRamp()) {
                return end;
            }
        }

        if (this.step === -256 && (this.position & 0xff) === 0) {
            return PCMPlayer.m_stereo
                ? WaveStream.DoMixBackwards1To1Stereo(0, (requireNonNull(this.sound) as Wave).samples, buffer, this.position, cursor, this.leftGain, this.rightGain, 0, end, boundary, this)
                : WaveStream.DoMixBackwards1To1Mono((requireNonNull(this.sound) as Wave).samples, buffer, this.position, cursor, this.gain, 0, end, boundary, this);
        } else {
            return PCMPlayer.m_stereo
                ? WaveStream.DoMixBackwardsStereo(0, 0, (requireNonNull(this.sound) as Wave).samples, buffer, this.position, cursor, this.leftGain, this.rightGain, 0, end, boundary, this, this.step, adjacent)
                : WaveStream.DoMixBackwardsMono(0, 0, (requireNonNull(this.sound) as Wave).samples, buffer, this.position, cursor, this.gain, 0, end, boundary, this, this.step, adjacent);
        }
    }

    // jc.b(Z)V
    SetReverse(backwards: boolean): void {
        this.step = ((this.step ^ (this.step >> 31)) + (this.step >>> 31)) | 0;
        if (backwards) {
            this.step = -this.step | 0;
        }
    }

    // jc.b(II[B[IIIIIIILjc;II)I
    private static DoMixBackwardsMono(
        interpolated: number,
        index: number,
        samples: Int8Array | null,
        buffer: Int32Array | null,
        position: number,
        cursor: number,
        gain: number,
        limit: number,
        end: number,
        boundary: number,
        stream: WaveStream,
        step: number,
        adjacent: number
    ): number {
        if (step === 0 || (limit = (cursor + intDivide((boundary + 256 - position + step) | 0, step)) | 0) > end) {
            limit = end;
        }

        while (cursor < limit) {
            index = position >> 8;
            const sample = arrayAtI8(samples, (index - 1) | 0);
            arrayPutI32(buffer, cursor, arrayAtI32(buffer, cursor) + (Math.imul((sample << 8) + Math.imul(arrayAtI8(samples, index) - sample, position & 0xff), gain) >> 6));
            cursor++;
            position = (position + step) | 0;
        }

        if (step === 0 || (limit = (cursor + intDivide((boundary - position + step) | 0, step)) | 0) > end) {
            limit = end;
        }

        interpolated = adjacent;

        for (let stride = step; cursor < limit; position = (position + stride) | 0) {
            arrayPutI32(buffer, cursor, arrayAtI32(buffer, cursor) + (Math.imul((interpolated << 8) + Math.imul(arrayAtI8(samples, position >> 8) - interpolated, position & 0xff), gain) >> 6));
            cursor++;
        }

        stream.position = position;
        return cursor;
    }

    // jc.d()I
    SelfMixCost(): number {
        return this.targetGain === 0 && this.rampRemaining === 0 ? 0 : 1;
    }

    // jc.c()I
    override Priority(): number {
        let priority = Math.imul(this.gain, 3) >> 6;
        priority = ((priority ^ (priority >> 31)) + (priority >>> 31)) | 0;
        if (this.loops === 0) {
            priority = (priority - intDivide(Math.imul(priority, this.position), requireNonNull((requireNonNull(this.sound) as Wave).samples).length << 8)) | 0;
        } else if (this.loops >= 0) {
            priority = (priority - intDivide(Math.imul(priority, this.loopStart), requireNonNull((requireNonNull(this.sound) as Wave).samples).length)) | 0;
        }

        return priority > 255 ? 255 : priority;
    }

    // jc.k()I
    GetPanFine(): number {
        return this.pan < 0 ? -1 : this.pan;
    }

    // jc.d(II)V
    private SetVolPanFine(gain: number, pan: number): void {
        this.targetGain = gain;
        this.pan = pan;
        this.rampRemaining = 0;
        this.SetMLRVol();
    }

    // jc.<init>(Lji;III)V and jc.<init>(Lji;II)V
    private constructor(source: Wave, step: number, gain: number, pan: number = 8192) {
        super();
        this.sound = source;
        this.loopStart = source.loopStart;
        this.loopEnd = source.loopEnd;
        this.pingPong = source.pingPong;
        this.step = step;
        this.targetGain = gain;
        this.pan = pan;
        this.position = 0;
        this.SetMLRVol();
    }

    // jc.l()I
    GetRateRaw(): number {
        return this.step < 0 ? -this.step | 0 : this.step;
    }
}
