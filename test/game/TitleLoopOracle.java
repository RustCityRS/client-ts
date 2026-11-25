import java.lang.reflect.Field;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.util.Arrays;
import java.util.stream.Collectors;

class TitleLoopOracle {
    static Method loop;
    static client app;
    static int script;

    static int count(gk list) {
        int n = 0;
        for (jf node = list.c.g; node != list.c; node = node.g) n++;
        return n;
    }

    static wf event(aj component, int digit) {
        m code = new m();
        code.D = new int[]{42,0,4002,0,4000,43,21};
        code.F = new int[]{0,10,0,digit,0,0,0};
        code.B = new id[code.D.length];
        sf.g.a(++script,0,code);
        wf event = new wf();
        event.C = component;
        event.G = new Object[]{script};
        return event;
    }

    static void tick() throws Exception {
        String status = "ok";
        try { loop.invoke(app,(byte)94); }
        catch (InvocationTargetException ex) {
            if (!(ex.getCause() instanceof RuntimeException)) throw ex;
            status = "threw";
        }
        String keys = Arrays.stream(sc.T,0,ok.D).mapToObj(Integer::toString).collect(Collectors.joining(","));
        String chars = Arrays.stream(hd.i,0,ok.D).mapToObj(Integer::toString).collect(Collectors.joining(","));
        System.out.println(String.join("/",status,keys,chars,""+id.p,""+bb.e,""+fk.Y,""+od.U[0],
            ""+count(db.s),""+count(ra.r),""+count(mi.q),""+(b.L != null),""+pa.tb,""+tb.k));
    }

    public static void main(String[] args) throws Exception {
        Class<?> unsafe = Class.forName("sun.misc.Unsafe");
        Field singleton = unsafe.getDeclaredField("theUnsafe"); singleton.setAccessible(true);
        app = (client)unsafe.getMethod("allocateInstance",Class.class).invoke(singleton.get(null),client.class);
        loop = client.class.getDeclaredMethod("g",byte.class); loop.setAccessible(true);
        hh.kb=1; hd.m=-1; id.p=0; bb.e=9; fk.Y=3; od.U[0]=0; tb.k=0;
        rg.b=new boolean[]{true}; aj parent=new aj();
        aj good=new aj(), stale=new aj(), high=new aj(), root=new aj();
        good.bc=stale.bc=0; high.bc=2; root.bc=-1; good.n=stale.n=high.n=0;
        parent.pb=new aj[]{good}; fk.ab=new aj[][]{{parent}};
        g.s=126; ob.C=1; ti.N[126]=3;ti.N[127]=4;ti.N[0]=5;ak.f[126]=97;ak.f[127]=0;ak.f[0]=-1;
        db.s.a(event(root,1),false); db.s.a(event(stale,7),false); db.s.a(event(good,2),false);
        ra.r.a(event(high,8),false); ra.r.a(event(root,3),false); mi.q.a(event(root,4),false);
        b.L = new dj(); b.L.b=2; pa.tb=true;
        tick();
        b.L.b=1;
        db.s.a(event(null,8),false); ra.r.a(event(root,5),false); mi.q.a(event(root,6),false);
        tick(); tick(); tick();
        hd.m=3; fk.ab=null; rg.b=null;
        db.s.a(event(root,7),false);
        tick();
        hd.m=-1; tick();
        hi.f=765; fl.l=503; hd.m=0; rg.b=new boolean[]{true}; fk.ab=new aj[][]{{parent}};
        parent.n=-1; parent.bc=-1; parent.Kc=0; parent.y=parent.i=true; parent.ob=4;
        parent.C=24; parent.H=24; parent.J=event(parent,9).G;
        tick(); tick();
        hh.kb=1500; hd.m=-1; pe.T=root; vf.Y=null; wg.d=bk.vc=ed.h=true; ca.a=1;
        root.ad=event(root,2).G; b.L=new dj(); b.L.b=1; pa.tb=true;
        tick();
        vf.Y=parent;
        tick();
        pe.T=null;
        Field random = Class.forName("java.lang.Math$RandomNumberGeneratorHolder").getDeclaredField("randomNumberGenerator");
        random.setAccessible(true);
        var rng=(java.util.Random)random.get(null);
        Field seedField=java.util.Random.class.getDeclaredField("seed");seedField.setAccessible(true);
        var seed=(java.util.concurrent.atomic.AtomicLong)seedField.get(rng);
        al sprites = new al(new ud() {
            db b(int dummy) { return null; }
            byte[] a(int mode,int group) { return null; }
            void b(int group,int dummy) {}
            int c(int group,int dummy) { return 0; }
        },true,true);
        var screen=new java.awt.image.BufferedImage(765,503,java.awt.image.BufferedImage.TYPE_INT_RGB);
        aj.kb=(java.awt.Frame)unsafe.getMethod("allocateInstance",Class.class).invoke(singleton.get(null),java.awt.Frame.class);
        pe.S=new java.awt.Canvas(){ public java.awt.Graphics getGraphics(){return screen.getGraphics();} };
        rg.s=new wc();rg.s.a(503,765,pe.S,(byte)-34);
        hi.f=vk.rb=765; fl.l=oh.j=503; hi.g=wd.b=qf.f=false;oa.a=0L;
        aj flame=new aj();
        flame.Kc=0;flame.n=-1;flame.y=true;flame.ob=3;flame.wc=1402;flame.ib=16;flame.Mb=16;flame.C=128;flame.H=254;
        fk.ab=new aj[][]{{flame}};rg.b=new boolean[]{true};hd.m=0;tf.C=10;
        // Initialize the same shuffled owners as an already displayed title screen before assigning the test RNG.
        od.a(sprites,0);fk.Y=0;app.d(0);
        rng.setSeed(1431);od.a(sprites,0);
        Arrays.fill(rg.s.n,0x999933);
        System.out.println("setup/"+seed.get());
        for (int cycle=1; cycle<=75; cycle++) {
            hh.kb=cycle;
            loop.invoke(app,(byte)94);
            if (cycle % 5 == 0) {
                int pending=fk.Y;
                app.d(0);
                int hash=1;
                for(int i=0;i<765*503;i++)hash=31*hash+rg.s.n[i];
                System.out.println(cycle+"/"+pending+"/"+fk.Y+"/"+flame.vb+"/"+flame.R+"/"+ik.G+"/"+
                    sf.m[0]+"/"+ce.T[0]+"/"+seed.get()+"/"+hash);
            }
        }
    }
}
