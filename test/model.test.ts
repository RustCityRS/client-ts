import { test, expect } from 'bun:test';
import { readGroup } from './cachefile.js';
import ModelUnlit from '#/dash3d/ModelUnlit.js';
import Js5Compression from '#/cache/Js5Compression.js';

function javaHash(values?: Iterable<number> | null): number {
    if (!values) return 0;
    let hash = 1;
    for (const n of values) hash = (Math.imul(hash, 31) + n) | 0;
    return hash;
}

test.skipIf(!process.env.CACHE_530)('530 vertex, face, colour and material streams agree with cb(byte[]) in the Java gamepack', () => {
    const cache = process.env.CACHE_530;
    if (cache === undefined) throw new TypeError('CACHE_530 is not set');
    const oracle = [
        [0, 193, 347, 6, -1890498339, 2102316274, -1308379848, -642705681, -917218978, -509794910, -690487821, -704860257, -79183942, -255288971, 0],
        [24206, 144, 250, 1, -1339085599, 1926149979, 512845130, -1878717689, 461339769, 1994244407, -870326847, 0, 1408984545, -1805503295, 0],
        [1100, 48, 31, 7, 553969550, 725836704, 1724390288, 948816830, -530461214, 1045124052, -1324453058, 0, -1946410959, 761018612, 0]
    ];
    for (const [id, ...expected] of oracle) {
        const model = new ModelUnlit(Js5Compression.Decompress(readGroup(cache, 7, id)));
        expect([
            model.numPoints,
            model.numFaces,
            model.numT,
            ...[
                model.pointX,
                model.pointY,
                model.pointZ,
                model.faceVertexA,
                model.faceVertexB,
                model.faceVertexC,
                model.faceColour,
                model.faceRenderType,
                model.faceMaterial,
                model.faceTextureAxis ? new Int8Array(model.faceTextureAxis.buffer) : null,
                model.faceAlpha
            ].map(javaHash)
        ]).toEqual(expected);
    }
});
import ClientPlayer from '#/dash3d/ClientPlayer.js';
import { localAssets } from './cachefile.js';
import IfType from '#/ui/IfType.js';
import Client from '#/client/Client.js';
import NativePix3D from '#/dash3d/Pix3D.js';
import TextureCache from '#/dash3d/TextureCache.js';
import NativePix2D from '#/graphics/Pix2D.js';
import InterfaceList from '#/ui/InterfaceList.js';
import InterfaceView from '#/ui/InterfaceView.js';
import { loginFixture } from './login-fixture.js';
import { cachePath } from './reference.js';

loginFixture(import.meta.url, 'IF3 model drawing uses the parent clip, scaled origin, orientation and orthographic zoom from lf', async () => {
    const assets = localAssets(cachePath, [7, 8, 9, 26]);
    NativePix3D.textureProvider = new TextureCache(assets.archive(9), assets.archive(26), assets.archive(8), 20, false);
    NativePix3D['brightness'] = Math.fround(0.8);
    NativePix3D['initColourTable'](0, 512);
    Client.localPlayer = new ClientPlayer();
    const c = new IfType();
    c.id = 1;
    c.if3 = true;
    Object.assign(c, { type: 6, modelId: 0, baseX: 50, baseY: 40, baseWidth: 120, baseHeight: 124, modelYAngle: 384, modelZAngle: 44, modelXAngle: 256, modelZoom: 380, modelOriginX: 8, modelOriginY: 6, modelOffsetY: 16 });
    const view = new InterfaceView([c]);
    Client.InterfaceCalculateSizeAndPosArray(256, 256, -1, [c], false);
    InterfaceList.rectRedrawnLastFrame[0] = true;
    for (const ortho of [false, true]) {
        c.modelOrtho = ortho;
        const pixels = new Int32Array(256 * 256);
        NativePix2D.setPixels(pixels, 256, 256);
        InterfaceList.rootCount = 0;
        view.draw();
        expect(javaHash(pixels)).toBe(ortho ? 474163005 : 726813378);
    }
});
