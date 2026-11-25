export const pixelTransferWgsl = /* wgsl */ `
struct Transfer {
    rasterZoom: vec4f,
    sourceRect: vec4i,
    surface: vec4i,
};
@group(0) @binding(0) var source: texture_2d<f32>;
@group(0) @binding(1) var<uniform> transfer: Transfer;

@vertex fn vs(@builtin(vertex_index) vertex: u32) -> @builtin(position) vec4f {
    let xy = array<vec2f,3>(vec2f(-1,-1),vec2f(3,-1),vec2f(-1,3));
    return vec4f(xy[vertex],0,1);
}
@fragment fn fs(@builtin(position) position: vec4f) -> @location(0) vec4f {
    let window = vec2f(position.x, f32(transfer.surface.x) - position.y);
    let zoom = transfer.rasterZoom.zw;
    let coord = (window - transfer.rasterZoom.xy) / zoom;
    // GL pixel ownership includes the lower window edge and excludes the upper edge of every zoomed texel.
    // A negative zoom reverses those inequalities in source coordinates.
    let index = vec2i(select(floor(coord),ceil(coord)-vec2f(1),zoom < vec2f(0)));
    if (any(index < vec2i(0)) || any(index >= transfer.sourceRect.zw)) { discard; }
    var pos = transfer.sourceRect.xy + index;
    if (transfer.surface.z != 0) { pos.y = transfer.surface.y - 1 - pos.y; }
    if (any(pos < vec2i(0)) || any(pos >= vec2i(textureDimensions(source)))) { discard; }
    let rgba = textureLoad(source,pos,0);
    return vec4f(rgba.rgb,select(rgba.a,1.0,transfer.surface.w != 0));
}`;
