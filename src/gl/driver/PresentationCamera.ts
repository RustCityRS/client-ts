import PresentationOrbit, { type FollowCamera } from './PresentationOrbit';

// Rotation used by GlRenderer.setCamera, in row-major order.
function rotation(out: Float64Array, pitch: number, yaw: number): void {
    const radians = Math.PI / 180;
    const cp = Math.cos((180 + pitch) * radians);
    const sp = Math.sin((180 + pitch) * radians);
    const cy = Math.cos(yaw * radians);
    const sy = Math.sin(yaw * radians);
    out[0] = cy;
    out[1] = 0;
    out[2] = sy;
    out[3] = sp * sy;
    out[4] = cp;
    out[5] = -sp * cy;
    out[6] = -cp * sy;
    out[7] = sp;
    out[8] = cp * cy;
}

const identity = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);

export interface RenderEye {
    x: number;
    y: number;
    z: number;
    pitch: number;
    yaw: number;
}

export default class PresentationCamera {
    private static active: PresentationCamera | null = null;
    private static readonly clicked = new Float64Array(5);
    private static clickCycle = -1;
    static needsRepick = false;

    static rememberPress(menuOpen: () => boolean): void {
        const camera = this.active;
        if (!camera || camera.shownCycle < 0 || menuOpen()) return;
        this.clicked.set(camera.shownPose);
        this.clickCycle = camera.shownCycle;
        this.needsRepick = camera.shownOffset || camera.shownCycle !== camera.cycle;
    }

    static applyPickedView(eye: RenderEye, cycle: number): void {
        if (!this.active || this.clickCycle < 0 || cycle < this.clickCycle) return;
        eye.x = Math.round(this.clicked[0]);
        eye.y = Math.round(this.clicked[1]);
        eye.z = Math.round(this.clicked[2]);
        eye.pitch = Math.round(this.clicked[3] * (2048 / 360));
        eye.yaw = Math.round(this.clicked[4] * (2048 / 360)) & 2047;
    }

    readonly matrix = identity.slice();
    private readonly pose = new Float64Array(5);
    private readonly source = new Float64Array(5);
    private readonly displayPose = new Float64Array(5);
    private readonly shownPose = new Float64Array(5);
    private shownCycle = -1;
    private shownOffset = false;
    private readonly frontPose = new Float64Array(5);
    private frontCycle = -1;
    private frontOffset = false;
    private orbit: PresentationOrbit | null = null;
    private offset = false;
    private readonly velocity = new Float64Array(5);
    private readonly currentRotation = new Float64Array(9);
    private readonly displayRotation = new Float64Array(9);
    private cycle = -1;
    private time = 0;
    private moving = false;

    get canAdvance(): boolean {
        return this.orbit !== null || this.moving;
    }

    get hasViewOffset(): boolean {
        return this.offset;
    }

    get followsOrbit(): boolean {
        return this.orbit !== null;
    }

    captureFront(sampled: boolean): void {
        this.frontPose.set(sampled ? this.displayPose : this.source);
        this.frontCycle = this.cycle;
        this.frontOffset = sampled && this.offset;
    }

    markPresented(front: boolean): void {
        if (!this.orbit) return;
        this.shownPose.set(front ? this.frontPose : this.displayPose);
        this.shownCycle = front ? this.frontCycle : this.cycle;
        this.shownOffset = front ? this.frontOffset : this.offset;
    }

    get pitchDegrees(): number {
        return this.displayPose[3];
    }

    get yawDegrees(): number {
        return this.displayPose[4];
    }

    applyTo(eye: RenderEye): void {
        eye.x = Math.round(this.displayPose[0]);
        eye.y = Math.round(this.displayPose[1]);
        eye.z = Math.round(this.displayPose[2]);
        eye.pitch = Math.round(this.displayPose[3] * (2048 / 360));
        eye.yaw = Math.round(this.displayPose[4] * (2048 / 360)) & 2047;
    }

    setSource(x: number, y: number, z: number, pitch: number, yaw: number): void {
        this.source[0] = x;
        this.source[1] = y;
        this.source[2] = z;
        this.source[3] = pitch;
        this.source[4] = yaw;
        rotation(this.currentRotation, pitch, yaw);
        this.displayPose.set(this.source);
        this.matrix.set(identity);
        this.offset = false;
    }

