import { isJavaRuntimeException } from '#/util/JavaException';
import { releaseReferences } from '#/util/StaticReferences';
import WrappedException from '#/util/WrappedException';
import ClientMouseListener from './ClientMouseListener';
import ThreadUtils from '#/util/ThreadUtils';
import { arrayPutI32, requireNonNull } from '#/util/JavaArray';
import { loadClientBuild, loadMinimenu, loadObjType } from '#/util/GamepackClasses';

export default class MouseTracking {
    // HD jd.a(I)V
    static releaseHdStatics(guard: number): void {
        try {
            if (guard !== 25951) {
                return;
            }
            const Minimenu = loadMinimenu();
            releaseReferences(Minimenu, 'objDragComponent');
            const ClientBuild = loadClientBuild();
            releaseReferences(ClientBuild, 'm_shadow');
            const ObjType = loadObjType();
            releaseReferences(ObjType, 'spriteCache');
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'jd.B(' + guard + ')');
        }
    }

    running = true; // ag.h:Z
    lock: object | null; // ag.g:Ljava/lang/Object;
    samplesX: Int32Array | null; // ag.o:[I
    samplesY: Int32Array | null; // ag.m:[I
    count: number; // ag.n:I

    // ag.<init>()V
    constructor() {
        this.lock = {};
        this.samplesX = new Int32Array(500);
        this.samplesY = new Int32Array(500);
        this.count = 0;
    }

    // ag.run()V
    async run(): Promise<void> {
        while (this.running) {
            requireNonNull(this.lock);
            if (this.count < 500) {
                arrayPutI32(this.samplesX, this.count, ClientMouseListener.x);
                arrayPutI32(this.samplesY, this.count, ClientMouseListener.mouseY);
                this.count = (this.count + 1) | 0;
            }
            await ThreadUtils.sleep(50n);
        }
    }
}
