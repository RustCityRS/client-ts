import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Arrays;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.Socket;
import java.util.HexFormat;

class InterfaceFoundationOracle {
    private static final class GroupProvider extends ud {
        final db index;
        final byte[] group;
        boolean ready;

        GroupProvider(byte[] reference, byte[] group) {
            index = new db(reference, q.a(0, reference, reference.length));
            this.group = group;
        }

        byte[] a(int unused, int groupId) { return ready ? group : null; }
        void b(int unused, int groupId) {}
        db b(int unused) { return index; }
        int c(int unused, int groupId) { return ready ? 100 : 0; }
    }

    static void properties() {
        int mask = 0x530;
        int[] hashes = new int[12];
        Arrays.fill(hashes, 1);
        for (int i = 0; i < 4096; i++) {
            int bits = i < 32 ? 1 << i : i < 64 ? ~(1 << (i - 32)) : mask;
            l p = new l(bits, i - 1);
            hashes[0] = 31 * hashes[0] + p.E;
            hashes[1] = 31 * hashes[1] + p.x;
            hashes[2] = 31 * hashes[2] + p.b(-1);
            hashes[3] = 31 * hashes[3] + (p.c(3867171) ? 1 : 0);
            hashes[4] = 31 * hashes[4] + (p.d(-23) ? 1 : 0);
            hashes[5] = 31 * hashes[5] + p.e(-30954);
            for (int op = -2; op <= 32; op++)
                hashes[6] = 31 * hashes[6] + (p.a((byte)-100, op) ? 1 : 0);
            hashes[7] = 31 * hashes[7] + (p.f(3867171) ? 1 : 0);
            hashes[8] = 31 * hashes[8] + (p.g(12928) ? 1 : 0);
            hashes[9] = 31 * hashes[9] + (p.c((byte)-100) ? 1 : 0);
            hashes[10] = 31 * hashes[10] + (p.d((byte)100) ? 1 : 0);
            hashes[11] = 31 * hashes[11] + (p.h(0) ? 1 : 0);
            mask = mask * 1664525 + 1013904223;
        }
        System.out.println(Arrays.toString(hashes));
    }

    private static aj hook(int id, int child, int mark) {
        aj c = new aj();
        c.Kc = id;
        c.bc = child;
        c.ob = 3;
        c.Lb = c.ac = c.Rc = new Object[]{9001, mark};
        return c;
    }

    private static void hooks(int group) {
        m script = new m();
        script.D = new int[]{42, 0, 4002, 33, 4000, 43, 21};
        script.F = new int[]{2, 10, 0, 0, 0, 2, 0};
        script.B = new id[script.D.length];
        script.E = 1;
        sf.g.a(9001L, 0, script);
        int id = group << 16;
        aj parent = hook(id, -1, 4);
        parent.ob = 0;
        parent.pb = new aj[]{hook(id, 0, 1), null, hook(id, 8, 2), hook(id, 0, 3)};
        fk.ab[group] = new aj[]{parent, hook(id + 1, -1, 5)};
        rg.b[group] = true;
        od.U[2] = 0;
        gd.b(group, (byte)-89);
        System.out.println(od.U[2]);
        for (int reason = 0; reason < 2; reason++) {
            od.U[2] = 0;
            dk.b((byte)77, group, reason);
            System.out.println(od.U[2]);
        }
    }

    public static void main(String[] args) throws Exception {
        properties();
        int group = Integer.parseInt(args[0]);
        GroupProvider source = new GroupProvider(Files.readAllBytes(Path.of(args[1])), Files.readAllBytes(Path.of(args[2])));
        kh.A = new al(source, false, true);
        fk.ab = new aj[kh.A.b(21296)][];
        rg.b = new boolean[fk.ab.length];
        int first = group << 16;
        System.out.println(qg.a(group, false) + "," + (ad.a((byte)110, first) == null) + "," + rg.b[group]);
        source.ready = true;
        System.out.println(qg.a(group, true) + "," + fk.ab[group].length + "," + rg.b[group]);
        aj preserved = new aj();
        preserved.Kc = first;
        fk.ab[group][0] = preserved;
        System.out.println(qg.a(group, false) + "," + (preserved == ad.a((byte)110, first)) + "," + rg.b[group]);
        int[] ids = new int[fk.ab[group].length], content = new int[ids.length];
        for (int i = 0; i < ids.length; i++) {
            aj component = ad.a((byte)110, first | i);
            ids[i] = component == null ? -1 : component.Kc;
            content[i] = component == null ? -1 : component.wc * 256 + component.ob;
        }
        System.out.println(Arrays.hashCode(ids) + "," + Arrays.hashCode(content));
        source.ready = false;
        System.out.println(qg.a(group, false) + "," + (preserved == ad.a((byte)110, first)));
        preserved.Sc = new l(767, 12345);
        for (int i = 3; i < args.length; i++) {
            String[] parts = args[i].split("-");
            byte[] body = HexFormat.of().parseHex(parts[1]);
            Socket socket = new Socket() {
                public void setSoTimeout(int timeout) {}
                public void setTcpNoDelay(boolean value) {}
                public InputStream getInputStream() { return new ByteArrayInputStream(body); }
                public OutputStream getOutputStream() { return new ByteArrayOutputStream(); }
            };
            ek.s = new se(socket, null);
            o.Y = Integer.parseInt(parts[0]);
            af.I = body.length;
            if (!rg.a((byte)57)) throw new AssertionError("message was not consumed");
            for (int child = -1; child <= 1; child++) {
                aj component = child == -1 ? preserved : new aj();
                component.Kc = first;
                component.bc = child;
                l active = client.a(component);
                System.out.println(active.E + "," + active.x);
            }
        }
        preserved.ob = 2;
        ra.a(group, -556);
        System.out.println(rg.b[group] + "," + (fk.ab[group][0] == preserved) + "," + (fk.ab[group][1] == null));
        hooks(group);
        rj.a(group, 100);
        for (int child = -1; child <= 1; child++) {
            aj c = new aj();
            c.Kc = first;
            c.bc = child;
            l props = client.a(c);
            System.out.println(props.E + "," + props.x);
        }
    }
}
