import java.io.*;
import java.nio.ByteBuffer;
import java.nio.file.*;
import java.security.MessageDigest;
import java.util.*;
import java.util.jar.JarFile;
import jdk.internal.org.objectweb.asm.*;

// af.a is untouched. Trace entry to its real lookup, sound, world and collision callees. A null
// collision receiver therefore faults after the scene mutation and before entering a ke method.
public final class LocRemoveOracle {
    static final Map<String,String> names=Map.ofEntries(
        Map.entry("ke.b(III)J","wall"),Map.entry("gk.a(III)J","decor"),
        Map.entry("j.a(III)J","scene"),Map.entry("dd.a(III)J","ground"),
        Map.entry("ke.a(II)Ljb;","type"),Map.entry("jb.a(B)Z","sound?"),Map.entry("fa.a(IIIILjb;)V","sound-"),
        Map.entry("wb.a(III)Lhk;","wall-"),Map.entry("le.a(III)Lnf;","decor-"),
        Map.entry("gl.a(III)Lec;","scene-"),Map.entry("de.a(III)Lpk;","ground-"),
        Map.entry("ke.a(IIIIIZ)V","cw"),Map.entry("ke.a(ZBIIIII)V","cl"),Map.entry("ke.c(III)V","cg"));
    static StringJoiner trace;
    static int step,failAt,mode;
    static boolean active;
    static ra square;
    static jb type;
    static MessageDigest sha;

