import java.io.*;
import java.lang.reflect.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.util.*;
import java.util.jar.*;
import jdk.internal.org.objectweb.asm.*;

public class MapBuildLoopOracle {
    static int phase, trigger, occurrence, action, argument, seen;
    static al primary = new al(null,false,false), alternate = new al(null,false,false);
    static id labelsSuffix = bi.l;
    static id loadingDoneSuffix = vi.W;
    static byte[][] oldLand, oldLoc, oldNpc;
    static be originalOut, replacementOut;
    static Field cipher;

    static int[] groups(int n) {
        if(n<0)return null;
        int[] ids=new int[n];
        for(int i=0;i<n;i++)ids[i]=400+i;
        return ids;
    }
    static byte[][] data(int n) {
        if(n<0)return null;
        byte[][] arr=new byte[n][];
        if(n>=3)for(int i=0;i<n;i++)arr[i]=new byte[]{0};
        return arr;
    }
    static be packet(int cap) {
        be b=new be(Math.max(0,cap));b.a(new int[]{-31,88,499,21},0);
        if(cap<0)b.fb=null;
        return b;
    }
    static void hook(int point) {
        if(trigger!=point || ++seen!=occurrence)return;
        switch(action) {
            case 1: mk.G=data(argument);break;
            case 2: lk.x=data(argument);break;
            case 3: kg.o=data(argument);break;
            case 4: fd.X=groups(argument);break;
            case 5: hh.qb=groups(argument);break;
            case 6: ae.c=groups(argument);break;
            case 7:
                if(argument<0)jg.w=null;
                else {jg.w=new int[argument][];for(int i=0;i<argument;i++)jg.w[i]=i==1?null:new int[]{99,71+i};}
                break;
            case 8: rb.i=groups(argument);break;
            case 9: ah.d=argument;break;
            case 10: pd.r=argument;break;
            case 11: jh.k=argument<0?null:new gh(argument==0?null:vb.a("other",(byte)90),null,0,0,0,true,0);break;
            case 12: bi.l=argument<0?null:vb.a("_more",(byte)69);break;
            case 13: aa.d=argument<0?null:alternate;break;
            case 14: re.d=argument<0?null:alternate;break;
            case 15: ug.d=new kc(argument);break;
            case 16: qk.v=replacementOut;break;
            case 17: qk.v=null;break;
            case 18: phase=argument;break;
            case 19: if(argument!=0)qg.G=true;else ek.s=null;break;
            case 20: vi.W=argument<0?null:vb.a("replacement",(byte)85);break;
            default: throw new AssertionError(action);
        }
    }
    static String receiver(al archive) { Objects.requireNonNull(archive);return archive==alternate?"+":""; }
    static void observe(int point,String call) {calls.add(call);hook(point);}
    public static void opcode(be packet,int dummy,int op) {packet.k(dummy,op);hook(op==20?13:14);}
    static String packetState(be p) throws Exception {
        if(p==null)return "~";
        ij isaac=(ij)cipher.get(p);
        return p.yb+"."+Arrays.hashCode(p.fb)+"."+isaac.b((byte)107);
    }
    static String details() throws Exception {
        return String.join(":", ""+(mk.G==oldLand),""+(lk.x==oldLoc),""+(kg.o==oldNpc),
            ""+Arrays.deepHashCode(oldLand),""+Arrays.deepHashCode(oldLoc),""+Arrays.deepHashCode(oldNpc),
            ""+Arrays.hashCode(fd.X),""+Arrays.hashCode(hh.qb),""+Arrays.hashCode(ae.c),""+Arrays.deepHashCode(jg.w),
            ""+Arrays.hashCode(rb.i),""+(ug.d==null?-1:ug.d.h),""+seen,
            ""+(qk.v==null?-1:qk.v==originalOut?0:1),packetState(originalOut),packetState(replacementOut));
    }
    static final List<String> calls = new ArrayList<>();
    static String value(id text) { return new String(text.b(false), StandardCharsets.ISO_8859_1); }
    public static void keep(boolean force,int dummy) { observe(1,"keep"+force); }
    public static byte[] ground(al a,int dummy,int file,int group) {
        observe(2,"land"+receiver(a)+group+"."+file);
        return phase==0?null:new byte[]{1,2,3};
    }
    public static byte[] keyed(al a,byte dummy,int file,int[] key,int group) {
        observe(group>=300 && group<400?4:3,"file"+receiver(a)+group+"."+file+"."+Arrays.hashCode(key));
        if (phase==0) return null;
        if (group==201 || group==202) {
            // Types 0..4 include a repeated placement, a shape-22 decoration and out-of-bounds placements.
            return new byte[]{1,66,40,2,40,0,1,67,88,0,1,68,88,0,1,69,88,0,1,70,88,0,0};
        }
        return new byte[]{7};
    }
    public static void hint(al a,id name,byte dummy) { observe(11,"hint"+receiver(a)+value(name)); }
    public static boolean exists(al a,id name,int min) { observe(5,"exists"+receiver(a)+value(name)); return phase!=3; }
    public static boolean labelReady(al a,int dummy,id name) { observe(6,"labels"+receiver(a)+value(name)); return phase!=0; }
    public static kc labelData(int dummy,id name,al a) {
        if (a == null) {
            observe(7,"read-null");
            return ii.a(dummy,name,a);
        }
        observe(7,"read"+receiver(a)+value(name));
        return new kc(a==alternate?3:0);
    }
    public static boolean model(al a,boolean dummy,int id,int file) {observe(8,"model"+receiver(a)+id);return phase!=1 || (id&1)==0;}
    public static void message(id text,boolean immediate,byte dummy) {observe(9,"msg"+value(text)+"."+immediate);}
    public static void scene(){ observe(10,"scene"); }
    public static void ignoreInt(int guard){}
    public static void ignoreTile(int guard,int z,int x){}
    public static void ignoreFlag(boolean guard){}
    public static void state(int dummy,int next){ tf.C=next;observe(12,"state"+next); }
    public static void reopen(int dummy){calls.add("reopen");}
    public static void audio(int dummy){calls.add("audio");}
    public static void slow(int dummy){calls.add("slow");}
    static void prepare(Path jar,Path dir) throws Exception {
        Map<String,String> redirect = Map.ofEntries(
            Map.entry("be.k(II)V","opcode"),Map.entry("ph.a(ZI)V","keep"),Map.entry("al.a(III)[B","ground"),Map.entry("al.a(BI[II)[B","keyed"),
            Map.entry("al.a(Lid;B)V","hint"),Map.entry("al.a(Lid;I)Z","exists"),Map.entry("al.a(ILid;)Z","labelReady"),
            Map.entry("ii.a(ILid;Lal;)Lkc;","labelData"),Map.entry("al.a(ZII)Z","model"),Map.entry("vg.a(Lid;ZB)V","message"),
            Map.entry("ej.a(II)V","state"),Map.entry("g.a(I)V","reopen"),Map.entry("uj.a(I)V","audio"),Map.entry("ed.d(I)V","slow"),
            Map.entry("lk.c(I)V","ignoreInt"),Map.entry("ng.b(III)V","ignoreTile"),Map.entry("ia.c(I)V","ignoreInt"),
            Map.entry("l.b(Z)V","ignoreFlag"),Map.entry("bf.c(I)V","ignoreInt"));
        try(JarFile source=new JarFile(jar.toFile())){
            for(String owner:new String[]{"gj","jb"}){
                ClassReader input=new ClassReader(source.getInputStream(source.getJarEntry(owner+".class")));
                ClassWriter out=new ClassWriter(0);
                input.accept(new ClassVisitor(Opcodes.ASM8,out){
                    public MethodVisitor visitMethod(int a,String n,String d,String sig,String[] errors){
                        MethodVisitor original=super.visitMethod(a,n,d,sig,errors);
                        if(!(owner.equals("gj") && n.equals("e") && d.equals("(I)V")) &&
                           !(owner.equals("jb") && n.equals("b") && d.equals("(B)Z"))) return original;
                        return new MethodVisitor(Opcodes.ASM8,original){
                            final Label postScene=new Label();boolean began=false;
                            public void visitMethodInsn(int op,String target,String name,String desc,boolean itf){
                                if(target.equals("uj") && !began){
                                    // The geometry builder ends before lk.c (0x35b).
                                    began=true;super.visitInsn(Opcodes.POP);
                                    super.visitMethodInsn(Opcodes.INVOKESTATIC,"MapBuildLoopOracle","scene","()V",false);
                                    super.visitJumpInsn(Opcodes.GOTO,postScene);return;
                                }
                                String replacement=redirect.get(target+"."+name+desc);
                                if(replacement==null){super.visitMethodInsn(op,target,name,desc,itf);return;}
                                String stat=op==Opcodes.INVOKESTATIC?desc:"(L"+target+";"+desc.substring(1);
                                super.visitMethodInsn(Opcodes.INVOKESTATIC,"MapBuildLoopOracle",replacement,stat,false);
                            }
                            public void visitIntInsn(int op,int operand){
                                if(op==Opcodes.SIPUSH && operand==8428) super.visitLabel(postScene);
                                super.visitIntInsn(op,operand);
                            }
                        };
                    }
                },0);
                Files.write(dir.resolve(owner+".class"),out.toByteArray());
            }
        }
    }
    public static void main(String[] args) throws Exception {
        if(args.length>0){prepare(Path.of(args[0]),Path.of(args[1]));return;}
        cipher=be.class.getDeclaredField("Jb");cipher.setAccessible(true);
        BufferedReader reader=new BufferedReader(new InputStreamReader(System.in));
        for(String line;(line=reader.readLine())!=null;){
            int[] cmd=Arrays.stream(line.split(" ")).mapToInt(Integer::parseInt).toArray();
            if(cmd[0]==0){
                bi.l=labelsSuffix;vi.W=loadingDoneSuffix;re.d=aa.d=ik.Y=primary;
                he.w.a(0);
                for(int i=0;i<5;i++){
                    jb loc = new jb();loc.k=i;loc.R=(i==2?1:0);loc.qb=(i==3?1:0);loc.q=i==4;
                    Field models=jb.class.getDeclaredField("yb");models.setAccessible(true);models.set(loc,new int[]{i*2,i*2+1});
                    he.w.a(i,loc,(byte)-71);
                }
                tf.C=cmd[1];qg.G=cmd[2]!=0;lf.i=cmd[3]!=0;ug.d=null;
                jh.k=new gh(vb.a("field",(byte)100),null,0,0,0,true,0);
                Class<?> unsafe=Class.forName("sun.misc.Unsafe"); Field field=unsafe.getDeclaredField("theUnsafe");field.setAccessible(true);
                Method allocate=unsafe.getMethod("allocateInstance",Class.class);
                tb.h=(cmd[4]&1)==0?null:(java.awt.Frame)allocate.invoke(field.get(null),java.awt.Frame.class);
                ek.s=(cmd[4]&2)==0?null:(se)allocate.invoke(field.get(null),se.class);
                ic.V=cmd[5];ah.k=cmd[6];hk.e=cmd[7];vj.t=cmd[8];bc.e=cmd[9];
                fd.X=new int[]{101,-1,103};hh.qb=new int[]{201,202,-1};ae.c=cmd[10]==0?null:new int[]{-1,301,302};
                rb.i=new int[]{0,257,514};jg.w=new int[][]{{0,11,0,0},{0,-22,0,0},{0,33,0,0}};
                mk.G=new byte[3][];lk.x=new byte[3][];kg.o=ae.c==null?null:new byte[3][];
                if(cmd[10]==2){mk.G[0]=new byte[]{11};kg.o[1]=new byte[]{13};}
                ah.d=65;pd.r=84;qk.v=new be(5000);qk.v.a(new int[]{1,2,3,4},0);
            }else{
                calls.clear();phase=cmd[1];String result="ok";
                trigger=cmd[0]==2?cmd[2]:0;seen=0;
                if(trigger!=0){
                    occurrence=cmd[3];action=cmd[4];argument=cmd[5];
                    oldLand=mk.G;oldLoc=lk.x;oldNpc=kg.o;
                    originalOut=qk.v;replacementOut=packet(action==16?argument:6);
                }
                try{gj.e(-30458);}
                catch(RuntimeException e){
                    Throwable cause=e;while(cause instanceof g wrapped)cause=wrapped.a;
                    if(trigger==0)result="error";
                    else if(cause instanceof NullPointerException)result="null-ref";
                    else if(cause instanceof IndexOutOfBoundsException)result="bounds";
                    else throw e;
                }
                System.out.println(String.join("/",result,""+tf.C,""+ah.d,""+pd.r,""+bc.e,""+(ug.d==null),
                    ""+Arrays.deepHashCode(mk.G),""+Arrays.deepHashCode(lk.x),""+Arrays.deepHashCode(kg.o),
                    (trigger==0?HexFormat.of().formatHex(qk.v.fb,0,qk.v.yb):details()),String.join(",",calls)));
            }
        }
    }
}
