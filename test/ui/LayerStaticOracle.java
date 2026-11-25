import java.lang.reflect.*;
import java.nio.file.*;
import java.util.*;
import jdk.internal.org.objectweb.asm.*;

/** Exercise a real component in the SD or HD interface walker. Instrument only
 * the dispatcher's field instructions, leaving the widgets and queues native. */
public class LayerStaticOracle {
    static boolean hd, active, hints, drawing, sub;
    static int guard;
    static int stop;
    static final List<String> events=new ArrayList<>(), stores=new ArrayList<>();
    static final Map<String,Field> fields=new LinkedHashMap<>();
    static final Map<String,String> labels=new LinkedHashMap<>();
    static final Map<Field,Object> defaults=new LinkedHashMap<>();
    static Object widget;
    static final class Stop extends Error {}
    static String variant(String sd,String gl){return hd?gl:sd;}
    public static void access(String label,int ordinal) {
        if(!active)return;
        events.add(hints?label+"@"+ordinal:label);
        if(events.size()==stop) throw new Stop();
    }
    public static void stored(String label) throws Exception {
        if(!active)return;
        Object value=fields.get(label).get(null);
        stores.add(label+"="+(value==null?"null":value==widget?"widget":(value instanceof Number || value instanceof Boolean)?value:"object"));
    }
    static void instrument(Path out,String cls,String method,String signature) throws Exception {
        ClassReader r;
        try(var stream=LayerStaticOracle.class.getResourceAsStream("/"+cls+".class")){r=new ClassReader(stream);}
        ClassWriter w=new ClassWriter(r,ClassWriter.COMPUTE_MAXS);
        r.accept(new ClassVisitor(Opcodes.ASM8,w) {
            @Override public MethodVisitor visitMethod(int m,String n,String d,String sig,String[] exc) {
                var raw=super.visitMethod(m,n,d,sig,exc);
                if(!n.equals(method) || !d.equals(signature)) return raw;
                return new MethodVisitor(Opcodes.ASM8,raw) {
                    final Map<String,Integer> counts=new HashMap<>();
                    @Override public void visitMethodInsn(int op,String owner,String name,String descriptor,boolean iface) {
                        if (drawing) {
                            String callee=owner+"."+name+descriptor;
                            // Isolate DrawLayer, keeping every argument and its field reads on the original path.
                            String replacement=switch(callee) {
                                case "kk.a(BIIIIZ)V","ui.a(IIZIII)V","fd.a(ILaj;III)V","ed.a(IBIILbe;)V",
                                     "mb.c(Lid;IIII)V","mb.b(Lid;IIII)V","rk.b(Lna;IIII)V","mb.a(Lid;IIII)V","rk.a(Lna;IIII)V",
                                     "ed.a(IIIIIIIII)V","ag.a(IIIIIIIII)V",
                                     "td.d(IIIII)V","td.c(IIIII)V","kb.b(IIIII)V","kb.c(IIIII)V",
                                     "dj.d(IIII)V","dj.c(IIIII)V","dj.a(IIIII)V" -> "void";
                                case "mb.b(Lid;)I","rk.a(Lna;)I" -> "width";
                                case "pj.a(III)Laj;","qf.a(BII)Lbe;" -> "widget";
                                case "nc.a(BJ)Ljf;","sc.a(JI)Lab;" -> "sub";
                                default -> null;
                            };
                            if(replacement!=null) {
                                var params=jdk.internal.org.objectweb.asm.Type.getArgumentTypes(descriptor);
                                for(int i=params.length-1;i>=0;i--) super.visitInsn(params[i].getSize()==2?Opcodes.POP2:Opcodes.POP);
                                if(op!=Opcodes.INVOKESTATIC) super.visitInsn(Opcodes.POP);
                                if(replacement.equals("width")) super.visitInsn(Opcodes.ICONST_4);
                                if(replacement.equals("widget") || replacement.equals("sub")){
                                    if(replacement.equals("widget"))super.visitFieldInsn(Opcodes.GETSTATIC,"LayerStaticOracle","widget","Ljava/lang/Object;");
                                    else super.visitMethodInsn(Opcodes.INVOKESTATIC,"LayerStaticOracle","subWidget","()Ljava/lang/Object;",false);
                                    super.visitTypeInsn(Opcodes.CHECKCAST,jdk.internal.org.objectweb.asm.Type.getReturnType(descriptor).getInternalName());
                                }
                                return;
                            }
                        }
                        super.visitMethodInsn(op,owner,name,descriptor,iface);
                    }
                    @Override public void visitFieldInsn(int op,String owner,String name,String type) {
                        if(drawing && op==Opcodes.GETFIELD && (owner+"."+name).equals(variant("mb.C","rk.ab"))) {
                            super.visitInsn(Opcodes.POP);super.visitInsn(Opcodes.ICONST_0);return;
                        }
                        String key=labels.get(owner+"."+name);
                        if(key==null || (op!=Opcodes.GETSTATIC && op!=Opcodes.PUTSTATIC)) {super.visitFieldInsn(op,owner,name,type);return;}
                        String label=op==Opcodes.PUTSTATIC?"set-"+key:key;
                        super.visitLdcInsn(label);super.visitLdcInsn(counts.merge(label,1,Integer::sum));
                        super.visitMethodInsn(Opcodes.INVOKESTATIC,"LayerStaticOracle","access","(Ljava/lang/String;I)V",false);
                        super.visitFieldInsn(op,owner,name,type);
                        if(op==Opcodes.PUTSTATIC) {
                            super.visitLdcInsn(key);
                            super.visitMethodInsn(Opcodes.INVOKESTATIC,"LayerStaticOracle","stored","(Ljava/lang/String;)V",false);
                        }
                    }
                };
            }
        },0);
        Files.write(out.resolve(cls+".class"),w.toByteArray());
    }
    public static Object subWidget() throws Exception {
        if(!sub)return null;
        var ctor=Class.forName(variant("qd","wk")).getDeclaredConstructor();ctor.setAccessible(true);return ctor.newInstance();
    }
    static void put(String name,String val) throws Exception {
        if(name.equals("draw.guard")) {guard=Integer.parseInt(val);return;}
        if(name.equals("draw.gpu")) {if(hd){var enabled=Class.forName("tf").getDeclaredField("w");enabled.setAccessible(true);enabled.setBoolean(null,Boolean.parseBoolean(val));}return;}
        if(name.equals("draw.sub")) {sub=Boolean.parseBoolean(val);return;}
        Field f=fields.get(name);Class<?> t=f.getType();Object obj=Modifier.isStatic(f.getModifiers())?null:widget;
        if(val.equals("null")) f.set(obj,null);
        else if(val.equals("widget")) f.set(obj,widget);
        else if(val.equals("new")) {var ctor=t.getDeclaredConstructor();ctor.setAccessible(true);f.set(obj,ctor.newInstance());}
        else if(val.equals("word")) {
            var factory=Class.forName(variant("vb","cd")).getDeclaredMethod("a",String.class,byte.class);
            factory.setAccessible(true);f.set(obj,factory.invoke(null,"hello",(byte)(hd?-128:60)));
        }
        else if(val.equals("hook")) f.set(obj,new Object[]{17});
        else if(t==int[].class) {
            String[] parts=val.split(","); int[] arr=new int[parts.length];for(int i=0;i<arr.length;i++)arr[i]=Integer.parseInt(parts[i]);f.set(obj,arr);
        } else if(t==boolean[].class) {
            boolean[] a=new boolean[128];if(!val.equals("-"))a[Integer.parseInt(val)]=true;f.set(obj,a);
        } else if(t==float.class) f.setFloat(obj,Float.parseFloat(val));
        else if(t==boolean.class) f.setBoolean(obj,Boolean.parseBoolean(val));
        else f.setInt(obj,Integer.parseInt(val));
    }
    public static void main(String[] args) throws Exception {
        hd=args[0].equals("gl");hints=Boolean.getBoolean("rs530.siteHints");
        drawing=args[2].equals("draw");
        Class<?> component=Class.forName(variant("aj","be"));
        List<String> lines=Files.readAllLines(Path.of(args[1]));
        for(String row:lines.subList(1,lines.size())) {
            String[] cols=row.split("\t");String id=cols[0]+"."+cols[1],ref=cols[hd?3:2];
            if(ref.equals("-") || !drawing && cols.length>4) continue;
            boolean instance=cols[0].equals("Widget");
            int dot=ref.indexOf('.');
            Field f=instance?component.getDeclaredField(ref):Class.forName(ref.substring(0,dot)).getDeclaredField(ref.substring(dot+1));
            f.setAccessible(true);fields.put(id,f);
            if(!instance){labels.put(ref,id);defaults.put(f,f.get(null));}
        }
        String cls=drawing?variant("lf","gn"):"client";
        String desc=drawing?variant("(I[Laj;IIIIIIZI)V","(III[Lbe;IIIIBI)V"):variant("([Laj;IIIIIII)V","([Lbe;IIIIIII)V");
        if(args.length==4){instrument(Path.of(args[3]),cls,"a",desc);return;}
        Class<?>[] types=java.lang.invoke.MethodType.fromMethodDescriptorString(desc,component.getClassLoader()).parameterArray();
        Method run=Class.forName(cls).getDeclaredMethod("a",types);run.setAccessible(true);
        Constructor<?> constructor=component.getDeclaredConstructor();constructor.setAccessible(true);
        Scanner sc=new Scanner(System.in);
        while(sc.hasNextLine()) {
            String[] row=sc.nextLine().split(" ");stop=Integer.parseInt(row[0]);
            active=false;events.clear();stores.clear();
            for(var entry:defaults.entrySet()) entry.getKey().set(null,entry.getValue());
            widget=constructor.newInstance();guard=119;sub=false; if(drawing)put("draw.gpu","false");
            for(int i=1;i<row.length;i++){String[] kv=row[i].split("=",2);put(kv[0],kv[1]);}
            Object layer=Array.newInstance(component,1);Array.set(layer,0,widget);
            String result="ok";active=true;
            try {
                if(!drawing)run.invoke(null,layer,-1,0,0,80,60,0,0);
                else if(hd) run.invoke(null,0,11,7,layer,80,-1,0,60,(byte)guard,0);
                else run.invoke(null,11,layer,-1,60,0,0,80,7,true,0);
            }
            catch(InvocationTargetException ex) {result=ex.getCause() instanceof Stop?"stop":"exception";}
            active=false;
            System.out.println("result\t"+String.join(",",events)+"|"+result+"|"+String.join(",",stores));
        }
    }
}