    public static void call(String name,int id) {
        if(!active)return;
        trace.add(name.equals("type")?"type="+id:name);
        if(++step==failAt)throw new IllegalArgumentException("observation");
        if(name.equals("type")&&mode==13&&square!=null)square.z=null;
        if(name.equals("scene-")&&mode==14){type.fb=4;type.y=2;}
    }
    static void prepare(Path jarPath,Path output)throws Exception{
        Set<String> owners=new HashSet<>(), found=new HashSet<>();
        for(String s:names.keySet())owners.add(s.substring(0,s.indexOf('.')));
        try(JarFile jar=new JarFile(jarPath.toFile())){
            for(String owner:owners){
                ClassReader r=new ClassReader(jar.getInputStream(jar.getJarEntry(owner+".class")));
                ClassWriter w=new ClassWriter(ClassWriter.COMPUTE_MAXS);
                r.accept(new ClassVisitor(Opcodes.ASM8,w){
                    public MethodVisitor visitMethod(int a,String n,String d,String g,String[] e){
                        MethodVisitor next=super.visitMethod(a,n,d,g,e);String key=owner+"."+n+d;
                        String label=names.get(key);if(label==null)return next;found.add(key);
                        return new MethodVisitor(Opcodes.ASM8,next){
                            public void visitCode(){
                                super.visitCode();super.visitLdcInsn(label);
                                if(label.equals("type"))super.visitVarInsn(Opcodes.ILOAD,1);else super.visitInsn(Opcodes.ICONST_0);
                                super.visitMethodInsn(Opcodes.INVOKESTATIC,"LocRemoveOracle","call","(Ljava/lang/String;I)V",false);
                            }
                        };
                    }
                },0);
                Files.write(output.resolve(owner+".class"),w.toByteArray());
            }
        }
        if(!found.equals(names.keySet()))throw new AssertionError(found);
    }
    static String flags(int[][] cells) {
        if(cells==null)return "-";
        for(int[] row:cells) {
            if(row==null){sha.update((byte)0);continue;}
            ByteBuffer b=ByteBuffer.allocate(row.length*4);
            for(int n:row)b.putInt(n);
            sha.update(b.array());
        }
        return HexFormat.of().formatHex(sha.digest());
    }
    static String cell(ra s,ec sprite) {
        if(s==null)return "-";
        StringJoiner refs=new StringJoiner(",");
        for(ec e:s.H)refs.add(e==null?"0":e==sprite?"1":"2");
        return (s.z!=null?"1":"0")+(s.C!=null?"1":"0")+(s.u!=null?"1":"0")+":"+s.t+":"+s.P+":"+Arrays.toString(s.A)+":"+refs;
    }
    static String run(int[] r){
        int layer=r[0],shape=r[1],angle=r[2],plane=r[3],x=r[4],z=r[5],id=r[9],sound=r[10];
        mode=r[11];failAt=r[12];step=0;trace=new StringJoiner(",");
        type=new jb();type.k=id;type.fb=r[6];type.y=r[7];type.qb=r[8];type.M=r[13]!=0;
        type.E=sound==1?29:-1;if(sound==2)type.mb=new int[0];if(sound==3)type.e=new int[]{-1,10101};
        jb child=new jb();child.k=10101;child.mb=new int[0];
        jb zero=id==0?type:new jb();zero.k=0;zero.E=sound==0?-1:800;
        he.w=new ve(64);he.w.a(0L,zero,(byte)-71);he.w.a((long)id,type,(byte)-71);he.w.a(10101L,child,(byte)-71);
        kl.Bb=new ra[4][104][104];
        square=null;ra neighbor=null;ec sprite=new ec();
        if(plane>=0&&plane<4&&x>=0&&x<104&&z>=0&&z<104&&mode!=1) {
            square=kl.Bb[plane][x][z]=new ra(plane,x,z);
            long key=mode==2?0L:Long.MIN_VALUE|((long)id<<32)|0x40000000L|((long)(angle&3)<<20)|((long)(shape&63)<<14)|0x39L;
            square.z=new hk();square.z.f=key;square.C=new nf();square.C.a=key;square.u=new pk();square.u.e=key;
            sprite.w=plane;sprite.a=x;sprite.n=mode==12?104:Math.min(x+1,103);sprite.y=sprite.m=z;
            sprite.u=key;
            ec other=new ec();square.H[0]=other;square.H[1]=sprite;square.H[2]=other;square.t=3;
            square.A[0]=1;square.A[1]=4;square.A[2]=8;square.P=13;
            if(x+1<104){neighbor=kl.Bb[plane][x+1][z]=new ra(plane,x+1,z);neighbor.H[0]=sprite;neighbor.t=1;neighbor.A[0]=9;neighbor.P=9;}
            if(mode==9)square.H[0]=null;
            if(mode==10)square.A=new int[1];
        }
        ke collision=new ke(104,104);
        for(int[] row:collision.d)Arrays.fill(row,-1);
        if(mode==4)collision.d=null;
        if(mode==5&&x>=0&&x<104)collision.d[x]=new int[Math.max(0,z)];
        nc.j=new gk();ik[] sounds=new ik[3];
        for(int i=0;i<sounds.length;i++) {
            ik s=sounds[i]=new ik();s.L=plane;s.C=(x+(i==0?1:0))*128;s.M=z*128;
            s.x=mode==1||mode==2||layer<0||layer>3?zero:type;nc.j.a(s,false);
        }
        if(mode==6)sounds[1].x=null;
        if(mode==7)kl.Bb=null;
        if(mode==8)he.w=null;
        String result="ok";active=true;
        try{af.a(mode==3?null:collision,x,(byte)36,r[14],plane,z,layer);}
        catch(RuntimeException err) {
            Throwable t=err;while(t instanceof g)t=((g)t).a;
            if(t instanceof NullPointerException)result="null";
            else if(t instanceof ArrayIndexOutOfBoundsException)result="index "+t.getMessage().split(" ")[1];
            else if(t instanceof IllegalArgumentException&&"observation".equals(t.getMessage()))result="injected";
            else throw err;
        }finally{active=false;}
        String links="";for(ik s:sounds)links+=s.p==null?'0':'1';
        return result+"|"+trace+"|"+links+"|"+cell(square,sprite)+"|"+cell(neighbor,sprite)+"|"+flags(collision.d);
    }
    public static void main(String[] args)throws Exception{
        if(args.length==2){prepare(Path.of(args[0]),Path.of(args[1]));return;}
        sha=MessageDigest.getInstance("SHA-256");BufferedReader in=new BufferedReader(new InputStreamReader(System.in));String line;
        while((line=in.readLine())!=null)System.out.println(run(Arrays.stream(line.split(" ")).mapToInt(Integer::parseInt).toArray()));
    }
}
