import java.io.*;
import java.nio.file.*;
import java.util.*;
import java.util.jar.JarFile;
import jdk.internal.org.objectweb.asm.*;

public class LocChangeOracle {
    static int step;
    static final StringBuilder calls = new StringBuilder();

    // Only model availability and scene placement are supplied by the fixture.
    // The actual de.a reads the real tile, wall, decor and scenery structures.
    public static boolean ready(jb loc, int unused, int shape) {
        calls.append("r").append(loc.k).append(",").append(shape).append(";");
        return (loc.k + shape + step) % 4 != 0;
    }
    public static void place(int shape,int plane,int id,byte unused,int layer,int x,int angle,int z) {
        calls.append("p").append(plane).append(",").append(x).append(",").append(z).append(",").append(layer)
             .append(",").append(id).append(",").append(shape).append(",").append(angle).append(";");
        if(x>=1 && x<=102 && z>=1 && z<=102) tile(plane,x,z,layer,id,shape,angle);
    }
    static void tile(int plane,int x,int z,int layer,int id,int shape,int angle) {
        ra square = kl.Bb[plane][x][z];
        if(square==null) kl.Bb[plane][x][z]=square=new ra(plane,x,z);
        long key=((long)id<<32) | (2L<<29) | (angle<<20) | (shape<<14) | (z<<7) | x;
        if(layer==0){square.z=null;if(id>=0){square.z=new hk();square.z.f=key;}}
        if(layer==1){square.C=null;if(id>=0){square.C=new nf();square.C.a=key;}}
        if(layer==2){square.t=0;if(id>=0){ec loc=new ec();loc.u=key;loc.a=x;loc.m=z;square.H[0]=loc;square.t=1;}}
        if(layer==3){square.u=null;if(id>=0){square.u=new pk();square.u.e=key;}}
    }
    static void prepare(String jar,String out)throws Exception {
        try(JarFile files=new JarFile(jar)){
            for(String name:new String[]{"bc","od"}){
                ClassReader reader=new ClassReader(files.getInputStream(files.getJarEntry(name+".class")));
                ClassWriter writer=new ClassWriter(0);
                reader.accept(new ClassVisitor(Opcodes.ASM8,writer){
                    public MethodVisitor visitMethod(int access,String n,String desc,String sign,String[] exceptions){
                        MethodVisitor m=super.visitMethod(access,n,desc,sign,exceptions);
                        if(!(name.equals("bc")&&n.equals("a")&&desc.equals("(III)Z") || name.equals("od")&&n.equals("e")&&desc.equals("(B)V"))) return m;
                        return new MethodVisitor(Opcodes.ASM8,m){
                            public void visitMethodInsn(int op,String owner,String method,String d,boolean iface){
                                if(owner.equals("jb")&&method.equals("a")&&d.equals("(II)Z")) super.visitMethodInsn(Opcodes.INVOKESTATIC,"LocChangeOracle","ready","(Ljb;II)Z",false);
                                else if(owner.equals("o")&&method.equals("a")&&d.equals("(IIIBIIII)V")) super.visitMethodInsn(op,"LocChangeOracle","place",d,false);
                                else super.visitMethodInsn(op,owner,method,d,iface);
                            }
                        };
                    }
                },0);
                Files.write(Path.of(out,name+".class"),writer.toByteArray());
            }
        }
    }
    public static void main(String[] args)throws Exception {
        if(args.length>0){prepare(args[0],args[1]);return;}
        kl.Bb=new ra[4][104][104]; wh.S=new gk();
        for(int i=0;i<24;i++){jb type=new jb();type.k=i;he.w.a((long)i,type,(byte)-71);}
        hd.b=new be(50); dg.C=ha.a=48;ah.f=1;
        BufferedReader in=new BufferedReader(new InputStreamReader(System.in));
        for(String line;(line=in.readLine())!=null;step++){
            String[] parts=line.split(" ");
            int[] a=new int[parts.length-1];
            if(!parts[0].equals("wire"))for(int i=0;i<a.length;i++)a[i]=Integer.parseInt(parts[i+1]);
            int pos=-1; boolean failed=false; calls.setLength(0);
            try {
                switch(parts[0]){
                    case "tile" -> tile(a[0],a[1],a[2],a[3],a[4],a[5],a[6]);
                    case "add" -> b.a(a[0],false,a[1],a[2],a[3],a[4],a[5],a[6],a[7],a[8]);
                    case "tick" -> od.e((byte)-118);
                    case "build" -> l.b(true);
                    case "wire" -> {
                        hd.b.fb=parts.length==3?HexFormat.of().parseHex(parts[2]):new byte[0];
                        hd.b.yb=0;o.Y=Integer.parseInt(parts[1]);qd.a(64);
                    }
                }
            } catch (RuntimeException ex){failed=true;}
            if(parts[0].equals("wire"))pos=hd.b.yb;
            StringBuilder state=new StringBuilder();
            for(ff n=(ff)wh.S.d(0);n!=null;n=(ff)wh.S.a(0)){
                state.append(Arrays.toString(new int[]{n.r,n.t,n.w,n.z,n.B,n.C,n.D,n.F,n.K,n.L,n.N,n.O}));
            }
            System.out.println(pos+"|"+failed+"|"+calls+"|"+state);
        }
    }
}
