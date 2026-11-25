import java.io.*;
import java.lang.reflect.Field;
import java.util.*;

public class LocalisedTextOracle {
    public static void main(String[] args) throws Exception {
        BufferedReader in = new BufferedReader(new InputStreamReader(System.in));
        List<Field> fields = new ArrayList<>();
        for (String entry; (entry=in.readLine())!=null;) {
            String[] path=entry.split("\\.");
            Field field=Class.forName(path[0]).getDeclaredField(path[1]);
            field.setAccessible(true);
            fields.add(field);
        }
        IdentityHashMap<id,Integer> identities=new IdentityHashMap<>();
        for (int lang : new int[]{-1,1,0,2,7,1,2,0}) {
            boolean error=false;
            if (lang!=-1) {
                try { ii.a((byte)127,lang); }
                catch (RuntimeException ex) { error=true; }
            }
            System.out.println(error);
            for (Field field:fields) {
                id s=(id)field.get(null);
                if (!identities.containsKey(s)) identities.put(s,identities.size());
                System.out.println(identities.get(s)+" "+HexFormat.of().formatHex(s.b(false)));
            }
        }
    }
}
