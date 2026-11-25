import java.io.*;
import java.lang.reflect.Field;
import java.nio.file.*;
import java.util.*;

public class WidgetFontOracle {
    static Path root;
    static int font, alt;
    static aj widget;
    static ve initial, other;
    static al alternateMetrics;
    static String mode, changes;
    static final ArrayList<String> reads=new ArrayList<>();
    static final IdentityHashMap<Object,Integer> seen=new IdentityHashMap<>();
    static final si[][] icons={null,new si[0],
        {new ch(12,1,0,0,12,1,new byte[12],new int[1])},
        {new ch(31,1,0,0,31,1,new byte[31],new int[1]),null}};
    static final Field iconField,heightsField;
    static {
        try {
            iconField=mb.class.getDeclaredField("ib"); iconField.setAccessible(true);
            heightsField=mb.class.getDeclaredField("M"); heightsField.setAccessible(true);
        } catch(Exception e){throw new AssertionError(e);}
    }
    static int identity(Object value){return value==null?0:seen.computeIfAbsent(value,unused->seen.size()+1);}
    static int iconId(Object value){for(int i=0;i<icons.length;i++)if(icons[i]==value)return i;throw new AssertionError();}
    static void read(String event) {
        reads.add(event+"."+(rk.o?1:0)+"."+widget.mc);
        for(String action:changes.split(",")) {
            String[] pair=action.split("=");
            if(pair.length!=2 || !event.equals(pair[0])) continue;
            switch(pair[1]) {
            case "cache":cf.f=other;break;
            case "no-cache":cf.f=null;break;
            case "alt-id":widget.mc=alt;break;
            case "minus-one":widget.mc=-1;break;
            case "metrics":pb.nc=alternateMetrics;break;
            case "no-metrics":pb.nc=null;break;
            case "no-sprites":h.f=null;break;
            case "flag":rk.o=true;break;
            case "icons":ag.k=icons[1];break;
            default:throw new AssertionError(action);
            }
        }
    }
    static class Provider extends ud {
        final String prefix; final int archive;
        Provider(String p,int a){prefix=p;archive=a;}
        byte[] data(int arc,int group){
            try{return Files.readAllBytes(root.resolve(arc+"-"+group));}
            catch(IOException e){throw new UncheckedIOException(e);}
        }
        db b(int unused){
            read(prefix+".i");
            if(mode.equals(prefix+"-noindex"))return null;
            byte[] bytes=data(255,archive);
            return new db(bytes,q.a(0,bytes,bytes.length));
        }
        byte[] a(int unused,int group){
            read(prefix+".g");
            if(mode.equals(prefix+"-missing"))return null;
            if(mode.equals(prefix+"-corrupt"))return new byte[]{0,0,0,0,2,0,1};
            return data(archive,group);
        }
        void b(int unused,int group){throw new AssertionError("prefetch");}
        int c(int group,int unused){throw new AssertionError("percentage");}
    }
    static void freshArchives(){
        h.f=mode.equals("S-null")?null:new al(new Provider("S",8),true,true);
        pb.nc=mode.equals("M-null")?null:new al(new Provider("M",13),true,true);
        alternateMetrics=new al(new Provider("N",13),true,true);
    }
    static String call(int arg,boolean noWidget) throws Exception {
        reads.clear();
        mb result=null;
        String fault="ok";
        try {result=(noWidget?null:widget).a(icons[arg],(byte)97);}
        catch(RuntimeException error){
            Throwable t=error;while(t instanceof g)t=((g)t).a;
            if(t instanceof NullPointerException)fault="null";
            else if(t instanceof IndexOutOfBoundsException)fault="bounds";
            else if(t instanceof ClassCastException)fault="cast";
            else throw error;
        }
        StringJoiner s=new StringJoiner("/");
        for(Object v:new Object[]{fault,rk.o?1:0,widget.mc,cf.f==null?-1:cf.f==initial?0:1,identity(result),
            iconId(ag.k),result==null?-1:iconId(iconField.get(result)),result==null?-1:Arrays.hashCode((int[])heightsField.get(result)),
            result==null?-1:result.b(aj.a("<img=0>Rune",(byte)-77))})s.add(""+v);
        for(ve cache:new ve[]{initial,other})for(int key:new int[]{font,alt,-1})s.add(""+identity(cache.a((long)key,false)));
        return s+"/"+String.join(",",reads);
    }
    public static void main(String[] args)throws Exception{
        root=Path.of(args[0]);font=Integer.parseInt(args[1]);alt=Integer.parseInt(args[2]);
        widget=new aj();mode="normal";changes="-";freshArchives();
        mb resident=sb.a(h.f,font,0,0,pb.nc);
        if(resident==null)throw new AssertionError("font asset");
        for(String line:Files.readAllLines(root.resolve("cases"))){
            String[] w=line.split(" ");mode=w[0];changes=w[2];seen.clear();widget=new aj();
            widget.mc=mode.equals("minus-one")?-1:mode.equals("invalid-group")?-23:font;
            initial=cf.f=new ve(20);other=new ve(20);
            if(mode.equals("no-cache")||mode.equals("minus-one"))cf.f=null;
            resident.a(icons[3],new int[]{29,32});
            if(mode.equals("hit"))initial.a((long)font,resident,(byte)-71);
            if(mode.equals("cast"))initial.a((long)font,new Object(),(byte)-71);
            ag.k=icons[3];rk.o=true;freshArchives();
            System.out.println(call(Integer.parseInt(w[1]), mode.equals("null-widget")));
            mode="normal";changes="-";freshArchives();
            if(cf.f==null)cf.f=other;
            System.out.println(call(1,false));
        }
    }
}
