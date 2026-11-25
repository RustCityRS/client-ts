import java.io.BufferedInputStream;
import java.io.DataInputStream;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.Socket;
import java.util.HexFormat;
import java.lang.ref.Reference;
import java.lang.reflect.Field;
import java.util.ArrayList;
import java.util.Arrays;

class ConfigOracle {
    static Field field(Class<?> c, String name) throws Exception {
        Field f = c.getDeclaredField(name);
        f.setAccessible(true);
        return f;
    }
    static int text(id value) {
        if (value == null) return 0;
        int hash = 1;
        for (int i = 0; i < value.c; i++) hash = hash * 31 + (value.A[i] & 255);
        return hash;
    }
    static int table(nc values) {
        if (values == null) return 0;
        int h = values.b(-1) + 1;
        for (jf n = values.c((byte)80); n != null; n = values.a(11)) {
            h = 31*h + (int)n.k;
            if (n instanceof we s) h = 31*h + text(s.v);
            else if (n instanceof pd s) h = 31*h + text(s.q);
            else h = 31*h + ((oe)n).v;
        }
        return h;
    }
    static int enums(lg e) throws Exception {
        int h = e.R;
        h = h*31 + e.Z;
        h = h*31 + text((id)field(lg.class, "H").get(e));
        h = h*31 + field(lg.class, "ab").getInt(e);
        h = h*31 + table(e.U);
        if (e.U != null) {
            ArrayList<jf> entries = new ArrayList<>();
            for (jf n = e.U.c((byte)80); n != null; n = e.U.a(11)) entries.add(n);
            for (jf n : entries) {
                if (n instanceof we s) {
                    h = h*31 + text(e.b(100, (int)n.k));
                    h = h*31 + (e.a(true, s.v) ? 1 : 0);
                } else {
                    h = h*31 + e.a((int)n.k, -100);
                    h = h*31 + (e.d(-1, ((oe)n).v) ? 1 : 0);
                }
            }
        }
        return 31*h + table((nc)field(lg.class, "B").get(e));
    }
    static int structs(af a) throws Exception {
        nc params = (nc)field(af.class, "B").get(a);
        int h = table(params);
        if (params != null) {
            for (jf n = params.c((byte)80); n != null; n = params.a(11)) {
                try {
                    h = h*31 + (n instanceof we ? text(a.a((byte)-122, (int)n.k, null)) : a.a(0, 33, (int)n.k));
                } catch (RuntimeException badType) { h = h*31 + 0x7341; }
            }
        }
        return h;
    }
    static void definitions(DataInputStream in) throws Exception {
        int count = in.readInt();
        int[] sum = new int[5], counts = new int[5];
        Arrays.fill(sum, 1);
        for (int i = 0; i < count; i++) {
            int kind = in.readUnsignedByte();
            gd p = new gd(in.readNBytes(in.readInt()));
            int h;
            if (kind == 0) {
                og t = new og(); t.a(p,16609); h = (t.j*31 + t.d)*31 + t.i;
            } else if (kind == 1) {
                bb t = new bb(); t.a(p,-2196); h = t.d;
            } else if (kind == 2) {
                sj t = new sj(); t.a(4572,p); h = ((field(sj.class,"O").getInt(t)*31 + t.B)*31 + text(t.K))*31 + (t.c(-13492) ? 1 : 0);
            } else if (kind == 3) {
                af t = new af(); t.a(-1,p); h = structs(t);
            } else {
                lg t = new lg(); t.a(p,82); h = enums(t);
            }
            counts[kind]++;
            sum[kind] = (sum[kind]*31 + p.yb)*31 + h;
        }
        System.out.println(Arrays.toString(counts));
        System.out.println(Arrays.toString(sum));
    }
    static String refs(ve cache, String action, Object value) throws Exception {
        nc table = (nc)field(ve.class,"o").get(cache);
        tb queue = (tb)field(ve.class,"b").get(cache);
        StringBuilder s = new StringBuilder(action + " " + value + " " + field(ve.class,"p").get(cache) + " " + cache.b((byte)-14));
        for (mk n = (mk)queue.a(104); n != null; n = (mk)queue.a(true)) {
            s.append(" ").append(n.k).append("/").append(n.d(true) ? "s" : "h").append("/").append(n.v);
        }
        return s.toString();
    }
    static void references() throws Exception {
        ve cache = new ve(3);
        Object[] values = {"A","B","C","D"};
        cache.a(3,values[0],(byte)-71); cache.a(6,values[1],(byte)-71); cache.a(7,values[2],(byte)-71);
        System.out.println(refs(cache,"full","-"));
        cache.a(1,100); cache.a(7,false); cache.a(1,100);
        System.out.println(refs(cache,"demote","-"));
        System.out.println(refs(cache,"promote",cache.a(3,false)));
        mk soft = (mk)((nc)field(ve.class,"o").get(cache)).a((byte)-82,6L);
        ((Reference<?>)field(hb.class,"M").get(soft)).clear();
        System.out.println(refs(cache,"released",cache.a(6,false)));
        cache.a(7,values[3],(byte)-71); cache.a(9,null,(byte)-71); cache.a(10,values[2],(byte)-71);
        System.out.println(refs(cache,"evict",cache.a(3,false)));
        cache.a(0,100); cache.a(0,100); cache.a((byte)110);
        System.out.println(refs(cache,"removeSoft","-"));
        cache.a(9,values[2],(byte)-71); cache.a(10,values[1],(byte)-71);
        cache.a(10L,(byte)-100); cache.a(0);
        System.out.println(refs(cache,"clear","-"));
    }
    static void variables() throws Exception {
        final int base = 14;
        og bit = new og();
        bit.a(new gd(new byte[]{1,0,14,4,6,0}),16609);
        cd.d.a(1200L,bit,(byte)-71);
        og wide = new og();
        wide.a(new gd(new byte[]{1,0,14,0,31,0}),16609);
        cd.d.a(1201L,wide,(byte)-71);
        for (int id = 0; id < 20; id++) {
            bb type = new bb();
            type.d = id == base ? 9 : 0;
            vf.S.a((long)id,type,(byte)-71);
        }
        gg.y = 20;
        bj.a((byte)94);
        be.a(10, base, 7);
        be.a(10, 7, -11);
        be.a(10, base, 9);
        System.out.println("initial " + vj.d[base] + " " + oc.c[base] + " " + v.a(-31374,true) + " " + v.a(-31374,false) + " " + v.a(-31374,false) + " " + vj.d[base]);
        se.a(1200,0,3);
        oi.a(7,124,1200);
        ui node = (ui)db.p.a((byte)-82,(long)base);
        long deadline = node.B & 0x3fffffffffffffffL;
        long remaining = deadline - eh.a(19644);
        System.out.println("delayed " + ie.a(22255,1200) + " " + vj.d[base] + " " + oc.c[base] + " " + (remaining > 0 && remaining <= 500) + " " + v.a(-31374,true));
        node.B = 0x4000000000000001L;
        System.out.println("expired " + v.a(-31374,true) + " " + ie.a(22255,1200) + " " + v.a(-31374,false));
        se.a(1200,0,8);
        ui clientOnly = (ui)db.p.a((byte)-82,(long)base);
        clientOnly.B = 1;
        System.out.println("client " + ie.a(22255,1200) + " " + v.a(-31374,true) + " " + db.p.d((byte)-100));
        ae.a(112,base,-1);
        int before = ie.a(22255,1201);
        se.a(1201,0,1);
        System.out.println("wide " + before + " " + vj.d[base]);
        ae.a(112,base,256);
        bj.a((byte)94);
        System.out.println("reset " + vj.d[base] + " " + oc.c[base] + " " + vj.d[7] + " " + oc.c[7] + " " + db.p.d((byte)-100));
        for (String packet : new String[]{"226-81234567008e","60-008e77","37-85b004","84-060000003004","128-","89-"}) {
            String[] pair = packet.split("-",-1);
            byte[] data = HexFormat.of().parseHex(pair[1]);
            Socket socket = new Socket() {
                public void setSoTimeout(int ms) {}
                public void setTcpNoDelay(boolean enabled) {}
                public InputStream getInputStream() { return new ByteArrayInputStream(data.length == 0 ? new byte[]{0} : data); }
                public OutputStream getOutputStream() { return new ByteArrayOutputStream(); }
            };
            ek.s = new se(socket,null);
            o.Y = Integer.parseInt(pair[0]); af.I = data.length;
            if (!rg.a((byte)57)) throw new AssertionError("unconsumed var message " + pair[0]);
            System.out.println("packet " + pair[0] + " " + vj.d[base] + " " + oc.c[base]);
        }
    }
    static class ConfigFiles extends ud {
        static ArrayList<String> reads = new ArrayList<>();
        final int seed;
        final db index;
        ConfigFiles(db index, int seed) { this.index = index; this.seed = seed; }
        db b(int dummy) { return index; }
        byte[] a(int mode, int group) {
            reads.add(seed + "/" + mode + "/" + group);
            byte[] file;
            switch (group) {
                case 0: case 1: file = new byte[]{1, 0, (byte)(seed + group), 2, 6, 0}; break;
                case 5: file = new byte[]{2, 0, (byte)seed, 0}; break;
                case 11: file = seed == 99 ? new byte[]{2, -1} : new byte[]{2, 0, 0, 0, (byte)seed, 0}; break;
                default: file = new byte[]{5, 0, (byte)(seed + group), 0};
            }
            return java.nio.ByteBuffer.allocate(5 + file.length).put((byte)0).putInt(file.length).put(file).array();
        }
        void b(int dummy, int group) { throw new AssertionError(); }
        int c(int group, int dummy) { throw new AssertionError(); }
    }
    static void init(al archive) {
        l.a(102, archive); wa.a(48, archive); tk.a(archive,(byte)-20); mi.a(415013098, archive);
    }
    static void loaders(String encoded) {
        byte[] bytes = java.util.Base64.getDecoder().decode(encoded);
        java.util.zip.CRC32 crc = new java.util.zip.CRC32(); crc.update(bytes);
        db index = new db(bytes, (int)crc.getValue());
        al a = new al(new ConfigFiles(index,3),false,false), b = new al(new ConfigFiles(index,7),false,false);
        ed.c = new vj(64); mg.c = new vj(64); vf.S = new ve(64); cd.d = new ve(64);
        init(a);
        pj inv = me.b((byte)69,0); sj param = ak.a(-100,0); bb varp = ck.a(0,17);
        og lower = we.a(31473,1023), upper = we.a(31473,1024);
        System.out.println("load " + inv.H + " " + param.B + " " + varp.d + " " + lower.j + " " + upper.j + " " + gg.y);
        init(b);
        System.out.println("same " + (me.b((byte)69,0) == inv) + " " + (ak.a(-100,0) == param) + " " + (ck.a(0,16) == varp) + " " + (we.a(31473,1024) == upper));
        ai.a((byte)56); f.a(-117);
        System.out.println("reload " + ck.a(0,16).d + " " + we.a(31473,1024).j + " " + we.a(31473,-1).j);
        gg.y = 719; boolean failed = false;
        try { tk.a(null,(byte)-20); } catch (RuntimeException ex) { failed = true; }
        System.out.println("partial " + failed + " " + (ba.g == null) + " " + gg.y + " " + ck.a(0,17).d);
        mg.c = new vj(64);
        wa.a(48,new al(new ConfigFiles(index,99),false,false)); failed = false;
        try { ak.a(-100,0); } catch (RuntimeException ex) { failed = true; }
        wa.a(48,b);
        System.out.println("retry " + failed + " " + ak.a(-100,0).B + " " + String.join(",",ConfigFiles.reads));
    }

    public static void main(String[] args) throws Exception {
        definitions(new DataInputStream(new BufferedInputStream(System.in)));
        references();
        variables();
        loaders(args[0]);
    }
}
