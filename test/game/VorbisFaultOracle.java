import java.io.BufferedInputStream;
import java.io.DataInputStream;
import java.lang.reflect.Array;
import java.lang.reflect.Constructor;
import java.lang.reflect.Field;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.util.Arrays;
import java.util.Comparator;
import java.util.HexFormat;
import java.util.Set;
import java.util.StringJoiner;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import jdk.jfr.Recording;
import jdk.jfr.consumer.RecordedEvent;
import jdk.jfr.consumer.RecordedFrame;
import jdk.jfr.consumer.RecordingFile;

public class VorbisFaultOracle {
    private static final Pattern INDEX = Pattern.compile("Index (-?[0-9]+)");
    private static final MessageDigest SHA;
    static {
        try { SHA = MessageDigest.getInstance("SHA-256"); }
        catch (Exception e) { throw new AssertionError(e); }
    }

    private static void hash(Object array) {
        int length = array == null ? -1 : Array.getLength(array);
        SHA.update(ByteBuffer.allocate(4).order(ByteOrder.LITTLE_ENDIAN).putInt(length).array());
        if (array instanceof byte[] bytes) SHA.update(bytes);
        else if (array instanceof boolean[] bools) {
            for (boolean b : bools) SHA.update((byte) (b ? 1 : 0));
        } else if (array instanceof float[] floats) {
            ByteBuffer bytes = ByteBuffer.allocate(length * 4).order(ByteOrder.LITTLE_ENDIAN);
            bytes.asFloatBuffer().put(floats);
            SHA.update(bytes.array());
        } else if (array instanceof int[] ints) {
            ByteBuffer bytes = ByteBuffer.allocate(length * 4).order(ByteOrder.LITTLE_ENDIAN);
            bytes.asIntBuffer().put(ints);
            SHA.update(bytes.array());
        }
    }

    public static void main(String[] args) throws Exception {
        boolean hd = "gl".equals(args[0]);
        Class<?> vorbis = Class.forName(hd ? "jc" : "ni");
        Class<?> floor = Class.forName(hd ? "ie" : "lb");
        Class<?> wave = Class.forName(hd ? "kj" : "ji");
        Set<String> decoderClasses = Set.of(vorbis.getName(), floor.getName(), hd ? "vb" : "i", hd ? "ji" : "dh");
        // Original JARs omit source lines. JFR supplies the precise bytecode offset of the throwing
        // array instruction without changing the gamepack classes or the decoding entry point.
        Path recording = Path.of(args[1], "faults.jfr"), sites = Path.of(args[1], "sites.txt");
        try (Recording trace = new Recording()) {
            trace.enable("jdk.JavaExceptionThrow").withStackTrace();
            trace.start();
            decodeCases(hd, vorbis, wave, floor, decoderClasses);
            trace.stop();
            trace.dump(recording);
        }
        try (var out = Files.newBufferedWriter(sites)) {
            var events = RecordingFile.readAllEvents(recording);
            events.sort(Comparator.comparing(RecordedEvent::getStartTime));
            for (RecordedEvent event : events) {
                if (!event.getClass("thrownClass").getName().equals("java.lang.ArrayIndexOutOfBoundsException")) continue;
                for (RecordedFrame frame : event.getStackTrace().getFrames()) {
                    var method = frame.getMethod();
                    if (!decoderClasses.contains(method.getType().getName())) continue;
                    out.write(method.getType().getName() + "." + method.getName() + method.getDescriptor() + "@" + frame.getBytecodeIndex());
                    out.newLine();
                    break;
                }
            }
        }
    }

    private static void decodeCases(boolean hd, Class<?> vorbis, Class<?> wave, Class<?> floor, Set<String> decoderClasses) throws Exception {
        Constructor<?> ctor = vorbis.getDeclaredConstructor(byte[].class);
        ctor.setAccessible(true);
        Method setup = VorbisOracle.method(vorbis, "b", byte[].class);
        Method toWave = VorbisOracle.method(vorbis, "a", int[].class);
        Field byteIndex = VorbisOracle.field(vorbis, hd ? "G" : "E"), bitIndex = VorbisOracle.field(vorbis, hd ? "Q" : "L");
        Field packet = VorbisOracle.field(vorbis, hd ? "U" : "Y"), written = VorbisOracle.field(vorbis, hd ? "V" : "U");
        Field previousSize = VorbisOracle.field(vorbis, "r"), previousTail = VorbisOracle.field(vorbis, hd ? "O" : "v");
        Field previousSilent = VorbisOracle.field(vorbis, hd ? "N" : "z");
        Field block = VorbisOracle.field(vorbis, hd ? "F" : "N"), previous = VorbisOracle.field(vorbis, hd ? "w" : "F");
        Field pcm = VorbisOracle.field(vorbis, hd ? "R" : "V"), samples = VorbisOracle.field(wave, hd ? "q" : "r");
        Field xs = VorbisOracle.field(floor, hd ? "h" : "g"), ys = VorbisOracle.field(floor, hd ? "j" : "d");
        Field enabled = VorbisOracle.field(floor, hd ? "b" : "e");
        DataInputStream in = new DataInputStream(new BufferedInputStream(System.in));
        for (int size; (size = in.readInt()) >= 0;) {
            setup.invoke(null, (Object) in.readNBytes(size));
            for (int cases = in.readInt(); cases > 0; cases--) {
                Object sound = ctor.newInstance((Object) in.readNBytes(in.readInt()));
                Arrays.fill((float[]) block.get(null), 0);
                Arrays.fill((int[]) xs.get(null), 0);
                Arrays.fill((int[]) ys.get(null), 0);
                Arrays.fill((boolean[]) enabled.get(null), false);
                int[] budget = {22050};
                Object result = null;
                String status = "ok";
                try {
                    result = toWave.invoke(sound, budget);
                } catch (InvocationTargetException thrown) {
                    Throwable e = thrown.getCause();
                    Matcher m = INDEX.matcher(String.valueOf(e.getMessage()));
                    StringJoiner call = new StringJoiner(">");
                    for (StackTraceElement frame : e.getStackTrace()) {
                        if (!decoderClasses.contains(frame.getClassName())) break;
                        call.add(frame.getClassName() + "." + frame.getMethodName());
                    }
                    status = e.getClass().getSimpleName() + ":" + (m.find() ? m.group(1) : "-") + ":" + call;
                }
                hash(block.get(null)); hash(previous.get(sound)); hash(pcm.get(sound));
                hash(result == null ? null : samples.get(result));
                hash(xs.get(null)); hash(ys.get(null)); hash(enabled.get(null));
                System.out.println(status + " " + byteIndex.getInt(null) + " " + bitIndex.getInt(null) + " " + packet.getInt(sound) + " "
                    + written.getInt(sound) + " " + budget[0] + " " + previousSize.getInt(sound) + " " + previousTail.getInt(sound) + " "
                    + previousSilent.getBoolean(sound) + " " + HexFormat.of().formatHex(SHA.digest()));
            }
        }
    }
}
