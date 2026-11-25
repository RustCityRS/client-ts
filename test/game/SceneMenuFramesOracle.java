import java.io.*;
import java.nio.file.*;
import java.util.*;
import jdk.internal.org.objectweb.asm.*;
import jdk.internal.org.objectweb.asm.tree.*;

// Replace only the 3D pick source at the 1337 widget. Keep the jar's lf.a
// interface traversal, pg.a menu builder, gf.e draw and t.c tick intact.
public class SceneMenuFramesOracle {
    static final long NPC_KEY=(100L<<32)|(1<<29)|(35<<7)|33;
    static long pickKey=NPC_KEY;
    static boolean picked;
    static boolean drawCross;

    static void patchViewport(Path folder)throws Exception {
        ClassNode layer=new ClassNode();
        try(InputStream input=SceneMenuFramesOracle.class.getResourceAsStream("/lf.class")){
            new ClassReader(input).accept(layer,0);
        }
        int replaced=0;
        for(MethodNode method:layer.methods)for(AbstractInsnNode insn:method.instructions){
            if(insn instanceof MethodInsnNode call && call.owner.equals("kk") && call.name.equals("a") && call.desc.equals("(BIIIIZ)V")){
                call.owner="SceneMenuFramesOracle";call.name="drawScene";replaced++;
            }
        }
        if(replaced!=1)throw new AssertionError("Viewport calls: "+replaced);
        ClassWriter writer=new ClassWriter(0);layer.accept(writer);
        Files.write(folder.resolve("lf.class"),writer.toByteArray());
    }

    public static void drawScene(byte guard,int height,int width,int y,int x,boolean fixed){
        Arrays.fill(rg.s.n,0);
        pf.W[0]=pickKey;dd.r=picked?1:0;
        if(o.O){si.t=33;hl.Y=35;o.O=false;}
        if(drawCross){
            td.b(x,y,x+width,y+height);
            qa.a(width,height,x,y,guard ^ -48);
        }
        if(!fixed && !ie.F && ve.g>=x && ve.g<x+width && ud.j>=y && ud.j<y+height)
            pg.a(y,ve.g,-127,width,height,ud.j,x);
    }

    static client initScene()throws Exception {
        client app=WidgetMenuFramesOracle.init(160,128);
        aj scene=new aj();scene.Kc=0x10000;scene.n=-1;scene.ob=3;scene.y=true;scene.wc=1337;
        scene.ib=2;scene.Mb=3;scene.C=155;scene.H=122;fk.ab[1]=new aj[]{scene};
        byte[] metrics=new byte[257];Arrays.fill(metrics,(byte)4);metrics[256]=6;
        int[] sizes=new int[256];Arrays.fill(sizes,1);
        byte[][] masks=new byte[256][1];for(byte[] mask:masks)mask[0]=1;
        uf.b=new fg(metrics,new int[256],new int[256],sizes,sizes,masks);
        nh.ab=ff.P;ei.s=42;oj.j=-80;vf.X=80;p.l=-64;fl.m=64;
        bk npc=uc.l[100]=new bk();ja type=npc.mc=new ja();
        type.G=7843;type.r=vb.a("Guide",(byte)55);type.hb=true;type.y=0;type.F=new id[]{vb.a("Chat",(byte)55),null,null,null,null};
        npc.L[0]=33;npc.ac[0]=35;npc.Z=33*128+64;npc.S=35*128+64;
        te.g.L[0]=31;te.g.ac[0]=31;te.g.Z=te.g.S=31*128+64;
        hk.e=3072;vj.t=3168;for(int[] col:hc.c[0].d)Arrays.fill(col,0);
        si.t=hl.Y=-1;
        return app;
    }

    static void frame(client app,int[] e,DataOutputStream pixels,boolean rowParameters)throws Exception {
        sj.C=sa.x=e[2];pf.Q=oj.e=e[3];oi.h=e[4];ca.a=0;
        ea.c=100;lc.v=150;tj.h=tj.i=false;wg.g=rj.x=true;qk.v.yb=0;qk.v.a(new int[]{1,2,3,4},0);
        if(e[0]==0)app.d(0);else t.c(100);
        StringJoiner actions=new StringJoiner(",");
        for(int i=0;i<vb.o;i++){
            actions.add(rowParameters?p.u[i]+":"+mh.h[i]+":"+ml.x[i]+":"+sa.z[i]+":"+ia.n[i]:Integer.toString(p.u[i]));
        }
        id tooltip=re.a(2);
        for(int pixel:rg.s.n)pixels.writeInt(pixel);
        System.out.println(String.join("|",actions.toString(),ie.F+","+fl.i+","+hc.j+","+lk.u+","+client.C,
            pk.k+","+ve.g+","+ud.j,df.J+","+jh.r+","+sb.a+","+kg.K,o.O+","+si.t+","+hl.Y,
            new String(tooltip.A,0,tooltip.c,java.nio.charset.StandardCharsets.ISO_8859_1),
            HexFormat.of().formatHex(qk.v.fb,0,qk.v.yb)));
    }

    public static void main(String[] args)throws Exception {
        if(args[0].equals("patch")){patchViewport(Path.of(args[1]));return;}
        client app=initScene();
        BufferedReader in=new BufferedReader(new InputStreamReader(System.in));
        try(DataOutputStream pixels=new DataOutputStream(new BufferedOutputStream(Files.newOutputStream(Path.of(args[1]))))){
          for(String line;(line=in.readLine())!=null;){
            int[] e=Arrays.stream(line.split(" ")).mapToInt(Integer::parseInt).toArray();
            picked=e[1]!=0;
            frame(app,e,pixels,false);
          }
        }
    }
}
