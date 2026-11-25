import Packet530 from '#/io/Packet530';
import type Js5Resources from '#/cache/Js5Resources';
import { requireNonNull } from '#/util/JavaArray';

type Pairs = [number, number][];
function pairs(buf: Packet530): Pairs {
    return Array.from({ length: buf.g1() }, () => [buf.g2(), buf.g2()]);
}

function ids(buf: Packet530): number[] {
    return Array.from({ length: buf.g1() }, () => buf.g2());
}

function params(buf: Packet530): Map<number, number | string> {
    const values = new Map<number, number | string>();
    for (let n = buf.g1(); n > 0; n--) {
        const string = buf.g1() === 1;
        const key = buf.g3();
        values.set(key, string ? buf.gjstr() : buf.g4());
    }
    return values;
}

function nullable(id: number): number {
    return id === 65535 ? -1 : id;
}

// ja.a(int,gd,byte)
export class NpcType {
    name = 'null';
    size = 1;
    turnSpeed = 32;
    bas = -1;
    smoothWalk = true;
    drawOnTop = false;
    minimap = true;
    mapIcon = -1;
    clickable = true;
    models: number[] = [];
    heads: number[] = [];
    translations: (number[] | undefined)[] = [];
    recolours: Pairs = [];
    retextures: Pairs = [];
    palette: number[] = [];
    resizeH = 128;
    resizeV = 128;
    ambient = 0;
    contrast = 0;
    varbit = -1;
    varp = -1;
    multi: number[] = [];
    ops: (string | null)[] = new Array(5).fill(null);
    level = -1;
    params = new Map<number, number | string>();

    constructor(data: Uint8Array) {
        const p = new Packet530(data);
        for (let op = p.g1(); op; op = p.g1()) {
            if (op >= 30 && op <= 34) {
                const value = p.gjstr();
                this.ops[op - 30] = value.toLowerCase() === 'hidden' ? null : value;
                continue;
            }
            switch (op) {
                case 1:
                    this.models = ids(p);
                    break;
                case 2:
                    this.name = p.gjstr();
                    break;
                case 12:
                    this.size = p.g1();
                    break;
                case 40:
                    this.recolours = pairs(p);
                    break;
                case 41:
                    this.retextures = pairs(p);
                    break;
                case 42:
                    this.palette = Array.from({ length: p.g1() }, () => p.g1());
                    break;
                case 60:
                    this.heads = ids(p);
                    break;
                case 93:
                    this.minimap = false;
                    break;
                case 95:
                    this.level = p.g2();
                    break;
                case 97:
                    this.resizeH = p.g2();
                    break;
                case 98:
                    this.resizeV = p.g2();
                    break;
                case 99:
                    this.drawOnTop = true;
                    break;
                case 100:
                    this.ambient = p.g1s();
                    break;
                case 101:
                    this.contrast = p.g1s() * 5;
                    break;
                case 102:
                case 122:
                case 123:
                case 137:
                    p.g2();
                    break;
                case 126:
                    this.mapIcon = p.g2();
                    break;
                case 103:
                    this.turnSpeed = p.g2();
                    break;
                case 106:
                case 118: {
                    this.varbit = nullable(p.g2());
                    this.varp = nullable(p.g2());
                    const fallback = op === 118 ? nullable(p.g2()) : -1;
                    this.multi = Array.from({ length: p.g1() + 1 }, () => nullable(p.g2()));
                    this.multi.push(fallback);
                    break;
                }
                case 107:
                    this.clickable = false;
                    break;
                case 109:
                    this.smoothWalk = false;
                    break;
                case 111:
                    break;
                case 113:
                    p.m_pos = (p.m_pos + 4) | 0;
                    break;
                case 114:
                case 115:
                    p.m_pos = (p.m_pos + 2) | 0;
                    break;
                case 119:
                case 125:
                case 128:
                    p.m_pos = (p.m_pos + 1) | 0;
                    break;
                case 121: {
                    for (let count = p.g1(); count > 0; count--) this.translations[p.g1()] = [p.g1s(), p.g1s(), p.g1s()];
                    break;
                }
                case 127:
                    this.bas = p.g2();
                    break;
                case 134:
                    p.m_pos = (p.m_pos + 9) | 0;
                    break;
                case 135:
                case 136:
                    p.m_pos = (p.m_pos + 3) | 0;
                    break;
                case 249:
                    this.params = params(p);
                    break;
                default:
                    throw new Error(`Unknown 530 NPC opcode ${op}`);
            }
        }
    }
}

