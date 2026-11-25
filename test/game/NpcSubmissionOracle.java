import java.io.*;
import java.nio.file.*;
import java.util.*;
import java.util.jar.*;
import jdk.internal.org.objectweb.asm.*;

// Most rows run nc, ie, ml, ob and bc from the unchanged gamepack. A second
// invocation observes nc's outgoing calls, delegating to those same methods.
public class NpcSubmissionOracle {
    static void instrument(String jar, Path dir) throws Exception {
        try (JarFile file = new JarFile(jar)) {
            ClassReader reader = new ClassReader(file.getInputStream(file.getJarEntry("nc.class")));
            ClassWriter writer = new ClassWriter(0);
            reader.accept(new ClassVisitor(Opcodes.ASM8, writer) {
                public MethodVisitor visitMethod(int flags, String name, String desc, String sig, String[] ex) {
                    MethodVisitor mv = super.visitMethod(flags,name,desc,sig,ex);
                    if (!name.equals("a") || !desc.equals("(ZI)V")) return mv;
                    return new MethodVisitor(Opcodes.ASM8,mv) {
                        public void visitMethodInsn(int op,String owner,String name,String d,boolean iface) {
                            String method = switch(owner+"."+name+d) {
                                case "bk.d(B)Z" -> "visible";
                                case "ja.a(I)Z" -> "multi";
                                case "ob.g(B)I" -> "size";
                                case "ml.a(IIIB)I" -> "height";
                                case "ob.a(IIIIILug;IJZ)Z" -> "add";
                                default -> null;
                            };
                            if (method==null) super.visitMethodInsn(op,owner,name,d,iface);
                            else super.visitMethodInsn(Opcodes.INVOKESTATIC,"NpcSubmissionOracle",method,
                                op==Opcodes.INVOKESTATIC?d:"(L"+owner+";"+d.substring(1),false);
                        }
                    };
                }
            },0);
            Files.write(dir.resolve("nc.class"),writer.toByteArray());
        }
    }
    static int mode, sizes, lookups;
    static StringJoiner trace;
    static final int[] ids = {6,2,15,9,1,17};
    static final bk[] actors = new bk[ids.length];
    static final ja[] types = new ja[ids.length];
    static int number(ug actor) { return Arrays.asList(actors).indexOf(actor); }
    static boolean visible(bk npc,byte guard) {
        trace.add("v"+number(npc));
        return npc.d(guard);
    }
    static boolean multi(ja type,int guard) {
        int id=Arrays.asList(types).indexOf(type);
        trace.add("m"+id);
        boolean result=type.a(guard);
        if (id==0) {
            ++lookups;
            if(mode==22 && lookups==1) type.kb=!type.kb;
            if(mode==27 && lookups==2) actors[0].mc=null;
            if((mode==33 || mode==34) && lookups==2) {
                int size=actors[0].g((byte)-39);
                int x=(actors[0].Z-size*64)>>7, z=(actors[0].S-size*64)>>7;
                aj.Nb[x]=new int[z+1];
                if(mode==34) aj.Nb[x+1]=null;
            }
        }
        return result;
    }
    static int size(ob npc,byte guard) {
        trace.add("s"+number(npc));
        int value=npc.g(guard);
        if(npc==actors[0]) {
            ++sizes;
            if(mode==20 && sizes==1) npc.Z+=128;
            if(mode==21 && sizes==2) npc.b(0,1);
        }
        return value;
    }
    static int height(int level,int x,int z,byte guard) {
        trace.add("h"+level+","+x+","+z+","+guard);
        if(mode==23) {
            ah.f=2;actors[0].Z+=120;actors[0].S+=13;actors[0].gb=1900;actors[0].r=true;
        }
        if(mode==25) throw new IllegalStateException();
        return ml.a(level,x,z,guard);
    }
    static boolean add(int level,int x,int z,int y,int radius,ug npc,int yaw,long key,boolean stretch) {
        trace.add("a"+level+","+x+","+z+","+y+","+radius+","+number(npc)+","+yaw+","+key+","+stretch);
        if(mode==24) { fi.n=new int[]{17}; ed.d=1; }
        if(mode==26) throw new IllegalStateException();
        if(mode==28) aj.Nb=null;
        if(mode==29) { fi.n[1]=17;return false; }
        return ob.a(level,x,z,y,radius,npc,yaw,key,stretch);
    }
    static final int[][][] terrain = new int[4][105][105];
    static final byte[][][] flags = new byte[4][104][104];
    static void run(int[] a) throws Exception {
        int pass=a[0];mode=a[1];int x=a[2],z=a[3],size=a[4],order=a[8];
        sizes=lookups=0;trace=new StringJoiner(";");
        ah.f=1; tg.x=qi.Y=104; ah.i=0; pa.xb=new ec[24]; kl.Bb=new ra[4][104][104];
        ve.q=terrain;nh.S=null;tb.t=flags;vj.d=new int[]{0};
        int len=mode==18?105:104;
        int[][] grid=new int[len][len];
        if(pass==4 || mode==18) for(int[] row:grid) Arrays.fill(row,43);
        aj.Nb=grid;
        uc.l=new bk[18];fi.n=ids.clone();ed.d=6;
        for(int i=0;i<ids.length;i++) {
            bk npc=new bk();ja type=new ja();
            actors[i]=npc;types[i]=type;
            uc.l[ids[i]]=i==4?null:npc;
            npc.mc=i==3?null:type; type.kb=i==2 || (i==5 && (order&4)!=0);type.hb=(i&1)==0;
            npc.Z=x+(i==2?a[5]:i==5?-a[5]:0);npc.S=z+(i==2 || i==5?a[6]:0);
            npc.b(0,i==2||i==5?a[7]:size);npc.H=-113-i;npc.gb=i*380;npc.r=(i&1)==1;
        }
        if((order&1)!=0) for(int i=0;i<ids.length;i++)fi.n[i]=ids[ids.length-1-i];
        if((order&2)!=0)fi.n[4]=fi.n[0];
        int tx=Math.max(0,Math.min(103,x>>7)),tz=Math.max(0,Math.min(103,z>>7));
        switch(mode) {
            case 1 -> grid[tx]=grid[Math.min(103,tx+1)];
            case 2 -> aj.Nb=null;
            case 3 -> aj.Nb=Arrays.copyOf(grid,tx);
            case 4 -> grid[tx]=null;
            case 5 -> grid[tx]=new int[tz];
            case 6 -> grid[tx][tz]=Integer.MAX_VALUE;
            case 7 -> types[0].J=new int[]{-1};
            case 8 -> types[0].J=new int[0];
            case 9 -> {types[1].J=new int[]{42,-1};var f=ja.class.getDeclaredField("H");f.setAccessible(true);f.setInt(types[1],1);}
            case 10 -> fi.n[4]=18;
            case 11 -> fi.n=Arrays.copyOf(fi.n,3);
            case 12 -> uc.l=null;
            case 13 -> fi.n=null;
            case 14 -> pa.xb=new ec[0];
            case 15 -> ah.f=-1;
            case 16 -> ve.q=new int[0][][];
            case 17 -> kl.Bb=null;
            case 19 -> {types[0].J=new int[]{7,-1};var f=ja.class.getDeclaredField("H");f.setAccessible(true);f.setInt(types[0],0);}
            case 30 -> { fi.n=null;uc.l=null;ed.d=-1; }
            case 31 -> { aj.Nb=new int[0][];ed.d=0; }
            case 32 -> {types[2].J=new int[0];fi.n=Arrays.copyOf(fi.n,4);ed.d=4;}
        }
        String status="ok";
        try {
            switch(pass) {
                case 0 -> nc.a(false,-14896);
                case 1 -> nc.a(true,-14896);
                case 2 -> {nc.a(true,-14896);nc.a(false,-14896);}
                case 3 -> {ie.b(3658);nc.a(true,-14896);nc.a(false,-14896);}
                case 4 -> ie.b(3658);
                case 5 -> {nc.a(false,-14896);nc.a(true,-14896);}
                case 6 -> {nc.a(false,-14896);nc.a(false,-14896);}
            }
        } catch(RuntimeException e) {
            Throwable cause=e;
            while(cause instanceof g wrapped)cause=wrapped.a;
            if(cause instanceof NullPointerException)status="null";
            else if(cause instanceof ArrayIndexOutOfBoundsException)status="bounds";
            else if(cause instanceof IllegalStateException)status="probe";
            else throw e;
        }
        StringJoiner heights=new StringJoiner(","),sprites=new StringJoiner(";");
        for(bk actor:actors)heights.add(""+actor.H);
        for(ec s:pa.xb)if(s!=null)sprites.add(s.u+","+number(s.z)+","+s.w+","+s.c+","+s.s+","+s.t+","+
            s.f+","+s.a+","+s.m+","+s.n+","+s.y);
        System.out.println(String.join("/",status,""+Arrays.deepHashCode(grid),""+Arrays.deepHashCode(aj.Nb),
            heights.toString(),""+ah.i,sprites.toString(),""+ed.d,trace.toString()));
    }
    public static void main(String[] args) throws Exception {
        if(args.length!=0){instrument(args[0],Path.of(args[1]));return;}
        if(aj.Nb.length!=104 || Arrays.stream(aj.Nb).distinct().count()!=104 ||
            Arrays.stream(aj.Nb).anyMatch(row->row.length!=104 || Arrays.stream(row).anyMatch(count->count!=0)))
            throw new AssertionError("Unexpected original occupancy grid");
        for(int p=0;p<4;p++)for(int x=0;x<105;x++)for(int z=0;z<105;z++)
            terrain[p][x][z]=p*317+x*19-z*27;
        for(int x=0;x<104;x++)for(int z=0;z<104;z++)flags[1][x][z]=(byte)(((x+z)%3==1)?2:0);
        BufferedReader input=new BufferedReader(new InputStreamReader(System.in));
        for(String s;(s=input.readLine())!=null;)run(Arrays.stream(s.split(" ")).mapToInt(Integer::parseInt).toArray());
    }
}
