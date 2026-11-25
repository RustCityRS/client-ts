import java.io.*;
import java.net.Socket;
import java.lang.reflect.Field;
import java.nio.file.*;
import java.util.*;
import java.util.jar.JarFile;
import jdk.internal.org.objectweb.asm.*;

// Runs the original qk.a directly and through rg.a with all four scene getters,
// real ml constructors and both definition caches. The second run records qk.a
// entry arguments before its coordinate guard and still executes the original body.
public class LocAttachOracle {
    static final ra[][][] tiles = new ra[4][104][104];
    static final Field[] fields = new Field[13];
    static final String[] names = {"L","o","s","j","A","y","F","B","G","I","R","P","D"};
    static ek same, fresh;
    static fc plain;
    static ml first, second;
    static StringJoiner attachments;
    static void observe(int x,int angle,int seq,int z,int shape,int level,int layer) {
        attachments.add(String.join(",",String.valueOf(x),String.valueOf(angle),String.valueOf(seq),
            String.valueOf(z),String.valueOf(shape),String.valueOf(level),String.valueOf(layer)));
    }
    static void instrument(String path,String dest)throws Exception {
        try(JarFile jar=new JarFile(path)) {
            ClassReader source=new ClassReader(jar.getInputStream(jar.getJarEntry("qk.class")));
            ClassWriter out=new ClassWriter(0);
            source.accept(new ClassVisitor(Opcodes.ASM8,out){
                public MethodVisitor visitMethod(int access,String name,String desc,String sig,String[] exceptions) {
                    MethodVisitor visitor=super.visitMethod(access,name,desc,sig,exceptions);
                    if(!name.equals("a")||!desc.equals("(IIIIIIII)V"))return visitor;
                    return new MethodVisitor(Opcodes.ASM8,visitor){
                        public void visitCode() {
                            super.visitCode();
                            for(int i=1;i<=7;i++)super.visitVarInsn(Opcodes.ILOAD,i);
                            super.visitMethodInsn(Opcodes.INVOKESTATIC,"LocAttachOracle","observe","(IIIIIII)V",false);
                        }
                    };
                }
            },0);
            Files.write(Path.of(dest,"qk.class"),out.toByteArray());
        }
    }
    static void receive(int opcode,int[] row)throws Exception {
        int length=row.length-10;
        byte[] bytes=new byte[length+1];
        for(int i=0;i<length;i++)bytes[i]=(byte)row[10+i];
        Socket socket=new Socket(){
            public void setSoTimeout(int timeout){} public void setTcpNoDelay(boolean enabled){}
            public InputStream getInputStream(){return new ByteArrayInputStream(bytes);}
            public OutputStream getOutputStream(){return OutputStream.nullOutputStream();}
        };
        ek.s=new se(socket,null);o.Y=opcode;af.I=length;hd.b=new be(length);
        if(!rg.a((byte)57))throw new AssertionError("packet not consumed");
    }
    static String model(ug value) throws Exception {
        if (value==null) return "~";
        if (value==plain) return "p";
        if (value==first) return "a";
        if (value==second) return "b";
        ml animation = (ml)value;
        StringJoiner parts = new StringJoiner(",");
        for (int i=0;i<fields.length;i++) {
            Object v=fields[i].get(animation);
            parts.add(i==6 ? v==null?"-":v==same?"s":v==fresh?"f":"?" : v.toString());
        }
        return parts.toString();
    }
    static int id(int variant,int i) {
        return switch(variant) { case 0 -> 0x73123450+i; case 1 -> i; default -> 0x7fffffff-i; };
    }
    static long key(int variant,int i) { return ((id(variant,i)|0x80000000L)<<32)|0x40034142L; }
    static ek seq(int id,int behaviour,int length) {
        ek type=new ek();type.f=id;type.b=behaviour;type.g=length<0?null:new int[length];type.G=3;
        ga.B.a(id,type,(byte)-71);return type;
    }
    static void run(int[] v) throws Exception {
        attachments=new StringJoiner(";");
        int layer=v[0], shape=v[1], angle=v[2], seq=v[3], x=v[4], z=v[5], level=v[6], mode=v[7], variant=v[8];
        int p=Math.max(0,Math.min(3,level)), tx=Math.max(0,Math.min(103,x)), tz=Math.max(0,Math.min(103,z));
        hh.kb = variant==2?Integer.MIN_VALUE:579;
        he.w.a(0);
        for (int i=0;i<4;i++) {
            if (mode==7) continue;
            jb loc=new jb();loc.k=id(variant,i);if (mode!=5) loc.e=new int[]{54,-1};
            he.w.a(loc.k,loc,(byte)-71);
        }
        kl.Bb=tiles;
        ra tile = new ra(p,tx,tz); tiles[p][tx][tz]=tile;
        hk wall=new hk(); nf decor=new nf(); ec sprite=new ec(); pk ground=new pk();
        wall.f=key(variant,0);decor.a=key(variant,1);sprite.u=key(variant,2);ground.e=key(variant,3);
        sprite.a=tx;sprite.m=tz;
        ug a=first,b=second;
        if (mode==1) a=b=plain;
        if (mode==2||mode==5) a=b=null;
        if (mode==3) a=b=first;
        if (mode==4||mode==7) b=null;
        wall.i=decor.i=sprite.z=ground.d=a;
        wall.c=decor.k=b;
        ec distract=new ec(); distract.a=tx+1;distract.m=tz;distract.u=sprite.u;distract.z=plain;
        ec category=new ec(); category.a=tx;category.m=tz;category.u=0x20000000;category.z=plain;
        tile.z=wall;tile.C=decor;tile.u=ground;tile.H[0]=distract;tile.H[1]=category;tile.H[2]=sprite;tile.t=3;
        switch(mode) {
            case 8 -> {tile.z=null;tile.C=null;tile.u=null;tile.t=2;}
            case 9 -> tiles[p][tx][tz]=null;
            case 10 -> kl.Bb=null;
            case 11 -> kl.Bb=new ra[0][][];
            case 12 -> kl.Bb=new ra[4][][];
            case 13 -> kl.Bb=new ra[4][104][0];
            case 14 -> tile.H[1]=null;
            case 15 -> {Arrays.fill(tile.H,distract);tile.t=6;}
            case 16 -> tile.H=null;
        }
        String status="ok",context="";
        boolean packet=v.length>9;
        if(packet){
            dg.C=x-3;ha.a=z-5;
            ah.f=v[9]==235?(level+1)&3:level;
            hk.e=3200;vj.t=6400;
        }
        try {
            if(packet)receive(v[9],v);
            else qk.a(2047,x,angle,seq,z,shape,level,layer);
        }
        catch(RuntimeException e) {
            context=e instanceof g wrapped?wrapped.q:"";
            Throwable t=e;while(t instanceof g wrapper)t=wrapper.a;
            if (t instanceof NullPointerException) status="null";
            else if(t instanceof ArrayIndexOutOfBoundsException) status="bounds";
            else throw e;
        }
        System.out.println(String.join("/",status+"~"+context,model(wall.i),model(wall.c),model(decor.i),model(decor.k),
            model(sprite.z),model(ground.d),model(distract.z),model(category.z),Boolean.toString(wall.i==wall.c),
            Boolean.toString(decor.i==decor.k)) + (packet?"|"+hd.b.yb+"|"+o.Y+"|"+attachments:""));
    }
    public static void main(String[] args) throws Exception {
        if(args.length>0){instrument(args[0],args[1]);return;}
        for (int i=0;i<names.length;i++) { fields[i]=ml.class.getDeclaredField(names[i]);fields[i].setAccessible(true); }
        same=seq(7,0,4);fresh=seq(8,2,1);seq(9,0,-1);gd.U=null;ag.i=null;
        plain=new fc();
        first=new ml(54,3,1,0,2,6,7,false,plain);
        second=new ml(55,3,1,0,2,6,7,false,plain);
        for (int i=7;i<=10;i++) {
            fields[i].setInt(first,new int[]{2,473,1,15}[i-7]);
            fields[i].setInt(second,new int[]{3,865,2,17}[i-7]);
        }
        BufferedReader input=new BufferedReader(new InputStreamReader(System.in));
        for(String line;(line=input.readLine())!=null;)run(Arrays.stream(line.split(" ")).mapToInt(Integer::parseInt).toArray());
    }
}
