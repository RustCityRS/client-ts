import java.io.*;
import java.lang.reflect.*;
import java.util.*;

public class MidiPcmOracle {
    static class Source extends ud {
        final db index;
        final byte[][] groups;
        Source(DataInputStream in) throws Exception {
            byte[] raw=in.readNBytes(in.readInt());
            index=new db(raw,q.a(0,raw,raw.length));
            groups=new byte[index.e][];
            for(int n=in.readInt();n>0;n--){
                int group=in.readInt();
                groups[group]=in.readNBytes(in.readInt());
            }
        }
        db b(int dummy){return index;}
        byte[] a(int mode,int group){return groups[group];}
        void b(int dummy,int group){}
        int c(int dummy,int group){return 100;}
    }
    static int channelState(ng stream) throws Exception {
        int hash=1;
        for(String name:"v x z D K Q X Y bb ob rb xb yb Cb Eb Gb".split(" "))
            hash=31*hash+Arrays.hashCode((int[])PcmOracle.field(ng.class,name).get(stream));
        return hash;
    }
    static int voiceState(ng stream) throws Exception {
        ef patch=(ef)stream.a();
        int hash=1;
        for(t v=(t)patch.x.d(0);v!=null;v=(t)patch.x.a(0)){
            hash=31*hash+Arrays.hashCode(new int[]{v.r,v.s,v.u,v.v,v.x,v.y,v.A,v.E,v.F,v.J,v.K,v.P,v.Q,v.R,v.S,v.T,v.U});
            if(v.B!=null){
                for(char name:"uvwxyzABCDEFGHI".toCharArray()){
                    Field f=PcmOracle.field(jc.class,""+name);
                    hash=31*hash+(f.getType()==boolean.class?(f.getBoolean(v.B)?1:0):f.getInt(v.B));
                }
            }
        }
        return hash;
    }
    public static void main(String[] args) throws Exception {
        DataInputStream in=new DataInputStream(new BufferedInputStream(System.in));
        al[] archives=new al[16];
        for(int id:new int[]{4,6,11,14,15})archives[id]=new al(new Source(in),false,true);
        Method message=ng.class.getDeclaredMethod("d",int.class,int.class);message.setAccessible(true);
        while(true){
            int archive=in.readInt();if(archive<0)break;
            int group=in.readInt();db.v=in.readBoolean();mj.e=in.readInt();boolean loop=in.readBoolean();
            ee track=ee.a(archives[archive],group,0);ng stream=new ng();stream.f(128,9,86);
            ll cache=new ll(archives[4],archives[14]);
            int attempts=1;while(!stream.a(cache,9,22050,archives[15],track) && attempts<4096)attempts++;
            System.out.println(attempts);if(attempts==4096)throw new IllegalStateException("missing fixture sample");
            stream.d((byte)-109);stream.b(213,52);stream.a(124,track,loop);
            for(int n=in.readInt();n>0;n--){
                int op=in.readInt(),arg=in.readInt(),h=0;
                switch(op){
                    case 0:{int[] samples=new int[(arg+3)*(db.v?2:1)];Arrays.fill(samples,-374);
                        stream.b(samples,2,arg);h=Arrays.hashCode(samples);break;}
                    case 1:stream.a(arg);break;
                    case 2:message.invoke(stream,arg,-84);break;
                    case 3:stream.b(arg,52);break;
                    case 4:stream.b(-118);break;
                }
                System.out.println(h+" "+stream.g((byte)-119)+" "+stream.e((byte)112)+" "+channelState(stream)+" "+voiceState(stream));
            }
        }
        ng stream=new ng();stream.f(128,9,86);
        pe.a(stream,archives[14],false,archives[15],archives[4]);gd.E=archives[11];al.l=archives[6];
        qk.v.a(new int[]{1,2,3,4},0);ag.l=0;db.v=false;mj.e=22050;
        for(int n=in.readInt();n>0;n--){
            int op=in.readInt(),arg=in.readInt();boolean loaded=false;qk.v.yb=0;
            switch(op){
                case 0:sd.N=arg;break;
                case 1:og.a((byte)-84,arg);break;
                case 2:af.b(-47,arg,203);break;
                case 3:sd.e(10359);break;
                case 4:loaded=a.a(false);break;
                case 5:stream.a(arg);break;
                case 6:dk.f(128);break;
                case 7:pf.c(arg,120);break;
                case 8:ll.a((byte)-67);break;
            }
            int end=qk.v.yb==0?-1:java.nio.ByteBuffer.wrap(qk.v.fb,1,4).getInt();
            System.out.println(ng.B+" "+(nk.S==al.l?6:nk.S==gd.E?11:0)+" "+oa.i+" "+cf.g+" "+mf.b+" "+hj.i+" "+ra.R+" "+dd.n+" "+hj.d+" "+loaded+" "+end+" "+stream.e((byte)112)+" "+stream.g((byte)-119));
        }
    }
}
