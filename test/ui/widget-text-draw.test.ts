import { expect } from 'bun:test';
import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import Client from '#/client/Client.js';
import ObjType from '#/config/ObjType.js';
import { fromJsString } from '#/datastruct/JagString.js';
import Pix2D from '#/graphics/Pix2D.js';
import Pix8 from '#/graphics/Pix8.js';
import PixfontGeneric from '#/graphics/PixfontGeneric.js';
import IfType from '#/ui/IfType.js';
import InterfaceList from '#/ui/InterfaceList.js';
import InterfaceView from '#/ui/InterfaceView.js';
import LocalisedText from '#/ui/LocalisedText.js';
import Minimenu from '#/ui/Minimenu.js';
import WrappedException from '#/util/WrappedException.js';
import { localAssets } from '../cachefile.js';
import { loginFixture } from '../login-fixture.js';
import { cachePath, gamepackPath } from '../reference.js';

type Row = [flags: number, item: number, count: number, fault: number, layout: number, region: number];

function cases(): Row[] {
    const rows: Row[] = [];
    // Flags cover IF3, active CS1, shadow, empty active text, hover and zero hover colour, continue.
    for (let flags = 0; flags < 128; flags++) {
        for (let layout = 0; layout < 8; layout++) rows.push([flags, -1, 0, 0, layout, (layout + flags) % 5]);
    }
    for (const flags of [0, 1, 3, 19, 65])
        for (const item of [995, 4151, 1002]) {
            for (const count of [-2147483648, -1, 0, 1, 2, 100_000, 10_000_000, 2147483647]) rows.push([flags, item, count, 0, 5, 0]);
        }
    for (let fault = 1; fault <= 9; fault++)
        for (const flags of [0, 1, 2, 3, 66, 67, 127]) {
            for (const region of [0, 1, 2, 3]) rows.push([flags, -1, 1, fault, 0, region]);
        }
    return rows;
}

function draw([flags, item, count, fault, layout, region]: Row, fontId: number): string {
    const c = new IfType();
    Object.assign(c, {
        id: 42,
        parentId: -1,
        type: 4,
        if3: !!(flags & 1),
        x: 27,
        y: 8,
        width: layout === 4 ? 8 : layout === 5 ? 128 : 96,
        height: layout === 4 ? 6 : 50,
        fontId: fault === 1 ? -1 : fault === 2 || fault === 6 ? 100000 : fontId,
        transparency: 220,
        textAlignH: layout % 4,
        textAlignV: (layout >> 1) % 4,
        lineSpacing: (layout % 3) * 5,
        textShadow: !!(flags & 4),
        comparisonOps: Int32Array.of(0),
        comparisonValues: Int32Array.of(flags & 2 ? 75 : 7),
        scripts: [Int32Array.of(20, 75, 0), Int32Array.of(20, -2147483648, 0), Int32Array.of(20, 1000000001, 0)],
        textValue: fromJsString('M\u00ff<img=0> %1 / %2<br><col=ff0000>B</col> %3'),
        activeTextValue: fromJsString(flags & 8 ? '' : 'Act<shad=405060>\u00f6</shad> %1'),
        colour: 0x567adc,
        activeColour: 0x76ec35,
        overColour: flags & 32 ? 0 : 0xbee526,
        activeOverColour: flags & 32 ? 0 : 0xef56dc,
        itemId: item,
        itemCount: count
    });
    if (fault === 3) Object.assign(c, { activeTextValue: null });
    if (fault === 4) Object.assign(c, { textValue: null });
    if (fault === 5) c.comparisonValues = null;
    if (fault === 8) c.comparisonValues = new Int32Array(0);
    InterfaceList.mouseOverComponent = flags & 16 ? c : null;
    InterfaceList.pressedContinue = flags & 64 ? c : null;
    Object.assign(LocalisedText, { PLEASEWAIT: fault === 7 ? null : fromJsString('continue %1<gt>') });
    InterfaceList.cycle = fault === 6 ? 599 : 600;
    Client.loopCycle = 600;
    InterfaceList.rootCount = 2;
    InterfaceList.dirty.fill(false);
    InterfaceList.rectRedrawnLastFrame.fill(false);
    InterfaceList.rectRedrawnLastFrame[2] = region < 3;
    Client.rectDebug = region === 4 ? 2 : 0;
    IfType.resourceMissing = true;
    Client.qaOpTest = false;
    Minimenu.isOpen = true;
    PixfontGeneric.defaultColour = PixfontGeneric.colour = PixfontGeneric.defaultShadowColour = PixfontGeneric.shadowColour = PixfontGeneric.alpha = 79;
    const width = 192,
        height = 78;
    const pixels = new Int32Array(width * (fault === 9 ? 28 : height));
    for (let i = 0; i < pixels.length; i++) pixels[i] = 0x324567 ^ Math.imul(i, 0x670a31);
    Pix2D.setPixels(pixels, width, height);
    Pix2D.setClipping(region === 1 ? 30 : region === 2 ? 78 : 1, region === 1 ? 19 : region === 2 ? 49 : 1, region === 1 ? 75 : region === 2 ? 78 : width - 1, region === 1 ? 51 : region === 2 ? 49 : height - 1);
    let result = 'ok';
    try {
        new InterfaceView([c]).draw();
    } catch (caught) {
        let error = caught;
        while (error instanceof WrappedException) error = error.cause;
        if (error instanceof TypeError) result = 'null';
        else if (error instanceof RangeError) result = 'bounds';
        else throw error;
    }
    return [
        result,
        IfType.resourceMissing,
        InterfaceList.dirty[2],
        PixfontGeneric.defaultColour,
        PixfontGeneric.colour,
        PixfontGeneric.defaultShadowColour,
        PixfontGeneric.shadowColour,
        PixfontGeneric.alpha,
        Pix2D.clipMinX,
        Pix2D.clipMinY,
        Pix2D.clipMaxX,
        Pix2D.clipMaxY,
        createHash('sha256').update(new Uint8Array(pixels.buffer)).digest('hex')
    ].join(' ');
}

