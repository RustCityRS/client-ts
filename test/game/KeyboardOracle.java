import java.awt.*;
import java.awt.event.*;
import java.io.*;
import java.util.*;

final class KeyboardOracle {
    static final vb handler=new vb();
    static class Surface extends Canvas {
        String calls="";
        public synchronized void addKeyListener(KeyListener k){calls+="ak"+(k==handler);}
        public synchronized void addFocusListener(FocusListener k){calls+="af"+(k==handler);}
        public synchronized void removeKeyListener(KeyListener k){calls+="rk"+(k==handler);}
        public synchronized void removeFocusListener(FocusListener k){calls+="rf"+(k==handler);}
        public void setFocusTraversalKeysEnabled(boolean enabled){calls+="tab"+enabled;}
    }
    @SuppressWarnings("deprecation")
    public static void main(String[] argv)throws Exception{
        Surface surface=new Surface();li.t=handler;
        BufferedReader in=new BufferedReader(new InputStreamReader(System.in));
        String line;
        while((line=in.readLine())!=null){
            String[] a=line.split(" ");int x=a.length>1?Integer.parseInt(a[1]):0,mod=a.length>2?Integer.parseInt(a[2]):0;
            String result="ok";surface.calls="";
            try{
                switch(a[0]){
                    case "map" -> {fb.p=x==0?"OpenJDK":"MICROSOFT Inc";fb.s=mod!=0?Component.class.getMethod("setFocusTraversalKeysEnabled",boolean.class):null;fi.b(12506);}
                    case "press","release","type" -> {
                        boolean typed=a[0].equals("type"),press=a[0].equals("press");
                        KeyEvent e=typed && x!=65535?new KeyEvent(surface,KeyEvent.KEY_TYPED,1,mod,0,(char)x):
                            new KeyEvent(surface,press?KeyEvent.KEY_PRESSED:KeyEvent.KEY_RELEASED,1,mod,typed?0:x,KeyEvent.CHAR_UNDEFINED);
                        if(press)handler.keyPressed(e);else if(typed)handler.keyTyped(e);else handler.keyReleased(e);
                        result=Boolean.toString(e.isConsumed());
                    }
                    case "gain" -> handler.focusGained(new FocusEvent(surface,FocusEvent.FOCUS_GAINED));
                    case "lost" -> handler.focusLost(new FocusEvent(surface,FocusEvent.FOCUS_LOST));
                    case "add" -> pj.a((byte)112,surface);
                    case "stop" -> ea.a(x,surface);
                    case "clear" -> ed.b(13548);
                    case "on" -> li.t=handler;
                    case "poll" -> ng.b(true);
                    case "next" -> result=Boolean.toString(id.c(false));
                    case "idle" -> mi.A=x;
                    case "collect" -> {
                        ok.D=0;
                        while(id.c(false)&&ok.D<128){sc.T[ok.D]=ek.y;hd.i[ok.D]=mg.F;ok.D++;}
                    }
                    default -> throw new AssertionError(line);
                }
            }catch(g e){
                if(e.a instanceof IndexOutOfBoundsException)result="bounds";
                else if(e.a instanceof NullPointerException)result="null";
                else throw e;
            }
            StringJoiner row=new StringJoiner(" ");
            row.add(result).add(surface.calls.isEmpty()?"-":surface.calls);
            for(int k:new int[]{c.a(0),fi.k,tg.v,ka.n,g.s,ob.C,ek.y,mg.F,ok.D,Arrays.hashCode(cf.m),
                Arrays.hashCode(id.w),Arrays.hashCode(ak.f),Arrays.hashCode(ti.N),Arrays.hashCode(ob.q),Arrays.hashCode(sc.T),Arrays.hashCode(hd.i)})
                row.add(Integer.toString(k));
            System.out.println(row);
        }
    }
}
