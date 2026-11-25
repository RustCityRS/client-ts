import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.PrintWriter;
import java.lang.reflect.Field;
import java.util.Arrays;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public final class TextureFilterOpsOracle {
    static final Pattern INDEX = Pattern.compile("Index (-?\\d+) out of bounds for length \\d+");

    static Object field(Object owner, String name) throws Exception {
        Field f = owner.getClass().getDeclaredField(name);
        f.setAccessible(true);
        return f.get(owner);
    }

    static String fault(Throwable error) {
        while (error instanceof g) error = ((g) error).a;
        if (error instanceof NullPointerException) return "null";
        if (error instanceof ArrayIndexOutOfBoundsException) {
            Matcher m = INDEX.matcher(error.getMessage());
            if (m.matches()) return "index" + m.group(1);
        }
        throw new AssertionError(error);
    }

    static bf filter(int id) {
        switch (id) {
            case 6: return new nl();
            case 9: return new bd();
            case 22: return new pf();
            default: throw new AssertionError(id);
        }
    }

    static String decode(int[] v) throws Exception {
        int id = v[1], code = v[2], length = v[3], value = v[4];
        bf op = filter(id);
        byte[] data = length < 0 ? null : Arrays.copyOf(new byte[]{(byte)value, (byte)(value ^ 0xa5)}, length);
        gd p = length == -2 ? null : new gd(data);
        String outcome = "ok";
        try { op.a(p, true, code); } catch (RuntimeException e) { outcome = fault(e); }
        return outcome + "|" + (p == null ? "-" : p.yb) + "|" + op.L + "|" + op.K + "|" + op.z.length + "|" +
            (id == 6 ? field(op,"R") + "," + field(op,"V") : id == 9 ? field(op,"R") + "," + field(op,"Q") : "-");
    }

    static final int[] VALUES = {Integer.MIN_VALUE, -1, 0, 123, 4096, 7000, Integer.MAX_VALUE};
    static final class Child extends bf {
        final int width, damage;
        int[][] dest;
        final StringBuilder calls = new StringBuilder();
        Child(boolean mono, int width, int damage) { super(0, mono); this.width=width; this.damage=damage; }
        int[] channel(int row, int c) {
            if (damage == 16) return dest[c];
            int[] out = new int[width];
            for (int x=0; x<width; x++) out[x] = VALUES[(x+c)%VALUES.length] + row*7;
            return out;
        }
        @Override int[] a(int row, byte guard) {
            calls.append("m").append(row).append(",");
            if (damage == 1) return null;
            int[] r=channel(row,0);
            return damage == 2 ? Arrays.copyOf(r,2) : r;
        }
        @Override int[][] a(boolean guard, int row) {
            calls.append("c").append(row).append(",");
            if (damage == 1) return null;
            if (damage == 3) return new int[0][];
            int[] r=channel(row,0), g=channel(row,1), b=channel(row,2);
            if (damage == 2) r=Arrays.copyOf(r,2);
            if (damage == 4) return new int[][]{r};
            if (damage == 5) g=null;
            if (damage == 6) b=Arrays.copyOf(b,2);
            return new int[][]{r,g,b};
        }
    }

    static void param(bf op, int code, int... bytes) {
        byte[] buffer = new byte[bytes.length];
        for (int i=0;i<bytes.length;i++) buffer[i]=(byte)bytes[i];
        op.a(new gd(buffer),true,code);
    }

    static String contents(Object o) {
        if (o == null) return "_";
        if (o instanceof int[]) return Arrays.toString((int[])o).replace(" ","");
        Object[] slots = (Object[])o;
        String[] text = new String[slots.length];
        for (int i=0;i<slots.length;i++) text[i]=contents(slots[i]);
        return "[" + String.join(",",text) + "]";
    }

    // All probes read the actual wk.v / pi.a backing arrays. Looking up a row through the cache again would change its invalid bit.
    static String render(int[] v) throws Exception {
        int id=v[1], config=v[4], width=v[6], damage=v[11];
        boolean mono=v[2]!=0;
        bf op=filter(id);
        if (id==6 && config!=4) {
            int lo=config==1?6200:700, hi=config==1?10:3200;
            param(op,0,lo>>8,lo); param(op,1,hi>>8,hi);
        } else if (id==9 && config!=4) {
            param(op,0,config&1); param(op,1,config>>1&1);
        }
        param(op,id==22?0:2,mono?1:0);
        op.K=v[5]; op.a((byte)-123,width,3);
        hf.I=v[7]; kl.Eb=v[8]; vi.hb=v[9];
        Child source = new Child(v[3]!=0,width,damage);
        op.z[0] = source;
        Object[] slots=(Object[])field(mono?op.I:op.C,mono?"v":"a");
        for (int i=0;i<slots.length;i++) {
            if (damage==7) {slots[i]=null;continue;}
            if (mono) {
                int[] pixels=(int[])slots[i];
                for(int x=0;x<pixels.length;x++) pixels[x]=-200-x;
                if(damage==8) slots[i]=Arrays.copyOf(pixels,2);
            } else {
                int[][] rgb=(int[][])slots[i];
                for(int c=0;c<3;c++) for(int x=0;x<rgb[c].length;x++) rgb[c][x]=-200-c*30-x;
                if (damage==8) rgb[1]=Arrays.copyOf(rgb[1],2);
                if (damage==9) rgb[2]=null;
                if (damage==10) slots[i]=Arrays.copyOf(rgb,1);
                if (damage==11) rgb[0]=rgb[2];
            }
        }
        if (damage==12) op.z=null;
        if (damage==13) op.z=new bf[0];
        if (damage==14) op.z[0]=null;
        if (damage==15) {op.I=null;op.C=null;}
        if (damage==16) {
            if (mono) source.dest=new int[][]{(int[])slots[0],(int[])slots[0],(int[])slots[0]};
            else source.dest=(int[][])slots[0];
        }
        StringBuilder trace=new StringBuilder();
        for(int row:new int[]{v[10],v[10],v[10]+1,v[10]}) {
            if(trace.length()>0) trace.append(";");
            String result;
            try {
                Object output=mono ? op.a(row,(byte)55) : op.a(true,row);
                result=output==null ? "returned-null" : "slot"+Arrays.asList(slots).indexOf(output);
            } catch(RuntimeException e) { result=fault(e); }
            String invalid=mono ? (op.I==null?"-":String.valueOf(op.I.w)) : (op.C==null?"-":String.valueOf(op.C.w));
            trace.append(result).append("|").append(invalid).append("|").append(source.calls).append("|").append(contents(slots));
        }
        return trace.toString();
    }

    public static void main(String[] args) throws Exception {
        BufferedReader input=new BufferedReader(new InputStreamReader(System.in));
        PrintWriter out=new PrintWriter(System.out);
        String line;
        while ((line=input.readLine())!=null) {
            int[] v=Arrays.stream(line.split(" ")).mapToInt(Integer::parseInt).toArray();
            out.println(v[0]==0?decode(v):render(v));
        }
        out.flush();
    }
}
