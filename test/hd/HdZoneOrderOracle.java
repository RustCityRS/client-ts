import java.io.*;
import java.nio.file.*;
import java.util.*;
import jdk.internal.org.objectweb.asm.*;

// Observe only g.b(B)V. Every GETSTATIC and PUTSTATIC keeps its real field instruction.
// Redirect the four scene callees at the method boundary; packet reads and entity constructors remain native.
public class HdZoneOrderOracle {
    static final class Boundary extends Error {}
    static final List<String> events = new ArrayList<>();
    static int stop, swap, replacement, gates;
    static void emit(String event) {
        events.add(event);
        if (events.size() == stop) throw new Boundary();
    }
    public static void field(String op, int index) {
        emit(index + ":" + op);
        if (op.equals("na.l") && ++gates == swap) na.l = replacement;
    }
    public static void loc(int plane,int z,int guard,int angle,int x,int remaining,int id,int layer,int shape,int delay) {
        emit("loc=" + Arrays.toString(new int[]{delay,shape,x,remaining,z,plane,layer,id,angle}));
    }
    public static void anim(int plane,int guard,int angle,int shape,int z,int layer,int x,int seq) {
        emit("anim=" + Arrays.toString(new int[]{x,angle,seq,z,shape,plane,layer}));
    }
    public static void show(int z,byte guard,int x) { emit("show=" + z + "," + x); }
    public static void merge(int x2,int start,int actor,int end,int z,int z2,int angle,int x1,int x,int shape,int guard,int z1,int id) {
        emit("merge=" + Arrays.toString(new int[]{actor,angle,end,x,z2,shape,z,x2,z1,id,x1,start}));
    }

    static void instrument(Path dir) throws Exception {
        try (InputStream stream = HdZoneOrderOracle.class.getResourceAsStream("/g.class")) {
            ClassReader reader = new ClassReader(stream);
            ClassWriter writer = new ClassWriter(reader,ClassWriter.COMPUTE_MAXS);
            reader.accept(new ClassVisitor(Opcodes.ASM8,writer) {
                public MethodVisitor visitMethod(int access,String name,String desc,String sig,String[] ex) {
                    MethodVisitor m=super.visitMethod(access,name,desc,sig,ex);
                    if (!name.equals("b") || !desc.equals("(B)V")) return m;
                    return new MethodVisitor(Opcodes.ASM8,m) {
                        int index;
                        public void visitFieldInsn(int op,String owner,String field,String type) {
                            if ((op==Opcodes.GETSTATIC || op==Opcodes.PUTSTATIC) && !(owner.equals("client") && field.equals("mb")) && !(owner.equals("g") && field.equals("h"))) {
                                super.visitLdcInsn((op==Opcodes.PUTSTATIC?"+":"")+owner+"."+field);
                                super.visitLdcInsn(index++);
                                super.visitMethodInsn(Opcodes.INVOKESTATIC,"HdZoneOrderOracle","field","(Ljava/lang/String;I)V",false);
                            }
                            super.visitFieldInsn(op,owner,field,type);
                        }
                        public void visitMethodInsn(int op,String owner,String name,String desc,boolean itf) {
                            String hook = switch(owner+"."+name+desc) {
                                case "ce.a(IIIIIIIIII)V" -> "loc";
                                case "hd.a(IIIIIIII)V" -> "anim";
                                case "rm.a(IBI)V" -> "show";
                                case "nh.a(IIIIIIIIIIIII)V" -> "merge";
                                default -> null;
                            };
                            if(hook!=null) super.visitMethodInsn(op,"HdZoneOrderOracle",hook,desc,false);
                            else super.visitMethodInsn(op,owner,name,desc,itf);
                        }
                    };
                }
            },0);
            Files.write(dir.resolve("g.class"),writer.toByteArray());
        }
    }

    public static void main(String[] args) throws Exception {
        if(args.length>0){instrument(Path.of(args[0]));return;}
        wk.t.a((byte)-109,new eg(),0L);
        nk.O = new e();
        nk.O.K[0]=nk.O.w[0]=0;
        ac.l.g=new int[][]{new int[]{31,15,17}};
        gj.m=null;
        BufferedReader in=new BufferedReader(new InputStreamReader(System.in));
        for(String line;(line=in.readLine())!=null;){
            String[] v=line.split(" ");
            na.l=Integer.parseInt(v[0]); int base=Integer.parseInt(v[1]);
            tf.w=v[2].equals("1"); byte guard=Byte.parseByte(v[3]); stop=Integer.parseInt(v[4]); swap=Integer.parseInt(v[5]); replacement=Integer.parseInt(v[6]);
            byte[] bytes=HexFormat.of().parseHex(v[7].equals("-")?"":v[7]);
            eg.e=new i(0);eg.e.y=bytes;
            ja.q=og.b=base;ee.b=0;gj.d=100;bf.E=0;cg.f=127;pe.j=0;
            mi.Y=new ih[1][8][8];
            if(base==0 && (na.l==14 || na.l==240)){
                mi.Y[0][0][0]=new ih();
                mi.Y[0][0][0].a(true,new pa(new uj()));
            }
            rj.U=new ih();hk.W=new ih();
            Arrays.fill(qe.t,0);Arrays.fill(na.mb,0);Arrays.fill(wh.g,0);Arrays.fill(ca.fb,0);
            gates=0;events.clear();
            String status="ok";
            try {g.b(guard);}
            catch(Boundary b){status="stop";}
            catch(RuntimeException e){Throwable cause=e;while(cause instanceof ld w)cause=w.f;status=cause.getClass().getSimpleName()+"@"+((ld)e).e;}
            System.out.println(status+"|"+eg.e.T+"|"+na.l+"|"+pe.j+","+qe.t[0]+","+wh.g[0]+","+na.mb[0]+","+ca.fb[0]+"|"+String.join(";",events));
        }
    }
}
