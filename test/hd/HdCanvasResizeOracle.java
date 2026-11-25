import java.applet.Applet;
import java.awt.*;
import java.nio.file.Path;
import java.util.StringJoiner;

/** Original qh.a(true), including a canvas replacement or removal from its AWT size callback. */
@SuppressWarnings("removal")
public final class HdCanvasResizeOracle {
    static int mutation, sizes, width, height;
    static Canvas second;
    static void event(String name) { WindowLayoutOracle.event(name); }
    static Dimension size(String host) { event(host+".size"); return new Dimension(width+sizes++,height+sizes); }
    static class Page extends Applet {
        public Dimension getSize(){return HdCanvasResizeOracle.size("page");}
        public Graphics getGraphics(){event("page.graphics");return null;}
    }
    static class Window extends Frame {
        String name;
        public Dimension getSize(){return HdCanvasResizeOracle.size(name);}
        public Insets getInsets(){event(name+".insets");return new Insets(7,3,13,8);}
        public Graphics getGraphics(){event(name+".graphics");return null;}
    }
    static class Display extends Canvas {
        final int id;
        Display(int id){this.id=id;}
        public void setSize(int w,int h){
            event("canvas"+id+".size="+w+","+h+"/gl="+tf.J+","+tf.A);
            if (mutation==1) md.L=second;
            if (mutation==2) md.L=null;
        }
        public void setLocation(int x,int y){event("canvas"+id+".location="+x+","+y);}
    }
    public static void main(String[] args) throws Exception {
        if (args.length!=0) {WindowLayoutOracle.instrument(true,Path.of(args[0]),"qh","(Z)V");return;}
        fk.l=(ll)WindowLayoutOracle.headless(ll.class);
        fk.l.i=(Page)WindowLayoutOracle.headless(Page.class);
        Window desktop=(Window)WindowLayoutOracle.headless(Window.class);desktop.name="frame";
        Window full=(Window)WindowLayoutOracle.headless(Window.class);full.name="full";
        Display first=new Display(0);
        second=new Display(1);
        md.W=-1;
        for(int host=0;host<3;host++) for(int mode=0;mode<4;mode++) for(int size=0;size<2;size++)
            for(mutation=0;mutation<3;mutation++) for(int fault=0;fault<16;fault++) {
                width=size==0?610:1181; height=size==0?407:803;
                sizes=0; WindowLayoutOracle.fault=fault; WindowLayoutOracle.events.clear();
                tf.w=(mode&1)!=0; jk.y=(mode&2)!=0; tf.J=43;tf.A=47;
                d.Y=host==0?null:desktop;fh.Y=host==2?full:null;md.L=first;
                for(String f:WindowLayoutOracle.HD) WindowLayoutOracle.field(f).setInt(null,-77);
                String result="ok";
                try {qh.a(true);} catch(ld e){result=e.e;}
                StringJoiner state=new StringJoiner(",");
                for(String f:WindowLayoutOracle.HD) state.add(String.valueOf(WindowLayoutOracle.field(f).getInt(null)));
                System.out.println(String.join(" ",WindowLayoutOracle.events)+"|"+result+"|"+state+","+tf.J+","+tf.A+
                    ","+(md.L==null?-1:md.L==first?0:1));
            }
    }
}
