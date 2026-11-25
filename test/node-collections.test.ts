import { requireNonNull } from '../src/util/JavaArray.js';
import { gamepackPath } from './reference.js';
import { expect, test } from 'bun:test';
import { fileURLToPath } from 'node:url';
import Linkable from '../src/datastruct/Linkable.js';
import SecondaryNode from '../src/datastruct/SecondaryNode.js';
import SecondaryHashTable from '../src/datastruct/SecondaryHashTable.js';
import IntNode from '../src/datastruct/IntNode.js';
import HashTable from '../src/datastruct/HashTable.js';
import SecondaryLinkedList from '../src/datastruct/SecondaryLinkedList.js';
import LruHashTable from '../src/datastruct/LruHashTable.js';
import SharedPtrList from '../src/datastruct/SharedPtrList.js';

test('intrusive hash buckets, duplicate searches, dual links, LRU and iterator state match nc, tb and vj', () => {
    const nodes = Array.from({ length: 12 }, () => new SecondaryNode());
    const table = new HashTable<SecondaryNode>(5);
    const empty = new HashTable<SecondaryNode>(0);
    const queue = new SecondaryLinkedList();
    const list = new SharedPtrList();
    const cache = new LruHashTable(3);
    const ids = new Map<Linkable, number>(nodes.map((node, i) => [node, i]));
    const id = (node: Linkable | null | undefined) => (node == null ? '-' : String(ids.get(node) ?? 's'));
    const commands: string[] = [],
        results: string[] = [];
    function snapshot(): string {
        let s = '';
        for (const t of [table, cache['table']]) {
            for (const sentinel of t.buckets) {
                s += '[';
                for (let n = sentinel.next; n !== sentinel; n = requireNonNull(n).next) s += id(n) + ',';
                s += ']';
            }
            s += '/' + t['searchKey'] + '/' + id(t['searchCursor']) + '/' + t['bucket'] + '/' + id(t['iterator']) + '|';
        }
        for (const q of [queue, cache['queue']]) {
            const sentinel = q['sentinel'];
            for (let n = sentinel.secondaryNext; n !== sentinel; n = requireNonNull(n).secondaryNext) s += id(n) + ',';
            s += '/' + id(q['cursor']) + '|';
        }
        for (let n = list.sentinel.next; n !== list.sentinel; n = requireNonNull(n).next) s += id(n) + ',';
        return s + '/' + id(list['cursor']) + '|' + cache['remaining'];
    }
    function run(op: string, index = 0, key = 0n): void {
        commands.push([op, index, key].join(' '));
        let result: Linkable | number | string | null | undefined | void;
        const n = nodes[index];
        try {
            switch (op) {
                case 'put':
                    result = table.put(n, key);
                    break;
                case 'badput':
                    try {
                        empty.put(n, key);
                    } catch {
                        result = [n.key, id(n.next), id(n.prev)].join(',');
                    }
                    break;
                case 'find':
                    result = table.get(key);
                    break;
                case 'same':
                    result = table.nextWithKey();
                    break;
                case 'head':
                    result = table.head();
                    break;
                case 'next':
                    result = table.next();
                    break;
                case 'count':
                    result = table.size();
                    break;
                case 'buckets':
                    result = table.getBucketCount();
                    break;
                case 'clear':
                    result = table.clear();
                    break;
                case 'add':
                    result = queue.addTail(n);
                    break;
                case 'pop':
                    result = queue.removeHead();
                    break;
                case 'qhead':
                    result = queue.head();
                    break;
                case 'qnext':
                    result = queue.next();
                    break;
                case 'qcount':
                    result = queue.size();
                    break;
                case 'qclear':
                    result = queue.clear();
                    break;
                case 'ladd':
                    result = list.push_back(n);
                    break;
                case 'lfirst':
                    result = list.push_front(n);
                    break;
                case 'lhead':
                    result = list.head();
                    break;
                case 'ltail':
                    result = list.tail();
                    break;
                case 'lnext':
                    result = list.next();
                    break;
                case 'lprev':
                    result = list.prev();
                    break;
                case 'lpop':
                    result = list.takeFrontAndPop();
                    break;
                case 'lclear':
                    result = list.clear();
                    break;
                case 'cache':
                    result = cache.Put(key, n);
                    break;
                case 'hit':
                    result = cache.Find(key);
                    break;
                case 'chead':
                    result = cache.head();
                    break;
                case 'cnext':
                    result = cache.next();
                    break;
                case 'cclear':
                    result = cache.Reset();
                    break;
                default:
                    throw new Error(op);
            }
        } catch {
            result = 'exception';
        }
        results.push((typeof result === 'number' || typeof result === 'string' ? result : id(result ?? null)) + '|' + snapshot());
    }
    for (const op of ['count', 'buckets', 'head', 'next', 'find', 'same', 'qcount', 'pop', 'qnext', 'chead', 'cnext']) run(op);
    run('badput', 1, 23n);
    run('put', 1, 7n);
    run('badput', 1, (1n << 62n) + 23n);
    // At either side of the JS exact-integer limit, distinct Java longs still enter their own buckets.
    for (const base of [1n << 53n, -(1n << 53n)]) {
        for (let i = 0; i < 7; i++) run('put', i, base + BigInt(i - 3));
        for (let i = 0; i < 7; i++) {
            run('find', 0, base + BigInt(i - 3));
            run('same');
        }
        run('head');
        for (let i = 0; i < 7; i++) run('next');
        run('clear');
    }
    for (const op of ['lhead', 'lnext', 'ltail', 'lprev', 'lpop', 'lclear']) run(op);
    for (let i = 0; i < nodes.length; i++) run(i % 2 === 0 ? 'ladd' : 'lfirst', i);
    run('ltail');
    for (let i = 0; i < 14; i++) run('lprev');
    run('lhead');
    run('ladd', 7);
    run('put', 3, -57n);
    run('lpop');
    for (let i = 0; i < 14; i++) run('lnext');
    run('lclear');
    for (const key of [0n, 4n, -1n, -(1n << 63n), 0n]) {
        for (let i = 0; i < 12; i++) {
            run('put', i, key + BigInt(i % 3));
            run('add', i);
        }
        run('find', 0, key);
        run('qhead');
        run('head');
        for (let i = 0; i < 13; i++) {
            run('same');
            run('next');
            run('qnext');
        }
        for (let i = 0; i < 12; i++) {
            const k = key + BigInt(i % 4);
            run('cache', i, k);
            run('hit', 0, key);
            run('count');
            run('chead');
            run('cnext');
        }
        for (const op of ['qcount', 'pop', 'cclear', 'clear', 'qclear']) run(op);
    }
    const java = Bun.spawnSync(['java', '-Djava.awt.headless=true', '-cp', gamepackPath, fileURLToPath(new URL('./io/NodeCollectionsOracle.java', import.meta.url))], { stdin: Buffer.from(commands.join('\n') + '\n'), timeout: 30000 });
    expect(java.stderr.toString()).toBe('');
    expect(java.exitCode).toBe(0);
    const [intNode, ...lines] = java.stdout.toString().trimEnd().split(/\r?\n/);
    expect([new IntNode().value, new IntNode(-2147483648).value]).toEqual(intNode.split(' ').map(Number));
    for (const size of [-1, 0, 1, 8, 13]) {
        let summary = 'exception';
        try {
            const buckets = new SecondaryHashTable(size)['buckets'];
            const linked = buckets.filter(n => n.secondaryNext === n && n.secondaryPrev === n && n.prev === null && n.next === null);
            summary = [buckets.length, new Set(buckets).size, linked.length].join(' ');
        } catch {
            // A rejected size leaves the oracle's exception marker in the summary.
        }
        expect(summary).toBe(requireNonNull(lines.shift()));
    }
    expect(lines.length).toBe(results.length);
    for (let i = 0; i < results.length; i++) expect(results[i], commands[i]).toBe(lines[i]);
});
