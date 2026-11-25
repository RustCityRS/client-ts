import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.lang.reflect.Field;
import java.lang.reflect.InvocationHandler;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.lang.reflect.Proxy;
import java.nio.charset.StandardCharsets;
import java.util.Random;

// Differential oracle for dc (Pix3D), the pc (TextureProvider) calls it makes, and the clip statics oj.j, vf.X, p.l
// and fl.m it writes. Everything is reached by reflection on the real classes in client.jar (this file runs in the
// source launcher, so it is a different runtime package from the gamepack and cannot touch package-private members
// directly). The texture loader is a java.lang.reflect.Proxy over pc with fixed fake textures that
// test/review/pix3d.test.ts reproduces exactly.
//
// Reads one operation per line on stdin and prints exactly one result line per operation on stdout.
// Run: java -Djava.awt.headless=true --add-opens java.base/java.lang=ALL-UNNAMED -cp client.jar pix3dOracle.java
// (--add-opens lets "setbright"/"setrand" seed the java.util.Random behind Math.random()).
class pix3dOracle {
    // Fake textures, shared with pix3d.test.ts. Id 4 has no texels (pc.a(IFI) returns null, so dc falls back to
    // Gouraud with the average colour). Ids 5 and 7 claim 128x128 texels but hold 64x64, so the 128 path reads
    // past the end; id 6 claims 64x64 but holds 128x128.
    static final boolean[] LOW = {true, false, true, false, false, false, true, false};
    static final boolean[] OPAQUE = {true, true, false, false, false, false, false, true};
    static final int[] SIZE = {4096, 16384, 4096, 16384, -1, 4096, 16384, 4096};
    static final int[] AVERAGE = {0x3F7A, 0xFFFF, 0, 0x007F, 0x1234, 0x8080, 0xC3FF, 0x2B40};
    static final int[][] TEXELS = new int[SIZE.length][];

    static Class<?> dc, td, pc;
    static final StringBuilder calls = new StringBuilder();
    static Object loader;
    static Random mathRandom;

    static int texel(int t, int i) {
        if (i % 11 == 0) return 0;
        int v = (i + 1) * 0x9E3779B1 ^ t * 0x85EBCA6B;
        v ^= v >>> 13;
        v *= 0x5BD1E995;
        v ^= v >>> 15;
        if (i % 13 == 0) return v & 0xFF000000 | 0x01000000;
        if (i % 17 == 0) return v;
        return v & 0xFFFFFF;
    }

    static int fillValue(int seed, int i) {
        int v = i * 0x2545F491 ^ seed * 0x27D4EB2F;
        v ^= v >>> 15;
        return v;
    }

    // Kept out of main(): HotSpot does not compile methods over 8000 bytecodes, so a loop inside main() stays interpreted.
    static void fill(int[] px, int seed) {
        for (int i = 0; i < px.length; i++) px[i] = fillValue(seed, i);
    }

    static String hash(int[] a) {
        if (a == null) return "null";
        int h = 1;
        for (int v : a) h = h * 31 + v;
        return Integer.toString(h);
    }

    static Field field(Class<?> owner, String name) throws Exception {
        Field f = owner.getDeclaredField(name);
        f.setAccessible(true);
        return f;
    }

    static Method method(Class<?> owner, String name, Class<?>... types) throws Exception {
        Method m = owner.getDeclaredMethod(name, types);
        m.setAccessible(true);
        return m;
    }

    static Class<?>[] ints(int n) {
        Class<?>[] t = new Class<?>[n];
        for (int i = 0; i < n; i++) t[i] = int.class;
        return t;
    }

    static Class<?>[] arrays(int n) {
        Class<?>[] t = new Class<?>[n + 2];
        t[0] = int[].class;
        t[1] = int[].class;
        for (int i = 0; i < n; i++) t[i + 2] = int.class;
        return t;
    }

    static void call(String entry) {
        if (calls.length() > 0) calls.append(';');
        calls.append(entry);
    }