    sourceEye(out: Float32Array, x: number, y: number, z: number): void {
        x -= this.source[0];
        y -= this.source[1];
        z -= this.source[2];
        const r = this.currentRotation;
        out[0] = r[0] * x + r[1] * y + r[2] * z;
        out[1] = r[3] * x + r[4] * y + r[5] * z;
        out[2] = r[6] * x + r[7] * y + r[8] * z;
    }

    reset(): void {
        if (PresentationCamera.active === this) {
            PresentationCamera.active = null;
            PresentationCamera.clickCycle = -1;
            PresentationCamera.needsRepick = false;
        }
        this.orbit = null;
        this.cycle = -1;
        this.shownCycle = -1;
        this.frontCycle = -1;
        this.moving = false;
        this.matrix.set(identity);
    }

    capture(x: number, y: number, z: number, pitch: number, yaw: number, cycle: number, time: number, follow?: FollowCamera): void {
        this.matrix.set(identity);
        this.offset = false;
        if (cycle === this.cycle && !!this.orbit === !!follow && x === this.pose[0] && y === this.pose[1] && z === this.pose[2] && pitch === this.pose[3] && yaw === this.pose[4]) {
            this.displayPose.set(this.pose);
            return;
        }
        const ticks = cycle - this.cycle;
        const v = this.velocity;
        v[0] = x - this.pose[0];
        v[1] = y - this.pose[1];
        v[2] = z - this.pose[2];
        v[3] = pitch - this.pose[3];
        v[4] = (yaw - this.pose[4]) % 360;
        if (v[4] > 180) v[4] -= 360;
        if (v[4] < -180) v[4] += 360;
        // A jump or a suspended tab supplies no reliable inter-tick velocity.
        const continuous = this.cycle >= 0 && ticks > 0 && ticks <= 4 && time - this.time <= 100 && Math.max(Math.abs(v[0]), Math.abs(v[1]), Math.abs(v[2])) <= 512 && Math.max(Math.abs(v[3]), Math.abs(v[4])) <= 45;
        this.moving = continuous && v.some(delta => delta !== 0);
        if (this.moving) for (let i = 0; i < v.length; i++) v[i] /= ticks;
        this.pose[0] = x;
        this.pose[1] = y;
        this.pose[2] = z;
        this.pose[3] = pitch;
        this.pose[4] = yaw;
        this.displayPose.set(this.pose);
        if (follow) {
            const elapsedTicks = this.orbit && continuous ? ticks : 0;
            this.orbit ??= new PresentationOrbit();
            this.orbit.capture(this.pose, follow, elapsedTicks, time);
            PresentationCamera.active = this;
        } else if (this.orbit) {
            this.orbit = null;
            PresentationCamera.active = null;
            PresentationCamera.needsRepick = false;
            PresentationCamera.clickCycle = -1;
        }
        this.setSource(x, y, z, pitch, yaw);
        this.cycle = cycle;
        this.time = time;
    }

    sample(time: number): Float32Array<ArrayBuffer> {
        // The browser's frame timestamp can precede the latest tick when input
        // and game tasks ran immediately before its animation-frame callbacks.
        const elapsed = Math.max(0, time - this.time);
        if (!this.canAdvance) {
            this.displayPose.set(this.pose);
            this.offset = false;
            this.matrix.set(identity);
            return this.matrix;
        }
        const display = this.displayPose;
        if (this.orbit) this.orbit.sample(display, Math.min(elapsed, 100));
        else {
            const t = Math.min(1, elapsed / 20);
            for (let i = 0; i < display.length; i++) display[i] = this.pose[i] + this.velocity[i] * t;
        }
        this.offset = display.some((n, i) => Math.abs(n - this.source[i]) > 0.00001);
        if (!this.offset) {
            this.matrix.set(identity);
            return this.matrix;
        }
        const current = this.currentRotation;
        const next = this.displayRotation;
        rotation(next, display[3], display[4]);
        // Convert the captured eye-space vertices to the new eye space:
        // R(next) * transpose(R(current)), plus R(next) * (currentPos - nextPos).
        for (let row = 0; row < 3; row++) {
            const i = row * 3;
            for (let col = 0; col < 3; col++) {
                const j = col * 3;
                this.matrix[col * 4 + row] = next[i] * current[j] + next[i + 1] * current[j + 1] + next[i + 2] * current[j + 2];
            }
            this.matrix[12 + row] = next[i] * (this.source[0] - display[0]) + next[i + 1] * (this.source[1] - display[1]) + next[i + 2] * (this.source[2] - display[2]);
        }
        return this.matrix;
    }
}
