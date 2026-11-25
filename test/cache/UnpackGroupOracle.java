import java.io.*;
import java.lang.reflect.*;
import java.nio.file.*;
import java.util.*;
import java.util.zip.CRC32;
import jdk.internal.org.objectweb.asm.*;

public class UnpackGroupOracle {
    static final byte[] indexData = {0,0,0,0,4,5,0,0,0};
    static Method unpack;
    static Field files, packed, reference;
    static al archive;
    static db index;
    static Object[][] oldRows, newRows;
    static Object[] oldPacked, newPacked;
    static byte[] container;
    static int[] ids;
    static int fault, rowReads, words, cursorHash, copies, copyHash;

    static void instrument(Path directory) throws Exception {
        try (var input = UnpackGroupOracle.class.getResourceAsStream("/al.class")) {
            var reader = new ClassReader(input);
            var writer = new ClassWriter(0);
            reader.accept(new ClassVisitor(Opcodes.ASM8, writer) {
                public MethodVisitor visitMethod(int access, String name, String desc, String sig, String[] exceptions) {
                    var method = super.visitMethod(access, name, desc, sig, exceptions);
                    if (!name.equals("a") || !desc.equals("([III)Z")) return method;
                    return new MethodVisitor(Opcodes.ASM8, method) {
                        public void visitFieldInsn(int op, String owner, String field, String type) {
                            super.visitFieldInsn(op, owner, field, type);
                            if (op == Opcodes.GETFIELD && owner.equals("al") && field.equals("O"))
                                super.visitMethodInsn(Opcodes.INVOKESTATIC, "UnpackGroupOracle", "rows", "(" + type + ")" + type, false);
                        }
                        public void visitMethodInsn(int op, String owner, String name, String type, boolean itf) {
                            if (owner.equals("gd") && name.equals("h") && type.equals("(B)I"))
                                super.visitMethodInsn(Opcodes.INVOKESTATIC,"UnpackGroupOracle","word","(Lgd;B)I",false);
                            else if (owner.equals("cc") && name.equals("a") && type.equals("([BI[BII)V"))
                                super.visitMethodInsn(Opcodes.INVOKESTATIC,"UnpackGroupOracle","copy",type,false);
                            else super.visitMethodInsn(op,owner,name,type,itf);
                        }
                    };
                }
            }, 0);
            Files.write(directory.resolve("al.class"), writer.toByteArray());
        }
    }

    static Field field(String name) throws Exception {
        var f = al.class.getDeclaredField(name);
        f.setAccessible(true);
        return f;
    }
    static Object[][] rows(Object[][] captured) throws Exception {
        if (++rowReads == 1 && fault == 1) files.set(archive, newRows);
        if (rowReads == 2 && fault == 2) files.set(archive, newRows);
        return captured;
    }
    static int word(gd p, byte guard) {
        words++;
        cursorHash = 31 * cursorHash + p.yb;
        try { return p.h(guard); }
        finally { cursorHash = 31 * cursorHash + p.yb; }
    }
    static void copy(byte[] src, int at, byte[] dest, int off, int len) {
        copies++;
        for (int value : new int[]{at, off, len, dest.length}) copyHash = 31 * copyHash + value;
        try { cc.a(src, at, dest, off, len); }
        finally { copyHash = 31 * copyHash + Arrays.hashCode(dest); }
    }
    static class Copier extends rb {
        void a(byte guard, byte[] value) {}
        byte[] b(byte guard) {
            try {
                if (fault == 3) files.set(archive, newRows);
                if (fault == 4) packed.set(archive, newPacked);
                if (fault == 5) index.g[0] = new int[0];
                if (fault == 6 && ids != null && ids.length > 0) ids[ids.length-1] = 40;
            } catch (IllegalAccessException ex) { throw new AssertionError(ex); }
            return container.clone();
        }
    }
    static String slot(Object value) {
        if (value == null) return "-";
        if (value instanceof Copier) return "p";
        if (value instanceof byte[] a) return "h"+Arrays.hashCode(a);
        if (value instanceof rb r) return "d"+Arrays.hashCode(r.b((byte)112));
        return Arrays.stream((Object[])value).map(UnpackGroupOracle::slot).toList().toString();
    }
    static int[] ints(String text) {
        return text.equals("-") ? null : text.equals("e") ? new int[0] : Arrays.stream(text.split(",")).mapToInt(Integer::parseInt).toArray();
    }
    static String run(String[] v) throws Exception {
        int count = Integer.parseInt(v[0]), capacity = Integer.parseInt(v[1]), row = Integer.parseInt(v[2]);
        int flags = Integer.parseInt(v[3]); fault = Integer.parseInt(v[4]); ids = ints(v[5]);
        int[] key = ints(v[6]);
        container = Base64.getDecoder().decode(v[7].equals("e") ? "" : v[7]);
        index.e = 1; index.l = new int[]{count}; index.j = new int[]{capacity};
        index.g = new int[][]{ids}; index.n = new int[]{75};
        oldRows = new Object[1][]; newRows = new Object[1][];
        if (row >= 0) {
            oldRows[0] = new Object[Math.max(capacity,0)];
            for(int i=0;i<oldRows[0].length;i++) if ((row & (1<<i))!=0) oldRows[0][i]=new byte[]{(byte)(95+i)};
        }
        archive = new al(null,(flags&1)!=0,(flags&2)!=0);
        oldPacked = new Object[]{(flags&4)!=0 ? new Copier() : container};
        if ((flags&8)!=0) oldPacked[0] = null;
        newPacked = new Object[]{new byte[]{4}};
        packed.set(archive,oldPacked); files.set(archive,oldRows); reference.set(archive,index);
        rowReads = 0; words = 0; cursorHash = 1; copies = 0; copyHash = 1;
        String result;
        try { result = String.valueOf(unpack.invoke(archive,key,114,0)); }
        catch (InvocationTargetException ex) {
            Throwable t = ex.getCause();
            String detail = "";
            if (t instanceof g wrapped && wrapped.q.contains("T3 - ")) {
                int start=wrapped.q.indexOf("T3 - ");
                detail = wrapped.q.substring(start).split(" ",3)[2].split(" ",2)[0];
            }
            while (t instanceof g wrapped) t = wrapped.a;
            if (t instanceof NullPointerException) result = "null";
            else if (t instanceof ArrayIndexOutOfBoundsException) result = "bounds";
            else if (t instanceof NegativeArraySizeException) result = "negative";
            else if (t instanceof RuntimeException) result = "runtime";
            else throw ex;
            result += detail;
        }
        return String.join("/",result,slot(oldRows),slot(newRows),slot(oldPacked),slot(newPacked),rowReads+":"+words+":"+cursorHash+":"+copies+":"+copyHash);
    }
    public static void main(String[] args) throws Exception {
        if(args.length>0){instrument(Path.of(args[0]));return;}
        files=field("O");packed=field("w");reference=field("x");
        unpack=al.class.getDeclaredMethod("a",int[].class,int.class,int.class);unpack.setAccessible(true);
        CRC32 crc=new CRC32();crc.update(indexData);index=new db(indexData,(int)crc.getValue());
        var input=new BufferedReader(new InputStreamReader(System.in));
        for(String line;(line=input.readLine())!=null;)System.out.println(run(line.split(" ")));
    }
}
