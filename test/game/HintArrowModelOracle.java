import java.io.*;
import java.lang.reflect.*;
import java.nio.file.*;
import java.security.MessageDigest;
import java.util.*;
import java.util.jar.JarFile;
import jdk.internal.org.objectweb.asm.*;

public final class HintArrowModelOracle {
    static int samples,trace,mode;
    static al archive;
    static int[][][] heights=new int[4][105][105];
    static int[][][] flat=new int[4][105][105];
    static byte[][][] flags=new byte[4][104][104];
    static byte[][][] emptyFlags=new byte[4][104][104];
    static IdentityHashMap<Object,Integer> identities=new IdentityHashMap<>();
    static Field bounds,spot,nf,colourA,colourB,colourC;
    static MessageDigest sha;

    static int tag(Object value){if(value==null)return 0;return identities.computeIfAbsent(value,ignored->identities.size()+1);}
    public static int ground(int level,int x,int z,byte guard) {
        samples++;trace=(((trace*31+level)*31+x)*31+z)*31+guard;
        if(mode==10 && samples==2)ah.f=3;
        if(mode==11 && samples==4)tb.t=null;
        return ml.a(level,x,z,guard);
    }
    static void prepare(Path gamepack,Path out)throws Exception {
        try(JarFile jar=new JarFile(gamepack.toFile())) {
            ClassReader reader=new ClassReader(jar.getInputStream(jar.getJarEntry("ai.class")));
            ClassWriter writer=new ClassWriter(0);int[] calls={0};
            reader.accept(new ClassVisitor(Opcodes.ASM8,writer) {
                public MethodVisitor visitMethod(int access,String name,String desc,String sig,String[] ex){
                    MethodVisitor visitor=super.visitMethod(access,name,desc,sig,ex);
                    if(!name.equals("a")||!desc.equals("(IIIILnd;II)Lnd;"))return visitor;
                    return new MethodVisitor(Opcodes.ASM8,visitor) {
                        public void visitMethodInsn(int op,String cls,String method,String type,boolean iface) {
                            if(op==Opcodes.INVOKESTATIC&&cls.equals("ml")&&method.equals("a")&&type.equals("(IIIB)I")){
                                super.visitMethodInsn(op,"HintArrowModelOracle","ground",type,false);calls[0]++;
                            }else super.visitMethodInsn(op,cls,method,type,iface);
                        }
                    };
                }
            },0);
            if(calls[0]!=3)throw new AssertionError(calls[0]);Files.write(out.resolve("ai.class"),writer.toByteArray());
        }
    }
    static String state(fc model)throws Exception {
        if(model==null)return "-";
        int points=model.D,faces=nf.getInt(model);ByteArrayOutputStream memory=new ByteArrayOutputStream();
        DataOutputStream data=new DataOutputStream(memory);
        int[][] arrays={model.U,model.q,model.v,(int[])colourA.get(model),(int[])colourB.get(model),(int[])colourC.get(model)};
        StringJoiner refs=new StringJoiner(",");
        for(int j=0;j<arrays.length;j++) {
            int[] row=arrays[j];refs.add(Integer.toString(tag(row)));
            if(row!=null){int count=Math.min(row.length,j<3?points:faces);for(int i=0;i<count;i++)data.writeInt(row[i]);}
        }
        return tag(model)+":"+points+":"+faces+":"+bounds.getBoolean(model)+":"+refs+":"+HexFormat.of().formatHex(sha.digest(memory.toByteArray()));
    }

    static String run(int[] row)throws Exception {
        int id=row[0],angle=row[1],x=row[2],z=row[3],baseY=row[4],level=row[5];mode=row[6];
        if(row[7]!=0)te.a=new ve(4);
        ah.f=level;ve.q=mode==0?flat:heights;tb.t=mode==1?emptyFlags:flags;
        fc base=new fc();base.D=3;
        base.U=new int[]{-150,21,201};base.q=new int[]{-9,0,101};base.v=new int[]{19,172,-120};
        rk.k=archive;
        switch(mode) {
            case 3: base=null;break;
            case 4: rk.k=null;break;
            case 5: tb.t=null;break;
            case 6: ve.q=null;break;
            case 7: te.a.a((long)id,new fc(),(byte)-71);break;
            case 8: te.a.a((long)id,new Object(),(byte)-71);break;
            case 9: base.U=null;break;
            case 12: base.D=0;break;
            case 13: ve.q=new int[0][][];break;
        }
        samples=0;trace=1;int lookups=al.g;
        fc value=null;String result="ok";
        try{value=(fc)ai.a(angle,z,-124,id,base,baseY,x);}catch(RuntimeException e){
            Throwable t=e;while(t instanceof g)t=((g)t).a;
            if(t instanceof NullPointerException)result="null";
            else if(t instanceof ArrayIndexOutOfBoundsException)result="index"+t.getMessage().split(" ")[1];
            else if(t instanceof ClassCastException)result="cast";else throw new AssertionError(t);
        }
        Object cached=te.a.a((long)id,false);
        String c=cached instanceof fc?state((fc)cached):cached==null?"-":"other";
        return result+" "+(al.g-lookups)+" "+samples+" "+trace+"|"+c+"|"+state(value)+"|"+state((fc)spot.get(null));
    }
    public static void main(String[] args)throws Exception{
        if(args.length==2){prepare(Path.of(args[0]),Path.of(args[1]));return;}
        sha=MessageDigest.getInstance("SHA-256");
        bounds=ModelMeshOracle.field(fc.class,"K");spot=ModelMeshOracle.field(fc.class,"V");nf=ModelMeshOracle.field(fc.class,"y");
        colourA=ModelMeshOracle.field(fc.class,"l");colourB=ModelMeshOracle.field(fc.class,"M");colourC=ModelMeshOracle.field(fc.class,"L");
        archive=new al(new ModelMeshOracle.Provider(args[0],7),true,true);
        dc.r=new ModelMeshOracle.Textures();
        for(int p=0;p<4;p++)for(int x=0;x<105;x++)for(int z=0;z<105;z++){
            heights[p][x][z]=(p*131+x*7-z*11)*10001;
            if(x<104&&z<104)flags[p][x][z]=(byte)(((x+z)%3==0)?2:0);
        }
        BufferedReader input=new BufferedReader(new InputStreamReader(System.in));PrintWriter output=new PrintWriter(System.out);String line;
        while((line=input.readLine())!=null)output.println(run(Arrays.stream(line.split(" ")).mapToInt(Integer::parseInt).toArray()));
        output.flush();
    }
}
