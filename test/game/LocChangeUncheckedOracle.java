import java.io.*;
import java.nio.file.*;
import java.util.*;
import java.util.jar.*;
import jdk.internal.org.objectweb.asm.*;

// Retain o.a and bc.a. Observe their two scene calls and the two config calls.
public class LocChangeUncheckedOracle {
    static int mode;
    static StringBuilder trace;
    static ke first = new ke(5, 5), second = new ke(5, 5);
    static jb type = new jb();
    static String map(ke m) { return m == null ? "n" : m == first ? "a" : "b"; }
    public static void remove(ke m, int x, byte guard, int height, int plane, int z, int layer) {
        trace.append("r,").append(map(m)).append(',').append(x).append(',').append(height).append(',').append(plane)
                .append(',').append(z).append(',').append(layer).append(',').append(lf.i).append('/');
        if (mode == 1) throw new IllegalStateException();
        if (mode == 2) hc.c = null;
        if (mode == 3) hc.c[plane] = second;
        if (mode == 4) lf.i = !lf.i;
    }
    public static void place(boolean water, int p, int id, int h, int angle, int shape, int x, int z, boolean build, ke m, int guard) {
        trace.append("p,").append(water).append(',').append(p).append(',').append(id).append(',').append(h).append(',')
            .append(angle).append(',').append(shape).append(',').append(x).append(',').append(z).append(',')
            .append(build).append(',').append(map(m)).append(',').append(lf.i).append('/');
        if (mode == 5) throw new IllegalStateException();
        if (mode == 6) lf.i = false;
    }
    public static jb lookup(int guard, int id) {
        trace.append("l,").append(id).append('/');
        if (mode == 1) throw new IllegalStateException();
        return mode == 2 ? null : type;
    }
    public static boolean ready(jb source, int guard, int shape) {
        Objects.requireNonNull(source);
        trace.append("m,").append(shape).append('/');
        if (mode == 5) throw new IllegalStateException();
        return (shape & 1) == 0;
    }
    static void instrument(String jar, Path dir) throws Exception {
        try (JarFile source = new JarFile(jar)) {
            for (String owner : new String[]{"o", "bc"}) {
                ClassReader reader = new ClassReader(source.getInputStream(source.getJarEntry(owner + ".class")));
                ClassWriter out = new ClassWriter(0);
                reader.accept(new ClassVisitor(Opcodes.ASM8,out) {
                    public MethodVisitor visitMethod(int f, String n, String d, String s, String[] ex) {
                        MethodVisitor mv = super.visitMethod(f,n,d,s,ex);
                        if (!n.equals("a") || !d.equals(owner.equals("o") ? "(IIIBIIII)V" : "(III)Z")) return mv;
                        return new MethodVisitor(Opcodes.ASM8,mv) {
                            public void visitMethodInsn(int op, String cl, String name, String desc, boolean iface) {
                                if (cl.equals("af") && desc.equals("(Lke;IBIIII)V")) super.visitMethodInsn(Opcodes.INVOKESTATIC,"LocChangeUncheckedOracle","remove",desc,false);
                                else if (cl.equals("nc") && desc.equals("(ZIIIIIIIZLke;I)V")) super.visitMethodInsn(Opcodes.INVOKESTATIC,"LocChangeUncheckedOracle","place",desc,false);
                                else if (cl.equals("ke") && desc.equals("(II)Ljb;")) super.visitMethodInsn(Opcodes.INVOKESTATIC,"LocChangeUncheckedOracle","lookup",desc,false);
                                else if (cl.equals("jb") && desc.equals("(II)Z")) super.visitMethodInsn(Opcodes.INVOKESTATIC,"LocChangeUncheckedOracle","ready","(Ljb;II)Z",false);
                                else super.visitMethodInsn(op,cl,name,desc,iface);
                            }
                        };
                    }
                },0);
                Files.write(dir.resolve(owner+".class"),out.toByteArray());
            }
        }
    }
    public static void main(String[] args) throws Exception {
        if (args.length != 0) { instrument(args[0],Path.of(args[1])); return; }
        byte[][][] flags = new byte[4][104][104];
        for (String line : new BufferedReader(new InputStreamReader(System.in)).lines().toList()) {
            int[] a = Arrays.stream(line.split(" ")).mapToInt(Integer::parseInt).toArray();
            int plane = a[1], x = a[2], z = a[3], shape = a[4], id = a[5], layer = a[6], angle = a[7], bits = a[8];
            mode = a[0]; rj.l = (bits&1) != 0; lf.i = (bits&2) != 0; sb.h = a[9];
            hc.c = mode == 7 ? null : new ke[]{first,first,first,first};
            tb.t = mode == 8 ? null : flags;
            if (x >= 0 && x < 104 && z >= 0 && z < 104) {
                for (int p=0;p<4;p++) flags[p][x][z] = 0;
                if (plane >= 0 && plane < 4 && (bits&4) != 0) flags[plane][x][z] |= 8;
                if ((bits&8) != 0) flags[0][x][z] |= 2;
                if ((bits&16) != 0) flags[1][x][z] |= 2;
            }
            String status = "ok"; trace = new StringBuilder();
            try {
                if (a[10] == 0) o.a(shape,plane,id,(byte)-26,layer,x,angle,z);
                else status = Boolean.toString(bc.a(id,67,shape));
            } catch (RuntimeException err) {
                Throwable cause=err;
                while (cause instanceof g) cause=((g)cause).a;
                if(cause instanceof NullPointerException) status="null";
                else if(cause instanceof ArrayIndexOutOfBoundsException) status="bounds";
                else if(cause instanceof IllegalStateException) status="stop";
                else throw err;
            }
            System.out.println(status+":"+lf.i+":"+trace);
        }
    }
}
