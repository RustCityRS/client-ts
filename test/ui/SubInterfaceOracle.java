import java.io.*;
import java.net.Socket;
import java.nio.file.*;
import java.util.*;

class SubInterfaceOracle {
    static final int ROOT = 596, A = 100, B = 101, C = 102;

    static class Provider extends ud {
        final db index;
        Provider(byte[] data) { index = new db(data, q.a(0, data, data.length)); }
        byte[] a(int unused, int group) { return null; }
        void b(int unused, int group) {}
        db b(int unused) { return index; }
        int c(int unused, int group) { return 0; }
    }

    static void packet(int opcode, byte[] bytes) throws Exception {
        Socket sock = new Socket() {
            public void setSoTimeout(int timeout) {}
            public void setTcpNoDelay(boolean b) {}
            public InputStream getInputStream() { return new ByteArrayInputStream(bytes); }
            public OutputStream getOutputStream() { return new ByteArrayOutputStream(); }
        };
        ek.s = new se(sock, null);
        af.I = bytes.length;
        o.Y = opcode;
        if (!rg.a((byte)57)) throw new AssertionError(opcode);
    }

    static void widgets(int group, int n, int marker) {
        aj[] row = fk.ab[group] = new aj[n];
        rg.b[group] = true;
        for (int i = 0; i < n; i++) {
            aj c = row[i] = new aj();
            c.Kc = group << 16 | i;
            c.ob = group == ROOT ? 0 : 3;
            c.X = c.h = (byte)(group == ROOT ? 0 : 1);
            c.G = 101 + i * 4;
            c.M = 73 - i;
            c.R = vk.db;
            c.vb = i + marker * 3;
            c.Lb = new Object[]{9001, marker};
            c.ac = new Object[]{9001, marker + i};
            c.ic = new Object[]{9001, marker};
        }
    }

    static String table() {
        StringJoiner text = new StringJoiner(",");
        oj it = new oj(va.Z);
        for (qd sub = (qd)it.b(-1); sub != null; sub = (qd)it.a(15035))
            text.add(sub.k + "/" + sub.q + "/" + sub.v);
        return text.toString();
    }

    static String sample(qd last) {
        StringJoiner out = new StringJoiner("|");
        out.add(table()).add(String.valueOf(last != null && last.a((byte)-90)))
            .add(String.valueOf(od.U[2])).add(String.valueOf(ca.g != null));
        int dirty = 1;
        for (boolean b : sf.m) dirty = 31 * dirty + (b ? 1 : 0);
        out.add(String.valueOf(dirty));
        for (int group : new int[]{ROOT,A,B,C}) {
            out.add(String.valueOf(rg.b[group]));
            if (fk.ab[group] != null) for (aj c : fk.ab[group]) out.add(c.C + "/" + c.H);
        }
        for (wf e = (wf)mi.q.a(true); e != null; e = (wf)mi.q.a(true))
            out.add(String.valueOf(e.C.Kc));
        return out.toString();
    }

    static int layout() {
        int hash = 1, r = 0x530;
        for (int i = 0; i < 2048; i++) {
            aj c = new aj();
            r = r*1664525 + 1013904223;
            int width = r >> (i % 31);
            r = r*1664525 + 1013904223;
            int height = r >> (i % 25);
            c.h = (byte)((i % 7) - 1); c.X = (byte)((i / 7 % 7) - 1);
            c.ub = (byte)((i / 3 % 8) - 1); c.m = (byte)((i / 11 % 8) - 1);
            c.ob = new int[]{0,2,7,3}[i % 4];
            c.ab = 0x10003 * i; c.jd = -0x10001 * i;
            c.G = r >> (i % 19); c.M = r >> (i % 11);
            c.Bc = width ^ r; c.Ec = height ^ r;
            c.cb = (i & 15) - 7; c.Wb = (i & 7) - 3;
            c.Sc = new l(i % 3, -1); c.ic = new Object[]{1};
            uc.c = (i & 1) != 0;
            try { pa.a(c,width,true,height,2); gh.a(c,(byte)-116,width,height); }
            catch (RuntimeException ex) { hash = hash*31+733; }
            for (int value : new int[]{c.C,c.H,c.ib,c.Mb}) hash = 31*hash + value;
            hash = 31*hash + (mi.q.a(true) != null ? 1 : 0);
        }
        uc.c = false;
        return hash;
    }

    public static void main(String[] args) throws Exception {
        System.out.println(layout());
        kh.A = new al(new Provider(Files.readAllBytes(Path.of(args[0]))), false, true);
        fk.ab = new aj[kh.A.b(21296)][];
        rg.b = new boolean[fk.ab.length];
        vb.o = 1; hi.f = 765; fl.l = 503;
        vk.db = 10;
        widgets(ROOT, 3, 1); widgets(A, 1, 4); widgets(B, 1, 5); widgets(C, 1, 6);
        m script = new m();
        script.D = new int[]{42,0,4002,33,4000,43,21}; script.F = new int[]{2,10,0,0,0,2,0};
        script.B = new id[7]; script.E = 1; sf.g.a(9001L,0,script);
        for (int i=1; i<args.length; i++) {
            Arrays.fill(sf.m,false); od.U[2]=0;
            ca.g = fk.ab[ROOT][2];
            qd last = (qd)va.Z.a((byte)-85,(long)(ROOT << 16));
            String[] words=args[i].split("-");
            packet(Integer.parseInt(words[0]), HexFormat.of().parseHex(words[1]));
            System.out.println(sample(last));
        }
    }
}
