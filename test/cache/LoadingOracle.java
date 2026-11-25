import java.io.*;
import java.util.*;
import java.util.zip.CRC32;

class LoadingOracle {
    static List<String> reads = new ArrayList<>();
    static int remainder;
    static boolean traceIndex;
    static class Provider extends ud {
        int archive;
        db index;
        Provider(int archive,String encoded) {
            this.archive=archive;
            byte[] bytes=Base64.getDecoder().decode(encoded);
            CRC32 crc=new CRC32(); crc.update(bytes);
            this.index=new db(bytes,(int)crc.getValue());
        }
        db b(int dummy) {
            if (traceIndex) reads.add("index");
            return index;
        }
        byte[] a(int mode,int group) {
            reads.add(archive+"/"+group);
            return group%4 < remainder ? new byte[]{0} : null;
        }
        void b(int dummy,int group) { throw new AssertionError(); }
        int c(int group,int dummy) { throw new AssertionError(); }
    }
    static int[] ids() {
        return new int[]{ce.I,vi.T,bj.i,jk.F,ef.w,bj.k,di.l,vj.s,ij.o,l.I,qe.jb,ej.f,gg.E,q.j,ik.X,mj.a,mi.D,tj.l,ed.a,da.h,wi.i};
    }
    static java.lang.reflect.Field field(String key) throws ReflectiveOperationException {
        int dot = key.indexOf('.');
        return Class.forName(key.substring(0,dot)).getDeclaredField(key.substring(dot+1));
    }
    static void changingNames(al sprites, al waiting) throws Exception {
        String[] names = ("gi.p oe.t mk.I sc.U uh.R gi.l fk.U rj.h rc.e vg.cb me.k je.jb di.c bf.H sj.J kf.c " +
            "ed.n be.Ib ad.e ea.d ek.J").split(" ");
        String[] slots = ("ce.I vi.T bj.i jk.F ef.w bj.k di.l vj.s ij.o l.I qe.jb ej.f gg.E q.j ik.X mj.a " +
            "mi.D tj.l ed.a da.h wi.i").split(" ");
        Object[] replacements = {null,me.k,vb.a("missing_name",(byte)42)};
        for (String name : names) {
            var f = field(name);
            Object old = f.get(null);
            try {
                for (al archive : new al[]{sprites,waiting}) {
                    for (Object replacement : replacements) {
                        for (int i=0; i<slots.length; i++) field(slots[i]).setInt(null,-800-i);
                        f.set(null,replacement);
                        String result = "ok";
                        try {
                            ld.a(archive,52);
                            g.a(81,archive);
                            pf.a(archive,-26442);
                        } catch (RuntimeException e) { result="exception"; }
                        System.out.println(result+"|"+Arrays.toString(ids()));
                    }
                }
            } finally { f.set(null,old); }
        }
    }
    static void readiness(String multipleGroups, String oneGroup) throws Exception {
        String[] fields = "ce.I vi.T bj.i jk.F ef.w bj.k di.l vj.s ij.o l.I qe.jb ej.f gg.E q.j ik.X mj.a mi.D tj.l ed.a da.h wi.i".split(" ");
        for (String key : fields) field(key).setInt(null, 0);
        remainder = 0;
        traceIndex = true;
        for (int shape = 0; shape < 4; shape++) {
            for (int hitmarks : new int[]{-1, 0}) for (int markers : new int[]{-1, 0}) {
                ef.w = hitmarks;
                l.I = markers;
                for (int call = 0; call < 6; call++) {
                    Provider p = new Provider(8, shape == 2 ? oneGroup : multipleGroups);
                    if (shape == 1) p.index = null;
                    al archive = shape == 0 ? null : new al(p, false, true);
                    reads.clear();
                    String value;
                    try {
                        value = switch (call) {
                            case 0, 1 -> Integer.toString(ka.a(archive, call == 1));
                            case 2 -> Integer.toString(nh.a(archive, null, -119));
                            case 3 -> Integer.toString(nh.a(null, archive, -119));
                            case 4 -> Integer.toString(jl.a(archive, 123));
                            default -> Boolean.toString(ck.a(archive, 14));
                        };
                    } catch (RuntimeException e) {
                        Throwable cause = e;
                        while (cause instanceof g wrapped && wrapped.a != null) cause = wrapped.a;
                        if (!(cause instanceof NullPointerException)) throw e;
                        value = "null";
                    }
                    System.out.println(value + "|" + String.join(",", reads));
                }
            }
        }
    }
    static class Stage70 {
        static final String[] slots = "uh.O bc.c sf.b dd.l rg.m re.d al.l rk.k h.i ha.b ek.D gd.E il.B nf.j f.f gj.Z fk.db bh.c ve.e ok.t ml.t ta.M jl.f aa.d kh.B wf.u wh.X ll.g".split(" ");
        static final String[] published = ("uf.s ik.V aj.ec ra.Z qh.b ik.Y gd.U nl.Y mf.k wd.i nf.c bb.f " +
            "uk.d ef.K ag.i s.S ec.j ig.s ma.g ba.g h.f kk.R pb.nc kh.A gf.ab ae.h s.Y a.b nh.N gj.W ke.s hj.e mj.d n.g").split(" ");
        static final Map<al,String> tags = new IdentityHashMap<>();
        static final List<String> events = new ArrayList<>();
        static final fg oldFont = new fg(new byte[257]), countFont = new fg(new byte[257]);
        static final id[] oldOps = {vb.a("original",(byte)60)};
        static db table;
        static String mode;
        static int target;
        static boolean changed;
        static final byte[] normal = {0,0,0,0,1,0}, wearable = {0,0,0,0,4,23,0,17,0}, broken = {0,0,0,0,1,23};

