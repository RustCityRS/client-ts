import java.io.*;
import java.nio.file.*;
import java.util.*;
import java.util.jar.*;
import jdk.internal.org.objectweb.asm.*;

// Runs th.a against the jar's actual pb/cl, ml.a, ob.a, pa.a and scene graph.
// The optional second run observes calls and selected GETSTATICs inside th.a alone.
public class PlayerSubmissionOracle {
    static void instrument(String jar, Path directory) throws Exception {
        try (JarFile file = new JarFile(jar)) {
            ClassReader reader = new ClassReader(file.getInputStream(file.getJarEntry("th.class")));
            ClassWriter writer = new ClassWriter(0);
            reader.accept(new ClassVisitor(Opcodes.ASM8, writer) {
                public MethodVisitor visitMethod(int access,String name,String desc,String sig,String[] exceptions) {
                    MethodVisitor mv = super.visitMethod(access,name,desc,sig,exceptions);
                    if (!name.equals("a") || !desc.equals("(IZ)V")) return mv;
                    return new MethodVisitor(Opcodes.ASM8,mv) {
                        public void visitMethodInsn(int opcode,String owner,String name,String desc,boolean iface) {
                            String hook = switch(owner+"."+name+desc) {
                                case "pb.d(B)Z" -> "visible";
                                case "pb.g(B)I" -> "size";
                                case "ob.f(B)Lmg;" -> "bas";
                                case "ml.a(IIIB)I" -> "height";
                                case "ob.a(IIIIILug;IJZ)Z" -> "add";
                                case "pa.a(IIIILug;IJIIII)Z" -> "add2";
                                default -> null;
                            };
                            if (hook == null) super.visitMethodInsn(opcode,owner,name,desc,iface);
                            else super.visitMethodInsn(Opcodes.INVOKESTATIC,"PlayerSubmissionOracle",hook,
                                opcode == Opcodes.INVOKESTATIC ? desc : "(L"+owner+";"+desc.substring(1),false);
                        }
                        public void visitFieldInsn(int opcode,String owner,String name,String desc) {
                            if(opcode==Opcodes.GETFIELD && owner.equals("ob") && (name.equals("Z")||name.equals("S"))) {
                                super.visitMethodInsn(Opcodes.INVOKESTATIC,"PlayerSubmissionOracle",name.equals("Z")?"fineX":"fineZ","(Lob;)I",false);
                                return;
                            }
                            String hook = switch(owner+"."+name) {
                                case "fe.R" -> "count";
                                case "te.g" -> "self";
                                case "ad.h" -> "ids";
                                case "hh.kb" -> "cycle";
                                default -> null;
                            };
                            if (hook == null || opcode != Opcodes.GETSTATIC) super.visitFieldInsn(opcode,owner,name,desc);
                            else super.visitMethodInsn(Opcodes.INVOKESTATIC,"PlayerSubmissionOracle",hook,"()"+desc,false);
                        }
                    };
                }
            },0);
            Files.write(directory.resolve("th.class"),writer.toByteArray());
        }
    }
    static final pb[] players = new pb[6];
    static final int[] playerIds = {6,2,15,9,1,17};
    static int mode, sizes, idReads, selfReads, cycleReads, countReads;
    static StringJoiner trace;
    static int number(ug p) {return Arrays.asList(players).indexOf(p);}
    static int fineX(ob p) {
        if(mode==36 || mode==37) trace.add("x"+number(p));
        if(mode==37) ah.f=3-ah.f;
        return p.Z;
    }
    static int fineZ(ob p) {
        if(mode==36 || mode==37) trace.add("z"+number(p));
        return p.S;
    }
    static int count() {
        trace.add("n"+fe.R);
        if (mode==34 && ++countReads==1) {int n=fe.R;fe.R=201;return n;}
        return fe.R;
    }
    static pb self() {
        trace.add("l"+number(te.g));
        if(mode==30 && ++selfReads==1) {pb p=te.g;te.g=players[3];return p;}
        return te.g;
    }
    static int[] ids() {
        trace.add("i");
        if(mode==31 && ++idReads==fe.R+2) {ad.h=ad.h.clone();ad.h[0]=17;}
        return ad.h;
    }
    static int cycle() {
        trace.add("c"+hh.kb);
        if(mode==32 && ++cycleReads==1) {int t=hh.kb;hh.kb=11;return t;}
        return hh.kb;
    }
    static boolean visible(pb p,byte guard) {
        trace.add("v"+number(p));
        boolean result=p.d(guard);
        if(mode==23 && p==players[0]) fe.R=0;
        return result;
    }
    static int size(pb p,byte guard) {
        trace.add("s"+number(p));
        int n=p.g(guard);
        if(p==players[0]) {
            sizes++;
            if(mode==20 && sizes==1) p.Z+=128;
            if(mode==21 && sizes==2) p.b(0,1);
        }
        return n;
    }
    static mg bas(ob p,byte guard) {
        trace.add("b"+number(p));
        if(mode==24) return null;
        if(mode==35) p.M=123;
        return p.f(guard);
    }
    static int height(int level,int x,int z,byte guard) {
        trace.add("h"+level+","+x+","+z+","+guard);
        if(mode==25) {ah.f=2;players[0].Z+=120;players[0].S+=13;players[0].gb=1900;players[0].Lb=33;}
        if(mode==26) throw new IllegalStateException();
        return ml.a(level,x,z,guard);
    }
    static boolean add(int level,int x,int z,int y,int radius,ug p,int yaw,long key,boolean stretch) {
        trace.add("a"+level+","+x+","+z+","+y+","+radius+","+number(p)+","+yaw+","+key+","+stretch);
        if(mode==27) throw new IllegalStateException();
        if(mode==28) {ad.h=new int[]{17};fe.R=1;}
        return ob.a(level,x,z,y,radius,p,yaw,key,stretch);
    }
    static boolean add2(int level,int x,int z,int y,ug p,int yaw,long key,int x1,int z1,int x2,int z2) {
        trace.add("e"+level+","+x+","+z+","+y+","+number(p)+","+yaw+","+key+","+x1+","+z1+","+x2+","+z2);
        if(mode==27) throw new IllegalStateException();
        if(mode==29) aj.Nb=null;
        return pa.a(level,x,z,y,p,yaw,key,x1,z1,x2,z2);
    }
    static final int[][][] terrain=new int[4][105][105];
    static final byte[][][] flags=new byte[4][104][104];
    static void run(int[] a) {
        int pass=a[0],x=a[2],z=a[3],size=a[4],count=a[5],attach=a[6];
        mode=a[1];trace=new StringJoiner(";");sizes=idReads=selfReads=cycleReads=countReads=0;
        ah.f=1;hh.kb=10;jh.j=(a[7]&1)!=0;tg.x=qi.Y=104;ah.i=0;
        pa.xb=new ec[24];kl.Bb=new ra[4][104][104];ve.q=terrain;nh.S=null;tb.t=flags;
        int[][] grid=new int[104][104];
        if((a[7]&2)!=0) for(int[] row:grid)Arrays.fill(row,2);
        aj.Nb=grid;fe.R=count;ad.h=new int[Math.max(6,count)];tf.J=new pb[18];
        for(int i=0;i<players.length;i++) {
            pb p=players[i]=new pb();
            tf.J[playerIds[i]]=i==4?null:p;ad.h[i]=playerIds[i];
            if(i!=3){p.pc=new cl();p.pc.k=-1;}
            p.Z=x+(i==5?128:0);p.S=z+(i==5?128:0);
            p.b(0,size);p.gb=380*i;p.H=-110-i;p.r=(i&1)==1;p.lc=true;p.M=i==1?12:-1;
            if(attach!=0 && i!=2) p.nb=new Object();
            p.y=attach==2?11:10;p.ib=attach==3?10:11;
            p.Lb=4+i;p.jb=6+i;p.hc=5+i;p.tb=8+i;
        }
        te.g=players[0];gl.z=x>>7;ic.T=z>>7;
        int tx=Math.max(0,Math.min(103,x>>7)),tz=Math.max(0,Math.min(103,z>>7));
        switch(mode) {
            case 1 -> grid[tx]=grid[Math.min(103,tx+1)];
            case 2 -> aj.Nb=null;
            case 3 -> aj.Nb=Arrays.copyOf(grid,tx);
            case 4 -> grid[tx]=null;
            case 5 -> grid[tx]=new int[tz];
            case 6 -> grid[tx][tz]=Integer.MAX_VALUE;
            case 7 -> fe.R=-1;
            case 8 -> te.g=null;
            case 9 -> ic.T++;
            case 10 -> ad.h[4]=18;
            case 11 -> ad.h=Arrays.copyOf(ad.h,2);
            case 12 -> tf.J=null;
            case 13 -> ad.h=null;
            case 14 -> pa.xb=new ec[0];
            case 15 -> ah.f=-1;
            case 16 -> ve.q=new int[0][][];
            case 17 -> kl.Bb=null;
            case 18 -> ad.h[5]=ad.h[0];
            case 19 -> tf.J[6]=null;
            case 33 -> {te.g=players[3];te.g.S+=128;}
        }
        String status="ok";
        try {
            if(pass==0 || pass==2 || pass==3) th.a(100,true);
            if(pass==1 || pass==2 || pass==3) th.a(102,false);
            if(pass==3) th.a(99,false);
        } catch(RuntimeException ex) {
            Throwable cause=ex;while(cause instanceof g wrapped)cause=wrapped.a;
            if(cause instanceof NullPointerException)status="null";
            else if(cause instanceof ArrayIndexOutOfBoundsException)status="bounds";
            else if(cause instanceof IllegalStateException)status="probe";
            else throw ex;
        }
        StringJoiner actorState=new StringJoiner(","),sprites=new StringJoiner(";");
        for(pb p:players)actorState.add(p.H+":"+(p.lc?1:0));
        for(ec s:pa.xb) if(s!=null) sprites.add(s.u+","+number(s.z)+","+s.w+","+s.c+","+s.s+","+s.t+","+
            s.f+","+s.a+","+s.m+","+s.n+","+s.y);
        System.out.println(String.join("/",status,""+gl.z,""+Arrays.deepHashCode(grid),""+Arrays.deepHashCode(aj.Nb),
            actorState.toString(),""+ah.i,sprites.toString(),""+fe.R,trace.toString()));
    }
    public static void main(String[] args) throws Exception {
        if(args.length!=0){instrument(args[0],Path.of(args[1]));return;}
        for(int p=0;p<4;p++) for(int x=0;x<105;x++) for(int z=0;z<105;z++) terrain[p][x][z]=p*317+x*19-z*27;
        for(int x=0;x<104;x++) for(int z=0;z<104;z++) flags[1][x][z]=(byte)((x+z)%3==1?2:0);
        BufferedReader input=new BufferedReader(new InputStreamReader(System.in));
        for(String s;(s=input.readLine())!=null;)run(Arrays.stream(s.split(" ")).mapToInt(Integer::parseInt).toArray());
    }
}
