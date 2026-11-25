import java.io.InputStream;
import java.lang.reflect.InvocationTargetException;
import java.net.*;
import java.nio.file.Path;
import java.util.*;
import java.util.jar.JarFile;
import jdk.internal.org.objectweb.asm.*;
import sun.misc.Unsafe;

public class ReleaseStaticsOracle implements Opcodes {
    static final Set<String> methods = new LinkedHashSet<>();
    static final List<String> trace = new ArrayList<>();
    static boolean active;
    static String stop;
    static boolean runtime;
    static String expectedCallee="";
    static boolean directProbe;
    static final Set<String> observedFields = new HashSet<>();
    static class Stop extends Error {}
    static void observe(String event) {
        if (!active) return;
        trace.add(event);
        if (event.equals(stop)) {
            if (runtime) throw new IllegalStateException("observed");
            throw new Stop();
        }
    }
    public static void call(String name) { observe("call "+name); }
    public static void store(String name, Object value) {
        observe((value==null?"null ":"set ")+name);
    }
    public static void primitive(String name,int value) {
        observe("primitive "+name+" "+value);
    }
    public static void invoke(String name) {
        if (expectedCallee.equals(name)) observe("invoke "+name);
    }
    public static void nestedStore(String name,Object value) {
        if (directProbe && observedFields.contains(name)) store(name,value);
    }
    public static void nestedPrimitive(String name,int value) {
        if (directProbe && observedFields.contains(name)) primitive(name,value);
    }
    public static void main(String[] args) throws Exception {
        Path jarPath = Path.of(args[0]);
        stop = args.length > 1 ? args[1] : "";
        runtime = args.length > 2 && args[2].equals("runtime");
        boolean hd = args.length > 3 && args[3].equals("hd");
        boolean observeNested=hd && stop.equals("helpers");
        try (JarFile jar = new JarFile(jarPath.toFile())) {
            ClassReader client = new ClassReader(jar.getInputStream(jar.getEntry("client.class")));
            client.accept(new ClassVisitor(ASM8) {
                public MethodVisitor visitMethod(int access,String name,String desc,String sig,String[] exceptions) {
                    if (!name.equals(hd ? "c" : "a") || !desc.equals(hd ? "(I)V" : "(Z)V")) return null;
                    return new MethodVisitor(ASM8) {
                        public void visitMethodInsn(int op,String owner,String name,String desc,boolean itf) {
                            if (op==INVOKESTATIC && desc.endsWith(")V")) methods.add(owner+"."+name+desc);
                        }
                    };
                }
            },0);
            try (URLClassLoader loader = new URLClassLoader(new URL[]{jarPath.toUri().toURL()},ReleaseStaticsOracle.class.getClassLoader()) {
                protected Class<?> findClass(String name) throws ClassNotFoundException {
                    var entry = jar.getJarEntry(name.replace('.','/')+".class");
                    if (entry==null) throw new ClassNotFoundException(name);
                    try (InputStream input=jar.getInputStream(entry)) {
                        var in = new ClassReader(input);
                        var out = new ClassWriter(ClassWriter.COMPUTE_MAXS);
                        in.accept(new ClassVisitor(ASM8,out) {
                            public MethodVisitor visitMethod(int access,String n,String d,String sig,String[] exceptions) {
                                MethodVisitor mv=super.visitMethod(access,n,d,sig,exceptions);
                                boolean releaseHelper=methods.contains(name+"."+n+d);
                                if (!releaseHelper && (!observeNested || n.equals("<clinit>"))) return mv;
                                return new MethodVisitor(ASM8,mv) {
                                    public void visitCode() {
                                        super.visitCode();
                                        if (!releaseHelper) return;
                                        super.visitLdcInsn(name+"."+n+d);
                                        super.visitMethodInsn(INVOKESTATIC,"ReleaseStaticsOracle","call","(Ljava/lang/String;)V",false);
                                    }
                                    public void visitMethodInsn(int op,String owner,String name,String desc,boolean itf) {
                                        if (releaseHelper && hd && op==INVOKESTATIC) {
                                            super.visitLdcInsn(owner+"."+name+desc);
                                            super.visitMethodInsn(INVOKESTATIC,"ReleaseStaticsOracle","invoke","(Ljava/lang/String;)V",false);
                                        }
                                        super.visitMethodInsn(op,owner,name,desc,itf);
                                    }
                                    public void visitFieldInsn(int op,String owner,String field,String desc) {
                                        super.visitFieldInsn(op,owner,field,desc);
                                        if (op!=PUTSTATIC) return;
                                        if (hd && desc.length()==1 && "BIZS".contains(desc)) {
                                            super.visitLdcInsn(owner+"."+field+":"+desc);
                                            super.visitFieldInsn(GETSTATIC,owner,field,desc);
                                            super.visitMethodInsn(INVOKESTATIC,"ReleaseStaticsOracle",releaseHelper?"primitive":"nestedPrimitive","(Ljava/lang/String;I)V",false);
                                            return;
                                        }
                                        if (!(desc.startsWith("L")||desc.startsWith("["))) return;
                                        super.visitLdcInsn(owner+"."+field+":"+desc);
                                        super.visitFieldInsn(GETSTATIC,owner,field,desc);
                                        super.visitMethodInsn(INVOKESTATIC,"ReleaseStaticsOracle",releaseHelper?"store":"nestedStore","(Ljava/lang/String;Ljava/lang/Object;)V",false);
                                    }
                                };
                            }
                        },0);
                        byte[] bytes=out.toByteArray();
                        return defineClass(name,bytes,0,bytes.length);
                    } catch(java.io.IOException err) { throw new ClassNotFoundException(name,err); }
                }
            }) {
                var type=Class.forName("client",true,loader);
                var field=Unsafe.class.getDeclaredField("theUnsafe");
                field.setAccessible(true);
                Object clientObject=((Unsafe)field.get(null)).allocateInstance(type);
                var release = type.getDeclaredMethod(hd ? "c" : "a", hd ? int.class : boolean.class);
                release.setAccessible(true);
                Object argument=hd ? Integer.valueOf(126) : Boolean.TRUE;
                if (stop.equals("helpers")) {
                    stop="";
                    runtime=true;
                    // Initialize the gamepack classes in their original shutdown order before the independent calls.
                    execute(release,clientObject,argument,hd);
                    try (Scanner cases=new Scanner(System.in)) {
                        while (cases.hasNextLine()) {
                            String[] test=cases.nextLine().split("\t");
                            if (test[0].equals("observe")) {
                                observedFields.add(test[1]);
                                continue;
                            }
                            String method=test[0], value=test[1];
                            expectedCallee=test.length>2 ? test[2] : "";
                            if (!methods.contains(method)) throw new AssertionError("Unknown release helper "+method);
                            int dot=method.indexOf('.'), paren=method.indexOf('(');
                            Class<?> argType=switch (method.charAt(paren+1)) {
                                case 'B' -> byte.class;
                                case 'Z' -> boolean.class;
                                case 'I' -> int.class;
                                default -> throw new AssertionError(method);
                            };
                            var owner=Class.forName(method.substring(0,dot),true,loader);
                            var helper=owner.getDeclaredMethod(method.substring(dot+1,paren),argType);
                            helper.setAccessible(true);
                            Object guard;
                            if (argType==boolean.class) guard=Boolean.valueOf(value);
                            else if (argType==byte.class) guard=Byte.valueOf(value);
                            else guard=Integer.valueOf(value);
                            trace.clear();
                            directProbe=true;
                            try { execute(helper,null,guard,hd); }
                            finally { directProbe=false; }
                            if (trace.get(trace.size()-1).equals("stack overflow")) {
                                trace.remove(trace.size()-1);
                                int period=trace.subList(1,trace.size()).indexOf("call "+method)+1;
                                if (period<=0 || trace.size()<period*2) throw new AssertionError(method);
                                for (int i=period;i<trace.size();i++) {
                                    if (!trace.get(i).equals(trace.get(i%period))) throw new AssertionError(method+" at "+i);
                                }
                                System.out.println(method+"\t"+value+"\tstack overflow\t"+String.join("\t",trace.subList(0,period)));
                            } else {
                                System.out.println(method+"\t"+value+"\t"+String.join("\t",trace));
                            }
                        }
                    }
                } else if (stop.equals("all-runtime")) {
                    stop="";
                    execute(release,clientObject,argument,hd);
                    List<String> complete=List.copyOf(trace);
                    runtime=true;
                    for (int i=0;i<complete.size();i++) {
                        String boundary=complete.get(i);
                        if (!boundary.startsWith("null ")) continue;
                        stop=boundary;
                        trace.clear();
                        execute(release,clientObject,argument,hd);
                        if (trace.size()!=i+2 || !trace.subList(0,i+1).equals(complete.subList(0,i+1)) ||
                            !trace.get(i+1).startsWith("wrapped ")) throw new AssertionError(boundary);
                        System.out.println(boundary+"\t"+trace.get(i+1));
                    }
                } else {
                    execute(release,clientObject,argument,hd);
                    trace.forEach(System.out::println);
                }
            }
        }
    }

    static void execute(java.lang.reflect.Method release,Object client,Object argument,boolean hd) throws Exception {
        active=true;
        try { release.invoke(client,argument); }
        catch(InvocationTargetException e) {
            if (e.getCause() instanceof Stop) return;
            if (e.getCause() instanceof StackOverflowError) { trace.add("stack overflow"); return; }
            var cause=e.getCause();
            if (!runtime || !cause.getClass().getName().equals(hd ? "ld" : "g")) throw new AssertionError(cause);
            var context=cause.getClass().getDeclaredField(hd ? "e" : "q");
            context.setAccessible(true);
            trace.add("wrapped "+context.get(cause));
        } finally { active=false; }
    }
}
