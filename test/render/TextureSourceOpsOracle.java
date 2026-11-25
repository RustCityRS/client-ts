import java.io.*;
import java.lang.reflect.*;
import java.util.*;

public final class TextureSourceOpsOracle {
    static final Field monoPixels=field(wk.class,"v"), colourPixels=field(pi.class,"a");
    static final Field level=field(ri.class,"O"), red=field(gf.class,"V"), green=field(gf.class,"N"), blue=field(gf.class,"U");
    static Field field(Class<?> owner,String name) {
        try { Field f=owner.getDeclaredField(name); f.setAccessible(true); return f; }
        catch(ReflectiveOperationException e){throw new AssertionError(e);}
    }
    static final class Case {
        final IdentityHashMap<Object,Integer> ids=new IdentityHashMap<>();
        final ArrayList<Object> arrays=new ArrayList<>();
        final bf op;
        final int width, height, code;
        final gd packet;
        Object last;
        Case(String[] v)throws Exception {
            String type=v[0],initial=v[1];width=Integer.parseInt(v[2]);height=Integer.parseInt(v[3]);
            Class<? extends bf> cls=switch(type){case "M"->ri.class;case "C"->gf.class;case "X"->sc.class;default->dk.class;};
            if(initial.equals("-"))op=cls.getConstructor().newInstance();
            else { var ctor=cls.getDeclaredConstructor(int.class);ctor.setAccessible(true);op=ctor.newInstance(Integer.parseInt(initial)); }
            op.K=Integer.parseInt(v[4]);code=Integer.parseInt(v[5]);
            packet=v[7].equals("no")?null:new gd(v[7].equals("null")?null:v[7].equals("-")?new byte[0]:HexFormat.of().parseHex(v[7]));
            if(packet!=null)packet.yb=Integer.parseInt(v[6]);
            hf.I=width;vg.U=new int[]{31,32,33,34,35};cf.h=new int[]{-15,725,4096,8192};
            id(vg.U);id(cf.h);
        }
        int id(Object arr) {
            if(arr==null)return 0;
            Integer known=ids.get(arr);if(known!=null)return known;
            int next=arrays.size()+1;arrays.add(arr);ids.put(arr,next);
            if(arr instanceof Object[])for(Object v:(Object[])arr)id(v);
            return next;
        }
        int hash() {
            int h=1;
            for(int i=0;i<arrays.size();i++){
                Object array=arrays.get(i);h=31*h+Array.getLength(array);
                if(array instanceof int[])for(int value:(int[])array)h=31*h+value;
                else for(Object member:(Object[])array)h=31*h+id(member);
            }
            return h;
        }
        Object[] pixels()throws Exception {
            return op.L?(int[][])monoPixels.get(op.I):(int[][][])colourPixels.get(op.C);
        }
        String step(String cmd)throws Exception {
            String status="ok";char c=cmd.charAt(0);
            try {
                switch(c){
                    case 'i' -> {op.a((byte)-120,width,height);id(pixels());}
                    case 'd' -> op.a(packet,true,code);
                    case 'g' -> {int row=Integer.parseInt(cmd.substring(1));last=op.L?op.a(row,(byte)55):op.a(true,row);status="id"+id(last);}
                    case 'w' -> {
                        if(last instanceof int[][]){int i=0;for(int[] a:(int[][])last){if(a!=null&&a.length>0)a[0]=10000+ ++i;}}
                        if(last instanceof int[] && ((int[])last).length>0)((int[])last)[0]=-910;
                    }
                    case 'x' -> vg.U=cmd.length()==1?null:new int[]{117,119};
                    case 'y' -> cf.h=cmd.length()==1?null:new int[]{97};
                    case 's' -> hf.I=Integer.parseInt(cmd.substring(1));
                    case 'z' -> pixels()[0]=null;
                    case 'a' -> {int[][] row=((int[][][])pixels())[0];row[1]=row[0];row[2]=row[0];}
                    case 'h' -> ((int[][][])pixels())[0][Integer.parseInt(cmd.substring(1))]=null;
                    case 'l' -> ((int[][][])pixels())[0][Integer.parseInt(cmd.substring(1))]=new int[1];
                    case 'r' -> ((int[][][])pixels())[0]=new int[Integer.parseInt(cmd.substring(1))][];
                    case 'k' -> op.d((byte)-100);
                    case 'p' -> {}
                    default -> throw new AssertionError(cmd);
                }
            } catch(RuntimeException e) {
                Throwable cause=e;while(cause instanceof g && ((g)cause).a!=null)cause=((g)cause).a;
                status=cause instanceof IndexOutOfBoundsException?"bounds":cause instanceof NullPointerException?"null":cause instanceof NegativeArraySizeException?"size":cause.getClass().getSimpleName();
            }
            String val=op instanceof ri?""+level.getInt(op):op instanceof gf?red.getInt(op)+"/"+green.getInt(op)+"/"+blue.getInt(op):"-";
            String invalid=op.L?(op.I==null?"-":op.I.w?"1":"0"):(op.C==null?"-":op.C.w?"1":"0");
            int hor=id(vg.U),vert=id(cf.h);
            return status+":"+(packet==null?"-":packet.yb)+":"+val+":"+invalid+":"+hor+":"+vert+":"+hash();
        }
    }
    public static void main(String[] args)throws Exception {
        var input=new BufferedReader(new InputStreamReader(System.in));var out=new PrintWriter(System.out);
        for(String line;(line=input.readLine())!=null;){
            String[] v=line.split(" ");Case row=new Case(v);var result=new StringJoiner("|");
            for(String cmd:v[8].split(","))result.add(row.step(cmd));out.println(result);
        }
        out.flush();
    }
}
