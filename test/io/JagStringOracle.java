import java.io.*;
import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.util.Base64;
import java.util.Calendar;

class JagStringOracle {
    static final Field mutable;
    static final Method integer;
    static {
        try {
            mutable = id.class.getDeclaredField("E");
            mutable.setAccessible(true);
            integer = id.class.getDeclaredMethod("c",byte.class,int.class);
            integer.setAccessible(true);
        } catch (ReflectiveOperationException ex) { throw new AssertionError(ex); }
    }
    static id text(String src, int length) {
        id r = new id();
        r.A = src.equals("~") ? null : src.equals("-") ? new byte[0] : Base64.getDecoder().decode(src);
        r.c = length;
        return r;
    }
    static String bytes(byte[] b) {
        return b == null ? "~" : b.length == 0 ? "-" : Base64.getEncoder().encodeToString(b);
    }
    static String describe(id s) throws Exception {
        return bytes(s.A) + "/" + s.c + "/" + mutable.getBoolean(s);
    }
    static String result(Object value, id s, id other) throws Exception {
        if (value instanceof id x) return (x == s ? "self" : x == other ? "other" : "new") + ":" + describe(x);
        if (value instanceof id[] xs) {
            StringBuilder parts = new StringBuilder();
            for (id x : xs) parts.append(result(x,s,other)).append(';');
            return parts.toString();
        }
        if (value instanceof byte[] b) return bytes(b);
        return String.valueOf(value);
    }
    static Object run(String op, id s, id o, int a, int b) throws Exception {
        return switch(op) {
            case "url" -> bytes(s.i(-8320).toString().getBytes(java.nio.charset.StandardCharsets.UTF_8));
            case "resolveUrl" -> bytes(s.a(o.i(-8320),(byte)117).toString().getBytes(java.nio.charset.StandardCharsets.UTF_8));
            case "split" -> s.a(a,100);
            case "reverse" -> s.a((byte)92);
            case "char" -> s.b(a,-3);
            case "name" -> s.b(a);
            case "base" -> s.b((byte)-16);
            case "normalize" -> s.h(-11662);
            case "sub" -> s.a(a,-5975,b);
            case "from" -> s.a((byte)34,a);
            case "hash" -> s.c(105);
            case "hash32" -> s.c((byte)31);
            case "objectHash" -> s.hashCode();
            case "parse" -> s.b((byte)-108,a);
            case "integer" -> integer.invoke(s,(byte)-96,a);
            case "decimal" -> s.g((byte)-110);
            case "isDecimal" -> s.d((byte)102);
            case "replace" -> s.a(o,true,s);
            case "range" -> s.a(a,48,o,b);
            case "as" -> s.a(false);
            case "find" -> s.a((byte)-128,o);
            case "findFrom" -> s.a(o,9274,a);
            case "trim" -> s.f(32);
            case "ends" -> s.a(90,o);
            case "copy" -> s.b(false);
            case "equals" -> s.b((byte)-69,o);
            case "objectEquals" -> s.equals(o);
            case "string" -> s.toString();
            case "tighten" -> s.e((byte)-128);
            case "with" -> s.c(a,-35);
            case "sentence" -> s.f((byte)127);
            case "lower" -> s.a(8238);
            case "equalsCase" -> s.b(110,o);
            case "findChar" -> s.a(true,a,b);
            case "startsCase" -> s.c((byte)-28,o);
            case "starts" -> s.a(o,100);
            case "collate" -> s.a(o,(byte)-16);
            case "compare" -> s.c(110,o);
            case "appendChar" -> s.d(-64,a);
            case "resize" -> { s.e(-64,a); yield null; }
            case "append" -> s.d(-63,o);
            case "appendSelf" -> s.d(-63,s);
            case "intern" -> s.d(-71);
            case "join" -> ug.a(3,new id[]{s,null,o},0,(byte)-67);
            case "format" -> fa.a(a<0,0,b,Math.abs(a));
            case "number" -> ui.a((long)b,a&3,Math.abs(a)%5,(byte)118,a>=0);
            case "escape" -> mb.c(s);
            case "date" -> {
                Calendar calendar = Calendar.getInstance();
                calendar.setTimeInMillis(((long)a+11745L)*86400000L);
                yield calendar.get(Calendar.DATE)+"-"+new String(u.g[calendar.get(Calendar.MONTH)].A)+"-"+calendar.get(Calendar.YEAR);
            }
            default -> throw new AssertionError(op);
        };
    }
    public static void main(String[] args) throws Exception {
        BufferedReader in = new BufferedReader(new InputStreamReader(System.in));
        for (String line; (line = in.readLine()) != null;) {
            String[] c = line.split(" ");
            id s = text(c[1],Integer.parseInt(c[2])), o = text(c[3],Integer.parseInt(c[4]));
            mutable.setBoolean(s,c[5].equals("1"));
            String value;
            try { value = result(run(c[0],s,o,Integer.parseInt(c[6]),Integer.parseInt(c[7])),s,o); }
            catch (Exception e) {
                if (c[0].equals("string")) {
                    if (!(e instanceof g wrapped) || wrapped.a.getClass() != RuntimeException.class || wrapped.a.getMessage() != null) throw e;
                    value = wrapped.q;
                } else value = "exception";
            }
            System.out.println(value+"|"+describe(s));
        }
    }
}
