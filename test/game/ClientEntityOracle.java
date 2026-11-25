import java.io.*;
import java.lang.reflect.*;
import java.util.*;

final class ClientEntityOracle {
    static final Field[] fields = Arrays.stream(ob.class.getDeclaredFields())
        .filter(f->!Modifier.isStatic(f.getModifiers())).sorted(Comparator.comparing(Field::getName)).toArray(Field[]::new);
    static String value(Object v) {
        if(v instanceof byte[] a) return Arrays.toString(a);
        if(v instanceof int[] a) return Arrays.toString(a);
        if(v instanceof Object[] a) return Arrays.toString(a);
        return String.valueOf(v);
    }
    public static void main(String[] args) throws Exception {
        var in=new BufferedReader(new InputStreamReader(System.in));
        for(Field f:fields)f.setAccessible(true);
        StringJoiner names=new StringJoiner(",");
        for(Field f:fields)names.add(f.getName());
        System.out.println(names);
        bk npc=new bk();
        ja type=new ja();type.q=37;
        ek stop=new ek();stop.k=1;
        ek keep=new ek();keep.k=0;
        ga.B.a(5001L,stop,(byte)-71);ga.B.a(5002L,keep,(byte)-71);
        String line;
        while((line=in.readLine())!=null) {
            String[] args0=line.split(" ");
            int[] a=new int[4];
            for(int i=1;i<args0.length;i++)a[i-1]=Integer.parseInt(args0[i]);
            String result="ok";
            try {
                switch(args0[0]) {
                    case "new" -> npc=new bk();
                    case "set" -> ((ob)npc).b(0,a[0]);
                    case "size" -> result=""+((ob)npc).g((byte)-76);
                    case "len" -> npc.F=a[0];
                    case "height" -> {npc.Qb=a[0];result=npc.b()+","+npc.c((byte)107);}
                    case "paths" -> {npc.L=new int[a[0]];npc.ac=new int[a[1]];npc.D=new byte[a[2]];}
                    case "step" -> ((ob)npc).c(a[0],a[1],a[2]);
                    case "move" -> ((ob)npc).a(a[0],a[1],(byte)88,a[2],a[3]!=0);
                    case "hit" -> ((ob)npc).a(a[0],a[1],50,a[2]);
                    case "seq" -> npc.bb=a[0];
                    case "reset" -> npc.a(2);
                    case "type" -> npc.a((byte)-51,a[0]==0?null:type);
                    case "visible" -> result=""+npc.d((byte)62);
                    case "bas" -> {jl.c=a[0];npc.U=a[1];result=""+npc.b(0);}
                    default -> throw new AssertionError(line);
                }
            } catch(g error) {
                if(error.a instanceof IndexOutOfBoundsException)result="bounds";
                else if(error.a instanceof NullPointerException)result="null";
                else throw error;
            }
            StringJoiner row=new StringJoiner(";");
            row.add(result);
            for(Field f:fields)row.add(value(f.get(npc)));
            System.out.println(row);
        }
    }
}
