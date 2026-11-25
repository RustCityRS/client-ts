import { arrayAtI32, arrayAtObj, arrayPutI32, requireNonNull } from '#/util/JavaArray';

// Row raster and drawing routines shared by the four gj shape primitives.
export default class TextureShapeRaster {
    static raster: (Int32Array | null)[] | null = null; // we.z:[[I
    static clipMinX = 0; // wa.j:I
    static clipMaxX = 100; // gg.I:I
    static clipTop = 0; // ia.m:I
    static clipMaxY = 100; // sf.d:I
    static circleWidths: Int32Array | null = null; // vg.Y:[I
    // a.a(IBIIII)V
    static drawLine(y1: number, colour: number, x1: number, y0: number, x0: number): void {
        let dy = (y1 - y0) | 0;
        let dx = (x1 - x0) | 0;
        if (dx === 0) {
            if (dy !== 0) TextureShapeRaster.fillSpan(y1, y0, x0, colour);
            return;
        }
        if (dy === 0) {
            TextureShapeRaster.drawHorizontalLine(y0, x1, x0, colour);
            return;
        }
        if (dx < 0) dx = -dx | 0;
        if (dy < 0) dy = -dy | 0;
        const steep = dx < dy;
        if (steep) {
            [x0, y0] = [y0, x0];
            [x1, y1] = [y1, x1];
        }
        if (x1 < x0) {
            [x0, x1] = [x1, x0];
            [y0, y1] = [y1, y0];
        }
        dy = (y1 - y0) | 0;
        if (dy < 0) dy = -dy | 0;
        dx = (x1 - x0) | 0;
        let currentY = y0;
        let error = -(dx >> 1) | 0;
        const stepY = y0 < y1 ? 1 : -1;
        for (let column = x0; column <= x1; column = (column + 1) | 0) {
            if (steep) arrayPutI32(arrayAtObj(TextureShapeRaster.raster, column), currentY, colour);
            else arrayPutI32(arrayAtObj(TextureShapeRaster.raster, currentY), column, colour);
            error = (error + dy) | 0;
            if (error > 0) {
                error = (error - dx) | 0;
                currentY = (currentY + stepY) | 0;
            }
        }
    }

    // aj.a(IIII)I
    static clamp(value: number, max: number, min: number): number {
        return value < min ? min : value > max ? max : value;
    }

    // al.a(IIIII)V
    static drawHorizontalLine(y: number, x1: number, x0: number, colour: number): void {
        if (x0 <= x1) {
            TextureShapeRaster.fillRow(x0, arrayAtObj(TextureShapeRaster.raster, y), x1, colour);
        } else {
            TextureShapeRaster.fillRow(x1, arrayAtObj(TextureShapeRaster.raster, y), x0, colour);
        }
    }

    // b.a(IIIIIIII)V
    static drawEllipseClipped(y: number, thickness: number, border: number, x: number, radiusY: number, fill: number, radiusX: number): void {
        let offsetY = radiusY;
        let span = 0;
        let innerSpan = 0;
        const innerRadiusX = (radiusX - thickness) | 0;
        const innerRadiusY = (radiusY - thickness) | 0;
        const ySquared = Math.imul(radiusY, radiusY);
        const innerXSquared = Math.imul(innerRadiusX, innerRadiusX);
        const innerYSquared = Math.imul(innerRadiusY, innerRadiusY);
        const xSquared = Math.imul(radiusX, radiusX);
        const twiceYSquared = ySquared << 1;
        const twiceInnerXSquared = innerXSquared << 1;
        const twiceXSquared = xSquared << 1;
        const twiceInnerYSquared = innerYSquared << 1;
        const diameterY = radiusY << 1;
        const innerDiameterY = innerRadiusY << 1;
        let outerErrorX = (Math.imul((1 - diameterY) | 0, xSquared) + twiceYSquared) | 0;
        let outerErrorY = (ySquared - Math.imul((-1 + diameterY) | 0, twiceXSquared)) | 0;
        let innerErrorX = (Math.imul((1 - innerDiameterY) | 0, innerXSquared) + twiceInnerYSquared) | 0;
        let innerErrorY = (innerYSquared - Math.imul(twiceInnerXSquared, (innerDiameterY - 1) | 0)) | 0;
        const fourXSquared = xSquared << 2;
        const fourInnerYSquared = innerYSquared << 2;
        let outerXStep = Math.imul(twiceYSquared, 3);
        const fourYSquared = ySquared << 2;
        const fourInnerXSquared = innerXSquared << 2;
        let outerYStep = Math.imul((diameterY - 3) | 0, twiceXSquared);
        let innerYStep = Math.imul((-3 + innerDiameterY) | 0, twiceInnerXSquared);
        let innerXStep = Math.imul(3, twiceInnerYSquared);
        let outerYGradient = Math.imul(fourXSquared, (radiusY - 1) | 0);
        let outerXGradient = fourYSquared;
        let innerXGradient = fourInnerYSquared;
        if (TextureShapeRaster.clipTop <= y && y <= TextureShapeRaster.clipMaxY) {
            const centreRow = arrayAtObj(TextureShapeRaster.raster, y);
            const rowLeft = TextureShapeRaster.clamp((x - radiusX) | 0, TextureShapeRaster.clipMaxX, TextureShapeRaster.clipMinX);
            const rowRight = TextureShapeRaster.clamp((radiusX + x) | 0, TextureShapeRaster.clipMaxX, TextureShapeRaster.clipMinX);
            const rowInnerLeft = TextureShapeRaster.clamp((x - innerRadiusX) | 0, TextureShapeRaster.clipMaxX, TextureShapeRaster.clipMinX);
            const rowInnerRight = TextureShapeRaster.clamp((innerRadiusX + x) | 0, TextureShapeRaster.clipMaxX, TextureShapeRaster.clipMinX);
            TextureShapeRaster.fillRow(rowLeft, centreRow, rowInnerLeft, border);
            TextureShapeRaster.fillRow(rowInnerLeft, centreRow, rowInnerRight, fill);
            TextureShapeRaster.fillRow(rowInnerRight, centreRow, rowRight, border);
        }
        let innerYGradient = Math.imul(fourInnerXSquared, (-1 + innerRadiusY) | 0);
        while (offsetY > 0) {
            const hasInterior = offsetY <= innerRadiusY;
            if (outerErrorX >= 0) {
                if (outerErrorY < 0) {
                    outerErrorX = (outerErrorX + outerXStep) | 0;
                    outerErrorY = (outerErrorY + outerXGradient) | 0;
                    outerXGradient = (outerXGradient + fourYSquared) | 0;
                    span = (span + 1) | 0;
                    outerXStep = (outerXStep + fourYSquared) | 0;
                }
            } else {
                while (outerErrorX < 0) {
                    outerErrorX = (outerErrorX + outerXStep) | 0;
                    outerXStep = (outerXStep + fourYSquared) | 0;
                    span = (span + 1) | 0;
                    outerErrorY = (outerErrorY + outerXGradient) | 0;
                    outerXGradient = (outerXGradient + fourYSquared) | 0;
                }
                if (outerErrorY < 0) {
                    outerErrorX = (outerErrorX + outerXStep) | 0;
                    outerErrorY = (outerErrorY + outerXGradient) | 0;
                    outerXGradient = (outerXGradient + fourYSquared) | 0;
                    span = (span + 1) | 0;
                    outerXStep = (outerXStep + fourYSquared) | 0;
                }
            }
            outerErrorY = (outerErrorY - outerYStep) | 0;
            if (hasInterior) {
                while (innerErrorX < 0) {
                    innerSpan = (innerSpan + 1) | 0;
                    innerErrorY = (innerErrorY + innerXGradient) | 0;
                    innerXGradient = (innerXGradient + fourInnerYSquared) | 0;
                    innerErrorX = (innerErrorX + innerXStep) | 0;
                    innerXStep = (innerXStep + fourInnerYSquared) | 0;
                }
                if (innerErrorY < 0) {
                    innerErrorY = (innerErrorY + innerXGradient) | 0;
                    innerSpan = (innerSpan + 1) | 0;
                    innerXGradient = (innerXGradient + fourInnerYSquared) | 0;
                    innerErrorX = (innerErrorX + innerXStep) | 0;
                    innerXStep = (innerXStep + fourInnerYSquared) | 0;
                }
                innerErrorX = (innerErrorX - innerYGradient) | 0;
                innerErrorY = (innerErrorY - innerYStep) | 0;
                innerYStep = (innerYStep - fourInnerXSquared) | 0;
                innerYGradient = (innerYGradient - fourInnerXSquared) | 0;
            }
            outerErrorX = (outerErrorX - outerYGradient) | 0;
            outerYStep = (outerYStep - fourXSquared) | 0;
            offsetY = (offsetY - 1) | 0;
            const bottom = (y + offsetY) | 0;
            outerYGradient = (outerYGradient - fourXSquared) | 0;
            const top = (y - offsetY) | 0;
            if (bottom >= TextureShapeRaster.clipTop && top <= TextureShapeRaster.clipMaxY) {
                const right = TextureShapeRaster.clamp((x + span) | 0, TextureShapeRaster.clipMaxX, TextureShapeRaster.clipMinX);
                const left = TextureShapeRaster.clamp((x - span) | 0, TextureShapeRaster.clipMaxX, TextureShapeRaster.clipMinX);
                if (hasInterior) {
                    const innerRight = TextureShapeRaster.clamp((x + innerSpan) | 0, TextureShapeRaster.clipMaxX, TextureShapeRaster.clipMinX);
                    const innerLeft = TextureShapeRaster.clamp((x - innerSpan) | 0, TextureShapeRaster.clipMaxX, TextureShapeRaster.clipMinX);
                    if (TextureShapeRaster.clipTop <= top) {
                        const upperRow = arrayAtObj(TextureShapeRaster.raster, top);
                        TextureShapeRaster.fillRow(left, upperRow, innerLeft, border);
                        TextureShapeRaster.fillRow(innerLeft, upperRow, innerRight, fill);
                        TextureShapeRaster.fillRow(innerRight, upperRow, right, border);
                    }
                    if (TextureShapeRaster.clipMaxY >= bottom) {
                        const lowerRow = arrayAtObj(TextureShapeRaster.raster, bottom);
                        TextureShapeRaster.fillRow(left, lowerRow, innerLeft, border);
                        TextureShapeRaster.fillRow(innerLeft, lowerRow, innerRight, fill);
                        TextureShapeRaster.fillRow(innerRight, lowerRow, right, border);
                    }
                } else {
                    if (TextureShapeRaster.clipTop <= top) {
                        TextureShapeRaster.fillRow(left, arrayAtObj(TextureShapeRaster.raster, top), right, border);
                    }
                    if (bottom <= TextureShapeRaster.clipMaxY) {
                        TextureShapeRaster.fillRow(left, arrayAtObj(TextureShapeRaster.raster, bottom), right, border);
                    }
                }
            }
        }
    }

