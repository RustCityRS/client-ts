import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.lang.reflect.Field;
import java.lang.reflect.Proxy;
import java.nio.ByteBuffer;
import java.security.MessageDigest;
import java.util.Arrays;
import java.util.HexFormat;
import javax.media.opengl.GL;

// wm.a(Lek;II)Z, including the stored coverage hash, partially filled shared scratch and bytes at the JOGL boundary.
public final class HdShadowTextureOracle {
    static String uploaded;
    static String hash(byte[] data) throws Exception {
        return data == null ? "-" : HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(data));
    }
    public static void main(String[] args) throws Exception {
        Field buffer = wm.class.getDeclaredField("g"), coverage = wm.class.getDeclaredField("h");
        buffer.setAccessible(true);
        coverage.setAccessible(true);
        tf.t = (GL)Proxy.newProxyInstance(GL.class.getClassLoader(), new Class<?>[]{GL.class}, (p,m,a) -> {
            if (m.getName().equals("glTexImage2D")) {
                ByteBuffer view = ((ByteBuffer)a[8]).duplicate();
                byte[] bytes = new byte[view.remaining()]; view.get(bytes);
                uploaded = hash(bytes);
            }
            return null;
        });
        BufferedReader in = new BufferedReader(new InputStreamReader(System.in));
        for (String line; (line = in.readLine()) != null;) {
            int[] a = Arrays.stream(line.split(" ")).mapToInt(Integer::parseInt).toArray();
            int width=a[0], size=a[1], x=a[2], z=a[3], len=a[4], pattern=a[5];
            ek bitmap = new ek(1,1,1); bitmap.a=width;
            bitmap.o = size < 0 ? null : new byte[size];
            if (bitmap.o != null) for (int i=0;i<size;i++) {
                bitmap.o[i] = (byte)(pattern==0 ? 0 : pattern==1 ? 200 : (i*13+i/11)%7==0 ? i|1 : 0);
            }
            byte[] scratch = len < 0 ? null : new byte[len];
            if (scratch != null) Arrays.fill(scratch,(byte)0x9a);
            buffer.set(null,scratch);
            wm block = new wm();
            for (int repeat=0;repeat<2;repeat++) {
                uploaded="-";
                String outcome;
                try { outcome=Boolean.toString(block.a(bitmap,x,z)); }
                catch (NullPointerException ex) {outcome="null";}
                catch (ArrayIndexOutOfBoundsException ex) {outcome="bounds "+ex.getMessage().split(" ")[1];}
                System.out.println(outcome+" "+coverage.getInt(block)+" "+hash(scratch)+" "+uploaded);
            }
        }
    }
}
