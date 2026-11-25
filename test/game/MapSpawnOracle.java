import java.io.*;
import java.util.*;

class MapSpawnOracle {
    static int hashActors(){
        int h=1;
        for(int i=0;i<uc.l.length;i++)if(uc.l[i]!=null){
            bk n=uc.l[i];
            for(int v:new int[]{i,n.dc,n.mc.G,n.g((byte)-87),n.N,n.gb,n.j,n.U,n.Z,n.S,Arrays.hashCode(n.L),Arrays.hashCode(n.ac)})h=31*h+v;
        }
        return h;
    }
    public static void main(String[] args)throws IOException{
        var in=new BufferedReader(new InputStreamReader(System.in));
        for(int i=1;i<=5;i++){
            ja type=new ja();type.G=i;type.K=(byte)(i==3?2:1);type.M=i==2?3:1;type.U=(byte)(i==4?8:i);
            type.s=i==2?0:21+i;type.q=90+i;
            gf.Z.a((long)i,type,(byte)-71);
        }
        for(String line;(line=in.readLine())!=null;){
            String[] f=line.split(" ");
            int reserve=Integer.parseInt(f[0]);
            if(reserve>=0){
                hh.kb=101;qk.F=reserve;ed.d=0;
                Arrays.fill(uf.m,0);Arrays.fill(uc.l,null);Arrays.fill(fi.n,-1);
                for(int i=0;i<reserve&&i<uf.m.length;i++)uf.m[i]=1000+i;
            }else hh.kb++;
            hk.e=Integer.parseInt(f[1]);vj.t=Integer.parseInt(f[2]);sb.h=Integer.parseInt(f[3]);
            String[] ids=f[4].split(","),files=f[5].split(",");
            rb.i=new int[ids.length];for(int i=0;i<ids.length;i++)rb.i[i]=Integer.parseInt(ids[i]);
            kg.o=f[5].equals("-")?null:new byte[files.length][];
            if(kg.o!=null)for(int i=0;i<files.length;i++)kg.o[i]=files[i].equals("n")?null:
                files[i].equals("e")?new byte[0]:Base64.getDecoder().decode(files[i]);
            boolean error=false;try{vg.e(63);}catch(RuntimeException ex){error=true;}
            System.out.println(error+" "+qk.F+" "+Arrays.hashCode(uf.m)+" "+ed.d+" "+Arrays.hashCode(fi.n)+" "+hashActors());
        }
    }
}
