// A virtual GL capability profile: the answers a GPU-free GL (NullGL) and the Java oracle's responder
// (GlRecorder.java) give to every query the jar and JOGL's GLU make, so both sides of a GLTrace comparison see
// the same driver (HD_PLAN 2.3 and Q2; GLTRACE.md section 16). Not a Java class. The JSON form
// (capsProfileToJson) is the exchange format with the Java side.
//
// Which profile. Both sides of a comparison must use the same profile. The TS responders (NullGL,
// NullGLDrawableFactory) take it as a required argument. GlRecorder.java's responder loads the JSON file named by
// -Dgltrace.caps and defaults to test/hd/rtx5070.json, the user's captured RTX 5070 (HD_PLAN Q2). That
// captured profile is the one frame oracles use by default: TS loads it with capsProfileFromJson. Alternate
// profiles go to Java as capsProfileToJson output through -Dgltrace.caps:
// - FALLBACK_CAPS_PROFILE: GLTRACE.md's reference profile (Appendices A, B and C) and the unit tests' profile.
// - RADEON_CAPS_PROFILE: the only profile that sets tf.G, so the only one that reaches the stream-VBO path.
//
// Profile answers are static: they never reflect state set by earlier calls (glPixelStorei, ...). The responders
// answer four pnames from per-context state instead, and ignore any profile entry for them: DRAW_BUFFER 3073,
// READ_BUFFER 3074, LIGHT_MODEL_AMBIENT 2899 (rd.a(I)V reads back what mk set into ARB local 66) and
// PROGRAM_ERROR_POSITION_ARB 34379 (always -1). WebGpuGL answers everything from its state mirror.

export const CAPS_PROFILE_FORMAT = 'rs530-caps-profile-v1';

export interface CapsProfile {
    readonly format: typeof CAPS_PROFILE_FORMAT;
    readonly name: string;
    // glGetString answers keyed by the decimal name (7936 VENDOR, 7937 RENDERER, 7938 VERSION, 7939 EXTENSIONS).
    // Any other name answers null.
    readonly strings: Readonly<Record<string, string>>;
    // glGetIntegerv answers keyed by the decimal pname; the values are written from params[params_offset] on.
    // A pname not listed writes nothing.
    readonly integers: Readonly<Record<string, readonly number[]>>;
    // glGetFloatv answers keyed by the decimal pname, as binary32 bit patterns (8 lowercase hex digits).
    readonly floats: Readonly<Record<string, readonly string[]>>;
    // GL methods whose proc address the virtual driver does not export: each call throws
    // GLException('Method "<name>" not available'), as com.sun.opengl.impl.GLImpl does. Only the 16 entries of
    // DYNAMIC_ENTRY_POINTS can be listed: the shipped GLImpl calls every other method natively, so it is never
    // unavailable. For glActiveTexture, glClientActiveTexture and glMultiTexCoord2f, which GLImpl also resolves
    // through their ARB aliases, the listed core name means both are missing.
    readonly missingEntryPoints: readonly string[];
}

export const GL_VENDOR = 7936;
export const GL_RENDERER = 7937;
export const GL_VERSION = 7938;
export const GL_EXTENSIONS = 7939;

