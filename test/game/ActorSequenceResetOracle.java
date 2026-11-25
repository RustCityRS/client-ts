import java.io.*;
import java.net.Socket;
import java.nio.file.*;
import java.util.*;
import jdk.internal.org.objectweb.asm.*;

public class ActorSequenceResetOracle {
    static int change, mode, read;
    static StringJoiner trace;
    static pb[] allPlayers, originalPlayers, otherPlayers;
    static bk[] allNpcs, originalNpcs, otherNpcs;
    static class Boundary extends Error {}

    // Observe tf.J and uc.l only within the original rg.a method. Retaining
    // the value just read allows its next GETSTATIC to see a different table.
    static void instrument(Path directory)throws Exception {
        try(var bytes=ActorSequenceResetOracle.class.getResourceAsStream("/rg.class")){
            ClassReader r=new ClassReader(bytes);
            ClassWriter w=new ClassWriter(0);
            r.accept(new ClassVisitor(Opcodes.ASM8,w){
                public MethodVisitor visitMethod(int a,String n,String d,String s,String[] e){
                    MethodVisitor mv=super.visitMethod(a,n,d,s,e);
                    if(!n.equals("a")||!d.equals("(B)Z"))return mv;
                    return new MethodVisitor(Opcodes.ASM8,mv){
                        public void visitFieldInsn(int op,String c,String f,String desc){
                            super.visitFieldInsn(op,c,f,desc);
                            if(op==Opcodes.GETSTATIC&&(c.equals("tf")&&f.equals("J")||c.equals("uc")&&f.equals("l"))){
                                super.visitMethodInsn(Opcodes.INVOKESTATIC,"ActorSequenceResetOracle",
                                    c.equals("tf")?"players":"npcs","("+desc+")"+desc,false);
                            }
                        }
                    };
                }
            },0);
            Files.write(directory.resolve("rg.class"),w.toByteArray());
        }
    }
    static pb[] players(pb[] captured){
        trace.add("p"+(captured==originalPlayers?0:captured==otherPlayers?1:captured==null?-1:2));
        if(++read==change)switch(mode){
            case 0 -> tf.J=otherPlayers;
            case 1 -> tf.J=null;
            case 2 -> tf.J=new pb[0];
            case 3 -> tf.J=Arrays.copyOf(otherPlayers,1);
            case 4 -> tf.J=new pb[4];
            case 5 -> uc.l=otherNpcs;
            case 6 -> throw new Boundary();
        }
        return captured;
    }
    static bk[] npcs(bk[] captured){
        trace.add("n"+(captured==originalNpcs?0:captured==otherNpcs?1:captured==null?-1:2));
        if(++read==change)switch(mode){
            case 0 -> uc.l=otherNpcs;
            case 1 -> uc.l=null;
            case 2 -> uc.l=new bk[0];
            case 3 -> uc.l=Arrays.copyOf(otherNpcs,1);
            case 4 -> uc.l=new bk[4];
            case 5 -> tf.J=otherPlayers;
            case 6 -> throw new Boundary();
        }
        return captured;
    }
    static void run(int[] a)throws Exception{
        change=a[0];mode=a[1];int shape=a[2];read=0;trace=new StringJoiner(",");
        allPlayers=new pb[]{new pb(),new pb(),new pb(),new pb()};
        allNpcs=new bk[]{new bk(),new bk(),new bk(),new bk()};
        for(int i=0;i<4;i++){allPlayers[i].bb=201+i;allNpcs[i].bb=501+i;}
        originalPlayers=new pb[]{allPlayers[0],null,allPlayers[1],allPlayers[0]};
        originalNpcs=new bk[]{null,allNpcs[0],allNpcs[1],allNpcs[0]};
        otherPlayers=new pb[]{allPlayers[2],allPlayers[3],null};
        otherNpcs=new bk[]{allNpcs[2],allNpcs[3],null};
        tf.J=shape==1?new pb[0]:shape==2?null:originalPlayers;
        uc.l=shape==3?new bk[0]:shape==4?null:originalNpcs;
        hd.b=new be(12);hd.b.yb=9;o.Y=131;af.I=0;fk.X=11;la.W=83;jh.q=104;ia.q=7;
        ek.s=new se(new Socket(){
            public void setSoTimeout(int value){}
            public void setTcpNoDelay(boolean value){}
            public InputStream getInputStream(){return new ByteArrayInputStream(new byte[]{87});}
            public OutputStream getOutputStream(){return OutputStream.nullOutputStream();}
        },null);
        String status;
        try {status=Boolean.toString(rg.a((byte)57));}
        catch(Boundary stop){status="stop";}
        catch(RuntimeException e){
            Throwable t=e;while(t instanceof g wrapped)t=wrapped.a;
            if(t instanceof NullPointerException)status="null";
            else if(t instanceof IndexOutOfBoundsException)status="bounds";
            else throw e;
        }
        StringJoiner state=new StringJoiner(",");
        for(ob actor:allPlayers)state.add(""+actor.bb);
        for(ob actor:allNpcs)state.add(""+actor.bb);
        System.out.println(status+"/"+state+"/"+o.Y+","+fk.X+","+la.W+","+jh.q+","+ia.q+","+hd.b.yb+"/"+trace);
    }
    public static void main(String[] args)throws Exception{
        if(args.length==1){instrument(Path.of(args[0]));return;}
        var input=new BufferedReader(new InputStreamReader(System.in));
        for(String line;(line=input.readLine())!=null;)run(Arrays.stream(line.split(" ")).mapToInt(Integer::parseInt).toArray());
    }
}
