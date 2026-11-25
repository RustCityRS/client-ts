import { expect, test } from 'bun:test';
import { relative, resolve, sep } from 'node:path';
import Client from '#/client/Client.js';
import Js5Resources from '#/cache/Js5Resources.js';
import SoftwareFont from '#/graphics/SoftwareFont.js';
import SuperPacket from '#/io/SuperPacket.js';
import InterfaceSession from '#/ui/InterfaceSession.js';
import InterfaceView from '#/ui/InterfaceView.js';
import { fixtureDiskQueue } from '../disk-queue.js';
import { loginFixture } from '../login-fixture.js';

// Neither native 530 gamepack allocates the 225 visibility or model arrays during login.
for (const identity of ['gl', 'sd'] as const) {
    loginFixture(
        import.meta.url,
        identity + ' gamepack loads its own gameplay scene on login',
        async () => {
            const assets = new Js5Resources(fixtureDiskQueue());
            const view = new InterfaceView([]);
            const ui = new InterfaceSession(view, assets);
            const client = new Client();
            Client.fontBold12 = new SoftwareFont(new Uint8Array(257));
            client['enterGame']({ outgoing: new SuperPacket(128), account: null, rebuild: null }, assets, ui);
            expect(client.game).toBeDefined();
            expect(view.drawScene !== undefined).toBe(false);
        },
        10000,
        identity
    );
}

test('the 530 browser graph contains only revision 530 rendering classes in both gamepacks', async () => {
    const root = resolve(import.meta.dir, '../..');
    for (const identity of ['sd', 'gl']) {
        const build = await Bun.build({
            root,
            entrypoints: [resolve(root, 'src/Client.ts')],
            target: 'browser',
            sourcemap: 'external',
            define: { 'process.env.RS530_GAMEPACK_IDENTITY': JSON.stringify(identity) }
        });
        expect(build.success, identity).toBe(true);
        const map = build.outputs.find(output => output.kind === 'sourcemap');
        if (!map) throw new Error('Missing browser source map');
        const sources = (JSON.parse(await map.text()).sources as string[]).map(path => relative(root, resolve(root, path)).split(sep).join('/'));
        expect(sources, identity).toContain('src/dash3d/world.ts');
        expect(
            sources.filter(path => /^src\/(?:530\/)?(?:scene\/(?:SceneViewport|WorldScene|RasterTables)|model\/(?:WorldProjection|SoftwareModel)|dash3d\/(?:World|Model))\.ts$/.test(path)),
            identity
        ).toEqual([]);
    }
});
