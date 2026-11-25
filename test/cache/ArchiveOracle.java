import java.io.*;
import java.lang.reflect.Field;
import java.util.*;
import java.util.zip.CRC32;

class ArchiveOracle {
    static class Provider extends ud {
        db table;
        boolean online;
        int available;
        final Map<Integer,byte[]> groups = new HashMap<>();
        final List<String> calls = new ArrayList<>();
        int[] replaceIds;
        Integer replacePacked;
        Object oldPacked;

        db b(int dummy) { calls.add("index"); return online ? table : null; }
        byte[] a(int mode,int group) {
            calls.add("group:" + group + ":" + mode);
            if (replaceIds != null) { table.d = replaceIds; replaceIds = null; }
            if (replacePacked != null) {
                oldPacked = replace("w", replacePacked < 0 ? null : new Object[replacePacked]);
                replacePacked = null;
            }
            return (available & 1 << group) == 0 ? null : groups.get(group);
        }
        void b(int dummy,int group) { calls.add("prefetch:" + group); }
        int c(int group,int dummy) { calls.add("percent:" + group); return 30 + group; }
    }

    static Object field(Object obj, String name) throws ReflectiveOperationException {
        Field f = obj.getClass().getDeclaredField(name);
        f.setAccessible(true);
        return f.get(obj);
    }

    static Object replace(String member, Object value) {
        try {
            Field f = al.class.getDeclaredField(member);
            f.setAccessible(true);
            Object old = f.get(archive);
            f.set(archive, value);
            return old;
        } catch (ReflectiveOperationException ex) { throw new AssertionError(ex); }
    }

    static String slots(Object object) {
        if (object == null) return "-";
        if (object instanceof byte[] data) return "h" + Arrays.hashCode(data);
        if (object instanceof md direct) return "d" + Arrays.hashCode(direct.b((byte)112));
        ArrayList<String> items = new ArrayList<>();
        for (Object item : (Object[])object) items.add(slots(item));
        return "[" + String.join(",",items) + "]";
    }

    static id name(String value) {
        if (value.equals("null")) return null;
        byte[] bytes = Base64.getDecoder().decode(value);
        return ea.a(bytes,0,bytes.length,0);
    }

    static al archive;
    static Provider provider;
    static final byte[][] held = new byte[17][];