// The fallback profile (HD_PLAN Q2): GL 2.1, 4 texture units, VBO, multisample, cube map, ARB_vertex_program,
// EXT_texture3D, point parameters, and a vendor and renderer that tf.m()I does not reject or special-case.
// What tf.m()I (runescape_gl.jar) does with it:
// - VENDOR lowercased contains none of "microsoft", "brian paul", "mesa": flags 1 stay clear.
// - VERSION.split("[. ]") gives "2","1": tf.B = 21 >= 12, flag 2 and 4 clear.
// - GL_ARB_multitexture and GL_ARB_texture_env_combine present: flags 8 and 0x20 clear.
// - MAX_TEXTURE_UNITS 4, MAX_TEXTURE_COORDS 8, MAX_TEXTURE_IMAGE_UNITS 16, all >= 2: flag 0x10 clear, so tf.m
//   returns 0 and goes on. tf.e = 4 >= 3 selects the three-unit paths of vm and wg.
// - tf.C (VBO), tf.y (multisample), tf.K (cube map), tf.H (vertex program) and tf.r (3D textures) all true.
// - RENDERER does not contain "radeon", so the Radeon 7000-9250 overrides of tf.C and tf.r are skipped and
//   tf.G keeps its default false (RADEON_CAPS_PROFILE below is the variant that sets it).
// - With tf.C, the probe glGenBuffersARB(1, ...) succeeds (no missing entry points).
// ga.a()V: GL_ARB_point_parameters present; POINT_SIZE_MAX 2047.0 > 1024 takes the clamp to 1024.
// JOGL's GLU (Mipmap.closestFit) parses VERSION.trim().substring(0, 3) = "2.1" >= 1.1 and takes the proxy
// path. JOGL's FunctionAvailabilityCache parses major 2, minor 1 from VERSION.
export const FALLBACK_CAPS_PROFILE: CapsProfile = deepFreeze({
    format: CAPS_PROFILE_FORMAT,
    name: 'fallback-gl21',
    strings: {
        '7936': 'RS530 Virtual GL',
        '7937': 'RS530 NullGL fallback profile',
        '7938': '2.1.2 RS530 Virtual GL',
        '7939': 'GL_ARB_multitexture GL_ARB_texture_env_combine GL_ARB_vertex_buffer_object GL_ARB_multisample ' + 'GL_ARB_texture_cube_map GL_ARB_vertex_program GL_EXT_texture3D GL_ARB_point_parameters GL_ARB_point_sprite'
    },
    integers: {
        '3312': [0], // UNPACK_SWAP_BYTES
        '3313': [0], // UNPACK_LSB_FIRST
        '3314': [0], // UNPACK_ROW_LENGTH
        '3315': [0], // UNPACK_SKIP_ROWS
        '3316': [0], // UNPACK_SKIP_PIXELS
        '3317': [4], // UNPACK_ALIGNMENT
        '3328': [0], // PACK_SWAP_BYTES
        '3329': [0], // PACK_LSB_FIRST
        '3330': [0], // PACK_ROW_LENGTH
        '3331': [0], // PACK_SKIP_ROWS
        '3332': [0], // PACK_SKIP_PIXELS
        '3333': [4], // PACK_ALIGNMENT
        '3379': [8192], // MAX_TEXTURE_SIZE
        '34018': [4], // MAX_TEXTURE_UNITS
        '34929': [8], // MAX_TEXTURE_COORDS
        '34930': [16] // MAX_TEXTURE_IMAGE_UNITS
    },
    floats: {
        '33063': ['44ffe000'] // POINT_SIZE_MAX: 2047.0
    },
    missingEntryPoints: []
});

// The fallback profile with a Radeon renderer string, for the one path no other profile reaches. tf.m()I sets
// tf.G = tf.C only inside `if (renderer.toLowerCase().indexOf("radeon") != -1)` (cfr/tf.java:373-388). That block
// splits the lowercased renderer at ' ' (after mapping '/' to ' ') and reads a model number from the first token
// whose first four chars are decimal. 7000-7999 clears tf.C, and 7000-9250 clears tf.r. 'RS530 Virtual Radeon' has
// no such token, so tf.C and tf.r stay true and tf.G becomes true. The jar reads tf.G once, at td pc1955 (the model
// upload of cfr/td.java:1778). That branch builds `new vi(true)` (a GL_STREAM_DRAW 35040 buffer) on first use and
// updates it afterwards with vi.a, which holds the jar's only glBufferSubDataARB. The fallback and the captured rtx5070 profile both leave tf.G false.
// Everything else equals FALLBACK_CAPS_PROFILE (checked by running the real tf.m()I in gl-trace.test.ts).
export const RADEON_CAPS_PROFILE: CapsProfile = deepFreeze({
    ...FALLBACK_CAPS_PROFILE,
    name: 'fallback-gl21-radeon',
    strings: { ...FALLBACK_CAPS_PROFILE.strings, '7937': 'RS530 Virtual Radeon' }
});

