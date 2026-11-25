import java.io.*;
import java.nio.file.*;
import java.util.*;
import jdk.internal.org.objectweb.asm.*;

// Keep the control flow of gj.e, including the flag/plane loops and each
// live qg.G test. Observe its dependencies through the third cache reset.
public class MapBuildResetOrderOracle {
    static List<String> calls = new ArrayList<>();
    static int stage, resets, tiles, fail, mutate, clip;
    static boolean allLevels;
    static class Boundary extends Error {}

    static void instrument(Path directory) throws Exception {
        var redirects = Map.ofEntries(
            Map.entry("ph.a(ZI)V","keep"), Map.entry("al.a(III)[B","fetch"),
            Map.entry("ll.a(I[BII)Z","check"), Map.entry("vg.a(Lid;ZB)V","message"),
            Map.entry("uj.a(I)V","audio"), Map.entry("bf.c(I)V","reset"), Map.entry("mc.a(IIIIZ)V","world"),
            Map.entry("ke.b(I)V","clip"), Map.entry("oh.a(ZI)V","areaSounds"), Map.entry("java/lang/System.gc()V","gc"),
            Map.entry("aj.a(ZI)V","init"), Map.entry("g.a(BZ)V","land"), Map.entry("dg.a(ZZ)V","locs"),
            Map.entry("vg.e(I)V","npcs"), Map.entry("wj.a(ZI)V","dynamicLand"), Map.entry("jh.a(BZ)V","dynamicLocs"),
            Map.entry("al.a(I[Lke;Z)V","finish"), Map.entry("dl.a(Z)Z","levels"), Map.entry("cf.a(I)V","base"),
            Map.entry("lk.c(I)V","quit"), Map.entry("ng.b(III)V","tile"), Map.entry("ia.c(I)V","roofs"), Map.entry("l.b(Z)V","correct")
        );
        try(var in=MapBuildResetOrderOracle.class.getResourceAsStream("/gj.class")){
            ClassReader r=new ClassReader(in);ClassWriter w=new ClassWriter(0);
            r.accept(new ClassVisitor(Opcodes.ASM8,w){
                public MethodVisitor visitMethod(int acc,String name,String desc,String sig,String[] ex){
                    var m=super.visitMethod(acc,name,desc,sig,ex);
                    if (!name.equals("e") || !desc.equals("(I)V")) return m;
                    return new MethodVisitor(Opcodes.ASM8,m){
                        public void visitMethodInsn(int op,String owner,String name,String type,boolean itf){
                            String dst=redirects.get(owner+"."+name+type);
                            if(dst == null) super.visitMethodInsn(op,owner,name,type,itf);
                            else super.visitMethodInsn(Opcodes.INVOKESTATIC,"MapBuildResetOrderOracle",dst,
                                op==Opcodes.INVOKESTATIC?type:"(L"+owner+";"+type.substring(1),false);
                        }
                    };
                }
            },0);
            Files.write(directory.resolve("gj.class"),w.toByteArray());
        }
    }

    static void event(String name) { calls.add(name); }
    static void require(boolean yes) { if(!yes)throw new AssertionError(); }
    static void keep(boolean force,int g) { event(force?"keep":"start"); }
    static byte[] fetch(al archive,int g,int file,int id) { require(file==0 && id==4);event("missing");return null; }
    static boolean check(int x,byte[] bytes,int g,int z){ require(g==6685);event("models");return stage!=2; }
    static void message(id text,boolean immediate,byte g){require(immediate && text!=null);event("message");}
    static void audio(int g){require(g==64);event("audio");}
    static void reset(int g){
        require(g==-18131); event("reset"+(++resets));
        if(fail==resets || resets==3)throw new Boundary();
    }
    static void world(int levels,int x,int z,int distance,boolean water){
        require(levels==4 && x==104 && z==104 && distance==25 && !water);event("world");
    }
    static void clip(ke map,int g){require(map==hc.c[clip]); event("clip"+clip++);}
    static void areaSounds(boolean all,int g){
        require(!all);require(tb.t[0][0][0]==0 && tb.t[3][103][103]==0);event("sounds");
    }
    static void gc(){event("gc");}
    static void init(boolean water,int g){require(!water);event("init");}
    static void land(byte g,boolean water){require(!water);event("land");}
    static void locs(boolean g,boolean water){
        require(g && !water);event("locs");
        if(mutate==1)qg.G=true;
        if(mutate==2)kg.o=null;
        if(mutate==3)kg.o=new byte[0][];
    }
    static void npcs(int g){require(g==63);event("npcs");}
    static void dynamicLand(boolean water,int g){require(!water);event("dynamicLand");}
    static void dynamicLocs(byte g,boolean water){require(!water);event("dynamicLocs");}
    static void finish(int g,ke[] maps,boolean water){require(g==128 && maps==hc.c && !water);event("finish");}
    static boolean levels(boolean g){require(g);event("levels");return allLevels;}
    static void base(int level){event("base"+level);}
    static void quit(int g){require(g==8428);event("quit");}
    static void tile(int g,int z,int x){
        require(g==72 && z==tiles%104 && x==tiles/104);
        if(++tiles==10816)event("tiles");
    }
    static void roofs(int g){require(g==512);event("roofs");}
    static void correct(boolean g){require(g);event("correct");}

    public static void main(String[] args)throws Exception{
        if(args.length!=0){instrument(Path.of(args[0]));return;}
        re.d=new al(null,false,false); ug.d=new kc(0);
        hc.c=new ke[]{new ke(104,104),new ke(104,104),new ke(104,104),new ke(104,104)};
        tb.t=new byte[4][104][104];
        var input=new BufferedReader(new InputStreamReader(System.in));
        for(String line;(line=input.readLine())!=null;){
            int[] v=Arrays.stream(line.split(" ")).mapToInt(Integer::parseInt).toArray();
            stage=v[0];qg.G=v[1]!=0;boolean npc=v[2]!=0;allLevels=v[3]!=0;fail=v[4];mutate=v[5];
            bc.e=v[6];je.Z=2;ah.f=0;ae.c=null;kg.o=npc?new byte[0][]:null;
            fd.X=new int[]{stage==1?4:-1};hh.qb=new int[]{-1};rb.i=new int[]{0};
            mk.G=new byte[1][];lk.x=new byte[][]{stage==1?null:new byte[]{0}};
            tb.t[0][0][0]=1;tb.t[3][103][103]=1;
            calls.clear();resets=0;tiles=0;clip=0;
            try{gj.e(-30458);}catch(Boundary done){}
            System.out.println(bc.e+"/"+tb.t[3][103][103]+"/"+String.join(",",calls));
        }
    }
}
