import java.io.*;
import java.lang.reflect.*;
import java.nio.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.security.*;
import java.util.*;
import javax.media.opengl.GL;

// Run the original HD rd constructor, generated noise tables, display-list setup,
// ARBvp upload, material switches and per-frame parameter updates. The GL context
// is the only substitute. Commands are captured before any injected driver fault.
public class HdProgramOracle {
    static rd material;
    static int programName,listName,errorPosition,failAt;
    static ArrayList<String> trace=new ArrayList<>();
    static final class DriverFault extends Error {}
    static Path sourcePath;
    static String word(float value){return "%08x".formatted(Float.floatToRawIntBits(value));}
    static final Field time=field("a"),noise=field("b"),program=field("c"),list=field("e");
    static Field field(String name){try{Field f=rd.class.getDeclaredField(name);f.setAccessible(true);return f;}catch(Exception e){throw new AssertionError(e);}}
    static Object runCall(Object proxy,Method method,Object[] args)throws Exception {
        String name=method.getName();
        StringJoiner record=new StringJoiner(",","(",")");
        if(args!=null)for(Object v:args) {
            if(v instanceof String src) {
                byte[] bytes=src.getBytes(StandardCharsets.US_ASCII);
                if(sourcePath!=null)Files.write(sourcePath,bytes);
                record.add(Base64.getEncoder().encodeToString(bytes));
            }else if(v instanceof Float f)record.add(word(f));
            else if(v instanceof int[] a)record.add(Arrays.toString(a).replace(" ",""));
            else if(v instanceof float[] a) {
                StringJoiner values=new StringJoiner(".","[","]");
                for(float f:a)values.add(word(f));
                record.add(values.toString());
            }else if(v instanceof FloatBuffer b) {
                StringJoiner values=new StringJoiner(".","[","]");
                for(int i=0;i<4;i++)values.add(word(b.get(b.position()+i)));
                record.add("B"+b.position()+":"+b.limit()+":"+b.isDirect()+":"+b.isReadOnly()+values);
            }else record.add(""+v);
        }
        trace.add(name+record);
        if(failAt==trace.size())throw new DriverFault();
        switch(name) {
            case "glGenProgramsARB" -> ((int[])args[1])[(int)args[2]]=programName;
            case "glGenLists" -> {return listName;}
            case "glGetIntegerv" -> ((int[])args[1])[(int)args[2]]=errorPosition;
            case "glGetFloatv" -> {
                float[] target=(float[])args[1];int i=(int)args[2];
                target[i]=0.375f;target[i+1]=-0.5f;target[i+2]=1.25f;target[i+3]=-0.0f;
            }
        }
        return null;
    }
    static String state()throws Exception {
        if(material==null)return "-";
        FloatBuffer table=(FloatBuffer)noise.get(material);
        String hash="-";
        if(table!=null){
            ByteBuffer data=ByteBuffer.allocate(4*table.limit()).order(ByteOrder.LITTLE_ENDIAN);
            for(int i=0;i<table.limit();i++)data.putInt(Float.floatToRawIntBits(table.get(i)));
            hash=table.position()+":"+HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(data.array()));
        }
        return time.getInt(material)+","+program.getInt(material)+","+list.getInt(material)+","+material.c()+","+hash;
    }
    public static void main(String[] args)throws Exception {
        if(args.length==1)sourcePath=Path.of(args[0]);
        tf.t=GlRecorder.forOracle().gl(HdProgramOracle::runCall);
        lm.f=9401;lm.b=new int[64];for(int i=0;i<64;i++)lm.b[i]=8100+i;
        bb.M=37;qc.cb=-128;sj.D=92;ej.X=512;uj.H=256;
        BufferedReader input=new BufferedReader(new InputStreamReader(System.in));
        for(String line;(line=input.readLine())!=null;){
            String[] v=line.split(" ");
            String op=v[0];int n=Integer.parseInt(v[1]);failAt=Integer.parseInt(v[2]);
            trace.clear();String result="ok";
            try{
                switch(op){
                    case "new" -> {
                        tf.H=(n&1)!=0;lm.e=(n&2)!=0;tf.f=(n&4)!=0;
                        tf.e=Integer.parseInt(v[3]);programName=Integer.parseInt(v[4]);
                        listName=Integer.parseInt(v[5]);errorPosition=Integer.parseInt(v[6]);
                        material=new rd();
                        aa.t=new pc[7];aa.t[2]=material;dl.c=0;mh.eb=-1;je.R=false;tf.g=-1;
                    }
                    case "flags" -> material.a(n);
                    case "bind" -> {tf.g=n;material.b();}
                    case "end" -> material.a();
                    case "fixed" -> {tf.d(n);tf.a(n);}
                    case "route" -> {rm.g=false;cb.b(0,n,Integer.parseInt(v[3]));}
                    default -> throw new AssertionError(op);
                }
            }catch(DriverFault ex){result="fault";}
             catch(IndexOutOfBoundsException ex){result="bounds";}
            System.out.println(result+"|"+state()+"|"+String.join(";",trace));
        }
    }
}
