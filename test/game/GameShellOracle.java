import java.awt.Graphics;
import java.awt.image.BufferedImage;
import java.io.*;
import java.lang.reflect.*;

// The shell, AWT clips, pixmap allocation and shutdown are the original classes.
// Only the abstract client hooks and the JRE clock/sleep endpoints are substituted.
public class GameShellOracle {
    static StringBuilder hooks = new StringBuilder();
    static class Shell extends p {
        public void init() {}
        void a(int ignored) { hooks.append("tick,"); }
        void d(int ignored) { hooks.append("draw,"); }
        void b(byte ignored) { hooks.append("init=").append(rg.s.n.length).append(','); }
        void c(int ignored) { hooks.append("quit,"); }
        void a(boolean ignored) {}
    }

    public static void main(String[] args) throws Exception {
        var result = System.out;
        var log = new ByteArrayOutputStream();
        System.setOut(new PrintStream(log));
        var unsafeClass = Class.forName("sun.misc.Unsafe");
        var field = unsafeClass.getDeclaredField("theUnsafe");
        field.setAccessible(true);
        var alloc = unsafeClass.getMethod("allocateInstance", Class.class);
        var worker = (fb) alloc.invoke(field.get(null), fb.class);
        var input = new BufferedReader(new InputStreamReader(System.in));
        var image = new BufferedImage(96, 65, BufferedImage.TYPE_INT_RGB);
        HostClockFixture.millis = 100000L;
        for (String line; (line = input.readLine()) != null;) {
            String[] arg = line.split(" ");
            Shell shell = WindowModeOracle.container(Shell.class);
            p.providesignlink(worker);
            worker.o = shell;
            jg.k = shell;
            fb.p = null;
            fb.k = null;
            g.r = hd.o = hi.g = wd.b = false;
            pe.S = null;
            rg.s = null;
            gh.X = null;
            ak.i = 1;
            tj.a = 7;
            hi.f = vk.rb = 7;
            fl.l = oh.j = 5;
            HostClockFixture.millis += 10000;
            HostClockFixture.sleeps.clear();
            log.reset();
            hooks.setLength(0);
            String error = "-";
            try {
                if (arg[0].equals("run")) {
                    fb.p = arg[1].equals("~") ? null : arg[1];
                    fb.k = arg[2].equals("~") ? null : arg[2];
                    shell.run();
                } else {
                    int flags = Integer.parseInt(arg[1]);
                    if ((flags & 1) != 0) jg.k = null;
                    if ((flags & 2) != 0) g.r = true;
                    if ((flags & 4) != 0) hd.o = true;
                    vc.P = HostClockFixture.millis - Integer.parseInt(arg[2]);
                    int x = Integer.parseInt(arg[3]), y = Integer.parseInt(arg[4]);
                    Graphics graphics = image.getGraphics();
                    if (x >= 0) graphics.setClip(100,-3,x,y);
                    if (x == -2) graphics = null;
                    switch (arg[0]) {
                        case "paint" -> shell.paint(graphics);
                        case "update" -> shell.update(graphics);
                        case "start" -> shell.start();
                        case "stop" -> shell.stop();
                        case "destroy" -> shell.destroy();
                        case "closing" -> shell.windowClosing(null);
                        case "provide" -> p.providesignlink((flags & 1) != 0 ? null : worker);
                        default -> throw new AssertionError();
                    }
                    if (graphics != null) graphics.dispose();
                }
            } catch (RuntimeException ex) {
                boolean drawing = arg[0].equals("paint") || arg[0].equals("update");
                error = drawing && ex instanceof g wrapped ? wrapped.q : "exception";
            }
            String reason = log.toString().contains("error_game_wrongjava") ? "wrongjava" :
                    log.toString().contains("error_game_crash") ? "crash" : "-";
            long kill = tj.a == 0 || tj.a == 7 ? tj.a : tj.a - HostClockFixture.millis;
            result.println(error+"|"+reason+"|"+ak.i+"|"+hd.o+"|"+hi.g+"|"+wd.b+"|"+g.r+"|"+
                    kill+"|"+(ca.l == null)+"|"+(tj.m == null)+"|"+(gh.X != null)+"|"+hooks+"|"+HostClockFixture.sleeps);
        }
    }
}
