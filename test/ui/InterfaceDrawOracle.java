import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Arrays;
import java.util.jar.JarFile;
import jdk.internal.org.objectweb.asm.*;

public class InterfaceDrawOracle {
    static final int GROUP = 596;
    static ChatOracle.Source available, unavailable;
    static final aj[] root = {new aj(), null}, drag = {null, new aj()}, previous = {}, replacement = {new aj()};
    static final aj oldParent = new aj(), newParent = new aj();
    static boolean[] originalDirty, otherDirty;
    static int action, dirtyTrap, draws, reads, readFault;
    static StringBuilder trace;
    static Throwable injected;

    static String components(aj[] array) {
        if (array == null) return "~";
        if (array == root) return "root";
        if (array == drag) return "drag";
        if (array == previous) return "empty";
        if (array == replacement) return "replacement";
        int hash = 1;
        for (aj c : array) hash = 31 * hash + (c == null ? -1 : c.Kc);
        return "loaded:" + array.length + ":" + hash;
    }
    static String dirty(boolean[] flags) {
        if (flags == null) return "~";
        StringBuilder result = new StringBuilder();
        for (boolean bit : flags) result.append(bit ? '1' : '0');
        return result.toString();
    }
    static String dirtyId(boolean[] flags) {
        return flags == null ? "~" : flags == originalDirty ? "a" : flags == otherDirty ? "b" : "?";
    }
    public static boolean open(int group, boolean allocateOnly) {
        trace.append("o,").append(group).append(',').append(allocateOnly).append(',').append(components(jg.q)).append(';');
        if (action == 10) {jg.q = replacement; throw new IllegalStateException();}
        boolean result = qg.a(group, allocateOnly);
        if (action == 11) {
            if (fk.ab != null && group >= 0 && group < fk.ab.length) fk.ab[group] = replacement;
            sf.m = otherDirty;
        }
        if (action == 12) jg.q = drag;
        return result;
    }
    public static void read(String field) {
        trace.append("r,").append(field).append(';');
        if (++reads == readFault) throw new UnsupportedOperationException();
        if (field.equals("layer") && draws == 1) {
            if (action == 14) jg.q = replacement;
            if (action == 15) jg.q = null;
        }
        if (action == 16 && field.equals("height")) hi.f = -571;
    }
    public static int rootIndex(aj parent) {
        int index = parent.vb;
        read("index");
        return index;
    }
    // Keep BASTORE's bounds/null check and successful write ahead of any observer action.
    public static void store(boolean[] array, int index, int value) {
        array[index] = value != 0;
        trace.append("s,").append(dirtyId(array)).append(',').append(index).append(',').append(value).append(';');
        if (index != 3) return;
        if (dirtyTrap == 1 || dirtyTrap == 2) sf.m = otherDirty;
        if (dirtyTrap == 3) sf.m = null;
        if (dirtyTrap == 4) throw new IllegalStateException();
    }
    public static void layer(int y, aj[] list, int parent, int bottom, int top, int rootId, int right, int x, boolean guard, int left) throws java.io.IOException {
        draws++;
        trace.append("d,").append(y).append(',').append(components(list)).append(',').append(parent).append(',').append(bottom)
            .append(',').append(top).append(',').append(rootId).append(',').append(right).append(',').append(x).append(',')
            .append(guard).append(',').append(left).append(',').append(components(jg.q)).append(';');
        if(action>=17&&draws==1){jg.q=drag;if(action>=20)return;}
        if(action>=17&&action<=22){
            switch((action-17)%3){
                case 0->{var ex=od.a(new IllegalStateException(),"leaf");injected=ex;throw ex;}
                case 1->{var ex=new AssertionError();injected=ex;throw ex;}
                case 2->{var ex=new java.io.IOException();injected=ex;throw ex;}
            }
        }
        if (draws == 1) {
            switch (action) {
                case 1, 4, 7, 14, 15, 16 -> jg.q = drag;
                case 2, 8 -> jg.q = list;
                case 3 -> {jg.q = drag; throw new IllegalStateException();}
                case 5 -> {jg.q = drag; vf.Y = null;}
                case 6 -> {
                    jg.q = replacement; vf.Y = newParent; vf.Y.vb = Integer.MIN_VALUE;
                    ma.n = Integer.MAX_VALUE; gf.db = -31; hi.f = -5; fl.l = 9876; hd.m = -3;
                }
                case 9 -> {jg.q = previous; vf.Y = newParent;}
                case 13 -> {jg.q = null; vf.Y = null;}
            }
        } else {
            if (action == 2 || action == 7) {jg.q = replacement; vf.Y = newParent;}
            if (action == 4 || action == 7) throw new IllegalStateException();
        }
    }
    static void prepare(Path jar, Path dir) throws Exception {
        try (JarFile file = new JarFile(jar.toFile())) {
            for (String owner : new String[]{"ed","b"}) {
                ClassReader original = new ClassReader(file.getInputStream(file.getJarEntry(owner+".class")));
                ClassWriter out = new ClassWriter(ClassWriter.COMPUTE_MAXS);
                original.accept(new ClassVisitor(Opcodes.ASM8, out) {
                    @Override public MethodVisitor visitMethod(int access,String name,String desc,String signature,String[] exceptions) {
                        MethodVisitor target = super.visitMethod(access,name,desc,signature,exceptions);
                        if (!(owner.equals("ed") && name.equals("a") && desc.equals("(IIIIIIIII)V")
                            || owner.equals("b") && name.equals("c") && desc.equals("(I)V"))) return target;
                        return new MethodVisitor(Opcodes.ASM8,target) {
                            @Override public void visitMethodInsn(int op,String owner,String name,String desc,boolean iface) {
                                if (owner.equals("lf") && name.equals("a") && desc.equals("(I[Laj;IIIIIIZI)V"))
                                    super.visitMethodInsn(op,"InterfaceDrawOracle","layer",desc,false);
                                else if (owner.equals("qg") && name.equals("a") && desc.equals("(IZ)Z"))
                                    super.visitMethodInsn(op,"InterfaceDrawOracle","open",desc,false);
                                else super.visitMethodInsn(op,owner,name,desc,iface);
                            }
                            @Override public void visitInsn(int op) {
                                if (op == Opcodes.BASTORE) super.visitMethodInsn(Opcodes.INVOKESTATIC,"InterfaceDrawOracle","store","([ZII)V",false);
                                else super.visitInsn(op);
                            }
                            @Override public void visitFieldInsn(int op,String owner,String name,String desc) {
                                if (op == Opcodes.GETFIELD && owner.equals("aj") && name.equals("vb")) {
                                    super.visitMethodInsn(Opcodes.INVOKESTATIC,"InterfaceDrawOracle","rootIndex","(Laj;)I",false);
                                    return;
                                }
                                super.visitFieldInsn(op,owner,name,desc);
                                if (op != Opcodes.GETSTATIC) return;
                                String label = switch (owner+"."+name) {
                                    case "sf.m" -> "dirty"; case "fk.ab" -> "groups"; case "ma.n" -> "y";
                                    case "jg.q" -> "layer"; case "fl.l" -> "height"; case "vf.Y" -> "parent";
                                    case "hi.f" -> "width"; case "gf.db" -> "x"; case "hd.m" -> "top";
                                    default -> null;
                                };
                                if (label == null) return;
                                super.visitLdcInsn(label);
                                super.visitMethodInsn(Opcodes.INVOKESTATIC,"InterfaceDrawOracle","read","(Ljava/lang/String;)V",false);
                            }
                        };
                    }
                },0);
                Files.write(dir.resolve(owner+".class"),out.toByteArray());
            }
        }
    }
    static void run(int[] args) {
        int entry = args[0], mode = args[1], length = args[2], rootId = args[3], size = args[6];
        action = args[4]; dirtyTrap = args[5]; draws = reads = 0; readFault = args.length==8?args[7]:0;trace = new StringBuilder();
        originalDirty = length == -1 ? null : new boolean[length];
        if (originalDirty != null) for (int i=2;i<length;i+=7) originalDirty[i]=true;
        sf.m = originalDirty; otherDirty = new boolean[dirtyTrap == 2 ? 9 : 107];
        fk.ab = new aj[GROUP+1][]; fk.ab[GROUP] = root;
        rg.b = new boolean[GROUP+1]; rg.b[GROUP] = true;
        kh.A = null; hd.m = GROUP;
        hi.f = size; fl.l = ~size; gf.db = 33; ma.n = -19;
        oldParent.vb = 14; newParent.vb = -129; vf.Y = oldParent; jg.q = previous;
        switch (mode) {
            case 1 -> fk.ab[GROUP] = previous;
            case 2 -> fk.ab[GROUP] = null;
            case 3, 4, 11 -> {
                rg.b[GROUP] = false;
                kh.A = new al(mode==3?unavailable:available,false,true);
                fk.ab[GROUP] = mode==11?replacement:null;
            }
            case 5 -> rg.b = null;
            case 6 -> rg.b = new boolean[GROUP];
            case 7 -> fk.ab = null;
            case 8 -> fk.ab = new aj[GROUP][];
            case 9 -> rg.b[GROUP] = false;
            case 12 -> hd.m = -1;
            case 13 -> hd.m = Integer.MAX_VALUE;
            case 14 -> vf.Y = null;
        }
        String fault = "ok";injected=null;
        try {
            if (entry == 0) ed.a(~size,-16,23,size,-33,rootId,57,hd.m,22562);
            else if(entry==1)b.c(1);
            else open(hd.m,rootId!=0);
        } catch (Throwable ex) {
            Throwable error = ex;
            while (error instanceof g wrapped) error = wrapped.a;
            fault = error instanceof AssertionError?"fatal":error instanceof java.io.IOException?"checked":error instanceof NullPointerException ? "null" : error instanceof ArrayIndexOutOfBoundsException ? "bounds" :
                error instanceof IllegalStateException ? "callback" : error instanceof UnsupportedOperationException ? "read" : error.getClass().getName();
            if(ex instanceof g wrapped)fault+="@"+wrapped.q;
            if(injected!=null)fault+="#"+(ex==injected);
        }
        System.out.println(String.join("|",fault,trace.toString(),dirty(originalDirty),dirty(otherDirty),dirtyId(sf.m),
            components(jg.q),vf.Y==null?"~":(vf.Y==oldParent?"a":"b")+vf.Y.vb,ma.n+","+gf.db,fl.l+","+hi.f,""+hd.m,
            fk.ab==null||fk.ab.length<=GROUP?"!":components(fk.ab[GROUP]),rg.b==null||rg.b.length<=GROUP?"!":String.valueOf(rg.b[GROUP])));
    }
    public static void main(String[] args) throws Exception {
        if(args.length!=0){prepare(Path.of(args[0]),Path.of(args[1]));return;}
        BufferedReader in = new BufferedReader(new InputStreamReader(System.in));
        String header=in.readLine(),content=in.readLine();
        available=new ChatOracle.Source(header+" "+GROUP+":"+content);
        unavailable=new ChatOracle.Source(header);
        for (String input : in.lines().toList()) run(Arrays.stream(input.split(" ")).mapToInt(Integer::parseInt).toArray());
    }
}
