import java.lang.reflect.*;
import java.nio.file.*;
import java.util.*;
import java.util.jar.*;
import jdk.internal.org.objectweb.asm.*;

class LogoutOracle {
    static int titleCalls;
    static Field field(Class<?> owner,String name) throws Exception {
        Field field=owner.getDeclaredField(name);
        field.setAccessible(true);
        return field;
    }
    public static void title(int dummy, boolean clear) { titleCalls++; tf.C=10; }
    static void prepare(Path jar, Path dir) throws Exception {
        try(JarFile source=new JarFile(jar.toFile())) {
            ClassReader reader=new ClassReader(source.getInputStream(source.getJarEntry("ig.class")));
            ClassWriter writer=new ClassWriter(0);
            reader.accept(new ClassVisitor(Opcodes.ASM8,writer) {
                public MethodVisitor visitMethod(int a,String name,String desc,String sig,String[] errors) {
                    MethodVisitor original=super.visitMethod(a,name,desc,sig,errors);
                    if(!name.equals("b") || !desc.equals("(I)V")) return original;
                    return new MethodVisitor(Opcodes.ASM8,original) {
                        public void visitMethodInsn(int op,String owner,String n,String d,boolean itf) {
                            // vb.a is covered separately. Observe the point at which ig hands off to the title UI.
                            if(owner.equals("vb") && n.equals("a") && d.equals("(IZ)V")) super.visitMethodInsn(op,"LogoutOracle","title",d,false);
                            else super.visitMethodInsn(op,owner,n,d,itf);
                        }
                    };
                }
            },0);
            Files.write(dir.resolve("ig.class"),writer.toByteArray());
        }
    }
    public static void main(String[] args) throws Exception {
        if(args[0].equals("prepare")) { prepare(Path.of(args[1]),Path.of(args[2]));return; }
        if(args[0].equals("scene")) {
            tg.x=qi.Y=1;
            ra square=new ra(0,0,0);
            na.G=new ra[][][]{{{square}}}; vf.V=new ra[][][]{{{square}}};
            jg occluder=new jg(); ll.c=new jg[]{occluder}; mc.P=1;
            ec sprite=new ec(); pa.xb=new ec[]{sprite,sprite}; ah.i=1; dg.v=new ec[]{sprite,sprite};
            ng.e();
            System.out.println(String.join("/", ""+(na.G[0][0][0]==null),""+(vf.V[0][0][0]==null),
                ""+mc.P,""+(ll.c[0]==occluder),""+ah.i,""+(pa.xb[0]==null),""+(pa.xb[1]==sprite),""+Arrays.stream(dg.v).allMatch(Objects::isNull)));
            return;
        }
        String mode=args[0]; oi.e=Integer.parseInt(args[1]); tf.C=30;
        tg.x=qi.Y=1;ra tile=new ra(0,0,0);na.G=new ra[][][]{{{tile}}};vf.V=new ra[][][]{{{tile}}};
        jg occluder=new jg();ll.c=new jg[]{occluder};mc.P=1;
        ec sprite=new ec();pa.xb=new ec[]{sprite,sprite};ah.i=1;dg.v=new ec[]{sprite,sprite};
        se stream=ek.s=new se(new GameProtocolOracle.Peer(),null);
        al[] archives=new al[11]; Field unpacked=al.class.getDeclaredField("O");unpacked.setAccessible(true);
        Field packed=al.class.getDeclaredField("w");packed.setAccessible(true);
        Object sentinel=new byte[]{1,2,3};
        for(int i=0;i<11;i++) {
            archives[i]=new al(new GameProtocolOracle.EmptyAssets(null),false,false);
            unpacked.set(archives[i],new Object[][]{{sentinel}});
            packed.set(archives[i],new Object[]{sentinel});
        }
        uh.O=archives[0];bc.c=archives[1];dd.l=archives[2];rg.m=archives[3];re.d=archives[4];al.l=archives[5];
        rk.k=archives[6];h.i=archives[7];ek.D=archives[8];gd.E=archives[9];il.B=archives[10];
        al materials=new al(new GameProtocolOracle.EmptyAssets(HexFormat.of().parseHex("00000000020000")),false,false);
        kg provider=new kg(archives[0],materials,archives[0],4,false);
        vj primary=(vj)field(kg.class,"k").get(provider), secondary=mode.equals("aliased")?primary:new vj(7);
        vj[] caches={primary,secondary};
        ei[] nodes={new ei(),new ei()};
        primary.a(37L,0,nodes[0]); secondary.a(49L,0,nodes[1]);
        Field sentinelField=field(vj.class,"e");
        Object[] oldSentinels={sentinelField.get(primary),sentinelField.get(secondary)};
        if(Set.of("secondary","aliased","badSecondary").contains(mode))field(kg.class,"J").set(provider,secondary);
        if(mode.equals("badPrimary"))field(kg.class,"k").set(provider,null);
        if(mode.equals("badSecondary"))field(vj.class,"j").set(secondary,null);
        dc.r=mode.equals("nullProvider")?null:mode.equals("wrongProvider")?(pc)Proxy.newProxyInstance(pc.class.getClassLoader(),
            new Class<?>[]{pc.class},(proxy,method,values)->{throw new AssertionError("unexpected pc method");}):provider;
        fg font=new fg(new byte[257]); m script=new m();
        fa.p.a(9L,font,(byte)-71); sf.g.a(9L,0,script);
        for(int level=0;level<4;level++) { hc.c[level]=new ke(104,104);hc.c[level].d[25][25]=123; }
        ke[] maps=hc.c.clone();
        oh.g=new byte[50][]; oh.g[2]=new byte[1]; vg.Q=3; jd.i=43; qc.Z=true;
        gf.Z.a(9L,sentinel,(byte)-71); ak.d.a(9L,sentinel,(byte)-71); wk.o.a(9L,sentinel,(byte)-71);
        ve.t[3]=new kf(); qg.G=true; gl.z=6; ic.T=7; ic.V=421; ah.k=429; hk.e=3000;vj.t=3100;
        sa.w=53;hj.d=true;dd.n=3;ng.B=0;hj.i=99;ra.R=47;
        tf.J[15]=new pb(); d.d[15]=new gd(4);uc.l[32767]=new bk(); fe.R=12;ed.d=14;
        b.H[3][103][103]=new gk();qa.P=mf.q=4;Arrays.fill(qh.h,true);cl.e=3;hd.m=-1;
        Object varpChanges=db.p;
        if(mode.equals("badArchive"))ek.D=null;
        if(mode.equals("badCollision"))hc.c[2]=null;
        String outcome="ok";
        try { ig.b(106); } catch(RuntimeException expected) {
            Throwable cause=expected;
            while(cause instanceof g wrapped)cause=wrapped.a;
            if(cause instanceof ClassCastException)outcome="cast";
            else if(cause instanceof NullPointerException)outcome="null";
            else throw expected;
        }
        StringJoiner result=new StringJoiner("/");
        for(Object value:new Object[]{outcome,titleCalls,tf.C,jd.i,qc.Z,qg.G,ic.V,ah.k,hk.e,vj.t,gl.z,ic.T,sa.w,
            hj.d,dd.n,ng.B,hj.i,ra.R,ve.t[3]==null,tf.J[15]==null,d.d[15]==null,uc.l[32767]==null,
            fe.R,ed.d,b.H[3][103][103]==null,qa.P,mf.q,cl.e,Arrays.hashCode(qh.h),
            oh.g[2]==null,vg.Q,gf.Z.a(9L,false)==sentinel,ak.d.a(9L,false)==sentinel,wk.o.a(9L,false)==sentinel,
            ek.s==null,GameProtocolOracle.field("m").getBoolean(stream),db.p==varpChanges,
            na.G[0][0][0]==null,vf.V[0][0][0]==null,mc.P,ll.c[0]==occluder,ah.i,pa.xb[0]==null,pa.xb[1]==sprite,
            Arrays.stream(dg.v).allMatch(Objects::isNull)}) result.add(String.valueOf(value));
        for(ke map:maps)result.add(String.valueOf(map.d[25][25]));
        for(al archive:archives) {
            result.add(String.valueOf(((Object[][])unpacked.get(archive))[0]==null));
            result.add(String.valueOf(((Object[])packed.get(archive))[0]==sentinel));
        }
        result.add(""+(fa.p.a(9L,false)==font));result.add(""+(sf.g.a(261775,9L)==script));
        for(int i=0;i<caches.length;i++) {
            result.add(""+(sentinelField.get(caches[i])==oldSentinels[i]));
            result.add(""+field(vj.class,"n").getInt(caches[i]));
            result.add(""+(nodes[i].p==null));result.add(""+(nodes[i].z==null));
        }
        System.out.println(result);
    }
}
