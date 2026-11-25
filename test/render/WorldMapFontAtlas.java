import java.awt.*;
import java.awt.image.*;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.util.*;
import java.util.zip.Deflater;
import java.util.zip.DeflaterOutputStream;

/** Builds browser host data using only standard AWT. No gamepack is required.
 * Run with the checkout's Windows Temurin JDK: java WorldMapFontAtlas.java path/to/WorldMapFontAtlas.ts */
class WorldMapFontAtlas {
    static final String REPERTOIRE = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!\"£$%^&*()-_=+[{]};:'@#~,<.>/?\\| ÄËÏÖÜäëïöüÿßÁÀÉÈÍÌÓÒÚÙáàéèíìóòúùÂÊÎÔÛâêîôûÆæ";
    static final int[] SIZES = {11,12,14,17,19,22,26,30};
    public static void main(String[] args) throws Exception {
        Canvas canvas=new Canvas();
        boolean nativePeer=args.length>1 && args[1].equals("peer");
        Frame frame=null;
        if(nativePeer) { frame=new Frame();frame.add(canvas);frame.addNotify(); }
        try {
            StringBuilder out=new StringBuilder("// Raw Helvetica cells sampled from Windows AWT by test/render/WorldMapFontAtlas.java.\n");
            out.append("// Each stream contains metrics, then per character its advance and two grayscale masks (one and two strikes).\n");
            out.append("export const worldMapFontCells: Readonly<Record<number,string>> = {\n");
            for(int size:SIZES)for(int style:new int[]{Font.PLAIN,Font.BOLD}) {
                Font f=new Font("Helvetica",style,size); FontMetrics fm=canvas.getFontMetrics(f);
                ByteArrayOutputStream buf=new ByteArrayOutputStream();
                Deflater deflate=new Deflater(9,true);
                try(DataOutputStream data=new DataOutputStream(new DeflaterOutputStream(buf,deflate))) {
                    data.writeByte(fm.getMaxAscent());data.writeByte(fm.getMaxDescent());data.writeByte(fm.getHeight());
                    for(char letter:REPERTOIRE.toCharArray()) {
                        int advance=fm.charWidth(letter), w=advance+1, h=fm.getMaxAscent()+fm.getMaxDescent();
                        data.writeByte(advance);
                        for(int strikes=1;strikes<=2;strikes++) {
                            Image cell=nativePeer?canvas.createImage(w,h):new BufferedImage(w,h,BufferedImage.TYPE_INT_RGB);
                            Graphics g=cell.getGraphics();
                            g.setColor(Color.black);g.fillRect(0,0,w,h);g.setColor(Color.white);g.setFont(f);
                            for(int x=0;x<strikes;x++)g.drawString(String.valueOf(letter),x,fm.getMaxAscent());
                            int[] pixels=new int[w*h];
                            if(!new PixelGrabber(cell,0,0,w,h,pixels,0,w).grabPixels())throw new IOException("PixelGrabber");
                            for(int rgb:pixels)data.writeByte(rgb & 255);
                            g.dispose();cell.flush();
                        }
                    }
                } finally { deflate.end(); }
                out.append("    ").append(size*2+style).append(": '").append(Base64.getEncoder().encodeToString(buf.toByteArray())).append("',\n");
            }
            out.append("};\n"); Files.writeString(Path.of(args[0]),out,StandardCharsets.UTF_8);
        } finally {if(frame!=null)frame.dispose();}
    }
}
