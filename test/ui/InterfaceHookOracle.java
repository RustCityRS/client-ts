import java.io.*;
import java.net.Socket;
import java.nio.file.*;
import java.util.*;
import java.util.concurrent.*;

class InterfaceHookOracle extends WorldListBlockingOracle {
    static final int A=20, B=21, BASE=192000;
    static final String[] modes={"load","null","change","stale","top","abort","script","open","close","move","modal"};
    static aj root,child,sibling,mounted;
    static aj widget(int id,int type){
        aj c=new aj();c.Kc=id;c.ob=type;return c;
    }
    static void mount(int parent,int group){
        qd sub=new qd();sub.v=group;va.Z.a((byte)-89,sub,(long)parent);
    }
    static Object[] hook(int n){return new Object[]{BASE+n};}
    static void prepare(String mode){
        Arrays.fill(od.U,0);Arrays.fill(sf.m,false);
        hd.m=A;jd.i=7;o.Y=-1;vb.o=1;p.u[0]=1002;va.Z=new nc(8);
        rg.b[A]=rg.b[B]=true;
        root=widget(A<<16,0);child=widget(root.Kc,3);child.bc=0;root.pb=new aj[]{child};
        sibling=widget((A<<16)+1,3);mounted=widget(B<<16,3);ca.g=sibling;
        fk.ab[A]=new aj[]{root,sibling};fk.ab[B]=new aj[]{mounted};
        root.Lb=hook(0);sibling.Lb=hook(2);mounted.Lb=hook(3);
        child.Rc=hook(0);root.Rc=hook(3);sibling.Rc=hook(4);mounted.Rc=hook(2);
        child.ac=hook(1);root.ac=hook(3);sibling.ac=hook(4);mounted.ac=hook(2);
        if(Set.of("change","move","close","modal").contains(mode)){mount(root.Kc,B);child.ac=hook(0);}
        if(mode.equals("stale")){root.ac=hook(0);child.bc=1;}
        if(mode.equals("open"))mounted.Lb=hook(0);
        if(mode.equals("null"))fk.ab[A][1]=null;
    }
    static String state(){
        int dirty=0;for(boolean b:sf.m)if(b)dirty++;
        qd left=(qd)va.Z.a((byte)-85,(long)root.Kc),right=(qd)va.Z.a((byte)-85,(long)sibling.Kc);
        return od.U[0]+"/"+od.U[1]+"/"+hd.m+"/"+jd.i+"/"+o.Y+"/"+dirty+"/"+(ca.g!=null)+"/"+
            (left==null?-1:left.v)+"/"+(right==null?-1:right.v)+"/"+hex.formatHex(qk.v.fb,0,qk.v.yb);
    }
    static void recv(int opcode,String data)throws Exception{
        byte[] bytes=hex.parseHex(data);
        Socket sock=new Socket(){
            public void setSoTimeout(int t){} public void setTcpNoDelay(boolean b){}
            public InputStream getInputStream(){return new ByteArrayInputStream(Arrays.copyOf(bytes,bytes.length+1));}
            public OutputStream getOutputStream(){return new ByteArrayOutputStream();}
        };
        ek.s=new se(sock,null);af.I=bytes.length;o.Y=opcode;
        if(!rg.a((byte)57))throw new AssertionError(opcode);
    }
    static void action(String mode,String msg)throws Exception{
        switch(mode){
            case "load","null" -> gd.b(A,(byte)-89);
            case "change","stale" -> dk.b((byte)60,A,1);
            case "modal" -> {wf e=new wf();e.G=hook(10);li.a(e,116);}
            default -> {String[] parts=msg.split("-",-1);recv(Integer.parseInt(parts[0]),parts[1]);}
        }
    }
    public static void main(String[] args)throws Exception{
        var unsafe=Class.forName("sun.misc.Unsafe");var singleton=unsafe.getDeclaredField("theUnsafe");singleton.setAccessible(true);
        tj.m=(fb)unsafe.getMethod("allocateInstance",Class.class).invoke(singleton.get(null),fb.class);
        var worker=new Thread(tj.m);worker.setDaemon(true);worker.start();
        kh.A=new al(new SubInterfaceOracle.Provider(Files.readAllBytes(Path.of(args[0]))),false,true);
        fk.ab=new aj[kh.A.b(21296)][];rg.b=new boolean[fk.ab.length];
        tf.C=10;hh.kb=1;th.h=aj.Cb=40001;bh.g=50001;
        String mark="42:0 0:10 4002 0:%d 4000 43:0";
        program(BASE,0,0,0,0,mark.formatted(7)+" 6500 43:1 "+mark.formatted(8)+" 21");
        for(int n=1;n<10;n++)program(BASE+n,0,0,0,0,mark.formatted(n)+" 21");
        program(BASE+10,0,0,0,0,mark.formatted(5)+" 3103 "+mark.formatted(6)+" 21");
        for(int i=0;i<modes.length;i++){
            String mode=modes[i],msg=args[i+1];
            prepare(mode);wd.g=1;ga.I=System.currentTimeMillis();kc.i=0;rb.a=0;ff.v=0;ag.j=null;ek.s=null;
            qk.v.yb=0;qk.v.a(new int[]{0,1,5,3},-1);
            var socket=new DelayedSocket((byte)0,(byte)0,(byte)2,(byte)1,(byte)0);
            f.k=new dj();f.k.b=1;f.k.a=socket;
            var job=new FutureTask<Boolean>(()->{try{action(mode,msg);return false;}catch(RuntimeException e){return true;}});
            var thread=new Thread(job);thread.setDaemon(true);thread.start();
            if(!socket.reading.await(2,TimeUnit.SECONDS))throw new AssertionError(mode+" missed read, finished="+job.isDone()+" state="+state());
            System.out.println(mode+" before "+state());
            if(mode.equals("load")){sibling.Lb=hook(9);fk.ab[A]=new aj[]{sibling};}
            if(mode.equals("abort"))mount(root.Kc,B);
            if(mode.equals("change")){sibling.ac=hook(9);mounted.ac=hook(5);}
            socket.release.countDown();
            boolean failed=job.get(3,TimeUnit.SECONDS);
            System.out.println(mode+" after "+failed+"/"+state());
            if(ek.s!=null){ek.s.a((byte)-86);ek.s=null;}
        }
    }
}
