import java.io.*;
import java.lang.reflect.*;
import java.util.*;
import java.security.MessageDigest;

class MusicDataOracle{
    public static void main(String[] args)throws Exception{
        DataInputStream in=new DataInputStream(new BufferedInputStream(System.in));
        Constructor<ee> ctor=ee.class.getDeclaredConstructor(gd.class);ctor.setAccessible(true);
        MessageDigest sha=MessageDigest.getInstance("SHA-256");
        for(int archive;(archive=in.readInt())>=0;){
            byte[] data=in.readNBytes(in.readInt());
            if(archive==15){
                tg patch=new tg(data);StringBuilder s=new StringBuilder();
                s.append(patch.I).append(' ').append(Arrays.hashCode(patch.K)).append(' ').append(Arrays.hashCode(patch.t)).append(' ').append(Arrays.hashCode(patch.F)).append(' ').append(Arrays.hashCode(patch.A)).append(' ').append(Arrays.hashCode((int[])PcmOracle.field(tg.class,"w").get(patch)));
                List<uf> params=new ArrayList<>();int hash=1;
                for(uf d:patch.q){if(!params.contains(d))params.add(d);hash=31*hash+params.indexOf(d);}
                s.append(' ').append(hash);
                for(uf d:params)if(d!=null)s.append(' ').append(Arrays.toString(new int[]{d.a,d.c,d.d,d.e,d.i,d.k,d.o,Arrays.hashCode(d.h),Arrays.hashCode(d.u)}));
                System.out.println(s);
            }else{
                gd p=new gd(data);ee song=ctor.newInstance(p);song.a();
                int used=1;
                for(lk mask=(lk)song.q.c((byte)36);mask!=null;mask=(lk)song.q.a(-104)){used=31*used+(int)mask.k;used=31*used+Arrays.hashCode(mask.w);}
                el reader=new el(song.r);int hash=1,n=0;reader.a(982538874L);
                while(!reader.e()){
                    int t=reader.g();reader.f(t);
                    int tick=reader.f[t];int msg=reader.e(t);long time=reader.a(tick);
                    hash=31*hash+t;hash=31*hash+tick;hash=31*hash+msg;hash=31*hash+(int)(time^(time>>>32));
                    if(msg==1)reader.a();else reader.b(t);
                    reader.c(t);n++;
                }
                System.out.println(p.yb+" "+HexFormat.of().formatHex(sha.digest(song.r))+" "+used+" "+n+" "+hash);
            }
        }
    }
}
