import java.io.*;
import java.lang.reflect.*;
import java.nio.file.*;
import java.util.*;

class IdkOracle {
    static final String[] fields={"d","v","e","f","o","l","t","h"};
    static String snapshot(fi kit, String status, int position) throws Exception {
        StringJoiner text=new StringJoiner(";");
        text.add(status).add(""+position);
        for(String name:fields){
            Field field=fi.class.getDeclaredField(name);
            field.setAccessible(true);
            Object value=field.get(kit);
            text.add(value instanceof int[] ? Arrays.toString((int[])value) :
                value instanceof short[] ? Arrays.toString((short[])value) : String.valueOf(value));
        }
        int checks=al.b;
        text.add(""+kit.a((byte)-100)).add(""+kit.a(true)).add(""+(al.b-checks));
        return text.toString();
    }
    static String check(fi type) {
        try { return String.valueOf(type.a(false)); } catch(RuntimeException ex) { return "error"; }
    }
    public static void main(String[] args) throws Exception {
        al archive=new al(new FloorConfigOracle.Provider(Path.of(args[0])),false,true);
        al models=new al(new FloorConfigOracle.Provider(Path.of(args[1])),false,true);
        id.a(archive,(byte)69,models);
        System.out.println(ml.u);
        for(int i=-1;i<=ml.u;i++){
            fi kit=hk.a(i,8629);
            System.out.println(snapshot(kit,kit==hk.a(i,8629)?"cached":"miss",0));
        }
        BufferedReader in=new BufferedReader(new InputStreamReader(System.in));
        for(String line;(line=in.readLine())!=null;){
            gd packet=new gd(HexFormat.of().parseHex(line));
            fi kit=new fi();
            String status="ok";
            try {kit.a((byte)-60,packet);} catch(RuntimeException ex){status="error";}
            System.out.println(snapshot(kit,status,packet.yb));
        }
        FloorConfigOracle.Provider provider = new FloorConfigOracle.Provider(Path.of(args[1]));
        models=new al(provider,false,false); id.a(archive,(byte)69,models);
        fi type = new fi();
        int group = provider.index.d[0];
        Field body=fi.class.getDeclaredField("f"); body.setAccessible(true);
        StringJoiner trace=new StringJoiner(" ");
        trace.add(check(type));
        body.set(type,new int[0]); trace.add(check(type));
        body.set(type,new int[]{-1}); trace.add(check(type));
        body.set(type,new int[]{group}); trace.add(check(type));
        models.a(-809612665,0,group); trace.add(check(type));
        ml.u=804; boolean failed=false;
        try {id.a(null,(byte)69,models);} catch(RuntimeException ex) {failed=true;}
        trace.add(String.valueOf(failed)).add(String.valueOf(ra.Z==null)).add(String.valueOf(qh.b==models)).add(String.valueOf(ml.u));
        System.out.println(trace);
    }
}