// The GL methods that the shipped com.sun.opengl.impl.GLImpl calls through a looked-up proc address. These are the
// only ones with a 'Method "<name>" not available' GLException (javap shows exactly these 16 strings). GlRecorder.java
// keeps the same set as DYNAMIC.
export const DYNAMIC_ENTRY_POINTS: ReadonlySet<string> = new Set<string>([
    'glActiveTexture',
    'glClientActiveTexture',
    'glMultiTexCoord2f',
    'glBindBufferARB',
    'glBufferDataARB',
    'glBufferSubDataARB',
    'glGenBuffersARB',
    'glDeleteBuffersARB',
    'glBindProgramARB',
    'glGenProgramsARB',
    'glProgramStringARB',
    'glProgramLocalParameter4fARB',
    'glProgramLocalParameter4fvARB',
    'glPointParameterfARB',
    'glPointParameterfvARB',
    'glTexImage3D'
]);

function deepFreeze<T>(value: T): T {
    if (typeof value === 'object' && value !== null) {
        for (const v of Object.values(value)) deepFreeze(v);
        Object.freeze(value);
    }
    return value;
}

// Throws Error('invalid caps profile: ...') when the profile breaks the schema above.
export function validateCapsProfile(profile: CapsProfile): void {
    const fail = (why: string): never => {
        throw new Error('invalid caps profile: ' + why);
    };
    if (profile.format !== CAPS_PROFILE_FORMAT) fail('format');
    if (typeof profile.name !== 'string' || !/^[A-Za-z0-9_.-]+$/.test(profile.name)) fail('name');
    for (const key of [GL_VENDOR, GL_RENDERER, GL_VERSION, GL_EXTENSIONS]) {
        if (typeof profile.strings[String(key)] !== 'string') fail('strings.' + key + ' missing');
    }
    for (const [k, v] of Object.entries(profile.strings)) {
        if (!/^[0-9]+$/.test(k) || typeof v !== 'string') fail('strings.' + k);
    }
    for (const [k, v] of Object.entries(profile.integers)) {
        if (!/^[0-9]+$/.test(k) || !Array.isArray(v) || v.some(x => typeof x !== 'number' || (x | 0) !== x)) fail('integers.' + k);
    }
    for (const [k, v] of Object.entries(profile.floats)) {
        if (!/^[0-9]+$/.test(k) || !Array.isArray(v) || v.some(x => typeof x !== 'string' || !/^[0-9a-f]{8}$/.test(x))) fail('floats.' + k);
    }
    for (const m of profile.missingEntryPoints) {
        if (!DYNAMIC_ENTRY_POINTS.has(m)) fail('missingEntryPoints.' + m);
    }
    joglVersion(profile.strings[String(GL_VERSION)]);
}

// The JSON exchange form: two-space indentation, keys of the maps in ascending numeric order, each array of scalars
// on one line as [a, b, ...]. Built field by field, so string values are written exactly as JSON.stringify
// escapes them and never rewritten.
export function capsProfileToJson(profile: CapsProfile): string {
    const array = (values: readonly (string | number)[]): string => '[' + values.map(v => JSON.stringify(v)).join(', ') + ']';
    const map = <V>(r: Readonly<Record<string, V>>, value: (v: V) => string): string => {
        const keys = Object.keys(r).sort((a, b) => Number(a) - Number(b));
        if (keys.length === 0) return '{}';
        return '{\n' + keys.map(k => '    ' + JSON.stringify(k) + ': ' + value(r[k])).join(',\n') + '\n  }';
    };
    return (
        '{\n' +
        '  "format": ' +
        JSON.stringify(profile.format) +
        ',\n' +
        '  "name": ' +
        JSON.stringify(profile.name) +
        ',\n' +
        '  "strings": ' +
        map(profile.strings, v => JSON.stringify(v)) +
        ',\n' +
        '  "integers": ' +
        map(profile.integers, array) +
        ',\n' +
        '  "floats": ' +
        map(profile.floats, array) +
        ',\n' +
        '  "missingEntryPoints": ' +
        array(profile.missingEntryPoints) +
        '\n' +
        '}\n'
    );
}

