import java.io.*;
import java.nio.file.*;
import java.util.*;
import jdk.internal.org.objectweb.asm.*;

class ResetTitleOrderOracle {
    static final class Stop extends Error {}
    static final StringJoiner[] calls={null};
    static String change,stop;
    static nc initial;
    static pb player;
    static int[] xy(){return te.g==null ? new int[]{-1,-1}:new int[]{te.g.Z,te.g.S};}
    static void call(String op) {
        int[] pos=xy();
        calls[0].add(op+"."+hd.m+"."+aa.e+"."+(va.Z==initial)+"."+(te.g==player)+"."+pos[0]+"."+pos[1]);
        if(op.equals(stop))throw new Stop();
        if(op.equals(change)) {
            if(op.startsWith("sub"))va.Z=new nc(4);
            if(op.equals("reset"))ah.n=33;
            if(op.equals("size")||op.equals("redraw"))hd.m=42;
            if(op.equals("on55"))ig.t=7;
            if(op.equals("x"))te.g=new pb();
        }
    }
    public static void close(int group,int dummy){call("close"+group);}
    public static void sub(qd node,boolean discard,int dummy){call("sub"+node.v);node.b((byte)-118);}
    public static void reset(int dummy){call("reset");}
    public static void size(boolean a,boolean b){call("size");}
    public static void redraw(int dummy){call("redraw");}
    public static void onload(int group,byte dummy){call("on"+group);}
    public static void cursor(int id,boolean dummy){call("cursor"+id);}
    public static void flame(al archive,int dummy){call("flame");throw new Stop();}
    public static void x(){call("x");}
    static void prepare(Path output)throws Exception {
        var reader=new ClassReader(vb.class.getResourceAsStream("/vb.class"));
        var writer=new ClassWriter(reader,0);
        var map=Map.of("ra","close","ok","sub","ki","reset","ik","size","pj","redraw","gd","onload","sc","cursor","od","flame");
        reader.accept(new ClassVisitor(Opcodes.ASM8,writer){
            public MethodVisitor visitMethod(int a,String n,String d,String sig,String[] ex) {
                var mv=super.visitMethod(a,n,d,sig,ex);
                if(!n.equals("a")||!d.equals("(IZ)V"))return mv;
                return new MethodVisitor(Opcodes.ASM8,mv){
                    public void visitMethodInsn(int op,String owner,String n,String d,boolean itf){
                        if(op==Opcodes.INVOKESTATIC&&map.containsKey(owner)&&!d.endsWith("Lg;"))
                            super.visitMethodInsn(op,"ResetTitleOrderOracle",map.get(owner),d,false);
                        else super.visitMethodInsn(op,owner,n,d,itf);
                    }
                    public void visitFieldInsn(int op,String owner,String n,String d){
                        super.visitFieldInsn(op,owner,n,d);
                        if(op==Opcodes.PUTFIELD&&owner.equals("ob")&&n.equals("Z"))super.visitMethodInsn(Opcodes.INVOKESTATIC,"ResetTitleOrderOracle","x","()V",false);
                    }
                };
            }
        },0);
        Files.write(output.resolve("vb.class"),writer.toByteArray());
    }
    static String run(String[] v) {
        boolean open=v[0].equals("1");int shape=Integer.parseInt(v[1]);
        hd.m=Integer.parseInt(v[2]);stop=v[3];change=v[4];
        ah.n=55;ig.t=9;aa.e=16;
        te.g=player=new pb();te.g.Z=10;te.g.S=11;
        initial=va.Z=new nc(8);
        for(int i=0;i<(shape==0?0:3);i++){
            jf node;
            if(shape==2&&i==0||shape==3&&i==2)node=new jf();
            else{qd s=new qd();s.v=i+20;node=s;}
            va.Z.a((byte)-89,node,(long)i);
        }
        calls[0]=new StringJoiner(" ");
        String result="ok";
        try{vb.a(8,open);}catch(Stop e){result="stop";}catch(g error){
            Throwable e=error;while(e instanceof g)e=((g)e).a;
            if(!(e instanceof ClassCastException))throw error;
            result="cast";
        }
        int[] pos=xy();
        return result+" "+calls[0]+" |"+hd.m+" "+aa.e+" "+(te.g==player)+" "+pos[0]+" "+pos[1];
    }
    public static void main(String[] args)throws Exception {
        if(args.length>0){prepare(Path.of(args[0]));return;}
        var in=new BufferedReader(new InputStreamReader(System.in));var out=new PrintWriter(System.out);
        for(String line;(line=in.readLine())!=null;)out.println(run(line.split(" ")));
        out.flush();
    }
}