    // b.a(IIIIIIIZ)V
    static drawEllipseUnclipped(x: number, radiusX: number, thickness: number, border: number, fill: number, radiusY: number, y: number): void {
        let offsetY = radiusY;
        let innerSpan = 0;
        let span = 0;
        const innerRadiusX = (radiusX - thickness) | 0;
        const innerXSquared = Math.imul(innerRadiusX, innerRadiusX);
        const ySquared = Math.imul(radiusY, radiusY);
        const innerRadiusY = (radiusY - thickness) | 0;
        const xSquared = Math.imul(radiusX, radiusX);
        const twiceXSquared = xSquared << 1;
        const twiceInnerXSquared = innerXSquared << 1;
        const innerYSquared = Math.imul(innerRadiusY, innerRadiusY);
        const twiceInnerYSquared = innerYSquared << 1;
        const innerDiameterY = innerRadiusY << 1;
        const twiceYSquared = ySquared << 1;
        const diameterY = radiusY << 1;
        let outerErrorX = (Math.imul((1 - diameterY) | 0, xSquared) + twiceYSquared) | 0;
        let outerErrorY = (ySquared - Math.imul(twiceXSquared, (-1 + diameterY) | 0)) | 0;
        let innerErrorX = (Math.imul(innerXSquared, (1 - innerDiameterY) | 0) + twiceInnerYSquared) | 0;
        let innerErrorY = (innerYSquared - Math.imul(twiceInnerXSquared, (innerDiameterY - 1) | 0)) | 0;
        const fourXSquared = xSquared << 2;
        const fourYSquared = ySquared << 2;
        const fourInnerXSquared = innerXSquared << 2;
        let outerYStep = Math.imul(twiceXSquared, (-3 + diameterY) | 0);
        let innerXStep = Math.imul(3, twiceInnerYSquared);
        let outerXStep = Math.imul(twiceYSquared, 3);
        let outerXGradient = fourYSquared;
        let innerYStep = Math.imul((-3 + innerDiameterY) | 0, twiceInnerXSquared);
        const fourInnerYSquared = innerYSquared << 2;
        let outerYGradient = Math.imul((-1 + radiusY) | 0, fourXSquared);
        let innerYGradient = Math.imul(fourInnerXSquared, (innerRadiusY - 1) | 0);
        const centreRow = arrayAtObj(TextureShapeRaster.raster, y);
        let innerXGradient = fourInnerYSquared;
        TextureShapeRaster.fillRow((x - radiusX) | 0, centreRow, (x - innerRadiusX) | 0, border);
        TextureShapeRaster.fillRow((x - innerRadiusX) | 0, centreRow, (x + innerRadiusX) | 0, fill);
        TextureShapeRaster.fillRow((x + innerRadiusX) | 0, centreRow, (radiusX + x) | 0, border);
        if (radiusY > 0) {
            do {
                if (outerErrorX < 0 && outerErrorX < 0) {
                    do {
                        outerErrorY = (outerErrorY + outerXGradient) | 0;
                        outerXGradient = (outerXGradient + fourYSquared) | 0;
                        span = (span + 1) | 0;
                        outerErrorX = (outerErrorX + outerXStep) | 0;
                        outerXStep = (outerXStep + fourYSquared) | 0;
                    } while (outerErrorX < 0);
                }
                const hasInterior = offsetY <= innerRadiusY;
                offsetY = (offsetY - 1) | 0;
                const top = (y - offsetY) | 0;
                if (outerErrorY < 0) {
                    outerErrorY = (outerErrorY + outerXGradient) | 0;
                    span = (span + 1) | 0;
                    outerXGradient = (outerXGradient + fourYSquared) | 0;
                    outerErrorX = (outerErrorX + outerXStep) | 0;
                    outerXStep = (outerXStep + fourYSquared) | 0;
                }
                const left = (x - span) | 0;
                outerErrorY = (outerErrorY - outerYStep) | 0;
                if (hasInterior) {
                    if (innerErrorX < 0 && innerErrorX < 0) {
                        do {
                            innerSpan = (innerSpan + 1) | 0;
                            innerErrorX = (innerErrorX + innerXStep) | 0;
                            innerXStep = (innerXStep + fourInnerYSquared) | 0;
                            innerErrorY = (innerErrorY + innerXGradient) | 0;
                            innerXGradient = (innerXGradient + fourInnerYSquared) | 0;
                        } while (innerErrorX < 0);
                    }
                    if (innerErrorY < 0) {
                        innerErrorX = (innerErrorX + innerXStep) | 0;
                        innerSpan = (innerSpan + 1) | 0;
                        innerErrorY = (innerErrorY + innerXGradient) | 0;
                        innerXGradient = (innerXGradient + fourInnerYSquared) | 0;
                        innerXStep = (innerXStep + fourInnerYSquared) | 0;
                    }
                    innerErrorX = (innerErrorX - innerYGradient) | 0;
                    innerYGradient = (innerYGradient - fourInnerXSquared) | 0;
                    innerErrorY = (innerErrorY - innerYStep) | 0;
                    innerYStep = (innerYStep - fourInnerXSquared) | 0;
                }
                outerErrorX = (outerErrorX - outerYGradient) | 0;
                const bottom = (offsetY + y) | 0;
                outerYStep = (outerYStep - fourXSquared) | 0;
                outerYGradient = (outerYGradient - fourXSquared) | 0;
                const right = (span + x) | 0;
                if (!hasInterior) {
                    TextureShapeRaster.fillRow(left, arrayAtObj(TextureShapeRaster.raster, top), right, border);
                    TextureShapeRaster.fillRow(left, arrayAtObj(TextureShapeRaster.raster, bottom), right, border);
                    continue;
                }
                const innerRight = (x + innerSpan) | 0;
                const innerLeft = (x - innerSpan) | 0;
                TextureShapeRaster.fillRow(left, arrayAtObj(TextureShapeRaster.raster, top), innerLeft, border);
                TextureShapeRaster.fillRow(innerLeft, arrayAtObj(TextureShapeRaster.raster, top), innerRight, fill);
                TextureShapeRaster.fillRow(innerRight, arrayAtObj(TextureShapeRaster.raster, top), right, border);
                TextureShapeRaster.fillRow(left, arrayAtObj(TextureShapeRaster.raster, bottom), innerLeft, border);
                TextureShapeRaster.fillRow(innerLeft, arrayAtObj(TextureShapeRaster.raster, bottom), innerRight, fill);
                TextureShapeRaster.fillRow(innerRight, arrayAtObj(TextureShapeRaster.raster, bottom), right, border);
            } while (offsetY > 0);
        }
    }

