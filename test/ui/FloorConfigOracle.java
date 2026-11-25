import java.io.*;
import java.lang.reflect.*;
import java.nio.file.*;
import java.util.*;

class FloorConfigOracle {
    static final class Provider extends ud {
        final db index;
        final Path dir;
        Provider(Path dir) throws IOException {
            this.dir = dir;
            byte[] data = Files.readAllBytes(dir.resolve("index"));
            index = new db(data,q.a(0,data,data.length));
        }
        byte[] a(int dummy,int group) {
            try { return Files.readAllBytes(dir.resolve("g"+group)); }
            catch (IOException ex) { return null; }
        }
        void b(int dummy,int group) {}
        db b(int unused) { return index; }
        int c(int unused,int group) { return 100; }
    }

    static int[] data(Object obj) throws Exception {
        if (obj instanceof rj v) {
            Field tex=rj.class.getDeclaredField("q"), rgb=rj.class.getDeclaredField("r");
            tex.setAccessible(true); rgb.setAccessible(true);
            return new int[]{v.d,v.e,v.m,v.o,tex.getInt(v),rgb.getInt(v)};
        }
        if (obj instanceof wa v) return new int[]{v.b?1:0,v.h,v.l,v.n,vk.gb};
        da v=(da)obj;
        return new int[]{v.a,v.j?1:0,v.l};
    }
    static Object get(int group,int id) {
        return switch(group) { case 1->ij.a((byte)39,id); case 4->jl.a(id,8); default->dl.a(id,group); };
    }
    static void seed(long seed) throws Exception {
        Field f=Class.forName("java.lang.Math$RandomNumberGeneratorHolder").getDeclaredField("randomNumberGenerator");
        f.setAccessible(true); ((Random)f.get(null)).setSeed(seed);
    }
    public static void main(String[] args) throws Exception {
        al archive=new al(new Provider(Path.of(args[0])),false,true);
        qg.a(archive,-51); ic.a(archive,(byte)-110);
        seed(0x530L); kh.a(archive,archive,(byte)-103);
        System.out.println(Arrays.toString(new int[]{b.J,gl.D,hj.h,pj.E}));
        for (int group : new int[]{1,4,34}) {
            int count=archive.c(group,64), hash=1;
            for (int id=0;id<count;id++) hash=31*hash+Arrays.hashCode(data(get(group,id)));
            System.out.println(Arrays.toString(new int[]{count,hash}));
        }
        int r=0x530, hash=1;
        for (int i=0;i<65536;i++) {
            r=r*1664525+1013904223;
            int rgb=(i%4==0?i+r/17:r) & 0xffffff;
            byte[] bytes=new byte[]{1,(byte)(rgb>>>16),(byte)(rgb>>>8),(byte)rgb,0};
            rj under=new rj();
            under.a((byte)116,new gd(bytes),i);
            hash=31*hash+Arrays.hashCode(data(under));
            hash=31*hash+lg.a((byte)-117,rgb);
            hash=31*hash+ec.a(-127,rgb);
        }
        System.out.println(hash);
        for (int i=1;i<args.length;i++) {
            String[] fields=args[i].split(":");
            int group=Integer.parseInt(fields[0]), id=Integer.parseInt(fields[1]);
            gd p=new gd(HexFormat.of().parseHex(fields[2]));
            Object value=switch(group){case 1->new rj();case 4->new wa();default->new da();};
            boolean ok=true;
            try {
                if (value instanceof rj v) v.a((byte)116,p,id);
                else if(value instanceof wa v) v.a(p,(byte)103,id);
                else ((da)value).a(p,(byte)-99,id);
            } catch(RuntimeException ex){ ok=false; }
            System.out.println(ok+"/"+p.yb+"/"+Arrays.toString(data(value)));
        }
        Object first=dl.a(3,34);
        ch sprite=new ch(1,1,0,0,1,1,new byte[1],new int[1]);
        mk.A.a(7L,sprite,(byte)-71);
        m.a(0,-100);
        System.out.println(Arrays.toString(new boolean[]{hj.f.a(3L,false)==first,mk.A.a(7L,false)==sprite}));
        m.a(0,-100); ki.e((byte)100);
        System.out.println(Arrays.toString(new boolean[]{hj.f.a(3L,false)==null,mk.A.a(7L,false)==null}));
        da empty=dl.a(3,65535);
        System.out.println(Arrays.toString(new int[]{empty.l,dl.a(3,34)==empty?1:0}));
        seed(17L);
        boolean failed=false;
        try { kh.a(null,null,(byte)-103); } catch(RuntimeException ex) { failed=true; }
        System.out.println(Arrays.toString(new int[]{failed?1:0,n.g==null?1:0,mj.d==null?1:0,
            gl.D,hj.h,pj.E,(int)(Math.random()*1000000)}));
        kh.a(null,archive,(byte)-103);
        System.out.println(Arrays.toString(new int[]{gl.D,hj.h,pj.E,(int)(Math.random()*1000000)}));
    }
}
