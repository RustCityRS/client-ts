import java.io.*;
import java.lang.reflect.Field;
import java.nio.file.*;
import java.util.Random;
import jdk.internal.org.objectweb.asm.*;
import jdk.internal.org.objectweb.asm.tree.*;

// Trace the original uk.a entry and kg.a return. Both gamepack methods still
// run in full, including the real procedural texture generator.
public class FinishBuildOracle {
    static final String GROUND="("+"I".repeat(20)+")V";
    static DataOutputStream calls;
    static int tiles,textures;
    static void traceTile(int a,int b,int c,int d,int e,int f,int g,int h,int i,int j,
                          int k,int l,int m,int n,int o,int p,int q,int r,int s,int t)throws IOException {
        for(int value:new int[]{a,b,c,d,e,f,g,h,i,j,k,l,m,n,o,p,q,r,s,t})calls.writeInt(value);
        tiles++;
    }
    static void traceTexture(int[] pixels){if(pixels!=null)textures++;}
    static void patch(Path temp,String owner,String descriptor)throws IOException {
        ClassNode node=new ClassNode();
        try(InputStream stream=FinishBuildOracle.class.getResourceAsStream("/"+owner+".class")){
            new ClassReader(stream).accept(node,0);
        }
        MethodNode target=node.methods.stream().filter(m->m.name.equals("a")&&m.desc.equals(descriptor)).findFirst().orElseThrow();
        if(owner.equals("uk")){
            InsnList prefix=new InsnList();
            for(int i=0;i<20;i++)prefix.add(new VarInsnNode(Opcodes.ILOAD,i));
            prefix.add(new MethodInsnNode(Opcodes.INVOKESTATIC,"FinishBuildOracle","traceTile",descriptor,false));
            target.instructions.insert(prefix);
        } else {
            for(AbstractInsnNode insn:target.instructions.toArray())if(insn.getOpcode()==Opcodes.ARETURN){
                InsnList trace=new InsnList();trace.add(new InsnNode(Opcodes.DUP));
                trace.add(new MethodInsnNode(Opcodes.INVOKESTATIC,"FinishBuildOracle","traceTexture","([I)V",false));
                target.instructions.insertBefore(insn,trace);
            }
        }
        ClassWriter writer=new ClassWriter(ClassWriter.COMPUTE_MAXS);node.accept(writer);
        Files.write(temp.resolve(owner+".class"),writer.toByteArray());
    }
    static al archive(String dir,int id)throws Exception{return new al(new ProviderConfigOracle.Provider(dir,id),false,false);}
    static DataOutputStream output(Path dir,String name)throws IOException{
        return new DataOutputStream(new BufferedOutputStream(Files.newOutputStream(dir.resolve(name+".bin"))));
    }
    static void seed(long seed)throws Exception{
        Field field=Class.forName("java.lang.Math$RandomNumberGeneratorHolder").getDeclaredField("randomNumberGenerator");
        field.setAccessible(true);((Random)field.get(null)).setSeed(seed);
    }
    public static void main(String[] args)throws Exception {
        Path dir=Path.of(args[1]);
        if(args[0].equals("patch")){patch(dir,"uk",GROUND);patch(dir,"kg","(IFI)[I");return;}
        String cache=args[0];
        aj.ec=ik.V=archive(cache,2);ik.Y=archive(cache,7);ag.i=archive(cache,20);uk.d=archive(cache,1);
        ef.K=archive(cache,0);ma.g=archive(cache,22);gd.U=archive(cache,16);
        dc.r=new kg(archive(cache,9),archive(cache,26),archive(cache,8),20,false);
        mc.a(4,104,104,25,false);aj.a(false,-17);tb.t=new byte[4][104][104];ok.z=true;
        ke[] clip=new ke[4];for(int p=0;p<4;p++)clip[p]=new ke(104,104);
        int[] ids={254,256,380,382};
        for(int i=0;i<4;i++){
            int x=(49+(i>>1))*64-3160,z=(49+(i&1))*64-3160;
            nk.a(z,false,3160,31375,x,Files.readAllBytes(dir.resolve("map"+ids[i]+".bin")),3160,clip);
        }
        seed(53001);
        for(int i=0;i<4;i++){
            int x=(49+(i>>1))*64-3160,z=(49+(i&1))*64-3160;
            hi.a((byte)-109,x,clip,Files.readAllBytes(dir.resolve("loc"+ids[i]+".bin")),z,false);
        }
        try(var shadow=output(dir,"shadow")){for(byte[][] plane:ke.E)for(byte[] row:plane)shadow.write(row);}
        seed(53002);dc.a(0.8f);
        ki.X=0;si.u=0;seed(53003);
        try(var stream=output(dir,"tiles")){calls=stream;al.a(128,clip,false);}
        try(var out=output(dir,"collision")){for(ke plane:clip)for(int[] row:plane.d)for(int v:row)out.writeInt(v);}
        try(var out=output(dir,"occluders")){
            for(int i=0;i<mc.P;i++){jg box=ll.c[i];for(int v:new int[]{box.d,box.c,box.g,box.i,box.o,box.a,box.u})out.writeInt(v);}
        }
        int[] frame=new int[512*334];td.a(frame,512,334);dc.d();seed(53004);
        qc.a(6500,-1080,5700,256,0,null,null,null,null,null,null,0,(byte)0,50,50);
        try(var out=output(dir,"frame")){for(int pixel:frame)out.writeInt(pixel);}
        java.util.Arrays.fill(frame,0);
        qc.a(3904,-900,3250,256,0,null,null,null,null,null,null,0,(byte)0,30,32);
        try(var out=output(dir,"river")){for(int pixel:frame)out.writeInt(pixel);}
        System.out.println(tiles+" "+mc.P+" "+textures+" "+ki.X+" "+si.u);
    }
}