    static Object run(String[] v) {
        switch(v[0]) {
            case "open": {
                provider = new Provider();
                byte[] src = Base64.getDecoder().decode(v[3]);
                CRC32 crc = new CRC32(); crc.update(src);
                provider.table = new db(src,(int)crc.getValue());
                for (int i=4; i < v.length; i+=2) provider.groups.put(Integer.parseInt(v[i]),Base64.getDecoder().decode(v[i+1]));
                archive = new al(provider,v[1].equals("1"),v[2].equals("1"));
                Arrays.fill(held,null);
                vc.J = false;
                break;
            }
            case "online": provider.online = v[1].equals("1"); break;
            case "noProvider": archive = new al(null, false, false); break;
            case "packed": {
                int length = Integer.parseInt(v[1]);
                provider.oldPacked = replace("w", length < 0 ? null : new Object[length]);
                break;
            }
            case "oldPacked": return slots(provider.oldPacked);
            case "unpacked": {
                int length = Integer.parseInt(v[1]);
                replace("O", length < 0 ? null : new Object[length][]);
                break;
            }
            case "row": {
                try { ((Object[][])field(archive,"O"))[Integer.parseInt(v[1])] = new Object[Integer.parseInt(v[2])]; }
                catch (ReflectiveOperationException ex) { throw new AssertionError(ex); }
                break;
            }
            case "swapIds": provider.replaceIds = Arrays.stream(v).skip(1).mapToInt(Integer::parseInt).toArray(); break;
            case "swapPacked": provider.replacePacked = Integer.valueOf(v[1]); break;
            case "counts": provider.table.l = Arrays.stream(v).skip(1).mapToInt(Integer::parseInt).toArray(); break;
            case "sparse":
                provider.table.g[Integer.parseInt(v[1])] = Arrays.stream(v).skip(2).mapToInt(Integer::parseInt).toArray();
                break;
            case "mask": provider.available = Integer.parseInt(v[1]); break;
            case "strict": vc.J = v[1].equals("1"); break;
            case "capacity": return archive.b(21296);
            case "gc": return archive.c(Integer.parseInt(v[1]),111);
            case "ids": return archive.b(Integer.parseInt(v[1]),(byte)-120);
            case "checksum": return archive.c((byte)-90);
            case "named": return archive.a((byte)-120,name(v[1]));
            case "contains": return archive.a(name(v[1]),Integer.parseInt(v[2]));
            case "prefetch": archive.a(name(v[1]),(byte)-120); break;
            case "np": return archive.b(name(v[1]),v.length > 2 ? Integer.parseInt(v[2]) : -19579);
            case "percent": return archive.d(Integer.parseInt(v[1]));
            case "all": return archive.c(-2);
            case "gr": return archive.b((byte)109,Integer.parseInt(v[1]));
            case "fr": return archive.a(true,Integer.parseInt(v[1]),Integer.parseInt(v[2]));
            case "ngr": return archive.a(256,name(v[1]));
            case "nfr": return archive.a(name(v[2]),25653,name(v[1]));
            case "namedFile": return archive.a(117,name(v[2]),name(v[1]));
            case "single": return archive.a(Integer.parseInt(v[1]),-100);
            case "sr": return archive.b(Integer.parseInt(v[1]),true);
            case "file": return archive.a(-809612665,Integer.parseInt(v[2]),Integer.parseInt(v[1]));
            case "key": {
                int[] key = new int[v.length-3];
                for (int i=0; i < key.length; i++) key[i]=Integer.parseInt(v[i+3]);
                return archive.a((byte)88,Integer.parseInt(v[2]),key,Integer.parseInt(v[1]));
            }
            case "peek": return archive.a(Integer.parseInt(v[1]),Integer.parseInt(v[2]),(byte)-100);
            case "hold": {
                int group = Integer.parseInt(v[2]), file = Integer.parseInt(v[3]);
                held[Integer.parseInt(v[1])] = v[4].equals("get")
                    ? archive.a(-809612665,file,group) : archive.a(group,file,(byte)-100);
                break;
            }
            case "same": return held[Integer.parseInt(v[1])] == held[Integer.parseInt(v[2])];
            case "poke": held[Integer.parseInt(v[1])][Integer.parseInt(v[2])] = (byte)Integer.parseInt(v[3]); break;
            case "held": return held[Integer.parseInt(v[1])];
            case "fileHashes": {
                int group = Integer.parseInt(v[1]);
                StringJoiner hashes = new StringJoiner(",");
                for (int id : archive.b(group,(byte)-120)) hashes.add(Integer.toString(Arrays.hashCode(archive.a(group,id,(byte)-100))));
                return hashes.toString();
            }
            case "discard": archive.a(Integer.parseInt(v[1]),(byte)-100); break;
            case "clear": archive.b((byte)-86); break;
            case "names": archive.a((byte)-100,v[1].equals("1"),v[2].equals("1")); break;
            default: throw new AssertionError(v[0]);
        }
        return "void";
    }

    public static void main(String[] args) throws Exception {
        BufferedReader in = new BufferedReader(new InputStreamReader(System.in));
        for (String line; (line=in.readLine()) != null;) {
            Object result;
            try { result = run(line.split(" ",-1)); }
            catch (RuntimeException ex) {
                result = "threw";
                Throwable cause = ex;
                while (cause instanceof g wrapped && wrapped.a != null) cause = wrapped.a;
                if (cause instanceof NullPointerException) result = "null";
                if (cause instanceof ArrayIndexOutOfBoundsException) result = "bounds";
                if (ex instanceof g wrapped) {
                    int start = wrapped.q.indexOf("T3 - ");
                    if (start != -1) result = wrapped.q.substring(start,wrapped.q.indexOf(' ',start+5));
                }
            }
            if (result instanceof byte[] bytes) result = "bytes" + Arrays.hashCode(bytes);
            if (result instanceof int[] ints) result = Arrays.toString(ints);
            db table = (db)field(archive,"x");
            String names = table == null ? "-" : "" + (table.f!=null ? 1 : 0) + (table.o!=null ? 1 : 0) + (table.m!=null ? 1 : 0) + (table.c!=null ? 1 : 0);
            System.out.println(result + "|" + String.join(",",provider.calls) + "|" + names + "|" + slots(field(archive,"w")) + "|" + slots(field(archive,"O")));
            provider.calls.clear();
        }
    }
}
