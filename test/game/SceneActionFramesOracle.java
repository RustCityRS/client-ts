import java.io.*;
import java.nio.file.*;
import java.util.*;

// SceneMenuFramesOracle replaces kk.a's 3D pick source. The JAR still builds,
// sorts, selects and draws its own menu and writes all of its outbound packets.
public final class SceneActionFramesOracle {
    static final int LOC=3859231, ITEM=4102, PLAYER=91;
    static final long LOC_KEY=((long)LOC<<32)|(2L<<29)|(2<<20)|(10<<14)|(36<<7)|30;
    static final long[] KEYS={0,SceneMenuFramesOracle.NPC_KEY,LOC_KEY,(3L<<29)|(33<<7)|34,
        ((long)PLAYER<<32)|(32<<7)|29};

    static id str(String value){return vb.a(value,(byte)55);}

    static void setupPicks(){
        te.g.uc=44;te.g.zc=-1;te.g.Bc=0;
        jb loc=new jb();loc.k=LOC;loc.r=str("High key");loc.kb=new id[]{str("Climb"),null,str("Search"),null,str("Push")};
        loc.eb=loc.Y=0;loc.h=45;loc.u=44;loc.fb=3;loc.y=2;loc.tb=5;he.w.a((long)LOC,loc,(byte)-71);
        kl.Bb=new ra[4][104][104];ra tile=kl.Bb[0][30][36]=new ra(0,30,36);tile.z=new hk();tile.z.f=LOC_KEY;

        kl obj=new kl();obj.I=ITEM;obj.s=str("Arrow");obj.C=new id[]{str("Lift"),null,str("Take"),null,str("Burn")};
        obj.j=obj.fb=2;obj.d=331;obj.db=432;fa.b.a((long)ITEM,obj,(byte)-71);
        b.H[0][34][33]=new gk();ig item=new ig();item.m=ITEM;b.H[0][34][33].a(new b(item),false);

        pb player=tf.J[PLAYER]=new pb();player.Gc=str("Other");player.uc=50;player.qc=50;player.zc=-1;
        player.Bc=0;player.rc=0;player.L[0]=29;player.ac[0]=32;player.Z=29*128+64;player.S=32*128+64;
        Arrays.fill(bk.ic,null);Arrays.fill(la.jb,-1);Arrays.fill(oe.A,false);
        bk.ic[0]=str("Follow");bk.ic[3]=str("Trade with");fe.R=0;ed.d=0;
        for(int cursor:new int[]{44,45,331,432})r.X.a(cursor,new dl(),(byte)-71);
    }

    public static void main(String[] args)throws Exception {
        client app=SceneMenuFramesOracle.initScene();
        setupPicks();
        al sprites = new al(new ProviderConfigOracle.Provider(args[1],8),false,false);
        di.m = oh.a(0,sprites,(byte)75,sprites.a((byte)126,je.jb));
        if(di.m.length != 8) throw new AssertionError("Expected eight cache crosshair frames");
        SceneMenuFramesOracle.drawCross = true;
        BufferedReader input=new BufferedReader(new InputStreamReader(System.in));
        try(DataOutputStream pixels=new DataOutputStream(new BufferedOutputStream(Files.newOutputStream(Path.of(args[0]))))){
            for(String line;(line=input.readLine())!=null;){
                int[] e=Arrays.stream(line.split(" ")).mapToInt(Integer::parseInt).toArray();
                int mode=e[5];
                le.c=mode==1?1:0;ok.r=mode==2;pj.C=mode==2?127:0;oh.a=-1;
                al.s=str("Target");t.W=str("Cast");ge.Z=str("Selected");gl.C=ce.D=-1;
                qe.W=ti.X=0x10000;gh.Y=-1;gl.A=56123;ph.h=7;
                SceneMenuFramesOracle.pickKey=KEYS[e[1]];
                SceneMenuFramesOracle.picked=e[1]!=0;
                SceneMenuFramesOracle.frame(app,e,pixels,true);
            }
        }
    }
}
