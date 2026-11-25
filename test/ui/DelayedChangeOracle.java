import java.io.*;
import java.lang.invoke.*;
import java.net.Socket;
import java.util.*;
import jdk.internal.org.objectweb.asm.*;
import jdk.internal.org.objectweb.asm.tree.*;

class DelayedChangeOracle {
    // Execute the state-change loop from t.c(I)V without starting the network,
    // camera, audio, renderer and other game-tick subsystems surrounding it.
    static MethodHandle tickLoop() throws Exception {
        ClassNode body=new ClassNode();
        try(InputStream in=t.class.getResourceAsStream("/t.class")) {
            new ClassReader(in).accept(body,ClassReader.SKIP_FRAMES|ClassReader.SKIP_DEBUG);
        }
        MethodNode tick=body.methods.stream().filter(m->m.name.equals("c") && m.desc.equals("(I)V")).findFirst().orElseThrow();
        AbstractInsnNode start=null, end=null;
        int polls=0;
        for(AbstractInsnNode n : tick.instructions) {
            if(n instanceof MethodInsnNode m && m.owner.equals("we") && m.name.equals("a") && m.desc.equals("(I)Lce;")) {
                if(++polls==1) start=n.getPrevious();
            } else if(polls==2 && n.getOpcode()==Opcodes.IFNONNULL) { end=n; break; }
        }
        if(start==null || end==null) throw new AssertionError("missing poll loop");
        ClassWriter writer=new ClassWriter(ClassWriter.COMPUTE_MAXS);
        writer.visit(Opcodes.V1_5,Opcodes.ACC_PUBLIC,"DelayedChangeTick",null,"java/lang/Object",null);
        MethodVisitor method=writer.visitMethod(Opcodes.ACC_PUBLIC|Opcodes.ACC_STATIC,"run","()V",null,null);
        method.visitCode();
        method.visitFieldInsn(Opcodes.GETSTATIC,"client","wb","I");
        method.visitVarInsn(Opcodes.ISTORE,12);
        for(AbstractInsnNode n=start;;n=n.getNext()) {
            n.accept(method);
            if(n==end) break;
        }
        method.visitInsn(Opcodes.RETURN); method.visitMaxs(0,0); method.visitEnd(); writer.visitEnd();
        Class<?> loop=MethodHandles.lookup().defineClass(writer.toByteArray());
        return MethodHandles.lookup().findStatic(loop,"run",MethodType.methodType(void.class));
    }

    static void receive(int opcode,byte[] data) throws Exception {
        Socket s=new Socket() {
            public void setSoTimeout(int n) {}
            public void setTcpNoDelay(boolean enabled) {}
            public InputStream getInputStream(){return new ByteArrayInputStream(data);}
            public OutputStream getOutputStream(){return new ByteArrayOutputStream();}
        };
        ek.s=new se(s,null); o.Y=opcode; af.I=data.length;
        if(!rg.a((byte)57)) throw new AssertionError("unconsumed message "+opcode);
    }
    static String describe(ce n) {
        return n == null ? "-" : n.d(55)+","+n.c((byte)126)+","+n.H+","+n.S+","+n.L;
    }
    static void ordering() {
        wf.b(true);
        ce a=pi.a(15,false,7), b=pi.a(16,false,7), ignored=pi.a(17,false,1);
        boolean same=a==pi.a(15,false,7);
        a.e(0); a.b(true); b.b(true); ignored.e(0);
        System.out.println(same+" "+describe(we.a(-124))+" "+describe(we.a(-124)));
        a.v=Long.MIN_VALUE|1L; ignored.v=1L;
        System.out.println(describe(we.a(-124))+" "+describe(we.a(-124))+" "+(pi.a(15,false,7)==a));
        ce negative=pi.a(-2,false,13);
        System.out.println(describe(negative)+" "+(negative==pi.a(-2,false,1)));
        wf.b(true);
    }
    static String text(id value) {
        return value == null ? "-" : HexFormat.of().formatHex(value.b(false));
    }
    static void state(aj c) {
        int[] values={c.yc,c.xc,c.md,c.w,c.kc,c.nd,c.d,c.id,c.vd,c.db,c.hb,c.jc,c.Sb,c.Hc,c.Q,c.oc,
                c.Wc?1:0,c.Bc,c.Ec,c.ib,c.Mb,c.ub,c.m,c.Ac,c.P,od.U[15],lc.t,uc.i,sf.m[12]?1:0,jd.i};
        System.out.println(Arrays.toString(values)+" "+text(c.gb)+" "+text(me.a[15]));
    }
    static void events() {
        aj c=new aj();
        c.Kc=7; c.n=-1; c.y=c.i=true; c.ob=3;
        c.C=30; c.H=40; c.ib=4; c.Mb=5;
        c.J=new Object[]{1}; c.dc=new Object[]{2}; c.qc=new Object[]{3}; c.Lc=new Object[]{4};
        c.Zc=new Object[]{5}; c.Z=new Object[]{6}; c.x=new Object[]{7}; c.Gc=new Object[]{8};
        c.g=new Object[]{9}; c.W=new Object[]{10}; c.Tc=new Object[]{11}; c.Pb=new Object[]{12};
        c.V=new Object[]{13}; c.pc=new Object[]{14};
        c.U=c.sc=c.c=c.Rb=c.Qb=new int[]{90};
        lc.t=uc.i=qg.B=b.I=od.V=0;
        Arrays.fill(e.a,0);Arrays.fill(rg.o,0);Arrays.fill(ii.c,0);Arrays.fill(pa.zb,0);Arrays.fill(ld.d,0);
        ok.D=1; sc.T[0]=14; hd.i[0]=65;
        for(int step=0;step<5;step++) {
            int count=new int[]{1,32,33,2,0}[step];
            for(int i=0;i<count;i++){
                int value=step==3 ? 90 : 17;
                e.a[lc.t++ & 31]=value;rg.o[uc.i++ & 31]=value;ii.c[qg.B++ & 31]=value;pa.zb[b.I++ & 31]=value;ld.d[od.V++ & 31]=value;
            }
            sj.C=step<2?10:76;pf.Q=12;ca.a=step==0?1:0;
            oi.h=step==0?1:0;sa.x=9;oj.e=11;
            client.a(new aj[]{c},-1,0,0,100,100,0,0);
            ArrayList<String> events=new ArrayList<>();
            for(gk queue:new gk[]{db.s,ra.r,mi.q}) {
                for(wf event=(wf)queue.a(true); event!=null; event=(wf)queue.a(true)) {
                    events.add(event.G[0]+":"+event.D+":"+event.K+":"+event.x+":"+event.E+":"+event.v+":"+(event.C==c));
                }
            }
            System.out.println(c.sd+" "+c.o+" "+c.b+" "+c.rd+" "+c.Nc+" "+String.join(",",events));
        }
    }

