import java.io.*;
import java.nio.file.*;
import java.util.*;
import java.util.jar.*;
import jdk.internal.org.objectweb.asm.*;

// Leave the original g.a / wj.a branches, reads, locals and loops intact.
// Only the three terrain calls and the PCM service call go to recording probes.
public class GroundGroupsOracle {
    static void instrument(String jar, Path dir) throws Exception {
        Map<String,String> probes=Map.of("uj","audio","nk","ground","lk","chunk","bk","clear");
        try(JarFile j=new JarFile(jar)){
            for(String owner:new String[]{"g","wj"}){
                ClassReader reader=new ClassReader(j.getInputStream(j.getJarEntry(owner+".class")));
                ClassWriter writer=new ClassWriter(0);
                reader.accept(new ClassVisitor(Opcodes.ASM8,writer){
                    @Override public MethodVisitor visitMethod(int flags,String name,String desc,String sig,String[] ex){
                        MethodVisitor mv=super.visitMethod(flags,name,desc,sig,ex);
                        if(!name.equals("a")||!desc.equals(owner.equals("g")?"(BZ)V":"(ZI)V"))return mv;
                        return new MethodVisitor(Opcodes.ASM8,mv){
                            @Override public void visitMethodInsn(int op,String target,String method,String signature,boolean iface){
                                if(op==Opcodes.INVOKESTATIC&&method.equals("a")&&probes.containsKey(target)){
                                    super.visitMethodInsn(op,"GroundGroupsOracle",probes.get(target),signature,false);
                                }else super.visitMethodInsn(op,target,method,signature,iface);
                            }
                        };
                    }
                },0);
                Files.write(dir.resolve(owner+".class"),writer.toByteArray());
            }
        }
    }
    static int mode,audioCalls,loads,clears;
    static final byte[] a={11},b={22},c={33};
    static byte[][] original;
    static ke[] oldMaps;
    static StringJoiner trace;
    static int template(int level,int rotation,int x,int z){return (level<<24)|(rotation<<1)|(x<<14)|(z<<3);}
    static String data(byte[] bytes){return bytes==a?"a":bytes==b?"b":bytes==c?"c":"_";}
    static String maps(ke[] coll){return coll==null?"null":coll==oldMaps?"old":"new";}
    public static void audio(int dummy){
        trace.add("p"+(++audioCalls));
        if(audioCalls==1){
            switch(mode){
                case 1 -> mk.G=new byte[][]{c};
                case 2 -> {hk.e=Integer.MAX_VALUE;vj.t=Integer.MIN_VALUE;ic.V=Integer.MIN_VALUE;ah.k=Integer.MAX_VALUE;rb.i=new int[]{0,1,3,4,5};hc.c=new ke[2];}
                case 3 -> {original[0]=null;original[1]=c;}
                case 4 -> rb.i=null;
                case 5 -> {ag.d=new int[4][13][13];ag.d[0][0][0]=template(3,1,144,416);}
                case 6 -> {throw new IllegalStateException();}
            }
        }
        if(mode==7 && audioCalls==2){ah.k=799;mk.G=null;hc.c=null;}
    }
    static void loaded(){
        loads++;
        if(loads!=1)return;
        if(mode==8){original[1]=original[0];rb.i=new int[]{0,0x1234};}
        if(mode==9){ag.d[0][0]=new int[1];}
        if(mode==10)throw new IllegalStateException();
    }
    public static void ground(int z,boolean u,int noiseZ,int dummy,int x,byte[] bytes,int noiseX,ke[] coll){
        trace.add("g"+z+","+u+","+noiseZ+","+x+","+data(bytes)+","+noiseX+","+maps(coll));loaded();
    }
    public static void chunk(int x,int sz,int z,int level,byte[] bytes,int rot,ke[] coll,int sl,int dummy,boolean u,int sx){
        trace.add("d"+x+","+sz+","+z+","+level+","+data(bytes)+","+rot+","+maps(coll)+","+sl+","+u+","+sx);loaded();
    }
    public static void clear(int x,int w,int z,byte guard,int h,int level){
        trace.add("c"+x+","+w+","+z+","+h+","+level);
        if(++clears!=1)return;
        if(mode==11){rb.i=null;mk.G=null;hc.c=null;ag.d[0][0]=new int[0];ah.k=805;}
        if(mode==12)throw new IllegalStateException();
    }
    static void run(boolean dynamic,boolean u,int z,int mode){
        GroundGroupsOracle.mode=mode;audioCalls=loads=clears=0;
        original=new byte[][]{a,null,b,null,null};mk.G=original;
        hc.c=oldMaps=new ke[4];rb.i=new int[]{0x1234,0x1234,0x1234,0x147,-1};
        hk.e=-393;vj.t=0x234;ic.V=22;ah.k=z;
        ag.d=new int[4][13][13];
        for(int[][] level:ag.d)for(int[] row:level)Arrays.fill(row,-1);
        for(int level=0;level<4;level++)for(int i=0;i<4;i++)
            ag.d[level][(i*3)%13][(i*5)%13]=template(i,i,144+i,416+7-i);
        ag.d[0][12][12]=template(2,3,9,568);
        switch(mode){
            case 13 -> mk.G=null;
            case 14 -> rb.i=null;
            case 15 -> {rb.i=new int[]{0x999,0x1234,0x1234,0x147,-1};mk.G=new byte[][]{null,null};}
            case 16 -> {hk.e=Integer.MIN_VALUE;vj.t=Integer.MAX_VALUE;ic.V=Integer.MAX_VALUE;rb.i[0]=Integer.MIN_VALUE;}
            case 17 -> ag.d=null;
            case 18 -> {ag.d[0]=new int[1][];ag.d[0][0]=null;}
            case 19 -> {rb.i=new int[0];mk.G=new byte[0][];}
            case 20 -> {rb.i=new int[]{0x999,0x1234,0x1234,0x147,-1};}
        }
        String result="ok";
        try{if(dynamic)wj.a(u,99);else g.a((byte)-7,u);}catch(RuntimeException err){
            Throwable t=err;while(t instanceof g wrap)t=wrap.a;
            result=t instanceof NullPointerException?"null":t instanceof ArrayIndexOutOfBoundsException?"bounds"+t.getMessage().split(" ")[1]:t instanceof IllegalStateException?"probe":t.toString();
        }
        System.out.println(result+"|"+trace);
    }
    public static void main(String[] args)throws Exception{
        if(args.length!=0){instrument(args[0],Path.of(args[1]));return;}
        BufferedReader r=new BufferedReader(new InputStreamReader(System.in));
        for(String line;(line=r.readLine())!=null;){
            int[] v=Arrays.stream(line.split(" ")).mapToInt(Integer::parseInt).toArray();
            trace=new StringJoiner(";");
            run(v[0]!=0,v[1]!=0,v[2],v[3]);
        }
    }
}
