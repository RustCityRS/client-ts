import { expect } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import Js5 from '#/cache/Js5.js';
import Js5Index from '#/cache/Js5Index.js';
import Js5ResourceProvider from '#/cache/Js5ResourceProvider.js';
import Client from '#/client/Client.js';
import ClientMouseListener from '#/client/ClientMouseListener.js';
import { fromJsString } from '#/datastruct/JagString.js';
import Pix2D from '#/graphics/Pix2D.js';
import Pix32 from '#/graphics/Pix32.js';
import SoftwareAlphaSprite from '#/graphics/SoftwareAlphaSprite.js';
import SoftwareFont from '#/graphics/SoftwareFont.js';
import Crc32 from '#/io/Crc32.js';
import InterfaceList from '#/ui/InterfaceList.js';
import LocalisedText from '#/ui/LocalisedText.js';
import Minimenu from '#/ui/Minimenu.js';
import { loginFixture } from '../login-fixture.js';
import { gamepackPath } from '../reference.js';

const short = (n: number) => [n >>> 8, n & 255];
function container(bytes: number[]): Uint8Array {
    const n = bytes.length;
    return Uint8Array.from([0, n >>> 24, n >>> 16, n >>> 8, n, ...bytes]);
}
function sprite(id: number): Uint8Array {
    const w = 3 + id,
        h = 6 - id,
        count = w * h,
        colour = 0x124fa3 + id * 0x173627;
    const pixels = Array.from({ length: count }, (_, i) => (i + id) % 3);
    const alpha = id % 2 === 0 ? [] : Array.from({ length: count }, (_, i) => 17 + ((i * 31) % 239));
    return container([alpha.length ? 2 : 0, ...pixels, ...alpha, colour >>> 16, colour >>> 8, colour, 0x81, 0x2f, 0xb2, ...short(w + 2), ...short(h + 2), 2, ...short(1), ...short(1), ...short(w), ...short(h), ...short(1)]);
}

const packedIndex = container([5, 0, 0, 5, ...[0, 1, 1, 1, 1].flatMap(short), ...Array(40).fill(0), ...[1, 1, 1, 1, 1].flatMap(short), ...Array(10).fill(0)]);
const groups = Array.from({ length: 5 }, (_, i) => sprite(i));
const slots = ['titleBarSprite', 'skinTitleEndSprite2', 'bottomEdgeSprite', 'styleSideSprite', 'spriteBottomCorner'] as const;
const hash = (values: ArrayLike<boolean | number>) => {
    let h = 1;
    for (let i = 0; i < values.length; i++) {
        const v = values[i];
        h = (Math.imul(h, 31) + (typeof v === 'boolean' ? (v ? 1231 : 1237) : v)) | 0;
    }
    return h;
};

function font(): SoftwareFont {
    const metric = new Uint8Array(257).fill(4);
    metric[256] = 7;
    const zero = new Int32Array(256),
        w = new Int32Array(256).fill(3),
        h = new Int32Array(256).fill(4);
    return new SoftwareFont(
        metric,
        zero,
        zero,
        w,
        h,
        Array.from({ length: 256 }, (_, c) => Uint8Array.from({ length: 12 }, (_, i) => +((i + c) % 4 !== 0)))
    );
}

type Row = [pre: number, available: number, malformed: number, damage: number, scene: number, hover: number, change: number, at: number];
function vectors(): Row[] {
    const rows: Row[] = [];
    for (let p = 0; p < 32; p++) for (let a = 0; a < 32; a++) rows.push([p, a, -1, 0, (p + a) % 5, (p * 3 + a) % 7, 0, -1]);
    for (const p of [0, 1, 3, 21, 28, 31]) for (let bad = 0; bad < 5; bad++) rows.push([p, 31, bad, 0, 0, 2, 0, -1]);
    for (const p of [0, 1, 3, 7, 29, 31]) for (let damage = 1; damage <= 8; damage++) for (let scene = 0; scene < 5; scene++) rows.push([p, 31, -1, damage, scene, 1, 0, -1]);
    for (const p of [0, 1, 3, 28]) for (let change = 1; change <= 5; change++) for (let at = 0; at < 5; at++) rows.push([p, 31, -1, 0, 0, 1, change, at]);
    for (const p of [0, 3, 28, 31]) for (const mask of [0, 31]) for (let hover = 0; hover < 7; hover++) rows.push([p, mask, -1, 0, 0, hover, 0, -1]);
    return rows;
}