    // b.a(BIIII)V
    static fillCircleClipped(y: number, radius: number, x: number, colour: number): void {
        let dx = 0;
        let dy = radius;
        let error = -radius | 0;
        const right = TextureShapeRaster.clamp((x + radius) | 0, TextureShapeRaster.clipMaxX, TextureShapeRaster.clipMinX);
        let delta = -1;
        const left = TextureShapeRaster.clamp((x - radius) | 0, TextureShapeRaster.clipMaxX, TextureShapeRaster.clipMinX);
        TextureShapeRaster.fillRow(left, arrayAtObj(TextureShapeRaster.raster, y), right, colour);
        if (radius > dx) {
            do {
                delta = (delta + 2) | 0;
                error = (error + delta) | 0;
                if (error > 0) {
                    dy = (dy - 1) | 0;
                    error = (error - (dy << 1)) | 0;
                    const bottom = (dy + y) | 0;
                    const top = (y - dy) | 0;
                    if (bottom >= TextureShapeRaster.clipTop && top <= TextureShapeRaster.clipMaxY) {
                        const spanRight = TextureShapeRaster.clamp((dx + x) | 0, TextureShapeRaster.clipMaxX, TextureShapeRaster.clipMinX);
                        const spanLeft = TextureShapeRaster.clamp((x - dx) | 0, TextureShapeRaster.clipMaxX, TextureShapeRaster.clipMinX);
                        if (bottom <= TextureShapeRaster.clipMaxY) {
                            TextureShapeRaster.fillRow(spanLeft, arrayAtObj(TextureShapeRaster.raster, bottom), spanRight, colour);
                        }
                        if (TextureShapeRaster.clipTop <= top) {
                            TextureShapeRaster.fillRow(spanLeft, arrayAtObj(TextureShapeRaster.raster, top), spanRight, colour);
                        }
                    }
                }
                dx = (dx + 1) | 0;
                const nearTop = (y - dx) | 0;
                const nearBottom = (y + dx) | 0;
                if (TextureShapeRaster.clipTop <= nearBottom && TextureShapeRaster.clipMaxY >= nearTop) {
                    const farRight = TextureShapeRaster.clamp((x + dy) | 0, TextureShapeRaster.clipMaxX, TextureShapeRaster.clipMinX);
                    const farLeft = TextureShapeRaster.clamp((x - dy) | 0, TextureShapeRaster.clipMaxX, TextureShapeRaster.clipMinX);
                    if (TextureShapeRaster.clipMaxY >= nearBottom) {
                        TextureShapeRaster.fillRow(farLeft, arrayAtObj(TextureShapeRaster.raster, nearBottom), farRight, colour);
                    }
                    if (nearTop >= TextureShapeRaster.clipTop) {
                        TextureShapeRaster.fillRow(farLeft, arrayAtObj(TextureShapeRaster.raster, nearTop), farRight, colour);
                    }
                }
            } while (dy > dx);
        }
    }

