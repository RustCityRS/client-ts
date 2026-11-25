import java.io.*;
import java.lang.reflect.*;
import java.nio.file.*;
import java.util.*;

// Commands stop at the disk-thread boundary. "drain" runs the JAR's ca.run()
// until a FIFO barrier completes, making the same interleaving repeatable.
class ProviderOracle {
    final int[] crcTable = a.f;
    final ej net = new ej();
    final ca disk;
    final cg groupStore, indexStore;
    final List<ne> files = new ArrayList<>();
    wi master;
    mc provider;
    qc queued, immediate;

    static Field field(Class<?> owner, String name) throws Exception {
        Field f = owner.getDeclaredField(name);
        f.setAccessible(true);
        return f;
    }

    static Object get(Object o, String name) throws Exception {
        return field(o.getClass(),name).get(o);
    }

    ProviderOracle(Path directory) throws Exception {
        Class<?> unsafe = Class.forName("sun.misc.Unsafe");
        Object instance = field(unsafe,"theUnsafe").get(null);
        disk = (ca) unsafe.getMethod("allocateInstance",Class.class).invoke(instance,ca.class);
        field(ca.class,"o").set(disk,new tb());
        sa data = file(directory.resolve("dat2"), 5200);
        groupStore = new cg(1,data,file(directory.resolve("idx1"),6000),1000000);
        indexStore = new cg(255,data,file(directory.resolve("idx255"),6000),1000000);
    }

    sa file(Path path, int size) throws Exception {
        ne f = new ne();
        field(ne.class,"a").setLong(f,Long.MAX_VALUE);
        field(ne.class,"c").set(f,path.toFile());
        field(ne.class,"d").set(f,new RandomAccessFile(path.toFile(),"rw"));
        files.add(f);
        return new sa(f,size,0);
    }

    void drain() throws Exception {
        qc end = disk.a(groupStore,901,17427);
        Thread worker = new Thread(disk);
        worker.setDaemon(true);
        field(ca.class,"p").setBoolean(disk,false);
        field(ca.class,"q").set(disk,worker);
        worker.start();
        long limit = System.nanoTime() + 2000000000L;
        while (end.D && System.nanoTime() < limit) Thread.sleep(1);
        if (end.D) throw new AssertionError("disk worker timed out");
        disk.a(false);
    }

    static String data(byte[] value) {
        return value == null ? "-" : Base64.getEncoder().encodeToString(value);
    }

    static byte[] bytes(String encoded) {
        return Base64.getDecoder().decode(encoded);
    }

    static void deliver(fd request, byte[] value, int position, boolean done) {
        request.P = new gd(value);
        request.P.yb = position < 0 ? value.length - request.M : position;
        if (done) {
            request.b(24120);
            request.D = false;
        }
    }

    df groupRequest(int group) throws Exception {
        return (df)((nc)get(provider,"o")).a((byte)-124, (long)group);
    }

