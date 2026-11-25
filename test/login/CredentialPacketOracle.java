import java.io.*;
import java.nio.file.*;
import java.util.*;
import java.util.jar.*;
import jdk.internal.org.objectweb.asm.*;
import jdk.internal.org.objectweb.asm.tree.*;

final class CredentialPacketOracle {
    static gd block;
    static be alternate;
    static id alternateText;
    static int reads,changeAt,mode,draws;

    public static void capture(gd packet) { block=packet; }
    public static void beforePacket() {
        if (++reads==changeAt) qk.v=mode==1?null:alternate;
    }
    public static void afterDraw() {
        draws++;
        if (draws==1 && (mode==2 || mode==3)) ga.G=mode==2?alternateText:null;
        if (draws==2 && (mode==4 || mode==5)) ga.F=mode==4?alternateText:null;
        if (draws==3 && mode==6) ce.F=0x7654;
    }

    // Keep the gamepack implementation and its normal exception handlers. Expose
    // the local packet and schedule a field replacement at a chosen instruction.
    static void instrument(Path dir,String cls,String descriptor) throws Exception {
        ClassReader reader;
        try(InputStream in=CredentialPacketOracle.class.getResourceAsStream("/"+cls+".class")){reader=new ClassReader(in);}
        ClassWriter writer=new ClassWriter(reader,ClassWriter.COMPUTE_MAXS);
        reader.accept(new ClassVisitor(Opcodes.ASM8,writer){
            @Override public MethodVisitor visitMethod(int access,String name,String desc,String signature,String[] exceptions){
                MethodVisitor mv=super.visitMethod(access,name,desc,signature,exceptions);
                if(!name.equals("a") || !desc.equals(descriptor))return mv;
                return new MethodVisitor(Opcodes.ASM8,mv){
                    @Override public void visitFieldInsn(int op,String owner,String field,String type){
                        if(op==Opcodes.GETSTATIC && owner.equals("qk") && field.equals("v"))
                            super.visitMethodInsn(Opcodes.INVOKESTATIC,"CredentialPacketOracle","beforePacket","()V",false);
                        super.visitFieldInsn(op,owner,field,type);
                    }
                    @Override public void visitMethodInsn(int op,String owner,String method,String type,boolean iface){
                        super.visitMethodInsn(op,owner,method,type,iface);
                        if(op==Opcodes.INVOKESPECIAL && owner.equals("gd") && method.equals("<init>") && type.equals("(I)V")){
                            super.visitInsn(Opcodes.DUP);
                            super.visitMethodInsn(Opcodes.INVOKESTATIC,"CredentialPacketOracle","capture","(Lgd;)V",false);
                        }
                        if(op==Opcodes.INVOKESTATIC && owner.equals("java/lang/Math") && method.equals("random"))
                            super.visitMethodInsn(Opcodes.INVOKESTATIC,"CredentialPacketOracle","afterDraw","()V",false);
                    }
                };
            }
        },0);
        Files.write(dir.resolve(cls+".class"),writer.toByteArray());
    }