        static void set(String name,Object value) {
            try { var f=field(name); f.setAccessible(true); f.set(null,value); }
            catch(ReflectiveOperationException e) {throw new AssertionError(e);}
        }
        static Object get(String name) throws Exception {
            var f=field(name);f.setAccessible(true);return f.get(null);
        }
        static class Input extends ud {
            final int id;
            final String tag;
            Input(int id,String tag) {this.id=id;this.tag=tag;}
            db b(int dummy) {
                events.add("i"+tag);
                if(id==19 && tag.equals("r19") && mode.equals("fontSwap")) rg.h=oldFont;
                if(id==3 && mode.equals("interrupt")) throw new IllegalStateException();
                if(id==3 && mode.equals("initSwap") && !changed) { changed=true;set(slots[2],archive(2,"r2")); }
                return table;
            }
            byte[] a(int request,int group) {
                events.add("g"+tag+"/"+group);
                if (!changed && id==target && mode.equals("swap")) {changed=true;set(slots[id],archive(id,"r"+id));}
                if (!changed && id==27 && mode.equals("fontSwap")) {changed=true;set(slots[19],archive(19,"r19"));}
                if (!changed && id==27 && mode.equals("objNull")) {changed=true;set(slots[19],null);}
                if (mode.equals("partial") || mode.equals("swap") || mode.equals("over") && id!=19) return null;
                return id==19 ? mode.equals("wearFail") ? broken : wearable : normal;
            }
            int c(int group,int dummy) {
                events.add("p"+tag+"/"+group);
                return mode.equals("over")?119:tag.startsWith("r")?91:(id*3+11)%83;
            }
            void b(int dummy,int group) {throw new AssertionError();}
        }
        static al archive(int id,String tag) {
            al a=new al(new Input(id,tag),false,true); tags.put(a,tag);return a;
        }
        static String opText(id[] ops){
            if(ops==oldOps) return "old";
            StringJoiner out=new StringJoiner(",");
            for(id name:ops)out.add(name==null?"_":Base64.getEncoder().encodeToString(name.b(false)));
            return out.toString();
        }
        static void run(BufferedReader input) throws Exception {
            byte[] bytes=Base64.getDecoder().decode(input.readLine());
            table=new db(bytes,q.a(0,bytes,bytes.length));
            Class<?> u=Class.forName("sun.misc.Unsafe");var uf=u.getDeclaredField("theUnsafe");uf.setAccessible(true);
            client app=(client)u.getMethod("allocateInstance",Class.class).invoke(uf.get(null),client.class);
            var load=client.class.getDeclaredMethod("f",byte.class);load.setAccessible(true);
            for(String line;(line=input.readLine())!=null;) {
                String[] fields=line.split(" ");mode=fields[0];target=Integer.parseInt(fields[1]);changed=false;
                tags.clear();al previous=archive(-1,"old");
                for(String member:published)set(member,previous);
                for(int i=0;i<slots.length;i++) set(slots[i],archive(i,"a"+i));
                fk.ab = new aj[3][];rg.b=new boolean[4];sd.Y=-7;bb.b=ok.z=false;
                tk.e=new int[]{731};mj.i=sb.i=oldOps;ae.k=oldFont;rg.h=countFont;
                fa.b.a(0);bh.b=70;ga.D=29;ie.A=vb.a("seed",(byte)62);we.y=true;
                events.clear();String result="ok";
                try{load.invoke(app,(byte)110);}
                catch(java.lang.reflect.InvocationTargetException ex) {
                    Throwable cause=ex.getCause();
                    while(cause instanceof g wrapped && wrapped.a!=null)cause=wrapped.a;
                    if(!(cause instanceof RuntimeException)) throw ex;
                    result="exception";
                }
                StringJoiner refs=new StringJoiner(",");
                for(String member:published){al ref=(al)get(member);refs.add(ref==null?"null":tags.get(ref));}
                System.out.println(line+"|"+result+"|"+String.join(",",events)+"|"+refs+"|"+bh.b+","+ga.D+","+
                    Base64.getEncoder().encodeToString(ie.A.b(false))+"|"+bb.b+","+ok.z+","+sd.Y+","+(ae.k==countFont)+","+(ae.k==oldFont)+","+(rg.h==countFont)+","+
                    fk.ab.length+","+rg.b.length+"|"+opText(mj.i)+"|"+opText(sb.i)+"|"+Arrays.toString(tk.e));
            }
        }
    }
    public static void main(String[] args) throws Exception {
        BufferedReader input = new BufferedReader(new InputStreamReader(System.in));
        if(args.length>0 && args[0].equals("stage70")) {Stage70.run(input);return;}
        String index = input.readLine();
        al sprites = new al(new Provider(8,index),false,true);
        al metrics = new al(new Provider(13,input.readLine()),false,true);
        System.out.println(Arrays.toString(ids()));
        ld.a(sprites,52);
        g.a(81,sprites);
        pf.a(sprites,-26442);
        System.out.println(Arrays.toString(ids()));
        for(remainder=0;remainder<=4;remainder++) {
            reads.clear();
            System.out.println(nh.a(sprites,metrics,-119)+","+ha.a((byte)-50)+","+jl.a(sprites,123)+","+qg.c(100)+","+ka.a(sprites,false)+","+wh.b(true)+","+ck.a(sprites,14)+"|"+String.join(",",reads));
        }
        Provider pending = new Provider(8,index);
        pending.index = null;
        changingNames(sprites,new al(pending,false,true));
        readiness(index,input.readLine());
    }
}
