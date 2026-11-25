import java.applet.*;
import java.awt.*;
import java.awt.event.*;
import java.awt.image.*;
import java.io.*;
import java.lang.reflect.*;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.*;

@SuppressWarnings({"removal", "deprecation"})
class ClientBootOracle {
    static final Map<String, String> params = new HashMap<>();
    static final ArrayList<String> calls = new ArrayList<>();
    static URL document, code;
    static boolean finishing;
    static int wheelPlatform;
    static final IllegalStateException paramFailure = new IllegalStateException();
    static final Error seriousFailure = new AssertionError();
    static final IOException ioFailure = new IOException();
    @SuppressWarnings("unchecked")
    static <E extends Throwable> void rethrow(Throwable error) throws E { throw (E)error; }
    static String value(String name) {
        String s = params.get(name);
        if ("!runtime".equals(s)) throw paramFailure;
        if ("!wrapped".equals(s)) throw od.a(paramFailure, "parent");
        if ("!error".equals(s)) throw seriousFailure;
        if ("!io".equals(s)) ClientBootOracle.<RuntimeException>rethrow(ioFailure);
        if ("!empty".equals(s)) { ga.J = vb.a("replaced", (byte)121); return null; }
        return s;
    }
    static void observe(String event) {
        if (!finishing) return;
        calls.add(event+"@"+(ud.a!=null)+"/"+nl.ab);
        if (event.equals("wheel")) fb.f=wheelPlatform;
    }
    static class InputCanvas extends Canvas {
        public void setSize(int w,int h) { observe("canvas"+w+"x"+h); super.setSize(w,h); }
        public void setLocation(int x,int y) { observe("location"+x+","+y); super.setLocation(x,y); }
        public void addKeyListener(KeyListener listener) { observe("key"); super.addKeyListener(listener); }
        public void addFocusListener(FocusListener listener) { observe("focus"); super.addFocusListener(listener); }
        public void addMouseListener(MouseListener listener) { observe("mouse"); super.addMouseListener(listener); }
        public void addMouseMotionListener(MouseMotionListener listener) { observe("motion"); super.addMouseMotionListener(listener); }
        public void addMouseWheelListener(MouseWheelListener listener) { observe("wheel"); super.addMouseWheelListener(listener); }
    }
    static class Page extends Applet implements AppletContext {
        public String getParameter(String name) { calls.add(name); return value(name); }
        public URL getDocumentBase() { calls.add("document"); value("!document"); return document; }
        public URL getCodeBase() { calls.add("code"); return code; }
        public AppletContext getAppletContext() { calls.add("context"); return this; }
        public Dimension getSize() { observe("size"); return new Dimension(765, 503); }
        public void showDocument(URL u, String target) { calls.add(target + "=" + u.toExternalForm()); }
        public void showDocument(URL u) {}
        public Applet getApplet(String n) { return null; }
        public Enumeration<Applet> getApplets() { return null; }
        public AudioClip getAudioClip(URL u) { return null; }
        public Image getImage(URL u) { return null; }
        public void showStatus(String s) {}
        public void setStream(String k, InputStream s) {}
        public InputStream getStream(String k) { return null; }
        public Iterator<String> getStreamKeys() { return null; }
    }
    static String bytes(id s) { return s == null ? "-" : HexFormat.of().formatHex(s.b(false)); }
    static String string(String s) { return s == null ? "" : s; }

    static Field field(Class<?> c, String s) throws Exception {
        Field f = c.getDeclaredField(s);
        f.setAccessible(true);
        return f;
    }

