import { expect } from 'bun:test';
import Client from '#/client/Client.js';
import ClientMouseListener from '#/client/ClientMouseListener.js';
import MouseWheel from '#/client/MouseWheel.js';
import GlCleaner from '#/gl/GlCleaner.js';
import GlRenderer from '#/gl/GlRenderer.js';
import NullGL from '#/gl/NullGL.js';
import { FALLBACK_CAPS_PROFILE } from '#/gl/CapsProfile.js';
import AccountCreation from '#/io/AccountCreation.js';
import { loginFixture } from '../login-fixture.js';
import { hdGamepackPath } from '../render/hd-reference.js';

loginFixture(
    import.meta.url,
    'HD title and region ticks drain finalized GL names between polling the mouse and wheel',
    async () => {
        const bytecode = Bun.spawnSync(['javap', '-p', '-c', '-classpath', hdGamepackPath, 'client']);
        expect(bytecode.exitCode, bytecode.stderr.toString()).toBe(0);
        const tick = bytecode.stdout.toString().split('final void a(byte);')[1].split('Exception table:')[0];
        // Original client.a(B)V, including the active-context branch and its jump past fa.c().
        expect(tick).toMatch(/Method ii\.b:\(I\)V\s+\d+: getstatic\s+#\d+\s+\/\/ Field tf\.w:Z\s+\d+: ifne\s+(\d+)\s+\d+: goto\s+(\d+)\s+\1: invokestatic\s+#\d+\s+\/\/ Method fa\.c:\(\)V\s+\2: getstatic\s+#\d+\s+\/\/ Field fk\.q:Luc;/);

        const events: string[] = [];
        const app = new Client();
        Object.assign(app, {
            js5Tick: async () => {},
            titleLoop: () => events.push('title'),
            LoginPoll: async () => {},
            login: { selectLoginWorld: async () => {} },
            MapBuildLoop: () => events.push('map')
        });
        AccountCreation.loop = async () => {};
        ClientMouseListener.poll = () => {
            events.push('mouse');
        };
        MouseWheel.instance = {
            poll: () => {
                events.push('wheel');
                return 0;
            },
            start() {},
            stop() {}
        };
        const gl = (GlRenderer.gl = new NullGL(FALLBACK_CAPS_PROFILE));
        gl.glDeleteBuffersARB = (count, names, offset) => {
            events.push('buffers ' + names?.slice(offset, offset + count).join(','));
        };
        gl.glDeleteTextures = (count, names, offset) => {
            events.push('textures ' + names?.slice(offset, offset + count).join(','));
        };
        gl.glDeleteLists = (name, count) => {
            events.push('lists ' + name + '/' + count);
        };

        // Two consecutive title/region changes in the same context. The first tick
        // retains queued names while inactive, and subsequent active ticks delete them exactly once.
        for (const state of [10, 28, 10]) {
            Client.gameState = state;
            const tail = state === 10 ? 'title' : 'map';
            const total = () => [GlCleaner.geometryMemory, GlCleaner.memory2d, GlCleaner.textureMemory];
            GlCleaner.geometryMemory += 4096;
            GlCleaner.memory2d += 2048;
            GlCleaner.textureMemory += 1024;
            GlCleaner.deleteBuffer(1, 4096, GlCleaner.generation);
            GlCleaner.deleteTexture2d(2, 2048, GlCleaner.generation);
            GlCleaner.deleteTexture(3, 1024, GlCleaner.generation);
            GlCleaner.deleteList(4, GlCleaner.generation);
            GlRenderer.active = false;
            await app['MainLoop']();
            expect(events.splice(0)).toEqual(['mouse', 'wheel', tail]);
            expect(total()).toEqual([4096, 2048, 1024]);
            GlRenderer.active = true;
            await app['MainLoop']();
            expect(events.splice(0)).toEqual(['mouse', 'buffers 1', 'textures 2,3', 'lists 4/1', 'wheel', tail]);
            expect(total()).toEqual([0, 0, 0]);
            await app['MainLoop']();
            expect(events.splice(0)).toEqual(['mouse', 'wheel', tail]);
        }
    },
    45000,
    'gl'
);
