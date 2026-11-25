import java.awt.Canvas;
import java.awt.Image;
import java.awt.image.BufferedImage;
import java.nio.file.*;
import java.util.*;

/** Original map viewport (wa.a), overview (a.a), and window-resource map reset (jb.a). */
public final class HdWorldMapViewportOracle {
    static final class SwitchingOverview extends qf {
        SwitchingOverview(int width, int height) { W=width; I=height; }
        void c(int x, int y) { tf.w=false; }
        void a(int a,int b,int c,int d,int e,int f) { throw new AssertionError(); }
        void a(int a,int b,int c) { throw new AssertionError(); }
        void a(int a,int b,int c,int d) { throw new AssertionError(); }
        void d(int a,int b) { throw new AssertionError(); }
        void b(int a,int b,int c,int d,int e) { throw new AssertionError(); }
        void e(int a,int b) { throw new AssertionError(); }
    }
    static final IdentityHashMap<Object,Integer> identities = new IdentityHashMap<>();
    static int id(Object value) { return value == null ? 0 : identities.computeIfAbsent(value, v -> identities.size()+1); }
    static void populate() {
        dc.O = 100;
        dl.e = oi.m = 64;
        gj.r = 4.0f; bc.W = 32; cd.u = 32;
        wa.ub = new bn(null,null,0,0,0x533644,true,50);
        uc.d = new int[1][1][4096];
        ck.J = new byte[1][1][4096]; hb.v = new byte[1][1][4096];
        si.R = new byte[1][1][4096]; jl.I = new byte[1][1][4096];
        fi.m = new byte[1][1][4096]; lf.b = new int[]{0,0xc48516,0x1961af};
        for (int i=0;i<4096;i++) {
            uc.d[0][0][i] = 1 + ((0x396941+i*0x10507)&0xffffff);
            if (i%5==1) { ck.J[0][0][i]=1; hb.v[0][0][i]=(byte)(4+i%38); }
            if (i%11==5) { si.R[0][0][i]=2; jl.I[0][0][i]=(byte)(4+i%19); }
            if (i%19==11) fi.m[0][0][i]=(byte)(1+i%28);
        }
        gj.i = new int[1][1][]; eh.g = new int[1][1][];
        qh.a = new se(1);
        qh.a.j[0]=cd.a("Town",(byte)-125); qh.a.q[0]=32; qh.a.d[0]=31;
        qh.a.n[0]=0xaced13; qh.a.u[0]=8;
        ma.q = new fd(12,true,md.L);
        hc.P = 1; qf.S = 3;
    }
    public static void main(String[] args) throws Exception {
        Path dir = Path.of(args[0]);
        en data = HdTitleFrameOracle.open(dir.resolve("main_file_cache.dat2"),5200);
        en index = HdTitleFrameOracle.open(dir.resolve("main_file_cache.idx255"),6000);
        ge master = new ge(255,data,index,500000);
        ve sprites = new ve(new HdTitleFrameOracle.Disk(master,data,dir,8),false,false);
        ve metrics = new ve(new HdTitleFrameOracle.Disk(master,data,dir,13),false,false);
        md.L = new Canvas() {
            public Image createImage(int w,int h) { return new BufferedImage(w,h,BufferedImage.TYPE_INT_RGB); }
        };
        try (GlRecorder recorder = new GlRecorder(Path.of(args[1]))) {
            tf.t = recorder.gl(); tf.w = true; tf.J=180; tf.A=112;
            g.a(208,sprites); hn.a(metrics,0,sprites);
            int[] screen = new int[tf.J*tf.A]; kb.a(screen,tf.J,tf.A);
            for (String line : Files.readAllLines(Path.of(args[2]))) {
                String[] p = line.split(" "); int x=Integer.parseInt(p[1]),y=Integer.parseInt(p[2]),w=Integer.parseInt(p[3]),h=Integer.parseInt(p[4]);
                recorder.mark(line.replace(' ','_'));
                String result="ok";
                try {
                    switch(p[0]) {
                        case "loading" -> { wa.ub=null; dc.O=40; wa.a(x,64,y,h,w); }
                        case "open" -> populate();
                        case "main" -> wa.a(x,64,y,h,w);
                        case "pan" -> { bc.W+=2; cd.u-=1; wa.a(x,64,y,h,w); }
                        case "overview" -> a.a(x,h,w,19481,y);
                        case "overview-switch" -> {
                            kb.a(screen,tf.J,tf.A);
                            fi.j=new SwitchingOverview(w,h);
                            a.a(x,h,w,19481,y);
                        }
                        case "fault" -> { qh.a=null; wa.a(x,64,y,h,w); }
                        case "empty", "negative" -> wa.a(x,64,y,h,w);
                        case "missing-icons" -> { gj.i=null; wa.a(x,64,y,h,w); }
                        case "missing-ground" -> { uc.d=null; wa.a(x,64,y,h,w); }
                        case "close" -> jb.a(17,false);
                        case "software", "software-gpu" -> { tf.w=false; kb.a(screen,tf.J,tf.A); wa.a(x,64,y,h,w); }
                        case "active" -> tf.w=true;
                    }
                } catch (ld e) { result=e.e+"|"+e.f.getClass().getSimpleName(); }
                System.out.println(line+"|"+result+"|"+id(mc.S)+","+id(fi.j)+","+id(kb.i)+"|"+
                    (mc.S==null ? "-" : mc.S.W+","+mc.S.I+","+Arrays.hashCode(mc.S.L))+"|"+
                    (fi.j==null ? "-" : fi.j.getClass().getSimpleName())+"|"+Arrays.hashCode(screen)+"|"+
                    cm.c+","+ig.b+","+ig.f+","+ha.o+","+hc.P+","+qf.S);
            }
            mc.S=new mm(1,1);
            ((client)HdTitleFrameOracle.headlessInstance(client.class)).c(126);
            System.out.println("shutdown|"+(mc.S==null));
        }
    }
}
