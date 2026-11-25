import { isJavaRuntimeException } from '#/util/JavaException';
import { releaseReferences } from '#/util/StaticReferences';
import WrappedException from '#/util/WrappedException';
import JagString, { fromLiteral } from '#/datastruct/JagString';
import { requireNonNull } from '#/util/JavaArray';
import SecondaryLinkedList from '#/datastruct/SecondaryLinkedList';
import SharedPtrList from '#/datastruct/SharedPtrList';
import SecondaryNode from '#/datastruct/SecondaryNode';
import type PacketT from '#/io/PacketT';
import SubArea from './SubArea';
import { loadMinimenu, loadWorldMap } from '#/util/GamepackClasses';

export default class MapArea extends SecondaryNode {
    // HD bn.g(B)V
    static releaseMapAreaStatics(guard: number): void {
        try {
            if (guard !== -46) {
                const Minimenu = loadMinimenu();
                Minimenu.width = 7;
            }
            const WorldMap = loadWorldMap();
            releaseReferences(WorldMap, 'component');
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'bn.D(' + guard + ')');
        }
    }

    static areas = new SharedPtrList<MapArea>(); // ba.d:Lgk;
    static readonly details = fromLiteral('details'); // hl.l:Lid;

    // nb.a(III)Lgh;
    static at(x: number, z: number): MapArea | null {
        for (let area = this.areas.head(); area !== null; area = this.areas.next()) {
            if (area.valid && area.contains(z, x)) return area;
        }
        return null;
    }

    // rb.a(III)Ltb;
    static allAt(z: number, x: number): SecondaryLinkedList<MapArea> {
        const matches = new SecondaryLinkedList<MapArea>();
        for (let area = this.areas.head(); area !== null; area = this.areas.next()) {
            if (area.valid && area.contains(z, x)) matches.addTail(area);
        }
        return matches;
    }

    // ug.a(ILid;)Lgh;
    static get(name: JagString | null): MapArea | null {
        for (let area = this.areas.head(); area !== null; area = this.areas.next()) {
            if (requireNonNull(area.groupName).equals(name)) return area;
        }
        return null;
    }

    maxX = 0; // gh.F:I
    defaultZoom = -1; // gh.H:I
    minX = 12800; // gh.I:I
    background = -1; // gh.J:I
    originX: number; // gh.Q:I
    originZ: number; // gh.R:I
    displayName: JagString | null; // gh.S:Lid;
    groupName: JagString | null; // gh.T:Lid;
    rectangles: SharedPtrList<SubArea>; // gh.U:Lgk;
    minZ = 12800; // gh.W:I
    valid = true; // gh.Z:Z
    maxZ = 0; // gh.ab:I

    // gh.<init>(Lid;Lid;IIIZI)V
    constructor(group: JagString | null, name: JagString | null, x: number, z: number, color: number, valid: boolean, zoom: number) {
        super();
        this.valid = valid;
        this.background = color;
        this.originZ = z;
        this.displayName = name;
        this.groupName = group;
        this.originX = x;
        this.defaultZoom = zoom;
        if (this.defaultZoom === 255) this.defaultZoom = 0;
        this.rectangles = new SharedPtrList();
    }

    // gh.c(I)V
    computeBounds(initialMaxZ: number): void {
        this.maxX = 0;
        this.maxZ = initialMaxZ;
        this.minZ = 12800;
        this.minX = 12800;
        for (let rect = this.rectangles.head(); rect !== null; rect = this.rectangles.next()) {
            if (this.maxX < rect.maxX) this.maxX = rect.maxX;
            if (rect.minZ < this.minZ) this.minZ = rect.minZ;
            if (this.maxZ < rect.maxZ) this.maxZ = rect.maxZ;
            if (this.minX > rect.minX) this.minX = rect.minX;
        }
    }

    // gh.a(IIZ)Z
    contains(z: number, x: number): boolean {
        if (this.minX <= x && x <= this.maxX && z >= this.minZ && this.maxZ >= z) {
            for (let rect = this.rectangles.head(); rect !== null; rect = this.rectangles.next()) {
                if (rect.contains(z, x)) return true;
            }
        }
        return false;
    }

    // hl.a(Lgd;B)Lgh;
    static decode(packet: PacketT): MapArea {
        const area = new MapArea(packet.gStringNoConversion(), packet.gStringNoConversion(), packet.g2(), packet.g2(), packet.g4(), packet.g1() === 1, packet.g1());
        const count = packet.g1();
        for (let i = 0; i < count; i++) {
            area.rectangles.push_back(new SubArea(packet.g2(), packet.g2(), packet.g2(), packet.g2()));
        }
        area.computeBounds(0);
        return area;
    }
}