    // bk.a(IIIIZ)V
    static fillCircleUnclipped(y: number, x: number, radius: number, colour: number): void {
        let dx = 0;
        TextureShapeRaster.fillRow((x - radius) | 0, arrayAtObj(TextureShapeRaster.raster, y), (radius + x) | 0, colour);
        let dy = radius;
        let error = -radius | 0;
        let delta = -1;
        if (dx < radius) {
            do {
                dx = (dx + 1) | 0;
                delta = (delta + 2) | 0;
                error = (error + delta) | 0;
                if (error >= 0) {
                    dy = (dy - 1) | 0;
                    error = (error - (dy << 1)) | 0;
                    const lowerOuterRow = arrayAtObj(TextureShapeRaster.raster, (dy + y) | 0);
                    const upperOuterRow = arrayAtObj(TextureShapeRaster.raster, (y - dy) | 0);
                    const left = (x - dx) | 0;
                    const right = (dx + x) | 0;
                    TextureShapeRaster.fillRow(left, lowerOuterRow, right, colour);
                    TextureShapeRaster.fillRow(left, upperOuterRow, right, colour);
                }
                const farRight = (x + dy) | 0;
                const lowerInnerRow = arrayAtObj(TextureShapeRaster.raster, (dx + y) | 0);
                const farLeft = (x - dy) | 0;
                const upperInnerRow = arrayAtObj(TextureShapeRaster.raster, (y - dx) | 0);
                TextureShapeRaster.fillRow(farLeft, lowerInnerRow, farRight, colour);
                TextureShapeRaster.fillRow(farLeft, upperInnerRow, farRight, colour);
            } while (dx < dy);
        }
    }

    // fe.a(IZ)V
    static ensureCircleScratch(length: number): void {
        if (TextureShapeRaster.circleWidths === null || requireNonNull(TextureShapeRaster.circleWidths).length < length) {
            TextureShapeRaster.circleWidths = new Int32Array(length);
        }
    }

    // gk.a(IIIIIII)V
    static drawRectOutline(right: number, top: number, thickness: number, left: number, bottom: number, colour: number): void {
        if (left >= TextureShapeRaster.clipMinX && TextureShapeRaster.clipMaxX >= right && top >= TextureShapeRaster.clipTop && TextureShapeRaster.clipMaxY >= bottom) {
            if (thickness === 1) {
                TextureShapeRaster.drawRectUnclipped(top, colour, bottom, left, right);
            } else {
                TextureShapeRaster.drawRectOutlineThick(right, thickness, left, bottom, top, colour);
            }
        } else {
            if (thickness === 1) {
                TextureShapeRaster.drawRectClipped(right, left, top, bottom, colour);
            } else {
                TextureShapeRaster.drawRectOutlineThickClipped(left, top, thickness, colour, right, bottom);
            }
        }
    }

    // h.a(IIIIIII)V
    static drawRectOutlineThickClipped(left: number, top: number, thickness: number, colour: number, right: number, bottom: number): void {
        const clippedTop = TextureShapeRaster.clamp(top, TextureShapeRaster.clipMaxY, TextureShapeRaster.clipTop);
        const clippedBottom = TextureShapeRaster.clamp(bottom, TextureShapeRaster.clipMaxY, TextureShapeRaster.clipTop);
        const clippedLeft = TextureShapeRaster.clamp(left, TextureShapeRaster.clipMaxX, TextureShapeRaster.clipMinX);
        const clippedRight = TextureShapeRaster.clamp(right, TextureShapeRaster.clipMaxX, TextureShapeRaster.clipMinX);
        const innerTop = TextureShapeRaster.clamp((top + thickness) | 0, TextureShapeRaster.clipMaxY, TextureShapeRaster.clipTop);
        const innerBottom = TextureShapeRaster.clamp((bottom - thickness) | 0, TextureShapeRaster.clipMaxY, TextureShapeRaster.clipTop);
        let yTop = clippedTop;
        if (innerTop > clippedTop) {
            do {
                TextureShapeRaster.fillRow(clippedLeft, arrayAtObj(TextureShapeRaster.raster, yTop), clippedRight, colour);
            } while (innerTop > (yTop = (yTop + 1) | 0));
        }
        let yBottom = clippedBottom;
        while (innerBottom < yBottom) {
            TextureShapeRaster.fillRow(clippedLeft, arrayAtObj(TextureShapeRaster.raster, yBottom), clippedRight, colour);
            yBottom = (yBottom - 1) | 0;
        }
        const innerLeft = TextureShapeRaster.clamp((left + thickness) | 0, TextureShapeRaster.clipMaxX, TextureShapeRaster.clipMinX);
        const innerRight = TextureShapeRaster.clamp((right - thickness) | 0, TextureShapeRaster.clipMaxX, TextureShapeRaster.clipMinX);
        let y = innerTop;
        if (innerBottom >= innerTop) {
            do {
                const row = arrayAtObj(TextureShapeRaster.raster, y);
                TextureShapeRaster.fillRow(clippedLeft, row, innerLeft, colour);
                TextureShapeRaster.fillRow(innerRight, row, clippedRight, colour);
            } while (innerBottom >= (y = (y + 1) | 0));
        }
    }

    // hi.a(IIIIIIII)V
    static drawEllipse(x: number, radiusY: number, y: number, border: number, thickness: number, fill: number, radiusX: number): void {
        if (radiusY === radiusX) {
            TextureShapeRaster.drawCircle(x, thickness, border, radiusX, y, fill);
        } else {
            if (TextureShapeRaster.clipMinX <= ((x - radiusX) | 0) && ((radiusX + x) | 0) <= TextureShapeRaster.clipMaxX && ((y - radiusY) | 0) >= TextureShapeRaster.clipTop && TextureShapeRaster.clipMaxY >= ((radiusY + y) | 0)) {
                TextureShapeRaster.drawEllipseUnclipped(x, radiusX, thickness, border, fill, radiusY, y);
            } else {
                TextureShapeRaster.drawEllipseClipped(y, thickness, border, x, radiusY, fill, radiusX);
            }
        }
    }

    // hl.a(IBIIIII)V
    static drawRectOutlineThick(right: number, thickness: number, left: number, bottom: number, top: number, colour: number): void {
        const innerTop = (top + thickness) | 0;
        const innerBottom = (bottom - thickness) | 0;
        const innerLeft = (left + thickness) | 0;
        const innerRight = (right - thickness) | 0;
        let yTop = top;
        if (innerTop > top) {
            do {
                TextureShapeRaster.fillRow(left, arrayAtObj(TextureShapeRaster.raster, yTop), right, colour);
            } while (innerTop > (yTop = (yTop + 1) | 0));
        }
        let yBottom = bottom;
        while (yBottom > innerBottom) {
            TextureShapeRaster.fillRow(left, arrayAtObj(TextureShapeRaster.raster, yBottom), right, colour);
            yBottom = (yBottom - 1) | 0;
        }
        let y = innerTop;
        if (innerBottom >= innerTop) {
            do {
                const row = arrayAtObj(TextureShapeRaster.raster, y);
                TextureShapeRaster.fillRow(left, row, innerLeft, colour);
                TextureShapeRaster.fillRow(innerRight, row, right, colour);
            } while (innerBottom >= (y = (y + 1) | 0));
        }
    }

