import { setLocalWorld, saveWorldConnection } from './world-connection.js';
import { expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join, resolve } from 'node:path';
import Client from '#/client/Client.js';
import GameShell from '#/client/GameShell.js';
import { fromJsString } from '#/datastruct/JagString.js';
import { readPacketBody } from './packet-body-fixture.js';
import declarations from '#/io/GamepackMembers.js';
import PacketT from '#/io/PacketT.js';
import SuperPacket from '#/io/SuperPacket.js';
import ReflectionCheck from '#/io/ReflectionCheck.js';
import LocalisedText from '#/ui/LocalisedText.js';
import { clientErrorHost } from '#/util/ClientError.js';
import { requireNonNull } from '#/util/JavaArray.js';
import Signlink from '#/util/Signlink.js';
import { gamepackPath } from './reference.js';

type Read = { op: number; owner: string; name: string; params?: string[]; value?: number; args?: Uint8Array[] };
function wire(id: number, reads: Read[]): Uint8Array {
    const p = new PacketT(5000);
    p.p1(reads.length);
    p.p4(id);
    for (const r of reads) {
        p.p1(r.op);
        p.pStringNoConversion(fromJsString(r.owner), 0);
        p.pStringNoConversion(fromJsString(r.name), 0);
        if (r.op === 1) p.p4(r.value ?? 0);
        if (r.op === 3 || r.op === 4) {
            const params = r.params ?? [];
            p.p1(params.length);
            for (const type of params) p.pStringNoConversion(fromJsString(type), 0);
            if (r.op === 3)
                for (const data of r.args ?? []) {
                    p.p4(data.length);
                    p.pArrayBuffer(data, data.length, 0);
                }
        }
    }
    return requireNonNull(p.m_data).slice(0, p.m_pos);
}
function parameters(entry: string): string[] {
    const descriptor = entry.slice(entry.indexOf('(') + 1, entry.indexOf(')'));
    return (descriptor.match(/\[*(?:L[^;]+;|[ZBCSIJFD])/g) ?? []).map(t => (t.startsWith('L') ? t.slice(1, -1).replaceAll('/', '.') : t.replaceAll('/', '.')));
}

test('reflection resolves the official field, queues missing-method lookup and preserves framing', async () => {
    const savedQueue = ReflectionCheck.queue,
        link = new Signlink(null),
        state = Client.gameState;
    try {
        ReflectionCheck.resetQueue();
        const p = new PacketT(200);
        const str = (s: string) => p.pStringNoConversion(fromJsString(s), 0);
        p.p1(4);
        p.p4(40);
        p.p1(1);
        str('tf');
        str('C');
        p.p4(-1);
        p.p1(3);
        str('q');
        str('unknown');
        p.p1(1);
        str('I');
        p.p4(3);
        p.p1(1);
        p.p1(2);
        p.p1(3);
        p.p1(0);
        str('ab');
        str('Q');
        p.p1(2);
        str('tf');
        str('C');
        const end = p.m_pos;
        p.m_pos = 0;
        ReflectionCheck.decode(link, p);
        await new Promise(r => setTimeout(r, 0));
        const out = new SuperPacket(100);
        out.SetEnc(new Int32Array(4));
        ReflectionCheck.processChecks(163, out);
        expect(Client.gameState).toBe(-1);
        expect(p.m_pos).toBe(end);
        out.m_pos = 6;
        expect([out.g1s(), out.g1s(), out.g1s(), out.g1s(), out.g4()]).toEqual([0, -6, -17, 0, 8]);
    } finally {
        Client.gameState = state;
        ReflectionCheck.queue = savedQueue;
        await link.stopWorker();
    }
});

const viewport = ['viewportWidth', 'viewportHeight', 'viewportFovLow', 'zoomWidth2', 'viewportZoomMin', 'zoomWidth', 'fovClampMinWidth', 'viewportMaxZoom', 'zoomWidthMin', 'fovClampMaxHeight'] as const;

test('Majula reflection requests match all declaration modifiers, live integer updates, ISAAC and CRC', async () => {
    const refs: Read[] = [];
    for (const [owner, fields, methods] of declarations) {
        for (const entry of fields.split(' ')) if (entry) refs.push({ op: 2, owner, name: entry.split(':')[0] });
        for (const entry of methods.split(' ')) if (entry) refs.push({ op: 4, owner, name: entry.split('(')[0], params: parameters(entry) });
    }
    const live = [
        'tf.C',
        'hh.kb',
        'wk.l',
        'ah.f',
        'hk.e',
        'vj.t',
        'qj.C',
        'ce.F',
        'd.c',
        'mf.j',
        'mi.y',
        'hl.w',
        'fb.f',
        'dd.a',
        'mg.T',
        'hi.f',
        'fl.l',
        'vk.rb',
        'oh.j',
        'rk.i',
        'sb.g',
        'ja.Z',
        'lg.G',
        'ib.db',
        'gi.m',
        'ae.j',
        'ri.V',
        'od.N',
        'ae.b'
    ];
    const extra: Read[] = [];
    for (const member of [...live, 'a.b', 'qj.y', 'gk.c', 'q.h', 'ok.s', 'eh.a', 'x.noField', 'badClass.n']) {
        const [owner, name] = member.split('.');
        extra.push({ op: 0, owner, name });
    }
    extra.push({ op: 4, owner: 'client', name: 'init', params: ['unavailable'] }, { op: 4, owner: 'qj', name: 'noMethod', params: ['I'] });
    const packets: Uint8Array[] = [];
    for (let i = 0; i < refs.length; i += 31) packets.push(wire(i ^ 0xfdefb4e3, refs.slice(i, i + 31)));
    for (let i = 0; i < 24; i++) packets.push(wire(i ^ 0xacef732b, extra));
    const writes: Read[] = [];
    for (const [i, field] of live.entries()) {
        const [owner, name] = field.split('.');
        writes.push({ op: 1, owner, name, value: 123456 + i }, { op: 0, owner, name });
    }
    for (const field of ['missingOwner.missing', 'qj.noField', 'qj.E', 'cb.V', 'a.b']) {
        const [owner, name] = field.split('.');
        writes.push({ op: 1, owner, name, value: 333 });
    }
    packets.push(wire(928, writes));
    packets.push(wire(0, []));
    const dir = mkdtempSync(join(tmpdir(), 'read-checks-530-'));
    const saved = {
        queue: ReflectionCheck.queue,
        link: GameShell.signlink,
        cycle: Client.loopCycle,
        state: Client.gameState,
        timer: Client.rebootTimer,
        plane: Client.playerLevel,
        x: Client.mapBuildBaseX,
        z: Client.mapBuildBaseZ,
        world: saveWorldConnection(),
        localPid: Client.localPid,
        revision: clientErrorHost.revision,
        language: LocalisedText.language,
        platform: Signlink.platform,
        fps: GameShell.m_fps,
        logic: GameShell.m_updateCount,
        canvasW: GameShell.m_sWid,
        canvasH: GameShell.m_sHei,
        frameW: GameShell.m_frameWidth,
        frameH: GameShell.m_frameHeight,
        viewport: viewport.map(k => Client[k])
    };
    const link = (GameShell.signlink = new Signlink(null)),
        out = new SuperPacket(5000);
    try {
        const built = Bun.spawnSync(['javac', '-cp', gamepackPath, '-d', dir, resolve(import.meta.dir, 'io/ReflectionCheckOracle.java')]);
        expect(built.stderr.toString()).toBe('');
        expect(built.exitCode).toBe(0);
        const jvm = Bun.spawnSync(['java', '-Djava.awt.headless=true', '-cp', dir + delimiter + gamepackPath, 'ReflectionCheckOracle'], { stdin: Buffer.from(packets.map(p => Buffer.from(p).toString('hex')).join('\n') + '\n'), timeout: 30000 });
        expect(jvm.stderr.toString()).toBe('');
        expect(jvm.exitCode).toBe(0);
        const lines = jvm.stdout.toString().trimEnd().split(/\r?\n/);
        expect(lines.length).toBe(packets.length);
        ReflectionCheck.resetQueue();
        out.SetEnc(Int32Array.of(2, 3, 5, 11));
        setLocalWorld(6);
        Client.modeWhere = 2;
        Client.affiliateId = 341;
        Client.mapBuildBaseX = 3151;
        Client.mapBuildBaseZ = 3214;
        Client.localPid = -1;
        clientErrorHost.revision = 530;
        LocalisedText.language = 2;
        Signlink.platform = 3;
        GameShell.m_fps = 50;
        GameShell.m_updateCount = 2;
        GameShell.m_sWid = 1003;
        GameShell.m_sHei = 807;
        GameShell.m_frameWidth = 1060;
        GameShell.m_frameHeight = 853;
        const values = [654, 408, 439, 387, 498, 430, 15, 32767, 7, 2629];
        viewport.forEach((k, i) => (Client[k] = values[i]));
        for (const [i, bytes] of packets.entries()) {
            const state = Math.imul(i, 19481557);
            Client.gameState = state;
            Client.loopCycle = ~state;
            Client.rebootTimer = state >> 8;
            Client.playerLevel = i & 3;
            out.m_pos = 0;
            const p = await readPacketBody(114, bytes);
            const item = requireNonNull(ReflectionCheck.queue.head()),
                fields = requireNonNull(item.fieldRequests),
                methods = requireNonNull(item.methodRequests);
            if (fields.some(v => v?.status === 0) || methods.some(v => v?.status === 0)) {
                ReflectionCheck.processChecks(163, out);
                expect(out.m_pos).toBe(0);
            }
            await new Promise(r => setTimeout(r, 0));
            ReflectionCheck.processChecks(163, out);
            expect([p.m_pos, ReflectionCheck.queue.head() === null, Buffer.from(requireNonNull(out.m_data).subarray(0, out.m_pos)).toString('hex')].join(' '), 'packet ' + i + ' ' + Buffer.from(bytes).toString('hex').slice(0, 110)).toBe(lines[i]);
        }
    } finally {
        await link.stopWorker();
        rmSync(dir, { recursive: true, force: true });
        ReflectionCheck.queue = saved.queue;
        GameShell.signlink = saved.link;
        Client.loopCycle = saved.cycle;
        Client.gameState = saved.state;
        Client.rebootTimer = saved.timer;
        Client.playerLevel = saved.plane;
        Client.mapBuildBaseX = saved.x;
        Client.mapBuildBaseZ = saved.z;
        Object.assign(Client, saved.world);
        Client.localPid = saved.localPid;
        clientErrorHost.revision = saved.revision;
        LocalisedText.language = saved.language;
        Signlink.platform = saved.platform;
        GameShell.m_fps = saved.fps;
        GameShell.m_updateCount = saved.logic;
        GameShell.m_sWid = saved.canvasW;
        GameShell.m_sHei = saved.canvasH;
        GameShell.m_frameWidth = saved.frameW;
        GameShell.m_frameHeight = saved.frameH;
        viewport.forEach((k, i) => {
            Client[k] = saved.viewport[i];
        });
    }
}, 45000);

test('lj resolves operations in order and preserves opaque argument bytes, request types, cursors and lookup failures', async () => {
    const vectors: { link: boolean; bytes: Uint8Array }[] = [];
    const samples: Read[] = [
        { op: 3, owner: 'a', name: 'a', params: ['I'], args: [Uint8Array.of(1, 128, 255)] },
        { op: 3, owner: 'a', name: 'missing', params: [], args: [] },
        { op: 4, owner: 'a', name: 'a', params: ['B'] },
        { op: 1, owner: 'dd', name: 'a', value: 317 },
        { op: 1, owner: 'unknown.OfficialClass', name: 'a', value: -316 },
        { op: 3, owner: 'unknown.OfficialClass', name: 'a', params: ['I', 'B'], args: [new Uint8Array(0), Uint8Array.of(1)] },
        { op: 3, owner: 'a', name: 'a', params: ['unknown.OfficialClass'], args: [Uint8Array.of(4)] },
        { op: 2, owner: 'dd', name: 'missing' },
        { op: 4, owner: 'qj', name: 'missing', params: ['[[I', 'java.lang.Object'] }
    ];
    const all = wire(-1259, samples);
    for (const link of [true, false]) {
        vectors.push({ link, bytes: all });
        for (let n = 5; n < all.length; n += 3) vectors.push({ link, bytes: all.slice(0, n) });
        for (const size of [-1, 0, 1, 2, 3, 9]) {
            const p = new PacketT(80);
            p.p1(2);
            p.p4(53);
            p.p1(3);
            for (const value of ['a', 'a']) p.pStringNoConversion(fromJsString(value), 0);
            p.p1(1);
            p.pStringNoConversion(fromJsString('I'), 0);
            p.p4(size);
            p.p1(2);
            for (const value of ['dd', 'a']) p.pStringNoConversion(fromJsString(value), 0);
            vectors.push({ link, bytes: requireNonNull(p.m_data).slice(0, p.m_pos) });
        }
    }
    const dir = mkdtempSync(resolve(import.meta.dir, '../out/check-decode-'));
    const before = ReflectionCheck.queue,
        memory = GameShell.maxMemory,
        host = new Signlink(null);
    const numbers = (a: Int32Array | null) => '[' + Array.from(requireNonNull(a)).join(', ') + ']';
    try {
        const asm = '--add-exports=java.base/jdk.internal.org.objectweb.asm=ALL-UNNAMED';
        const built = Bun.spawnSync(['javac', asm, '-cp', gamepackPath, '-d', dir, resolve(import.meta.dir, 'io/ReflectionCheckOracle.java'), resolve(import.meta.dir, 'io/ReflectionAllocationOracle.java')]);
        expect(built.stderr.toString()).toBe('');
        expect(built.exitCode).toBe(0);
        const input = vectors.map(v => (v.link ? 'link ' : 'null ') + Buffer.from(v.bytes).toString('hex')).join('\n') + '\n';
        const java = Bun.spawnSync(['java', '-Djava.awt.headless=true', '-cp', dir + delimiter + gamepackPath, 'ReflectionCheckOracle', 'decode'], { stdin: Buffer.from(input) });
        expect(java.stderr.toString()).toBe('');
        expect(java.exitCode).toBe(0);
        const lines = java.stdout.toString().trimEnd().split(/\r?\n/);
        expect(lines).toHaveLength(vectors.length);
        for (const [i, { link, bytes }] of vectors.entries()) {
            ReflectionCheck.resetQueue();
            const packet = new PacketT(bytes);
            ReflectionCheck.decode(link ? host : null, packet);
            const check = requireNonNull(ReflectionCheck.queue.head());
            await new Promise(resolve => setTimeout(resolve, 0));
            const requests = (list: typeof check.methodRequests) =>
                requireNonNull(list)
                    .map(r => (r === null ? '~' : r.type + '/' + r.status))
                    .join(',');
            const args = requireNonNull(check.arguments)
                .map(row => (row === null ? '~' : '[' + row.map(data => (data === null ? '~' : Buffer.from(data).toString('hex'))).join(',') + ']'))
                .join('/');
            expect([packet.m_pos, check.id, numbers(check.operations), numbers(check.intOperands), numbers(check.errors), requests(check.fieldRequests), requests(check.methodRequests), args].join('|'), 'vector ' + i).toBe(lines[i]);
        }
        // The allocator refuses a three-byte array on both sides. The next entry
        // starts directly after its length, making an extra byte read observable.
        const p = new PacketT(80);
        p.p1(2);
        p.p4(59);
        p.p1(3);
        p.pStringNoConversion(fromJsString('a'), 0);
        p.pStringNoConversion(fromJsString('a'), 0);
        p.p1(1);
        p.pStringNoConversion(fromJsString('I'), 0);
        p.p4(3);
        p.p1(2);
        p.pStringNoConversion(fromJsString('dd'), 0);
        p.pStringNoConversion(fromJsString('a'), 0);
        const bytes = requireNonNull(p.m_data).slice(0, p.m_pos);
        const failed = Bun.spawnSync(['java', asm, '-Djava.awt.headless=true', '-cp', dir + delimiter + gamepackPath, 'ReflectionAllocationOracle'], { stdin: Buffer.from(Buffer.from(bytes).toString('hex') + '\n') });
        expect(failed.stderr.toString()).toBe('');
        expect(failed.exitCode).toBe(0);
        GameShell.maxMemory = 0;
        ReflectionCheck.resetQueue();
        const packet = new PacketT(bytes);
        ReflectionCheck.decode(null, packet);
        const check = requireNonNull(ReflectionCheck.queue.head());
        expect([packet.m_pos, numbers(check.operations), numbers(check.errors)].join('|')).toBe(failed.stdout.toString().trim());
    } finally {
        GameShell.maxMemory = memory;
        await host.stopWorker();
        ReflectionCheck.queue = before;
        rmSync(dir, { recursive: true, force: true });
    }
}, 20000);
