import java.io.*;
import java.lang.reflect.*;
import java.nio.file.*;
import java.util.*;
import jdk.internal.org.objectweb.asm.*;

public class InterfaceEventOrderOracle {
    static final String[] hooks = "Pc Gc pc g W Tc Pb V J dc qc Lc Zc Z p u od K gd x nb".split(" ");
    static final String[] counters = "lc.t uc.i qg.B b.I od.V".split(" ");
    static final String[] rings = "e.a rg.o ii.c pa.zb ld.d".split(" ");
    static final String[] triggers = "U sc c Rb Qb".split(" ");
    static final String[] cursors = "sd o b rd Nc".split(" ");
    static aj widget;
    static gk main, exits, timers, alternate;
    static final Set<Object[]> installed=Collections.newSetFromMap(new IdentityHashMap<>());
    static String watch, target, action;
    static int at, reads;
    static final class Stop extends Error {}

    static Field field(String name) throws ReflectiveOperationException {
        int dot=name.indexOf('.');
        Field f=Class.forName(name.substring(0,dot)).getDeclaredField(name.substring(dot+1));
        f.setAccessible(true);
        return f;
    }
    public static void beforeRead(String name) throws ReflectiveOperationException {
        if(!name.equals(watch) || ++reads!=at)return;
        if(action.equals("throw"))throw new Stop();
        Field f=field(target);
        Object receiver=Modifier.isStatic(f.getModifiers())?null:widget;
        switch(action){
            case "null" -> f.set(receiver,null);
            case "hook" -> {Object[] value={999};installed.add(value);f.set(receiver,value);}
            case "queue" -> f.set(receiver,alternate);
            case "short" -> f.set(receiver,new int[1]);
            case "match" -> {int[] a=new int[32];Arrays.fill(a,42);f.set(receiver,a);}
            case "true","false" -> f.setBoolean(receiver,Boolean.parseBoolean(action));
            default -> f.setInt(receiver,Integer.parseInt(action));
        }
    }
    // Insert read callbacks without changing the original component, operand
    // stack or branch taken by client.a. The fixture observes this method only.
    static void instrument(Path dir,String owner,String descriptor)throws IOException{
        ClassReader reader;
        try(var input=InterfaceEventOrderOracle.class.getResourceAsStream("/"+owner+".class")){reader=new ClassReader(input);}
        ClassWriter writer=new ClassWriter(reader,ClassWriter.COMPUTE_MAXS);
        reader.accept(new ClassVisitor(Opcodes.ASM8,writer){
            public MethodVisitor visitMethod(int a,String n,String d,String sig,String[] ex){
                var original=super.visitMethod(a,n,d,sig,ex);
                if(!n.equals("a")||!d.equals(descriptor))return original;
                return new MethodVisitor(Opcodes.ASM8,original){
                    public void visitFieldInsn(int op,String owner,String name,String desc){
                        if(op==Opcodes.GETSTATIC || op==Opcodes.GETFIELD){
                            super.visitLdcInsn(owner+"."+name);
                            super.visitMethodInsn(Opcodes.INVOKESTATIC,"InterfaceEventOrderOracle","beforeRead","(Ljava/lang/String;)V",false);
                        }
                        super.visitFieldInsn(op,owner,name,desc);
                    }
                };
            }
        },0);
        Files.write(dir.resolve(owner+".class"),writer.toByteArray());
    }
    static void setup(int mode)throws Exception {
        widget=new aj();widget.Kc=47;widget.n=-1;widget.bc=-1;widget.ob=3;widget.y=widget.i=true;
        widget.ib=2;widget.Mb=3;widget.C=50;widget.H=40;widget.Sc=new l(0,-1);
        installed.clear();
        for(int i=0;i<hooks.length;i++){
            Object[] args={i+1};installed.add(args);field("aj."+hooks[i]).set(widget,args);
        }
        widget.ic=new Object[]{22};installed.add(widget.ic);
        widget.G=mode==7?50:19;widget.M=mode==7?40:21;
        int current=mode==3?1:mode==4?33:mode==5?Integer.MIN_VALUE+2:4;
        int previous=mode==2?Integer.MIN_VALUE:mode==3?-2:mode==5?Integer.MAX_VALUE-1:0;
        for(int i=0;i<5;i++){
            int[] values=new int[32];values[2]=42;values[31]=42;
            if(mode==2)values[0]=42;
            field(rings[i]).set(null,values);field(counters[i]).setInt(null,current);
            field("aj."+triggers[i]).set(widget,new int[]{73,42});field("aj."+cursors[i]).setInt(widget,previous);
        }
        main=mi.q=new gk();exits=ra.r=new gk();timers=db.s=new gk();alternate=new gk();
        widget.Xc=widget.Fc=mode==1;sj.C=mode==1?-8:8;pf.Q=12;sa.x=15;oj.e=16;
        ca.a=oi.h=mode==1?0:1;ie.F=false;ec.e=null;pe.T=vf.Y=null;sb.e=0;kf.l=3;
        bb.e=30;sb.c=uc.b=qe.N=pi.p=mf.l=9;widget.Mc=2;tk.a=true;
        ok.D=2;sc.T=new int[]{50,51};hd.i=new int[]{61,62};
    }
    static String queue(gk list){
        var events=new StringJoiner("/");
        for(wf e=(wf)list.a(true);e!=null;e=(wf)list.a(true)) {
            events.add((e.G==null?"-":installed.contains(e.G)?e.G[0]:"copy")+","+(e.C==widget?1:0)+","+(e.v?1:0)+","+e.D+","+e.K+","+e.x+","+e.E);
        }
        return events.toString();
    }
    static String summary(String outcome)throws Exception{
        var state=new StringJoiner(",");
        state.add(widget.Fc?"1":"0");state.add(widget.Xc?"1":"0");state.add(""+widget.Mc);state.add(""+widget.C);state.add(""+widget.H);
        for(String name:cursors)state.add(""+field("aj."+name).getInt(widget));
        return String.join(";",outcome,""+reads,state.toString(),queue(main),queue(exits),queue(timers),queue(alternate));
    }
    public static void main(String[] args)throws Exception{
        if(args.length!=0){
            instrument(Path.of(args[0]),"client","([Laj;IIIIIII)V");instrument(Path.of(args[0]),"pa","(Laj;IZII)V");return;
        }
        var input=new BufferedReader(new InputStreamReader(System.in));
        for(String line;(line=input.readLine())!=null;){
            String[] v=line.split(" ");int mode=Integer.parseInt(v[0]);setup(mode);
            watch=v[1];at=Integer.parseInt(v[2]);target=v[3];action=v[4];reads=0;
            String outcome="ok";
            try{
                if(mode>=6)pa.a(widget,100,mode!=8,100,2);
                else client.a(new aj[]{widget},-1,0,0,100,100,2,3);
            }
            catch(Stop stop){outcome="stop";}
            catch(RuntimeException err){
                Throwable cause=err;while(cause instanceof g wrapped && wrapped.a!=null)cause=wrapped.a;
                outcome=cause instanceof NullPointerException?"null":cause instanceof IndexOutOfBoundsException?"bounds":cause.getClass().getSimpleName();
            }
            System.out.println(summary(outcome));
        }
    }
}