    // ic.a(II[III)V
    static fillRow(start: number, row: Int32Array | null, end: number, colour: number): void {
        const blockLimit = (-7 + (end = (end - 1) | 0)) | 0;
        start = (start - 1) | 0;
        while (start < blockLimit) {
            start = (start + 1) | 0;
            arrayPutI32(row, start, colour);
            start = (start + 1) | 0;
            arrayPutI32(row, start, colour);
            start = (start + 1) | 0;
            arrayPutI32(row, start, colour);
            start = (start + 1) | 0;
            arrayPutI32(row, start, colour);
            start = (start + 1) | 0;
            arrayPutI32(row, start, colour);
            start = (start + 1) | 0;
            arrayPutI32(row, start, colour);
            start = (start + 1) | 0;
            arrayPutI32(row, start, colour);
            start = (start + 1) | 0;
            arrayPutI32(row, start, colour);
        }
        while (end > start) {
            start = (start + 1) | 0;
            arrayPutI32(row, start, colour);
        }
    }

    // jg.a(IIBIII)V
    static fillRectUnclipped(right: number, top: number, colour: number, bottom: number, left: number): void {
        let y = top;
        if (top <= bottom) {
            do {
                TextureShapeRaster.fillRow(left, arrayAtObj(TextureShapeRaster.raster, y), right, colour);
            } while ((y = (y + 1) | 0) <= bottom);
        }
    }

    // kh.a(IIIIB)V
    static setClip(maxX: number, top: number, minX: number, maxY: number): void {
        TextureShapeRaster.clipTop = top;
        TextureShapeRaster.clipMinX = minX;
        TextureShapeRaster.clipMaxX = maxX;
        TextureShapeRaster.clipMaxY = maxY;
    }

    // la.a(IIIIII)V
    static fillEllipseUnclipped(colour: number, x: number, radiusX: number, radiusY: number, y: number): void {
        TextureShapeRaster.fillRow((x - radiusX) | 0, arrayAtObj(TextureShapeRaster.raster, y), (x + radiusX) | 0, colour);
        let span = 0;
        let offsetY = radiusY;
        const xSquared = Math.imul(radiusX, radiusX);
        const ySquared = Math.imul(radiusY, radiusY);
        const twiceYSquared = ySquared << 1;
        const diameterY = radiusY << 1;
        const twiceXSquared = xSquared << 1;
        let errorY = (ySquared - Math.imul(twiceXSquared, (-1 + diameterY) | 0)) | 0;
        let errorX = (Math.imul((1 - diameterY) | 0, xSquared) + twiceYSquared) | 0;
        const fourXSquared = xSquared << 2;
        const fourYSquared = ySquared << 2;
        let xStep = Math.imul(twiceYSquared, (3 + (span << 1)) | 0);
        let yStep = Math.imul(twiceXSquared, ((radiusY << 1) - 3) | 0);
        let xGradient = Math.imul(fourYSquared, (span + 1) | 0);
        let yGradient = Math.imul(fourXSquared, (radiusY - 1) | 0);
        if (radiusY > 0) {
            do {
                if (errorX < 0 && errorX < 0) {
                    do {
                        errorX = (errorX + xStep) | 0;
                        span = (span + 1) | 0;
                        xStep = (xStep + fourYSquared) | 0;
                        errorY = (errorY + xGradient) | 0;
                        xGradient = (xGradient + fourYSquared) | 0;
                    } while (errorX < 0);
                }
                const top = (y - (offsetY = (offsetY - 1) | 0)) | 0;
                const bottom = (offsetY + y) | 0;
                if (errorY < 0) {
                    span = (span + 1) | 0;
                    errorY = (errorY + xGradient) | 0;
                    errorX = (errorX + xStep) | 0;
                    xStep = (xStep + fourYSquared) | 0;
                    xGradient = (xGradient + fourYSquared) | 0;
                }
                errorY = (errorY - yStep) | 0;
                errorX = (errorX - yGradient) | 0;
                yStep = (yStep - fourXSquared) | 0;
                const right = (x + span) | 0;
                const left = (x - span) | 0;
                yGradient = (yGradient - fourXSquared) | 0;
                TextureShapeRaster.fillRow(left, arrayAtObj(TextureShapeRaster.raster, top), right, colour);
                TextureShapeRaster.fillRow(left, arrayAtObj(TextureShapeRaster.raster, bottom), right, colour);
            } while (offsetY > 0);
        }
    }

    // lk.a(IIIII)V
    static fillSpan(y1: number, y0: number, x: number, colour: number): void {
        const start = Math.min(y0, y1),
            end = Math.max(y0, y1);
        for (let y = start; y < end; y++) arrayPutI32(arrayAtObj(TextureShapeRaster.raster, y), x, colour);
    }

    // ll.a(IBIIII)V
    static drawRectClipped(right: number, left: number, top: number, bottom: number, colour: number): void {
        if (top > TextureShapeRaster.clipMaxY || bottom < TextureShapeRaster.clipTop) return;
        let drawLeft = true,
            drawRight = true;
        if (left < TextureShapeRaster.clipMinX) {
            left = TextureShapeRaster.clipMinX;
            drawLeft = false;
        } else if (left > TextureShapeRaster.clipMaxX) {
            left = TextureShapeRaster.clipMaxX;
            drawLeft = false;
        }
        if (right < TextureShapeRaster.clipMinX) {
            right = TextureShapeRaster.clipMinX;
            drawRight = false;
        } else if (right > TextureShapeRaster.clipMaxX) {
            right = TextureShapeRaster.clipMaxX;
            drawRight = false;
        }
        if (top >= TextureShapeRaster.clipTop) {
            TextureShapeRaster.fillRow(left, arrayAtObj(TextureShapeRaster.raster, top), right, colour);
            top = (top + 1) | 0;
        } else top = TextureShapeRaster.clipTop;
        if (bottom <= TextureShapeRaster.clipMaxY) {
            TextureShapeRaster.fillRow(left, arrayAtObj(TextureShapeRaster.raster, bottom), right, colour);
            bottom = (bottom - 1) | 0;
        } else bottom = TextureShapeRaster.clipMaxY;
        if (!drawLeft && !drawRight) return;
        for (let y = top; y <= bottom; y = (y + 1) | 0) {
            const row = arrayAtObj(TextureShapeRaster.raster, y);
            if (drawRight) arrayPutI32(row, right, colour);
            if (drawLeft) arrayPutI32(row, left, colour);
        }
    }

    // mc.a(IIIIIII)V
    static drawCircle(x: number, thickness: number, border: number, radius: number, y: number, fill: number): void {
        if (((x - radius) | 0) < TextureShapeRaster.clipMinX || TextureShapeRaster.clipMaxX < ((x + radius) | 0) || TextureShapeRaster.clipTop > ((y - radius) | 0) || TextureShapeRaster.clipMaxY < ((radius + y) | 0)) {
            TextureShapeRaster.fillCircleOutlinedClipped(thickness, border, radius, x, fill, y);
            return;
        }
        TextureShapeRaster.fillOutlinedCircleUnclipped(border, x, radius, thickness, fill, y);
    }

