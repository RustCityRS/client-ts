import java.lang.reflect.*;
import java.util.*;
import java.util.zip.CRC32;

// Drives the unmodified hg.a and tj.a methods with deliberately dirty client globals.
class LoginResetOracle {
    static final id marker = vb.a("previous",(byte)54);
    static final StringJoiner result = new StringJoiner("/");
    static void add(Object... values) { for(Object value:values) result.add(String.valueOf(value)); }
    public static void main(String[] args) throws Exception {
        String mode=args[0];
        int seed=Integer.parseInt(args[1]);
        Random seeded=new Random(seed);
        Field random=Class.forName("java.lang.Math$RandomNumberGeneratorHolder").getDeclaredField("randomNumberGenerator");
        random.setAccessible(true); ((Random)random.get(null)).setSeed(seed);
        qk.v=new be(5000); hd.b=new be(5000); qk.v.a(new int[]{1,2,3,4},-1);
        qk.v.yb=9; hd.b.yb=7; af.I=91; hi.f=765; fl.l=503; kf.d=0;
        tf.C=40; ej.p=new ag(); ej.p.n=12; rj.x=false; wg.g=false; ea.c=331L; lk.v=8;
        wk.l=523; gl.z=88; ic.T=67; ki.R=4; ia.q=55; la.W=23; o.Y=77; fk.X=88; jh.q=99; ia.l=2;
        ie.F=true; vb.o=17; cl.e=3; je.ib=27; le.c=2; ok.r=true; ve.m=1234; ag.l=7;
        jd.i=423; qc.Z=true; ja.W=false; kf.n=true; tj.i=false;
        sj.L=37; ei.u=2; uh.N=1; dk.P=marker; jl.b=new rf[1];
        ui.q[29]=marker; m.T[17]=marker; me.a[49]=marker; od.U[49]=1234;
        di.i[7]=46; wa.o[7]=65; ll.m[7]=123505; bk.ic[4]=marker; la.jb[4]=19; oe.A[4]=true;
        o.S=qf.c=rk.d=oh.c=vc.R=gi.o=t.Z=ud.i=p.e=mc.u=97;
        for(int i=0;i<100;i++) sf.m[i]=seeded.nextBoolean();
        pb retainedPlayer=new pb(); bk retainedNpc=new bk();
        tf.J[0]=tf.J[2047]=retainedPlayer; uc.l[12]=uc.l[32767]=retainedNpc;
        retainedPlayer.Zb=721; retainedNpc.Zb=932; te.g=retainedPlayer;
        fe.R=ed.d=2; hd.m=-1; va.Z=new nc(8); ca.g=new aj();
        nc oldInv=mf.d; gk oldLocs=wh.S; short[] oldPalette=rc.h; ea oldOffer=rb.h[3]=new ea();
        od.U[0]=91; cg.f.b((byte)127); ph.g.b((byte)127);
        byte[] empty={0,0,0,0,4,5,1,0,0}; CRC32 crc=new CRC32();crc.update(empty);
        kh.A=new al(null,true,true); Field index=al.class.getDeclaredField("x");index.setAccessible(true);
        index.set(kh.A,new db(empty,(int)crc.getValue()));
        if(mode.equals("broken")) kh.A=null;
        be inbound=hd.b,outbound=qk.v;
        if(mode.equals("resume-input")) hd.b=null;
        if(mode.equals("resume-output")) qk.v=null;
        if(mode.equals("resume-short")) sf.m=Arrays.copyOf(sf.m,17);
        if(mode.equals("resume-long")) sf.m=Arrays.copyOf(sf.m,103);
        try {
            if(mode.startsWith("resume")) hg.a(true); else tj.a(0);
            add("ok");
        } catch(RuntimeException expected) {add(mode.startsWith("resume") && expected instanceof g wrapped ? wrapped.q : "runtime");}
        hd.b=inbound;qk.v=outbound;
        add(tf.C,ki.R,ia.q,la.W,o.Y,fk.X,jh.q,af.I,hd.b.yb,qk.v.yb,
            HexFormat.of().formatHex(qk.v.fb,0,qk.v.yb),ie.F,vb.o,wk.l,gl.z,ic.T,cl.e,je.ib,le.c,ok.r,ve.m,ag.l,
            jd.i,qc.Z,ja.W,kf.n,tj.i,ia.l,sj.L,ei.u,uh.N,dk.P==marker,jl.b==null,
            ui.q[29]==marker,m.T[17]==marker,me.a[49]==marker,od.U[49],di.i[7],wa.o[7],ll.m[7],bk.ic[4]==marker,la.jb[4],oe.A[4],
            o.S,qf.c,rk.d,oh.c,vc.R,gi.o,t.Z,ud.i,p.e,mc.u,
            retainedPlayer.Zb,retainedNpc.Zb,tf.J[0]==null,tf.J[2047]==te.g,te.g==retainedPlayer,uc.l[12]==null,uc.l[32767]==null,
            fe.R,ed.d,ca.g==null,oldInv==mf.d,oldLocs==wh.S,oldPalette==rc.h,rc.h==al.q,rc.h==de.v,rc.h==la.Z,oldOffer==rb.h[3],
            ej.p.n,rj.x,wg.g,ea.c,lk.v,Arrays.hashCode(sf.m));
        System.out.println(result);
    }
}
