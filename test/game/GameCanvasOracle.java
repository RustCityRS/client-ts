import java.awt.Component;
import java.awt.Graphics;
import java.awt.image.BufferedImage;
import java.io.IOException;

public final class GameCanvasOracle {
    private static final Graphics[] graphics = {null,
        new BufferedImage(1, 1, BufferedImage.TYPE_INT_RGB).getGraphics(),
        new BufferedImage(2, 1, BufferedImage.TYPE_INT_RGB).getGraphics()};
    private static final RuntimeException runtimeFailure = new IllegalStateException();
    private static final Error seriousFailure = new AssertionError();
    private static final IOException checkedFailure = new IOException();
    private static final StringBuilder trace = new StringBuilder();
    private static int mode;
    private static ah nested;

    @SuppressWarnings("unchecked")
    private static <E extends Throwable> void rethrow(Throwable error) throws E { throw (E) error; }

    private static final class Parent extends Component {
        final int id;
        Parent(int id) { this.id = id; }
        public void update(Graphics gr) { record("U", gr); }
        public void paint(Graphics gr) { record("P", gr); }
        private void record(String method, Graphics gr) {
            trace.append(id).append(method).append(gr == null ? 0 : gr == graphics[1] ? 1 : gr == graphics[2] ? 2 : 3);
            if (id == 1 && mode >= 4 && mode <= 7 || id == 1 && mode == 9) {
                if (method.equals("U")) nested.paint(gr); else nested.update(gr);
            } else if (mode == 1 || mode == 5) throw runtimeFailure;
            else if (mode == 2 || mode == 6) throw seriousFailure;
            else if (mode == 3 || mode == 7) throw od.a(runtimeFailure, "parent");
            else if (mode >= 8) GameCanvasOracle.<RuntimeException>rethrow(checkedFailure);
        }
    }

    public static void main(String[] args) {
        try {
            nested = new ah(new Parent(2));
            for (int parent = 0; parent < 2; parent++) {
                ah canvas = new ah(parent == 0 ? null : new Parent(1));
                for (int method = 0; method < 2; method++) for (Graphics gr : graphics) for (mode = 0; mode < 10; mode++) {
                    trace.setLength(0);
                    String result = "ok";
                    try {
                        if (method == 0) canvas.paint(gr); else canvas.update(gr);
                    } catch (g failure) {
                        result = failure.q + "|" + (failure.a == runtimeFailure ? "runtime" : failure.a instanceof NullPointerException ? "null" : "unknown");
                    } catch (Error failure) {
                        result = failure == seriousFailure ? "error" : "unknown";
                    } catch (Throwable failure) {
                        result = failure == checkedFailure ? "checked" : "unknown";
                    }
                    System.out.println(trace + "|" + result);
                }
            }
        } finally {
            graphics[1].dispose();
            graphics[2].dispose();
        }
    }
}
