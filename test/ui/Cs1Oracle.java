import java.io.*;
import java.net.Socket;
import java.util.*;

class Cs1Oracle {
    static int[] ints(DataInputStream in) throws IOException {
        int length=in.readInt();
        if(length<0)return null;
        int[] result=new int[length];
        for(int i=0;i<length;i++)result[i]=in.readInt();
        return result;
    }

    static void packet(byte[] bytes) throws Exception {
        Socket socket=new Socket(){
            public void setSoTimeout(int n){}
            public void setTcpNoDelay(boolean enabled){}
            public InputStream getInputStream(){return new ByteArrayInputStream(bytes);}
            public OutputStream getOutputStream(){return new ByteArrayOutputStream();}
        };
        ek.s=new se(socket,null);o.Y=164;af.I=4;
        if(!rg.a((byte)57))throw new AssertionError("unread packet");
        for(int i=0;dd.e.b==0 && i<1000;i++)Thread.sleep(1);
        System.out.println(hd.b.yb+" "+dd.e.e+" "+dd.e.c+" "+dd.e.b+" "+dd.e.a);
    }

    public static void main(String[] args) throws Exception {
        DataInputStream in=new DataInputStream(new BufferedInputStream(System.in));
        cd.d=new ve(4096);
        for(int n=in.readInt();n>0;n--){
            int id=in.readInt();byte[] bytes=in.readNBytes(in.readInt());
            og type=new og();type.a(new gd(bytes),16609);cd.d.a((long)id,type,(byte)-71);
        }
        for(int index=5562;index<=5567;index++){
            kl type=new kl();type.f=(index&1)==0;fa.b.a((long)index,type,(byte)-71);
        }
        fk.ab=new aj[150][];rg.b=new boolean[150];rg.b[149]=true;
        aj inv=new aj();inv.Zb=new int[]{5563,5563,5566,0};inv.Ob=new int[]{Integer.MAX_VALUE,4,69,0};fk.ab[149]=new aj[]{inv};
        for(int i=0;i<2500;i++)vj.d[i]=(i+1)*7325681;
        for(int i=0;i<25;i++){wa.o[i]=i*5%99;ll.m[i]=292341*i;di.i[i]=i*17%121;}
        te.g=new pb();te.g.uc=83;te.g.Z=-12304;te.g.S=1485;hk.e=3200;vj.t=3460;ie.s=63;uj.k=-189;

        int count=in.readInt();
        for(int i=0;i<count;i++){
            aj c=new aj();
            int length=in.readInt();
            if(length>=0)c.a(-5,new gd(in.readNBytes(length)));
            else{
                int rows=in.readInt();
                c.Vb=rows<0?null:new int[rows][];
                for(int j=0;j<rows;j++)c.Vb[j]=ints(in);
                c.bd=ints(in);c.eb=ints(in);
            }
            ka.c=(i&1)==0;
            dd.e=i%3==0?null:new dj();
            if(dd.e!=null){dd.e.c=0x8009feff;dd.e.a=i%3==2?"\u00e4\000\u2603":null;}
            int hash=1;
            for(int j=-1;j<=6;j++)hash=hash*31+mj.a(c,j,(byte)-32);
            String cond;
            try{cond=String.valueOf(e.a(c,(byte)-69));}catch(RuntimeException ex){cond="error";}
            id before=aj.a(i%7==0?"unchanged":"n%1/%2/%3/%4/%5 repeat%1 == %dns",(byte)-102);
            id after=client.a(before,c,(byte)-111);
            System.out.println(hash+" "+cond+" "+(before==after)+" "+HexFormat.of().formatHex(after.A,0,after.c));
        }
        tj.m=new fb(null,0,null,0);
        try{
            for(int n=in.readInt();n>0;n--)packet(in.readNBytes(4));
        }finally{tj.m.a(100);}
    }
}
