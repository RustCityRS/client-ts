// javax.media.opengl.GLException extends java.lang.RuntimeException (shipped jogl.jar, JOGL 1.1.x).
// A plain Error subclass, which is how the port represents RuntimeException (util/JavaException.ts):
// isJavaRuntimeException() accepts it, so the ports of the gamepack's catch (Exception) and
// catch (Throwable) arms catch it.
// The message follows RuntimeException: (String) keeps the string, (Throwable) keeps the cause and uses its
// toString() as the message (the JS toString, since no Java code reads it back), and () has no message.
// The port represents Java's null message as ''.
export default class GLException extends Error {
    override cause: Error | null;

    // javax.media.opengl.GLException.<init>()V
    // javax.media.opengl.GLException.<init>(Ljava/lang/String;)V
    // javax.media.opengl.GLException.<init>(Ljava/lang/Throwable;)V
    constructor(arg: string | Error | null = null) {
        super(arg === null ? '' : typeof arg === 'string' ? arg : String(arg));
        this.cause = arg instanceof Error ? arg : null;
    }
}
