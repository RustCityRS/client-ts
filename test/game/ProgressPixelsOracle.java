import java.awt.*;
import java.awt.image.BufferedImage;
import java.io.*;
import java.lang.reflect.Method;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.util.Base64;
import java.util.zip.DeflaterOutputStream;
import javax.imageio.ImageIO;

public final class ProgressPixelsOracle {
    static final int W = 765, H = 503;
    static final Font FONT = new Font("Helvetica",Font.BOLD,13);
    static class Surface extends Canvas {
        final BufferedImage screen = new BufferedImage(W,H,BufferedImage.TYPE_INT_RGB);
        public Graphics getGraphics() { return screen.getGraphics(); }
        public Image createImage(int w,int h) { return new BufferedImage(w,h,BufferedImage.TYPE_INT_RGB); }
    }
    static void set(String owner,String field,Object value) throws Exception {
        var f = Class.forName(owner).getDeclaredField(field);
        f.setAccessible(true);
        f.set(null,value);
    }
    static Method method(String owner,String name,Class<?>... params) throws Exception {
        Method m = Class.forName(owner).getDeclaredMethod(name,params);
        m.setAccessible(true);
        return m;
    }
    static Object string(boolean hd,String text) throws Exception {
        byte[] data = text.getBytes(StandardCharsets.ISO_8859_1);
        Method m = method(hd ? "an" : "ea","a",byte[].class,int.class,int.class,int.class);
        return m.invoke(null,data,hd ? -4114 : 0,data.length,0);
    }

    static void render(boolean hd,Path dir,Path script) throws Exception {
        Surface canvas = new Surface();
        set(hd ? "md" : "pe",hd ? "L" : "S",canvas);
        set(hd ? "dl" : "hi",hd ? "d" : "f",W);
        set(hd ? "uj" : "fl",hd ? "B" : "l",H);
        Class<?> str = Class.forName(hd ? "na" : "id");
        Method draw = hd ? method("bc","a",Color.class,boolean.class,boolean.class,str,int.class)
            : method("t","a",int.class,boolean.class,str,byte.class,Color.class);
        int frame = 0;
        for (String line : Files.readAllLines(script)) {
            String[] p = line.split("\t",-1);
            set(hd ? "wj" : "tk",hd ? "e" : "h",string(hd,p[0]));
            Object message = string(hd,p[1]);
            int progress = Integer.parseInt(p[2]);
            for (int i=0;i<Integer.parseInt(p[4]);i++) {
                boolean clear = p[3].equals("1") && i==0;
                if (hd) draw.invoke(null,null,false,clear,message,progress);
                else draw.invoke(null,progress,clear,message,(byte)75,null);
            }
            ImageIO.write(canvas.screen,"png",dir.resolve((hd?"hd-":"sd-") + frame++ + ".png").toFile());
        }
    }

    // The browser port's single startup font, generated with Windows AWT at its native pixel size.
    static void atlas(Path output) throws Exception {
        Surface canvas = new Surface();
        FontMetrics fm = canvas.getFontMetrics(FONT);
        ByteArrayOutputStream raw = new ByteArrayOutputStream();
        try (DataOutputStream data = new DataOutputStream(new DeflaterOutputStream(raw))) {
            for (int code=0;code<256;code++) {
                String text = Character.toString((char)code);
                BufferedImage im = new BufferedImage(48,48,BufferedImage.TYPE_INT_RGB);
                Graphics g = im.getGraphics();
                g.setFont(FONT);
                g.setColor(Color.white);
                g.drawString(text,8,30);
                g.dispose();
                int left=48,top=48,right=0,bottom=0;
                for (int y=0;y<48;y++) for (int x=0;x<48;x++) {
                    int v = im.getRGB(x,y) & 255;
                    if (v==0) continue;
                    if (v!=255) throw new AssertionError("nonbinary glyph " + code);
                    left=Math.min(left,x); top=Math.min(top,y); right=Math.max(right,x+1); bottom=Math.max(bottom,y+1);
                }
                if (right==0) {left=right=8;top=bottom=30;}
                data.writeByte(fm.stringWidth(text));
                data.writeByte(left-8); data.writeByte(top-30);
                data.writeByte(right-left); data.writeByte(bottom-top);
                for (int y=top;y<bottom;y++) {
                    int mask=0;
                    for (int x=left;x<right;x++) if ((im.getRGB(x,y)&255)!=0) mask |= 1<<(x-left);
                    data.writeShort(mask);
                }
            }
        }
        Files.writeString(output,"// Helvetica bold 13, sampled by test/game/ProgressPixelsOracle.java atlas.\n"
            + "export const progressFontCells = '" + Base64.getEncoder().encodeToString(raw.toByteArray()) + "';\n");
    }

    static void compare(Path dir,int frames) throws Exception {
        for (int i=0;i<frames;i++) {
            BufferedImage sd=ImageIO.read(dir.resolve("sd-"+i+".png").toFile());
            BufferedImage hd=ImageIO.read(dir.resolve("hd-"+i+".png").toFile());
            BufferedImage ts=ImageIO.read(dir.resolve("browser-"+i+".png").toFile());
            int mismatch=0,heading=0,soft=0;
            for (int y=0;y<H;y++) for (int x=0;x<W;x++) {
                int java=sd.getRGB(x,y),web=ts.getRGB(x,y);
                if (java!=hd.getRGB(x,y)) throw new AssertionError("gamepack disagreement");
                if (web!=java) {mismatch++; if (y<H/2-18) heading++;}
                if (y<H/2-18 && (web&255)!=0 && (web&255)!=255) soft++;
            }
            System.out.println(i + " " + mismatch + " " + heading + " " + soft);
        }
    }
    public static void main(String[] args) throws Exception {
        if (args[0].equals("atlas")) atlas(Path.of(args[1]));
        else if (args[0].equals("compare")) compare(Path.of(args[1]),Integer.parseInt(args[2]));
        else render(args[0].equals("hd"),Path.of(args[1]),Path.of(args[2]));
    }
}
