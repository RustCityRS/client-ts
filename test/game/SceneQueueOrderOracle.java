import java.io.*;
import java.nio.file.*;
import java.util.*;
import java.util.jar.JarFile;
import java.lang.reflect.Field;
import jdk.internal.org.objectweb.asm.*;

// Only archive/scene calls and explicit watchpoints are redirected. The four
// methods, all casts, and gk's traversal, link rewrites and cursor are original.
public class SceneQueueOrderOracle {
    static void prepare(String source,Path dir)throws Exception{
        try(JarFile jar=new JarFile(source)){
            for(String owner:List.of("b","od","l","ng")){
                ClassReader reader=new ClassReader(jar.getInputStream(jar.getJarEntry(owner+".class")));
                ClassWriter writer=new ClassWriter(ClassWriter.COMPUTE_MAXS);
                reader.accept(new ClassVisitor(Opcodes.ASM8,writer){
                    public MethodVisitor visitMethod(int access,String name,String desc,String sig,String[] ex){
                        MethodVisitor mv=super.visitMethod(access,name,desc,sig,ex);
                        if(!Set.of("b.a(IZIIIIIIII)V","od.e(B)V","l.b(Z)V","ng.b(III)V").contains(owner+"."+name+desc))return mv;
                        return new MethodVisitor(Opcodes.ASM8,mv){
                            public void visitFieldInsn(int op,String c,String n,String d){
                                if(owner.equals("od")&&c.equals("ff")&&op==Opcodes.GETFIELD){
                                    super.visitInsn(Opcodes.DUP);super.visitLdcInsn(n);
                                    super.visitMethodInsn(Opcodes.INVOKESTATIC,"SceneQueueOrderOracle","watch","(Lff;Ljava/lang/String;)V",false);
                                }
                                super.visitFieldInsn(op,c,n,d);
                            }
                            public void visitMethodInsn(int op,String c,String n,String d,boolean iface){
                                String label=switch(c+"."+n+d){
                                    case "de.a(Lff;I)V"->"remember";
                                    case "bc.a(III)Z"->"ready";
                                    case "o.a(IIIBIIII)V"->"place";
                                    case "rg.a(II)Lkl;"->"type";
                                    case "gk.a(Ljf;B)V"->"front";
                                    default->null;
                                };
                                if(label==null)super.visitMethodInsn(op,c,n,d,iface);
                                else super.visitMethodInsn(Opcodes.INVOKESTATIC,"SceneQueueOrderOracle",label,
                                    op==Opcodes.INVOKESTATIC?d:"(L"+c+";"+d.substring(1),false);
                            }
                        };
                    }
                },0);
                Files.write(dir.resolve(owner+".class"),writer.toByteArray());
            }
        }
    }
    static int op,mode,variant,remainingReads,delayReads;
    static boolean changed;
    static gk list,other;
    static jf wrong;
    static ff first,second,alternate;
    static b ground1,ground2;
    static StringJoiner trace;
    static final Map<jf,String> names=new IdentityHashMap<>();
    static final Field cursor;
    static {try{cursor=gk.class.getDeclaredField("t");cursor.setAccessible(true);}catch(Exception e){throw new AssertionError(e);}}
    static String name(jf n){return n==null?"-":names.getOrDefault(n,"new");}
    static void watch(ff node,String field){
        if(mode<14||mode>17)return;
        trace.add(name(node)+"."+field);
        if(node!=first)return;
        if(mode==15&&field.equals("r")&&++remainingReads==2)node.r=Integer.MIN_VALUE;
        if(mode==16&&field.equals("F")&&++delayReads==2)node.F=Integer.MIN_VALUE;
        if(mode==17&&field.equals("K")&&++remainingReads==2)node.K=-1;
    }
    static void action(){
        if(changed)return; changed=true;
        if(mode==7||mode==8){
            wh.S=mode==7?other:null;
            b.H[0][1][1]=wh.S;
            if(variant!=0&&wh.S!=null)wh.S.d(0);
        }
        if(mode==9)throw new IllegalStateException();
    }
    static void remember(ff f,int ignored){trace.add("old");action();f.B=1;f.D=7;f.K=3;}
    static boolean ready(int id,int guard,int shape){trace.add("r"+id+","+shape);action();return true;}
    static void place(int shape,int plane,int id,byte guard,int layer,int x,int angle,int z){
        trace.add("p"+plane+","+x+","+z+","+layer+","+id+","+shape+","+angle);action();
    }
    static kl type(int id,int guard){
        trace.add("t"+id);action();
        if(mode==12)ground1.T=null;
        if(mode==13)ground1.T=ground2.T;
        kl t=new kl();t.h=id==3?23:70;t.ib=1;return t;
    }
    static void front(gk q,jf n,byte guard){
        q.a(n,guard);
        if(mode==10)q.a(wrong,(byte)-120);
        if(mode==11)q.a(wrong,false);
    }
    static void add(gk q,jf n){q.a(n,false);}
    static void setup(int action,int scenario,int v) {
        op=action;mode=scenario;variant=v;changed=false;remainingReads=delayReads=0;trace=new StringJoiner(";");
        list=new gk();other=new gk();wh.S=list;ah.f=0;b.H=new gk[1][2][2];b.H[0][1][1]=list;
        kl.Bb=new ra[1][2][2];ve.q=null;
        first=new ff();second=new ff();wrong=new jf();
        ground1=new b(new ig());ground2=new b(new ig());ground1.T.m=3;ground2.T.m=5;
        ground1.T.p=mode==19?Integer.MAX_VALUE:2;ground2.T.p=variant==1?-1:1;
        for(ff f:new ff[]{first,second}){f.r=v==0?-1:v==1?1:5;f.F=1;f.L=3;f.K=mode==17?3:6;f.C=4;f.D=7;f.w=2;f.N=1;f.z=1;f.O=0;f.B=1;}
        second.w=3;
        if(mode==18)first.w=1;
        names.clear();names.put(list.c,"S");names.put(other.c,"A");names.put(wrong,"wrong");
        names.put(first,"f");names.put(second,"s");names.put(ground1,"g");names.put(ground2,"h");
        alternate=new ff();alternate.r=4;alternate.F=3;names.put(alternate,"alternate");
        if(mode==7||mode==8){
            if(variant==2){jf prefix=new jf();names.put(prefix,"prefix");add(other,prefix);}
            add(other,alternate);
        }
        if(mode==1)add(list,wrong);
        add(list,op==3?ground1:first);
        if(mode==2||mode==18)add(list,wrong);
        add(list,op==3?ground2:second);
        if(mode==3)add(list,wrong);
        if(mode==4){wh.S=null;b.H[0][1][1]=null;}
        if(mode==5)list.c.g=null;
        if(mode==6)list.c.p=null;
        if(mode==20)(op==3?(jf)ground2:first).g=null;
        if(mode==15)first.r=2;
        if(mode==16)first.F=2;
    }
    static String listState(gk q)throws Exception{
        return name(q.c.g)+","+name(q.c.p)+","+name((jf)cursor.get(q));
    }
    static void run(int op,int mode,int variant)throws Exception{
        setup(op,mode,variant);
        String status="ok";
        try{
            switch(op){
                case 0->b.a(9,false,8,1,13,1,0,1,22,2);
                case 1->od.e((byte)-118);
                case 2->l.b(true);
                case 3->ng.b(121,1,1);
            }
        }catch(RuntimeException ex){
            Throwable cause=ex;while(cause instanceof g w)cause=w.a;
            if(cause instanceof ClassCastException)status="cast";
            else if(cause instanceof NullPointerException)status="null";
            else if(cause instanceof IllegalStateException)status="probe";
            else throw ex;
        }
        StringJoiner links=new StringJoiner(";");
        for(jf n:List.of(first,second,ground1,ground2,wrong,alternate))links.add(name(n.p)+","+name(n.g));
        StringJoiner pile=new StringJoiner(",");
        ra tile=kl.Bb[0][1][1];
        if(tile!=null&&tile.y!=null)for(ug item:new ug[]{tile.y.k,tile.y.b,tile.y.f})if(item!=null)pile.add(""+((ig)item).m);
        System.out.println(String.join("|",status,trace.toString(),listState(list),listState(other),links.toString(),
            first.r+","+first.F+","+first.L+","+first.K+","+second.r+","+second.F+","+second.L+","+second.K+","+alternate.r+","+alternate.F,pile.toString()));
    }
    public static void main(String[] args)throws Exception{
        if(args.length==2){prepare(args[0],Path.of(args[1]));return;}
        BufferedReader r=new BufferedReader(new InputStreamReader(System.in));
        for(String s;(s=r.readLine())!=null;){int[] a=Arrays.stream(s.split(" ")).mapToInt(Integer::parseInt).toArray();run(a[0],a[1],a[2]);}
    }
}
