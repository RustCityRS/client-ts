import java.io.BufferedInputStream;
import java.io.DataInputStream;
import java.lang.reflect.Constructor;
import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.security.MessageDigest;
import java.util.Arrays;
import java.util.HexFormat;

public class VorbisOracle {
    static Field field(Class<?> type, String name) throws Exception {
        Field field = type.getDeclaredField(name);
        field.setAccessible(true);
        return field;
    }

    static Method method(Class<?> type, String name, Class<?>... args) throws Exception {
        Method method = type.getDeclaredMethod(name, args);
        method.setAccessible(true);
        return method;
    }

    public static void main(String[] args) throws Exception {
        boolean hd = "gl".equals(args[0]);
        Class<?> vorbis = Class.forName(hd ? "jc" : "ni");
        Class<?> wave = Class.forName(hd ? "kj" : "ji");
        Method setup = method(vorbis, "b", byte[].class);
        Method decode = method(vorbis, hd ? "d" : "b", int.class);
        Method toWave = method(vorbis, "a", int[].class);
        Constructor<?> ctor = vorbis.getDeclaredConstructor(byte[].class);
        ctor.setAccessible(true);
        Field packets = field(vorbis, "M");
        Field previous = field(vorbis, hd ? "w" : "F");
        Field largeSize = field(vorbis, hd ? "y" : "C");
        Field cursor = field(vorbis, hd ? "U" : "Y");
        Field written = field(vorbis, hd ? "V" : "U");
        Field rate = field(wave, hd ? "u" : "t");
        Field loopStart = field(wave, hd ? "t" : "s");
        Field loopEnd = field(wave, hd ? "s" : "v");
        Field pingPong = field(wave, hd ? "r" : "u");
        Field samples = field(wave, hd ? "q" : "r");

        DataInputStream in = new DataInputStream(new BufferedInputStream(System.in));
        MessageDigest sha = MessageDigest.getInstance("SHA-256");
        setup.invoke(null, (Object) in.readNBytes(in.readInt()));
        for (int n; (n = in.readInt()) >= 0;) {
            byte[] data = in.readNBytes(n);
            Object sound = ctor.newInstance((Object) data);
            previous.set(sound, new float[largeSize.getInt(null)]);
            int hash = 1;
            for (int i = 0; i < ((byte[][]) packets.get(sound)).length; i++) {
                float[] result = (float[]) decode.invoke(sound, i);
                hash = 31 * hash + Arrays.hashCode(result);
            }
            Object sample = ctor.newInstance((Object) data);
            int[] budget = {0};
            if (toWave.invoke(sample, budget) != null) throw new AssertionError();
            StringBuilder state = new StringBuilder();
            Object pcm = null;
            for (int amount : new int[] {1, 2, 700, 255, 1, 9, 1536}) {
                budget[0] = amount;
                pcm = toWave.invoke(sample, budget);
                state.append(budget[0]).append(':').append(cursor.getInt(sample)).append(':').append(written.getInt(sample)).append(',');
                if (pcm != null) break;
            }
            if (pcm == null) pcm = toWave.invoke(sample, (Object) null);
            byte[] bytes = (byte[]) samples.get(pcm);

            Object songSample = ctor.newInstance((Object) data);
            StringBuilder ticks = new StringBuilder();
            do {
                budget[0] = 22050;
                pcm = toWave.invoke(songSample, budget);
                ticks.append(budget[0]).append(':').append(cursor.getInt(songSample)).append(':').append(written.getInt(songSample)).append(',');
            } while (pcm == null);
            if (!Arrays.equals((byte[]) samples.get(pcm), bytes)) throw new AssertionError();
            System.out.println(hash + " " + state + " " + ticks + " " + rate.getInt(pcm) + " " + loopStart.getInt(pcm) + " " + loopEnd.getInt(pcm)
                + " " + pingPong.getBoolean(pcm) + " " + bytes.length + " " + HexFormat.of().formatHex(sha.digest(bytes)));
        }
    }
}
