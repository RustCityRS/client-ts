import java.io.*;
import java.lang.reflect.*;
import java.nio.*;
import java.nio.file.*;
import java.util.*;

class TextureStartupOracle {
    static al tex,altTex,sprites,altSprites,altMeta;
    static int mode,cut;
    static byte[] metadata;
    static StringBuilder events;
    static boolean changed;
    static void swapInputs(){ha.b=altTex;h.i=altSprites;wh.X=altMeta;b.E=!b.E;}
    static void clearInputs(){ha.b=h.i=null;b.E=!b.E;dg.w=4;}
    static class Meta extends ud {
        final String tag;
        final ProceduralTextureCacheOracle.Disk disk;
        Meta(String tag,ProceduralTextureCacheOracle.Disk disk){this.tag=tag;this.disk=disk;}
        db b(int unused){events.append("i").append(tag).append(';');
            if(mode==5&&tag.equals("b"))clearInputs();
            return mode==2?null:disk.table;}
        byte[] a(int modeArg,int group){
            events.append("g").append(tag).append(group).append(';');
            if(!changed&&tag.equals("a")){
                changed=true;
                if(mode==4||mode==5||mode==12)swapInputs();
                if(mode==11)wh.X=null;
            }
            if(mode==1 || mode==12 && tag.equals("a"))return null;
            if(mode==6){
                int length=cut<0?metadata.length-1:Math.min(cut,metadata.length);
                byte[] bytes=new byte[5+length];ByteBuffer.wrap(bytes).put((byte)0).putInt(length).put(metadata,0,length);
                return bytes;
            }
            return disk.a(modeArg,group);
        }
        void b(int unused,int group){}
        int c(int group,int unused){events.append("p").append(tag).append(group).append(';');return -53;}
    }
    static Field field(Class<?> type,String key)throws Exception{Field f=type.getDeclaredField(key);f.setAccessible(true);return f;}
    static String describe(Object o,Object a,Object b){return o==null?"~":o==a?"a":o==b?"b":"?";}
    static String classify(Throwable e){
        while(e instanceof InvocationTargetException || e instanceof g)e=e instanceof g wrapped?wrapped.a:e.getCause();
        return e instanceof NullPointerException?"null":e instanceof IndexOutOfBoundsException?"bounds":e.getClass().getSimpleName();
    }
    static int[] pixels(kg cache,int id){return cache.a(id,0.7F,15964);}
    static String frame(int id,boolean terrain){
        int[] frame=new int[28*22];Arrays.fill(frame,0x53213a);td.a(frame,28,22);dc.d();dc.e=0;dc.h=false;
        if(terrain)dc.a(1,19,17,2,6,26,100,112,96,-45,12,41,-20,40,55,500,420,569,id);
        else dc.b(1,19,17,2,6,26,100,112,96,-45,12,41,-20,40,55,500,420,569,id);
        ByteBuffer bytes=ByteBuffer.allocate(frame.length*4).order(ByteOrder.LITTLE_ENDIAN);bytes.asIntBuffer().put(frame);
        return dc.h+":"+Base64.getEncoder().encodeToString(bytes.array());
    }
    static String status(kg result,int id)throws Exception{
        Object recent=field(kg.class,"k").get(result);int freeBefore=field(vj.class,"n").getInt(recent);
        String pixels;
        try{
            int[] first=pixels(result,id),next=pixels(result,id);
            pixels=first==null?"missing":first.length+","+Arrays.hashCode(first)+","+(first==next);
            if(first!=null&&(mode==0||mode==4||mode==5))pixels+=","+frame(id,true)+","+frame(id,false);
        }catch(RuntimeException e){pixels=classify(e);}
        return String.join(",",describe(field(kg.class,"n").get(result),tex,altTex),describe(field(kg.class,"C").get(result),sprites,altSprites),
            ""+field(kg.class,"q").getInt(result),""+field(kg.class,"G").getBoolean(result),""+(field(kg.class,"J").get(result)==null),
            ""+field(vj.class,"m").getInt(recent),""+freeBefore,""+field(vj.class,"n").getInt(recent),
            ""+result.a((byte)-125,id),""+result.a(id,0),""+result.b(0,id),""+result.d(0,id),pixels);
    }
    public static void main(String[] args)throws Exception{
        Path dir=Path.of(args[0]);
        Class<?> unsafe=Class.forName("sun.misc.Unsafe");Object memory=field(unsafe,"theUnsafe").get(null);
        client app=(client)unsafe.getMethod("allocateInstance",Class.class).invoke(memory,client.class);
        Method load=client.class.getDeclaredMethod("f",byte.class);load.setAccessible(true);
        Random random=(Random)field(Class.forName("java.lang.Math$RandomNumberGeneratorHolder"),"randomNumberGenerator").get(null);
        try(var texturesDisk=new ProceduralTextureCacheOracle.Disk(dir,9);var metaDisk=new ProceduralTextureCacheOracle.Disk(dir,26);
            var spritesDisk=new ProceduralTextureCacheOracle.Disk(dir,8)){
            tex=new al(texturesDisk,false,true);altTex=new al(texturesDisk,false,true);
            sprites=new al(spritesDisk,false,true);altSprites=new al(spritesDisk,false,true);
            al realMeta=new al(metaDisk,true,true);metadata=realMeta.a(-809612665,0,0);
            kg prior=new kg(tex,realMeta,sprites,3,false);
            BufferedReader input=new BufferedReader(new InputStreamReader(System.in));
            for(String cmd:input.lines().toList()){
                int[] v=Arrays.stream(cmd.split(" ")).mapToInt(Integer::parseInt).toArray();
                mode=v[0];boolean detailed=v[1]!=0;int brightness=v[2];cut=v[3];int sample=v[4],seed=v[5];changed=false;
                events=new StringBuilder();altMeta=new al(new Meta("b",metaDisk),true,true);
                wh.X=mode==7?null:new al(new Meta("a",metaDisk),true,true);
                ha.b=mode==8?null:tex;h.i=mode==13?null:sprites;
                dc.r=prior;dg.w=brightness;b.E=detailed;we.y=true;bh.b=90;ga.D=29;ie.A=vb.a("seed",(byte)114);
                dc.o=mode==9?null:new int[mode==10?29:65536];
                if(dc.o!=null)Arrays.fill(dc.o,0x139bc);
                field(dc.class,"i").setFloat(null,0.546875F);random.setSeed(seed);
                String fault="ok";
                try{load.invoke(app,(byte)110);}catch(InvocationTargetException e){fault=classify(e);}
                String text=ie.A==null?"~":Base64.getEncoder().encodeToString(ie.A.b(false));
                System.out.println(String.join("|",fault,events.toString(),bh.b+","+ga.D+","+text,
                    ""+Float.floatToRawIntBits(field(dc.class,"i").getFloat(null)),String.valueOf(Arrays.hashCode(dc.o)),String.valueOf(random.nextInt()),
                    dc.r==prior?"prior":status((kg)dc.r,sample)));
            }
        }
    }
}
