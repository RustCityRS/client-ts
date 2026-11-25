interface TextureBindings {
    next?: WeakMap<GPUTexture | GPUSampler, TextureBindings>;
    group?: GPUBindGroup;
}

/** Reuse immutable WebGPU bindings when OpenGL switches back to a previous set of textures and samplers. */
export default class TextureBindingCache {
    private readonly layouts = new WeakMap<GPUBindGroupLayout, TextureBindings>();
    private readonly views = new WeakMap<GPUTexture, GPUTextureView>();

    get(device: GPUDevice, layout: GPUBindGroupLayout, stages: readonly { unit: number; dimension?: GPUTextureViewDimension }[], resources: readonly (GPUTexture | GPUSampler)[]): GPUBindGroup {
        let bindings = this.layouts.get(layout);
        if (bindings === undefined) {
            bindings = {};
            this.layouts.set(layout, bindings);
        }
        for (let i = 0; i < stages.length * 2; i++) {
            const resource = resources[i];
            const children: WeakMap<GPUTexture | GPUSampler, TextureBindings> = (bindings.next ??= new WeakMap());
            let child = children.get(resource);
            if (child === undefined) {
                child = {};
                children.set(resource, child);
            }
            bindings = child;
        }
        if (bindings.group === undefined) {
            const entries: GPUBindGroupEntry[] = [];
            for (let i = 0; i < stages.length; i++) {
                // A realized GL texture belongs to exactly one target (2D, 3D or cube).
                const texture = resources[2 * i] as GPUTexture;
                let view = this.views.get(texture);
                if (view === undefined) {
                    view = texture.createView({ dimension: stages[i].dimension ?? '2d' });
                    this.views.set(texture, view);
                }
                const binding = 2 * stages[i].unit;
                entries.push({ binding, resource: view }, { binding: binding + 1, resource: resources[2 * i + 1] as GPUSampler });
            }
            bindings.group = device.createBindGroup({ layout, entries });
        }
        return bindings.group;
    }
}
