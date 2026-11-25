import Linkable from '#/datastruct/Linkable';
import SharedPtrList from '#/datastruct/SharedPtrList';
import GameShell from '#/client/GameShell';
import Client from '#/client/Client';
import LocalisedText from '#/ui/LocalisedText';
import { clientErrorHost, JavaError } from '#/util/ClientError';
import Signlink from '#/util/Signlink';
import type SignlinkRequest from '#/util/SignlinkRequest';
import { arrayAtI32, arrayAtObj, requireNonNull } from '#/util/JavaArray';
import type PacketT from './PacketT';
import type SuperPacket from './SuperPacket';
import { utf8String } from './JavaText';
import GamepackClass, { GamepackClassNotFound, type GamepackMember } from './GamepackClass';

function memberName(p: PacketT): string {
    const bytes = p.gStringNoConversion().toBytes();
    return utf8String(bytes, 0, bytes.length);
}

// Only cells bound to a ported gamepack field participate in Field.getInt/setInt.
function intCell<K extends string>(owner: Record<K, number>, key: K, value: number | undefined): number {
    if (value !== undefined) owner[key] = value;
    return owner[key];
}

function gameInt(member: GamepackMember, value?: number): number | undefined {
    switch (member.owner + '.' + member.name) {
        case 'tf.C':
            return intCell(Client, 'gameState', value);
        case 'hh.kb':
            return intCell(Client, 'loopCycle', value);
        case 'wk.l':
            return intCell(Client, 'rebootTimer', value);
        case 'ah.f':
            return intCell(Client, 'playerLevel', value);
        case 'hk.e':
            return intCell(Client, 'mapBuildBaseX', value);
        case 'vj.t':
            return intCell(Client, 'mapBuildBaseZ', value);
        case 'qj.C':
            return intCell(Client, 'selectedWorldId', value);
        case 'ce.F':
            return intCell(Client, 'affiliateId', value);
        case 'd.c':
            return intCell(Client, 'modeWhere', value);
        case 'mf.j':
            return intCell(clientErrorHost, 'revision', value);
        case 'mi.y':
            return intCell(Client, 'localPid', value);
        case 'hl.w':
            return intCell(LocalisedText, 'language', value);
        case 'fb.f':
            return intCell(Signlink, 'platform', value);
        case 'dd.a':
            return intCell(GameShell, 'm_fps', value);
        case 'mg.T':
            return intCell(GameShell, 'm_updateCount', value);
        case 'hi.f':
            return intCell(GameShell, 'm_sWid', value);
        case 'fl.l':
            return intCell(GameShell, 'm_sHei', value);
        case 'vk.rb':
            return intCell(GameShell, 'm_frameWidth', value);
        case 'oh.j':
            return intCell(GameShell, 'm_frameHeight', value);
        case 'rk.i':
            return intCell(Client, 'viewportWidth', value);
        case 'sb.g':
            return intCell(Client, 'viewportHeight', value);
        case 'ja.Z':
            return intCell(Client, 'viewportFovLow', value);
        case 'lg.G':
            return intCell(Client, 'zoomWidth2', value);
        case 'ib.db':
            return intCell(Client, 'viewportZoomMin', value);
        case 'gi.m':
            return intCell(Client, 'zoomWidth', value);
        case 'ae.j':
            return intCell(Client, 'fovClampMinWidth', value);
        case 'ri.V':
            return intCell(Client, 'viewportMaxZoom', value);
        case 'od.N':
            return intCell(Client, 'zoomWidthMin', value);
        case 'ae.b':
            return intCell(Client, 'fovClampMaxHeight', value);
        default:
            return undefined;
    }
}

// qj extends jf. Majula's REFLECTION_CHECKER emits field values and field/method modifiers.
export default class ReflectionCheck extends Linkable {
    methodRequests: (SignlinkRequest | null)[] | null = null; // qj.s:[Ldj;
    intOperands: Int32Array | null = null; // qj.t:[I
    errors: Int32Array | null = null; // qj.u:[I
    arguments: (Array<Uint8Array | null> | null)[] | null = null; // qj.x:[[[B
    fieldRequests: (SignlinkRequest | null)[] | null = null; // qj.y:[Ldj;
    operations: Int32Array | null = null; // qj.z:[I
    id = 0; // qj.E:I
    count = 0; // qj.G:I
    static queue = new SharedPtrList<ReflectionCheck>(); // di.a:Lgk;

    // qj.<init>()V
    constructor() {
        super();
    }

    // SD r.e(I)V / HD j.c(I)V
    static resetQueue(guard = 91): void {
        if (guard < 91) return;
        this.queue = new SharedPtrList<ReflectionCheck>();
    }

