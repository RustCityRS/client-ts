import java.io.*;
import java.net.Socket;
import java.nio.file.*;
import java.util.*;

// Execute the original he/pj methods, rg packet dispatch and gh interpreter.
class InventoryOracle {
    static final HexFormat hex = HexFormat.of();
    static final aj component = new aj();
    static int scriptId = 100000;
    static he saved;
    static nc savedTable;
    static int[] savedIds, savedCounts;

    static class Provider extends ud {
        final db index;
        final byte[] group;
        Provider(String directory) throws Exception {
            byte[] bytes = Files.readAllBytes(Path.of(directory, "index"));
            index = new db(bytes, q.a(0, bytes, bytes.length));
            group = Files.readAllBytes(Path.of(directory, "group"));
        }
        db b(int ignored) { return index; }
        byte[] a(int mode, int id) { return id == 5 ? group : null; }
        void b(int ignored, int group) {}
        int c(int group, int ignored) { return 100; }
    }

    static class Source extends Socket {
        final ByteArrayInputStream in;
        Source(byte[] bytes) { in = new ByteArrayInputStream(bytes); }
        public void setSoTimeout(int timeout) {}
        public void setTcpNoDelay(boolean enabled) {}
        public InputStream getInputStream() { return in; }
        public OutputStream getOutputStream() { return OutputStream.nullOutputStream(); }
    }

    static String ints(int[] values) {
        if (values == null) return "~";
        StringJoiner result = new StringJoiner(",");
        for (int value : values) result.add(Integer.toString(value));
        return result.toString();
    }
    static String state(int key) {
        he c = (he)mf.d.a((byte)-33, (long)key);
        return c == null ? "~" : ints(c.x) + "/" + ints(c.t);
    }
    static int number(String[] p, int i) { return Integer.parseInt(p[i]); }

    static String execute(String[] p, Provider provider) throws Exception {
        switch (p[0]) {
            case "ring":
                pa.zb = p[1].equals("-") ? null : new int[number(p,1)];
                b.I = number(p,2);
                return "";
            case "defs": {
                int count = provider.index.j[5];
                int[] sizes = new int[count + 1];
                for (int i = 0; i <= count; i++) sizes[i] = me.b((byte)69, i).H;
                return ints(sizes);
            }
            case "raw": {
                gd packet = new gd(p.length == 2 ? hex.parseHex(p[1]) : new byte[0]);
                pj type = new pj();
                boolean ok = true;
                try { type.a((byte)125, packet); } catch (RuntimeException error) { ok = false; }
                return ok + ";" + packet.yb + ";" + type.H;
            }
            case "config": {
                pj t = new pj(); t.H = number(p, 2);
                ed.c.a((long)number(p, 1), 0, t);
                return "";
            }
            case "obj": {
                int id = number(p, 1);
                kl t = new kl(); t.a(new gd(hex.parseHex(p[2])), -28322 ^ 21525);
                fa.b.a((long)id, t, (byte)-71);
                sd.Y = Math.max(sd.Y, id + 1);
                return "";
            }
            case "view":
                component.Zb = p[1].equals("-") ? null : new int[number(p,1)];
                component.Ob = p[2].equals("-") ? null : new int[number(p,2)];
                if (component.Zb != null) Arrays.fill(component.Zb, 27);
                if (component.Ob != null) Arrays.fill(component.Ob, 58);
                sf.m[2] = false;
                return "";
            case "set": rc.a(number(p,3), number(p,1), 94, number(p,4), number(p,2)); return "";
            case "read": return id.c(number(p,1),-84,number(p,2)) + "," + wk.a(number(p,1),number(p,2),(byte)-88);
            case "total": return "" + ok.a(number(p,1),number(p,2),number(p,3));
            case "param": return "" + bi.a(number(p,2),(byte)11,number(p,1),number(p,3) != 0);
            case "clear": jd.a(false,number(p,1)); return "";
            case "remove": me.a((byte)74,number(p,1)); return "";
            case "free": return "" + wd.a(number(p,1),-123);
            case "state": return state(number(p,1));
            case "save":
                savedTable = mf.d; saved = (he)mf.d.a((byte)-33, (long)number(p,1));
                savedIds = saved.x; savedCounts = saved.t;
                return "";
            case "identity":
                return (savedTable == mf.d)+","+(saved == mf.d.a((byte)-33,(long)number(p,1)))+","+
                    saved.a((byte)-100)+","+(savedIds == saved.x)+","+(savedCounts == saved.t);
            case "reset": ck.c(128); return "";
            case "script": {
                m code = new m();
                code.D = new int[p.length]; code.F = new int[p.length];
                for (int i = 2; i < p.length; i++) code.F[i-2] = number(p,i);
                code.D[p.length-2] = number(p,1); code.D[p.length-1] = 21;
                wf event = new wf(); event.G = new Object[]{ ++scriptId };
                sf.g.a((long)scriptId, 0, code);
                gh.a(event,-22368,1000);
                return "" + tg.B[0];
            }
            case "wire": {
                byte[] data = hex.parseHex(p[2]);
                ek.s = new se(new Source(data), null);
                o.Y = number(p,1); af.I = data.length;
                boolean ok = true;
                try { rg.a((byte)98); } catch (RuntimeException e) { ok = false; }
                return ok+";"+hd.b.yb+";"+ints(component.Zb)+";"+ints(component.Ob)+";"+sf.m[2]+";"+b.I+";"+ints(pa.zb);
            }
            default: throw new AssertionError(p[0]);
        }
    }
    public static void main(String[] args) throws Exception {
        Provider provider = new Provider(args[0]); l.a(100, new al(provider, false, false));
        rg.b = new boolean[]{false, true};
        fk.ab = new aj[][]{null, new aj[]{component}};
        component.vb = 2; component.R = vk.db; sd.Y = 0;
        BufferedReader commands = new BufferedReader(new InputStreamReader(System.in));
        for (String line; (line = commands.readLine()) != null;) {
            try { System.out.println(execute(line.split(" "), provider)); }
            catch (RuntimeException ex) { System.out.println("exception"); }
        }
    }
}
