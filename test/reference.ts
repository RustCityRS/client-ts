import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// A 530 test run includes the Java and cache oracles even when invoked directly
// with "bun test test". Explicit paths take precedence over local defaults.
const defaults = {
    GAMEPACK_530: join(homedir(), 'RustroverProjects', 'rs-majula', 'public', '530', 'client.jar'),
    CACHE_530: fileURLToPath(new URL('../out/cache254', import.meta.url)),
    RS530_CACHE_ZIP: join(tmpdir(), 'rs-530', 'disk.zip')
};

for (const [name, fallback] of Object.entries(defaults)) {
    const path = resolve(process.env[name] || fallback);
    const required = name === 'CACHE_530' ? [join(path, 'main_file_cache.dat2'), join(path, 'main_file_cache.idx255')] : [path];
    for (const file of required) {
        if (!existsSync(file)) throw new Error(`Missing 530 reference ${file}. Set ${name} before running the 530 suite. See README.md.`);
    }
    process.env[name] = path;
}

export const gamepackPath = resolve(process.env.GAMEPACK_530 || defaults.GAMEPACK_530);
export const cachePath = resolve(process.env.CACHE_530 || defaults.CACHE_530);
export const cacheZipPath = resolve(process.env.RS530_CACHE_ZIP || defaults.RS530_CACHE_ZIP);

const sha = createHash('sha256').update(readFileSync(gamepackPath)).digest('hex');
if (sha !== '3d0ea4ddb99319482356ce2b0f38ba6dc82cd351a8ba193d2c306a4c1e0fe4bd') throw new Error('GAMEPACK_530 must identify the original revision 530 SD client.jar');
