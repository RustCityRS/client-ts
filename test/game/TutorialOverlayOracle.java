import java.nio.file.*;
import java.util.*;
import java.io.*;

public class TutorialOverlayOracle {
    static final int HOST=(548<<16)|4;
    public static void main(String[] args)throws Exception {
        String cache=args[0];
        client app=WidgetMenuFramesOracle.init(765,503);
        al groups=new al(new ProviderConfigOracle.Provider(cache,3),false,false),sprites=new al(new ProviderConfigOracle.Provider(cache,8),false,false);
        ld.a(sprites,52);rh compass=fa.a(-123,sprites,mi.D,0);compass.c();ff.u=compass;
        hf.a(new al(new ProviderConfigOracle.Provider(cache,20),false,false),
            new al(new ProviderConfigOracle.Provider(cache,1),false,false),52,new al(new ProviderConfigOracle.Provider(cache,0),false,false));
        wf.a(new al(new ProviderConfigOracle.Provider(cache,13),false,false),sprites,
            true,new al(new ProviderConfigOracle.Provider(cache,7),false,false),groups);
        if(!qg.a(548,false)||!qg.a(371,false))throw new AssertionError("Missing cache groups");
        aj layer=fk.ab[371][0];if(layer.Lc==null || !layer.i || layer.hd)throw new AssertionError("unexpected 371:0 hooks");
        fk.ab[371][4].Wc=true; // tutorial_progress_open
        qd sub=new qd();sub.v=371;sub.q=1;va.Z.a((byte)-89,sub,(long)HOST);
        hd.m=548;ik.a(false,false);
        uf.b=wj.g;nh.ab=ff.P;tf.C=30;
        if(args.length>1){widgetFrames(app,layer);return;}
        int[][] points={{440,50},{255,300},{368,6},{512,95},{50,325},{100,337},{100,338},{37,300},{38,300},
                        {255,300},{255,300},{255,300},{255,160},{255,300},{100,337},{100,338}};
        for(int i=0;i<points.length;i++){
            int x=points[i][0],y=points[i][1];sub.q=i==10?0:1;layer.hd=i==9;
            if(i==11){layer.Yc=new id[]{vb.a("Inspect",(byte)55)};layer.N=new Object[]{1};}
            if(i==12){
                layer.Yc=null;layer.N=null;
                // Player design is mounted above tutorial_progress. Its host ends on
                // row 337; chat begins at 338.
                for(int[] mount:new int[][]{{11,771,0},{76,752,1}}){
                    if(!qg.a(mount[1],false))throw new AssertionError("Missing group "+mount[1]);
                    qd entry=new qd();entry.v=mount[1];entry.q=mount[2];
                    va.Z.a((byte)-89,entry,(long)((548<<16)|mount[0]));
                }
                ik.a(false,false);
            }
            sj.C=sa.x=x;pf.Q=oj.e=y;oi.h=0;o.O=false;pk.k=0;
            try {app.d(0);}catch(g failure){throw new AssertionError(failure.q,failure.a);}
            StringJoiner rows=new StringJoiner(",");
            for(int row=0;row<vb.o;row++)rows.add(""+p.u[row]);
            if(i!=11){oi.h=1;ge.b(false);}
            System.out.println(x+" "+y+" "+rows+" "+o.O);
        }
    }

    // A script-created test widget on the real tutorial layer. The host and all
    // other fixed-mode cache widgets, including the FPS layer, remain intact.
    static void widgetFrames(client app,aj layer)throws Exception {
        BufferedReader input=new BufferedReader(new InputStreamReader(System.in));
        for(String line;(line=input.readLine())!=null;){
            int[] v=Arrays.stream(line.split(" ")).mapToInt(Integer::parseInt).toArray();
            int x=v[0],y=v[1];aj c=new aj();c.Kc=(371<<16)|1000;c.n=layer.Kc;c.ib=199;c.Mb=12;c.C=34;c.H=24;
            c.wc=v[2];c.y=v[3]!=0;c.ob=v[4];c.f=v[5];c.Sc=new l(v[6],-1);c.Wc=v[7]!=0;c.hd=v[8]!=0;
            if(v[9]>=0){c.Yc=new id[v[9]+1];c.Yc[v[9]]=vb.a("Inspect",(byte)55);}
            if(v[10]!=0){aj child=new aj();child.Kc=c.Kc+1;child.n=c.Kc;child.y=false;child.ob=3;child.f=1;child.C=34;child.H=24;c.pb=new aj[]{child};}
            uc.c=v[11]!=0;ki.R=v[12];layer.pb=new aj[]{c};
            if(c.ob==2){
                c.G=c.M=1;c.Zb=new int[1];c.Ob=new int[1];c.yb=new int[20];c.Gb=new int[20];c.lb=new int[20];Arrays.fill(c.lb,-1);
            }
            if(c.wc==1338){c.s=new int[c.H];c.ud=new int[c.H];Arrays.fill(c.s,10);Arrays.fill(c.ud,8);}
            sj.C=sa.x=x;pf.Q=oj.e=y;oi.h=0;o.O=ie.F=false;pk.k=0;
            try{app.d(0);}catch(g failure){throw new AssertionError(line+" "+failure.q,failure.a);}
            StringJoiner rows=new StringJoiner(",");
            for(int i=0;i<vb.o;i++)rows.add(p.u[i]+":"+sa.z[i]);
            System.out.println(rows);
        }
    }
}
