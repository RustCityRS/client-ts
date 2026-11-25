import type PresentationCamera from './PresentationCamera';

/** Projection data for the sprites attached to actors or world coordinates in one HD viewport. */
export default class ProjectedOverlays {
    // Captured eye.xyz, focal lengths, local scissor and the Java sprite anchor in NDC.
    readonly data = new Float32Array(11);
    readonly bytes = new Uint8Array(this.data.buffer);
    private readonly chat: Float32Array[] = [];
    revision = 0;
    x = 0;
    y = 0;
    width = 0;
    height = 0;
    private pixelX = 0;
    private pixelY = 0;
    private centerX = 0;
    private centerY = 0;

    constructor(
        readonly camera: GPUBuffer,
        private readonly view: PresentationCamera
    ) {}

    begin(left: number, top: number, width: number, height: number, surfaceWidth: number, surfaceHeight: number, projection: Float32Array): void {
        this.x = Math.max(0, left);
        this.y = Math.max(0, top);
        this.width = Math.max(0, Math.min(surfaceWidth, left + width) - this.x);
        this.height = Math.max(0, Math.min(surfaceHeight, top + height) - this.y);
        this.pixelX = 2 / surfaceWidth;
        this.pixelY = 2 / surfaceHeight;
        this.data[3] = (projection[0] * width) / surfaceWidth;
        this.data[4] = (projection[5] * height) / surfaceHeight;
        this.centerX = ((1 - projection[8]) * width) / 2;
        this.centerY = ((1 + projection[9]) * height) / 2;
        this.revision++;
    }

    anchor(x: number, y: number, z: number, screenX: number, screenY: number): void {
        this.view.sourceEye(this.data, x, y, z);
        this.data[9] = (screenX - this.centerX) * this.pixelX;
        this.data[10] = (this.centerY - screenY) * this.pixelY;
        this.clip();
    }

    // The health bar and scrolling chat have a clip that travels with the anchor.
    // The scene boundary remains a hardware scissor fixed to the viewport.
    clip(left = -1e8, top = -1e8, right = 1e8, bottom = 1e8): void {
        this.data[5] = left * this.pixelX - 1;
        this.data[6] = 1 - bottom * this.pixelY;
        this.data[7] = right * this.pixelX - 1;
        this.data[8] = 1 - top * this.pixelY;
        this.revision++;
    }

    saveChat(index: number): void {
        (this.chat[index] ??= new Float32Array(this.data.length)).set(this.data);
    }

    selectChat(index: number): void {
        this.data.set(this.chat[index]);
        this.revision++;
    }
}