function draw(row: Row, table: Js5Index, bold: SoftwareFont): string {
    const [pre, mask, bad, damage, scene, hover, change, at] = row;
    let reads = '';
    class Source extends Js5ResourceProvider {
        constructor(
            readonly tag: string,
            readonly available: number,
            readonly corrupt: number
        ) {
            super();
        }
        index() {
            reads += this.tag + 'i';
            return table;
        }
        group(mode: number, id: number) {
            reads += this.tag + id + '/' + mode;
            if (this.tag === 'a' && id === at) {
                if (change === 1) Client.m_pSprites = cold;
                if (change === 2) {
                    Minimenu.x = 60;
                    Minimenu.y = 9;
                    Minimenu.width = 6;
                    Minimenu.height = 12;
                    ClientMouseListener.x = 8;
                    ClientMouseListener.mouseY = 42;
                    Minimenu.count = 1;
                }
                if (change === 3) Client.fontBold12 = null;
                if (change === 4) Client.m_pSprites = null;
                if (change === 5) {
                    Minimenu.skinTitleSpriteId = 4;
                    Minimenu.skinTitleEndSprite = 0;
                    Minimenu.bottomSpriteId = 4;
                    Minimenu.sideSpriteId = 0;
                    Minimenu.skinBottomCornerSprite = 1;
                }
            }
            return (this.available & (1 << id)) === 0 ? null : this.corrupt === id ? Uint8Array.of(0, 0, 0, 0, 1, 0) : groups[id];
        }
        prefetchGroup() {
            throw Error('unexpected prefetch');
        }
        GetGroupLoadPercentage(): number {
            throw Error('unexpected percentage');
        }
    }
    const cold = new Js5(new Source('b', 0, -1), false, true);
    Client.m_pSprites = damage === 4 ? null : new Js5(new Source('a', mask, bad), false, true);
    const old = slots.map((field, id) => {
        let s: Pix32 | null = null;
        if (pre & (1 << id)) {
            const w = id + 3,
                h = 6 - id,
                px = Int32Array.from({ length: w * h }, (_, i) => ((i + id) % 4 === 0 ? 0 : 0x811306 + id * 231 + i * 0x20200));
            s = new Pix32(w + 2, h + 2, 1, 1, w, h, px);
            if ((damage === 1 && id === 0) || (damage === 2 && id === 2)) s.width = 0;
            if (damage === 3 && id === 3) s.height = 0;
        }
        Minimenu[field] = s;
        return s;
    });
    Minimenu.skinTitleSpriteId = 0;
    Minimenu.skinTitleEndSprite = 1;
    Minimenu.bottomSpriteId = 2;
    Minimenu.sideSpriteId = 3;
    Minimenu.skinBottomCornerSprite = 4;
    Minimenu.backgroundColour = 0x1234a9;
    Minimenu.highlightColour = 0x8f782f;
    Minimenu.textColour = 0x44ccdd;
    Minimenu.skinHighlightTextColour = 0xf1a532;
    Minimenu.transparency = [0, 33, 256, -9, 300][scene];
    Minimenu.skinHoverAlpha = [0, 200, 33, 257, -8][scene];
    Minimenu.x = [4, -9, 45, 13, 61][scene];
    Minimenu.y = [3, -4, 42, 17, 40][scene];
    Minimenu.width = [45, 62, 39, 0, 17][scene];
    Minimenu.height = [64, 52, 47, 45, 14][scene];
    Minimenu.count = [3, 2, 1, 0, 1][scene];
    ClientMouseListener.x = Minimenu.x + [0, 1, Minimenu.width - 1, Minimenu.width, 12, 12, 12][hover];
    ClientMouseListener.mouseY = Minimenu.y + [28, 23, 36, 27, 22, 38, 40][hover];
    LocalisedText.chooseOption = fromJsString('Choose');
    Client.fontBold12 = damage === 5 ? null : bold;
    for (let i = 0; i < 3; i++) {
        Minimenu.option[i] = fromJsString('op' + i);
        Minimenu.target[i] = fromJsString(i === 1 ? '' : 't' + i);
    }
    if (damage === 6) Minimenu.target[0] = null;
    const frame = Int32Array.from({ length: damage === 7 ? 250 : 72 * 66 }, (_, i) => (0x123535 + i * 31) & 0xffffff);
    Pix2D.setPixels(frame, 72, 66);
    Pix2D.setClipping(4 + scene, 3 + scene, 67 - scene, 63 - scene);
    InterfaceList.rootCount = damage === 8 ? 101 : 100;
    for (let i = 0; i < 100; i++) {
        InterfaceList.rootX[i] = ((i * 17) % 90) - 12;
        InterfaceList.rootY[i] = ((i * 13) % 81) - 12;
        InterfaceList.rootWidth[i] = (i * 7) % 21;
        InterfaceList.rootHeight[i] = (i * 9) % 26;
        InterfaceList.rectangleRedraw[i] = i % 11 === 0;
        InterfaceList.dirty[i] = i % 13 === 0;
    }
    let fault = '-';
    try {
        Minimenu.DrawSpriteMenu();
    } catch (err) {
        fault = err instanceof RangeError ? (err.message === '/ by zero' ? 'divide' : 'bounds') : err instanceof TypeError ? 'null' : String(err);
    }
    const identity = slots.map((slot, i) => (Minimenu[slot] === null ? '_' : Minimenu[slot] === old[i] ? 'O' : Minimenu[slot] instanceof SoftwareAlphaSprite ? 'A' : 'P')).join('');
    return [fault, reads, identity, hash(frame), hash(InterfaceList.rectangleRedraw), hash(InterfaceList.dirty)].join(';');
}

loginFixture(
    import.meta.url,
    'sprite menu matches original archive requests, skin identity, clipped pixels and dirty rectangles',
    async () => {
        const dir = mkdtempSync(join(tmpdir(), 'sprite-menu-'));
        try {
            const cc = Bun.spawnSync(['javac', '-cp', gamepackPath, '-d', dir, join(import.meta.dir, 'sprite-menu-oracle.java')]);
            expect(cc.exitCode, cc.stderr.toString()).toBe(0);
            const rows = vectors(),
                header = [packedIndex, ...groups].map(buf => Buffer.from(buf).toString('base64')).join(' ');
            const jvm = Bun.spawnSync(['java', '-Djava.awt.headless=true', '-cp', dir + delimiter + gamepackPath, 'SpriteMenuOracle'], {
                stdin: Buffer.from([header, ...rows.map(row => row.join(' '))].join('\n') + '\n'),
                maxBuffer: 4 * 1024 * 1024
            });
            expect(jvm.exitCode, jvm.stderr.toString()).toBe(0);
            const expected = jvm.stdout.toString().trimEnd().split(/\r?\n/);
            expect(expected.length).toBe(rows.length);
            const index = new Js5Index(packedIndex, Crc32.prefix(packedIndex, packedIndex.length)),
                bold = font();
            for (const [i, row] of rows.entries()) expect(draw(row, index, bold), row.join(' ')).toBe(expected[i]);
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    },
    35000
);
