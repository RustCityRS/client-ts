import java.awt.image.BufferedImage;
import java.awt.image.DataBufferInt;
import java.lang.foreign.Arena;
import java.lang.foreign.FunctionDescriptor;
import java.lang.foreign.Linker;
import java.lang.foreign.MemorySegment;
import java.lang.foreign.SymbolLookup;
import java.lang.invoke.MethodHandle;
import java.nio.file.Path;
import javax.media.opengl.GL;
import javax.media.opengl.GLContext;
import static java.lang.foreign.ValueLayout.ADDRESS;
import static java.lang.foreign.ValueLayout.JAVA_BYTE;
import static java.lang.foreign.ValueLayout.JAVA_INT;

/** Read the current Windows JOGL context. The shipped jogl.jar omits glReadPixels. */
public final class NativeGlReadback {
    private static final int GL_PACK_ROW_LENGTH = 3330, GL_PACK_SKIP_ROWS = 3331,
        GL_PACK_SKIP_PIXELS = 3332, GL_PACK_ALIGNMENT = 3333;
    private static final int GL_PIXEL_PACK_BUFFER = 35051, GL_PIXEL_PACK_BUFFER_BINDING = 35053;
    private static final MethodHandle READ = Linker.nativeLinker().downcallHandle(
        SymbolLookup.libraryLookup(Path.of(System.getenv("SystemRoot"), "System32", "opengl32.dll"), Arena.global())
            .find("glReadPixels").orElseThrow(),
        FunctionDescriptor.ofVoid(JAVA_INT, JAVA_INT, JAVA_INT, JAVA_INT, JAVA_INT, JAVA_INT, ADDRESS));

    private static int integer(GL gl, int key) {
        int[] value = new int[1];
        gl.glGetIntegerv(key, value, 0);
        return value[0];
    }

    public static BufferedImage readBack(GL gl, int width, int height) {
        if (GLContext.getCurrent() == null) throw new IllegalStateException("OpenGL context must be current");
        int size = Math.multiplyExact(4, Math.multiplyExact(width, height));
        BufferedImage image = new BufferedImage(width, height, BufferedImage.TYPE_INT_ARGB);
        int read = integer(gl, 3074);
        int rowLength = integer(gl, GL_PACK_ROW_LENGTH), skipRows = integer(gl, GL_PACK_SKIP_ROWS);
        int skipPixels = integer(gl, GL_PACK_SKIP_PIXELS), alignment = integer(gl, GL_PACK_ALIGNMENT);
        boolean hasPackBuffers = gl.isExtensionAvailable("GL_ARB_pixel_buffer_object") || gl.isExtensionAvailable("GL_VERSION_2_1");
        int packBuffer = hasPackBuffers ? integer(gl, GL_PIXEL_PACK_BUFFER_BINDING) : 0;
        try (Arena arena = Arena.ofConfined()) {
            MemorySegment pixels = arena.allocate(size, 4);
            try {
                if (packBuffer != 0) gl.glBindBufferARB(GL_PIXEL_PACK_BUFFER, 0);
                gl.glReadBuffer(integer(gl, 3122) == 0 ? 1028 : 1029); // front for single-buffered, back before a swap
                gl.glPixelStorei(GL_PACK_ROW_LENGTH, 0);
                gl.glPixelStorei(GL_PACK_SKIP_ROWS, 0);
                gl.glPixelStorei(GL_PACK_SKIP_PIXELS, 0);
                gl.glPixelStorei(GL_PACK_ALIGNMENT, 1);
                READ.invokeExact(0, 0, width, height, 6408, 5121, pixels); // GL_RGBA / GL_UNSIGNED_BYTE
            } catch (RuntimeException | Error ex) {
                throw ex;
            } catch (Throwable ex) {
                throw new IllegalStateException("glReadPixels failed", ex);
            } finally {
                gl.glPixelStorei(GL_PACK_ALIGNMENT, alignment);
                gl.glPixelStorei(GL_PACK_SKIP_PIXELS, skipPixels);
                gl.glPixelStorei(GL_PACK_SKIP_ROWS, skipRows);
                gl.glPixelStorei(GL_PACK_ROW_LENGTH, rowLength);
                gl.glReadBuffer(read);
                if (packBuffer != 0) gl.glBindBufferARB(GL_PIXEL_PACK_BUFFER, packBuffer);
            }
            byte[] rgba = pixels.toArray(JAVA_BYTE);
            int[] argb = ((DataBufferInt) image.getRaster().getDataBuffer()).getData();
            for (int y = 0; y < height; y++) {
                int dest = (height - 1 - y) * width;
                for (int x = 0, k = 4 * y * width; x < width; x++, k += 4) {
                    argb[dest + x] = (rgba[k + 3] << 24) | ((rgba[k] & 255) << 16) |
                        ((rgba[k + 1] & 255) << 8) | (rgba[k + 2] & 255);
                }
            }
        }
        return image;
    }

    private NativeGlReadback() {}
}
