import java.io.*;
import java.lang.reflect.*;
import java.nio.file.*;
import java.util.*;
import java.util.jar.*;
import jdk.internal.org.objectweb.asm.*;

public class CameraOpcodeOrderOracle {
    static final String[] sd = "hk.e vj.t qa.P mf.q ck.I sc.W se.d ga.A mg.e cl.e pd.s df.B bd.X qj.w kg.l tg.B".split(" ");
    static final String[] hd = "se.a lc.n me.k eb.t k.i g.d t.z sh.c j.K sg.o fl.s eg.d tg.b ol.ib id.d uj.t".split(" ");
    static int cut;
    static String fault;
    static final List<String> trace = new ArrayList<>();

    public static void event(String name) {
        trace.add(name);
        if (cut == trace.size()) throw new IllegalStateException("cut");
    }
    public static int load(int[] stack,int i) {
        int value = stack[i];
        event("i"+i);
        return value;
    }
    public static void store(int[] stack,int i,int value) {
        if(i<0 || i>=stack.length) {stack[i]=value;return;}
        event("o"+i+"="+value);
        stack[i]=value;
    }
    public static void moveSD(int f,int x,int h,int s,int dummy,int z,boolean snap) {
        event("move="+f+","+x+","+h+","+s+","+z+","+(snap?1:0));
    }
    public static void moveHD(boolean snap,int s,int h,int f,byte dummy,int z,int x) {moveSD(f,x,h,s,0,z,snap);}
    public static void lookSD(int s,int h,int x,int f,int z,int dummy) {event("look="+s+","+h+","+x+","+f+","+z);}
    public static void lookHD(int h,int z,int s,int x,byte dummy,int f) {lookSD(s,h,x,f,z,0);}
    public static void reset(int dummy) {event("reset");}
    public static void clampSD(int dummy) {event("clamp");}
    public static void clampHD(byte dummy) {event("clamp");}
    public static void reportSD(Throwable error,String text,int dummy) {
        fault = error instanceof IllegalStateException ? "cut" : error instanceof IndexOutOfBoundsException ? "bounds"
            : error instanceof NullPointerException ? "null" : error.getClass().getSimpleName();
    }
    public static void reportHD(String text,Throwable error,byte dummy) {reportSD(error,text,0);}

