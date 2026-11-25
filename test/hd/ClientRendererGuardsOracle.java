import java.util.Arrays;

/** Invoke the HD packet decoder and interface traversal with each renderer selected. */
public final class ClientRendererGuardsOracle {
    public static void main(String[] args) {
        byte[] body = new byte[20];
        for (int i = 0; i < body.length; i++) body[i] = (byte) (7 + 17 * i);
        for (boolean active : new boolean[]{false, true}) {
            tf.w = active;
            for (int size = 0; size <= body.length; size++) {
                na.l = 202;
                eg.e = new i(0);
                eg.e.y = Arrays.copyOf(body, size);
                ka.q = new ih();
                String status = "ok";
                try {
                    g.b((byte) -100);
                } catch (ld error) {
                    Throwable cause = error;
                    while (cause instanceof ld) cause = ((ld) cause).f;
                    if (!(cause instanceof ArrayIndexOutOfBoundsException)) throw error;
                    status = "bounds";
                }
                System.out.println("packet " + active + " " + size + " " + status + " " + eg.e.T + " " + (ka.q.b(2) != null));
            }
            for (boolean current : new boolean[]{false, true}) {
                be c = new be();
                c.N = -1;
                c.I = 1;
                c.Hb = c.T = true;
                c.K = 1402;
                c.n = c.R = 20;
                c.Uc = 1;
                oj.v = 9;
                c.cb = current ? 9 : 8;
                pa.R = new boolean[2];
                client.a(new be[]{c}, -1, 0, 0, 30, 30, 0, 0);
                System.out.println("widget " + active + " " + current + " " + pa.R[1]);
            }
        }
    }
}
