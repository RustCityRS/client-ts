import java.io.*;
import java.nio.file.*;
import java.util.*;
import java.util.jar.JarFile;
import jdk.internal.org.objectweb.asm.*;

public class GetAvHOracle {
    // Observe the value that the instruction really loaded, including the exact
    // point where a reference ceases to follow replacements of its parent.
    static void prepare(String jar,Path out)throws Exception{
        try(JarFile file=new JarFile(jar)){
            ClassReader reader=new ClassReader(file.getInputStream(file.getJarEntry("ml.class")));
            ClassWriter writer=new ClassWriter(0);
            reader.accept(new ClassVisitor(Opcodes.ASM8,writer){
                public MethodVisitor visitMethod(int access,String name,String desc,String sig,String[] ex){
                    MethodVisitor mv=super.visitMethod(access,name,desc,sig,ex);
                    if(!name.equals("a")||!desc.equals("(IIIB)I"))return mv;
                    return new MethodVisitor(Opcodes.ASM8,mv){
                        boolean bytes;int depth;
                        public void visitFieldInsn(int op,String c,String n,String d){
                            if(op==Opcodes.GETSTATIC&&(c.equals("ve")&&n.equals("q")||c.equals("tb")&&n.equals("t"))){
                                bytes=c.equals("tb");depth=0;
                                super.visitMethodInsn(Opcodes.INVOKESTATIC,"GetAvHOracle",bytes?"flags":"heights","()"+d,false);
                            }else super.visitFieldInsn(op,c,n,d);
                        }
                        public void visitInsn(int op){
                            if(op==Opcodes.AALOAD){
                                int dimension=3-depth++;String kind=bytes?"B":"I";
                                super.visitMethodInsn(Opcodes.INVOKESTATIC,"GetAvHOracle",(bytes?"flag":"height")+(dimension==3?"Plane":"Row"),
                                    "("+"[".repeat(dimension)+kind+"I)"+"[".repeat(dimension-1)+kind,false);
                            }else if(op==Opcodes.IALOAD||op==Opcodes.BALOAD)
                                super.visitMethodInsn(Opcodes.INVOKESTATIC,"GetAvHOracle",op==Opcodes.IALOAD?"sample":"flag",op==Opcodes.IALOAD?"([II)I":"([BI)I",false);
                            else super.visitInsn(op);
                        }
                    };
                }
            },0);
            Files.write(out.resolve("ml.class"),writer.toByteArray());
        }
    }
    static int mode,at,step,p,x,z;
    static int[][][] replacement;
    static StringJoiner trace;
    static void touch(String event){
        trace.add(event);
        if(++step!=at)return;
        switch(mode){
            case 1->ve.q=replacement;
            case 2->ve.q[p]=replacement[p];
            case 3->{ve.q[p][x]=replacement[p][x];ve.q[p][x+1]=replacement[p][x+1];}
            case 4->ve.q[p][x]=replacement[p][x];
            case 5->ve.q[p][x+1]=replacement[p][x+1];
            case 6->ve.q=null;
            case 7->ve.q[p]=null;
            case 8->ve.q[p][x]=null;
            case 9->ve.q[p][x+1]=new int[z];
            case 10->ve.q=new int[0][][];
            case 11->tb.t[1][x][z]^=2;
            case 12->tb.t=null;
            case 13->throw new IllegalStateException();
            case 14->ve.q[p][x][z+1]=Integer.MIN_VALUE;
        }
    }
    static int[][][] heights(){int[][][] v=ve.q;touch("H");return v;}
    static byte[][][] flags(){byte[][][] v=tb.t;touch("F");return v;}
    static int[][] heightPlane(int[][][] a,int i){int[][] v=a[i];touch("P"+i);return v;}
    static int[] heightRow(int[][] a,int i){int[] v=a[i];touch("R"+i);return v;}
    static int sample(int[] a,int i){int v=a[i];touch("V"+i+"="+v);return v;}
    static byte[][] flagPlane(byte[][][] a,int i){byte[][] v=a[i];touch("B"+i);return v;}
    static byte[] flagRow(byte[][] a,int i){byte[] v=a[i];touch("C"+i);return v;}
    static int flag(byte[] a,int i){int v=a[i];touch("T"+i+"="+(v&255));return v;}
    static int[][][] terrain(int n,int seed){
        int[][][] h=new int[4][n][n];
        for(int l=0;l<4;l++)for(int i=0;i<n;i++)for(int j=0;j<n;j++)
            h[l][i][j]=((l+seed)*0x71234567+i*0x445f7e3-j*0x59f23bc1)^(seed*1237+i+j);
        return h;
    }
    static String run(int[] row){
        int level=row[0],fineX=row[1],fineZ=row[2],bits=row[3];mode=row[4];at=row[5];step=0;trace=new StringJoiner(";");
        int tileX=fineX>>7,tileZ=fineZ>>7;
        int size=(tileX>=4&&tileX<=103 || tileZ>=4&&tileZ<=103)?105:5;
        x=Math.max(0,Math.min(size-2,tileX));z=Math.max(0,Math.min(size-2,tileZ));
        ve.q=terrain(size,31);replacement=terrain(size,-17);tb.t=new byte[2][size][size];tb.t[1][x][z]=(byte)bits;
        p=Math.max(0,Math.min(3,level<3&&(bits&2)!=0?level+1:level));
        switch(mode){
            case 21->ve.q=null;
            case 22->ve.q=new int[0][][];
            case 23->ve.q[p]=null;
            case 24->ve.q[p]=new int[x][];
            case 25->ve.q[p][x+1]=null;
            case 26->ve.q[p][x+1]=new int[z+1];
            case 27->ve.q[p][x]=new int[z+1];
            case 28->tb.t=null;
            case 29->tb.t=new byte[1][][];
            case 30->tb.t[1]=null;
            case 31->tb.t[1]=new byte[x][];
            case 32->tb.t[1][x]=null;
            case 33->tb.t[1][x]=new byte[z];
        }
        String status,context="";
        byte guard=row.length>6?(byte)row[6]:(byte)-71;
        try{status="v"+ml.a(level,fineX,fineZ,guard);}
        catch(RuntimeException ex){
            if(ex instanceof g w)context=w.q;
            Throwable t=ex;while(t instanceof g w)t=w.a;
            if(t instanceof NullPointerException)status="null";
            else if(t instanceof ArrayIndexOutOfBoundsException)status="bounds:"+t.getMessage().split(" ")[1];
            else if(t instanceof IllegalStateException)status="probe";
            else if(t instanceof ArithmeticException)status="arithmetic";
            else throw ex;
        }
        return status+"|"+context+"|"+trace;
    }
    public static void main(String[] args)throws Exception{
        if(args.length==2){prepare(args[0],Path.of(args[1]));return;}
        BufferedReader in=new BufferedReader(new InputStreamReader(System.in));
        for(String s;(s=in.readLine())!=null;)System.out.println(run(Arrays.stream(s.split(" ")).mapToInt(Integer::parseInt).toArray()));
    }
}
