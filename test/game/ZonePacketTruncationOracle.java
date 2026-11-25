import java.io.*;
import java.net.Socket;
import java.lang.reflect.Field;
import java.util.*;

// No classfile instrumentation. The three entry points run from the pinned SD JAR.
public class ZonePacketTruncationOracle {
    static final Field cursor;
    static {
        try { cursor = gk.class.getDeclaredField("t"); cursor.setAccessible(true); }
        catch (Exception error) { throw new AssertionError(error); }
    }

    static class Peer extends Socket {
        final byte[] bytes;
        Peer(byte[] bytes) { this.bytes = bytes; }
        public void setSoTimeout(int n) {}
        public void setTcpNoDelay(boolean enabled) {}
        public InputStream getInputStream() { return new ByteArrayInputStream(bytes); }
        public OutputStream getOutputStream() { return OutputStream.nullOutputStream(); }
    }

    static void run(int opcode, int entry, int scenario, int start, byte[] body) throws Exception {
        int base = scenario <= 2 ? 200 : 0;
        gk pile = new gk();
        jf wrong = new jf();
        ig item = new ig(); item.m = 5; item.p = 7;
        b node = new b(item);
        if (scenario == 3) pile.a(wrong, false);
        pile.a(node, false);
        if (scenario == 4) pile.a(wrong, false);
        b.H = new gk[1][8][8]; b.H[0][0][0] = pile;
        nl.Q.b((byte)125); wh.S.b((byte)125);
        kl.Bb = new ra[1][8][8]; ve.q = null; ah.f = 0; mi.y = 51;
        dg.C = ha.a = base; ia.q = 71; fk.X = 41; la.W = 42; jh.q = 43;
        boolean enclosed = entry == 2 || entry == 4;
        byte[] frame = body;
        if (enclosed) {
            frame = new byte[body.length + 3]; frame[0] = (byte)(base + 128); frame[1] = (byte)(128 - base); frame[2] = (byte)opcode;
            System.arraycopy(body, 0, frame, 3, body.length);
        }
        hd.b = new be(0); hd.b.fb = scenario == 1 ? null : entry == 0 ? frame.clone() : new byte[frame.length];
        hd.b.yb = start; o.Y = enclosed ? 230 : opcode;
        byte[] transport = Arrays.copyOf(frame, frame.length + 1);
        ek.s = new se(new Peer(transport), null);
        af.I = entry == 3 || entry == 4 ? transport.length + 1 : frame.length;
        String status = "ok";
        try {
            if (entry == 0) qd.a(64);
            else status = "" + rg.a((byte)57);
        } catch (RuntimeException err) {
            Throwable root = err;
            while (root instanceof g wrapped) root = wrapped.a;
            status = root.getClass().getSimpleName() + "@" + (err instanceof g wrapped ? wrapped.q : "");
        }
        StringJoiner merges = new StringJoiner("/");
        for (jk m = (jk)nl.Q.d(0); m != null; m = (jk)nl.Q.a(0)) merges.add(LocMergeOracle.merge(m));
        jf next = (jf)cursor.get(pile);
        String cur = next == null ? "-" : next == wrong ? "w" : next == node ? "b" : next == pile.c ? "s" : "?";
        System.out.println(status + "|" + hd.b.yb + "," + o.Y + "," + af.I + "|" + ia.q + "," + fk.X + "," + la.W + "," +
            jh.q + "|" + merges + "|" + cur + "," + item.p + "," + (node.p != null) + "," + (wrong.p != null));
    }
    public static void main(String[] args) throws Exception {
        var read = new BufferedReader(new InputStreamReader(System.in));
        for (String line; (line = read.readLine()) != null;) {
            String[] words = line.split(" ", -1);
            run(Integer.parseInt(words[0]),Integer.parseInt(words[1]),Integer.parseInt(words[2]),Integer.parseInt(words[3]),HexFormat.of().parseHex(words[4]));
        }
    }
}
