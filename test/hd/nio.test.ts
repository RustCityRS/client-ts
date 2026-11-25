import { expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import NioBuffer from '#/util/nio/Buffer.js';
import ByteBuffer, { type ByteArray } from '#/util/nio/ByteBuffer.js';
import ByteOrder from '#/util/nio/ByteOrder.js';
import FloatBuffer from '#/util/nio/FloatBuffer.js';
import IntBuffer from '#/util/nio/IntBuffer.js';
import ShortBuffer from '#/util/nio/ShortBuffer.js';
import BufferOverflowException from '#/util/nio/BufferOverflowException.js';
import BufferUnderflowException from '#/util/nio/BufferUnderflowException.js';
import InvalidMarkException from '#/util/nio/InvalidMarkException.js';
import ReadOnlyBufferException from '#/util/nio/ReadOnlyBufferException.js';
import { bufferByteRange, bufferBytes, bufferByteView, bufferElementSize, bufferKind } from '#/util/nio/BufferBytes.js';

// One corpus, two interpreters: NioOracle.java runs it on real java.nio, runCorpus below on src/util/nio.
// Line format: <n> <result> | <state of the target slot>[ arr=<array>][ src=<state of the source buffer>].
// State: kind, position, limit, capacity, mark, order, direct, read-only and every element of [0, capacity).
// Float results print f:NaN for any NaN: a JS number cannot carry a NaN payload (JavaScriptCore canonicalizes it),
// so get() is compared by value; stored bits are compared exactly through the state dumps and glbytes.

type Kind = 'byte' | 'short' | 'int' | 'float';

// float bit patterns that survive a trip through a JS number (no NaN other than the canonical 7fc00000)
const SAFE_FLOATS = ['00000000', '80000000', '3f800000', 'bf800000', '7f800000', 'ff800000', '7fc00000', '00000001', '807fffff', '7f7fffff', '42f6e979', 'c2c80000', '3eaaaaab', '00800000', '4b000001'];

function hex2(v: number): string {
    return (v & 0xff).toString(16).padStart(2, '0');
}

function scriptedCorpus(): string[] {
    const bytes = (n: number, from: number) => Array.from({ length: n }, (_, k) => hex2(from + k)).join(',');
    return [
        'nativeOrder',
        // creation and the java.nio defaults
        'allocate sB0 0',
        'allocate sBx -1',
        'allocateDirect sBy -1',
        'allocateDirect sB1 0',
        'dump sB0',
        'dump sB1',
        'allocate sB2 16',
        'allocateDirect sB3 16',
        'order sB2',
        'order sB3',
        'isDirect sB2',
        'isDirect sB3',
        'isReadOnly sB2',
        'isReadOnly sB3',
        'hasArray sB2',
        'hasArray sB3',
        'array sB2 sA9',
        'arrayOffset sB2',
        'array sB3 sA8',
        'arrayOffset sB3',
        'putAt sB2 3 77',
        'dumpArr sA9',
        'capacity sB2',
        'position sB2',
        'limit sB2',
        'remaining sB2',
        'hasRemaining sB2',
        // position, limit, mark, reset, flip, clear, rewind
        'setPosition sB2 4',
        'mark sB2',
        'setPosition sB2 8',
        'reset sB2',
        'setPosition sB2 2',
        'reset sB2',
        'mark sB2',
        'setLimit sB2 1',
        'reset sB2',
        'setLimit sB2 17',
        'setLimit sB2 -1',
        'setLimit sB2 16',
        'setPosition sB2 17',
        'setPosition sB2 -1',
        'setPosition sB2 16',
        'hasRemaining sB2',
        'remaining sB2',
        'setPosition sB2 5',
        'mark sB2',
        'setLimit sB2 5',
        'reset sB2',
        'setPosition sB2 5',
        'flip sB2',
        'reset sB2',
        'mark sB2',
        'clear sB2',
        'reset sB2',
        'setPosition sB2 3',
        'mark sB2',
        'rewind sB2',
        'reset sB2',
        'setLimit sB2 0',
        'hasRemaining sB2',
        'remaining sB2',
        'clear sB2',
        // relative and absolute single bytes
        'put sB2 1',
        'put sB2 -1',
        'put sB2 127',
        'put sB2 -128',
        'position sB2',
        'setLimit sB2 5',
        'put sB2 5',
        'put sB2 6',
        'flip sB2',
        'get sB2',
        'get sB2',
        'get sB2',
        'get sB2',
        'get sB2',
        'get sB2',
        'getAt sB2 -1',
        'getAt sB2 0',
        'getAt sB2 4',
        'getAt sB2 5',
        'putAt sB2 5 9',
        'putAt sB2 4 -7',
        'putAt sB2 -1 1',
        'clear sB2',
        // multi-byte values in both orders
        'putShort sB2 4660',
        'putInt sB2 305419896',
        'putFloat sB2 3f800000',
        'putShort sB2 -2',
        'putInt sB2 -2147483648',
        'putShort sB2 1',
        'dump sB2',
        'flip sB2',
        'getShort sB2',
        'getInt sB2',
        'getFloat sB2',
        'getShort sB2',
        'getInt sB2',
        'getShort sB2',
        'getShortAt sB2 14',
        'getShortAt sB2 15',
        'getIntAt sB2 12',
        'getIntAt sB2 13',
        'getIntAt sB2 -1',
        'getFloatAt sB2 2',
        'getFloatAt sB2 13',
        'setOrder sB2 LITTLE',
        'order sB2',
        'getShortAt sB2 0',
        'getIntAt sB2 2',
        'getFloatAt sB2 6',
        'putIntAt sB2 0 16909060',
        'putShortAt sB2 14 -300',
        'putFloatAt sB2 4 c2c80000',
        'dump sB2',
        'setOrder sB2 BIG',
        'getIntAt sB2 0',
        'setOrder sB2 NULL',
        'order sB2',
        'getIntAt sB2 0',
        'putShortAt sB2 15 1',
        'putIntAt sB2 13 1',
        'putFloatAt sB2 -1 00000000',
        'setPosition sB2 13',
        'getInt sB2',
        'putInt sB2 7',
        'putFloat sB2 00000000',
        'getFloat sB2',
        'putShort sB2 1',
        'getShort sB2',
        'dump sB2',
        'allocateDirect sB4 8',
        'setOrder sB4 LITTLE',
        'putInt sB4 -559038737',
        'putFloat sB4 7fc00000',
        'flip sB4',
        'getInt sB4',
        'getFloat sB4',
        'dump sB4',
        'glbytes sB4',
        // wrap, aliasing with the caller's array, bounds
        'bytes sA0 ' + bytes(10, 0),
        'bytes sA1 ' + bytes(10, 0x40),
        'wrap sB5 sA0',
        'dump sB5',
        'array sB5 sA2',
        'arrayOffset sB5',
        'put sB5 -86',
        'dumpArr sA0',
        'putAt sB5 9 85',
        'dumpArr sA0',
        'wrap3 sB6 sA0 2 5',
        'dump sB6',
        'arrayOffset sB6',
        'array sB6 sA2',
        'wrap3 sBz sA0 -1 3',
        'wrap3 sBz sA0 3 -1',
        'wrap3 sBz sA0 11 0',
        'wrap3 sB7 sA0 10 0',
        'dump sB7',
        'wrap3 sBz sA0 3 8',
        'wrap3 sBz sA0 1 2147483647',
        'wrap3 sBz sA0 2147483647 1',
        'nullarr sAn',
        'wrap sBz sAn',
        'wrap3 sBz sAn 0 0',
        'bytes sA3 -',
        'wrap sB8 sA3',
        'dump sB8',
        'get sB8',
        'put sB8 1',
        'glbytes sB8',
        // bulk get
        'bytes sA4 ' + bytes(8, 0xf0),
        'getArr sB6 sA4',
        'getArr3 sB6 sA4 1 5',
        'dump sB6',
        'getArr3 sB6 sA4 0 1',
        'getArr3 sB6 sA4 0 0',
        'getArr3 sB6 sA4 -1 1',
        'getArr3 sB6 sA4 8 1',
        'getArr3 sB6 sA4 4 5',
        'getArr3 sB6 sA4 7 2',
        'getArr3 sB6 sA4 8 0',
        'getArr3 sB6 sAn 0 0',
        'getArr sB6 sAn',
        'rewind sB6',
        'getArr3 sB6 sA4 0 7',
        'getArr3 sB6 sA4 0 2147483647',
        // bulk put
        'clear sB3',
        'putArr sB3 sA0',
        'putArr sB3 sA0',
        'putArr3 sB3 sA0 4 6',
        'dump sB3',
        'putArr3 sB3 sA0 0 1',
        'putArr3 sB3 sA0 9 2',
        'putArr3 sB3 sAn 0 0',
        'putArr sB3 sAn',
        'putArr3 sB3 sA0 3 0',
        'putArr3 sB3 sA0 -1 0',
        // overlapping copies within one array behave as memmove
        'wrap sB9 sA1',
        'setPosition sB9 2',
        'putArr3 sB9 sA1 0 8',
        'dumpArr sA1',
        'setPosition sB9 0',
        'putArr3 sB9 sA1 2 8',
        'dumpArr sA1',
        'wrap sB10 sA1',
        'setPosition sB10 1',
        'getArr3 sB10 sA1 3 6',
        'dumpArr sA1',
        // ByteBuffer.put(ByteBuffer)
        'putBuf sB3 sB3',
        'clear sB3',
        'wrap sB11 sA0',
        'putBuf sB3 sB11',
        'putBuf sB3 sB11',
        'rewind sB11',
        'putBuf sB3 sB11',
        'dump sB11',
        'nullarr sBn',
        'putBuf sB3 sBn',
        'flip sB3',
        'allocate sB12 4',
        'putBuf sB12 sB3',
        'setLimit sB3 4',
        'putBuf sB12 sB3',
        'clear sB12',
        'putBuf sB12 sB3',
        'dump sB12',
        'wrap sB13 sA1',
        'wrap sB14 sA1',
        'setLimit sB13 6',
        'setPosition sB14 3',
        'putBuf sB14 sB13',
        'dumpArr sA1',
        'setPosition sB13 3',
        'setLimit sB13 9',
        'setPosition sB14 0',
        'putBuf sB14 sB13',
        'dumpArr sA1',
        // views share storage; their order is the byte buffer's order when they are made
        'bytes sA5 ' + bytes(16, 0x10),
        'allocate sB15 16',
        'putArr sB15 sA5',
        'clear sB15',
        'asShort sS0 sB15',
        'dump sS0',
        'order sS0',
        'isDirect sS0',
        'isReadOnly sS0',
        'hasArray sS0',
        'array sS0 sA6',
        'arrayOffset sS0',
        'get sS0',
        'getAt sS0 7',
        'getAt sS0 8',
        'getAt sS0 -1',
        'put sS0 -1',
        'putAt sS0 7 4660',
        'putAt sS0 8 1',
        'dump sS0',
        'dump sB15',
        'setPosition sB15 3',
        'setOrder sB15 LITTLE',
        'asInt sI0 sB15',
        'dump sI0',
        'setOrder sB15 BIG',
        'dump sI0',
        'order sI0',
        'put sI0 1',
        'putAt sI0 2 -1',
        'putAt sI0 3 0',
        'dump sB15',
        'dump sS0',
        'asFloat sF0 sB15',
        'dump sF0',
        'getAt sF0 0',
        'put sF0 3f800000',
        'dump sB15',
        'position sB15',
        'setPosition sB15 15',
        'asInt sI1 sB15',
        'dump sI1',
        'get sI1',
        'put sI1 1',
        'asShort sS1 sB15',
        'dump sS1',
        'setPosition sB15 16',
        'asFloat sF1 sB15',
        'dump sF1',
        'setPosition sB15 1',
        'setLimit sB15 10',
        'asShort sS8 sB15',
        'dump sS8',
        'clear sB15',
        'allocateDirect sB16 12',
        'setOrder sB16 LITTLE',
        'asInt sI2 sB16',
        'isDirect sI2',
        'hasArray sI2',
        'array sI2 sA6',
        'put sI2 1',
        'put sI2 -2',
        'put sI2 2147483647',
        'put sI2 0',
        'dump sB16',
        'glbytes sI2',
        'flip sI2',
        'glbytes sI2',
        'setOrder sB16 BIG',
        'asShort sS2 sB16',
        'dump sS2',
        'glbytes sS2',
        'asFloat sF2 sB16',
        'glbytes sF2',
        'dump sF2',
        'isDirect sF2',
        // ShortBuffer
        'sallocate sS3 4',
        'sallocate sSx -1',
        'order sS3',
        'isDirect sS3',
        'hasArray sS3',
        'array sS3 sA7',
        'arrayOffset sS3',
        'put sS3 -32768',
        'put sS3 32767',
        'putAt sS3 3 1',
        'putAt sS3 4 1',
        'dumpArr sA7',
        'shorts sA10 1,2,3,4,5,6',
        'swrap sS4 sA10',
        'swrap3 sS5 sA10 1 4',
        'dump sS5',
        'swrap3 sSx sA10 5 2',
        'swrap sSx sAn',
        'putArr sS3 sA10',
        'putArr3 sS3 sA10 4 2',
        'dump sS3',
        'putArr3 sS3 sA10 5 2',
        'putArr sS3 sAn',
        'rewind sS3',
        'putBuf sS3 sS4',
        'putBuf sS3 sS3',
        'putBuf sS3 sS5',
        'dump sS3',
        'dump sS5',
        'putBuf sS2 sS4',
        'dump sS2',
        'dump sB16',
        'glbytes sS2',
        'rewind sS2',
        'get sS2',
        'get sS2',
        'getAt sS2 5',
        // IntBuffer
        'ints sA11 1,-1,2147483647,-2147483648',
        'iwrap sI3 sA11',
        'iwrap3 sI4 sA11 1 2',
        'dump sI4',
        'iwrap3 sIx sA11 -1 2',
        'iwrap sIx sAn',
        'iallocate sI5 6',
        'iallocate sIx -1',
        'order sI5',
        'putArr sI5 sA11',
        'put sI5 7',
        'putAt sI5 5 9',
        'put sI5 8',
        'put sI5 9',
        'dump sI5',
        'array sI3 sA12',
        'put sI3 42',
        'dumpArr sA11',
        'putBuf sI2 sI3',
        'dump sB16',
        'putBuf sI2 sI2',
        'setOrder sB16 BIG',
        'asInt sI6 sB16',
        'putBuf sI6 sI4',
        'dump sB16',
        'glbytes sI6',
        'clear sI6',
        'putArr3 sI6 sA11 1 3',
        'dump sB16',
        'putArr3 sI6 sA11 0 1',
        'putArr3 sI6 sAn 0 0',
        // FloatBuffer
        'floats sA13 3f800000,bf800000,7f800000,ff800000,00000001,80000000',
        'fwrap sF3 sA13',
        'fwrap3 sF4 sA13 2 3',
        'dump sF4',
        'fwrap3 sFx sA13 4 3',
        'fwrap sFx sAn',
        'fallocate sF5 4',
        'fallocate sFx -1',
        'order sF5',
        'get sF3',
        'getAt sF3 5',
        'getAt sF3 6',
        'put sF5 40490fdb',
        'putAt sF5 3 7fc00000',
        'putAt sF5 4 00000000',
        'getAt sF5 3',
        'putArr sF5 sA13',
        'putArr3 sF5 sA13 0 3',
        'dump sF5',
        'put sF5 3f800000',
        // read-only FloatBuffer (heap: HeapFloatBufferR)
        'setPosition sF3 2',
        'mark sF3',
        'setPosition sF3 3',
        'asRO sF6 sF3',
        'dump sF6',
        'reset sF6',
        'dump sF6',
        'dump sF3',
        'isReadOnly sF6',
        'hasArray sF6',
        'array sF6 sA14',
        'arrayOffset sF6',
        'isDirect sF6',
        'order sF6',
        'put sF6 3f800000',
        'putAt sF6 0 3f800000',
        'putAt sF6 99 00000000',
        'putArr sF6 sA13',
        'putArr sF6 sAn',
        'putArr3 sF6 sAn 0 0',
        'putArr3 sF6 sA13 -1 0',
        'putBuf sF6 sF6',
        'putBuf sF6 sF3',
        'get sF6',
        'getAt sF6 0',
        'dump sF6',
        'clear sF5',
        'putBuf sF5 sF6',
        'dump sF5',
        'asRO sF7 sF6',
        'isReadOnly sF7',
        'dump sF7',
        'putAt sF3 0 42f6e979',
        'getAt sF7 0',
        // read-only views (ByteBufferAsFloatBufferRB/RL, DirectFloatBufferRU)
        'asFloat sF8 sB15',
        'asRO sF9 sF8',
        'isReadOnly sF9',
        'hasArray sF9',
        'array sF9 sA15',
        'arrayOffset sF9',
        'putBuf sF9 sF9',
        'putBuf sF9 sF8',
        'put sF9 00000000',
        'putArr sF9 sA13',
        'dump sF9',
        'order sF9',
        'setOrder sB16 LITTLE',
        'asFloat sF10 sB16',
        'asRO sF11 sF10',
        'isDirect sF11',
        'putBuf sF11 sF11',
        'putBuf sF11 sF10',
        'getAt sF11 0',
        'order sF11',
        // float bits are moved, not converted: NaN payloads and a signalling NaN survive every bulk put
        'floats sA16 7fc00123,7f800001,ffc00000,ff800001,3f800000,00000000',
        'fwrap sF12 sA16',
        'dump sF12',
        'glbytes sF12',
        'allocate sB17 24',
        'asFloat sF13 sB17',
        'putArr sF13 sA16',
        'dump sF13',
        'dump sB17',
        'setOrder sB17 LITTLE',
        'asFloat sF14 sB17',
        'putBuf sF14 sF12',
        'dump sB17',
        'dump sF13',
        'allocateDirect sB18 24',
        'asFloat sF15 sB18',
        'rewind sF13',
        'putBuf sF15 sF13',
        'dump sB18',
        'glbytes sF15',
        'flip sF15',
        'glbytes sF15',
        'setOrder sB18 LITTLE',
        'asFloat sF16 sB18',
        'putArr sF16 sA16',
        'dump sB18',
        'getAt sF16 0',
        'getAt sF16 4',
        'fallocate sF18 6',
        'rewind sF12',
        'putBuf sF18 sF12',
        'dump sF18',
        'flip sF18',
        'glbytes sF18',
        // com.sun.opengl.util.BufferUtil.copy*: newByteBuffer(n) = allocateDirect(n).order(nativeOrder()); mark; put; reset; rewind
        'setPosition sB11 3',
        'remaining sB11',
        'allocateDirect sB19 7',
        'setOrder sB19 LITTLE',
        'mark sB11',
        'putBuf sB19 sB11',
        'reset sB11',
        'rewind sB19',
        'dump sB19',
        'dump sB11',
        'clear sF3',
        'setPosition sF3 1',
        'remaining sF3',
        'allocateDirect sB20 20',
        'setOrder sB20 LITTLE',
        'mark sF3',
        'asFloat sF17 sB20',
        'putBuf sF17 sF3',
        'reset sF3',
        'rewind sB20',
        'dump sB20',
        'glbytes sB20',
        'dump sF3',
        'clear sI3',
        'remaining sI3',
        'allocateDirect sB21 16',
        'setOrder sB21 LITTLE',
        'mark sI3',
        'asInt sI7 sB21',
        'putBuf sI7 sI3',
        'reset sI3',
        'rewind sB21',
        'glbytes sB21',
        'clear sS4',
        'remaining sS4',
        'allocateDirect sB22 12',
        'setOrder sB22 LITTLE',
        'mark sS4',
        'asShort sS6 sB22',
        'putBuf sS6 sS4',
        'reset sS4',
        'rewind sB22',
        'glbytes sB22',
        // JOGL mipmap access patterns: native-order heap buffer, views written by index, relative multi-byte reads
        'allocate sB23 8',
        'setOrder sB23 LITTLE',
        'asShort sS7 sB23',
        'putAt sS7 0 -2',
        'putAt sS7 3 258',
        'position sB23',
        'getShort sB23',
        'getShort sB23',
        'rewind sB23',
        'getInt sB23',
        'getIntAt sB23 4',
        'mark sB23',
        'get sB23',
        'reset sB23',
        'position sB23',
        'asInt sI8 sB23',
        'put sI8 -16777216',
        'asFloat sF19 sB23',
        'getAt sF19 0',
        'rewind sB23',
        'getFloat sB23',
        // GL bytes of [position, limit) for each kind
        'setPosition sB5 2',
        'setLimit sB5 6',
        'glbytes sB5',
        'glbytes sS3',
        'setPosition sS3 1',
        'glbytes sS3',
        'glbytes sF5',
        'glbytes sI5',
        'glbytes sF9',
        'glbytes sS0',
        'glbytes sF0',
        'glbytes sI0'
    ];
}

function randomCorpus(count: number): string[] {
    const lines: string[] = [];
    let seed = 0x2545f491;
    const next = () => {
        seed ^= seed << 13;
        seed ^= seed >>> 17;
        seed ^= seed << 5;
        return seed >>> 0;
    };
    const rnd = (n: number) => next() % n;
    function pick<T>(items: T[]): T {
        const item = items[rnd(items.length)];
        if (item === undefined) throw new Error('empty pick');
        return item;
    }
    type Buf = { name: string; kind: Kind; cap: number; heap: boolean; ro: boolean };
    type Arr = { name: string; kind: Kind; len: number };
    const bufs = new Map<string, Buf>();
    const arrs = new Map<string, Arr>();
    const value = (kind: Kind) => (kind === 'byte' ? String(rnd(256) - 128) : kind === 'short' ? String(rnd(65536) - 32768) : kind === 'int' ? String(next() | 0) : pick(SAFE_FLOATS));
    function array(name: string, kind: Kind, len: number) {
        const items = Array.from({ length: len }, () => (kind === 'byte' ? hex2(rnd(256)) : value(kind)));
        const command = kind === 'byte' ? 'bytes' : kind === 'short' ? 'shorts' : kind === 'int' ? 'ints' : 'floats';
        lines.push(command + ' ' + name + ' ' + (len === 0 ? '-' : items.join(',')));
        arrs.set(name, { name, kind, len });
    }
    function add(line: string, buf: Buf) {
        lines.push(line);
        bufs.set(buf.name, buf);
    }
    for (let k = 0; k < 6; k++) array('rA' + k, 'byte', k === 5 ? 0 : 4 + rnd(21));
    array('rA6', 'short', 9);
    array('rA7', 'short', 3);
    array('rA8', 'int', 7);
    array('rA9', 'int', 2);
    array('rA10', 'float', 8);
    array('rA11', 'float', 3);
    const len = (name: string) => {
        const a = arrs.get(name);
        if (a === undefined) throw new Error(name);
        return a.len;
    };
    add('allocate rB0 24', { name: 'rB0', kind: 'byte', cap: 24, heap: true, ro: false });
    add('allocateDirect rB1 24', { name: 'rB1', kind: 'byte', cap: 24, heap: false, ro: false });
    add('wrap rB2 rA0', { name: 'rB2', kind: 'byte', cap: len('rA0'), heap: true, ro: false });
    add('wrap3 rB3 rA1 1 ' + (len('rA1') - 2), { name: 'rB3', kind: 'byte', cap: len('rA1'), heap: true, ro: false });
    add('allocateDirect rB4 13', { name: 'rB4', kind: 'byte', cap: 13, heap: false, ro: false });
    add('allocate rB5 7', { name: 'rB5', kind: 'byte', cap: 7, heap: true, ro: false });
    add('sallocate rS0 9', { name: 'rS0', kind: 'short', cap: 9, heap: true, ro: false });
    add('swrap rS1 rA6', { name: 'rS1', kind: 'short', cap: 9, heap: true, ro: false });
    add('iallocate rI0 7', { name: 'rI0', kind: 'int', cap: 7, heap: true, ro: false });
    add('iwrap rI1 rA8', { name: 'rI1', kind: 'int', cap: 7, heap: true, ro: false });
    add('fallocate rF0 8', { name: 'rF0', kind: 'float', cap: 8, heap: true, ro: false });
    add('fwrap rF1 rA10', { name: 'rF1', kind: 'float', cap: 8, heap: true, ro: false });
    add('asRO rF2 rF1', { name: 'rF2', kind: 'float', cap: 8, heap: true, ro: true });
    let views = 0,
        ros = 0,
        arrays = 0;
    const index = (cap: number) => rnd(cap + 4) - 2;
    function range(arrLen: number): string {
        if (rnd(10) < 7) {
            const off = rnd(arrLen + 1);
            return off + ' ' + rnd(arrLen - off + 1);
        }
        return rnd(arrLen + 3) - 1 + ' ' + (rnd(arrLen + 3) - 1);
    }
    const common = [
        'position',
        'setPosition',
        'setPosition',
        'setPosition',
        'limit',
        'setLimit',
        'setLimit',
        'mark',
        'mark',
        'reset',
        'reset',
        'clear',
        'flip',
        'rewind',
        'remaining',
        'hasRemaining',
        'order',
        'capacity',
        'isDirect',
        'isReadOnly',
        'hasArray',
        'arrayOffset',
        'array',
        'dump',
        'glbytes'
    ];
    const byteOps = [
        'setOrder',
        'setOrder',
        'get',
        'get',
        'getAt',
        'getArr',
        'getArr3',
        'getArr3',
        'put',
        'put',
        'putAt',
        'putArr',
        'putArr3',
        'putArr3',
        'putBuf',
        'putBuf',
        'getShort',
        'getShortAt',
        'getInt',
        'getIntAt',
        'getFloat',
        'getFloatAt',
        'putShort',
        'putShortAt',
        'putInt',
        'putInt',
        'putIntAt',
        'putFloat',
        'putFloatAt'
    ];
    const typedOps = ['get', 'get', 'getAt', 'put', 'put', 'put', 'putAt', 'putArr', 'putArr3', 'putArr3', 'putBuf', 'putBuf'];
    while (lines.length < count) {
        const roll = rnd(100);
        const byteBufs = [...bufs.values()].filter(b => b.kind === 'byte');
        if (roll < 6) {
            const parent = pick(byteBufs);
            const kind = pick<Kind>(['short', 'int', 'float']);
            const name = 'rV' + (views++ % 10);
            add((kind === 'short' ? 'asShort ' : kind === 'int' ? 'asInt ' : 'asFloat ') + name + ' ' + parent.name, { name, kind, cap: parent.cap >> (kind === 'short' ? 1 : 2), heap: false, ro: false });
            continue;
        }
        if (roll < 8) {
            const source = pick([...bufs.values()].filter(b => b.kind === 'float'));
            const name = 'rR' + (ros++ % 4);
            if (name === source.name) continue;
            add('asRO ' + name + ' ' + source.name, { name, kind: 'float', cap: source.cap, heap: source.heap, ro: true });
            continue;
        }
        if (roll < 10) {
            lines.push('dumpArr ' + pick([...arrs.keys()]));
            continue;
        }
        const buf = pick([...bufs.values()]);
        const ops = buf.kind === 'byte' ? byteOps : typedOps;
        const op = rnd(100) < 40 ? pick(common) : pick(ops);
        const kindArrays = [...arrs.values()].filter(a => a.kind === buf.kind);
        const sameKind = [...bufs.values()].filter(b => b.kind === buf.kind);
        let line = op + ' ' + buf.name;
        switch (op) {
            case 'setPosition':
            case 'setLimit':
                line += ' ' + index(buf.cap);
                break;
            case 'array': {
                if (buf.heap && !buf.ro) {
                    const name = 'rY' + (arrays++ % 6);
                    line += ' ' + name;
                    lines.push(line);
                    arrs.set(name, { name, kind: buf.kind, len: buf.cap });
                    continue;
                }
                line += ' rZ';
                break;
            }
            case 'setOrder':
                line += ' ' + pick(['BIG', 'LITTLE', 'NULL']);
                break;
            case 'getAt':
            case 'getShortAt':
            case 'getIntAt':
            case 'getFloatAt':
                line += ' ' + index(buf.cap);
                break;
            case 'put':
                line += ' ' + value(buf.kind);
                break;
            case 'putAt':
                line += ' ' + index(buf.cap) + ' ' + value(buf.kind);
                break;
            case 'putShort':
                line += ' ' + value('short');
                break;
            case 'putInt':
                line += ' ' + value('int');
                break;
            case 'putFloat':
                line += ' ' + value('float');
                break;
            case 'putShortAt':
                line += ' ' + index(buf.cap) + ' ' + value('short');
                break;
            case 'putIntAt':
                line += ' ' + index(buf.cap) + ' ' + value('int');
                break;
            case 'putFloatAt':
                line += ' ' + index(buf.cap) + ' ' + value('float');
                break;
            case 'getArr':
            case 'putArr':
                line += ' ' + pick(kindArrays).name;
                break;
            case 'getArr3':
            case 'putArr3': {
                const a = pick(kindArrays);
                line += ' ' + a.name + ' ' + range(a.len);
                break;
            }
            case 'putBuf':
                line += ' ' + pick(sameKind).name;
                break;
        }
        lines.push(line);
    }
    return lines;
}

// ---- the TS interpreter ----

type JavaArray = ByteArray | Int16Array | Int32Array | Float32Array;
type Slot = NioBuffer | JavaArray | null;
class CorpusError extends Error {}

const f32 = new Float32Array(1);
const u32 = new Uint32Array(f32.buffer);
function floatBits(x: number): number {
    f32[0] = x;
    return u32[0] ?? 0;
}
function fromBits(hex: string): number {
    u32[0] = parseInt(hex, 16) >>> 0;
    return f32[0] ?? 0;
}
function f(x: number): string {
    return Number.isNaN(x) ? 'f:NaN' : 'f:' + floatBits(x).toString(16).padStart(8, '0');
}
function hex(bytes: Uint8Array): string {
    return Array.from(bytes, hex2).join('');
}

function exceptionName(e: unknown): string {
    if (e instanceof CorpusError) throw e;
    if (e instanceof BufferOverflowException) return 'BufferOverflowException';
    if (e instanceof BufferUnderflowException) return 'BufferUnderflowException';
    if (e instanceof InvalidMarkException) return 'InvalidMarkException';
    if (e instanceof ReadOnlyBufferException) return 'ReadOnlyBufferException';
    if (e instanceof TypeError && e.message === 'Null reference') return 'NullPointerException';
    if (e instanceof RangeError && e.message === 'IndexOutOfBoundsException') return 'IndexOutOfBoundsException';
    if (e instanceof Error && e.message.startsWith('IllegalArgumentException')) return 'IllegalArgumentException';
    if (e instanceof Error && e.message === 'UnsupportedOperationException') return 'UnsupportedOperationException';
    return 'HOST:' + String(e);
}

function orderOf(b: NioBuffer): ByteOrder {
    if (b instanceof ByteBuffer || b instanceof ShortBuffer || b instanceof IntBuffer || b instanceof FloatBuffer) return b.order();
    throw new CorpusError('not a buffer');
}

function runCorpus(lines: string[]): string[] {
    const slots = new Map<string, Slot>();
    const slot = (name: string | undefined): Slot => {
        if (name === undefined || !slots.has(name)) throw new CorpusError('no slot ' + name);
        return slots.get(name) ?? null;
    };
    const buffer = (name: string | undefined): NioBuffer => {
        const o = slot(name);
        if (!(o instanceof NioBuffer)) throw new CorpusError('not a buffer ' + name);
        return o;
    };
    // a null slot reaches the port as null, like a null Java reference
    const bytesArg = (name: string | undefined) => {
        const o = slot(name);
        if (o === null || o instanceof Int8Array || o instanceof Uint8Array) return o;
        throw new CorpusError('not bytes');
    };
    const shortsArg = (name: string | undefined) => {
        const o = slot(name);
        if (o === null || o instanceof Int16Array) return o;
        throw new CorpusError('not shorts');
    };
    const intsArg = (name: string | undefined) => {
        const o = slot(name);
        if (o === null || o instanceof Int32Array) return o;
        throw new CorpusError('not ints');
    };
    const floatsArg = (name: string | undefined) => {
        const o = slot(name);
        if (o === null || o instanceof Float32Array) return o;
        throw new CorpusError('not floats');
    };
    // Java casts null to any buffer type; the port's overloads then see null
    const byteBuffer = (name: string | undefined): ByteBuffer => {
        const o = slot(name);
        if (o instanceof ByteBuffer) return o;
        if (o === null) return o as unknown as ByteBuffer;
        throw new CorpusError('not a ByteBuffer');
    };
    const shortBuffer = (name: string | undefined): ShortBuffer => {
        const o = slot(name);
        if (o instanceof ShortBuffer) return o;
        if (o === null) return o as unknown as ShortBuffer;
        throw new CorpusError('not a ShortBuffer');
    };
    const intBuffer = (name: string | undefined): IntBuffer => {
        const o = slot(name);
        if (o instanceof IntBuffer) return o;
        if (o === null) return o as unknown as IntBuffer;
        throw new CorpusError('not an IntBuffer');
    };
    const floatBuffer = (name: string | undefined): FloatBuffer => {
        const o = slot(name);
        if (o instanceof FloatBuffer) return o;
        if (o === null) return o as unknown as FloatBuffer;
        throw new CorpusError('not a FloatBuffer');
    };
    const n = (s: string | undefined) => {
        if (s === undefined) throw new CorpusError('missing arg');
        return parseInt(s, 10);
    };
    const bits = (s: string | undefined) => {
        if (s === undefined) throw new CorpusError('missing arg');
        return fromBits(s);
    };
    const self = (returned: unknown, target: unknown) => (returned === target ? 'this' : 'other');
    const tf = (v: boolean) => (v ? 'T' : 'F');

    function identity(a: unknown): string {
        for (const [name, value] of slots) if (value === a) return 'same:' + name;
        return 'new';
    }

    function parseArray(kind: string, name: string, body: string): Slot {
        if (kind === 'nullarr') return null;
        const parts = body === '-' ? [] : body.split(',');
        if (kind === 'bytes') {
            // the port takes byte[] as either typed array: alternate them by slot name
            const a = (name.charCodeAt(name.length - 1) & 1) === 0 ? new Int8Array(parts.length) : new Uint8Array(parts.length);
            parts.forEach((p, k) => {
                a[k] = parseInt(p, 16);
            });
            return a;
        }
        if (kind === 'shorts') return Int16Array.from(parts, p => parseInt(p, 10));
        if (kind === 'ints') return Int32Array.from(parts, p => parseInt(p, 10));
        const a = new Float32Array(parts.length);
        const raw = new Uint32Array(a.buffer);
        parts.forEach((p, k) => {
            raw[k] = parseInt(p, 16) >>> 0;
        });
        return a;
    }

    function dumpArr(name: string | undefined): string {
        if (name === undefined || !slots.has(name)) return 'none';
        const a = slots.get(name) ?? null;
        if (a === null) return 'null';
        if (a instanceof Int8Array || a instanceof Uint8Array) return 'b:' + hex(new Uint8Array(a.buffer, a.byteOffset, a.length));
        if (a instanceof Int16Array) return 's:' + Array.from(a).join(',');
        if (a instanceof Int32Array) return 'i:' + Array.from(a).join(',');
        if (a instanceof Float32Array) return 'f:' + Array.from(new Uint32Array(a.buffer, a.byteOffset, a.length), v => v.toString(16).padStart(8, '0')).join(',');
        throw new CorpusError('not an array');
    }

    function state(name: string): string {
        if (!slots.has(name)) return name + ' none';
        const o = slots.get(name) ?? null;
        if (o === null) return name + ' null';
        if (!(o instanceof NioBuffer)) return name + ' array';
        const size = bufferElementSize(o);
        const little = orderOf(o) === ByteOrder.LITTLE_ENDIAN;
        const raw = bufferByteRange(o, 0, o.capacity());
        const view = new DataView(raw.buffer, raw.byteOffset, raw.byteLength);
        const items: string[] = [];
        for (let k = 0; k < o.capacity(); k++) {
            if (size === 1) items.push(hex2(view.getUint8(k)));
            else if (size === 2)
                items.push(
                    view
                        .getUint16(k * 2, little)
                        .toString(16)
                        .padStart(4, '0')
                );
            else
                items.push(
                    view
                        .getUint32(k * 4, little)
                        .toString(16)
                        .padStart(8, '0')
                );
        }
        return (
            name +
            ' ' +
            bufferKind(o) +
            ' p=' +
            o.position() +
            ' l=' +
            o.limit() +
            ' c=' +
            o.capacity() +
            ' m=' +
            o.markValue() +
            ' o=' +
            (little ? 'L' : 'B') +
            ' d=' +
            (o.isDirect() ? 1 : 0) +
            ' r=' +
            (o.isReadOnly() ? 1 : 0) +
            ' [' +
            items.join(size === 1 ? '' : ',') +
            ']'
        );
    }

    function common(op: string, b: NioBuffer, t: string[]): string | null {
        switch (op) {
            case 'capacity':
                return '' + b.capacity();
            case 'position':
                return '' + b.position();
            case 'setPosition':
                return self(b.position(n(t[2])), b);
            case 'limit':
                return '' + b.limit();
            case 'setLimit':
                return self(b.limit(n(t[2])), b);
            case 'mark':
                return self(b.mark(), b);
            case 'reset':
                return self(b.reset(), b);
            case 'clear':
                return self(b.clear(), b);
            case 'flip':
                return self(b.flip(), b);
            case 'rewind':
                return self(b.rewind(), b);
            case 'remaining':
                return '' + b.remaining();
            case 'hasRemaining':
                return tf(b.hasRemaining());
            case 'isDirect':
                return tf(b.isDirect());
            case 'isReadOnly':
                return tf(b.isReadOnly());
            case 'hasArray':
                return tf(b.hasArray());
            case 'arrayOffset':
                return '' + b.arrayOffset();
            case 'array': {
                const a = b.array();
                const id = identity(a);
                const name = t[2];
                if (name === undefined) throw new CorpusError('missing arg');
                slots.set(name, a);
                return id;
            }
            case 'order':
                return orderOf(b).toString();
            default:
                return null;
        }
    }

    function byteOp(op: string, b: ByteBuffer, t: string[]): string {
        switch (op) {
            case 'setOrder':
                return self(b.order(t[2] === 'BIG' ? ByteOrder.BIG_ENDIAN : t[2] === 'LITTLE' ? ByteOrder.LITTLE_ENDIAN : null), b);
            case 'get':
                return '' + b.get();
            case 'getAt':
                return '' + b.get(n(t[2]));
            case 'getArr':
                return self(b.get(bytesArg(t[2])), b);
            case 'getArr3':
                return self(b.get(bytesArg(t[2]), n(t[3]), n(t[4])), b);
            case 'put':
                return self(b.put(n(t[2])), b);
            case 'putAt':
                return self(b.put(n(t[2]), n(t[3])), b);
            case 'putArr':
                return self(b.put(bytesArg(t[2])), b);
            case 'putArr3':
                return self(b.put(bytesArg(t[2]), n(t[3]), n(t[4])), b);
            case 'putBuf':
                return self(b.put(byteBuffer(t[2])), b);
            case 'getShort':
                return '' + b.getShort();
            case 'getShortAt':
                return '' + b.getShort(n(t[2]));
            case 'getInt':
                return '' + b.getInt();
            case 'getIntAt':
                return '' + b.getInt(n(t[2]));
            case 'getFloat':
                return f(b.getFloat());
            case 'getFloatAt':
                return f(b.getFloat(n(t[2])));
            case 'putShort':
                return self(b.putShort(n(t[2])), b);
            case 'putShortAt':
                return self(b.putShort(n(t[2]), n(t[3])), b);
            case 'putInt':
                return self(b.putInt(n(t[2])), b);
            case 'putIntAt':
                return self(b.putInt(n(t[2]), n(t[3])), b);
            case 'putFloat':
                return self(b.putFloat(bits(t[2])), b);
            case 'putFloatAt':
                return self(b.putFloat(n(t[2]), bits(t[3])), b);
            default:
                throw new CorpusError('bad byte op ' + op);
        }
    }

    function shortOp(op: string, b: ShortBuffer, t: string[]): string {
        switch (op) {
            case 'get':
                return '' + b.get();
            case 'getAt':
                return '' + b.get(n(t[2]));
            case 'put':
                return self(b.put(n(t[2])), b);
            case 'putAt':
                return self(b.put(n(t[2]), n(t[3])), b);
            case 'putArr':
                return self(b.put(shortsArg(t[2])), b);
            case 'putArr3':
                return self(b.put(shortsArg(t[2]), n(t[3]), n(t[4])), b);
            case 'putBuf':
                return self(b.put(shortBuffer(t[2])), b);
            default:
                throw new CorpusError('bad short op ' + op);
        }
    }

    function intOp(op: string, b: IntBuffer, t: string[]): string {
        switch (op) {
            case 'get':
                return '' + b.get();
            case 'getAt':
                return '' + b.get(n(t[2]));
            case 'put':
                return self(b.put(n(t[2])), b);
            case 'putAt':
                return self(b.put(n(t[2]), n(t[3])), b);
            case 'putArr':
                return self(b.put(intsArg(t[2])), b);
            case 'putArr3':
                return self(b.put(intsArg(t[2]), n(t[3]), n(t[4])), b);
            case 'putBuf':
                return self(b.put(intBuffer(t[2])), b);
            default:
                throw new CorpusError('bad int op ' + op);
        }
    }

    function floatOp(op: string, b: FloatBuffer, t: string[]): string {
        switch (op) {
            case 'get':
                return f(b.get());
            case 'getAt':
                return f(b.get(n(t[2])));
            case 'put':
                return self(b.put(bits(t[2])), b);
            case 'putAt':
                return self(b.put(n(t[2]), bits(t[3])), b);
            case 'putArr':
                return self(b.put(floatsArg(t[2])), b);
            case 'putArr3':
                return self(b.put(floatsArg(t[2]), n(t[3]), n(t[4])), b);
            case 'putBuf':
                return self(b.put(floatBuffer(t[2])), b);
            default:
                throw new CorpusError('bad float op ' + op);
        }
    }

    function run(t: string[]): string {
        const op = t[0] ?? '';
        let target: string | null = t[1] ?? null;
        let result: string;
        let extra = '';
        const put = (name: string | undefined, value: Slot) => {
            if (name === undefined) throw new CorpusError('missing slot');
            slots.set(name, value);
        };
        try {
            switch (op) {
                case 'nativeOrder':
                    result = ByteOrder.nativeOrder().toString();
                    target = null;
                    break;
                case 'bytes':
                case 'shorts':
                case 'ints':
                case 'floats':
                case 'nullarr':
                    put(t[1], parseArray(op, t[1] ?? '', t[2] ?? '-'));
                    return 'ok | arr=' + dumpArr(t[1]);
                case 'dumpArr':
                    return 'ok | arr=' + dumpArr(t[1]);
                case 'allocate':
                    put(t[1], ByteBuffer.allocate(n(t[2])));
                    result = 'ok';
                    break;
                case 'allocateDirect':
                    put(t[1], ByteBuffer.allocateDirect(n(t[2])));
                    result = 'ok';
                    break;
                case 'wrap':
                    put(t[1], ByteBuffer.wrap(bytesArg(t[2])));
                    result = 'ok';
                    break;
                case 'wrap3':
                    put(t[1], ByteBuffer.wrap(bytesArg(t[2]), n(t[3]), n(t[4])));
                    result = 'ok';
                    break;
                case 'sallocate':
                    put(t[1], ShortBuffer.allocate(n(t[2])));
                    result = 'ok';
                    break;
                case 'swrap':
                    put(t[1], ShortBuffer.wrap(shortsArg(t[2])));
                    result = 'ok';
                    break;
                case 'swrap3':
                    put(t[1], ShortBuffer.wrap(shortsArg(t[2]), n(t[3]), n(t[4])));
                    result = 'ok';
                    break;
                case 'iallocate':
                    put(t[1], IntBuffer.allocate(n(t[2])));
                    result = 'ok';
                    break;
                case 'iwrap':
                    put(t[1], IntBuffer.wrap(intsArg(t[2])));
                    result = 'ok';
                    break;
                case 'iwrap3':
                    put(t[1], IntBuffer.wrap(intsArg(t[2]), n(t[3]), n(t[4])));
                    result = 'ok';
                    break;
                case 'fallocate':
                    put(t[1], FloatBuffer.allocate(n(t[2])));
                    result = 'ok';
                    break;
                case 'fwrap':
                    put(t[1], FloatBuffer.wrap(floatsArg(t[2])));
                    result = 'ok';
                    break;
                case 'fwrap3':
                    put(t[1], FloatBuffer.wrap(floatsArg(t[2]), n(t[3]), n(t[4])));
                    result = 'ok';
                    break;
                case 'asShort':
                    put(t[1], byteBuffer(t[2]).asShortBuffer());
                    result = 'ok';
                    break;
                case 'asInt':
                    put(t[1], byteBuffer(t[2]).asIntBuffer());
                    result = 'ok';
                    break;
                case 'asFloat':
                    put(t[1], byteBuffer(t[2]).asFloatBuffer());
                    result = 'ok';
                    break;
                case 'asRO':
                    put(t[1], floatBuffer(t[2]).asReadOnlyBuffer());
                    result = 'ok';
                    break;
                case 'dump':
                    result = 'ok';
                    break;
                case 'glbytes':
                    result = 'g:' + hex(bufferBytes(buffer(t[1])));
                    break;
                default: {
                    const o = buffer(t[1]);
                    const shared = common(op, o, t);
                    if (shared !== null) {
                        result = shared;
                        if (op === 'array') extra = ' arr=' + dumpArr(t[2]);
                    } else if (o instanceof ByteBuffer) {
                        result = byteOp(op, o, t);
                    } else if (o instanceof ShortBuffer) {
                        result = shortOp(op, o, t);
                    } else if (o instanceof IntBuffer) {
                        result = intOp(op, o, t);
                    } else if (o instanceof FloatBuffer) {
                        result = floatOp(op, o, t);
                    } else {
                        throw new CorpusError('bad slot ' + t[1]);
                    }
                    if (op.startsWith('getArr') || op.startsWith('putArr')) extra = ' arr=' + dumpArr(t[2]);
                    if (op === 'putBuf') extra = ' src=' + state(t[2] ?? '');
                }
            }
        } catch (e) {
            result = '!' + exceptionName(e);
            if (op.startsWith('getArr') || op.startsWith('putArr') || op === 'array') extra = ' arr=' + dumpArr(t[2]);
            if (op === 'putBuf') extra = ' src=' + state(t[2] ?? '');
        }
        return result + ' | ' + (target === null ? '-' : state(target)) + extra;
    }

    return lines.map((line, k) => k + ' ' + run(line.split(' ')));
}

// every java.nio member the HD jar, JOGL's GLU/mipmap code, BufferUtil and the GL mirror use (nio-surface.txt)
const REQUIRED_OPS = [
    'nativeOrder',
    'allocate',
    'allocateDirect',
    'wrap',
    'wrap3',
    'sallocate',
    'swrap',
    'swrap3',
    'iallocate',
    'iwrap',
    'iwrap3',
    'fallocate',
    'fwrap',
    'fwrap3',
    'asShort',
    'asInt',
    'asFloat',
    'asRO',
    'capacity',
    'position',
    'setPosition',
    'limit',
    'setLimit',
    'mark',
    'reset',
    'clear',
    'flip',
    'rewind',
    'remaining',
    'hasRemaining',
    'isDirect',
    'isReadOnly',
    'hasArray',
    'array',
    'arrayOffset',
    'order',
    'setOrder',
    'get',
    'getAt',
    'getArr',
    'getArr3',
    'put',
    'putAt',
    'putArr',
    'putArr3',
    'putBuf',
    'getShort',
    'getShortAt',
    'getInt',
    'getIntAt',
    'getFloat',
    'getFloatAt',
    'putShort',
    'putShortAt',
    'putInt',
    'putIntAt',
    'putFloat',
    'putFloatAt',
    'glbytes'
];
const EXCEPTIONS = ['BufferOverflowException', 'BufferUnderflowException', 'InvalidMarkException', 'ReadOnlyBufferException', 'IndexOutOfBoundsException', 'IllegalArgumentException', 'NullPointerException', 'UnsupportedOperationException'];

test('GL can borrow the addressed storage synchronously or retain a snapshot', () => {
    for (const order of [ByteOrder.BIG_ENDIAN, ByteOrder.LITTLE_ENDIAN]) {
        const memory = new Uint8Array(40);
        const raw = ByteBuffer.wrap(memory.subarray(3, 35)).order(order);
        raw.position(2);
        for (const buf of [raw, raw.asShortBuffer(), raw.asIntBuffer(), raw.asFloatBuffer()]) {
            const size = bufferElementSize(buf);
            const start = (buf === raw ? 3 : 5) + size;
            buf.limit(1);
            const borrowed = bufferByteView(buf, 1, 3);
            const saved = bufferByteRange(buf, 1, 3);
            expect(borrowed.byteLength).toBe(2 * size);
            expect(borrowed.buffer).toBe(memory.buffer);
            expect(borrowed.byteOffset).toBe(start);
            memory[start] ^= 255;
            expect(borrowed[0]).toBe(memory[start]);
            expect(saved[0]).toBe(255 ^ borrowed[0]);
            expect(buf.limit()).toBe(1);
            expect(() => bufferByteView(buf, 0, buf.capacity() + 1)).toThrow();
        }
    }
});

test('java.nio port matches real java.nio line by line over the scripted and random corpus', () => {
    const corpus = [...scriptedCorpus(), ...randomCorpus(1600)];
    expect(corpus.length).toBeGreaterThanOrEqual(400);
    const used = new Set(corpus.map(line => line.split(' ')[0]));
    for (const op of REQUIRED_OPS) expect(used.has(op), op).toBe(true);

    const dir = mkdtempSync(join(tmpdir(), 'rs530-nio-'));
    try {
        const compile = Bun.spawnSync(['javac', '-d', dir, join(import.meta.dir, 'NioOracle.java')]);
        expect(compile.exitCode, compile.stderr.toString()).toBe(0);
        const run = Bun.spawnSync(['java', '--add-opens', 'java.base/java.nio=ALL-UNNAMED', '-cp', dir, 'NioOracle'], {
            stdin: Buffer.from(corpus.join('\n') + '\n'),
            maxBuffer: 32 * 1024 * 1024,
            timeout: 50000
        });
        expect(run.exitCode, run.stderr.toString()).toBe(0);
        const java = run.stdout.toString().trimEnd().split(/\r?\n/);
        expect(java.length).toBe(corpus.length);
        for (const name of EXCEPTIONS)
            expect(
                java.some(line => line.includes(' !' + name + ' ')),
                name
            ).toBe(true);

        const ts = runCorpus(corpus);
        const mismatches: string[] = [];
        for (let k = 0; k < corpus.length; k++) {
            if (ts[k] !== java[k]) mismatches.push('#' + k + ' ' + corpus[k] + '\n  java: ' + java[k] + '\n  ts:   ' + ts[k]);
        }
        expect(mismatches.slice(0, 10).join('\n')).toBe('');
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
}, 60000);
