type Viewport = [number, number, number, number, number, number];
type Scissor = [number, number, number, number];

// WebGPU keeps viewport and scissor on the pass, outside the native bundles.
export default class RecordedRenderBundles {
    private readonly segments: { viewport?: Viewport; scissor?: Scissor; bundles: GPURenderBundle[] }[] = [];
    readonly bundles: GPURenderBundle[] = [];
    private viewportWord = -1;
    private scissorWord = -1;

    add(bundle: GPURenderBundle, words: number[], v: number, s: number): void {
        this.bundles.push(bundle);
        const previous = this.segments[this.segments.length - 1];
        if (previous && v === this.viewportWord && s === this.scissorWord) {
            previous.bundles.push(bundle);
            return;
        }
        const viewport: Viewport | undefined = v === this.viewportWord ? previous?.viewport : [words[v], words[v + 1], words[v + 2], words[v + 3], words[v + 4], words[v + 5]];
        const scissor: Scissor | undefined = s === this.scissorWord ? previous?.scissor : [words[s], words[s + 1], words[s + 2], words[s + 3]];
        this.viewportWord = v;
        this.scissorWord = s;
        this.segments.push({ viewport, scissor, bundles: [bundle] });
    }

    execute(pass: GPURenderPassEncoder): void {
        let viewport: Viewport | undefined, scissor: Scissor | undefined;
        for (const segment of this.segments) {
            if (segment.viewport && viewport !== segment.viewport) pass.setViewport(...(viewport = segment.viewport));
            if (segment.scissor && scissor !== segment.scissor) pass.setScissorRect(...(scissor = segment.scissor));
            pass.executeBundles(segment.bundles);
        }
    }
}
