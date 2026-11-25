import java.io.*;
import java.lang.reflect.*;
import java.util.Arrays;

final class CollisionOracle {
    static final Class<?> I = int.class, B = byte.class;
    static final Class<?> K = ke.class;
    static final Method SET = method("a", I,I,B,I), CLEAR = method("b", I,I,B,I);
    static final Method OVERLAPS = method("a", I,I,I,I,I,I,I,I,I);
    static final Method TOUCHES = method("a", I,I,I,I,I,B,I,I,I,I);
    static Method method(String name, Class<?>... args) {
        try {
            Method m = K.getDeclaredMethod(name,args);
            m.setAccessible(true);
            return m;
        } catch (ReflectiveOperationException ex) { throw new AssertionError(ex); }
    }
    static Field field(String name) throws Exception {
        Field f = K.getDeclaredField(name);
        f.setAccessible(true);
        return f;
    }
    public static void main(String[] args) throws Exception {
        DataInputStream in = new DataInputStream(new BufferedInputStream(System.in));
        DataOutputStream out = new DataOutputStream(new BufferedOutputStream(System.out));
        int count = in.readInt();
        ke map = new ke(0,0);
        for (int i = 0; i < count; i++) {
            int op = in.readInt();
            int x = in.readInt(), z = in.readInt(), size = in.readInt(), tx = in.readInt(), tz = in.readInt();
            int w = in.readInt(), h = in.readInt(), side = in.readInt(), sizeZ = in.readInt();
            boolean ok = true;
            int result;
            try {
                switch (op) {
                    case 0 -> map = new ke(x,z);
                    case 1 -> { field("x").setInt(map,x); field("g").setInt(map,z); }
                    case 2 -> { for (int[] row : map.d) Arrays.fill(row, x); }
                    case 3 -> map.b(57);
                    case 4 -> map.a(z,true,x,size,tz!=0,tx);
                    case 5 -> map.a(z,-1,x,size,tx,tz!=0);
                    case 6 -> map.a(tx,(byte)70,tz!=0,size,x,z);
                    case 7 -> map.a(tz!=0,(byte)-99,z,size,x,tx,w);
                    case 8 -> map.a(z,x,-26742);
                    case 9 -> map.a(false,z,x);
                    case 10 -> map.c(z,-110,x);
                    case 11 -> SET.invoke(map,size,x,(byte)-84,z);
                    case 12 -> CLEAR.invoke(map,size,x,(byte)-73,z);
                    case 13 -> ok = map.a(w,x,size,tx,-112,z,tz,h);
                    case 14 -> ok = map.a(tx,size,w,(byte)124,tz,h,x,z);
                    case 15 -> ok = map.b(x,tx,tz,h,side,w,25417,size,z);
                    case 16 -> ok = (boolean)OVERLAPS.invoke(map,z,tz,0,size,h,tx,w,x,sizeZ);
                    case 17 -> ok = (boolean)TOUCHES.invoke(map,h,z,x,w,tx,(byte)-108,size,side,tz,sizeZ);
                    default -> throw new AssertionError(op);
                }
                result = ok ? 1 : 0;
            } catch (RuntimeException | InvocationTargetException ex) {
                Throwable t=ex;
                while (t.getCause()!=null) t=t.getCause();
                // od.a wraps game exceptions in g.a.
                if(t instanceof g wrapped) t=wrapped.a;
                if(t instanceof IndexOutOfBoundsException || t instanceof NegativeArraySizeException) result=-1;
                else throw ex;
            }
            out.writeInt(result);
            if (op <= 12) {
                out.writeInt(map.d.length);
                for (int[] row : map.d) {
                    out.writeInt(row.length);
                    for (int flag : row) out.writeInt(flag);
                }
            }
        }
        out.flush();
    }
}
