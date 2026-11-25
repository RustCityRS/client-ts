import java.io.*;
import java.lang.reflect.*;
import java.nio.*;
import java.security.MessageDigest;
import java.util.*;

public final class TextureShapeOpsOracle {
    static final Class<?>[] shapeTypes={na.class,il.class,gg.class,v.class};
    static final String[][] coordinateFields={{"C","H","A","E"},{"F","D","C","E","z","G","y","N"},{"z","x","D","J"},{"J","y","H","C"}};
    static final Field shapes=field(gj.class,"cb");
    static final Method draw;
    static {try{draw=gj.class.getDeclaredMethod("a",int[][].class,int.class);draw.setAccessible(true);}catch(Exception e){throw new AssertionError(e);}}
    static Field field(Class<?> cls,String name){
        try{Field f=cls.getDeclaredField(name);f.setAccessible(true);return f;}catch(Exception e){throw new AssertionError(e);}
    }
    static final class RecordingShape extends u{
        final Case context;final int id;
        RecordingShape(Case ctx,int id,int fill,int outline){super(fill,outline,2);this.context=ctx;this.id=id;}
        void record(String mode,int a,int b){
            context.log.add(id+mode+a+","+b);
            if(id!=1)return;
            try{
                changeDimensions();
                if(context.replace==1)shapes.set(context.op,new u[]{this,new RecordingShape(context,4,1,-1),new RecordingShape(context,5,-1,1)});
                if(context.replace==2)shapes.set(context.op,null);
                if(context.replace==3)((u[])shapes.get(context.op))[1]=null;
                if(context.replace==4){we.z=context.other;wa.j=31;sf.d=-8;}
            }catch(IllegalAccessException e){throw new AssertionError(e);}
        }
        @Override void a(byte guard,int a,int b){record("f",a,b);}
        @Override void b(byte guard,int a,int b){record("o",a,b);}
        @Override void a(int a,int b,byte guard){record("b",a,b);}
    }
    static void changeDimensions(){hf.I+=11;g.k-=1;}
    static final class Case {
        final gj op=new gj();
        final int width,height;
        final int[][] other;
        final List<String> log=new ArrayList<>();
        final IdentityHashMap<Object,Integer> identities=new IdentityHashMap<>();
        final MessageDigest digest=MessageDigest.getInstance("SHA-256");
        int replace;
        gd packet;
        Object last;
        Case(int w,int h)throws Exception{
            width=w;height=h;other=new int[h][w];hf.I=g.k=-1;vk.a(119,w,h);
            we.z=null;vg.Y=null;wa.j=5;gg.I=6;ia.m=7;sf.d=8;
        }
        void pixels(Object value,MessageDigest d){
            if(value==null){d.update((byte)0);return;}
            if(value instanceof int[] row){
                d.update((byte)1);
                ByteBuffer b=ByteBuffer.allocate(4+row.length*4);b.putInt(row.length);
                for(int v:row)b.putInt(v);
                d.update(b.array());return;
            }
            Object[] a=(Object[])value;
            d.update((byte)2);d.update(ByteBuffer.allocate(4).putInt(a.length).array());
            for(Object v:a)pixels(v,d);
        }
        String image(Object obj){
            if(obj==null)return "-";
            int id=identities.computeIfAbsent(obj,k->identities.size()+1);
            pixels(obj,digest);return id+"/"+HexFormat.of().formatHex(digest.digest());
        }
        String shapeState()throws Exception{
            u[] a=(u[])shapes.get(op);
            if(a==null)return "-";
            StringJoiner s=new StringJoiner("/","[","]");
            for(u shape:a){
                if(shape==null){s.add("_");continue;}
                if(shape instanceof RecordingShape p){s.add("p"+p.id);continue;}
                int k=Arrays.asList(shapeTypes).indexOf(shape.getClass());
                StringJoiner t=new StringJoiner(","); t.add(""+k);
                for(String f:coordinateFields[k])t.add(""+field(shapeTypes[k],f).getInt(shape));
                t.add(""+shape.o).add(""+shape.h).add(""+shape.l);s.add(t.toString());
            }
            return s.toString();
        }
        Object[] slots()throws Exception{
            return op.L?(op.I==null?null:(int[][])field(wk.class,"v").get(op.I)):(op.C==null?null:(int[][][])field(pi.class,"a").get(op.C));
        }
        String state()throws Exception{
            Object[] a=slots();
            return String.join("|",packet==null?"-":""+packet.yb,shapeState(),""+op.L,
                op.L?(op.I==null?"-":""+op.I.w):(op.C==null?"-":""+op.C.w), image(a),image(we.z), image(last),
                a==null?"-":""+Arrays.asList(a).indexOf(last),image(vg.Y),
                wa.j+","+gg.I+","+ia.m+","+sf.d,String.join("/",log));
        }
        u construct(int[] args)throws Exception{
            int kind=args[0],n=args.length-1;
            Class<?>[] params=new Class<?>[n];Arrays.fill(params,int.class);
            Object[] values=new Object[n];for(int i=0;i<n;i++)values[i]=args[i+1];
            Constructor<?> c=shapeTypes[kind].getDeclaredConstructor(params);c.setAccessible(true);return (u)c.newInstance(values);
        }
        String run(String cmd)throws Exception{
            String result="ok";
            try{
                String rest=cmd.substring(1);
                switch(cmd.charAt(0)){
                    case 'd' -> {
                        String[] v=rest.split(":");packet=v[1].equals("none")?null:new gd(v[1].equals("null")?null:v[1].equals("-")?new byte[0]:HexFormat.of().parseHex(v[1]));
                        op.a(packet,true,Integer.parseInt(v[0]));
                    }
                    case 'n' -> {
                        int[] v=Arrays.stream(rest.split(",")).mapToInt(Integer::parseInt).toArray();
                        u[] a=(u[])shapes.get(op);
                        a=a==null?new u[1]:Arrays.copyOf(a,a.length+1);a[a.length-1]=construct(v);shapes.set(op,a);
                    }
                    case 'i' -> {op.K=Integer.parseInt(rest);op.a((byte)-120,width,height);}
                    case 'g' -> {int r=Integer.parseInt(rest);last=op.L?op.a(r,(byte)55):op.a(true,r);}
                    case 'r' -> draw.invoke(op,other,Integer.parseInt(rest));
                    case 'u' -> {
                        int[] v=Arrays.stream(rest.split(",")).mapToInt(Integer::parseInt).toArray();u shape=((u[])shapes.get(op))[v[0]];
                        if(v[1]==0)shape.a((byte)-36,width,height);else if(v[1]==1)shape.b((byte)-41,width,height);else shape.a(height,width,(byte)-67);
                    }
                    case 'p' -> {replace=Integer.parseInt(rest);shapes.set(op,new u[]{new RecordingShape(this,1,1,1),new RecordingShape(this,2,1,-1),new RecordingShape(this,3,-1,-1)});}
                    case 'b' -> {
                        int[] v=Arrays.stream(rest.split(",")).mapToInt(Integer::parseInt).toArray();
                        int r=v[0],length=v[2];
                        int[] row=length<0?null:new int[length];
                        if(op.L)((int[][])slots())[r]=row;
                        else ((int[][][])slots())[r][v[1]]=row;
                    }
                    case 'm' -> {int[] v=Arrays.stream(rest.split(",")).mapToInt(Integer::parseInt).toArray();kl.Eb=v[0];vi.hb=v[1];}
                    default -> throw new AssertionError(cmd);
                }
            }catch(Exception e){
                Throwable t=e;
                if(t instanceof InvocationTargetException) t=t.getCause();
                while(t instanceof g wrap)t=wrap.a;
                if(t instanceof NullPointerException)result="null";
                else if(t instanceof IndexOutOfBoundsException)result="bounds"+t.getMessage().split(" ")[1];
                else if(t instanceof ArithmeticException)result="arith";
                else if(t instanceof RuntimeException&&t.getMessage()!=null&&t.getMessage().contains("full image cache"))result="partial-cache";
                else throw e;
            }
            return result+":"+state();
        }
    }
    public static void main(String[] args)throws Exception{
        BufferedReader in=new BufferedReader(new InputStreamReader(System.in));
        for(String line;(line=in.readLine())!=null;){
            String[] v=line.split(" ");Case c=new Case(Integer.parseInt(v[0]),Integer.parseInt(v[1]));
            StringJoiner t=new StringJoiner(";");t.add(c.state());for(int i=2;i<v.length;i++)t.add(c.run(v[i]));System.out.println(t);
        }
    }
}
