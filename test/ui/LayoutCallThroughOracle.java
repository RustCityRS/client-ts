import java.io.*;
import java.lang.invoke.MethodHandles;
import java.lang.reflect.*;
import java.util.*;
import jdk.internal.org.objectweb.asm.*;
import jdk.internal.org.objectweb.asm.tree.*;

public class LayoutCallThroughOracle {
    static final Map<String,Method> entries=new HashMap<>();
    static final Set<String> fields=Set.of("aj.C","aj.H","aj.ld","aj.jb","aj.Kc","aj.pb","qd.v","hi.f","fl.l","hd.m","fk.ab","va.Z");
    static int mode,fail;
    static aj root,child,dynamic,mounted;
    static aj[] original,linked,kids,alternate;
    static StringJoiner trace;
    static final Map<String,Integer> hits=new HashMap<>();

    public static void read(String field) {
        trace.add(field);
        int n=hits.merge(field,1,Integer::sum);
        if (fail>0 && --fail==0) throw new IllegalArgumentException("probe");
        if (mode==2 && n==1 && field.equals("aj.ld")) root.ld=197;
        if (mode==2 && n==1 && field.equals("aj.jb")) root.jb=-56;
        if (mode==3 && n==1 && field.equals("aj.Kc")) root.Kc=2<<16;
        if (mode==6 && n==1 && field.equals("aj.pb")) root.pb=null;
        if (mode==7 && n==1 && field.equals("aj.pb")) root.pb=alternate;
        if (mode==15 && field.equals("fl.l")) hi.f=-321;
        if (mode==16 && field.equals("aj.C")) root.H=-43;
        if (mode==17 && field.equals("fk.ab")) fk.ab=null;
    }
    static String row(aj[] a) {
        return a==null?"null":a==original?"R":a==linked?"L":a==kids?"K":a==alternate?"A":"?";
    }
    public static void children(int w,int h,int parent,byte guard,aj[] a,boolean resize) {
        trace.add("children:"+w+","+h+","+parent+","+row(a)+","+resize);
        hf.a(w,h,parent,guard,a,resize);
    }
    public static void group(boolean resize,int h,byte guard,int w,int id) {
        trace.add("group:"+resize+","+h+","+w+","+id);
        rb.a(resize,h,guard,w,id);
    }
    public static boolean open(int id,boolean allocate) {
        trace.add("open:"+id+","+allocate);
        if(mode==13)return false;
        boolean answer=qg.a(id,allocate);
        if(mode==11)fk.ab=null;
        if(mode==12)fk.ab[id]=alternate;
        return answer;
    }
    public static void size(aj c,int w,boolean resize,int h,int guard) {
        trace.add("size:"+w+","+resize+","+h);pa.a(c,w,resize,h,guard);
    }
    public static void position(aj c,byte guard,int w,int h) {
        trace.add("position:"+guard+","+w+","+h);gh.a(c,guard,w,h);
    }
    static void copy(ClassWriter out,String owner,String desc,String exported) throws Exception {
        var node=new ClassNode();
        try(var in=LayoutCallThroughOracle.class.getResourceAsStream("/"+owner+".class")){new ClassReader(in).accept(node,0);}
        for(MethodNode m:node.methods)if(m.name.equals("a")&&m.desc.equals(desc)){
            for(var ins:m.instructions.toArray()){
                if(ins instanceof FieldInsnNode f && (f.getOpcode()==Opcodes.GETSTATIC||f.getOpcode()==Opcodes.GETFIELD)){
                    String key=f.owner+"."+f.name;
                    if(fields.contains(key)){
                        var hook=new InsnList();hook.add(new LdcInsnNode(key));
                        hook.add(new MethodInsnNode(Opcodes.INVOKESTATIC,"LayoutCallThroughOracle","read","(Ljava/lang/String;)V",false));
                        m.instructions.insert(ins,hook);
                    }
                }
                if(ins instanceof MethodInsnNode call){
                    String target=switch(call.owner+"."+call.name+call.desc){
                        case "pa.a(Laj;IZII)V" -> "size"; case "gh.a(Laj;BII)V" -> "position";
                        case "hf.a(IIIB[Laj;Z)V" -> "children"; case "rb.a(ZIBII)V" -> "group";
                        case "qg.a(IZ)Z" -> "open"; default -> null;
                    };
                    if(target!=null){call.owner="LayoutCallThroughOracle";call.name=target;}
                }
            }
            m.name=exported;m.access=Opcodes.ACC_PUBLIC|Opcodes.ACC_STATIC;m.accept(out);return;
        }
        throw new AssertionError(owner+desc);
    }
    static aj widget(int id,int parent,int marker) {
        aj c=new aj();c.Kc=id;c.n=parent;c.ob=marker==1?0:3;c.X=c.h=1;
        c.G=marker*5;c.M=marker*2;c.C=60+marker;c.H=30+marker;return c;
    }
    public static void main(String[] args)throws Exception{
        Class.forName("client");
        var writer=new ClassWriter(ClassWriter.COMPUTE_MAXS);
        writer.visit(Opcodes.V1_6,Opcodes.ACC_PUBLIC,"LayoutCallThroughSites",null,"java/lang/Object",null);
        copy(writer,"ik","(ILaj;)V","component");copy(writer,"mi","(ZLaj;I)V","subcomponents");
        copy(writer,"rb","(ZIBII)V","group");copy(writer,"ik","(ZZ)V","all");writer.visitEnd();
        for(Method method:MethodHandles.lookup().defineClass(writer.toByteArray()).getDeclaredMethods())entries.put(method.getName(),method);
        try(var input=new BufferedReader(new InputStreamReader(System.in))){
            for(String line;(line=input.readLine())!=null;){
                String[] p=line.split(" ");String entry=p[0];mode=Integer.parseInt(p[1]);fail=Integer.parseInt(p[2]);
                boolean resize=Boolean.parseBoolean(p[3]);hi.f=301;fl.l=150;hd.m=1;uc.c=false;
                root=widget(65536,-1,1);child=widget(65537,root.Kc,2);dynamic=widget(65536,root.Kc,3);mounted=widget(131072,-1,4);
                original=new aj[]{root,null,child};linked=new aj[]{mounted};kids=root.pb=new aj[]{null,dynamic};alternate=new aj[]{child,mounted};
                root.ld=mode==1?0:123;root.jb=mode==1?0:94;
                fk.ab=new aj[][]{null,original,linked};rg.b=new boolean[]{false,true,true};va.Z=new nc(8);
                qd sub=new qd();sub.v=2;va.Z.a((byte)-89,mode==9?new jf():sub,root.Kc);
                if(mode==4)fk.ab=null;if(mode==5)fk.ab[1]=null;if(mode==8)va.Z=null;if(mode==10)root.Kc=-65536;
                aj subject=mode==14?null:entry.equals("component")&&(mode==1||mode==16)?child:root;
                trace=new StringJoiner(";");hits.clear();String status="ok";
                try{
                    switch(entry){
                        case "component" -> entries.get(entry).invoke(null,0,subject);
                        case "subcomponents" -> entries.get(entry).invoke(null,resize,subject,68);
                        case "group" -> entries.get(entry).invoke(null,resize,-23,(byte)91,49,1);
                        case "all" -> entries.get(entry).invoke(null,resize,false);
                    }
                }catch(InvocationTargetException e){
                    Throwable c=e.getCause();while(c instanceof g w)c=w.a;
                    status=c instanceof NullPointerException?"null":c instanceof IndexOutOfBoundsException?"bounds":
                        c instanceof ClassCastException?"cast":c instanceof IllegalArgumentException?"probe":c.getClass().getSimpleName();
                }
                var state=new StringJoiner(",");
                for(aj c:new aj[]{root,child,dynamic,mounted}){state.add(""+c.C);state.add(""+c.H);}
                System.out.println(status+"|"+trace+"|"+state);
            }
        }
    }
}
