import java.io.*;
import java.util.*;

public class CameraOracle{
    public static void main(String[] args)throws Exception{
        BufferedReader input=new BufferedReader(new InputStreamReader(System.in));
        ve.q=new int[4][105][105];vb.c=new byte[4][104][104];tb.t=new byte[4][104][104];
        for(int p=0;p<4;p++)for(int x=0;x<105;x++)for(int z=0;z<105;z++){
            ve.q[p][x][z]=-p*240-(x*3-z*5+x*z*13&511);
            if(x<104 && z<104){tb.t[p][x][z]=(byte)((x+z)%7==0?2:0);vb.c[p][x][z]=(byte)(p*16+x-z);}
        }
        te.g=new pb();ah.f=1;hk.e=3040;vj.t=3056;hd.b=new be(5000);qk.v.a(new int[]{1,2,3,4},0);
        for(String line;(line=input.readLine())!=null;){
            String[] f=line.split(" ");int[] n=new int[f.length];String out="";if(!f[0].equals("wire"))for(int j=1;j<n.length;j++)n[j]=Integer.parseInt(f[j]);
            switch(f[0]){
                case "reset":ud.a(-1);break;
                case "offsets":client.nb=n[1];gg.C=n[2];df.B=n[3];gi.n=n[4];break;
                case "follow":{
                    hc.a=n[1]!=0;te.g.Z=n[2];te.g.S=n[3];Arrays.fill(ob.q,false);ok.D=n.length-4;
                    for(int j=4;j<n.length;j++){ob.q[n[j]]=true;sc.T[j-4]=n[j];}
                    sf.a((byte)110);break;
                }
                case "tick":uj.a((byte)127);break;
                case "spline":kf.a(1);break;
                case "splineRows":{
                    qa.P=0;mf.q=1;ck.I=0;sc.W=0;se.d=n[4];ga.A=271;mg.e=39871;
                    qh.e=true;tk.a=false;rk.m=17;mf.i=33;ud.g=-19;bd.X=461;qj.w=256;
                    qf.j=0.5F;v.x=-0.25F;
                    for(int path=0;path<2;path++){
                        kg.l[path]=new int[4][];
                        for(int row=0;row<4;row++){
                            int length=path!=n[1]||row<2?3:n[row];
                            if(length<0)continue;
                            kg.l[path][row]=new int[length];
                            for(int axis=0;axis<length;axis++)
                                kg.l[path][row][axis]=0x65432109*(row*2+3*path-axis*7);
                        }
                    }
                    try{kf.a(1);out="ok";}
                    catch(RuntimeException e){
                        Throwable cause=e;
                        while(cause instanceof g wrap&&wrap.a!=null)cause=wrap.a;
                        out=cause instanceof NullPointerException?"null":cause instanceof IndexOutOfBoundsException?"bounds":cause.getClass().getSimpleName();
                    }
                    break;
                }
                case "orbit":hj.a(n[1],110,n[2],n[3],n[4],n[5],334,n[6]);break;
                case "buffers":{
                    int len=n[2];
                    switch(n[1]){
                        case 0:qh.h=new boolean[len];Arrays.fill(qh.h,true);break;
                        case 1:lj.f=new int[len];break;
                        case 2:fa.n=new int[len];break;
                        case 3:ll.d=new int[len];break;
                        case 4:cd.f=new int[len];break;
                    }
                    break;
                }
                case "wire":{
                    int op=Integer.parseInt(f[1]);byte[] bytes=java.util.HexFormat.of().parseHex(f[2]);
                    hd.b.fb=new byte[bytes.length];
                    try { ChatOracle.receive(op,bytes);out="ok"; }
                    catch(RuntimeException e){out="exception";}
                    out+=" "+hd.b.yb+","+o.Y;
                    break;
                }
                case "script":{
                    String[] values=Arrays.copyOfRange(f,2,f.length);
                    boolean scalar=n[1]==5505||n[1]==5506||n[1]==5407;
                    String ret=ChatOracle.run(new String[]{"cs2",f[1],String.join(",",values),"",scalar?"i":"b"});
                    if(scalar)out=ret;break;
                }
                default:throw new AssertionError(line);
            }
            System.out.println(out+"|"+Arrays.toString(new int[]{
                cl.e,rk.m,mf.i,ud.g,bd.X,qj.w,pd.s,df.B,pg.H,ai.f,cf.a,ok.A,pg.V,
                o.S,t.Z,ud.i,oh.c,gi.o,vc.R,qf.c,rk.d,mc.u,p.e,
                qa.P,mf.q,ck.I,sc.W,se.d,ga.A,mg.e,qh.e?1:0,tk.a?1:0,Float.floatToRawIntBits(qf.j),Float.floatToRawIntBits(v.x),
                Arrays.deepHashCode(kg.l),Arrays.hashCode(qh.h),Arrays.hashCode(lj.f),Arrays.hashCode(fa.n),Arrays.hashCode(ll.d),Arrays.hashCode(cd.f),jd.i}));
        }
    }
}
