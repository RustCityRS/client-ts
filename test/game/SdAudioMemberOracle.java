import java.lang.reflect.*;
import java.nio.file.*;
import java.security.MessageDigest;
import java.util.*;
import java.util.zip.CRC32;

// Package access calls the stock default-package classes directly. The only host
// stub is the Signlink sound device, which records the arguments sent by qb.
public final class SdAudioMemberOracle {
    static Field field(Class<?> cls, String name) throws Exception {
        Field f = cls.getDeclaredField(name);
        f.setAccessible(true);
        return f;
    }
    static Method method(Class<?> cls, String name, Class<?>... args) throws Exception {
        Method m = cls.getDeclaredMethod(name, args);
        m.setAccessible(true);
        return m;
    }
    static void row(Object... values) {
        System.out.println(String.join("|", Arrays.stream(values).map(String::valueOf).toList()));
    }
    static jc stream(int pan) {
        return jc.a(new ji(22050, new byte[32], 1, 29), 256, 507, pan);
    }
    static void pcm() throws Exception {
        dg player = new dg();
        player.E = 739;
        player.g = new int[]{5, -2};
        int[] samples = player.g;
        jc voice = stream(4321);
        field(dg.class, "r").set(player, voice);
        field(dg.class, "e").setLong(player, 591L);
        Field remaining = field(dg.class, "I"), position = field(jc.class, "I");
        remaining.setInt(player, 378);
        for (String op : List.of("init", "open", "write", "flush")) {
            switch (op) {
                case "init" -> player.a((java.awt.Component)null);
                case "open" -> player.c(9000);
                case "write" -> player.c();
                case "flush" -> player.b();
            }
            row("base", op, player.a(), remaining.getInt(player), field(dg.class,"r").get(player) == voice,
                player.g == samples, Arrays.toString(samples), position.getInt(voice));
        }
        Method skip = method(dg.class, "a", int.class, int.class);
        for (int count : new int[]{3, 0, 256, 256}) {
            skip.invoke(player, -125, count);
            row("skip", count, remaining.getInt(player), position.getInt(voice), field(dg.class,"e").getLong(player));
        }
        field(dg.class, "r").set(player, null);
        for (int[] pair : new int[][]{{Integer.MIN_VALUE,1},{Integer.MAX_VALUE,-1},{0,-17}}) {
            remaining.setInt(player, pair[0]);
            skip.invoke(player, -125, pair[1]);
            row("skip-silent", pair[0], pair[1], remaining.getInt(player));
        }
    }
    static String id(jj voice, jc a, jc b) { return voice == null ? "-" : voice == a ? "a" : voice == b ? "b" : "?"; }
    static void midi() throws Exception {
        ng player = new ng();
        ef mixer = (ef)player.a();
        jc first = stream(1000), second = stream(13000);
        row("empty", mixer.d(), player.d(), player.b() == null, first.b() == null, mixer.a() == null);
        for (jc voice : new jc[]{null, first, null, null, second, null}) {
            t note = new t();
            note.B = voice;
            mixer.x.a(note, false);
        }
        row("voices", id(mixer.a(),first,second), id(mixer.b(),first,second), id(mixer.b(),first,second),
            id(mixer.a(),first,second), id(mixer.a(),first,second), id(mixer.b(),first,second));
        for (int pan : new int[]{-2,0,8192,16384}) {
            jc voice = stream(1234);
            voice.a(37, 901, pan);
            for (int gain : new int[]{-123, 0, 2147483647, -2147483648}) {
                method(jc.class, "e", int.class).invoke(voice, gain);
                List<Object> values = new ArrayList<>(List.of("gain", pan, gain));
                for (char c : "uvwxyzABCDEFGHI".toCharArray()) values.add(field(jc.class,String.valueOf(c)).get(voice));
                row(values.toArray());
            }
        }
    }
    static class Device implements k {
        int[] shared;
        public int a(int guard, int ch) {
            if (guard != 18576) throw new AssertionError(guard);
            row("position", ch);
            return 1025 - 2*ch;
        }
        public void b(int guard, int ch) { if(guard != 48) throw new AssertionError(guard); row("flush", ch); }
        public void c(int guard, int ch) { if(guard != -128) throw new AssertionError(guard); row("close", ch); }
        public void a(int ch, int[] data) {
            row("write", ch, data == shared, Arrays.toString(data));
            if(data != null) data[1] = ch - 45;
        }
        public void a(byte guard,int ch,int cap) { throw new AssertionError(); }
        public void a(boolean s,int g,java.awt.Component c,int r) { throw new AssertionError(); }
    }
    static void nativeDevice() throws Exception {
        Class<?> unsafe = Class.forName("sun.misc.Unsafe");
        Object u = field(unsafe,"theUnsafe").get(null);
        fb signlink = (fb)unsafe.getMethod("allocateInstance",Class.class).invoke(u,fb.class);
        Device device = new Device();
        field(fb.class,"d").set(signlink, device);
        for (int ch : new int[]{0, 1}) {
            qb player = new qb(signlink, ch);
            player.g = device.shared = new int[]{-2147483648, 0, 2147483647};
            row("queued", player.a());
            player.c(); player.b(); player.d();
            row("after-device", Arrays.toString(player.g));
            player.g = null;
            player.c();
        }
    }
    static void constructors() throws Exception {
        var ctor = vd.class.getDeclaredConstructor();
        ctor.setAccessible(true);
        vd synth = ctor.newInstance();
        Object[] tones = (Object[])field(vd.class,"b").get(synth);
        row("synth", field(vd.class,"a").get(synth), field(vd.class,"c").get(synth),
            tones.length, Arrays.stream(tones).allMatch(Objects::isNull), field(vd.class,"b").get(ctor.newInstance()) != tones);
        tg patch = new tg();
        row("patch", patch.q, patch.t, field(tg.class,"w").get(patch), patch.A, patch.D, patch.F, patch.I, patch.K, patch.g, patch.p);
    }
    static al archive(int[] capacities, Object[][] files) throws Exception {
        byte[] bytes = {0,0,0,0,4,5,0,0,0};
        CRC32 crc = new CRC32(); crc.update(bytes);
        db idx = new db(bytes,(int)crc.getValue());
        idx.e = capacities.length; idx.j = capacities;
        al archive = new al(null,false,false);
        field(al.class,"x").set(archive,idx);
        field(al.class,"O").set(archive,files);
        field(al.class,"w").set(archive,new Object[capacities.length]);
        return archive;
    }
    static void cache(byte[] effect) throws Exception {
        for (boolean single : new boolean[]{true,false}) {
            al archive = single ? archive(new int[]{2}, new Object[][]{new Object[]{null,effect}})
                : archive(new int[]{2,1}, new Object[][]{null,new Object[]{effect}});
            ll cache = new ll(archive,null);
            ji saved = null;
            for (int[] budget : new int[][]{{0},{17},{-99},{},null}) {
                ji wave = cache.a(1,budget,1);
                row("cache", single, Arrays.toString(budget), wave == null ? "-" :
                    wave.t+","+wave.s+","+wave.v+","+wave.r.length+","+HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(wave.r)),
                    wave != null && wave == saved);
                saved = wave;
            }
            try { row("missing", cache.a(9,new int[]{1},1) == null); }
            catch (RuntimeException ex) {
                Throwable cause=ex; while(cause instanceof g wrapped) cause=wrapped.a;
                if(cause.getClass() != RuntimeException.class) throw ex;
                row("missing","ambiguous");
            }
            try { cache = new ll(archive,null); cache.a(1,new int[0],1); throw new AssertionError(); }
            catch (RuntimeException ex) {
                Throwable cause=ex; while(cause instanceof g wrapped) cause=wrapped.a;
                if(!(cause instanceof ArrayIndexOutOfBoundsException)) throw ex;
                row("cold-empty-budget","bounds");
            }
        }
    }
    public static void main(String[] args) throws Exception {
        pcm(); midi(); nativeDevice(); constructors(); cache(Files.readAllBytes(Path.of(args[0])));
    }
}
