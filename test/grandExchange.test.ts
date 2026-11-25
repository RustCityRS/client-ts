import DelayedStateChange from '#/ui/DelayedStateChange.js';
import Client from '#/client/Client.js';
import StockPlayerOffer from '#/client/StockPlayerOffer.js';
import ScriptRunner from '#/script/ScriptRunner.js';
import LruHashTable from '#/datastruct/LruHashTable.js';
import { test, expect } from 'bun:test';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { resolve, join, delimiter } from 'node:path';
import { fileURLToPath } from 'node:url';
import { localAssets } from './cachefile.js';
import { cachePath, gamepackPath } from './reference.js';
import { readPacketBody } from './packet-body-fixture.js';
import PacketT from '#/io/PacketT.js';
import { ClientScript } from '#/script/ClientScript.js';
import HookReq from '#/script/HookReq.js';
import InterfaceView from '#/ui/InterfaceView.js';
import InterfaceSession from '#/ui/InterfaceSession.js';
import { requireNonNull } from '#/util/JavaArray.js';

test('all GE flag bytes, signed fields, reset offers and ten CS2 operations match rg and gh', async () => {
    const payloads: Uint8Array[] = [];
    for (let flags = 0; flags < 256; flags++) {
        const p = new PacketT(20);
        p.p1(flags % 6);
        p.p1(flags);
        p.p2(flags * 851);
        p.p4(Math.imul(flags, 0x742f0331));
        p.p4(Math.imul(flags, -0x18973129));
        p.p4(Math.imul(flags, -0x6830000));
        p.p4(Math.imul(flags, 0x53489afe));
        payloads.push(requireNonNull(p.m_data).slice(0, p.m_pos));
    }
    payloads.push(Uint8Array.of(2, 0));
    const out = resolve(import.meta.dir, '../out');
    mkdirSync(out, { recursive: true });
    const tmp = mkdtempSync(join(out, 'ge-'));
    let lines: string[];
    try {
        const compiled = Bun.spawnSync(['javac', '-cp', gamepackPath, '-d', tmp, fileURLToPath(new URL('./ui/GrandExchangeOracle.java', import.meta.url))]);
        if (compiled.exitCode !== 0) throw Error(compiled.stderr.toString());
        const stdin = Buffer.from(payloads.map(p => Buffer.from(p).toString('hex')).join('\n') + '\n');
        const result = Bun.spawnSync(['java', '-Djava.awt.headless=true', '-cp', tmp + delimiter + gamepackPath, 'GrandExchangeOracle'], { stdin });
        if (result.exitCode !== 0) throw Error(result.stderr.toString());
        lines = result.stdout.toString().trim().split(/\r?\n/);
    } finally {
        rmSync(tmp, { recursive: true, force: true });
    }
    const assets = localAssets(cachePath, [3, 12]);
    new InterfaceSession(new InterfaceView([]), assets);
    const ops: number[] = [],
        params: number[] = [];
    for (const [i, op] of [3903, 3904, 3905, 3906, 3907, 3908, 3910, 3911, 3912, 3913].entries()) {
        ops.push(33, op, 43);
        params.push(0, 0, i);
    }
    ops.push(21);
    params.push(0);
    const oldScriptCache = ClientScript.m_cache;
    ClientScript.m_cache = new LruHashTable<ClientScript>(128);
    const script = new ClientScript();
    script.opcodes = Int32Array.from(ops);
    script.intOperands = Int32Array.from(params);
    script.intLocals = 1;
    script.stringOperands = new Array(ops.length).fill(null);
    ClientScript.m_cache.Put(8401n, script);
    const savedOffers = Client.grandExchangeOffers,
        savedStockCycle = Client.stockTransmitCycle,
        savedCycle = Client.transmitCycle;
    const savedInts = ScriptRunner.intStack.slice();
    Client.grandExchangeOffers = Array.from({ length: 6 }, () => new StockPlayerOffer());
    Client.transmitCycle = 1;
    const errors: Error[] = [];
    const runner = new ScriptRunner(ClientScript.Get, error => errors.push(error));
    try {
        for (const [i, bytes] of payloads.entries()) {
            const slot = bytes[0],
                old = requireNonNull(Client.grandExchangeOffers)[slot];
            Client.transmitCycle += 12345;
            const p = await readPacketBody(116, bytes);
            const c = requireNonNull(requireNonNull(Client.grandExchangeOffers)[slot]);
            const e = new HookReq();
            e.args = [8401, slot];
            runner.ExecuteScript(e, 200000);
            const result = [c !== old, p.m_pos, Client.stockTransmitCycle, c.GetOfferStatus(), c.GetOfferType(), '[' + Array.from(DelayedStateChange.varcs.subarray(0, 10)).join(', ') + ']'].join(' ');
            expect(result).toBe(lines[i]);
        }
        expect(errors).toHaveLength(0);
        const offers = (Client.grandExchangeOffers = Array<StockPlayerOffer | null>(6).fill(null));
        offers[1] = new StockPlayerOffer();
        let row = payloads.length;
        for (let opcode = 3903; opcode <= 3913; opcode++)
            for (const slot of [-1, 0, 1, 6]) {
                const id = 8410 + opcode * 8 + slot,
                    edge = new ClientScript();
                edge.opcodes = Int32Array.of(0, opcode, 0, 21);
                edge.intOperands = Int32Array.of(slot, 0, 91055, 0);
                edge.stringOperands = Array(4).fill(null);
                ClientScript.m_cache.Put(BigInt(id), edge);
                const event = new HookReq();
                event.args = [id];
                ScriptRunner.intStack.fill(-11017);
                errors.length = 0;
                runner.ExecuteScript(event, 200000);
                expect('[' + Array.from(ScriptRunner.intStack.subarray(0, 3)).join(', ') + ']').toBe(lines[row++]);
                expect(errors.length).toBe(slot === 1 && opcode !== 3909 ? 0 : 1);
            }
        expect(row).toBe(lines.length);
    } finally {
        ClientScript.m_cache = oldScriptCache;
        Client.transmitCycle = savedCycle;
        Client.stockTransmitCycle = savedStockCycle;
        Client.grandExchangeOffers = savedOffers;
        ScriptRunner.intStack.set(savedInts);
    }
}, 20000);
