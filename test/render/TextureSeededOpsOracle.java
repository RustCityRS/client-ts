import java.io.*;
import java.util.*;
import java.lang.reflect.*;

public final class TextureSeededOpsOracle {
    static final Map<String,String> fieldNames=Map.of("hh","O T U V W X Y db eb gb hb lb pb rb","wb","O P R U W X Z eb gb hb",
        "vk","Q V W Y Z cb eb nb ob","je","N O P W Y eb fb gb","kk","O S V Y Z");
    static Field field(Class<?> cls,String name)throws Exception{Field f=cls.getDeclaredField(name);f.setAccessible(true);return f;}
    static int hash(Object v) {
        if(v==null)return 0;
        if(v instanceof int[] a)return Arrays.hashCode(a);
        if(v instanceof byte[] a){int h=1;for(byte b:a)h=31*h+(b&255);return h;}
        if(v instanceof short[] a)return Arrays.hashCode(a);
        if(v instanceof Object[] a){int h=1;for(Object o:a)h=31*h+hash(o);return h;}
        if(v instanceof Boolean b)return b?1:0;
        return (int)v;
    }
    static final class Case {
        final bf op;
        final String kind;int width,height;gd packet;int[] last;int[][] backing;
        IdentityHashMap<int[],Integer> ids=new IdentityHashMap<>();
        Method privateMethod;
        Case(String[] v)throws Exception{
            kind=v[0];width=Integer.parseInt(v[1]);height=Integer.parseInt(v[2]);op=switch(kind){case "hh"->new hh();case "wb"->new wb();case "vk"->new vk();case "je"->new je();default->new kk();};
            op.K=Integer.parseInt(v[3]); hf.I=g.k=-1;vk.a(-100,width,height);op.a((byte)-120,width,height);
            backing=(int[][])field(wk.class,"v").get(op.I);for(int[] a:backing)ids.put(a,ids.size()+1);
            b.O=10;bh.i=11;u.k=12;jk.G=13;
            if(kind.equals("wb"))privateMethod=wb.class.getDeclaredMethod("a",boolean.class,int.class,int.class,int.class,int.class,int[][].class,Random.class);
            if(kind.equals("vk"))privateMethod=vk.class.getDeclaredMethod("a",int.class,int.class,int.class,int.class,int.class,int.class,int.class);
            if(privateMethod!=null)privateMethod.setAccessible(true);
        }
        String step(String word)throws Exception{
            String result="ok";
            try{
                char opCode=word.charAt(0);
                if(opCode=='D'){
                    String[] c=word.substring(1).split(":");packet=c[1].equals("n")?null:new gd(c[1].equals("-")?new byte[0]:HexFormat.of().parseHex(c[1]));
                    if(packet!=null)packet.yb=Integer.parseInt(c[2]);op.a(packet,true,Integer.parseInt(c[0]));
                }else if(opCode=='P')op.b(105);
                else if(opCode=='G'){last=op.a(Integer.parseInt(word.substring(1)),(byte)55);result=last==null?"nil":""+ids.get(last);}
                else if(opCode=='A'){
                    int h=1;for(int y=0;y<height;y++){last=op.a(y,(byte)55);h=31*h+hash(last);h=31*h+(last==null?0:ids.get(last));}
                    result="image"+h;
                }else if(opCode=='W'){if(last!=null&&last.length>0)last[0]=-530;}
                else if(opCode=='X')vg.U=word.length()==1?null:new int[]{-3072,8192,4096};
                else if(opCode=='Y')cf.h=word.length()==1?null:new int[]{4096,8192,-128};
                else if(opCode=='Z')backing[0]=null;
                else if(opCode=='S'){
                    int seed=((Number)field(op.getClass(),kind.equals("vk")?"Z":"eb").get(op)).intValue();result="share"+(field(op.getClass(),"Y").get(op)==wf.a(seed,(byte)108));
                }else if(opCode=='T'){int h=1;for(int t:new int[]{Integer.MIN_VALUE,-1,0,1,2048,4095,4096,65535,Integer.MAX_VALUE})h=31*h+ig.a(t,(byte)-4);result="fade"+h;}
                else if(opCode=='H'){
                    String[] a=word.substring(1).split(":");int[] n=Arrays.stream(a).mapToInt(Integer::parseInt).toArray();
                    result="noise"+privateMethod.invoke(op,n[0],n[1],n[2],78,n[3],n[4],n[5]);
                }else if(opCode=='B'){
                    int[] n=Arrays.stream(word.substring(1).split(":")).mapToInt(Integer::parseInt).toArray();
                    field(wb.class,"P").setInt(op,n[4]);privateMethod.invoke(op,true,n[0],n[1],n[2],n[3],backing,new Random(n[5]));
                }
            }catch(Throwable e){
                Throwable t=e instanceof InvocationTargetException?((InvocationTargetException)e).getCause():e;
                while(t instanceof g&&((g)t).a!=null)t=((g)t).a;
                result=t instanceof NullPointerException?"null":t instanceof IndexOutOfBoundsException?"bounds":t instanceof ArithmeticException?"divide":
                    t instanceof IllegalArgumentException?"bound":t instanceof NegativeArraySizeException?"size":t instanceof RuntimeException?"runtime":t.getClass().getSimpleName();
            }
            int fields=1;for(String name:fieldNames.get(kind).split(" "))fields=31*fields+hash(field(op.getClass(),name).get(op));
            int d=1;for(int n:new int[]{b.O,bh.i,u.k,jk.G})d=31*d+n;
            return result+":"+(packet==null?"-":packet.yb)+":"+fields+":"+(op.I.w?1:0)+":"+hash(backing)+":"+d;
        }
    }
    public static void main(String[] args)throws Exception{
        var reader=new BufferedReader(new InputStreamReader(System.in));var out=new PrintWriter(System.out);
        for(String line;(line=reader.readLine())!=null;){String[] v=line.split(" ");Case c=new Case(v);var trace=new StringJoiner("|");
            for(String word:v[4].split(","))trace.add(c.step(word));out.println(trace);}
        out.flush();
    }
}
