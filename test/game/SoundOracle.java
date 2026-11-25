import java.io.*;
import java.security.MessageDigest;
import java.util.HexFormat;

class SoundOracle {
    public static void main(String[] args) throws Exception {
        var packet = Class.forName("gd").getDeclaredConstructor(byte[].class);
        var synth = Class.forName("vd").getDeclaredConstructor(Class.forName("gd"));
        var trim = Class.forName("vd").getDeclaredMethod("a");
        var pcm = Class.forName("vd").getDeclaredMethod("b");
        var sound = Class.forName("ji");
        var rate = sound.getDeclaredField("t");
        var samples = sound.getDeclaredField("r");
        var start = sound.getDeclaredField("s");
        var end = sound.getDeclaredField("v");
        for (var a : new java.lang.reflect.AccessibleObject[]{packet,synth,trim,pcm,rate,samples,start,end}) a.setAccessible(true);
        var in = new DataInputStream(new BufferedInputStream(System.in));
        var hash = MessageDigest.getInstance("SHA-256");
        int length;
        while ((length = in.readInt()) != -1) {
            Object voice = synth.newInstance(packet.newInstance((Object)in.readNBytes(length)));
            var delay = trim.invoke(voice);
            var data = pcm.invoke(voice);
            var bytes = (byte[])samples.get(data);
            System.out.println(delay + " " + rate.get(data) + " " + start.get(data) + " " + end.get(data) + " " +
                bytes.length + " " + HexFormat.of().formatHex(hash.digest(bytes)));
        }
    }
}
