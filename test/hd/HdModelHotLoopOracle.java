import java.lang.reflect.*;
import java.util.*;

/** Keep the partial wa cursor/bytes and td coordinates at each failed access. */
public class HdModelHotLoopOracle {
    static void field(Object receiver, String name, Object value) throws Exception {
        Field f = td.class.getDeclaredField(name); f.setAccessible(true); f.set(receiver,value);
    }
    public static void main(String[] args) throws Exception {
        var constructor = td.class.getDeclaredConstructor(); constructor.setAccessible(true);
        var upload = td.class.getDeclaredMethod("a",boolean.class,boolean.class,boolean.class,boolean.class,boolean.class);
        upload.setAccessible(true);
        for (int endian = 0; endian < 2; endian++) for (int size = 0; size < 36; size++) {
            td model = constructor.newInstance();
            tf.f = endian != 0;
            wa packet = new wa(new byte[size]);
            field(null,"D",packet); field(model,"Y",new ql()); field(model,"I",3); field(model,"S",0);
            field(model,"H",new int[]{1,Integer.MAX_VALUE,16777217});
            field(model,"eb",new int[]{-175,-174,-173}); field(model,"hb",new int[]{9,8,-7});
            field(model,"X",new int[]{0,1,2,3}); field(model,"N",new short[]{1,2,3});
            try { upload.invoke(model,false,true,false,false,false); throw new AssertionError(); }
            catch (InvocationTargetException e) {
                Throwable cause = e.getCause();
                if (cause instanceof ld wrapper) cause = wrapper.f;
                if (!(cause instanceof ArrayIndexOutOfBoundsException)) throw e;
            }
            System.out.println("p " + packet.T + " " + HexFormat.of().formatHex(packet.y));
        }
        for (int mode=0; mode<10; mode++) {
            td model = constructor.newInstance();
            int[] x=mode==8 ? hf.g : mode==9 ? hf.r : new int[]{35032,-6001,1677731};
            int[] y=mode==1 ? x : new int[]{912437,-9811,739};
            int[] z=mode==2 ? y : new int[]{-4811,-313138,120};
            if (mode==3) y=new int[]{912437};
            field(model,"H",x); field(model,"eb",y); field(model,"hb",z);
            field(model,"K",new int[][]{new int[]{0,1,mode==4 ? -1 : 2}});
            field(null,"sb",13); field(null,"yb",-55); field(null,"vb",121);
            String fault="ok";
            try {model.a(2,new int[]{0},mode==5 ? 2121 : 113,mode==6 ? -1 : 19,mode==7 ? 2048 : mode>=8 ? 1 : 97,false);}
            catch (ArrayIndexOutOfBoundsException e) {fault="bounds";}
            System.out.println("r "+fault+" "+Arrays.hashCode(x)+" "+Arrays.hashCode(y)+" "+Arrays.hashCode(z));
        }
    }
}
