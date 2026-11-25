// Browser pointer coordinates and the GPU surface share this displayed rectangle. Canvas pixels
// occupy the content box, inside any transformed CSS border and padding.
export function canvasContentBounds(
    canvas: HTMLCanvasElement,
    css = getComputedStyle(canvas)
): {
    left: number;
    top: number;
    width: number;
    height: number;
} {
    const bounds = canvas.getBoundingClientRect();
    const left = parseFloat(css.borderLeftWidth) + parseFloat(css.paddingLeft);
    const top = parseFloat(css.borderTopWidth) + parseFloat(css.paddingTop);
    const horizontal = left + parseFloat(css.borderRightWidth) + parseFloat(css.paddingRight);
    const vertical = top + parseFloat(css.borderBottomWidth) + parseFloat(css.paddingBottom);
    if (horizontal === 0 && vertical === 0) return bounds;
    const borderBox = css.boxSizing === 'border-box';
    const boxWidth = parseFloat(css.width) + (borderBox ? 0 : horizontal);
    const boxHeight = parseFloat(css.height) + (borderBox ? 0 : vertical);
    const scaleX = boxWidth > 0 ? bounds.width / boxWidth : 1;
    const scaleY = boxHeight > 0 ? bounds.height / boxHeight : 1;
    return {
        left: bounds.left + left * scaleX,
        top: bounds.top + top * scaleY,
        width: Math.max(0, bounds.width - horizontal * scaleX),
        height: Math.max(0, bounds.height - vertical * scaleY)
    };
}
