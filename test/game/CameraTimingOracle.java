import java.io.*;
import java.lang.invoke.MethodHandles;
import java.lang.reflect.*;
import java.util.*;
import jdk.internal.org.objectweb.asm.*;
import jdk.internal.org.objectweb.asm.tree.*;

public class CameraTimingOracle {
    static boolean field(AbstractInsnNode n,String owner,String name){
        return n instanceof FieldInsnNode && n.getOpcode()==Opcodes.GETSTATIC && ((FieldInsnNode)n).owner.equals(owner) && ((FieldInsnNode)n).name.equals(name);
    }
    static boolean method(AbstractInsnNode n,String owner,String name,String desc){
        return n instanceof MethodInsnNode && ((MethodInsnNode)n).owner.equals(owner) && ((MethodInsnNode)n).name.equals(name) && ((MethodInsnNode)n).desc.equals(desc);
    }
    static void faults(Method report) throws Exception {
        var lines = new BufferedReader(new InputStreamReader(System.in));
        for(String line; (line=lines.readLine())!=null;) {
            int[] v=Arrays.stream(line.split(" ")).mapToInt(Integer::parseInt).toArray();
            int phase=v[0], length=v[2], count=v[3], key=v[4];
            te.g=v[7]==0?null:new pb();
            if(te.g!=null){te.g.Z=12;te.g.S=32;}
            client.nb=3;gg.C=6;pg.H=1000;ai.f=-600;
            hc.a=v[1]!=0;ok.D=count;sc.T=length<0?null:new int[length];
            ob.q=length<0?null:new boolean[length];
            if(length>0)sc.T[0]=key;
            if(key>=0&&key<length)ob.q[key]=true;
            cf.a=11;ok.A=13;pd.s=289;df.B=1976;pg.V=49001;ci.c=v[8];tj.i=v[9]!=0;
            qk.v.fb=new byte[v[5]];Arrays.fill(qk.v.fb,(byte)0xa5);
            qk.v.yb=v[6];qk.v.a(new int[]{1,22,4,8},-1);
            String fault="-";
            try {
                if(phase==0)report.invoke(null);else sf.a((byte)110);
            } catch(Throwable err){
                while(err instanceof InvocationTargetException || err instanceof g) {
                    err=err instanceof InvocationTargetException?err.getCause():((g)err).a;
                }
                fault=err instanceof NullPointerException?"null":err instanceof IndexOutOfBoundsException?"bounds":err.getClass().getSimpleName();
            }
            int cursor=qk.v.yb;String bytes=HexFormat.of().formatHex(qk.v.fb);
            qk.v.fb=new byte[1];qk.v.yb=0;qk.v.k(2,251);
            System.out.println(fault+" "+ci.c+" "+tj.i+" "+cursor+" "+bytes+" "+(qk.v.fb[0]&255)+" "+pg.H+" "+ai.f+" "+pd.s+" "+df.B+" "+cf.a+" "+ok.A+" "+pg.V);
        }
    }
    // Keep Jagex's actual bytecode and branch labels for the three camera-only blocks.
    // The surrounding game loop requires AWT input, applet lifecycle, GL, drawing and many unrelated archives.
    static void copy(ClassWriter cw,String name,String owner,String original,String desc,
        java.util.function.Predicate<AbstractInsnNode> begin,java.util.function.Predicate<AbstractInsnNode> stop,boolean view)throws Exception{
        ClassNode c=new ClassNode();
        try(InputStream in=CameraTimingOracle.class.getResourceAsStream("/"+owner+".class")){new ClassReader(in).accept(c,0);}
        MethodNode m=c.methods.stream().filter(n->n.name.equals(original)&&n.desc.equals(desc)).findFirst().orElseThrow();
        AbstractInsnNode[] list=m.instructions.toArray();int start=0,end=0;
        while(start<list.length&&!begin.test(list[start]))start++;
        if(start==list.length)throw new AssertionError("start "+name);
        // mc.U is also incremented near the start of t.c's drift block.
        for(end=start+1;end<list.length;end++)if(stop.test(list[end])&&(!name.equals("drift")||end>start+100))break;
        if(end==list.length)throw new AssertionError("end "+name);
        MethodNode out=new MethodNode(Opcodes.ACC_PUBLIC|Opcodes.ACC_STATIC,name,"()V",null,null);
        InsnList body=out.instructions;
        if(view){
            body.add(new IntInsnNode(Opcodes.BIPUSH,118));body.add(new VarInsnNode(Opcodes.ISTORE,0));
            body.add(new IntInsnNode(Opcodes.SIPUSH,334));body.add(new VarInsnNode(Opcodes.ISTORE,1));
        }
        body.add(new InsnNode(Opcodes.ICONST_0));body.add(new VarInsnNode(Opcodes.ISTORE,view?16:12));
        LabelNode finish=new LabelNode();Map<LabelNode,LabelNode> labels=new HashMap<>();
        for(int i=0;i<list.length;i++)if(list[i] instanceof LabelNode)labels.put((LabelNode)list[i],i>=start&&i<end?new LabelNode():finish);
        for(int i=start;i<end;i++)if(!(list[i] instanceof LineNumberNode)&&!(list[i] instanceof FrameNode))body.add(list[i].clone(labels));
        if(view)body.add(new InsnNode(Opcodes.POP)); // argument for the next il.b(Z)V, outside the extracted camera code
        body.add(finish);body.add(new InsnNode(Opcodes.RETURN));out.accept(cw);
    }
    public static void main(String[] args)throws Exception{
        ClassWriter cw=new ClassWriter(ClassWriter.COMPUTE_FRAMES|ClassWriter.COMPUTE_MAXS);
        cw.visit(Opcodes.V1_8,Opcodes.ACC_PUBLIC,"CameraBlocks530",null,"java/lang/Object",null);
        copy(cw,"report","t","c","(I)V",n->field(n,"ci","c"),n->field(n,"wg","g"),false);
        copy(cw,"drift","t","c","(I)V",n->field(n,"kf","q"),n->field(n,"mc","U"),false);
        copy(cw,"view","kk","a","(BIIIIZ)V",n->field(n,"cl","e"),n->method(n,"il","b","(Z)V"),true);
        cw.visitEnd();Class<?> blocks=MethodHandles.lookup().defineClass(cw.toByteArray());
        Field rng=Class.forName("java.lang.Math$RandomNumberGeneratorHolder").getDeclaredField("randomNumberGenerator");rng.setAccessible(true);((Random)rng.get(null)).setSeed(60733);
        te.g=new pb();te.g.Z=16;te.g.S=25;ah.f=0;ve.q=null;qk.v.a(new int[]{1,2,3,4},0);
        cl.e=1;client.nb=-52;gg.C=56;df.B=523;gi.n=39;kk.db=11;ag.e=59;pg.H=6712;ai.f=5820;pd.s=185;pg.V=51200;
        for(int i=0;i<5;i++){qh.h[i]=true;lj.f[i]=17*i+8;fa.n[i]=71+i*8;ll.d[i]=i*54+26;cd.f[i]=i*15+8;}
        Method drift=blocks.getMethod("drift"),report=blocks.getMethod("report"),view=blocks.getMethod("view");
        if(args.length>0){faults(report);return;}
        // Resolve initializers before seeding the two deterministic inputs.
        hc.a=false;Arrays.fill(ob.q,false);ok.D=0;sc.T[0]=97;
        view.invoke(null);report.invoke(null);drift.invoke(null);
        ci.c=0;tj.i=true;kf.q=0;vf.P=0;qk.v.a(new int[]{1,2,3,4},0);
        ((Random)rng.get(null)).setSeed(60733);
        for(int t=0;t<2408;t++){
            hc.a=(t/111)%2!=0;Arrays.fill(ob.q,false);ob.q[96]=t%31==5;ob.q[99]=t%73<9;
            ok.D=t%33==11?2:0;sc.T[0]=97;sc.T[1]=100;
            qk.v.yb=0;report.invoke(null);for(int i=0;i<5;i++)cd.f[i]++;drift.invoke(null);
            if(t%11==0){view.invoke(null);}
            System.out.println(client.nb+" "+gg.C+" "+gi.n+" "+kk.db+" "+ag.e+" "+ci.c+" "+tj.i+" "+java.util.HexFormat.of().formatHex(qk.v.fb,0,qk.v.yb)+"|"+
                (t%11==0?rk.m+","+mf.i+","+ud.g+","+bd.X+","+qj.w:"-"));
        }
    }
}
