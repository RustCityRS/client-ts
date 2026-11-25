import { expect } from 'bun:test';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import ClientBuild from '#/client/ClientBuild.js';
import ParticleBase from '#/dash3d/ParticleBase.js';
import ParticleSystem from '#/dash3d/ParticleSystem.js';
import SecondaryHashTable from '#/datastruct/SecondaryHashTable.js';
import SharedPtrList from '#/datastruct/SharedPtrList.js';
import PacketT from '#/io/PacketT.js';
import InterfaceStateStatics from '#/ui/InterfaceStateStatics.js';
import { requireNonNull } from '#/util/JavaArray.js';
import { loginFixture } from './login-fixture.js';
import { gamepackPath } from './reference.js';

type System = typeof ParticleSystem;
const vectors = () => [ClientBuild.WSHAPE0, ClientBuild.WSHAPE1, ClientBuild.DECORXOF, ClientBuild.DECORZOF, ClientBuild.DECORXOF2, ClientBuild.DECORZOF2];
const contents = (arrays: Int32Array[]) => '[' + arrays.map(array => '[' + array.join(', ') + ']').join(', ') + ']';

function simulate(system: System, base: typeof ParticleBase, state: typeof InterfaceStateStatics, reset: (p: ParticleSystem) => void) {
    const initial = vectors(),
        data = ['initial ' + contents(initial)];
    initial.forEach((row, i) => (row[1] = 74546 + i));
    data.push('default ' + system.getDetailLevel());
    const b = new base(),
        s = new state();
    const first = new system(),
        second = new system();
    expect(first instanceof base).toBe(true);
    expect(s instanceof base).toBe(false);
    expect([b, s, first, second].map(object => Object.keys(object))).toEqual([[], [], [], []]);
    for (const level of [-2147483648, -1, 0, 1, 2, 3, 17001, 2147483647]) {
        system.setDetailLevel(level);
        reset(first);
        reset(second);
        data.push('reset ' + system.getDetailLevel() + ' ' + (first !== second));
    }
    const after = vectors();
    data.push('arrays ' + initial.every((row, i) => row === after[i]) + ' ' + (new Set(after).size === 6) + ' ' + contents(after));
    return data;
}

// Native JDI observes fully initialized receivers on constructor exit. Forward
// construction including newTarget, so the enclosing super() still sees ue.
function onConstruct<C extends new (...args: never[]) => object>(ctor: C, observe: (value: InstanceType<C>) => void): C {
    return new Proxy(ctor, {
        construct(target, args, newTarget) {
            const value = Reflect.construct(target, args, newTarget) as InstanceType<C>;
            observe(value);
            return value;
        }
    });
}

loginFixture(
    import.meta.url,
    'particle constructors and six mutable loc vectors match the untouched 530 gamepack',
    async () => {
        const dir = mkdtempSync(join(tmpdir(), 'rs530-particle-')),
            key = Symbol.for('rs530.test.particle.lifecycle');
        const initial = vectors().map(array => array.slice());
        try {
            const compiler = Bun.spawnSync(['javac', '--add-modules', 'jdk.jdi', '-cp', gamepackPath, '-d', dir, join(import.meta.dir, 'game/ParticleLifecycleOracle.java')]);
            expect(compiler.exitCode, compiler.stderr.toString()).toBe(0);
            const java = Bun.spawnSync(['java', '--add-modules', 'jdk.jdi', '-cp', dir + delimiter + gamepackPath, 'ParticleLifecycleOracle', 'observe'], { timeout: 30000 });
            expect(java.exitCode, java.stderr.toString()).toBe(0);
            const lines = java.stdout.toString().trimEnd().split(/\r?\n/);
            expect(simulate(ParticleSystem, ParticleBase, InterfaceStateStatics, p => p.reset())).toEqual(lines.slice(0, -1));
            vectors().forEach((row, i) => row.set(initial[i]));

            const trace: string[] = [],
                ids = new Map<object, number>();
            const id = (o: object) => {
                const existing = ids.get(o);
                if (existing !== undefined) return existing;
                const next = ids.size + 1;
                ids.set(o, next);
                return next;
            };
            const taps: { ctors: Record<string, object>; owner: System | null } = { ctors: {}, owner: null };
            Reflect.set(globalThis, key, taps);
            taps.ctors.SecondaryHashTable = onConstruct(SecondaryHashTable, table => {
                const buckets = table['buckets'];
                trace.push(['q', requireNonNull(taps.owner).getDetailLevel(), buckets.length, new Set(buckets).size, buckets.every(node => node.secondaryNext === node && node.secondaryPrev === node)].join(' '));
            });
            taps.ctors.PacketT = onConstruct(PacketT, p => {
                const bytes = requireNonNull(p.m_data);
                trace.push(['gd', requireNonNull(taps.owner).getDetailLevel(), p.m_pos, bytes.length, bytes.every(value => value === 0)].join(' '));
            });
            taps.ctors.SharedPtrList = onConstruct(SharedPtrList, list => trace.push('gk ' + id(list) + ' ' + (list.sentinel.next === list.sentinel && list.sentinel.prev === list.sentinel && list['cursor'] === null)));
            const base = onConstruct(ParticleBase, p => trace.push('ii ' + id(p) + ' ' + (p instanceof requireNonNull(taps.owner) ? 'ue' : 'ii')));
            taps.ctors.ParticleBase = base;

            // Only imports get constructor probes. The single static-block entry
            // watchpoint exposes its receiver before its public ES module binding exists.
            function observedCopy(name: string, source: string): string {
                let code = readFileSync(new URL('../src/' + source, import.meta.url), 'utf8');
                const access = 'globalThis[Symbol.for("rs530.test.particle.lifecycle")]';
                code = code.replace(/^import (\w+) from '[^']+';/gm, (_, local: string) => {
                    if (!(local in taps.ctors)) throw new Error('Unhandled particle constructor dependency ' + local);
                    return 'const ' + local + ' = ' + access + '.ctors.' + local + ';';
                });
                if (name === 'ue') code = code.replace(/\bstatic\s*\{/, 'static { ' + access + '.owner = this;');
                const path = join(dir, name + '.ts');
                writeFileSync(path, code);
                return pathToFileURL(path).href;
            }
            const nativeState: typeof InterfaceStateStatics = (await import(observedCopy('n', 'ui/InterfaceStateStatics.ts'))).default;
            const state = onConstruct(nativeState, p => trace.push('n ' + id(p) + ' n'));
            taps.ctors.InterfaceStateStatics = state;
            const nativeSystem: System = (await import(observedCopy('ue', 'dash3d/ParticleSystem.ts'))).default;
            const system = onConstruct(nativeSystem, p => trace.push('ue ' + id(p) + ' ue'));
            expect(
                simulate(system, base, state, p => {
                    p.reset();
                    trace.push('ue.b ' + id(p) + ' ue');
                })
            ).toEqual(lines.slice(0, -1));
            expect('trace ' + trace.join(';')).toBe(requireNonNull(lines.at(-1)));
        } finally {
            Reflect.deleteProperty(globalThis, key);
            rmSync(dir, { recursive: true, force: true });
        }
    },
    45000
);
