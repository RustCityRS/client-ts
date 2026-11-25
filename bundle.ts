import fs from 'node:fs';
import { resolve } from 'node:path';

import { minify } from 'terser';

import { clientPropertyMangling } from './bundleProperties';
import { nth_identifier } from './identifier.js';

const production = process.argv[2] !== 'dev';
let majulaPublic: string | undefined;
if (process.argv[2] === 'majula') {
    if (!process.argv[3]) throw new Error('Usage: bun run build:majula <path-to-rs-majula>');
    majulaPublic = resolve(process.argv[3], 'public', '530');
    if (!fs.statSync(majulaPublic, { throwIfNoEntry: false })?.isDirectory()) throw new Error(`Missing Majula public directory: ${majulaPublic}`);
}
const define: Record<string, string> = {
    'process.env.RS530_GZIP_WASM': JSON.stringify(fs.readFileSync('src/3rdparty/js5-zlib/js5-inflate.wasm').toString('base64')),
    'process.env.RS530_BZIP_WASM': JSON.stringify(fs.readFileSync('src/3rdparty/js5-bzip/js5-bzip.wasm').toString('base64')),
    'process.env.RS530_GAMEPACK_IDENTITY': JSON.stringify('gl'),
    // original key, used 2003-2010
    'process.env.LOGIN_RSAE': JSON.stringify(process.env.LOGIN_RSAE ?? '58778699976184461502525193738213253649000149147835990136706041084440742975821'),
    'process.env.LOGIN_RSAN': JSON.stringify(process.env.LOGIN_RSAN ?? '7162900525229798032761816791230527296329313291232324290237849263501208207972894053929065636522363163621000728841182238772712427862772219676577293600221789')
};

const entrypoint = 'src/Client.ts';
const build = await Bun.build({
    entrypoints: [entrypoint],
    sourcemap: 'external',
    define,
    minify: production,
    drop: production ? ['console'] : []
});
if (!build.success) {
    for (const log of build.logs) console.error(log);
    process.exit(1);
}

const bundle = build.outputs[0];
let source = await bundle.text();
let sourcemap = (await bundle.sourcemap?.text()) ?? '';
if (production) {
    const compressed = await minify(source, {
        format: { ascii_only: true },
        sourceMap: { content: sourcemap },
        toplevel: true,
        compress: { ecma: 2020 },
        mangle: { nth_identifier, properties: clientPropertyMangling(entrypoint, JSON.parse(sourcemap).sources) }
    });
    if (!compressed.code || !compressed.map) throw new Error('Terser did not emit the client and its source map');
    source = compressed.code;
    sourcemap = compressed.map.toString();
}

fs.mkdirSync('out', { recursive: true });
// Older builds emitted the worklet alongside client.js.
fs.rmSync('out/pcm-worklet.js', { force: true });
fs.writeFileSync('out/client.js.map', sourcemap);
fs.writeFileSync('out/client.js', source);
if (majulaPublic) {
    fs.copyFileSync('out/client.js', resolve(majulaPublic, 'client.js'));
}
