import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.*;

// Original archive 23, map area/label decoders and gh.a CS2 interpreter.
class WorldMapOracle {
    static final HexFormat hex = HexFormat.of();
    static class Provider extends ud {
        final db index;
        final byte[][] groups;
        Provider(DataInputStream in) throws IOException {
            byte[] table = in.readNBytes(in.readInt());
            index = new db(table, q.a(0,table,table.length));
            groups = new byte[index.e][];
            for (int group : index.d) groups[group] = in.readNBytes(in.readInt());
        }
        db b(int ignored) { return index; }
        byte[] a(int mode,int group) { return groups[group]; }
        void b(int ignored,int group) {}
        int c(int group,int ignored) { return 100; }
    }
    static String string(id s) { return s == null ? "-" : hex.formatHex(s.A,0,s.c); }
    static id parse(String s) {
        if (s.equals("-")) return null;
        byte[] bytes = hex.parseHex(s);
        return ea.a(bytes,0,bytes.length,0);
    }
    static String name(gh area) { return area == null ? "-" : string(area.T); }
    static void print(Object... fields) {
        StringJoiner line = new StringJoiner("/");
        for (Object value : fields) line.add(String.valueOf(value));
        System.out.println(line);
    }
    static void area(gh a) throws ReflectiveOperationException {
        var displayName=gh.class.getDeclaredField("S");
        displayName.setAccessible(true);
        print("area",name(a),string((id)displayName.get(a)),a.Q,a.R,a.J,a.Z,a.H,a.I,a.W,a.F,a.ab);
        for (ie r=(ie)a.U.d(0); r!=null; r=(ie)a.U.a(0)) print("rect",r.B,r.D,r.y,r.q);
    }
    static void labels(kc data) {
        print("labels",data.h);
        for (int i=0;i<data.h;i++) print(string(data.j[i]),data.m[i],data.l[i],data.f[i],data.b[i],
            data.a(i,(byte)-65),data.b(i,(byte)49),data.a(i,true),data.a(71,i));
    }
    static void query(int x,int z) {
        StringJoiner hits=new StringJoiner(",");
        tb list=rb.a(z,x,-29055);
        for (gh a=(gh)list.a(104);a!=null;a=(gh)list.a(true)) hits.add(name(a));
        print("query",name(nb.a(19451,x,z)),hits);
    }
    static int scriptId=700;
    static void run(int opcode,String stringOperand,String intOperand) {
        ArrayList<Integer> ops=new ArrayList<>(), ints=new ArrayList<>();
        ArrayList<id> strings=new ArrayList<>();
        if (!stringOperand.equals("_")) { ops.add(3);ints.add(0);strings.add(parse(stringOperand)); }
        if (!intOperand.equals("_")) { ops.add(0);ints.add(Integer.parseInt(intOperand));strings.add(null); }
        ops.add(opcode);ints.add(0);strings.add(null);
        ops.add(21);ints.add(0);strings.add(null);
        m script=new m(); script.D=ops.stream().mapToInt(Integer::intValue).toArray();
        script.F=ints.stream().mapToInt(Integer::intValue).toArray(); script.B=strings.toArray(id[]::new);
        sf.g.a(++scriptId,0,script);
        wf event=new wf();event.G=new Object[]{scriptId};
        Arrays.fill(tg.B, 0x5190); Arrays.fill(g.p,null);
        gh.a(event,-22368,1000);
        print("vm",opcode,tg.B[0],tg.B[1],string(g.p[0]),name(rk.h),string(ph.d),sa.w,le.l,e.f,qi.S,ug.f == (int)ug.f ? (int)ug.f : -1,
            hd.n,hh.sb,ij.l,Arrays.hashCode(gl.w));
    }
    public static void main(String[] args) throws Exception {
        DataInputStream in=new DataInputStream(new BufferedInputStream(System.in));
        al archive=new al(new Provider(in),false,false);
        mc.a(120,new rh[in.readInt()],archive);
        print("boot",he.y==archive,gl.w.length,oe.y.length);
        for (gh a=(gh)ba.d.d(0);a!=null;a=(gh)ba.d.a(0)) area(a);
        BufferedReader lines=new BufferedReader(new InputStreamReader(in,StandardCharsets.US_ASCII));
        for (String line;(line=lines.readLine())!=null;) {
            String[] v=line.split(" ",-1);
            switch (v[0]) {
                case "query" -> query(Integer.parseInt(v[1]),Integer.parseInt(v[2]));
                case "name" -> { id s=parse(v[1]); uj.a((byte)-117,s); print("name",name(ug.a(-23,s)),name(ki.e(23410))); }
                case "labels" -> { jg.t=ii.a(12447,parse(v[1]),archive);labels(jg.t); }
                case "reset" -> { pf.a(v[1].equals("1"),(byte)-113);print("reset",string(ph.d),name(rk.h),jg.t==null,sa.w,e.f,qi.S); }
                case "view" -> {
                    mf.h=new aj(); mf.h.C=177; mf.h.H=103; hd.h=3f; ug.f=4f;
                    ki.db=896; ml.m=1344; oi.a=64; od.P=512; vb.f=88; uj.d=51; c.C=71; sg.b=331; sa.w=100;
                }
                case "scroll" -> {
                    int x=Integer.parseInt(v[2]),z=Integer.parseInt(v[3]);
                    switch(v[1]) {
                        case "setX" -> la.c(x,z);
                        case "setZ" -> ig.a((byte)123,z);
                        case "target" -> uh.a(-5402,z,x);
                        case "overview" -> lg.a(mf.h.C,z,x,(byte)-91,mf.h.H);
                        case "tick" -> qk.c(true);
                        case "zoom" -> qg.b(x,true);
                        default -> throw new AssertionError(line);
                    }
                    print("scroll",c.C,sg.b,e.f,qi.S,Float.floatToIntBits(hd.h),Float.floatToIntBits(ug.f));
                }
                case "reopen" -> { g.a(0);print("reopen",string(ph.d),name(rk.h)); }
                case "tele" -> {
                    qk.v=new be(100);qk.v.a(new int[]{1,2,3,4},0);
                    uh.a(Integer.parseInt(v[1]),Integer.parseInt(v[2]),Integer.parseInt(v[3]),2074796454);
                    print("tele",hex.formatHex(qk.v.fb,0,qk.v.yb));
                }
                case "raw" -> {
                    gd packet=new gd(hex.parseHex(v[1]));
                    try { area(hl.a(packet,(byte)-114));print("raw",packet.yb); }
                    catch (RuntimeException ex) { print("rawError",packet.yb); }
                }
                case "vm" -> run(Integer.parseInt(v[1]),v[2],v[3]);
                default -> throw new AssertionError(line);
            }
        }
    }
}
