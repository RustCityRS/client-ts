import java.io.*;
import java.net.Socket;
import java.nio.file.*;
import java.util.*;
import jdk.internal.org.objectweb.asm.*;
import jdk.internal.org.objectweb.asm.tree.*;

public class PacketDispatchOrderOracle {
    static final class Boundary extends Error {}
    static StringJoiner reads;
    static be first, second;
    static boolean dispatch, sweep;
    static int gates, packetReads, replaceGate, replacement, throwGate, replaceBuffer, throwBuffer;

    public static void historyWritten() { dispatch = true; }
    public static void opcodeRead(int candidate) {
        if (!dispatch) { reads.add("p"); return; }
        reads.add(candidate < 0 ? "other" : Integer.toString(candidate));
        gates++;
        if (gates == replaceGate) o.Y = replacement;
        if (gates == throwGate || sweep && (candidate == o.Y || candidate < 0)) throw new Boundary();
    }
    public static void bufferRead() {
        reads.add("b"+first.yb+"/"+second.yb);
        if (dispatch) {
            packetReads++;
            if (packetReads == replaceBuffer) hd.b = second;
            if (packetReads == throwBuffer) throw new Boundary();
        }
    }
    static AbstractInsnNode next(AbstractInsnNode n) {
        do { n=n.getNext(); } while(n!=null && n.getOpcode()<0);
        return n;
    }
    static int constant(AbstractInsnNode n) {
        if(n instanceof IntInsnNode value) return value.operand;
        if(n.getOpcode()>=Opcodes.ICONST_M1 && n.getOpcode()<=Opcodes.ICONST_5) return n.getOpcode()-Opcodes.ICONST_0;
        throw new AssertionError("not a literal: "+n.getOpcode());
    }
    // Read the literal from Jagex's comparison itself. The obfuscator tests some
    // packet ids by complementing both operands before IF_ICMPEQ / IF_ICMPNE.
    static int candidate(FieldInsnNode read) {
        var value=next(read);
        var after=next(value);
        boolean complemented=after!=null && after.getOpcode()==Opcodes.IXOR && value.getOpcode()==Opcodes.ICONST_M1;
        if(complemented) { value=next(after); after=next(value); }
        if(after==null || after.getOpcode()!=Opcodes.IF_ICMPNE && after.getOpcode()!=Opcodes.IF_ICMPEQ) return -1;
        return complemented ? ~constant(value) : constant(value);
    }
    static MethodInsnNode hook(String name,String desc) {
        return new MethodInsnNode(Opcodes.INVOKESTATIC,"PacketDispatchOrderOracle",name,desc,false);
    }
    static void instrument(Path directory) throws IOException {
        ClassReader reader;
        try(var bytes=PacketDispatchOrderOracle.class.getResourceAsStream("/rg.class")) { reader=new ClassReader(bytes); }
        var type=new ClassNode();
        reader.accept(type,0);
        var method=type.methods.stream().filter(m->m.name.equals("a") && m.desc.equals("(B)Z")).findFirst().orElseThrow();
        boolean body=false;
        for(var insn:method.instructions.toArray()) {
            if(!(insn instanceof FieldInsnNode field)) continue;
            if(field.getOpcode()==Opcodes.PUTSTATIC && field.owner.equals("fk") && field.name.equals("X")) {
                method.instructions.insert(field,hook("historyWritten","()V"));
                body=true;
            }
            if(field.getOpcode()!=Opcodes.GETSTATIC) continue;
            if(field.owner.equals("hd") && field.name.equals("b")) method.instructions.insertBefore(field,hook("bufferRead","()V"));
            if(field.owner.equals("o") && field.name.equals("Y")) {
                int check=body?candidate(field):-1;
                method.instructions.insertBefore(field,new LdcInsnNode(check));
                method.instructions.insertBefore(field,hook("opcodeRead","(I)V"));
            }
        }
        if(!body)throw new AssertionError("missing fk.X");
        var writer=new ClassWriter(reader,ClassWriter.COMPUTE_MAXS);
        type.accept(writer);
        Files.write(directory.resolve("rg.class"),writer.toByteArray());
    }

    static class Peer extends Socket {
        final byte[] bytes;
        Peer(byte[] bytes) { this.bytes=bytes; }
        public void setSoTimeout(int timeout) {}
        public void setTcpNoDelay(boolean enabled) {}
        public InputStream getInputStream() { return new ByteArrayInputStream(bytes); }
        public OutputStream getOutputStream() { return OutputStream.nullOutputStream(); }
    }
    public static void main(String[] args) throws Exception {
        if(args.length!=0) { instrument(Path.of(args[0])); return; }
        var input=new BufferedReader(new InputStreamReader(System.in));
        for(String row; (row=input.readLine())!=null;) {
            String[] v=row.split(" ");
            int op=Integer.parseInt(v[0]);
            sweep=Integer.parseInt(v[1])!=0;
            replaceGate=Integer.parseInt(v[2]); replacement=Integer.parseInt(v[3]); throwGate=Integer.parseInt(v[4]);
            replaceBuffer=Integer.parseInt(v[5]); throwBuffer=Integer.parseInt(v[6]);
            byte[] wire=HexFormat.of().parseHex(v[7]), alt=HexFormat.of().parseHex(v[8]);
            first=new be(48); first.yb=12; second=new be(0); second.fb=alt; second.yb=3;
            hd.b=first; o.Y=op; af.I=wire.length; ek.s=new se(new Peer(wire),null);
            ia.q=55; fk.X=42; la.W=51; jh.q=11; dg.C=44; ha.a=45;
            wa.a=new vc[1]; ei.q=null; hk.e=1000; vj.t=1000;
            dispatch=false; gates=packetReads=0; reads=new StringJoiner(",");
            String outcome;
            try { outcome=Boolean.toString(rg.a((byte)57)); }
            catch(Boundary e) { outcome="stop"; }
            catch(RuntimeException err) {
                Throwable t=err;
                while(t instanceof g wrapper && wrapper.a!=null)t=wrapper.a;
                outcome=t instanceof IndexOutOfBoundsException?"bounds":t instanceof NullPointerException?"null":t.getClass().getSimpleName();
            }
            System.out.println(reads+";"+outcome+";"+first.yb+","+second.yb+","+(hd.b==second?2:1)+";"+o.Y+","+fk.X+","+la.W+","+jh.q+","+ia.q+","+dg.C+","+ha.a);
        }
    }
}
