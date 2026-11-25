import java.applet.Applet;
import java.awt.Canvas;
import java.awt.Dimension;
import java.io.RandomAccessFile;
import java.lang.reflect.Field;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.nio.ByteBuffer;
import java.nio.file.Path;
import java.util.HashSet;
import java.util.HexFormat;
import java.util.Random;
import java.util.Set;
import java.util.function.IntConsumer;
import java.util.function.Consumer;
import java.util.zip.CRC32;

/** Original 530 HD title scene and cache, with a local disk source and a recorded JOGL driver. */
public final class HdTitleFrameOracle {
    private static final String[] ARCHIVES = ("re.B ud.J wf.g dc.z uc.c ca.Z kc.w vl.g ra.K pk.Z ol.U rg.z bf.s ve.l "
        + "kl.r km.Oc wl.s km.Nc nj.l ni.k ui.cb jh.p mf.W sg.k uj.J cd.B nd.t sf.b").split(" ");
    private static final String WORLD_LIST = "0101010000555300010101000000000001002d00006c6f63616c686f73740000000001000000";

    // The archive's qm file wrapper has a default constructor. Supply a read-only OS handle;
    // en buffers reads and ge traverses exactly the same sectors as the original client.
    static en open(Path file, int readBuffer) throws Exception {
        qm handle = new qm();
        Field storage = qm.class.getDeclaredField("a");
        storage.setAccessible(true);
        storage.set(handle, new RandomAccessFile(file.toFile(), "r"));
        return new en(handle, readBuffer, 0);
    }

    static final class Disk extends v {
        final ii index;
        final ge groups;
        final en file;
        final Set<Integer> requested = new HashSet<>();

        Disk(ge master, en data, Path directory, int id) throws Exception {
            byte[] raw = master.a(id, (byte)104);
            CRC32 crc = new CRC32();
            crc.update(raw);
            index = new ii(raw, (int)crc.getValue());
            file = open(directory.resolve("main_file_cache.idx" + id), 6000);
            groups = new ge(id, data, file, 1000000);
        }

        ii b(int guard) { return index; }
        void a(int group, int guard) {}
        int b(int group, int guard) { return 100; }
        byte[] c(int group, int guard) {
            requested.add(group);
            return groups.a(group, (byte)104);
        }
    }

    static Object headlessInstance(Class<?> kind) throws Exception {
        Class<?> unsafe = Class.forName("sun.misc.Unsafe");
        Field singleton = unsafe.getDeclaredField("theUnsafe");
        singleton.setAccessible(true);
        return unsafe.getMethod("allocateInstance", Class.class).invoke(singleton.get(null), kind);
    }

    @SuppressWarnings("removal")
    static final class Page extends Applet {
        public Dimension getSize() { return new Dimension(765, 503); }
    }

    static void set(Object owner, String name, Object value) throws ReflectiveOperationException {
        Field field = owner.getClass().getDeclaredField(name);
        field.setAccessible(true);
        field.set(owner,value);
    }

    // Stage 30 constructs every archive itself. Supply the completed local index responses the
    // JS5 server would provide, then replace only its group source with synchronous sector reads.
    static void supplyMasterIndex(Disk[] disks) throws Exception {
        id.l = new jb();
        v.f = new al(id.l,null);
        ByteBuffer master = ByteBuffer.allocate(5 + disks.length * 8);
        master.put((byte)0).putInt(disks.length * 8);
        bg[] providers = new bg[disks.length];
        for (int id = 0; id < disks.length; id++) {
            ii index = disks[id].index;
            master.putInt(index.z).putInt(index.v);
            providers[id] = new bg(id,null,null,null,null,index.z,index.v,true);
            set(providers[id],"m",index);
        }
        set(v.f,"a",new wa(master.array()));
        set(v.f,"s",providers);
    }

