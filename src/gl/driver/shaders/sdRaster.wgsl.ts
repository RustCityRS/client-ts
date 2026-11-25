// dc scanline arithmetic is signed 32-bit, including the final arithmetic shift of modulated RGB.
export const sdRasterShader = /* wgsl */ `
@group(0) @binding(0) var<storage, read_write> pixels: array<i32>;
@group(0) @binding(1) var<storage, read> assets: array<i32>;
@group(0) @binding(2) var<storage, read> commands: array<i32>;

fn scaleColour(rgb: i32, n: i32) -> i32 {
    return ((((rgb & 0xff00ff) * n) >> 8u) & 0xff00ff) + ((((rgb & 0xff00) * n) >> 8u) & 0xff00);
}

fn quotient(uvw: vec3i, shift: u32) -> vec2i {
    let divisor = uvw.z >> shift;
    if (divisor == 0) { return vec2i(0); }
    return uvw.xy / divisor;
}

fn packed(uv: vec2i, shift: u32) -> i32 { return (uv.x << shift) + uv.y; }

fn blendPacked(rgb: i32, old: i32, a: i32) -> i32 {
    let rb = ((rgb & 0xff00ff) * a + (old & 0xff00ff) * (256 - a)) & -16711936;
    let g = ((rgb & 0xff00) * a + (old & 0xff00) * (256 - a)) & 0xff0000;
    return rb + g;
}

fn drawSpan(at: i32, lane: i32, lanes: i32) {
    let first = commands[at];
    let count = commands[at + 1];
    // A destination word stays assigned to the same lane for every span in this row.
    let start = (lane - first) & (lanes - 1);
    if (start >= count) { return; }
    let x0 = commands[at + 2];
    let colour = commands[at + 3];
    let step = commands[at + 4];
    let alpha = commands[at + 5];
    let flags = commands[at + 6];
    let asset = commands[at + 7];
    let kind = commands[at + 8];
    if (kind == 4) {
        for (var i = start; i < count; i += lanes) {
            var rgb = colour;
            if (flags == 1) { rgb = scaleColour(colour, alpha) + scaleColour(pixels[first + i], 256 - alpha); }
            if (flags == 2) {
                let old = pixels[first + i];
                let r = (((colour >> 16u) & 255) * alpha + ((old >> 16u) & 255) * (256 - alpha)) >> 8u;
                let g = (((colour >> 8u) & 255) * alpha + ((old >> 8u) & 255) * (256 - alpha)) >> 8u;
                let b = ((colour & 255) * alpha + (old & 255) * (256 - alpha)) >> 8u;
                rgb = (r << 16u) + (g << 8u) + b;
            }
            pixels[first + i] = rgb;
        }
        return;
    }
    if (kind == 6) {
        for (var i = start; i < count; i += lanes) {
            let byte = step + i;
            let mask = u32(assets[asset + (byte >> 2u)]) >> (u32(byte & 3) * 8u);
            if ((mask & 255u) == 0u) { continue; }
            var rgb = colour;
            if (flags != 0) {
                let old = pixels[first + i];
                let a = ((((colour & 0xff00ff) * alpha) & -16711936) + (((colour & 0xff00) * alpha) & 0xff0000)) >> 8u;
                let b = ((((old & 0xff00ff) * (256 - alpha)) & -16711936) + (((old & 0xff00) * (256 - alpha)) & 0xff0000)) >> 8u;
                rgb = a + b;
            }
            pixels[first + i] = rgb;
        }
        return;
    }
    if (kind == 5) {
        var x = commands[at + 11] + start * commands[at + 14];
        var y = commands[at + 12] + start * commands[at + 15];
        let stride = commands[at + 10];
        for (var i = start; i < count; i += lanes) {
            let rgb = assets[asset + colour + (x >> u32(step)) + (y >> u32(step)) * stride];
            if (flags == 2 || flags == 4 || flags == 5) {
                var a = i32(u32(rgb) >> 24u);
                if (flags == 5) { a = (a * alpha) >> 8u; }
                if (a != 0 || flags != 2) {
                    pixels[first + i] = i32(u32(blendPacked(rgb, pixels[first + i], a)) >> 8u);
                }
            } else if (flags == 3) {
                if (rgb != 0) { pixels[first + i] = blendPacked(rgb, pixels[first + i], alpha) >> 8u; }
            } else if (flags == 1 || rgb != 0) {
                pixels[first + i] = rgb;
            }
            x += lanes * commands[at + 14];
            y += lanes * commands[at + 15];
        }
        return;
    }
    if (kind == 7) {
        var x = commands[at + 11] + start * commands[at + 14];
        for (var i = start; i < count; i += lanes) {
            let pos = colour + (x >> 16u);
            let index = i32((u32(assets[asset + (pos >> 2u)]) >> (u32(pos & 3) * 8u)) & 255u);
            if (index != 0) {
                var rgb = assets[step + index];
                if (flags == 1) { rgb = blendPacked(rgb, pixels[first + i], alpha) >> 8u; }
                if (flags == 2) {
                    let r = (((rgb >> 16u) & 255) * ((alpha >> 16u) & 255)) >> 8u;
                    let g = (((rgb >> 8u) & 255) * ((alpha >> 8u) & 255)) >> 8u;
                    let b = ((rgb & 255) * (alpha & 255)) >> 8u;
                    rgb = (r << 16u) + (g << 8u) + b;
                }
                pixels[first + i] = rgb;
            }
            x += lanes * commands[at + 14];
        }
        return;
    }

    if (kind == 8) {
        for (var i = start; i < count; i += lanes) {
            let bg = pixels[first + i];
            var rgb = bg;
            if (i < alpha) {
                let heat = assets[asset + colour + i];
                if (heat != 0) {
                    let flame = assets[flags + heat];
                    let a = min(255, heat + 18);
                    let inv = min(255, 238 - heat);
                    let g = (inv * (bg & 0xff00) + a * (flame & 0xff00)) & 0xff0000;
                    let rb = (a * (flame & 0xff00ff) + inv * (bg & 0xff00ff)) & -16711936;
                    rgb = (g + rb) >> 8u;
                }
            }
            pixels[step + i] = rgb;
        }
        return;
    }
    if (kind == 9) {
        for (var i = start; i < count; i += lanes) { pixels[first + i] = pixels[colour + i]; }
        return;
    }
    if (kind == 10) {
        for (var i = start; i < count; i += lanes) {
            pixels[first + i] = blendPacked(colour, pixels[first + i], alpha) >> 8u;
        }
        return;
    }
    if (kind == 11) {
        // The recorder gives this span a single invocation and its own dispatch.
        // dc loads a live palette entry once per group, before any destination writes.
        let group = select(1, 4, (flags & 1) != 0);
        var shade = colour + step * x0;
        for (var i = 0; i < count; i += group) {
            var rgb = pixels[shade >> 8u];
            if (alpha != 0) { rgb = scaleColour(rgb, 256 - alpha); }
            for (var j = i; j < min(i + group, count); j++) {
                var result = rgb;
                if (alpha != 0) { result += scaleColour(pixels[first + j], alpha); }
                pixels[first + j] = result;
            }
            shade += step * group;
        }
        return;
    }

    if (kind < 2) {
        for (var i = start; i < count; i += lanes) {
            let index = first + i;
            var rgb = colour;
            if (kind == 1) {
                let k = select(i, i & ~3, (flags & 1) != 0);
                rgb = assets[asset + ((colour + step * (x0 + k)) >> 8u)];
            } else if (alpha == 254) {
                pixels[index] = pixels[index + 1];
                continue;
            }
            if (alpha != 0) { rgb = scaleColour(rgb, 256 - alpha) + scaleColour(pixels[index], alpha); }
            pixels[index] = rgb;
        }
        return;
    }

    let x = x0 - commands[at + 10];
    let origin = vec3i(commands[at + 11], commands[at + 12], commands[at + 13]);
    let delta = vec3i(commands[at + 14], commands[at + 15], commands[at + 16]);
    let small = (flags & 1) != 0;
    let zShift = select(14u, 12u, small);
    let uShift = select(18u, 20u, small);
    let indexShift = select(25u, 26u, small);
    let vMask = select(16256, 4032, small);
    let plane = origin + delta * x;
    let a = quotient(plane, zShift);
    let b = quotient(plane + delta * count, zShift);
    let base = packed(a, uShift);
    let stepTex = packed((b - a) / count, uShift);
    for (var i = start; i < count; i += lanes) {
        let block = i & ~7;
        var tex = base + stepTex * i;
        if (kind == 3) {
            let current = origin + (delta >> vec3u(3u)) * x + delta * (block >> 3u);
            let uv = quotient(current, zShift);
            let next = quotient(current + delta, zShift);
            tex = packed(uv, uShift) + packed((next - uv) >> vec2u(3u), uShift) * (i - block);
        }
        let shade = (colour + step * (x0 + block)) >> 8u;
        let rgb = assets[asset + (tex & vMask) + i32(u32(tex) >> indexShift)];
        if (rgb != 0 || (flags & 2) != 0) {
            pixels[first + i] = ((((rgb & 0xff00ff) * shade) & -16711936) + (((rgb & 0xff00) * shade) & 0xff0000)) >> 8u;
        }
    }
}

// Decode the compact native Gouraud call. The six branches preserve dc's tie
// decisions after vertical clipping. All edge and colour operations use signed ints.
fn projectedGouraud(at: i32, row: i32, lane: i32, lanes: i32, stride: i32) {
    let base = ~commands[at];
    let y0 = (commands[at + 1] << 16u) >> 16u;
    let y1 = commands[at + 1] >> 16u;
    let y2 = (commands[at + 2] << 16u) >> 16u;
    let x0 = commands[at + 2] >> 16u;
    let x1 = (commands[at + 3] << 16u) >> 16u;
    let x2 = commands[at + 3] >> 16u;
    let c0 = commands[at + 4] & 65535;
    let c1 = i32(u32(commands[at + 4]) >> 16u);
    let c2 = commands[at + 5] & 65535;
    let height = commands[at + 5] >> 16u;
    let firstY = max(0, min(y0, min(y1,y2)));
    let y = row - base / stride + firstY;
    if (y < firstY || y >= min(height, max(y0, max(y1,y2)))) { return; }

    let dx01 = x1 - x0;
    let dy01 = y1 - y0;
    let dx02 = x2 - x0;
    let dy02 = y2 - y0;
    let dc01 = c1 - c0;
    let dc02 = c2 - c0;
    let area = dx01 * dy02 - dx02 * dy01;
    let shadeX = ((dc01 * dy02 - dc02 * dy01) << 8u) / area;
    let shadeY = ((dc02 * dx01 - dc01 * dx02) << 8u) / area;
    let slope01 = select((dx01 << 16u) / dy01, 0, dy01 == 0);
    let slope02 = select((dx02 << 16u) / dy02, 0, dy02 == 0);
    let slope12 = select(((x2 - x1) << 16u) / (y2 - y1), 0, y1 == y2);

    var top: i32;
    var middle: i32;
    var topX: i32;
    var middleX: i32;
    var colour: i32;
    var longSlope: i32;
    var upperSlope: i32;
    var lowerSlope: i32;
    var longLeft: bool;
    // dc compares the last two vertices after capping y to the viewport height.
    let end0 = min(y0,height);
    let end1 = min(y1,height);
    let end2 = min(y2,height);
    if (y0 <= y1 && y0 <= y2) {
        top = y0; topX = x0; colour = c0;
        if (end1 < end2) {
            middle = y1; middleX = x1;
            longSlope = slope02; upperSlope = slope01; lowerSlope = slope12;
            longLeft = select((slope02 < slope01), (slope02 > slope12), max(0,top) == max(0,middle));
        } else {
            middle = y2; middleX = x2;
            longSlope = slope01; upperSlope = slope02; lowerSlope = slope12;
            longLeft = !select((slope02 < slope01), (slope12 > slope01), max(0,top) == max(0,middle));
        }
    } else if (y1 <= y2) {
        top = y1; topX = x1; colour = c1;
        if (end2 < end0) {
            middle = y2; middleX = x2;
            longSlope = slope01; upperSlope = slope12; lowerSlope = slope02;
            longLeft = select((slope01 < slope12), (slope01 > slope02), max(0,top) == max(0,middle));
        } else {
            middle = y0; middleX = x0;
            longSlope = slope12; upperSlope = slope01; lowerSlope = slope02;
            longLeft = slope01 >= slope12;
        }
    } else {
        top = y2; topX = x2; colour = c2;
        if (end0 < end1) {
            middle = y0; middleX = x0;
            longSlope = slope12; upperSlope = slope02; lowerSlope = slope01;
            longLeft = slope12 < slope02;
        } else {
            middle = y1; middleX = x1;
            longSlope = slope02; upperSlope = slope12; lowerSlope = slope01;
            longLeft = slope12 >= slope02;
        }
    }
    let longX = ((topX << 16u) + longSlope * (y - top)) >> 16u;
    let upperX = ((topX << 16u) + upperSlope * (y - top)) >> 16u;
    let lowerX = ((middleX << 16u) + lowerSlope * (y - middle)) >> 16u;
    let shortX = select(upperX, lowerX, y >= middle);
    var left = select(shortX, longX, longLeft);
    var right = select(longX, shortX, longLeft);
    let flags = commands[at + 6];
    let clip = (flags << 16u) >> 16u;
    if (clip >= 0) {
        left = max(0,left);
        right = min(clip,right);
    }
    let first = base + (y - firstY) * stride + left;
    let shade = (colour << 8u) + shadeX * (left - topX + 1) + shadeY * (y - top);
    let alpha = (flags >> 16u) & 255;
    let low = (flags & 0x1000000) != 0;
    let palette = commands[at + 7];
    for (var i = (lane - first) & (lanes - 1); i < right - left; i += lanes) {
        var rgb = assets[palette + ((shade + shadeX * select(i, i & ~3, low)) >> 8u)];
        if (alpha != 0) { rgb = scaleColour(rgb,256 - alpha) + scaleColour(pixels[first + i],alpha); }
        pixels[first + i] = rgb;
    }
}

// dc's selected left/right edges advance as Java ints. Each row processes these
// references in the same ordered list as sprites, flat spans and textured spans.
fn drawGouraudEdges(at: i32, row: i32, lane: i32, lanes: i32, stride: i32) {
    if (commands[at] < 0) { projectedGouraud(at,row,lane,lanes,stride); return; }
    let dy = row - commands[at + 1];
    if (dy < 0 || dy >= commands[at + 2]) { return; }
    let x0 = (commands[at + 3] + dy * commands[at + 5]) >> 16u;
    let x1 = (commands[at + 4] + dy * commands[at + 6]) >> 16u;
    let clip = commands[at + 10];
    let left = select(x0,max(0,x0),clip >= 0);
    let right = select(x1,min(clip,x1),clip >= 0);
    let first = commands[at] + dy * stride + left;
    let dx = commands[at + 9];
    let shade = commands[at + 7] + dy * commands[at + 8] + dx * left;
    let alpha = commands[at + 11];
    let packedPalette = commands[at + 12];
    let lowDetail = packedPalette < 0;
    let palette = select(packedPalette,~packedPalette,lowDetail);
    for (var i = (lane - first) & (lanes - 1); i < right - left; i += lanes) {
        var rgb = assets[palette + ((shade + dx * select(i,i & ~3,lowDetail)) >> 8u)];
        if (alpha != 0) { rgb = scaleColour(rgb,256 - alpha) + scaleColour(pixels[first + i],alpha); }
        pixels[first + i] = rgb;
    }
}

@compute @workgroup_size(32)
fn main(@builtin(global_invocation_id) id: vec3u, @builtin(num_workgroups) groups: vec3u) {
    let head = commands[id.y];
    let serial = head != -1 && head < 0;
    if (serial && id.x != 0u) { return; }
    let lanes = select(32,1,serial);
    var at = select(head & 0x7fffffff,-1,head == -1);
    var edgeIndex = 0;
    var edgeEnd = 0;
    if (commands[groups.y] == -2147483648) {
        let group = groups.y + 2u + (id.y >> 3u);
        edgeIndex = commands[group];
        edgeEnd = commands[group + 1u];
    }
    loop {
        if (at < 0 && edgeIndex >= edgeEnd) { break; }
        if (edgeIndex < edgeEnd && (at < 0 || commands[edgeIndex] < at)) {
            drawGouraudEdges(commands[edgeIndex],i32(id.y),i32(id.x),lanes,commands[groups.y + 1u]);
            edgeIndex++;
            continue;
        }
        let descriptor = commands[at];
        if (descriptor < 0) {
            let first = (descriptor & 0x7fffffff) >> 11u;
            let count = descriptor & 2047;
            let begin = commands[at + 1];
            let start = (i32(id.x) - first) & (lanes - 1);
            if (begin < 0) {
                for (var i = start; i < count; i += lanes) { pixels[first + i] = assets[~begin]; }
                at = commands[at + 2];
            } else {
                let step = commands[at + 2];
                let palette = ~commands[at + 3];
                for (var i = start; i < count; i += lanes) {
                    pixels[first + i] = assets[palette + ((begin + step * (i & ~3)) >> 8u)];
                }
                at = commands[at + 4];
            }
        } else {
            drawSpan(at, i32(id.x), lanes);
            at = commands[at + 9];
        }
    }
}
`;
