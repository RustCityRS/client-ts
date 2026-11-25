import java.io.*;
import java.lang.reflect.*;
import java.nio.file.*;
import java.util.*;
import java.util.zip.CRC32;
import jdk.internal.org.objectweb.asm.*;

public class ProviderValidationOracle {
    static final byte[] indexBytes = {0,0,0,0,4,5,0,0,0};
    static Field reference;
    static mc provider;
    static db first, second, shortIndex;
    static int at, action, reads;
    static class Stop extends Error {}

    static void instrument(Path dir) throws Exception {
        try (var input=ProviderValidationOracle.class.getResourceAsStream("/mc.class")) {
            var r=new ClassReader(input);var w=new ClassWriter(0);
            r.accept(new ClassVisitor(Opcodes.ASM8,w) {
                public MethodVisitor visitMethod(int a,String n,String d,String s,String[] e) {
                    var m=super.visitMethod(a,n,d,s,e);
                    return new MethodVisitor(Opcodes.ASM8,m) {
                        public void visitFieldInsn(int op,String c,String f,String type) {
                            super.visitFieldInsn(op,c,f,type);
                            if(op==Opcodes.GETFIELD && c.equals("mc") && f.equals("G"))
                                super.visitMethodInsn(Opcodes.INVOKESTATIC,"ProviderValidationOracle","read","(Ldb;)Ldb;",false);
                        }
                    };
                }
            },0);Files.write(dir.resolve("mc.class"),w.toByteArray());
        }
    }
    static db read(db value) throws Exception {
        if (++reads == at) switch(action) {
            case 0 -> reference.set(provider, second);
            case 1 -> reference.set(provider, null);
            case 2 -> reference.set(provider, shortIndex);
            case 3 -> throw new Stop();
            case 4 -> field("Y").setInt(provider,-1);
            case 5 -> field("Y").setInt(provider,Integer.MAX_VALUE);
        }
        return value;
    }
    static Field field(String name) throws Exception {
        var f=mc.class.getDeclaredField(name);f.setAccessible(true);return f;
    }
    static int crc(byte[] bytes,int end) {
        CRC32 crc=new CRC32();crc.update(bytes,0,end);return (int)crc.getValue();
    }
    static db index(int version,int checksum,int count) {
        db record=new db(indexBytes,crc(indexBytes,indexBytes.length));
        record.e=3;
        record.l=new int[count];record.n=new int[count];record.a=new int[count];
        Arrays.fill(record.n,checksum);Arrays.fill(record.a,version);
        return record;
    }
    static String run(int op,int change,int next,int flags) throws Exception {
        ej net=new ej();net.G=4;net.F=7;
        boolean urgent=(flags&1)!=0;
        byte[] bytes={8,16,32,0x12,0x34};
        int checksum=crc(bytes,3);
        first=index(0x1234,checksum+(flags>>2),3);second=index(0xabcd,checksum,2);shortIndex=index(0xfedc,checksum,0);
        provider=new mc(17,null,null,net,null,0,0,op>=7);
        reference.set(provider,first);field("B").set(provider,new byte[]{1,(byte)(op==3?1:0),1});
        nc table=(nc)field("o").get(provider);
        jf wrong=new jf(){byte[] e(int guard){return bytes;}};
        qc disk=new qc();disk.X=bytes;disk.D=false;disk.E=urgent;
        fd network=new fd();network.M=2;network.P=new gd(bytes);network.P.yb=3;network.D=false;network.E=urgent;
        jf request=op==0?disk:op==1?network:wrong;
        if(op<=2)table.a((byte)-89,request,1L);
        if(op>=3 && op<=6) {
            field("ab").set(provider,new gk());
            field("Z").setBoolean(provider,op==4||op==6);
            field("cb").setBoolean(provider,op==5);
            if(op==3){
                jf hint=new jf();hint.k=1;
                ((gk)field("bb").get(provider)).a(hint,false);
            }
            if(op==6)field("Y").setInt(provider,-1);
        }
        if(op>=7){
            if(op==8)table.a((byte)-89,disk,0L);
            table.a((byte)-89,wrong,1L);
        }
        if((flags&2)!=0) for(int i=0;i<20;i++)net.a((byte)0,i,4,(byte)-70,true);
        at=change;action=next;reads=0;
        String result="ok";
        try{
            if(op<=2)result=provider.a(0,1)==null?"none":"bytes";
            else if(op==3)provider.d((byte)71);
            else provider.g(29373);
        }catch(Stop end){ result="stop"; }
        catch(RuntimeException ex){
            Throwable t=ex;while(t instanceof g wrapped)t=wrapped.a;
            if(t instanceof ClassCastException)result="cast";
            else if(t instanceof IndexOutOfBoundsException)result="bounds";
            else if(t instanceof NullPointerException)result="null";
            else throw ex;
        }
        jf retained=table.a((byte)-124,1L);
        return String.join("/",result,""+reads,(bytes[3]&255)+","+(bytes[4]&255),net.G+","+net.F+","+net.b((byte)64),
            Arrays.toString((byte[])field("B").get(provider)),field("x").get(provider)+","+field("Y").get(provider)+","+field("Z").get(provider)+","+field("cb").get(provider),
            retained==null?"empty":retained==wrong?"wrong":retained==request?"same":"new",disk.I+"");
    }
    public static void main(String[] args)throws Exception{
        if(args.length>0){instrument(Path.of(args[0]));return;}
        reference=field("G");
        var input=new BufferedReader(new InputStreamReader(System.in));
        for(String line;(line=input.readLine())!=null;){
            int[] v=Arrays.stream(line.split(" ")).mapToInt(Integer::parseInt).toArray();
            System.out.println(run(v[0],v[1],v[2],v[3]));
        }
    }
}
