import java.io.*;
import java.nio.file.*;
import java.util.Arrays;
import java.util.jar.JarFile;
import jdk.internal.org.objectweb.asm.*;

public final class GroundVisLevelOracle {
    static int reads;
    static boolean replace;
    static byte[][][] next;

    // The original GETSTATIC leaves its value on the stack. Replace the static only after that load.
    public static void loaded() {
        if (++reads==1 && replace)tb.t=next;
    }
    static void prepare(Path gamepack,Path out) throws Exception {
        try (JarFile jar=new JarFile(gamepack.toFile())) {
            ClassReader reader=new ClassReader(jar.getInputStream(jar.getJarEntry("ec.class")));
            ClassWriter writer=new ClassWriter(0);
            int[] sites={0};
            reader.accept(new ClassVisitor(Opcodes.ASM8,writer) {
                public MethodVisitor visitMethod(int access,String name,String desc,String sig,String[] thrown) {
                    MethodVisitor visitor=super.visitMethod(access,name,desc,sig,thrown);
                    if(!name.equals("a")||!desc.equals("(ZIII)I"))return visitor;
                    return new MethodVisitor(Opcodes.ASM8,visitor) {
                        public void visitFieldInsn(int op,String cls,String field,String type) {
                            super.visitFieldInsn(op,cls,field,type);
                            if(op==Opcodes.GETSTATIC&&cls.equals("tb")&&field.equals("t")&&type.equals("[[[B")) {
                                sites[0]++;
                                super.visitMethodInsn(Opcodes.INVOKESTATIC,"GroundVisLevelOracle","loaded","()V",false);
                            }
                        }
                    };
                }
            },0);
            if(sites[0]!=2)throw new AssertionError(sites[0]);
            Files.write(out.resolve("ec.class"),writer.toByteArray());
        }
    }
    static byte[][][] map(int width,int height,int current,int bridge,int p,int x,int z) {
        byte[][][] flags=new byte[4][width][height];
        int a=x>=0&&x<width?x:0,b=z>=0&&z<height?z:0;
        flags[1][a][b]=(byte)bridge;
        if(p>=0&&p<4)flags[p][a][b]=(byte)current;
        return flags;
    }
    static String run(int[] c) {
        int w=c[0],h=c[1],x=c[2],z=c[3],level=c[4],mask=c[5],bridge=c[6],fault=c[7];
        int p=level>=0&&level<4?level:0, a=x>=0&&x<w?x:0, b=z>=0&&z<h?z:0;
        reads=0; replace=false; next=null;
        tb.t=map(w,h,mask,bridge,level,x,z);
        switch(fault) {
            case 1: tb.t=null;break;
            case 2: tb.t=new byte[0][][];break;
            case 3: tb.t[p]=null;break;
            case 4: tb.t[p]=Arrays.copyOf(tb.t[p],a);break;
            case 5: tb.t[p][a]=null;break;
            case 6: tb.t[p][a]=Arrays.copyOf(tb.t[p][a],b);break;
            case 7: tb.t[1]=null;break;
            case 8: tb.t[1][a]=Arrays.copyOf(tb.t[1][a],b);break;
            case 9: replace=true;break;
            case 10: replace=true; next=map(w,h,bridge^2,bridge^2,level,x,z);break;
            case 11: replace=true; next=new byte[0][][];break;
            case 12: tb.t[1]=tb.t[3];break;
        }
        String result;
        try {result="value"+ec.a(false,x,level,z);}catch(RuntimeException e) {
            Throwable error=e;
            while(error instanceof g)error=((g)error).a;
            if(error instanceof NullPointerException)result="null";
            else if(error instanceof ArrayIndexOutOfBoundsException)result="index"+error.getMessage().split(" ")[1];
            else throw new AssertionError(error);
        }
        return reads+" "+result;
    }
    public static void main(String[] args)throws Exception{
        if(args.length!=0){prepare(Path.of(args[0]),Path.of(args[1]));return;}
        BufferedReader input=new BufferedReader(new InputStreamReader(System.in));
        PrintWriter output=new PrintWriter(System.out);
        String line;
        while((line=input.readLine())!=null)output.println(run(Arrays.stream(line.split(" ")).mapToInt(Integer::parseInt).toArray()));
        output.flush();
    }
}
