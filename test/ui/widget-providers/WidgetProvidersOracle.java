import java.io.*;
import java.lang.reflect.Field;
import java.nio.file.*;
import java.util.*;
import java.util.jar.*;
import jdk.internal.org.objectweb.asm.*;

// The normal run uses the untouched gamepack, including both JS5 archives,
// sprite decoding, transformations, mask building, model lighting and caches.
// In the field-observation run the JAR still performs each field read. A
// probe placed immediately afterwards can replace the next read's reference.
public class WidgetProvidersOracle {
    static Path root;
    static String mode;
    static aj widget;
    static ve initial, replacement;
    static final Map<Integer,db> indexes=new HashMap<>();
    static final StringJoiner[] events={new StringJoiner(";")};
    static final IdentityHashMap<Object,Integer> identities=new IdentityHashMap<>();
    static final int[] originalMask={-7,4};
    static int statics,starts,widths;
    static final ek sequence=new ek();
    static final cl player=new cl();
    static final ja npc=new ja();
    static final kl object=new kl();
    static final fc model=new fc();
    static void instrument(String jar,Path destination)throws Exception {
        try(JarFile jf=new JarFile(jar)){
            ClassReader reader=new ClassReader(jf.getInputStream(jf.getJarEntry("aj.class")));
            ClassWriter writer=new ClassWriter(0);
            reader.accept(new ClassVisitor(Opcodes.ASM8,writer){
                public MethodVisitor visitMethod(int access,String name,String desc,String sig,String[] ex){
                    MethodVisitor mv=super.visitMethod(access,name,desc,sig,ex);
                    if(!(name.equals("a")&&desc.equals("(I)Z") || (name.equals("b")||name.equals("c"))&&desc.equals("(ZI)Lvc;") ||
                        name.equals("a")&&desc.equals("(Lcl;IIZIZLek;)Lnd;")))return mv;
                    return new MethodVisitor(Opcodes.ASM8,mv){
                        public void visitMethodInsn(int op,String owner,String name,String desc,boolean iface){
                            String call=switch(owner+"."+name+desc){
                                case "uk.a(II)Lja;" -> "npcDef";
                                case "rg.a(II)Lkl;" -> "objDef";
                                case "ek.a(IILnd;II)Lnd;" -> "animate";
                                case "ja.a(Lek;IIII)Lnd;" -> "npcHead";
                                case "cl.a(IILek;II)Lnd;" -> "playerHead";
                                case "kl.a(Lek;IIIII)Lnd;" -> "objModel";
                                case "ja.a([Lci;ILek;IIIBIILek;)Lnd;" -> "npcBody";
                                case "cl.a(Lek;IIIIIBI)Lnd;" -> "kitHead";
                                default -> null;
                            };
                            if(call==null)super.visitMethodInsn(op,owner,name,desc,iface);
                            else super.visitMethodInsn(Opcodes.INVOKESTATIC,"WidgetProvidersOracle",call,
                                op==Opcodes.INVOKESTATIC?desc:"(L"+owner+";"+desc.substring(1),false);
                        }
                        public void visitFieldInsn(int op,String owner,String field,String type){
                            super.visitFieldInsn(op,owner,field,type);
                            if(op==Opcodes.GETSTATIC && (owner.equals("bj")&&field.equals("b") || owner.equals("gf")&&field.equals("S")))
                                super.visitMethodInsn(Opcodes.INVOKESTATIC,"WidgetProvidersOracle","cache","(Lve;)Lve;",false);
                            if(op==Opcodes.GETFIELD && owner.equals("aj") && (field.equals("s")||field.equals("ud")))
                                super.visitMethodInsn(Opcodes.INVOKESTATIC,"WidgetProvidersOracle",field.equals("s")?"start":"width","([I)[I",false);
                        }
                    };
                }
            },0);
            Files.write(destination.resolve("aj.class"),writer.toByteArray());
        }
    }
    static ja npcDef(int id,int guard){events[0].add("npc:"+id);return npc;}
    static kl objDef(int id,int guard){events[0].add("obj:"+id);return object;}
    static nd delegate(String call,Object... args){
        StringJoiner trace=new StringJoiner(",");trace.add(call);
        for(Object value:args)trace.add(value==sequence?"seq":value==player?"player":value==object?"obj":value==npc?"npc":
            value instanceof nd?"model":Objects.toString(value));
        events[0].add(trace.toString());
        if(mode.equals("delegate-throw"))throw new IllegalStateException();
        return mode.equals("delegate-null")?null:model;
    }
    static nd animate(ek s,int a,int b,nd m,int guard,int c){return delegate("anim",s,a,b,m,c);}
    static nd npcHead(ja n,ek s,int a,int guard,int b,int c){return delegate("head-n",n,s,a,b,c);}
    static nd playerHead(cl p,int a,int b,ek s,int c,int guard){return delegate("head-p",p,a,b,s,c);}
    static nd objModel(kl obj,ek s,int a,int guard,int b,int c,int d){return delegate("obj-model",obj,s,a,b,c,d);}
    static nd npcBody(ja n,ci[] slots,int a,ek s,int b,int c,int d,byte guard,int e,int f,ek t){
        return delegate("body",n,slots,a,s,b,c,d,e,f,t);
    }
    static nd kitHead(cl p,ek s,int a,int b,int c,int d,int e,byte guard,int f){
        return delegate("kit",p,s,a,b,c,d,e,f);
    }
    static ve cache(ve captured){
        events[0].add("cache"+(++statics));
        if(mode.equals("cache-read")&&statics==1){gf.S=bj.b=replacement;}
        if(mode.equals("put-read")&&statics==2){gf.S=bj.b=null;}
        return captured;
    }
    static int[] start(int[] captured){
        events[0].add("start"+(++starts));
        if(mode.equals("start-read")&&starts==2) widget.s=new int[0];
        return captured;
    }
    static int[] width(int[] captured){
        events[0].add("width"+(++widths));
        if(mode.equals("width-read")&&widths==1)widget.ud=null;
        return captured;
    }
    static byte[] file(String name){
        try{return Files.readAllBytes(root.resolve(name));}catch(IOException e){throw new UncheckedIOException(e);}
    }
    static void dropArchives(){h.f=null;kk.R=null;}
    static class Provider extends ud {
        final int archive;
        Provider(int archive){this.archive=archive;}
        void event(String tag){
            events[0].add(tag+":"+rk.o);
            if(tag.startsWith("g")){
                switch(mode){
                    case "swap" -> {gf.S=bj.b=replacement;widget.mb=169;widget.w=1;widget.Dc=13579;widget.Kb=!widget.Kb;}
                    case "drop-cache" -> gf.S=bj.b=null;
                    case "replace-mask" -> {widget.s=originalMask;widget.ud=originalMask;}
                    case "set-flag" -> rk.o=true;
                }
            }
            if(mode.equals("drop-archive")&&tag.startsWith("i"))dropArchives();
        }
        db b(int guard){event("i"+archive);return mode.equals("no-index")?null:indexes.get(archive);}
        byte[] a(int guard,int group){
            event("g"+archive+"."+group);
            if(mode.equals("missing"))return null;
            if(mode.equals("corrupt"))return new byte[]{0,0,0,0,1,0};
            if(archive==8 && !mode.equals("real"))return file("synthetic");
            return file(archive+"-"+group);
        }
        int c(int group,int guard){throw new AssertionError("percentage");}
        void b(int guard,int group){throw new AssertionError("prefetch");}
    }
    static int id(Object value){
        return value==null?0:identities.computeIfAbsent(value,key->identities.size()+1);
    }
    static String numbers(int[] a){
        if(a==null)return "~";
        StringJoiner s=new StringJoiner(",");for(int n:a)s.add(""+n);return s.toString();
    }
    static String spriteOrModel(Object value){
        if(value==null)return "~";
        if(value instanceof Boolean b)return b.toString();
        if(value instanceof rh p)return (p instanceof vh?"alpha":"rgb")+","+id(p)+","+p.F+","+p.C+","+p.O+","+p.D+
            ","+p.B+","+p.A+","+numbers(p.I);
        if(value instanceof fc p)return "model,"+id(p)+","+p.b();
        return "wrong";
    }
    static long graphicKey(int id){
        return ((long)widget.Dc<<40)+((widget.Kb?1L:0L)<<38)+((long)widget.tc<<36)+
            ((widget.Xb?1L:0L)<<35)+id+((widget.fb?1L:0L)<<39);
    }
    static String describeArray(int[] array){return (array==originalMask?"old:":"")+numbers(array);}
    static void run(String[] a)throws Exception{
        int op=Integer.parseInt(a[0]),argument=Integer.parseInt(a[2]),flags=Integer.parseInt(a[3]),outline=Integer.parseInt(a[4]);
        int shadow=Integer.parseInt(a[5]),type=Integer.parseInt(a[6]);
        boolean active=(flags&8)!=0,seedFlag=(flags&16)!=0;
        mode=a[1];widget=new aj();identities.clear();statics=starts=widths=0;
        widget.Kb=(flags&1)!=0;widget.fb=(flags&2)!=0;widget.Xb=(flags&4)!=0;
        widget.Dc=shadow;widget.tc=outline;widget.mb=active?169:argument;widget.lc=active?argument:169;
        widget.md=active?5:type;widget.w=active?1:argument;
        Field onType=aj.class.getDeclaredField("zb"),onId=aj.class.getDeclaredField("O");
        onType.setAccessible(true);onId.setAccessible(true);onType.setInt(widget,active?type:5);onId.setInt(widget,active?argument:1);
        boolean delegated=mode.startsWith("delegate");
        if(delegated&&type==7){widget.w=0x1234abcd;widget.kc=-37812;}
        widget.lb=mode.equals("null-slots")?null:new int[]{-1,argument};
        if(mode.equals("cached-mask"))widget.s=originalMask;
        if(mode.equals("old-width"))widget.ud=originalMask;
        initial=bj.b=gf.S=new ve(10);replacement=new ve(10);
        if(mode.equals("null-cache"))gf.S=bj.b=null;
        long key=op==1?graphicKey(argument):op==3?(long)(argument+(type<<16)):argument;
        if(mode.equals("hit")||mode.equals("poison"))initial.a(key,
            mode.equals("poison")?new Object():op==3?new fc():new rh(1,2),(byte)-71);
        h.f=mode.equals("null-archive")?null:new al(new Provider(8),true,true);
        kk.R=mode.equals("null-archive")?null:new al(new Provider(7),true,true);
        rk.o=true;
        for(int repeat=0;repeat<2;repeat++){
            events[0]=new StringJoiner(";");
            String fault="ok";Object result=null;
            try {
                result=switch(op) {
                    case 0 -> widget.a(22710);
                    case 1 -> mode.equals("shared")&&repeat==1?widget.b(true,1):widget.c(active,-72);
                    case 2 -> widget.b(true,mode.equals("below-slot")?-1:mode.equals("above-slot")?2:1);
                    case 3 -> widget.a(delegated?player:null,23,7,active,11,seedFlag,delegated?sequence:null);
                    default -> throw new AssertionError();
                };
            }catch(RuntimeException e){
                Throwable cause=e;while(cause instanceof g w)cause=w.a;
                if(cause instanceof NullPointerException)fault="null";
                else if(cause instanceof IndexOutOfBoundsException)fault="bounds";
                else if(cause instanceof ClassCastException)fault="cast";
                else if(cause instanceof IllegalStateException)fault="probe";
                else if(cause instanceof NegativeArraySizeException)fault="negative";
                else throw e;
            }
            System.out.println(String.join("/",fault,""+rk.o,spriteOrModel(result),describeArray(widget.s),
                describeArray(widget.ud),""+id(initial.a(key,false)),""+id(replacement.a(key,false)),events[0].toString()));
        }
    }
    public static void main(String[] args)throws Exception{
        if(args.length==2){instrument(args[0],Path.of(args[1]));return;}
        root=Path.of(args[0]);
        // The model-0 cache asset has textured faces. Its lighting constructor
        // asks only pc.b(II)Z for texture availability and never samples texels.
        dc.r=(pc)java.lang.reflect.Proxy.newProxyInstance(pc.class.getClassLoader(),new Class<?>[]{pc.class},
            (proxy,method,argv)->{if(method.getName().equals("b"))return true;throw new AssertionError(method);});
        for(int arc:new int[]{7,8}){
            byte[] bytes=file("255-"+arc);indexes.put(arc,new db(bytes,q.a(0,bytes,bytes.length)));
        }
        BufferedReader input=new BufferedReader(new InputStreamReader(System.in));
        for(String row;(row=input.readLine())!=null;)run(row.split(" "));
    }
}
