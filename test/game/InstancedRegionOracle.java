import java.io.*;
import java.nio.file.*;
import java.util.*;
import java.util.jar.JarFile;
import jdk.internal.org.objectweb.asm.*;

class InstancedRegionOracle {
    static final List<String> placements=new ArrayList<>();
    static void placed(boolean underwater,int plane,int id,int heightPlane,int angle,int shape,int x,int z,boolean surface,ke map,int dummy) {
        placements.add(id+","+plane+","+x+","+z+","+shape+","+angle);
    }
    // Capture the call to nc.a after ck.a has decoded, rotated, clipped and chosen the collision plane.
    // wj.a -> lk.a -> fi.a and jh.a -> ck.a, including both native template decoders, remain executable.
    static void prepare(Path source,Path directory)throws Exception {
        try(JarFile jar=new JarFile(source.toFile())){
            ClassReader reader=new ClassReader(jar.getInputStream(jar.getJarEntry("ck.class")));
            ClassWriter writer=new ClassWriter(0);int[] calls={0};
            reader.accept(new ClassVisitor(Opcodes.ASM8,writer){
                public MethodVisitor visitMethod(int access,String name,String desc,String sig,String[] thrown){
                    MethodVisitor m=super.visitMethod(access,name,desc,sig,thrown);
                    if(!name.equals("a") || !desc.equals("(II[Lke;BII[BIZII)V"))return m;
                    return new MethodVisitor(Opcodes.ASM8,m){
                        public void visitMethodInsn(int op,String cls,String method,String type,boolean itf){
                            if(op==Opcodes.INVOKESTATIC && cls.equals("nc") && method.equals("a")){
                                calls[0]++;super.visitMethodInsn(op,"InstancedRegionOracle","placed",type,false);
                            }else super.visitMethodInsn(op,cls,method,type,itf);
                        }
                    };
                }
            },0);
            if(calls[0]!=1)throw new AssertionError("nc.a calls: "+calls[0]);
            Files.write(directory.resolve("ck.class"),writer.toByteArray());
        }
    }
    static int num(String s){return Integer.parseInt(s);}
    public static void main(String[] args)throws Exception {
        if(args.length!=0){prepare(Path.of(args[0]),Path.of(args[1]));return;}
        BufferedReader in=new BufferedReader(new InputStreamReader(System.in));
        int n=num(in.readLine());rb.i=new int[n];mk.G=new byte[n][];lk.x=new byte[n][];
        for(int i=0;i<n;i++){
            String[] row=in.readLine().split(" ");rb.i[i]=num(row[0]);mk.G[i]=Base64.getDecoder().decode(row[1]);lk.x[i]=Base64.getDecoder().decode(row[2]);
        }
        n=num(in.readLine());for(int i=0;i<n;i++){
            String[] row=in.readLine().split(" ");int id=num(row[0]);jb type=new jb();type.k=id;type.fb=num(row[1]);type.y=num(row[2]);
            he.w.a(id,type,(byte)-71);
        }
        ag.d=new int[4][13][13];for(int[][] plane:ag.d)for(int[] row:plane)Arrays.fill(row,-1);
        n=num(in.readLine());for(int i=0;i<n;i++){
            String[] row=in.readLine().split(" ");ag.d[num(row[0])][num(row[1])][num(row[2])]=num(row[3]);
        }
        hc.c=new ke[4];for(int i=0;i<4;i++)hc.c[i]=new ke(104,104);
        ve.q=new int[4][105][105];ke.E=new byte[4][105][105];tb.t=new byte[4][104][104];
        ka.m=new byte[4][104][104];ib.jb=new byte[4][104][104];lg.A=new byte[4][104][104];qe.V=new byte[4][104][104];vb.c=new byte[4][104][104];
        wj.a(false,99);jh.a((byte)-50,false);
        ByteArrayOutputStream raw=new ByteArrayOutputStream();DataOutputStream tiles=new DataOutputStream(raw);
        for(int plane=0;plane<4;plane++)for(int x=0;x<104;x++)for(int z=0;z<104;z++){
            tiles.writeInt(ve.q[plane][x][z]);tiles.writeByte(tb.t[plane][x][z]);tiles.writeByte(qe.V[plane][x][z]);
            tiles.writeByte(ka.m[plane][x][z]);tiles.writeByte(ib.jb[plane][x][z]);tiles.writeByte(lg.A[plane][x][z]);
            tiles.writeByte(vb.c[plane][x][z]);tiles.writeByte(ke.E[plane][x][z]);
        }
        System.out.println(Base64.getEncoder().encodeToString(raw.toByteArray()));
        System.out.println(String.join(";",placements));
    }
}
