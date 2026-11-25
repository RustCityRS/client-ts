import type PacketT from '#/io/PacketT';
import { arrayPutObj } from '#/util/JavaArray';

export default class BASType {
    m_crawlLeft: number; // mg.a:I
    m_readyTurnRight: number; // mg.b:I
    rollMax: number; // mg.d:I
    turnMax: number; // mg.f:I
    m_walkBackward: number; // mg.i:I
    m_hillRotateLength: number; // mg.j:I
    m_walkLeft: number; // mg.k:I
    roll: number; // mg.l:I
    m_walkRight: number; // mg.m:I
    m_runRight: number; // mg.n:I
    pitchMax: number; // mg.s:I
    walkAcceleration: number; // mg.t:I
    m_crawlRight: number; // mg.u:I
    m_crawlForward: number; // mg.v:I
    hillX: number; // mg.w:I
    pitch: number; // mg.x:I
    m_crawlBackward: number; // mg.y:I
    m_walkForward: number; // mg.z:I
    m_runBackward: number; // mg.A:I
    transforms: (Int32Array | null)[] | null = null; // mg.B:[[I
    ready: number; // mg.C:I
    rollAcceleration: number; // mg.E:I
    turnAcceleration: number; // mg.J:I
    m_runLeft: number; // mg.L:I
    pitchAcceleration: number; // mg.O:I
    m_readyTurnLeft: number; // mg.P:I
    m_runForward: number; // mg.R:I

    // mg.<init>()V
    constructor() {
        this.m_readyTurnRight = -1;
        this.m_crawlLeft = -1;
        this.m_hillRotateLength = 0;
        this.roll = 0;
        this.rollMax = 0;
        this.m_walkRight = -1;
        this.walkAcceleration = -1;
        this.turnMax = 0;
        this.m_crawlRight = -1;
        this.pitchMax = 0;
        this.m_runRight = -1;
        this.m_walkBackward = -1;
        this.ready = -1;
        this.rollAcceleration = 0;
        this.m_crawlBackward = -1;
        this.m_crawlForward = -1;
        this.pitch = 0;
        this.m_runLeft = -1;
        this.m_walkForward = -1;
        this.m_walkLeft = -1;
        this.m_readyTurnLeft = -1;
        this.pitchAcceleration = 0;
        this.m_runBackward = -1;
        this.turnAcceleration = 0;
        this.hillX = 0;
        this.m_runForward = -1;
    }

    // mg.a(Lgd;II)V
    private DecodeType(p: PacketT, opcode: number): void {
        switch (opcode) {
            case 1:
                this.ready = p.g2();
                this.m_walkForward = p.g2();
                if (this.ready === 65535) this.ready = -1;
                if (this.m_walkForward === 65535) this.m_walkForward = -1;
                break;
            case 2:
                this.m_crawlForward = p.g2();
                break;
            case 3:
                this.m_crawlBackward = p.g2();
                break;
            case 4:
                this.m_crawlLeft = p.g2();
                break;
            case 5:
                this.m_crawlRight = p.g2();
                break;
            case 6:
                this.m_runForward = p.g2();
                break;
            case 7:
                this.m_runBackward = p.g2();
                break;
            case 8:
                this.m_runLeft = p.g2();
                break;
            case 9:
                this.m_runRight = p.g2();
                break;
            case 26:
                this.hillX = p.g1() * 4;
                this.m_hillRotateLength = p.g1() * 4;
                break;
            case 27: {
                if (this.transforms === null) this.transforms = new Array<Int32Array | null>(12).fill(null);
                const slot = p.g1(),
                    matrix = new Int32Array(6);
                arrayPutObj(this.transforms, slot, matrix);
                for (let i = 0; i < 6; i++) matrix[i] = p.g2s();
                break;
            }
            case 29:
                this.turnAcceleration = p.g1();
                break;
            case 30:
                this.turnMax = p.g2();
                break;
            case 31:
                this.rollAcceleration = p.g1();
                break;
            case 32:
                this.rollMax = p.g2();
                break;
            case 33:
                this.roll = p.g2s();
                break;
            case 34:
                this.pitchAcceleration = p.g1();
                break;
            case 35:
                this.pitchMax = p.g2();
                break;
            case 36:
                this.pitch = p.g2s();
                break;
            case 37:
                this.walkAcceleration = p.g1();
                break;
            case 38:
                this.m_readyTurnLeft = p.g2();
                break;
            case 39:
                this.m_readyTurnRight = p.g2();
                break;
            case 40:
                this.m_walkBackward = p.g2();
                break;
            case 41:
                this.m_walkLeft = p.g2();
                break;
            case 42:
                this.m_walkRight = p.g2();
                break;
            case 43:
            case 44:
            case 45:
                p.g2();
                break;
        }
    }

    // mg.a(B)V
    PostDecode(): void {}

    // mg.a(Lgd;I)V
    Decode(p: PacketT): void {
        for (let opcode = p.g1(); opcode !== 0; opcode = p.g1()) this.DecodeType(p, opcode);
    }
}
