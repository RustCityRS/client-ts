// The follow-camera values read at the last game draw. Angles are game units (one turn = 2048).
export interface FollowCamera {
    focusX: number;
    focusY: number;
    focusZ: number;
    zoomScale: number;
    followPitch: number;
    distance: number;
    yawVelocity: number;
    pitchVelocity: number;
}

const radiansPerUnit = Math.PI / 1024;
const degreesPerUnit = 360 / 2048;

// The eventual resting angle is already known if the keys are released now:
// GlFollowCamera halves the signed velocity, then adds half of that to the angle.
function stoppingDistance(velocity: number): number {
    let distance = 0;
    while (Math.abs(velocity) >= 4) {
        velocity = (velocity / 2) | 0;
        distance += (velocity / 2) | 0;
    }
    return distance;
}

class OrbitAngle {
    private target = 0;
    private distance = 0;
    private start = 0;
    private end = 0;
    private braking = false;

    constructor(private readonly wraps: boolean) {}

    capture(angle: number, velocity: number, time: number, shown: number, reset: boolean, minimum = -Infinity, maximum = Infinity): void {
        const target = Math.max(minimum, Math.min(maximum, angle + stoppingDistance(velocity)));
        if (!reset && target === this.target) {
            // Successive Java ticks converge on the same endpoint after key-up.
            // A quadratic ease over twice the time left preserves the current
            // angular speed at release and reaches exactly zero at that endpoint.
            if (this.braking || shown >= this.end) return;
            const remaining = this.end - shown;
            this.distance = target - this.sample(shown);
            this.start = shown;
            this.end = shown + remaining * 2;
            this.braking = true;
            return;
        }
        const from = reset ? Math.max(minimum, Math.min(maximum, angle)) : this.sample(shown);
        const delta = target - from;
        this.distance = this.wraps ? ((delta + 3072) % 2048) - 1024 : delta;
        this.target = target;
        this.start = shown;
        // Give the renderer two ticks of motion to present across a late game draw.
        // Anchor at the last displayed angle when the simulation timestamp is older.
        this.end = Math.max(shown + 20, time + 40);
        this.braking = false;
    }

    sample(time: number): number {
        const remaining = Math.max(0, Math.min(1, (this.end - time) / (this.end - this.start)));
        return this.target - this.distance * (this.braking ? remaining * remaining : remaining);
    }
}

export default class PresentationOrbit {
    private readonly yaw = new OrbitAngle(true);
    private readonly pitch = new OrbitAngle(false);
    private zoomScale = 256;
    private focusX = 0;
    private focusY = 0;
    private focusZ = 0;
    private dx = 0;
    private dy = 0;
    private dz = 0;
    private time = 0;
    private lastSample = 0;

    capture(view: Float64Array, follow: FollowCamera, ticks: number, time: number): void {
        this.lastSample = ticks ? Math.max(time, this.lastSample) : time;
        this.yaw.capture(view[4] / degreesPerUnit, follow.yawVelocity, time, this.lastSample, !ticks);
        this.pitch.capture(follow.followPitch, follow.pitchVelocity, time, this.lastSample, !ticks, Math.max(128, follow.distance >> 8), 383);
        this.dx = ticks ? (follow.focusX - this.focusX) / ticks : 0;
        this.dy = ticks ? (follow.focusY - this.focusY) / ticks : 0;
        this.dz = ticks ? (follow.focusZ - this.focusZ) / ticks : 0;
        this.focusX = follow.focusX;
        this.focusY = follow.focusY;
        this.focusZ = follow.focusZ;
        this.zoomScale = follow.zoomScale;
        this.time = time;
    }

    sample(out: Float64Array, elapsed: number): void {
        this.lastSample = Math.max(this.lastSample, this.time + elapsed);
        const yaw = this.yaw.sample(this.lastSample);
        const pitch = this.pitch.sample(this.lastSample);
        const radius = (this.zoomScale / 256) * (600 + 3 * pitch);
        const horizontal = Math.cos(pitch * radiansPerUnit) * radius;
        // Interpolate the two known focus points. An abrupt stop or a change
        // in terrain height must not send the camera past its target and back.
        const t = Math.min(elapsed / 20, 1) - 1;
        out[0] = this.focusX + this.dx * t + Math.sin(yaw * radiansPerUnit) * horizontal;
        out[1] = this.focusY + this.dy * t - Math.sin(pitch * radiansPerUnit) * radius;
        out[2] = this.focusZ + this.dz * t - Math.cos(yaw * radiansPerUnit) * horizontal;
        out[3] = pitch * degreesPerUnit;
        out[4] = yaw * degreesPerUnit;
    }
}