    static void render(Canvas canvas, Disk[] disks, IntConsumer startFrame, Consumer<String> checkpoint) throws Exception {
        client game = (client)headlessInstance(client.class);
        fk.l = new ll((Page)headlessInstance(Page.class), 32, null, 0);
        qe.v = fi.a((byte)-31); // GameShell timer, reset when gd.c finishes loading the region.
        md.L = canvas;
        fl.U = dl.d = 765;
        jh.c = uj.B = 503;
        kb.a(new int[765 * 503], 765, 503);
        cm.b = Thread.currentThread();
        rc.M = true; // The hardware harness loads the DLLs; the recording harness installs its JOGL factory.
        rh.j = game;
        pb.Q = jl.H = 1; // client.init reads the worldid parameter and sets the active world.
        rg.F = 1; pa.N = 0; na.h = false; // Preferences after loading: fixed HD, no AA, safe mode off.
        supplyMasterIndex(disks);
        Method load = client.class.getDeclaredMethod("i", int.class);
        load.setAccessible(true);
        nc.j = 10;
        checkpoint.accept("loader.software");
        for (int stage : new int[]{10,30,40,45,50,60,65,70,80,90,100,110,120,130,135,140}) {
            if (nc.j != stage || tf.w) throw new AssertionError("software startup " + stage + ": " + nc.j + " " + tf.w);
            if (stage == 135) {
                if (!nh.a(4, HexFormat.of().parseHex(WORLD_LIST))) throw new AssertionError("offline world list");
                sk.gb = ad.a((byte)-55); // ql.b sees the response as already fetched and does no network I/O.
            }
            load.invoke(game,107);
            if (stage == 30) for (int i = 0; i < disks.length; i++) {
                String[] slot = ARCHIVES[i].split("\\.");
                ve archive = (ve)Class.forName(slot[0]).getDeclaredField(slot[1]).get(null);
                set(archive,"i",disks[i]);
            }
        }
        if (nc.j != 150 || tf.w || tl.d != 5 || !od.c) throw new AssertionError("stage 150 entry " + nc.j + " " + tl.d);
        checkpoint.accept("mode.hd");
        load.invoke(game,107); // client.i -> th.a -> pm.a -> tf.a, VBO setup, hf.a(0.7f), lb.a(false).
        if (nc.j != 160 || !tf.w || le.a(0) != 1) throw new AssertionError("stage 150 did not initialize fixed HD");
        checkpoint.accept("interface.onload");
        load.invoke(game, 107); // client.i -> fm.a -> login OnLoad -> request the title map.
        if (tl.d != 28) throw new AssertionError("region was not requested: " + tl.d);
        checkpoint.accept("region.build");
        for (int i = 0; i < 4 && tl.d == 28; i++) gd.c(-117);
        if (tl.d != 10) throw new AssertionError("incomplete title region: " + tl.d + ", " + nm.U + ", " + sj.p);

        be[] login = th.j[md.W];
        if (md.W != 744 || login.length != 434 || login[125].K != 1403
            || login[128].K != 1402 || login[129].K != 1402) throw new AssertionError("cached login group");
        Method tick = client.class.getDeclaredMethod("d", byte.class);
        tick.setAccessible(true);
        int firstScene = -1;
        int sceneFrames = 0;
        checkpoint.accept("warmup");
        // The original client.a(byte) reseeds d.S from the wall clock at tick 1 and handles host I/O.
        // Replay the same deterministic boundary: increment gj.d, call client.d(byte), then client.f(40).
        // Forty warmup ticks put group-744 CS2's 1403 reveal inside the 50 measured frames.
        for (int i = -40; i < 50; i++) {
            if (i >= 0) startFrame.accept(i);
            ++gj.d;
            tick.invoke(game, (byte)1);
            int sceneCalls = ui.S;
            game.f(40);
            if (ui.S != sceneCalls) {
                if (i < 0 || ui.S != sceneCalls + 1) throw new AssertionError("scene pass at " + i);
                if (firstScene == -1) firstScene = i;
                sceneFrames++;
            }
            if (!tf.w || !login[128].a || !login[129].a || s.f != 0 || uf.e != 0)
                throw new AssertionError("HD title flame state at " + i);
        }
        System.out.println("title " + md.W + " " + login.length + " " + tf.J + " " + tf.A);
        System.out.println("viewport " + firstScene + " " + sceneFrames + " flames " + s.f + " " + uf.e);
    }

    public static void main(String[] args) throws Exception {
        Canvas canvas = new Canvas() { public boolean isDisplayable() { return true; } };
        canvas.setSize(765, 503);
        try (GlRecorder recorder = new GlRecorder(Path.of(args[1])); AutoCloseable factory = recorder.installFactory()) {
            recorder.loadProfile(Path.of(args[2]));
            run(Path.of(args[0]), canvas, i -> recorder.mark("title." + i), recorder::mark);
        }
    }

    static void run(Path directory, Canvas canvas, IntConsumer startFrame, Consumer<String> checkpoint) throws Exception {
        Field rng = Class.forName("java.lang.Math$RandomNumberGeneratorHolder").getDeclaredField("randomNumberGenerator");
        rng.setAccessible(true);
        ((Random)rng.get(null)).setSeed(53020L);
        en data = open(directory.resolve("main_file_cache.dat2"), 5200);
        en reference = open(directory.resolve("main_file_cache.idx255"), 6000);
        ge master = new ge(255, data, reference, 500000);
        Disk[] disks = new Disk[ARCHIVES.length];
        try {
            for (int id = 0; id < ARCHIVES.length; id++) {
                disks[id] = new Disk(master, data, directory, id);
            }
            render(canvas, disks, startFrame, checkpoint);
            System.out.println("groups ui/maps/models/sprites/scripts/fonts " + disks[3].requested.size()
                + " " + disks[5].requested.size() + " " + disks[7].requested.size() + " " + disks[8].requested.size()
                + " " + disks[12].requested.size() + " " + disks[13].requested.size());
        } catch (Exception ex) {
            Throwable cause = ex instanceof InvocationTargetException ? ex.getCause() : ex;
            if (cause instanceof ld wrapped) {
                System.err.println(wrapped.e);
                wrapped.f.printStackTrace();
            }
            throw ex;
        } finally {
            if (od.f != null) od.f.e = false;
            if (ba.D != null) ba.D.a(false);
            if (lh.s != null) lh.s.a(false);
            if (fk.l != null) fk.l.b(0);
            for (Disk disk : disks) if (disk != null) disk.file.b(false);
            reference.b(false);
            data.b(false);
        }
    }
}
