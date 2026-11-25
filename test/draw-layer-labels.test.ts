import { expect } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import Client from '#/client/Client.js';
import JagString, { fromLiteral } from '#/datastruct/JagString.js';
import SoftwareFont from '#/graphics/SoftwareFont.js';
import TitleScreen from '#/title/TitleScreen.js';
import LocalisedText from '#/ui/LocalisedText.js';
import Minimenu from '#/ui/Minimenu.js';
import WorldMap from '#/ui/WorldMap.js';
import { requireNonNull } from '#/util/JavaArray.js';
import { loginFixture } from './login-fixture.js';
import { gamepackPath } from './reference.js';

loginFixture(import.meta.url, 'DrawLayer and map labels retain JAR bytes, interned identities and map label scratch through a reset', async () => {
    const dir = mkdtempSync(join(tmpdir(), '530-draw-labels-'));
    try {
        const compile = Bun.spawnSync(['javac', '-cp', gamepackPath, '-d', dir, join(import.meta.dir, 'game/DrawLayerLabelsOracle.java')]);
        expect(compile.exitCode, compile.stderr.toString()).toBe(0);
        const references = new Map<JagString, number>(),
            initial = WorldMap.labelLines;
        function describe(value: JagString | null): string {
            if (value === null) return '-';
            if (!references.has(value)) references.set(value, references.size);
            return references.get(value) + ':' + Buffer.from(value.toBytes()).toString('hex');
        }
        const rows: string[] = [];
        function snapshot(status: string) {
            rows.push(
                [
                    status,
                    WorldMap.viewTop,
                    WorldMap.viewMinX,
                    WorldMap.labelLines === initial,
                    ...[
                        Client.fpsLabel,
                        Client.memLabel,
                        Client.debugCacheLabel,
                        Client.percentOpenParen,
                        Client.colEndTimes,
                        WorldMap.fpsLabel,
                        WorldMap.memLabel,
                        WorldMap.memSuffix,
                        Client.kilobytes,
                        LocalisedText.loadingPercentEnd,
                        Minimenu.orange,
                        TitleScreen['loadingTextDefault'],
                        TitleScreen.m_loadString,
                        ...WorldMap.labelLines
                    ].map(describe)
                ].join('|')
            );
        }
        snapshot('init');
        for (const lang of [1, 0, 2, 1, 2, 0]) {
            LocalisedText.setLanguage(lang);
            snapshot('lang' + lang);
        }
        const font = new SoftwareFont(new Uint8Array(257));
        WorldMap.viewTop = -791;
        WorldMap.viewMinX = 1028;
        TitleScreen.m_loadString = fromLiteral('loading');
        for (const text of ['North<br>Bank', 'A<br>B<br>C<br>D<br>E', 'One', '1<br>2<br>3<br>4<br>5<br>6', '']) {
            let result: string;
            try {
                result = 'count' + font.splitParagraph(fromLiteral(text), null, WorldMap.labelLines);
            } catch (error) {
                if (!(error instanceof RangeError)) throw error;
                result = 'bounds';
            }
            snapshot(result);
            WorldMap.Reset(false);
            snapshot('reset');
        }
        const literals: [string, JagString, string][] = [
            ['we.t', WorldMap.memSuffix, 'k'],
            ['we.x', LocalisedText.germanClose, 'Schlie-8en'],
            ['jf.c', LocalisedText.englishLoadedTextures, 'Loaded textures'],
            ['jf.f', Client.shiftClickDisabled, 'Shift)2click disabled)3'],
            ['jf.h', LocalisedText.englishLoadedConfig, 'Loaded config'],
            ['jf.d', requireNonNull(LocalisedText.englishStarted3dLibrary), 'Started 3d Library'],
            ['nc.k', LocalisedText.englishDiscard, 'Discard'],
            ['nc.a', LocalisedText.englishLoadingConfig, 'Loading config )2 '],
            ['nc.r', Client.percent4, '(U4'],
            ['gk.f', Minimenu.lime, '<col=40ff00>'],
            ['gk.a', Client.playerCacheCommand, '::pcachesize'],
            ['gk.l', LocalisedText.germanUnableToFind, 'Spieler kann nicht gefunden werden: '],
            ['mf.o', Client.kilobytes, 'k']
        ];
        for (const [field, held, text] of literals) {
            const lookup = fromLiteral(text);
            rows.push([field, describe(held), describe(lookup), fromLiteral(text) === lookup, held['mutable'], lookup['mutable']].join('|'));
        }
        for (const firstClass of ['client', 'sa']) {
            const jar = Bun.spawnSync(['java', '-Djava.awt.headless=true', '-DfirstClass=' + firstClass, '-cp', dir + delimiter + gamepackPath, 'DrawLayerLabelsOracle']);
            expect(jar.exitCode, jar.stderr.toString()).toBe(0);
            expect(rows).toEqual(jar.stdout.toString().trimEnd().split(/\r?\n/));
        }
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
});
