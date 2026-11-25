import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;

// Differential oracle for the exception paths of the revision 530 scene traversal (src/dash3d/world.ts): the
// catch (Exception) arm around p.a's sprite pass (world.Fill), and an exception that escapes the traversal from a
// wall draw outside that try. Compiled into the jar's unnamed package so it can subclass ug and call the
// package-private statics. world-fill-catch.test.ts runs the same script through the TS port and compares the lines.
//
// Test models: an id with id % 10 == 9 throws from its draw, id % 10 == 8 throws from getMinY (ug.b), others log only.
class WorldFillOracle {
    static final StringBuilder log = new StringBuilder();

    static void call(String token) {
        log.append(' ').append(token);
    }

    static final class TM extends ug {
        final int id;

        TM(int id) {
            this.id = id;
        }

        void a(int yaw, int sinPitch, int cosPitch, int sinYaw, int cosYaw, int x, int y, int z, long typecode, int level, ue particles) {
            call("D" + id + "," + yaw + "," + x + "," + y + "," + z + "," + typecode + "," + level);
            if (id % 10 == 9) {
                call("X" + id);
                throw new IllegalStateException("T" + id);
            }
        }

        int b() {
            call("B" + id);
            if (id % 10 == 8) {
                call("Y" + id);
                throw new IllegalStateException("M" + id);
            }
            return -((id * 37) % 300);
        }

        void a(int arg0, int arg1, int arg2, int arg3, int arg4) {
            call("U" + id);
        }
    }

    static ug model(int id) {
        return id < 0 ? null : new TM(id);
    }

    static String dump() {
        StringBuilder sb = new StringBuilder();
        sb.append("f").append(af.O).append(",c").append(la.kb).append(",i").append(o.O ? 1 : 0);
        ra[][][] squares = kl.Bb;
        for (int level = 0; level < squares.length; level++)
            for (int x = 0; x < squares[level].length; x++)
                for (int z = 0; z < squares[level][x].length; z++) {
                    ra r = squares[level][x][z];
                    if (r == null) continue;
                    sb.append(' ').append(level).append('/').append(x).append('/').append(z).append(':');
                    sb.append(r.B ? 1 : 0).append(r.J ? 1 : 0).append(r.E ? 1 : 0);
                    sb.append(',').append(r.D).append(',').append(r.I).append(',').append(r.U).append(',').append(r.G).append(',').append(r.t);
                    for (int i = 0; i < r.t; i++) {
                        ec s = r.H[i];
                        sb.append(';').append(((TM) s.z).id).append('@').append(s.r).append('/').append(s.l);
                    }
                }
        return sb.toString();
    }

    public static void main(String[] argv) throws Exception {
        BufferedReader in = new BufferedReader(new InputStreamReader(System.in, StandardCharsets.US_ASCII));
        StringBuilder out = new StringBuilder();
        for (String line; (line = in.readLine()) != null;) {
            if (line.isEmpty()) continue;
            String[] f = line.split(" ");
            long[] a = new long[f.length - 1];
            for (int i = 1; i < f.length; i++) a[i - 1] = Long.parseLong(f[i]);
            int[] n = new int[a.length];
            for (int i = 0; i < a.length; i++) n[i] = (int) a[i];
            log.setLength(0);
            String result;
            try {
                result = run(f[0], n, a);
            } catch (IllegalStateException e) {
                result = "ex:" + e.getMessage();
            } catch (ArrayIndexOutOfBoundsException e) {
                result = "aioobe";
            } catch (NullPointerException e) {
                result = "npe";
            }
            out.append(result).append('|').append(log).append('\n');
        }
        System.out.print(out);
        System.out.flush();
    }

    static String run(String op, int[] n, long[] a) {
        switch (op) {
            case "fb": {
                int width = n[0], height = n[1];
                td.g = new int[width * height];
                td.c = width;
                td.i = height;
                td.e = 0;
                td.b = 0;
                td.h = width;
                td.d = height;
                dc.d();
                return "ok";
            }
            case "init":
                mc.a(n[0], n[1], n[2], n[3], n[4] != 0);
                return "ok";
            case "fbl":
                cf.a(n[0]);
                return "ok";
            case "spr":
                return Boolean.toString(bc.a(n[0], n[1], n[2], n[3], n[4], n[5], n[6], n[7], model(n[8]), n[9], n[10] != 0, a[11]));
            case "wall":
                ae.a(n[0], n[1], n[2], n[3], model(n[4]), model(n[5]), n[6], n[7], a[8]);
                return "ok";
            case "delwall":
                return wb.a(n[0], n[1], n[2]) == null ? "null" : "wall";
            case "draw":
                qc.a(n[0], n[1], n[2], n[3], n[4], null, null, null, null, null, null, 0, (byte) 0, n[5], n[6]);
                return "ok";
            case "dump":
                return dump();
            default:
                throw new IllegalArgumentException("unknown op " + op);
        }
    }
}
