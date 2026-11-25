import java.lang.invoke.MethodType;
import java.lang.reflect.*;
import java.util.jar.JarFile;

class PortMapOracle {
    public static void main(String[] args) throws Exception {
        boolean instances = args.length > 1 && args[1].equals("instance");
        try (JarFile jar = new JarFile(args[0])) {
            for (var entry : jar.stream().filter(e -> e.getName().endsWith(".class")).toList()) {
                String name = entry.getName().replace('/','.').replaceFirst("\\.class$","");
                Class<?> type = Class.forName(name,false,PortMapOracle.class.getClassLoader());
                System.out.println(name);
                for (var field : type.getDeclaredFields()) {
                    if (Modifier.isStatic(field.getModifiers()) != instances) System.out.println(name+" field "+field.getName()+":"+field.getType().descriptorString());
                }
                for (var method : type.getDeclaredMethods()) {
                    if (Modifier.isStatic(method.getModifiers()) == instances) continue;
                    String descriptor = MethodType.methodType(method.getReturnType(),method.getParameterTypes()).descriptorString();
                    System.out.println(name+" method "+method.getName()+descriptor);
                }
                if (instances) for (var ctor : type.getDeclaredConstructors()) {
                    String descriptor = MethodType.methodType(void.class,ctor.getParameterTypes()).descriptorString();
                    System.out.println(name+" method <init>"+descriptor);
                }
            }
        }
    }
}
