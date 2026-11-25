import java.io.*;
import java.nio.ByteBuffer;
import java.security.MessageDigest;
import java.util.*;

class HdWorldMapRenderAreaOracle {
    static int[] setup(int mode) throws Exception {
        wa.ub=new bn(null,null,0,0,mode==3?0:mode==4?0x1865ba:-1,true,2);
        dl.e=oi.m=128;ca.db=2;
        lf.b=new int[]{0,0x990088,-1,0x218352,0x774f12};
        uc.d=new int[2][2][4096]; ck.J=new byte[2][2][4096];si.R=new byte[2][2][4096];
        hb.v=new byte[2][2][4096];jl.I=new byte[2][2][4096];fi.m=new byte[2][2][4096];eh.g=new int[2][2][4096];
        for (int x=0;x<2;x++) for(int z=0;z<2;z++) for(int i=0;i<4096;i++){
            uc.d[x][z][i]=i%9==0?0:(0x102030+i*0x10115)&0xffffff;
            ck.J[x][z][i]=(byte)(i%5);
            si.R[x][z][i]=(byte)((i/5)%5);
            hb.v[x][z][i]=(byte)((i+3)%48);
            jl.I[x][z][i]=(byte)((i/3+5)%48);
            fi.m[x][z][i]=(byte)(i%31);
        }
        for (int id=0;id<4;id++){
            aa type=new aa();type.f=(id&1)==0?0:0x48c0ed;type.s=(id&2)!=0;type.i=id+4;
            sk.hb.a((byte)-86,type,id);
            for(int r=0;r<4;r++) {
                ek sprite=new ek(5,4,1,1,3,2,new byte[]{1,2,0,0,1,2},new int[]{0,0xd27344,0x337fc2});
                rl.P.a((byte)-86,sprite,(r<<16)|type.i);
            }
        }
        for(int i=0;i<16;i++)eh.g[0][0][i+2+64*(i%3+1)]=(i%4+1)|((i/4)<<14)|(2<<16)|(3<<20);
        switch (mode) {
            case 1 -> uc.d[0][0]=null;
            case 2 -> uc.d[0]=null;
            case 5 -> lf.b=null;
            case 6 -> lf.b=new int[2];
            case 7 -> hb.v[0][0]=null;
            case 8 -> jl.I[0][0]=null;
            case 9 -> fi.m[0][0]=new byte[1];
            case 10 -> si.R[0]=null;
            case 11 -> eh.g[0]=null;
            case 12 -> eh.g[0][0]=new int[1];
            case 13 -> eh.g[0][0]=null;
            case 14 -> uc.d=null;
            case 15 -> wa.ub=null;
            case 16 -> eh.g=null;
            case 17 -> ck.J=new byte[0][][];
            case 19 -> si.R[0][0]=null;
            case 20 -> ck.J[0][0]=null;
            case 21 -> jl.I[0][0]=new byte[3];
            case 22 -> si.R[0][0][1]=-1;
            case 23 -> { si.R=new byte[0][][]; hb.v=null; }
            case 24 -> { hb.v=new byte[0][][]; fi.m=null; }
            case 25 -> { si.R[0][0]=new byte[0]; ck.J[0]=null; }
        }
        int[] pixels=new int[mode==18?233:45*37];
        Arrays.fill(pixels,0x6a94b3);kb.a(pixels,45,37);kb.c(2,1,41,35);
        return pixels;
    }
    public static void main(String[] args)throws Exception {
        var lines=new BufferedReader(new InputStreamReader(System.in));
        for(String line;(line=lines.readLine())!=null;) {
            int[] v=Arrays.stream(line.split(" ")).mapToInt(Integer::parseInt).toArray();
            int[] pixels=setup(v[0]);le.k=true;
            String fault="ok",context="";
            try {
                if(v[1]==0) le.a(v[9],v[12],v[10],v[4],v[2],v[5],v[7],v[3],v[11],v[8],v[6]);
                else rg.a(v[2],v[8],v[10],v[4],v[3],v[9],v[6],v[5],v[7]);
            } catch(RuntimeException ex) {
                Throwable cause=ex;
                if(ex instanceof ld trace) {
                    int start=trace.e.indexOf("wl.C("); if(start<0) start=trace.e.indexOf("le.C("); if(start<0) start=trace.e.indexOf("rg.SA(");
                    if(start>=0)context=trace.e.substring(start);
                    cause=trace.f;
                }
                fault=cause instanceof NullPointerException?"null":cause instanceof ArithmeticException?"divide":
                    cause instanceof IndexOutOfBoundsException?"bounds":cause.getClass().getSimpleName();
            }
            ByteBuffer buffer=ByteBuffer.allocate(pixels.length*4); for(int p:pixels) buffer.putInt(p);
            String sha=HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(buffer.array()));
            System.out.println(fault+"|"+context+"|"+(le.k)+"|"+sha);
        }
    }
}
