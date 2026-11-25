import java.io.*;
import java.lang.reflect.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.security.MessageDigest;
import java.util.*;
import java.util.zip.CRC32;

// Runs unmodified in each gamepack's classpath. Every nonstatic pb/jb field
// is included in the snapshot. The archive receives the original packed groups.
public class LocTypeDataOracle {
    static boolean hd;
    static String name(String sd, String gl) { return hd ? gl : sd; }
    static Class<?> cls(String sd, String gl) throws Exception { return Class.forName(name(sd,gl)); }
    static Field field(Class<?> type, String key) throws Exception {
        Field f=type.getDeclaredField(key); f.setAccessible(true); return f;
    }
    static Method method(Class<?> type,String key,Class<?>... args) throws Exception {
        Method m=type.getDeclaredMethod(key,args); m.setAccessible(true); return m;
    }
    static Object construct(Class<?> type,Class<?>[] args,Object... values) throws Exception {
        Constructor<?> c=type.getDeclaredConstructor(args); c.setAccessible(true); return c.newInstance(values);
    }
    static List<Field> fields=new ArrayList<>();
    static Class<?> jag,table,integerNode;
    static Field textBytes,textLength,buckets,next,key,intValue,stringValue;
    static String value(Object v) throws Exception {
        if(v==null) return "-";
        if(jag.isInstance(v)) return HexFormat.of().formatHex((byte[])textBytes.get(v),0,textLength.getInt(v));
        if(v.getClass().isArray()){
            StringJoiner values=new StringJoiner(",","[","]");
            for(int i=0;i<Array.getLength(v);i++) values.add(value(Array.get(v,i)));
            return values.toString();
        }
        if(table.isInstance(v)){
            Object[] rows=(Object[])buckets.get(v);
            List<String> params=new ArrayList<>();
            for(Object head:rows) for(Object n=next.get(head);n!=head;n=next.get(n))
                params.add(key.getLong(n)+(integerNode.isInstance(n)?"i"+intValue.getInt(n):"s"+value(stringValue.get(n))));
            return rows.length+":"+String.join(",",params);
        }
        return String.valueOf(v);
    }
    static String dump(Object loc) throws Exception {
        StringJoiner line=new StringJoiner("|");
        for(Field field:fields) line.add(value(field.get(loc)));
        return line.toString();
    }
    static String fault(InvocationTargetException ex) throws Exception {
        Throwable cause=ex.getCause();
        Class<?> wrapper=cls("g","ld");
        if(wrapper.isInstance(cause)) cause=(Throwable)field(wrapper,name("a","f")).get(cause);
        if(cause instanceof ArrayIndexOutOfBoundsException) return "bounds:"+cause.getMessage().split(" ")[1];
        if(cause instanceof ClassCastException) return "cast";
        if(cause instanceof NullPointerException) return "null";
        throw ex;
    }
    public static void main(String[] args) throws Exception {
        hd=args[0].equals("gl"); Path dir=Path.of(args[1]);
        Class<?> loc=cls("jb","pb"), packet=cls("gd","wa"), archive=cls("al","ve"), idx=cls("db","ii");
        jag=cls("id","na"); table=cls("nc","sc"); integerNode=cls("oe","ka");
        textBytes=field(jag,name("A","T"));textLength=field(jag,name("c","lb"));
        buckets=field(table,name("n","c")); Class<?> node=cls("jf","ab");
        next=field(node,name("g","d"));key=field(node,name("k","a"));
        intValue=field(integerNode,name("v","p"));stringValue=field(cls("we","sj"),name("v","A"));
        for(String key:Files.readString(dir.resolve("fields")).trim().split(" ")) fields.add(field(loc,key));
        long instances=Arrays.stream(loc.getDeclaredFields()).filter(f->!Modifier.isStatic(f.getModifiers())).count();
        if(new HashSet<>(fields).size()!=instances) throw new AssertionError("uncovered Java fields");
        Method decode=hd ? method(loc,"a",int.class,packet) : method(loc,"a",packet,int.class);
        Method post=method(loc,name("b","c"),int.class);
        Method list=method(cls("ke","wc"),"a",int.class,int.class);
        Field cursor=field(packet,name("yb","T")),low=field(cls("uj","gn"),name("j","d"));
        Class<?> provider=cls("ud","v");
        Object config=construct(archive,new Class<?>[]{provider,boolean.class,boolean.class},null,false,false);
        try(DataInputStream input=new DataInputStream(new BufferedInputStream(Files.newInputStream(dir.resolve("groups"))))){
            byte[] ref=input.readNBytes(input.readInt());CRC32 crc=new CRC32();crc.update(ref);
            Object index=construct(idx,new Class<?>[]{byte[].class,int.class},ref,(int)crc.getValue());
            int[] groups=(int[])field(idx,name("d","m")).get(index);
            Object[] raw=new Object[1+groups[groups.length-1]];
            Object[][] unpacked=new Object[raw.length][];
            for(int id:groups){if(input.readInt()!=id)throw new AssertionError(id);raw[id]=input.readNBytes(input.readInt());}
            field(archive,name("x","o")).set(config,index);field(archive,name("w","M")).set(config,raw);
            field(archive,name("O","A")).set(config,unpacked);
            if(hd) method(cls("","oi"),"a",int.class,archive,archive,boolean.class).invoke(null,2,config,null,false);
            else method(cls("sb",""),"a",archive,byte.class,archive,boolean.class).invoke(null,null,(byte)58,config,false);
            Method fileIds=hd ? method(archive,"a",byte.class,int.class) : method(archive,"b",int.class,byte.class);
            MessageDigest sha=MessageDigest.getInstance("SHA-256");
            Method setMembers=hd ? method(cls("","pe"),"a",byte.class,boolean.class) : method(cls("id",""),"a",boolean.class,int.class);
            for(boolean members:new boolean[]{false,true}){
                setMembers.invoke(null,hd ? new Object[]{(byte)-117,members} : new Object[]{members,0});
                int total=0, flagged=0;
                Field flag=hd?field(loc,"lb"):null;
                for(int group:groups){
                    int[] ids=(int[])fileIds.invoke(config,hd ? new Object[]{(byte)-128,group} : new Object[]{group,(byte)-104});
                    for(int file:ids){
                        Object result=list.invoke(null,hd?4:11525,(group<<8)|file);
                        if(result!=list.invoke(null,hd?4:11525,(group<<8)|file))throw new AssertionError("cache miss");
                        sha.update((dump(result)+"\n").getBytes(StandardCharsets.UTF_8));
                        if(hd&&flag.getBoolean(result)) flagged++;
                        total++;
                    }
                    System.out.println("group "+group+" "+ids.length+" "+HexFormat.of().formatHex(sha.digest()));
                }
                System.out.println("total "+total+" "+flagged);
            }
            // The last cache window is far beyond file 0. A failed load must leave
            // that file uncached, so the next call can decode a repaired container.
            unpacked[0][0]=new byte[]{82,93};
            try{list.invoke(null,hd?4:11525,0);throw new AssertionError("bad loc should throw");}
            catch(InvocationTargetException ex){System.out.println("broken "+fault(ex));}
            unpacked[0][0]=new byte[]{82,93,(byte)0x80,1,74,91,0};
            Object repaired=list.invoke(null,hd?4:11525,0);
            System.out.println("repaired "+dump(repaired)+" "+(repaired==list.invoke(null,hd?4:11525,0)));
            System.out.println("missing "+dump(list.invoke(null,hd?4:11525,0x7fffffff)));
        }
        Object cache=field(cls("he","oe"),name("w","j")).get(null);
        if(hd) method(cache.getClass(),"a",byte.class,Object.class,long.class).invoke(cache,(byte)-114,new Object(),-1L);
        else method(cache.getClass(),"a",long.class,Object.class,byte.class).invoke(cache,-1L,new Object(),(byte)-71);
        try{list.invoke(null,hd?4:11525,-1);throw new AssertionError("cast");}
        catch(InvocationTargetException ex){System.out.println("cache "+fault(ex));}
        BufferedReader in=new BufferedReader(new InputStreamReader(System.in));
        for(String s;(s=in.readLine())!=null;){
            String[] req=s.split(" ",-1);
            low.setBoolean(null,req[0].equals("1"));
            Object type=construct(loc,new Class<?>[0]);
            Object data=construct(packet,new Class<?>[]{byte[].class},HexFormat.of().parseHex(req[1]));
            String status="ok";
            try{
                decode.invoke(type,hd ? new Object[]{6219,data} : new Object[]{data,7423});
                post.invoke(type,hd?-2116:114);
            }catch(InvocationTargetException ex){status=fault(ex);}
            System.out.println(status+" "+cursor.getInt(data)+" "+dump(type));
        }
    }
}
