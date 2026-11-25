import java.io.*;
import java.util.*;

class MenuInputOracle {
    static final int GROUP=49,ID=GROUP<<16;
    static final short[] OPS={46,42,30,1002,1001,3001};
    static int ref(aj c){return c==null?-1:c.Kc;}
    static String sample(boolean error){
        return error+"/"+ie.F+"/"+pk.k+"/"+g.n+"/"+ef.J+"/"+fl.i+"/"+hc.j+"/"+lk.u+"/"+client.C+"/"+
            ref(ec.e)+"/"+ej.b+"/"+te.c+"/"+vj.u+"/"+gl.y+"/"+bd.S+"/"+ref(m.G)+"/"+u.q+"/"+ki.O+"/"+
            Arrays.toString(Arrays.copyOf(sf.m,5))+"/"+HexFormat.of().formatHex(qk.v.fb,0,qk.v.yb);
    }
    public static void main(String[] args)throws Exception{
        byte[] metrics=new byte[257];Arrays.fill(metrics,(byte)6);fg font=new fg(metrics);
        fk.ab=new aj[GROUP+1][];rg.b=new boolean[GROUP+1];rg.b[GROUP]=true;
        aj[] row=fk.ab[GROUP]=new aj[6];for(int i=0;i<row.length;i++){
            aj c=row[i]=new aj();c.Kc=ID+i;c.R=23;c.vb=i%5;
        }
        vk.db=23;
        BufferedReader rd=new BufferedReader(new InputStreamReader(System.in));
        for(String line;(line=rd.readLine())!=null;){
            int[] v=Arrays.stream(line.split(",")).mapToInt(Integer::parseInt).toArray();
            int mode=v[0],flags=v[1];vb.o=v[2];oi.h=v[3];pk.k=v[4];fl.i=v[5];hc.j=v[6];lk.u=v[7];client.C=v[8];
            hi.f=v[9];fl.l=v[10];sa.x=v[11];oj.e=v[12];sj.C=v[13];pf.Q=v[14];ve.g=v[15];ud.j=v[16];g.n=v[17];ef.J=v[18];
            ie.F=(flags&1)!=0;ec.g=(flags&2)!=0;pb.sc=(flags&4)!=0;ob.q[81]=(flags&8)!=0;d.q=flags>>4&1;
            ec.e=(flags&32)!=0?row[0]:null;pe.T=(flags&64)!=0?row[1]:null;
            uf.b=(flags&128)!=0?null:font;
            for(int i=0;i<6;i++){
                p.u[i]=OPS[(v[19]+i)%OPS.length];ml.x[i]=ID+i;mh.h[i]=i-1;sa.z[i]=7+i;
                ak.a[i]=vb.a("Op"+i,(byte)54);ph.e[i]=(flags&256)!=0&&i==0?null:i%2==0?ga.J:vb.a("Target"+i,(byte)54);
                row[i].Sc=new l(v[20],-1);
            }
            ik.G=v[21];Arrays.fill(sf.m,false);
            for(int i=0;i<5;i++){nh.Y[i]=fl.i+i*20-10;r.U[i]=hc.j+i*12-16;gk.i[i]=20;ik.Q[i]=16;}
            te.c=true;ej.b=5;vj.u=7;gl.y=8;bd.S=9;m.G=null;u.q=10;ki.O=12;ok.r=false;le.c=0;
            qk.v.yb=0;qk.v.a(new int[]{0,1,5,3},-1);
            boolean error=false;try{
                if(mode==0)ge.b(false);else if(mode==1)f.b(-116);else qj.a(117);
            }catch(RuntimeException e){error=true;}
            System.out.println(sample(error));
        }
    }
}
