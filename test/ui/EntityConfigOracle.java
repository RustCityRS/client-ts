import java.io.*;
import java.lang.reflect.*;
import java.util.*;

// Runs the original definition archive providers, loaders and decoders.
class EntityConfigOracle {
    static class Provider extends ud {
        db index;
        byte[][] groups;
        Provider(DataInputStream in) throws Exception {
            byte[] ref = in.readNBytes(in.readInt());
            index = new db(ref, q.a(0,ref,ref.length));
            groups = new byte[index.e][];
            for (int group : index.d) groups[group] = in.readNBytes(in.readInt());
        }
        db b(int ignored) { return index; }
        byte[] a(int mode,int group) { return groups[group]; }
        void b(int ignored,int group) {}
        int c(int group,int ignored) { return 100; }
    }

    static int hash(Object v) throws Exception {
        if (v == null) return 0;
        if (v instanceof Boolean b) return b ? 1231 : 1237;
        if (v instanceof Number n) return n.intValue();
        if (v instanceof id s) {
            int h = 1;
            for (int i=0; i<s.c; i++) h = h*31 + (s.A[i] & 255);
            return h;
        }
        if (v instanceof nc table) {
            int h = table.b(-1) + 1;
            for (jf node=table.c((byte)80); node != null; node=table.a(11)) {
                h = h*31 + (int)node.k;
                h = h*31 + (node instanceof we s ? hash(s.v) : ((oe)node).v);
            }
            return h;
        }
        if (v.getClass().isArray()) {
            int h=1;
            for (int i=0;i<Array.getLength(v);i++) h=h*31+hash(Array.get(v,i));
            return h;
        }
        throw new AssertionError(v);
    }

    static class Fields {
        final Field[] fields;
        final int[] hashes;
        int count, cursorHash=1;
        Fields(Class<?> cls) {
            fields=Arrays.stream(cls.getDeclaredFields()).filter(f -> !Modifier.isStatic(f.getModifiers()))
                    .sorted(Comparator.comparing(Field::getName)).toArray(Field[]::new);
            for (Field f : fields) f.setAccessible(true);
            hashes=new int[fields.length];
            Arrays.fill(hashes,1);
        }
        void add(Object value,int cursor) throws Exception {
            count++;
            cursorHash=31*cursorHash+cursor;
            for(int j=0;j<fields.length;j++) hashes[j]=hashes[j]*31+hash(fields[j].get(value));
        }
        void print() {
            System.out.println(count+" "+cursorHash);
            for(int j=0;j<fields.length;j++) System.out.println(fields[j].getName()+" "+fields[j].getType().descriptorString()+" "+hashes[j]);
        }
    }

    static Object raw(int kind, int id, gd p, Fields fields) throws Exception {
        Object obj;
        int cursor;
        if (kind==0) obj=new kl(); else if (kind==1) obj=new ja(); else obj=new jb();
        try {
            if (obj instanceof kl t) { t.I=id; t.a(p,-28322 ^ 21525); }
            else if (obj instanceof ja t) { t.G=id; t.a(p,(byte)-28); }
            else { jb t=(jb)obj; t.k=id; t.a(p,7423); }
            cursor=p.yb;
        } catch (RuntimeException ex) { cursor=~p.yb; }
        fields.add(obj,cursor);
        return obj;
    }

    static int scriptId=70000;
    static String script(int op,int resultType,String text,int[] integers) throws Exception {
        m code=new m();
        int length=integers.length+(text==null ? 0 : 1)+4, ip=0;
        code.D=new int[length]; code.F=new int[length]; code.B=new id[length];
        for(int value:integers) { code.D[ip]=0; code.F[ip++]=value; }
        if(text!=null) { code.D[ip]=3; code.B[ip++]=text.equals("<null>") ? null : aj.a(text,(byte)-100); }
        code.D[ip++]=op; code.D[ip]=0; code.F[ip++]=534821;
        code.D[ip]=3; code.B[ip++]=aj.a("after",(byte)-100); code.D[ip]=21;
        wf event=new wf(); event.G=new Object[]{++scriptId}; sf.g.a(scriptId,0,code);
        Arrays.fill(tg.B,-732); Arrays.fill(g.p,null);
        PrintStream output=System.out;
        ByteArrayOutputStream report=new ByteArrayOutputStream();
        try (PrintStream capture=new PrintStream(report)) {
            System.setOut(capture); gh.a(event,-22368,1000);
        } finally { System.setOut(output); }
        String log=report.toString();
        String fault=log.contains("IndexOutOfBoundsException")?"bounds":log.contains("NullPointerException")?"null":
            log.contains("ClassCastException")?"cast":log.contains("CS2 - scr:")?"runtime":"ok";
        int ints=1,strings=1;
        for(int i=0;i<10;i++){ ints=31*ints+tg.B[i]; strings=31*strings+hash(g.p[i]); }
        return ints+" "+strings+" "+fault;
    }

