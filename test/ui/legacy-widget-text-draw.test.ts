import { expect } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import Client from '#/client/Client.js';
import type Js5 from '#/cache/Js5.js';
import { fromJsString } from '#/datastruct/JagString.js';
import Pix2D from '#/graphics/Pix2D.js';
import PixfontGeneric from '#/graphics/PixfontGeneric.js';
import IfType from '#/ui/IfType.js';
import InterfaceList from '#/ui/InterfaceList.js';
import InterfaceView from '#/ui/InterfaceView.js';
import Minimenu from '#/ui/Minimenu.js';
import { requireNonNull } from '#/util/JavaArray.js';
import WrappedException from '#/util/WrappedException.js';
import { compareFramebuffers } from '../render/Framebuffer.js';
import { localAssets } from '../cachefile.js';
import { loginFixture } from '../login-fixture.js';
import { readReferenceFrames } from '../reference-frames.js';
import { cachePath, gamepackPath } from '../reference.js';

type Row = [type: number, textId: number, flags: number, align: number, fault: number];
const WIDTH = 256,
    HEIGHT = 96,
    BACKGROUND = 0x274831;

function cases(interfaces: Js5): Row[] {
    const tooltips: number[] = [];
    for (let group = 0; group < interfaces.GetGroupIdLimit(); group++) {
        for (const file of interfaces.GetFileList(group) ?? []) {
            const id = (group << 16) | file;
            const original = IfType.Get(id);
            if (original?.type === 8 && !original.if3) tooltips.push(id);
        }
    }
    expect(tooltips).toHaveLength(201);
    const rows: Row[] = tooltips.map((id, index) => [8, id, 1 | ((index % 4) << 2), 0, 0]);
    for (const flags of [0, 4, 8, 12, 16, 32, 44, 64, 80, 144]) {
        for (const align of [-1, 0, 1, 2, 3]) rows.push([7, -1, flags, align, 0]);
        for (const fault of [1, 2, 3, 4]) rows.push([7, -1, flags, 0, fault]);
    }
    for (const flags of [0, 1, 3, 5, 9, 13, 17, 65, 145]) {
        for (const text of [-1, -2, -3]) rows.push([8, text, flags, 0, 0]);
        for (const fault of [5, 6]) rows.push([8, -1, flags, 0, fault]);
    }
    return rows;
}

function draw([type, id, flags, align, fault]: Row, fontId: number, font: PixfontGeneric) {
    const c = new IfType();
    c.type = type;
    c.if3 = false;
    c.parentId = -1;
    c.id = 463;
    c.width = 93;
    c.height = 20;
    c.x = flags & 4 ? 189 : 11;
    c.y = flags & 8 ? 68 : 21;
    c.baseWidth = c.baseHeight = 2;
    c.itemY = 3;
    c.itemX = -1;
    c.textAlignH = align;
    c.textShadow = !!(flags & 32);
    c.colour = 0xb1f469;
    c.itemCounts = fault === 3 ? Int32Array.of(1) : Int32Array.of(1, 32, -1, 1_000_000);
    c.itemIds = fault === 4 ? null : Int32Array.of(4152, 996, 0, 996);
    c.fontId = fault === 1 ? -1 : fault === 2 ? 99999 : fontId;
    c.textValue = id >= 0 ? requireNonNull(IfType.Get(id)).textValue : fromJsString(id === -1 ? 'Cost %1<br><col=998877>Rune</col><br><br>End' : id === -2 ? '<br>X<br>' : '');
    if (fault === 5) Object.assign(c, { textValue: null });
    c.scripts = [Int32Array.of(20, 23, 0)];
    Client.tooltipComponent = flags & 1 ? c : null;
    InterfaceList.tooltipDelay = 7;
    Client.tooltipTimer = flags & 2 ? 6 : 7;
    Client.p12 = fault === 6 ? null : font;
    InterfaceList.rootCount = 3;
    Client.loopCycle = 811;
    InterfaceList.cycle = flags & 64 ? 812 : 811;
    InterfaceList.dirty.fill(false);
    InterfaceList.rectRedrawnLastFrame.fill(false);
    InterfaceList.rectRedrawnLastFrame[3] = !(flags & 16);
    Client.rectDebug = flags & 128 ? 2 : 0;
    IfType.resourceMissing = true;
    Minimenu.isOpen = true;
    const pixels = new Int32Array(WIDTH * HEIGHT).fill(BACKGROUND);
    Pix2D.setPixels(pixels, WIDTH, HEIGHT);

    Pix2D.setClipping(4, 2, WIDTH - 8, HEIGHT - 3);
    let status = 'ok';
    try {
        new InterfaceView([c]).draw();
    } catch (caught) {
        let error = caught;
        while (error instanceof WrappedException) error = error.cause;
        if (error instanceof TypeError) status = 'NullPointerException';
        else if (error instanceof RangeError) status = 'ArrayIndexOutOfBoundsException';
        else throw error;
    }
    return { state: [status, IfType.resourceMissing, InterfaceList.dirty[3], c.rootIndex, c.drawCycle].join(' '), pixels };
}

loginFixture(
    import.meta.url,
    'IF1 item grids and all 201 cached tooltip texts match the original framebuffer',
    async () => {
        const temp = mkdtempSync(join(tmpdir(), 'rs530-item-grid-tooltip-'));
        try {
            const compile = Bun.spawnSync(['javac', '-cp', gamepackPath, '-d', temp, join(import.meta.dir, 'LegacyWidgetTextOracle.java'), join(import.meta.dir, '../render/ProceduralTextureCacheOracle.java')]);
            expect(compile.exitCode, compile.stderr.toString()).toBe(0);
            const assets = localAssets(cachePath, [3, 8, 13, 19]);
            const rows = cases(assets.archive(3));
            const fontWidget = new IfType();
            fontWidget.fontId = assets.archive(8).GetGroupId(fromJsString('p12_full'));
            const font = requireNonNull(fontWidget.GetFont(PixfontGeneric.nameIcons));
            const framePath = join(temp, 'frames.bin');
            const java = Bun.spawnSync(['java', '-Djava.awt.headless=true', '-cp', temp + delimiter + gamepackPath, 'LegacyWidgetTextOracle', cachePath, framePath], { stdin: Buffer.from(rows.map(row => row.join(' ')).join('\n') + '\n') });
            expect(java.exitCode, java.stderr.toString()).toBe(0);
            const states = java.stdout.toString().trimEnd().split(/\r?\n/);
            expect(states).toHaveLength(rows.length);
            let partialGrids = 0,
                drawnTooltips = 0;
            for (const { index, frame } of readReferenceFrames(framePath, WIDTH, HEIGHT, rows.length)) {
                const row = rows[index];
                const actual = draw(row, fontWidget.fontId, font);
                expect(actual.state, row.join(' ')).toBe(states[index]);
                expect(() => compareFramebuffers(frame, { ...frame, pixels: actual.pixels }), row.join(' ')).not.toThrow();
                const changedPixels = frame.pixels.some(pixel => pixel !== BACKGROUND);
                if (row[0] === 7 && states[index].startsWith('ArrayIndexOutOfBoundsException ') && changedPixels) partialGrids++;
                if (row[1] >= 0 && changedPixels) drawnTooltips++;
            }
            expect(partialGrids).toBeGreaterThan(0);
            expect(drawnTooltips).toBe(201);
        } finally {
            rmSync(temp, { recursive: true, force: true });
        }
    },
    60000
);
