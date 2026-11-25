import java.awt.Frame;
import java.io.*;
import java.nio.file.*;
import java.util.*;
import java.util.jar.JarFile;
import jdk.internal.org.objectweb.asm.*;

/** The original CS2 dispatcher and display-mode filter/sort run against recorded window, display and GL endpoints. */
public final class HdDisplayScriptOracle {
    static final List<String> log = new ArrayList<>();
    static final int[] words = {640,480,32,60, 1280,720,16,60, 1024,768,0,60, 1200,800,24,60,
        800,600,-1,70, 1024,768,32,75, 1024,768,32,85, 1600,600,32,90, 100000,80000,24,60};
    static Frame frame;
    static int provider, mutate, id = 87000;
    static String state() { return il.I+","+od.c+","+rm.g+","+fk.g+","+sa.W+","+bh.z+","+tl.d+","+l.k; }
    static void event(String name) { log.add(name+"@"+state()); }
    public static od[] raw(int guard,ll link) {
        event("modes");
        od[] result = new od[provider == 0 ? 0 : words.length/4];
        for (int i=0;i<result.length;i++) {
            od m=result[i]=new od(); m.j=words[4*i]; m.l=words[4*i+1]; m.m=words[4*i+2]; m.k=words[4*i+3];
        }
        return result;
    }
    public static void window(boolean replace,int mode,int guard,int width,int height) {
        event("window="+mode+","+width+","+height); fh.Y = mode == 3 && provider == 1 ? frame : null;
    }
    public static na prefix(boolean guard) { event("prefix"); return cd.a("home",(byte)-120); }
    public static void open(na address,byte guard,boolean blank) {
        event("open="+new String(address.T,0,address.lb,java.nio.charset.StandardCharsets.ISO_8859_1)+","+blank);
    }
    public static void brightness(float v) {
        event("gamma="+Float.floatToRawIntBits(v));
        if (mutate==1) tf.w=!tf.w;
        if (mutate==3) throw new IndexOutOfBoundsException("gamma");
    }
    public static void material(int guard,int arg,int material) {
        event("material="+arg+","+material);
        if (mutate==1) tf.w=!tf.w;
        if (mutate==2) throw new IndexOutOfBoundsException("material");
    }
    public static void spriteCache(byte guard) { event("sprites"); }
    public static void write(ll link,byte guard) {
        event("write");
        if (mutate==5) throw new IndexOutOfBoundsException("write");
    }
    public static void mainState(int next,int guard) {
        event("state="+next);
        if (mutate==4) throw new IndexOutOfBoundsException("state");
        if (mutate==6) throw gj.a(new IndexOutOfBoundsException("state"),"state callback");
        tl.d=next;
    }
    public static void report(String text,Throwable e,byte guard) {
        String context="";
        if (e instanceof ld wrapper) {
            context=" "+wrapper.e;
            e=wrapper.f;
        }
        event("fault="+(e instanceof IndexOutOfBoundsException ? "bounds" : e.getClass().getSimpleName())+context);
    }

    static void patch(String jar,Path output) throws Exception {
        for (String owner:List.of("h","ab","lf")) try (JarFile pack=new JarFile(jar)) {
            ClassReader reader=new ClassReader(pack.getInputStream(pack.getJarEntry(owner+".class")));
            ClassWriter writer=new ClassWriter(reader,0);
            reader.accept(new ClassVisitor(Opcodes.ASM8,writer) {
                public MethodVisitor visitMethod(int flags,String name,String desc,String signature,String[] errors) {
                    MethodVisitor method=super.visitMethod(flags,name,desc,signature,errors);
                    if (!(owner.equals("h") && name.equals("a") && desc.equals("(BILjl;)V")
                        || owner.equals("ab") && name.equals("c") && desc.equals("(B)[Lod;")
                        || owner.equals("lf") && name.equals("a") && desc.equals("(I)V"))) return method;
                    return new MethodVisitor(Opcodes.ASM8,method) {
                        public void visitMethodInsn(int op,String o,String n,String d,boolean itf) {
                            String target=switch(o+"."+n+d) {
                                case "pm.a(ILll;)[Lod;" -> "raw";
                                case "th.a(ZIIII)V" -> "window";
                                case "be.a(Z)Lna;" -> "prefix";
                                case "nf.a(Lna;BZ)V" -> "open";
                                case "hf.a(F)V" -> "brightness";
                                case "cb.b(III)V" -> "material";
                                case "wa.e(B)V" -> "spriteCache";
                                case "qh.a(Lll;B)V" -> "write";
                                case "pl.a(II)V" -> "mainState";
                                case "ha.a(Ljava/lang/String;Ljava/lang/Throwable;B)V" -> "report";
                                default -> null;
                            };
                            if(target==null) super.visitMethodInsn(op,o,n,d,itf);
                            else super.visitMethodInsn(Opcodes.INVOKESTATIC,"HdDisplayScriptOracle",target,d,false);
                        }
                    };
                }
            },0);
            Files.write(output.resolve(owner+".class"),writer.toByteArray());
        }
    }

    public static void main(String[] args) throws Exception {
        if(args.length>0){patch(args[0],Path.of(args[1]));return;}
        frame=(Frame)HdTitleFrameOracle.headlessInstance(Frame.class);
        ll.n="linux"; d.Y=null; gj.b=0;
        BufferedReader in=new BufferedReader(new InputStreamReader(System.in));
        for(String line;(line=in.readLine())!=null;) {
            int[] v=Arrays.stream(line.split(",")).mapToInt(Integer::parseInt).toArray();
            int op=v[0],value=v[1]; tf.w=v[2]!=0; od.c=v[3]!=0; il.I=v[4]; tl.d=v[5];
            fh.Y=v[6]==1?frame:null; provider=v[7]; mutate=v[8]; rg.F=2; rm.g=false; fk.g=false; l.k=1;
            if(op>=6100 && op<6200){l.k=value;rm.g=value==1;fk.g=value==0;tf.y=value==1;}
            bh.z=true; sa.W=false; ib.i=null; j.v=value==1?1600:1024; bl.W=value==1?600:768;
            ArrayList<Integer> code=new ArrayList<>(), operands=new ArrayList<>();
            if(op==5300){code.add(0);operands.add(944);code.add(0);operands.add(712);}
            if(op==5421){code.add(3);operands.add(0);}
            boolean pushValue=v.length<10 || v[9]!=0;
            if((op==5303 || op==5421 || op>=6000 && op<6100) && pushValue){code.add(0);operands.add(value);}
            code.add(op);operands.add(0);
            if(op==5302){code.add(op);operands.add(0);}
            code.add(0);operands.add(7117);code.add(21);operands.add(0);
            qc script=new qc(); script.O=code.stream().mapToInt(i->i).toArray(); script.W=operands.stream().mapToInt(i->i).toArray();
            script.T=new na[code.size()]; if(op==5421)script.T[0]=cd.a("page",(byte)-120);
            ib.d.a(script,id,(byte)-87);jl hook=new jl();hook.E=new Object[]{id++};
            Arrays.fill(uj.t,-913); log.clear(); h.a((byte)-12,200,hook);
            String modes="-";
            if(ib.i!=null){StringJoiner s=new StringJoiner("/");for(od m:ib.i)s.add(m.j+"x"+m.l+":"+m.m+":"+m.k);modes=s.toString();}
            System.out.println(state()+"|"+(fh.Y!=null)+"|"+Arrays.toString(Arrays.copyOf(uj.t,4))+"|"+modes+"|"+String.join(";",log));
        }
    }
}
