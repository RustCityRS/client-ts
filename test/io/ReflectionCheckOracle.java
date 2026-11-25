import java.io.*;
import java.net.Socket;
import java.util.*;

class ReflectionCheckOracle {
    static String requests(dj[] list) throws InterruptedException {
        StringJoiner out=new StringJoiner(",");
        for(dj request:list) {
            if(request==null) {out.add("~");continue;}
            for(int retry=0;request.b==0 && retry<10000;retry++)Thread.sleep(1);
            out.add(request.e+"/"+request.b);
        }
        return out.toString();
    }
    static void decodeOnly(String line) throws Exception {
        String[] parts=line.split(" ");
        hd.b.fb=HexFormat.of().parseHex(parts[1]);hd.b.yb=0;di.a=new gk();
        lj.a(parts[0].equals("link")?tj.m:null,hd.b,hd.b.fb.length,896);
        qj check=(qj)di.a.d(0);
        StringJoiner buffers=new StringJoiner("/");
        for(byte[][] args:check.x) {
            if(args==null){buffers.add("~");continue;}
            StringJoiner values=new StringJoiner(",","[","]");
            for(byte[] bytes:args)values.add(bytes==null?"~":HexFormat.of().formatHex(bytes));
            buffers.add(values.toString());
        }
        System.out.println(String.join("|",""+hd.b.yb,""+check.E,Arrays.toString(check.z),Arrays.toString(check.t),
            Arrays.toString(check.u),requests(check.y),requests(check.s),buffers.toString()));
    }
    static void read(byte[] bytes)throws Exception{
        Socket socket=new Socket(){public void setSoTimeout(int n){} public void setTcpNoDelay(boolean enabled){}
            public InputStream getInputStream(){return new ByteArrayInputStream(bytes);} public OutputStream getOutputStream(){return new ByteArrayOutputStream();}};
        ek.s=new se(socket,null);o.Y=114;af.I=bytes.length;
        if(!rg.a((byte)57))throw new AssertionError("unconsumed packet");
    }
    public static void main(String[] args)throws Exception{
        tj.m=new fb(null,0,null,0);HexFormat hex=HexFormat.of();
        qk.v.a(new int[]{2,3,5,11},-1);
        try(BufferedReader input=new BufferedReader(new InputStreamReader(System.in))){
            int i=0;
            for(String row;(row=input.readLine())!=null;i++){
                if(args.length==1 && args[0].equals("decode")){decodeOnly(row);continue;}
                int state=i*19481557;tf.C=state;hh.kb=~state;wk.l=state>>8;ah.f=i&3;hk.e=3151;vj.t=3214;
                qj.C=6;ce.F=341;d.c=2;mf.j=530;mi.y=-1;hl.w=2;fb.f=3;dd.a=50;mg.T=2;
                hi.f=1003;fl.l=807;vk.rb=1060;oh.j=853;rk.i=654;sb.g=408;
                ja.Z=439;lg.G=387;ib.db=498;gi.m=430;ae.j=15;ri.V=32767;od.N=7;ae.b=2629;
                qk.v.yb=0;
                read(hex.parseHex(row));qj item=(qj)di.a.d(0);
                for(dj[] requests:new dj[][]{item.s,item.y})for(dj request:requests)if(request!=null)
                    for(int retry=0;retry<10000&&request.b==0;retry++)Thread.sleep(1);
                lg.a(163,qk.v,true);
                System.out.println(hd.b.yb+" "+(di.a.d(0)==null)+" "+hex.formatHex(qk.v.fb,0,qk.v.yb));
            }
        }finally{tj.m.a(100);}
    }
}
