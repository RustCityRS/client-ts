import java.lang.reflect.Field;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Proxy;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.*;
import javax.media.opengl.GL;

/** Unmodified gn.a and be.a on the original HD gamepack. Real cf/el objects and JOGL calls,
 * software pixels, both clip rectangles, and the cached object left by each draw. */
public class HdTiledWidgetOracle {
    static final int width = 41, height = 33;
    static final List<Object> keep = new ArrayList<>();
    static boolean drawing;
    static int mode, scissor;

    static String outcome(Throwable error) {
        String context = "";
        if (error instanceof ld wrapper) { context = "@" + wrapper.e; error = wrapper.f; }
        return error.getClass().getSimpleName() + context;
    }
    static String type(Object s) {
        if (s == null) return "_";
        if (s instanceof el) return "el";
        if (s instanceof cf) return "cf";
        if (s instanceof am) return "am";
        if (s instanceof mm) return "mm";
        return "other";
    }
    public static void main(String[] args) throws Exception {
        Path dir = Path.of(args[0]), cache = Path.of(args[2]);
        en data = HdTitleFrameOracle.open(cache.resolve("main_file_cache.dat2"),5200);
        ge master = new ge(255,data,HdTitleFrameOracle.open(cache.resolve("main_file_cache.idx255"),6000),500000);
        bm.f = new ve(new HdTitleFrameOracle.Disk(master,data,cache,8),false,false);
        GlRecorder recorder = new GlRecorder(dir);
        GL delegate = recorder.gl();
        tf.t = (GL) Proxy.newProxyInstance(GL.class.getClassLoader(),new Class<?>[]{GL.class},(self,method,values) -> {
            String name = method.getName();
            if (drawing) {
                if (name.equals("glScissor") && (++scissor == 2 && mode == 7 || scissor == 3 && mode == 8)) throw new IllegalStateException();
                if (mode == 6 && (name.equals("glCallList") || name.equals("glBegin"))) throw new IllegalStateException();
                if (mode == 13 && name.equals("glVertex2f")) throw new AssertionError();
            }
            try { return method.invoke(delegate,values); }
            catch (InvocationTargetException ex) { throw ex.getCause(); }
        });
        Field clipRight = dj.class.getDeclaredField("d");
        clipRight.setAccessible(true);
        tf.J = width; tf.A = height;
        int row = 0;
        for (String line : Files.readAllLines(Path.of(args[1]))) {
            int[] a = Arrays.stream(line.split(" ")).mapToInt(Integer::parseInt).toArray();
            boolean active = a[0] != 0, alpha = a[1] != 0;
            int shape = a[2], angle = a[3], transparency = a[4];
            mode = a[5];
            recorder.mark("case" + row++);
            tf.w = active;
            be c = new be();
            c.Fc = 20; c.N = -1; c.I = 5; c.Hb = true; c.H = true;
            c.jd = 5; c.jb = 4; c.n = 24; c.R = 18; c.ed = angle; c.wb = transparency; c.c = alpha;
            c.xb = mode == 9 ? new int[]{9,641,802,13}[shape] : mode == 14 ? -1 : 300;
            c.Q = -1;
            long key = ((alpha ? 1L : 0L) << 35) + c.xb;
            pf.b = new n(16);
            Object inserted = null;
            if (mode != 9 && mode != 14) {
                int w = (shape & 1) == 0 ? 4 : 3;
                int h = (shape & 2) == 0 ? 4 : 3;
                int cropW = mode == 3 ? 0 : w == 4 ? 7 : 8;
                int cropH = mode == 4 ? 0 : h == 4 ? 5 : 8;
                int[] source = new int[w*h];
                for (int i = 0; i < source.length; i++) {
                    int rgb = (0x61275a + i*0x214257) & 0xffffff;
                    source[i] = i%5 == 1 ? 0 : rgb | (alpha ? ((i*61+47)&255)<<24 : 0);
                }
                mm software = alpha ? new am(cropW,cropH,1,1,w,h,source) : new mm(cropW,cropH,1,1,w,h,source);
                Object cached = software;
                if (mode == 2) cached = new Object();
                else if (active != (mode == 1)) cached = alpha ? new el(software) : new cf(software);
                if (mode == 10) ((qf)cached).W = 0;
                if (mode == 11) ((qf)cached).I = 0;
                pf.b.a((byte)-75,cached,key);
                inserted = cached;
                keep.add(cached);
            }
            sc.z[0] = true; pa.R[0] = false; rc.C = true;
            int[] pixels = new int[mode == 5 ? 226 : width*height];
            for (int i = 0; i < pixels.length; i++) pixels[i] = 0x172635 + i*13;
            kb.a(pixels,width,height); kb.c(1,1,20,14);
            dj.d(1,2,21,17);
            scissor = 0; drawing = true;
            String result = "ok";
            try { gn.a(2,3,7,new be[]{c},30,-1,4,27,(byte)119,0); }
            catch (RuntimeException | AssertionError error) { result = outcome(error); }
            finally { drawing = false; }
            Object cached = pf.b.b(key,(byte)121);
            keep.add(cached);
            String token = type(cached) + ":" + (cached == null ? "empty" : cached == inserted ? "same" : "loaded");
            if (cached instanceof qf s) token += "," + s.J + "," + s.V + "," + s.W + "," + s.I;
            String sw = kb.b + "," + kb.d + "," + kb.e + "," + kb.h;
            String gl = dj.c + "," + dj.b + "," + clipRight.getInt(null) + "," + dj.e;
            ByteBuffer frame = ByteBuffer.allocate(pixels.length*4).order(ByteOrder.LITTLE_ENDIAN);
            frame.asIntBuffer().put(pixels);
            System.out.println(String.join("|",result,token,sw,gl,c.Uc+","+rc.C+","+pa.R[0],Base64.getEncoder().encodeToString(frame.array())));
        }
        recorder.close();
    }
}
