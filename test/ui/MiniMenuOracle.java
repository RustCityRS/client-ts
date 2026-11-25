import java.util.*;
import java.io.*;
import java.lang.invoke.*;
import jdk.internal.org.objectweb.asm.*;
import jdk.internal.org.objectweb.asm.tree.*;

class MiniMenuOracle {
    static final int GROUP=0x19b,ID=GROUP<<16,OBJ=0x95b1;
    static aj c;
    static String text(id s){return s==null?"-":HexFormat.of().formatHex(s.A,0,s.c);}
    static int hash(int h,String val){return 31*h+val.hashCode();}
    static String entries(){
        int h=1;
        for(int i=0;i<vb.o;i++){
            h=hash(h,text(ak.a[i]));h=hash(h,text(ph.e[i]));h=hash(h,text(ja.a(i,(byte)121)));
            for(long v:new long[]{p.u[i],ia.n[i],mh.h[i],ml.x[i],sa.z[i]}){h=31*h+(int)v;h=31*h+(int)(v>>>32);}
        }
        return vb.o+","+h;
    }
    static id str(String s){return vb.a(s,(byte)60);}
    static void begin(){
        vb.o=1;p.u[0]=1002;ak.a[0]=dd.b;ph.e[0]=ga.J;ia.n[0]=aa.e;
    }
    static MethodHandle inventoryTick()throws Throwable{
        ClassNode body=new ClassNode();
        try(InputStream in=t.class.getResourceAsStream("/t.class")){new ClassReader(in).accept(body,ClassReader.SKIP_FRAMES|ClassReader.SKIP_DEBUG);}
        MethodNode method=body.methods.stream().filter(m->m.name.equals("c")&&m.desc.equals("(I)V")).findFirst().orElseThrow();
        AbstractInsnNode start=null,end=null;
        for(AbstractInsnNode n:method.instructions){
            if(start==null && n instanceof FieldInsnNode f && f.owner.equals("ec")&&f.name.equals("e") && f.getOpcode()==Opcodes.GETSTATIC){
                AbstractInsnNode next=n.getNext();while(next.getOpcode()<0)next=next.getNext();
                if(next instanceof JumpInsnNode j && j.getOpcode()==Opcodes.IFNULL){start=n;end=j.label;break;}
            }
        }
        ClassWriter writer=new ClassWriter(ClassWriter.COMPUTE_MAXS);
        writer.visit(Opcodes.V1_5,Opcodes.ACC_PUBLIC,"MenuInventoryTick",null,"java/lang/Object",null);
        MethodVisitor mv=writer.visitMethod(Opcodes.ACC_PUBLIC|Opcodes.ACC_STATIC,"tick","()V",null,null);
        mv.visitCode();mv.visitFieldInsn(Opcodes.GETSTATIC,"client","wb","I");mv.visitVarInsn(Opcodes.ISTORE,12);
        for(AbstractInsnNode n=start;;n=n.getNext()){n.accept(mv);if(n==end)break;}
        mv.visitInsn(Opcodes.RETURN);mv.visitMaxs(0,0);mv.visitEnd();writer.visitEnd();
        return MethodHandles.lookup().findStatic(MethodHandles.lookup().defineClass(writer.toByteArray()),"tick",MethodType.methodType(void.class));
    }
    public static void main(String[] args)throws Throwable{
        fk.ab=new aj[GROUP+1][];rg.b=new boolean[GROUP+1];rg.b[GROUP]=true;
        c=new aj();fk.ab[GROUP]=new aj[]{c};c.Kc=ID;c.ib=c.Mb=0;c.G=3;c.M=1;c.ob=2;c.jd=1;
        c.yb=new int[20];c.Gb=new int[20];c.Zb=new int[]{OBJ+1,OBJ+1,OBJ+1};c.Ob=new int[]{73,123456,23};
        c.j=new id[]{str("Bank"),null,str("Option2"),str("Option3"),str("Option4")};
        c.Yc=new id[]{str("Op1"),null,str("Op3"),str(" "),null,str("Op6"),null,str("Op8")};
        c.v=new int[]{61,72,94,11};c.Tb=str("target");c.E=str(" Select ");c.r=str("widget");
        c.pd=42;c.wb=77;c.R=23;c.vb=0;vk.db=23;
        kl obj=new kl();obj.I=OBJ;obj.s=str("Rune");obj.vb=new id[]{str("Equip"),str("Eat"),null,str("Play"),str("Drop")};
        fa.b.a((long)OBJ,obj,(byte)-99);
        aa.e=11;gl.C=22;me.P=33;ce.D=44;oh.a=-1;al.s=str("targetname");t.W=str("spell");ge.Z=str("selected");
        byte[] metrics=new byte[257];Arrays.fill(metrics,(byte)6);uf.b=new fg(metrics);hi.f=765;fl.l=503;
        for(int i=0;i<256;i++){
            c.Sc=new l((i%3==0 ? -1 : i%3==1 ? 0x43fff3 : 0),-1);
            c.y=(i&1)!=0;c.f=i%7;uc.c=(i&2)!=0;kl.p=(i&4)!=0;ok.r=(i&8)!=0;pj.C=(i&32)!=0?48:0;le.c=(i&16)!=0?1:0;
            c.bc=(i&1)!=0?-1:0;ph.h=i%3;ti.X=ID;hg.f=null;oj.i=-1;
            ie.F=false;begin();sf.a(0,i%4*33,-1,c);ti.f(-62);
            System.out.println(entries()+" "+(hg.f==c)+" "+oj.i);
        }
        ie.F=false;vb.o=0;aa.e=11;
        for(int i=0;i<510;i++)tb.a((byte)117,str("t"+i),(short)(i%5==0?1000:i%2==0?5:1005),str("o"+i),i*30000,i*33331,0x7fa200000000L+i,i%2==0?-1:i);
        ti.f(-62);System.out.println(entries());
        for(int idx:new int[]{348,22,10,0,495}){vk.a(idx,false);System.out.println(entries());}
        vb.o=4;pk.k=0;ve.g=762;ud.j=498;sa.x=758;oj.e=491;f.b(-70);
        System.out.println(ie.F+" "+pk.k+" "+g.n+" "+ef.J);
        ve.g=g.n;ud.j=ef.J;f.b(-70);System.out.println(ie.F+" "+fl.i+" "+hc.j+" "+lk.u+" "+client.C);
        ie.F=false;vb.o=0;uc.c=kl.p=ok.r=false;le.c=0;aa.e=-1;c.bc=-1;c.y=true;c.Sc=new l(-1,-1);
        qk.v.a(new int[]{0,1,5,3},-1);vb.o=1;ia.l=0;
        for(int action:new int[]{12,39,6,15,22,59,1001,46,13,10,38,3,42,50,37,1,2,30,18,44,26,23,1005,1005,2030}){
            int pos=qk.v.yb;sf.m[0]=false;p.u[0]=(short)action;ml.x[0]=ID;mh.h[0]=(action==38||action==6||action==59||action==1001)?-1:1;sa.z[0]=(action==59||action==1001)?4:OBJ;
            if(action==1005 && ve.m!=0)c.Ob[1]=99;
            bd.c(2,0);
            System.out.println(HexFormat.of().formatHex(qk.v.fb,pos,qk.v.yb)+" "+le.c+" "+ok.r+" "+aa.e+" "+(m.G==c)+" "+u.q+" "+ki.O+" "+sf.m[0]+" "+ve.m);
        }
        MethodHandle tick=inventoryTick();c.y=false;c.wc=206;c.Sc=new l(1<<28,-1);
        for(int trial=0;trial<4;trial++){
            c.Zb=new int[]{3,6,8};c.Ob=new int[]{11,23,39};int pos=qk.v.yb;
            c.Sc=new l((1<<28)|(trial==1?1<<29:0),-1);ff.q=trial==2?1:0;if(trial==3)c.Zb[0]=0;
            vb.o=1;p.u[0]=30;mh.h[0]=2;ml.x[0]=ID;sa.x=10;oj.e=20;oi.h=1;ie.F=false;pe.T=null;ec.e=null;ge.b(false);
            for(int step=0;step<6;step++){
                sj.C=step*4+sa.x;pf.Q=oj.e;ca.a=step==5?0:1;hg.f=c;oj.i=0;tick.invokeExact();
            }
            System.out.println(Arrays.toString(c.Zb)+" "+Arrays.toString(c.Ob)+" "+(ec.e==null)+" "+u.q+" "+HexFormat.of().formatHex(qk.v.fb,pos,qk.v.yb));
        }
        ca.g=null;int pos=qk.v.yb;le.c=0;ok.r=false;vb.o=1;p.u[0]=38;mh.h[0]=-1;ml.x[0]=ID;bd.c(2,0);
        System.out.println(HexFormat.of().formatHex(qk.v.fb,pos,qk.v.yb)+" "+(ca.g==c));
        for(int lang=0;lang<3;lang++){
            ii.a((byte)127,lang);
            for(int i=0;i<96;i++){
                vb.o=1+(i%6);le.c=(i>>1)&1;ok.r=(i&4)!=0;pb.sc=(i&8)!=0;ob.q[81]=(i&16)!=0;
                ge.Z=str("coin");t.W=str("cast");al.s=str("spell");
                for(int j=0;j<vb.o;j++){ak.a[j]=str("look"+j);ph.e[j]=str(((i+j)&1)==0?"":"item"+j);}
                System.out.println(text(re.a(2)));
            }
        }
    }
}
