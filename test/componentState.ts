import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import IfType from '#/ui/IfType.js';
import JagString from '#/datastruct/JagString.js';
import { arrayAt } from '#/util/JavaArray.js';
import ServerActiveProperties from '#/ui/ServerActiveProperties.js';

export function mix(hash: number, n: number): number {
    return (Math.imul(hash, 31) + n) | 0;
}

export function valueHash(value: unknown): number {
    if (value === null) return 0;
    if (value instanceof IfType) return (Math.imul(value.id, 31) + value.childId + 1) | 0;
    if (typeof value === 'number') return value;
    if (typeof value === 'boolean') return value ? 1231 : 1237;
    if (value instanceof ServerActiveProperties) return mix(value.events, value.targetParam);
    if (value instanceof JagString) {
        let h = 1;
        for (let i = 0; i < value.length; i++) h = mix(h, arrayAt(value.bytes, i));
        return h;
    }
    if (value instanceof Int32Array || value instanceof Int8Array || Array.isArray(value)) {
        let h = 1;
        for (const element of value) h = mix(h, valueHash(element));
        return h;
    }
    throw new Error('Unhandled component field ' + String(value));
}

export function componentFields() {
    const fields = [...readFileSync(resolve(import.meta.dir, '../src/ui/IfType.ts'), 'utf8').matchAll(/^ +\/\/ aj\.(\w+):([^\r\n]+)\r?\n +(\w+)/gm)].map(([, name, descriptor, member]) => ({
        name,
        descriptor,
        member: member as keyof IfType,
        hash: 1
    }));
    fields.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    return fields;
}
