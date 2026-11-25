import { isJavaRuntimeException } from '#/util/JavaException';
import { releaseReferences } from '#/util/StaticReferences';
import WrappedException from '#/util/WrappedException';
import { loadClient, loadWorldMap } from '#/util/GamepackClasses';
export interface WheelSurface {
    addMouseWheelListener(listener: WheelListener): void;
    removeMouseWheelListener(listener: WheelListener): void;
}

export interface WheelListener {
    mouseWheelMoved(rotation: number): void;
}

export default abstract class MouseWheel {
    // HD uc.b(I)V
    static releaseHdStatics(guard: number): void {
        try {
            const WorldMap = loadWorldMap();
            releaseReferences(WorldMap, 'underlayColors');
            if (guard !== 0) {
                return;
            }
            const Client = loadClient();
            releaseReferences(Client, 'm_pJagFx');
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'uc.A(' + guard + ')');
        }
    }

    static instance: MouseWheel | null = null; // lj.k:Lle;
    static rotation = 0; // kf.l:I

    // le.<init>()V
    constructor() {}

    // wg.a(I)Lle;
    static async create(): Promise<MouseWheel | null> {
        try {
            const { default: JavaMouseWheel } = await import('./JavaMouseWheel');
            return new JavaMouseWheel();
        } catch {
            return null;
        }
    }
    // le.a(B)I
    abstract poll(): number;
    // le.a(ZLjava/awt/Component;)V
    abstract start(surface: WheelSurface): void;
    // le.a(BLjava/awt/Component;)V
    abstract stop(surface: WheelSurface): void;
}
