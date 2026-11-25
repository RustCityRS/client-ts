// rd.f's !!ARBvp1.0. Texture matrix 1 takes view position back to world coordinates.
let world = u.textureMatrices[1] * eye;
let noiseAddress = vec2u(fract(vec2f(world.x + world.z, world.z - world.x) * 0.0001220703125) * 64.0);
let noise = vec2f(u.local[noiseAddress.x].x,u.local[noiseAddress.y].y) * u.local[64].x;
out.color = vec4f(primary.rgb * u.local[66].rgb, 1);
out.eyeZ = clip.z;