    public static void main(String[] args) throws Exception {
        Class<?> unsafeClass = Class.forName("sun.misc.Unsafe");
        Object unsafe = field(unsafeClass, "theUnsafe").get(null);
        Method alloc = unsafeClass.getMethod("allocateInstance", Class.class);
        Page page = (Page)alloc.invoke(unsafe, Page.class);
        client game = (client)alloc.invoke(unsafe, client.class);
        fb link = (fb)alloc.invoke(unsafe, fb.class);
        link.o = page;
        tj.m = link;
        pe.S = new Canvas();
        Field tail = field(fb.class, "j");
        // A controlled Java worker records the original dj instead of starting the game's unrelated main loop.
        Thread worker = new Thread(() -> {
            try {
                synchronized (link) {
                    while (true) {
                        dj r = (dj)tail.get(link);
                        if (r == null || r.b != 0) link.wait();
                        else {
                            calls.add("request=" + r.e + "/" + r.c + "/" + (r.d == game));
                            r.b = 1;
                        }
                    }
                }
            } catch (InterruptedException done) {
            } catch (Exception e) { throw new RuntimeException(e); }
        });
        worker.setDaemon(true);
        worker.start();
        var in = new BufferedReader(new InputStreamReader(System.in, StandardCharsets.UTF_8));
        var output = System.out;
        System.setOut(new PrintStream(OutputStream.nullOutputStream()));
        try {
            String line;
            while ((line = in.readLine()) != null) {
                String[] a = line.split(" ", -1);
                switch (a[0]) {
                    case "doc" -> document = new URL(a[1]);
                    case "code" -> code = new URL(a[1]);
                    case "set" -> { if (a[2].equals("~")) params.remove(a[1]); else params.put(a[1], new String(Base64.getDecoder().decode(a[2]),StandardCharsets.UTF_8)); }
                    case "reset" -> { jg.k = null; dg.B = null; lc.x = 0; field(p.class, "o").setBoolean(game, false); }
                    default -> {
                        calls.clear();
                        String result = "ok";
                        try {
                            if (a[0].equals("init")) game.init();
                            else if (a[0].equals("start")) game.a(-126,330,34,-42,221);
                            else {
                                // b also reads preferences via the live fb worker. Its cache request is unsupported in SD.
                                d.c = Integer.parseInt(a[1]); fb.f = Integer.parseInt(a[2]);
                                oi.e=Integer.parseInt(a[3]);wheelPlatform=Integer.parseInt(a[4]);jg.C=!a[5].equals("0");
                                nl.ab=-37;ud.a=null;oh.g=null;
                                pe.S=new InputCanvas();
                                tj.m = new fb(page, 32, null, 0);
                                finishing=true;
                                try { game.b((byte)-108); }
                                finally {
                                    finishing=false;
                                    if(ud.a!=null)ud.a.a(false);
                                    tj.m.a(true); tj.m = link;
                                }
                            }
                        } catch (Throwable e) {
                            Throwable cause=e;
                            while (cause instanceof g wrapped && wrapped.a != null) cause=wrapped.a;
                            result=cause instanceof NumberFormatException?"number":cause instanceof NullPointerException?"null":"runtime";
                            if (cause == paramFailure) result = "runtime/" + ((g)e).q;
                            if (e == seriousFailure) result = "error";
                            if (e == ioFailure) result = "io";
                            if (a[0].equals("finish")) { e.printStackTrace(); cause.printStackTrace(); }
                        }
                        if (a[0].equals("finish")) {
                            output.println(String.join("|", result, string(pg.S), ""+th.h, ""+bh.g, string(sd.T), ""+ag.f, ""+aa.a, ""+aj.Cb, ""+ie.r, ""+qj.C,
                                ""+jg.C,""+(oh.g==null?-1:oh.g.length),""+nl.ab,String.join(",", calls)));
                        } else {
                            output.println(String.join("|", result, ""+ik.R, ""+d.c, ""+oi.e, ""+uj.l, ""+hl.w, ""+lk.z, ""+client.L, ""+jl.c, ""+ce.F,
                                bytes(oj.k), ""+da.e, ""+vk.kb, ""+(dg.B==game), ""+(jg.k==game), ""+lc.x, ""+mf.j, ""+fl.l, ""+oh.j, ""+pa.rb, ""+sk.N, ""+hi.f, ""+vk.rb,
                                ""+field(p.class,"o").getBoolean(game),String.join(",",calls)));
                        }
                    }
                }
            }
        } finally { worker.interrupt(); worker.join(); }
    }
}
