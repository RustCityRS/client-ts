import java.io.*;
import java.lang.reflect.Field;
import java.util.*;

class ProjectileZoneOracle {
    static Number field(hl p,String name)throws Exception {
        Field f=hl.class.getDeclaredField(name);
        f.setAccessible(true);
        return (Number)f.get(p);
    }
    static void state(StringJoiner out,hl p)throws Exception {
        for(String name:new String[]{"I","V","q","Z","t","U","u","n","r","s","T","o","M","D","J","ab","N","O","L","v","cb","F","j","bb","R"})
            out.add(field(p,name).toString());
    }
    public static void main(String[] args)throws Exception {
        BufferedReader in=new BufferedReader(new InputStreamReader(System.in));
        ag.i=new al(new ChatOracle.Source(in.readLine()),false,false);
        ig.s=new al(new ChatOracle.Source(in.readLine()),false,false);
        mg bas=new mg();
        bas.B=new int[12][];
        bas.B[2]=new int[]{-171,43,257,0,0,0};
        bas.B[4]=new int[]{401,-79,-23,0,0,0};
        ig.n.a(35L,bas,(byte)-71);
        uc.l[23]=new bk();tf.J[13]=new pb();te.g=new pb();
        for(ob a:new ob[]{uc.l[23],tf.J[13],te.g})a.U=35;
        uc.l[23].gb=1931;tf.J[13].gb=274;te.g.gb=585;
        mi.y=7;dg.C=34;ha.a=48;ah.f=1;hh.kb=100;
        tg.x=qi.Y=104;
        ve.q=new int[4][105][105];
        tb.t=new byte[4][104][104];
        for(int p=0;p<4;p++)for(int x=0;x<105;x++)for(int z=0;z<105;z++)
            ve.q[p][x][z]=p*400+x*64-z*128;
        for(int x=0;x<104;x++)for(int z=0;z<104;z++)if((x+z)%4==1)tb.t[1][x][z]=2;
        for(String line;(line=in.readLine())!=null;){
            String[] f=line.split(" ");
            StringJoiner out=new StringJoiner(" ");
            if(f[0].equals("packet")){
                o.Y=Integer.parseInt(f[1]);
                hd.b.fb=HexFormat.of().parseHex(f[2]);hd.b.yb=0;
                qd.a(64);
                out.add(Integer.toString(hd.b.yb));
            }else if(f[0].equals("tick")){
                hh.kb=Integer.parseInt(f[1]);id.p=Integer.parseInt(f[2]);ah.f=Integer.parseInt(f[3]);
                uc.l[23].Z=4944+hh.kb;uc.l[23].S=hh.kb%5==0?-1:7677-hh.kb;
                tf.J[13].Z=hh.kb%6==0?13312:4747-hh.kb;tf.J[13].S=6810+hh.kb;
                te.g.Z=4096-hh.kb;te.g.S=7800+hh.kb;
                kl.Bb=new ra[4][104][104];pa.xb=new ec[256];ah.i=0;
                pk.a(95);
                out.add(Integer.toString(ah.i));
                for(int i=0;i<ah.i;i++){
                    ec entity=pa.xb[i];
                    for(long v:new long[]{field((hl)entity.z,"I").intValue(),entity.w,entity.c,entity.s,entity.t,entity.f,entity.u})
                        out.add(Long.toString(v));
                }
            }else throw new AssertionError(line);
            for(tf node=(tf)cg.f.d(0);node!=null;node=(tf)cg.f.a(0))state(out,node.G);
            System.out.println(out);
        }
    }
}
