// Revision 742 nj.k(128, 128, 16, 8, new aee(419684), 4, 4, 16, .5, .6).
// The Z coordinate is integral on every octave for these sixteen animation slices.
self.onmessage = ({ data: permutation }) => {
    const height = new Int8Array(128 * 128 * 16);
    const f = Math.fround;
    function fade(t) {
        return f(f(f(t * t) * t) * f(f(f(6 * t - 15) * t) + 10));
    }
    function lerp(a, b, t) {
        return f(f(f(b - a) * t) + a);
    }
    function gradient(i, x, y) {
        const g = permutation[i & 255];
        const third = f(0.333333);
        return f(f(f((g & 1 ? third : -third) * x) + f((g & 2 ? third : -third) * y)) + (g & 4 ? third : -third));
    }
    let amplitude = 0.5;
    for (let octave = 0; octave < 8; octave++) {
        const mask = ((4 << octave) - 1) & 255;
        const step = (1 << octave) / 32;
        const scale = f(amplitude * 127);
        let index = 0;
        for (let z = 0; z < 16; z++) {
            const pz = permutation[(z << octave) & 255];
            for (let y = 0; y < 128; y++) {
                const py = y * step;
                const fy = py - (py | 0);
                const weightY = fade(fy);
                const near = permutation[(pz + ((py | 0) & mask)) & 255];
                const far = permutation[(pz + (((py | 0) + 1) & mask)) & 255];
                for (let x = 0; x < 128; x++) {
                    const px = x * step;
                    const fx = px - (px | 0);
                    const weightX = fade(fx);
                    const left = (px | 0) & mask;
                    const right = ((px | 0) + 1) & mask;
                    const a = lerp(gradient(near + left, 1 - fx, 1 - fy), gradient(near + right, fx, 1 - fy), weightX);
                    const b = lerp(gradient(far + left, 1 - fx, fy), gradient(far + right, fx, fy), weightX);
                    height[index] = f(height[index] + f(scale * lerp(a, b, weightY)));
                    index++;
                }
            }
        }
        amplitude = f(amplitude * f(0.6));
    }
    const bytes = new Uint8Array(height.buffer);
    for (let i = 0; i < bytes.length; i++) bytes[i] += 127;
    const levels = [];
    let width = 128,
        depth = 16;
    let rgba = new Uint8Array(bytes.length * 4);
    for (let i = 0; i < bytes.length; i++) {
        const x = i & 127,
            y = (i >> 7) & 127,
            slice = i & ~16383;
        const dx = bytes[(i & ~127) + ((x - 1) & 127)] - bytes[(i & ~127) + ((x + 1) & 127)];
        const dz = bytes[slice + (((y - 1) & 127) << 7) + x] - bytes[slice + (((y + 1) & 127) << 7) + x];
        const scale = f(128 / Math.sqrt(dx * dx + dz * dz + 16384));
        rgba[i * 4] = f(f(dx * scale) + 127);
        rgba[i * 4 + 1] = f(f(128 * scale) + 127);
        rgba[i * 4 + 2] = f(f(dz * scale) + 127);
        rgba[i * 4 + 3] = bytes[i];
    }
    levels.push(rgba);
    while (width > 1) {
        const w = width >> 1,
            d = Math.max(1, depth >> 1);
        const next = new Uint8Array(w * w * d * 4);
        for (let z = 0; z < d; z++) {
            for (let y = 0; y < w; y++) {
                for (let x = 0; x < w; x++) {
                    const dst = ((z * w + y) * w + x) * 4;
                    for (let c = 0; c < 4; c++) {
                        let sum = 0;
                        const layers = depth > 1 ? 2 : 1;
                        for (let k = 0; k < layers; k++) {
                            const src = (((z * 2 + k) * width + y * 2) * width + x * 2) * 4 + c;
                            sum += rgba[src] + rgba[src + 4] + rgba[src + width * 4] + rgba[src + width * 4 + 4];
                        }
                        next[dst + c] = Math.round(sum / (4 * layers));
                    }
                }
            }
        }
        levels.push(next);
        rgba = next;
        width = w;
        depth = d;
    }
    self.postMessage(
        levels,
        levels.map(level => level.buffer)
    );
    self.close();
};