// kl.a(int,gd,int), including the wearable IDs used by lf.a(byte).
export class ObjType {
    name = 'null';
    mesh = 0;
    zoom = 2000;
    rotX = 0;
    rotY = 0;
    rotZ = 0;
    offsetX = 0;
    offsetY = 0;
    modelScale = [128, 128, 128];
    ambient = 0;
    contrast = 0;
    recolours: Pairs = [];
    retextures: Pairs = [];
    palette: number[] = [];
    wear = [
        [-1, -1, -1],
        [-1, -1, -1]
    ];
    head = [
        [-1, -1],
        [-1, -1]
    ];
    translation = [
        [0, 0, 0],
        [0, 0, 0]
    ];
    lentTemplate = -1;
    lent = -1;
    certTemplate = -1;
    cert = -1;
    countObj = new Int32Array(10);
    countCo = new Int32Array(10);
    team = 0;
    stackable = false;
    members = false;
    tradable = false;
    cost = 1;
    ops: (string | null)[] = [null, null, 'Take', null, null];
    iops: (string | null)[] = [null, null, null, null, 'Drop'];
    params = new Map<number, number | string>();

    constructor(data: Uint8Array) {
        const p = new Packet530(data);
        for (let op = p.g1(); op; op = p.g1()) {
            if (op >= 30 && op <= 39) {
                const value = p.gjstr();
                if (op < 35) this.ops[op - 30] = value.toLowerCase() === 'hidden' ? null : value;
                else this.iops[op - 35] = value;
                continue;
            }
            if (op >= 100 && op <= 109) {
                this.countObj[op - 100] = p.g2();
                this.countCo[op - 100] = p.g2();
                continue;
            }
            switch (op) {
                case 1:
                    this.mesh = p.g2();
                    break;
                case 2:
                    this.name = p.gjstr();
                    break;
                case 4:
                    this.zoom = p.g2();
                    break;
                case 5:
                    this.rotX = p.g2();
                    break;
                case 6:
                    this.rotY = p.g2();
                    break;
                case 7:
                    this.offsetX = p.g2s();
                    break;
                case 8:
                    this.offsetY = p.g2s();
                    break;
                case 11:
                    this.stackable = true;
                    break;
                case 12:
                    this.cost = p.g4();
                    break;
                case 16:
                    this.members = true;
                    break;
                case 23:
                    this.wear[0][0] = p.g2();
                    break;
                case 24:
                    this.wear[0][1] = p.g2();
                    break;
                case 25:
                    this.wear[1][0] = p.g2();
                    break;
                case 26:
                    this.wear[1][1] = p.g2();
                    break;
                case 40:
                    this.recolours = pairs(p);
                    break;
                case 41:
                    this.retextures = pairs(p);
                    break;
                case 42:
                    this.palette = Array.from({ length: p.g1() }, () => p.g1());
                    break;
                case 65:
                    this.tradable = true;
                    break;
                case 78:
                    this.wear[0][2] = p.g2();
                    break;
                case 79:
                    this.wear[1][2] = p.g2();
                    break;
                case 90:
                    this.head[0][0] = p.g2();
                    break;
                case 91:
                    this.head[1][0] = p.g2();
                    break;
                case 92:
                    this.head[0][1] = p.g2();
                    break;
                case 93:
                    this.head[1][1] = p.g2();
                    break;
                case 95:
                    this.rotZ = p.g2();
                    break;
                case 96:
                    p.g1();
                    break;
                case 97:
                    this.cert = p.g2();
                    break;
                case 98:
                    this.certTemplate = p.g2();
                    break;
                case 110:
                case 111:
                case 112:
                    this.modelScale[op - 110] = p.g2();
                    break;
                case 113:
                    this.ambient = p.g1s();
                    break;
                case 114:
                    this.contrast = p.g1s() * 5;
                    break;
                case 115:
                    this.team = p.g1();
                    break;
                case 121:
                    this.lent = p.g2();
                    break;
                case 122:
                    this.lentTemplate = p.g2();
                    break;
                case 125:
                case 126:
                    this.translation[op - 125] = [p.g1s(), p.g1s(), p.g1s()];
                    break;
                case 127:
                case 128:
                case 129:
                case 130:
                    p.m_pos = (p.m_pos + 3) | 0;
                    break;
                case 249:
                    this.params = params(p);
                    break;
                default:
                    throw new Error(`Unknown 530 obj opcode ${op}`);
            }
        }
    }

