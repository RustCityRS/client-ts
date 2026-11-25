import java.io.*;
import java.lang.reflect.*;
import java.nio.*;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.util.*;
import java.util.concurrent.atomic.AtomicLong;

// All gamepack instructions run unchanged, including Math.random(). Seed/inspect the
// JRE's actual Random and compare both its state and every byte of the mutable images.
public class TitleFlamesOracle {
    static al archive;
    static ch[] runes;
    static Random rng;
    static AtomicLong seed;
    static int[] pattern(int n,int kind) {
        if (n<0) return null;
        int[] a=new int[n];
        for (int i=0;i<n;i++) {
            int v=i*0x48923d79 ^ kind*0x73297c0b;
            a[i]=switch(kind){case 0 -> i&255;case 1 -> (i%67)-33;default -> v;};
        }
        return a;
    }
    static Object[] slots() {
        return new Object[]{rc.f,f.a,qj.K,ea.k,ed.m,sc.P,t.H,uf.g,uf.g==null?null:uf.g.I,td.g,ij.a};
    }
    static String state(Object[] before) throws Exception {
        StringJoiner refs=new StringJoiner(",");
        IdentityHashMap<Object,Integer> ids=new IdentityHashMap<>();
        ArrayList<Object> live=new ArrayList<>();
        for(Object[] slots:new Object[][]{before,slots()}) for(Object o:slots) {
            if(o==null){refs.add("-");continue;}
            if(!ids.containsKey(o)){ids.put(o,live.size());live.add(o);}
            refs.add(""+ids.get(o));
        }
        MessageDigest digest=MessageDigest.getInstance("SHA-256");
        ByteBuffer len=ByteBuffer.allocate(4).order(ByteOrder.LITTLE_ENDIAN);
        for(Object o:live) if(o instanceof int[] a) {
            digest.update(len.putInt(0,a.length).array());
            ByteBuffer buf=ByteBuffer.allocate(a.length*4).order(ByteOrder.LITTLE_ENDIAN);
            buf.asIntBuffer().put(a);digest.update(buf.array());
        } else if(o instanceof ch[] a) {
            digest.update(len.putInt(0,a.length).array());
            for (ch rune:a) {
                digest.update(len.putInt(0,rune==null?-1:rune.l).array());
                if(rune==null) continue;
                for(int v:new int[]{rune.n,rune.b,rune.j,rune.y==null?-1:rune.y.length}) digest.update(len.putInt(0,v).array());
                if(rune.y!=null)digest.update(rune.y);
            }
        }
        return String.join("|",refs.toString(),HexFormat.of().formatHex(digest.digest()),""+seed.get(),
            fk.Y+","+jg.v+","+ka.h+","+m.M+","+td.e+","+td.b+","+td.h+","+td.d);
    }
    static String run(String line)throws Exception {
        int[] p=Arrays.stream(line.split(" ")).mapToInt(Integer::parseInt).toArray();
        int op=p[0],fault=p[1],n=p[2],cycles=p[3],x=p[4],y=p[5],clip=p[6];
        rc.f=pattern(32768,op==9?0:3); f.a=pattern(32768,4); ea.k=pattern(32768,0); qj.K=pattern(32768,5);
        sc.P=new int[]{0xee038145,0x80bb3c67,0xf13400e1,0x750ccb89}; t.H=pattern(256,6); ed.m=pattern(256,1);
        ij.a=runes; uf.g=new rh(128,254); uf.g.I=pattern(128*254,7); td.a(pattern(192*280,8),192,280);
        td.b(clip==1?24:clip==2?51:0,clip==1?29:clip==2?61:0,clip==1?102:clip==2?51:192,clip==1?133:clip==2?61:280);
        fk.Y=cycles;jg.v=5;ka.h=Integer.MAX_VALUE-3;m.M=1977;hh.kb=clip;
        switch(fault) {
            case 1 -> ea.k=pattern(n,0);
            case 2 -> rc.f=pattern(n,3);
            case 3 -> f.a=pattern(n,4);
            case 4 -> ed.m=pattern(n,1);
            case 5 -> qj.K=pattern(n,5);
            case 6 -> t.H=pattern(n,6);
            case 7 -> uf.g.I=pattern(n,7);
            case 8 -> td.g=pattern(n,8);
            case 9 -> {ij.a=n<0?null:Arrays.copyOf(runes,n);m.M=32768;}
            case 10 -> uf.g=null;
            case 11 -> sc.P=pattern(n,6);
            case 12 -> ed.m[3]=n;
            case 13 -> ea.k[1024]=n;
            case 14 -> m.M=n;
            case 15 -> f.a=rc.f;
            case 16 -> uf.g.I=td.g;
            case 17 -> qj.K=ea.k;
            case 18 -> jg.v=n;
        }
        rng.setSeed(18339L + clip);
        Object[] before=slots();
        aj widget=null;
        String result="ok";
        try {
            switch(op) {
                case 0 -> od.a(archive,0);
                case 1 -> ca.a(-48,n<0?null:runes[n%runes.length]);
                case 2 -> nl.c(cycles,12);
                case 3 -> vb.b(x,122,y);
                case 4 -> ng.c((byte)-81);
                case 5 -> {
                    od.a(archive,0);
                    for(int tick=0;tick<cycles;tick++){
                        hh.kb=tick;ng.c((byte)-81);
                        if(tick%5==0)vb.b(x,122,y);
                    }
                }
                case 6 -> od.a(null,0);
                case 7 -> ca.a(-69,new ch(1,1,x,y,5,4,n<0?null:new byte[n],new int[256]));
                case 8 -> {
                    byte[] pixels=new byte[n];Arrays.fill(pixels,(byte)0x81);
                    ca.a(-69,new ch(5,4,x,y,5,4,pixels,new int[256]));
                }
                case 9 -> {
                    widget=new aj();widget.wc=1402;widget.n=-1;widget.ob=3;widget.y=true;
                    widget.C=18;widget.H=22;widget.ib=x;widget.Mb=y;widget.vb=-31;widget.R=-99;
                    ik.G=fault==23?n:7;
                    hh.kb=0x49024310+clip;
                    nh.Y=pattern(100,0);r.U=pattern(100,0);gk.i=pattern(100,0);ik.Q=pattern(100,0);
                    sf.m=new boolean[100];ce.T=new boolean[100];
                    sf.m[5]=true;ce.T[9]=true;
                    if(fault==19)sf.m=n<0?null:Arrays.copyOf(sf.m,n);
                    if(fault==20)ce.T=n<0?null:Arrays.copyOf(ce.T,n);
                    if(fault==21)r.U=n<0?null:Arrays.copyOf(r.U,n);
                    if(fault==22)ik.Q=n<0?null:Arrays.copyOf(ik.Q,n);
                    lf.a(0,new aj[]{widget},-1,td.d,td.b,-1,td.h,0,true,td.e);
                }
            }
        } catch(RuntimeException e) {
            Throwable cause=e;
            while(cause instanceof g w)cause=w.a;
            result=cause instanceof NullPointerException?"null":cause instanceof IndexOutOfBoundsException?"bounds":cause.getClass().getName();
        }
        String widgetState="";
        if(widget!=null)widgetState="|"+widget.vb+","+widget.R+","+ik.G+"|"+
            Arrays.toString(nh.Y)+"|"+Arrays.toString(r.U)+"|"+Arrays.toString(gk.i)+"|"+Arrays.toString(ik.Q)+"|"+
            Arrays.toString(sf.m)+"|"+Arrays.toString(ce.T);
        return result+"|"+state(before)+widgetState;
    }
    static void repeatedDraw(Path dir, int mode) throws IOException {
        int width = 256, height = 254;
        td.a(new int[width * height], width, height);
        ea.k = new int[mode == 2 ? 32512 : 32768];
        ea.k[129] = 128;
        rc.f = new int[32768];
        ed.m = new int[256];
        t.H = new int[256];
        for (int i = 0; i < 256; i++) t.H[i] = i * 65793;
        uf.g = new rh(128, 254);
        fk.Y = jg.v = ka.h = m.M = hh.kb = 0;
        rng.setSeed(18339L);
        vb.b(0, 122, 0);
        int fault = Integer.MAX_VALUE;
        if (mode == 0) ng.c((byte)-81);
        else {
            try { nl.c(mode == 1 ? -1 : mode == 2 ? 1 : Integer.MIN_VALUE + 256, 12); }
            catch (RuntimeException e) {
                Throwable cause = e;
                while (cause instanceof g wrapped) cause = wrapped.a;
                if (!(cause instanceof ArrayIndexOutOfBoundsException)) throw e;
                var match = java.util.regex.Pattern.compile("Index (-?\\d+) out of bounds").matcher(cause.getMessage());
                if (!match.find()) throw e;
                fault = Integer.parseInt(match.group(1));
            }
        }
        vb.b(128, 122, 0);
        ByteBuffer result = ByteBuffer.allocate((td.g.length + 1) * 4).order(ByteOrder.LITTLE_ENDIAN);
        result.putInt(fault).asIntBuffer().put(td.g);
        Files.write(dir.resolve("repeated-flames-" + mode + ".bin"), result.array());
    }

    public static void main(String[] args)throws Exception {
        Field holder=Class.forName("java.lang.Math$RandomNumberGeneratorHolder").getDeclaredField("randomNumberGenerator");
        holder.setAccessible(true);rng=(Random)holder.get(null);
        Field field=Random.class.getDeclaredField("seed");field.setAccessible(true);seed=(AtomicLong)field.get(rng);
        try(var disk=new ProceduralTextureCacheOracle.Disk(Path.of(args[0]),8)) {
            archive=new al(disk,true,true);wi.i=Integer.parseInt(args[1]);
            runes=lc.a(archive,-110,wi.i);
            // These shuffled owners have unrelated random-consuming class initializers.
            // The live title has initialized them before comparing seeded frames.
            run("0 0 0 0 0 0 0");
            run("3 0 0 5 0 0 0");
            BufferedReader reader=new BufferedReader(new InputStreamReader(System.in));
            for(String line;(line=reader.readLine())!=null;) System.out.println(run(line));
            if (args.length > 2) for (int mode = 0; mode < 4; mode++) repeatedDraw(Path.of(args[2]), mode);
        }
    }
}