    static void modelChecks(db index) throws Exception {
        Field ids=jb.class.getDeclaredField("yb");
        ids.setAccessible(true);
        al original=ik.Y;
        try {
            for(int method=0;method<2;method++) {
                for(int scenario=0;scenario<5;scenario++) {
                    int mode=scenario;
                    jb loc=new jb();
                    ids.set(loc,new int[]{1,2,3,4});
                    List<Integer> groups=new ArrayList<>();
                    ik.Y=new al(new ud(){
                        db b(int ignored) { return index; }
                        byte[] a(int ignored,int group) {
                            groups.add(group);
                            if(groups.size()==1) try {
                                if(mode==1) ids.set(loc,new int[0]);
                                if(mode==2) ids.set(loc,new int[]{7,5,6});
                                if(mode==3) ids.set(loc,null);
                                if(mode==4) throw new IllegalStateException();
                            } catch(IllegalAccessException e) { throw new AssertionError(e); }
                            return group%2==0 ? new byte[1] : null;
                        }
                        void b(int ignored,int group) {}
                        int c(int group,int ignored) { return 0; }
                    },false,false);
                    String result;
                    try { result=String.valueOf(method==0 ? loc.b((byte)-20) : loc.a(-30880,10)); }
                    catch(RuntimeException fault) { result="fault"; }
                    System.out.println(result+" "+groups);
                }
            }
        } finally { ik.Y=original; }
        for(int size=-1;size<=6;size++) {
            kl target=new kl(),source=new kl();
            source.vb=size<0 ? null : new id[size];
            for(int i=0;i<size;i++) source.vb[i]=aj.a("slot"+i,(byte)-100);
            boolean done=true;
            try { target.a(new kl(),source,true); } catch(RuntimeException fault) { done=false; }
            System.out.println(done+" "+hash(target.vb));
        }
    }

    static void defaultNames() throws Exception {
        id originalNpc = qg.A, originalLoc = n.e, originalObj = ha.f;
        ja npc = new ja(); jb loc = new jb(); kl obj = new kl();
        System.out.println((npc.r == loc.r) + " " + (npc.r == obj.s) + " " + hash(obj.s));
        id other = aj.a("replacement", (byte)-100);
        try {
            for (int mask = 0; mask < 8; mask++) {
                qg.A = (mask & 1) == 0 ? other : null;
                n.e = (mask & 2) == 0 ? other : null;
                ha.f = (mask & 4) == 0 ? other : null;
                ja nextNpc = new ja(); jb nextLoc = new jb(); kl nextObj = new kl();
                System.out.println((nextNpc.r == other) + " " + (nextLoc.r == other) + " " + (nextObj.s == other));
                System.out.println(hash(nextNpc.r) + " " + hash(nextLoc.r) + " " + hash(nextObj.s));
                nextNpc.a(new gd(new byte[]{2, 'N', 0, 0}), (byte)-28);
                nextLoc.a(new gd(new byte[]{2, 'L', 0, 0}), 7423);
                nextObj.a(new gd(new byte[]{2, 'O', 0, 0}), -28322 ^ 21525);
                System.out.println(hash(nextNpc.r) + " " + hash(nextLoc.r) + " " + hash(nextObj.s));
            }
            System.out.println((npc.r == originalNpc) + " " + (loc.r == originalLoc) + " " + (obj.s == originalObj));
        } finally {
            qg.A = originalNpc; n.e = originalLoc; ha.f = originalObj;
        }
    }

    static void methods() throws Exception {
        ja npc=new ja();
        npc.a(new gd(HexFormat.of().parseHex("76ffff00040004010002ffff00")),(byte)-28);
        jb loc=new jb();
        loc.a(new gd(HexFormat.of().parseHex("5cffff00040005010003ffff00")),7423);
        for(int selector : new int[]{-1,0,1,2,999}) {
            vj.d[4]=selector;
            ja n=npc.b(-1); jb l=loc.c((byte)-84);
            System.out.println(n.G+" "+npc.a(-100)+" "+npc.a((byte)100)+" "+l.k+" "+loc.a((byte)-95));
        }
        npc.J=new int[]{-1,-1}; loc.e=new int[]{-1,-1};
        System.out.println((npc.b(-1)==null)+" "+npc.a(-100)+" "+(loc.c((byte)-84)==null));
        kl stack=rg.a(995,-28322);
        for(int count : new int[]{-1,0,1,2,3,25,100,1000,Integer.MAX_VALUE}) {
            kl selected=stack.a(count,-1);
            System.out.println(selected.I+" "+(selected==stack));
        }
    }

