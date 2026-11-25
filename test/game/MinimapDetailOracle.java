import java.io.*;
import java.nio.file.*;
import java.util.*;
import java.util.jar.JarFile;
import jdk.internal.org.objectweb.asm.*;

public class MinimapDetailOracle {
    static final int W=512,H=96;
    static final int[] ids={0x7ffffffe,23,31};
    static final ud empty=new ud(){
        db b(int n){return null;} byte[] a(int m,int g){return null;}
        void b(int n,int g){} int c(int g,int n){return 0;}
    };
    static StringJoiner trace;
    static int mode,fail,step;
    static int[] buffer,other;
    static jb wallType;
    static void watch(String tag){trace.add(tag);if(++step==fail)throw new IllegalStateException("watch");}
    static void prepare(String jar,Path dir)throws Exception{
        try(JarFile file=new JarFile(jar)){
            for(String owner:List.of("ig","vi")){
                ClassReader reader=new ClassReader(file.getInputStream(file.getJarEntry(owner+".class")));
                ClassWriter writer=new ClassWriter(ClassWriter.COMPUTE_MAXS);
                reader.accept(new ClassVisitor(Opcodes.ASM8,writer){
                    public MethodVisitor visitMethod(int a,String n,String desc,String sig,String[] ex){
                        MethodVisitor mv=super.visitMethod(a,n,desc,sig,ex);
                        if(!n.equals("a")||!(desc.equals("(IIIIIIII)Z")||desc.equals("(Ljb;IIIIII)Z")))return mv;
                        return new MethodVisitor(Opcodes.ASM8,mv){
                            public void visitMethodInsn(int op,String c,String n,String d,boolean iface){
                                String h=switch(c+"."+n+d){
                                    case "ke.b(III)J"->"wall";case "j.a(III)J"->"scenery";case "dd.a(III)J"->"ground";
                                    case "ke.a(II)Ljb;"->"loc";case "dl.a(II)Lda;"->"msi";case "da.a(IB)Lch;"->"sprite";
                                    case "ch.a(IIII)V"->"scaled";case "ch.a(IIIII)V"->"tinted";default->null;
                                };
                                if(h==null)super.visitMethodInsn(op,c,n,d,iface);else super.visitMethodInsn(Opcodes.INVOKESTATIC,
                                    "MinimapDetailOracle",h,op==Opcodes.INVOKESTATIC?d:"(L"+c+";"+d.substring(1),false);
                            }
                            public void visitInsn(int op){
                                if(op==Opcodes.IASTORE)super.visitMethodInsn(Opcodes.INVOKESTATIC,"MinimapDetailOracle","store","([III)V",false);
                                else super.visitInsn(op);
                            }
                        };
                    }
                },0);
                Files.write(dir.resolve(owner+".class"),writer.toByteArray());
            }
        }
    }
    static long wall(int p,int x,int z){watch("w"+p+","+x+","+z);return ke.b(p,x,z);}
    static long scenery(int p,int x,int z){watch("s"+p+","+x+","+z);return j.a(p,x,z);}
    static long ground(int p,int x,int z){watch("g"+p+","+x+","+z);return dd.a(p,x,z);}
    static jb loc(int guard,int id){watch("l"+id);return ke.a(guard,id);}
    static da msi(int id,int group){watch("m"+id+","+group);return dl.a(id,group);}
    static ch sprite(da m,int angle,byte guard){
        watch("i"+m.l+","+angle);ch s=m.a(angle,guard);
        if(mode==18){wallType.fb=5;wallType.y=3;m.j=true;m.a=0xd972c1;}
        return s;
    }
    static void scaled(ch s,int x,int y,int w,int h){watch("d"+x+","+y+","+w+","+h);s.a(x,y,w,h);}
    static void tinted(ch s,int x,int y,int w,int h,int tint){watch("t"+x+","+y+","+w+","+h+","+tint);s.a(x,y,w,h,tint);}
    static void store(int[] dst,int pos,int v){int old=dst[pos];watch("p"+pos+"="+v);if(mode==17)td.g=other;dst[pos]=v;}
    static String pixels(int[] frame){
        StringJoiner r=new StringJoiner(",");
        for(int i=0;i<frame.length;i++)if(frame[i]!=0)r.add(i+"="+frame[i]);
        return r.toString();
    }
    static String run(int[] r){
        int layers=r[0],shape=r[1],angle=r[2],neg=r[3],icons=r[4],opts=r[5];mode=r[6];fail=r[7];step=0;trace=new StringJoiner(";");
        int x=mode==14?0x40000005:5,z=mode==15?Integer.MIN_VALUE+100:100;
        int offsetX=1-x,offsetZ=1-z,level=mode==21?2:0;
        kl.Bb=new ra[1][3][3];
        ra square=kl.Bb[0][1][1]=new ra(0,1,1);
        he.w=new ve(64);hj.f=new ve(64);mk.A=new ve(64);n.g=null;mj.d=new al(empty,true,true);
        for(int i=0;i<3;i++){
            int id=ids[i],ms=10+i;
            long key=(((long)id)<<32)|0x40000000L|((long)(angle&3)<<20)|((long)(i==1&&layers!=2?9:shape)<<14)|69;
            if((neg&(1<<i))!=0)key|=Long.MIN_VALUE;
            if((layers&(1<<i))!=0){
                if(i==0){square.z=new hk();square.z.f=key;}
                if(i==1){ec s=new ec();s.a=1;s.m=1;s.u=key;square.H[0]=s;square.t=1;}
                if(i==2){square.u=new pk();square.u.e=key;}
            }
            jb l=new jb();if(i==0)wallType=l;l.k=id;l.wb=(icons&(1<<i))!=0?ms:-1;
            l.ub=(opts&1)!=0;l.O=i-1;l.fb=mode==11?0:mode==12?Integer.MIN_VALUE:2+i;l.y=mode==13?0:3+i;
            if(mode!=7||i!=1)he.w.a((long)id,l,(byte)-71);
            da m=new da();m.l=mode==8?-1:40+i;m.j=(opts&2)!=0;m.a=(opts&4)!=0?0xbb72c1:0;
            if(mode!=9)hj.f.a((long)ms,m,(byte)-71);
            for(int a=0;a<4;a++){
                int[] palette={0,0x854fe1+i*7+a,0xc874aa+i*91+a,0x12a1d7+i};
                byte[] px={0,1,2,3,2,1,0,3,1,0,2,1};
                if(mode==10)px=new byte[3];
                if(mode==19)palette=new int[]{0,1};
                ch image=new ch(7+a,6,1,1,4,3,px,palette);
                if(mode!=6||i!=(icons==4?2:icons==2?1:0))mk.A.a((long)(m.l|(a<<16)),image,(byte)-71);
            }
        }
        int pos=24624+5*4+2048*3;
        int len=switch(mode){case 3->pos;case 4->pos+2;case 5->pos+1025;default->W*H;};
        buffer=new int[len];other=new int[len];td.a(mode==1?null:buffer,W,H);
        if(mode==16)td.b(64,60,79,71);
        if(mode==2)kl.Bb=null;
        if(mode==20){square.H[0]=null;square.t=1;}
        String status;
        try{status=""+ig.a(z,offsetX,0x81234567,level,-710,x,offsetZ,0x120b51);}
        catch(RuntimeException ex){
            Throwable t=ex;while(t instanceof g w)t=w.a;
            if(t instanceof NullPointerException)status="null";
            else if(t instanceof ArrayIndexOutOfBoundsException)status="bounds:"+t.getMessage().split(" ")[1];
            else if(t instanceof ArithmeticException)status="division";
            else if(t instanceof IllegalStateException)status="probe";
            else throw ex;
        }
        return status+"|"+trace+"|"+pixels(buffer)+"|"+pixels(other);
    }
    public static void main(String[] args)throws Exception{
        if(args.length==2){prepare(args[0],Path.of(args[1]));return;}
        BufferedReader in=new BufferedReader(new InputStreamReader(System.in));
        for(String s;(s=in.readLine())!=null;)System.out.println(run(Arrays.stream(s.split(" ")).mapToInt(Integer::parseInt).toArray()));
    }
}