export function capsProfileFromJson(text: string): CapsProfile {
    const profile = deepFreeze(JSON.parse(text) as CapsProfile);
    validateCapsProfile(profile);
    return profile;
}

// The GL_VERSION_<major>_<minor> names JOGL's FunctionAvailabilityCache.initAvailableExtensions adds for a
// version string, highest first (for "2.1.2 ...": 2_1 2_0 1_5 1_4 1_3 1_2 1_1 1_0).
export function joglVersionExtensions(version: string): string[] {
    const v = joglVersion(version);
    let major = v.major;
    let minor = v.minor;
    const out: string[] = [];
    while (major > 0) {
        while (minor >= 0) {
            out.push('GL_VERSION_' + major + '_' + minor);
            minor--;
        }
        if (major === 2) minor = 5;
        major--;
    }
    return out;
}

// com.sun.opengl.impl.FunctionAvailabilityCache$Version.<init>(Ljava/lang/String;)V for a glGetString(VERSION)
// answer (the GL_VERSION_ form is never passed here). Throws Error('IllegalArgumentException: ...') where the
// Java constructor throws IllegalArgumentException.
export function joglVersion(version: string): { major: number; minor: number } {
    const illegal = () => new Error('IllegalArgumentException: Illegally formatted version identifier: "' + version + '"');
    const dotTokens = version.split('.').filter(t => t.length > 0);
    if (dotTokens.length < 2) throw illegal();
    let major = javaIntegerValueOf(dotTokens[0], illegal);
    let minor = javaIntegerValueOf(dotTokens[1], illegal);
    const spaceTokens = version.split(' ').filter(t => t.length > 0);
    if (spaceTokens.length >= 2) {
        const m = /^\D*(\d+)\.(\d+)\.?(\d*).*$/.exec(spaceTokens[1]);
        if (m !== null) {
            const mj = javaIntegerValueOf(m[1], illegal);
            const mn = javaIntegerValueOf(m[2], illegal);
            if ((mj === major && mn > minor) || mj === major + 1) {
                major = mj;
                minor = mn;
            }
        }
    }
    return { major, minor };
}

function javaIntegerValueOf(s: string, illegal: () => Error): number {
    if (!/^[+-]?[0-9]+$/.test(s)) throw illegal();
    const v = Number(s);
    if ((v | 0) !== v) throw illegal();
    return v;
}

// isExtensionAvailable(name) as JOGL answers it for this profile: a token of the EXTENSIONS string, or one of the
// derived GL_VERSION names. FunctionAvailabilityCache.initAvailableExtensions reads the tokens with
// `new StringTokenizer(String)`, whose default delimiters are " \t\n\r\f", and trims each token with String.trim()
// (every char <= U+0020 at either end). (JOGL also maps WGL_/GLX_NV_vertex_array_range and appends the platform
// WGL extension string; the profile has neither.)
export function profileHasExtension(profile: CapsProfile, name: string | null): boolean {
    if (name === null) return false;
    const tokens = profile.strings[String(GL_EXTENSIONS)]
        .split(/[ \t\n\r\f]+/)
        .filter(t => t.length > 0)
        .map(javaStringTrim);
    return tokens.includes(name) || joglVersionExtensions(profile.strings[String(GL_VERSION)]).includes(name);
}

// java.lang.String.trim(): strips chars <= U+0020 at both ends (JS trim() strips a different set).
function javaStringTrim(value: string): string {
    let st = 0;
    let len = value.length;
    while (st < len && value.charCodeAt(st) <= 0x20) st++;
    while (st < len && value.charCodeAt(len - 1) <= 0x20) len--;
    return value.substring(st, len);
}
