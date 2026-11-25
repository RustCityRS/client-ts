import Pix2D from '#/graphics/Pix2D';
import Client from '#/client/Client';
import type IfType from './IfType';
import InterfaceList from './InterfaceList';

type Bounds = [left: number, top: number, right: number, bottom: number];
type WidgetGroup = (IfType | null)[];
type PositionedWidget = { component: IfType; x: number; y: number };

// lf.a consumes these client codes before sf.a or the type-0 subtree.
function drawsOwnContent(code: number): boolean {
    return code === 1337 || code === 1338 || code === 1339 || code === 1400 || code === 1401 || code === 1402 || code === 1405 || code === 1406;
}

export default class InterfaceView {
    components: IfType[] = [];
    private topGroup: WidgetGroup = [];
    drawMinimap?: (c: IfType, x: number, y: number) => void;
    drawScene?: (x: number, y: number, width: number, height: number) => void;
    private mounts: ReadonlyMap<number, WidgetGroup> = new Map();
    private viewport: Bounds = [0, 0, 0, 0];

    constructor(components: WidgetGroup) {
        this.setGroups(components, new Map());
    }

    setGroups(top: WidgetGroup, subs: ReadonlyMap<number, WidgetGroup>): void {
        this.topGroup = top;
        this.mounts = subs;
        this.components = [...new Set([...top, ...Array.from(subs.values()).flat()].filter((c): c is IfType => c !== null))];
    }

    setViewport(width: number, height: number): void {
        this.viewport = [0, 0, width, height];
    }

    draw(): void {
        const clip: Bounds = [Pix2D.clipMinX, Pix2D.clipMinY, Pix2D.clipMaxX, Pix2D.clipMaxY];
        Client.DrawLayer(0, this.topGroup, -1, clip[3], clip[1], -1, clip[2], 0, clip[0]);
        Pix2D.setClipping(...clip);
    }

    drawViewport(x: number, y: number, width: number, height: number): void {
        this.drawScene?.(x, y, width, height);
    }

    visibleComponents(): IfType[] {
        const visible: IfType[] = [];
        this.visit(this.topGroup, -1, 0, 0, this.viewport, c => visible.push(c));
        return visible;
    }

    // client.a([Laj;IIIIIII)V keeps each component's screen position as a traversal local, not a field.
    visiblePositions(): { component: IfType; x: number; y: number }[] {
        const visible: { component: IfType; x: number; y: number }[] = [];
        this.visit(this.topGroup, -1, 0, 0, this.viewport, (component, x, y) => visible.push({ component, x, y }));
        return visible;
    }

    hitTest(x: number, y: number): IfType[] {
        return this.menuHits(x, y).map(hit => hit.component);
    }

    menuHits(x: number, y: number): PositionedWidget[] {
        const hits: PositionedWidget[] = [];
        this.visit(
            this.topGroup,
            -1,
            0,
            0,
            this.viewport,
            (component, originX, originY, bounds) => {
                if (x >= bounds[0] && x < bounds[2] && y >= bounds[1] && y < bounds[3]) {
                    if (drawsOwnContent(component.clientCode)) {
                        if (component.clientCode !== 1337 && component.clientCode !== 1338) return;
                    } else if (component.type === 0 && component.noClickThrough && !Client.qaOpTest) hits.length = 0;
                    hits.push({ component, x: originX, y: originY });
                }
            },
            (host, bounds) => {
                if (!Client.qaOpTest && x >= bounds[0] && x < bounds[2] && y >= bounds[1] && y < bounds[3] && InterfaceList.subInterfaces.get(BigInt(host.id))?.type === 0) hits.length = 0;
            }
        );
        return hits;
    }

    private visit(components: WidgetGroup, parent: number, px: number, py: number, clip: Bounds, visitor: (c: IfType, x: number, y: number, bounds: Bounds, parentClip: Bounds) => void, beforeMount?: (host: IfType, bounds: Bounds) => void): void {
        for (const c of components) {
            if (!c || c.parentId !== parent || (c.if3 && Client.Hide(c))) continue;
            const x = (px + c.x) | 0,
                y = (py + c.y) | 0;
            const extra = c.type === 9 ? 1 : 0;
            const bounds: Bounds = c.type === 2 ? clip : [Math.max(clip[0], x), Math.max(clip[1], y), Math.min(clip[2], (x + c.width + extra) | 0), Math.min(clip[3], (y + c.height + extra) | 0)];
            if (c.if3 && (bounds[0] >= bounds[2] || bounds[1] >= bounds[3])) continue;
            visitor(c, x, y, bounds, clip);
            if (c.type === 0 && !drawsOwnContent(c.clientCode)) {
                if (!c.if3 && Client.Hide(c) && c !== InterfaceList.mouseOverComponent) continue;
                const scrollY = c.if3 ? c.scrollY : Math.max(0, Math.min(c.scrollY, (c.scrollHeight - c.height) | 0));
                const childX = (x - c.scrollX) | 0,
                    childY = (y - scrollY) | 0;
                this.visit(components, c.id, childX, childY, bounds, visitor, beforeMount);
                if (c.childSlots !== null) this.visit(c.childSlots, c.id, childX, childY, bounds, visitor, beforeMount);
                const mounted = this.mounts.get(c.id);
                if (mounted !== undefined) {
                    beforeMount?.(c, bounds);
                    this.visit(mounted, -1, x, y, bounds, visitor, beforeMount);
                }
            }
        }
    }
}
