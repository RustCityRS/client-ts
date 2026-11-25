import java.io.*;
import java.lang.reflect.Array;
import java.lang.reflect.Field;
import java.nio.file.*;
import java.security.MessageDigest;
import java.util.*;
import java.util.jar.JarFile;
import jdk.internal.org.objectweb.asm.*;

public final class GroundSquareOracle {
    // Native order used only to enumerate observable state. The methods execute from the gamepack.
    static final String[] names = {"vk.O","t.ab","tf.E","lc.A","li.B","ke.E","lg.A","ti.db","qe.V","ka.m","ib.jb",
        "je.Z","sb.h","tb.t","ve.q","lf.g"};
    static final int[] tiles = {13,8,9,10,6,14,15};
    static final Field[] fields = new Field[names.length];
    static final List<String> writes = new ArrayList<>();

    public static void store(String field) { writes.add(field); }

    // Observe after each original store without changing its operands or the actual stored reference.
    static void instrument(Path jarFile, Path dir) throws Exception {
        try (JarFile jar = new JarFile(jarFile.toFile())) {
            for (String cls : new String[]{"aj","lk"}) {
                ClassReader reader = new ClassReader(jar.getInputStream(jar.getJarEntry(cls+".class")));
                ClassWriter writer = new ClassWriter(ClassWriter.COMPUTE_MAXS);
                reader.accept(new ClassVisitor(Opcodes.ASM8, writer) {
                    public MethodVisitor visitMethod(int access,String name,String desc,String sig,String[] thrown) {
                        MethodVisitor visitor = super.visitMethod(access,name,desc,sig,thrown);
                        if (!(cls.equals("aj") ? name.equals("a") && desc.equals("(ZI)V") : name.equals("c") && desc.equals("(I)V"))) return visitor;
                        return new MethodVisitor(Opcodes.ASM8, visitor) {
                            public void visitFieldInsn(int op,String owner,String field,String type) {
                                super.visitFieldInsn(op,owner,field,type);
                                String id=owner+"."+field;
                                if (op==Opcodes.PUTSTATIC && Arrays.asList(names).contains(id)) {
                                    super.visitLdcInsn(id);
                                    super.visitMethodInsn(Opcodes.INVOKESTATIC,"GroundSquareOracle","store","(Ljava/lang/String;)V",false);
                                }
                            }
                        };
                    }
                },0);
                Files.write(dir.resolve(cls+".class"),writer.toByteArray());
            }
        }
    }

    static String lifecycle(String op) throws Exception {
        Object[] before = new Object[names.length];
        for(int i=0;i<before.length;i++) before[i]=fields[i].get(null);
        writes.clear();
        if(op.equals("quit")) lk.c(8428);
        else aj.a(op.equals("water"),-122);
        StringJoiner state = new StringJoiner(" ");
        state.add(String.join(",",writes));
        for(int i=0;i<fields.length;i++) {
            Object value=fields[i].get(null);
            if(value==null) {state.add("-");continue;}
            if(value instanceof Integer){state.add(value.toString());continue;}
            String token=value==before[i]?"same":"new";
            Object part=value;
            while(part.getClass().isArray()) {
                int n=Array.getLength(part);
                token+=":"+n;
                part=Array.get(part,n-1);
            }
            state.add(token+":"+part);
            // Tag the final cell, so the following call distinguishes zeroed fresh arrays from reused ones.
            part=value;
            while(part.getClass().getComponentType().isArray())part=Array.get(part,Array.getLength(part)-1);
            int n=Array.getLength(part)-1;
            if(part instanceof byte[])((byte[])part)[n]=(byte)(i+31);
            else ((int[])part)[n]=i+31;
        }
        return state.toString();
    }

    static String error(Throwable e) {
        while(e instanceof g)e=((g)e).a;
        if(e instanceof NullPointerException)return "null";
        if(e instanceof ArrayIndexOutOfBoundsException)return "index"+e.getMessage().split(" ")[1];
        throw new AssertionError(e);
    }

