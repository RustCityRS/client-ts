import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';
import { GL, GLConstants, glMethods } from '#/jogl/GL.js';
import GLCapabilities from '#/jogl/GLCapabilities.js';
import GLContext from '#/jogl/GLContext.js';
import type GLDrawable from '#/jogl/GLDrawable.js';
import GLDrawableFactory, { registerGLDrawableFactory } from '#/jogl/GLDrawableFactory.js';
import GLException from '#/jogl/GLException.js';
import { isJavaRuntimeException, JavaError } from '#/util/JavaException.js';
import { inventory } from '../render/hd-jogl-inventory.js';
import { hdGamepackPath, joglPath } from '../render/hd-reference.js';

// The JOGL mirror in src/jogl against the shipped jogl.jar and runescape_gl.jar.
//
// Constant values. The shipped javax.media.opengl.GL has no fields: javac inlined every GL_* constant and
// ProGuard dropped them. So the values are checked against javap -constants of two other generators:
// JOGL 2 (the javax.media.opengl lineage, renamed com.jogamp.opengl) and LWJGL 3. Both outputs are kept
// in jogl-constants.javap.txt, filtered to the declared names. Regenerate it after changing the names
// (bash; JBR = a JetBrains Runtime with JCEF, which bundles JOGL 2 as module jogl.all; LWJGL = an LWJGL 3
// lwjgl-opengl jar; jimage and javap from a JDK 21):
//   T=$(mktemp -d); jimage extract --dir "$T" --include 'regex:/jogl\.all/com/jogamp/opengl/.*' "$JBR/lib/modules"
//   names=$( (grep -oE '^ +GL_[A-Z0-9_]+:' src/jogl/GL.ts | tr -d ' :'; echo CONTEXT_NOT_CURRENT CONTEXT_CURRENT CONTEXT_CURRENT_NEW) | tr '\n' ' ' | xargs | tr ' ' '|')
//   { javap -cp "$T/jogl.all" -constants com.jogamp.opengl.{GL,GL2ES1,GL2ES2,GL2ES3,GL2GL3,GL2,GL3,GL3ES3,GL3bc,GL4,GL4ES3,GL4bc,GLES1,GLES2,GLES3,GLContext} com.jogamp.opengl.fixedfunc.{GLLightingFunc,GLMatrixFunc,GLPointerFunc}
//     javap -cp "$LWJGL" -constants org.lwjgl.opengl.GL{11,12,13,14,15,20,21}{C,} org.lwjgl.opengl.ARB{Vertex,Fragment}Program
//   } | grep -E "^public |static final int ($names) =" | tr -d '\r' > "$T/body"
//   { head -4 test/hd/jogl-constants.javap.txt; cat "$T/body"; } > "$T/new" && mv "$T/new" test/hd/jogl-constants.javap.txt
//   (the first four lines are '#' provenance comments; update the JOGL/LWJGL versions there if they change)
//
// Constant coverage. JoglSurfaceOracle.java propagates constants through the bytecode of every JOGL call
// site. The declared set must equal, value for value, the union of:
// - the GL enums runescape_gl.jar passes;
// - the GL enums jogl.jar's GLU mipmap code passes or compares;
// - the GL enums JOGL's own implementation queries (GL_EXTENSIONS).

const root = join(import.meta.dir, '..', '..');
const source = (file: string) => join(root, 'src', 'jogl', file);

function run(command: string[]): string {
    const result = Bun.spawnSync(command, { stdout: 'pipe', stderr: 'pipe' });
    if (result.exitCode !== 0) throw new Error(command.join(' ') + '\n' + result.stderr.toString());
    return result.stdout.toString().replaceAll('\r\n', '\n');
}

// ---- TS declarations to JVM descriptors ----

