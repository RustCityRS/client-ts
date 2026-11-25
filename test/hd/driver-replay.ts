import { bitsToFloat, entryRule, type EntryRule, GlTraceWriter, type IntElem, parseTrace, type Role, type TraceRecord, type TraceValue, unescapeText } from '../../src/gl/GlTrace.js';
import { RecordingGLDrawableFactory } from '../../src/gl/RecordingGL.js';
import { glMethods, type GL } from '../../src/jogl/GL.js';
import GLCapabilities from '../../src/jogl/GLCapabilities.js';
import type GLContext from '../../src/jogl/GLContext.js';
import type GLDrawable from '../../src/jogl/GLDrawable.js';
import type GLDrawableFactory from '../../src/jogl/GLDrawableFactory.js';
import type Buffer from '../../src/util/nio/Buffer.js';
import ByteBuffer from '../../src/util/nio/ByteBuffer.js';
import ByteOrder from '../../src/util/nio/ByteOrder.js';
import FloatBuffer from '../../src/util/nio/FloatBuffer.js';
import IntBuffer from '../../src/util/nio/IntBuffer.js';
import ShortBuffer from '../../src/util/nio/ShortBuffer.js';

// Test helper for the WebGpuGL driver (HD batch H1): replays a GLTrace v1 recorded from the Java client (Codex's
// HdInitOracle through GlRecorder.java) into a TS GLDrawableFactory under RecordingGLDrawableFactory, and returns the
// trace the TS side records. Calls are reissued with the recorded arguments: floats from their bits, buffers rebuilt
// with the recorded kind, position, limit, capacity and storage from the inline hex or the blob store, normalized
// names (#T3, @D1, ...) mapped to whatever the replayed driver allocated. The replayed trace equals the Java trace
// exactly when the responder answers as GlRecorder's does, so the same replay into NullGL and into WebGpuGL checks
// that the driver changes nothing the port records. Display-list bodies are reissued as recorded (compiled), and the
// ~gl markers are produced by RecordingGL itself.

export type BlobStore = (sha: string) => Uint8Array;

export interface ReplayOptions {
    // The getGLDrawable target, standing for the Java canvas (@O1).
    readonly target: object;
    // Called with every object the replay creates, keyed by its trace reference (e.g. '@D1').
    readonly onRef?: (token: string, value: object) => void;
}

function tokenOfName(e: IntElem): string {
    if (e.t === 'name') return '#' + e.kind + e.id;
    if (e.t === 'rawname') return '#' + e.kind + '?' + e.v;
    return String(e.v);
}

function utf8(bytes: Uint8Array): string {
    return new TextDecoder().decode(bytes);
}

function doubleOf(bits: bigint): number {
    const b = new BigInt64Array([BigInt.asIntN(64, bits)]);
    return new Float64Array(b.buffer)[0];
}

function storage(buffer: Buffer): Uint8Array {
    if (buffer instanceof ByteBuffer || buffer instanceof ShortBuffer || buffer instanceof IntBuffer || buffer instanceof FloatBuffer) return buffer.storageBytes();
    throw new Error('unsupported buffer');
}

function elementSize(kind: string): number {
    return kind === 'byte' ? 1 : kind === 'short' ? 2 : 4;
}

function makeBuffer(v: Extract<TraceValue, { t: 'buffer' }>, blobs: BlobStore): Buffer {
    let b: Buffer;
    if (v.kind === 'byte') {
        b = v.direct ? ByteBuffer.allocateDirect(v.cap) : ByteBuffer.allocate(v.cap);
    } else if (v.direct) {
        const bytes = ByteBuffer.allocateDirect(v.cap * elementSize(v.kind)).order(ByteOrder.nativeOrder());
        b = v.kind === 'short' ? bytes.asShortBuffer() : v.kind === 'int' ? bytes.asIntBuffer() : bytes.asFloatBuffer();
    } else {
        b = v.kind === 'short' ? ShortBuffer.allocate(v.cap) : v.kind === 'int' ? IntBuffer.allocate(v.cap) : FloatBuffer.allocate(v.cap);
    }
    const data = v.hex !== null ? Uint8Array.from((v.hex.match(/../g) ?? []).map(h => parseInt(h, 16))) : blobs(v.sha);
    storage(b).set(data, v.pos * elementSize(v.kind));
    b.limit(v.lim);
    b.position(v.pos);
    return b;
}

