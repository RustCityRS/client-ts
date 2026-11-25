import java.awt.Canvas;
import java.awt.Image;
import java.awt.image.BufferedImage;
import java.lang.invoke.MethodHandles;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.util.*;
import jdk.internal.org.objectweb.asm.*;
import jdk.internal.org.objectweb.asm.tree.*;

public class WorldMapReadOrderOracle {
    static String scenario;
    static final List<String> trace = new ArrayList<>();
    static final Map<String,Method> entries = new HashMap<>();

    public static void observe(String field) {
        trace.add(field);
        if (scenario.equals("zoom") && field.equals("zoom")) { c.C -= 7; sg.b += 5; }
        if (field.equals("labelZ")) od.P += 17;
        if (field.equals("labelX")) oi.a += 11;
    }
    public static void tiles(int right, int top, int mapRight, int bottom, int mapBottom, int left, int y, int x, byte guard) {
        trace.add("tiles:" + left + "," + top + "," + mapRight + "," + mapBottom);
    }
    public static void scaled(int a,int b,byte c,int d,int e,int f,int g,int h,int i) {}
    public static void labels(int a,int b,int c,int d,int e,int f,int g,byte h,int i) {}
    public static void debug(mb receiver,id text,int x,int y,int colour,int shadow) {
        Objects.requireNonNull(receiver);
        trace.add(text == null ? "debug:null" : "debug:text");
    }
    public static void label(eg receiver,id text,int x,int y,int colour,boolean shadow) {
        Objects.requireNonNull(receiver);
        trace.add("label:" + x + "," + y + "," + text.c);
    }

    // Copy only the original methods under inspection. Insert read watchpoints, and intercept the paint
    // boundaries so the actual coordinates and nullable text argument remain visible to the fixture.
    static void instrument(String owner,String desc,ClassWriter out) throws Exception {
        var source = new ClassNode();
        try (var stream = WorldMapReadOrderOracle.class.getResourceAsStream("/" + owner + ".class")) {
            new ClassReader(stream).accept(source, 0);
        }
        for (MethodNode method : source.methods) if (method.name.equals("a") && method.desc.equals(desc)) {
            for (var insn : method.instructions.toArray()) {
                String watch = null;
                if (insn instanceof FieldInsnNode f && (f.getOpcode()==Opcodes.GETSTATIC || f.getOpcode()==Opcodes.GETFIELD)) {
                    watch = switch (f.owner + "." + f.name) {
                        case "hd.h" -> owner.equals("ah") ? "zoom" : null;
                        case "kc.l" -> "labelZ"; case "kc.m" -> "labelX"; case "sa.A" -> "lines";
                        case "wd.f" -> "loading"; case "mi.F" -> "iconX"; case "mi.z" -> "iconZ";
                        default -> null;
                    };
                } else if (insn instanceof MethodInsnNode op) {
                    String target = op.owner + "." + op.name + op.desc;
                    if (target.equals("id.h(B)I")) watch = "length";
                    if (target.equals("lf.a(IZ)Lid;")) watch = "format";
                    String redirect = switch (target) {
                        case "jf.a(IIIIIIIIB)V" -> "tiles"; case "mj.a(IIBIIIIII)V" -> "scaled";
                        case "ik.a(IIIIIIIBI)V" -> "labels"; case "eg.b(Lid;IIIZ)V" -> "label";
                        case "mb.c(Lid;IIII)V" -> "debug"; default -> null;
                    };
                    if (redirect != null) {
                        String args = op.getOpcode() == Opcodes.INVOKESTATIC ? op.desc : "(L" + op.owner + ";" + op.desc.substring(1);
                        method.instructions.set(op, new MethodInsnNode(Opcodes.INVOKESTATIC,"WorldMapReadOrderOracle",redirect,args,false));
                    }
                }
                if (watch != null) {
                    var hook = new InsnList();
                    hook.add(new LdcInsnNode(watch));
                    hook.add(new MethodInsnNode(Opcodes.INVOKESTATIC,"WorldMapReadOrderOracle","observe","(Ljava/lang/String;)V",false));
                    method.instructions.insertBefore(insn,hook);
                }
            }
            method.name = owner; method.access = Opcodes.ACC_PUBLIC | Opcodes.ACC_STATIC;
            method.accept(out);
            return;
        }
        throw new AssertionError(owner + desc);
    }

    public static void main(String[] args) throws Exception {
        Class.forName("client");
        var out = new ClassWriter(ClassWriter.COMPUTE_MAXS);
        out.visit(Opcodes.V1_6,Opcodes.ACC_PUBLIC,"WorldMapReadSites",null,"java/lang/Object",null);
        instrument("ah","(IIIII)V",out); instrument("ik","(IIIIIIIBI)V",out); instrument("e","(IIIIIIIIIII)V",out);
        out.visitEnd();
        for (Method entry : MethodHandles.lookup().defineClass(out.toByteArray()).getDeclaredMethods()) entries.put(entry.getName(),entry);
        Canvas surface = new Canvas() {
            public Image createImage(int w,int h) { return new BufferedImage(w,h,BufferedImage.TYPE_INT_RGB); }
        };
        pe.S=surface;
        eg mapFont = new eg(11,true,surface);
        for (String arg : args) {
            scenario = arg.split(",")[0];
            int scale = Integer.parseInt(arg.split(",")[1]);
            trace.clear(); c.C=10; sg.b=20; sa.w=100; hd.h=3; hh.sb=0; jg.C=false; rk.h=null;
            uj.d=cl.w=vb.f=rc.g=0; td.a(new int[120*80],120,80);
            String status = "ok";
            try {
                switch (scenario) {
                    case "zoom","guard","load" -> {
                        jg.C=scenario.equals("guard"); wj.g=new fg(new byte[257]);
                        if (scenario.equals("load")) {sa.w=0; uf.b=null;}
                        entries.get("ah").invoke(null,3,scale,4,37,52);
                    }
                    case "label","split" -> {
                        jg.t=new kc(1); jg.t.l[0]=19; jg.t.m[0]=28; jg.t.f[0]=8; jg.t.b[0]=-1;
                        jg.t.j[0]=aj.a("AB<br>C",(byte)-77);
                        oi.a=10; od.P=20; ml.m=80; sa.A=new id[3]; lk.E=mapFont;
                        ma.b=scenario.equals("split")?null:new fg(new byte[257]);
                        entries.get("ik").invoke(null,0,0,0,120,80,80,120,(byte)-127,0);
                    }
                    case "sprite" -> {
                        ad.a=new gk(); mi icon=new mi(); icon.F=24; icon.z=37; icon.s=0;
                        ad.a.a(icon,false); oe.y=new rh[]{null}; qj.L=new int[0][][];
                        entries.get("e").invoke(null,65536,30079,0,0,0,0,0,0,0,65536,0);
                    }
                    default -> throw new AssertionError(scenario);
                }
            } catch (InvocationTargetException ex) {
                Throwable cause=ex.getCause();
                while (cause instanceof g wrapped) cause=wrapped.a;
                if (!(cause instanceof NullPointerException)) throw ex;
                status="null";
            }
            System.out.println(arg+"|"+status+"|"+String.join(";",trace)+"|"+uj.d+","+cl.w+","+rc.g+","+vb.f);
        }
    }
}
