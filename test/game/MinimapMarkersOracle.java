import java.io.*;
import java.nio.file.*;
import java.util.*;
import java.util.jar.*;
import jdk.internal.org.objectweb.asm.*;

public class MinimapMarkersOracle {
    static final int W=96,H=88;
    static final int[] sin=dc.l,cos=dc.g;
    static int mode,zoomReads,widthReads,heightReads;
    static StringJoiner trace;
    static void instrument(String jar,Path dir) throws Exception {
        try(JarFile file=new JarFile(jar)){
            for(String owner:new String[]{"wa","hd"}){
                ClassReader reader=new ClassReader(file.getInputStream(file.getJarEntry(owner+".class")));
                ClassWriter writer=new ClassWriter(0);
                reader.accept(new ClassVisitor(Opcodes.ASM8,writer){
                    public MethodVisitor visitMethod(int access,String name,String desc,String sig,String[] ex){
                        MethodVisitor mv=super.visitMethod(access,name,desc,sig,ex);
                        if(!name.equals("a")||!(desc.equals("(Laj;ILvc;ZIII)V")||desc.equals("(Laj;IIIIII)V")))return mv;
                        return new MethodVisitor(Opcodes.ASM8,mv){
                            public void visitFieldInsn(int opcode,String className,String name,String desc){
                                String hook=switch(className+"."+name){
                                    case "aj.C"->"width";case "aj.H"->"height";case "kk.db"->"zoom";
                                    case "df.B"->"yaw";case "ag.e"->"angle";case "dc.l"->"sines";case "dc.g"->"cosines";
                                    case "aj.s"->"starts";case "aj.ud"->"widths";default->null;};
                                if(hook==null)super.visitFieldInsn(opcode,className,name,desc);
                                else super.visitMethodInsn(Opcodes.INVOKESTATIC,"MinimapMarkersOracle",hook,
                                    opcode==Opcodes.GETSTATIC?"()"+desc:"(L"+className+";)"+desc,false);
                            }
                            public void visitMethodInsn(int opcode,String className,String name,String desc,boolean iface){
                                if(className.equals("rh")&&name.equals("a")&&(desc.equals("(IIIIIIDI)V")||desc.equals("(II[I[I)V")))
                                    super.visitMethodInsn(Opcodes.INVOKESTATIC,"MinimapMarkersOracle",desc.contains("D")?"rotate":"masked","(Lrh;"+desc.substring(1),false);
                                else super.visitMethodInsn(opcode,className,name,desc,iface);
                            }
                        };
                    }
                },0);
                Files.write(dir.resolve(owner+".class"),writer.toByteArray());
            }
        }
    }
    static int width(aj c){int value=c.C;trace.add("w"+value);if(mode==21&&++widthReads==1)c.C+=18;return value;}
    static int height(aj c){int value=c.H;trace.add("h"+value);if(mode==21&&++heightReads==1)c.H-=10;return value;}
    static int zoom(){int value=kk.db;trace.add("z"+value);if(mode==22&&++zoomReads==1)kk.db=-255;return value;}
    static int yaw(){trace.add("y");return df.B;}
    static int angle(){trace.add("a");return ag.e;}
    static int[] sines(){trace.add("s");return dc.l;}
    static int[] cosines(){trace.add("c");return dc.g;}
    static int[] starts(aj c){trace.add("x");return c.s;}
    static int[] widths(aj c){trace.add("n");return c.ud;}
    static void masked(rh s,int x,int y,int[] starts,int[] widths){
        Objects.requireNonNull(s);trace.add("m"+x+","+y);
        s.a(x,y,starts,widths);
    }
    static void rotate(rh s,int x,int y,int w,int h,int ax,int ay,double angle,int zoom){
        Objects.requireNonNull(s);
        trace.add("r"+x+","+y+","+w+","+h+","+ax+","+ay+","+(int)(angle*1e8)+","+zoom);
        s.a(x,y,w,h,ax,ay,angle,zoom);
    }
    static class Other extends vc {
        void a(int a,int b,int c){} void a(int a,int b,int c,int d,int e,int f){} void a(int a,int b){}
        void a(int a,int b,int c,int d){} void b(int a,int b){} void c(int a,int b){} void a(int a,int b,int c,int d,int e){}
    }
    static String run(int[] v){
        int op=v[0];mode=v[1];int dx=v[2],dz=v[3],x=v[8],y=v[9];int id=v[10];
        trace=new StringJoiner(";");zoomReads=widthReads=heightReads=0;
        aj c=new aj();c.C=v[4];c.H=v[5];df.B=v[6];ag.e=-67;kk.db=v[7];dc.l=sin;dc.g=cos;
        int[] frame=new int[mode==18?W*H/2:W*H];
        for(int i=0;i<frame.length;i++)frame[i]=37*i^0xAAC9;
        td.a(frame,W,H);td.b(3,7,91,80);
        c.s=new int[73];c.ud=new int[73];
        for(int i=0;i<73;i++){c.s[i]=(i%6)+3;c.ud[i]=81-(i%16);}
        rh dot=new rh(13,15,2,3,7,8,new int[56]),edge=new rh(30,30);
        for(int i=0;i<dot.I.length;i++)dot.I[i]=i%3==0?0:12471*i;
        for(int i=0;i<edge.I.length;i++)edge.I[i]=i%6==0?0:(i*1237^0xB731);
        vc sprite=dot;
        cf.e=new vc[]{null,dot};gf.cb=new vc[]{null,edge};
        switch(mode){
            case 1->c=null;
            case 2-> {sprite=null;c=null;cf.e[1]=null;}
            case 3-> {sprite=new Other();cf.e[1]=sprite;gf.cb[1]=sprite;}
            case 4->gf.cb=null;
            case 5->cf.e=null;
            case 6->dc.l=null;
            case 7->dc.g=null;
            case 8->dc.l=new int[0];
            case 9->dc.g=new int[0];
            case 10->c.s=null;
            case 11->c.ud=null;
            case 12->c.s=new int[72];
            case 13->c.ud=new int[30];
            case 14-> {Arrays.fill(c.s,9);Arrays.fill(c.ud,-5);}
            case 15-> {td.a(null,W,H);td.b(3,7,91,80);}
            case 16-> {dot.I=new int[20];edge.I=new int[35];}
            case 17-> {dot.D=Integer.MIN_VALUE;dot.O=Integer.MAX_VALUE;}
            case 19-> {int pos=(df.B+ag.e)&2047;dc.l=new int[2048];dc.g=new int[2048];dc.l[pos]=0x7fffffff;dc.g[pos]=-0x400001;}
            case 20-> {cf.e=new vc[0];gf.cb=new vc[0];}
        }
        String status="ok";
        try{
            if(op==0)hd.a(c,dx,dz,y,x,id,20);
            else wa.a(c,x,sprite,op==1,dx,y,dz);
        }catch(RuntimeException e){
            Throwable cause=e;while(cause instanceof g wrapped)cause=wrapped.a;
            if(cause instanceof NullPointerException)status="null";
            else if(cause instanceof IndexOutOfBoundsException)status="bounds:"+cause.getMessage().split(" ")[1];
            else if(cause instanceof ClassCastException)status="cast";
            else if(cause instanceof ArithmeticException)status="division";
            else if(cause instanceof IllegalStateException)status="state";
            else throw e;
        }
        return status+"|"+trace+"|"+Arrays.hashCode(frame);
    }
    public static void main(String[] args)throws Exception {
        if(args.length==2){instrument(args[0],Path.of(args[1]));return;}
        BufferedReader reader=new BufferedReader(new InputStreamReader(System.in));
        for(String s;(s=reader.readLine())!=null;)System.out.println(run(Arrays.stream(s.split(" ")).mapToInt(Integer::parseInt).toArray()));
    }
}