// The JVM descriptor of the overload a record used: the only one, or the one whose roles fit the columns.
function ruleFor(r: TraceRecord): EntryRule {
    const candidates = glMethods.filter(m => m[0] === r.entry).map(m => entryRule(m[0], m[1]));
    const fits = candidates.filter(
        rule =>
            rule.params.length === r.args.length &&
            rule.params.every((role, i) => {
                const v = r.args[i];
                if (role.r === 'long') return v.t === 'long';
                if (role.r === 'buf' || role.r === 'buf-n' || role.r === 'out-buf') return v.t === 'buffer' || v.t === 'null';
                if (role.r === 'in-f' || role.r === 'out-f') return v.t === 'fv' || v.t === 'null';
                return true;
            })
    );
    if (fits.length !== 1) throw new Error('replay: cannot pick an overload of ' + r.entry);
    return fits[0];
}

export function replayTrace(text: string, blobs: BlobStore, factory: GLDrawableFactory, options: ReplayOptions): string {
    const replay = replayTraceMarkers(text, blobs, factory, options);
    for (;;) {
        const step = replay.next();
        if (step.done) return step.value;
    }
}

// A headless caller can allow an asynchronous driver operation to finish at a recorded frame marker.
export function* replayTraceMarkers(text: string, blobs: BlobStore, factory: GLDrawableFactory, options: ReplayOptions): Generator<string, string> {
    const file = parseTrace(text);
    const writer = new GlTraceWriter();
    const refs = new Map<string, object>();
    const names = new Map<string, number>();
    const rec = new RecordingGLDrawableFactory(factory, writer);
    const setRef = (token: string, value: object) => {
        refs.set(token, value);
        options.onRef?.(token, value);
    };
    setRef('@F1', rec);
    setRef('@O1', options.target);
    const ref = (v: TraceValue): object => {
        if (v.t !== 'ref') throw new Error('replay: expected a reference');
        const o = refs.get('@' + v.kind + v.id);
        if (o === undefined) throw new Error('replay: unknown reference @' + v.kind + v.id);
        return o;
    };
    const nameValue = (e: IntElem): number => {
        if (e.t === 'int') return e.v;
        if (e.t === 'rawname') return e.v;
        const raw = names.get(tokenOfName(e));
        if (raw === undefined) throw new Error('replay: unknown name ' + tokenOfName(e));
        return raw;
    };

    for (const r of file.records) {
        if (r.entry === '~gl') continue;
        if (r.entry === '~mark') {
            const label = r.args[0];
            if (label.t !== 'label') throw new Error('replay: bad mark');
            writer.mark(label.text);
            yield label.text;
            continue;
        }
        const invoke = (): unknown => {
            switch (r.entry) {
                case 'GLDrawableFactory.getGLDrawable': {
                    const caps = r.args[2];
                    let c: GLCapabilities | null = null;
                    if (caps.t === 'caps') {
                        c = new GLCapabilities();
                        c.setDoubleBuffered(caps.doubleBuffered);
                        c.setStereo(caps.stereo);
                        c.setHardwareAccelerated(caps.hardwareAccelerated);
                        c.setDepthBits(caps.depthBits);
                        c.setStencilBits(caps.stencilBits);
                        c.setRedBits(caps.redBits);
                        c.setGreenBits(caps.greenBits);
                        c.setBlueBits(caps.blueBits);
                        c.setAlphaBits(caps.alphaBits);
                        c.setAccumRedBits(caps.accumRedBits);
                        c.setAccumGreenBits(caps.accumGreenBits);
                        c.setAccumBlueBits(caps.accumBlueBits);
                        c.setAccumAlphaBits(caps.accumAlphaBits);
                        c.setSampleBuffers(caps.sampleBuffers);
                        c.setNumSamples(caps.numSamples);
                    }
                    return (ref(r.args[0]) as GLDrawableFactory).getGLDrawable(ref(r.args[1]), c, null);
                }
                case 'GLDrawable.setRealized': {
                    const b = r.args[1];
                    return (ref(r.args[0]) as GLDrawable).setRealized(b.t === 'bool' && b.v);
                }
                case 'GLDrawable.createContext':
                    return (ref(r.args[0]) as GLDrawable).createContext(null);
                case 'GLDrawable.swapBuffers':
                    return (ref(r.args[0]) as GLDrawable).swapBuffers();
                case 'GLContext.makeCurrent':
                    return (ref(r.args[0]) as GLContext).makeCurrent();
                case 'GLContext.release':
                    return (ref(r.args[0]) as GLContext).release();
                case 'GLContext.destroy':
                    return (ref(r.args[0]) as GLContext).destroy();
                case 'GLContext.getGL':
                    return (ref(r.args[0]) as GLContext).getGL();
            }
            return invokeGL(r);
        };
        const outputs: { role: Role; index: number; array: Int32Array | Float32Array }[] = [];
        const invokeGL = (record: TraceRecord): unknown => {
            const gl = refs.get('@G1') as GL | undefined;
            if (gl === undefined) throw new Error('replay: GL call before getGL');
            const rule = ruleFor(record);
            const args: unknown[] = [];
            for (let i = 0; i < rule.params.length; i++) {
                const role = rule.params[i];
                const v = record.args[i];
                args.push(argument(role, v, record.args[i + 1], i));
            }
            const method = (gl as unknown as Record<string, (...a: unknown[]) => unknown>)[record.entry];
            return method.apply(gl, args);

            function offsetOf(next: TraceValue | undefined): number {
                return next !== undefined && next.t === 'int' ? next.v : 0;
            }

            function argument(role: Role, v: TraceValue, next: TraceValue | undefined, index: number): unknown {
                if (v.t === 'null') return null;
                switch (role.r) {
                    case 'int':
                    case 'byte':
                        if (v.t !== 'int') throw new Error('replay: int column');
                        return v.v;
                    case 'float':
                        if (v.t !== 'float') throw new Error('replay: float column');
                        return bitsToFloat(v.bits);
                    case 'double':
                        if (v.t !== 'double') throw new Error('replay: double column');
                        return doubleOf(v.bits);
                    case 'bool':
                        if (v.t !== 'bool') throw new Error('replay: bool column');
                        return v.v;
                    case 'long':
                        if (v.t !== 'long') throw new Error('replay: long column');
                        return v.v;
                    case 'string':
                        if (v.t !== 'string') throw new Error('replay: string column');
                        return utf8(v.text !== null ? unescapeText(v.text) : blobs(v.sha));
                    case 'name':
                        if (v.t !== 'int' && v.t !== 'name' && v.t !== 'rawname') throw new Error('replay: name column');
                        return nameValue(v);
                    case 'buf':
                    case 'buf-n':
                        if (v.t !== 'buffer') throw new Error('replay: buffer column');
                        return makeBuffer(v, blobs);
                    case 'out-buf': {
                        if (v.t !== 'buffer') throw new Error('replay: buffer column');
                        const b = FloatBuffer.allocate(v.cap);
                        b.limit(v.lim);
                        b.position(v.pos);
                        return b;
                    }
                    case 'in-f': {
                        if (v.t !== 'fv') throw new Error('replay: fv column');
                        const off = offsetOf(next);
                        const a = new Float32Array(off + v.bits.length);
                        new Uint32Array(a.buffer).set(v.bits, off);
                        return a;
                    }
                    case 'in-names': {
                        if (v.t !== 'iv') throw new Error('replay: iv column');
                        const off = offsetOf(next);
                        return Int32Array.from([...new Array<number>(off).fill(0), ...v.elems.map(nameValue)]);
                    }
                    case 'out-f':
                    case 'out-i':
                    case 'out-names': {
                        const count = v.t === 'fv' ? v.bits.length + v.missing : v.t === 'iv' ? v.elems.length + v.missing : 0;
                        const off = offsetOf(next);
                        const a = role.r === 'out-f' ? new Float32Array(off + count) : new Int32Array(off + count);
                        outputs.push({ role, index, array: a });
                        return a;
                    }
                    case 'caps':
                    case 'ref':
                        throw new Error('replay: unexpected role ' + role.r);
                }
            }
        };
        let result: unknown;
        try {
            result = invoke();
        } catch (e) {
            if (r.thrown === null) throw e;
            continue;
        }
        if (r.thrown !== null) throw new Error('replay: ' + r.entry + ' returned where the trace threw');
        // Learn the names this call allocated (in the recorded order) and the objects it returned.
        for (const o of outputs) {
            if (o.role.r !== 'out-names') continue;
            const v = r.args[o.index];
            const next = r.args[o.index + 1];
            const off = next !== undefined && next.t === 'int' ? next.v : 0;
            if (v.t !== 'iv') continue;
            v.elems.forEach((e, k) => {
                if (e.t === 'name') names.set(tokenOfName(e), (o.array as Int32Array)[off + k]);
            });
        }
        const ret = r.ret;
        if (ret !== null && ret.t === 'ref' && typeof result === 'object' && result !== null) setRef('@' + ret.kind + ret.id, result);
        if (ret !== null && ret.t === 'name' && r.entry === 'glGenLists' && typeof result === 'number') {
            const range = r.args[0];
            const n = range.t === 'int' ? range.v : 1;
            for (let k = 0; k < n; k++) names.set('#L' + (ret.id + k), (result + k) | 0);
        }
    }
    return writer.text();
}
