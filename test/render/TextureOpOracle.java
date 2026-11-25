import java.util.Arrays;
import java.util.IdentityHashMap;
import java.util.Random;

class TextureOpOracle {
    static class Plain extends bf {
        Plain(int inputs, boolean mono) { super(inputs, mono); }
    }
    static class Source extends bf {
        int[] mono;
        int[][] rgb;
        int row;
        Source(boolean single, int shape) {
            super(0, single);
            mono = shape == 1 ? null : new int[]{301, 302};
            rgb = shape == 1 ? null : shape == 2 ? new int[0][] : new int[][]{mono, null, mono};
        }
        int[] a(int y, byte dummy) { row = y; return mono; }
        int[][] a(boolean dummy, int y) { row = y; return rgb; }
    }
    interface Op { Object run(); }
    static String attempt(Op op) {
        try { return String.valueOf(op.run()); }
        catch (RuntimeException ex) {
            Throwable t = ex;
            while (t instanceof g) t = ((g)t).a;
            if (t instanceof NullPointerException) return "null-ref";
            if (t instanceof ArrayIndexOutOfBoundsException) return "bounds";
            if (t instanceof IllegalStateException) return t.getMessage();
            if (t instanceof NegativeArraySizeException) return "size";
            if (t instanceof ClassCastException) return "cast";
            if (t instanceof IllegalArgumentException) return "argument";
            throw ex;
        }
    }
    static final IdentityHashMap<Object,Integer> refs = new IdentityHashMap<>();
    static int id(Object x) { return x == null ? 0 : refs.computeIfAbsent(x,k -> refs.size()+1); }
    static void graph() {
        bf p = new Plain(2, false);
        p.a(null,true,2147483647);
        p.b(58);
        System.out.println(p.z.length+" "+p.K+" "+p.L+" "+p.a(-1)+" "+p.c((byte)-116)+" "+
            attempt(()->p.a(7,(byte)55))+" "+attempt(()->p.a(true,7)));
        for (boolean mono : new boolean[]{false,true}) for (int shape=0; shape<5; shape++) {
            Source s = new Source(mono,shape);
            refs.clear();
            id(s.mono); id(s.rgb);
            p.z = shape == 4 ? null : new bf[]{shape == 3 ? null : s, null};
            for (int child : new int[]{-1,0,1,2,Integer.MIN_VALUE,0}) for (int y : new int[]{-131,0,123}) {
                String rgb = attempt(()-> {
                    int[][] pixels = p.a(y,false,child);
                    String r = ""+id(pixels);
                    if (pixels != null) for (int[] chan : pixels) r+=","+id(chan);
                    return r;
                });
                String single = attempt(()->id(p.a(child,y,false)));
                System.out.println(rgb+" "+single+" "+s.row);
            }
        }
        for (int capacity : new int[]{-1,0,1,2,255}) for (int height : new int[]{-1,0,1,3}) {
            for (int width : new int[]{-2,0,1,4}) {
                refs.clear();
                bf node = new Plain(0,true);
                for (boolean mono : new boolean[]{true,false,true,false}) {
                    node.L=mono;
                    node.K=capacity;
                    String init=attempt(()->{node.a((byte)-120,width,height);return "ok";});
                    int incoming=id(node.C), other=id(node.I);
                    for (int row : new int[]{0,1,0,2,1}) {
                        String got=attempt(()->id(mono ? node.I.a(row,true) : node.C.a(row,80)));
                        System.out.println(init+" "+incoming+" "+other+" "+got);
                    }
                    if (!mono) {
                        for (int i=0;i<2;i++) {
                            String cleared=attempt(()->{node.d((byte)-120);return "ok";});
                            System.out.println(cleared+" "+id(node.C)+" "+id(node.I));
                        }
                    }
                }
            }
        }
    }
    static void coordinates() {
        refs.clear();
        for (int width : new int[]{0,1,3,5,64,128,0,7,-1,65,524289}) {
            for (int height : new int[]{0,3,3,width,-1,1,64,5}) {
                String result=attempt(()->{vk.a(119,width,height);return "ok";});
                System.out.println(result+" "+hf.I+" "+g.k+" "+kl.Eb+" "+vi.hb+" "+j.b+" "+
                    id(vg.U)+" "+id(cf.h)+" "+Arrays.hashCode(vg.U)+" "+Arrays.hashCode(cf.h));
            }
        }
        for (int mask : new int[]{0,3,1,3,2,3,0,3}) {
            if ((mask&1)==0) h.e=null;
            if ((mask&2)==0) c.t=null;
            gf.e(-100);
            System.out.println(id(h.e)+" "+id(c.t)+" "+Arrays.toString(h.e)+" "+Arrays.toString(c.t));
            h.e[0]=3; c.t[0]=5;
        }
    }
    static void randomTables() {
        refs.clear();
        for (int seed : new int[]{0,1,-1,12589,Integer.MIN_VALUE,Integer.MAX_VALUE}) {
            Random r=new Random(seed);
            for(int bound : new int[]{-1,0,1,2,3,15,16,17,127,128,129,255,256,257,67108864,1073741825,2147483647}) {
                for(int i=0;i<12;i++) System.out.println(attempt(()->vk.a(123,r,bound)));
                System.out.println(attempt(()->vk.a(123,(Random)null,bound)));
            }
        }
        vb.e=new vj(16);
        for (int i=0;i<122;i++) {
            int seed = i<62 ? i%19-9 : new int[]{-1,0,1,2147483647,-2147483648,3,0}[i%7];
            byte[] p=wf.a(seed,(byte)100);
            System.out.println(id(p)+" "+Arrays.toString(p));
            p[0]=(byte)i;
        }
        vb.e.a(-4L,0,new ei());
        System.out.println(attempt(()->wf.a(-4,(byte)100)));
        vb.e.a(-9L,0,new ga(null));
        System.out.println(attempt(()->id(wf.a(-9,(byte)100))));
        vb.e=null;
        System.out.println(attempt(()->wf.a(7,(byte)100)));
    }
    public static void main(String[] args) { graph(); coordinates(); randomTables(); }
}
