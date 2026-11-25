import java.io.*;
import java.lang.reflect.*;
import java.util.*;

/** Call cb.a(Lcb;IS)I / gb.a(Lgb;IS)I directly, including on partly initialized models. */
public class AddPointFromModelOracle {
    public static void main(String[] args) throws Exception {
        boolean hd = args[0].equals("gl");
        Class<?> model = Class.forName(hd ? "gb" : "cb");
        Constructor<?> ctor = model.getDeclaredConstructor();
        ctor.setAccessible(true);
        Method add = model.getDeclaredMethod("a", model, int.class, short.class);
        add.setAccessible(true);
        String[] names = hd ? new String[]{"jb","fb","qb","J","rb","lb"} : new String[]{"m","l","T","o","j","s"};
        Field[] f = new Field[names.length];
        for (int i=0; i<f.length; i++) { f[i]=model.getDeclaredField(names[i]); f[i].setAccessible(true); }
        BufferedReader in = new BufferedReader(new InputStreamReader(System.in));
        for (String row; (row=in.readLine())!=null;) {
            int[] p = Arrays.stream(row.split(",")).mapToInt(Integer::parseInt).toArray();
            int match=p[0], slot=p[1], length=p[2], alias=p[3], index=p[4], count=p[5];
            Object dest=ctor.newInstance(), source=ctor.newInstance();
            Object[] arrays = {
                new int[]{7,17,17,43,53}, new int[]{29,31,29,47,53}, new int[]{-41,-41,match==1?-41:11,47,53},
                new int[]{9,11,13,19,23}, new short[]{5,7,9,11,13},
                new int[]{8,17,37,17,59}, new int[]{6,29,39,29,61}, new int[]{4,-41,43,-41,67}, new int[]{15,25,35,45,55}
            };
            if (slot>=0 && slot<arrays.length) {
                Object a=arrays[slot];
                arrays[slot]=length<0 ? null : a instanceof short[] shorts ? Arrays.copyOf(shorts,length) : Arrays.copyOf((int[])a,length);
            }
            if (alias==1) arrays[1]=arrays[0];
            if (alias==2) arrays[5]=arrays[0];
            if (alias==3) arrays[6]=arrays[0];
            if (alias==4) arrays[8]=arrays[0];
            for (int j=0; j<arrays.length; j++) f[j<5?j:j-5].set(j<5?dest:source,arrays[j]);
            f[5].setInt(dest,count);
            if (alias==5) source=dest;
            String result;
            try { result=String.valueOf(add.invoke(dest, slot==9?null:source, index, (short)-32767)); }
            catch (InvocationTargetException e) {
                Throwable t=e.getCause();
                if (t instanceof NullPointerException) result="null";
                else if (t instanceof ArrayIndexOutOfBoundsException) result="bounds:"+t.getMessage().split(" ")[1];
                else throw e;
            }
            StringJoiner out=new StringJoiner("|");
            out.add(result).add(String.valueOf(f[5].getInt(dest)));
            for (int j=0;j<arrays.length;j++) {
                Object a=f[j<5?j:j-5].get(j<5?dest:source);
                out.add(a==null?"null":a instanceof short[] shorts?Arrays.toString(shorts):Arrays.toString((int[])a));
            }
            System.out.println(out);
        }
    }
}
