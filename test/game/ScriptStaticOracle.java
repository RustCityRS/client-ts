import java.lang.reflect.*;
import java.nio.file.*;
import java.util.*;
import java.util.jar.JarFile;
import jdk.internal.org.objectweb.asm.*;

// Instrument the original dispatcher's static instructions, leaving its operands,
// destination arrays, branches and exception handlers on the JVM.
public class ScriptStaticOracle extends ScriptLocalsOracle {
    static final Map<String,String> names = new LinkedHashMap<>();
    static boolean active;
    static int target, failAt;
    static String result;
    static int[] currentStack;
    static Object[] currentStrings;
    static final List<String> writes=new ArrayList<>();
    public static void afterInt(String name,int value) { if (active) writes.add(name+"="+value); }
    public static void afterRef(String name,Object value) { if (active) writes.add(name+"="+(value==null?"null":"object")); }
    static final class Stop extends Error {}

    public static void select(int opcode) { active = target<0 || opcode == target; }
    public static void read(String label,int occurrence) {
        if (!active) return;
        log.add(Boolean.getBoolean("rs530.siteHints") ? label+"@"+occurrence : label);
        if (log.size() == failAt) throw new Stop();
    }
    public static void index(int[] array,int index) {
        if (active && array==currentStack && index>=0 && index<array.length) {
            log.add("index"+index);
            if(log.size()==failAt) throw new Stop();
        }
    }
    public static void stringIndex(Object[] array,int index) {
        if (active && array==currentStrings && index>=0 && index<array.length) {
            log.add("sindex"+index);
            if(log.size()==failAt) throw new Stop();
        }
    }
    public static void reported(Throwable error,String message,int guard) { active=false; result="report"; }
    public static void reported(String message,Throwable error,byte guard) { active=false; result="report"; }

    static void instrument(String pack,Path dir) throws Exception {
        String cls=dispatcher(), oracle="ScriptStaticOracle";
        try (JarFile jar=new JarFile(pack)) {
            ClassReader input=new ClassReader(jar.getInputStream(jar.getJarEntry(cls+".class")));
            ClassWriter output=new ClassWriter(input,ClassWriter.COMPUTE_MAXS);
            input.accept(new ClassVisitor(Opcodes.ASM8,output) {
                public MethodVisitor visitMethod(int flags,String method,String desc,String sig,String[] exc) {
                    MethodVisitor mv=super.visitMethod(flags,method,desc,sig,exc);
                    if (!method.equals("a") || !desc.equals(variant("(Lwf;II)V","(BILjl;)V"))) return mv;
                    return new MethodVisitor(Opcodes.ASM8,mv) {
                        final Map<String,Integer> occurrences=new HashMap<>();
                        public void visitVarInsn(int op,int local) {
                            super.visitVarInsn(op,local);
                            if (op==Opcodes.ISTORE && local==11) {
                                super.visitVarInsn(Opcodes.ILOAD,local);
                                super.visitMethodInsn(Opcodes.INVOKESTATIC,oracle,"select","(I)V",false);
                            }
                        }
                        public void visitInsn(int op) {
                            if (op==Opcodes.IALOAD) {
                                super.visitInsn(Opcodes.DUP2);
                                super.visitMethodInsn(Opcodes.INVOKESTATIC,oracle,"index","([II)V",false);
                            }
                            if (op==Opcodes.AALOAD) {
                                super.visitInsn(Opcodes.DUP2);
                                super.visitMethodInsn(Opcodes.INVOKESTATIC,oracle,"stringIndex","([Ljava/lang/Object;I)V",false);
                            }
                            super.visitInsn(op);
                        }
                        public void visitFieldInsn(int op,String owner,String field,String type) {
                            String label=names.get(owner+"."+field);
                            String tag=op==Opcodes.PUTSTATIC?"set-"+label:label;
                            if ((op==Opcodes.GETSTATIC || op==Opcodes.PUTSTATIC) && label!=null) {
                                super.visitLdcInsn(tag);
                                super.visitLdcInsn(occurrences.merge(tag,1,Integer::sum));
                                super.visitMethodInsn(Opcodes.INVOKESTATIC,oracle,"read","(Ljava/lang/String;I)V",false);
                            }
                            super.visitFieldInsn(op,owner,field,type);
                            if (op==Opcodes.PUTSTATIC && label!=null) {
                                super.visitLdcInsn(label);
                                super.visitFieldInsn(Opcodes.GETSTATIC,owner,field,type);
                                boolean ref=type.startsWith("[") || type.startsWith("L");
                                super.visitMethodInsn(Opcodes.INVOKESTATIC,oracle,ref?"afterRef":"afterInt",ref?"(Ljava/lang/String;Ljava/lang/Object;)V":"(Ljava/lang/String;I)V",false);
                            }
                        }
                        public void visitMethodInsn(int op,String owner,String name,String desc,boolean itf) {
                            // A headless JVM cannot create the host fullscreen window.
                            // Keep all five original operands and the following frame test.
                            if(hd && owner.equals("th") && name.equals("a") && desc.equals("(ZIIII)V")) {
                                super.visitInsn(Opcodes.POP2);super.visitInsn(Opcodes.POP2);super.visitInsn(Opcodes.POP);return;
                            }
                            if (owner.equals(variant("pk","ha")) && desc.equals(variant("(Ljava/lang/Throwable;Ljava/lang/String;I)V","(Ljava/lang/String;Ljava/lang/Throwable;B)V")))
                                super.visitMethodInsn(op,oracle,"reported",desc,false);
                            else super.visitMethodInsn(op,owner,name,desc,itf);
                        }
                    };
                }
            },0);
            Files.write(dir.resolve(cls+".class"),output.toByteArray());
        }
    }

