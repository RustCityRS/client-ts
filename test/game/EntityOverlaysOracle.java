import java.io.*;
import java.nio.*;
import java.nio.file.*;
import java.util.*;
import java.util.jar.JarFile;
import java.util.zip.DeflaterOutputStream;
import jdk.internal.org.objectweb.asm.*;

public class EntityOverlaysOracle {
    static final int WIDTH=136, HEIGHT=100;
    static final IdentityHashMap<Object,String> ids=new IdentityHashMap<>();
    static StringBuilder trace;
    static int call, faultAt;
    static int archiveGroup;
    static al archive;
    static void log(String name,Object... args) {
        trace.append(name);
        for(Object arg:args) trace.append(',').append(arg);
        trace.append(';');
        if (++call==faultAt) throw new IllegalStateException("trace");
    }
    static String text(id value) {return value==null?"~":HexFormat.of().formatHex(value.A,0,value.c);}
    public static void projection(int y,byte guard,int x,int a,int b,int h,ob actor) {
        log("p",y,x,h,ids.get(actor));vi.a(y,guard,x,a,b,h,actor);
    }
    public static void sprite(vc s,int x,int y){Objects.requireNonNull(s);log("s",ids.get(s),x,y);s.c(x,y);}
    public static void clip(int l,int t,int r,int b){log("c",l,t,r,b);td.a(l,t,r,b);}
    public static void reset(int l,int t,int r,int b){log("r",l,t,r,b);td.b(l,t,r,b);}
    public static int width(mb f,id msg){Objects.requireNonNull(f);log("w",ids.get(f),text(msg));return f.b(msg);}
    public static void centre(mb f,id msg,int x,int y,int c,int shadow){Objects.requireNonNull(f);log("f",ids.get(f),text(msg),x,y,c,shadow);f.a(msg,x,y,c,shadow);}
    public static void left(mb f,id msg,int x,int y,int c,int shadow){Objects.requireNonNull(f);log("l",ids.get(f),text(msg),x,y,c,shadow);f.b(msg,x,y,c,shadow);}
    public static void wave(mb f,id msg,int x,int y,int c,int shadow,int tick){Objects.requireNonNull(f);log("v",ids.get(f),text(msg),x,y,c,shadow,tick);f.b(msg,x,y,c,shadow,tick);}
    public static void wave2(mb f,id msg,int x,int y,int c,int shadow,int tick){Objects.requireNonNull(f);log("u",ids.get(f),text(msg),x,y,c,shadow,tick);f.a(msg,x,y,c,shadow,tick);}
    public static void shake(mb f,id msg,int x,int y,int c,int shadow,int tick,int age){Objects.requireNonNull(f);log("k",ids.get(f),text(msg),x,y,c,shadow,tick,age);f.a(msg,x,y,c,shadow,tick,age);}
    public static vc[] load(int group,al archive,int guard,int file) {
        log("g",group,file);
        vc[] sprites=nh.a(group,archive,guard,file);
        if(sprites!=null)for(int i=0;i<sprites.length;i++)ids.put(sprites[i],"g"+group+"."+i);
        return sprites;
    }
    static void prepare(Path jar,Path dir)throws Exception {
        try(JarFile file=new JarFile(jar.toFile())){
            ClassReader input=new ClassReader(file.getInputStream(file.getJarEntry("vj.class")));
            ClassWriter output=new ClassWriter(ClassWriter.COMPUTE_MAXS);
            input.accept(new ClassVisitor(Opcodes.ASM8,output){
                public MethodVisitor visitMethod(int access,String name,String desc,String sig,String[] errors){
                    MethodVisitor mv=super.visitMethod(access,name,desc,sig,errors);
                    if(!name.equals("a")||!desc.equals("(IIIIIII)V"))return mv;
                    return new MethodVisitor(Opcodes.ASM8,mv){
                        public void visitMethodInsn(int op,String owner,String method,String sig,boolean iface){
                            String target=switch(owner+"."+method+sig){
                                case "vi.a(IBIIIILob;)V" -> "projection";
                                case "nh.a(ILal;II)[Lvc;" -> "load";
                                case "vc.c(II)V" -> "sprite"; case "td.a(IIII)V" -> "clip"; case "td.b(IIII)V" -> "reset";
                                case "mb.b(Lid;)I" -> "width";
                                case "mb.a(Lid;IIII)V" -> "centre"; case "mb.b(Lid;IIII)V" -> "left";
                                case "mb.a(Lid;IIIII)V" -> "wave2"; case "mb.b(Lid;IIIII)V" -> "wave"; case "mb.a(Lid;IIIIII)V" -> "shake";
                                default -> null;
                            };
                            if(target==null){super.visitMethodInsn(op,owner,method,sig,iface);return;}
                            String args=op==Opcodes.INVOKESTATIC?sig:"(L"+owner+";"+sig.substring(1);
                            super.visitMethodInsn(Opcodes.INVOKESTATIC,"EntityOverlaysOracle",target,args,false);
                        }
                    };
                }
            },0);
            Files.write(dir.resolve("vj.class"),output.toByteArray());
        }
    }
    static vc image(int id,int w,int h){
        int[] pixels=new int[w*h];
        for(int i=0;i<pixels.length;i++)pixels[i]=(i+id)%7==0?0:(id*0x3d0b13+i*133)&0xffffff;
        vc sprite=new rh(w,h,0,0,w,h,pixels);ids.put(sprite,"i"+id);return sprite;
    }
    static id name(String value){return MenuFeedbackOracle.word(value);}
    static kf arrow(int type,int actor,int icon){kf a=new kf();a.j=type;a.a=actor;a.o=icon;return a;}
    static int[] slots(){int[] a=new int[4];Arrays.fill(a,-91);return a;}
    static String ints(int[] a){return a==null?"null":Arrays.toString(a);}
    static String messages(id[] a) {
        if(a==null)return "null";
        return String.join(",",Arrays.stream(a).map(value -> value==null?"~":text(value)+":"+ids.getOrDefault(value,"?")).toList());
    }
    static vc[] pair(int n){return new vc[]{image(n,15,4),image(n+1,15,4)};}
    static void clearSpriteArchive(){h.i=null;}
    static void useSpriteArchive(){h.i=archive;}
    static void run(int[] v)throws Exception {
        int variant=v[0],colour=v[1],effect=v[2],timer=v[3],stamp=v[4],arg=v[5];
        int top=7,left=5,w=124,h=86;faultAt=v[6];call=0;trace=new StringBuilder();ids.clear();
        td.a(new int[WIDTH*HEIGHT],WIDTH,HEIGHT);Arrays.fill(td.g,0x63201406);td.b(left,top,left+w,top+h);
        uf.b=MenuFeedbackOracle.font(0);ma.b=MenuFeedbackOracle.font(1);ids.put(uf.b,"b");ids.put(ma.b,"p");
        j.i=81;j.h=0;ga.N=4;ga.R=slots();ga.Q=slots();ga.O=slots();ga.L=slots();ga.S=slots();ga.U=slots();ga.P=slots();
        ga.T=new id[]{name("old"),null,null,name("old")};
        ids.put(ga.T[0],"old0");ids.put(ga.T[3],"old3");
        ie.I=new int[]{0xffe000,0xcc1435,0x61661e,0x123abb,0xff00ee,0x00ffee};
        jl.e=-83;tg.z=-117;ah.f=1;ve.q=null;rk.m=4096;mf.i=-105;ud.g=4096;bd.X=qj.w=0;
        hh.kb=41;ai.d=stamp;si.e=0;
        te.g=new pb();tf.J=new pb[5];tf.J[2]=new pb();uc.l=new bk[5];uc.l[3]=new bk();
        pb self=te.g,other=tf.J[2];bk npc=uc.l[3];
        fe.R=ed.d=1;ad.h=new int[]{2};fi.n=new int[]{3};self.pc=new cl();other.pc=new cl();npc.mc=new ja();
        self.Gc=name("Tester");other.Gc=name("Peer");sj.L=0;ck.p=new id[]{other.Gc};
        int i=0;for(ob actor:new ob[]{self,other,npc}){
            ids.put(actor,"a"+i);actor.Z=4096+5*i;actor.S=4820+i;actor.Qb=-100-2*i;
            actor.P=name(new String[]{"Rune","Caf\u00e9","<col=663322>q</col>"}[i]);
            ids.put(actor.P,"text"+i);
            actor.mb=colour;actor.ub=effect;actor.Nb=timer;i++;
        }
        oa.c=new vc[]{image(1,7,8)};ph.m=new vc[]{image(2,8,5)};wa.a=new vc[]{image(3,9,7)};
        pe.B=new vc[]{image(4,11,9),image(5,12,8)};
        gg.H=pair(6);wk.o=new ve(4);npc.mc.fb=27;wk.o.a(27L,pair(8),(byte)-71);clearSpriteArchive();
        ve.t=new kf[]{null,arrow(10,2,0),arrow(1,3,0),arrow(1,4,0)};
        if(variant!=0){
            for(ob actor:new ob[]{self,other,npc}){
                actor.n=50;actor.Bb=127;
                actor.p=new int[]{44,42,48,50};actor.Db=new int[]{0,1,0,1};actor.Ob=new int[]{0,-4,123,2000000000};
            }
            self.jc=0;self.Ac=0;other.Ac=0;npc.mc.b=0;npc.mc.O=90;
        }
        switch(variant){
            case 2 -> {hh.kb=52;ai.d=stamp;j.h=arg;}
            case 3 -> {si.e=arg;sj.L=stamp&1;}
            case 4 -> {ga.N=arg;}
            case 5 -> {self.pc=null;npc.mc=null;other.Z=13057;}
            case 6 -> {npc.mc.J=new int[]{-1};other.S=4097;}
            case 7 -> {left=-11;top=-8;w=89;h=73;td.b(2,1,55,61);}
            case 8 -> {wk.o.a(27L,new vc[1],(byte)-71);npc.mc.fb=28;wk.o.a(28L,new vc[1],(byte)-71);}
            case 9 -> {npc.mc.fb=999;}
            case 10 -> {ga.S=new int[1];}
            case 11 -> {ga.T=null;}
            case 12 -> {self.jc=7;}
            case 13 -> {pe.B[1]=null;}
            case 14 -> {gg.H=new vc[]{gg.H[0],null};}
            case 15 -> {uf.b=null;}
            case 16 -> {ma.b=null;}
            case 17 -> {self.p=new int[]{0};}
            case 18 -> {ad.h=new int[]{8};}
            case 19 -> {ve.t=new kf[]{arrow(10,2,5)};}
            case 20 -> {self.Nb=Integer.MIN_VALUE;self.Bb=Integer.MAX_VALUE;npc.mc.O=Integer.MAX_VALUE;}
            case 21 -> {self.P=null;other.P=null;npc.P=null;}
            case 22 -> {hh.kb=49;npc.mc.O=-1;}
            case 23 -> {j.h=1;}
            case 24 -> {useSpriteArchive();npc.mc.fb=archiveGroup;}
            case 25 -> {npc.mc.J=new int[]{77};ja sub=new ja();sub.b=0;sub.O=27;gf.Z.a(77L,sub,(byte)-71);npc.mc.O=133;npc.mc.b=-1;}
            case 26 -> {useSpriteArchive();npc.mc.fb=-1;}
            case 27 -> {wk.o.a(123L,new Object(),(byte)-71);npc.mc.fb=123;}
            case 28 -> {useSpriteArchive();npc.mc.fb=archiveGroup;fi.n=new int[]{3,3};ed.d=2;}
            case 29 -> {useSpriteArchive();npc.mc.fb=65535;}
        }
        String fault="ok";
        try{vj.a(top,256,left,256,w,h,20);}
        catch(Throwable e){while(e instanceof g wrapped)e=wrapped.a;
            fault=e instanceof ArrayIndexOutOfBoundsException?"bounds":e instanceof NullPointerException?"null":
                e instanceof IllegalStateException?"trace":e instanceof ClassCastException?"cast":e.getClass().getSimpleName();}
        ByteBuffer bytes=ByteBuffer.allocate(WIDTH*HEIGHT*4).order(ByteOrder.LITTLE_ENDIAN);
        bytes.asIntBuffer().put(td.g);
        ByteArrayOutputStream compressed=new ByteArrayOutputStream();
        try(DeflaterOutputStream out=new DeflaterOutputStream(compressed)){out.write(bytes.array());}
        System.out.println(String.join("|",fault,trace.toString(),""+j.i,ints(ga.R),ints(ga.Q),ints(ga.O),ints(ga.L),ints(ga.S),ints(ga.U),ints(ga.P),
            messages(ga.T),jl.e+","+tg.z,td.e+","+td.b+","+td.h+","+td.d,
            variant==24||variant==28?Arrays.toString(Arrays.stream((vc[])wk.o.a((long)archiveGroup,false)).map(ids::get).toArray()):"-",
            Base64.getEncoder().encodeToString(compressed.toByteArray())));
    }
    public static void main(String[] args)throws Exception {
        if(args.length!=0){prepare(Path.of(args[0]),Path.of(args[1]));return;}
        BufferedReader input=new BufferedReader(new InputStreamReader(System.in));
        archiveGroup=Integer.parseInt(input.readLine());
        archive=new al(new ChatOracle.Source(input.readLine()),false,false);
        for(String line:input.lines().toList())run(Arrays.stream(line.split(" ")).mapToInt(Integer::parseInt).toArray());
    }
}
