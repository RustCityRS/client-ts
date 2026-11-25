import java.io.InputStream;
import java.lang.reflect.*;
import java.nio.file.*;
import java.util.*;
import java.util.jar.JarFile;
import jdk.internal.org.objectweb.asm.*;

// Keep gj.e / gd.c intact up to the first labels read after the file loop. Interpose at the two
// keyed fetches, after each operand's getstatic and before the JAR's original iaload / aaload.
public final class MapFetchOrderOracle implements Opcodes {
    private static boolean hd;
    private static String target, mode;
    private static final List<String> events = new ArrayList<>();
    private static Field locationGroups, npcGroups, keys, locationFiles, npcFiles;
    private static final class End extends Error {}
    public static void end() { throw new End(); }
    public static void keep(int first, int second) {}

    public static int[] group(int[] original, String site) throws IllegalAccessException {
        if (!site.equals(target)) return original;
        events.add("group");
        if (mode.equals("swap")) keys.set(null,new int[][]{{-71, 991}});
        if (mode.equals("nullGroup")) return null;
        if (mode.equals("shortGroup")) return new int[0];
        return original;
    }
    public static int[][] key(int[][] original, String site) throws IllegalAccessException {
        if (!site.equals(target)) return original;
        events.add("key");
        if (mode.equals("swap")) (target.equals("loc") ? locationGroups : npcGroups).set(null,new int[]{499});
        if (mode.equals("nullGroup")) return new int[0][];
        if (mode.equals("shortGroup")) return null;
        if (mode.equals("nullRow")) return new int[][]{null};
        return original;
    }
    private static byte[] fetch(Object archive, int file, int[] key, int group, String site) throws IllegalAccessException {
        Objects.requireNonNull(archive);
        events.add(site + "(" + file + "," + group + "," + Arrays.toString(key) + ")");
        if (site.equals(target)) {
            if (mode.equals("throw")) throw new IllegalStateException();
            if (mode.equals("missing")) return null;
            if (mode.equals("replace")) (site.equals("loc") ? locationFiles : npcFiles).set(null,new byte[1][]);
        }
        return new byte[]{(byte)group,(byte)(key == null ? 0 : key[0])};
    }
    public static byte[] fetchSd(Object archive, byte guard, int file, int[] key, int group, String site) throws IllegalAccessException {
        return fetch(archive,file,key,group,site);
    }
    public static byte[] fetchHd(Object archive, int group, int[] key, int guard, int file, String site) throws IllegalAccessException {
        return fetch(archive,file,key,group,site);
    }