const referenceDescriptors: Record<string, string> = {
    GLenum: 'I',
    GLbitfield: 'I',
    GLint: 'I',
    GLuint: 'I',
    GLsizei: 'I',
    GLsizeiptrARB: 'I',
    GLintptrARB: 'I',
    GLfloat: 'F',
    GLclampf: 'F',
    GLdouble: 'D',
    GLclampd: 'D',
    GLubyte: 'B',
    GLboolean: 'Z',
    Float32Array: '[F',
    Int32Array: '[I',
    Buffer: 'Ljava/nio/Buffer;',
    FloatBuffer: 'Ljava/nio/FloatBuffer;',
    Error: 'Ljava/lang/Throwable;',
    GL: 'Ljavax/media/opengl/GL;',
    GLContext: 'Ljavax/media/opengl/GLContext;',
    GLDrawable: 'Ljavax/media/opengl/GLDrawable;',
    GLDrawableFactory: 'Ljavax/media/opengl/GLDrawableFactory;',
    GLCapabilities: 'Ljavax/media/opengl/GLCapabilities;',
    GLCapabilitiesChooser: 'Ljavax/media/opengl/GLCapabilitiesChooser;'
};

const isNull = (type: ts.TypeNode) => ts.isLiteralTypeNode(type) && type.literal.kind === ts.SyntaxKind.NullKeyword;

// Each alternative a TS type stands for: `string | Error | null` is two Java parameter types.
function typeDescriptors(type: ts.TypeNode | undefined): { descriptor: string; text: string }[] {
    if (type === undefined) throw new Error('Unannotated declaration');
    if (ts.isParenthesizedTypeNode(type)) return typeDescriptors(type.type);
    if (ts.isUnionTypeNode(type)) return type.types.filter(t => !isNull(t)).flatMap(typeDescriptors);
    if (ts.isArrayTypeNode(type)) return typeDescriptors(type.elementType).map(e => ({ descriptor: '[' + e.descriptor, text: e.text + '[]' }));
    const keyword: Partial<Record<ts.SyntaxKind, string>> = {
        [ts.SyntaxKind.NumberKeyword]: 'I',
        [ts.SyntaxKind.BooleanKeyword]: 'Z',
        [ts.SyntaxKind.StringKeyword]: 'Ljava/lang/String;',
        [ts.SyntaxKind.BigIntKeyword]: 'J',
        [ts.SyntaxKind.VoidKeyword]: 'V',
        [ts.SyntaxKind.ObjectKeyword]: 'Ljava/lang/Object;'
    };
    const descriptor = keyword[type.kind];
    if (descriptor !== undefined) return [{ descriptor, text: type.getText() }];
    if (ts.isTypeReferenceNode(type)) {
        const name = type.typeName.getText();
        const mapped = referenceDescriptors[name];
        if (mapped === undefined) throw new Error('No JVM type for ' + name);
        return [{ descriptor: mapped, text: name }];
    }
    throw new Error('No JVM type for ' + type.getText());
}

interface Member {
    name: string;
    descriptor: string;
    params: string[];
}

// The non-private methods and constructors of one class or interface, one entry per Java overload.
function declaredMembers(file: string, typeName: string): Member[] {
    const text = readFileSync(source(file), 'utf8');
    const unit = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
    let declaration: ts.ClassDeclaration | ts.InterfaceDeclaration | undefined;
    unit.forEachChild(node => {
        if ((ts.isClassDeclaration(node) || ts.isInterfaceDeclaration(node)) && node.name?.text === typeName) declaration = node;
    });
    if (declaration === undefined) throw new Error(typeName + ' not declared in ' + file);
    const members: Member[] = [];
    let constructors = 0;
    for (const member of declaration.members) {
        if (!(ts.isMethodSignature(member) || ts.isMethodDeclaration(member) || ts.isConstructorDeclaration(member))) continue;
        if (ts.canHaveModifiers(member) && ts.getModifiers(member)?.some(m => m.kind === ts.SyntaxKind.PrivateKeyword)) continue;
        const name = ts.isConstructorDeclaration(member) ? '<init>' : member.name.getText();
        if (name === '<init>') constructors++;
        let returns;
        if (ts.isConstructorDeclaration(member)) {
            returns = 'V';
        } else {
            returns = typeDescriptors(member.type)
                .map(t => t.descriptor)
                .join('|');
        }
        let forms: { descriptors: string[]; params: string[] }[] = [{ descriptors: [], params: [] }];
        for (const parameter of member.parameters) {
            const alternatives = typeDescriptors(parameter.type);
            const next = forms.flatMap(form => alternatives.map(a => ({ descriptors: [...form.descriptors, a.descriptor], params: [...form.params, a.text] })));
            forms = parameter.initializer !== undefined || parameter.questionToken !== undefined ? [...forms, ...next] : next;
        }
        for (const form of forms) members.push({ name, descriptor: '(' + form.descriptors.join('') + ')' + returns, params: form.params });
    }
    if (ts.isClassDeclaration(declaration) && constructors === 0) members.push({ name: '<init>', descriptor: '()V', params: [] });
    return members;
}

