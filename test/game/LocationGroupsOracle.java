import java.io.*;
import java.nio.file.*;
import java.util.*;
import java.util.jar.JarFile;
import jdk.internal.org.objectweb.asm.*;

public final class LocationGroupsOracle {
    static final String[] fields={"lk.x","mk.G","rb.i","hk.e","vj.t","hc.c","ag.d"};
    static final byte[] a={11},b={22},c={33};
    static byte[][] original;
    static ke[] coll;
    static int mode,pumps,loads,reads,digest,indexReads;
    static StringJoiner trace;

    public static void field(int id) {
        reads++;digest=digest*31+id;
        if(id==2 && ++indexReads==1) {
            if(mode==24)rb.i=new int[]{0x070b,0x1234};
            if(mode==25)rb.i=null;
        }
    }
    public static void pump(int ignored) {
        trace.add("p"+(++pumps));
        if(pumps==1) switch(mode) {
            case 1: lk.x=new byte[][]{c};break;
            case 2: mk.G=null;break;
            case 3: original[0]=null;original[1]=c;break;
            case 4: rb.i=null;break;
            case 5: hc.c=new ke[1];hk.e=Integer.MAX_VALUE;vj.t=Integer.MIN_VALUE;break;
            case 6: throw new IllegalStateException();
            case 7: ag.d=new int[4][13][13];ag.d[0][0][0]=template(0,1,144,416);break;
        }
        if(mode==8 && pumps==2){hc.c=null;lk.x=null;hk.e=Integer.MIN_VALUE;vj.t=Integer.MAX_VALUE;}
    }
    static String bytes(byte[] data){return data==a?"a":data==b?"b":data==c?"c":"null";}
    static String maps(ke[] maps){return maps==null?"null":maps==coll?"old":"new";}
    static void placed() {
        if(++loads!=1)return;
        switch(mode) {
            case 9: rb.i=new int[]{0x1234,0x1234};original[1]=b;break;
            case 10: ag.d[0][0]=new int[1];break;
            case 11: throw new IllegalStateException();
            case 12: Arrays.fill(original,null);hc.c=null;break;
        }
    }
    public static void ordinary(byte guard,int x,ke[] maps,byte[] data,int z,boolean water) {
        trace.add("n"+x+","+maps(maps)+","+bytes(data)+","+z+","+water);placed();
    }
    public static void instance(int x,int sourceX,ke[] maps,byte guard,int rotation,int sourceLevel,byte[] data,int z,boolean water,int level,int sourceZ) {
        trace.add("i"+x+","+sourceX+","+maps(maps)+","+rotation+","+sourceLevel+","+bytes(data)+","+z+","+water+","+level+","+sourceZ);placed();
    }
    static int template(int p,int r,int x,int z){return (p<<24)|(r<<1)|(x<<14)|(z<<3);}
    static String run(int dynamic,int water,int scenario) {
        mode=scenario;pumps=loads=reads=indexReads=0;digest=1;trace=new StringJoiner(";");
        lk.x=original=new byte[][]{a,null,b,null,c};
        mk.G=new byte[5][];rb.i=new int[]{0x1234,0x1234,0x1234,0x147,0x7fff};
        hc.c=coll=new ke[4];hk.e=393;vj.t=-516;ag.d=new int[4][13][13];
        for(int[][] level:ag.d)for(int[] row:level)Arrays.fill(row,-1);
        for(int p=0;p<4;p++)for(int i=0;i<4;i++)ag.d[p][i*3][i*4]=template(i,i,144+i,416+7-i);
        ag.d[0][0][1]=template(0,3,9,568);ag.d[3][12][12]=0xef000001|template(0,3,1023,2047);
        switch(mode) {
            case 13: lk.x=null;break;
            case 14: mk.G=null;break;
            case 15: rb.i=null;break;
            case 16: rb.i=new int[0];break;
            case 17: lk.x=new byte[][]{null};break;
            case 18: rb.i[0]=Integer.MIN_VALUE;hk.e=Integer.MAX_VALUE;vj.t=Integer.MIN_VALUE;break;
            case 19: ag.d=null;break;
            case 20: ag.d[0]=new int[1][];break;
            case 21: mk.G=new byte[0][];lk.x=null;break;
            case 22: original[0]=null;original[1]=null;break;
            case 23: hc.c=null;break;
            case 26: for(int[][] plane:ag.d)for(int[] row:plane)Arrays.fill(row,-1);rb.i=null;lk.x=null;break;
            case 27: for(int[][] plane:ag.d)for(int[] row:plane)Arrays.fill(row,template(2,1,144,416));rb.i=null;break;
        }
        String result="ok";
        try {if(dynamic!=0)jh.a((byte)-50,water!=0);else dg.a(true,water!=0);}
        catch(RuntimeException e){
            Throwable err=e;while(err instanceof g)err=((g)err).a;
            if(err instanceof NullPointerException)result="null";
            else if(err instanceof ArrayIndexOutOfBoundsException)result="index"+err.getMessage().split(" ")[1];
            else if(err instanceof IllegalStateException)result="probe";
            else throw new AssertionError(err);
        }
        return result+" "+reads+" "+digest+"|"+trace;
    }
    static void prepare(Path gamepack,Path out)throws Exception {
        try(JarFile jar=new JarFile(gamepack.toFile())){
            for(String owner:new String[]{"dg","jh"}) {
                ClassReader reader=new ClassReader(jar.getInputStream(jar.getJarEntry(owner+".class")));
                ClassWriter writer=new ClassWriter(ClassWriter.COMPUTE_MAXS);int[] calls={0};
                reader.accept(new ClassVisitor(Opcodes.ASM8,writer){
                    public MethodVisitor visitMethod(int access,String name,String desc,String sig,String[] thrown) {
                        MethodVisitor visitor=super.visitMethod(access,name,desc,sig,thrown);
                        if(!name.equals("a")||!desc.equals(owner.equals("dg")?"(ZZ)V":"(BZ)V"))return visitor;
                        return new MethodVisitor(Opcodes.ASM8,visitor){
                            public void visitMethodInsn(int op,String cls,String method,String type,boolean iface) {
                                if(op==Opcodes.INVOKESTATIC && method.equals("a") && (cls.equals("uj")||cls.equals("hi")||cls.equals("ck"))) {
                                    calls[0]++;
                                    super.visitMethodInsn(op,"LocationGroupsOracle",cls.equals("uj")?"pump":cls.equals("hi")?"ordinary":"instance",type,false);
                                } else super.visitMethodInsn(op,cls,method,type,iface);
                            }
                            public void visitFieldInsn(int op,String cls,String field,String type) {
                                super.visitFieldInsn(op,cls,field,type);
                                int i=Arrays.asList(fields).indexOf(cls+"."+field);
                                if(op==Opcodes.GETSTATIC&&i!=-1){
                                    super.visitLdcInsn(i);
                                    super.visitMethodInsn(Opcodes.INVOKESTATIC,"LocationGroupsOracle","field","(I)V",false);
                                }
                            }
                        };
                    }
                },0);
                if(calls[0]!=2)throw new AssertionError(calls[0]);
                Files.write(out.resolve(owner+".class"),writer.toByteArray());
            }
        }
    }
    public static void main(String[] args)throws Exception {
        if(args.length!=0){prepare(Path.of(args[0]),Path.of(args[1]));return;}
        BufferedReader input=new BufferedReader(new InputStreamReader(System.in));PrintWriter output=new PrintWriter(System.out);String line;
        while((line=input.readLine())!=null){int[] v=Arrays.stream(line.split(" ")).mapToInt(Integer::parseInt).toArray();output.println(run(v[0],v[1],v[2]));}
        output.flush();
    }
}
