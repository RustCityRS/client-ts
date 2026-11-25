import java.io.*;
import java.nio.*;
import java.nio.file.*;
import java.util.*;
import java.util.jar.JarFile;
import jdk.internal.org.objectweb.asm.*;

class FrameDrawOracle {
    static final aj widget=new aj();
    static final pb player=new pb();
    static final gk sounds=new gk();
    static final id[] names=new id[5];
    static final Set<String> globals=Set.of(("sf.m ce.T n.i ik.G vk.db hh.kb hd.m jb.ab oi.g nk.V hg.f id.p ie.F p.u vb.o ia.n aa.e "+
        "pk.k ve.g g.n ud.j ef.J oi.h pf.Q sj.C oj.e sa.x ak.a dd.b ph.e ga.J fd.Z li.y ec.g ig.t lh.a vi.S ml.T nh.Y r.U gk.i ik.Q ah.f te.g").split(" "));
    static StringBuilder trace;
    static int eventCount,failAt,drawMode;
    static Throwable injected;
    static void event(String s){trace.append(s).append(';');if(++eventCount==failAt)throw new IllegalStateException();}
    public static void field(String s){event(s);}
    public static void animate(int ignored,int group){
        event("animate,"+group);
        if(drawMode==8)hd.m=-1;
        if(drawMode==9){ik.G=1;hh.kb=Integer.MIN_VALUE;hd.m=771;sf.m=new boolean[]{true,true,false};}
    }
    public static void draw(int ignored) throws IOException {
        event("layer");ik.G=3;
        if(drawMode==10){var ex=od.a(new IllegalStateException(),"layer");injected=ex;throw ex;}
        if(drawMode==11){var ex=new AssertionError();injected=ex;throw ex;}
        if(drawMode==12){var ex=new IOException();injected=ex;throw ex;}
        if(drawMode==1||drawMode==2){oi.g=41;jb.ab=56;if(drawMode==2){nk.V=widget;fd.Z=-7;li.y=91;}}
        if(drawMode==3)ie.F=true;if(drawMode==4)ie.F=false;
        if(drawMode==5||drawMode==6||drawMode==7) {
            vb.o=4; p.u=new short[]{41,1001,13,1002};ia.n=new int[]{1,207,drawMode==5?-1:108,91};
            ak.a=names.clone();ph.e=names.clone();mh.h=new int[]{71,70,80,72};ml.x=new int[]{83,85,92,81};
            sa.z=new long[]{Long.MIN_VALUE,63,12,Long.MAX_VALUE};oi.g=11;jb.ab=44;
        }
        if(drawMode==6){te.g.Z=734;te.g.S=-289;ah.f=2;id.p=-77;lh.a=1;vi.S=1;}
        if(drawMode==7)te.g=null;
    }
    public static void clip(){event("clip");td.c();}
    public static void sort(int ignored){event("sort");ti.f(ignored);}
    public static void tip(int x,aj c,int y,byte guard){event("tip,"+x+","+(c==null?"~":"widget")+","+y);}
    public static void menu(byte guard){event("classic");}
    public static void spriteMenu(byte guard){event("sprite");}
    public static int top(int ignored){event("top");return sg.a(ignored);}
    public static void cursor(int id,boolean guard){event("cursor,"+id);sc.a(id,guard);}
    public static void tint(int x,int y,int w,int h,int colour,int alpha){
        event("tint,"+x+","+y+","+w+","+h+","+colour+","+alpha);td.b(x,y,w,h,colour,alpha);
    }
    public static void sound(byte guard,int p,int time,int x,int z){event("sound,"+p+","+time+","+x+","+z);tk.a(guard,p,time,x,z);}
    static void prepare(Path jar,Path dir)throws Exception {
        try(JarFile file=new JarFile(jar.toFile())){
            for(String owner:new String[]{"db","gf"}){
                ClassReader reader=new ClassReader(file.getInputStream(file.getJarEntry(owner+".class")));
                ClassWriter out=new ClassWriter(ClassWriter.COMPUTE_MAXS);
                reader.accept(new ClassVisitor(Opcodes.ASM8,out){
                    public MethodVisitor visitMethod(int access,String name,String desc,String sig,String[] ex){
                        MethodVisitor base=super.visitMethod(access,name,desc,sig,ex);
                        if(!(owner.equals("db")&&name.equals("a")&&desc.equals("(I)V")||owner.equals("gf")&&name.equals("e")&&desc.equals("(B)V")))return base;
                        return new MethodVisitor(Opcodes.ASM8,base){
                            public void visitFieldInsn(int op,String cls,String name,String type){
                                super.visitFieldInsn(op,cls,name,type);
                                String key=cls+"."+name;
                                if((op==Opcodes.GETSTATIC||op==Opcodes.PUTSTATIC)&&globals.contains(key)){
                                    super.visitLdcInsn((op==Opcodes.GETSTATIC?"r":"w")+key);
                                    super.visitMethodInsn(Opcodes.INVOKESTATIC,"FrameDrawOracle","field","(Ljava/lang/String;)V",false);
                                }
                            }
                            public void visitMethodInsn(int op,String cls,String name,String desc,boolean iface){
                                String target=switch(cls+"."+name+desc){
                                    case "g.a(II)V"->"animate";case "b.c(I)V"->"draw";case "td.c()V"->"clip";
                                    case "ti.f(I)V"->"sort";case "ii.a(ILaj;IB)V"->"tip";
                                    case "oi.b(B)V"->"menu";case "wh.e(B)V"->"spriteMenu";case "sg.a(I)I"->"top";
                                    case "sc.a(IZ)V"->"cursor";case "td.b(IIIIII)V"->"tint";case "tk.a(BIIII)V"->"sound";
                                    default->null;};
                                if(target==null)super.visitMethodInsn(op,cls,name,desc,iface);
                                else super.visitMethodInsn(op,"FrameDrawOracle",target,desc,false);
                            }
                        };
                    }
                },0);
                Files.write(dir.resolve(owner+".class"),out.toByteArray());
            }
        }
    }
    static String bools(boolean[] a){if(a==null)return "~";String s="";for(boolean bit:a)s+=bit?"1":"0";return s;}
    static String ids(id[] a){if(a==null)return "~";StringJoiner out=new StringJoiner(",");
        for(id value:a){int i=-1;for(int n=0;n<names.length;n++)if(names[n]==value)i=n;out.add(value==null?"~":value==dd.b?"c":value==ga.J?"e":""+i);}return out.toString();}
    static String pixels(){ByteBuffer buf=ByteBuffer.allocate(td.g.length*4).order(ByteOrder.LITTLE_ENDIAN);buf.asIntBuffer().put(td.g);return Base64.getEncoder().encodeToString(buf.array());}
    static String nums(Object a){if(a==null)return "~";if(a instanceof short[] b)return Arrays.toString(b);
        if(a instanceof long[] b)return Arrays.toString(b);return Arrays.toString((int[])a);}
    static void run(int[] v) {
        int entry=v[0],menu=v[2],pointer=v[3],bad=v[5];
        hd.m=v[1];drawMode=v[4];ml.T=v[6];ik.G=v[7];failAt=v[8];eventCount=0;trace=new StringBuilder();
        ie.F=menu!=0;ec.g=menu==2;oi.h=pointer&1;pk.k=(pointer&2)!=0?2:0;pb.sc=(pointer&4)!=0;
        ob.q=new boolean[112];ob.q[81]=(pointer&1)!=0;
        sj.C=13;pf.Q=19;sa.x=37;oj.e=43;g.n=79;ef.J=83;ve.g=101;ud.j=-105;
        aa.e=44;ig.t=57;wb.db=false;qh.c=-1;
        vb.o=4;p.u=new short[]{40,1001,13,1002};ia.n=new int[]{39,50,169,72};
        ak.a=names.clone();ph.e=names.clone();mh.h=new int[]{6,8,1,2};ml.x=new int[]{1,7,3,9};
        sa.z=new long[]{1,0,Long.MAX_VALUE,Long.MIN_VALUE};
        sf.m=new boolean[]{false,true,false,true};ce.T=new boolean[]{true,false,false,true};n.i=new boolean[]{true,false,true,false};
        nh.Y=new int[]{-2,3,11,15};r.U=new int[]{1,2,4,7};gk.i=new int[]{6,8,10,1};ik.Q=new int[]{7,9,4,2};
        vk.db=-33;hh.kb=121;id.p=29;ah.f=1;te.g=player;player.Z=2451;player.S=4407;nc.j=sounds;
        jb.ab=32;oi.g=12;fd.Z=24;li.y=50;nk.V=hg.f=widget;lh.a=pointer%3;vi.S=(pointer+1)%3;
        td.a(new int[21*11],21,11);for(int i=0;i<td.g.length;i++)td.g[i]=0x234198+i*17;td.b(3,4,15,7);
        switch(bad){
            case 1->sf.m=null;case 2->sf.m=new boolean[]{true};case 3->ce.T=null;case 4->n.i=null;
            case 5->n.i=new boolean[0];case 6->ce.T=new boolean[1];case 7->sf.m=new boolean[]{false,false,false,false};
            case 8->p.u=new short[0];case 9->ia.n=null;case 10->ak.a=null;case 11->ph.e=new id[0];
            case 12->ob.q=null;case 13->te.g=null;case 14->nh.Y=null;case 15->r.U=new int[0];
            case 16->gk.i=new int[]{7};case 17->ik.Q=new int[]{8};case 18->sa.z=null;case 19->n.i=sf.m;
            case 20->n.i=ce.T;case 21->sf.m=ce.T;case 22->nc.j=null;
        }
        String fault="ok";injected=null;
        try{if(entry==0)db.a(-98);else gf.e((byte)101);}
        catch(Throwable ex){Throwable e=ex;while(e instanceof g wrapped)e=wrapped.a;
            fault=e instanceof AssertionError?"fatal":e instanceof IOException?"checked":e instanceof NullPointerException?"null":e instanceof IndexOutOfBoundsException?"bounds":e instanceof IllegalStateException?"probe":e.getClass().getName();
            if(ex instanceof g wrapped)fault+="@"+wrapped.q;
            if(injected!=null)fault+="#"+(ex==injected);}
        System.out.println(String.join("|",fault,trace.toString(),hd.m+","+ik.G+","+vk.db+","+hh.kb+","+id.p,
            bools(sf.m),bools(ce.T),bools(n.i),jb.ab+","+oi.g+","+fd.Z+","+li.y+","+(nk.V==null?"~":"c")+","+(hg.f==null?"~":"c"),
            ie.F+","+vb.o+","+ve.g+","+ud.j+","+lh.a+","+vi.S,nums(p.u),nums(ia.n),ids(ak.a),ids(ph.e),nums(mh.h),nums(ml.x),nums(sa.z),
            td.e+","+td.b+","+td.h+","+td.d,pixels()));
    }
    public static void main(String[] args)throws Exception {
        if(args.length!=0){prepare(Path.of(args[0]),Path.of(args[1]));return;}
        for(int i=0;i<names.length;i++)names[i]=ea.a(new byte[]{(byte)(65+i)},0,1,0);
        BufferedReader in=new BufferedReader(new InputStreamReader(System.in));
        for(String line:in.lines().toList())run(Arrays.stream(line.split(" ")).mapToInt(Integer::parseInt).toArray());
    }
}