    // Logs each pc call. A dummy argument other than the constant every dc call site passes is appended after '!'.
    static Object loaderCall(Method m, Object[] args) {
        String name = m.getName();
        Class<?>[] p = m.getParameterTypes();
        if (name.equals("a") && p.length == 2 && p[0] == int.class && p[1] == int.class) {
            int id = (Integer) args[0], dummy = (Integer) args[1];
            call("L" + id + (dummy == 0 ? "" : "!" + dummy));
            return LOW[id];
        }
        if (name.equals("b") && p.length == 2) {
            int dummy = (Integer) args[0], id = (Integer) args[1];
            call("A" + id + (dummy == 0 ? "" : "!" + dummy));
            return Boolean.TRUE;
        }
        if (name.equals("c") && p.length == 2) {
            int dummy = (Integer) args[0], id = (Integer) args[1];
            call("G" + id + (dummy == 117 ? "" : "!" + dummy));
            return TEXELS[id];
        }
        if (name.equals("a") && p.length == 2 && p[1] == byte.class) {
            int id = (Integer) args[0], dummy = (Byte) args[1];
            call("D" + id + (dummy == -95 ? "" : "!" + dummy));
            return Boolean.TRUE;
        }
        if (name.equals("a") && p.length == 3) {
            int id = (Integer) args[0], dummy = (Integer) args[2];
            float brightness = (Float) args[1];
            call("P" + id + "," + Float.floatToRawIntBits(brightness) + (dummy == 15964 ? "" : "!" + dummy));
            return TEXELS[id];
        }
        if (name.equals("a") && p.length == 2 && p[0] == byte.class) {
            int dummy = (Byte) args[0], id = (Integer) args[1];
            call("V" + id + (dummy >= -125 && dummy <= -118 ? "" : "!" + dummy));
            return AVERAGE[id];
        }
        if (name.equals("d") && p.length == 2) {
            int dummy = (Integer) args[0], id = (Integer) args[1];
            call("O" + id + (dummy == 0 ? "" : "!" + dummy));
            return OPAQUE[id];
        }
        throw new IllegalStateException("unexpected pc call " + m);
    }

    interface Body {
        void run() throws Exception;
    }

    static String run(Body body) throws Exception {
        try {
            body.run();
            return "ok";
        } catch (InvocationTargetException e) {
            Throwable c = e.getCause();
            if (c instanceof ArrayIndexOutOfBoundsException) return "aioobe";
            if (c instanceof ArithmeticException) return "arith";
            if (c instanceof NullPointerException) return "npe";
            if (c instanceof NegativeArraySizeException) return "nase";
            return "ex:" + c.getClass().getName();
        }
    }

