import java.io.*;
import java.lang.reflect.Field;
import java.nio.file.*;
import java.util.*;
import java.util.jar.JarFile;
import jdk.internal.org.objectweb.asm.*;

public class GdmEffectsOracle {
    static final Set<String> fields=Set.of("cg.f","ph.g","tf.G","qg.E","ah.f","hh.kb","id.p",
        "hl.V","hl.u","hl.U","hl.s","hl.T","hl.O","hl.v","hl.L","hl.o","uc.l","tf.J","te.g","mi.y",
        "ob.Z","ob.S","ac.m","ac.x","ac.y","ac.C","ac.u","ac.n");
    static final Field cursor;
    static { try {cursor=gk.class.getDeclaredField("t");cursor.setAccessible(true);} catch(Exception e){throw new AssertionError(e);} }
    static final IdentityHashMap<Object,Integer> ids=new IdentityHashMap<>();
    static int editAt,mutation,reads;
    static boolean map;
    static gk list,alt;
    static hl projectile;
    static ac spot;
    static StringBuilder trace;
    static int ident(Object object) {return ids.getOrDefault(object,-9);}
    public static void observe(String event) {
        trace.append(event).append(';');
        if (++reads!=editAt) return;
        switch(mutation) {
            case 1 -> {ah.f=2;hh.kb=13;id.p=3;}
            case 2 -> {projectile.s=-5;projectile.V=2;projectile.T=-47;spot.m=2;spot.x=true;}
            case 3 -> {if(map)ph.g=alt;else cg.f=alt;}
            case 4 -> throw new IllegalStateException("fixture");
            case 5 -> {uc.l[1].Z=1111;te.g.S=188;tf.J[2].Z=13312;mi.y=2;}
        }
    }
    public static int height(int level,int x,int z,byte guard) {
        observe("height"+level+","+x+","+z+","+guard);
        return ml.a(level,x,z,guard);
    }
    public static void aim(hl p,byte guard,int x,int y,int z,int cycle) {
        observe("aim"+ident(p)+","+x+","+y+","+z+","+cycle);
        p.a(guard,x,y,z,cycle);
    }
    public static void advance(hl p,byte guard,int elapsed) {observe("advance"+ident(p)+","+elapsed);p.a(guard,elapsed);}
    public static void advance(ac s,int elapsed,int guard) {observe("advance"+ident(s)+","+elapsed);s.a(elapsed,guard);}
    public static boolean add(int level,int x,int z,int y,int radius,ug model,int yaw,long key,boolean extend) {
        observe("add"+ident(model)+","+level+","+x+","+z+","+y+","+radius+","+yaw+","+key+","+extend);
        return ob.a(level,x,z,y,radius,model,yaw,key,extend);
    }
    static void prepare(Path jar,Path path)throws Exception {
        try(JarFile file=new JarFile(jar.toFile())) {
            for(String owner:List.of("pk","mf")) {
                ClassReader input=new ClassReader(file.getInputStream(file.getJarEntry(owner+".class")));
                ClassWriter out=new ClassWriter(ClassWriter.COMPUTE_MAXS);
                input.accept(new ClassVisitor(Opcodes.ASM8,out) {
                    public MethodVisitor visitMethod(int access,String name,String desc,String sig,String[] errors) {
                        MethodVisitor mv=super.visitMethod(access,name,desc,sig,errors);
                        if(!name.equals("a")||!desc.equals("(I)V"))return mv;
                        return new MethodVisitor(Opcodes.ASM8,mv) {
                            public void visitFieldInsn(int op,String cls,String field,String type) {
                                super.visitFieldInsn(op,cls,field,type);
                                String tag=cls+"."+field;
                                if(fields.contains(tag)) {
                                    super.visitLdcInsn(tag);
                                    super.visitMethodInsn(Opcodes.INVOKESTATIC,"GdmEffectsOracle","observe","(Ljava/lang/String;)V",false);
                                }
                            }
                            public void visitMethodInsn(int op,String cls,String method,String sig,boolean iface) {
                                if(method.equals("a")) {
                                    String observer=switch(cls) {
                                        case "ml" -> "height"; case "hl" -> sig.equals("(BI)V")?"advance":"aim";
                                        case "ac" -> "advance"; case "ob" -> "add"; default -> null;
                                    };
                                    if(observer!=null) {
                                        String args=op==Opcodes.INVOKESTATIC?sig:"(L"+cls+";"+sig.substring(1);
                                        super.visitMethodInsn(Opcodes.INVOKESTATIC,"GdmEffectsOracle",observer,args,false);
                                        return;
                                    }
                                }
                                super.visitMethodInsn(op,cls,method,sig,iface);
                            }
                        };
                    }
                },0);
                Files.write(path.resolve(owner+".class"),out.toByteArray());
            }
        }
    }
    static void put(gk owner,jf node,Object model,int id) {
        ids.put(node,id);
        if(model!=null) ids.put(model,id);
        owner.a(node,false);
    }
    static String state(gk owner) throws Exception {
        StringBuilder result=new StringBuilder();
        for(jf n=owner.c.g;n!=owner.c;n=n.g) result.append(ident(n));
        jf next=(jf)cursor.get(owner);
        return result+":"+(next==null?"n":next==owner.c?"s":ident(next));
    }
    static void init(int variant,int target) {
        ids.clear();
        ah.f=1;hh.kb=10;id.p=1;mi.y=4;
        list=new gk();alt=new gk();
        if(map)ph.g=list;else cg.f=list;
        uc.l=new bk[3];uc.l[1]=new bk();uc.l[1].Z=521;uc.l[1].S=833;
        tf.J=new pb[4];tf.J[2]=new pb();tf.J[2].Z=702;tf.J[2].S=901;
        te.g=new pb();te.g.Z=883;te.g.S=401;
        kl.Bb=new ra[4][16][16];pa.xb=new ec[40];ah.i=0;
        tg.x=qi.Y=16;ve.q=heights;
        projectile=new hl(7,1,411,654,19,10,16,-1,2,target,15);
        projectile.O=511.75;projectile.v=712.5;projectile.L=-98.75;
        spot=new ac(7,1,610,720,-360,0,10);
        hl p2=new hl(7,1,330,490,-15,2,9,-1,2,0,25);
        hl p3=new hl(7,1,330,490,-15,12,180,-1,2,0,25);
        ac s2=new ac(7,1,382,421,-39,0,13),s3=new ac(7,2,431,400,8,0,9);
        if(map){put(list,new qg(s3),s3,2);put(list,new qg(spot),spot,1);put(list,new qg(s2),s2,3);}
        else{put(list,new tf(p2),p2,2);put(list,new tf(projectile),projectile,1);put(list,new tf(p3),p3,3);}
        if(variant==1)id.p=20;
        if(variant==2){hh.kb=17;spot.x=true;}
        if(variant==3){uc.l[1].S=13312;te.g.Z=-1;tf.J[2].Z=13311;}
        if(variant==4){projectile.O=Double.NaN;projectile.v=Double.POSITIVE_INFINITY;projectile.L=Double.NEGATIVE_INFINITY;}
        if(variant==5){projectile.O=-2147483649.;projectile.v=2147483648.;projectile.L=-0.;}
        if(variant==6){pa.xb=new ec[0];}
        if(variant==7){put(list,new jf(),null,4);}
        if(variant==8){put(list,map?new qg(null):new tf(null),null,4);}
        if(variant==9){uc.l=null;tf.J=null;}
        if(variant==10){ah.f=2;}
        if(variant==11){ve.q=null;}
        if(variant==12)hh.kb=16;
        if(variant==13)hh.kb=Integer.MIN_VALUE;
        if(variant==14){uc.l[1].Z=0;uc.l[1].S=0;te.g.Z=13311;te.g.S=13311;tf.J[2].Z=13312;}
        if(variant==15){id.p=-3;tf.J[2].S=-1;uc.l[1].Z=13312;te.g.Z=13312;}
        if(variant==16){projectile.T=Integer.MIN_VALUE;projectile.u=Integer.MAX_VALUE;}
        put(alt,map?new qg(s2):new tf(p3),map?s2:p3,5);
        alt.d(0);
    }
    static int[][][] heights=new int[4][105][105];
    public static void main(String[]args)throws Exception {
        if(args.length!=0){prepare(Path.of(args[0]),Path.of(args[1]));return;}
        tb.t=new byte[4][104][104];tb.t[1][4][6]=2;
        for(int p=0;p<4;p++)for(int x=0;x<105;x++)for(int z=0;z<105;z++)heights[p][x][z]=p*210+x*3-z*17;
        li spotType=new li();spotType.k=3;r.V.a(7L,spotType,(byte)-71);
        ek seq=new ek();seq.F=new int[]{1,2,3};seq.g=new int[]{0,1,2};seq.G=2;ga.B.a(3L,seq,(byte)-71);
        BufferedReader input=new BufferedReader(new InputStreamReader(System.in));
        for(String line;(line=input.readLine())!=null;) {
            int[] v=Arrays.stream(line.split(" ")).mapToInt(Integer::parseInt).toArray();
            map=v[0]==1;init(v[1],v[2]);editAt=v[3];mutation=v[4];reads=0;trace=new StringBuilder();
            String fault="ok";
            try {if(map)mf.a(1);else pk.a(95);}
            catch(Throwable t){while(t instanceof g wrapped)t=wrapped.a;fault=t instanceof NullPointerException?"null":
                t instanceof IndexOutOfBoundsException?"bounds":t instanceof ClassCastException?"cast":t instanceof IllegalStateException?"fixture":t.getClass().getName();}
            StringBuilder inserted=new StringBuilder();
            for(ec sprite:pa.xb)if(sprite!=null)inserted.append(ident(sprite.z)).append(',').append(sprite.w).append(',').append(sprite.c)
                .append(',').append(sprite.s).append(',').append(sprite.t).append(',').append(sprite.f).append(';');
            System.out.println(fault+"|"+trace+"|"+state(list)+"|"+state(alt)+"|"+ah.i+"|"+inserted);
        }
    }
}
