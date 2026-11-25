import java.io.*;
import java.lang.reflect.*;
import java.net.Socket;
import java.util.*;

class LoginHeaderOracle {
    static Field field(String name)throws Exception{
        String[] parts=name.split("\\.");Field f=Class.forName(parts[0]).getDeclaredField(parts[1]);f.setAccessible(true);return f;
    }
    public static void main(String[] args)throws Exception{
        var reader=new BufferedReader(new InputStreamReader(System.in));
        String[] names={"he.w","lj.c","vf.T","uj.f","fa.b","ra.M","gb.r"};
        Field[] slots=new Field[names.length];for(int i=0;i<slots.length;i++)slots[i]=field(names[i]);
        for(String line;(line=reader.readLine())!=null;){
            int[] v=Arrays.stream(line.split(" ")).mapToInt(Integer::parseInt).toArray();
            int prefix=v[0],avail=v[1],missing=v[2],mask=v[3];
            byte[] data={(byte)201,(byte)195,1,0,1,0,1,(byte)0xbe,(byte)0xef,0,1,100,16,32};
            if((mask&1)!=0)for(int i=2;i<11;i++)if(i!=7&&i!=8)data[i]^=1;
            mi.E=-9;tg.r=-11;mi.y=-77;ld.g=data[2]!=1;d.h=data[3]!=1;aj.Cc=data[4]!=1;qi.Z=data[5]!=1;tj.h=data[6]!=1;da.d=data[9]!=1;ka.c=data[10]!=1;
            ok.z=((mask&2)!=0)==(data[10]==1);bb.b=((mask&4)!=0)==(data[10]==1);
            ve[] original=new ve[7];
            for(int i=0;i<slots.length;i++){ve cache=original[i]=new ve(2);cache.a(7L,new Object(),(byte)-71);slots[i].set(null,i==missing?null:cache);}
            od.O=8;nk.U=0;af.I=21;o.Y=33;uj.l=true;
            hd.b=new be(14);hd.b.yb=35;hd.b.a(new int[]{2,7,4},-1);
            int[] available={avail};
            InputStream input=new InputStream(){
                public int available(){return available[0];}
                public int read(){throw new AssertionError();}
                public int read(byte[] dest,int off,int len){
                    System.arraycopy(data,0,dest,off,len);available[0]-=len;
                    // Simulate a packet-buffer replacement at the exact stream boundary.
                    hd.b.fb=prefix<0?null:Arrays.copyOf(dest,prefix);return len;
                }
            };
            Socket socket=new Socket(){
                public void setSoTimeout(int ms){}public void setTcpNoDelay(boolean enabled){}
                public InputStream getInputStream(){return input;}public OutputStream getOutputStream(){return OutputStream.nullOutputStream();}
            };
            ek.s=new se(socket,null);boolean failed=false;
            try{le.a(-28426);}catch(RuntimeException e){failed=true;}finally{ek.s.a((byte)-86);ek.s=null;}
            StringBuilder retained=new StringBuilder();for(ve c:original)retained.append(c.a(7L,false)==null?'0':'1');
            System.out.println(failed+" "+od.O+" "+nk.U+" "+hd.b.yb+" "+o.Y+" "+af.I+" "+mi.E+" "+tg.r+" "+ld.g+" "+d.h+" "+aj.Cc+" "+
                qi.Z+" "+tj.h+" "+mi.y+" "+da.d+" "+ka.c+" "+ok.z+" "+bb.b+" "+retained);
        }
    }
}