    static String tile(String[] args) throws Exception {
        int fault=Integer.parseInt(args[1]),start=Integer.parseInt(args[2]),z=Integer.parseInt(args[3]);
        int rot=Integer.parseInt(args[4]),p=Integer.parseInt(args[5]),x=Integer.parseInt(args[6]);
        int noiseZ=Integer.parseInt(args[7]),noiseX=Integer.parseInt(args[9]);
        boolean underwater=args[8].equals("1");
        gd packet=fault==1?null:new gd(fault==2?null:HexFormat.of().parseHex(args.length==10?"":args[10]));
        if(packet!=null)packet.yb=start;
        Object[][] savedRows=new Object[tiles.length][];
        for(int i=0;i<tiles.length;i++) {
            boolean ints=i>=5;
            Object grid=ints?new int[2][2][3]:new byte[2][2][3];
            savedRows[i]=new Object[4];
            for(int l=0;l<2;l++)for(int a=0;a<2;a++) {
                Object row=Array.get(Array.get(grid,l),a);savedRows[i][l*2+a]=row;
                for(int b=0;b<3;b++) {
                    if(ints)((int[])row)[b]=(i==5?Integer.MIN_VALUE:Integer.MAX_VALUE)+(l*6+a*3+b)*(i==5?1:-1);
                    else ((byte[])row)[b]=(byte)(100+i*13+l*6+a*3+b);
                }
            }
            if(fault>=10 && (fault-10)/6==i) {
                int plane=p==1?1:0;
                switch((fault-10)%6) {
                    case 0: grid=null;break;
                    case 1: grid=ints?new int[0][][]:new byte[0][][];break;
                    case 2: Array.set(grid,plane,null);break;
                    case 3: Array.set(grid,plane,ints?new int[0][]:new byte[0][]);break;
                    case 4: Array.set(Array.get(grid,plane),1,null);break;
                    case 5: Array.set(Array.get(grid,plane),1,ints?new int[0]:new byte[0]);break;
                }
            }
            fields[tiles[i]].set(null,grid);
        }
        if(fault==3) ve.q=lf.g;
        String status="ok";
        try { fi.a(false,packet,z,rot,p,x,noiseZ,underwater,noiseX); }
        catch(RuntimeException e){status=error(e);}
        StringJoiner result=new StringJoiner(" ");
        result.add(status).add(packet==null?"-":Integer.toString(packet.yb));
        for(Object[] grid:savedRows) {
            int hash=1;
            for(Object row:grid)for(int j=0;j<Array.getLength(row);j++)
                hash=hash*31+(row instanceof int[]?((int[])row)[j]:(((byte[])row)[j]&255));
            result.add(Integer.toString(hash));
        }
        return result.toString();
    }

    static String region(String[] args) throws Exception {
        boolean underwater=args[1].equals("1");
        int ox=Integer.parseInt(args[2]),oz=Integer.parseInt(args[3]),rotation=Integer.parseInt(args[4]);
        gd packet=new gd(Base64.getDecoder().decode(args[5]));
        aj.a(false,-122);
        tb.t=new byte[4][104][104];ve.q=new int[4][105][105];lf.g=new int[4][105][105];
        for(int p=0;p<4;p++)for(int x=0;x<105;x++)for(int z=0;z<105;z++)lf.g[p][x][z]=Integer.MAX_VALUE-((p<<16)+(x<<8)+z);
        MessageDigest digest=MessageDigest.getInstance("SHA-256");
        ByteArrayOutputStream raw=new ByteArrayOutputStream();
        DataOutputStream values=new DataOutputStream(raw);
        for(int p=0;p<4;p++)for(int x=0;x<64;x++)for(int z=0;z<64;z++) {
            fi.a(false,packet,z+oz,rotation,p,x+ox,3160,underwater,3160);
            values.writeInt(packet.yb);
        }
        for(int p=0;p<4;p++)for(int x=0;x<104;x++)for(int z=0;z<104;z++) {
            values.writeInt(ve.q[p][x][z]);values.writeByte(tb.t[p][x][z]);values.writeByte(qe.V[p][x][z]);
            values.writeByte(ka.m[p][x][z]);values.writeByte(ib.jb[p][x][z]);values.writeByte(lg.A[p][x][z]);
        }
        return packet.yb+" "+HexFormat.of().formatHex(digest.digest(raw.toByteArray()));
    }

    public static void main(String[] args) throws Exception {
        if(args.length!=0){instrument(Path.of(args[0]),Path.of(args[1]));return;}
        for(int i=0;i<names.length;i++){
            String[] path=names[i].split("\\.");
            fields[i]=Class.forName(path[0]).getDeclaredField(path[1]);fields[i].setAccessible(true);
        }
        sb.h=71;je.Z=-59;tb.t=new byte[1][2][3];ve.q=new int[1][2][3];lf.g=new int[1][2][3];
        BufferedReader input=new BufferedReader(new InputStreamReader(System.in));
        PrintWriter output=new PrintWriter(System.out);
        String line;
        while((line=input.readLine())!=null) {
            String[] row=line.split(" ");
            switch(row[0]) {
                case "life": output.println(lifecycle(row[1]));break;
                case "tile": output.println(tile(row));break;
                case "region": output.println(region(row));break;
                default: throw new AssertionError(row[0]);
            }
        }
        output.flush();
    }
}