    String run(String[] c) throws Exception {
        int n = c.length > 1 && c[1].matches("-?[0-9]+") ? Integer.parseInt(c[1]) : 0;
        switch (c[0]) {
            case "master": master = new wi(net,disk); break;
            case "crcTable": a.f = n == 0 ? new int[256] : crcTable; break;
            case "crcState": ff.G = n == 0 ? null : new java.util.zip.CRC32(); break;
            case "crcError":
                ff.G = new java.util.zip.CRC32() { @Override public void reset() { throw new AssertionError("checksum"); } };
                break;
            case "fatalGroup":
                try { return data(provider.a(0,n)); }
                catch (AssertionError error) { return "fatal"; }
            case "crcSeed": ff.G.update(new byte[]{2,3,-1},0,n); break;
            case "load": return String.valueOf(master.b(0));
            case "masterBytes": deliver((fd)get(master,"l"),bytes(c[1]),-1,true); break;
            case "provider": {
                mc old = provider;
                provider = master.a(false,n,c[2].equals("1") ? indexStore : null,c[3].equals("1") ? groupStore : null);
                return old == provider ? "same" : "new";
            }
            case "fill": for (int i=0; i<n; i++) net.a((byte)0,i,40,(byte)-70,c[2].equals("1")); break;
            case "unfill": ((tb)get(net,c[1].equals("1") ? "c" : "y")).b((byte)-109); break;
            case "index": return provider.b(255) == null ? "-" : String.valueOf(provider.b(255).k);
            case "indexPct": return String.valueOf(provider.h(0));
            case "indexBytes": deliver((fd)get(provider,"K"),bytes(c[1]),Integer.parseInt(c[2]),c[3].equals("1")); break;
            case "group": return data(provider.a(Integer.parseInt(c[2]),n));
            case "groupBytes": deliver((fd)groupRequest(n),bytes(c[2]),Integer.parseInt(c[3]),c[4].equals("1")); break;
            case "groupPct": return String.valueOf(provider.c(n,0));
            case "mixedPct": {
                nc table = (nc)get(provider,"o");
                int kind = Integer.parseInt(c[2]);
                fd net = new fd();
                net.P = new gd(kind == 4 ? 0 : 20);
                net.P.yb = 7;
                qc disk = new qc();
                disk.D = false;
                jf wrong = new jf() { int c(byte guard) { return 71; } };
                jf[] entries = { wrong, new jf(), disk, net, net };
                if (kind < entries.length) table.a((byte)-89,entries[kind],(long)n);
                qc next = new qc();
                if (kind < entries.length) table.a((byte)-89,next,(long)n);
                String value;
                try { value = String.valueOf(provider.c(n,0)); }
                catch (RuntimeException ex) {
                    Throwable cause = ex;
                    while (cause instanceof g wrapped) cause = wrapped.a;
                    if (cause instanceof ClassCastException) value = "cast";
                    else if (cause instanceof ArithmeticException) value = "arithmetic";
                    else throw ex;
                }
                return value + "/" + (table.a((byte)-124) == next);
            }
            case "groupState": {
                df r = groupRequest(n);
                return r == null ? "-" : (r instanceof fd ? "net" : "disk") + "/" + r.D + "/" + r.E + "/" + r.I;
            }
            case "priority": provider.b(21190,n); break;
            case "prefetchAll": provider.c((byte)-45); break;
            case "tick": master.a(true); break;
            case "cleanup": field(mc.class,"db").setLong(provider,0L); provider.g(29373); break;
            case "seed": {
                byte[] b = bytes(c[3]);
                cg store = c[1].equals("i") ? indexStore : groupStore;
                if (!store.a(b.length,Integer.parseInt(c[2]),b,(byte)57)) throw new AssertionError("seed");
                break;
            }
            case "write": queued = disk.a(n,groupStore,-2127,bytes(c[2])); break;
            case "immediate": immediate = disk.a(1,n,groupStore); break;
            case "read": queued = disk.a(groupStore,n,17427); break;
            case "diskState": {
                qc r = c[1].equals("q") ? queued : immediate;
                String result;
                try { result = data(r.e(0)); } catch (RuntimeException ex) { result = "exception"; }
                return r.Q + "/" + r.v + "/" + r.E + "/" + r.c((byte)-52) + "/" + result + "/" + (queued != null && queued.X != null && queued.X == r.X);
            }
            case "drain": drain(); break;
            case "pending": disk.s = n; break;
            case "doubleStop":
                field(ca.class,"q").set(disk,new Thread());
                disk.a(false);
                disk.a(false);
                break;
            default: throw new AssertionError(c[0]);
        }
        return ".";
    }

    String snapshot() throws Exception {
        String s = net.b((byte)64) + "/" + net.F + "/" + net.G + "/" + disk.s;
        if (master != null) {
            gd packet = (gd)get(master,"n");
            s += "|" + (packet == null ? "-" : packet.yb);
        }
        if (provider != null) {
            byte[] status = (byte[])get(provider,"B");
            s += "|" + get(provider,"t") + "/" + get(provider,"W") + "/" + provider.b((byte)64) + "/" + provider.a(true) + "/" +
                provider.e(110) + "/" + get(provider,"Y") + "/" + get(provider,"Z") + "/" + get(provider,"cb") + "/" +
                data(status) + "/" + ((nc)get(provider,"o")).d((byte)-107);
        }
        return s + "|" + (ff.G == null ? "-" : ff.G.getValue());
    }

    public static void main(String[] args) throws Exception {
        ProviderOracle h = new ProviderOracle(Path.of(args[0]));
        BufferedReader in = new BufferedReader(new InputStreamReader(System.in));
        try {
            for (String line; (line = in.readLine()) != null;) {
                String result;
                try { result = h.run(line.split(" ")); } catch (RuntimeException ex) { result = "exception"; }
                System.out.println(result + "|" + h.snapshot());
            }
        } finally { for (ne f : h.files) f.a(-1); }
    }
}
