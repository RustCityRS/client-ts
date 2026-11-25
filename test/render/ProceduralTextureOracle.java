import java.io.*;
import java.lang.reflect.*;
import java.nio.file.*;
import java.util.*;
import jdk.internal.org.objectweb.asm.*;

class ProceduralTextureOracle {
    static Field field(String name)throws Exception {
        Field f=jd.class.getDeclaredField(name);f.setAccessible(true);return f;
    }
    static final al archive=new al(null,false,true);
    static StringJoiner trace;
    static int stop, calls;
    static boolean ready(String call) {trace.add(call);hg.a+=2;return ++calls!=stop;}
    public static boolean single(al a,int id,boolean unused){Objects.requireNonNull(a);return ready("s"+id);}
    public static boolean file(al a,boolean unused,int group,int id){Objects.requireNonNull(a);return ready("f"+group+","+id);}
    static class Provider implements pc {
        public boolean a(int id,byte unused){return ready("t"+id);}
        public boolean a(int id,int d){throw new AssertionError();}
        public int[] c(int d,int id){throw new AssertionError();}
        public boolean b(int d,int id){throw new AssertionError();}
        public int[] a(int a,float b,int c){throw new AssertionError();}
        public int a(byte a,int b){throw new AssertionError();}
        public boolean d(int a,int b){throw new AssertionError();}
    }
    static final Provider provider=new Provider();
    static void prepare(Path dir)throws Exception {
        ClassReader reader=new ClassReader(jd.class.getResourceAsStream("/jd.class"));
        ClassWriter writer=new ClassWriter(reader,0);
        reader.accept(new ClassVisitor(Opcodes.ASM8,writer){
            public MethodVisitor visitMethod(int a,String n,String d,String sig,String[] ex){
                MethodVisitor mv=super.visitMethod(a,n,d,sig,ex);
                if(!d.equals("(Lpc;BLal;)Z"))return mv;
                return new MethodVisitor(Opcodes.ASM8,mv){
                    public void visitMethodInsn(int op,String owner,String n,String d,boolean itf){
                        if(owner.equals("al"))super.visitMethodInsn(Opcodes.INVOKESTATIC,"ProceduralTextureOracle",n.equals("b")?"single":"file","(Lal;"+d.substring(1),false);
                        else super.visitMethodInsn(op,owner,n,d,itf);
                    }
                };
            }
        },0);
        Files.write(dir.resolve("jd.class"),writer.toByteArray());
    }
    static String fault(Throwable t) {
        while(t instanceof g)t=((g)t).a;
        if(t instanceof NullPointerException)return "null";
        if(t instanceof ArrayIndexOutOfBoundsException)return "bounds";
        if(t instanceof NegativeArraySizeException)return "size";
        if(t instanceof ArithmeticException)return "arith";
        if(t instanceof RuntimeException)return t.getMessage();
        throw new AssertionError(t);
    }
    static String describe(bf op) {
        if(op==null)return "-";
        return op.getClass().getName()+","+op.L+","+op.K+","+op.z.length+","+op.c((byte)-98)+","+op.a(-1);
    }
    static gd packet(String token){return token.equals("p") ? null : new gd(token.equals("n") ? null : HexFormat.of().parseHex(token.substring(1)));}
    static String decode(boolean graph,String token)throws Exception {
        gd p=packet(token);String result;
        try {
            if(!graph) result=describe(ll.a(p,2790));
            else {
                jd def=new jd(p);
                bf[] ops=(bf[])field("c").get(def);
                List<bf> nodes=Arrays.asList(ops);
                StringJoiner all=new StringJoiner("/");
                for(bf op:ops){
                    StringJoiner children=new StringJoiner(",");
                    for(bf child:op.z)children.add(""+nodes.indexOf(child));
                    all.add(describe(op)+"["+children+"]");
                }
                result=all+":"+nodes.indexOf(field("f").get(def))+":"+nodes.indexOf(field("h").get(def))+":"+
                    Arrays.toString((int[])field("a").get(def))+":"+Arrays.toString((int[])field("p").get(def));
            }
        }catch(RuntimeException e){result=fault(e);}
        return (p==null?-1:p.yb)+":"+result;
    }
    static class Probe extends bf {
        final int mode;
        Probe(int kind){super(0,(kind&1)==0);mode=kind;}
        int[] a(int row,byte d){trace.add("m"+row);return mode==2 ? null : values(row);}
        int[][] a(boolean d,int row) {
            trace.add("c"+row);
            if(mode==3)return null;
            if(mode==5)return new int[][]{values(row)};
            return new int[][]{values(row),mode==7?null:values(row+4),values(row+9)};
        }
        int[] values(int row){int[] r=new int[mode==4?1:18];for(int i=0;i<r.length;i++)r[i]=(row*1709+i*913-79)%8000;return r;}
        void d(byte d){trace.add("d"+mode);if(mode==8)throw new ArithmeticException();super.d(d);}
    }
    static String render(String[] v)throws Exception {
        int kind=Integer.parseInt(v[1]),w=Integer.parseInt(v[2]),h=Integer.parseInt(v[3]),mode=Integer.parseInt(v[4]);
        boolean trans=v[5].equals("1"),flip=v[6].equals("1");
        double brightness=Double.parseDouble(v[7]);
        jd def=new jd(); Probe p=new Probe(kind),extra=new Probe(0);
        p.K=mode==4?-1:255;extra.K=1;
        bf[] ops=new bf[]{extra, mode==2?null:p, mode==3?null:extra};
        if(mode!=9){field("c").set(def,ops);field("f").set(def,mode==1?null:p);}
        trace=new StringJoiner(",");kg.x=mode==5 ? new int[3] : mode==6 ? null : new int[256];
        wf.L=mode==8?brightness:-1;hf.I=g.k=kl.Eb=vi.hb=j.b=0;cf.h=vg.U=null;
        gj.P=null;jf.o=null;
        String got;
        try {got=Arrays.toString(def.a(provider,archive,71,trans,w,flip,brightness,h));}
        catch(RuntimeException ex){got=fault(ex);}
        return got+"|"+trace+"|"+(p.C!=null)+","+(p.I!=null)+","+(extra.I!=null)+"|"+hf.I+","+g.k+","+
            (cf.h==vg.U)+","+(gj.P==provider)+","+(jf.o==archive)+","+Arrays.hashCode(kg.x)+","+Double.doubleToLongBits(wf.L);
    }
    static String dependencies(String[] v)throws Exception {
        int mode=Integer.parseInt(v[1]);hg.a=Integer.parseInt(v[2]);stop=Integer.parseInt(v[3]);
        jd t=new jd();
        field("p").set(t,mode==1?null:mode==2?new int[0]:new int[]{0,12,4});
        field("a").set(t,mode==3?null:new int[]{6,3,0,5});
        trace=new StringJoiner(","); calls=0;String result;
        try{result=""+t.a(mode==4?null:provider,(byte)115,mode==5?null:archive);}catch(RuntimeException ex){result=fault(ex);}
        return result+":"+hg.a+":"+trace;
    }
    public static void main(String[] args)throws Exception {
        if(args.length>0){prepare(Path.of(args[0]));return;}
        BufferedReader in=new BufferedReader(new InputStreamReader(System.in));PrintWriter out=new PrintWriter(System.out);
        for(String line;(line=in.readLine())!=null;) {
            String[] v=line.split(" ");
            out.println(switch(v[0]){case "F"->describe(la.d(-120,Integer.parseInt(v[1])));
                case "D","G"->decode(v[0].equals("G"),v[1]);case "A"->dependencies(v);default->render(v);});
        }out.flush();
    }
}
