import java.util.*;
import java.util.concurrent.*;

class TargetModeOracle extends WorldListBlockingOracle {
    static final int GROUP=44, ID=GROUP<<16, SCRIPT=192100;
    static final String[] modes={"enter","end","retarget","select","object","cleanup","menu-click","enter-dirty","end-dirty",
        "enter-empty","end-empty","enter-negative","end-negative","idle","plain"};
    static aj oldParent,newParent,oldChild,newChild,replacement;
    static id text(String value){return vb.a(value,(byte)54);}
    static aj widget(int id,int slot,int index) {
        aj c=new aj();c.Kc=id;c.bc=slot;c.vb=index;c.R=23;c.wb=70+index;c.pd=40+index;
        c.Sc=new l((index+1)<<11,80+index);c.r=text("Widget"+index);c.E=text("Spell"+index);c.y=true;
        return c;
    }
    static Object[] hook(boolean waits){return new Object[]{SCRIPT+(waits?0:1),-2147483645,-2147483643};}
    static void prepare(String mode){
        Arrays.fill(od.U,0);Arrays.fill(sf.m,false);
        oldParent=widget(ID,-1,0);newParent=widget(ID+1,-1,1);
        oldChild=widget(ID,0,2);newChild=widget(ID+1,0,3);replacement=widget(ID+1,0,4);
        oldParent.pb=new aj[]{oldChild};newParent.pb=new aj[]{newChild};
        fk.ab[GROUP]=new aj[]{oldParent,newParent};rg.b[GROUP]=true;
        oldChild.td=hook(true);newChild.Fb=hook(true);replacement.Fb=hook(false);vk.db=23;
        ok.r=true;aa.e=9;gh.Y=0;qe.W=ID;ce.D=23;oh.a=17;pj.C=38;
        t.W=text("old-verb");al.s=text("old-name");le.c=1;ti.X=ID;ph.h=8;gl.A=11;ge.Z=text("old-object");
        m.G=newParent;u.q=0;vb.o=1;ie.F=mode.equals("menu-click");
        fl.i=21;hc.j=22;lk.u=90;client.C=37;ec.g=false;sa.x=40;oj.e=53;oi.h=1;pe.T=null;ec.e=null;
        if(mode.equals("enter-dirty"))newChild.vb=100;
        if(mode.equals("end-dirty"))oldChild.vb=100;
        if(mode.equals("select")||mode.equals("idle"))ok.r=false;
        if(mode.equals("end-empty"))gh.Y=1;
        if(mode.equals("end-negative"))gh.Y=-2;
        if(mode.equals("plain"))newChild.Fb=null;
        if(mode.equals("idle"))qe.W=-1;
    }
    static String state()throws Exception{
        return Arrays.toString(Arrays.copyOf(od.U,4))+"/"+ok.r+"/"+aa.e+"/"+gh.Y+"/"+qe.W+"/"+ce.D+"/"+oh.a+"/"+pj.C+
            "/"+le.c+"/"+ti.X+"/"+ph.h+"/"+gl.A+"/"+string(t.W)+"/"+string(al.s)+"/"+string(ge.Z)+"/"+
            Arrays.toString(Arrays.copyOf(sf.m,5))+"/"+ie.F;
    }
    static void action(String mode){
        if(mode.startsWith("enter")||mode.equals("plain"))
            re.a(311,(byte)-50,mode.equals("enter-empty")?1:mode.equals("enter-negative")?-2:0,312,ID+1,313,314);
        else if(mode.startsWith("end")||mode.equals("idle"))kl.d(5197);
        else{
            p.u[0]=(short)(mode.equals("object")?12:mode.equals("cleanup")||mode.equals("menu-click")?1002:6);
            mh.h[0]=0;ml.x[0]=ID+1;sa.z[0]=37;
            if(mode.equals("menu-click"))ge.b(false);else bd.c(2,0);
        }
    }
    public static void main(String[] args)throws Exception{
        var unsafe=Class.forName("sun.misc.Unsafe");var singleton=unsafe.getDeclaredField("theUnsafe");singleton.setAccessible(true);
        tj.m=(fb)unsafe.getMethod("allocateInstance",Class.class).invoke(singleton.get(null),fb.class);
        var worker=new Thread(tj.m);worker.setDaemon(true);worker.start();
        fk.ab=new aj[GROUP+1][];rg.b=new boolean[GROUP+1];tf.C=10;hh.kb=1;th.h=aj.Cb=40001;bh.g=50001;
        kl obj=new kl();obj.I=37;obj.s=text("Rune");fa.b.a(37L,obj,(byte)-99);
        String event="33:0 43:1 33:1 43:2";
        program(SCRIPT,2,0,0,0,event+" 0:1 43:0 6500 43:3 0:2 43:0 21");
        program(SCRIPT+1,2,0,0,0,event+" 0:3 43:0 21");
        for(String mode:modes){
            prepare(mode);
            if(mode.contains("empty")||mode.contains("negative")||mode.equals("idle")||mode.equals("plain")){
                boolean failed=false;try{action(mode);}catch(RuntimeException e){failed=true;}
                System.out.println(mode+" sync "+failed+"/"+state());continue;
            }
            wd.g=1;ga.I=System.currentTimeMillis();kc.i=0;rb.a=0;ff.v=0;ag.j=null;ek.s=null;
            var socket=new DelayedSocket((byte)0,(byte)0,(byte)2,(byte)1,(byte)0);
            f.k=new dj();f.k.b=1;f.k.a=socket;
            var task=new FutureTask<Boolean>(()->{try{action(mode);return false;}catch(RuntimeException err){return true;}});
            var thread=new Thread(task);thread.setDaemon(true);thread.start();
            if(!socket.reading.await(2,TimeUnit.SECONDS))throw new AssertionError(mode+" no first read");
            System.out.println(mode+" before "+state());
            if(mode.equals("retarget")){newParent.pb[0]=replacement;newChild.Sc=new l(9<<11,999);newChild.r=text("changed");}
            if(mode.equals("enter")){newParent.pb[0]=replacement;newChild.vb=0;}
            if(mode.equals("end")){oldParent.pb[0]=null;oldChild.vb=4;}
            socket.release.countDown();
            System.out.println(mode+" after "+task.get(3,TimeUnit.SECONDS)+"/"+state());
            if(ek.s!=null){ek.s.a((byte)-86);ek.s=null;}
        }
    }
}
