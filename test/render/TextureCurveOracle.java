import java.io.*;
import java.lang.reflect.*;
import java.util.*;

class TextureCurveOracle {
    static class Ramp extends bf {
        int[] input;
        Ramp(int[] data){super(0,true);input=data;}
        int[] a(int row,byte dummy){return input;}
    }
    static String fault(Throwable t) {
        while(t instanceof g)t=((g)t).a;
        if(t instanceof NullPointerException)return "null";
        if(t instanceof ArrayIndexOutOfBoundsException)return "bounds";
        if(t instanceof ArithmeticException)return "arith";
        return t.getMessage();
    }
    static Object field(bf node,String name)throws Exception {
        Field f=node.getClass().getDeclaredField(name);
        f.setAccessible(true);
        return f.get(node);
    }
    static String state(bf node)throws Exception {
        if(node instanceof kj) return field(node,"Q")+":"+Arrays.deepToString((int[][])field(node,"ab"))+":"+
            Arrays.toString((int[])field(node,"N"))+":"+Arrays.toString((int[])field(node,"O"))+":"+
            Arrays.hashCode((short[])field(node,"P"));
        return Arrays.deepToString((int[][])field(node,"eb"))+":"+Arrays.hashCode((int[])field(node,"bb"));
    }
    static String run(String[] v)throws Exception {
        boolean mono=v[0].equals("8");
        bf node=mono ? new kj() : new nk();
        int[] input=new int[264];
        for(int i=0;i<input.length;i++)input[i]=(i-3)<<4;
        input[0]=Integer.MIN_VALUE;input[input.length-1]=Integer.MAX_VALUE;
        node.z[0]=new Ramp(input);
        hf.I=input.length;node.K=1;node.a((byte)-120,input.length,3);
        h.e=c.t=null;
        StringJoiner trace=new StringJoiner("|");
        for(int i=1;i<v.length;i++) {
            String s=v[i],out="ok";
            gd p=null;
            try {
                if(s.equals("p"))node.b(-122);
                else if(s.equals("c")) {h.e=new int[4];c.t=new int[3];}
                else if(s.startsWith("r")) {
                    int y=Integer.parseInt(s.substring(1));
                    out=mono ? Arrays.toString(node.a(y,(byte)55)) : Arrays.deepToString(node.a(true,y));
                } else {
                    p=s.equals("n") ? null : new gd(s.equals("d") ? null : Base64.getDecoder().decode(s.substring(1)));
                    node.a(p,true,s.charAt(0)=='x' ? 51 : 0);
                }
            }catch(RuntimeException e){out=fault(e);}
            trace.add(out+":"+(p==null ? -1 : p.yb)+":"+state(node));
        }
        return trace.toString();
    }
    public static void main(String[] args)throws Exception {
        BufferedReader input=new BufferedReader(new InputStreamReader(System.in));
        PrintWriter out=new PrintWriter(System.out);
        for(String line;(line=input.readLine())!=null;) out.println(run(line.split(" ")));
        out.flush();
    }
}
