import java.io.BufferedReader;
import java.io.ByteArrayOutputStream;
import java.io.InputStreamReader;
import java.io.PrintStream;
import java.lang.reflect.Field;
import java.lang.reflect.Proxy;
import java.util.Arrays;
import java.util.HexFormat;
import java.util.StringJoiner;

// Runs a setter, its getter and a completion marker through gh.a in client.jar.
class PreferenceScriptOracle {
    public static void main(String[] args) throws Exception {
        HexFormat hex = HexFormat.of();
        al materials = new al(new GameProtocolOracle.EmptyAssets(hex.parseHex("00000000020000")), false, false);
        kg textures = new kg(null, materials, null, 4, false);
        pc wrongProvider = (pc)Proxy.newProxyInstance(pc.class.getClassLoader(), new Class<?>[]{pc.class},
                (proxy, method, arguments) -> { throw new AssertionError("unexpected dispatch"); });
        Field recentUse = kg.class.getDeclaredField("k");
        recentUse.setAccessible(true);
        vj cache = (vj)recentUse.get(textures);
        Field lowMemory = kg.class.getDeclaredField("G");
        lowMemory.setAccessible(true);
        ve.f = new ng();
        int id = 700;
        int marker = 0x1234abcd;
        BufferedReader in = new BufferedReader(new InputStreamReader(System.in));
        PrintStream output = System.out;
        for (String line; (line = in.readLine()) != null;) {
            String[] values = line.split(" ");
            int opcode = Integer.parseInt(values[0]), value = Integer.parseInt(values[1]);
            te.e = Integer.parseInt(values[2]);
            jd.a(-100, null);
            qc.W = true;
            kf.n = false;
            ac.k = new byte[4][104][104];
            ac.k[0][0][0] = 19;
            sf.j = new int[3];
            ai.d = 24;
            tf.C = 30;
            dd.n = 42;
            ng.B = 0;
            oa.i = -1;
            hj.i = 0;
            hj.d = true;
            sd.N = Integer.parseInt(values[3]);
            ve.f.b(256, 122);
            textures.a(-85, false);
            cache.a(11L, 0, new ei());
            int provider = values.length > 4 ? Integer.parseInt(values[4]) : 0;
            dc.r = provider == 1 ? null : provider == 2 ? wrongProvider : textures;
            he.w.a(1L, new Object(), (byte)-71);
            gb.r.a(1L, new Object(), (byte)-71);
            int writes = b.N;
            m script = new m();
            script.D = new int[]{0, opcode, opcode + 100, 0, 21};
            script.F = new int[]{value, 0, 0, marker, 0};
            script.B = new id[5];
            sf.g.a(++id, 0, script);
            wf event = new wf();
            event.G = new Object[]{id};
            Arrays.fill(tg.B, -991);
            ByteArrayOutputStream report = new ByteArrayOutputStream();
            System.setOut(new PrintStream(report));
            try { gh.a(event, -22368, 1000); } finally { System.setOut(output); }
            String log = report.toString();
            String fault = log.isEmpty() ? "ok" : log.contains("ClassCastException") ? "cast"
                    : log.contains("NullPointerException") ? "null" : log;
            gd disk = db.b(-6);
            StringJoiner result = new StringJoiner(";");
            for (Object field : new Object[]{tg.B[0], tg.B[1], tg.B[2], hex.formatHex(disk.fb, 0, disk.yb),
                    e.a(104), qc.W, b.N - writes, tf.C, sf.a(0), uj.j, kf.d, lowMemory.getBoolean(textures),
                    he.w.a(1L, false) != null, gb.r.a(1L, false) != null, ng.B, oa.i, hj.i, hj.d, ve.f.e((byte)115),
                    fault, cache.a(261775, 11L) != null, ac.k == null ? -1 : ac.k[0][0][0], sf.j.length}) {
                result.add(String.valueOf(field));
            }
            System.out.println(result);
        }
    }
}