    public static void main(String[] argv) throws Exception {
        dc = Class.forName("dc");
        td = Class.forName("td");
        pc = Class.forName("pc");
        for (int t = 0; t < SIZE.length; t++) {
            if (SIZE[t] < 0) continue;
            int[] p = new int[SIZE[t]];
            for (int i = 0; i < p.length; i++) p[i] = texel(t, i);
            TEXELS[t] = p;
        }
        InvocationHandler handler = (proxy, m, args) -> {
            if (m.getDeclaringClass() == Object.class) {
                switch (m.getName()) {
                    case "equals": return proxy == args[0];
                    case "hashCode": return System.identityHashCode(proxy);
                    default: return "fake pc";
                }
            }
            return loaderCall(m, args);
        };
        loader = Proxy.newProxyInstance(pc.getClassLoader(), new Class<?>[] {pc}, handler);
        Math.random();
        mathRandom = (Random) field(Class.forName("java.lang.Math$RandomNumberGeneratorHolder"), "randomNumberGenerator").get(null);

        // dc fields (Pix3D names in pix3d.test.ts)
        Field lowDetail = field(dc, "a"), originY = field(dc, "b"), divTable = field(dc, "c"), scanline = field(dc, "d");
        Field trans = field(dc, "e"), originX = field(dc, "f"), cosTable = field(dc, "g"), textureFallback = field(dc, "h");
        Field brightness = field(dc, "i"), hclip = field(dc, "j"), divTable2 = field(dc, "k"), sinTable = field(dc, "l");
        Field lowMemTexture = field(dc, "m"), opaque = field(dc, "n"), colourTable = field(dc, "o"), width = field(dc, "p");
        Field height = field(dc, "q"), textureProvider = field(dc, "r");
        Field clipMinX = field(Class.forName("oj"), "j"), clipMaxX = field(Class.forName("vf"), "X");
        Field clipMinY = field(Class.forName("p"), "l"), clipMaxY = field(Class.forName("fl"), "m");
        // td fields (Pix2D)
        Field pixels = field(td, "g"), pixWidth = field(td, "c"), pixHeight = field(td, "i");
        Field pixClipMinX = field(td, "e"), pixClipMinY = field(td, "b"), pixClipMaxX = field(td, "h"), pixClipMaxY = field(td, "d");

        Method setBrightness = method(dc, "a", float.class);
        Method resetOrigin = method(dc, "a");
        Method gouraudRaster = method(dc, "a", int[].class, int.class, int.class, int.class, int.class, int.class, int.class, int.class);
        Method terrainTextureRaster = method(dc, "a", arrays(13));
        Method terrainTextureTriangle = method(dc, "a", ints(19));
        Method textureRaster = method(dc, "b", arrays(13));
        Method flatRaster = method(dc, "a", int[].class, int.class, int.class, int.class, int.class, int.class);
        Method unload = method(dc, "b");
        Method getOffsetY = method(dc, "c");
        Method setRenderClipping = method(dc, "d");
        Method adjustLightness = method(dc, "a", int.class, int.class);
        Method textureTriangle = method(dc, "b", ints(19));
        Method setTextures = method(dc, "a", pc);
        Method setRandomBrightness = method(dc, "b", float.class);
        Method gouraudTriangle = method(dc, "a", ints(9));
        Method initColourTable = method(dc, "b", int.class, int.class);
        Method getOffsetX = method(dc, "e");
        Method testHclip = method(dc, "a", ints(3));
        Method setBounds = method(dc, "a", ints(4));
        Method flatTriangle = method(dc, "a", ints(7));
        Method setOrigin = method(dc, "c", int.class, int.class);

        BufferedReader in = new BufferedReader(new InputStreamReader(System.in, StandardCharsets.US_ASCII));
        StringBuilder out = new StringBuilder();
        for (String line; (line = in.readLine()) != null;) {
            if (line.isEmpty()) continue;
            String[] f = line.split(" ");
            String op = f[0];
            int[] a = new int[f.length - 1];
            for (int i = 1; i < f.length; i++) a[i - 1] = Integer.parseInt(f[i]);
            calls.setLength(0);
            String result;
            switch (op) {
                case "tables":
                    result = hash((int[]) sinTable.get(null)) + " " + hash((int[]) cosTable.get(null)) + " "
                        + hash((int[]) divTable.get(null)) + " " + hash((int[]) divTable2.get(null));
                    break;
                case "fb": {
                    int[] px = new int[a[0] * a[1]];
                    fill(px, a[2]);
                    pixels.set(null, px);
                    pixWidth.setInt(null, a[0]);
                    pixHeight.setInt(null, a[1]);
                    result = "ok";
                    break;
                }
                case "fbnull":
                    pixels.set(null, null);
                    result = "ok";
                    break;
                case "fill": {
                    int[] px = (int[]) pixels.get(null);
                    if (px != null) fill(px, a[0]);
                    result = "ok";
                    break;
                }
                case "clip":
                case "bounds":
                case "origin":
                case "reset": {
                    String r;
                    if (op.equals("clip")) {
                        pixClipMinX.setInt(null, a[0]);
                        pixClipMinY.setInt(null, a[1]);
                        pixClipMaxX.setInt(null, a[2]);
                        pixClipMaxY.setInt(null, a[3]);
                        r = run(() -> setRenderClipping.invoke(null));
                    } else if (op.equals("bounds")) {
                        r = run(() -> setBounds.invoke(null, a[0], a[1], a[2], a[3]));
                    } else if (op.equals("origin")) {
                        r = run(() -> setOrigin.invoke(null, a[0], a[1]));
                    } else {
                        r = run(() -> resetOrigin.invoke(null));
                    }
                    int[] d = (int[]) scanline.get(null);
                    result = r + " " + width.getInt(null) + " " + height.getInt(null) + " " + originX.getInt(null) + " " + originY.getInt(null)
                        + " " + clipMinX.getInt(null) + " " + clipMaxX.getInt(null) + " " + clipMinY.getInt(null) + " " + clipMaxY.getInt(null)
                        + " " + (d == null ? -1 : d.length) + " " + hash(d);
                    break;
                }
                case "offsets": {
                    int[] v = new int[2];
                    String y = run(() -> v[0] = (Integer) getOffsetY.invoke(null));
                    String x = run(() -> v[1] = (Integer) getOffsetX.invoke(null));
                    result = y + " " + v[0] + " " + x + " " + v[1];
                    break;
                }
                case "state":
                    lowDetail.setBoolean(null, a[0] != 0);
                    trans.setInt(null, a[1]);
                    hclip.setBoolean(null, a[2] != 0);
                    textureFallback.setBoolean(null, a[3] != 0);
                    lowMemTexture.setBoolean(null, a[4] != 0);
                    opaque.setBoolean(null, a[5] != 0);
                    result = "ok";
                    break;
                case "hclip":
                    testHclip.invoke(null, a[0], a[1], a[2]);
                    result = hclip.getBoolean(null) ? "1" : "0";
                    break;
                case "bright": {
                    brightness.setFloat(null, Float.intBitsToFloat(a[0]));
                    String r = run(() -> initColourTable.invoke(null, 0, 512));
                    result = r + " " + hash((int[]) colourTable.get(null));
                    break;
                }
                case "colours": {
                    String r = run(() -> initColourTable.invoke(null, a[0], a[1]));
                    result = r + " " + hash((int[]) colourTable.get(null));
                    break;
                }
                case "setbright": {
                    mathRandom.setSeed(a[0]);
                    String r = run(() -> setBrightness.invoke(null, Float.intBitsToFloat(a[1])));
                    result = r + " " + Float.floatToRawIntBits(brightness.getFloat(null)) + " " + hash((int[]) colourTable.get(null));
                    break;
                }
                case "setrand":
                    mathRandom.setSeed(a[0]);
                    setRandomBrightness.invoke(null, Float.intBitsToFloat(a[1]));
                    result = Integer.toString(Float.floatToRawIntBits(brightness.getFloat(null)));
                    break;
                case "adjust":
                    result = Integer.toString((Integer) adjustLightness.invoke(null, a[0], a[1]));
                    break;
                case "loader":
                    setTextures.invoke(null, a[0] == 0 ? null : loader);
                    result = textureProvider.get(null) == null ? "0" : "1";
                    break;
                case "unload":
                    unload.invoke(null);
                    result = (scanline.get(null) == null ? "1" : "0") + (colourTable.get(null) == null ? "1" : "0")
                        + (textureProvider.get(null) == null ? "1" : "0") + (divTable.get(null) == null ? "1" : "0")
                        + (divTable2.get(null) == null ? "1" : "0") + (sinTable.get(null) == null ? "1" : "0")
                        + (cosTable.get(null) == null ? "1" : "0");
                    break;
                case "flat":
                case "gouraud":
                case "ttex":
                case "tex":
                case "rflat":
                case "rgour":
                case "rttex":
                case "rtex": {
                    Object[] args;
                    Method target;
                    switch (op) {
                        case "flat": target = flatTriangle; args = boxed(a, 0, 7); break;
                        case "gouraud": target = gouraudTriangle; args = boxed(a, 0, 9); break;
                        case "ttex": target = terrainTextureTriangle; args = boxed(a, 0, 19); break;
                        case "tex": target = textureTriangle; args = boxed(a, 0, 19); break;
                        case "rflat": target = flatRaster; args = withPixels(pixels.get(null), boxed(a, 0, 5)); break;
                        case "rgour": target = gouraudRaster; args = withPixels(pixels.get(null), boxed(a, 0, 7)); break;
                        default: {
                            target = op.equals("rttex") ? terrainTextureRaster : textureRaster;
                            Object[] rest = boxed(a, 1, 13);
                            args = new Object[15];
                            args[0] = pixels.get(null);
                            args[1] = TEXELS[a[0]];
                            System.arraycopy(rest, 0, args, 2, 13);
                            break;
                        }
                    }
                    Method m = target;
                    Object[] callArgs = args;
                    String r = run(() -> m.invoke(null, callArgs));
                    result = r + " " + hash((int[]) pixels.get(null)) + " " + (textureFallback.getBoolean(null) ? 1 : 0)
                        + (lowMemTexture.getBoolean(null) ? 1 : 0) + (opaque.getBoolean(null) ? 1 : 0) + (hclip.getBoolean(null) ? 1 : 0)
                        + " " + (calls.length() == 0 ? "-" : calls.toString());
                    break;
                }
                default:
                    throw new IllegalArgumentException("unknown op " + line);
            }
            out.append(result).append('\n');
        }
        System.out.print(out);
        System.out.flush();
    }

    static Object[] boxed(int[] a, int from, int count) {
        if (a.length != from + count) throw new IllegalArgumentException("expected " + (from + count) + " arguments, got " + a.length);
        Object[] o = new Object[count];
        for (int i = 0; i < count; i++) o[i] = a[from + i];
        return o;
    }

    static Object[] withPixels(Object pixels, Object[] rest) {
        Object[] o = new Object[rest.length + 1];
        o[0] = pixels;
        System.arraycopy(rest, 0, o, 1, rest.length);
        return o;
    }
}