    // lj.a(Lfb;Lgd;II)V
    static decode(signlink: Signlink | null, p: PacketT): void {
        const check = new ReflectionCheck();
        check.count = p.g1();
        check.id = p.g4();
        check.methodRequests = new Array(check.count).fill(null);
        check.arguments = new Array(check.count).fill(null);
        check.fieldRequests = new Array(check.count).fill(null);
        check.intOperands = new Int32Array(check.count);
        check.operations = new Int32Array(check.count);
        check.errors = new Int32Array(check.count);
        for (let i = 0; i < check.count; i++)
            try {
                const operation = p.g1();
                if (operation === 0 || operation === 1 || operation === 2) {
                    const cls = memberName(p),
                        name = memberName(p),
                        operand = operation === 1 ? p.g4() : 0;
                    check.operations[i] = operation;
                    check.intOperands[i] = operand;
                    const type = GamepackClass.loadClass(cls);
                    check.fieldRequests[i] = requireNonNull(signlink).getDeclaredField(type, name);
                } else if (operation === 3 || operation === 4) {
                    const cls = memberName(p),
                        name = memberName(p),
                        count = p.g1(),
                        params: string[] = [];
                    for (let j = 0; j < count; j++) params.push(memberName(p));
                    const args = new Array<Uint8Array | null>(count).fill(null);
                    if (operation === 3) {
                        for (let j = 0; j < count; j++) {
                            const size = p.g4();
                            if (size < 0) throw new RangeError('NegativeArraySizeException');
                            // te.e includes one megabyte above Runtime.maxMemory(). An impossible
                            // allocation raises Error before gd.a reads the first argument byte.
                            if (size === 0x7fffffff || size >= GameShell.maxMemory * 1048576) throw new JavaError('OutOfMemoryError');
                            try {
                                args[j] = new Uint8Array(size);
                            } catch (error) {
                                if (error instanceof RangeError) throw new JavaError('OutOfMemoryError');
                                throw error;
                            }
                            p.gArrayBuffer(size, 0, args[j]);
                        }
                    }
                    check.operations[i] = operation;
                    const types = params.map(GamepackClass.loadClass),
                        owner = GamepackClass.loadClass(cls);
                    check.methodRequests[i] = requireNonNull(signlink).getDeclaredMethod(owner, name, types);
                    check.arguments[i] = args;
                }
            } catch (error) {
                if (error instanceof GamepackClassNotFound) check.errors[i] = -1;
                else if (error instanceof DOMException && error.name === 'SecurityError') check.errors[i] = -2;
                else if (error instanceof TypeError) check.errors[i] = -3;
                else if (error instanceof JavaError || !(error instanceof Error)) check.errors[i] = -5;
                else check.errors[i] = -4;
            }
        this.queue.push_back(check);
    }

    // lg.a(ILbe;Z)V
    static processChecks(opcode: number, out: SuperPacket): void {
        for (let check = this.queue.head(); check !== null; check = this.queue.head()) {
            const errors = requireNonNull(check.errors),
                operations = requireNonNull(check.operations);
            let pending = false;
            for (let i = 0; i < check.count; i++) {
                const field = arrayAtObj(check.fieldRequests, i),
                    method = arrayAtObj(check.methodRequests, i);
                if (field?.status === 2) errors[i] = -5;
                if (field?.status === 0) pending = true;
                if (method?.status === 2) errors[i] = -6;
                if (method?.status === 0) pending = true;
            }
            if (pending) return;
            out.pHead(opcode);
            out.p1(0);
            const start = out.m_pos;
            out.p4(check.id);
            for (let i = 0; i < check.count; i++) {
                if (errors[i] !== 0) {
                    out.p1(errors[i]);
                    continue;
                }
                const op = operations[i],
                    request = op === 3 || op === 4 ? arrayAtObj(check.methodRequests, i) : arrayAtObj(check.fieldRequests, i);
                const member = request?.result as GamepackMember | null | undefined;
                if (member == null) {
                    out.p1(-19);
                    continue;
                }
                if (op === 2 || op === 4) {
                    out.p1(0);
                    out.p4(member.modifiers);
                    continue;
                }
                if (op === 3) {
                    // A method resolved through the declaration table. The browser has no
                    // JVM ObjectInputStream/Method.invoke host. Report processing-time SecurityException.
                    out.p1(-17);
                    continue;
                }
                if ((member.modifiers & 8) === 0) {
                    out.p1(-19);
                    continue;
                }
                if ((member.modifiers & 2) !== 0 && member.owner !== 'lg') {
                    out.p1(-14);
                    continue;
                }
                if (op === 1) {
                    if ((member.modifiers & 16) !== 0) {
                        out.p1(-14);
                        continue;
                    }
                    if (!['I', 'J', 'F', 'D'].includes(member.descriptor)) {
                        out.p1(-15);
                        continue;
                    }
                    if (gameInt(member, arrayAtI32(check.intOperands, i)) === undefined) {
                        out.p1(-17);
                        continue;
                    }
                    out.p1(0);
                    continue;
                }
                if (!['I', 'S', 'B', 'C'].includes(member.descriptor)) {
                    out.p1(-15);
                    continue;
                }
                const value = gameInt(member);
                if (value === undefined) {
                    out.p1(-17);
                    continue;
                }
                out.p1(0);
                out.p4(value);
            }
            out.addCrc(start);
            out.pSize1((out.m_pos - start) | 0);
            check.Unlink();
        }
    }
}
