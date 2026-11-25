import java.io.*;
import java.lang.reflect.Field;
import java.net.Socket;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.zip.CRC32;

// ri.a's real RSA, preferences, window mode, JS5 CRC reads and ISAAC setup.
// The caller supplies the eight server challenge bytes and the warmed archive CRCs.
class HdLoginFrameOracle {
    static Field field(String full)throws Exception {
        String[] s=full.split("\\.");Field f=Class.forName(s[0]).getDeclaredField(s[1]);f.setAccessible(true);return f;
    }
    static na string(String text){
        na value=new na();value.T=text.getBytes(StandardCharsets.ISO_8859_1);value.lb=value.T.length;return value;
    }
    static void mode(int value)throws Exception {
        tf.w=value>0;jk.y=value>=2;fh.Y=value==3?HdWindowStatusOracle.frameReference():null;
        dl.d=value<2?765:1024;uj.B=value<2?503:768;pa.N=0;
    }
    static void status(int value)throws Exception {
        mode(value);ag.P.T=0;ej.i(-3);System.out.println(HexFormat.of().formatHex(ag.P.y,0,ag.P.T));
    }
    public static void main(String[] args)throws Exception {
        BufferedReader in=new BufferedReader(new InputStreamReader(System.in,StandardCharsets.UTF_8));
        byte[] challenge=HexFormat.of().parseHex(in.readLine());String user=in.readLine(),password=in.readLine();
        int[] crcs=Arrays.stream(in.readLine().split(" ")).mapToInt(Integer::parseInt).toArray();
        String[] archives=("re.B ud.J wf.g dc.z uc.c ca.Z kc.w vl.g ra.K pk.Z ol.U rg.z bf.s ve.l "+
            "kl.r km.Oc wl.s km.Nc nj.l ni.k ui.cb jh.p mf.W sg.k uj.J cd.B nd.t sf.b").split(" ");
        byte[] empty={0,0,0,0,4,5,0,0,0};CRC32 crc=new CRC32();crc.update(empty);
        for(int n=0;n<28;n++){
            ve archive=new ve(null,true,true);ii idx=new ii(empty,(int)crc.getValue());idx.z=crcs[n];
            field("ve.o").set(archive,idx);field(archives[n]).set(null,archive);
        }
        Socket memory=new Socket(){
            public void setTcpNoDelay(boolean flag){}public void setSoTimeout(int timeout){}
            public InputStream getInputStream(){return new ByteArrayInputStream(challenge);}
            public OutputStream getOutputStream(){return OutputStream.nullOutputStream();}
        };
        jk.B=new ma(memory,null);field("ma.n").set(jk.B,new im());
        tl.d=10;af.c=-1;ud.S=false;dk.h=string(args[1]);pa.S=string(user);pa.P=string(password);
        ol.V=3;mode(Integer.parseInt(args[0]));
        if(System.getProperty("rs530.seed")!=null){
            Class.forName("ri");
            Field rng=Class.forName("java.lang.Math$RandomNumberGeneratorHolder").getDeclaredField("randomNumberGenerator");
            rng.setAccessible(true);((Random)rng.get(null)).setSeed(Long.getLong("rs530.seed"));
        }
        ri.a((byte)-9);
        if(ol.V!=4)throw new AssertionError("login stage "+ol.V);
        System.out.println(HexFormat.of().formatHex(bg.g.y,0,bg.g.T));
        if(args.length>2){
            for(int j=3;j<args.length;j++)status(Integer.parseInt(args[j]));
            ag.P.T=0;ag.P.r(0,10);ag.P.b(-125,(182<<16)|6);
            System.out.println(HexFormat.of().formatHex(ag.P.y,0,ag.P.T));
            byte[] decode=new byte[4096];
            for(int j=0;j<decode.length;j++){eg.e.T=0;eg.e.y[0]=0;decode[j]=(byte)eg.e.s(0);}
            System.out.println(HexFormat.of().formatHex(decode));
        }
    }
}
