import java.io.PrintWriter;
import java.lang.reflect.Field;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.util.Arrays;
import java.util.HexFormat;

/** Read appearance packets through the original HD player, packet, item, NPC, model and area-sound classes. */
public final class HdPlayerAppearanceOracle {
    static Object field(Class<?> owner, Object instance, String name) throws ReflectiveOperationException {
        Field field = owner.getDeclaredField(name);
        field.setAccessible(true);
        return field.get(instance);
    }

    static String snapshot(e player, wa packet, String outcome, hh previous) throws Exception {
        StringBuilder line = new StringBuilder(outcome + " " + packet.T);
        for (Object value : new Object[]{
                player.Qb, player.ac, player.c((byte)114), field(fe.class, player, "Tb"), field(e.class, player, "wc"),
                player.Vc, player.tc, player.uc, player.G, player.Mc == null ? "-" : HexFormat.of().formatHex(player.Mc.T, 0, player.Mc.lb),
                player.yc, player.Xc, player.Fc, player.Sc, player.Pc, player.qc, player.Hc, player.Cc, player.Wc,
                player.Mc != null && he.ab.a(player.Mc.j(-118), 0) != null, previous == player.Bc
        }) line.append(' ').append(value);
        if (player.Bc == null) return line.append(" -").toString();
        for (String name : new String[]{"e", "m", "x", "q", "i", "l", "t"}) {
            Object value = field(hh.class, player.Bc, name);
            line.append(' ').append(value instanceof int[] a ? Arrays.toString(a).replace(" ", "") : value);
        }
        return line.toString();
    }

    static String mesh(ak result, ak again) throws Exception {
        if (result == null) return "null " + (again == null);
        td model = (td)result;
        StringBuilder row = new StringBuilder().append(result == again).append(' ').append(model.I);
        for (String name : new String[]{"H","eb","hb","w","P","Q","t","B"}) {
            Object data = field(td.class, model, name);
            int hash = data instanceof int[] a ? Arrays.hashCode(a) : data instanceof short[] a ? Arrays.hashCode(a) : Arrays.hashCode((byte[])data);
            row.append(' ').append(hash);
        }
        return row.toString();
    }

    static void checkModels(PrintWriter out) throws Exception {
        tf.w = true;
        for (int variant : new int[]{0,1}) {
            l.b.c(3);
            if (variant == 0) {
                cj.e = md.V; mj.C = pk.V; nj.m = dg.c; qe.r = vd.B;
            } else {
                cj.e = q.d; nj.m = ci.u; qe.r = aa.h; mj.C = bj.t;
            }
            for (int npc : new int[]{-1,50}) {
                hh model = new hh();
                model.a(new int[]{2,3,4,1,3},npc,false,0,null,340);
                for (int step = 0; step < 5; step++) {
                    switch (step) {
                        case 1 -> model.a(0,false,5);
                        case 2 -> model.a(0,2,0);
                        case 3 -> model.a(true,true);
                        case 4 -> model.a(3,18,0);
                    }
                    ak head = model.a(-1,(byte)123,null,0,0);
                    ak headAgain = model.a(-1,(byte)123,null,0,0);
                    ak kits = model.a(0,18,2,0,null,-1,1,-2012759707);
                    ak kitsAgain = model.a(0,18,2,0,null,-1,1,-2012759707);
                    out.println("model " + variant + " " + npc + " " + step + " " + field(hh.class,model,"q") + " " + model.b(-24861) + " " + mesh(head,headAgain) + " " + mesh(kits,kitsAgain));
                }
            }
        }
        hh broken = new hh();
        broken.a(new int[5],-1,false,0,new int[12],0);
        Field equipment = hh.class.getDeclaredField("l"), colours = hh.class.getDeclaredField("t");
        equipment.setAccessible(true); colours.setAccessible(true);
        for (int eSize : new int[]{-1,0,8,9,12}) for (int cSize : new int[]{-1,0,4,5}) {
            equipment.set(broken,eSize < 0 ? null : new int[eSize]);
            colours.set(broken,cSize < 0 ? null : new int[cSize]);
            String outcome;
            try { outcome = Integer.toString(broken.b(-24861)); }
            catch (ld wrapped) {
                if (wrapped.f instanceof NullPointerException) outcome = "null";
                else if (wrapped.f instanceof ArrayIndexOutOfBoundsException bounds) outcome = "index " + bounds.getMessage().split(" ")[1];
                else throw wrapped;
            }
            out.println("head-id " + eSize + " " + cSize + " " + outcome);
        }
    }

    static void run(Path inputs, Path output) throws Exception {
        ClassLoader loader = HdPlayerAppearanceOracle.class.getClassLoader();
        if (Class.forName("e", false, loader) != e.class
                || e.class.getDeclaredMethod("a", int.class, Class.forName("wa", false, loader)).getReturnType() != void.class)
            throw new AssertionError("original e/wa signature");
        Path jar = Path.of(e.class.getProtectionDomain().getCodeSource().getLocation().toURI());
        String digest = HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(Files.readAllBytes(jar)));
        if (!digest.equals("38df9ba79fdaad00380006c2b98a272d0cc1c55399d201a268a500fbe5df4398"))
            throw new AssertionError("appearance class loaded from unexpected gamepack " + digest);
        // Original RuneScape startup palette; the title fixture bootstraps the archives without invoking main().
        cj.e = md.V;
        if (ta.p[799] != 4315 || ta.p[800] != 4317) throw new AssertionError("missing original wearable definitions");
        try (PrintWriter out = new PrintWriter(Files.newBufferedWriter(output))) {
            e player = null;
            for (String line : Files.readAllLines(inputs)) {
                String[] values = line.split(" ", -1);
                if (values[0].equals("new")) {
                    player = new e();
                    player.K[0] = 34;
                    player.w[0] = 65;
                    player.Qb = 4444;
                    player.ac = 5333;
                    continue;
                }
                if (values[0].equals("particles")) {
                    player.vb = new ga();
                    continue;
                }
                wa packet = new wa(HexFormat.of().parseHex(values[2]));
                packet.T = 7;
                hh previous = player.Bc;
                String outcome = "ok";
                try { player.a(Integer.parseInt(values[1]), packet); }
                catch (RuntimeException e) {
                    Throwable cause = e;
                    while (cause instanceof ld wrapped) cause = wrapped.f;
                    if (cause instanceof IndexOutOfBoundsException) outcome = "bounds";
                    else if (cause instanceof NullPointerException) outcome = "null";
                    else throw e;
                }
                out.println(values[0] + " " + snapshot(player, packet, outcome, previous));
            }
            checkModels(out);
        }
    }

    public static void main(String[] args) throws Exception {
        HdGlModelAnimationOracle.withArchives(args, () -> run(Path.of(args[2]), Path.of(args[3])));
    }
}
