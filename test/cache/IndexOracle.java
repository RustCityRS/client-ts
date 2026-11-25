import java.io.*;
import java.lang.reflect.*;
import java.nio.charset.StandardCharsets;
import java.security.DigestOutputStream;
import java.security.MessageDigest;
import java.util.*;

class IndexOracle {
    static Field field(String owner, String name) throws Exception {
        Field f = Class.forName(owner).getDeclaredField(name);
        f.setAccessible(true);
        return f;
    }

    static Method method(String owner, String name, Class<?>... params) throws Exception {
        Method m = Class.forName(owner).getDeclaredMethod(name, params);
        m.setAccessible(true);
        return m;
    }

    static Constructor<?> constructor(String owner, Class<?>... params) throws Exception {
        Constructor<?> c = Class.forName(owner).getDeclaredConstructor(params);
        c.setAccessible(true);
        return c;
    }

    static void ints(DataOutputStream out, int[] data) throws IOException {
        if (data == null) out.writeInt(-1);
        else {
            out.writeInt(data.length);
            for (int n : data) out.writeInt(n);
        }
    }

    static void matrix(DataOutputStream out, int[][] data) throws IOException {
        if (data == null) out.writeInt(-1);
        else {
            out.writeInt(data.length);
            for (int[] row : data) ints(out,row);
        }
    }

    static String digest(Object index) throws Exception {
        MessageDigest hash = MessageDigest.getInstance("SHA-256");
        DataOutputStream out = new DataOutputStream(new DigestOutputStream(OutputStream.nullOutputStream(),hash));
        for (String key : new String[]{"b","k","i","e"}) out.writeInt(field("db",key).getInt(index));
        for (String key : new String[]{"d","l","j","n","a","c"}) ints(out,(int[])field("db",key).get(index));
        for (String key : new String[]{"g","o"}) matrix(out,(int[][])field("db",key).get(index));
        Field slots = field("mf","f");
        Object names = field("db","m").get(index);
        ints(out,names == null ? null : (int[])slots.get(names));
        Object[] files = (Object[])field("db","f").get(index);
        out.writeInt(files == null ? -1 : files.length);
        if (files != null) for (Object name : files) ints(out,name == null ? null : (int[])slots.get(name));
        return HexFormat.of().formatHex(hash.digest());
    }

    static String lookups(Object index) throws Exception {
        Object archive = constructor("al",Class.forName("ud"),boolean.class,boolean.class).newInstance(null,false,false);
        field("al","x").set(archive,index);
        Method group = method("al","a",byte.class,Class.forName("id"));
        Method string = method("ea","a",byte[].class,int.class,int.class,int.class);
        Method lower = method("id","a",int.class), hash = method("id","c",byte.class);
        Method lookup = method("mf","a",int.class,int.class);
        Object[] names = (Object[])field("db","f").get(index);
        List<Integer> results = new ArrayList<>();
        for (int value : new int[]{0xc0,0xe0,0xd7,0xf7,0xdf,0xde,0xfe,0xff,0x61}) {
            Object name = string.invoke(null,new byte[]{(byte)value},0,1,0);
            results.add((int)group.invoke(archive,(byte)-120,name));
            int id = (int)hash.invoke(lower.invoke(name,8238),(byte)31);
            results.add((int)lookup.invoke(names[1],-125,id));
            results.add((int)lookup.invoke(names[4],-125,id));
        }
        return results.toString();
    }

    public static void main(String[] args) throws Exception {
        Constructor<?> ctor = constructor("db",byte[].class,int.class);
        BufferedReader in = new BufferedReader(new InputStreamReader(System.in,StandardCharsets.US_ASCII));
        for (String line; (line = in.readLine()) != null;) {
            String[] parts = line.split(" ");
            Object index;
            try {
                index = ctor.newInstance(Base64.getDecoder().decode(parts[2]),Integer.parseInt(parts[1]));
            } catch (InvocationTargetException ex) {
                if (!(ex.getCause() instanceof RuntimeException)) throw ex;
                System.out.println("rejected");
                continue;
            }
            if (parts[0].equals("redecode")) {
                String[] keys = {"d","l","j","g","n","a","c","m","o","f"};
                Object[] old = new Object[keys.length];
                for (int i=0;i<keys.length;i++) old[i] = field("db",keys[i]).get(index);
                String result = "ok";
                try {
                    method("db","a",byte[].class,int.class).invoke(index,Base64.getDecoder().decode(parts[3]),Integer.parseInt(parts[4]));
                } catch (InvocationTargetException ex) {
                    if (!(ex.getCause() instanceof RuntimeException)) throw ex;
                    result = "rejected";
                }
                StringBuilder changed = new StringBuilder();
                for (int i=0;i<keys.length;i++) changed.append(old[i]==field("db",keys[i]).get(index) ? '0' : '1');
                System.out.println(result + " " + changed + " " + digest(index));
            } else {
                System.out.println(digest(index) + (parts[0].equals("names") ? " " + lookups(index) : ""));
            }
        }
    }
}
