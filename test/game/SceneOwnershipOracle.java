class SceneOwnershipOracle {
    static class Model extends ug {
        final String mode;
        int heights, draws;

        Model(String mode) { this.mode = mode; }

        int b() {
            heights++;
            if (mode.equals("heightError")) throw new AssertionError();
            if (mode.equals("heightException")) throw new IllegalStateException();
            return 0;
        }

        void a(int a, int b, int c, int d, int e, int f, int g, int h, long i, int j, ue k) {
            draws++;
            if (mode.equals("drawError")) throw new AssertionError();
            if (mode.equals("drawException")) throw new IllegalStateException();
        }

        void a(int a, int b, int c, int d, int e) {}
    }

    static void fill(String mode) {
        mc.a(1, 1, 1, 1, false);
        Model model = new Model(mode);
        bc.a(0, 0, 0, 1, 1, 64, 64, 0, model, 0, false, 1L);
        ra tile = kl.Bb[0][0][0];
        tile.J = tile.E = true;
        af.O = la.kb = 1;
        String result = "returned";
        try { p.a(tile, false); }
        catch (AssertionError e) { result = "escaped"; }
        System.out.println(mode+" "+result+" "+model.heights+" "+model.draws+" "+tile.J+" "+tile.E+" "+af.O+" "+tile.H[0].r);
    }

    static void overflow(int count) {
        mc.a(1, 2, 1, 1, false);
        ah.i = mc.P = count;
        Model model = new Model("");
        String status = "returned";
        try { bc.a(0, 0, 0, 2, 1, 128, 64, 0, model, 0, true, 0x40000001L); }
        catch (ArrayIndexOutOfBoundsException e) { status = "bounds"; }
        ra left = kl.Bb[0][0][0], right = kl.Bb[0][1][0];
        ec sprite = left.H[0];
        System.out.println("insert "+status+" "+ah.i+" "+(sprite == right.H[0])+" "+(sprite.z == model)+" "+left.P+" "+right.P);
        status = "returned";
        try { og.a(1, 0, 128, 0, 128, -128, 0); }
        catch (ArrayIndexOutOfBoundsException e) { status = "bounds"; }
        System.out.println("occluder "+status+" "+mc.P);
        boolean remote = gl.a(0, 1, 0) == null;
        boolean origin = gl.a(0, 0, 0) == sprite;
        System.out.println("remove "+remote+" "+origin+" "+left.t+" "+right.t+" "+left.P+" "+right.P+" "+(left.H[0] == null)+" "+(right.H[0] == null)+" "+(sprite.z == model));
        // Next init (mc.a) calls ng.e and would revisit this deliberately invalid count.
        ah.i = mc.P = 0;
    }

    public static void main(String[] args) {
        for (String mode : new String[]{"heightError", "drawError", "heightException", "drawException", "ok"}) fill(mode);
        for (int count : new int[]{5000, -1, Integer.MAX_VALUE}) overflow(count);
    }
}
