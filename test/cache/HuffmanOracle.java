import java.io.*;
import java.lang.reflect.Field;
import java.util.*;

class HuffmanOracle {
    static dd codec;
    static byte[] lengths;
    static byte[] bytes(String str) { return Base64.getDecoder().decode(str); }
    static String enc(byte[] bytes) { return Base64.getEncoder().encodeToString(bytes); }
    static int[] ints(String name) throws Exception {
        Field f = dd.class.getDeclaredField(name); f.setAccessible(true); return (int[])f.get(codec);
    }
    public static void main(String[] args) throws Exception {
        var in = new BufferedReader(new InputStreamReader(System.in));
        for (String line; (line=in.readLine())!=null;) {
            String[] v=line.split(" ",-1);
            switch (v[0]) {
                case "cabbage": {
                    id text = gk.a(new gd(new byte[0]),112);
                    Field mutable = id.class.getDeclaredField("E");
                    mutable.setAccessible(true);
                    boolean rejected = false;
                    try { text.d(-64,65); }
                    catch (g ex) {
                        if (!(ex.a instanceof IllegalArgumentException)) throw ex;
                        rejected = true;
                    }
                    System.out.println((text==mk.C)+"|"+(text==vb.a("Cabbage",(byte)102))+"|"+mutable.getBoolean(text)+"|"+rejected+"|"+enc(text.b(false)));
                    break;
                }
                case "set":
                    lengths=bytes(v[1]);
                    try {
                        codec=new dd(lengths);
                        kc.a(codec,122);
                        System.out.println(Arrays.toString(ints("c"))+"|"+Arrays.toString(ints("d")));
                    } catch (RuntimeException ex) { System.out.println("threw"); }
                    break;
                case "mutate":
                    lengths[Integer.parseInt(v[1])]=(byte)Integer.parseInt(v[2]);
                    System.out.println("mutated");
                    break;
                case "encode": case "decode": {
                    byte[] src=bytes(v[1]), dst=v[2].equals("=")?src:bytes(v[2]);
                    int start=Integer.parseInt(v[3]), count=Integer.parseInt(v[4]), offset=Integer.parseInt(v[5]);
                    String result;
                    try { result=""+(v[0].equals("encode")?codec.a(start,count,dst,offset,src,-121):codec.a(src,(byte)-19,dst,start,count,offset)); }
                    catch (RuntimeException ex) { result="threw"; }
                    System.out.println(result+"|"+enc(dst)); break;
                }
                case "write": {
                    byte[] src=bytes(v[1]), dst=bytes(v[2]); gd buf=new gd(dst); buf.yb=Integer.parseInt(v[3]);
                    id word=ea.a(src,0,src.length,0); String result;
                    try {result=""+gj.a(-121,word,buf);} catch(RuntimeException ex){result="threw";}
                    System.out.println(result+"|"+buf.yb+"|"+enc(dst)); break;
                }
                case "read": case "readLimited": {
                    gd buf=new gd(bytes(v[1])); buf.yb=Integer.parseInt(v[2]);
                    id text = v[0].equals("read")?gk.a(buf,112):oa.a(Integer.parseInt(v[3]),Integer.parseInt(v[4]),buf);
                    System.out.println(enc(text.b(false))+"|"+buf.yb+"|"+(text==mk.C)); break;
                }
                default: throw new AssertionError();
            }
        }
    }
}
