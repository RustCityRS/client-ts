import { expect, test } from 'bun:test';
import type Js5 from '../../src/cache/Js5.js';
import ModelUnlit from '../../src/dash3d/ModelUnlit.js';

// cb.a(Lal;II)Lcb; (ModelUnlit.Load). The jar oracle in model-unlit.test.ts drives cb without an archive, so this
// covers the one cross-unit call it cannot reach. Bytecode: `var0.a(-809612665, var2, var1)` -> al.a(III)[B, whose
// second int is the file and third the group (it calls al.a(B, file, null, group)), i.e. Js5.GetFile(file, group).
// So Load(archive, group, file) must fetch (group, file), return null for a missing file, decode the bytes with
// cb(byte[]) otherwise, and throw on a null archive (the invokevirtual on var0).

function archive(result: Uint8Array | null, calls: [number, number][]): Js5 {
    const fake = {
        GetFile(file: number, group: number): Uint8Array | null {
            calls.push([file, group]);
            return result;
        }
    };
    return fake as unknown as Js5;
}

test('ModelUnlit.Load passes (file, group) to Js5.GetFile like cb.a(Lal;II)Lcb;', () => {
    const calls: [number, number][] = [];
    expect(ModelUnlit.Load(archive(null, calls), 1234, 7)).toBeNull();
    expect(calls).toEqual([[7, 1234]]);

    // A minimal old-format model (18-byte footer, not ending in -1,-1): no vertices, faces or textures, priority 5.
    const bytes = new Uint8Array(18);
    bytes[6] = 5;
    const model = ModelUnlit.Load(archive(bytes, calls), 42, 0);
    expect(calls).toEqual([
        [7, 1234],
        [0, 42]
    ]);
    expect(model).toBeInstanceOf(ModelUnlit);
    const m = model as ModelUnlit;
    expect(m.numPoints).toBe(0);
    expect(m.numFaces).toBe(0);
    expect(m.numT).toBe(0);
    expect(m.priority).toBe(5);
    expect(m.facePriority).toBeNull();
    expect(m.faceRenderType).toBeNull();
    expect(m.faceMaterial).toBeNull();

    expect(() => ModelUnlit.Load(null, 0, 0)).toThrow(TypeError);
});
