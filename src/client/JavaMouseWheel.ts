import MouseWheel, { type WheelSurface } from './MouseWheel';

export default class JavaMouseWheel extends MouseWheel {
    private rotation = 0; // ih.m:I

    // ih.<init>()V
    constructor() {
        super();
    }

    // ih.a(B)I
    poll(): number {
        const result = this.rotation;
        this.rotation = 0;
        return result;
    }

    // ih.a(ZLjava/awt/Component;)V
    start(surface: WheelSurface): void {
        surface.addMouseWheelListener(this);
    }

    // ih.mouseWheelMoved(Ljava/awt/event/MouseWheelEvent;)V
    mouseWheelMoved(rotation: number): void {
        this.rotation = (this.rotation + rotation) | 0;
    }

    // ih.a(BLjava/awt/Component;)V
    stop(surface: WheelSurface): void {
        surface.removeMouseWheelListener(this);
    }
}