    // oe.a(IIIIII)V
    static drawRectUnclipped(top: number, colour: number, bottom: number, left: number, right: number): void {
        TextureShapeRaster.fillRow(left, arrayAtObj(TextureShapeRaster.raster, top), right, colour);
        top = (top + 1) | 0;
        TextureShapeRaster.fillRow(left, arrayAtObj(TextureShapeRaster.raster, bottom), right, colour);
        bottom = (bottom - 1) | 0;
        for (let y = top; y <= bottom; y = (y + 1) | 0) {
            const row = arrayAtObj(TextureShapeRaster.raster, y);
            arrayPutI32(row, right, colour);
            arrayPutI32(row, left, colour);
        }
    }

    // pi.a(IBIIIIII)V
    static fillRectOutlinedClipped(right: number, border: number, bottom: number, thickness: number, top: number, left: number, fill: number): void {
        const clippedTop = TextureShapeRaster.clamp(top, TextureShapeRaster.clipMaxY, TextureShapeRaster.clipTop);
        const clippedBottom = TextureShapeRaster.clamp(bottom, TextureShapeRaster.clipMaxY, TextureShapeRaster.clipTop);
        const clippedLeft = TextureShapeRaster.clamp(left, TextureShapeRaster.clipMaxX, TextureShapeRaster.clipMinX);
        const clippedRight = TextureShapeRaster.clamp(right, TextureShapeRaster.clipMaxX, TextureShapeRaster.clipMinX);
        const innerTop = TextureShapeRaster.clamp((thickness + top) | 0, TextureShapeRaster.clipMaxY, TextureShapeRaster.clipTop);
        const innerBottom = TextureShapeRaster.clamp((bottom - thickness) | 0, TextureShapeRaster.clipMaxY, TextureShapeRaster.clipTop);
        let yTop = clippedTop;
        while (innerTop > yTop) {
            TextureShapeRaster.fillRow(clippedLeft, arrayAtObj(TextureShapeRaster.raster, yTop), clippedRight, border);
            yTop = (yTop + 1) | 0;
        }
        let yBottom = clippedBottom;
        if (clippedBottom > innerBottom) {
            do {
                TextureShapeRaster.fillRow(clippedLeft, arrayAtObj(TextureShapeRaster.raster, yBottom), clippedRight, border);
            } while ((yBottom = (yBottom - 1) | 0) > innerBottom);
        }
        const innerLeft = TextureShapeRaster.clamp((thickness + left) | 0, TextureShapeRaster.clipMaxX, TextureShapeRaster.clipMinX);
        const innerRight = TextureShapeRaster.clamp((right - thickness) | 0, TextureShapeRaster.clipMaxX, TextureShapeRaster.clipMinX);
        let y = innerTop;
        if (innerTop <= innerBottom) {
            do {
                const row = arrayAtObj(TextureShapeRaster.raster, y);
                TextureShapeRaster.fillRow(clippedLeft, row, innerLeft, border);
                TextureShapeRaster.fillRow(innerLeft, row, innerRight, fill);
                TextureShapeRaster.fillRow(innerRight, row, clippedRight, border);
            } while ((y = (y + 1) | 0) <= innerBottom);
        }
    }

    // qc.a(IIIIBI)V
    static fillRectClipped(left: number, top: number, right: number, bottom: number, colour: number): void {
        const clippedTop = TextureShapeRaster.clamp(top, TextureShapeRaster.clipMaxY, TextureShapeRaster.clipTop);
        const clippedBottom = TextureShapeRaster.clamp(bottom, TextureShapeRaster.clipMaxY, TextureShapeRaster.clipTop);
        const clippedLeft = TextureShapeRaster.clamp(left, TextureShapeRaster.clipMaxX, TextureShapeRaster.clipMinX);
        const clippedRight = TextureShapeRaster.clamp(right, TextureShapeRaster.clipMaxX, TextureShapeRaster.clipMinX);
        let y = clippedTop;
        if (clippedTop <= clippedBottom) {
            do {
                TextureShapeRaster.fillRow(clippedLeft, arrayAtObj(TextureShapeRaster.raster, y), clippedRight, colour);
            } while ((y = (y + 1) | 0) <= clippedBottom);
        }
    }

    // qj.a(I[[I)V
    static bindCanvas(pixels: (Int32Array | null)[] | null): void {
        TextureShapeRaster.raster = pixels;
    }

    // t.a(IBIII)V
    static hline(colour: number, y: number, x0: number, x1: number): void {
        if (y >= TextureShapeRaster.clipTop && TextureShapeRaster.clipMaxY >= y) {
            x0 = TextureShapeRaster.clamp(x0, TextureShapeRaster.clipMaxX, TextureShapeRaster.clipMinX);
            x1 = TextureShapeRaster.clamp(x1, TextureShapeRaster.clipMaxX, TextureShapeRaster.clipMinX);
            TextureShapeRaster.drawHorizontalLine(y, x1, x0, colour);
        }
    }

