import java.lang.reflect.*;
import java.util.*;
import javax.sound.sampled.SourceDataLine;

public class PcmPlayerOracle {
    static class Player extends dg {
        int queued; boolean badWrite;
        List<String> actions=new ArrayList<>();
        int a(){actions.add("size");return queued;}
        void c(int size){actions.add("open:"+size);queued=0;}
        void d(){actions.add("close");}
        void c(){actions.add("write:"+Arrays.hashCode(g));if(badWrite)throw new IllegalStateException();queued+=256;}
        void b(){actions.add("flush");}
    }
    static class Listener extends bg {
        final int id; int calls;
        Listener(int id,int delay){this.id=id;q=delay;}
        int a(cj mixer){events.add(id+"@"+q);return ++calls<4?id+1:-1;}
        void a(){events.add("rm"+id);}
    }
    static final List<String> events=new ArrayList<>();
    static final Field[] playerFields=new Field[7];
    static Field f(Class<?> c,String field) throws Exception{return PcmOracle.field(c,field);}
    static void output(String marker,Player p,jc[] streams,ji[] sounds)throws Exception{
        StringBuilder line=new StringBuilder(marker+"|"+String.join(",",p.actions)+"|"+String.join(",",events)+"|");
        for(Field f:playerFields)line.append(f.get(p)).append(',');
        line.append(p.E).append(',').append(p.M).append(',').append(f(dg.class,"D").getLong(p)!=0).append('|');
        for(jc s:streams)line.append(s.q?'1':'0').append(s.p==null?'0':'1').append(',').append(s.t).append(',').append(f(jc.class,"I").getInt(s)).append(';');
        for(ji s:sounds)line.append(s.q).append(',');
        System.out.println(line);p.actions.clear();events.clear();
    }
    static void exercise(boolean stereo)throws Exception{
        db.v=stereo;mj.e=22050;
        byte[] source=new byte[35];for(int i=0;i<35;i++)source[i]=(byte)(i*21-39);
        ji[] sounds={new ji(22050,source,3,31),new ji(22050,source,0,35,true),new ji(44100,source,3,26)};
        Player p=new Player();p.E=512;p.M=1536;p.g=new int[stereo?512:256];
        cj root=new cj(),a=new cj(),b=new cj();root.a(a);root.a(b);
        jc[] streams=new jc[59];
        for(int i=0;i<streams.length;i++){
            jc s=jc.a(sounds[i%3],57+i*6,(1+i%42)*1061,(i*672)%16384);
            s.b(-1);s.c(i%9*256);streams[i]=s;
            ((i&1)==1?a:b).a(s);
        }
        Method ins=cj.class.getDeclaredMethod("a",jf.class,bg.class);ins.setAccessible(true);
        for(int i=0;i<5;i++){gk list=(gk)f(cj.class,"v").get(a);ins.invoke(a,list.c.g,new Listener(i+1,i*5));}
        p.a(104,root);
        for(int i=0;i<35;i++){
            if(i!=0 && (i<18 || i>22))f(dg.class,"G").setLong(p,Long.MAX_VALUE);
            if(i==3||i==10)p.a(0);
            if(i==6)p.b(-7755);
            if(i==8)p.M=90000;
            if(i==14){p.M=768;p.badWrite=true;}
            if(i==15)p.badWrite=false;
            if(i==16)f(dg.class,"D").setLong(p,1L);
            if(i>=18 && i<=22){f(dg.class,"G").setLong(p,0L);p.queued=p.M;}
            if(i==23){f(dg.class,"D").setLong(p,1L);p.queued=0;}
            else if(i<18 || i>22)p.queued=Math.max(0,p.queued-(i%3+1)*256);
            if(i==26){a.b(streams[7]);root.b(b);}
            if(i==28){root.a(b);b.a(streams[7]);}
            if(i==30)p.a(104,null);
            if(i==32)p.a(104,root);
            p.a(false);
            output("pump"+i,p,streams,sounds);
        }
        p.d(86);
        output("stop",p,streams,sounds);
    }
    static void device(boolean stereo)throws Exception{
        db.v=stereo;mj.e=22050;ua p=new ua();p.a((java.awt.Component)null);p.g=new int[stereo?512:256];
        int[] edge={Integer.MIN_VALUE,Integer.MAX_VALUE,-8388609,-8388608,-8388607,-257,-256,-1,0,127,255,256,8388607,8388608};
        for(int i=0;i<p.g.length;i++)p.g[i]=i<edge.length?edge[i]:i*379236917;
        SourceDataLine line=(SourceDataLine)Proxy.newProxyInstance(PcmPlayerOracle.class.getClassLoader(),new Class[]{SourceDataLine.class},(target,m,args)->{
            switch(m.getName()){
                case "available":return 123;
                case "write":System.out.println("bytes:"+Base64.getEncoder().encodeToString((byte[])args[0]));return args[2];
                case "close":case "flush":System.out.println(m.getName());return null;
                default:throw new UnsupportedOperationException(m.getName());
            }
        });
        f(ua.class,"S").set(p,line);f(ua.class,"Q").setInt(p,1250);f(ua.class,"P").setBoolean(p,false);
        System.out.println("position:"+p.a());p.c();p.b();p.d();p.d();
    }
    public static void main(String[] args)throws Exception{
        for(int i=0;i<playerFields.length;i++)playerFields[i]=f(dg.class,"FHIJKNq".substring(i,i+1));
        for(boolean stereo:new boolean[]{false,true}){exercise(stereo);device(stereo);}
    }
}
