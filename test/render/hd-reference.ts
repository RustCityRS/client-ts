import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

function reference(variable: 'GAMEPACK_HD_530' | 'JOGL_530', filename: string, sha256: string): string {
    const sd = resolve(process.env.GAMEPACK_530 || join(homedir(), 'RustroverProjects', 'rs-majula', 'public', '530', 'client.jar'));
    const path = resolve(process.env[variable] || join(dirname(sd), 'hd', filename));
    if (!existsSync(path)) throw new Error('Missing original HD reference ' + path + '. Set ' + variable + ' to ' + filename + '.');
    const digest = createHash('sha256').update(readFileSync(path)).digest('hex');
    if (digest !== sha256) throw new Error(variable + ' has SHA-256 ' + digest + '. Expected ' + sha256 + ' for ' + filename + '.');
    return path;
}

export const hdGamepackPath = reference('GAMEPACK_HD_530', 'runescape_gl.jar', '38df9ba79fdaad00380006c2b98a272d0cc1c55399d201a268a500fbe5df4398');
export const joglPath = reference('JOGL_530', 'jogl.jar', 'af1cf9a3bfc9b4ff7c3262653fda868e068b694cd3fd38849bbf04ad3c3dc79b');