    static void varcFaults(MethodHandle tick) throws Throwable {
        id text = vb.a("seed", (byte)54);
        for (int type : new int[]{1, 2}) {
            for (int size : new int[]{-1, 0, 2}) for (int length : new int[]{-1, 0, 1, 32}) {
                for (int index : new int[]{0, 1, 2}) for (int cursor : new int[]{-1, 0, 31, Integer.MAX_VALUE}) {
                    wf.b(true);
                    od.U = size < 0 ? null : new int[size];
                    me.a = size < 0 ? null : new id[size];
                    e.a = length < 0 ? null : new int[length];
                    rg.o = length < 0 ? null : new int[length];
                    lc.t = uc.i = cursor;
                    ce first = pi.a(index, false, type);
                    first.b(true);
                    first.H = 981;
                    first.O = text;
                    pi.a(8, false, 99).b(true);
                    String status = "ok";
                    try { tick.invokeExact(); }
                    catch (NullPointerException ex) { status = "null"; }
                    catch (ArrayIndexOutOfBoundsException ex) { status = "bounds"; }
                    System.out.println(status + " " + lc.t + " " + uc.i + " " + Arrays.hashCode(od.U) + " " +
                        (me.a != null && index < me.a.length && me.a[index] == text) + " " +
                        Arrays.hashCode(e.a) + " " + Arrays.hashCode(rg.o) + " " + describe(we.a(-124)));
                }
            }
        }
    }

    public static void main(String[] args) throws Throwable {
        ordering();
        MethodHandle tick=tickLoop();
        aj c=new aj();
        c.y=true; c.Kc=0; c.R=vk.db; c.vb=12; c.ob=0; c.G=64; c.jb=32; c.H=98;
        c.Sb=c.Q=c.Hc=8; fk.ab=new aj[][]{{c}}; rg.b=new boolean[]{true};
        te.g=new pb();
        kl obj=new kl(); obj.I=995; obj.gb=1234; obj.U=11; obj.P=22; obj.m=33; obj.u=-25; obj.q=37;
        fa.b.a(995L,obj,(byte)-71);
        od.U[15]=-1; jd.i=0;
        for(String command : args) {
            if(command.equals("tick")) { tick.invokeExact(); state(c); sf.m[12]=false; }
            else if(command.equals("old")) c.y=false;
            else if(command.equals("client")) { cf.a(0,false); nk.d(15,7931); }
            else if(command.equals("expire")) {
                for(ce pending=(ce)bb.k.a(104);pending!=null;pending=(ce)bb.k.a(true)) pending.v=(pending.v & Long.MIN_VALUE)|1L;
            } else {
                String[] parts=command.split("-",2);
                receive(Integer.parseInt(parts[0]),HexFormat.of().parseHex(parts[1]));
            }
        }
        events();
        varcFaults(tick);
    }
}
