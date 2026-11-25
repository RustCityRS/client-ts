let ambient = /* @AMBIENT */;
let diffuse = /* @DIFFUSE */;
var color = u.emission.rgb + ambient.rgb * u.sceneAmbient.rgb;
for (var i=0u; i<8u; i++) {
    let l = u.lights[i];
    if (l.attenuation.w == 0.0) { continue; }
    var direction = l.position.xyz;
    var attenuation = 1.0;
    if (l.position.w != 0.0) {
        direction = direction / l.position.w - eye.xyz / eye.w;
        let d = length(direction);
        attenuation = 1.0 / dot(l.attenuation.xyz, vec3f(1,d,d*d));
    }
    let nDotL = max(dot(normal, normalize(direction)), 0.0);
    color += attenuation * (l.ambient.rgb * ambient.rgb + l.diffuse.rgb * diffuse.rgb * nDotL);
}
out.color = saturate(vec4f(color,diffuse.a));
