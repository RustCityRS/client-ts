import java.nio.file.*;
import java.util.*;
import java.util.jar.JarFile;
import jdk.internal.org.objectweb.asm.*;
import jdk.internal.org.objectweb.asm.tree.*;

public class SceneCutoverOracle {
    static final String SELF = "SceneCutoverOracle";
    static final class End extends Error {}
    static final List<String> events = new ArrayList<>();
    static boolean nativeScene, geometry, retry;
    static int tiles, tileHash, action;

    static ClassNode read(JarFile jar, String name) throws Exception {
        ClassNode type = new ClassNode();
        new ClassReader(jar.getInputStream(jar.getJarEntry(name+".class"))).accept(type, 0);
        return type;
    }
    static MethodNode method(ClassNode type, String name, String desc) {
        return type.methods.stream().filter(m -> m.name.equals(name) && m.desc.equals(desc)).findFirst().orElseThrow();
    }
    static void save(ClassNode type, Path directory) throws Exception {
        ClassWriter writer = new ClassWriter(ClassWriter.COMPUTE_MAXS);
        type.accept(writer);
        Files.write(directory.resolve(type.name+".class"), writer.toByteArray());
    }
    static void redirect(MethodInsnNode call, String name) { call.owner=SELF; call.name=name; }
    static void instrument(Path jarFile, Path output) throws Exception {
        try (JarFile jar = new JarFile(jarFile.toFile())) {
            ClassNode map = read(jar,"gj");
            MethodNode rebuild = method(map,"e","(I)V");
            LabelNode afterGeometry = new LabelNode();
            for (AbstractInsnNode n : rebuild.instructions.toArray()) {
                if (n instanceof IntInsnNode push && push.operand == 8428) rebuild.instructions.insertBefore(n,afterGeometry);
                if (!(n instanceof MethodInsnNode call)) continue;
                switch (call.owner+"."+call.name+call.desc) {
                    case "ph.a(ZI)V" -> redirect(call,"keep");
                    case "uj.a(I)V" -> redirect(call,"audio");
                    case "bf.c(I)V" -> redirect(call,"reset");
                    case "mc.a(IIIIZ)V" -> {
                        redirect(call,"initialise");
                        rebuild.instructions.insert(call,new JumpInsnNode(Opcodes.GOTO,afterGeometry));
                    }
                    case "lk.c(I)V" -> redirect(call,"quit");
                    case "ng.b(III)V" -> redirect(call,"tile");
                    case "ia.c(I)V" -> redirect(call,"roofs");
                    case "l.b(Z)V" -> redirect(call,"locs");
                }
            }
            save(map,output);
            ClassNode minimap = read(jar,"hi");
            for (AbstractInsnNode n : method(minimap,"b","(I)V").instructions.toArray()) {
                if (!(n instanceof MethodInsnNode call)) continue;
                switch (call.owner+"."+call.name+call.desc) {
                    case "ph.a(IZ)Z" -> redirect(call,"buffer");
                    case "ia.c(I)V" -> redirect(call,"roofs");
                }
            }
            save(minimap,output);

            // Execute the original t.c block from the preference-sent load to the queued location updates.
            // All branches inside those bounds, including the early game-state return, stay intact.
            ClassNode tick = read(jar,"t");
            MethodNode original = method(tick,"c","(I)V");
            AbstractInsnNode start=null, end=null;
            for (AbstractInsnNode n : original.instructions.toArray()) {
                if (n instanceof FieldInsnNode f && f.getOpcode()==Opcodes.GETSTATIC && f.owner.equals("qc") && f.name.equals("W")) start=n;
                if (n instanceof MethodInsnNode m && m.owner.equals("od") && m.name.equals("e") && m.desc.equals("(B)V")) {
                    end=m; redirect(m,"queue"); break;
                }
            }
            Objects.requireNonNull(start); Objects.requireNonNull(end);
            ClassWriter block = new ClassWriter(ClassWriter.COMPUTE_MAXS);
            block.visit(Opcodes.V1_5,Opcodes.ACC_PUBLIC,"SceneCutoverTick",null,"java/lang/Object",null);
            MethodVisitor run = block.visitMethod(Opcodes.ACC_PUBLIC|Opcodes.ACC_STATIC,"run","()V",null,null);
            run.visitCode();
            for(AbstractInsnNode n=start;n!=null;n=n.getNext()) {
                if(!(n instanceof LineNumberNode) && !(n instanceof FrameNode)) n.accept(run);
                if(n==end) break;
            }
            run.visitInsn(Opcodes.RETURN); run.visitMaxs(0,0); run.visitEnd(); block.visitEnd();
            Files.write(output.resolve("SceneCutoverTick.class"),block.toByteArray());
        }
    }
    public static void keep(boolean force,int guard) {events.add("keep"+force);}
    public static void audio(int guard) {
        if (geometry || nativeScene) events.add("audio"+guard);
    }
    public static void reset(int guard) {
        if (geometry || nativeScene) events.add("reset"+guard);
        if (geometry) throw new End();
    }
    public static void initialise(int levels,int x,int z,int radius,boolean underwater) {
        if(nativeScene) {
            events.add("init"+levels+","+x+","+z+","+radius+","+underwater);
            mc.a(levels,x,z,radius,underwater);
        }
        geometry=true;
        events.add("viewport"+(kl.Bb==null ? -1 : kl.Bb.length));
        if(retry) throw new End();
    }
    public static void quit(int guard) {events.add("quit"+guard);}
    public static void tile(int guard,int z,int x) {tiles++;tileHash=31*(31*tileHash+x)+z;}
    public static void roofs(int guard) {
        if(nativeScene) { events.add("roof"+guard+":"+gk.j+":"+tiles); ia.c(guard); }
    }
    public static void locs(boolean guard) {events.add("locs"+guard);}
    public static boolean buffer(int level,boolean guard) {
        if(!guard) throw new AssertionError();
        events.add((nativeScene?"buffer":"legacy")+level);
        if(action==2) ah.f=3;
        if(action==3) tf.C=25;
        if(!nativeScene && action!=0) gk.j=level;
        return nativeScene && action!=0;
    }
    public static void queue(byte guard) {events.add("queue"+guard);}

