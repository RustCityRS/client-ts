import java.lang.reflect.Array;
import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.nio.file.*;
import java.util.*;
import java.util.jar.JarFile;
import jdk.internal.org.objectweb.asm.*;

// Run the original dispatcher. Observe its array publications and script-field
// reads, with an optional exception immediately before a selected field read.
public class ScriptLocalsOracle {
    static boolean hd;
    static final List<String> log = new ArrayList<>();
    static final Map<String,Integer> counts = new HashMap<>();
    static String fault;
    static String variant(String sd,String gl) { return hd ? gl : sd; }
    static String code() { return variant("m","qc"); }
    static String dispatcher() { return variant("gh","h"); }
    static String label(String owner,String name,int opcode) {
        if (opcode == Opcodes.GETFIELD && owner.equals(code())) {
            if (name.equals(variant("D","O"))) return "ops";
            if (name.equals(variant("F","W"))) return "args";
            if (name.equals(variant("E","L"))) return "newInt";
            if (name.equals(variant("I","S"))) return "newString";
        }
        if (opcode == Opcodes.PUTSTATIC) {
            if ((owner+"."+name).equals(variant("mk.J","rh.a"))) return "putInt";
            if ((owner+"."+name).equals(variant("lk.t","og.g"))) return "putString";
        }
        return null;
    }
    public static void note(String operation) {
        int number=counts.merge(operation,1,Integer::sum);
        String point=operation+number;
        log.add(point);
        if (point.equals(fault)) throw new IllegalStateException("read fault");
    }
    public static void reported(Throwable error,String message,int guard) {
        log.add("report");
    }
    public static void reported(String message,Throwable error,byte guard) {
        log.add("report");
    }
    static void patch(String pack,Path output) throws Exception {
        String cls=dispatcher();
        try(JarFile jar=new JarFile(pack)) {
            ClassReader reader=new ClassReader(jar.getInputStream(jar.getJarEntry(cls+".class")));
            ClassWriter writer=new ClassWriter(reader,ClassWriter.COMPUTE_MAXS);
            reader.accept(new ClassVisitor(Opcodes.ASM8,writer) {
                public MethodVisitor visitMethod(int flags,String name,String desc,String sig,String[] exceptions) {
                    MethodVisitor method=super.visitMethod(flags,name,desc,sig,exceptions);
                    if (!name.equals("a") || !desc.equals(variant("(Lwf;II)V","(BILjl;)V"))) return method;
                    return new MethodVisitor(Opcodes.ASM8,method) {
                        public void visitFieldInsn(int op,String owner,String field,String type) {
                            String tag=label(owner,field,op);
                            if (tag!=null) {
                                super.visitLdcInsn(tag);
                                super.visitMethodInsn(Opcodes.INVOKESTATIC,"ScriptLocalsOracle","note","(Ljava/lang/String;)V",false);
                            }
                            super.visitFieldInsn(op,owner,field,type);
                        }
                        public void visitMethodInsn(int op,String owner,String name,String desc,boolean itf) {
                            if (owner.equals(variant("pk","ha")) && desc.equals(variant("(Ljava/lang/Throwable;Ljava/lang/String;I)V","(Ljava/lang/String;Ljava/lang/Throwable;B)V")))
                                super.visitMethodInsn(op,"ScriptLocalsOracle","reported",desc,false);
                            else super.visitMethodInsn(op,owner,name,desc,itf);
                        }
                    };
                }
            },0);
            Files.write(output.resolve(cls+".class"),writer.toByteArray());
        }
    }
    static Field field(String name) throws Exception {
        int dot=name.indexOf('.');
        Field f=Class.forName(name.substring(0,dot)).getDeclaredField(name.substring(dot+1)); f.setAccessible(true); return f;
    }
    static Object make(String cls) throws Exception {
        var c=Class.forName(cls).getDeclaredConstructor();c.setAccessible(true);return c.newInstance();
    }
    static void put(Object obj,String sd,String gl,Object value) throws Exception {
        field(code()+"."+variant(sd,gl)).set(obj,value);
    }
    static Object script(int id,boolean root,int ints,int strings) throws Exception {
        Object s=make(code());put(s,"D","O",root?new int[]{40,21}:new int[]{21});
        put(s,"F","W",root?new int[]{id+1,0}:new int[]{0}); put(s,"E","L",ints);put(s,"I","S",strings);
        Object cache=field(variant("sf.g","ib.d")).get(null);
        cache(cache,id,s);
        return s;
    }
    static void cache(Object cache,int id,Object s) throws Exception {
        Method insert;
        if (hd) {
            insert=cache.getClass().getDeclaredMethod("a",Class.forName("rg"),long.class,byte.class); insert.setAccessible(true);
            insert.invoke(cache,s,(long)id,(byte)-87);
        } else {
            insert=cache.getClass().getDeclaredMethod("a",long.class,int.class,Class.forName("ei")); insert.setAccessible(true);
            insert.invoke(cache,(long)id,0,s);
        }
    }
    public static void main(String[] args) throws Exception {
        hd=args[0].equals("gl");
        if(args.length==3) {patch(args[1],Path.of(args[2]));return;}
        Class<?> hook=Class.forName(variant("wf","jl")), string=Class.forName(variant("id","na"));
        Method run=hd?Class.forName("h").getDeclaredMethod("a",byte.class,int.class,hook):
            Class.forName("gh").getDeclaredMethod("a",hook,int.class,int.class);
        run.setAccessible(true);
        Field il=field(variant("mk.J","rh.a")), sl=field(variant("lk.t","og.g")), depth=field(variant("oi.b","km.ad"));
        Field frames=field(variant("kc.p","fe.nc"));
        int id=1;
        for(String line:new String(System.in.readAllBytes()).strip().split("\\R")) {
            String[] input=line.split(" ");fault=input[0]; log.clear(); counts.clear();
            script(id,true,Integer.parseInt(input[1]),Integer.parseInt(input[2]));
            script(id+1,false,Integer.parseInt(input[3]),Integer.parseInt(input[4]));
            Object e=make(hook.getName());field(variant("wf.G","jl.E")).set(e,new Object[]{id}); id+=2;
            il.set(null,new int[7]);sl.set(null,Array.newInstance(string,8));
            Array.set(frames.get(null),0,null);
            try {
                if(hd) run.invoke(null,(byte)-12,100,e);else run.invoke(null,e,-22368,100);
            } catch(java.lang.reflect.InvocationTargetException error) {log.add("escaped");}
            Object frame=Array.get(frames.get(null),0);
            String saved=frame==null?"-":Array.getLength(field(variant("qf.k","hj.b")).get(frame))+"/"+Array.getLength(field(variant("qf.g","hj.f")).get(frame));
            System.out.println(line+"|"+String.join(",",log)+"|"+Array.getLength(il.get(null))+"/"+Array.getLength(sl.get(null))+"/"+depth.getInt(null)+"|"+saved);
        }
    }
}