    static Field member(Class<?> cls,String name) throws Exception {
        while (cls!=null) {
            try { Field f=cls.getDeclaredField(name); f.setAccessible(true); return f; }
            catch (NoSuchFieldException error) { cls=cls.getSuperclass(); }
        }
        throw new NoSuchFieldException(name);
    }
    static void set(String path,String encoded) throws Exception {
        String[] parts=path.split("\\.");
        Object owner=null;
        Field f=field(parts[0]+"."+parts[1]);
        for (int i=2;i<parts.length;i++) { owner=f.get(owner); f=member(owner.getClass(),parts[i]); }
        Class<?> type=f.getType();
        if (encoded.equals("null")) f.set(owner,null);
        else if (encoded.startsWith("text:")) f.set(owner,text(encoded.substring(5)));
        else if (encoded.startsWith("raw:")) f.set(owner,encoded.substring(4));
        else if (encoded.startsWith("objects:")) {
            Class<?> item=type.getComponentType();
            String entry=encoded.substring(8);
            Object array=Array.newInstance(item,1);
            if (entry.equals("friend")) {Object person=make(item.getName());member(item,"t").set(person,text("Bob"));Array.set(array,0,person);}
            else if (!entry.equals("null")) Array.set(array,0,entry.equals("new")?make(item.getName()):text(entry));
            f.set(owner,array);
        }
        else if (encoded.equals("new")) f.set(owner,make(type.getName()));
        else if (type==int[].class) f.set(owner,new int[]{Integer.parseInt(encoded)});
        else if (type==long[].class) f.set(owner,new long[]{Long.parseLong(encoded)});
        else if (type==short[].class) f.set(owner,new short[]{Short.parseShort(encoded)});
        else if (type==boolean[].class) {
            boolean[] flags=new boolean[128];Arrays.fill(flags,encoded.equals("1"));f.set(owner,flags);
        }
        else if (type==byte.class) f.setByte(owner,Byte.parseByte(encoded));
        else if (type==boolean.class) f.setBoolean(owner,encoded.equals("1"));
        else f.setInt(owner,Integer.parseInt(encoded));
    }
    static Object text(String s) throws Exception {
        Object x=make(variant("id","na"));
        byte[] data=s.getBytes(java.nio.charset.StandardCharsets.ISO_8859_1);
        field(variant("id.A","na.T")).set(x,data);
        field(variant("id.c","na.lb")).setInt(x,data.length);
        return x;
    }
    static Object construct(String cls,Class<?>[] types,Object... args) throws Exception {
        Constructor<?> ctor=Class.forName(cls).getDeclaredConstructor(types);ctor.setAccessible(true);return ctor.newInstance(args);
    }
    static void mapArea() throws Exception {
        byte[] data={65,0,65,0,0,0,0,0,0,0,0,0,1,0,1,0,0,0,0,0,8,0,8};
        String packet=variant("gd","wa");Object bytes=construct(packet,new Class<?>[]{byte[].class},data);
        Method decode=Class.forName(variant("hl","rb")).getDeclaredMethod("a",Class.forName(packet),hd?boolean.class:byte.class);
        decode.setAccessible(true);Object area=hd?decode.invoke(null,bytes,true):decode.invoke(null,bytes,(byte)-114);
        Object list=make(variant("gk","ih"));field(variant("ba.d","sh.a")).set(null,list);
        Method add=hd?list.getClass().getDeclaredMethod("a",boolean.class,Class.forName("ab")):
            list.getClass().getDeclaredMethod("a",Class.forName("jf"),boolean.class);
        add.setAccessible(true);if(hd)add.invoke(list,true,area);else add.invoke(list,area,false);
    }
    static void sprites() throws Exception {
        byte[] data={0,0,0,0,4,5,0,0,0};
        java.util.zip.CRC32 crc=new java.util.zip.CRC32();crc.update(data);
        Object index=construct(variant("db","ii"),new Class<?>[]{byte[].class,int.class},data,(int)crc.getValue());
        Object js5=construct(variant("al","ve"),new Class<?>[]{Class.forName(variant("ud","v")),boolean.class,boolean.class},null,false,true);
        Field indexField=null;
        for(Field f:js5.getClass().getDeclaredFields()) if(!Modifier.isStatic(f.getModifiers()) && f.getType()==index.getClass()) indexField=f;
        indexField.setAccessible(true);indexField.set(js5,index);
        field(variant("h.i","ra.K")).set(null,js5);
    }

