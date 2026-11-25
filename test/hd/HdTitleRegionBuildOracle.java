import java.awt.Canvas;
import java.lang.reflect.Field;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Proxy;
import java.lang.reflect.Method;
import java.nio.file.Path;
import java.util.Arrays;
import java.util.Random;
import java.util.HashSet;
import java.util.Set;
import javax.media.opengl.GL;

/** Observe the rebuilt maps before the first tick or draw of the HD title. */
public final class HdTitleRegionBuildOracle {
    private static final class Complete extends Error {}

    private static Object field(Object owner, String name) throws ReflectiveOperationException {
        Field f = owner.getClass().getDeclaredField(name);
        f.setAccessible(true);
        return f.get(owner);
    }

    private static String cacheState(nk cache) throws ReflectiveOperationException {
        Object solid = field(cache,"G");
        return field(cache,"J") + " " + field(cache,"z") + " " + field(field(cache,"P"),"r") + " "
            + (solid == null ? "-" : field(solid,"r"));
    }

    private static void tickState(int tick) {
        int actors = 1;
        for (int i = 0; i < nm.S.length; i++) {
            km a = nm.S[i];
            if (a == null) continue;
            actors = actors * 31 + Arrays.hashCode(new int[]{i,a.Qb,a.ac,a.Nb,a.Ab,a.cb,a.H,a.wb,a.Kb,a.kb,
                Arrays.hashCode(a.K),Arrays.hashCode(a.w),Arrays.hashCode(a.mb)});
        }
        System.out.println("tick " + tick + " " + km.Pc + " " + af.d + " " + kh.f + " " + tg.b + " " + ol.ib
            + " " + t.z + " " + actors + " " + Arrays.deepHashCode(li.h[ee.b].m));
    }

    private static void removeLocations() {
        Set<String> seen = new HashSet<>();
        for (int plane = 0; plane < 4; plane++) for (int x = 1; x < 103; x++) for (int z = 1; z < 103; z++) {
            bj square = kc.o[plane][x][z];
            if (square == null) continue;
            for (int layer = 0; layer < 4; layer++) {
                long key;
                th model;
                if (layer == 0 && square.K != null) {key = vj.a(plane,x,z); model = square.K.e;}
                else if (layer == 1 && square.J != null) {key = l.a(plane,x,z); model = square.J.j;}
                else if (layer == 2 && kf.b(plane,x,z) != null) {key = cl.a(plane,x,z); model = kf.b(plane,x,z).c;}
                else if (layer == 3 && square.G != null) {key = bj.a(plane,x,z); model = square.G.c;}
                else continue;
                int shape = (int)(key >>> 14) & 31, angle = (int)(key >>> 20) & 3;
                String role = shape + "." + angle + "." + (model instanceof dc);
                if (!wc.a(4,(int)(key >>> 32) & Integer.MAX_VALUE).D || !seen.add(role)) continue;
                int height = plane < 3 && (bb.g[1][x][z] & 2) != 0 ? plane + 1 : plane;
                if (model instanceof dc animated) animated.d(3);
                String before = GlRecorder.sha(tj.a.o);
                dg.a(-96,z,x,plane,layer,height,li.h[plane]);
                System.out.println("remove " + role + " " + plane + " " + x + " " + z + " " + layer + " " + height
                    + " " + GlRecorder.sha(tj.a.o) + " " + Arrays.deepHashCode(li.h[plane].m) + " " + before);
            }
        }
    }

