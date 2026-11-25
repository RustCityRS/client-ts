import java.awt.Canvas;
import java.io.*;
import java.net.Socket;
import java.util.*;

class GroundObjOracle {
    static final IdentityHashMap<ig, Integer> identities = new IdentityHashMap<>();
    static String obj(ig item) {
        if (item == null) return "-";
        return identities.computeIfAbsent(item, o -> identities.size() + 1) + "/" + item.m + "/" + item.p;
    }
    static String snapshot() {
        StringJoiner lists = new StringJoiner("|"), slots = new StringJoiner("|");
        for (int plane = 0; plane < 4; plane++) {
            for (int x = 0; x < 104; x++) {
                for (int z = 0; z < 104; z++) {
                    String tile = null;
                    gk list = b.H[plane][x][z];
                    if (list != null) {
                        tile = plane + "/" + x + "/" + z + ":";
                        StringJoiner nodes = new StringJoiner(",");
                        for (b n = (b)list.d(0); n != null; n = (b)list.a(0)) nodes.add(obj(n.T));
                        lists.add(tile + nodes);
                    }
                    ra cell = kl.Bb[plane][x][z];
                    if (cell != null && cell.y != null) {
                        mh slot = cell.y;
                        if (tile == null) tile = plane + "/" + x + "/" + z + ":";
                        slots.add(tile + obj((ig)slot.k) + "," + obj((ig)slot.b) + "," + obj((ig)slot.f));
                    }
                }
            }
        }
        return lists + ";" + slots;
    }

    static void receive(int op, byte[] data) throws Exception {
        Socket socket = new Socket() {
            public void setSoTimeout(int n) {}
            public void setTcpNoDelay(boolean b) {}
            public InputStream getInputStream() { return new ByteArrayInputStream(data); }
            public OutputStream getOutputStream() { return OutputStream.nullOutputStream(); }
        };
        ek.s = new se(socket, null);
        o.Y = op;
        af.I = data.length;
        hd.b.fb = new byte[data.length];
        if (!rg.a((byte)57)) throw new AssertionError();
    }

    public static void main(String[] args) throws Exception {
        kl.Bb = new ra[4][104][104];
        b.H = new gk[4][104][104];
        te.g = new pb();
        hk.e = vj.t = 0;
        mi.y = 73;
        dg.C = ha.a = ah.f = 0;
        tf.C = 25;
        wj.g = new fg(new byte[257], new int[256], new int[256], new int[256], new int[256], new byte[256][0]);
        qd.s = vb.a("", (byte)54);
        pe.S = new Canvas();
        ba.d = new gk();
        var input = new BufferedReader(new InputStreamReader(System.in));
        String line;
        while ((line = input.readLine()) != null) {
            String[] parts = line.split(" ", -1);
            int pos = -1;
            String result = "ok";
            try {
                switch (parts[0]) {
                    case "type" -> {
                        kl type = new kl();
                        type.h = Integer.parseInt(parts[2]);
                        type.ib = Integer.parseInt(parts[3]);
                        fa.b.a(Long.parseLong(parts[1]), type, (byte)-71);
                    }
                    case "plane" -> ah.f = Integer.parseInt(parts[1]);
                    case "shift" -> bj.a(ah.f, (Integer.parseInt(parts[2]) >> 3) + 6, 0, 0, (Integer.parseInt(parts[1]) >> 3) + 6, 0, false);
                    case "refresh" -> {
                        kl.Bb = new ra[4][104][104];
                        for (int x = 0; x < 104; x++) for (int z = 0; z < 104; z++) {
                            ng.b(121, z, x);
                        }
                    }
                    default -> {
                        try {
                            receive(Integer.parseInt(parts[0]), HexFormat.of().parseHex(parts[1]));
                        } finally { pos = hd.b.yb; }
                    }
                }
            } catch (RuntimeException error) {
                Throwable cause = error;
                while (cause instanceof g wrapped && wrapped.a != null) cause = wrapped.a;
                if (parts[0].equals("shift")) { error.printStackTrace(); cause.printStackTrace(); }
                result = cause instanceof IndexOutOfBoundsException ? "bounds" : cause instanceof NullPointerException ? "null" : "runtime";
            }
            System.out.println(result + ";" + pos + ";" + snapshot());
        }
    }
}