    public static void main(String[] args) throws Exception {
        hd=args[0].equals("gl");
        Scanner lines=new Scanner(System.in);
        for (String pair:lines.nextLine().split(" ")) {
            String[] kv=pair.split("="); names.put(kv[0],kv[1]);
        }
        if (args.length==3) { instrument(args[1],Path.of(args[2]));return; }
        Class<?> hook=Class.forName(variant("wf","jl"));
        Method run=hd?Class.forName("h").getDeclaredMethod("a",byte.class,int.class,hook):
            Class.forName("gh").getDeclaredMethod("a",hook,int.class,int.class);
        run.setAccessible(true);
        int id=0;
        Field stream=field(variant("qk.v","ag.P"));
        Object defaultStream=stream.get(null);
        Field groups=field(variant("fk.ab","th.j"));Object initialGroups=groups.get(null);
        Field areas=field(variant("ba.d","sh.a")),sprites=field(variant("h.i","ra.K"));
        Object defaultAreas=areas.get(null), defaultSprites=sprites.get(null);
        while (lines.hasNextLine()) {
            String[] parts=lines.nextLine().split(" ");
            int opcode=Integer.parseInt(parts[0]);
            String[] inputs=parts[1].equals("-991")?new String[0]:parts[1].split(",");
            active=false;target=opcode;failAt=Integer.parseInt(parts[2]);result="ok";log.clear();writes.clear();
            stream.set(null,defaultStream);
            groups.set(null,initialGroups);
            areas.set(null,defaultAreas);sprites.set(null,defaultSprites);
            int operand=0; for (int i=3;i<parts.length;i++) {
                String[] kv=parts[i].split("=");
                if(kv[0].equals("operand")) operand=Integer.parseInt(kv[1]);
                else if(kv[0].equals("gpu")) {if(hd) field("tf.w").setBoolean(null,kv[1].equals("1"));}
                else if(kv[0].equals("area")) mapArea();
                else if(kv[0].equals("sprites")) sprites();
                else if (kv[0].equals("widgets")) {
                    Class<?> node=Class.forName(variant("aj","be"));Object list=Array.newInstance(node,1,1);
                    Array.set(Array.get(list,0),0,field(variant("al.B","sg.i")).get(null));groups.set(null,list);
                } else if(kv[0].equals("enum")) {
                    Object e=make(variant("lg","ml"));member(e.getClass(),variant("R","V")).setInt(e,115);member(e.getClass(),variant("Z","N")).setInt(e,115);
                    cache(field(variant("t.z","lj.p")).get(null),Integer.parseInt(kv[1]),e);
                } else if(kv[0].equals("param")) {
                    String[] pair=kv[1].split(":");
                    Object p=make(variant("sj","hn"));member(p.getClass(),variant("O","L")).setInt(p,Integer.parseInt(pair[1]));
                    cache(field(variant("mg.c","wd.a")).get(null),Integer.parseInt(pair[0]),p);
                }
                else if(kv[0].equals("cipher")) {
                    Class<?> cls=stream.getType();
                    Constructor<?> ctor=cls.getDeclaredConstructor(int.class);ctor.setAccessible(true);Object packet=ctor.newInstance(512);
                    Method enc=cls.getDeclaredMethod("a",int[].class,hd?boolean.class:int.class);enc.setAccessible(true);
                    if(hd) enc.invoke(packet,new int[4],false);else enc.invoke(packet,new int[4],0);
                    stream.set(null,packet);
                } else set(kv[0],kv[1]);
            }
            int[] stack=new int[32];Arrays.fill(stack,-991);currentStack=stack;
            field(variant("tg.B","uj.t")).set(null,stack);
            Object strStack=Array.newInstance(Class.forName(variant("id","na")),32);
            currentStrings=(Object[])strStack;
            field(variant("g.p","ab.j")).set(null,strStack);
            id+=2;
            Object code=script(id,true,opcode==-7?1:0,0);
            int[] ops=new int[inputs.length+2], argsArray=new int[ops.length];
            Object strings=Array.newInstance(Class.forName(variant("id","na")),ops.length);
            for(int i=0;i<inputs.length;i++) {
                if (inputs[i].startsWith("s:")) {ops[i]=3;Array.set(strings,i,text(inputs[i].substring(2)));}
                else argsArray[i]=Integer.parseInt(inputs[i]);
            }
            argsArray[inputs.length]=operand;ops[inputs.length]=opcode;ops[inputs.length+1]=21;
            if(opcode==-7) {ops=new int[]{40,21};argsArray=new int[]{id+1,0};script(id+1,false,0,0);}
            if(opcode==-8 || opcode==-9) {
                ops=new int[]{9999};argsArray=new int[1];
                if(opcode==-8) put(code,"J","R",text("broken"));
            }
            put(code,"D","O",ops);put(code,"F","W",argsArray);put(code,"B","T",strings);
            Object e=make(hook.getName());field(variant("wf.G","jl.E")).set(e,opcode==-7?new Object[]{id,17}:new Object[]{id});
            active=opcode<0;
            try {
                if(hd) run.invoke(null,(byte)-12,100,e);else run.invoke(null,e,-22368,100);
            } catch(InvocationTargetException error) {
                if (!(error.getCause() instanceof Stop)) throw error;
                result="stop";
            }
            active=false;
            Object first=Array.get(strStack,0);
            String str=first==null?"null":new String((byte[])field(variant("id.A","na.T")).get(first),0,field(variant("id.c","na.lb")).getInt(first),java.nio.charset.StandardCharsets.ISO_8859_1);
            System.out.println(String.join(",",log)+"|"+result+"|"+stack[0]+"|"+str+"|"+String.join(",",writes));
        }
    }
}
