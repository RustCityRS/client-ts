struct Varying {
    @builtin(position) pos: vec4f,
    @location(0) color: vec4f,
    @location(1) uv0: vec2f,
    @location(2) uv1: vec2f
}

@vertex fn vertex(@location(0) pos: vec4f, @location(1) color: vec4f, @location(2) uv0: vec2f, @location(3) uv1: vec2f) -> Varying {
    return Varying(pos, color, uv0, uv1);
}

@fragment fn fragment(v: Varying) -> @location(0) vec4f {
    var outColor = v.color;
    /* @FRAGMENT_OPERATIONS */
    return outColor;
}
