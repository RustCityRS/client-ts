import java.io.*;
import java.lang.reflect.*;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.*;

// The original fi methods, cb constructors, al archive and db index execute from client.jar.
// Only ud (the disk backend) is a fixture. A real al with both discard flags set exposes each
// valid file load, including repeated model IDs, without an instrumented or patched gamepack.
class IdkModelOracle {
    static final String[] MODEL_FIELDS = ModelMeshOracle.CB_FIELDS;
    static final Map<String,Field> kitFields = new HashMap<>();
    static fi kit;
    static int faultAt, fault, calls, startCount;
    static int[] replacement;
    static ModelArchive source;
    static al models;
    static MessageDigest sha;

    static class ModelArchive extends ModelMeshOracle.Provider {
        final List<String> reads = new ArrayList<>();
        ModelArchive(String path) throws Exception { super(path, 7); }

        @Override byte[] a(int mode, int group) {
            reads.add((al.g - startCount) + ":" + mode + "/" + group);
            if (++calls == faultAt) {
                try {
                    switch (fault) {
                        case 1: return null;
                        case 2: return new byte[]{0,0,0,0,1,37};
                        case 3: qh.b = null; break;
                        case 4: kitFields.get("e").set(kit, replacement); break;
                        case 5: kitFields.get("f").set(kit, replacement); break;
                        case 6: kitFields.get("l").set(kit, null); break;
                        case 7: kitFields.get("h").set(kit, null); break;
                    }
                } catch (ReflectiveOperationException failure) { throw new AssertionError(failure); }
            }
            return super.a(mode, group);
        }
    }

    static int[] ints(String text) {
        if (text.equals("~")) return null;
        if (text.equals("_")) return new int[0];
        return Arrays.stream(text.split(",")).mapToInt(Integer::parseInt).toArray();
    }
    static short[] shorts(String text) {
        int[] values = ints(text);
        if (values == null) return null;
        short[] result = new short[values.length];
        for (int i=0;i<values.length;i++) result[i]=(short)values[i];
        return result;
    }
    static String state(cb model) throws Exception {
        if (model==null) return "null";
        StringJoiner result = new StringJoiner(",");
        for (String name : MODEL_FIELDS) {
            Field field = cb.class.getDeclaredField(name);
            field.setAccessible(true);
            Object value=field.get(model);
            String encoded;
            if (value==null) encoded="~";
            else if (!value.getClass().isArray()) encoded=value.toString();
            else {
                String text;
                if (value instanceof int[] arr) text=Arrays.toString(arr);
                else if (value instanceof short[] arr) text=Arrays.toString(arr);
                else if (value instanceof byte[] arr) text=Arrays.toString(arr);
                else throw new AssertionError("Unexpected allocated post-processing array cb."+name);
                encoded=Array.getLength(value)+":"+HexFormat.of().formatHex(sha.digest(text.getBytes(StandardCharsets.US_ASCII)));
            }
            result.add(name+"="+encoded);
        }
        return result.toString();
    }
    static String outcome(boolean head) throws Exception {
        try { return state(head ? kit.a(9961) : kit.c(71)); }
        catch (RuntimeException failure) {
            Throwable cause=failure;
            while (cause instanceof g wrapped) cause=wrapped.a;
            if (cause instanceof ArrayIndexOutOfBoundsException) return "bounds";
            if (cause instanceof NullPointerException) return "null-ref";
            throw failure;
        }
    }
    public static void main(String[] args) throws Exception {
        sha=MessageDigest.getInstance("SHA-256");
        for (String name : new String[]{"e","f","o","l","t","h"}) {
            Field field=fi.class.getDeclaredField(name);
            field.setAccessible(true);
            kitFields.put(name,field);
        }
        source = new ModelArchive(args[0]);
        models = new al(source,true,true);
        id.a(new al(new ModelMeshOracle.Provider(args[0],2),false,false),(byte)69,models);
        System.out.println(ml.u);
        BufferedReader in=new BufferedReader(new InputStreamReader(System.in));
        for (String line; (line=in.readLine())!=null;) {
            String[] row=line.split(" ");
            int id=Integer.parseInt(row[1]);
            kit=id >= 0 ? hk.a(id,8629) : new fi();
            if (id<0) {
                kitFields.get("e").set(kit,ints(row[2]));
                kitFields.get("f").set(kit,ints(row[3]));
                int i=4;
                for(String name:new String[]{"o","l","t","h"}) kitFields.get(name).set(kit,shorts(row[i++]));
            }
            faultAt=Integer.parseInt(row[8]); fault=Integer.parseInt(row[9]); replacement=ints(row[10]);
            calls=0;source.reads.clear();qh.b=faultAt==0&&fault==3?null:models;
            startCount=al.g;
            String value=outcome(row[0].equals("H"));
            System.out.println((al.g-startCount)+";"+String.join(",",source.reads)+";"+value);
        }
    }
}
