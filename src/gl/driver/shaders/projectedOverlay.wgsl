@group(1) @binding(0) var<uniform> presentationView: mat4x4f;

struct Varying {
    @builtin(position) pos: vec4f,
    @location(0) color: vec4f,
    @location(1) uv0: vec2f,
    @location(2) uv1: vec2f,
    @location(3) sourcePosition: vec2f,
    @location(4) @interpolate(flat) localClip: vec4f
}

@vertex fn vertex(@location(0) pos: vec4f, @location(1) color: vec4f, @location(2) uv0: vec2f, @location(3) uv1: vec2f,
    @location(4) eye: vec3f, @location(5) focal: vec2f, @location(6) localClip: vec4f, @location(7) javaAnchor: vec2f) -> Varying {
    let displayed = presentationView * vec4f(eye, 1.0);
    var shifted = pos;
    if (displayed.z <= -50.0) {
        // Move the complete Java sprite from its integer screen anchor to the
        // world camera's projected position, preserving pixel dimensions and layout.
        let offset = focal * displayed.xy / -displayed.z - javaAnchor;
        shifted = vec4f(pos.xy + pos.w * offset, pos.zw);
    } else {
        shifted.z = 2.0 * pos.w;
    }
    return Varying(shifted, color, uv0, uv1, pos.xy / pos.w, localClip);
}

@fragment fn fragment(v: Varying) -> @location(0) vec4f {
    var outColor = v.color;
    /* @FRAGMENT_OPERATIONS */
    // GL scissors include the top and left pixel and exclude the bottom and right.
    let s = v.sourcePosition;
    if (s.x < v.localClip.x || s.x >= v.localClip.z || s.y <= v.localClip.y || s.y > v.localClip.w) { discard; }
    return outColor;
}
