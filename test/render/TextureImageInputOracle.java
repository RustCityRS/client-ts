import java.io.*;
import java.lang.reflect.*;
import java.nio.file.*;
import java.util.*;

class TextureImageInputOracle {
    static final Map<Integer,byte[]> groups = new HashMap<>();
    static db index;
    static class ArchiveProvider extends ud {
        db b(int unused) { return index; }
        byte[] a(int mode,int group) { return groups.get(group); }
        void b(int unused,int group) {}
        int c(int unused,int group) { return 100; }
    }
    static final int[] image = new int[128*128];
    static StringBuilder log;
    static class Textures implements pc {
        int behavior;
        Textures(int mode) { behavior=mode; }
        public boolean a(int id,int dummy) {
            log.append("s").append(id).append(",");
            if(behavior==3) gj.P=new Textures(4);
            if(behavior==5) gj.P=null;
            if(behavior==6) vk.a(119,33,7);
            return (id&1)==0;
        }
        public int[] c(int dummy,int id) {
            log.append("p").append(id).append(".").append(behavior).append(",");
            vk.a(119,11,5);
            if(behavior==1)return null;
            if(behavior==2)return new int[]{0xabcd};
            return image;
        }
        public boolean b(int a,int b){throw new AssertionError();}
        public boolean a(int a,byte b){throw new AssertionError();}
        public int[] a(int a,float b,int c){throw new AssertionError();}
        public int a(byte a,int b){throw new AssertionError();}
        public boolean d(int a,int b){throw new AssertionError();}
    }
    static Field field(Class<?> type,String name) throws Exception {
        Field f=type.getDeclaredField(name);f.setAccessible(true);return f;
    }
    static String fault(Throwable t) {
        while(t instanceof g)t=((g)t).a;
        if(t instanceof NullPointerException)return "null";
        if(t instanceof IndexOutOfBoundsException)return "bounds";
        if(t instanceof ArithmeticException)return "arith";
        if(t instanceof RuntimeException)return "runtime";
        throw new AssertionError(t);
    }
    static String run(int[] v) throws Exception {
        int op=v[0],kind=v[1],id=v[2],group=v[3],w=v[4],h=v[5],sw=v[6],sh=v[7],cap=v[8],len=v[9];
        bf node=la.d(-120,op);
        log=new StringBuilder();
        hf.I=g.k=0;kl.Eb=vi.hb=j.b=0;vg.U=cf.h=null;
        vk.a(119,w,h);
        node.K=cap;node.a((byte)-120,w,h);
        hg.a=group;
        jf.o=kind==9 ? null : new al(new ArchiveProvider(),false,true);
        gj.P=kind==9 ? null : new Textures(kind);
        Field pixels=op==36 ? field(fk.class,"T") : field(la.class,"mb");
        Field width=op==36 ? field(fk.class,"Q") : field(la.class,"lb");
        Field height=op==36 ? field(fk.class,"Z") : field(la.class,"N");
        gd p=new gd(len<0 ? null : Arrays.copyOf(new byte[]{(byte)(id>>8),(byte)id},len));
        String result="ok";
        try{node.a(p,true,id<0 ? 1 : 0);}catch(RuntimeException e){result=fault(e);}
        if(kind==7 || kind==8){
            pixels.set(node,Arrays.copyOf(image,kind==7 ? 60 : 3));
            width.setInt(node,sw);height.setInt(node,sh);
        }
        int[][] retained = cap==1 ? node.C.a(0,80) : null;
        if(retained!=null) {retained[0][0]=97;if(h>1)node.C.a(1,80);}
        StringJoiner trace=new StringJoiner("|");
        trace.add(result+":"+p.yb+":"+node.c((byte)-98)+":"+node.a(-1));
        IdentityHashMap<int[][],Integer> ids=new IdentityHashMap<>();
        for(int y : new int[]{0,1,1,h-1,2,-1,0,h}) {
            try{
                int[][] row=node.a(true,y);
                result="r"+ids.computeIfAbsent(row,k->ids.size()+1)+"."+Arrays.deepHashCode(row);
            }catch(RuntimeException e){result=fault(e);}
            trace.add(result+":"+width.getInt(node)+":"+height.getInt(node)+":"+(pixels.get(node)!=null)+":"+
                Arrays.deepHashCode(retained)+":"+hf.I+":"+g.k+":"+log);
            log.setLength(0);
        }
        for (int i=0;i<2;i++) {
            try{node.d((byte)107);result="ok";}catch(RuntimeException e){result=fault(e);}
            trace.add(result+":"+(pixels.get(node)!=null)+":"+Arrays.deepHashCode(retained));
        }
        return trace.toString();
    }
    public static void main(String[] args)throws Exception {
        Path dir=Path.of(args[0]);
        byte[] table=Files.readAllBytes(dir.resolve("index"));
        index=new db(table,q.a(0,table,table.length));
        for(String group:args[1].split(","))groups.put(Integer.parseInt(group),Files.readAllBytes(dir.resolve(group)));
        for(int i=0;i<image.length;i++)image[i]=i*0x5def7123^0xa752008f;
        BufferedReader in=new BufferedReader(new InputStreamReader(System.in));
        PrintWriter out=new PrintWriter(System.out);
        for(String s;(s=in.readLine())!=null;)out.println(run(Arrays.stream(s.split(" ")).mapToInt(Integer::parseInt).toArray()));
        out.flush();
    }
}