    static id text(int spec,boolean name) {
        if(spec==-1)return null;
        id value=new id();
        int length=spec<0?2:spec;
        if(spec==-2)value.A=null;
        else {
            value.A=new byte[spec==-3?1:length];
            String source=name?"Fixture530":"test-only-";
            for(int i=0;i<value.A.length;i++)value.A[i]=(byte)source.charAt(i%source.length());
        }
        value.c=spec==-4?-3:length;
        return value;
    }
    static String bytes(gd p){
        return p==null?"-":p.yb+","+(p.fb==null?"null":HexFormat.of().formatHex(p.fb));
    }
    static String ref(id value,id original){return value==null?"null":value==alternateText?"changed":value==original?"input":"old";}
    static void execute(int[] v) {
        long name=v.length>8?new long[]{0L,-1L,Long.MIN_VALUE,Long.MAX_VALUE}[v[8]]:0x05a4_8927_a1c4_572bL;
        switch(v[0]){
            case 0 -> lg.a(user,password,11,v[5]);
            case 1 -> me.a(name,0x12345,-1972,0x101,password,0x103,120);
            case 2 -> wi.a(0x103,0x12345,-1972,0x101,9);
            case 3 -> hh.a(name,-121);
        }
    }
    static id user,password;
    static void checkCallers(Path gamepack)throws Exception{
        List<String> callers=new ArrayList<>();
        try(JarFile jar=new JarFile(gamepack.toFile())){
            for(var entry:Collections.list(jar.entries()))if(entry.getName().endsWith(".class")){
                ClassNode cls=new ClassNode();
                try(InputStream in=jar.getInputStream(entry)){new ClassReader(in).accept(cls,ClassReader.SKIP_DEBUG|ClassReader.SKIP_FRAMES);}
                for(MethodNode m:cls.methods)for(AbstractInsnNode n:m.instructions)
                    if(n instanceof MethodInsnNode call && call.owner.equals("lg") && call.name.equals("a") && call.desc.equals("(Lid;Lid;II)V")){
                        AbstractInsnNode p=n.getPrevious();while(p.getOpcode()<0)p=p.getPrevious();
                        int constant;
                        if(p instanceof IntInsnNode push)constant=push.operand;
                        else if(p.getOpcode()>=Opcodes.ICONST_M1 && p.getOpcode()<=Opcodes.ICONST_5)constant=p.getOpcode()-Opcodes.ICONST_0;
                        else throw new AssertionError("nonconstant login offset in "+cls.name+"."+m.name);
                        callers.add(cls.name+"."+m.name+m.desc+":"+constant);
                    }
            }
        }
        System.out.println(String.join(",",callers));
    }
    public static void main(String[] args)throws Exception{
        if(args.length!=0){
            checkCallers(Path.of(args[1]));
            Path dir=Path.of(args[0]);instrument(dir,"lg","(Lid;Lid;II)V");instrument(dir,"me","(JIIILid;II)V");
            instrument(dir,"wi","(IIIII)V");instrument(dir,"hh","(JI)V");return;
        }
        var randomField=Class.forName("java.lang.Math$RandomNumberGeneratorHolder").getDeclaredField("randomNumberGenerator");
        randomField.setAccessible(true);Random rng=(Random)randomField.get(null);
        alternateText=text(8,true);user=text(5,true);password=text(6,false);
        // Resolve all initialization effects before controlling the Math.random seed.
        for(int op=0;op<4;op++) {qk.v=new be(5000);qj.C=-1;execute(new int[]{op,0,0,0,0,0});}
        ii.b(0);
        BufferedReader input=new BufferedReader(new InputStreamReader(System.in));
        for(String line;(line=input.readLine())!=null;){
            int[] v=Arrays.stream(line.split(" ")).mapToInt(Integer::parseInt).toArray();
            user=text(v[2],true);password=text(v[3],false);
            ga.G=ga.F=text(1,false);qj.C=v[1];ce.F=0x527a;mode=v[7];changeAt=v[6];reads=draws=0;block=null;
            dg.h=31;pe.P=32;g.f=33;hg.b=34;fk.cb=35;
            gl.t=36;nb.e=37;t.L=38;ge.Q=39;
            kl.X=40;sc.V=true;tk.d=41;nk.U=42;od.O=43;il.K=44;
            byte[] storage=v[4]<0?null:new byte[v[4]];
            if(storage!=null)Arrays.fill(storage,(byte)0xb5);
            wk.r[0]=storage;lc.C=1;qk.v=new be(5000);be initial=qk.v;initial.yb=7;
            byte[] other=new byte[73];Arrays.fill(other,(byte)0xe3);
            alternate=new be(0);alternate.fb=other;alternate.yb=3;
            rng.setSeed(543210);
            String fault="ok";
            try{execute(v);}catch(RuntimeException e){
                Throwable cause=e;while(cause instanceof g wrap && wrap.a!=null)cause=wrap.a;
                fault=cause instanceof NullPointerException?"null":cause instanceof IndexOutOfBoundsException?"bounds":cause.getClass().getSimpleName();
            }
            var fields=new StringJoiner(",");
            for(int field:new int[]{dg.h,pe.P,g.f,hg.b,fk.cb,gl.t,nb.e,t.L,ge.Q,kl.X,tk.d,nk.U,od.O,il.K,ce.F})fields.add(""+field);
            System.out.println(String.join(";",fault,fields.toString(),""+sc.V,ref(ga.G,user),ref(ga.F,password),bytes(initial),bytes(alternate),
                qk.v==null?"null":qk.v==initial?"first":"second",bytes(block),""+lc.C,""+(wk.r[0]==null),""+(initial.fb==storage),
                ""+reads,""+draws,""+rng.nextInt()));
        }
    }
}
