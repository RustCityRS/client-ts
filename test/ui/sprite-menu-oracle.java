import java.io.*;
import java.util.*;
import java.util.zip.CRC32;

// Runs the unmodified wh.e(B)V with real al/gi, rh/vh, td, fg and sd.
class SpriteMenuOracle {
    static db index;
    static byte[][] groups;
    static StringBuilder reads;
    static al cold;
    static int change, at;
    static void archive(al value) {h.i=value;}
    static final class Source extends ud {
        int mask,bad; String tag;
        Source(String tag,int mask,int bad) { this.tag=tag; this.mask=mask; this.bad=bad; }
        db b(int unused) {reads.append(tag).append('i'); return index;}
        byte[] a(int mode,int id) {
            reads.append(tag).append(id).append('/').append(mode);
            if (tag.equals("a") && id==at) {
                switch (change) {
                    case 1 -> archive(cold);
                    case 2 -> {fl.i=60; hc.j=9; lk.u=6; client.C=12; sj.C=8; pf.Q=42; vb.o=1;}
                    case 3 -> uf.b=null;
                    case 4 -> archive(null);
                    case 5 -> {bi.k=4; ah.e=0; fd.ab=4; nh.O=0; bd.W=1;}
                }
            }
            return (mask&(1<<id))==0?null:bad==id?new byte[]{0,0,0,0,1,0}:groups[id];
        }
        void b(int unused,int group) {throw new AssertionError();}
        int c(int group,int unused) {throw new AssertionError();}
    }
    static fg font() {
        byte[] metric=new byte[257];Arrays.fill(metric,(byte)4);metric[256]=7;
        int[] zero=new int[256],w=new int[256],h=new int[256];
        Arrays.fill(w,3);Arrays.fill(h,4);byte[][] glyphs=new byte[256][12];
        for(int c=0;c<256;c++)for(int i=0;i<12;i++)glyphs[c][i]=(byte)((i+c)%4==0?0:1);
        return new fg(metric,zero,zero,w,h,glyphs);
    }
    static vc seed(int id,int damage) {
        int w=id+3,h=6-id;
        int[] pixels=new int[w*h];
        for(int i=0;i<pixels.length;i++)pixels[i]=(i+id)%4==0?0:0x811306+id*231+i*0x20200;
        rh sprite=new rh(w+2,h+2,1,1,w,h,pixels);
        if(damage==1&&id==0||damage==2&&id==2)sprite.B=0;
        if(damage==3&&id==3)sprite.A=0;
        return sprite;
    }
    static String fault(Throwable err) {
        while(err instanceof g)err=((g)err).a;
        return err instanceof ArithmeticException?"divide":err instanceof NullPointerException?"null":
            err instanceof IndexOutOfBoundsException?"bounds":err.getClass().getSimpleName();
    }
    public static void main(String[] args)throws Exception {
        BufferedReader in=new BufferedReader(new InputStreamReader(System.in));
        String[] bytes=in.readLine().split(" ");byte[] packed=Base64.getDecoder().decode(bytes[0]);
        CRC32 crc=new CRC32();crc.update(packed);index=new db(packed,(int)crc.getValue());
        groups=new byte[5][];for(int i=0;i<5;i++)groups[i]=Base64.getDecoder().decode(bytes[i+1]);
        fg type=font();
        for(String row;(row=in.readLine())!=null;){
            int[] v=Arrays.stream(row.split(" ")).mapToInt(Integer::parseInt).toArray();
            int pre=v[0],mask=v[1],bad=v[2],damage=v[3],scene=v[4],hover=v[5];change=v[6];at=v[7];
            reads=new StringBuilder();cold=new al(new Source("b",0,-1),false,true);
            h.i=damage==4?null:new al(new Source("a",mask,bad),false,true);
            vc[] old=new vc[5];for(int i=0;i<5;i++)if((pre&(1<<i))!=0)old[i]=seed(i,damage);
            o.R=old[0];c.E=old[1];sc.N=old[2];ra.Q=old[3];dd.i=old[4];
            bi.k=0;ah.e=1;fd.ab=2;nh.O=3;bd.W=4;
            lj.j=0x1234a9;jh.m=0x8f782f;qi.U=0x44ccdd;bj.h=0xf1a532;
            d.p=new int[]{0,33,256,-9,300}[scene];bc.i=new int[]{0,200,33,257,-8}[scene];
            fl.i=new int[]{4,-9,45,13,61}[scene];hc.j=new int[]{3,-4,42,17,40}[scene];
            lk.u=new int[]{45,62,39,0,17}[scene];client.C=new int[]{64,52,47,45,14}[scene];
            vb.o=new int[]{3,2,1,0,1}[scene];
            sj.C=fl.i+new int[]{0,1,lk.u-1,lk.u,12,12,12}[hover];
            pf.Q=hc.j+new int[]{28,23,36,27,22,38,40}[hover];
            si.q=vb.a("Choose",(byte)54);uf.b=damage==5?null:type;
            for(int i=0;i<3;i++){ak.a[i]=vb.a("op"+i,(byte)54);ph.e[i]=vb.a(i==1?"":"t"+i,(byte)54);}
            if(damage==6)ph.e[0]=null;
            int[] frame=new int[damage==7?250:72*66];for(int i=0;i<frame.length;i++)frame[i]=(0x123535+i*31)&0xffffff;
            td.a(frame,72,66);td.b(4+scene,3+scene,67-scene,63-scene);
            ik.G=damage==8?101:100;
            for(int i=0;i<100;i++){nh.Y[i]=(i*17)%90-12;r.U[i]=(i*13)%81-12;gk.i[i]=(i*7)%21;ik.Q[i]=(i*9)%26;ce.T[i]=i%11==0;sf.m[i]=i%13==0;}
            String result="-";
            try{wh.e((byte)-18);}catch(RuntimeException ex){result=fault(ex);}
            vc[] now={o.R,c.E,sc.N,ra.Q,dd.i};StringBuilder slots=new StringBuilder();
            for(int i=0;i<5;i++)slots.append(now[i]==null?'_':now[i]==old[i]?'O':now[i] instanceof vh?'A':'P');
            System.out.println(String.join(";",result,reads.toString(),slots.toString(),Integer.toString(Arrays.hashCode(frame)),
                Integer.toString(Arrays.hashCode(ce.T)),Integer.toString(Arrays.hashCode(sf.m))));
        }
    }
}
