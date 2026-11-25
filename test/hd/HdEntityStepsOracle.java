import java.io.PrintWriter;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Arrays;
import java.util.IdentityHashMap;

/** Step, reset and record hits through the stock fe methods on original player and NPC receivers. */
public final class HdEntityStepsOracle {
    static int[] ints(int length, int start, int stride) {
        if (length < 0) return null;
        int[] result = new int[length];
        Arrays.setAll(result, i -> start + stride * i);
        return result;
    }

    static byte[] speeds(int length) {
        if (length < 0) return null;
        byte[] result = new byte[length];
        for (int i = 0; i < length; i++) result[i] = (byte)(i - 5);
        return result;
    }

    static String outcome(RuntimeException error) {
        String context = "-";
        Throwable cause = error;
        if (cause instanceof ld wrapped) {
            context = wrapped.e;
            cause = wrapped.f;
        }
        String kind;
        if (cause instanceof NullPointerException) kind = "null";
        else if (cause instanceof ArrayIndexOutOfBoundsException) {
            kind = "bounds:" + cause.getMessage().replaceFirst(".*?(?=-?\\d)", "").split(" ")[0];
        } else if (cause instanceof ArithmeticException) kind = cause.getMessage();
        else throw error;
        return context + "|" + kind;
    }

    static String snapshot(fe actor, String result) {
        return String.join(" ", result, ""+actor.Nb, ""+actor.Ib, ""+actor.O, ""+actor.Qb, ""+actor.ac,
                Arrays.toString(actor.K), Arrays.toString(actor.w), Arrays.toString(actor.mb),
                Arrays.toString(actor.ic), Arrays.toString(actor.Mb), Arrays.toString(actor.L)).replace(", ", ",");
    }

    static int[] vector(int length, int first, int second) {
        return length < 0 ? null : Arrays.copyOf(new int[]{first, second}, length);
    }

    static void slotTests(PrintWriter out) {
        for (int id = 23030; id < 23034; id++) {
            tk seq = client.a(id, (byte)-20);
            seq.a = (id - 23030) % 3;
            seq.p = id == 23033 ? 1 : 5;
            seq.C = new int[][]{{(id << 8) | (2 << 5) | 3}};
        }
        for (fe actor : new fe[]{new e(), new km()}) {
            cg.f = 127;
            actor.ac = -192; actor.Qb = 576;
            IdentityHashMap<ub, Integer> identities = new IdentityHashMap<>();
            for (int[] v : new int[][]{
                {2,2,2,23030,23031, 3,4, 3,12}, {2,2,2,23030,23031, 8,9, 3,12},
                {2,2,2,23032,23033, 2,7, 16,12}, {2,2,2,23032,-1, 9,8, 16,2},
                {2,2,2,-1,23033, 0,5, -1,7}, {2,2,2,23033,23031, -1,6, 4096,3},
                {2,1,2,23031,-1, 44,5, 4,2}, {2,2,1,23031,-1, 45,5, 4,2},
                {1,-1,0,23031,0, 4,0, 1,0}, {1,0,-1,23031,0, 4,0, 1,0},
                {-1,1,1,0,0,0,0,0,0}, {0,-1,-1,0,0,0,0,0,0}
            }) {
                for (ub slot : actor.Eb) if (slot != null) {
                    slot.g = 6; slot.d = 3; slot.l = 5; slot.f = 4; slot.q = 2;
                }
                int[] seqs = vector(v[0],v[3],v[4]), delays = vector(v[1],v[5],v[6]), masks = vector(v[2],v[7],v[8]);
                pe.j = 0;
                String result = "ok";
                try {
                    if (actor instanceof e player) ci.a(delays,seqs,player,(byte)-113,masks);
                    else mi.a(masks,(byte)92,(km)actor,delays,seqs);
                } catch (RuntimeException ex) { result = outcome(ex); }
                StringBuilder snap = new StringBuilder(result);
                for (ub slot : actor.Eb) {
                    if (slot == null) snap.append(" -");
                    else snap.append(' ').append(identities.computeIfAbsent(slot, k -> identities.size()+1))
                        .append(',').append(slot.b).append(',').append(slot.g).append(',').append(slot.d)
                        .append(',').append(slot.l).append(',').append(slot.f).append(',').append(slot.q);
                }
                for (int i = 0; i < pe.j; i++) snap.append(" sound ").append(qe.t[i]).append(',').append(wh.g[i]).append(',').append(na.mb[i]).append(',').append(ca.fb[i]);
                out.println(snap);
            }
            if (actor instanceof km npc) {
                for (byte guard : new byte[]{-128,81,82,127}) {
                    String result = "ok";
                    try { mi.a(null,guard,npc,null,null); }
                    catch (RuntimeException ex) { result = outcome(ex); }
                    out.println("guard " + guard + " " + result);
                }
            }
            if (actor instanceof e player) {
                for (byte guard : new byte[]{-128,-97,-96,127}) {
                    ci.u = new short[0][];
                    ci.a(null,new int[0],player,guard,null);
                    out.println("guard " + guard + " " + (ci.u == null));
                }
                for (int height : new int[]{-32768,-1,0,2147483647}) {
                    player.Rb = height;
                    player.a(7,2,48,90,120);
                    out.println("height " + player.b());
                }
            }
        }
    }

    static void run(Path input, Path output, Path expectedJar) throws Exception {
        for (Class<?> type : new Class<?>[]{fe.class, e.class, km.class}) {
            Path source = Path.of(type.getProtectionDomain().getCodeSource().getLocation().toURI());
            if (!Files.isSameFile(source, expectedJar)) throw new AssertionError(source);
        }
        if (client.a(0, (byte)-20).f != 0 || client.a(25, (byte)-20).f != 2 || client.a(618, (byte)-20).f != 1)
            throw new AssertionError("movement cancellation inputs");
        fe actor = null;
        try (PrintWriter out = new PrintWriter(Files.newBufferedWriter(output))) {
            for (String command : Files.readAllLines(input)) {
                String[] word = command.split(" ");
                int[] v = Arrays.stream(word).skip(1).mapToInt(Integer::parseInt).toArray();
                String result = "ok";
                try {
                    switch (word[0]) {
                        case "new" -> actor = v[0] == 0 ? new e() : new km();
                        case "path" -> {
                            actor.K = ints(v[0], v[3], 3);
                            actor.w = ints(v[1], v[4], -2);
                            actor.mb = speeds(v[2]);
                            actor.Nb = v[5]; actor.Ib = v[6]; actor.O = v[7];
                        }
                        case "hits" -> {
                            actor.ic = ints(v[0], -12, 3);
                            actor.Mb = ints(v[1], 5, 2);
                            actor.L = ints(v[2], v[3], 0);
                        }
                        case "step" -> actor.a(v[0], (byte)v[1], v[2]);
                        case "hit" -> actor.a(v[0], v[1], v[2], v[3]);
                        case "reset" -> actor.c(v[0]);
                        case "move" -> actor.a(-2, v[0], v[1], v[2], v[3] != 0);
                        default -> throw new AssertionError(command);
                    }
                } catch (RuntimeException error) {
                    result = outcome(error);
                }
                out.println(snapshot(actor, result));
            }
            slotTests(out);
        }
    }

    public static void main(String[] args) throws Exception {
        HdGlModelAnimationOracle.withArchives(args, () -> run(Path.of(args[2]), Path.of(args[3]), Path.of(args[4])));
    }
}
