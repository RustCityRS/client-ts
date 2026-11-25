import java.io.*;
import java.nio.ByteBuffer;
import java.nio.file.*;
import java.security.MessageDigest;
import java.util.*;
import java.util.jar.JarFile;
import jdk.internal.org.objectweb.asm.*;

// ga.a(ZIBI[[[Lra;I)Z runs on the JAR's ra/hk/ec objects. Observe the queue and object field
// loads in ga only. ob.a still computes wall masks, with a hook to change the caller-visible state.
public final class RoofFloodOracle {
    static ra[][][] squares;
    static int mode, seedX, seedZ, calls, maskTrace, xLoads, zLoads, queueTrace;
    static boolean replaced;
    static MessageDigest sha;
    public static int wall(int code,int guard) {
        calls++; maskTrace=maskTrace*31+code;
        int mask=ob.a(code,guard);
        if(calls==1&&mode==21) squares[1][seedX-1][seedZ].z=null;
        if(calls==1&&mode==22) ah.f=3;
        return mask;
    }
    public static int[] queueX() {
        xLoads++;queueTrace=31*queueTrace+1;
        if(mode==28&&xLoads==6){n.j=n.j.clone();n.j[1]=0x52120000|seedX-1;}
        if(mode==29&&xLoads==4)n.j=new int[0];
        return n.j;
    }
    public static int[] queueZ() {
        zLoads++;queueTrace=31*queueTrace+2;
        if(mode==30&&zLoads==3)u.b=new int[0];
        return u.b;
    }
    public static int angle1(hk w) {
        int value=w.k;
        if(mode==26&&!replaced) {
            replaced=true;
            hk next=squares[1][seedX-1][seedZ].z=new hk();next.k=512;next.j=1;
        }
        return value;
    }
    public static long code(ec s) {
        long value=s.u;
        if(mode==27&&!replaced) {
            replaced=true;
            ec next=squares[1][seedX-1][seedZ].H[0]=new ec();next.u=18L<<14;
        }
        return value;
    }
    static void prepare(Path jarFile,Path out)throws Exception{
        try(JarFile jar=new JarFile(jarFile.toFile())){
            ClassReader reader=new ClassReader(jar.getInputStream(jar.getJarEntry("ga.class")));
            ClassWriter writer=new ClassWriter(0);
            int[] sites=new int[5];
            reader.accept(new ClassVisitor(Opcodes.ASM8,writer){
                public MethodVisitor visitMethod(int a,String n,String d,String s,String[] e){
                    MethodVisitor m=super.visitMethod(a,n,d,s,e);
                    if(!n.equals("a")||!d.equals("(ZIBI[[[Lra;I)Z"))return m;
                    return new MethodVisitor(Opcodes.ASM8,m){
                        public void visitFieldInsn(int op,String cls,String name,String desc){
                            if(op==Opcodes.GETSTATIC&&cls.equals("n")&&name.equals("j")&&desc.equals("[I")) {
                                sites[1]++;super.visitMethodInsn(Opcodes.INVOKESTATIC,"RoofFloodOracle","queueX","()[I",false);
                            } else if(op==Opcodes.GETSTATIC&&cls.equals("u")&&name.equals("b")&&desc.equals("[I")) {
                                sites[2]++;super.visitMethodInsn(Opcodes.INVOKESTATIC,"RoofFloodOracle","queueZ","()[I",false);
                            } else if(op==Opcodes.GETFIELD&&cls.equals("hk")&&name.equals("k")&&desc.equals("I")) {
                                sites[3]++;super.visitMethodInsn(Opcodes.INVOKESTATIC,"RoofFloodOracle","angle1","(Lhk;)I",false);
                            } else if(op==Opcodes.GETFIELD&&cls.equals("ec")&&name.equals("u")&&desc.equals("J")) {
                                sites[4]++;super.visitMethodInsn(Opcodes.INVOKESTATIC,"RoofFloodOracle","code","(Lec;)J",false);
                            } else super.visitFieldInsn(op,cls,name,desc);
                        }
                        public void visitMethodInsn(int op,String cls,String name,String desc,boolean itf){
                            if(cls.equals("ob")&&name.equals("a")&&desc.equals("(II)I")){
                                sites[0]++;super.visitMethodInsn(op,"RoofFloodOracle","wall",desc,false);
                            }else super.visitMethodInsn(op,cls,name,desc,itf);
                        }
                    };
                }
            },0);
            if(!Arrays.equals(sites,new int[]{3,12,11,3,2}))throw new AssertionError(Arrays.toString(sites));
            Files.write(out.resolve("ga.class"),writer.toByteArray());
        }
    }
    static String digest(int[] words){
        if(words==null)return "-";
        ByteBuffer b=ByteBuffer.allocate(words.length*4);
        for(int w:words)b.putInt(w);
        return HexFormat.of().formatHex(sha.digest(b.array()));
    }
    static String marks(byte[][][] grid){
        if(grid==null)return "-";
        for(byte[][] plane:grid)for(byte[] row:plane)sha.update(row);
        return HexFormat.of().formatHex(sha.digest());
    }
    static int[] bound(int initial){int[] data=new int[3];Arrays.fill(data,initial);return data;}