    public static void main(String[] args) throws Exception {
        if(args.length==2) {instrument(Path.of(args[0]),Path.of(args[1]));return;}
        var tick=Class.forName("SceneCutoverTick").getMethod("run");
        for(boolean enabled : new boolean[]{false,true}) {
            nativeScene=enabled;
            mk.G=lk.x=new byte[0][]; ug.d=new kc(0); bc.e=0; tf.C=25; kf.n=true; gk.j=-1;
            kl.Bb=na.G=null; ve.q=lf.g=null; ac.k=new byte[1][1][1]; sf.j=new int[3];
            for(boolean pending : new boolean[]{true,false}) {
                geometry=false; retry=pending; tiles=0; tileHash=1; events.clear(); Object old=kl.Bb;
                try {gj.e(-30458);} catch(End done) {}
                System.out.println(String.join(";",events)+"/"+tiles+"/"+tileHash+"/"+(kl.Bb!=old)+"/"+
                    (kl.Bb==na.G)+"/"+(ve.q==lf.g)+"/"+(ve.q==null?-1:ve.q[0][0].length)+"/"+(ac.k==null)+"/"+sf.j.length);
            }
            qc.W=true; rj.l=true; gk.j=-1; ah.f=2; tiles=0;
            for(int step : new int[]{0,0,1,1,2,3}) {
                if(step>=2) ah.f=step-2;
                tf.C=30; action=step; events.clear(); ac.k=new byte[1][1][1]; sf.j=new int[3];
                tick.invoke(null);
                System.out.println(String.join(";",events)+"/"+tf.C+"/"+ah.f+"/"+gk.j+"/"+(ac.k==null)+"/"+sf.j.length);
            }
        }
    }
}
