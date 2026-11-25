import java.awt.*;
import java.awt.image.*;
import java.io.*;
import java.lang.reflect.*;
import java.nio.*;
import java.nio.file.*;
import java.security.*;
import java.util.*;

/** The original eg class is loaded unchanged. Both AWT and eg construct their own fonts. */
class WorldMapFontOracle {
    static final Class<?>[] BLIT={int[].class,byte[].class,int.class,int.class,int.class,int.class,int.class,int.class,int.class};
    static final Method width=method("a",id.class),left=method("a",id.class,int.class,int.class,int.class,boolean.class);
    static final Method glyph=method("a",int.class,int.class,int.class,int.class,byte[].class),mono=method("a",BLIT),alpha=method("b",BLIT);
    static final Field data=field("b"),aa=field("c"),cursor=field("d"),offsets=field("f");
    static final MessageDigest digest;
    static {try {digest=MessageDigest.getInstance("SHA-256");} catch(Exception e){throw new AssertionError(e);}}
    static Method method(String name,Class<?>... args) {
        try {Method m=eg.class.getDeclaredMethod(name,args);m.setAccessible(true);return m;}catch(Exception e){throw new AssertionError(e);}
    }
    static Field field(String name) {
        try {Field f=eg.class.getDeclaredField(name);f.setAccessible(true);return f;}catch(Exception e){throw new AssertionError(e);}
    }
    static eg font;
    static int mode, images, flushes, trace;
    static boolean bold;
    static Canvas plain;
    static StringBuilder metricCalls;
    static OutputStream hostData;
    static final class Surface extends Canvas {
        public FontMetrics getFontMetrics(Font font) {
            bold=font.isBold();
            metricCalls.append(font.getSize()).append(bold?'b':'p').append(',');
            if(mode==5)throw new IllegalStateException();
            return super.getFontMetrics(font);
        }
        public Image createImage(int w,int h) {
            images++;trace=(trace*31+w)*31+h;
            if(mode==6&&images==10)pe.S=null;
            if(mode==7&&images==10)return null;
            return new BufferedImage(w,h,BufferedImage.TYPE_INT_RGB) {
                public Graphics getGraphics() {
                    Graphics2D g=createGraphics();
                    if(mode==3)g.setRenderingHint(RenderingHints.KEY_TEXT_ANTIALIASING,RenderingHints.VALUE_TEXT_ANTIALIAS_ON);
                    return g;
                }
                public ImageProducer getSource() {
                    if(mode==10 && images==10)throw new IllegalStateException();
                    if(mode==11 && images==10)return new MemoryImageSource(w,h,new int[w*h],0,w) {
                        public void startProduction(ImageConsumer c){throw new IllegalStateException();}
                    };
                    int[] rgb=getRGB(0,0,w,h,null,0,w);
                    for(int j=0;j<rgb.length;j++){
                        int c=rgb[j]&255;
                        if(c!=0&&(mode==2||mode==1&&bold))c=new int[]{29,30,31,101,229,230,231}[j%7];
                        if(mode==3)try{hostData.write(c);}catch(IOException e){throw new UncheckedIOException(e);}
                        rgb[j]=0xff000000|c*0x10101;
                    }
                    return new MemoryImageSource(w,h,rgb,0,w);
                }
                public void flush(){flushes++;if(mode==8&&images==10)throw new IllegalStateException();super.flush();}
            };
        }
    }
    static String failure(Throwable t) {
        while(t instanceof InvocationTargetException e)t=e.getCause();
        while(t instanceof g wrapped)t=wrapped.a;
        if(t instanceof NullPointerException)return "null";
        if(t instanceof IndexOutOfBoundsException)return "bounds";
        if(t instanceof IllegalStateException)return "host";
        if(t instanceof NegativeArraySizeException)return "size";
        throw new AssertionError(t);
    }
    static String packed(byte[] bytes) {return bytes==null?"-":Base64.getEncoder().encodeToString(bytes);}
    static String pixels(int[] words) {
        if(words==null)return "-";
        ByteBuffer buf=ByteBuffer.allocate(words.length*4).order(ByteOrder.LITTLE_ENDIAN);
        buf.asIntBuffer().put(words);
        return HexFormat.of().formatHex(digest.digest(buf.array()));
    }
    static String init(String[] parts,Path dir) throws Exception {
        int size=Integer.parseInt(parts[1]);boolean b=parts[2].equals("1");mode=Integer.parseInt(parts[3]);
        metricCalls=new StringBuilder();images=flushes=0;trace=1;pe.S=plain==null?new Surface():plain;font=null;
        String result="ok";Field chars=field("a"),length=field("e");
        Object oldChars=chars.get(null),oldOffsets=offsets.get(null);int oldLength=length.getInt(null);
        if(mode==12)chars.set(null,null);
        if(mode==13)length.setInt(null,-1);
        if(mode==14)length.setInt(null,20000);
        if(mode==15){chars.set(null,"A");length.setInt(null,2);}
        if(mode==16)eg.c();
        try(OutputStream out=new BufferedOutputStream(Files.newOutputStream(dir.resolve("cells-"+size+"-"+b+"-"+mode)))) {
            hostData=out;
            try{font=new eg(size,b,mode==9?null:plain==null?new Surface():plain);}catch(Exception e){result=failure(e);}
        }finally{chars.set(null,oldChars);length.setInt(null,oldLength);offsets.set(null,oldOffsets);}
        return String.join("|",result,metricCalls.toString(),images+","+flushes+","+trace,
            font==null?"-":aa.getBoolean(font)+","+cursor.getInt(font)+","+font.a()+","+font.b(),
            font==null?"-":packed((byte[])data.get(font)));
    }
    static String draw(String[] a)throws Exception {
        int op=Integer.parseInt(a[1]),x=Integer.parseInt(a[2]),y=Integer.parseInt(a[3]),colour=Integer.parseInt(a[4]);
        boolean shadow=a[5].equals("1");int clip=Integer.parseInt(a[6]),bad=Integer.parseInt(a[7]);
        byte[] raw=Base64.getDecoder().decode(a[8]);id s=new id(); s.c=raw.length;s.A=raw;
        int w=79,h=43;
        int[] screen=new int[bad==8?83:w*h];for(int i=0;i<screen.length;i++)screen[i]=0x91bc239e+i*1403747;
        td.a(bad==7?null:screen,w,h);
        if(clip==1)td.b(3,6,51,39);
        if(clip==2)td.b(27,9,28,10);
        if(clip==3)td.b(13,16,8,4);
        Object old=data.get(font),lookup=offsets.get(null);
        if(bad==1)s=null;
        if(bad==2)s.c+=3;
        if(bad==3)data.set(font,null);
        if(bad==4)data.set(font,Arrays.copyOf((byte[])old,11));
        if(bad==5)offsets.set(null,null);
        if(bad==6){int[] values=new int[256];Arrays.fill(values,-7);offsets.set(null,values);}
        String measured,status="ok";
        try{measured=""+width.invoke(font,s);}catch(Exception e){measured=failure(e);}
        try{
            if(op==0)font.b(s,x,y,colour,shadow);
            if(op==1)left.invoke(font,s,x,y,colour,shadow);
            if(op==2)glyph.invoke(font,raw.length==0?0:((int[])lookup)[raw[0]&255],x,y,colour,(byte[])data.get(font));
        }catch(Exception e){status=failure(e);}
        finally{data.set(font,old);offsets.set(null,lookup);}
        return measured+"|"+status+"|"+pixels(td.g);
    }
    static String blit(String[] a) {
        int[] p=Arrays.stream(a).skip(1).mapToInt(Integer::parseInt).toArray();
        byte[] source={0,1,29,30,31,70,(byte)128,(byte)229,(byte)230,(byte)231,(byte)255,2};
        int[] dest=new int[17];Arrays.setAll(dest,i->0xffbe8734+72187*i);
        String result="ok";
        try{(p[0]==0?mono:alpha).invoke(font,p[8]==1?null:dest,p[8]==2?null:source,p[1],p[2],p[3],p[4],p[5],p[6],p[7]);}
        catch(Exception e){result=failure(e);}
        return result+"|"+pixels(dest);
    }
    public static void main(String[] args)throws Exception {
        Path dir=Path.of(args[0]);
        Frame frame=null;
        if(args.length>1) {
            if(GraphicsEnvironment.isHeadless())plain=new Canvas(){
                public Image createImage(int w,int h){return new BufferedImage(w,h,BufferedImage.TYPE_INT_RGB);}
            };
            else{plain=new Canvas();frame=new Frame();frame.add(plain);frame.addNotify();}
        }
        try {
        BufferedReader in=new BufferedReader(new InputStreamReader(System.in)); PrintWriter out=new PrintWriter(System.out);
        for(String line:in.lines().toList()) {
            String[] a=line.split(" ",-1);
            out.println(a[0].equals("F")?init(a,dir):a[0].equals("D")?draw(a):blit(a));
        }out.flush();
        }finally{if(frame!=null)frame.dispose();}
    }
}
