import java.io.*;
import java.lang.reflect.*;
import java.net.*;
import java.nio.file.*;
import java.util.*;
import jdk.internal.org.objectweb.asm.*;

final class Js5ConnectionReadOracle {
    static ej first,second;
    static se a,b;
    static int readAt,action,reads,callbackAt,events,available,reply;
    static StringBuilder log;

    public static void queueRead(){
        if(++reads==readAt)wk.d=action==2?null:second;
    }
    public static long clock(int unused){
        if(action==10)ha.c=55000L;
        return 55000L;
    }
    static void event(String name)throws IOException{
        log.append(name);
        // se enqueues a writer on this headless Signlink. Mark it completed
        // before a failed read lets the gamepack close and join the stream.
        try{for(se s:new se[]{a,b,hl.H})if(s!=null && writer.get(s) instanceof dj task)task.b=2;}
        catch(IllegalAccessException e){throw new AssertionError(e);}
        if(++events!=callbackAt)return;
        if(action==1 || action==7)wk.d=second;
        if(action==2)wk.d=null;
        if(action==3 || action==7)hl.H=b;
        if(action==4)hl.H=null;
        if(action==5)je.T=7;
        if(action==6)tf.C=28;
        if(action==8)throw new IOException("socket");
        if(action==9){wk.d=second;throw new IOException("socket");}
    }
    static class Peer extends Socket{
        final String tag;
        Peer(String tag){this.tag=tag;}
        public void setSoTimeout(int time) {}
        public void setTcpNoDelay(boolean enabled) {}
        public InputStream getInputStream(){return new InputStream(){
            public int available()throws IOException{event(tag+"A");return available;}
            public int read()throws IOException{event(tag+"R");return tag.equals("b")?19:reply;}
        };}
        public OutputStream getOutputStream(){return OutputStream.nullOutputStream();}
    }
    static void instrument(Path dir)throws Exception{
        ClassReader r;
        try(InputStream in=client.class.getResourceAsStream("/client.class")){r=new ClassReader(in);}
        ClassWriter w=new ClassWriter(r,0);
        r.accept(new ClassVisitor(Opcodes.ASM8,w){
            @Override public MethodVisitor visitMethod(int access,String n,String d,String s,String[] x){
                MethodVisitor mv=super.visitMethod(access,n,d,s,x);
                if(!(n.equals("a") && d.equals("(II)V") || n.equals("b") && d.equals("(Z)V") || n.equals("g") && d.equals("(I)V")))return mv;
                return new MethodVisitor(Opcodes.ASM8,mv){
                    @Override public void visitFieldInsn(int op,String owner,String name,String type){
                        if(op==Opcodes.GETSTATIC && owner.equals("wk") && name.equals("d"))
                            super.visitMethodInsn(Opcodes.INVOKESTATIC,"Js5ConnectionReadOracle","queueRead","()V",false);
                        super.visitFieldInsn(op,owner,name,type);
                    }
                    @Override public void visitMethodInsn(int op,String owner,String name,String desc,boolean iface){
                        if(owner.equals("eh")&&name.equals("a")&&desc.equals("(I)J"))super.visitMethodInsn(op,"Js5ConnectionReadOracle","clock",desc,false);
                        else super.visitMethodInsn(op,owner,name,desc,iface);
                    }
                };
            }
        },0);
        Files.write(dir.resolve("client.class"),w.toByteArray());
    }
    static String stream(Object s){return s==null?"-":s==a?"a":s==b?"b":"c";}
    static Field active,buf,tail,writer;
    static String queue(ej q)throws Exception{return q.G+","+q.F+","+stream(active.get(q));}
    static String wire(se s)throws Exception{
        byte[] bytes=(byte[])buf.get(s);
        return bytes==null?"-":HexFormat.of().formatHex(bytes,0,tail.getInt(s));
    }
    public static void main(String[] args)throws Exception{
        if(args.length!=0){instrument(Path.of(args[0]));return;}
        Object app=Js5ConnectionOracle.allocate("client");
        var connect=client.class.getDeclaredMethod("b",boolean.class);
        var error=client.class.getDeclaredMethod("a",int.class,int.class);
        var tick=client.class.getDeclaredMethod("g",int.class);
        for(var m:new Method[]{connect,error,tick})m.setAccessible(true);
        active=Js5ConnectionOracle.field("ej","B");buf=Js5ConnectionOracle.field("se","B");tail=Js5ConnectionOracle.field("se","o");writer=Js5ConnectionOracle.field("se","n");
        fb signlink=(fb)Js5ConnectionOracle.allocate("fb");
        tj.m=signlink;Js5ConnectionOracle.field("p","o").setBoolean(app,true);
        BufferedReader input=new BufferedReader(new InputStreamReader(System.in));
        for(String line;(line=input.readLine())!=null;){
            int[] v=Arrays.stream(line.split(" ")).mapToInt(Integer::parseInt).toArray();
            readAt=v[6];callbackAt=v[7];action=v[8];available=v[9];reply=v[10];reads=events=0;log=new StringBuilder();
            first=new ej();second=new ej();wk.d=first;first.G=v[3];first.F=v[4];second.G=3;second.F=6;
            a=new se(new Peer("a"),signlink);b=new se(new Peer("b"),signlink);hl.H=action==11?null:a;
            te.f=new dj();te.f.a=new Peer("c");te.f.b=v[5];
            tf.C=v[2];je.T=v[1];ha.c=1733;mc.X=0;sj.M=0;ag.f=ie.r=40231;aa.a=50231;
            if(v[0]==2 || v[0]==3)first.a((byte)0,1,2,(byte)-80,true);
            if(v[0]==3)active.set(first,a);
            String fault="ok";
            try{
                if(v[0]==0)connect.invoke(app,false);else if(v[0]==1)error.invoke(app,-102,117);else tick.invoke(app,3524);
            }catch(InvocationTargetException e){
                Throwable cause=e.getCause();while(cause instanceof g w && w.a!=null)cause=w.a;
                fault=cause instanceof NullPointerException?"null":cause.getClass().getSimpleName();
            }
            System.out.println(String.join(";",fault,""+tf.C,""+je.T,""+sj.M,""+mc.X,""+ie.r,""+ha.c,
                ""+reads,log.toString(),wk.d==null?"-":wk.d==first?"a":"b",stream(hl.H),""+(te.f!=null),queue(first),queue(second),wire(a),wire(b)));
        }
    }
}
