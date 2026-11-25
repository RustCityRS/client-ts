import Client from './Client';
import { arrayAtI32, arrayAtObj, requireNonNull } from '#/util/JavaArray';
import { doubleToInt } from '#/util/IntUtils';
import OrbitCamera from './OrbitCamera';

export default class CinematicCamera {
    // o.S:I
    static tileX = 0;
    // t.Z:I
    static tileZ = 0;
    // ud.i:I
    static height = 0;
    // oh.c:I
    static step = 0;
    // gi.o:I
    static factor = 0;
    // vc.R:I
    static lookX = 0;
    // qf.c:I
    static lookZ = 0;
    // rk.d:I
    static lookHeight = 0;
    // mc.u:I
    static lookStep = 0;
    // p.e:I
    static lookFactor = 0;
    // kg.l:[[[I
    static readonly paths: ((Int32Array | null)[] | null)[] = [null, null];
    // qa.P:I
    static positionPath = -1;
    // mf.q:I
    static lookPath = -1;
    // ck.I:I
    static positionSegment = 0;
    // sc.W:I
    static lookSegment = 0;
    // se.d:I
    static progress = 0;
    // ga.A:I
    static startRate = 0;
    // mg.e:I
    static endRate = 0;
    // qh.e:Z
    static ended = false;
    // tk.a:Z
    static justEnded = false;
    // qf.j:F
    static pitchRadians = 0;
    // v.x:F
    static yawRadians = 0;
    // ka.a(IIIIIIZ)V. NXT OldCamera::MoveTo.
    static MoveTo(factor: number, x: number, height: number, step: number, z: number, snap: boolean): void {
        this.tileX = x;
        this.tileZ = z;
        this.step = step;
        this.height = height;
        this.factor = factor;
        if (snap && factor >= 100) {
            OrbitCamera.z = ((z << 7) + 64) | 0;
            OrbitCamera.x = ((x << 7) + 64) | 0;
            OrbitCamera.y = (Client.GetAvH(OrbitCamera.x, OrbitCamera.z, Client.playerLevel, 111) - height) | 0;
        }
        OrbitCamera.mode = 2;
    }
    // bi.a(IIIIII)V. NXT OldCamera::LookAt.
    static LookAt(step: number, height: number, x: number, factor: number, z: number): void {
        this.lookStep = step;
        this.lookX = x;
        this.lookFactor = factor;
        this.lookZ = z;
        this.lookHeight = height;
        if (factor >= 100) {
            const fineX = ((this.lookX << 7) + 64) | 0,
                fineZ = ((this.lookZ << 7) + 64) | 0;
            const y = (Client.GetAvH(fineX, fineZ, Client.playerLevel, 99) - this.lookHeight) | 0;
            const dz = (fineZ - OrbitCamera.z) | 0,
                dy = (y - OrbitCamera.y) | 0,
                dx = (fineX - OrbitCamera.x) | 0;
            const horizontal = doubleToInt(Math.sqrt((Math.imul(dz, dz) + Math.imul(dx, dx)) | 0));
            OrbitCamera.pitch = doubleToInt(Math.atan2(dy, horizontal) * 325.949) & 2047;
            OrbitCamera.yaw = doubleToInt(-325.949 * Math.atan2(dx, dz)) & 2047;
            if (OrbitCamera.pitch < 128) OrbitCamera.pitch = 128;
            if (OrbitCamera.pitch > 383) OrbitCamera.pitch = 383;
        }
        OrbitCamera.mode = 2;
    }
    // kf.a(I)V
    static spline(): void {
        if (this.positionPath === -1 || this.lookPath === -1) return;
        const increment = (this.startRate + (Math.imul(this.progress, (this.endRate - this.startRate) | 0) >> 16)) | 0;
        this.progress = (this.progress + increment) | 0;
        if (this.progress >= 65535) {
            this.justEnded = !this.ended;
            this.progress = 65535;
            this.ended = true;
        } else {
            this.ended = false;
            this.justEnded = false;
        }
        const f = Math.fround,
            t = f(f(this.progress) / 65535);
        const pos = new Float32Array(3);
        const eye = requireNonNull(arrayAtObj(this.paths, this.positionPath));
        const eyeIndex = this.positionSegment << 1;
        for (let axis = 0; axis < 3; axis++) {
            const start = arrayAtI32(arrayAtObj(eye, eyeIndex), axis);
            const a = Math.imul(start, 3);
            const b = Math.imul(arrayAtI32(arrayAtObj(eye, eyeIndex + 1), axis), 3);
            const control = arrayAtI32(arrayAtObj(eye, eyeIndex + 3), axis);
            const end = arrayAtI32(arrayAtObj(eye, eyeIndex + 2), axis);
            const c = Math.imul(end + end - control, 3);
            const linear = (b - a) | 0;
            const quadratic = (a + c - Math.imul(b, 2)) | 0;
            const cubic = (end - start + b - c) | 0;
            pos[axis] = f(t * f(f(linear) + f(t * f(f(quadratic) + f(f(cubic) * t))))) + f(start);
        }
        OrbitCamera.x = (doubleToInt(pos[0]) - (Client.mapBuildBaseX << 7)) | 0;
        OrbitCamera.y = -doubleToInt(pos[1]) | 0;
        OrbitCamera.z = (doubleToInt(pos[2]) - (Client.mapBuildBaseZ << 7)) | 0;
        const target = new Float32Array(3);
        const look = requireNonNull(arrayAtObj(this.paths, this.lookPath));
        const lookIndex = this.lookSegment << 1;
        for (let axis = 0; axis < 3; axis++) {
            const start = arrayAtI32(arrayAtObj(look, lookIndex), axis);
            const a = Math.imul(start, 3);
            const b = Math.imul(arrayAtI32(arrayAtObj(look, lookIndex + 1), axis), 3);
            const end = arrayAtI32(arrayAtObj(look, lookIndex + 2), axis);
            const control = arrayAtI32(arrayAtObj(look, lookIndex + 3), axis);
            const c = Math.imul(end - control + end, 3);
            const linear = (b - a) | 0;
            const quadratic = (a - Math.imul(b, 2) + c) | 0;
            const cubic = (end - start + b - c) | 0;
            const second = f(f(t * f(cubic)) + f(quadratic));
            const first = f(f(second * t) + f(linear));
            target[axis] = f(first * t) + f(start);
        }
        const dx = f(target[0] - pos[0]),
            dy = -f(target[1] - pos[1]),
            dz = f(target[2] - pos[2]);
        const horizontal = Math.sqrt(f(f(dx * dx) + f(dz * dz)));
        this.pitchRadians = f(Math.atan2(dy, horizontal));
        this.yawRadians = -f(Math.atan2(dx, dz));
        OrbitCamera.pitch = doubleToInt(325.949 * this.pitchRadians) & 2047;
        OrbitCamera.yaw = doubleToInt(325.949 * this.yawRadians) & 2047;
    }
}
