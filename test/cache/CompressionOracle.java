import java.io.*;
import java.lang.reflect.*;
import java.nio.charset.StandardCharsets;
import java.security.DigestOutputStream;
import java.security.MessageDigest;
import java.util.*;

class CompressionOracle {
    static Field field(String owner, String name) throws Exception {
        Field f = Class.forName(owner).getDeclaredField(name);
        f.setAccessible(true);
        return f;
    }

    static Method method(String owner, String name, Class<?>... types) throws Exception {
        Method m = Class.forName(owner).getDeclaredMethod(name, types);
        m.setAccessible(true);
        return m;
    }

    static Constructor<?> constructor(String owner, Class<?>... types) throws Exception {
        Constructor<?> c = Class.forName(owner).getDeclaredConstructor(types);
        c.setAccessible(true);
        return c;
    }

    static void array(DataOutputStream out, Object value) throws IOException {
        if (value == null) { out.writeInt(-1); return; }
        out.writeInt(Array.getLength(value));
        if (value instanceof byte[] bytes) out.write(bytes);
        else if (value instanceof boolean[] flags) { for (boolean flag : flags) out.writeBoolean(flag); }
        else if (value instanceof int[] ints) {
            java.nio.ByteBuffer bytes = java.nio.ByteBuffer.allocate(4 * ints.length);
            bytes.asIntBuffer().put(ints);
            out.write(bytes.array());
        }
        else for (Object row : (Object[])value) array(out, row);
    }

    static String state(boolean hd) throws Exception {
        MessageDigest hash = MessageDigest.getInstance("SHA-256");
        DataOutputStream out = new DataOutputStream(new DigestOutputStream(OutputStream.nullOutputStream(),hash));
        String owner=hd ? "bb" : "me";
        Object state = field(hd ? "oc" : "rd","a").get(null);
        String ints=hd ? "L B z o u e w x j K J F I P D l" : "b c i m o p z C E F I J M O Q S";
        String arrays=hd ? "h i O G r C a f v y k q d H b p" : "d e f h j l n q r t y A B D G H";
        for (String key : ints.split(" ")) out.writeInt(field(owner,key).getInt(state));
        for (String key : arrays.split(" ")) array(out,field(owner,key).get(state));
        array(out,hd ? field("s","a").get(null) : field("ij","d").get(null));
        return HexFormat.of().formatHex(hash.digest());
    }

