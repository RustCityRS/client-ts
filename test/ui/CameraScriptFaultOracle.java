import java.io.*;
import java.util.*;
import java.util.regex.Pattern;

class CameraScriptFaultOracle {
    static final Pattern report = Pattern.compile("CS2 - scr:-?[0-9]+ op:(-?[0-9]+)");

    public static void main(String[] args) throws Exception {
        var reader = new BufferedReader(new InputStreamReader(System.in));
        var output = System.out;
        int key = 85500;
        for (String row; (row = reader.readLine()) != null;) {
            int[] values = Arrays.stream(row.split(" ")).mapToInt(Integer::parseInt).toArray();
            int op = values[0], layout = values[1], n = values.length - 2;
            kg.l[0] = layout == 0 ? null : new int[layout][4];
            kg.l[1] = new int[6][4];
            qa.P = mf.q = ck.I = sc.W = se.d = ga.A = mg.e = 511;
            cl.e = 2;
            lj.j = d.p = jh.m = bc.i = bi.k = ah.e = fd.ab = nh.O = bd.W = qi.U = bj.h = 181;
            ec.g = false; gl.C = 75; me.P = 69; ig.t = 18; h.i = null;
            Arrays.fill(tg.B, -691);
            m code = new m();
            code.D = new int[n + 3];
            code.F = new int[n + 3];
            code.B = new id[n + 3];
            System.arraycopy(values, 2, code.F, 0, n);
            code.D[n] = op; code.F[n + 1] = -72; code.D[n + 2] = 21;
            sf.g.a((long)key, 0, code);
            wf event = new wf(); event.G = new Object[]{key++};
            var capture = new ByteArrayOutputStream();
            System.setOut(new PrintStream(capture));
            try { gh.a(event, -22368, 1200); } finally { System.setOut(output); }
            String log = capture.toString(), fault = "-";
            var match = report.matcher(log);
            if (match.find()) fault = match.group(1) + "/" + (
                log.contains("NullPointerException") ? "null" :
                log.contains("IndexOutOfBoundsException") ? "bounds" :
                log.contains("NegativeArraySizeException") ? "length" :
                log.contains("IllegalStateException") ? "illegal" : "runtime");
            output.println(fault + ";" + Arrays.hashCode(tg.B) + ";" + Arrays.deepHashCode(kg.l) + ";" +
                Arrays.toString(new int[]{qa.P, mf.q, ck.I, sc.W, se.d, ga.A, mg.e, cl.e, lj.j, d.p, jh.m, bc.i,
                    bi.k, ah.e, fd.ab, nh.O, bd.W, qi.U, bj.h, ec.g ? 1 : 0, gl.C, me.P, ig.t}));
        }
    }
}
