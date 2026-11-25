import java.lang.invoke.MethodType;
import java.lang.reflect.*;
import java.util.*;
import java.util.jar.JarFile;

// Emits declaration data only. Loading a class without initialization avoids running its game code.
class GamepackMembers {
    public static void main(String[] args)throws Exception {
        try(JarFile jar=new JarFile(args[0])){
            String variant = args.length > 1 ? args[1] : "SD";
            if (!variant.equals("HD") && !variant.equals("SD")) throw new IllegalArgumentException(variant);
            System.out.println("// Generated from the original 530 " + variant + " JAR by test/io/GamepackMembers.java.");
            System.out.println("// Each row holds a class name, its fields (name:type:modifiers), and its methods (name+descriptor:modifiers).");
            System.out.println("const declarations: [string,string,string][] = [");
            for(String file:jar.stream().map(e->e.getName()).filter(n->n.endsWith(".class")).sorted().toList()){
                String name=file.substring(0,file.length()-6).replace('/','.');
                Class<?> type=Class.forName(name,false,GamepackMembers.class.getClassLoader());
                TreeSet<String> fields=new TreeSet<>(),methods=new TreeSet<>();
                for(Field f:type.getDeclaredFields())fields.add(f.getName()+":"+f.getType().descriptorString()+":"+f.getModifiers());
                for(Method m:type.getDeclaredMethods()){
                    String d=MethodType.methodType(m.getReturnType(),m.getParameterTypes()).toMethodDescriptorString();
                    methods.add(m.getName()+d+":"+m.getModifiers());
                }
                System.out.println("    ['"+name+"','"+String.join(" ",fields)+"','"+String.join(" ",methods)+"'],");
            }
            System.out.println("];\nexport default declarations;");
        }
    }
}