    public static void main(String[] args) throws Exception {
        DataInputStream in=new DataInputStream(new BufferedInputStream(System.in));
        for(int kind=0;kind<3;kind++) {
            Provider provider=new Provider(in);
            al archive=new al(provider,false,false);
            if(kind==0) bj.a(archive,-128,true,null,archive);
            if(kind==1) qj.a(-2,archive,archive);
            if(kind==2) sb.a(archive,(byte)58,archive,true);
            Class<?> cls=kind==0?kl.class:kind==1?ja.class:jb.class;
            Fields raw=new Fields(cls);
            Fields[] loaded={new Fields(cls),new Fields(cls)};
            for(int phase=0;phase<2;phase++) {
                bb.b=ok.z=phase==0;
                fa.b.a(0); gf.Z.a(0); he.w.a(0);
                for(int group:provider.index.d) {
                    int[] ids=archive.b(group,(byte)-120);
                    for(int file:ids) {
                        int id=(group << (kind==1 ? 7 : 8))+file;
                        if(phase==0) raw(kind,id,new gd(archive.a(-809612665,file,group)),raw);
                        Object type=kind==0 ? rg.a(id,-28322) : kind==1 ? uk.a(id,-1428) : ke.a(11525,id);
                        loaded[phase].add(type,0);
                    }
                }
            }
            for(int edge=0,n=in.readInt();edge<n;edge++) raw(kind,-2-edge,new gd(in.readNBytes(in.readInt())),raw);
            raw.print(); loaded[0].print(); loaded[1].print();
        }
        al config=new al(new Provider(in),false,false);
        wa.a(48,config);
        mj.a(0,config);
        Provider enums=new Provider(in);
        h.a(-17017,new al(enums,false,false));
        qj.a((byte)-112,true); id.a(true,0);
        modelChecks(enums.index);
        defaultNames();
        methods();
        int enumShapes=in.readInt();
        for(int i=0;i<enumShapes;i++){
            lg type=new lg();
            type.a(new gd(in.readNBytes(in.readInt())),82);
            t.z.a(83000L+i,0,type);
        }
        t.z.a(83000L+enumShapes,0,new m());
        int scripts=in.readInt();
        for(int i=0;i<scripts;i++) {
            int op=in.readInt(), result=in.readInt();
            String query=in.readBoolean() ? in.readUTF() : null;
            int[] operands=new int[in.readInt()];
            for(int j=0;j<operands.length;j++) operands[j]=in.readInt();
            System.out.println(script(op,result,query,operands));
        }
        for (int length : new int[]{-1, 0, 1, 2, 3, 16, 31}) {
            for (int capacity : new int[]{-1, 0, 1, 2, 8, 16, 31}) {
                id[] names = length < 0 ? null : new id[length];
                for (int i = 0; i < length; i++) if (i % 5 != 0) names[i] = aj.a(Integer.toString(i * 3 % 4), (byte)-100);
                short[] ids = capacity < 0 ? null : new short[capacity];
                for (int i = 0; i < capacity; i++) ids[i] = (short)(32766 + i);
                String outcome = "ok";
                try { qe.a(ids, -4097, names); }
                catch (RuntimeException error) {
                    Throwable cause = error;
                    if (cause instanceof g wrapper) cause = wrapper.a;
                    if (cause instanceof NullPointerException) outcome = "null";
                    else if (cause instanceof ArrayIndexOutOfBoundsException) outcome = "bounds";
                    else throw error;
                }
                System.out.println(outcome + " " + hash(names) + " " + hash(ids));
            }
        }
        lf.a((byte)-91);
        System.out.println(tk.e.length+" "+Arrays.hashCode(tk.e));
        m.C=pk.c;
        for(int i=0,n=in.readInt();i<n;i++) {
            pb player=new pb();
            player.a(new gd(in.readNBytes(in.readInt())),-100);
            System.out.println(player.pc.b(28544));
        }
    }
}
