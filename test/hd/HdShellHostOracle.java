import java.applet.*;
import java.awt.Frame;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.lang.reflect.Proxy;
import java.net.URL;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import jdk.internal.org.objectweb.asm.*;

/** Probe host boundaries while executing nf.a, rc.a, c.a and the prefix of client.c from the HD JAR. */
public class HdShellHostOracle {
    static final String HOOK = "HdShellHostOracle";
    static final ArrayList<String> events = new ArrayList<>();
    static int cut, baseReads;
    static String mode, parameter;
    static client shell;
    static Page page;
    static Frame frame;
    static ll link;
    static class MouseBoundary extends Error {}
    static void event(String name) {
        events.add(name);
        if (events.size() == cut) throw new IllegalStateException("cut");
        if (name.equals("mouse")) throw new MouseBoundary();
    }
    public static void shutdown() { event("shutdown"); }
    public static im release(ll receiver, Class<?> type, int guard) {
        event("request11");
        im request = receiver.a(type, guard);
        if (request.f != 11 || request.a != 0 || request.c != shell.getClass() || request.d != 0 || request.e != null)
            throw new AssertionError("incorrect queued class release");
        return request;
    }
    public static im exit(ll receiver, Frame which, int guard) {
        if (receiver == null) throw new NullPointerException();
        if (receiver != link || which != (mode.equals("null-frame") ? null : frame) || guard != 86) throw new AssertionError("incorrect fullscreen exit");
        event("exit");
        im request = new im(); request.d = 1; return request;
    }
    public static im thread(ll receiver, int guard, int priority, Runnable app) {
        if (receiver != link || priority != 1 || app != shell) throw new AssertionError("incorrect startup request");
        event("thread");
        im request = new im(); request.d = 1; request.e = Thread.currentThread(); return request;
    }
    public static Object bridge(Applet app, String js, Object[] args, byte guard) {
        if (app == null) throw new NullPointerException();
        if (app != page || guard != 117 || args.length != 1) throw new AssertionError("incorrect LiveConnect arguments");
        event(js + "=" + args[0]);
        if (mode.equals("js-error")) throw new AssertionError("js");
        if (mode.equals("js-fault")) throw new IllegalStateException("js");
        return null;
    }
    static final class Display extends Frame {
        public void setVisible(boolean value) { event("visible=" + value); }
        public void dispose() { event("dispose"); }
    }
    static final class Page extends Applet {
        public String getParameter(String name) { event("param=" + name); return parameter; }
        public URL getCodeBase() {
            event("base");
            int id = ++baseReads;
            if (mode.equals("first-base") && id == 1) throw new IllegalStateException("base");
            try { return new URL("https://example.invalid/folder" + id + "/client.bin"); }
            catch (Exception ex) { throw new AssertionError(ex); }
        }
        public AppletContext getAppletContext() {
            event("context");
            if (mode.equals("clear-shell")) sj.F = null;
            return (AppletContext)Proxy.newProxyInstance(getClass().getClassLoader(), new Class<?>[]{AppletContext.class}, (p,m,a) -> {
                if (!m.getName().equals("showDocument")) throw new AssertionError(m);
                event("show=" + a[1] + "=" + a[0]);
                if (mode.equals("show-error")) throw new AssertionError("show");
                if (mode.equals("show-fault")) throw new IllegalStateException("show");
                return null;
            });
        }
    }
    static void instrument(String owner, String method, String descriptor, Path dir) throws Exception {
        ClassReader reader = new ClassReader(owner);
        ClassWriter writer = new ClassWriter(reader, ClassWriter.COMPUTE_MAXS);
        reader.accept(new ClassVisitor(Opcodes.ASM8,writer) {
            public MethodVisitor visitMethod(int a,String n,String d,String s,String[] e) {
                MethodVisitor mv = super.visitMethod(a,n,d,s,e);
                if (!method.equals(n) || !descriptor.equals(d)) return mv;
                return new MethodVisitor(Opcodes.ASM8,mv) {
                    void record(String value) {
                        super.visitLdcInsn(value);
                        super.visitMethodInsn(Opcodes.INVOKESTATIC,HOOK,"event","(Ljava/lang/String;)V",false);
                    }
                    public void visitFieldInsn(int op,String cls,String name,String desc) {
                        String member = cls+"."+name;
                        if (owner.equals("client") && op == Opcodes.GETSTATIC) {
                            switch(member) {
                                case "tf.w" -> record("active");
                                case "fh.Y" -> record("frame");
                                case "fk.l" -> record("link");
                                case "od.f" -> record("mouse");
                            }
                        }
                        super.visitFieldInsn(op,cls,name,desc);
                        if (owner.equals("client") && op == Opcodes.PUTSTATIC && member.equals("fh.Y")) record("cleared");
                    }
                    public void visitMethodInsn(int op,String cls,String n,String d,boolean iface) {
                        String key = cls+"."+n+d;
                        String replacement = switch(key) {
                            case "tf.o()V" -> "shutdown";
                            case "ll.a(Ljava/lang/Class;I)Lim;" -> "release";
                            case "ll.a(Ljava/awt/Frame;I)Lim;" -> "exit";
                            case "ll.a(IILjava/lang/Runnable;)Lim;" -> "thread";
                            case "gh.a(Ljava/applet/Applet;Ljava/lang/String;[Ljava/lang/Object;B)Ljava/lang/Object;" -> "bridge";
                            default -> null;
                        };
                        if (replacement == null) super.visitMethodInsn(op,cls,n,d,iface);
                        else super.visitMethodInsn(Opcodes.INVOKESTATIC,HOOK,replacement,
                            op == Opcodes.INVOKESTATIC ? d : "(L"+cls+";"+d.substring(1),false);
                    }
                };
            }
        },0);
        Files.write(dir.resolve(owner+".class"),writer.toByteArray());
    }
    public static void main(String[] args) throws Exception {
        if (args.length > 0) {
            Path dir = Path.of(args[0]);
            instrument("client","c","(B)V",dir);
            instrument("c","a","(Ljava/awt/Frame;ZLll;)V",dir);
            instrument("nf","a","(Lna;BZ)V",dir);
            instrument("rc","a","(BIIII)V",dir);
            return;
        }
        shell = (client)WindowLayoutOracle.headless(client.class);
        page = (Page)WindowLayoutOracle.headless(Page.class);
        frame = (Display)WindowLayoutOracle.headless(Display.class);
        link = (ll)WindowLayoutOracle.headless(ll.class);
        shell.setStub((AppletStub)Proxy.newProxyInstance(HdShellHostOracle.class.getClassLoader(), new Class<?>[]{AppletStub.class},
            (p,m,a) -> switch(m.getName()) { case "getCodeBase" -> page.getCodeBase(); case "getAppletContext" -> page.getAppletContext(); default -> null; }));
        BufferedReader stdin = new BufferedReader(new InputStreamReader(System.in));
        for (String row; (row=stdin.readLine())!=null;) {
            String[] r = row.split(" ");
            events.clear(); cut=0; baseReads=0; mode="ok";
            String status = "ok";
            try {
                if (r[0].equals("q")) {
                    tf.w = r[1].equals("1"); fh.Y = r[2].equals("1") ? frame : null;
                    fk.l = r[3].equals("1") ? link : null; cut = Integer.parseInt(r[4]);
                    shell.c((byte)23);
                } else if (r[0].equals("f")) {
                    mode="null-frame";
                    c.a(null, true, link);
                } else if (r[0].equals("u")) {
                    tf.w = r[2].equals("1"); da.M = r[3].equals("1"); mode = r[4];
                    sj.F = shell; fk.l = mode.equals("no-link") ? null : link; link.i = page;
                    na address = r[5].equals("null") ? null : sj.a(r[5],27307);
                    nf.a(address,(byte)125,r[1].equals("1"));
                } else {
                    parameter = r[1].equals("null") ? null : r[1];
                    sj.F=null; fk.l=link; link.i=page; da.M = !r[1].equals("1"); cm.b=null;
                    shell.a((byte)-44,765,32,530,503);
                }
            } catch (MouseBoundary stop) { status = "boundary"; }
            catch (ld wrapped) { status = wrapped.e + "/" + wrapped.f.getClass().getSimpleName(); }
            catch (AssertionError failure) { if (!"show".equals(failure.getMessage())) throw failure; status="host-error"; }
            String state = r[0].equals("q") ? String.valueOf(fh.Y == null)
                : r[0].equals("s") ? da.M + "," + (cm.b==Thread.currentThread()) : "-";
            System.out.println(status+"|"+String.join(";",events)+"|"+state);
        }
    }
}
