import java.awt.Frame;
import java.io.ByteArrayInputStream;
import java.io.File;
import java.io.InputStream;
import java.lang.reflect.Field;
import java.net.URL;
import java.net.URLConnection;
import java.net.URLStreamHandler;
import java.nio.file.Path;
import java.util.Map;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;

// Run separately with the gamepack's ll/im and the signed loader's ll/im, which share these public descriptors.
public class HdSignlinkOracle {
    public static int marker;

    static void waitFor(im request) throws Exception {
        long end = System.nanoTime() + TimeUnit.SECONDS.toNanos(5);
        while (request.d == 0 && System.nanoTime() < end) Thread.sleep(1);
        if (request.d == 0) throw new AssertionError("Signlink worker did not settle");
    }

    static void batch(ll link, Frame frame) throws Exception {
        CountDownLatch entered = new CountDownLatch(1);
        CountDownLatch resume = new CountDownLatch(1);
        URL url = new URL(null, "fixture://queue", new URLStreamHandler() {
            protected URLConnection openConnection(URL address) {
                return new URLConnection(address) {
                    public void connect() {}
                    public InputStream getInputStream() {
                        entered.countDown();
                        try {
                            if (!resume.await(5, TimeUnit.SECONDS)) throw new AssertionError("Queue not resumed");
                        } catch (InterruptedException error) {
                            throw new AssertionError(error);
                        }
                        return new ByteArrayInputStream(new byte[0]);
                    }
                };
            }
        });
        im hold = link.a(false, url);
        if (!entered.await(5, TimeUnit.SECONDS)) throw new AssertionError("Worker did not enter the local fixture");
        im load = link.a(-43, HdSignlinkOracle.class);
        im exit = link.a(frame, 86);
        im modes = link.a((byte)65);
        im enter = link.a(32, 72, 0x18001, 0x8001, -121);
        im field = link.a(-40, "marker", HdSignlinkOracle.class);
        im[] requests = { load, exit, modes, enter, field };
        Object[] lookup = (Object[])field.c;
        if (lookup[0] != HdSignlinkOracle.class || !lookup[1].equals("marker")) throw new AssertionError("marker lookup arguments");
        Object[] arguments = { HdSignlinkOracle.class, frame, null, null, lookup };
        for (int i = 0; i < requests.length; i++) {
            im r = requests[i];
            System.out.println("queued " + r.f + " " + r.a + " " + r.d + " " + (r.c == arguments[i])
                + " " + (r.e == null) + " " + (r.b == (i + 1 < requests.length ? requests[i + 1] : null)));
        }
        resume.countDown();
        waitFor(field);
        System.out.println("done " + hold.d + " " + load.d + " " + exit.d + " " + modes.d + " " + enter.d + " " + field.d + " "
            + (load.e == null) + " " + (exit.e == null) + " " + ((Field)field.e).getName());
    }

    static Frame frameWithoutPeer() throws Exception {
        Class<?> unsafe = Class.forName("sun.misc.Unsafe");
        Field field = unsafe.getDeclaredField("theUnsafe");
        field.setAccessible(true);
        return (Frame)unsafe.getMethod("allocateInstance", Class.class).invoke(field.get(null), Frame.class);
    }

    @SuppressWarnings("unchecked")
    public static void main(String[] args) throws Exception {
        boolean loader = args[0].equals("loader");
        Path temp = Path.of(args[1]).toAbsolutePath();
        Path natives = Path.of(args[2]).toAbsolutePath();
        Map<String, File> files = null;
        if (loader) {
            // Select only files owned by the fixture before the original constructor probes the system cache.
            Field map = ll.class.getDeclaredField("w");
            map.setAccessible(true);
            files = (Map<String, File>)map.get(null);
            for (String name : new String[] { "random.dat", "main_file_cache.dat2", "main_file_cache.idx255" }) {
                files.put(name, temp.resolve(name).toFile());
            }
        }
        Frame frame = frameWithoutPeer();
        ll link = new ll(null, 32, "fixture", 0);
        try {
            System.out.println("fullscreen " + link.a(false));
            for (boolean ready : new boolean[] { false, true, false }) {
                if (loader) {
                    // ll.run's actual signed-loader request 10 resolves these names, then calls Runtime.load0.
                    for (String name : new String[] { "jogl.dll", "jogl_awt.dll", "libgluegen-rt.so", "libjogl.so",
                            "libjogl_awt.so", "libjogl.jnilib", "libjogl_awt.jnilib" }) {
                        files.put(name, (ready ? natives : temp.resolve("missing")).resolve(name).toFile());
                    }
                }
                batch(link, frame);
            }
        } finally {
            link.b(0);
        }
    }
}
