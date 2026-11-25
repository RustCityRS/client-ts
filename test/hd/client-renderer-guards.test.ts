import { expect } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import Client from '#/client/Client.js';
import LocMergeQueue from '#/client/LocMergeQueue.js';
import GlRenderer from '#/gl/GlRenderer.js';
import Protocol from '#/io/Protocol.js';
import SuperPacket from '#/io/SuperPacket.js';
import IfType from '#/ui/IfType.js';
import InterfaceList from '#/ui/InterfaceList.js';
import WrappedException from '#/util/WrappedException.js';
import { loginFixture } from '../login-fixture.js';
import { hdGamepackPath, joglPath } from '../render/hd-reference.js';

loginFixture(
    import.meta.url,
    'packet 202 and widget 1402 side effects follow the HD renderer switch',
    async () => {
        const dir = mkdtempSync(join(tmpdir(), 'rs530-renderer-guards-'));
        try {
            const cp = [dir, hdGamepackPath, joglPath].join(delimiter);
            const compile = Bun.spawnSync(['javac', '-cp', cp, '-d', dir, join(import.meta.dir, 'ClientRendererGuardsOracle.java')]);
            expect(compile.exitCode, compile.stderr.toString()).toBe(0);
            const java = Bun.spawnSync(['java', '-Djava.awt.headless=true', '-cp', cp, 'ClientRendererGuardsOracle']);
            expect(java.exitCode, java.stderr.toString()).toBe(0);
            const reference = java.stdout.toString().trimEnd().split(/\r?\n/);
            const actual: string[] = [];
            const body = Uint8Array.from({ length: 20 }, (_, i) => 7 + 17 * i);
            for (const active of [false, true]) {
                GlRenderer.active = active;
                for (let size = 0; size <= body.length; size++) {
                    const packet = new SuperPacket(0);
                    packet.m_data = body.subarray(0, size);
                    Protocol.inPacket = packet;
                    Protocol.packetType = 202;
                    LocMergeQueue.pending.clear();
                    let status = 'ok';
                    try {
                        Client.ZonePacket();
                    } catch (error) {
                        if (!(error instanceof WrappedException && error.cause instanceof RangeError)) throw error;
                        status = 'bounds';
                    }
                    actual.push(['packet', active, size, status, packet.m_pos, LocMergeQueue.pending.head() !== null].join(' '));
                }
                for (const current of [false, true]) {
                    const c = Object.assign(new IfType(), { parentId: -1, type: 1, if3: true, hasHook: true, clientCode: 1402, width: 20, height: 20, rootIndex: 1, drawCycle: current ? 9 : 8 });
                    InterfaceList.cycle = 9;
                    InterfaceList.dirty[1] = false;
                    await Client.LoopLayer([c], -1, 0, 0, 30, 30, 0, 0);
                    actual.push(['widget', active, current, InterfaceList.dirty[1]].join(' '));
                }
            }
            expect(reference).toContain('widget false true true');
            expect(reference).toContain('widget true true false');
            expect(reference).toContain('packet false 20 ok 14 true');
            expect(reference).toContain('packet true 20 ok 14 false');
            expect(actual).toEqual(reference);
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    },
    30000,
    'gl'
);