    public static void main(String[] args) throws Exception {
        Canvas canvas = new Canvas() { public boolean isDisplayable() { return true; } };
        canvas.setSize(765, 503);
        Field grid = jf.class.getDeclaredField("g");
        grid.setAccessible(true);
        Field random = Class.forName("java.lang.Math$RandomNumberGeneratorHolder").getDeclaredField("randomNumberGenerator");
        random.setAccessible(true);
        Random source = (Random)random.get(null);
        Field seed = Random.class.getDeclaredField("seed");
        seed.setAccessible(true);
        var onloadSeed = (java.util.concurrent.atomic.AtomicLong)seed.get(source);
        Method titleTick = client.class.getDeclaredMethod("d",byte.class);
        titleTick.setAccessible(true);
        Field brightness = hf.class.getDeclaredField("o");
        brightness.setAccessible(true);
        String[] cacheStages = new String[3];
        int[] colours = new int[4];
        byte[][] beforeFloorShadows = new byte[1][];
        try (GlRecorder recorder = new GlRecorder(Path.of(args[1])); AutoCloseable factory = recorder.installFactory()) {
            recorder.loadProfile(Path.of(args[2]));
            try {
                HdTitleFrameOracle.run(Path.of(args[0]), canvas, i -> {}, phase -> {
                    recorder.mark(phase);
                    try {
                        if (phase.equals("mode.hd")) cacheStages[0] = cacheState((nk)hf.e);
                        if (phase.equals("interface.onload")) {
                            cacheStages[1] = cacheState((nk)hf.e);
                            cacheStages[2] = cacheState(new nk(pk.Z,nd.t,ra.K,7,true));
                        }
                    } catch (ReflectiveOperationException ex) { throw new AssertionError(ex); }
                    if (phase.equals("interface.onload")) System.out.println("onload-seed " + (onloadSeed.get() ^ 0x5deece66dL));
                    if (phase.equals("region.build")) {
                        System.out.println("map-request " + onloadSeed.get() + " " + sg.o + " " + km.Pc + " " + kh.f + " "
                            + Arrays.toString(client.lb).replace(" ", ""));
                        colours[0] = gm.R;
                        colours[1] = ok.c;
                        source.setSeed(5302036L);
                        hf.a(0.7f);
                        try { colours[2] = Float.floatToRawIntBits(brightness.getFloat(null)); }
                        catch (IllegalAccessException ex) { throw new AssertionError(ex); }
                        colours[3] = Arrays.hashCode(hf.a);
                        // di.a finishes plane zero before it can stamp upper-floor shadows. Observe
                        // its first terrain VBO allocation, after p.a has stamped every location.
                        GL delegate = tf.t;
                        tf.t = (GL)Proxy.newProxyInstance(GL.class.getClassLoader(),new Class<?>[]{GL.class},(p,m,a)-> {
                            if (beforeFloorShadows[0] == null && m.getName().equals("glGenBuffersARB")
                                && StackWalker.getInstance().walk(s -> s.anyMatch(f -> f.getClassName().equals("di") && f.getMethodName().equals("a")))) {
                                beforeFloorShadows[0] = tj.a.o.clone();
                            }
                            try { return m.invoke(delegate,a); }
                            catch (InvocationTargetException e) { throw e.getCause(); }
                        });
                    }
                    if (!phase.equals("warmup")) return;
                    try {
                        System.out.println("region " + tl.d + " " + gf.R + " " + eb.u + " " + se.a + " " + lc.n
                            + " " + wi.db + " " + lg.k + " " + jf.l + " " + Arrays.deepHashCode((int[][][])grid.get(null))
                            + " " + Arrays.deepHashCode(gj.m) + " " + Arrays.deepHashCode(bb.g)
                            + " " + Arrays.deepHashCode(sm.e));
                        System.out.println("collision " + Arrays.deepHashCode(li.h[0].m) + " " + Arrays.deepHashCode(li.h[1].m)
                            + " " + Arrays.deepHashCode(li.h[2].m) + " " + Arrays.deepHashCode(li.h[3].m));
                        if (beforeFloorShadows[0] == null) throw new AssertionError("no plane-zero terrain VBO");
                        byte[] floor = tj.a.o.clone();
                        for (int i = 0; i < floor.length; i++) floor[i] -= beforeFloorShadows[0][i];
                        System.out.println("floor-shadows " + GlRecorder.sha(floor));
                        System.out.println("all-shadows " + GlRecorder.sha(tj.a.o));
                        System.out.println("texture-caches " + String.join(" ",cacheStages));
                        System.out.println("terrain-colours " + colours[0] + " " + colours[1] + " " + colours[2] + " " + colours[3]
                            + " " + gm.R + " " + ok.c);
                        for (int i = 0; i < jf.l; i++) {
                            fj mesh = jf.a[i].B;
                            System.out.println("light " + i + " " + (mesh == null ? "-" : mesh.l + " " + mesh.n));
                            if (mesh != null) {
                                recorder.mark("light." + i);
                                mesh.c();
                            }
                        }
                        source.setSeed(5303575L);
                        tickState(0);
                        for (int tick = 1; tick <= 120; tick++) {
                            ++gj.d;
                            titleTick.invoke(rh.j,(byte)1);
                            tickState(tick);
                        }
                        recorder.mark("scene.terrain");
                        GL scene = tf.t;
                        int[] depth = {0};
                        boolean[] terrain = {true};
                        boolean[] worldFinished = {false};
                        StackWalker walker = StackWalker.getInstance();
                        tf.t = (GL)Proxy.newProxyInstance(GL.class.getClassLoader(),new Class<?>[]{GL.class},(p,m,a)-> {
                            if (!terrain[0] && !worldFinished[0] && depth[0] == 0 &&
                                !walker.walk(s -> s.anyMatch(f -> f.getClassName().equals("mf") && f.getMethodName().equals("a")))) {
                                recorder.mark("scene.world.end");
                                worldFinished[0] = true;
                            }
                            Object value;
                            try { value = m.invoke(scene,a); }
                            catch (InvocationTargetException e) { throw e.getCause(); }
                            if (m.getName().equals("glPushMatrix")) depth[0]++;
                            if (m.getName().equals("glPopMatrix") && --depth[0] == 0 && terrain[0]
                                && walker.walk(s -> s.anyMatch(f -> f.getClassName().equals("uc") && f.getMethodName().equals("a")))) {
                                recorder.mark("scene.models");
                                terrain[0] = false;
                            }
                            return value;
                        });
                        ui.a(-6403,503,true,0,765,0);
                        if (terrain[0]) throw new AssertionError("no title terrain draw");
                        if (!worldFinished[0]) recorder.mark("scene.world.end");
                        System.out.println("visibility " + Arrays.deepHashCode(ha.k) + " " + Arrays.deepHashCode(dl.h));
                        System.out.println("submitted-shadows " + GlRecorder.sha(tj.a.o));
                        recorder.mark("scene.end");
                        removeLocations();
                        tf.t = scene;
                        tl.d = 30;
                        source.setSeed(5304500L);
                        th.a(false,0,-8914,-1,-1);
                        if (tf.w || tl.d != 25) throw new AssertionError("software switch " + tf.w + " " + tl.d);
                        gm.R = ok.c = 0;
                        source.setSeed(5304501L);
                        hf.a(0.7f);
                        for (int attempt = 0; attempt < 4 && tl.d == 25; attempt++) gd.c(-117);
                        System.out.println("software-region " + tl.d + " " + wi.db + " " + lg.k + " "
                            + Arrays.deepHashCode(gj.m) + " " + Arrays.deepHashCode(bb.g) + " "
                            + Arrays.deepHashCode(li.h[0].m) + " " + Arrays.deepHashCode(li.h[1].m)
                            + " " + Arrays.deepHashCode(li.h[2].m) + " " + Arrays.deepHashCode(li.h[3].m));
                        if (tl.d != 30 || wi.db != 25) throw new AssertionError("software region");
                        bi.jb = false;
                        Arrays.fill(kb.i,0x345678);
                        for (int frame = 0; frame < 2; frame++) {
                            if (frame == 1) ol.ib = (ol.ib + 256) & 2047;
                            ui.a(-6403,334,false,4,512,4);
                            Path image = Path.of(args[1],"software-scene-" + frame + ".i32");
                            try (var pixels = new java.io.DataOutputStream(new java.io.BufferedOutputStream(java.nio.file.Files.newOutputStream(image)))) {
                                for (int value : kb.i) pixels.writeInt(value);
                            } catch (java.io.IOException ex) { throw new AssertionError(ex); }
                        }
                    } catch (ReflectiveOperationException ex) { throw new AssertionError(ex); }
                    throw new Complete();
                });
                throw new AssertionError("unreached warmup boundary");
            } catch (Complete expected) {}
        }
    }
}