    private static void instrument(Path jarPath, Path dir) throws Exception {
        String body = hd ? "gd" : "gj";
        try (JarFile jar = new JarFile(jarPath.toFile()); InputStream bytes = jar.getInputStream(jar.getJarEntry(body+".class"))) {
            ClassReader reader = new ClassReader(bytes);
            ClassWriter writer = new ClassWriter(reader,ClassWriter.COMPUTE_MAXS);
            reader.accept(new ClassVisitor(ASM8,writer) {
                public MethodVisitor visitMethod(int flags,String method,String descriptor,String signature,String[] exceptions) {
                    MethodVisitor base=super.visitMethod(flags,method,descriptor,signature,exceptions);
                    if (!method.equals(hd ? "c" : "e") || !descriptor.equals("(I)V")) return base;
                    return new MethodVisitor(ASM8,base) {
                        int locations, npcs, keyRows, fetches;
                        public void visitFieldInsn(int op,String owner,String name,String desc) {
                            String field=owner+"."+name+":"+desc;
                            if (op==GETSTATIC && field.equals(hd ? "tb.X:Lse;" : "ug.d:Lkc;"))
                                super.visitMethodInsn(INVOKESTATIC,"MapFetchOrderOracle","end","()V",false);
                            super.visitFieldInsn(op,owner,name,desc);
                            if (op!=GETSTATIC) return;
                            String site;
                            if (field.equals(hd ? "nj.j:[I" : "hh.qb:[I") && ++locations==2) site="loc";
                            else if (field.equals(hd ? "nm.P:[I" : "ae.c:[I") && ++npcs==3) site="npc";
                            else if (field.equals(hd ? "fl.D:[[I" : "jg.w:[[I") && ++keyRows<=2) site=keyRows==1 ? "loc" : "npc";
                            else return;
                            super.visitLdcInsn(site);
                            super.visitMethodInsn(INVOKESTATIC,"MapFetchOrderOracle",desc.equals("[I") ? "group" : "key","("+desc+"Ljava/lang/String;)"+desc,false);
                        }
                        public void visitMethodInsn(int op,String owner,String name,String desc,boolean itf) {
                            String member=owner+"."+name+desc;
                            if (member.equals(hd ? "ah.a(BZ)V" : "ph.a(ZI)V"))
                                super.visitMethodInsn(INVOKESTATIC,"MapFetchOrderOracle","keep","(II)V",false);
                            else if (member.equals(hd ? "ve.a(I[III)[B" : "al.a(BI[II)[B")) {
                                super.visitLdcInsn(++fetches==1 ? "loc" : "npc");
                                super.visitMethodInsn(INVOKESTATIC,"MapFetchOrderOracle",hd ? "fetchHd" : "fetchSd",
                                    "(Ljava/lang/Object;"+desc.substring(1,desc.indexOf(')'))+"Ljava/lang/String;)[B",false);
                            } else super.visitMethodInsn(op,owner,name,desc,itf);
                        }
                        public void visitEnd() {
                            if (locations<2 || npcs<3 || keyRows<2 || fetches!=2) throw new AssertionError("unexpected keyed fetch layout");
                            super.visitEnd();
                        }
                    };
                }
            },0);
            Files.write(dir.resolve(body+".class"),writer.toByteArray());
        }
    }
    private static Field field(String sd,String gl, Class<?> type) throws Exception {
        String[] parts=(hd ? gl : sd).split("\\.");
        for (Field field:Class.forName(parts[0]).getDeclaredFields()) if (field.getName().equals(parts[1]) && field.getType()==type) {
            field.setAccessible(true); return field;
        }
        throw new NoSuchFieldException(Arrays.toString(parts));
    }
    public static void main(String[] args) throws Exception {
        hd=args[1].equals("gl");
        if (args[0].equals("instrument")) {instrument(Path.of(args[2]),Path.of(args[3])); return;}
        Class<?> archive=Class.forName(hd ? "ve" : "al");
        Constructor<?> ctor=Arrays.stream(archive.getDeclaredConstructors()).filter(c->c.getParameterCount()==3 && c.getParameterTypes()[1]==boolean.class).findFirst().orElseThrow();
        ctor.setAccessible(true);
        field("re.d","ca.Z",archive).set(null,ctor.newInstance(null,false,false));
        locationGroups=field("hh.qb","nj.j",int[].class); npcGroups=field("ae.c","nm.P",int[].class);
        keys=field("jg.w","fl.D",int[][].class); locationFiles=field("lk.x","mf.O",byte[][].class); npcFiles=field("kg.o","pg.jb",byte[][].class);
        field("mk.G","we.H",byte[][].class).set(null,new byte[][]{{11}});
        field("fd.X","client.lb",int[].class).set(null,new int[]{-1});
        Field missing=field("ah.d","nm.U",int.class);
        if (hd) {
            field("","hk.bb",int[].class).set(null,new int[]{-1});
            field("","cl.V",int[].class).set(null,new int[]{-1});
        }
        Method body=Class.forName(hd ? "gd" : "gj").getDeclaredMethod(hd ? "c" : "e",int.class);
        body.setAccessible(true);
        for (boolean active: hd ? new boolean[]{false,true} : new boolean[]{false}) {
            if (hd) field("","tf.w",boolean.class).setBoolean(null,active);
            for (String site:List.of("loc","npc")) for (String probe:List.of("ok","swap","nullGroup","shortGroup","nullRow","throw","missing","replace")) {
                target=site; mode=probe; events.clear();
                byte[][] oldLoc=new byte[1][],oldNpc=new byte[1][];
                locationGroups.set(null,new int[]{201}); npcGroups.set(null,new int[]{301}); keys.set(null,new int[][]{{13,-53}});
                locationFiles.set(null,oldLoc); npcFiles.set(null,oldNpc); missing.setInt(null,77);
                String result;
                try {body.invoke(null,hd ? -117 : -30458); throw new AssertionError("no loop boundary");}
                catch(InvocationTargetException e) {
                    Throwable cause=e.getCause();
                    if (cause.getClass().getName().equals(hd ? "ld" : "g")) cause=(Throwable)field("g.a","ld.f",Throwable.class).get(cause);
                    result=cause instanceof End ? "ok" : cause.getClass().getSimpleName();
                }
                System.out.println(active+" "+site+" "+probe+"|"+String.join(";",events)+"|"+result+"|"+missing.getInt(null)+"|"
                    +Arrays.deepToString(oldLoc)+"/"+Arrays.deepToString((byte[][])locationFiles.get(null))+"|"
                    +Arrays.deepToString(oldNpc)+"/"+Arrays.deepToString((byte[][])npcFiles.get(null)));
            }
        }
    }
}