    public static void main(String[] args) throws Exception {
        if (args.length==1 && args[0].endsWith("-output")) {
            boolean gl=args[0].startsWith("hd");
            String owner=gl?"bb":"me";
            Object s=field(gl?"oc":"rd","a").get(null);
            Method write=method(gl?"oc":"rd","a",s.getClass());
            String[] names=(gl?"J e L z x B l u o":"I p b i C c S o m").split(" ");
            for(int mode=0;mode<6;mode++){
                int[] table=new int[100000];
                table[0]=(1<<8)|37;
                table[1]=((mode==1?17:mode==2?100001:mode==3?-21:2)<<8)|73;
                table[17]=(2<<8)|11;
                table[2]=(3<<8)|19;
                table[3]=23;
                field(gl?"s":"ij",gl?"a":"d").set(null,table);
                int space=mode==5?131072:6;
                byte[] dest=new byte[mode==4?3:space+2];Arrays.fill(dest,(byte)-91);
                field(owner,gl?"k":"y").set(s,dest);
                int[] values={Integer.MAX_VALUE-2,-71,0,1,3,0,2,space,4};
                for(int i=0;i<names.length;i++){
                    Field f=field(owner,names[i]);
                    if(f.getType()==byte.class)f.setByte(s,(byte)values[i]);else f.setInt(s,values[i]);
                }
                String status="ok";
                try{write.invoke(null,s);}
                catch(InvocationTargetException e){
                    if(!(e.getCause() instanceof ArrayIndexOutOfBoundsException t))throw e;
                    status="bounds:"+t.getMessage().split(" ")[1];
                }
                StringJoiner result=new StringJoiner("|");result.add(status);
                for(String name:names)result.add(String.valueOf(field(owner,name).getInt(s)));
                result.add(HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(dest)));
                System.out.println(result);
            }
            return;
        }
        if (args.length==1 && (args[0].equals("hd-bzip") || args[0].endsWith("-bzip-faults"))) {
            boolean hd=args[0].startsWith("hd"), detailed=args[0].endsWith("-faults");
            Method decode=method(hd?"oc":"rd","a",byte[].class,int.class,byte[].class,int.class,int.class);
            BufferedReader in=new BufferedReader(new InputStreamReader(System.in,StandardCharsets.US_ASCII));
            for(String line;(line=in.readLine())!=null;){
                String[] v=line.split(" ",-1);
                byte[] src=Base64.getDecoder().decode(v[6]), dest=new byte[Integer.parseInt(v[1])];
                Arrays.fill(dest,(byte)0xa5);
                String result;
                try { result="ok"+decode.invoke(null,dest,Integer.parseInt(v[2]),src,Integer.parseInt(v[4]),Integer.parseInt(v[3])); }
                catch(InvocationTargetException ex) {
                    if(!(ex.getCause() instanceof RuntimeException cause)) throw ex;
                    result="rejected";
                    if (detailed) result += cause instanceof ArrayIndexOutOfBoundsException
                        ? ":" + cause.getMessage().split(" ")[1] : ":" + cause.getClass().getSimpleName();
                }
                System.out.println(result+" "+HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(dest))+" "+state(hd));
            }
            return;
        }
        Method bz = method("rd","a",byte[].class,int.class,byte[].class,int.class,int.class);
        Method gz = method("bi","a",byte[].class,byte.class,Class.forName("gd"));
        Method container = method("ec","a",byte[].class,boolean.class);
        Method clear = method("rd","a");
        Object gzip = constructor("bi").newInstance();
        Field sharedField = field("wk","s"), inflater = field("bi","e");
        Object shared = sharedField.get(null), firstInflater = null;
        Constructor<?> packet = constructor("gd",byte[].class);
        BufferedReader in = new BufferedReader(new InputStreamReader(System.in,StandardCharsets.US_ASCII));
        for (String line; (line = in.readLine()) != null;) {
            String[] v = line.split(" ",-1);
            byte[] source = Base64.getDecoder().decode(v[6]);
            byte[] dest = new byte[Integer.parseInt(v[1])];
            Arrays.fill(dest,(byte)0xa5);
            int length = Integer.parseInt(v[2]), offset = Integer.parseInt(v[3]), packed = Integer.parseInt(v[4]);
            field("ce","K").setInt(null,Integer.parseInt(v[5]));
            String result = "ok";
            Object buf = null;
            try {
                switch (v[0]) {
                    case "b": result += bz.invoke(null,dest,length,source,packed,offset); break;
                    case "g":
                        buf = packet.newInstance((Object)source);
                        field("gd","yb").setInt(buf,offset);
                        gz.invoke(gzip,dest,(byte)-118,buf);
                        break;
                    case "c": dest = (byte[])container.invoke(null,source,false); break;
                    case "nullInput": dest = (byte[])container.invoke(null,null,false); break;
                    case "nullCodec": sharedField.set(null,null); break;
                    case "restoreCodec": sharedField.set(null,shared); break;
                    case "x": clear.invoke(null); break;
                    default: throw new AssertionError(v[0]);
                }
            } catch (InvocationTargetException e) {
                if (!(e.getCause() instanceof RuntimeException)) throw e;
                result = "rejected";
                if (v[0].equals("c") || v[0].equals("nullInput")) {
                    Throwable cause = e.getCause();
                    if (cause.getClass().getName().equals("g")) cause = (Throwable)field("g","a").get(cause);
                    result += cause.getClass().getSimpleName();
                }
            }
            result += " " + HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(dest));
            if (v[0].equals("b")) result += " " + state(false);
            if (v[0].equals("g")) result += " " + field("gd","yb").getInt(buf) + " " + (field("bi","e").get(gzip) != null);
            if (v[0].equals("x")) result += " " + (field("rd","a").get(null) == null);
            if (v[0].equals("c") || v[0].equals("nullInput") || v[0].equals("nullCodec") || v[0].equals("restoreCodec")) {
                if (firstInflater == null) firstInflater = inflater.get(shared);
                result += " " + (sharedField.get(null) == shared) + " " + (inflater.get(shared) != null) + " " + (inflater.get(shared) == firstInflater);
            }
            System.out.println(result);
        }
    }
}