// Non-private methods and constructors as javap prints them, per class.
function javapMembers(classpath: string, classes: string[]): Map<string, { name: string; descriptor: string }[]> {
    const output = run(['javap', '-cp', classpath, '-s', ...classes]);
    const byClass = new Map<string, { name: string; descriptor: string }[]>();
    let current: { name: string; descriptor: string }[] = [];
    let simple = '',
        pending = '';
    for (const line of output.split('\n')) {
        const header = /^public (?:(?:abstract|final) )*(?:class|interface) ([\w.]+)/.exec(line);
        if (header) {
            current = [];
            byClass.set(header[1], current);
            simple = header[1].slice(header[1].lastIndexOf('.') + 1);
            continue;
        }
        const method = /^ {2}[^(]*?([\w$]+)\(.*\)(?: throws [\w.$, ]+)?;$/.exec(line);
        if (method) {
            pending = method[1] === simple ? '<init>' : method[1];
            continue;
        }
        const descriptor = /^ {4}descriptor: (\(\S*)$/.exec(line);
        if (descriptor && pending !== '') current.push({ name: pending, descriptor: descriptor[1] });
        pending = '';
    }
    return byClass;
}

const apiTypes = [
    ['javax.media.opengl.GL', 'GL.ts', 'GL'],
    ['javax.media.opengl.GLDrawableFactory', 'GLDrawableFactory.ts', 'GLDrawableFactory'],
    ['javax.media.opengl.GLDrawable', 'GLDrawable.ts', 'GLDrawable'],
    ['javax.media.opengl.GLContext', 'GLContext.ts', 'GLContext'],
    ['javax.media.opengl.GLCapabilities', 'GLCapabilities.ts', 'GLCapabilities'],
    ['javax.media.opengl.GLException', 'GLException.ts', 'GLException'],
    ['javax.media.opengl.GLCapabilitiesChooser', 'GLCapabilitiesChooser.ts', 'GLCapabilitiesChooser']
] as const;

// Deliberate TS signature differences: a covariant return in place of Java's Object.
const covariant = new Map([['javax.media.opengl.GLCapabilities.clone', ['()Ljava/lang/Object;', '()Ljavax/media/opengl/GLCapabilities;']]]);

const key = (m: { name: string; descriptor: string }) => m.name + m.descriptor;

test('the TS JOGL types declare exactly the shipped jogl.jar members, and every inventory call resolves to one', () => {
    const shipped = javapMembers(
        joglPath,
        apiTypes.map(([java]) => java)
    );
    const declared = new Map<string, Set<string>>();
    for (const [java, file, name] of apiTypes) {
        const ours = declaredMembers(file, name).map(m => {
            const deviation = covariant.get(java + '.' + m.name);
            return deviation !== undefined && m.descriptor === deviation[1] ? { ...m, descriptor: deviation[0] } : m;
        });
        const theirs = shipped.get(java);
        if (theirs === undefined) throw new Error('javap printed no ' + java);
        if (java === 'javax.media.opengl.GL') {
            // Same order as the shipped interface, which glMethods records for recorders and proxies.
            expect(theirs).toHaveLength(102);
            expect(ours.map(key)).toEqual(theirs.map(key));
            expect(glMethods.map(([n, d]) => n + d)).toEqual(theirs.map(key));
        } else {
            expect(ours.map(key).sort()).toEqual(theirs.map(key).sort());
        }
        declared.set(java.replaceAll('.', '/'), new Set(ours.map(key)));
    }

    const rows = inventory()
        .trimEnd()
        .split('\n')
        .map(line => line.split('\t'));
    const targets = rows.filter(([kind]) => kind === 'target');
    const calls = rows.filter(([kind]) => kind === 'call');
    expect(targets).toHaveLength(115);
    expect(calls).toHaveLength(956);
    const glu: string[] = [];
    for (const [, owner, name, descriptor, resolved] of targets) {
        expect(resolved).toBe(owner);
        if (owner === 'javax/media/opengl/glu/GLU') {
            glu.push(name + descriptor);
            continue;
        }
        expect(declared.get(owner)?.has(name + descriptor), owner + '.' + name + descriptor).toBe(true);
    }
    expect(glu.sort()).toEqual(['<init>()V', 'gluBuild2DMipmaps(IIIIIILjava/nio/Buffer;)I']); // the GLU unit's
    for (const [, method, ordinal, , owner, name, descriptor] of calls) {
        if (owner === 'javax/media/opengl/glu/GLU') continue;
        expect(declared.get(owner)?.has(name + descriptor), method + ' #' + ordinal + ' ' + owner + '.' + name + descriptor).toBe(true);
    }
    // The two GL methods the gamepack never calls are the GLU mipmap code's.
    const used = new Set(calls.filter(([, , , , owner]) => owner === 'javax/media/opengl/GL').map(([, , , , , name, d]) => name + d));
    expect(glMethods.map(([n, d]) => n + d).filter(m => !used.has(m))).toEqual(['glGetTexLevelParameteriv(III[II)V', 'glPixelStorei(II)V']);
}, 60000);

// ---- constants ----

function snapshot(): Map<string, Map<string, number>> {
    const classes = new Map<string, Map<string, number>>();
    let current: Map<string, number> | undefined;
    for (const line of readFileSync(join(import.meta.dir, 'jogl-constants.javap.txt'), 'utf8')
        .replaceAll('\r\n', '\n')
        .split('\n')) {
        const header = /^public (?:(?:abstract|final) )*(?:class|interface) ([\w.]+)/.exec(line);
        if (header) {
            current = new Map();
            classes.set(header[1], current);
            continue;
        }
        const constant = /^ {2}public static final int (\w+) = (-?\d+);$/.exec(line);
        if (constant) {
            if (current === undefined) throw new Error('constant before class header');
            current.set(constant[1], Number(constant[2]));
        } else if (line !== '' && !line.startsWith('#') && line !== '}') {
            throw new Error('unexpected snapshot line ' + line);
        }
    }
    return classes;
}

// The one value JOGL 2 does not share with JOGL 1.1.x: its GL2ES2 carries GL_UNSIGNED_INT_10_10_10_2 with
// the OES value 0x8DF6 (suffix dropped when ES and desktop were merged). The desktop value 0x8036 is what
// javac inlined into jogl.jar's mipmap code (checked in the coverage test) and what LWJGL declares.
const jogl2Differs = new Map([['GL_UNSIGNED_INT_10_10_10_2', 0x8df6]]);

test('every GL_* and GLContext constant equals javap -constants of JOGL and LWJGL', () => {
    const classes = snapshot();
    const values = (prefix: string, name: string) => {
        const found = new Set<number>();
        for (const [owner, constants] of classes) {
            const value = constants.get(name);
            if (owner.startsWith(prefix) && value !== undefined) found.add(value);
        }
        expect(found.size, prefix + ' ' + name + ' declared with several values').toBeLessThanOrEqual(1);
        return found.size === 0 ? undefined : [...found][0];
    };
    expect(GLConstants).toBe(GL);
    expect(Object.isFrozen(GL)).toBe(true);
    const declared = Object.entries(GL);
    expect(declared).toHaveLength(192);
    for (const [name, value] of declared) {
        expect(values('org.lwjgl.', name), 'LWJGL ' + name).toBe(value);
        expect(values('com.jogamp.', name), 'JOGL 2 ' + name).toBe(jogl2Differs.get(name) ?? value);
    }
    const context = classes.get('com.jogamp.opengl.GLContext');
    expect(context?.get('CONTEXT_NOT_CURRENT')).toBe(GLContext.CONTEXT_NOT_CURRENT);
    expect(context?.get('CONTEXT_CURRENT')).toBe(GLContext.CONTEXT_CURRENT);
    expect(context?.get('CONTEXT_CURRENT_NEW')).toBe(GLContext.CONTEXT_CURRENT_NEW);
    expect([GLContext.CONTEXT_NOT_CURRENT, GLContext.CONTEXT_CURRENT, GLContext.CONTEXT_CURRENT_NEW]).toEqual([0, 1, 2]);
    // The snapshot holds exactly the declared names.
    const names = new Set([...classes.values()].flatMap(constants => [...constants.keys()]));
    expect([...names].sort()).toEqual([...declared.map(([name]) => name), 'CONTEXT_NOT_CURRENT', 'CONTEXT_CURRENT', 'CONTEXT_CURRENT_NEW'].sort());
});

// ---- constant coverage, from the bytecode ----

interface Site {
    jar: string;
    method: string;
    owner: string;
    name: string;
    descriptor: string;
    args: string[];
}

let oracleOutput: string | undefined;
function oracle(): string {
    if (oracleOutput === undefined) {
        const exports = ['asm', 'asm.tree', 'asm.tree.analysis', 'asm.util'].flatMap(p => ['--add-exports', 'java.base/jdk.internal.org.objectweb.' + p + '=ALL-UNNAMED']);
        oracleOutput = run(['java', ...exports, '-cp', joglPath, join(import.meta.dir, 'JoglSurfaceOracle.java'), hdGamepackPath, joglPath]);
    }
    return oracleOutput;
}

const oracleRows = (kind: string) =>
    oracle()
        .trimEnd()
        .split('\n')
        .map(line => line.split('\t'))
        .filter(([k]) => k === kind);

const glOverloads = new Map(declaredMembers('GL.ts', 'GL').map(m => [key(m), m.params]));

// pnames whose GLint `param` is an enumerant (texture filters and wraps, env modes and combiner state,
// texgen mode, fog mode).
const enumValuedPnames = new Set<number>([
    GL.GL_TEXTURE_MIN_FILTER,
    GL.GL_TEXTURE_MAG_FILTER,
    GL.GL_TEXTURE_WRAP_S,
    GL.GL_TEXTURE_WRAP_T,
    GL.GL_TEXTURE_WRAP_R,
    GL.GL_TEXTURE_ENV_MODE,
    GL.GL_COMBINE_RGB,
    GL.GL_COMBINE_ALPHA,
    GL.GL_SOURCE0_RGB,
    GL.GL_SOURCE1_RGB,
    GL.GL_SOURCE2_RGB,
    GL.GL_SOURCE0_ALPHA,
    GL.GL_SOURCE1_ALPHA,
    GL.GL_SOURCE2_ALPHA,
    GL.GL_OPERAND0_RGB,
    GL.GL_OPERAND1_RGB,
    GL.GL_TEXTURE_GEN_MODE,
    GL.GL_FOG_MODE
]);
const pnameParam: Record<string, [pname: number, param: number]> = { glTexParameteri: [1, 2], glTexEnvi: [1, 2], glTexGeni: [1, 2], glFogi: [0, 1] };

const ints = (arg: string) => arg.split(',').map(Number);

// The GL enum values a site passes, and the enum arguments that are not compile-time constants.
function enumValues(site: Site, unresolved: string[]): number[] {
    const params = glOverloads.get(site.name + site.descriptor);
    if (params === undefined) throw new Error('undeclared ' + site.name + site.descriptor);
    expect(site.args).toHaveLength(params.length);
    const found: number[] = [];
    params.forEach((type, i) => {
        const arg = site.args[i];
        const special = pnameParam[site.name];
        const isEnum = type === 'GLenum' || type === 'GLbitfield' || (special !== undefined && i === special[1] && site.args[special[0]] !== '?' && ints(site.args[special[0]]).every(p => enumValuedPnames.has(p)));
        const isFormat = site.name.startsWith('glTexImage') && i === 2; // internalformat: an enumerant, or a 1..4 component count
        if (!isEnum && !isFormat) return;
        if (arg === '?') {
            unresolved.push(site.method + ' ' + site.name + ' #' + i);
            return;
        }
        for (const value of ints(arg)) {
            if (isFormat && value <= 4) continue;
            if (type === 'GLbitfield') {
                for (let bit = 1; bit !== 0; bit <<= 1) if (value & bit) found.push(bit);
            } else found.push(value);
        }
    });
    return found;
}

const LIGHT4_7 = [GL.GL_LIGHT4, GL.GL_LIGHT5, GL.GL_LIGHT6, GL.GL_LIGHT7];
const CUBE_FACES = [34069, 34070, 34071, 34072, 34073, 34074];

// Enum arguments computed at run time, each resolved by reading the code (hd2d/cfr decompiles).
const dynamicSites: [site: string, count: number, values: number[]][] = [
    ['jf.a(I)V glDisable #0', 1, LIGHT4_7], // n + 16384 + 4, n = 0..3
    ['jf.a(ILgi;III)V glEnable #0', 1, LIGHT4_7],
    ['jf.a(ILgi;III)V glLightf #0', 1, LIGHT4_7],
    ['jf.a(ILgi;III)V glLightfv #0', 2, LIGHT4_7],
    ['jf.e()V glLightf #0', 2, LIGHT4_7], // 16388 + n, n = 0..3
    ['jf.e()V glLightfv #0', 1, LIGHT4_7],
    ['hg.a([[[Lbj;FZ)V glClientActiveTexture #0', 2, [GL.GL_TEXTURE1, GL.GL_TEXTURE2]], // wg.e(): b ? 33986 : 33985
    ['wg.f()V glClientActiveTexture #0', 1, [GL.GL_TEXTURE1, GL.GL_TEXTURE2]],
    ['wg.g()V glClientActiveTexture #0', 1, [GL.GL_TEXTURE1, GL.GL_TEXTURE2]],
    ['vm.e()V glTexImage2D #0', 3, CUBE_FACES], // 34069 + i, i = 0..5
    ['tf.h()V glDrawBuffer #0', 1, []], // restores the value glGetIntegerv(GL_DRAW_BUFFER) returned
    ['tf.h()V glReadBuffer #0', 1, []] // restores the value glGetIntegerv(GL_READ_BUFFER) returned
];

// Int literals of 256 or more in the GLU and mipmap classes that are not GL enums: byte/short expansion
// multipliers, channel masks of the packed pixel types, and GLU's own error codes (the GLU unit's).
const mipmapNonEnums = [257, 516, 992, 1023, 1984, 2016, 3840, 4092, 31744, 32768, 61440, 63488, 65280, 65535, 1047552, 4190208, 16711680, 1072693248];
const gluErrors = [100900, 100901, 100902, 100904]; // GLU_INVALID_ENUM, _VALUE, GLU_OUT_OF_MEMORY, GLU_INVALID_OPERATION

test('the GL constants are exactly the GL enums the gamepack, the GLU mipmap code and JOGL use', () => {
    const sites: Site[] = oracleRows('site').map(([, jar, method, owner, name, descriptor, ...args]) => ({ jar, method, owner, name, descriptor, args }));
    expect(sites.filter(s => s.args.includes('DEAD'))).toEqual([]);
    const gamepack = sites.filter(s => s.jar === 'gamepack');
    expect(gamepack).toHaveLength(956);

    const jar = new Set<number>(),
        unresolved: string[] = [];
    for (const site of gamepack.filter(s => s.owner === 'javax/media/opengl/GL')) for (const v of enumValues(site, unresolved)) jar.add(v);
    const counts = new Map<string, number>();
    for (const u of unresolved) counts.set(u, (counts.get(u) ?? 0) + 1);
    expect([...counts].sort()).toEqual(dynamicSites.map(([site, count]) => [site, count] as [string, number]).sort());
    for (const [, , values] of dynamicSites) for (const v of values) jar.add(v);

    const mipmap = (s: Site) => s.method.startsWith('com/sun/opengl/impl/mipmap/') || s.method.startsWith('javax/media/opengl/glu/');
    const glu = new Set<number>(),
        impl = new Set<number>();
    for (const site of sites.filter(s => s.jar === 'jogl' && s.owner === 'javax/media/opengl/GL')) {
        for (const v of enumValues(site, [])) (mipmap(site) ? glu : impl).add(v);
    }
    const literals = new Set(
        oracleRows('literal')
            .map(([, value]) => Number(value))
            .filter(v => v >= 256)
    );
    for (const v of [...mipmapNonEnums, ...gluErrors]) expect(literals.has(v), 'literal ' + v).toBe(true);
    for (const v of literals) if (!mipmapNonEnums.includes(v) && !gluErrors.includes(v)) glu.add(v);
    expect([...impl].sort()).toEqual([GL.GL_VERSION, GL.GL_EXTENSIONS]);

    const declared = new Set<number>(Object.values(GL));
    expect([...declared].sort((a, b) => a - b)).toEqual([...new Set([...jar, ...glu, ...impl])].sort((a, b) => a - b));
    // Names sharing a value: only these.
    const byValue = new Map<number, string[]>();
    for (const [name, value] of Object.entries(GL)) byValue.set(value, [...(byValue.get(value) ?? []), name]);
    expect([...byValue.values()].filter(names => names.length > 1)).toEqual([
        ['GL_LINES', 'GL_ONE'],
        ['GL_ENABLE_BIT', 'GL_S'],
        ['GL_COLOR_BUFFER_BIT', 'GL_LIGHT0']
    ]);
    // The fog hint is GL_FASTEST (0x1101). The mapping notes and HD_PLAN 2.3 decode it as NICEST (0x1102).
    expect(gamepack.filter(s => s.name === 'glHint').map(s => s.args)).toEqual([[String(GL.GL_FOG_HINT), String(GL.GL_FASTEST)]]);
    // javac inlined GL_UNSIGNED_INT_10_10_10_2 = 0x8036 into the mipmap type switches (see jogl2Differs).
    expect(oracleRows('literal').some(([, v, where, next]) => Number(v) === GL.GL_UNSIGNED_INT_10_10_10_2 && where.startsWith('com/sun/opengl/impl/mipmap/Mipmap.legalType') && next === 'LOOKUPSWITCH')).toBe(true);
}, 60000);

// ---- behaviour ----

test('GLCapabilities matches the shipped class for the oracle sequence', () => {
    const rows: string[] = [];
    const caps = (label: string, c: GLCapabilities) =>
        rows.push(
            [
                'caps',
                label,
                c.toString(),
                [
                    c.getDoubleBuffered(),
                    c.getStereo(),
                    c.getHardwareAccelerated(),
                    c.getDepthBits(),
                    c.getStencilBits(),
                    c.getRedBits(),
                    c.getGreenBits(),
                    c.getBlueBits(),
                    c.getAlphaBits(),
                    c.getAccumRedBits(),
                    c.getAccumGreenBits(),
                    c.getAccumBlueBits(),
                    c.getAccumAlphaBits(),
                    c.getSampleBuffers(),
                    c.getNumSamples()
                ].join(',')
            ].join('\t')
        );
    // Mirrors JoglSurfaceOracle.caps(StringBuilder).
    const c = new GLCapabilities();
    caps('default', c);
    for (const samples of [2, 4]) {
        const aa = new GLCapabilities();
        aa.setSampleBuffers(true);
        aa.setNumSamples(samples);
        caps('aa' + samples, aa);
    }
    c.setSampleBuffers(true);
    c.setNumSamples(4);
    const copy = c.clone();
    copy.setNumSamples(8);
    copy.setDepthBits(32);
    caps('clone-source', c);
    caps('clone', copy);
    c.setDoubleBuffered(false);
    c.setStereo(true);
    c.setHardwareAccelerated(false);
    c.setDepthBits(16);
    c.setStencilBits(8);
    c.setRedBits(5);
    c.setGreenBits(6);
    c.setBlueBits(-5);
    c.setAlphaBits(1);
    c.setAccumRedBits(16);
    c.setAccumGreenBits(2147483647);
    c.setAccumBlueBits(0);
    c.setAccumAlphaBits(-2147483648);
    c.setNumSamples(-1);
    c.setPbufferFloatingPointBuffers(true);
    caps('all', c);
    c.setSampleBuffers(false);
    caps('no-samples', c);
    expect(copy).toBeInstanceOf(GLCapabilities);
    expect(rows).toEqual(oracleRows('caps').map(row => row.join('\t')));
}, 60000);

class FakeFactory extends GLDrawableFactory {
    getGLDrawable(): GLDrawable {
        throw new Error('unused');
    }
}

test('GLDrawableFactory.getFactory follows the registered platform, and is null without one as on an unsupported OS', () => {
    try {
        registerGLDrawableFactory(null);
        expect(GLDrawableFactory.getFactory()).toBeNull();
        expect(GLDrawableFactory.getFactory()).toBeNull();

        let created = 0;
        const platform = () => {
            created++;
            return new FakeFactory();
        };
        registerGLDrawableFactory(platform);
        expect(created).toBe(0); // created lazily, as Java's getFactory does
        const first = GLDrawableFactory.getFactory();
        expect(first).toBeInstanceOf(FakeFactory);
        expect(GLDrawableFactory.getFactory()).toBe(first);
        expect(created).toBe(1);
        registerGLDrawableFactory(platform); // re-registering drops the cached factory
        expect(GLDrawableFactory.getFactory()).not.toBe(first);
        expect(created).toBe(2);

        // A failing constructor propagates (Java: an Error from new XxxGLDrawableFactory()) and caches nothing.
        let attempts = 0;
        registerGLDrawableFactory(() => {
            attempts++;
            throw new JavaError('UnsatisfiedLinkError');
        });
        expect(() => GLDrawableFactory.getFactory()).toThrow(JavaError);
        expect(() => GLDrawableFactory.getFactory()).toThrow(JavaError);
        expect(attempts).toBe(2);
    } finally {
        registerGLDrawableFactory(null);
    }
});

class FakeContext extends GLContext {
    makeCurrent(): number {
        if (GLContext.getCurrent() === this) return GLContext.CONTEXT_CURRENT;
        GLContext.getCurrent()?.release();
        GLContext.setCurrent(this);
        return GLContext.CONTEXT_CURRENT_NEW;
    }
    release(): void {
        GLContext.setCurrent(null);
    }
    destroy(): void {}
    getGL(): GL {
        throw new Error('unused');
    }
}

test('GLContext keeps one static current context, and GLException is a RuntimeException', () => {
    const a = new FakeContext(),
        b = new FakeContext();
    try {
        expect(a.makeCurrent()).toBe(2);
        expect(GLContext.getCurrent()).toBe(a);
        expect(a.makeCurrent()).toBe(1);
        expect(b.makeCurrent()).toBe(2);
        expect(GLContext.getCurrent()).toBe(b);
        b.release();
        expect(GLContext.getCurrent()).toBeNull();
    } finally {
        a.release();
    }

    const cause = new Error('boom');
    for (const e of [new GLException(), new GLException('Error swapping buffers'), new GLException(cause), new GLException(null)]) {
        expect(e).toBeInstanceOf(Error);
        expect(isJavaRuntimeException(e)).toBe(true);
    }
    expect(new GLException().message).toBe('');
    expect(new GLException().cause).toBeNull();
    expect(new GLException('Error swapping buffers').message).toBe('Error swapping buffers');
    expect(new GLException(cause).cause).toBe(cause);
    expect(new GLException(cause).message).toBe(String(cause));
});
