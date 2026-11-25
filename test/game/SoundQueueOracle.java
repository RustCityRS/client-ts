import java.io.*;
import java.util.*;

class SoundQueueOracle {
    static int scriptId=80000;
    static void script(int[] args) {
        int size=args.length;
        m code=new m();
        code.D=new int[size];code.F=new int[size];code.B=new id[size];
        for(int i=2;i<size;i++)code.F[i-2]=args[i];
        code.D[size-2]=args[1];code.D[size-1]=21;
        wf event=new wf();event.G=new Object[]{++scriptId};sf.g.a((long)scriptId,0,code);gh.a(event,-22368,1000);
    }
    public static void main(String[] args)throws Exception{
        BufferedReader in=new BufferedReader(new InputStreamReader(System.in));
        rg.m=new al(new ChatOracle.Source(in.readLine()),false,true);
        pd.t=127;dd.u=78;dd.n=-1;sd.N=0;
        al original=rg.m; al.l=original; ve.f=new ng(); qk.v=new be(12); qk.v.a(new int[]{530,0,0,0},0);
        te.g=new pb();ba.f=new hd(22050,22050);mj.e=22050;db.v=false;o.P=new cj();
        for(String row;(row=in.readLine())!=null;){
            String[] line=row.split(" ");
            int[] n=new int[line.length];for(int i=1;i<n.length;i++)n[i]=Integer.parseInt(line[i]);
            String error="";
            try{
                switch(line[0]){
                    case "synth":uj.a(true,n[2],n[3],n[1]);break;
                    case "frame":{ek seq=new ek();seq.H=new int[][]{{n[1]},null};
                        sf.a(seq,n[3],-124,n[2],n[4]!=0,n[5]);break;}
                    case "area":hd.b=new be(6);hd.b.fb[0]=(byte)n[1];hd.b.fb[1]=(byte)(n[2]>>8);hd.b.fb[2]=(byte)n[2];hd.b.fb[3]=(byte)n[3];hd.b.fb[4]=(byte)n[4];
                        o.Y=97;dg.C=2;ha.a=3;if(te.g!=null){te.g.L[0]=n[5];te.g.ac[0]=n[6];}qd.a(64);break;
                    case "tick":if(te.g!=null){te.g.Z=n[1];te.g.S=n[2];}dk.f(128);break;
                    case "archive":rg.m=n[1]!=0?original:null;break;
                    case "self":te.g=n[1]!=0?new pb():null;break;
                    case "script":script(n);break;
                    case "packet":{
                        byte[] payload=new byte[n.length-2];for(int j=2;j<n.length;j++)payload[j-2]=(byte)n[j];
                        ChatOracle.receive(n[1],payload);
                        break;
                    }
                    case "count":ag.l=n[1];break;
                    case "wire":qk.v=new be(n[1]);qk.v.a(new int[]{530,0,0,0},0);break;
                    case "music":dd.n=n[1];hj.d=n[2]!=0;ng.B=n[3];sd.N=n[4];break;
                    case "frameNull":sf.a(null,0,-124,0,false,0);break;
                    case "vol":pd.t=n[1];dd.u=n[2];break;
                    case "reset":ag.l=0;break;
                    default:throw new AssertionError(row);
                }
            }catch(RuntimeException ex){error="exception";}
            int[] decoded=new int[50];for(int i=0;i<50;i++)decoded[i]=pi.o[i]==null?0:1;
            int[] buffer=new int[22];o.P.b(buffer,0,buffer.length);
            System.out.println(error+"|"+ag.l+" "+Arrays.hashCode(ff.J)+" "+Arrays.hashCode(uh.Q)+" "+Arrays.hashCode(u.r)+" "+Arrays.hashCode(gk.e)+" "+Arrays.hashCode(decoded)+" "+Arrays.hashCode(buffer)
                +" "+dd.n+" "+hj.d+" "+ng.B+" "+oa.i+" "+cf.g+" "+hj.i+" "+mf.b+" "+ra.R+" "+(nk.S==original)
                +" "+qk.v.yb+" "+Arrays.hashCode(qk.v.fb));
        }
    }
}

