import { expect, test } from 'bun:test';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { gamepackPath } from './reference.js';

test('all 90 language selections and their original source constants match the gamepack in value, identity and write order', () => {
    const source = readFileSync(join(import.meta.dir, '../src/ui/LocalisedText.ts'), 'utf8');
    const fields = Array.from(source.matchAll(/static (?:readonly )?(\w+)(?:: JagString \| null)? = .*?; \/\/ (\w+\.\w+):Lid;/g), ([, name, owner]) => ({ name, owner }));
    const names = new Map(fields.map(row => [row.name, row.owner]));
    expect(names.size).toBe(fields.length);
    const dir = mkdtempSync(join(tmpdir(), 'rs530-language-'));
    try {
        const compile = Bun.spawnSync(['javac', '-cp', gamepackPath, '-d', dir, join(import.meta.dir, 'game', 'LocalisedTextOracle.java')]);
        expect(compile.exitCode, compile.stderr.toString()).toBe(0);
        const bytes = Bun.spawnSync(['java', '-cp', dir + delimiter + gamepackPath, 'LocalisedTextOracle'], {
            stdin: Buffer.from(fields.map(f => f.owner).join('\n')),
            maxBuffer: 4 * 1024 * 1024
        });
        expect(bytes.exitCode, bytes.stderr.toString()).toBe(0);
        const js = Bun.spawnSync(
            [
                process.execPath,
                '-e',
                `
            import Text from './src/ui/LocalisedText.js';
            const keys=JSON.parse(await Bun.stdin.text()), ids=new Map();
            for(const lang of [-1,1,0,2,7,1,2,0]){
                let error=false;
                if(lang!==-1)try{Text.setLanguage(lang);}catch{error=true;}
                console.log(error);
                for(const name of keys){
                    const s=Text[name];
                    if(!ids.has(s))ids.set(s,ids.size);
                    console.log(ids.get(s)+' '+Buffer.from(s.toBytes()).toString('hex'));
                }
            }`
            ],
            { cwd: join(import.meta.dir, '..'), stdin: Buffer.from(JSON.stringify(fields.map(f => f.name))), maxBuffer: 4 * 1024 * 1024 }
        );
        expect(js.exitCode, js.stderr.toString()).toBe(0);
        const expected = bytes.stdout.toString().trimEnd().split(/\r?\n/),
            actual = js.stdout.toString().trimEnd().split(/\r?\n/);
        expect(actual.length).toBe(expected.length);
        for (let i = 0; i < expected.length; i++) expect(actual[i], fields[(i - 1) % (fields.length + 1)]?.owner).toBe(expected[i]);
        for (const [owner, signature, method] of [
            ['d', 'a(byte);', 'setGerman'],
            ['sk', 'e(int);', 'setFrench']
        ]) {
            const javap = Bun.spawnSync(['javap', '-c', '-p', '-classpath', gamepackPath, owner]);
            expect(javap.exitCode, javap.stderr.toString()).toBe(0);
            const body = javap.stdout
                .toString()
                .split('static final void ' + signature)[1]
                .split(/\r?\n {2}\S/)[0];
            const writes = Array.from(body.matchAll(/putstatic\s+#[^\n]*?\/\/ Field ([\w.]+):Lid;/g), ([, s]) => (s.includes('.') ? s : owner + '.' + s));
            const ts = source.split('private static ' + method + '(): void {')[1].split('\n    }')[0];
            const assigned = Array.from(ts.matchAll(/LocalisedText\.(\w+) = LocalisedText\./g), ([, s]) => names.get(s));
            expect(writes).toHaveLength(90);
            expect(assigned).toEqual(writes);
        }
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
});
