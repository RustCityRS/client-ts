import world from '#/dash3d/world';
import ClientBuild from './ClientBuild';
import Client from './Client';
import { arrayAtI32, arrayAtObj, arrayAtU8, arrayPutObj } from '#/util/JavaArray';
import { intDivide, doubleToInt } from '#/util/IntUtils';
import { mathRandom } from '#/util/JavaRandom';
import CinematicCamera from './CinematicCamera';
import { glJar } from './ClientVariant';
import { isJavaRuntimeException } from '#/util/JavaException';
import WrappedException from '#/util/WrappedException';

export default class OrbitCamera {
    // cl.e:I
    static mode = 0;
    // rk.m:I
    static x = 0;
    // mf.i:I
    static y = 0;
    // ud.g:I
    static z = 0;
    // bd.X:I
    static pitch = 0;
    // qj.w:I
    static yaw = 0;
    // pg.H:I
    static focusX = 0;
    // ai.f:I
    static focusZ = 0;
    // pd.s:I
    static followPitch = 128;
    // df.B:I
    static followYaw = 0;
    // client.nb:I
    static followOffsetX = 0;
    // gg.C:I
    static followOffsetZ = 0;
    // gi.n:I
    static yawOffset = 0;
    // ag.e:I
    static minimapAngle = 0;
    // kk.db:I
    static minimapZoom = 0;
    // ok.A:I
    static yawVelocity = 0;
    // cf.a:I
    static pitchVelocity = 0;
    // pg.V:I
    static distance = 0;
    // kf.q:I
    static driftTicks = 0;
    // vf.P:I
    static minimapTicks = 0;
    // kk.eb:I
    static driftX = 2;
    // li.A:I
    static driftZ = 2;
    // qd.x:I
    static driftYaw = 1;
    // gk.x:I
    static driftAngle = 2;
    // va.Q:I
    static driftZoom = 1;
    // ci.c:I
    static reportDelay = 0;
    // tj.i:Z
    static reportPending = true;
    // qh.h:[Z
    static readonly shake = new Array<boolean>(5).fill(false);
    // lj.f:[I
    static readonly shakeRandom = new Int32Array(5);
    // fa.n:[I
    static readonly shakeAmplitude = new Int32Array(5);
    // ll.d:[I
    static readonly shakeFrequency = new Int32Array(5);
    // cd.f:[I
    static readonly shakePhase = new Int32Array(5);

    // SD pi.b(I)V / HD gn.b(B)V.
    static clamp(guard = -94): void {
        try {
            const plane = Client.playerLevel;
            this.followPitch = Math.min(383, Math.max(128, this.followPitch));
            this.followYaw &= 2047;
            const x = this.focusX >> 7;
            const z = this.focusZ >> 7;
            const ground = glJar ? Client.GetAvHHd(plane, 1, this.focusX, this.focusZ) : Client.GetAvH(this.focusX, this.focusZ, plane, 90);
            let max = 0;
            if (x > 3 && z > 3 && x < 100 && z < 100) {
                for (let tx = x - 4; tx <= x + 4; tx++)
                    for (let tz = z - 4; tz <= z + 4; tz++) {
                        let p = plane;
                        if (p < 3 && (arrayAtU8(arrayAtObj(arrayAtObj(ClientBuild.m_mapl, 1), tx), tz) & 2) !== 0) p++;
                        const delta = (ground + 8 * (arrayAtU8(arrayAtObj(arrayAtObj(world.tileCameraClearance, p), tx), tz) & 255) - arrayAtI32(arrayAtObj(arrayAtObj(world.levelHeightmaps, p), tx), tz)) | 0;
                        if (max < delta) max = delta;
                    }
            }
            const target = Math.max(32768, Math.min(98048, Math.imul(max, 192)));
            if (target !== this.distance) this.distance = (this.distance + intDivide((target - this.distance) | 0, target > this.distance ? 24 : 80)) | 0;
        } catch (error) {
            if (!glJar || !isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'gn.D(' + guard + ')');
        }
    }
    // kk.a(BIIIIZ)V camera placement and five shake axes.
    static view(plane: number, x: number, z: number) {
        if (this.mode === 1) {
            let pitch = Math.max(this.followPitch, intDivide(this.distance, 256));
            if (this.shake[4]) pitch = Math.max(pitch, (this.shakeAmplitude[4] + 128) | 0);
            const yaw = (this.followYaw + this.yawOffset) & 2047;
            Client.CamFollow((Client.GetAvH(x, z, plane, 98) - 50) | 0, (600 + Math.imul(pitch, 3)) | 0, yaw, this.focusX, pitch, this.focusZ);
        }
        const eye = { x: this.x, y: this.y, z: this.z, pitch: this.pitch, yaw: this.yaw };
        for (let i = 0; i < 5; i++)
            if (this.shake[i]) {
                const r = this.shakeRandom[i];
                const delta = doubleToInt(mathRandom.nextDouble() * ((1 + Math.imul(r, 2)) | 0) - r + Math.sin((this.shakeFrequency[i] / 100) * this.shakePhase[i]) * this.shakeAmplitude[i]);
                switch (i) {
                    case 0:
                        eye.x = (eye.x + delta) | 0;
                        break;
                    case 1:
                        eye.y = (eye.y + delta) | 0;
                        break;
                    case 2:
                        eye.z = (eye.z + delta) | 0;
                        break;
                    case 3:
                        eye.yaw = (eye.yaw + delta) & 2047;
                        break;
                    case 4:
                        eye.pitch = Math.max(128, Math.min(383, (eye.pitch + delta) | 0));
                        break;
                }
            }
        return eye;
    }
    // SD ud.a(I)V / HD cl.e(I)V.
    static reset(): void {
        if (glJar) {
            try {
                for (let axis = 0; axis < 5; axis++) arrayPutObj(OrbitCamera.shake, axis, false);
                CinematicCamera.lookStep = 0;
                CinematicCamera.lookFactor = 0;
                CinematicCamera.positionPath = -1;
                CinematicCamera.lookPath = -1;
                this.mode = 1;
            } catch (error) {
                if (!isJavaRuntimeException(error)) throw error;
                throw WrappedException.wrap(error, 'cl.A(-21556)');
            }
            return;
        }
        for (let axis = 0; axis < 5; axis++) arrayPutObj(OrbitCamera.shake, axis, false);
        CinematicCamera.lookFactor = 0;
        this.mode = 1;
        CinematicCamera.positionPath = -1;
        CinematicCamera.lookStep = 0;
        CinematicCamera.lookPath = -1;
    }
}
