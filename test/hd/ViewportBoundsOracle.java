import java.io.*;
import java.lang.reflect.Proxy;
import java.util.*;
import javax.media.opengl.GL;

/** Original HD ja.a with the JOGL command receiver observed while dj renders the actual bars. */
public final class ViewportBoundsOracle {
    static final List<String> commands = new ArrayList<>();
    static int fault, fans, vertices;

    public static void main(String[] args) throws Exception {
        tf.J = 765; tf.A = 503;
        tf.t = (GL) Proxy.newProxyInstance(GL.class.getClassLoader(),new Class<?>[]{GL.class},(o,method,values)->{
            String op = method.getName();
            var params = new ArrayList<String>();
            if (values != null) for (Object value : values) {
                if (value instanceof Float f) params.add(Integer.toHexString(Float.floatToRawIntBits(f)));
                else if (value instanceof Double d) params.add(Long.toHexString(Double.doubleToRawLongBits(d)));
                else params.add(String.valueOf(value));
            }
            commands.add(op+"("+String.join(",",params)+")");
            if (op.equals("glBegin")) fans++;
            if (op.equals("glVertex2f")) vertices++;
            if (fault == 1 && op.equals("glDisable") || fault == 2 && fans == 2 && vertices == 5) throw new IllegalStateException();
            return null;
        });
        var input=new BufferedReader(new InputStreamReader(System.in));
        for (String line; (line=input.readLine())!=null;) {
            int[] a=Arrays.stream(line.split(" ")).mapToInt(Integer::parseInt).toArray();
            tf.w = a[0]!=0; od.g = (short)a[8]; an.db = (short)a[9]; mc.tb = (short)a[10]; ac.k = (short)a[11];
            ee.f = (short)a[12]; kd.yb = (short)a[13];
            ah.n=-1001; bn.eb=-1002; nc.n=-1003; tm.i=-1004; sc.p=-1005;
            fans=0; vertices=0; fault=a[7]; commands.clear(); String result="ok";
            try { ja.a(a[3],a[6],a[2],a[4],a[1],a[5]!=0); }
            catch (ld e) {
                Throwable root=e; while(root instanceof ld wrapped) root=wrapped.f;
                result=root.getClass().getSimpleName()+" "+e.e.substring(e.e.lastIndexOf("ja.C("));
            }
            System.out.println(result+"|"+ah.n+","+bn.eb+","+nc.n+","+tm.i+","+sc.p+"|"+String.join(";",commands));
        }
    }
}
