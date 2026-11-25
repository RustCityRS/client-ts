import java.io.*;
import java.awt.Canvas;
import java.awt.Image;
import java.awt.image.BufferedImage;
import java.lang.reflect.*;
import java.nio.ByteBuffer;
import java.nio.file.*;
import java.security.MessageDigest;
import java.util.*;

// One invocation advances each real lg.b stage, including archive/loc lookups.
class WorldMapTerrainOracle {
    static class Clock extends e {
        int resets;
        void a(byte ignored) { resets++; }
        int a(byte ignored,int minimum,int time) { return 1; }
    }
    static class Surface extends Canvas {
        public Image createImage(int width,int height) {
            return new BufferedImage(width,height,BufferedImage.TYPE_INT_RGB);
        }
    }
    static final Clock clock = new Clock();
    static String digest(Object value) throws Exception {
        MessageDigest digest=MessageDigest.getInstance("SHA-256");
        update(digest,value);
        return HexFormat.of().formatHex(digest.digest());
    }
    static void update(MessageDigest d,Object value) {
        int count=value==null?-1:Array.getLength(value);
        d.update(ByteBuffer.allocate(4).putInt(count).array());
        if (value instanceof byte[] bytes) d.update(bytes);
        else if(value instanceof int[] ints) {
            ByteBuffer b=ByteBuffer.allocate(4*count);
            for(int i:ints) b.putInt(i);
            d.update(b.array());
        } else if(value instanceof Object[] a) for(Object item:a) update(d,item);
    }
    static void dump() throws Exception {
        ArrayList<Integer> icons=new ArrayList<>();
        for(mi item=(mi)rf.v.d(0);item!=null;item=(mi)rf.v.a(0)) {
            icons.add(item.s);icons.add(item.z);icons.add(item.F);
        }
        var out = new StringJoiner("/");
        for (Object value:new Object[]{sa.w,oi.a,od.P,ki.db,ml.m,c.C,sg.b,Float.floatToIntBits(hd.h),Float.floatToIntBits(ug.f),e.f,qi.S,
            jg.t==null?-1:jg.t.h,clock.resets,mc.U,mc.P,hc.c[0].d[4][5],hc.c[1].d[4][5],hc.c[2].d[4][5],hc.c[3].d[4][5],
            lk.E!=null,ig.y!=null,ia.k!=null,rb.b!=null,qa.T!=null,t.Y!=null,ml.Q!=null,hj.j!=null})
            out.add(String.valueOf(value));
        for (Object data:new Object[]{pa.wb,tb.w,af.J,mg.o,hc.f,fl.g,hh.ob,ai.a,qj.L,icons.stream().mapToInt(Integer::intValue).toArray()})
            out.add(digest(data));
        System.out.println(out);
    }
    static void malformed(int mode,byte[] bytes) throws Exception {
        gd packet=new gd(bytes);
        boolean threw=false;
        try {
            if(mode==0) gl.a(packet,-1276586906);
            else if(mode==1) oc.a((byte)-82,packet);
            else if(mode==2) sj.b(81,packet);
            else og.b(packet,63);
        } catch(RuntimeException ex) { threw=true; }
        System.out.println(mode+"/"+packet.yb+"/"+threw);
    }
    static void edge(String label,Runnable action)throws Exception{
        String fault="ok";
        try{action.run();}catch(RuntimeException failure){
            Throwable cause=failure;
            while(cause instanceof g)cause=((g)cause).a;
            fault=cause instanceof NullPointerException?"null":cause instanceof IndexOutOfBoundsException?"bounds":cause.getClass().getSimpleName();
        }
        StringJoiner out=new StringJoiner("/");
        for(Object value:new Object[]{label,fault,sa.w,oi.a,od.P,ki.db,ml.m,c.C,sg.b,mc.P,mc.U,clock.resets,hc.c[0].d[4][5],
            hc.c[1].d[4][5],hc.c[2]==null?-1:hc.c[2].d[4][5],hc.c[3].d[4][5],ab.T[0],tj.c[0],mg.T,
            digest(pa.wb),tb.w==null?-1:tb.w.length,tb.w==null||tb.w.length!=1?"-":digest(tb.w),lk.E!=null})
            out.add(String.valueOf(value));
        System.out.println(out);
    }
    static al delayed(WorldMapOracle.Provider source,int percent) {
        return new al(new ud(){
            db b(int ignored){return source.index;}
            byte[] a(int mode,int group){return null;}
            void b(int ignored,int group){}
            int c(int group,int ignored){return percent;}
        },true,true);
    }
    static void edges(WorldMapOracle.Provider source,al map)throws Exception{
        sa.w=3;he.y=delayed(source,17);aa.d=delayed(source,87);
        edge("wait",()->lg.b(true));aa.d=null;
        edge("missing-percent-archive",()->lg.b(true));
        he.y=aa.d=map;sa.w=0;
        for(int i=0;i<4;i++)hc.c[i].d[4][5]=11+i;
        ke savedMap=hc.c[2];hc.c[2]=null;mc.P=59;
        edge("missing-third-collision-map",()->lg.b(true));hc.c[2]=savedMap;
        sa.w=10;oi.a=23;od.P=-9;ki.db=37;ml.m=413;pb player=te.g;te.g=null;
        edge("missing-player",()->lg.b(true));te.g=player;
        pc materials=dc.r;dc.r=null;
        edge("missing-materials",()->lg.b(true));dc.r=materials;
        sa.w=20;gh.X=null;mc.U=38;ab.T[0]=17L;tj.c[0]=29L;mg.T=31;
        edge("missing-clock",()->lg.b(true));gh.X=clock;
        sa.w=70;lk.E=null;pe.S=null;
        edge("missing-font-surface",()->lg.b(true));
        ki.db=ml.m=64;oi.a=od.P=0;tb.w=new int[1][1][];dc.o=null;
        byte[] tile=new byte[69];tile[0]=1;tile[5]=1;
        edge("missing-palette",()->og.b(new gd(tile),63));
        pa.wb=new int[]{917};dc.o=new int[65536];
        edge("short-overlay-table",()->lj.a(0,0,122));
        Field random=Class.forName("java.lang.Math$RandomNumberGeneratorHolder").getDeclaredField("randomNumberGenerator");
        random.setAccessible(true);
        for(int seed=0;seed<32;seed++){
            int[] hues={-8,0,8,Integer.MAX_VALUE},lights={16,0,-16,Integer.MIN_VALUE};
            ki.X=hues[seed%4];si.u=lights[seed%4];
            ((Random)random.get(null)).setSeed(seed);
            // A fresh JVM has terrain flags but no scene-building scratch arrays. al.a still commits both offsets.
            try{al.a(128,hc.c,false);}catch(RuntimeException ignored){}
            System.out.println(seed+"/"+ki.X+"/"+si.u+"/"+(int)(Math.random()*32768.0));
        }
    }
    public static void main(String[] argv) throws Exception {
        DataInputStream in=new DataInputStream(new BufferedInputStream(Files.newInputStream(Path.of(argv[0]))));
        WorldMapOracle.Provider source=new WorldMapOracle.Provider(in);
        al map=new al(source,true,true);
        al conf=new al(new WorldMapOracle.Provider(in),false,true);
        al locs=new al(new WorldMapOracle.Provider(in),false,true);
        al varbits=new al(new WorldMapOracle.Provider(in),false,true);
        al sprites=new al(new WorldMapOracle.Provider(in),false,true);
        qg.a(conf,-51);ic.a(conf,(byte)-110);sb.a(conf,(byte)58,locs,true);
        mc.a(120,new rh[4],map);aa.d=map;
        // Varbit + Varp definitions consulted by multi-locs.
        mi.a(415013098,varbits);
        for(int i=0;i<4;i++) {hc.c[i]=new ke(104,104);hc.c[i].d[4][5]=317+i;}
        tf.C=30;mc.P=28;
        gh.X=clock;pe.S=new Surface();te.g=new pb();te.g.Z=3328;te.g.S=9856;hk.e=32;vj.t=120;
        dc.r=(pc)Proxy.newProxyInstance(pc.class.getClassLoader(),new Class[]{pc.class},(p,m,a)->{
            if(m.getName().equals("b")) return ((int)a[1]%3)!=0;
            if(m.getReturnType()==int.class) return ((int)a[1]*341)&65535;
            throw new AssertionError(m);
        });
        for(int i=0;i<dc.o.length;i++) dc.o[i]=(i*111387+5734519)&0xffffff;
        cg.i=-7;ok.q=9;ki.X=6;si.u=-5;
        fi.b(-1,vb.a("main",(byte)58));
        do { mc.U=27;lg.b(true);dump(); } while(sa.w<100);
        n.g=conf; mj.d=sprites; gl.D=hj.h=pj.E=0;
        boolean rendered=false;
        realView:
        for (int cx=0;cx<ai.a.length;cx++) for(int cz=0;cz<ai.a[cx].length;cz++) {
            int[] chunk=ai.a[cx][cz];
            if (chunk==null) continue;
            for (int i=0;i<chunk.length;i++) if ((chunk[i]&0x3fff)!=0) {
                int x=(cx<<6)+(i&63), z=(cz<<6)+(i>>6);
                int[] pixels=new int[193*117];
                Arrays.fill(pixels,0x2b4059);
                td.a(pixels,193,117); td.b(5,4,189,113);
                jf.a(201,z-15,x+23,125,z+16,x-24,-6,-8,(byte)-91);
                System.out.println("view/"+x+"/"+z+"/"+digest(pixels));
                rendered=true;
                break realView;
            }
        }
        if (!rendered) throw new AssertionError("No map-scene sprite in the cache");
        for(int i=0,n=in.readInt();i<n;i++) {
            int mode=in.readInt();
            malformed(mode,in.readNBytes(in.readInt()));
        }
        edges(source,map);
    }
}
