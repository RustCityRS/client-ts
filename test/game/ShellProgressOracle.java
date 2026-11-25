import java.awt.*;
import java.awt.image.*;
import java.io.*;
import java.util.Arrays;
import javax.swing.DebugGraphics;

// t.a draws against these AWT endpoints. Keep coordinates, operand order and failures observable.
public class ShellProgressOracle {
    static StringBuilder log = new StringBuilder();
    static int fault;
    static final BufferedImage screen = new BufferedImage(313,71,BufferedImage.TYPE_INT_RGB);
    static class Surface extends BufferedImage {
        Surface(int w,int h) { super(w,h,BufferedImage.TYPE_INT_RGB); }
        public Graphics getGraphics() {
            log.append("bar;");
            if (fault == 4) throw new IllegalStateException();
            return new Draw(super.getGraphics(),true);
        }
    }
    static class Draw extends DebugGraphics {
        final Graphics out;
        final boolean bar;
        Draw(Graphics out,boolean bar) { this.out=out;this.bar=bar; }
        public void setColor(Color c) { log.append("c"+(c.getRGB()&0xffffff)+";");out.setColor(c); }
        public void drawRect(int x,int y,int w,int h) { log.append("r"+x+","+y+","+w+","+h+";");out.drawRect(x,y,w,h); }
        public void fillRect(int x,int y,int w,int h) { log.append("f"+x+","+y+","+w+","+h+";");out.fillRect(x,y,w,h); }
        public void setFont(Font f) { log.append("font"+f.getName()+","+f.getStyle()+","+f.getSize()+";");out.setFont(f); }
        public void drawString(String s,int x,int y) {
            log.append("s"+s+","+x+","+y+";");
            if (bar && fault==6 || !bar && fault==7) throw new IllegalStateException();
            out.drawString(s,x,y);
        }
        public boolean drawImage(Image image,int x,int y,ImageObserver observer) {
            log.append("blit"+x+","+y+";");
            if (fault==5) throw new IllegalStateException();
            return out.drawImage(image,x,y,observer);
        }
    }
    static class Host extends Canvas {
        public Graphics getGraphics() {
            log.append("screen;");
            if (fault==1) throw new IllegalStateException();
            return new Draw(screen.getGraphics(),false);
        }
        public FontMetrics getFontMetrics(Font f) {
            log.append("metrics"+f.getName()+","+f.getStyle()+","+f.getSize()+";");
            if (fault==2) throw new IllegalStateException();
            return new FontMetrics(f) {
                public int stringWidth(String s) {
                    log.append("w"+s+";");
                    if (fault==8) throw new IllegalStateException();
                    return s.equals("wide") ? Integer.MAX_VALUE : 11*s.length();
                }
            };
        }
        public Image createImage(int w,int h) {
            log.append("new"+w+","+h+";");
            return fault==3 ? null : new Surface(w,h);
        }
        public void repaint() { log.append("repaint;"); }
    }
    static id string(String s) {
        if (s.equals("null")) return null;
        byte[] b=(s.equals("empty")?"":s).getBytes(java.nio.charset.StandardCharsets.ISO_8859_1);
        return ea.a(b,0,b.length,0);
    }
    public static void main(String[] args) throws Exception {
        var input=new BufferedReader(new InputStreamReader(System.in,java.nio.charset.StandardCharsets.UTF_8));
        var output=new PrintWriter(System.out,true,java.nio.charset.StandardCharsets.UTF_8);
        pe.S=new Host();
        client applet=WindowModeOracle.container(client.class);
        aj.kb=WindowModeOracle.container(WindowModeOracle.TestFrame.class);
        for (String line; (line=input.readLine())!=null;) {
            String[] f=line.split(" ");
            if (Integer.parseInt(f[0])!=0) wi.a(255);
            fault=Integer.parseInt(f[1]);hi.f=Integer.parseInt(f[2]);fl.l=Integer.parseInt(f[3]);
            tk.h=string(f[7]);
            Graphics g=screen.getGraphics();g.setColor(new Color(0x416982));g.fillRect(0,0,313,71);g.dispose();
            log.setLength(0);
            int c=Integer.parseInt(f[8]);
            if(f.length>9) {
                tf.C=0;hi.g=f[5].equals("1");vk.rb=hi.f;oh.j=fl.l;sk.N=pa.rb=0;
                ga.D=Integer.parseInt(f[4]);ie.A=string(f[6]);qf.f=false;
                applet.d(0);
                if(f[9].equals("leave"))ej.a(-11461,1);
                log.append("state"+tf.C+","+hi.g+";");
            } else t.a(Integer.parseInt(f[4]),f[5].equals("1"),string(f[6]),(byte)75,c<0?null:new Color(c));
            boolean pixelCase=(f[6].equals("empty")&&f[7].equals("null"));
            output.println(log+"|"+(ci.h!=null)+","+(wj.f!=null)+","+(wg.a!=null)+"|"+
                (pixelCase?Arrays.hashCode(screen.getRGB(0,0,313,71,null,0,313)):0));
        }
    }
}
