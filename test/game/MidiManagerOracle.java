import java.io.*;
import java.lang.reflect.*;
import java.util.*;

// No music methods are replaced. Only the disk provider is controlled so al may
// complete a 530 fetch, suspend loading a patch, or change a live native global.
class MidiManagerOracle {
    static int flags, callbacks;
    static StringBuilder log;
    static ng first, second;
    static ee initial;
    static byte[] packed(int... bytes) {
        byte[] out = new byte[bytes.length+5];
        out[4]=(byte)bytes.length;
        for(int i=0;i<bytes.length;i++) out[5+i]=(byte)bytes[i];
        return out;
    }
    static final int[] EMPTY={7,0,1,0,96}, NOTES={0,7,0,0,60,100,1,0,96};
    static class Source extends ud {
        final db index; final boolean patch;
        Source(boolean patch) {
            this.patch=patch;
            byte[] table=packed(5,0,0,1,0,0,0,0,0,0,0,0,0,0,0,1,0,0);
            index=new db(table,q.a(0,table,table.length));
        }
        db b(int ignored){return index;}
        byte[] a(int mode,int group){
            log.append(patch?"p":"s");
            if((callbacks&16)!=0)throw new AssertionError("archive");
            if(patch){
                if((callbacks&1)!=0) ve.f=second;
                if((callbacks&2)!=0) qf.m=null;
                if((callbacks&4)!=0) rk.a=null;
                return null;
            }
            if((callbacks&8)!=0) ve.f=second;
            if((flags&32)!=0) return null;
            return packed((flags&64)!=0 ? NOTES : EMPTY);
        }
        void b(int mode,int group){}
        int c(int group,int mode){return 100;}
    }
    static String snapshot(String result, boolean printed) {
        int current=ve.f==null?0:ve.f==first?1:2;
        return String.join(":",result,""+printed,log.toString(),""+ng.B,""+(nk.S!=null),""+oa.i,""+cf.g,""+mf.b,""+hj.i,""+ra.R,
            ""+(al.z!=null),""+(qf.m==null?0:qf.m==initial?1:2),""+(qf.m!=null && qf.m.q!=null),""+current,
            ""+first.e((byte)112),""+first.g((byte)92),""+second.e((byte)112),""+second.g((byte)92));
    }
    public static void main(String[] args) throws Exception {
        Constructor<ee> ctor=ee.class.getDeclaredConstructor(gd.class);ctor.setAccessible(true);
        al songs=new al(new Source(false),true,true), patches=new al(new Source(true),true,true);
        ByteArrayOutputStream printed=new ByteArrayOutputStream();System.setErr(new PrintStream(printed));
        BufferedReader input=new BufferedReader(new InputStreamReader(System.in));
        for(String line;(line=input.readLine())!=null;){
            String[] r=line.split(" ");
            int status=Integer.parseInt(r[0]), preload=Integer.parseInt(r[1]);
            flags=Integer.parseInt(r[2]);callbacks=Integer.parseInt(r[3]);
            int volume=Integer.parseInt(r[4]),fade=Integer.parseInt(r[5]);
            first=new ng();second=new ng();first.b(volume,52);second.b(986,52);
            byte[] supplied=Arrays.copyOfRange(packed(preload==2?NOTES:EMPTY),5,packed(preload==2?NOTES:EMPTY).length);
            initial=ctor.newInstance(new gd(supplied));
            if((flags&128)!=0)first.a(124,initial,true);
            if(preload==3)initial.r=new byte[0];
            pe.a((flags&1)!=0 ? null:first,(flags&2)!=0 ? null:songs,false,(flags&4)!=0 ? null:patches,(flags&8)!=0 ? null:songs);
            al.z=(flags&16)!=0?new ll(ab.U,g.o):null;
            qf.m=preload==0?null:initial; ng.B=status; nk.S=(flags&256)!=0?null:songs;
            oa.i=cf.g=0;mf.b=true;hj.i=127;ra.R=fade;
            StringJoiner stages=new StringJoiner(";");
            for(char action:r[6].toCharArray()) {
                log=new StringBuilder();printed.reset();String result="ok";
                try{
                    switch(action){
                        case 's': ib.b(fade,(byte)127); break;
                        case 'p': fl.a(volume,fade,songs,false,12672,0,0); break;
                        case 'q': ph.a(0,true,0,songs,volume,(byte)-105); break;
                        case 'i': ll.a((byte)-67); break;
                        case 'v': pf.c(volume,123); break;
                        case 'r': result=""+mj.a(0); break;
                        case 'f': sd.e(10359); break;
                        case 'l': result=""+a.a(false); break;
                    }
                } catch(AssertionError e){result="java-error";}
                catch(RuntimeException e){
                    Throwable t=e;while(t instanceof g wrapped)t=wrapped.a;
                    if(!(t instanceof NullPointerException))throw e;
                    result="null-ref";
                }
                stages.add(snapshot(result,printed.size()!=0));
            }
            System.out.println(stages);
        }
    }
}
