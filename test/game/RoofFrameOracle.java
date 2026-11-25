import java.io.*;
import java.nio.file.*;
import java.util.*;
import java.util.jar.JarFile;
import jdk.internal.org.objectweb.asm.*;

public final class RoofFrameOracle {
    static int fault,height,hash,marks,tests;
    static StringJoiner calls;
    static final IdentityHashMap<byte[],Integer> ids=new IdentityHashMap<>();
    static byte[][][] flags=new byte[4][104][104], fullMarks=new byte[4][104][104];
    static ra[][][] squares=new ra[1][1][1];
    static pb player=new pb();
    static int mask;
    static void record(int a,int b,int c,int d){hash=(((hash*31+a)*31+b)*31+c)*31+d;}
    public static void mark(byte[] row,int i,int v){row[i]=(byte)v;record(1,ids.get(row),i,v&255);marks++;}
    public static int flag(byte[] row,int i){int v=row[i];record(2,ids.get(row),i,v&255);tests++;return v;}
    public static boolean flood(boolean rebuild,int z,byte dummy,int slot,ra[][][] grid,int x) {
        calls.add((rebuild?1:0)+","+z+","+slot+","+(grid==squares?1:0)+","+x);
        if(fault==18&&slot==0){rk.m=7*128;ud.g=9*128;te.g.Z=11*128;te.g.S=10*128;ah.f=1;kl.Bb=null;flags[1][8][9]=4;}
        if(fault==19)throw new IllegalStateException();
        return false;
    }
    public static int ground(int level,int x,int z,byte dummy){
        calls.add("h"+level+","+x+","+z);
        if(fault==20){rk.m=8*128;ud.g=9*128;ah.f=1;mf.i=height-799;flags[1][8][9]=4;}
        return height;
    }
    static void prepare(Path jarPath,Path dir)throws Exception{
        try(JarFile jar=new JarFile(jarPath.toFile())){
            ClassReader reader=new ClassReader(jar.getInputStream(jar.getJarEntry("il.class")));
            ClassWriter writer=new ClassWriter(0);
            reader.accept(new ClassVisitor(Opcodes.ASM8,writer){
                public MethodVisitor visitMethod(int access,String name,String desc,String sig,String[] ex){
                    MethodVisitor visitor=super.visitMethod(access,name,desc,sig,ex);
                    if(!name.equals("b")||!desc.equals("(Z)V"))return visitor;
                    return new MethodVisitor(Opcodes.ASM8,visitor){
                        public void visitInsn(int op){
                            if(op==Opcodes.BASTORE)super.visitMethodInsn(Opcodes.INVOKESTATIC,"RoofFrameOracle","mark","([BII)V",false);
                            else if(op==Opcodes.BALOAD)super.visitMethodInsn(Opcodes.INVOKESTATIC,"RoofFrameOracle","flag","([BI)I",false);
                            else super.visitInsn(op);
                        }
                        public void visitMethodInsn(int op,String cls,String method,String type,boolean iface){
                            if(op==Opcodes.INVOKESTATIC&&method.equals("a")&&(cls.equals("ga")||cls.equals("ml")))
                                super.visitMethodInsn(op,"RoofFrameOracle",cls.equals("ga")?"flood":"ground",type,false);
                            else super.visitMethodInsn(op,cls,method,type,iface);
                        }
                    };
                }
            },0);
            Files.write(dir.resolve("il.class"),writer.toByteArray());
        }
    }
    static String run(int[] r){
        int mode=r[0],level=r[1],camMode=r[2],pitch=r[3],x=r[4],z=r[5],px=r[6],pz=r[7],hx=r[8],hz=r[9],stamp=r[10],land=r[11],camY=r[12];fault=r[13];
        height=land;hash=1;marks=tests=0;calls=new StringJoiner(";");
        rj.l=mode!=1;oi.j=mode!=3;kf.n=mode==0;ah.f=level;cl.e=camMode;bd.X=pitch;ai.d=stamp;
        rk.m=x*128+35;ud.g=z*128+19;mf.i=camY;te.g=player;player.Z=px*128+77;player.S=pz*128+14;
        kl.Bb=squares;ac.k=fullMarks.clone();tb.t=flags.clone();
        int col=Math.floorMod(stamp,104);
        for(int p=0;p<4;p++){
            ac.k[p]=fullMarks[p].clone();tb.t[p]=flags[p].clone();
            if(hx>=0&&hx<104&&hz>=0&&hz<104)flags[p][hx][hz]=4;
            if(fault>=18 && px>=0&&px<104&&pz>=0&&pz<104)flags[p][px][pz]=4;
        }
        int[][] bound=new int[5][];
        for(int i=0;i<5;i++)bound[i]=new int[]{111+i,222+i,333+i};
        switch(fault){
            case 1:ac.k=null;break;
            case 2:ac.k=new byte[][][]{fullMarks[0],null};break;
            case 3:ac.k[2]=new byte[0][];break;
            case 4:ac.k[1][col]=null;break;
            case 5:ac.k[2][col]=new byte[47];ids.put(ac.k[2][col],2*104+col);break;
            case 6:case 7:case 8:case 9:case 10:bound[fault-6]=null;break;
            case 11:case 12:case 13:case 14:case 15:bound[fault-11]=new int[]{17};break;
            case 16:tb.t=null;break;
            case 17:te.g=null;break;
            case 21:if(px>=0&&px<104)tb.t[level&3][px]=new byte[0];break;
        }
        qa.N=bound[0];vc.M=bound[1];gh.L=bound[2];sf.j=bound[3];ce.G=bound[4];
        String result="ok";
        try{il.b(true);}catch(RuntimeException e){
            Throwable t=e;while(t instanceof g)t=((g)t).a;
            if(t instanceof ArithmeticException)result="divide";
            else if(t instanceof NullPointerException)result="null";
            else if(t instanceof ArrayIndexOutOfBoundsException)result="index"+t.getMessage().split(" ")[1];
            else if(t instanceof IllegalStateException)result="probe";
            else throw new AssertionError(t);
        }
        for(int p=0;p<4;p++){
            if(hx>=0&&hx<104&&hz>=0&&hz<104)flags[p][hx][hz]=0;
            if(px>=0&&px<104&&pz>=0&&pz<104)flags[p][px][pz]=0;
        }
        flags[1][8][9]=0;
        StringJoiner bounds=new StringJoiner(";");
        for(int[] arr:bound)bounds.add(arr==null?"-":Arrays.toString(arr).replace(" ",""));
        return result+" "+marks+" "+tests+" "+hash+"|"+bounds+"|"+calls;
    }
    public static void main(String[] args)throws Exception{
        if(args.length!=0){prepare(Path.of(args[0]),Path.of(args[1]));return;}
        for(int p=0;p<4;p++)for(int x=0;x<104;x++){ids.put(flags[p][x],p*104+x);ids.put(fullMarks[p][x],p*104+x);}
        BufferedReader in=new BufferedReader(new InputStreamReader(System.in));PrintWriter out=new PrintWriter(System.out);String s;
        while((s=in.readLine())!=null)out.println(run(Arrays.stream(s.split(" ")).mapToInt(Integer::parseInt).toArray()));
        out.flush();
    }
}
