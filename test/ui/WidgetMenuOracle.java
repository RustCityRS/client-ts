import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.util.Arrays;
import java.lang.invoke.*;
import java.io.InputStream;
import jdk.internal.org.objectweb.asm.*;
import jdk.internal.org.objectweb.asm.tree.*;

final class WidgetMenuOracle {
    static id text(String value) { return aj.a(value,(byte)-100); }
    static id[] names(String... values) {
        id[] result = new id[values.length];
        for (int i=0;i<result.length;i++) result[i]=values[i]==null?null:text(values[i]);
        return result;
    }
    static int length(int slot,int damage,int family) { return damage==slot?(family==6?0:1):48; }
    static String failure(Throwable cause) {
        while(cause instanceof g wrapped && wrapped.a!=null) cause=wrapped.a;
        return cause instanceof NullPointerException?"null":cause instanceof IndexOutOfBoundsException?"bounds":cause.getClass().getSimpleName();
    }
    // gf.e(B)V bytes 0..107 build the cancel entry; the remaining method draws interfaces and the scene.
    static MethodHandle resetPrologue() throws Throwable {
        ClassNode source=new ClassNode();
        try(InputStream in=gf.class.getResourceAsStream("/gf.class")){new ClassReader(in).accept(source,ClassReader.SKIP_FRAMES|ClassReader.SKIP_DEBUG);}
        MethodNode method=source.methods.stream().filter(m->m.name.equals("e")&&m.desc.equals("(B)V")).findFirst().orElseThrow();
        ClassWriter writer=new ClassWriter(ClassWriter.COMPUTE_MAXS);
        writer.visit(Opcodes.V1_5,Opcodes.ACC_PUBLIC,"WidgetMenuReset",null,"java/lang/Object",null);
        MethodVisitor mv=writer.visitMethod(Opcodes.ACC_PUBLIC|Opcodes.ACC_STATIC,"run","()V",null,null);
        mv.visitCode();
        for(AbstractInsnNode n:method.instructions){
            if(n instanceof VarInsnNode v&&v.getOpcode()==Opcodes.ILOAD&&v.var==0)break;
            n.accept(mv);
        }
        mv.visitInsn(Opcodes.RETURN);mv.visitMaxs(0,0);mv.visitEnd();writer.visitEnd();
        return MethodHandles.lookup().findStatic(MethodHandles.lookup().defineClass(writer.toByteArray()),"run",MethodType.methodType(void.class));
    }
    public static void main(String[] args) throws Throwable {
        MethodHandle reset=resetPrologue();
        BufferedReader input=new BufferedReader(new InputStreamReader(System.in));
        id sentinel=text("sentinel");
        kl obj=new kl();obj.I=21;obj.s=text("item");fa.b.a(21L,obj,(byte)-71);
        for (String line;(line=input.readLine())!=null;) {
            int[] args0=Arrays.stream(line.split(" ")).mapToInt(Integer::parseInt).toArray();
            int family=args0[0],damage=args0[1],widgetDamage=args0[2],mode=args0[3],index=args0[4];
            ak.a=damage==-1?null:new id[length(1,damage,family)];ph.e=damage==-2?null:new id[length(2,damage,family)];
            ia.n=damage==-3?null:new int[length(3,damage,family)];p.u=damage==-4?null:new short[length(4,damage,family)];
            sa.z=damage==-5?null:new long[length(5,damage,family)];mh.h=damage==-6?null:new int[length(6,damage,family)];ml.x=damage==-7?null:new int[length(7,damage,family)];
            if(ak.a!=null)Arrays.fill(ak.a,sentinel);if(ph.e!=null)Arrays.fill(ph.e,sentinel);
            if(ia.n!=null)Arrays.fill(ia.n,-31);if(p.u!=null)Arrays.fill(p.u,(short)-32);if(sa.z!=null)Arrays.fill(sa.z,-33);
            if(mh.h!=null)Arrays.fill(mh.h,-34);if(ml.x!=null)Arrays.fill(ml.x,-35);
            aj c=new aj();c.Kc=0xabcde;c.bc=8;c.f=mode%7;c.ob=2;c.y=true;c.G=2;c.M=1;
            c.jd=widgetDamage==14?-32:widgetDamage==15?Integer.MAX_VALUE-40:0;c.ab=0;
            c.yb=widgetDamage==1?null:new int[widgetDamage==2?1:20];c.Gb=widgetDamage==3?null:new int[widgetDamage==4?1:20];
            c.Zb=widgetDamage==5?null:widgetDamage==6?new int[]{22}:new int[]{22,widgetDamage==13?0:22};
            c.Sc=widgetDamage==9?null:new l(widgetDamage==17?0:-1,-1);
            c.N=widgetDamage==17?new Object[0]:null;
            obj.vb=widgetDamage==7?names("Wear","Eat"):widgetDamage==16?null:names("Wear",null,"Take","Rub","Drop");
            c.j=widgetDamage==8?names("Zero","One"):names("Zero",null,"Two",null,"Four");
            c.Yc=names("First"," ","Third",null,"Fifth",null,"Seven","Eight","Nine","Last");
            c.r=text("base");c.Tb=text("target");c.fc=text("button");c.E=text("use");
            c.v=new int[]{314,315,316,317,318,319};
            if(widgetDamage==10){c.Yc[9].A=null;}
            if(widgetDamage==11){c.E.A=null;}
            ca.g=null;hg.f=null;oj.i=-8;aa.e=53;gl.C=64;ce.D=66;me.P=67;
            le.c=(mode&4)==0?0:1;ok.r=(mode&8)!=0;pj.C=48;oh.a=-1;ti.X=c.Kc;ph.h=0;
            ge.Z=text("selected");al.s=text("cast");t.W=text("spell");uc.c=(mode&2)!=0;kl.p=(mode&1)!=0;
            vb.o=family>=2?0:index;ie.F=(mode&16)!=0;
            ve.g=51;ud.j=-52;pk.k=mode&3;g.n=41;ef.J=-42;oi.h=(mode&4)==0?0:1;sa.x=61;oj.e=-62;sj.C=71;pf.Q=-72;
            if(family>=6)vb.o=widgetDamage;
            if(family>=7)for(int i=0;i<48;i++){
                if(ak.a!=null&&i<ak.a.length)ak.a[i]=text("o"+i);if(ph.e!=null&&i<ph.e.length)ph.e[i]=text("t"+i);
                if(ia.n!=null&&i<ia.n.length)ia.n[i]=100+i;if(p.u!=null&&i<p.u.length)p.u[i]=(short)new int[]{30,1001,1000,12,1002,0}[i%6];
                if(sa.z!=null&&i<sa.z.length)sa.z[i]=(1L<<48)+i;if(mh.h!=null&&i<mh.h.length)mh.h[i]=1000+i;if(ml.x!=null&&i<ml.x.length)ml.x[i]=-1000-i;
            }
            String fault="ok";int result=-1;
            try {
                switch(family) {
                    case 6 -> reset.invokeExact();
                    case 7 -> ti.f(-62);
                    case 8 -> vk.a(index,(mode&1)!=0);
                    case 0 -> tb.a((byte)125,sentinel,(short)32760,text("option"),-127,359,0x708090aabbccddeeL,(mode&1)==0?-1:17);
                    case 1 -> sf.a(0,(mode&1)==0?32:0,-1,widgetDamage==12?null:c);
                    case 2 -> result=Arrays.hashCode(fl.a(widgetDamage==16?null:obj.vb,index));
                    case 3 -> {id value=rg.a(index,0,widgetDamage==12?null:c);result=value==null?0:value.hashCode();}
                    case 4 -> result=ci.a((byte)-121,widgetDamage==12?null:c,index);
                    case 5 -> {id value=gi.a(320,widgetDamage==12?null:c);result=value==null?0:value.hashCode();}
                }
            } catch(RuntimeException error){fault=failure(error);}
            System.out.println(fault+" "+result+" "+vb.o+" "+(hg.f==c)+" "+oj.i+" "+Arrays.hashCode(ak.a)+" "+Arrays.hashCode(ph.e)+" "+Arrays.hashCode(ia.n)+" "+Arrays.hashCode(p.u)+" "+Arrays.hashCode(sa.z)+" "+Arrays.hashCode(mh.h)+" "+Arrays.hashCode(ml.x)+" "+ve.g+" "+ud.j);
        }
    }
}
