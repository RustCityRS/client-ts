import java.io.*;
import java.nio.file.*;
import java.util.*;
import java.util.jar.JarFile;
import jdk.internal.org.objectweb.asm.*;

public final class GroundMissingOracle {
    static final IdentityHashMap<Object,Integer> rowIds = new IdentityHashMap<>();
    static final List<Object> rows = new ArrayList<>();
    static int writes, trace;

    static void register(Object row) {
        rowIds.put(row,rows.size());
        rows.add(row);
    }
    static void saved(Object row,int index,int value) {
        writes++;
        trace=((trace*31+rowIds.get(row))*31+index)*31+value;
    }
    public static void putHeight(int[] row,int index,int value) {
        row[index]=value;
        saved(row,index,value);
    }
    public static void putShadow(byte[] row,int index,int value) {
        row[index]=(byte)value;
        saved(row,index,value&255);
    }

    // Each original array store executes before observation, including its JVM null/index checks.
    // No control-flow or array-read instructions in bk.a are replaced.
    static void prepare(Path gamepack,Path out) throws Exception {
        try(JarFile jar=new JarFile(gamepack.toFile())) {
            ClassReader reader=new ClassReader(jar.getInputStream(jar.getJarEntry("bk.class")));
            ClassWriter writer=new ClassWriter(0);
            int[] counts={0,0};
            reader.accept(new ClassVisitor(Opcodes.ASM8,writer) {
                public MethodVisitor visitMethod(int access,String name,String desc,String sig,String[] exceptions) {
                    MethodVisitor visitor=super.visitMethod(access,name,desc,sig,exceptions);
                    if(!name.equals("a") || !desc.equals("(IIIBII)V")) return visitor;
                    return new MethodVisitor(Opcodes.ASM8,visitor) {
                        public void visitInsn(int op) {
                            if(op==Opcodes.IASTORE) {counts[0]++;super.visitMethodInsn(Opcodes.INVOKESTATIC,"GroundMissingOracle","putHeight","([III)V",false);}
                            else if(op==Opcodes.BASTORE) {counts[1]++;super.visitMethodInsn(Opcodes.INVOKESTATIC,"GroundMissingOracle","putShadow","([BII)V",false);}
                            else super.visitInsn(op);
                        }
                    };
                }
            },0);
            if(counts[0]<5 || counts[1]!=1)throw new AssertionError(Arrays.toString(counts));
            Files.write(out.resolve("bk.class"),writer.toByteArray());
        }
    }
    static String error(Throwable e) {
        while(e instanceof g)e=((g)e).a;
        if(e instanceof NullPointerException)return "null";
        if(e instanceof ArrayIndexOutOfBoundsException)return "index"+e.getMessage().split(" ")[1];
        throw new AssertionError(e);
    }

    static String run(int[] c) {
        int size=c[0],x=c[1],w=c[2],z=c[3],h=c[4],plane=c[5],mask=c[6],fault=c[7];
        rowIds.clear();rows.clear();writes=0;trace=1;
        ve.q=new int[4][size][size];ke.E=new byte[4][size][size];
        for(int p=0;p<4;p++)for(int a=0;a<size;a++) {
            register(ve.q[p][a]);register(ke.E[p][a]);
            for(int b=0;b<size;b++) {
                int key=p*65537+a*37+b;
                ve.q[p][a][b]=key*1664525+1013904223;
                ke.E[p][a][b]=(byte)(key*19+7);
            }
        }
        if(x>0&&x<size&&z>0&&z<size&&plane>=0&&plane<4) {
            int[] xs={x-1,x,x-1},zs={z,z-1,z-1};
            for(int i=0;i<3;i++)if((mask&(1<<i))==0)ve.q[plane][xs[i]][zs[i]]=plane==0?0:ve.q[plane-1][xs[i]][zs[i]];
        }
        int p=plane>=0&&plane<4?plane:0, a=x>=0&&x<size?x:1, b=z>=0&&z<size?z:1;
        int next=Math.min(a+1,size-1), len=Math.min(b+1,size);
        switch(fault) {
            case 1: ke.E=null;break;
            case 2: ke.E=new byte[0][][];break;
            case 3: ke.E[p]=null;break;
            case 4: ke.E[p]=Arrays.copyOf(ke.E[p],next);break;
            case 5: ke.E[p][next]=null;break;
            case 6: {byte[] row=Arrays.copyOf(ke.E[p][next],len);register(row);ke.E[p][next]=row;break;}
            case 7: ve.q=null;break;
            case 8: ve.q=new int[1][][];break;
            case 9: ve.q[p]=null;break;
            case 10: ve.q[p]=Arrays.copyOf(ve.q[p],next);break;
            case 11: ve.q[p][next]=null;break;
            case 12: {int[] row=Arrays.copyOf(ve.q[p][next],len);register(row);ve.q[p][next]=row;break;}
            case 13: if(p>0)ve.q[p-1]=null;break;
            case 14: if(p>0)ve.q[p-1][next]=null;break;
            case 15: if(p>0)ve.q[p-1][a]=new int[0];break;
            case 16: if(a>0)ve.q[p][a-1]=null;break;
            case 17: if(p>0&&a>0)ve.q[p-1][a-1]=null;break;
            case 18: if(a>0)ve.q[p][a]=ve.q[p][a-1];break;
            case 19: if(p>0)ve.q[p]=ve.q[p-1];break;
            case 20: if(a>0)ke.E[p][a]=ke.E[p][a-1];break;
        }
        String status="ok";
        try {bk.a(x,w,z,(byte)125,h,plane);}catch(RuntimeException e){status=error(e);}
        int digest=1;
        for(Object row:rows) {
            if(row instanceof int[])for(int v:(int[])row)digest=digest*31+v;
            else for(byte v:(byte[])row)digest=digest*31+(v&255);
        }
        return status+" "+writes+" "+trace+" "+digest;
    }

    public static void main(String[] args) throws Exception {
        if(args.length!=0) {prepare(Path.of(args[0]),Path.of(args[1]));return;}
        BufferedReader in=new BufferedReader(new InputStreamReader(System.in));PrintWriter out=new PrintWriter(System.out);
        String line;
        while((line=in.readLine())!=null)out.println(run(Arrays.stream(line.split(" ")).mapToInt(Integer::parseInt).toArray()));
        out.flush();
    }
}
