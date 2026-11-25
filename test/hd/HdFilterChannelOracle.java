import java.util.Arrays;

class HdFilterChannelOracle {
    static class Child extends j {
        final int[][] pixels;
        Child(int shape) {
            super(0, false);
            int[][] full = {{31}, {57}, {99}};
            pixels = switch (shape) {
                case 3 -> new int[][]{new int[0], null, new int[0]};
                case 4 -> new int[][]{null, new int[0], new int[0]};
                default -> Arrays.copyOf(full, shape == 5 ? 3 : shape);
            };
        }
        @Override int[][] b(int guard, int y) { return pixels; }
    }

    public static void main(String[] args) throws Exception {
        pe.r = 1;
        ck.X = lb.z = 0;
        var pixels = nd.class.getDeclaredField("a");
        pixels.setAccessible(true);
        for (int filter : new int[]{6,9,22}) {
            for (int input = 0; input <= 5; input++) {
                for (int output = 0; output <= 3; output++) {
                    j op = switch (filter) { case 6 -> new aj(); case 9 -> new ej(); default -> new tb(); };
                    op.p = false;
                    op.G = 1;
                    op.b(1, 1, 250);
                    op.u[0] = new Child(input);
                    int[][][] slots = (int[][][]) pixels.get(op.t);
                    slots[0] = Arrays.copyOf(slots[0], output);
                    String result;
                    try {
                        op.b(-1,0);
                        result = "ok";
                    } catch (ld wrapped) {
                        if (wrapped.f instanceof ArrayIndexOutOfBoundsException) result = "index" + wrapped.f.getMessage().split(" ")[1];
                        else if (wrapped.f instanceof NullPointerException) result = "null";
                        else throw wrapped;
                    }
                    System.out.println(result + "|" + Arrays.deepToString(slots[0]));
                }
            }
        }
    }
}
