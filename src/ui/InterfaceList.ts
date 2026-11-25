import IfType from './IfType';
import Client from '#/client/Client';
import HashTable from '#/datastruct/HashTable';
import HashTableIterator from '#/datastruct/HashTableIterator';
import SubInterface from './SubInterface';
import WrappedException from '#/util/WrappedException';
import { isJavaRuntimeException } from '#/util/JavaException';
import { arrayAtI32, arrayAtObj, arrayPutObj, requireNonNull } from '#/util/JavaArray';

export default class InterfaceList {
    static cycle = -2; // vk.db:I
    static readonly dirty = new Array<boolean>(100).fill(false); // sf.m:[Z
    static readonly rectangleRedraw = new Array<boolean>(100).fill(false); // ce.T:[Z
    static readonly rectRedrawnLastFrame = new Array<boolean>(100).fill(false); // n.i:[Z
    static rootCount = 0; // ik.G:I
    static readonly rootX = new Int32Array(100); // nh.Y:[I
    static readonly rootY = new Int32Array(100); // r.U:[I
    static readonly rootWidth = new Int32Array(100); // gk.i:[I
    static readonly rootHeight = new Int32Array(100); // ik.Q:[I

    // pj.c(I)V
    static redrawAll(): void {
        for (let i = 0; i < 100; i++) arrayPutObj(InterfaceList.dirty, i, true);
    }

    // uj.a(IIIII)V
    static invalidateArea(height: number, x: number, width: number, y: number): void {
        for (let i = 0; i < InterfaceList.rootCount; i++) {
            if (
                x < ((arrayAtI32(InterfaceList.rootWidth, i) + arrayAtI32(InterfaceList.rootX, i)) | 0) &&
                ((x + width) | 0) > arrayAtI32(InterfaceList.rootX, i) &&
                y < ((arrayAtI32(InterfaceList.rootY, i) + arrayAtI32(InterfaceList.rootHeight, i)) | 0) &&
                ((y + height) | 0) > arrayAtI32(InterfaceList.rootY, i)
            ) {
                arrayPutObj(InterfaceList.dirty, i, true);
            }
        }
    }

    // sd.a(IIIII)V
    static redrawArea(y: number, height: number, width: number, x: number): void {
        for (let i = 0; i < InterfaceList.rootCount; i++) {
            if (
                x < ((arrayAtI32(InterfaceList.rootWidth, i) + arrayAtI32(InterfaceList.rootX, i)) | 0) &&
                ((x + width) | 0) > arrayAtI32(InterfaceList.rootX, i) &&
                ((arrayAtI32(InterfaceList.rootY, i) + arrayAtI32(InterfaceList.rootHeight, i)) | 0) > y &&
                ((y + height) | 0) > arrayAtI32(InterfaceList.rootY, i)
            ) {
                arrayPutObj(InterfaceList.rectangleRedraw, i, true);
            }
        }
    }

    static miscTransmitAt = 0; // mf.l:I
    static viewportComponent: IfType | null = null; // bh.l:Laj;

    // va.Z:Lnc;
    static subInterfaces = new HashTable<SubInterface>(8);
    // ca.g:Laj;
    static pressedContinue: IfType | null = null;
    // di.g:Laj;
    static mouseOverComponent: IfType | null = null;
    // jf.i:I
    static tooltipDelay = 50;
    // hd.m:I
    static top = -1;

    // ed.a(IIIIIIIII)V. Client::DrawInterface, projects/osclient/client.cpp:6965.
    static DrawInterface(bottom: number, offsetY: number, top: number, right: number, left: number, root: number, offsetX: number, group: number): void {
        try {
            if (!IfType.OpenInterface(group)) {
                if (root !== -1) arrayPutObj(InterfaceList.dirty, root, true);
                else {
                    for (let i = 0; i < 100; i++) arrayPutObj(InterfaceList.dirty, i, true);
                }
            } else {
                Client.DrawLayer(offsetY, arrayAtObj(IfType.m_list, group), -1, bottom, top, root, right, offsetX, left);
            }
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'ed.H(' + [bottom, offsetY, top, right, left, root, offsetX, group, 22562].join(',') + ')');
        }
    }

    // ki.f(I)V
    static reset(): void {
        IfType.m_list = new Array(requireNonNull(IfType.m_pInterfaces).GetGroupIdLimit()).fill(null);
        IfType.m_open = new Array<boolean>(requireNonNull(IfType.m_pInterfaces).GetGroupIdLimit()).fill(false);
    }

    // pj.a(III)Laj;
    static GetComponent(id: number, child: number): IfType | null {
        const parent = IfType.Get(id);
        if (child === -1) return parent;
        return parent !== null && parent.childSlots !== null && parent.childSlots.length > child ? (arrayAtObj(parent.childSlots, child) ?? null) : null;
    }

    // wb.a(Laj;B)Laj;
    static getParent(component: IfType): IfType | null {
        if (component.parentId !== -1) return IfType.Get(component.parentId);
        const group = component.id >>> 16;
        const iterator = new HashTableIterator(InterfaceList.subInterfaces);
        for (let node = iterator.head(); node !== null; node = iterator.next()) {
            if (!(node instanceof SubInterface)) throw new TypeError('ClassCastException: not a SubInterface');
            if (node.group === group) return IfType.Get(Number(BigInt.asIntN(32, node.key)));
        }
        return null;
    }
}
