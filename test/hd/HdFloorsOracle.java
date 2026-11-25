import java.io.*;
import java.lang.reflect.Field;
import java.nio.ByteBuffer;
import java.nio.file.*;
import java.security.MessageDigest;
import java.util.*;
import java.util.zip.CRC32;
import jdk.internal.org.objectweb.asm.*;

public class HdFloorsOracle {
    // Preserve ni's arithmetic and log the actual destination of each colour field store.
    static void traceUnderlayStores(Path dir) throws Exception {
        try (InputStream input = HdFloorsOracle.class.getResourceAsStream("/ni.class")) {
            ClassReader reader = new ClassReader(input);
            ClassWriter writer = new ClassWriter(reader, ClassWriter.COMPUTE_MAXS);
            reader.accept(new ClassVisitor(Opcodes.ASM8, writer) {
                public MethodVisitor visitMethod(int access, String name, String desc, String sig, String[] ex) {
                    MethodVisitor mv = super.visitMethod(access, name, desc, sig, ex);
                    if (!name.equals("a") || !desc.equals("(IB)V")) return mv;
                    return new MethodVisitor(Opcodes.ASM8, mv) {
                        public void visitFieldInsn(int op, String owner, String field, String type) {
                            super.visitFieldInsn(op, owner, field, type);
                            if (op == Opcodes.PUTFIELD && owner.equals("ni")) {
                                super.visitFieldInsn(Opcodes.GETSTATIC, "java/lang/System", "out", "Ljava/io/PrintStream;");
                                super.visitLdcInsn(field);
                                super.visitMethodInsn(Opcodes.INVOKEVIRTUAL, "java/io/PrintStream", "println", "(Ljava/lang/String;)V", false);
                            }
                        }
                    };
                }
            }, 0);
            Files.write(dir.resolve("ni.class"), writer.toByteArray());
        }
    }
    static final Field rgb;
    static { try { rgb=ni.class.getDeclaredField("b");rgb.setAccessible(true); } catch(Exception e){throw new AssertionError(e);} }
    static final class Provider extends v {
        final ii index; final byte[][] groups=new byte[5][];
        Provider(Path dir)throws Exception {
            byte[] reference=Files.readAllBytes(dir.resolve("index"));
            CRC32 crc=new CRC32();crc.update(reference);index=new ii(reference,(int)crc.getValue());
            for(int id:new int[]{1,4})groups[id]=Files.readAllBytes(dir.resolve("group-"+id));
        }
        ii b(int guard){return index;}
        void a(int id,int guard){}
        int b(int id,int guard){return c(id,guard)==null?0:100;}
        byte[] c(int id,int guard){return id>=0&&id<groups.length?groups[id]:null;}
    }
    static String fields(Object type)throws Exception {
        if(type instanceof wl a)return a.j+","+a.l+","+a.p+","+a.f+","+a.w+","+a.x+","+a.t+","+a.y+","+a.z+","+a.m;
        ni a=(ni)type;return rgb.getInt(a)+","+a.m+","+a.o+","+a.l+","+a.u+","+a.d+","+a.r+","+a.i;
    }
    static Object list(int group,int file){return group==4?um.a((byte)-117,file):qc.a(true,file);}
    static String failure(RuntimeException ex){
        Throwable error=ex instanceof ld w?w.f:ex;
        if(error instanceof ClassCastException)return "cast";
        if(error instanceof ArrayIndexOutOfBoundsException)return "bounds:"+error.getMessage().split(" ")[1];
        if(error instanceof NullPointerException)return "null";
        throw ex;
    }
    static void colourPlanes()throws Exception {
        MessageDigest sha=MessageDigest.getInstance("SHA-256");
        ByteBuffer plane=ByteBuffer.allocate(65536 * 6 * Integer.BYTES);
        byte[] fluBytes={1,0,0,0,0},floBytes={1,0,0,0,7,0,0,0,0};
        wa fluPacket=new wa(fluBytes),floPacket=new wa(floBytes);
        ni flu=new ni();wl flo=new wl();
        for(int red=0;red<256;red++){
            plane.clear();
            fluBytes[1]=floBytes[1]=floBytes[5]=(byte)red;
            for(int green=0;green<256;green++){
                fluBytes[2]=floBytes[2]=floBytes[6]=(byte)green;
                for(int blue=0;blue<256;blue++){
                    fluBytes[3]=floBytes[3]=floBytes[7]=(byte)blue;
                    fluPacket.T=0;flu.a(0,fluPacket,255);
                    floPacket.T=0;flo.a(24559,floPacket,0);
                    plane.putInt(flu.i).putInt(flu.d).putInt(flu.r).putInt(flu.u).putInt(flo.z).putInt(flo.t);
                }
            }
            System.out.println(HexFormat.of().formatHex(sha.digest(plane.array())));
        }
    }
    public static void main(String[] args)throws Exception {
        if(args[0].equals("instrument")){traceUnderlayStores(Path.of(args[1]));return;}
        if(args[0].equals("helpers")){
            for(int rgb:new int[]{0,0x123456,0x808080,0xffffff,0xff00ff}){
                for(int guard:new int[]{-110,96,97,116})System.out.println(be.a(guard,rgb));
                for(int seed:new int[]{Integer.MIN_VALUE,-8388609,-1,0,1,2,8388608,Integer.MAX_VALUE})System.out.println(ib.a(seed,rgb));
                ni underlay=new ni();
                underlay.a(0,new wa(new byte[]{1,(byte)(rgb>>>16),(byte)(rgb>>>8),(byte)rgb,0}),255);
            }
            return;
        }
        if(args[0].equals("rgb")){colourPlanes();return;}
        ve archive=new ve(new Provider(Path.of(args[0])),false,false);
        qc.a(false,archive);hc.a(archive,-1);
        System.out.println("bind "+(cl.J==archive)+" "+(oj.x==archive)+" "+hj.a+" "+ca.db);
        for(int group:new int[]{1,4}){
            int[] ids=archive.a((byte)-128,group);
            for(int id:ids){
                Object type=list(group,id);
                System.out.println("file "+group+" "+id+" "+fields(type)+" "+ca.db+" "+(list(group,id)==type));
            }
            Object missing=list(group,-1);System.out.println("missing "+group+" "+fields(missing)+" "+(missing==list(group,-1)));
            n cache=group==4?t.p:gj.p;
            // Table entry is published only after decoding. Opcode 8, however,
            // updates the global default water immediately, even if opcode 9 fails.
            Field unpacked=ve.class.getDeclaredField("A");unpacked.setAccessible(true);
            Object[] files=((Object[][])unpacked.get(archive))[group];
            int damaged=ids[0];files[damaged]=group==4?new byte[]{8,9,12}:new byte[]{3,12};
            cache.c(3);
            try{list(group,damaged);throw new AssertionError();}
            catch(RuntimeException ex){System.out.println("broken "+group+" "+failure(ex)+" "+ca.db+" "+(cache.b((long)damaged,(byte)121)==null));}
            files[damaged]=group==4?new byte[]{9,0,76,0}:new byte[]{3,0,76,0};
            System.out.println("repaired "+group+" "+fields(list(group,damaged)));
            cache.a((byte)-109,new Object(),-3);
            try{list(group,-3);throw new AssertionError();}catch(RuntimeException ex){System.out.println("cast "+group+" "+failure(ex));}
            Object cached=list(group,ids[0]);
            if(group==1)hc.a((ve)null,-1);
            else {try{qc.a(false,null);throw new AssertionError();}catch(RuntimeException ex){System.out.println("bind-null "+failure(ex)+" "+hj.a);}}
            System.out.println("cached "+group+" "+(list(group,ids[0])==cached));
            try{list(group,-2);throw new AssertionError();}catch(RuntimeException ex){System.out.println("miss "+group+" "+failure(ex));}
        }
        BufferedReader in=new BufferedReader(new InputStreamReader(System.in));
        for(String line;(line=in.readLine())!=null;){
            String[] p=line.split(" ",-1);int group=Integer.parseInt(p[0]),file=Integer.parseInt(p[1]);
            wa packet=new wa(HexFormat.of().parseHex(p[2]));String result="ok";Object type=group==4?new wl():new ni();
            try{if(type instanceof wl a)a.a(24559,packet,file);else ((ni)type).a(file,packet,255);}
            catch(RuntimeException ex){result=failure(ex);}
            System.out.println("decode "+group+" "+file+" "+result+" "+packet.T+" "+fields(type)+" "+ca.db);
        }
    }
}
