import type { SignlinkClass } from '#/util/Signlink';
import { JavaCheckedException } from '#/util/JavaException';

export class GamepackClassNotFound extends JavaCheckedException {}

export interface GamepackMember {
    readonly owner: string;
    readonly name: string;
    readonly descriptor: string;
    readonly modifiers: number;
}

let index: { declared: Map<string, { fields: string; methods: string }>; referenced: Set<string> } | undefined;

function reflectionIndex() {
    if (index) return index;
    // Keep the build-time choice at the require so Bun includes only this gamepack's declarations.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const declarations = ((process.env.RS530_GAMEPACK_IDENTITY === 'gl' ? require('./GamepackMembersHd') : require('./GamepackMembers')) as typeof import('./GamepackMembers')).default;
    const declared = new Map(declarations.map(([name, fields, methods]) => [name, { fields, methods }]));
    const referenced = new Set<string>(['java.lang.Object', 'java.lang.String']);
    for (const [, fields, methods] of declarations) for (const match of (fields + ' ' + methods).matchAll(/L([^;: ()]+);/g)) referenced.add(match[1].replaceAll('/', '.'));
    return (index = { declared, referenced });
}

// The browser represents a JVM Class with immutable declarations from the reference JAR.
export default class GamepackClass implements SignlinkClass {
    private constructor(
        readonly name: string,
        readonly descriptor: string
    ) {}

    // ab.a(ILjava/lang/String;)Ljava/lang/Class;
    static loadClass(name: string): GamepackClass {
        const { declared, referenced } = reflectionIndex();
        if (name.length === 1 && 'BISJZFDC'.includes(name)) return new GamepackClass(name, name);
        if (declared.has(name) || referenced.has(name)) return new GamepackClass(name, 'L' + name.replaceAll('.', '/') + ';');
        if (name.startsWith('[')) {
            const component = name.replace(/^\[+/, '');
            if (component.length === 1 && 'BISJZFDC'.includes(component)) return new GamepackClass(name, name);
            if (component[0] === 'L' && component.endsWith(';')) {
                const element = component.slice(1, -1);
                if (declared.has(element) || referenced.has(element)) return new GamepackClass(name, name.replaceAll('.', '/'));
            }
        }
        throw new GamepackClassNotFound(name);
    }

    getDeclaredField(name: string): GamepackMember {
        const row = reflectionIndex().declared.get(this.name);
        if (row !== undefined)
            for (const entry of row.fields.split(' ')) {
                const [field, descriptor, mods] = entry.split(':');
                if (descriptor !== undefined && field === name) return { owner: this.name, name, descriptor, modifiers: Number(mods) };
            }
        throw new Error('No declared field');
    }
    getDeclaredMethod(name: string, parameters: readonly SignlinkClass[] | null): GamepackMember {
        const signature =
            name +
            '(' +
            (parameters ?? [])
                .map(cls => {
                    if (!(cls instanceof GamepackClass)) throw new TypeError('Expected gamepack class');
                    return cls.descriptor;
                })
                .join('') +
            ')';
        const row = reflectionIndex().declared.get(this.name);
        if (row !== undefined)
            for (const entry of row.methods.split(' ')) {
                if (entry.startsWith(signature)) {
                    const [method, mods] = entry.split(':');
                    return { owner: this.name, name, descriptor: method.slice(name.length), modifiers: Number(mods) };
                }
            }
        throw new Error('No declared method');
    }
}