    // tb.a(IIIIIZI)V
    static fillOutlinedCircleUnclipped(border: number, x: number, radius: number, thickness: number, fill: number, y: number): void {
        let dy = radius;
        let dx = 0;
        let innerRadius = (radius - thickness) | 0;
        TextureShapeRaster.ensureCircleScratch(radius);
        let innerDelta = -1;
        if (innerRadius < 0) {
            innerRadius = 0;
        }
        let outerError = -radius | 0;
        let innerSpan = innerRadius;
        let innerError = -innerRadius | 0;
        let outerDelta = -1;
        const centreRow = arrayAtObj(TextureShapeRaster.raster, y);
        const centreInnerLeft = (x - innerRadius) | 0;
        const centreInnerRight = (x + innerRadius) | 0;
        TextureShapeRaster.fillRow((x - radius) | 0, centreRow, centreInnerLeft, border);
        TextureShapeRaster.fillRow(centreInnerLeft, centreRow, centreInnerRight, fill);
        TextureShapeRaster.fillRow(centreInnerRight, centreRow, (x + radius) | 0, border);
        if (dx < radius) {
            do {
                outerDelta = (outerDelta + 2) | 0;
                innerDelta = (innerDelta + 2) | 0;
                innerError = (innerError + innerDelta) | 0;
                outerError = (outerError + outerDelta) | 0;
                if (innerError >= 0 && innerSpan >= 1) {
                    arrayPutI32(TextureShapeRaster.circleWidths, innerSpan, dx);
                    innerSpan = (innerSpan - 1) | 0;
                    innerError = (innerError - (innerSpan << 1)) | 0;
                }
                dx = (dx + 1) | 0;
                if (outerError >= 0) {
                    if (innerRadius <= (dy = (dy - 1) | 0)) {
                        const lowerCap = arrayAtObj(TextureShapeRaster.raster, (dy + y) | 0);
                        const upperCap = arrayAtObj(TextureShapeRaster.raster, (y - dy) | 0);
                        const capRight = (dx + x) | 0;
                        const capLeft = (x - dx) | 0;
                        TextureShapeRaster.fillRow(capLeft, lowerCap, capRight, border);
                        TextureShapeRaster.fillRow(capLeft, upperCap, capRight, border);
                        outerError = (outerError - (dy << 1)) | 0;
                    } else {
                        const lowerBand = arrayAtObj(TextureShapeRaster.raster, (y + dy) | 0);
                        const bandRight = (x + dx) | 0;
                        const bandLeft = (x - dx) | 0;
                        const capInnerSpan = arrayAtI32(TextureShapeRaster.circleWidths, dy);
                        const innerLeft = (x - capInnerSpan) | 0;
                        const upperBand = arrayAtObj(TextureShapeRaster.raster, (y - dy) | 0);
                        const innerRight = (x + capInnerSpan) | 0;
                        TextureShapeRaster.fillRow(bandLeft, lowerBand, innerLeft, border);
                        TextureShapeRaster.fillRow(innerLeft, lowerBand, innerRight, fill);
                        TextureShapeRaster.fillRow(innerRight, lowerBand, bandRight, border);
                        TextureShapeRaster.fillRow(bandLeft, upperBand, innerLeft, border);
                        TextureShapeRaster.fillRow(innerLeft, upperBand, innerRight, fill);
                        TextureShapeRaster.fillRow(innerRight, upperBand, bandRight, border);
                        outerError = (outerError - (dy << 1)) | 0;
                    }
                }
                const lowerRow = arrayAtObj(TextureShapeRaster.raster, (dx + y) | 0);
                const upperRow = arrayAtObj(TextureShapeRaster.raster, (y - dx) | 0);
                const right = (x + dy) | 0;
                const left = (x - dy) | 0;
                if (innerRadius <= dx) {
                    TextureShapeRaster.fillRow(left, lowerRow, right, border);
                    TextureShapeRaster.fillRow(left, upperRow, right, border);
                    continue;
                }
                const span = dx <= innerSpan ? innerSpan : arrayAtI32(TextureShapeRaster.circleWidths, dx);
                const fillRight = (x + span) | 0;
                const fillLeft = (x - span) | 0;
                TextureShapeRaster.fillRow(left, lowerRow, fillLeft, border);
                TextureShapeRaster.fillRow(fillLeft, lowerRow, fillRight, fill);
                TextureShapeRaster.fillRow(fillRight, lowerRow, right, border);
                TextureShapeRaster.fillRow(left, upperRow, fillLeft, border);
                TextureShapeRaster.fillRow(fillLeft, upperRow, fillRight, fill);
                TextureShapeRaster.fillRow(fillRight, upperRow, right, border);
            } while (dx < dy);
        }
    }

    // tb.a(IIIBII)V
    static fillRect(left: number, bottom: number, top: number, right: number, colour: number): void {
        if (left >= TextureShapeRaster.clipMinX && right <= TextureShapeRaster.clipMaxX && top >= TextureShapeRaster.clipTop && TextureShapeRaster.clipMaxY >= bottom) {
            TextureShapeRaster.fillRectUnclipped(right, top, colour, bottom, left);
        } else {
            TextureShapeRaster.fillRectClipped(left, top, right, bottom, colour);
        }
    }