    static String run(int[] r) {
        mode=r[0];int pattern=r[1],level=r[2],x=r[3],z=r[4],variant=r[5],index=r[7];
        ai.d=r[6];ah.f=level;boolean rebuild=r[8]!=0;
        seedX=x;seedZ=z;calls=0;maskTrace=1;xLoads=zLoads=0;queueTrace=1;replaced=false;
        ac.k=new byte[4][104][104]; tb.t=new byte[4][104][104];ve.q=new int[4][105][105];squares=new ra[4][104][104];
        for(int p=0;p<4;p++)for(int i=0;i<104;i++)for(int j=0;j<104;j++){
            ac.k[p][i][j]=117;
            int dx=i-x,dz=j-z;
            if(p==level&&pattern!=5&&(dx==0&&dz==0||pattern==1&&Math.abs(dx)<=4&&Math.abs(dz)<=2||
                pattern==2||pattern==3&&Math.abs(dx)==Math.abs(dz)&&Math.abs(dx)<=5||
                pattern==4&&Math.abs(dx)<=8&&Math.abs(dz)<=8&&(dx*dx+dz*17)%7!=0))tb.t[p][i][j]=4;
            if(p>level&&(mode==13 || pattern==4&&(i+j*9+p)%5==0))tb.t[p][i][j]|=8;
            ve.q[p][i][j]=1009*p+313*i-73*j;
            if(p<=level||Math.abs(dx)>1||Math.abs(dz)>1)continue;
            if(mode==1||mode==2||mode==21||mode==22||mode==26||mode==28) {
                ra s=squares[p][i][j]=new ra(p,i,j);hk w=s.z=new hk();
                w.k=mode==2?512:variant;w.j=mode==1?512:variant;
            }
            if(mode==3||mode==4||mode==5||mode==14||mode==24||mode==27) {
                ra s=squares[p][i][j]=new ra(p,i,j);s.t=1;
                ec e=s.H[0]=new ec();
                e.u=0xFFFF012300000000L | (long)(variant&63)<<14 | (long)(variant>>6&3)<<20;
                e.a=e.n=i;e.m=e.y=j;
                if(mode==4){e.a=Math.max(0,i-2);e.n=Math.min(103,i+3);e.m=Math.max(0,j-3);e.y=Math.min(103,j+2);}
                if(mode==5&&dx==0&&dz==0){e.a=1;e.n=2;e.m=102;e.y=104;}
                if(mode==14&&dx==0&&dz==0)s.t=2;
                if(mode==24&&dx!=0)s.H=null;
            }
        }
        n.j=new int[4096];u.b=new int[4096];Arrays.fill(n.j,0x7287);Arrays.fill(u.b,-77);
        qa.N=bound(-1000000);vc.M=bound(1000000);gh.L=bound(0);sf.j=bound(1000000);ce.G=bound(0);
        switch(mode){
            case 6:squares=null;break;
            case 7:ac.k=null;break;
            case 8:tb.t=null;break;
            case 9:ve.q=null;break;
            case 10:u.b=n.j;break;
            case 11:if(variant>=0)n.j=new int[variant];else u.b=new int[~variant];break;
            case 12:ac.k[level][x][z]=(byte)(rebuild?1:ai.d);break;
            case 16:vc.M=qa.N;sf.j=gh.L;ce.G=qa.N;Arrays.fill(qa.N,2147483643);break;
            case 17:if(variant==0)qa.N=null;else if(variant==1)vc.M=null;else if(variant==2)gh.L=null;else if(variant==3)sf.j=null;else ce.G=null;break;
            case 18:qa.N=new int[1];break;
            case 19:ac.k=tb.t;break;
            case 23:if(variant==0)ve.q=new int[1][][];else if(variant==1)ac.k[1][x]=new byte[z];else squares[1]=null;break;
            case 25:ve.q[1][x][z]=Integer.MAX_VALUE;break;
        }
        String result;
        try{result=Boolean.toString(ga.a(rebuild,z,(byte)79,index,squares,x));}
        catch(RuntimeException err){
            Throwable e=err;while(e instanceof g)e=((g)e).a;
            if(e instanceof NullPointerException)result="null";
            else if(e instanceof ArrayIndexOutOfBoundsException)result="index "+e.getMessage().split(" ")[1];
            else throw err;
        }
        return result+"|"+calls+","+maskTrace+","+ah.f+"|"+xLoads+","+zLoads+","+queueTrace+","+replaced+"|"+marks(ac.k)+"|"+digest(n.j)+"|"+digest(u.b)+"|"+
            Arrays.toString(qa.N)+"|"+Arrays.toString(vc.M)+"|"+Arrays.toString(gh.L)+"|"+Arrays.toString(sf.j)+"|"+Arrays.toString(ce.G);
    }
    public static void main(String[] args)throws Exception{
        if(args.length==2){prepare(Path.of(args[0]),Path.of(args[1]));return;}
        sha=MessageDigest.getInstance("SHA-256");BufferedReader in=new BufferedReader(new InputStreamReader(System.in));String line;
        while((line=in.readLine())!=null)System.out.println(run(Arrays.stream(line.split(" ")).mapToInt(Integer::parseInt).toArray()));
    }
}
