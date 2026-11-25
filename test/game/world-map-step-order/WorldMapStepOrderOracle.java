import java.awt.*;
import java.awt.image.BufferedImage;
import java.io.*;
import java.nio.file.*;
import java.nio.charset.StandardCharsets;
import java.util.*;

public class WorldMapStepOrderOracle {
    static final String[] names={"mesa","forest","bay"};
    static final gh[] areas=new gh[3];
    static final al[] archives=new al[3];
    static final class Clock extends e {
        int resets;
        void a(byte ignored){resets++;}
        int a(byte ignored,int minimum,int time){return 1;}
    }
    static final Clock clock=new Clock();
    static final class Surface extends Canvas {
        String font="-";
        public FontMetrics getFontMetrics(Font f) {
            if(font.equals("-"))font=f.getSize()+"."+f.getStyle();
            if(setup.equals("font-fault"))throw new NullPointerException("font");
            return super.getFontMetrics(f);
        }
        public Image createImage(int w,int h){return new BufferedImage(w,h,BufferedImage.TYPE_INT_RGB);}
    }
    static final Surface canvas=new Surface();
    static String setup,actions;
    static byte[] table;
    static int indexes,ready;
    static final ArrayList<String> calls=new ArrayList<>();
    static void callback(String event) {
        calls.add(event);
        for(String action:actions.split(",")) {
            String[] pair=action.split("=");
            if(pair.length!=2 || !pair[0].equals(event))continue;
            switch(pair[1]) {
            case "B":rk.h=areas[1];he.y=archives[1];aa.d=archives[1];break;
            case "C":rk.h=areas[2];he.y=archives[2];aa.d=archives[2];break;
            case "null-area":rk.h=null;break;
            case "null-archive":he.y=null;break;
            case "null-percent":aa.d=null;break;
            case "null-name":rk.h.T=null;break;
            case "miss":rk.h.T=aj.a("missing",(byte)-77);break;
            default:throw new AssertionError(action);
            }
        }
    }
    static class Provider extends ud {
        final int id; final String name;
        Provider(int id){this.id=id;name="ABC".substring(id,id+1);}
        db b(int unused){
            callback(name+".i");
            return (indexes&(1<<id))==0?null:new db(table,q.a(0,table,table.length));
        }
        byte[] a(int unused,int group){
            callback(name+".g"+group);
            if((ready&(1<<id))==0)return null;
            if(group<3)return new byte[]{0,0,0,0,0};
            // Labels have a visible archive and group marker in both name and coordinates.
            return new byte[]{0,0,0,0,12,(byte)(65+id),(byte)(48+group),0,16,0,(byte)id,0,(byte)group,0,1,2,3};
        }
        int c(int group,int unused){callback(name+".p"+group);return 17+24*id+10*group;}
        void b(int unused,int group){throw new AssertionError("prefetch");}
    }
    static String text(id name){return name==null?"-":new String(name.A,0,name.c,StandardCharsets.ISO_8859_1);}
    static void run(String line,Path root)throws Exception{
        String[] w=line.split(" ");int stage=Integer.parseInt(w[0]);boolean bold=w[1].equals("1");
        setup=w[2];indexes=Integer.parseInt(w[3]);ready=Integer.parseInt(w[4]);actions=w[5];calls.clear();
        table=Files.readAllBytes(root.resolve("index"+stage));
        for(int i=0;i<3;i++){
            gh area=areas[i]=new gh(aj.a(names[i],(byte)-77),null,2+i,3+i,0,true,new int[]{37,75,200}[i]);
            area.I=64+i*128;area.F=area.I+64*(i+1);area.W=128+i*64;area.ab=area.W+64*(i+1);
            archives[i]=new al(new Provider(i),true,true);
        }
        rk.h=areas[0];he.y=archives[0];aa.d=archives[2];if(setup.equals("no-area"))rk.h=null;
        if(setup.equals("no-name"))rk.h.T=null;if(setup.equals("miss"))rk.h.T=aj.a("missing",(byte)-77);
        if(setup.equals("no-archive"))he.y=null;if(setup.equals("no-percent"))aa.d=null;
        sa.w=stage;oi.a=1;od.P=2;ki.db=ml.m=0;c.C=7;sg.b=9;hd.h=ug.f=1.0f;mc.U=35;
        clock.resets=0;gh.X=clock;canvas.font="-";pe.S=canvas;tf.C=30;
        te.g=setup.equals("no-player")?null:new pb();hk.e=vj.t=-800;b.J=0;
        jg.t=new kc(2);lk.E=ig.y=ia.k=rb.b=qa.T=t.Y=ml.Q=hj.j=null;
        for(int i=0;i<4;i++){hc.c[i]=new ke(104,104);hc.c[i].d[4][5]=73+i;}
        if(setup.equals("bad-map"))hc.c[2]=null;
        String fault="ok";
        try{lg.b(bold);}catch(RuntimeException error){
            if (!(error instanceof g wrapped) || !wrapped.q.endsWith("lg.L(" + bold + ")")) throw error;
            Throwable t=error;while(t instanceof g)t=((g)t).a;
            if(t instanceof NullPointerException)fault="null";
            else if(t instanceof IndexOutOfBoundsException)fault="bounds";
            else throw error;
        }
        int current=Arrays.asList(areas).indexOf(rk.h), archive=Arrays.asList(archives).indexOf(he.y);
        String label=jg.t==null?"-":Integer.toString(jg.t.h);
        if(jg.t!=null && jg.t.h==1)label+="."+text(jg.t.j[0])+"."+jg.t.m[0]+"."+jg.t.l[0];
        StringJoiner out=new StringJoiner("/");
        for(Object value:new Object[]{fault,sa.w,current,archive,oi.a,od.P,ki.db,ml.m,c.C,sg.b,(int)hd.h,(int)ug.f,
            label,clock.resets,mc.U,hc.c[0].d[4][5],lk.E!=null?1:0,hj.j!=null?1:0,canvas.font,String.join(",",calls)})out.add(""+value);
        System.out.println(out);
    }
    public static void main(String[] args)throws Exception{
        Path root=Path.of(args[0]);
        for(String line:Files.readAllLines(root.resolve("cases")))run(line,root);
    }
}
