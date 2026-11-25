export const readbackPatternWgsl = /* wgsl */ `
        struct Size { width: u32, height: u32, pitch: u32, start: u32 }
        @group(0) @binding(0) var<uniform> size: Size;
        @group(0) @binding(1) var<storage,read_write> words: array<u32>;
        @group(0) @binding(2) var frame: texture_storage_2d<r32uint,write>;
        @compute @workgroup_size(8, 8)
        fn main(@builtin(global_invocation_id) id: vec3<u32>) {
            if (id.x >= size.width || id.y >= size.height) { return; }
            var pixel = 0xa9876543u ^ ((id.x + id.y * size.width) * 0x35b7c295u);
            if (id.x >= 1u && id.x < 14u && id.y >= 1u && id.y < 4u) { pixel = 0xce234567u; }
            words[size.start + id.y * size.pitch + id.x] = pixel;
            textureStore(frame, id.xy, vec4u(pixel, 0u, 0u, 0u));
        }`;
