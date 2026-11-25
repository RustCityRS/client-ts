import java.io.*;
import java.util.*;

public class MusicCorpusOracle{
    public static void main(String[] args)throws Exception{
        DataInputStream in=new DataInputStream(new BufferedInputStream(System.in));
        al[] archives=new al[16];
        for(int id:new int[]{4,6,11,14,15})archives[id]=new al(new MidiPcmOracle.Source(in),false,true);
        ll sounds=new ll(archives[4],archives[14]);
        mj.e=22050;db.v=false;boolean full=in.readBoolean();
        for(int a:new int[]{6,11}){
            for(int n=in.readInt();n>0;n--){
                int id=in.readInt();ee track=ee.a(archives[a],id,0);ng stream=new ng();stream.f(128,9,86);
                if(!stream.a(sounds,9,0,archives[15],track))throw new IllegalStateException("missing sample "+a+"/"+id);
                stream.d((byte)-109);stream.a(124,track,false);
                int nsec=0,pcm=1,transport=1;int[] b=new int[22050];
                do{
                    if(full || nsec%13==0 || a==11){
                        Arrays.fill(b,0);stream.b(b,0,b.length);pcm=31*pcm+Arrays.hashCode(b);
                    }else stream.a(22050);
                    transport=31*transport+(stream.g((byte)-119)?1:0);
                    if(++nsec>=1800)throw new AssertionError("runaway "+a+"/"+id);
                }while(stream.g((byte)-119));
                Arrays.fill(b,0);stream.b(b,0,b.length);pcm=31*pcm+Arrays.hashCode(b);
                System.out.println(a+"/"+id+" "+nsec+" "+pcm+" "+transport);
            }
        }
    }
}
