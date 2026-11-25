import java.io.*;
import java.net.Socket;
import java.util.*;

class WidgetPacketOracle {
    static final HexFormat hex = HexFormat.of();

    static void bind(int op, int capacity, byte[] data) throws Exception {
        byte[] wire = Arrays.copyOf(data, data.length + 1);
        Socket socket = new Socket() {
            public void setSoTimeout(int value) {}
            public void setTcpNoDelay(boolean value) {}
            public InputStream getInputStream() { return new ByteArrayInputStream(wire); }
            public OutputStream getOutputStream() { return new ByteArrayOutputStream(); }
        };
        ek.s = new se(socket, null);
        hd.b = new be(capacity); Arrays.fill(hd.b.fb, (byte)0);
        o.Y = op; af.I = data.length; jd.i = 56; qc.Z = false; ia.q = 7; la.W = 81; fk.X = 93;
    }

    public static void main(String[] args) throws Exception {
        var reader = new BufferedReader(new InputStreamReader(System.in));
        kl obj = new kl();
        obj.U = 113; obj.P = 337; obj.m = 882; obj.gb = Integer.MAX_VALUE; obj.q = -173; obj.u = 235;
        fa.b.a(995L, obj, (byte)-71);
        for (String line; (line = reader.readLine()) != null;) {
            String[] parts = line.split(" ", -1);
            int op = Integer.parseInt(parts[0]), mode = Integer.parseInt(parts[1]), capacity = Integer.parseInt(parts[2]);
            bind(op,capacity,hex.parseHex(parts[3]));
            aj widget = new aj(); widget.y = (mode & 1) == 0; widget.Kc = 0;
            widget.R = vk.db; widget.vb = 6; widget.Sc = new l(634, 803); sf.m[6] = false;
            fk.ab = new aj[][]{{widget}}; rg.b = new boolean[]{true};
            te.g = (mode & 2) == 0 ? new pb() : null;
            if (te.g != null && (mode & 4) == 0) { te.g.pc = new cl(); te.g.pc.k = -1; }
            fd.W = new nc(512); if ((mode & 8) != 0) fd.W.a((byte)-89, new l(19, 56), -1L);
            if (mode >= 16) {
                fd.W.a((byte)-89, new jf(), mode - 17L);
                va.Z = new nc(8);
                va.Z.a((byte)-89, new jf(), 0L);
            }
            wf.b(true);
            String outcome;
            try { outcome = String.valueOf(rg.a((byte)57)); }
            catch (RuntimeException ex) {
                Throwable cause = ex;
                while (cause instanceof g wrap && wrap.a != null) cause = wrap.a;
                outcome = cause instanceof IndexOutOfBoundsException ? "bounds" : cause instanceof NullPointerException ? "null" :
                    cause instanceof ArithmeticException ? "arithmetic" : cause instanceof ClassCastException ? "cast" : cause.getClass().getName();
            }
            var overrides = new StringJoiner(",");
            for (jf node = fd.W.c((byte)30); node != null; node = fd.W.a(11))
                overrides.add(node instanceof l p ? p.k + ":" + p.E + ":" + p.x : node.k + ":link");
            var queue = new StringJoiner(",");
            for (ce c; (c = we.a(-124)) != null;) queue.add(c.d(55) + ":" + c.c((byte)126) + ":" + c.H + ":" + c.S + ":" + c.L + ":" +
                (c.O == null ? "-" : hex.formatHex(c.O.A, 0, c.O.c)));
            System.out.println(outcome + ";" + hd.b.yb + ";" + o.Y + ";" + jd.i + ";" + qc.Z + ";" + ia.q + ";" + la.W +
                ";" + fk.X + ";" + jh.q + ";" + widget.nd + ";" + widget.d + ";" + widget.md + ";" + widget.w + ";" + widget.vd +
                ";" + sf.m[6] + ";" + overrides + ";" + queue);
        }
    }
}
