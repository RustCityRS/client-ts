import java.io.*;
import java.lang.reflect.Field;
import java.nio.ByteBuffer;
import java.security.MessageDigest;
import java.util.*;

class WorldMapRenderAreaOracle {
    static int[] setup(int mode) throws Exception {
        rk.h=new gh(null,null,0,0,mode==3?0:mode==4?0x1865ba:-1,true,2);
        ki.db=ml.m=128;vk.gb=2;
        pa.wb=new int[]{0,0x990088,-1,0x218352,0x774f12};
        tb.w=new int[2][2][4096]; af.J=new byte[2][2][4096];hc.f=new byte[2][2][4096];
        mg.o=new byte[2][2][4096];fl.g=new byte[2][2][4096];hh.ob=new byte[2][2][4096];ai.a=new int[2][2][4096];
        for (int x=0;x<2;x++) for(int z=0;z<2;z++) for(int i=0;i<4096;i++){
            tb.w[x][z][i]=i%9==0?0:(0x102030+i*0x10115)&0xffffff;
            af.J[x][z][i]=(byte)(i%5);
            hc.f[x][z][i]=(byte)((i/5)%5);
            mg.o[x][z][i]=(byte)((i+3)%48);
            fl.g[x][z][i]=(byte)((i/3+5)%48);
            hh.ob[x][z][i]=(byte)(i%31);
        }
        for (int id=0;id<4;id++){
            da type=new da();type.a=(id&1)==0?0:0x48c0ed;type.j=(id&2)!=0;type.l=id+4;
            hj.f.a(id,type,(byte)-71);
            for(int r=0;r<4;r++) {
                ch sprite=new ch(5,4,1,1,3,2,new byte[]{1,2,0,0,1,2},new int[]{0,0xd27344,0x337fc2});
                mk.A.a((r<<16)|type.l,sprite,(byte)-71);
            }
        }
        for(int i=0;i<16;i++)ai.a[0][0][i+2+64*(i%3+1)]=(i%4+1)|((i/4)<<14)|(2<<16)|(3<<20);
        switch (mode) {
            case 1 -> tb.w[0][0]=null;
            case 2 -> tb.w[0]=null;
            case 5 -> pa.wb=null;
            case 6 -> pa.wb=new int[2];
            case 7 -> mg.o[0][0]=null;
            case 8 -> fl.g[0][0]=null;
            case 9 -> hh.ob[0][0]=new byte[1];
            case 10 -> hc.f[0]=null;
            case 11 -> ai.a[0]=null;
            case 12 -> ai.a[0][0]=new int[1];
            case 13 -> ai.a[0][0]=null;
            case 14 -> tb.w=null;
            case 15 -> rk.h=null;
            case 16 -> ai.a=null;
            case 17 -> af.J=new byte[0][][];
            case 19 -> hc.f[0][0]=null;
            case 20 -> af.J[0][0]=null;
            case 21 -> fl.g[0][0]=new byte[3];
            case 22 -> hc.f[0][0][1]=-1;
            case 23 -> { hc.f=new byte[0][][]; mg.o=null; }
            case 24 -> { mg.o=new byte[0][][]; hh.ob=null; }
            case 25 -> { hc.f[0][0]=new byte[0]; af.J[0]=null; }
        }
        int[] pixels=new int[mode==18?233:45*37];
        Arrays.fill(pixels,0x6a94b3);td.a(pixels,45,37);td.b(2,1,41,35);
        return pixels;
    }
    public static void main(String[] args)throws Exception {
        var lines=new BufferedReader(new InputStreamReader(System.in));
        Field label=jf.class.getDeclaredField("d");label.setAccessible(true);
        id held=(id)label.get(null);
        for(String line;(line=lines.readLine())!=null;) {
            int[] v=Arrays.stream(line.split(" ")).mapToInt(Integer::parseInt).toArray();
            int[] pixels=setup(v[0]);label.set(null,held);
            String fault="ok",context="";
            try {
                if(v[1]==0) ob.a(v[2],v[3],v[4],v[5],v[6],v[7],v[8],v[9],v[10],v[11],v[12]);
                else jf.a(v[2],v[3],v[4],v[5],v[6],v[7],v[8],v[9],(byte)v[10]);
            } catch(RuntimeException ex) {
                Throwable cause=ex;
                if(ex instanceof g trace) {
                    int start=trace.q.indexOf("ob.G("); if(start<0) start=trace.q.indexOf("jf.AC(");
                    if(start>=0)context=trace.q.substring(start);
                    cause=trace.a;
                }
                fault=cause instanceof NullPointerException?"null":cause instanceof ArithmeticException?"divide":
                    cause instanceof IndexOutOfBoundsException?"bounds":cause.getClass().getSimpleName();
            }
            ByteBuffer buffer=ByteBuffer.allocate(pixels.length*4); for(int p:pixels) buffer.putInt(p);
            String sha=HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(buffer.array()));
            System.out.println(fault+"|"+context+"|"+(label.get(null)==held)+"|"+sha);
        }
    }
}
