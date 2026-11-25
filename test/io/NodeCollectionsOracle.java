import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.lang.reflect.Constructor;
import java.lang.reflect.Field;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.util.Arrays;

class NodeCollectionsOracle {
    static Class<?> type(String name) throws Exception { return Class.forName(name); }

    static Object create(String name, Class<?>[] types, Object... args) throws Exception {
        Constructor<?> ctor = type(name).getDeclaredConstructor(types);
        ctor.setAccessible(true);
        return ctor.newInstance(args);
    }

    static Object call(Object owner, String name, Class<?>[] types, Object... args) throws Exception {
        Method m = owner.getClass().getDeclaredMethod(name, types);
        m.setAccessible(true);
        return m.invoke(owner, args);
    }

    static Object field(Object owner, String name) throws Exception {
        Class<?> c = owner.getClass();
        for (;;) {
            try {
                Field f = c.getDeclaredField(name);
                f.setAccessible(true);
                return f.get(owner);
            } catch (NoSuchFieldException ex) { c = c.getSuperclass(); }
        }
    }

    static String id(Object node, Object[] nodes) {
        if (node == null) return "-";
        int index = Arrays.asList(nodes).indexOf(node);
        return index == -1 ? "s" : String.valueOf(index);
    }

    static String snapshot(Object table, Object queue, Object cache, Object list, Object[] nodes) throws Exception {
        StringBuilder s = new StringBuilder();
        for (Object target : new Object[]{table, field(cache, "j")}) {
            for (Object sentinel : (Object[])field(target, "n")) {
                s.append('[');
                for (Object n = field(sentinel, "g"); n != sentinel; n = field(n, "g")) s.append(id(n, nodes)).append(',');
                s.append(']');
            }
            s.append('/').append(field(target, "u")).append('/').append(id(field(target,"i"), nodes))
                .append('/').append(field(target, "w")).append('/').append(id(field(target,"v"), nodes)).append('|');
        }
        for (Object target : new Object[]{queue, field(cache, "l")}) {
            Object sentinel = field(target, "x");
            for (Object n = field(sentinel, "t"); n != sentinel; n = field(n, "t")) s.append(id(n,nodes)).append(',');
            s.append('/').append(id(field(target,"C"), nodes)).append('|');
        }
        Object sentinel = field(list,"c");
        for (Object n = field(sentinel,"g"); n != sentinel; n = field(n,"g")) s.append(id(n,nodes)).append(',');
        s.append('/').append(id(field(list,"t"),nodes)).append('|').append(field(cache,"n"));
        return s.toString();
    }

    public static void main(String[] args) throws Exception {
        Class<?> B = byte.class, I = int.class, J = long.class, Z = boolean.class, jf = type("jf"), ei = type("ei");
        Object[] nodes = new Object[12];
        for (int i = 0; i < nodes.length; i++) nodes[i] = create("ei",new Class<?>[]{});
        Object intNode = create("oe",new Class<?>[]{I}, Integer.MIN_VALUE);
        System.out.println(field(create("oe",new Class<?>[]{}),"v") + " " + field(intNode,"v"));
        for(int count:new int[]{-1,0,1,8,13}){
            try{
                Object[] buckets=(Object[])field(create("q",new Class<?>[]{I},count),"h");
                int initialized=0;
                for(Object sentinel:buckets)
                    if(field(sentinel,"t")==sentinel&&field(sentinel,"z")==sentinel&&field(sentinel,"p")==null&&field(sentinel,"g")==null)initialized++;
                System.out.println(buckets.length+" "+Arrays.stream(buckets).distinct().count()+" "+initialized);
            }catch(InvocationTargetException e){System.out.println("exception");}
        }
        Object t = create("nc",new Class<?>[]{I},5);
        Object empty = create("nc", new Class<?>[]{I}, 0);
        Object q = create("tb",new Class<?>[]{});
        Object list = create("gk",new Class<?>[]{});
        Object c = create("vj",new Class<?>[]{I},3);
        BufferedReader in = new BufferedReader(new InputStreamReader(System.in));
        for (String line; (line = in.readLine()) != null;) {
            String[] words = line.split(" ");
            String op = words[0];
            Object node = nodes[Integer.parseInt(words[1])];
            long key = Long.parseLong(words[2]);
            Object result;
            try {
                result = switch (op) {
                    case "put" -> call(t,"a",new Class<?>[]{B,jf,J},(byte)-89,node,key);
                    case "badput" -> {
                        try { call(empty,"a",new Class<?>[]{B,jf,J},(byte)-89,node,key); throw new AssertionError(); }
                        catch (InvocationTargetException e) {
                            yield field(node,"k") + "," + id(field(node,"g"),nodes) + "," + id(field(node,"p"),nodes);
                        }
                    }
                    case "find" -> call(t,"a",new Class<?>[]{B,J},(byte)-73,key);
                    case "same" -> call(t,"a",new Class<?>[]{B},(byte)-100);
                    case "head" -> call(t,"c",new Class<?>[]{B},(byte)24);
                    case "next" -> call(t,"a",new Class<?>[]{I},11);
                    case "count" -> call(t,"d",new Class<?>[]{B},(byte)-107);
                    case "buckets" -> call(t,"b",new Class<?>[]{I},-1);
                    case "clear" -> call(t,"a",new Class<?>[]{Z},true);
                    case "add" -> call(q,"a",new Class<?>[]{ei,I},node,-225);
                    case "pop" -> call(q,"a",new Class<?>[]{B},(byte)-123);
                    case "qhead" -> call(q,"a",new Class<?>[]{I},104);
                    case "qnext" -> call(q,"a",new Class<?>[]{Z},true);
                    case "qcount" -> call(q,"b",new Class<?>[]{I},-19462);
                    case "qclear" -> call(q,"b",new Class<?>[]{B},(byte)-109);
                    case "ladd" -> call(list,"a",new Class<?>[]{jf,Z},node,false);
                    case "lfirst" -> call(list,"a",new Class<?>[]{jf,B},node,(byte)100);
                    case "lhead" -> call(list,"d",new Class<?>[]{I},0);
                    case "ltail" -> call(list,"a",new Class<?>[]{B},(byte)100);
                    case "lnext" -> call(list,"a",new Class<?>[]{I},0);
                    case "lprev" -> call(list,"c",new Class<?>[]{I},100);
                    case "lpop" -> call(list,"a",new Class<?>[]{Z},true);
                    case "lclear" -> call(list,"b",new Class<?>[]{B},(byte)125);
                    case "cache" -> call(c,"a",new Class<?>[]{J,I,ei},key,0,node);
                    case "hit" -> call(c,"a",new Class<?>[]{I,J},261775,key);
                    case "chead" -> call(c,"a",new Class<?>[]{I},3);
                    case "cnext" -> call(c,"a",new Class<?>[]{B},(byte)-100);
                    case "cclear" -> call(c,"b",new Class<?>[]{I},20);
                    default -> throw new AssertionError(op);
                };
            } catch (InvocationTargetException ex) { result = "exception"; }
            System.out.println((result instanceof Number || result instanceof String ? result : id(result,nodes)) + "|" + snapshot(t,q,c,list,nodes));
        }
    }
}
