import java.io.*;
import java.net.Socket;
import java.util.Arrays;
import java.util.HexFormat;

class PacketFragmentsOracle {
    static final class Input extends ByteArrayInputStream {
        int visible;
        Input(byte[] data) { super(data); }
        public int available() { return visible - pos; }
        public int read(byte[] dst, int off, int len) { return super.read(dst, off, Math.min(len, available())); }
        int consumed() { return pos; }
    }
    static String hex(id text) {
        return text == null ? "~" : HexFormat.of().formatHex(text.A, 0, text.c);
    }
    public static void main(String[] args) throws Exception {
        BufferedReader reader = new BufferedReader(new InputStreamReader(System.in));
        for (String line; (line = reader.readLine()) != null;) {
            byte[] wire = HexFormat.of().parseHex(line);
            Input input = new Input(wire);
            ek.s = new se(new Socket() {
                public void setSoTimeout(int timeout) {}
                public void setTcpNoDelay(boolean enabled) {}
                public InputStream getInputStream() { return input; }
                public OutputStream getOutputStream() { return OutputStream.nullOutputStream(); }
            }, null);
            hd.b = new be(5000);
            Arrays.fill(hd.b.fb, (byte)0);
            Arrays.fill(hd.b.fb, 0, 12, (byte)49);
            hd.b.a(new int[]{11, 19, 73, 37}, -1);
            hd.b.yb = 7; o.Y = -1; af.I = -17; ia.q = 37;
            fk.X = 1; la.W = 2; jh.q = 3;
            tj.m = null; fb.f = 2; fb.l = "windows"; vk.kb = false; pa.tb = false;
            di.a = new gk(); oj.k = null; client.sb = null; rb.h = new ea[6];
            pi.p = 735; bb.e = 968; dg.C=11; ha.a=19; ah.f=0; ei.q=null;
            for (input.visible = 0; input.visible <= wire.length; input.visible++) {
                String outcome;
                try { outcome = Boolean.toString(rg.a((byte)57)); }
                catch (g error) { outcome = "exception"; }
                qj check = (qj)di.a.d(0);
                System.out.println(String.join("|", outcome, ""+o.Y, ""+af.I, ""+hd.b.yb, ""+input.consumed(),
                    ""+fk.X, ""+la.W, ""+jh.q, ""+ia.q, ""+pi.p, ""+(rb.h[2]!=null), hex(oj.k),
                    hex(client.sb), ""+pa.tb, check==null?"~":""+check.E, ""+dg.C, ""+ha.a));
            }
        }
    }
}
