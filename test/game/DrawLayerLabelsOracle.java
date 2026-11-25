import java.lang.reflect.Field;
import java.util.*;

// Read the original clinit publications first, then take the same snapshots after ii.a,
// the actual label splitter used by ik.a, and pf.a's map reset.
class DrawLayerLabelsOracle {
    static final IdentityHashMap<id,Integer> references = new IdentityHashMap<>();
    static {
        try { Class.forName(System.getProperty("firstClass", "client")); }
        catch (ClassNotFoundException e) { throw new ExceptionInInitializerError(e); }
    }
    static final id[] initialLines = sa.A;
    static String describe(id value) {
        if (value == null) return "-";
        return references.computeIfAbsent(value,k -> references.size()) + ":" + HexFormat.of().formatHex(value.b(false));
    }
    static void snapshot(String status) throws Exception {
        Field loading = ie.class.getDeclaredField("u"); loading.setAccessible(true);
        StringJoiner out = new StringJoiner("|");
        out.add(status).add(""+cl.w).add(""+rc.g).add(""+(sa.A==initialLines));
        for (id value : new id[]{ak.g,fa.a,gd.bb,rf.u,vc.Q,d.f,u.f,we.t,mf.o,tg.s,f.j,(id)loading.get(null),ie.A}) out.add(describe(value));
        for (id value : sa.A) out.add(describe(value));
        System.out.println(out);
    }
    static void initialLiterals() throws Exception {
        Field mutable = id.class.getDeclaredField("E"); mutable.setAccessible(true);
        String[][] sources = {
            {"we","t","k"}, {"we","x","Schlie-8en"}, {"jf","c","Loaded textures"},
            {"jf","f","Shift)2click disabled)3"}, {"jf","h","Loaded config"}, {"jf","d","Started 3d Library"},
            {"nc","k","Discard"}, {"nc","a","Loading config )2 "}, {"nc","r","(U4"},
            {"gk","f","<col=40ff00>"}, {"gk","a","::pcachesize"}, {"gk","l","Spieler kann nicht gefunden werden: "},
            {"mf","o","k"}
        };
        for (String[] source : sources) {
            Field field = Class.forName(source[0]).getDeclaredField(source[1]); field.setAccessible(true);
            id held = (id)field.get(null), lookup = vb.a(source[2], (byte)82);
            System.out.println(source[0]+"."+source[1]+"|"+describe(held)+"|"+describe(lookup)+"|"+
                (vb.a(source[2], (byte)82)==lookup)+"|"+mutable.getBoolean(held)+"|"+mutable.getBoolean(lookup));
        }
    }
    public static void main(String[] args) throws Exception {
        snapshot("init");
        for(int lang : new int[]{1,0,2,1,2,0}) { ii.a((byte)127,lang); snapshot("lang"+lang); }
        fg font = new fg(new byte[257]);
        cl.w = -791; rc.g = 1028; ie.A = vb.a("loading", (byte)82);
        for (String text : new String[]{"North<br>Bank","A<br>B<br>C<br>D<br>E","One","1<br>2<br>3<br>4<br>5<br>6",""}) {
            String result;
            try { result = "count"+font.a(vb.a(text,(byte)93),null,sa.A); }
            catch(ArrayIndexOutOfBoundsException e) { result = "bounds"; }
            snapshot(result);
            pf.a(false,(byte)-106);
            snapshot("reset");
        }
        initialLiterals();
    }
}
