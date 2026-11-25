import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Runs driver-gpu-node.ts under node with headless Dawn (the 'webgpu' package; Bun 1.2 crashes loading dawn.node).
// The runner is bundled with Bun.build first, so node needs no TypeScript or path-alias support.

export interface NodeCheck {
    readonly name: string;
    readonly ok: boolean;
    readonly detail: string;
}

export interface NodeReport {
    readonly exitCode: number;
    readonly output: string;
    readonly adapter: string;
    readonly checks: readonly NodeCheck[];
    readonly dir: string;
}

export interface ReplayCase {
    readonly name: string;
    readonly trace: string;
    readonly blobs: string;
    readonly profile: string;
    readonly native?: string;
}

export async function runDriverNode(mode: 'gpu' | 'replay' | 'title' | 'terrain' | 'water', cases: readonly ReplayCase[] = []): Promise<NodeReport> {
    const dir = mkdtempSync(join(tmpdir(), 'rs530-driver-' + mode + '-'));
    const build = await Bun.build({ entrypoints: [join(import.meta.dir, 'driver-gpu-node.ts')], target: 'node', format: 'esm', outdir: dir });
    if (!build.success) throw new Error('bundle failed: ' + build.logs.map(l => String(l)).join('\n'));
    const bundle = build.outputs[0].path;
    const webgpu = createRequire(import.meta.url).resolve('webgpu');
    const config = join(dir, 'config.json');
    writeFileSync(config, JSON.stringify({ webgpu, mode, out: dir, cases }));
    const run = Bun.spawnSync(['node', bundle, config], { timeout: 300000 });
    const output = run.stdout.toString() + run.stderr.toString();
    let report: { adapter: string; checks: NodeCheck[] } = { adapter: '', checks: [] };
    try {
        report = JSON.parse(readFileSync(join(dir, 'report.json'), 'utf8'));
    } catch {
        // no report: the run failed before writing it; exitCode and output say why
    }
    return { exitCode: run.exitCode ?? -1, output, adapter: report.adapter, checks: report.checks, dir };
}
