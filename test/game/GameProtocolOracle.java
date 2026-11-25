import java.io.*;
import java.lang.reflect.Field;
import java.net.Socket;
import java.util.*;

class GameProtocolOracle {
    static final HexFormat hex = HexFormat.of();
    static final int[] seed = {1,2,3,4};
    static final Input input = new Input();
    static final be encoder = new be(5000);
    static se stream;
    static int wirePos;
    static int[] sizes;
    static class EmptyAssets extends ud {
        final db index;
        final byte[] group;
        EmptyAssets(byte[] group) {
            byte[] ref = hex.parseHex("0000000012050000010000000000000000000000010000");
            index = new db(ref,q.a(0,ref,ref.length)); this.group = group;
        }
        db b(int ignored) { return index; }
        byte[] a(int mode,int group) { return this.group; }
        void b(int ignored,int group) {}
        int c(int group,int ignored) { return 100; }
    }
    static class Input extends InputStream {
        final ByteArrayOutputStream bytes = new ByteArrayOutputStream();
        int pos, visible, polls;
        boolean replaceOnRead, detachOnRead, ioFailure, assertionFailure;
        public int available() throws IOException {
            polls++;
            if (ioFailure) { ioFailure=false; throw new IOException("receive"); }
            if (assertionFailure) { assertionFailure=false; throw new AssertionError("receive"); }
            return visible;
        }
        public int read() { if (visible <= 0) return -1; visible--; return bytes.toByteArray()[pos++] & 255; }
        public int read(byte[] dest, int start, int count) {
            count = Math.min(count,visible);
            if (count == 0) return -1;
            System.arraycopy(bytes.toByteArray(),pos,dest,start,count);
            if (replaceOnRead) {
                replaceOnRead=false;
                try {
                    be packet=new be(5000);
                    Field isaac=be.class.getDeclaredField("Jb"); isaac.setAccessible(true);
                    isaac.set(packet,isaac.get(hd.b));
                    Arrays.fill(packet.fb,0,24,(byte)5);
                    packet.yb=19;
                    hd.b=packet;
                } catch (ReflectiveOperationException e) { throw new AssertionError(e); }
            }
            if (detachOnRead) { detachOnRead=false; ek.s=null; }
            visible -= count; pos += count; return count;
        }
    }
    static class Peer extends Socket {
        public void setSoTimeout(int timeout) {}
        public void setTcpNoDelay(boolean enabled) {}
        public InputStream getInputStream() { return input; }
        public OutputStream getOutputStream() { return OutputStream.nullOutputStream(); }
    }
    static Field field(String name) throws Exception {
        Field f = se.class.getDeclaredField(name); f.setAccessible(true); return f;
    }
    static void encode(int op, byte[] body) throws Exception {
        encoder.yb = 0; encoder.k(2,op);
        input.bytes.write(encoder.fb[0] & 255);
        if (sizes[op] == -2) input.bytes.write(body.length >> 8);
        if (sizes[op] < 0) input.bytes.write(body.length);
        input.bytes.write(body);
    }
    static void init() throws Exception {
        // The real game tick can run headless. Warm up its default input/focus
        // changes once and then start both ciphers at a known checkpoint.
        hh.kb=1; tf.C=30; o.Y=-1; ej.p=new ag(); te.g=tf.J[2047]=new pb(); te.g.Z=te.g.S=4096;
        Field f = rg.class.getDeclaredField("i"); f.setAccessible(true); sizes = (int[])f.get(null);
        // Supply the cache and collision-map objects normally constructed by
        // client.f so the original T1/T2 logout can finish in headless mode.
        al empty = new al(new EmptyAssets(null),false,false);
        uh.O=bc.c=dd.l=rg.m=re.d=al.l=rk.k=h.i=ek.D=gd.E=il.B=kh.A=empty;
        al materials = new al(new EmptyAssets(hex.parseHex("00000000020000")), false, false);
        dc.r=new kg(empty,materials,empty,4,false);
        for (int i=0;i<4;i++) hc.c[i]=new ke(104,104);
        kg.H=true; wk.d=new ej();
        gk.j=sb.h=ah.f; qk.v.a(seed,0); qc.W=true;
        t.c(100);
        qk.v.yb = hd.b.yb = 0; qk.v.a(seed,0); hd.b.a(seed,0); encoder.a(seed,0);
        fk.X=la.W=jh.q=o.Y=-1; ia.q=af.I=mc.U=0; sc.V=false;
        stream = ek.s = new se(new Peer(),null);
        // Leave se's actual ring writer asleep so a fixture can inspect each
        // queued range deterministically, without opening a socket or thread.
        dj task = new dj(); task.b = 1; task.a = new Thread(); field("n").set(stream,task);
    }
    static void state(String value) throws Exception {
        byte[] ring = (byte[])field("B").get(stream);
        int tail = field("o").getInt(stream);
        String wire = ring == null ? "" : tail >= wirePos ? hex.formatHex(ring,wirePos,tail) :
                hex.formatHex(ring,wirePos,ring.length) + hex.formatHex(ring,0,tail);
        wirePos = tail;
        System.out.println(String.join(";",value,""+o.Y,""+af.I,""+fk.X,""+la.W,""+jh.q,""+ia.q,""+mc.U,""+sc.V,
            ""+hd.b.yb,hex.formatHex(hd.b.fb,0,24),""+input.pos,""+input.polls,hex.formatHex(qk.v.fb,0,qk.v.yb),wire,
            ""+tf.C,""+(ek.s!=null),""+qc.Z,""+jd.i,""+dg.C,""+ha.a,""+rj.x,""+ej.p.n,""+Arrays.hashCode(ej.p.o),
            ""+Arrays.hashCode(ej.p.m),""+se.a,""+mk.K,""+lk.v,""+ea.c,""+je.ib,""+mi.A,""+ia.l));
    }
    public static void main(String[] args) throws Exception {
        init();
        for (String line; (line = reader.readLine()) != null;) {
            String[] p = line.split(" ");
            String value = "";
            try {
                switch (p[0]) {
                    case "empty-null": {
                        byte[] before=hd.b.fb;
                        hd.b.fb=null;input.visible++;gl.z=17;o.Y=153;af.I=0;
                        try { value=rg.a((byte)57)+","+gl.z; }
                        finally { hd.b.fb=before;input.visible--; }
                        break;
                    }
                    case "size": sizes[Integer.parseInt(p[1])]=Integer.parseInt(p[2]);break;
                    case "replace": input.replaceOnRead=true;break;
                    case "detach": input.detachOnRead=true;break;
                    case "raw": input.bytes.write(hex.parseHex(p[1]));break;
                    case "io": input.ioFailure=true;break;
                    case "assert": input.assertionFailure=true;break;
                    case "frame": encode(Integer.parseInt(p[1]),p.length>2 ? hex.parseHex(p[2]) : new byte[0]); break;
                    case "read": input.visible += Integer.parseInt(p[1]); value=""+rg.a((byte)57); break;
                    case "check": input.visible += Integer.parseInt(p[1]); value=""+e.b(-66); break;
                    case "restart":
                        o.Y=-1; tf.C=30; mf.m=null;
                        stream=ek.s=new se(new Peer(),null); wirePos=0;
                        dj task=new dj(); task.b=1; task.a=new Thread(); field("n").set(stream,task);
                        break;
                    case "write":
                        qk.v.k(2,Integer.parseInt(p[1]));
                        if (p.length>2) for(byte b:hex.parseHex(p[2])) qk.v.b((byte)4,(int)b);
                        break;
                    case "verify": value=""+sk.b(Integer.parseInt(p[1]),(byte)-128);break;
                    case "ack": qc.Z=true; jd.i=Integer.parseInt(p[1]); break;
                    case "force": ph.a(Boolean.parseBoolean(p[1]),121); break;
                    case "tick": t.c(100); break;
                    case "focus": wg.g=Boolean.parseBoolean(p[1]); break;
                    case "track": tj.h=Boolean.parseBoolean(p[1]); break;
                    case "samples":
                        for (int i=1;i<p.length;i+=2) {
                            ej.p.o[ej.p.n]=Integer.parseInt(p[i]);
                            ej.p.m[ej.p.n++]=Integer.parseInt(p[i+1]);
                        }
                        break;
                    case "click":
                        oi.h=Integer.parseInt(p[1]); sa.x=Integer.parseInt(p[2]);
                        oj.e=Integer.parseInt(p[3]); lc.v=Long.parseLong(p[4]); break;
                    case "fail": field("y").setBoolean(stream,true); break;
                    case "cleartimer":ia.l=0;break;
                    case "idleinput":je.ib=Integer.parseInt(p[1]);mi.A=Integer.parseInt(p[2]);break;
                    case "connect": ek.s = p[1].equals("yes") ? stream : null; break;
                    case "idles": ia.q=Integer.parseInt(p[1]); mc.U=Integer.parseInt(p[2]); break;
                    case "seedorder":
                        b.L=new dj();b.L.b=1;b.L.a=new Object();client.sb=null;pa.tb=true;
                        kf.q=321;vf.P=411;ng.B=0;ve.f=new ng();dd.n=117;sd.N=255;hj.d=false;
                        bb.e=42;wk.l=2;mf.l=987;break;
                    case "order":
                        value=String.join(",",""+(b.L==null),""+pa.tb,""+kf.q,""+vf.P,""+dd.n,""+mf.l,""+wk.l,
                            hex.formatHex(qk.v.fb,0,qk.v.yb));break;
                    case "state": tf.C=Integer.parseInt(p[1]); break;
                    default: throw new AssertionError(line);
                }
            } catch (AssertionError e) {
                if (!"receive".equals(e.getMessage())) throw e;
                value="error";
            } catch (g e) {
                if (e.a instanceof Error) throw e;
                value="exception";
            }
            state(value);
        }
    }
    static final BufferedReader reader = new BufferedReader(new InputStreamReader(System.in));
}
