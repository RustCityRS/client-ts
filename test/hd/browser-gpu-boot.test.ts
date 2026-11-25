import { expect } from 'bun:test';
import { loginFixture } from '../login-fixture.js';
import { Client as BrowserClient } from '#/Client.js';
import Client from '#/client/Client.js';
import GLDrawableFactory, { registerGLDrawableFactory } from '#/jogl/GLDrawableFactory.js';
import GpuDevice from '#/gl/driver/GpuDevice.js';
import { GLX } from '#/gl/driver/GlEnums.js';
import { WebGpuDrawableFactory } from '#/gl/driver/WebGpuDrawableFactory.js';

loginFixture(
    import.meta.url,
    'browser startup waits for its WebGPU device before initializing the game',
    async () => {
        const init = Client.prototype['MainInit'];
        const acquire = GpuDevice.acquire;
        const previousFactory = GLDrawableFactory.getFactory();
        let starts = 0;
        let hdDefaults: boolean | undefined;
        Client.prototype['MainInit'] = async useBrowserHdDefaults => {
            starts++;
            hdDefaults = useBrowserHdDefaults;
        };
        try {
            for (const outcome of ['available', 'absent', 'rejected', 'closed'] as const) {
                const page: BrowserClient = Object.create(BrowserClient.prototype);
                registerGLDrawableFactory(null);
                starts = 0;
                hdDefaults = undefined;
                page['closed'] = false;
                const pending = Promise.withResolvers<GpuDevice | null>();
                GpuDevice.acquire = () => pending.promise;
                const boot = page['MainInit']();
                expect(starts).toBe(0);
                expect(GLDrawableFactory.getFactory()).toBeNull();
                if (outcome === 'rejected') pending.reject(new Error('device unavailable'));
                else if (outcome === 'absent') pending.resolve(null);
                else {
                    page['closed'] = outcome === 'closed';
                    const limits = { maxTextureDimension2D: 8192, maxTextureDimension3D: 256, maxSampledTexturesPerShaderStage: 16, maxSamplersPerShaderStage: 16 };
                    pending.resolve(Object.assign(Object.create(GpuDevice.prototype), { device: { limits } }));
                }
                await boot;
                expect(starts).toBe(outcome === 'closed' ? 0 : 1);
                expect<boolean | undefined>(hdDefaults).toBe(outcome === 'closed' ? undefined : outcome === 'available');
                const factory = GLDrawableFactory.getFactory();
                if (outcome === 'available') {
                    expect(factory).toBeInstanceOf(WebGpuDrawableFactory);
                    expect(page['sdDevice']).toBeInstanceOf(GpuDevice);
                    const { profile } = factory as WebGpuDrawableFactory;
                    expect(profile.strings[GLX.GL_RENDERER]).toBe('WebGPU');
                    expect(profile.integers[GLX.GL_MAX_TEXTURE_SIZE]).toEqual([8192]);
                    expect(profile.integers[GLX.GL_MAX_CUBE_MAP_TEXTURE_SIZE]).toEqual([8192]);
                    expect(profile.integers[GLX.GL_MAX_3D_TEXTURE_SIZE]).toEqual([256]);
                    expect(profile.integers[GLX.GL_MAX_TEXTURE_UNITS]).toEqual([3]);
                } else expect(factory).toBeNull();
            }
        } finally {
            Client.prototype['MainInit'] = init;
            GpuDevice.acquire = acquire;
            registerGLDrawableFactory(previousFactory === null ? null : () => previousFactory);
        }
    },
    15000,
    'gl'
);

loginFixture(
    import.meta.url,
    'non-GL browser startup keeps the native SD CPU renderer',
    async () => {
        const init = Client.prototype['MainInit'],
            acquire = GpuDevice.acquire;
        let requested = 0,
            starts = 0;
        Client.prototype['MainInit'] = async defaults => {
            expect(defaults).toBe(false);
            starts++;
        };
        GpuDevice.acquire = async () => {
            requested++;
            return null;
        };
        try {
            const page: BrowserClient = Object.create(BrowserClient.prototype);
            await page['MainInit']();
            expect(requested).toBe(0);
            expect(starts).toBe(1);
        } finally {
            Client.prototype['MainInit'] = init;
            GpuDevice.acquire = acquire;
        }
    },
    15000,
    'sd'
);
