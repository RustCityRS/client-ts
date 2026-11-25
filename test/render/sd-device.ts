import { createRequire } from 'node:module';
import { join } from 'node:path';
import { readFileSync, writeFileSync } from 'node:fs';
import type { SdRasterFrame } from '#/dash3d/SdRasterSpans.js';

// Dawn runs in Node. Bun executes the actual 530 scene and leaves its GPU input words here.
export async function renderSdFrames(dir: string, frames: SdRasterFrame[], resident = false): Promise<Int32Array[]> {
    const entry = join(import.meta.dir, 'sd-device-node.ts');
    const build = await Bun.build({ entrypoints: [entry], target: 'node', format: 'esm', outdir: dir });
    if (!build.success) throw new Error(build.logs.map(String).join('\n'));
    const manifest = frames.map((frame, index) => {
        const save = (name: string, words: Int32Array): string => {
            const file = join(dir, `sd-${index}-${name}.bin`);
            writeFileSync(file, words);
            return file;
        };
        return {
            width: frame.width,
            height: frame.height,
            initial: save('initial', frame.initial),
            assets: save('assets', frame.assets),
            batches: frame.batches.map((batch, i) => save(String(i), batch)),
            feedback: frame.feedback?.map(({ offset, pixels }, i) => ({ offset, image: save('feedback-' + i, pixels) })),
            output: join(dir, `sd-${index}-gpu.bin`)
        };
    });
    const data = join(dir, 'sd-frames.json');
    writeFileSync(data, JSON.stringify(manifest));
    const run = Bun.spawnSync(['node', build.outputs[0].path, createRequire(import.meta.url).resolve('webgpu'), data, resident ? 'resident' : 'isolated']);
    if (run.exitCode !== 0) throw new Error(run.stderr.toString() + run.stdout.toString());
    return manifest.map(({ output, feedback }, index) => {
        if (feedback)
            feedback.forEach(({ image }, i) => {
                const bytes = readFileSync(image);
                const retained = frames[index].feedback?.[i];
                if (!retained) throw new Error('Missing SD feedback image ' + i);
                retained.pixels.set(new Int32Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 4));
            });
        const data = readFileSync(output);
        return new Int32Array(data.buffer, data.byteOffset, data.byteLength / 4);
    });
}
