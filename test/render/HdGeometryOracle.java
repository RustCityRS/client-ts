import java.io.*;
import java.lang.reflect.*;
import java.nio.*;
import java.util.*;
import javax.media.opengl.GL;

// Real HD hg vertices, tiles, uploads and draw methods. The recorder represents
// JOGL's context, including the array/element buffer bindings captured at each pointer.
public class HdGeometryOracle {
    static final int ARRAY = 34962, ELEMENT = 34963, TEXTURE0 = 33984;
    static final int driverName = 9173;
    static int array, element, texture;
    static boolean depth;
    static String fault;
    static final List<String> trace = new ArrayList<>();
    static final IdentityHashMap<Buffer,Integer> buffers = new IdentityHashMap<>();
    static final class DriverFault extends Error {}

    static void set(Class<?> type,String name,Object value) throws ReflectiveOperationException {
        Field f=type.getDeclaredField(name);f.setAccessible(true);f.set(null,value);
    }
    static String handle(int id){return id==driverName?"V":String.valueOf(id);}
    static String bytes(ByteBuffer source) {
        ByteBuffer copy=source.duplicate();
        copy.position(0);
        byte[] values=new byte[copy.remaining()];copy.get(values);
        return HexFormat.of().formatHex(values);
    }
    static String pointer(Object input) {
        if(input instanceof Long offset)return "offset:"+offset;
        var b=(ByteBuffer)input;
        int id=buffers.computeIfAbsent(b,k->buffers.size());
        return "buffer:"+id+":"+b.position()+":"+b.limit()+":"+b.capacity()+":"+(b.isDirect()?"direct":"heap");
    }
    static Object call(Object self, Method method, Object[] a){
        String name=method.getName(),out;
        switch(name){
            case "glGenBuffersARB" -> {out="gen "+a[0]+" "+a[2];((int[])a[1])[(int)a[2]]=driverName;}
            case "glBindBufferARB" -> {
                int target=(int)a[0],id=(int)a[1];out="bind "+target+" "+handle(id);
                trace.add(out);if(name.equals(fault))throw new DriverFault();
                if(target==ARRAY)array=id;else if(target==ELEMENT)element=id;else throw new AssertionError(target);
                return null;
            }
            case "glBufferDataARB" -> out="upload "+a[0]+" "+a[1]+" "+a[3]+" "+handle(array)+" "+pointer(a[2])+" "+bytes((ByteBuffer)a[2]);
            case "glClientActiveTexture" -> {
                out="unit "+a[0]; trace.add(out);if(name.equals(fault))throw new DriverFault();texture=(int)a[0];return null;
            }
            case "glVertexPointer","glColorPointer","glNormalPointer","glTexCoordPointer" -> {
                int i=a.length-1;String command=name.substring(2,name.length()-7);
                var fields=new StringJoiner(" ");for(int k=0;k<i;k++)fields.add(String.valueOf(a[k]));
                out=command+" "+fields+" "+handle(array)+" "+texture+" "+pointer(a[i]);
                if(name.equals("glVertexPointer") && a[i] instanceof ByteBuffer b)out+=" "+bytes(b);
            }
            case "glDrawElements" -> out="draw "+a[0]+" "+a[1]+" "+a[2]+" "+handle(element)+" "+depth+" "+pointer(a[3])+" "+bytes((ByteBuffer)a[3]);
            case "glDepthMask" -> {
                out="depth "+a[0];trace.add(out);if(name.equals(fault))throw new DriverFault();depth=(boolean)a[0];return null;
            }
            case "glMatrixMode" -> out="matrix "+a[0];
            case "glLoadMatrixf" -> {
                float[] m=(float[])a[0];int off=(int)a[1];
                StringJoiner values=new StringJoiner(",");for(int i=0;i<16;i++)values.add(Integer.toHexString(Float.floatToRawIntBits(m[off+i])));
                out="load "+off+" "+values;
            }
            default -> throw new AssertionError(method);
        }
        trace.add(out);if(name.equals(fault))throw new DriverFault();return null;
    }

    static void run(String line)throws Exception{
        String[] s=line.split(" ");int[] v=new int[9];for(int i=0;i<v.length;i++)v[i]=Integer.parseInt(s[i]);
        int path=v[0],visible=v[6];boolean big=v[1]!=0,auxiliary=v[2]!=0,normals=v[3]!=0,second=v[4]!=0;
        trace.clear();buffers.clear();fault=s[9];hg.c();
        tf.C=path==2;tf.f=big;od.c=normals;set(wg.class,"b",v[5]!=0);
        set(tf.class,"o",v[7]==0);set(tf.class,"s",-1);set(tf.class,"m",0f);set(tf.class,"j",0f);
        set(tf.class,"c",-1.25f);set(tf.class,"k",-100f);
        float[] projection=new float[16];projection[0]=1.25f;projection[5]=2;projection[11]=-1f;set(tf.class,"x",projection);
        dl.c=0;array=path==0?0:71;element=path==0?0:83;texture=TEXTURE0;depth=true;
        hg batch=new hg(-1,32f,second,auxiliary,0);
        batch.p=5;batch.r=2;batch.b();
        var ids=new StringJoiner(",");
        ids.add(""+batch.a(0,11,0,0.25f,0.5f,-1f,0x10203040,0.75f));
        ids.add(""+batch.a(63,-8,2,1f,0.0f,0.25f,0x718293a4,-0.5f));
        ids.add(""+batch.a(-3,39,67,-0.25f,2f,0.125f,0x55667788,2.25f));
        ids.add(""+batch.a(0,23,64,0f,-1.5f,1f,0xdeadbeef,1.25f));
        // Repeated seam position and colour: same index, lower Y, old normal and auxiliary coordinate.
        ids.add(""+batch.a(0,-7,0,9f,9f,9f,0x10203040,9f));
        ids.add(""+batch.a(0,0,0,new int[]{0,1,2,3},new int[]{1,3,0},false));
        ids.add(""+batch.a(0,1,0,new int[]{0,2,1},null,true));
        bj[][][] tiles=new bj[1][2][1];
        tiles[0][0][0]=new bj(0,0,0);tiles[0][0][0].x=(visible&1)!=0;
        if((visible&4)==0){tiles[0][1][0]=new bj(0,1,0);tiles[0][1][0].x=(visible&2)!=0;}
        String status="ok";try{
            batch.d();
            tf.C=path!=0;
            for(int i=0;i<v[8];i++)batch.a(tiles,8f,true);
        }catch(DriverFault e){status="fault";}
        System.out.println(status+"|"+ids+"|"+batch.q+"|"+handle(array)+","+handle(element)+","+texture+","+depth+"|"+String.join(";",trace));
    }
    public static void main(String[] args)throws Exception{
        tf.t=GlRecorder.forOracle().gl(HdGeometryOracle::call);
        var in=new BufferedReader(new InputStreamReader(System.in));for(String s;(s=in.readLine())!=null;)run(s);
    }
}
