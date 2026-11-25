import { expect, test } from 'bun:test';
import TextureBindingCache from '#/gl/driver/TextureBindingCache.js';

test('switching glyph, mask and sampler bindings reuses their original WebGPU groups', () => {
    const cache = new TextureBindingCache();
    const created: GPUBindGroupDescriptor[] = [];
    const device = {
        createBindGroup(descriptor: GPUBindGroupDescriptor) {
            created.push(descriptor);
            return {};
        }
    } as unknown as GPUDevice;
    const views: { id: string; dimension?: GPUTextureViewDimension }[] = [];
    function texture(id: string): GPUTexture {
        return {
            createView({ dimension }: GPUTextureViewDescriptor) {
                const view = { id, dimension };
                views.push(view);
                return view;
            }
        } as unknown as GPUTexture;
    }
    const atlas = texture('atlas'),
        icon = texture('icon'),
        mask = texture('mask');
    const nearest = {} as GPUSampler,
        linear = {} as GPUSampler;
    const layout = {} as GPUBindGroupLayout;
    const stages = [{ unit: 0 }, { unit: 1 }];
    const group = cache.get(device, layout, stages, [atlas, nearest, mask, linear]);
    const switched = cache.get(device, layout, stages, [icon, nearest, mask, linear]);
    expect(switched).not.toBe(group);
    expect(cache.get(device, layout, stages, [atlas, nearest, mask, linear])).toBe(group);
    expect(cache.get(device, layout, stages, [atlas, nearest, mask, nearest])).not.toBe(group);
    expect(cache.get(device, layout, stages, [mask, linear, atlas, nearest])).not.toBe(group);
    const maskLayout = {} as GPUBindGroupLayout;
    expect(cache.get(device, maskLayout, [{ unit: 1 }], [atlas, nearest])).not.toBe(group);
    expect(created).toHaveLength(5);
    expect(Array.from(created[0].entries, entry => entry.binding)).toEqual([0, 1, 2, 3]);
    expect(Array.from(created[4].entries, entry => entry.binding)).toEqual([2, 3]);
    expect(views).toEqual([
        { id: 'atlas', dimension: '2d' },
        { id: 'mask', dimension: '2d' },
        { id: 'icon', dimension: '2d' }
    ]);
});