    derive(template: ObjType, base: ObjType, lent: boolean): void {
        this.mesh = template.mesh;
        this.zoom = template.zoom;
        this.rotX = template.rotX;
        this.rotY = template.rotY;
        this.rotZ = template.rotZ;
        this.offsetX = template.offsetX;
        this.offsetY = template.offsetY;
        this.name = base.name;
        this.members = base.members;
        const appearance = lent ? base : template;
        this.recolours = appearance.recolours;
        this.retextures = appearance.retextures;
        this.palette = appearance.palette;
        if (lent) {
            this.wear = base.wear;
            this.head = base.head;
            this.translation = base.translation;
            this.team = base.team;
            this.cost = 0;
            this.ops = base.ops;
            this.iops = [...base.iops.slice(0, 4), 'Discard'];
            this.params = base.params;
        } else {
            this.cost = base.cost;
            this.stackable = true;
        }
    }
}

export class IdkType {
    models: number[] = [];
    heads = new Int32Array(5).fill(-1);
    bodyPart = -1;
    disabled = false;
    recolours: Pairs = [];
    retextures: Pairs = [];
    constructor(data: Uint8Array) {
        const p = new Packet530(data);
        for (let op = p.g1(); op; op = p.g1()) {
            if (op === 1) this.bodyPart = p.g1();
            else if (op === 2) this.models = ids(p);
            else if (op === 3) this.disabled = true;
            else if (op === 40) this.recolours = pairs(p);
            else if (op === 41) this.retextures = pairs(p);
            else if (op >= 60 && op < 70) this.heads[op - 60] = p.g2();
            else throw new Error(`Unknown 530 IDK opcode ${op}`);
        }
    }
}

class ConfigArchive {
    readonly npcs = new Map<number, NpcType>();
    readonly kits = new Map<number, IdkType>();
    readonly objs = new Map<number, ObjType>();
    readonly rawObjs = new Map<number, ObjType>();
    readonly groups = new Set<number>();
    wearables?: number[];
}

const caches = new WeakMap<Js5Resources, ConfigArchive>();
function cache(assets: Js5Resources): ConfigArchive {
    let c = caches.get(assets);
    if (!c) caches.set(assets, (c = new ConfigArchive()));
    return c;
}

export function getNpcType(assets: Js5Resources, id: number): NpcType | null {
    const c = cache(assets);
    let npc = c.npcs.get(id);
    if (!npc && id >= 0) {
        const buf = assets.file(18, id >>> 7, id & 127);
        if (buf) c.npcs.set(id, (npc = new NpcType(buf)));
    }
    return npc ?? null;
}

export function getIdkType(assets: Js5Resources, id: number): IdkType | null {
    const c = cache(assets);
    let idk = c.kits.get(id);
    if (!idk && id >= 0) {
        const data = assets.file(2, 3, id);
        if (data) c.kits.set(id, (idk = new IdkType(data)));
    }
    return idk ?? null;
}

function loadObjGroup(assets: Js5Resources, c: ConfigArchive, group: number): boolean {
    if (c.groups.has(group)) return true;
    const files = assets.files(19, group);
    if (!files) return false;
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file) c.rawObjs.set(group * 256 + i, new ObjType(file));
    }
    c.groups.add(group);
    return true;
}

export function getObjType(assets: Js5Resources, id: number): ObjType | null {
    const c = cache(assets);
    const cached = c.objs.get(id);
    if (cached !== undefined) return cached;
    if (id < 0 || !loadObjGroup(assets, c, id >>> 8)) return null;
    const obj = c.rawObjs.get(id);
    if (!obj) return null;
    const lent = obj.lentTemplate >= 0;
    if (lent || obj.certTemplate >= 0) {
        const template = getObjType(assets, lent ? obj.lentTemplate : obj.certTemplate);
        const base = getObjType(assets, lent ? obj.lent : obj.cert);
        if (!template || !base) return null;
        obj.derive(template, base, lent);
    }
    c.objs.set(id, obj);
    return obj;
}

// lf.a(byte) runs after the object archive has loaded.
export function wearableIds(assets: Js5Resources): number[] | undefined {
    const c = cache(assets);
    if (c.wearables) return c.wearables;
    let ready = true;
    for (const group of requireNonNull(requireNonNull(assets.index(19)).groupIds)) if (!loadObjGroup(assets, c, group)) ready = false;
    if (!ready) return undefined;
    const ids: number[] = [];
    for (const group of requireNonNull(requireNonNull(assets.index(19)).groupIds)) {
        const fileIds = assets.archive(19).GetFileList(group);
        if (fileIds === null) throw new TypeError(`wearableIds: obj group ${group} has no file ids`);
        for (const i of fileIds) {
            const id = (group << 8) + i;
            const type = getObjType(assets, id);
            if (type === null) throw new TypeError(`wearableIds: obj ${id} could not be loaded`);
            if (type.wear[0][0] >= 0 || type.wear[1][0] >= 0) ids.push(id);
        }
    }
    return (c.wearables = ids);
}
