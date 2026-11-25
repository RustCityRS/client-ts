import type Js5Resources from '#/cache/Js5Resources.js';
import { requireNonNull } from '#/util/JavaArray.js';
import { expect, test } from 'bun:test';
import { fileURLToPath } from 'node:url';

// A full login mutates the game's singleton state, including scene slots, audio fade, UI callbacks
// and network buffers. Match the oracle's fresh JVM for each independent login scenario.
export function loginFixture(url: string, name: string, run: () => Promise<void>, timeout = 45000, identity?: 'sd' | 'gl'): void {
    const file = fileURLToPath(url);
    if (process.env.RS530_LOGIN_FIXTURE === file) {
        test(name, run, timeout);
        return;
    }
    test(
        name,
        () => {
            const child = Bun.spawnSync([process.execPath, 'test', '--test-name-pattern', name, file], {
                env: { ...process.env, ...(identity && { RS530_GAMEPACK_IDENTITY: identity }), RS530_LOGIN_FIXTURE: file },
                timeout: timeout + 2000
            });
            expect(child.exitCode, child.stderr.toString()).toBe(0);
            expect(child.stderr.toString()).toMatch(/^\s*1 pass$/m);
        },
        timeout + 4000
    );
}

export function setLoginChecksums(assets: Js5Resources, crc: (archive: number) => number): void {
    for (let id = 0; id < 28; id++) {
        const archive = assets.archive(id);
        archive.GetIndexCrc();
        Object.assign(requireNonNull(archive['index']), { m_indexCRC: crc(id) });
    }
}

// bi.g and mg.H, the public key embedded in the 530 gamepack.
export const javaRsaExponent = 58778699976184461502525193738213253649000149147835990136706041084440742975821n;
export const javaRsaModulus = 7162900525229798032761816791230527296329313291232324290237849263501208207972894053929065636522363163621000728841182238772712427862772219676577293600221789n;
