import java.util.*;
import java.io.*;
import java.lang.invoke.*;
import jdk.internal.org.objectweb.asm.*;
import jdk.internal.org.objectweb.asm.tree.*;

final class WorldMenuOracle extends MiniMenuOracle {
    static final int NPC = 7843, LOC = 3859231, ITEM = 4102, PLAYER = 91, X = 4, Z = 7;
    static long key(int kind, int id) {
        return ((long)id << 32) | ((long)kind << 29) | ((2 << 20) | (10 << 14) | (Z << 7) | X);
    }
    static void action(int action,long key,int x,int z) {
        p.u[0]=(short)action;sa.z[0]=key;mh.h[0]=x;ml.x[0]=z;qk.v.yb=0;
        bd.c(2,0);
        System.out.println(HexFormat.of().formatHex(qk.v.fb,0,qk.v.yb)+" "+df.J+" "+jh.r+" "+sb.a+" "+kg.K+" "+lh.a+" "+vi.S+" "+o.O+" "+ak.j+" "+oh.k+" "+rc.b);
    }
    static MethodHandle groundTick()throws Throwable{
        ClassNode body=new ClassNode();
        try(InputStream in=t.class.getResourceAsStream("/t.class")){new ClassReader(in).accept(body,ClassReader.SKIP_FRAMES|ClassReader.SKIP_DEBUG);}
        MethodNode method=body.methods.stream().filter(m->m.name.equals("c")&&m.desc.equals("(I)V")).findFirst().orElseThrow();
        AbstractInsnNode start=null,end=null;
        for(AbstractInsnNode n:method.instructions){
            if(n instanceof FieldInsnNode f && f.owner.equals("si")&&f.name.equals("t")&&f.getOpcode()==Opcodes.PUTSTATIC){
                end=n;
                int checks=0;
                for(AbstractInsnNode back=n;back!=null;back=back.getPrevious()){
                    if(back instanceof FieldInsnNode v && v.owner.equals("mi")&&v.name.equals("E")&&v.getOpcode()==Opcodes.GETSTATIC&&++checks==2){
                        start=back;break;
                    }
                }
                break;
            }
        }
        ClassWriter writer=new ClassWriter(ClassWriter.COMPUTE_MAXS);
        writer.visit(Opcodes.V1_5,Opcodes.ACC_PUBLIC,"WorldMenuGroundTick",null,"java/lang/Object",null);
        MethodVisitor mv=writer.visitMethod(Opcodes.ACC_PUBLIC|Opcodes.ACC_STATIC,"tick","()V",null,null);
        mv.visitCode();mv.visitFieldInsn(Opcodes.GETSTATIC,"client","wb","I");mv.visitVarInsn(Opcodes.ISTORE,12);
        for(AbstractInsnNode n=Objects.requireNonNull(start);;n=n.getNext()){n.accept(mv);if(n==end)break;}
        mv.visitInsn(Opcodes.RETURN);mv.visitMaxs(0,0);mv.visitEnd();writer.visitEnd();
        return MethodHandles.lookup().findStatic(MethodHandles.lookup().defineClass(writer.toByteArray()),"tick",MethodType.methodType(void.class));
    }
    public static void main(String[] args) throws Throwable {
        int plane=0;
        ah.f=plane;
        pb self=te.g=new pb(), player=tf.J[PLAYER]=new pb();
        self.uc=44;self.zc=3;self.Bc=1;self.Gc=str("Local");player.Gc=str("Other");
        bk npc=uc.l[100]=new bk();npc.mc=new ja();
        ja n=npc.mc;n.G=NPC;n.r=str("Ally");n.hb=true;n.F=new id[]{str("Chat"),str("ATTACK"),null,str("Wave"),str("Attack")};n.P=n.X=0;n.i=67;n.V=66;n.cb=68;
        gf.Z.a((long)NPC,n,(byte)-71);
        jb l=new jb();l.k=LOC;l.r=str("High key");l.kb=new id[]{str("Climb"),null,str("Search"),null,str("Push")};
        l.eb=l.Y=0;l.h=45;l.u=44;l.fb=3;l.y=2;l.tb=5;he.w.a((long)LOC,l,(byte)-71);
        long lk=key(2,LOC), other=key(2,LOC+1);
        kl.Bb=new ra[4][104][104];ra tile=kl.Bb[plane][X][Z]=new ra(plane,X,Z);tile.z=new hk();tile.z.f=lk;
        b.H[plane][X][Z]=new gk();
        for(int i=0;i<2;i++){
            kl o=new kl();o.I=ITEM+i;o.s=str("Arrow"+i);o.C=new id[]{str("Lift"),null,str("Take"),null,str("Burn")};
            o.j=o.fb=2;o.d=331;o.db=432;fa.b.a((long)o.I,o,(byte)-71);
            ig item=new ig();item.m=o.I;b.H[plane][X][Z].a(new b(item),false);
        }
        ad.h[0]=PLAYER;fe.R=1;ed.d=1;fi.n[0]=100;
        long[] keys={-1L,lk,lk,other,key(3,0),key(1,100),key(0,PLAYER),lk, key(0,2047)};
        tf.J[2047]=self;self.Z=0;self.S=0;
        pf.W=keys;dd.r=keys.length;
        oj.j=-200;vf.X=200;p.l=-120;fl.m=180;
        fk.ab=new aj[1][1];rg.b=new boolean[]{true};fk.ab[0][0]=new aj();
        nh.ab=ff.P;aa.e=11;gl.C=22;me.P=33;ce.D=44;oh.a=-1;al.s=str("Target");t.W=str("Cast");ge.Z=str("Selected");
        for(int i=0;i<8;i++){bk.ic[i]=i==5?null:str(i==2?"attack":"Option"+i);la.jb[i]=55+i;oe.A[i]=i%3==0;}
        for(int i=0;i<256;i++){
            jl.c=(i>>5)&1;kl.p=(i&1)!=0;le.c=(i&2)!=0?1:0;ok.r=(i&4)!=0;pj.C=(i&8)!=0?127:0;gh.Y=-1;qe.W=0;
            n.M=(i&16)!=0?2:1;n.y=i%11==0?0:i%89;
            int center=32*128+64*n.M;npc.Z=center;npc.S=center+(i%3==1?1:0);player.Z=center;player.S=center;
            player.uc=i%77;player.qc=player.uc+(i%3);player.zc=(i%3==0?-1:3);player.Bc=i%3;player.rc=(i%7==0?321:0);
            begin();pg.a(7,58,-113,72,65,44,5);ti.f(-62);
            System.out.println(entries());
        }
        jl.c=0;ok.r=false;le.c=0;kl.p=false;vb.o=1;
        hc.c[0]=new ke(104,104);for(int[] col:hc.c[0].d)Arrays.fill(col,0);
        hk.e=3072;vj.t=3168;self.L[0]=34;self.ac[0]=31;self.Z=34*128+64;self.S=31*128+64;
        npc.L[0]=player.L[0]=39;npc.ac[0]=player.ac[0]=36;
        ph.h=65192;gl.A=56123;ti.X=0x1369abcd;gh.Y=21415;qe.W=0x789acbaf;
        qk.v.a(new int[]{3,5,9,1},-1);a.e=-41;ca.n=18;df.B=1856;ag.e=-15;kk.db=46;
        sa.x=0;oj.e=0;lh.a=vi.S=0;
        for(int i=0;i<6;i++){
            jl.c=i&1;ob.q[82]=(i&2)!=0;
            int x=20+i,z=44-i;
            for(int act:new int[]{33,8,51,9,31,40,34,17,16,47,49,19,14,29,4,60,32,1007,20,11,58,45,1003,48,28,1004,21,25,7,35,43,36,24,1006,5,41,57,5,41,57}){
                long packed=PLAYER;
                if(act==49||act==19||act==14||act==29||act==4||act==60||act==32||act==1007)packed=100;
                if(act==20||act==11||act==58||act==45||act==1003||act==48||act==28)packed=(lk & ~((31L<<14)|(3L<<20))) | ((long)new int[]{0,9,10,11,22,5}[i]<<14) | ((long)(i&3)<<20);
                if(act==1004)packed=LOC;
                if(act==21||act==25||act==7||act==35||act==43||act==36||act==24||act==1006)packed=ITEM;
                if(act==5||act==41||act==57){packed=(i&1);o.O=false;ak.j=9;oh.k=10;rc.b=11;}
                action(act,packed,x,z);
            }
        }
        MethodHandle tick=groundTick();jl.c=0;ob.q[82]=ob.q[81]=false;sa.x=0;oj.e=0;
        for(int i=1;i<4;i++)hc.c[i]=hc.c[0];
        int[] rotations={0,1,-1,4,-4,Integer.MIN_VALUE,Integer.MAX_VALUE};
        for(int i=0;i<110;i++){
            lh.a=i%3;vi.S=i/3%3;mi.E=i>=36?2:0;ob.q[81]=ob.q[82]=i>=36;
            if(i>=54){
                int v=i-54;
                ah.f=v/7%4;kf.l=rotations[v%rotations.length];
                ob.q[81]=(v&1)==0;ob.q[82]=(v&2)==0;
                mi.E=(v&4)==0?2:0;
            }
            si.t=(i<54?i%2:(i-54)&8)==0?-1:25;hl.Y=42;df.J=2;jh.r=83;kg.K=4;sb.a=5;qk.v.yb=0;
            PrintStream output=System.out;System.setOut(new PrintStream(OutputStream.nullOutputStream()));
            try{tick.invokeExact();}finally{System.setOut(output);}
            System.out.println(HexFormat.of().formatHex(qk.v.fb,0,qk.v.yb)+" "+df.J+" "+jh.r+" "+sb.a+" "+kg.K+" "+lh.a+" "+vi.S+" "+si.t+" "+hl.Y);
        }
        for(int mode=0;mode<4;mode++)for(int size=0;size<=48;size++){
            mi.E=mode==3?2:0; ob.q[81]=ob.q[82]=mode==3;
            kf.l=1;ah.f=2;lh.a=mode==1||mode==3?2:0;vi.S=mode==2||mode==3?2:0;
            si.t=25;hl.Y=42;df.J=2;jh.r=83;kg.K=4;sb.a=5;
            qk.v.fb=new byte[size];Arrays.fill(qk.v.fb,(byte)0xa5);qk.v.yb=0;qk.v.a(new int[]{1,22,4,8},-1);
            String fault="ok";
            PrintStream output=System.out;System.setOut(new PrintStream(OutputStream.nullOutputStream()));
            try { tick.invokeExact(); }
            catch(RuntimeException error) {
                Throwable cause=error;
                while(cause instanceof g wrapped && wrapped.a!=null)cause=wrapped.a;
                fault=cause instanceof IndexOutOfBoundsException?"bounds":cause.getClass().getSimpleName();
            } finally {System.setOut(output);}
            int pos=qk.v.yb;String data=HexFormat.of().formatHex(qk.v.fb);
            qk.v.fb=new byte[1];qk.v.yb=0;qk.v.k(2,251);
            System.out.println(fault+" "+pos+" "+data+" "+(qk.v.fb[0]&255)+" "+df.J+" "+jh.r+" "+sb.a+" "+kg.K+" "+lh.a+" "+vi.S+" "+si.t+" "+hl.Y);
        }
    }
}

