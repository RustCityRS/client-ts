import java.io.*;
import java.util.*;
import java.util.regex.*;
import java.lang.reflect.Field;

public final class TextureSamplingOpsOracle {
    static int width, damage, signal, calls, trace;
    static final int[] BOUNDARY = {Integer.MIN_VALUE, Integer.MAX_VALUE, 0, -1, 4095, 4096, 8192};
    static final Pattern INDEX = Pattern.compile("Index (-?\\d+) out of bounds for length \\d+");
    static String error(Throwable t) {
        while (t instanceof g) t=((g)t).a;
        if (t instanceof NullPointerException) return "null";
        if (t instanceof ArithmeticException) return "divide";
        if (t instanceof NegativeArraySizeException) return "negative";
        if (t instanceof IllegalStateException) return t.getMessage();
        if (t instanceof ArrayIndexOutOfBoundsException) {
            Matcher index=INDEX.matcher(t.getMessage());
            if (index.matches()) return "index"+index.group(1);
        }
        throw new AssertionError(t);
    }
    static Object field(Object o,String name) throws Exception {
        Field f=o.getClass().getDeclaredField(name); f.setAccessible(true); return f.get(o);
    }
    static bf filter(int id) {
        switch(id) {
            case 5:return new wh(); case 19:return new sd(); case 20:return new ki();
            case 23:return new ti(); case 33:return new vf(); default:throw new AssertionError(id);
        }
    }
    static String decode(int[] v) throws Exception {
        int id=v[1], size=v[3], value=v[4];
        bf op=filter(id);
        gd p=size==-2?null:new gd(size==-1?null:Arrays.copyOf(new byte[]{(byte)value,(byte)(value^0xa5)},size));
        String status="ok";
        try { op.a(p,true,v[2]); } catch(RuntimeException e){ status=error(e); }
        String own;
        switch(id) {
            case 5: own=field(op,"V")+","+field(op,"N");break;
            case 19:own=String.valueOf(field(op,"Q"));break;
            case 20:own=field(op,"Q")+","+field(op,"Z");break;
            case 33:own=field(op,"Q")+","+field(op,"N");break;
            default:own="-";
        }
        return status+"|"+(p==null?"-":p.yb)+"|"+op.L+"|"+op.z.length+"|"+own;
    }
    static int value(int row,int ch,int x,int slot) {
        int raw=row*193 + ch*691 + x*1049 + slot*3709;
        switch(signal) {
            case 0: return raw & 4095;
            case 1: return Integer.rotateLeft(raw*0x45678d,x&7);
            case 2: return BOUNDARY[(x+ch+slot)%BOUNDARY.length]+row*7;
            default:return slot==1 ? (x+row)*16 : slot==2 ? 4101-x*47 : raw;
        }
    }
    static final class Child extends bf {
        final int slot;
        final int[][] held=new int[3][width];
        Child(int slot, boolean mono) { super(0,mono);this.slot=slot; }
        void call(boolean mono,int row) {
            calls++;trace=31*(31*trace+slot*2+(mono?0:1))+row;
            if(damage==15 && slot==0){kk.cb=(kk.cb+1)&kl.Eb;ik.ab=(ik.ab+2)&vi.hb;}
        }
        int[] channel(int row,int ch) {
            int len=damage==5 && slot==0?Math.min(width,2):width;
            int[] values=damage==16?held[ch]:new int[len];
            for(int x=0;x<values.length;x++)values[x]=value(row,ch,x,slot);
            return values;
        }
        @Override int[] a(int row,byte guard){
            call(true,row);
            return (damage==6&&slot==0)||(damage==9&&calls==4)? null:channel(row,0);
        }
        @Override int[][] a(boolean guard,int row) {
            call(false,row);
            if(damage==9&&calls==4)return null;
            return new int[][]{channel(row,0),damage==6&&slot==0?null:channel(row,1),channel(row,2)};
        }
    }
    static void param(bf op,int code,int... bytes) {
        byte[] b=new byte[bytes.length];
        for(int i=0;i<b.length;i++)b[i]=(byte)bytes[i];
        op.a(new gd(b),true,code);
    }
    static void configure(bf op,int id,int config) {
        if(config==0)return;
        if(id==5||id==20){
            int[] h={0,0,2,1,255,3},v={0,0,1,3,2,0};
            param(op,0,h[config]);param(op,1,v[config]);
        }else if(id==19||id==33){
            int[] values={0,0,1,257,4096,65535};
            int x=values[config];param(op,0,x>>8,x);
            if(id==33)param(op,1,config&1);
        }
    }
    static String pixels(Object o){
        if(o==null)return "_";
        if(o instanceof int[])return Arrays.toString((int[])o).replace(" ","");
        Object[] a=(Object[])o;String[] parts=new String[a.length];
        for(int i=0;i<a.length;i++)parts[i]=pixels(a[i]);
        return "["+String.join(",",parts)+"]";
    }
    static String render(int[] v) throws Exception {
        int id=v[1], height=v[6], row=v[7];
        boolean mono=v[2]!=0, childMono=v[3]!=0;
        width=v[5];damage=v[8];signal=v[9];calls=0;trace=1;
        bf op=filter(id);configure(op,id,v[4]);op.L=mono;
        h.e=null;c.t=null;op.b(-122);
        hf.I=width;g.k=height;kl.Eb=width-1;vi.hb=height-1;
        vg.U=new int[width];cf.h=new int[height];
        for(int x=0;x<width;x++)vg.U[x]=(x<<12)/width;
        for(int y=0;y<height;y++)cf.h[y]=(y<<12)/height;
        kk.cb=9;ik.ab=11;
        op.K=1;op.a((byte)-123,width,height);
        for(int i=0;i<op.z.length;i++)op.z[i]=new Child(i,childMono);
        Object[] slots=(Object[])field(mono?op.I:op.C,mono?"v":"a");
        if(damage==1)vg.U=null;
        if(damage==2)cf.h=Arrays.copyOf(cf.h,1);
        if(damage==3)c.t=null;
        if(damage==4)h.e=new int[]{1,-9};
        if(damage==7)op.z[0]=null;
        if(damage==8)op.z=new bf[0];
        if(damage==10)slots[0]=null;
        if(damage==11)kl.Eb=-2;
        if(damage==12)hf.I=-1;
        if(damage==13)hf.I+=2;
        if(damage==14){if(mono)slots[0]=new int[2];else ((int[][])slots[0])[1]=new int[2];}
        if(damage==17){Arrays.fill(vg.U,2048);Arrays.fill(cf.h,Integer.MIN_VALUE);}
        StringBuilder result=new StringBuilder();
        for(int y:new int[]{row,row,row+1}){
            if(result.length()>0)result.append(";");
            String status="ok";
            try{
                Object output=mono?op.a(y,(byte)55):op.a(true,y);
                status=output==null?"returned-null":output==slots[0]?"slot":"other";
            }catch(RuntimeException e){status=error(e);}
            result.append(status+"|"+(mono?op.I.w:op.C.w)+"|"+calls+","+trace+"|"+kk.cb+","+ik.ab+"|"+pixels(slots[0]));
        }
        return result.toString();
    }
    public static void main(String[] args)throws Exception{
        BufferedReader input=new BufferedReader(new InputStreamReader(System.in));
        PrintWriter output=new PrintWriter(System.out);
        String line;
        while((line=input.readLine())!=null){
            int[] v=Arrays.stream(line.split(" ")).mapToInt(Integer::parseInt).toArray();
            output.println(v[0]==0?decode(v):render(v));
        }
        output.flush();
    }
}
