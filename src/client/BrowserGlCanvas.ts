/// <reference types="@webgpu/types" />
import type { GlCanvas } from '#/gl/GlRenderer';
import { releasePresenter } from '#/gl/driver/Presenter';
import { canvasContentBounds } from './CanvasContentBounds';

// Browser host for tf's AWT drawable. The existing canvas keeps its 2D context and owns mouse and keyboard input.
export default class BrowserGlCanvas implements GlCanvas {
    private readonly surface: HTMLCanvasElement;
    private input: HTMLCanvasElement;
    private resize: ResizeObserver | null = null;
    private mutation: MutationObserver | null = null;
    private context: GPUCanvasContext | null = null;
    private disposed = false;

    constructor(input: HTMLCanvasElement) {
        this.input = input;
        this.surface = input.ownerDocument.createElement('canvas');
        this.surface.setAttribute('aria-hidden', 'true');
        this.surface.inert = true;
        this.surface.style.cssText = 'all:initial;position:absolute;display:block;box-sizing:content-box;left:0;top:0;width:1px;height:1px;pointer-events:none';
        this.observe();
        this.sync();
    }

    isDisplayable(): boolean {
        return !this.disposed && this.input.isConnected && this.surface.isConnected;
    }

    getSize(): { width: number; height: number } {
        return { width: this.getWidth(), height: this.getHeight() };
    }

    // Each draw queries the window dimensions. Read only the requested backing dimension.
    getWidth(): number {
        const width = this.input.width;
        if (!this.disposed && this.surface.width !== width) this.surface.width = width;
        return width;
    }

    getHeight(): number {
        const height = this.input.height;
        if (!this.disposed && this.surface.height !== height) this.surface.height = height;
        return height;
    }

    getContext(kind: 'webgpu'): GPUCanvasContext | null {
        if (!this.isDisplayable()) return null;
        this.context ??= this.surface.getContext(kind);
        return this.context;
    }

    setInput(input: HTMLCanvasElement): void {
        if (this.disposed || this.input === input) return;
        this.unobserve();
        this.input = input;
        this.observe();
        this.sync();
    }

    private observe(): void {
        const view = this.input.ownerDocument.defaultView;
        if (!view) return;
        view.addEventListener('resize', this.sync);
        view.addEventListener('scroll', this.sync, true);
        if (typeof ResizeObserver !== 'undefined') this.resize = new ResizeObserver(this.sync);
        if (typeof MutationObserver !== 'undefined') this.mutation = new MutationObserver(this.sync);
        for (let node: HTMLElement | null = this.input; node !== null; node = node.parentElement) {
            this.resize?.observe(node);
            this.mutation?.observe(node, { attributes: true, childList: node === this.input.parentElement });
        }
    }

    private unobserve(): void {
        const view = this.input.ownerDocument.defaultView;
        view?.removeEventListener('resize', this.sync);
        view?.removeEventListener('scroll', this.sync, true);
        this.resize?.disconnect();
        this.mutation?.disconnect();
        this.resize = null;
        this.mutation = null;
    }

    readonly sync = (): void => {
        if (this.disposed) return;
        const input = this.input;
        const surface = this.surface;
        const view = input.ownerDocument.defaultView;
        if (!view || !input.isConnected) {
            surface.remove();
            return;
        }
        if (input.nextSibling !== surface) input.after(surface);
        this.getWidth();
        this.getHeight();

        const css = view.getComputedStyle(input);
        const style = surface.style;
        if (style.zIndex !== css.zIndex) style.zIndex = css.zIndex;
        if (style.visibility !== css.visibility) style.visibility = css.visibility;
        const bounds = canvasContentBounds(input, css);

        // Both elements share their ancestor transforms and scroll containers. Measure the surface's actual origin
        // so this also works when its CSS containing block is further up the tree than its immediate parent.
        const current = surface.getBoundingClientRect();
        const width = parseFloat(style.width);
        const height = parseFloat(style.height);
        const parentScaleX = width > 0 && current.width > 0 ? current.width / width : 1;
        const parentScaleY = height > 0 && current.height > 0 ? current.height / height : 1;
        const left = parseFloat(style.left) + (bounds.left - current.left) / parentScaleX;
        const top = parseFloat(style.top) + (bounds.top - current.top) / parentScaleY;
        const nextWidth = bounds.width / parentScaleX;
        const nextHeight = bounds.height / parentScaleY;
        if (Math.abs(parseFloat(style.left) - left) > 1 / 64) style.left = left + 'px';
        if (Math.abs(parseFloat(style.top) - top) > 1 / 64) style.top = top + 'px';
        if (Math.abs(width - nextWidth) > 1 / 64) style.width = nextWidth + 'px';
        if (Math.abs(height - nextHeight) > 1 / 64) style.height = nextHeight + 'px';

        // An absolute element escapes the overflow clips between its parent and its containing block. Restore
        // those clips without positioning the host's ancestors or changing the layout of their other children.
        const x = bounds.left;
        const y = bounds.top;
        let clipLeft = 0,
            clipRight = 0,
            clipTop = 0,
            clipBottom = 0;
        const containingBlock = surface.offsetParent;
        for (let node = input.parentElement; node && node !== containingBlock; node = node.parentElement) {
            const rule = view.getComputedStyle(node);
            if (rule.overflowX === 'visible' && rule.overflowY === 'visible') continue;
            const rect = node.getBoundingClientRect();
            if (rule.overflowX !== 'visible' && node.offsetWidth > 0) {
                const scale = rect.width / node.offsetWidth;
                const start = rect.left + node.clientLeft * scale;
                clipLeft = Math.max(clipLeft, (start - x) / parentScaleX);
                clipRight = Math.max(clipRight, nextWidth - (start + node.clientWidth * scale - x) / parentScaleX);
            }
            if (rule.overflowY !== 'visible' && node.offsetHeight > 0) {
                const scale = rect.height / node.offsetHeight;
                const start = rect.top + node.clientTop * scale;
                clipTop = Math.max(clipTop, (start - y) / parentScaleY);
                clipBottom = Math.max(clipBottom, nextHeight - (start + node.clientHeight * scale - y) / parentScaleY);
            }
        }
        const clip = clipLeft || clipRight || clipTop || clipBottom ? 'inset(' + [clipTop, clipRight, clipBottom, clipLeft].join('px ') + 'px)' : 'none';
        if (style.clipPath !== clip) style.clipPath = clip;
    };

    dispose(): void {
        if (this.disposed) return;
        this.disposed = true;
        this.unobserve();
        releasePresenter(this);
        this.context?.unconfigure();
        this.context = null;
        this.surface.remove();
    }
}
