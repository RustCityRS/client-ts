import java.io.*;
import java.net.Socket;
import java.lang.reflect.Field;
import java.util.*;

class ActorPacketOracle {
    static int field(ac a,String name)throws Exception{
        Field f=ac.class.getDeclaredField(name);f.setAccessible(true);return f.getInt(a);
    }
    static String actor(ob a){
        return Arrays.toString(new int[]{a.S,a.Z,a.F,a.T,a.bb,a.fb,a.lb,a.Ub,a.Ab,a.E,a.t,a.gc,a.fc,a.Xb,a.hb,a.w})+
            Arrays.toString(a.L)+Arrays.toString(a.ac);
    }
    static void receive(int op,byte[] bytes)throws Exception{
        byte[] transport=bytes.length==0?new byte[1]:bytes;
        Socket socket=new Socket(){
            public void setSoTimeout(int n){} public void setTcpNoDelay(boolean b){}
            public InputStream getInputStream(){return new ByteArrayInputStream(transport);}
            public OutputStream getOutputStream(){return OutputStream.nullOutputStream();}
        };
        ek.s=new se(socket,null);o.Y=op;af.I=bytes.length;hd.b.fb=new byte[bytes.length];
        if(!rg.a((byte)57))throw new AssertionError();
    }
    public static void main(String[] args)throws Exception{
        ActorInfoOracle.reset(0);hk.e=3000;vj.t=3100;mi.y=73;hh.kb=99;
        fk.X=la.W=jh.q=0;
        ve.q=new int[4][105][105];tb.t=new byte[4][104][104];tg.x=qi.Y=104;
        for(int level=0;level<4;level++)for(int x=0;x<105;x++)for(int z=0;z<105;z++)ve.q[level][x][z]=level*800+x*41-z*13;
        for(int x=0;x<104;x++)for(int z=0;z<104;z++)if(((x+z)&1)==0)tb.t[1][x][z]=2;
        ek noFrames=new ek();noFrames.h=3;ga.B.a(105L,noFrames,(byte)-71);
        li noFrameSpot=new li();noFrameSpot.k=105;r.V.a(215L,noFrameSpot,(byte)-71);
        gl.z=68;ic.T=89;tf.J[9]=new pb();uc.l[42]=new bk();
        tf.J[345]=new pb();uc.l[567]=new bk();tf.J[345].bb=300;uc.l[567].bb=301;
        li staticSpot=new li();staticSpot.k=-1;staticSpot.d=65535;r.V.a(65535L,staticSpot,(byte)-71);
        ek unmapped=new ek();ga.B.a(-1L,unmapped,(byte)-71);ga.B.a(65535L,unmapped,(byte)-71);
        var input=new BufferedReader(new InputStreamReader(System.in));String line;
        while((line=input.readLine())!=null){
            var p=line.split(" ",-1);String result="ok";
            try{
                if(p[0].equals("step")){
                    for(qg n=(qg)ph.g.d(0);n!=null;n=(qg)ph.g.a(0))n.E.a(Integer.parseInt(p[1]),-120);
                }else receive(Integer.parseInt(p[0]),HexFormat.of().parseHex(p[1]));
            }catch(RuntimeException e){
                Throwable cause=e;while(cause instanceof g wrap && wrap.a!=null)cause=wrap.a;
                result=cause instanceof IndexOutOfBoundsException?"bounds":cause instanceof NullPointerException?"null":"runtime";
                if(!p[0].equals("step") && e instanceof g wrapped)
                    result += "@" + wrapped.q.substring(wrapped.q.lastIndexOf(' ') + 1);
            }
            StringJoiner spots=new StringJoiner("|");
            for(qg n=(qg)ph.g.d(0);n!=null;n=(qg)ph.g.a(0)){
                ac a=n.E;spots.add(Arrays.toString(new int[]{field(a,"p"),a.m,a.C,a.n,a.u,a.y,field(a,"t"),field(a,"v"),field(a,"q"),a.x?1:0}));
            }
            System.out.println(String.join(";",result,""+hd.b.yb,""+o.Y,""+af.I,""+fk.X,""+la.W,""+jh.q,""+ah.f,""+gl.z,""+ic.T,actor(te.g),actor(tf.J[9]),actor(uc.l[42]),""+ag.l,spots.toString(),""+tf.J[345].bb,""+uc.l[567].bb));
        }
    }
}