    // ui.a(IIIIIII)V
    static fillCircleOutlinedClipped(thickness: number, border: number, radius: number, x: number, fill: number, y: number): void {
        TextureShapeRaster.ensureCircleScratch(radius);
        let dx = 0;
        let innerRadius = (radius - thickness) | 0;
        let outerError = -radius | 0;
        let dy = radius;
        if (innerRadius < 0) {
            innerRadius = 0;
        }
        let innerSpan = innerRadius;
        let innerError = -innerRadius | 0;
        if (y >= TextureShapeRaster.clipTop && TextureShapeRaster.clipMaxY >= y) {
            const centreRow = arrayAtObj(TextureShapeRaster.raster, y);
            const centreLeft = TextureShapeRaster.clamp((x - radius) | 0, TextureShapeRaster.clipMaxX, TextureShapeRaster.clipMinX);
            const centreRight = TextureShapeRaster.clamp((radius + x) | 0, TextureShapeRaster.clipMaxX, TextureShapeRaster.clipMinX);
            const centreInnerLeft = TextureShapeRaster.clamp((x - innerRadius) | 0, TextureShapeRaster.clipMaxX, TextureShapeRaster.clipMinX);
            const centreInnerRight = TextureShapeRaster.clamp((x + innerRadius) | 0, TextureShapeRaster.clipMaxX, TextureShapeRaster.clipMinX);
            TextureShapeRaster.fillRow(centreLeft, centreRow, centreInnerLeft, border);
            TextureShapeRaster.fillRow(centreInnerLeft, centreRow, centreInnerRight, fill);
            TextureShapeRaster.fillRow(centreInnerRight, centreRow, centreRight, border);
        }
        let outerDelta = -1;
        let innerDelta = -1;
        while (dy > dx) {
            innerDelta = (innerDelta + 2) | 0;
            outerDelta = (outerDelta + 2) | 0;
            outerError = (outerError + outerDelta) | 0;
            innerError = (innerError + innerDelta) | 0;
            if (innerError >= 0 && innerSpan >= 1) {
                innerSpan = (innerSpan - 1) | 0;
                arrayPutI32(TextureShapeRaster.circleWidths, innerSpan, dx);
                innerError = (innerError - (innerSpan << 1)) | 0;
            }
            dx = (dx + 1) | 0;
            if (outerError >= 0) {
                const capTop = (y - (dy = (dy - 1) | 0)) | 0;
                outerError = (outerError - (dy << 1)) | 0;
                const capBottom = (dy + y) | 0;
                if (capBottom >= TextureShapeRaster.clipTop && TextureShapeRaster.clipMaxY >= capTop) {
                    if (dy < innerRadius) {
                        const capInnerSpan = arrayAtI32(TextureShapeRaster.circleWidths, dy);
                        const bandRight = TextureShapeRaster.clamp((x + dx) | 0, TextureShapeRaster.clipMaxX, TextureShapeRaster.clipMinX);
                        const bandLeft = TextureShapeRaster.clamp((x - dx) | 0, TextureShapeRaster.clipMaxX, TextureShapeRaster.clipMinX);
                        const bandInnerRight = TextureShapeRaster.clamp((x + capInnerSpan) | 0, TextureShapeRaster.clipMaxX, TextureShapeRaster.clipMinX);
                        const bandInnerLeft = TextureShapeRaster.clamp((x - capInnerSpan) | 0, TextureShapeRaster.clipMaxX, TextureShapeRaster.clipMinX);
                        if (capBottom <= TextureShapeRaster.clipMaxY) {
                            const lowerBand = arrayAtObj(TextureShapeRaster.raster, capBottom);
                            TextureShapeRaster.fillRow(bandLeft, lowerBand, bandInnerLeft, border);
                            TextureShapeRaster.fillRow(bandInnerLeft, lowerBand, bandInnerRight, fill);
                            TextureShapeRaster.fillRow(bandInnerRight, lowerBand, bandRight, border);
                        }
                        if (capTop >= TextureShapeRaster.clipTop) {
                            const upperBand = arrayAtObj(TextureShapeRaster.raster, capTop);
                            TextureShapeRaster.fillRow(bandLeft, upperBand, bandInnerLeft, border);
                            TextureShapeRaster.fillRow(bandInnerLeft, upperBand, bandInnerRight, fill);
                            TextureShapeRaster.fillRow(bandInnerRight, upperBand, bandRight, border);
                        }
                    } else {
                        const capRight = TextureShapeRaster.clamp((x + dx) | 0, TextureShapeRaster.clipMaxX, TextureShapeRaster.clipMinX);
                        const capLeft = TextureShapeRaster.clamp((x - dx) | 0, TextureShapeRaster.clipMaxX, TextureShapeRaster.clipMinX);
                        if (TextureShapeRaster.clipMaxY >= capBottom) {
                            TextureShapeRaster.fillRow(capLeft, arrayAtObj(TextureShapeRaster.raster, capBottom), capRight, border);
                        }
                        if (TextureShapeRaster.clipTop <= capTop) {
                            TextureShapeRaster.fillRow(capLeft, arrayAtObj(TextureShapeRaster.raster, capTop), capRight, border);
                        }
                    }
                }
            }
            const top = (y - dx) | 0;
            const bottom = (y + dx) | 0;
            if (bottom >= TextureShapeRaster.clipTop && TextureShapeRaster.clipMaxY >= top) {
                let right = (x + dy) | 0;
                let left = (x - dy) | 0;
                if (TextureShapeRaster.clipMinX <= right && left <= TextureShapeRaster.clipMaxX) {
                    right = TextureShapeRaster.clamp(right, TextureShapeRaster.clipMaxX, TextureShapeRaster.clipMinX);
                    left = TextureShapeRaster.clamp(left, TextureShapeRaster.clipMaxX, TextureShapeRaster.clipMinX);
                    if (innerRadius > dx) {
                        const span = dx <= innerSpan ? innerSpan : arrayAtI32(TextureShapeRaster.circleWidths, dx);
                        const innerRight = TextureShapeRaster.clamp((span + x) | 0, TextureShapeRaster.clipMaxX, TextureShapeRaster.clipMinX);
                        const innerLeft = TextureShapeRaster.clamp((x - span) | 0, TextureShapeRaster.clipMaxX, TextureShapeRaster.clipMinX);
                        if (bottom <= TextureShapeRaster.clipMaxY) {
                            const lowerRow = arrayAtObj(TextureShapeRaster.raster, bottom);
                            TextureShapeRaster.fillRow(left, lowerRow, innerLeft, border);
                            TextureShapeRaster.fillRow(innerLeft, lowerRow, innerRight, fill);
                            TextureShapeRaster.fillRow(innerRight, lowerRow, right, border);
                        }
                        if (TextureShapeRaster.clipTop <= top) {
                            const upperRow = arrayAtObj(TextureShapeRaster.raster, top);
                            TextureShapeRaster.fillRow(left, upperRow, innerLeft, border);
                            TextureShapeRaster.fillRow(innerLeft, upperRow, innerRight, fill);
                            TextureShapeRaster.fillRow(innerRight, upperRow, right, border);
                        }
                    } else {
                        if (bottom <= TextureShapeRaster.clipMaxY) {
                            TextureShapeRaster.fillRow(left, arrayAtObj(TextureShapeRaster.raster, bottom), right, border);
                        }
                        if (top >= TextureShapeRaster.clipTop) {
                            TextureShapeRaster.fillRow(left, arrayAtObj(TextureShapeRaster.raster, top), right, border);
                        }
                    }
                }
            }
        }
    }

    // va.a(IIBII)V
    static drawVerticalLineClipped(y1: number, y0: number, colour: number, x: number): void {
        if (TextureShapeRaster.clipMinX <= x && x <= TextureShapeRaster.clipMaxX) {
            y0 = TextureShapeRaster.clamp(y0, TextureShapeRaster.clipMaxY, TextureShapeRaster.clipTop);
            y1 = TextureShapeRaster.clamp(y1, TextureShapeRaster.clipMaxY, TextureShapeRaster.clipTop);
            TextureShapeRaster.fillSpan(y1, y0, x, colour);
        }
    }

    // vi.a(IIIIIIZI)V
    static fillRectBordered(border: number, right: number, bottom: number, fill: number, thickness: number, top: number, left: number): void {
        if (TextureShapeRaster.clipMinX > left || right > TextureShapeRaster.clipMaxX || top < TextureShapeRaster.clipTop || bottom > TextureShapeRaster.clipMaxY) {
            TextureShapeRaster.fillRectOutlinedClipped(right, border, bottom, thickness, top, left, fill);
            return;
        }
        TextureShapeRaster.fillRectWithBorder(right, bottom, border, top, fill, thickness, left);
    }

    // wf.a(IIBII)V
    static fillCircle(colour: number, x: number, y: number, radius: number): void {
        if (((x - radius) | 0) < TextureShapeRaster.clipMinX || ((x + radius) | 0) > TextureShapeRaster.clipMaxX || TextureShapeRaster.clipTop > ((y - radius) | 0) || ((y + radius) | 0) > TextureShapeRaster.clipMaxY) {
            TextureShapeRaster.fillCircleClipped(y, radius, x, colour);
            return;
        }
        TextureShapeRaster.fillCircleUnclipped(y, x, radius, colour);
    }

    // wg.a(IZIIIIII)V
    static fillRectWithBorder(right: number, bottom: number, border: number, top: number, fill: number, thickness: number, left: number): void {
        const innerTop = (thickness + top) | 0;
        const innerBottom = (bottom - thickness) | 0;
        const innerRight = (right - thickness) | 0;
        let yTop = top;
        while (innerTop > yTop) {
            TextureShapeRaster.fillRow(left, arrayAtObj(TextureShapeRaster.raster, yTop), right, border);
            yTop = (yTop + 1) | 0;
        }
        const innerLeft = (left + thickness) | 0;
        let yBottom = bottom;
        while (yBottom > innerBottom) {
            TextureShapeRaster.fillRow(left, arrayAtObj(TextureShapeRaster.raster, yBottom), right, border);
            yBottom = (yBottom - 1) | 0;
        }
        let y = innerTop;
        if (innerBottom >= innerTop) {
            do {
                const row = arrayAtObj(TextureShapeRaster.raster, y);
                TextureShapeRaster.fillRow(left, row, innerLeft, border);
                TextureShapeRaster.fillRow(innerLeft, row, innerRight, fill);
                TextureShapeRaster.fillRow(innerRight, row, right, border);
            } while (innerBottom >= (y = (y + 1) | 0));
        }
    }
}
