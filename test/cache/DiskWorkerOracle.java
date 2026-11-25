import java.lang.reflect.Field;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.atomic.AtomicReference;

class DiskWorkerOracle {
    static Field field(Class<?> c, String name) throws Exception {
        Field result = c.getDeclaredField(name);
        result.setAccessible(true);
        return result;
    }

    static void awaitRequest(fb link) throws Exception {
        long until = System.nanoTime() + 3000000000L;
        synchronized (link) {
            while (field(fb.class,"j").get(link) == null) {
                if (System.nanoTime() > until) throw new AssertionError("no request");
                link.wait(10L);
            }
        }
    }

    public static void main(String[] args) throws Exception {
        Class<?> unsafe = Class.forName("sun.misc.Unsafe");
        Object allocator = field(unsafe,"theUnsafe").get(null);
        for (String mode : new String[]{"ok","reject","null","wrong"}) {
            fb link = tj.m = (fb)unsafe.getMethod("allocateInstance",Class.class).invoke(allocator,fb.class);
            AtomicReference<ca> result = new AtomicReference<>();
            AtomicReference<Throwable> error = new AtomicReference<>();
            Thread constructor = new Thread(() -> {
                try {result.set(new ca());} catch (Throwable e) {error.set(e);}
            });
            constructor.setDaemon(true);
            constructor.start();
            awaitRequest(link);
            dj req = (dj)field(fb.class,"j").get(link);
            ca cache = (ca)req.d;
            Field worker = field(ca.class,"q"), stopping = field(ca.class,"p");
            System.out.println(mode + " requested " + req.e + " " + req.c + " " + req.b + " " + (worker.get(cache)==null) + " " + stopping.get(cache) + " " + cache.s);
            CountDownLatch finish = new CountDownLatch(1);
            Thread fake = new Thread(() -> {try {finish.await();} catch (InterruptedException e) {}});
            fake.setDaemon(true);
            fake.start();
            req.a = mode.equals("wrong") ? new Object() : mode.equals("null") ? null : fake;
            req.b = mode.equals("reject") ? 2 : 1;
            constructor.join(3000L);
            if (constructor.isAlive()) throw new AssertionError("constructor did not complete");
            if (error.get()!=null) {
                System.out.println(mode + " rejected " + (worker.get(cache)==null));
                finish.countDown();
                continue;
            }
            System.out.println(mode + " opened " + (cache==result.get()) + " " + (worker.get(cache)==req.a));
            Thread close = new Thread(() -> {
                try {cache.a(false);} catch (Throwable e) {error.set(e);}
            });
            close.start();
            long until = System.nanoTime() + 3000000000L;
            while (!stopping.getBoolean(cache) && System.nanoTime() < until) Thread.sleep(1);
            if (mode.equals("ok")) {
                System.out.println("joining " + stopping.get(cache) + " " + (worker.get(cache)==fake) + " " + close.isAlive());
            }
            finish.countDown();
            close.join(3000L);
            System.out.println(mode + " stopped " + (error.get()!=null) + " " + (worker.get(cache)==null));
            try {cache.a(false);System.out.println("twice false");}
            catch (RuntimeException e) {System.out.println("twice true");}
        }
        fb host = tj.m = new fb(null,0,null,0);
        ca cache = new ca();
        Thread worker = (Thread)field(ca.class,"q").get(cache);
        Thread second = new Thread(cache);
        second.setDaemon(true);
        second.start();
        long until = System.nanoTime() + 3000000000L;
        while ((worker.getState()!=Thread.State.WAITING || second.getState()!=Thread.State.WAITING) && System.nanoTime()<until) Thread.sleep(1);
        if (worker.getState()!=Thread.State.WAITING || second.getState()!=Thread.State.WAITING) throw new AssertionError("queue wait");
        cache.a(false);
        second.join(3000L);
        System.out.println("notifyAll " + !worker.isAlive() + " " + !second.isAlive());
        host.a(15);
        tj.m = null;
        try {new ca();System.out.println("no signlink false");}
        catch (RuntimeException e) {System.out.println("no signlink true");}
    }
}
