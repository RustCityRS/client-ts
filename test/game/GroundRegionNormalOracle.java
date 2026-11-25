import java.io.*;
import java.nio.file.*;
import java.util.*;
import java.util.jar.JarFile;
import jdk.internal.org.objectweb.asm.*;

public class GroundRegionNormalOracle {
    static gd packet;
    static int calls, trace;
    // The bytecode probes retain the arguments and call the original
    // fi.a. It exposes the local packet so the final g1/rewind can be observed.
    public static void square(boolean guard,gd p,int z,int r,int level,int x,int noiseZ,boolean water,int noiseX) {
        packet=p; calls++;
        trace=31*trace+p.yb; trace=31*trace+z; trace=31*trace+r; trace=31*trace+level;
        trace=31*trace+x; trace=31*trace+noiseZ; trace=31*trace+(water?1:0); trace=31*trace+noiseX;
        fi.a(guard,p,z,r,level,x,noiseZ,water,noiseX);
    }
    static void instrument(String jar,Path output,String owner,String descriptor,int expectedSites) throws Exception {
        try(JarFile game=new JarFile(jar)) {
            ClassReader reader=new ClassReader(game.getInputStream(game.getJarEntry(owner+".class")));
            ClassWriter writer=new ClassWriter(0);
            int[] sites={0};
            reader.accept(new ClassVisitor(Opcodes.ASM8,writer) {
                public MethodVisitor visitMethod(int a,String n,String d,String s,String[] e) {
                    MethodVisitor m=super.visitMethod(a,n,d,s,e);
                    if(!n.equals("a")||!d.equals(descriptor))return m;
                    return new MethodVisitor(Opcodes.ASM8,m) {
                        public void visitMethodInsn(int op,String owner,String name,String desc,boolean itf) {
                            if(owner.equals("fi")&&name.equals("a")&&desc.equals("(ZLgd;IIIIIZI)V")) {
                                sites[0]++; super.visitMethodInsn(op,"GroundRegionNormalOracle","square",desc,false);
                            } else super.visitMethodInsn(op,owner,name,desc,itf);
                        }
                    };
                }
            },0);
            if(sites[0]!=expectedSites)throw new AssertionError("tile decoding sites for "+owner+": "+sites[0]);
            Files.write(output.resolve(owner+".class"),writer.toByteArray());
        }
    }
    static byte[][][] bytes(int seed) {
        byte[][][] v=new byte[4][104][104];
        for(int p=0;p<4;p++) for(int x=0;x<104;x++) for(int z=0;z<104;z++)
            v[p][x][z]=(byte)(seed+p*31+x*13+z*23);
        return v;
    }
    static int[][][] heights(int seed) {
        int[][][] v=new int[4][105][105];
        for(int p=0;p<4;p++) for(int x=0;x<105;x++) for(int z=0;z<105;z++)
            v[p][x][z]=seed+p*0x34567890+x*37+z*83;
        return v;
    }
    static void check(String line,Path dir) throws Exception {
        String[] cols=line.split(" ");
        boolean water=cols[0].equals("1");
        int x=Integer.parseInt(cols[1]),z=Integer.parseInt(cols[2]),nz=Integer.parseInt(cols[3]),nx=Integer.parseInt(cols[4]);
        String fault=cols[5]; byte[] data=cols[6].equals("-")?null:Files.readAllBytes(dir.resolve(cols[6]));
        tb.t=bytes(1); qe.V=bytes(2); ka.m=bytes(3); ib.jb=bytes(4); lg.A=bytes(5); vb.c=bytes(6);
        lf.g=heights(-911); ve.q=heights(7967);
        ke[] maps=new ke[4];
        for(int p=0;p<4;p++) {
            maps[p]=new ke(104,104);
            for(int i=0;i<104;i++) for(int j=0;j<104;j++)maps[p].d[i][j]=(0x01000000|p*141+i*237+j*63);
        }
        if(fault.equals("nullMaps"))maps=null;
        if(fault.equals("shortMaps"))maps=Arrays.copyOf(maps,2);
        if(fault.equals("nullMap"))maps[1]=null;
        if(fault.equals("shortFlags"))maps[1].d[12]=new int[3];
        if(fault.equals("nullAux"))vb.c=null;
        if(fault.equals("shortAux"))vb.c[2][x]=new byte[5];
        if(fault.equals("shortDest"))vb.c[1][x]=new byte[3];
        if(fault.equals("nullUnderlay"))qe.V=null;
        if(fault.equals("nullHeight"))ve.q=null;
        packet=null;calls=0;trace=1;
        String status="ok";
        try {
            if(cols.length==7)nk.a(z,water,nz,31375,x,data,nx,maps);
            else {
                int sourceX=Integer.parseInt(cols[7]),sourceZ=Integer.parseInt(cols[8]),rotation=Integer.parseInt(cols[9]);
                int level=Integer.parseInt(cols[10]),sourceLevel=Integer.parseInt(cols[11]);
                lk.a(x,sourceZ,z,level,data,rotation,maps,sourceLevel,73,water,sourceX);
            }
        }
        catch(RuntimeException ex) {
            Throwable v=ex;
            while(v instanceof g wrapped && wrapped.a!=null)v=wrapped.a;
            if(v instanceof NullPointerException)status="null";
            else if(v instanceof ArrayIndexOutOfBoundsException)status="bounds";
            else throw ex;
        }
        StringJoiner o=new StringJoiner(" ");
        o.add(status).add(Integer.toString(packet==null?-1:packet.yb)).add(Integer.toString(calls)).add(Integer.toString(trace));
        for(Object[] arr:new Object[][]{tb.t,qe.V,ka.m,ib.jb,lg.A,vb.c,lf.g,ve.q})o.add(Integer.toString(Arrays.deepHashCode(arr)));
        if(maps==null)o.add("-");
        else for(ke map:maps)o.add(Integer.toString(map==null?0:Arrays.deepHashCode(map.d)));
        System.out.println(o);
    }
    public static void main(String[] args) throws Exception {
        if(args[0].equals("instrument")) {
            instrument(args[1],Path.of(args[2]),"nk","(IZIII[BI[Lke;)V",1);
            instrument(args[1],Path.of(args[2]),"lk","(IIII[BI[Lke;IIZI)V",2);
            return;
        }
        BufferedReader in=new BufferedReader(new InputStreamReader(System.in));
        for(String line;(line=in.readLine())!=null;)check(line,Path.of(args[0]));
    }
}
