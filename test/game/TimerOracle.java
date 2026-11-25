import java.io.*;
import java.lang.reflect.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.util.*;
import java.util.jar.JarFile;

// Time and sleeping are the only JRE calls redirected. Every gamepack instruction,
// including the monotonic adjustment and the two-sleep workaround, runs unmodified.
class HostClockFixture {
    static long nanos, millis;
    static final List<Long> sleeps = new ArrayList<>();
    static Runnable afterSleep;
    public static long nanoTime() { return nanos; }
    public static long currentTimeMillis() { return millis; }
    public static void sleep(long milliseconds) {
        sleeps.add(milliseconds);
        nanos += milliseconds * 1000000;
        millis += milliseconds;
        if (afterSleep != null) afterSleep.run();
    }
}

class TimerOracle {
    static void redirect(JarFile jar, Path dir, String type, String owner) throws IOException {
        byte[] bytes = jar.getInputStream(jar.getJarEntry(type + ".class")).readAllBytes();
        byte[] utf = owner.getBytes(StandardCharsets.UTF_8), host = "HostClockFixture".getBytes(StandardCharsets.UTF_8);
        int count = 0;
        if (utf.length != host.length) throw new AssertionError(owner);
        for (int i = 3; i + utf.length <= bytes.length; i++) {
            if (bytes[i-3] == 1 && bytes[i-2] == 0 && bytes[i-1] == utf.length &&
                    Arrays.equals(bytes, i, i+utf.length, utf, 0, utf.length)) {
                System.arraycopy(host, 0, bytes, i, host.length);
                count++;
            }
        }
        if (count != 1) throw new AssertionError(type + " " + count);
        Files.write(dir.resolve(type + ".class"), bytes);
    }

    static String fields(e clock, int ticks) throws Exception {
        StringJoiner text = new StringJoiner(";");
        text.add(""+ticks).add(""+HostClockFixture.sleeps).add(""+HostClockFixture.nanos).add(""+HostClockFixture.millis);
        for (String name : clock instanceof bl ? new String[]{"j"} : new String[]{"j","m","o","q","r","v"}) {
            Field field = clock.getClass().getDeclaredField(name);
            field.setAccessible(true);
            Object value = field.get(clock);
            text.add(value instanceof long[] ? Arrays.toString((long[]) value) : value.toString());
        }
        return text.toString();
    }

    public static void main(String[] args) throws Exception {
        if (args.length > 0) {
            try (JarFile jar = new JarFile(args[0])) {
                Path dir = Path.of(args[1]);
                redirect(jar,dir,"bl","java/lang/System");
                redirect(jar,dir,"eh","java/lang/System");
                redirect(jar,dir,"kh","java/lang/Thread");
            }
            return;
        }
        BufferedReader reader = new BufferedReader(new InputStreamReader(System.in));
        e clock = null;
        for (String line; (line=reader.readLine()) != null;) {
            String[] command = line.split(" ");
            HostClockFixture.sleeps.clear();
            HostClockFixture.nanos += Long.parseLong(command[1]);
            HostClockFixture.millis += Long.parseLong(command[2]);
            int ticks = -1;
            switch (command[0]) {
                case "nano" -> clock = kl.b((byte)117);
                case "millis" -> clock = new gl();
                case "reset" -> clock.a((byte)96);
                case "step" -> ticks = clock.a((byte)61,Integer.parseInt(command[3]),Integer.parseInt(command[4]));
                case "sleep" -> qa.a(-107, Long.parseLong(command[3]));
                default -> throw new IllegalArgumentException(command[0]);
            }
            System.out.println(fields(clock,ticks));
        }
    }
}
