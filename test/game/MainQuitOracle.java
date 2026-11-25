import java.awt.Canvas;
import java.awt.event.*;
import java.io.*;
import java.nio.file.*;
import java.util.*;
import java.util.jar.JarFile;
import jdk.internal.org.objectweb.asm.*;
import sun.misc.Unsafe;

public class MainQuitOracle {
    static final Map<Object,String> names = new IdentityHashMap<>();
    static final Set<String> watched = Set.of("ej.p","ek.s","pe.S","lj.k","m.S","ld.k","wk.d","ud.a","ik.O","f.g","q.c","ei.q");
    static final Map<String,String> calls = Map.of("se.a(B)V","stream","dg.d(I)V","pcm","ej.b(Z)V","net","ca.a(Z)V","disk","sa.b(I)V","file");
    static final StringBuilder trace = new StringBuilder();
    static final Unsafe unsafe;
    static {
        try {
            var f=Unsafe.class.getDeclaredField("theUnsafe"); f.setAccessible(true); unsafe=(Unsafe)f.get(null);
        } catch (ReflectiveOperationException e) { throw new AssertionError(e); }
    }
    static int at, action, steps;
    static String key;
    static g injected;
    static List<Object> original = new ArrayList<>(), alternate = new ArrayList<>();
    static final String[] keys={"ej.p","ek.s","pe.S","lj.k","m.S","ld.k","wk.d","ud.a","ik.O","f.g","q.c","ei.q"};
    static String id(Object o) {return o==null?"-":names.get(o);}
    static <T> T tag(T o,String id) {names.put(o,id);return o;}
    static java.lang.reflect.Field field(String k) throws ReflectiveOperationException {
        String[] pair=k.split("\\."); return Class.forName(pair[0]).getDeclaredField(pair[1]);
    }
    static void assign(String k,Object v) {
        try {field(k).set(null,v);}catch(ReflectiveOperationException e){throw new AssertionError(e);}
    }
    static Object blank(Class<?> c,String label) throws InstantiationException {return tag(unsafe.allocateInstance(c),label);}
    static void event(String name) {
        trace.append(name).append(';');
        if (++steps!=at) return;
        switch(action) {
            case 1 -> throw new IllegalStateException("event");
            case 2 -> assign(key,null);
            case 3 -> assign(key,alternate.get(Arrays.asList(keys).indexOf(key)));
            case 4 -> assign("f.g",tag(new sa[0],"empty"));
            case 5, 8 -> MainQuitOracle.<RuntimeException>raise(new IOException("file"));
            case 6 -> throw new AssertionError("event");
            case 7 -> throw injected;
        }
    }
    @SuppressWarnings("unchecked") static <T extends Throwable> void raise(Throwable t) throws T {throw (T)t;}
    public static void fieldRead(String key) {event("r"+key);}
    public static void fieldWrite(String key) {event("w"+key);}
    public static void stream(Object self,int guard) {Objects.requireNonNull(self);event("stream:"+id(self));}
    public static void pcm(Object self,int guard) {Objects.requireNonNull(self);event("pcm:"+id(self));}
    public static void file(Object self,int guard) {Objects.requireNonNull(self);event("file:"+id(self));}
    public static void net(Object self,boolean guard) {Objects.requireNonNull(self);event("net:"+id(self));}
    public static void disk(Object self,boolean guard) {Objects.requireNonNull(self);event("disk:"+id(self));}
    static class Surface extends Canvas {
        String label;
        Surface(String label) {this.label=label;}
        public void removeKeyListener(KeyListener l) {event(label+":key");}
        public void removeMouseListener(MouseListener l) {event(label+":mouse");}
        public void removeFocusListener(FocusListener l) {event(label+":focus"+(l instanceof vb?"K":"M"));}
        public void removeMouseMotionListener(MouseMotionListener l) {event(label+":motion");}
        public void removeMouseWheelListener(MouseWheelListener l) {event(label+":wheel:"+id(l));}
    }
    static void instrument(String jar,String dir) throws IOException {
        try(var jf=new JarFile(jar)) {
            var r=new ClassReader(jf.getInputStream(jf.getJarEntry("client.class")));
            var w=new ClassWriter(ClassWriter.COMPUTE_MAXS);
            r.accept(new ClassVisitor(Opcodes.ASM8,w) {
                public MethodVisitor visitMethod(int access,String n,String d,String s,String[] e) {
                    var m=super.visitMethod(access,n,d,s,e);
                    if (!n.equals("c")||!d.equals("(I)V")) return m;
                    return new MethodVisitor(Opcodes.ASM8,m) {
                        void hook(String method,String k) {
                            super.visitLdcInsn(k);super.visitMethodInsn(Opcodes.INVOKESTATIC,"MainQuitOracle",method,"(Ljava/lang/String;)V",false);
                        }
                        public void visitFieldInsn(int op,String owner,String n,String d) {
                            String k=owner+"."+n;
                            if(op==Opcodes.GETSTATIC && watched.contains(k)) hook("fieldRead",k);
                            super.visitFieldInsn(op,owner,n,d);
                            if(op==Opcodes.PUTSTATIC && watched.contains(k)) hook("fieldWrite",k);
                        }
                        public void visitMethodInsn(int op,String owner,String name,String desc,boolean iface) {
                            String target=calls.get(owner+"."+name+desc);
                            if(target!=null) {
                                String sig=desc.contains("Z")?"(Ljava/lang/Object;Z)V":"(Ljava/lang/Object;I)V";
                                super.visitMethodInsn(Opcodes.INVOKESTATIC,"MainQuitOracle",target,sig,false);
                            }else super.visitMethodInsn(op,owner,name,desc,iface);
                        }
                    };
                }
            },0);
            Files.write(Path.of(dir,"client.class"),w.toByteArray());
        }
    }
    static void init() throws Exception {
        for (String k:keys) for(int variant=0;variant<2;variant++) {
            Object obj;
            String label=k+variant;
            if(k.equals("pe.S")) obj=tag(new Surface(label),label);
            else if(k.equals("lj.k")) obj=blank(ih.class,label);
            else if(k.equals("f.g")) {
                sa a=(sa)blank(sa.class,"F"+variant+"a"),b=(sa)blank(sa.class,"F"+variant+"b");
                obj=tag(variant==0?new sa[]{a,null,b}:new sa[]{null,b},label);
            }else obj=blank(field(k).getType(),label);
            (variant==0?original:alternate).add(obj);
        }
    }
    static String outcome(Throwable e) {
        if(e instanceof g w) return w.q+"/"+outcome(w.a);
        if(e instanceof NullPointerException) return "null";
        if(e instanceof ArrayIndexOutOfBoundsException) return "bounds";
        if(e instanceof IOException) return "io";
        if(e instanceof AssertionError) return "error";
        if(e instanceof IllegalStateException) return "fault";
        return e.getClass().getName();
    }
    public static void main(String[] args) throws Exception {
        if(args.length==2){instrument(args[0],args[1]);return;}
        init();
        for (var objects: List.of(original,alternate)) {
            var work = objects.get(Arrays.asList(keys).indexOf("ud.a"));
            var list=ca.class.getDeclaredField("o");list.setAccessible(true);list.set(work,new tb());
            var thread=ca.class.getDeclaredField("q");thread.setAccessible(true);thread.set(work,new Thread());
        }
        var app=(client)unsafe.allocateInstance(client.class);
        var in=new BufferedReader(new InputStreamReader(System.in));
        for(String line;(line=in.readLine())!=null;) {
            String[] v=line.split(" ");
            int mask=Integer.parseInt(v[0]); at=Integer.parseInt(v[1]);action=Integer.parseInt(v[2]);key=v[3];
            for(int i=0;i<keys.length;i++) assign(keys[i],(mask&(1<<i))!=0?null:original.get(i));
            ((ag)original.get(0)).h=true; ((ag)alternate.get(0)).h=true;
            if(key.equals("full") && ud.a!=null) {
                var thread=ca.class.getDeclaredField("q");thread.setAccessible(true);thread.set(ud.a,new Thread());
            }
            li.t=(vb)unsafe.allocateInstance(vb.class);ai.g=(uk)unsafe.allocateInstance(uk.class);
            fi.k=77;mg.S=71; steps=0;trace.setLength(0);
            injected=od.a(new IllegalStateException("event"),"origin");
            String result="ok";
            try {
                if(key.equals("keyboard")) ea.a(63,pe.S);
                else if(key.equals("mouse")) ke.a(pe.S,-7);
                else app.c(0);
            }catch(Throwable t){result=outcome(t)+(action==7&&at!=0&&at<=steps?"/"+(t==injected):"");}
            var fields=new StringJoiner(",");
            for(String k:keys)fields.add(id(field(k).get(null)));
            System.out.println(result+"|"+trace+"|"+fields+"|"+((ag)original.get(0)).h+","+((ag)alternate.get(0)).h+","+
                (li.t!=null)+","+(ai.g!=null)+","+fi.k+","+mg.S);
        }
    }
}
