import { expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { delimiter, join } from 'node:path';
import { tmpdir } from 'node:os';
import Js5 from '#/cache/Js5.js';
import PacketT from '#/io/PacketT.js';
import IdkType from '#/config/IdkType.js';
import { requireNonNull } from '#/util/JavaArray.js';
import { localAssets, readGroup } from './cachefile.js';
import { cachePath, gamepackPath } from './reference.js';

test('identity kits match fi and hk for all cached definitions, partial field writes, model checks and cursor failures', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rs530-idk-'));
    const assets = localAssets(cachePath, [2, 7]),
        config = assets.archive(2),
        models = assets.archive(7);
    const inputs: Uint8Array[] = [];
    const complete = Uint8Array.of(1, 15, 2, 2, 0, 2, 255, 255, 3, 40, 2, 128, 0, 255, 255, 0, 1, 127, 255, 41, 1, 128, 1, 0, 3, 60, 0, 2, 64, 255, 255, 0);
    for (let size = 0; size <= complete.length; size++) inputs.push(complete.subarray(0, size));
    for (let opcode = 0; opcode < 256; opcode++) inputs.push(Uint8Array.of(opcode, 0, 4, 0, 0));
    let checks = 0;
    const ready = models.RequestDownload.bind(models);
    const selected = new Set<number>();
    const probe = Object.create(Js5.prototype) as Js5;
    probe.RequestDownload = (check, group, file) => {
        checks++;
        if ((group & 1) !== 0 || !ready(check, group, file)) return false;
        selected.add(group);
        return true;
    };
    const javaArray = (v: Int32Array | Int16Array | null) => (v === null ? 'null' : '[' + v.join(', ') + ']');
    function snapshot(kit: IdkType, status: string, pos: number): string {
        checks = 0;
        return [
            status,
            pos,
            kit.nonSelectable,
            kit.bodyPart,
            javaArray(kit.headModels),
            javaArray(kit.models),
            javaArray(kit.recolourFrom),
            javaArray(kit.recolourTo),
            javaArray(kit.retextureFrom),
            javaArray(kit.retextureTo),
            kit.CheckHead(),
            kit.CheckModel(),
            checks
        ].join(';');
    }
    try {
        IdkType.Init(config, probe);
        const actual = [String(IdkType.m_numDefinitions)];
        for (let id = -1; id <= IdkType.m_numDefinitions; id++) {
            const value = IdkType.List(id);
            actual.push(snapshot(value, IdkType.List(id) === value ? 'cached' : 'miss', 0));
        }
        for (const bytes of inputs) {
            const kit = new IdkType(),
                packet = new PacketT(bytes);
            let status = 'ok';
            try {
                kit.Decode(packet);
            } catch (error) {
                if (!(error instanceof RangeError)) throw error;
                status = 'error';
            }
            actual.push(snapshot(kit, status, packet.m_pos));
        }
        const provider = requireNonNull(models['provider']);
        const fresh = new Js5(provider, false, false);
        IdkType.Init(config, fresh);
        const group = provider.index()?.groupIds?.[0];
        if (group === undefined) throw new Error('No model groups in the gamepack cache');
        selected.add(group);
        const type = new IdkType();
        const check = () => {
            try {
                return String(type.CheckModel(false));
            } catch {
                return 'error';
            }
        };
        const trace = [check()];
        type.models = new Int32Array(0);
        trace.push(check());
        type.models = Int32Array.of(-1);
        trace.push(check());
        type.models = Int32Array.of(group);
        trace.push(check());
        fresh.GetFile(0, group);
        trace.push(check());
        IdkType.m_numDefinitions = 804;
        let failed = false;
        try {
            IdkType.Init(null, fresh);
        } catch {
            failed = true;
        }
        trace.push(String(failed), String(IdkType.m_pConfigClient === null), String(IdkType.m_pModels === fresh), String(IdkType.m_numDefinitions));
        actual.push(trace.join(' '));
        const cfg = join(dir, 'config'),
            mdl = join(dir, 'models');
        mkdirSync(cfg);
        mkdirSync(mdl);
        writeFileSync(join(cfg, 'index'), readGroup(cachePath, 255, 2));
        writeFileSync(join(cfg, 'g3'), readGroup(cachePath, 2, 3));
        writeFileSync(join(mdl, 'index'), readGroup(cachePath, 255, 7));
        for (const group of selected) writeFileSync(join(mdl, 'g' + group), readGroup(cachePath, 7, group));
        const build = Bun.spawnSync(['javac', '-cp', gamepackPath, '-d', dir, join(import.meta.dir, 'ui', 'IdkOracle.java'), join(import.meta.dir, 'ui', 'FloorConfigOracle.java')]);
        expect(build.stderr.toString()).toBe('');
        expect(build.exitCode).toBe(0);
        const java = Bun.spawnSync(['java', '-cp', dir + delimiter + gamepackPath, 'IdkOracle', cfg, mdl], {
            stdin: Buffer.from(inputs.map(bytes => Buffer.from(bytes).toString('hex')).join('\n') + '\n')
        });
        expect(java.stderr.toString()).toBe('');
        expect(java.exitCode).toBe(0);
        const expected = java.stdout.toString().trim().split(/\r?\n/);
        expect(expected.length).toBe(actual.length);
        actual.forEach((row, i) => expect(row, 'identity kit trace ' + i).toBe(expected[i]));
    } finally {
        IdkType.Init(config, models);
        IdkType.ResetCache();
        rmSync(dir, { recursive: true, force: true });
    }
});
