import java.io.BufferedInputStream;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.SequenceInputStream;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.util.jar.JarOutputStream;
import java.util.jar.Pack200;
import java.util.zip.GZIPInputStream;
import java.util.zip.ZipEntry;

// The 530 loader restores the two omitted gzip magic bytes before reading Pack200.
public class UnpackGamepack {
    public static void main(String[] args) throws IOException {
        byte[] header = {0x1f, (byte) 0x8b};
        try (InputStream file = Files.newInputStream(Paths.get(args[0]));
             InputStream pack = new BufferedInputStream(new GZIPInputStream(new SequenceInputStream(new ByteArrayInputStream(header), file)));
             JarOutputStream jar = new JarOutputStream(Files.newOutputStream(Paths.get(args[1]))) {
                 @Override
                 public void putNextEntry(ZipEntry entry) throws IOException {
                     // The reference JARs also deflate the empty META-INF directory.
                     entry.setMethod(ZipEntry.DEFLATED);
                     entry.setCompressedSize(-1);
                     super.putNextEntry(entry);
                 }
             }) {
            Pack200.newUnpacker().unpack(pack, jar);
        }
    }
}
