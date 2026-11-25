import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { hdGamepackPath, joglPath } from './hd-reference.js';

export function inventory(): string {
    const process = Bun.spawnSync([
        'java',
        '--add-exports',
        'java.base/jdk.internal.org.objectweb.asm=ALL-UNNAMED',
        '--add-exports',
        'java.base/jdk.internal.org.objectweb.asm.tree=ALL-UNNAMED',
        join(import.meta.dir, 'HdJoglInventory.java'),
        hdGamepackPath,
        joglPath
    ]);
    if (process.exitCode !== 0) throw new Error(process.stderr.toString());
    return process.stdout.toString().replaceAll('\r\n', '\n');
}

if (import.meta.main) {
    const output = resolve(process.argv[2] || 'out/530-hd-jogl.tsv');
    const data = inventory();
    mkdirSync(dirname(output), { recursive: true });
    writeFileSync(output, data);
    console.log(
        data
            .split('\n')
            .filter(line => /^(jar|summary|opcode|family)\t/.test(line))
            .join('\n')
    );
    console.log('Wrote ' + output);
}
