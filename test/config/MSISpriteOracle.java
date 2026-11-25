import java.io.*;
import java.lang.reflect.*;
import java.nio.*;
import java.security.*;
import java.util.*;

final class MSISpriteOracle {
    static byte[] index;
    static final Map<Integer,byte[]> groups=new HashMap<>();
    static final IdentityHashMap<ch,Integer> identities=new IdentityHashMap<>();
    static StringJoiner calls=new StringJoiner(",");
    static final da type=new da();
    static int mode,substitute,requests;
    static al secondary;
    static ch last;
    static final HexFormat hex=HexFormat.of();
    static final class Source extends ud {
        final String label;
        Source(String label){this.label=label;}
        db b(int unused){
            calls.add(label+"i");
            return new db(index,q.a(0,index,index.length));
        }
        byte[] a(int request,int group){
            calls.add(label+"g"+request+":"+group);
            requests++;
            if(mode==1 && requests==1 || mode==2)return null;
            if(mode==3 && requests==1)type.l=substitute;
            if(mode==4 && requests==1)mj.d=secondary;
            if(mode==5 && requests==1){gl.D=-31;hj.h=40;pj.E=99;}
            if(mode==6)return new byte[]{0,0,0,0,2,0,1};
            return groups.get(group);
        }
        void b(int unused,int group){calls.add(label+"p"+group);}
        int c(int group,int unused){return 100;}
    }
    static String run(String cmd,Field palette)throws Exception{
        String[] p=cmd.split(" ");
        switch(p[0]){
            case "index":index=Base64.getDecoder().decode(p[1]);return null;
            case "group":groups.put(Integer.parseInt(p[1]),Base64.getDecoder().decode(p[2]));return null;
            case "archive":
                mode=Integer.parseInt(p[1]);substitute=Integer.parseInt(p[2]);requests=0;
                mj.d=new al(new Source("a"),true,true);secondary=new al(new Source("b"),true,true);return null;
            case "null":mj.d=null;return null;
            case "reset":mk.A=new ve(64);return null;
            case "bad":mk.A.a(Long.parseLong(p[1]),new Object(),(byte)-71);return null;
            case "poke":last.y[0]^=0x7f;return null;
            case "delta":gl.D=Integer.parseInt(p[1]);hj.h=Integer.parseInt(p[2]);pj.E=Integer.parseInt(p[3]);return null;
        }
        type.l=Integer.parseInt(p[1]);
        String result;
        try {
            ch sprite=type.a(Integer.parseInt(p[2]),(byte)-100);
            if(sprite==null)result="-";
            else {
                last=sprite;
                int id=identities.computeIfAbsent(sprite,s->identities.size()+1);
                int[] colours=(int[])palette.get(sprite);
                ByteBuffer bytes=ByteBuffer.allocate(colours.length*4);
                for(int c:colours)bytes.putInt(c);
                var digest=MessageDigest.getInstance("SHA-256");
                result=id+","+sprite.o+","+sprite.c+","+sprite.b+","+sprite.j+","+sprite.l+","+sprite.n+","+
                    hex.formatHex(digest.digest(sprite.y))+","+hex.formatHex(digest.digest(bytes.array()));
            }
        }catch(RuntimeException e){
            Throwable cause=e;while(cause instanceof g w && w.a!=null)cause=w.a;
            result=cause instanceof ClassCastException?"cast":cause instanceof NullPointerException?"null":
                cause instanceof IndexOutOfBoundsException?"bounds":cause.getClass().getSimpleName();
        }
        return type.l+";"+result+";"+calls;
    }
    public static void main(String[] args)throws Exception{
        Field palette=ch.class.getDeclaredField("z");palette.setAccessible(true);
        BufferedReader in=new BufferedReader(new InputStreamReader(System.in));
        for(String cmd;(cmd=in.readLine())!=null;){
            String result=run(cmd,palette);if(result!=null)System.out.println(result);
            // Clear only the trace. JS5 archive and sprite caches persist between calls.
            calls=new StringJoiner(",");
        }
    }
}