    static void prepare(boolean gl,Path jar,Path dir) throws Exception {
        String owner=gl?"h":"gh";
        try (JarFile pack=new JarFile(jar.toFile())) {
            ClassReader reader=new ClassReader(pack.getInputStream(pack.getJarEntry(owner+".class")));
            ClassWriter writer=new ClassWriter(reader,ClassWriter.COMPUTE_MAXS);
            reader.accept(new ClassVisitor(Opcodes.ASM8,writer) {
                public MethodVisitor visitMethod(int flags,String n,String d,String sig,String[] errors) {
                    MethodVisitor m=super.visitMethod(flags,n,d,sig,errors);
                    if (!n.equals("a") || !d.equals(gl?"(BILjl;)V":"(Lwf;II)V")) return m;
                    return new MethodVisitor(Opcodes.ASM8,m) {
                        boolean camera;
                        int markers,stores;
                        public void visitIntInsn(int op,int value) {
                            // The first 5500 routes an opcode range. The second compares opcode 5500 itself.
                            if (op==Opcodes.SIPUSH && value==5500 && ++markers==2) camera=true;
                            super.visitIntInsn(op,value);
                        }
                        void probe(String name,String descriptor) {
                            super.visitMethodInsn(Opcodes.INVOKESTATIC,"CameraOpcodeOrderOracle",name,descriptor,false);
                        }
                        public void visitFieldInsn(int op,String o,String n,String d) {
                            if(camera) {
                                super.visitLdcInsn((op==Opcodes.GETSTATIC?"r":"w")+o+"."+n);
                                probe("event","(Ljava/lang/String;)V");
                            }
                            super.visitFieldInsn(op,o,n,d);
                        }
                        public void visitInsn(int op) {
                            if(camera && op==Opcodes.IALOAD) probe("load","([II)I");
                            else if(camera && op==Opcodes.IASTORE) {
                                probe("store","([III)V");
                                // 5505 and 5506 end with the only two integer stores in this block.
                                if (++stores==2) camera=false;
                            } else super.visitInsn(op);
                        }
                        public void visitMethodInsn(int op,String o,String n,String d,boolean itf) {
                            String sub=switch(o+"."+n+d) {
                                case "pk.a(Ljava/lang/Throwable;Ljava/lang/String;I)V" -> "reportSD";
                                case "ha.a(Ljava/lang/String;Ljava/lang/Throwable;B)V" -> "reportHD";
                                default -> null;
                            };
                            if(camera) sub=switch(o+"."+n+d) {
                                case "ka.a(IIIIIIZ)V" -> "moveSD";
                                case "lb.a(ZIIIBII)V" -> "moveHD";
                                case "bi.a(IIIIII)V" -> "lookSD";
                                case "vd.a(IIIIBI)V" -> "lookHD";
                                case "cl.e(I)V", "ud.a(I)V" -> "reset";
                                case "pi.b(I)V" -> "clampSD";
                                case "gn.b(B)V" -> "clampHD";
                                default -> sub;
                            };
                            if(sub==null) super.visitMethodInsn(op,o,n,d,itf); else probe(sub,d);
                        }
                    };
                }
            },0);
            Files.write(dir.resolve(owner+".class"),writer.toByteArray());
        }
    }
    static Field field(String path) throws Exception {
        String[] names=path.split("\\.");
        Field f=Class.forName(names[0]).getDeclaredField(names[1]); f.setAccessible(true);return f;
    }
    public static void main(String[] args) throws Exception {
        boolean gl=args[0].equals("gl");
        if(args.length==3) {prepare(gl,Path.of(args[1]),Path.of(args[2]));return;}
        String[] names=gl?hd:sd;
        Field[] statics=new Field[names.length];
        for(int i=0;i<names.length;i++) statics[i]=field(names[i]);
        Class<?> script=Class.forName(gl?"qc":"m"), hook=Class.forName(gl?"jl":"wf");
        Object cache=field(gl?"ib.d":"sf.g").get(null);
        Method put=gl?cache.getClass().getDeclaredMethod("a",Class.forName("rg"),long.class,byte.class)
            :cache.getClass().getDeclaredMethod("a",long.class,int.class,Class.forName("ei"));
        Method run=gl?Class.forName("h").getDeclaredMethod("a",byte.class,int.class,hook)
            :Class.forName("gh").getDeclaredMethod("a",hook,int.class,int.class);
        int key=855000;
        for(String line:new BufferedReader(new InputStreamReader(System.in)).lines().toList()) {
            int[] row=Arrays.stream(line.split(" ")).mapToInt(Integer::parseInt).toArray();
            int n=row.length-4,op=row[0],layout=row[2],mode=row[3];
            int[] values=new int[n+2],ops=new int[n+2],stack=new int[8];
            Arrays.fill(stack,-691);
            for(int i=0;i<14;i++) statics[i].setInt(null,i==0?2608:i==1?3248:i==9?mode:511+i);
            statics[14].set(null,new int[][][]{layout==0?null:new int[layout][4],new int[6][4]});
            statics[15].set(null,stack);
            System.arraycopy(row,4,values,0,n);ops[n]=op;ops[n+1]=21;
            Object code=script.getDeclaredConstructor().newInstance(),event=hook.getDeclaredConstructor().newInstance();
            field(gl?"qc.O":"m.D").set(code,ops);field(gl?"qc.W":"m.F").set(code,values);
            field(gl?"qc.T":"m.B").set(code,Array.newInstance(Class.forName(gl?"na":"id"),ops.length));
            field(gl?"jl.E":"wf.G").set(event,new Object[]{key});
            if(gl) put.invoke(cache,code,(long)key,(byte)-87); else put.invoke(cache,(long)key,0,code);
            key++;cut=row[1];trace.clear();fault="ok";
            if(gl) run.invoke(null,(byte)-12,200,event);else run.invoke(null,event,-22368,200);
            int[] fields=new int[14];
            for(int i=0;i<fields.length;i++) fields[i]=statics[i].getInt(null);
            System.out.println(fault+";"+String.join(" ",trace)+";"+Arrays.toString(fields)+";"+Arrays.toString(stack));
        }
    }
}