loginFixture(
    import.meta.url,
    'type 4 widgets match original glyphs, colours, item labels, continue and CS1 substitutions',
    async () => {
        const dir = mkdtempSync(join(tmpdir(), 'rs530-widget-text-'));
        try {
            const javac = Bun.spawnSync(['javac', '-cp', gamepackPath, '-d', dir, join(import.meta.dir, 'WidgetTextDrawOracle.java'), join(import.meta.dir, '../render/ProceduralTextureCacheOracle.java')]);
            expect(javac.exitCode, javac.stderr.toString()).toBe(0);
            const rows = cases();
            const jvm = Bun.spawnSync(['java', '-Djava.awt.headless=true', '-cp', dir + delimiter + gamepackPath, 'WidgetTextDrawOracle', cachePath], {
                stdin: Buffer.from(rows.map(row => row.join(' ')).join('\n') + '\n'),
                maxBuffer: 8 * 1024 * 1024
            });
            expect(jvm.exitCode, jvm.stderr.toString()).toBe(0);
            const lines = jvm.stdout.toString().trimEnd().split(/\r?\n/);
            expect(lines).toHaveLength(rows.length);
            const assets = localAssets(cachePath, [8, 13, 19]);
            const fontId = assets.archive(8).GetGroupId(fromJsString('b12_full'));
            ObjType.List(1002).name = null;
            PixfontGeneric.nameIcons = [new Pix8(7, 3, 0, 0, 7, 3, Uint8Array.of(1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 1, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1), Int32Array.of(0, 0xc0ff31))];
            for (const [i, row] of rows.entries()) {
                const [flags, , , fault, , region] = row;
                if (flags === 1 && region === 0 && [1, 2, 6].includes(fault)) {
                    // No assigned font, a missing font this cycle, and a missing font on a stale root.
                    expect(lines[i].split(' ').slice(0, 3)).toEqual(['ok', String(fault !== 1), String(fault === 2)]);
                }
                expect(draw(row, fontId), row.join(' ')).toBe(lines[i]);
            }
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    },
    60000
);
