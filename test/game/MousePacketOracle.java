import java.io.*;
import java.nio.file.*;
import java.util.*;
import jdk.internal.org.objectweb.asm.*;

final class MousePacketOracle {
    static int recorderReads, packetReads, changeRecorder, changePacket;
    static ag nextRecorder;
    static be nextPacket;
    static final class EndOfBlock extends Error {}

    // Schedule an intervening assignment immediately before a selected GETSTATIC.
    // The original instructions, including the monitor and its exception handler, still execute.
    public static void recorderRead() {
        if (++recorderReads == changeRecorder) ej.p = nextRecorder;
    }
    public static void packetRead() {
        if (++packetReads == changePacket) qk.v = nextPacket;
    }
    public static void cameraBoundary() { throw new EndOfBlock(); }

    static void instrument(Path dir) throws IOException {
        ClassReader reader;
        try (InputStream bytes = t.class.getResourceAsStream("/t.class")) { reader = new ClassReader(bytes); }
        ClassWriter writer = new ClassWriter(reader,0);
        reader.accept(new ClassVisitor(Opcodes.ASM8,writer) {
            @Override public MethodVisitor visitMethod(int access,String name,String desc,String signature,String[] exceptions) {
                MethodVisitor body = super.visitMethod(access,name,desc,signature,exceptions);
                if (!name.equals("c") || !desc.equals("(I)V")) return body;
                return new MethodVisitor(Opcodes.ASM8,body) {
                    boolean inside, ended;
                    @Override public void visitFieldInsn(int op,String owner,String field,String type) {
                        if (!ended && op == Opcodes.GETSTATIC) {
                            if (owner.equals("ej") && field.equals("p")) inside = true;
                            if (inside) {
                                String hook = null;
                                if (owner.equals("ej") && field.equals("p")) hook = "recorderRead";
                                if (owner.equals("qk") && field.equals("v")) hook = "packetRead";
                                if (owner.equals("ci") && field.equals("c")) { hook = "cameraBoundary"; ended = true; }
                                if (hook != null) super.visitMethodInsn(Opcodes.INVOKESTATIC,"MousePacketOracle",hook,"()V",false);
                            }
                        }
                        super.visitFieldInsn(op,owner,field,type);
                    }
                    @Override public void visitEnd() {
                        if (!ended) throw new AssertionError("t.c mouse region missing");
                        super.visitEnd();
                    }
                };
            }
        },0);
        Files.write(dir.resolve("t.class"),writer.toByteArray());
    }

    static int[] samples(int size,int mode,boolean y) {
        if (size < 0) return null;
        int[] values = new int[size];
        for (int i=0;i<size;i++) {
            if (mode==0) values[i] = (y?3:2)+i;
            else if (mode==1) values[i] = (i%2==0?120:33)+(y?1:0);
            else if (mode==2) values[i] = i%2==0 ? (y?65544:71111)+i : -1;
            else values[i] = y?-1:2;
        }
        return values;
    }
    static be packet(int size,int pos,int tag,boolean cipher) {
        be p = new be(0);
        p.fb = size < 0 ? null : new byte[size];
        if (p.fb != null) Arrays.fill(p.fb,(byte)tag);
        p.yb = pos;
        if (cipher) p.a(new int[]{tag,3,9,17},0);
        return p;
    }
    static String packetState(be p,boolean cipher) {
        String bytes = p.fb==null?"null":HexFormat.of().formatHex(p.fb);
        int pos = p.yb;
        int next = -1;
        if (cipher) {
            p.fb=new byte[1];p.yb=0;p.k(2,251);next=p.fb[0]&255;
        }
        return pos+","+bytes+","+next;
    }
    static String recorderState(ag r) {
        return r.n+","+Arrays.hashCode(r.o)+","+Arrays.hashCode(r.m);
    }
    public static void main(String[] args) throws IOException {
        if (args.length!=0) { instrument(Path.of(args[0])); return; }
        tf.C=30;ek.s=null;
        BufferedReader input = new BufferedReader(new InputStreamReader(System.in));
        for (String row;(row=input.readLine())!=null;) {
            int[] v=Arrays.stream(row.split(" ")).mapToInt(Integer::parseInt).toArray();
            int damage=v[10];
            ag first=new ag(),second=new ag();
            first.n=v[0];first.o=samples(v[1],v[5],false);first.m=samples(v[2],v[5],true);
            if(damage==1)first.g=null;
            second.n=3;second.o=samples(3,1,false);second.m=samples(3,1,true);
            ej.p=damage==2?null:first;nextRecorder=damage==3?null:second;
            tj.h=damage!=5;se.a=mk.K=0;lk.v=v[4];
            ea.c=199L;oi.h=v[3];lc.v=oi.h==2?Long.MIN_VALUE:789L;sa.x=65544;oj.e=-14;
            be a=packet(v[6],v[7],19,damage!=7), b=packet(14,damage==8?Integer.MIN_VALUE:3,37,true);
            qk.v=a;nextPacket=damage==4?null:b;
            changeRecorder=v[8];changePacket=v[9];recorderReads=packetReads=0;
            String fault="returned";
            try { t.c(100); }
            catch(EndOfBlock end) { fault="ok"; }
            catch(RuntimeException e) {
                Throwable cause=e;while(cause instanceof g wrapper && wrapper.a!=null)cause=wrapper.a;
                fault=cause instanceof NullPointerException?"null":cause instanceof IndexOutOfBoundsException?"bounds":cause.getClass().getSimpleName();
            }
            System.out.println(String.join(";",fault,recorderState(first),recorderState(second),ej.p==null?"-":ej.p==first?"a":"b",
                packetState(a,damage!=7),packetState(b,true),qk.v==null?"-":qk.v==a?"a":"b",""+se.a,""+mk.K,""+lk.v,""+ea.c,
                ""+recorderReads,""+packetReads));
        }
    }
}
