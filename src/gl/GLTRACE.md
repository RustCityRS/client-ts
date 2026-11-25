# GLTrace v1

GLTrace v1 specifies how to record and compare the Java and TypeScript HD clients’ GL commands.

- The TypeScript recorder is `src/gl/RecordingGL.ts`. Its serializer, rule table and parser are in `src/gl/GlTrace.ts`.
- The Java reference recorder used the shipped JOGL classes as described in §18.
- `src/gl/NullGL.ts` implements the capability responder specified in §16.
- Section 17 defines how to compare the recorded streams.

For the same calls and responding state (§16), a Java recorder must produce byte-for-byte identical text to `RecordingGL`. Appendix A gives the complete reference trace over the fallback profile in Appendix B. It covers every entry point in §12 and every rule for Java calls. Appendix C shows the TS-only slip tokens (§14).

The independent Java recorder used §12, §13 and Appendix B to drive the calls through a `java.lang.reflect.Proxy` GL, Java NIO buffers and the shipped JOGL classes. Conformance requires reproducing Appendix A byte for byte, including the meta line.

“Must”, “must not” and “may” are normative. Sections 11–13 and Appendices A–C define the reference data for conformance.

## 1. Model

A trace is the sequence of calls the client makes on the JOGL objects it holds: the `GL`, the `GLDrawableFactory`, the `GLDrawable`s and the `GLContext`s. The client is the gamepack in Java and the port in TS.

- Every call to an entry listed in §12 produces exactly one record. The record is appended when the call returns or throws.
- Calls that a recorder, a responder or a driver makes internally produce no record.
- The only other records are the pseudo entries `~gl` and `~mark` (§15).

A recorder never changes behaviour. It passes arguments through unchanged, returns the inner result unchanged, rethrows the inner throwable unchanged, and never makes GL calls of its own.

## 2. Text format

- Encoding: UTF-8 with LF line ends. The file ends with an LF. Every byte is in practice 0x09, 0x0A or 0x20..0x7E, because strings are escaped (§8).
- Line 1 is exactly `#GLTrace v1`.
- Meta lines `#! <text>` may follow, but only before the first record. They hold free text with no tab or LF (for example `#! source=java`) and are never compared.
- Records follow. A record is one record line, optionally followed by one stack line `#@ <text>`.
    - The stack text is free text with no tab or LF.
    - Java writes StackWalker frames as `class.method pc`; TS writes function names.
    - Frames are joined by `<`, innermost first.
    - Stack lines are never compared.
- No other lines and no blank lines are allowed.

## 3. Record line

```
<id> TAB <entry> { TAB <column> } [ TAB "=> " <value> | TAB "!> " <throw-kind> ]
```

- **`<id>`:** `<frame>.<seq>` for an ordered record, `<frame>.d<n>` for a deletion record (§4). Decimal numbers with no leading zeros.
- **`<entry>`:** one of three forms:
    - the GL method name: `glBindTexture`, `isExtensionAvailable`, `setSwapInterval`;
    - `<SimpleClassName>.<method>` for the context API: `GLDrawable.swapBuffers`;
    - a pseudo entry: `~gl`, `~mark`.
- **Columns:**
    - A context-API entry's first column is the receiver reference (§10).
    - Then comes one column per Java parameter, in declaration order. This includes the `int` offset parameter that follows every array.
    - Each column is serialized by its role in §12.
- **Return and throw:**
    - A non-void call that returns normally ends with `=> <value>`, serialized by the return role in §12.
    - A void call has no return column.
    - A call that throws ends with `!> <kind>` (§11) and has no return column.

## 4. Numbering and frames

Each trace keeps three counters, all starting at 0: `frame`, `seq` and `del`.

- **Ordered records:** any record whose entry is not flagged `deletion` in §12 gets the id `frame.seq`, then `seq` is incremented.
- **Deletion records:** `glDeleteTextures`, `glDeleteBuffersARB` and `glDeleteLists` get the id `frame.d<del>`, then `del` is incremented.
    - Deletion records never use a `seq` value.
    - Java finalizers decide when deletions happen. Because deletions take no `seq`, that timing cannot shift the ids of ordered records.
- **Frame end:** after appending a record of an entry flagged `ends-frame` (only `GLDrawable.swapBuffers`), `frame` is incremented and `seq` and `del` are reset to 0. This happens whether or not swapBuffers threw.

## 5. Scalar tokens

| Java type      | Role               | Token                                                                               |
| -------------- | ------------------ | ----------------------------------------------------------------------------------- |
| int, short     | `int`              | signed decimal: `-1`, `0`, `34962`                                                  |
| byte           | `byte`             | signed decimal of the Java byte, -128..127 (`glColor4ub((byte)-1, ...)` gives `-1`) |
| float          | `float`            | `f:` + 8 lowercase hex digits of `Float.floatToRawIntBits`                          |
| double         | `double`           | `d:` + 16 lowercase hex digits of `Double.doubleToRawLongBits`                      |
| boolean        | `bool`             | `T` or `F`                                                                          |
| long           | `long`             | `o:` + signed decimal (every long the jar passes is a VBO byte offset)              |
| null reference | any reference role | `null`                                                                              |

## 6. Arrays

The roles `in-f[C]`, `out-f[C]`, `out-i[C]`, `in-names:K[C]` and `out-names:K[C]` apply to a `float[]` or `int[]` parameter. The parameter after the array is always its `int` offset, which is serialized as an ordinary `int` column.

**Count `C`** takes one of three forms:

- a decimal number;
- `$k`: the value of the call's parameter `k`, counting from 0 without the receiver. A negative value counts 0.
- `TABLE($k)`: parameter `k` looked up in count table `TABLE` (§13). A pname that is not listed counts 1.

**Elements:**

- The serialized elements are indices `offset` .. `offset + C - 1`.
- The token is `fv:` (float[]) or `iv:` (int[]) followed by the elements, separated by commas.
- A float element is 8 lowercase hex digits of `floatToRawIntBits` of the stored value. TS reads the raw bits from the array memory, so NaN payloads are kept.
- An int element is a signed decimal, or a name token (§9) for the name roles.

**Indices outside the array:**

- An index outside `0 .. length-1` is not serialized. This includes every index when `offset < 0`.
- Instead, a final element `!<m>` gives the number `m` (at least 1) of such indices.
- Count 4 with 2 elements present: `fv:00000000,00000000,!2`. Count 4 with no element present: `fv:!4`. Count 0: `fv:` or `iv:`.
- A null array is `null`.

**When:**

- Input roles (`in-…`) are serialized before the call.
- Output roles (`out-…`) are serialized after the call, even when it threw. They show the values the array holds at that point.

## 7. Buffers

The roles `buf`, `buf[C]` and `out-buf[C]` apply to a `java.nio.Buffer` parameter. In practice this is a ByteBuffer, ShortBuffer, IntBuffer or FloatBuffer.

```
B:<kind>:<pos>:<lim>:<cap>:<storage>:<sha256>[:<hex>]
```

- **kind:** `byte`, `short`, `int` or `float`.
- **pos, lim, cap:** `position()`, `limit()` and `capacity()` at serialization time.
- **storage:** `direct` if `isDirect()`, else `heap`. A view of a direct ByteBuffer is `direct`.
- **Hashed range `[start, end)`:** `start = pos`. `end = lim` for `buf`, and `end = min(lim, pos + C)` for `buf[C]` and `out-buf[C]`.
- **Bytes:** for each element index in `[start, end)`, in order, the element's bytes as stored, which are exactly the bytes GL reads. Each element is encoded in the buffer's `order()`:
    - ByteBuffer: the byte;
    - ShortBuffer: 2 bytes;
    - IntBuffer: 4 bytes;
    - FloatBuffer: the 4 bytes of `floatToRawIntBits`.

    Every buffer the jar passes is in native order, and native order is little-endian on the oracle host and in browsers. A view made from a BIG_ENDIAN ByteBuffer contributes big-endian elements (Appendix A, `glTexCoordPointer`).

- **sha256:** the lowercase hex SHA-256 of those bytes.
- **hex:** present if and only if there are at most 256 bytes. It is `:` followed by the bytes in lowercase hex. An empty range therefore leaves a trailing `:`.
- **When:** `buf` and `buf[C]` are serialized before the call, `out-buf[C]` after it.
- **Java:** read each element with absolute `get(i)`, which does not move the position. Write it into `ByteBuffer.allocate(n).order(buf.order())` with `put`, `putShort`, `putInt`, or `putInt(Float.floatToRawIntBits(get(i)))`, then hash the array with `MessageDigest.getInstance("SHA-256")`.
- **Blob store (optional, not part of the text):** a recorder may hand every hashed byte range and every string payload to a blob sink keyed by its sha256, so that traces can be replayed. TS: `GlTraceWriterOptions.blobs`.

## 8. Strings

The role `string` applies to parameters and returns.

```
S:<len>:<sha256>[:<text>]
```

- **bytes:** the UTF-8 encoding of the string, exactly as Java's `String.getBytes(StandardCharsets.UTF_8)` returns it.
    - A surrogate pair (a high surrogate U+D800..U+DBFF followed by a low surrogate U+DC00..U+DFFF) is one 4-byte sequence.
    - Every unpaired surrogate becomes the single byte `?` (0x3F), Java's replacement byte. Unpaired means a high surrogate not followed by a low one, or a low surrogate not preceded by a high one. The code unit after an unpaired high surrogate is encoded on its own.
    - The replacement is not U+FFFD (EF BF BD), which `TextEncoder` and `String.prototype.toWellFormed` would give. TS (`javaUtf8Bytes` in `GlTrace.ts`) therefore replaces unpaired surrogates with `?` itself before encoding.
    - Examples: U+D800 alone is `S:1:<sha256>:?`, the reversed pair U+DE00 U+D83D is `S:2:<sha256>:??`, and U+D83D U+D83D U+DE00 is the 5 bytes `3f f0 9f 98 80`.
- **len:** the number of bytes.
- **sha256:** the lowercase hex SHA-256 of the bytes (64 digits `0-9a-f`).
- **text:** present if and only if `len` is at most 256.
    - Bytes in 0x21..0x7E other than `%` are written as their character.
    - Every other byte is written as `%` followed by two UPPERCASE hex digits.
    - Example: `RS530 Virtual GL` becomes `RS530%20Virtual%20GL`.
- **null:** `null`.
- **Scope:** every string in the jar is ASCII. Strings with unpaired surrogates come only from a port bug or a test, and both sides encode them as above.

## 9. GL object names

There are four kinds: `T` textures, `B` buffer objects, `L` display lists and `P` programs. The name roles are `name:K` (an int parameter), `in-names:K[C]` and `out-names:K[C]` (int[] elements), and `alloc-lists[$k]` (the return of glGenLists).

Each trace keeps, per kind, a counter `n_K` starting at 0 and a map from raw value to id.

**Allocation** applies to `out-names` elements in index order, then to the `alloc-lists` return. It happens only when the call returned normally. For each element value `v`:

- If `v == 0`, the token is `0` and nothing is allocated.
- Otherwise `n_K` is incremented, `map[v] = n_K`, and the token is `#K<n_K>`. The new entry replaces any earlier entry for `v`, because drivers may reuse freed names.

**glGenLists(range) returning base:**

- If the call returned normally, `base != 0` and `range > 0`, the names `base`, `base+1`, … `base+range-1` are allocated in that order, so their ids are consecutive. The return token is the id of `base`.
- Otherwise the return token is the resolution of `base`.

**Resolution** applies to every other occurrence: `name:K` parameters, `in-names` elements, `out-names` elements of a call that threw, and a glGenLists return without allocation. For a value `v`:

- `v == 0` gives `0`;
- `v` in the map gives `#K<map[v]>`;
- otherwise the token is `#K?<v>`, with `v` in signed decimal (example: `#T?999`).

**Deletions** remove nothing from the map. A reference after a deletion resolves to the old id until the raw value is allocated again.

Ids follow allocation order per kind, so neither side depends on driver numbering.

## 10. Object references, context calls and the GL receiver

There are five reference kinds: `F` GLDrawableFactory, `D` GLDrawable, `C` GLContext, `G` GL, and `O` any other object (the canvas target or a chooser).

**Reference tokens:**

- The token is `@K<n>`.
- `n` is assigned per kind, by object identity (Java `==`, TS `===`), the first time the object appears in the trace. Each record's columns are scanned left to right: receiver, parameters, return.
- A null reference is `null`.
- The object is the one the client holds (the recorder's wrapper or proxy), never an inner driver object.

**Context-API entries** (the rows of §12 that have a receiver) carry the receiver as their first column.

**Capabilities** (role `caps`): `K:` followed by 15 fields joined by `:`, read from the GLCapabilities getters at serialization time. Booleans are written `T`/`F` and ints in decimal. The order is:
`getDoubleBuffered`, `getStereo`, `getHardwareAccelerated`, `getDepthBits`, `getStencilBits`, `getRedBits`, `getGreenBits`, `getBlueBits`, `getAlphaBits`, `getAccumRedBits`, `getAccumGreenBits`, `getAccumBlueBits`, `getAccumAlphaBits`, `getSampleBuffers`, `getNumSamples`.
`new GLCapabilities()` followed by `setSampleBuffers(true)` and `setNumSamples(4)` gives `K:T:F:T:24:0:8:8:8:0:0:0:0:0:T:4`. A null capabilities argument is `null`.

**GL receiver marker:** when an ordered GL-method call (a §12 entry without a receiver) starts, before its columns are serialized and before the responder is invoked, the recorder appends `~gl TAB @G<n>` if the receiving GL object differs from the remembered receiver, or if there is none, and then remembers this receiver. The marker is itself an ordered record. Deletion calls neither emit the marker nor update the remembered receiver. One GL object therefore costs one marker, and switching `tf.t` between GL objects mid-method (Codex's context-switch fault cases) shows up in the trace.

The marker is decided when the call starts, but the call's own record is appended when it returns (§11). In a reentrant call the two are separated: if the responder for a call on `@G1` makes a recorded call on `@G2`, the trace reads `~gl @G1`, `~gl @G2`, the inner record, then the outer record, with no marker before the outer record. The original Java recorder used the same ordering as RecordingGL.

**Internal calls:** a context call that an implementation makes inside another recorded call is internal and must not be recorded. An example is a driver's makeCurrent releasing the previous context.

- Java: a fake GLContext must not route such releases through its recording entry points.
- TS: RecordingGLContext presents the inner context as current while the inner makeCurrent runs.

**Current context:** `GLContext.getCurrent()` must return the client-facing (recording) context. This is what makes `tf.o()V`'s `GLContext.getCurrent() == p` test work, and what lets GLU's `GLContext.getCurrent().getGL()` reach the recording GL.

## 11. Returns, throws and unrecorded members

**Returns:** `=> <value>`, serialized by the return role.

**Throws:** `!> <kind>`, where the kind is one of:

| Kind               | Java                                           | TS                                                                                    |
| ------------------ | ---------------------------------------------- | ------------------------------------------------------------------------------------- |
| `GLException`      | `javax.media.opengl.GLException` or a subclass | `src/jogl/GLException`                                                                |
| `RuntimeException` | any other RuntimeException                     | any other Error that is not JavaError or JavaCheckedException (the port's convention) |
| `Error`            | `java.lang.Error`                              | `JavaError`                                                                           |
| `Exception`        | a checked exception                            | `JavaCheckedException`                                                                |
| `Throwable`        | anything else                                  | a non-Error value                                                                     |

**Unrecorded members.** These surface members produce no record:

<!-- unrecorded:begin -->

| Member                            | Descriptor                                 | Reason                                                                                      |
| --------------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------- |
| `GLDrawableFactory.getFactory`    | `()Ljavax/media/opengl/GLDrawableFactory;` | static; a Java recorder cannot intercept it                                                 |
| `GLContext.getCurrent`            | `()Ljavax/media/opengl/GLContext;`         | static; a Java recorder cannot intercept it                                                 |
| `GLCapabilities.<init>`           | `()V`                                      | concrete class; its state is recorded as the caps column of GLDrawableFactory.getGLDrawable |
| `GLCapabilities.setSampleBuffers` | `(Z)V`                                     | concrete class; its state is recorded as the caps column of GLDrawableFactory.getGLDrawable |
| `GLCapabilities.setNumSamples`    | `(I)V`                                     | concrete class; its state is recorded as the caps column of GLDrawableFactory.getGLDrawable |
| `GLU.<init>`                      | `()V`                                      | concrete class with an empty constructor; makes no GL call                                  |
| `GLU.gluBuild2DMipmaps`           | `(IIIIIILjava/nio/Buffer;)I`               | concrete class; recorded through the GL calls it makes on GLContext.getCurrent().getGL()    |

<!-- unrecorded:end -->

**Display lists:** the calls between `glNewList` and `glEndList` are recorded as they are issued, as ordinary records, so the body appears as compiled. `glCallList` is one record, and the list body is not replayed into the trace.

**GLU:** `gluBuild2DMipmaps` itself is not recorded. What it does through the recorded objects is recorded as ordinary records, in the order JOGL's `com.sun.opengl.impl.mipmap` code issues it:

1. `GLContext.getGL` on the current context, from `GLU.getCurrentGL()` (`GLContext.getCurrent().getGL()`), followed by the `~gl` marker if it is due (§10).
2. `glGetString(7938)` (VERSION), from `Mipmap.closestFit`.
3. Either the proxy probe, when the first three chars of the trimmed VERSION parse as at least 1.1: pairs of `glTexImage2D` (or `glTexImage1D`) on the proxy target at level 1 and `glGetTexLevelParameteriv(<proxy target>, 1, 4096 TEXTURE_WIDTH)`, halving until the width is not 0. Or `glGetIntegerv(3379)` (MAX_TEXTURE_SIZE), when VERSION is below 1.1, when the probe threw a GLException, or when even the 1x1 probe was refused (in the last two cases after the probe records).
4. The 12 pixel-store reads `glGetIntegerv` 3317, 3314, 3315, 3316, 3313, 3312 (UNPACK ALIGNMENT, ROW_LENGTH, SKIP_ROWS, SKIP_PIXELS, LSB_FIRST, SWAP_BYTES), then 3333, 3330, 3331, 3332, 3329, 3328 (the same six PACK modes).
5. The `glPixelStorei` calls that set up the upload, one `glTexImage2D` per level with `glPixelStorei` calls between levels, and the `glPixelStorei` calls that restore the saved modes.

For the client's call (RGBA/UNSIGNED_BYTE, 128 or 64, a direct or heap ByteBuffer), when closestFit keeps the size, the sequence after step 4 is `glPixelStorei` 3315, 3316, 3314 (all 0), `glTexImage2D` level 0, `glPixelStorei(3312, 0)`, `glTexImage2D` levels 1 to the 1x1 level, then `glPixelStorei` 3317, 3315, 3316, 3314, 3312 with the saved values. Both recorders must record each call that GLU issues.

**Reentrancy:** a recorded call made while another recorded call is still running is appended first, because records are appended on return. The `~gl` marker is decided at call start (§10). No driver in use does this.

## 12. Entry table

Columns of the table:

- **receiver:** `-` for a GL method; otherwise the reference role of the receiver column.
- **columns:** one role per Java parameter.
- **return:** the return role.
- **flag:** `deletion` (§4, §17), `ends-frame` (§4) or `-`.

Parameter roles:

| Role                                        | Section | Serialization                                                  |
| ------------------------------------------- | ------- | -------------------------------------------------------------- |
| `int` `byte` `float` `double` `bool` `long` | §5      | scalar tokens                                                  |
| `string`                                    | §8      | string token                                                   |
| `caps`                                      | §10     | capabilities token                                             |
| `buf`                                       | §7      | buffer token, `[pos, lim)` hashed, before the call             |
| `buf[C]`                                    | §7      | buffer token, `[pos, min(lim, pos+C))` hashed, before the call |
| `out-buf[C]`                                | §7      | as `buf[C]`, after the call                                    |
| `in-f[C]`                                   | §6      | float elements, before the call                                |
| `out-f[C]`                                  | §6      | float elements, after the call                                 |
| `out-i[C]`                                  | §6      | int elements, after the call                                   |
| `name:K`                                    | §9      | resolved name                                                  |
| `in-names:K[C]`                             | §6, §9  | resolved names, before the call                                |
| `out-names:K[C]`                            | §6, §9  | allocated names (resolved if the call threw), after the call   |
| `ref:K`                                     | §10     | object reference                                               |

Return roles: `void` (no column), `int`, `bool`, `string`, `ref:K`, and `alloc-lists[$k]` (§9).

The rows below are the GLTrace rules of `ENTRY_RULE_SOURCE` in `GlTrace.ts`, verbatim and in the same order. The GL rows match the 102 methods of the shipped `javax.media.opengl.GL`, which `src/jogl/GL.ts` mirrors; the context rows match the 8 context-API members in the JOGL surface table.

<!-- entry-table:begin -->

| entry                             | descriptor                                                                                                                         | receiver | columns                                                     | return            | flag         |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | -------- | ----------------------------------------------------------- | ----------------- | ------------ |
| `glActiveTexture`                 | `(I)V`                                                                                                                             | -        | `int`                                                       | `void`            | -            |
| `glAlphaFunc`                     | `(IF)V`                                                                                                                            | -        | `int` `float`                                               | `void`            | -            |
| `glBegin`                         | `(I)V`                                                                                                                             | -        | `int`                                                       | `void`            | -            |
| `glBindBufferARB`                 | `(II)V`                                                                                                                            | -        | `int` `name:B`                                              | `void`            | -            |
| `glBindProgramARB`                | `(II)V`                                                                                                                            | -        | `int` `name:P`                                              | `void`            | -            |
| `glBindTexture`                   | `(II)V`                                                                                                                            | -        | `int` `name:T`                                              | `void`            | -            |
| `glBlendFunc`                     | `(II)V`                                                                                                                            | -        | `int` `int`                                                 | `void`            | -            |
| `glBufferDataARB`                 | `(IILjava/nio/Buffer;I)V`                                                                                                          | -        | `int` `int` `buf` `int`                                     | `void`            | -            |
| `glBufferSubDataARB`              | `(IIILjava/nio/Buffer;)V`                                                                                                          | -        | `int` `int` `int` `buf`                                     | `void`            | -            |
| `glCallList`                      | `(I)V`                                                                                                                             | -        | `name:L`                                                    | `void`            | -            |
| `glClear`                         | `(I)V`                                                                                                                             | -        | `int`                                                       | `void`            | -            |
| `glClearColor`                    | `(FFFF)V`                                                                                                                          | -        | `float` `float` `float` `float`                             | `void`            | -            |
| `glClearDepth`                    | `(D)V`                                                                                                                             | -        | `double`                                                    | `void`            | -            |
| `glClientActiveTexture`           | `(I)V`                                                                                                                             | -        | `int`                                                       | `void`            | -            |
| `glColor3ub`                      | `(BBB)V`                                                                                                                           | -        | `byte` `byte` `byte`                                        | `void`            | -            |
| `glColor4f`                       | `(FFFF)V`                                                                                                                          | -        | `float` `float` `float` `float`                             | `void`            | -            |
| `glColor4fv`                      | `([FI)V`                                                                                                                           | -        | `in-f[4]` `int`                                             | `void`            | -            |
| `glColor4ub`                      | `(BBBB)V`                                                                                                                          | -        | `byte` `byte` `byte` `byte`                                 | `void`            | -            |
| `glColorMaterial`                 | `(II)V`                                                                                                                            | -        | `int` `int`                                                 | `void`            | -            |
| `glColorPointer`                  | `(IIILjava/nio/Buffer;)V`                                                                                                          | -        | `int` `int` `int` `buf`                                     | `void`            | -            |
| `glColorPointer`                  | `(IIIJ)V`                                                                                                                          | -        | `int` `int` `int` `long`                                    | `void`            | -            |
| `glCopyPixels`                    | `(IIIII)V`                                                                                                                         | -        | `int` `int` `int` `int` `int`                               | `void`            | -            |
| `glCullFace`                      | `(I)V`                                                                                                                             | -        | `int`                                                       | `void`            | -            |
| `glDeleteBuffersARB`              | `(I[II)V`                                                                                                                          | -        | `int` `in-names:B[$0]` `int`                                | `void`            | `deletion`   |
| `glDeleteLists`                   | `(II)V`                                                                                                                            | -        | `name:L` `int`                                              | `void`            | `deletion`   |
| `glDeleteTextures`                | `(I[II)V`                                                                                                                          | -        | `int` `in-names:T[$0]` `int`                                | `void`            | `deletion`   |
| `glDepthFunc`                     | `(I)V`                                                                                                                             | -        | `int`                                                       | `void`            | -            |
| `glDepthMask`                     | `(Z)V`                                                                                                                             | -        | `bool`                                                      | `void`            | -            |
| `glDisable`                       | `(I)V`                                                                                                                             | -        | `int`                                                       | `void`            | -            |
| `glDisableClientState`            | `(I)V`                                                                                                                             | -        | `int`                                                       | `void`            | -            |
| `glDrawBuffer`                    | `(I)V`                                                                                                                             | -        | `int`                                                       | `void`            | -            |
| `glDrawElements`                  | `(IIILjava/nio/Buffer;)V`                                                                                                          | -        | `int` `int` `int` `buf`                                     | `void`            | -            |
| `glDrawElements`                  | `(IIIJ)V`                                                                                                                          | -        | `int` `int` `int` `long`                                    | `void`            | -            |
| `glDrawPixels`                    | `(IIIILjava/nio/Buffer;)V`                                                                                                         | -        | `int` `int` `int` `int` `buf`                               | `void`            | -            |
| `glEnable`                        | `(I)V`                                                                                                                             | -        | `int`                                                       | `void`            | -            |
| `glEnableClientState`             | `(I)V`                                                                                                                             | -        | `int`                                                       | `void`            | -            |
| `glEnd`                           | `()V`                                                                                                                              | -        | -                                                           | `void`            | -            |
| `glEndList`                       | `()V`                                                                                                                              | -        | -                                                           | `void`            | -            |
| `glFogf`                          | `(IF)V`                                                                                                                            | -        | `int` `float`                                               | `void`            | -            |
| `glFogfv`                         | `(I[FI)V`                                                                                                                          | -        | `int` `in-f[FOGFV($0)]` `int`                               | `void`            | -            |
| `glFogi`                          | `(II)V`                                                                                                                            | -        | `int` `int`                                                 | `void`            | -            |
| `glGenBuffersARB`                 | `(I[II)V`                                                                                                                          | -        | `int` `out-names:B[$0]` `int`                               | `void`            | -            |
| `glGenLists`                      | `(I)I`                                                                                                                             | -        | `int`                                                       | `alloc-lists[$0]` | -            |
| `glGenProgramsARB`                | `(I[II)V`                                                                                                                          | -        | `int` `out-names:P[$0]` `int`                               | `void`            | -            |
| `glGenTextures`                   | `(I[II)V`                                                                                                                          | -        | `int` `out-names:T[$0]` `int`                               | `void`            | -            |
| `glGetFloatv`                     | `(ILjava/nio/FloatBuffer;)V`                                                                                                       | -        | `int` `out-buf[GETFV($0)]`                                  | `void`            | -            |
| `glGetFloatv`                     | `(I[FI)V`                                                                                                                          | -        | `int` `out-f[GETFV($0)]` `int`                              | `void`            | -            |
| `glGetIntegerv`                   | `(I[II)V`                                                                                                                          | -        | `int` `out-i[1]` `int`                                      | `void`            | -            |
| `glGetString`                     | `(I)Ljava/lang/String;`                                                                                                            | -        | `int`                                                       | `string`          | -            |
| `glGetTexLevelParameteriv`        | `(III[II)V`                                                                                                                        | -        | `int` `int` `int` `out-i[1]` `int`                          | `void`            | -            |
| `glHint`                          | `(II)V`                                                                                                                            | -        | `int` `int`                                                 | `void`            | -            |
| `glInterleavedArrays`             | `(IILjava/nio/Buffer;)V`                                                                                                           | -        | `int` `int` `buf`                                           | `void`            | -            |
| `glInterleavedArrays`             | `(IIJ)V`                                                                                                                           | -        | `int` `int` `long`                                          | `void`            | -            |
| `glLightModelfv`                  | `(I[FI)V`                                                                                                                          | -        | `int` `in-f[LIGHTMODELFV($0)]` `int`                        | `void`            | -            |
| `glLightf`                        | `(IIF)V`                                                                                                                           | -        | `int` `int` `float`                                         | `void`            | -            |
| `glLightfv`                       | `(II[FI)V`                                                                                                                         | -        | `int` `int` `in-f[LIGHTFV($1)]` `int`                       | `void`            | -            |
| `glLoadIdentity`                  | `()V`                                                                                                                              | -        | -                                                           | `void`            | -            |
| `glLoadMatrixf`                   | `([FI)V`                                                                                                                           | -        | `in-f[16]` `int`                                            | `void`            | -            |
| `glMatrixMode`                    | `(I)V`                                                                                                                             | -        | `int`                                                       | `void`            | -            |
| `glMultiTexCoord2f`               | `(IFF)V`                                                                                                                           | -        | `int` `float` `float`                                       | `void`            | -            |
| `glNewList`                       | `(II)V`                                                                                                                            | -        | `name:L` `int`                                              | `void`            | -            |
| `glNormalPointer`                 | `(IILjava/nio/Buffer;)V`                                                                                                           | -        | `int` `int` `buf`                                           | `void`            | -            |
| `glNormalPointer`                 | `(IIJ)V`                                                                                                                           | -        | `int` `int` `long`                                          | `void`            | -            |
| `glOrtho`                         | `(DDDDDD)V`                                                                                                                        | -        | `double` `double` `double` `double` `double` `double`       | `void`            | -            |
| `glPixelStorei`                   | `(II)V`                                                                                                                            | -        | `int` `int`                                                 | `void`            | -            |
| `glPixelZoom`                     | `(FF)V`                                                                                                                            | -        | `float` `float`                                             | `void`            | -            |
| `glPointParameterfARB`            | `(IF)V`                                                                                                                            | -        | `int` `float`                                               | `void`            | -            |
| `glPointParameterfvARB`           | `(I[FI)V`                                                                                                                          | -        | `int` `in-f[POINTPARAMFV($0)]` `int`                        | `void`            | -            |
| `glPolygonMode`                   | `(II)V`                                                                                                                            | -        | `int` `int`                                                 | `void`            | -            |
| `glPopAttrib`                     | `()V`                                                                                                                              | -        | -                                                           | `void`            | -            |
| `glPopMatrix`                     | `()V`                                                                                                                              | -        | -                                                           | `void`            | -            |
| `glProgramLocalParameter4fARB`    | `(IIFFFF)V`                                                                                                                        | -        | `int` `int` `float` `float` `float` `float`                 | `void`            | -            |
| `glProgramLocalParameter4fvARB`   | `(IILjava/nio/FloatBuffer;)V`                                                                                                      | -        | `int` `int` `buf[4]`                                        | `void`            | -            |
| `glProgramLocalParameter4fvARB`   | `(II[FI)V`                                                                                                                         | -        | `int` `int` `in-f[4]` `int`                                 | `void`            | -            |
| `glProgramStringARB`              | `(IIILjava/lang/String;)V`                                                                                                         | -        | `int` `int` `int` `string`                                  | `void`            | -            |
| `glPushAttrib`                    | `(I)V`                                                                                                                             | -        | `int`                                                       | `void`            | -            |
| `glPushMatrix`                    | `()V`                                                                                                                              | -        | -                                                           | `void`            | -            |
| `glRasterPos2i`                   | `(II)V`                                                                                                                            | -        | `int` `int`                                                 | `void`            | -            |
| `glReadBuffer`                    | `(I)V`                                                                                                                             | -        | `int`                                                       | `void`            | -            |
| `glRotatef`                       | `(FFFF)V`                                                                                                                          | -        | `float` `float` `float` `float`                             | `void`            | -            |
| `glScalef`                        | `(FFF)V`                                                                                                                           | -        | `float` `float` `float`                                     | `void`            | -            |
| `glScissor`                       | `(IIII)V`                                                                                                                          | -        | `int` `int` `int` `int`                                     | `void`            | -            |
| `glShadeModel`                    | `(I)V`                                                                                                                             | -        | `int`                                                       | `void`            | -            |
| `glTexCoord2f`                    | `(FF)V`                                                                                                                            | -        | `float` `float`                                             | `void`            | -            |
| `glTexCoordPointer`               | `(IIILjava/nio/Buffer;)V`                                                                                                          | -        | `int` `int` `int` `buf`                                     | `void`            | -            |
| `glTexCoordPointer`               | `(IIIJ)V`                                                                                                                          | -        | `int` `int` `int` `long`                                    | `void`            | -            |
| `glTexEnvf`                       | `(IIF)V`                                                                                                                           | -        | `int` `int` `float`                                         | `void`            | -            |
| `glTexEnvfv`                      | `(II[FI)V`                                                                                                                         | -        | `int` `int` `in-f[TEXENVFV($1)]` `int`                      | `void`            | -            |
| `glTexEnvi`                       | `(III)V`                                                                                                                           | -        | `int` `int` `int`                                           | `void`            | -            |
| `glTexGenfv`                      | `(II[FI)V`                                                                                                                         | -        | `int` `int` `in-f[TEXGENFV($1)]` `int`                      | `void`            | -            |
| `glTexGeni`                       | `(III)V`                                                                                                                           | -        | `int` `int` `int`                                           | `void`            | -            |
| `glTexImage1D`                    | `(IIIIIIILjava/nio/Buffer;)V`                                                                                                      | -        | `int` `int` `int` `int` `int` `int` `int` `buf`             | `void`            | -            |
| `glTexImage2D`                    | `(IIIIIIIILjava/nio/Buffer;)V`                                                                                                     | -        | `int` `int` `int` `int` `int` `int` `int` `int` `buf`       | `void`            | -            |
| `glTexImage3D`                    | `(IIIIIIIIILjava/nio/Buffer;)V`                                                                                                    | -        | `int` `int` `int` `int` `int` `int` `int` `int` `int` `buf` | `void`            | -            |
| `glTexParameteri`                 | `(III)V`                                                                                                                           | -        | `int` `int` `int`                                           | `void`            | -            |
| `glTranslatef`                    | `(FFF)V`                                                                                                                           | -        | `float` `float` `float`                                     | `void`            | -            |
| `glVertex2f`                      | `(FF)V`                                                                                                                            | -        | `float` `float`                                             | `void`            | -            |
| `glVertexPointer`                 | `(IIILjava/nio/Buffer;)V`                                                                                                          | -        | `int` `int` `int` `buf`                                     | `void`            | -            |
| `glVertexPointer`                 | `(IIIJ)V`                                                                                                                          | -        | `int` `int` `int` `long`                                    | `void`            | -            |
| `glViewport`                      | `(IIII)V`                                                                                                                          | -        | `int` `int` `int` `int`                                     | `void`            | -            |
| `isExtensionAvailable`            | `(Ljava/lang/String;)Z`                                                                                                            | -        | `string`                                                    | `bool`            | -            |
| `setSwapInterval`                 | `(I)V`                                                                                                                             | -        | `int`                                                       | `void`            | -            |
| `GLDrawableFactory.getGLDrawable` | `(Ljava/lang/Object;Ljavax/media/opengl/GLCapabilities;Ljavax/media/opengl/GLCapabilitiesChooser;)Ljavax/media/opengl/GLDrawable;` | `ref:F`  | `ref:O` `caps` `ref:O`                                      | `ref:D`           | -            |
| `GLDrawable.createContext`        | `(Ljavax/media/opengl/GLContext;)Ljavax/media/opengl/GLContext;`                                                                   | `ref:D`  | `ref:C`                                                     | `ref:C`           | -            |
| `GLDrawable.setRealized`          | `(Z)V`                                                                                                                             | `ref:D`  | `bool`                                                      | `void`            | -            |
| `GLDrawable.swapBuffers`          | `()V`                                                                                                                              | `ref:D`  | -                                                           | `void`            | `ends-frame` |
| `GLContext.makeCurrent`           | `()I`                                                                                                                              | `ref:C`  | -                                                           | `int`             | -            |
| `GLContext.release`               | `()V`                                                                                                                              | `ref:C`  | -                                                           | `void`            | -            |
| `GLContext.destroy`               | `()V`                                                                                                                              | `ref:C`  | -                                                           | `void`            | -            |
| `GLContext.getGL`                 | `()Ljavax/media/opengl/GL;`                                                                                                        | `ref:C`  | -                                                           | `ref:G`           | -            |

<!-- entry-table:end -->

## 13. Count tables

A pname that a table does not list counts 1. The names are given for reading only; the values are what the rules use.

<!-- count-tables:begin -->

| table          | pname                              | count |
| -------------- | ---------------------------------- | ----- |
| `LIGHTFV`      | 4608 (AMBIENT)                     | 4     |
| `LIGHTFV`      | 4609 (DIFFUSE)                     | 4     |
| `LIGHTFV`      | 4610 (SPECULAR)                    | 4     |
| `LIGHTFV`      | 4611 (POSITION)                    | 4     |
| `LIGHTFV`      | 4612 (SPOT_DIRECTION)              | 3     |
| `FOGFV`        | 2918 (FOG_COLOR)                   | 4     |
| `LIGHTMODELFV` | 2899 (LIGHT_MODEL_AMBIENT)         | 4     |
| `TEXENVFV`     | 8705 (TEXTURE_ENV_COLOR)           | 4     |
| `TEXGENFV`     | 9473 (OBJECT_PLANE)                | 4     |
| `TEXGENFV`     | 9474 (EYE_PLANE)                   | 4     |
| `POINTPARAMFV` | 33065 (POINT_DISTANCE_ATTENUATION) | 3     |
| `GETFV`        | 2899 (LIGHT_MODEL_AMBIENT)         | 4     |

<!-- count-tables:end -->

These tables cover every pname the jar and JOGL's GLU pass, using the decoded constants of `gl-state/calls.tsv`:

| Entry                    | Pnames passed                                                                                                                                                                                            |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| glLightfv                | POSITION, AMBIENT, DIFFUSE on LIGHT0, LIGHT1 and LIGHT4..7                                                                                                                                               |
| glFogfv                  | FOG_COLOR                                                                                                                                                                                                |
| glLightModelfv           | LIGHT_MODEL_AMBIENT                                                                                                                                                                                      |
| glTexEnvfv               | TEXTURE_ENV_COLOR                                                                                                                                                                                        |
| glTexGenfv               | OBJECT_PLANE and EYE_PLANE for S, T, R and Q                                                                                                                                                             |
| glPointParameterfvARB    | POINT_DISTANCE_ATTENUATION                                                                                                                                                                               |
| glGetFloatv              | LIGHT_MODEL_AMBIENT (float[]) and POINT_SIZE_MAX (FloatBuffer)                                                                                                                                           |
| glGetIntegerv            | scalar pnames only (DRAW_BUFFER, READ_BUFFER, MAX_TEXTURE_UNITS, MAX_TEXTURE_COORDS, MAX_TEXTURE_IMAGE_UNITS, PROGRAM_ERROR_POSITION_ARB, MAX_TEXTURE_SIZE, the 12 pixel-store pnames), hence `out-i[1]` |
| glGetTexLevelParameteriv | TEXTURE_WIDTH, hence `out-i[1]`                                                                                                                                                                          |

The remaining multi-valued entries in the tables (SPECULAR, SPOT_DIRECTION) are the other multi-valued pnames GL defines for those entries.

## 14. TS-only slip tokens

The TS port passes JS values where Java has typed parameters. When a value cannot be the Java type, RecordingGL writes a slip token `<form>:<text>` in place of the column. Java never produces a slip token, so any slip is a guaranteed divergence that points straight at a port bug. The diff tool reports slips explicitly.

Slip tokens are TS-only, so they are never part of the cross-language stream: Appendix A has none. Appendix C is the TS-only golden for the three most common slips: a fractional int, an inexact float and an out-of-range byte.

| Form                                 | Meaning                                                                                                               |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| `i?`                                 | an int parameter that is not an int32 (fraction, NaN, out of range, wrong type)                                       |
| `b?`                                 | a byte parameter outside -128..127 (a sign-extension slip)                                                            |
| `f?`                                 | a float parameter that is not a binary32 value (a missing `Math.fround`); the text is the 16 hex digits of the double |
| `d?`                                 | a double parameter that is not a number                                                                               |
| `z?`                                 | a boolean parameter that is not a boolean                                                                             |
| `o?`                                 | a long parameter that is not a bigint in the int64 range                                                              |
| `fv?`, `iv?`, `B?`, `S?`, `K?`, `R?` | an array, buffer, string, capabilities or reference argument of the wrong type                                        |

The slip text is printable ASCII with no spaces.

**Negative zero.** An int or byte parameter (including a name, an array offset or a count) holding -0 is not a slip: it is written as `0`. A Java int has no negative zero, and -0 behaves as 0 in every int operation the port uses, while the port rules do not require `| 0` after unary minus or `%`, so a correct port can pass -0 where Java passes 0. A -0 that reaches a float parameter is a real divergence and shows there as `f:80000000`.

## 15. Pseudo entries

- **`~gl TAB @G<n>`:** the GL receiver marker (§10).
- **`~mark TAB <label>`:** a checkpoint. The harness appends it at the same code position on both sides (TS `GlTraceWriter.mark(label)`; Java `GlRecorder.mark(label)`). The label matches `[A-Za-z0-9_.:-]+`. It is an ordered record, and §17 compares live objects at each mark.

## 16. Capability profile and responder

The trace compares the client, not the driver. On both sides the GL behind the recorder is a responder. In TS this is `NullGL` with `NullGLDrawableFactory`, `NullGLDrawable` and `NullGLContext`. In Java it is GlRecorder's responder. Both must behave as described in this section. The behaviour is parameterized by a capability profile (`src/gl/CapsProfile.ts`), which is exchanged as JSON (Appendix B):

```
{ "format": "rs530-caps-profile-v1", "name": <[A-Za-z0-9_.-]+>,
  "strings":  { "<decimal GL name>": <string> },              // 7936..7939 required
  "integers": { "<decimal pname>": [<int>, ...] },
  "floats":   { "<decimal pname>": ["<8 hex binary32 bits>", ...] },
  "missingEntryPoints": [<GL method name>, ...] }              // only the 16 names of item 3 below
```

Both sides of a comparison must use the same capability profile. The TypeScript responders take it as a required constructor argument. `capsProfileFromJson` and `capsProfileToJson` read and write the exchange format. Historical frame comparisons used a captured RTX 5070 profile. The Java recorder accepted a profile path through `-Dgltrace.caps`.

- The fallback profile in Appendix B is the reference profile for this specification.
- The Radeon profile described below also exercises the jar’s stream-VBO path.

**Profile answers and state answers.** Profile answers are static: they never reflect earlier calls (glPixelStorei, …). Four pnames are answered from the GL object's own state instead, and any profile entry for them is ignored:

| pname                            | Initial value                                                                     | Changed by                                                                            |
| -------------------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| DRAW_BUFFER 3073                 | BACK (1029) if the drawable's capabilities are double-buffered, else FRONT (1028) | `glDrawBuffer(mode)`                                                                  |
| READ_BUFFER 3074                 | as DRAW_BUFFER                                                                    | `glReadBuffer(mode)`                                                                  |
| LIGHT_MODEL_AMBIENT 2899         | (0.2f, 0.2f, 0.2f, 1.0f)                                                          | `glLightModelfv(2899, v, off)` with `0 <= off <= v.length - 4` copies `v[off..off+3]` |
| PROGRAM_ERROR_POSITION_ARB 34379 | -1                                                                                | nothing (every program string loads)                                                  |

These are the values the jar reads back: `tf.h()V` saves and restores the draw and read buffers, and `rd.a(I)V` loads the ambient that `mk` set into ARB local parameter 66. Each GL object (one per context) starts from the initial values; a GL made without a drawable is double-buffered. WebGpuGL answers everything from its state mirror.

| Call                                                     | Responder behaviour                                                                                                                                  |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `glGetString(name)`                                      | `strings[name]`, or null if not listed                                                                                                               |
| `isExtensionAvailable(name)`                             | see below                                                                                                                                            |
| `glGetIntegerv(pname, a, off)`                           | writes the state value above, or `integers[pname]`, to `a[off..]`; an unlisted pname writes nothing                                                  |
| `glGetFloatv(pname, a, off)`                             | writes the state value above, or the floats of `floats[pname]`, to `a[off..]`; an unlisted pname writes nothing                                      |
| `glGetFloatv(pname, FloatBuffer b)`                      | the same values, with absolute puts at `b.position() + i`; the position does not move. Both forms write the exact stored bits, NaN payloads included |
| `glGetTexLevelParameteriv(target, level, pname, a, off)` | writes one value: the proxy rule for TEXTURE_WIDTH (4096), TEXTURE_HEIGHT (4097) or TEXTURE_DEPTH (32881) on a proxy target, otherwise 0             |
| `glGetError()`                                           | NullGL only (not in the shipped interface): 0                                                                                                        |

`isExtensionAvailable(name)` answers as JOGL's `FunctionAvailabilityCache` does:

- `true` if `name` is a token of `strings[7939]`, as `FunctionAvailabilityCache.initAvailableExtensions` reads them: `new java.util.StringTokenizer(s)` with its default delimiters `" \t\n\r\f"` (space, tab, newline, carriage return, form feed; not U+000B), then `String.trim()` on each token (which strips every char up to U+0020 from both ends);
- `true` if `name` is one of the `GL_VERSION_<M>_<m>` names derived from `strings[7938]`, otherwise `false`.

The derivation of the `GL_VERSION_<M>_<m>` names:

1. Parse the version as `FunctionAvailabilityCache$Version` does. Major and minor are the first two `.`-separated tokens, read with `Integer.valueOf`. If the second space-separated token matches `\D*(\d+)\.(\d+)\.?(\d*).*`, it replaces them when its major is equal and its minor is greater, or when its major is one more.
2. Run:

    ```
    while (major > 0) {
        while (minor >= 0) { add GL_VERSION_<major>_<minor>; minor--; }
        if (major == 2) minor = 5;
        major--;
    }
    ```

    For `2.1.2 …` this gives 2_1, 2_0, 1_5, 1_4, 1_3, 1_2, 1_1 and 1_0.

**Proxy rule.** A `glTexImage1D/2D/3D` on a proxy target records an image for that (target, level) pair. The proxy targets are PROXY_TEXTURE_1D 32867, PROXY_TEXTURE_2D 32868, PROXY_TEXTURE_3D 32880 and PROXY_TEXTURE_CUBE_MAP 34075.

- The image is supported when all of these hold:
    - `border == 0`;
    - `level >= 0`;
    - every dimension the target has (1D: width; 2D and cube: width and height; 3D: all three) is `>= 0`, and `dimension * 2^level <= max`;
    - for a cube map, also `width == height`.

    `max` is `integers[34076]` for a cube map, `integers[32883]` for 3D, and `integers[3379]` otherwise; a missing entry falls back to `integers[3379]`.

- If the image is supported, the query reports width, height and depth. A dimension the target lacks reports 1.
- Otherwise it reports 0, 0, 0.
- A (target, level) pair with no recorded image reports 0.

JOGL's GLU (`Mipmap.closestFit`) relies on this rule.

**Names.** Each GL object counts textures, buffers, programs and lists separately, starting at 1.

- `glGenTextures`, `glGenBuffersARB` and `glGenProgramsARB` write the next `n` names to `a[off..off+n-1]`.
- `glGenLists(range)` returns the next name and advances the count by `range`. A `range` of 0 or less returns 0.
- Names are never reused, and `glDelete*` frees nothing.

**JOGL argument checks.** These are the Java-side checks of the shipped `com.sun.opengl.impl.GLImpl` that do not involve a Buffer argument, applied in GLImpl's order:

1. For `glGen*` and `glDelete*` arrays: `BufferFactory.rangeCheck(array, offset, n)`. When `array != null && array.length < offset + n`, it throws `ArrayIndexOutOfBoundsException("Required <n> elements in array, only had <length - offset>")` (a RangeError in TS).
2. For every array overload: when `array != null && array.length <= offset`, it throws `GLException("array offset argument \"<param>_offset\" (<offset>) equals or exceeds array length (<length>)")`. `<param>` is the JOGL parameter name: `v`, `ids`, `textures`, `params` or `m`.
3. `missingEntryPoints` may list only the 16 methods below, which are the only ones the shipped GLImpl calls through a looked-up proc address (it has exactly these 16 `Method "…" not available` strings). Every other method is a direct native call and is never unavailable, and a profile that lists one is invalid (`validateCapsProfile` rejects it). A listed method throws `GLException("Method \"<name>\" not available")`. This check comes after the array checks for array overloads, and first for the others:
    - glActiveTexture, glClientActiveTexture and glMultiTexCoord2f (these also try their ARB aliases; listing the core name means both are missing);
    - glBindBufferARB, glBufferDataARB, glBufferSubDataARB, glGenBuffersARB and glDeleteBuffersARB;
    - glBindProgramARB, glGenProgramsARB, glProgramStringARB, glProgramLocalParameter4fARB and glProgramLocalParameter4fvARB;
    - glPointParameterfARB and glPointParameterfvARB;
    - glTexImage3D.

GLImpl's Buffer-argument checks are not part of the responder contract. In the shipped build they are: a direct buffer for `gl*Pointer`, `BufferFactory.rangeCheck`/`rangeCheckBytes` against `imageSizeInBytes`, and `checkBufferObject`, which tests only `inBeginEndPair` and the VBO/PBO extension flags, never the bound buffer.

**Everything else** has no effect and returns nothing, apart from the state changes listed above.

**Context API:**

- **Factory:** `getGLDrawable(null, …)` throws IllegalArgumentException("Null target"). Otherwise it returns a new, unrealized drawable holding a clone of the capabilities, or `new GLCapabilities()` for null.
- **Drawable:** `createContext` returns a new context with its own GL, double-buffered as the drawable's capabilities say. `setRealized` records the flag. `swapBuffers` does nothing.
- **`makeCurrent()`:**
    1. If the context is already current, it returns 1.
    2. Otherwise it releases the current context (internally, §10).
    3. It returns 0 if the drawable is unrealized or the context was destroyed.
    4. Otherwise it returns 2 the first time and 1 afterwards, and the context becomes current.
- **`release()`:** clears the current context.
- **`destroy()`:** marks the context destroyed.
- **`getGL()`:** always returns the same GL.

**Fallback profile** (`FALLBACK_CAPS_PROFILE`, Appendix B). The following results were observed with `tf.m()I` in runescape_gl.jar.

- It returns 0.
- It sets `tf.B = 21` and `tf.e = 4`, which is at least 3, so vm and wg take their three-unit paths.
- It sets `tf.C`, `tf.y`, `tf.K`, `tf.H` and `tf.r` all to true.
- It leaves `tf.G` false, because the renderer does not contain "radeon".

`ga.a()V` clamps POINT_SIZE_MAX (2047.0) to 1024, and GLU takes its proxy path because the version starts with "2.1".

**Radeon profile** (`RADEON_CAPS_PROFILE`, name `fallback-gl21-radeon`). It equals the fallback profile except for RENDERER `RS530 Virtual Radeon`. `tf.m()I` sets `tf.G = tf.C` only when the lowercased renderer contains "radeon". It clears `tf.C` for a 7000-7999 model number and `tf.r` for 7000-9250, reading the model from the first space-separated token (after `/` becomes a space) whose first four chars are decimal. This renderer has no model number, so the real `tf.m()I` returns 0 with the same statics as the fallback and `tf.G` true. The jar reads `tf.G` only at td pc1955, where it builds `new vi(true)` (`glBufferDataARB` with GL_STREAM_DRAW 35040) and later updates it with `vi.a`, the jar's only `glBufferSubDataARB`. Neither the fallback nor the captured RTX 5070 profile (NVIDIA) sets `tf.G`, so comparisons that exercise that path use the Radeon profile.

## 17. Comparison

The Java recording normally supplies the expected trace.

1. **Ordered records:** the ordered records (every record except deletion records) are compared in order as record lines. The `#@` stack lines and the `#!` meta lines are ignored. The first record that differs, or the first record present on only one side, is the divergence. The report shows it with 20 records of context before it and up to 20 records after it on each side, including stack lines.
2. **Deletion records** are compared separately in their recorded order when deletion comparison is requested.
3. **Live objects:** when the ordered records are equal, the live names of each kind are compared at every `~mark` and at the end of the trace.
    - Live names are those allocated (§9) and not deleted by a deletion record that returned normally.
    - `glDeleteLists(#Lk, r)` deletes `#Lk .. #L(k+r-1)`. This is exact for ranges deleted as they were allocated, which is how the jar deletes them (fa.c, range 1).

The reference comparator used exit status 0 for equal traces, 1 for a difference, and 2 for a usage or parse error.

## 18. Notes for the Java recorder

- **GL:**
    - Use one `java.lang.reflect.Proxy` with an `InvocationHandler`.
    - The entry is `method.getName()`. Overloads are told apart by building the JVM descriptor from `method.getParameterTypes()` and `getReturnType()`, and the rule is looked up by name and descriptor.
    - The receiver identity for `~gl` is the proxy object.
    - Boxed `Float` and `Double` arguments are serialized through `floatToRawIntBits` and `doubleToRawLongBits`.
- **Context objects:**
    - `GLDrawable` is an interface, so a Proxy works.
    - `GLDrawableFactory` and `GLContext` are abstract classes: subclass them.
    - Install the factory by setting the static field `javax.media.opengl.GLDrawableFactory.factory` with reflection.
    - Call `GLContext.setCurrent` (protected static) from the GLContext subclass, so that GLU's `getCurrentGL()` returns the recording proxy.
- **Not recordable from Java:** `GLDrawableFactory.getFactory`, `GLContext.getCurrent`, `GLCapabilities` and `GLU` are statics or concrete classes that a Java recorder cannot intercept without instrumentation, so neither side records them (§11).
- **Serialization order:** for a GL-method call, first decide and append the `~gl` marker (§10). Then serialize the input columns before invoking the responder, and the output columns and the return value after it, then append the record. On a throw, append with `!> <kind>`, then rethrow.

## 19. Known limitations

The original HD material comparison allowed one 8-bit channel step for hardware-filtered samples. Eleven 128×128 frames yielded two differing pixels on the tested native OpenGL and Dawn devices. At (102,48), underwater material 3 with depth 96 produced RGBA (39,77,111,255) on OpenGL and (39,77,112,255) on Dawn. At (68,101), material 4 produced (52,96,143,255) and (52,95,142,255). Geometry coverage and alpha matched throughout. Nearest filtering of the noise volume made both diagnostic frames byte-exact. Restoring the game's linear filter reproduced the two differences. The normal renderer uses the original filter.

- **Scalar float NaN payloads:** a TS number cannot carry a NaN payload (JavaScriptCore canonicalizes every NaN), so RecordingGL writes `f:7fc00000` for any NaN scalar. Java writes the raw bits. Arrays and buffers that the caller fills keep payloads on both sides, and so do the arrays and FloatBuffers that `glGetFloatv` fills (§16).
- **Computed float pixels:** pixel data that the port computes with float arithmetic loses NaN payloads. The GL_FLOAT levels that GLU's `HalveImage` and `ScaleInternal` compute for `gluBuild2DMipmaps` hold the canonical `7fc00000` for every NaN result, where jogl.jar on HotSpot keeps a NaN operand's sign and (quieted) payload; levels passed through unchanged keep their bits, and every non-NaN value is exact. The jar never reaches this: it builds GL_RGBA/GL_UNSIGNED_BYTE mipmaps only.
- **Client-memory pointer data** (gl\*Pointer and glInterleavedArrays with a Buffer) is hashed when the pointer is set, not at draw time.
- **Static queries:** apart from the four state pnames, query answers are static (§16).
- **Live-set check:** it assumes that a `glDeleteLists` range covers names allocated together (§17).

## Appendix A. Golden trace

`GlTraceWriter` recorded the reference calls over `NullGLDrawableFactory(FALLBACK_CAPS_PROFILE)` with the meta entry `profile=fallback-gl21`. Tab characters separate the columns.

Every record is one a Java client produces, and there are no slip tokens (§14; the TS-only slips are in Appendix C). A Java recorder that drives the same calls over the same profile and writes the same meta line must print exactly this text.

<!-- golden:begin -->

```
#GLTrace v1
#! profile=fallback-gl21
0.0	GLDrawableFactory.getGLDrawable	@F1	@O1	K:T:F:T:24:0:8:8:8:0:0:0:0:0:T:4	null	=> @D1
0.1	GLDrawable.setRealized	@D1	T
0.2	GLDrawable.createContext	@D1	null	=> @C1
0.3	GLContext.makeCurrent	@C1	=> 2
0.4	GLContext.getGL	@C1	=> @G1
0.5	~gl	@G1
0.6	glGetString	7936	=> S:16:96252b5f59c1b5735cfdcd4bb9cd8072fef195437d58d73ee221b04d6b9ce504:RS530%20Virtual%20GL
0.7	isExtensionAvailable	S:21:262ee598e253f387e868b4d4e3cbca6646218ea6266016db2a220b4c43fc7239:GL_ARB_vertex_program	=> T
0.8	isExtensionAvailable	S:11:bce9222b9a4ca8e1cb64663fd41e21d7cf99468115cf0da785a455eac3dd7a93:GL_NV_fence	=> F
0.9	glGetIntegerv	34018	iv:4	1
0.10	setSwapInterval	0
0.11	glGenTextures	2	iv:#T1,#T2	1
0.12	glGenBuffersARB	1	iv:#B1	0
0.13	glGenProgramsARB	1	iv:#P1	0
0.14	glGenLists	2	=> #L1
0.15	glNewList	#L2	4864
0.16	glBegin	6
0.17	glColor4ub	-128	1	2	127
0.18	glTexCoord2f	f:3f000000	f:3f800000
0.19	glVertex2f	f:bfc00000	f:40000000
0.20	glEnd
0.21	glEndList
0.22	glCallList	#L2
0.23	glActiveTexture	33985
0.24	glBindTexture	3553	#T2
0.25	glBindTexture	3553	0
0.26	glBindTexture	3553	#T?999
0.27	glBindBufferARB	34962	#B1
0.28	glBindProgramARB	34336	#P1
0.29	glEnable	2929
0.30	glDisable	3042
0.31	glAlphaFunc	516	f:00000000
0.32	glBlendFunc	770	771
0.33	glClearColor	f:3e800000	f:3f000000	f:3f800000	f:00000000
0.34	glClear	16640
0.35	glClearDepth	d:3ff0000000000000
0.36	glClientActiveTexture	33984
0.37	glColor3ub	-1	0	127
0.38	glColor4f	f:3f800000	f:00000000	f:80000000	f:3f000000
0.39	glColor4fv	fv:00000000,7fa00001,3f400000,00000000	1
0.40	glColorMaterial	1032	5634
0.41	glColorPointer	4	5121	16	B:byte:12:16:16:direct:6eee4b5dba52fa92c4570ba19a5d58ee85f631156e9af160cfd42dc0b6051840:ccddeeff
0.42	glColorPointer	4	5121	16	o:12
0.43	glCopyPixels	0	0	765	503	6144
0.44	glCullFace	1029
0.45	glDepthFunc	515
0.46	glDepthMask	F
0.47	glDisableClientState	32886
0.48	glEnableClientState	32884
0.49	glDrawBuffer	1026
0.50	glReadBuffer	1024
0.51	glDrawElements	4	3	5125	B:int:0:3:3:direct:ad5dc1478de06a4c2728ea528bd9361a4b945e92a414bf4d180cedaaeaa5f4cc:000000000100000002000000
0.52	glDrawElements	4	6	5125	o:36
0.53	glDrawPixels	2	1	32993	5121	B:int:0:2:2:heap:494e7c35ae9b34738ceb48059967ee65e1803480d9be3ce2a5ef61d362dec580:44332211ffffffff
0.54	glFogfv	2918	fv:3f000000,3e800000,3e000000,3f800000	0
0.55	glFogfv	2915	fv:453b8000	4
0.56	glFogf	2916	f:45600000
0.57	glFogi	2917	9729
0.58	glGetFloatv	2899	fv:3e4ccccd,3e4ccccd,3e4ccccd,3f800000	1
0.59	glGetFloatv	33063	B:float:0:1:1:heap:d111203b79d6d465d03e7fa80a6b8ce507911662a90397d0b0df3dedb2548355:00e0ff44
0.60	glTexImage2D	32868	1	4	64	32	0	6408	5121	null
0.61	glGetTexLevelParameteriv	32868	1	4096	iv:64	0
0.62	glHint	3156	4353
0.63	glInterleavedArrays	10791	20	B:float:0:10:10:direct:5b991c0ea9aa330371d4a10dc8850cceb70029b1b5570bf5a49947dc52332431:0000803f0000000000000000000000000000000000000000000000000000000000000000000000c0
0.64	glInterleavedArrays	10787	16	o:0
0.65	glLightModelfv	2899	fv:3e4ccccd,3e99999a,3ecccccd,3f800000	0
0.66	glLightf	16388	4617	f:3a83126f
0.67	glLightfv	16384	4611	fv:00000000,3f800000,00000000,00000000	0
0.68	glLightfv	16385	4615	fv:3f000000	4
0.69	glMatrixMode	5889
0.70	glLoadIdentity
0.71	glLoadMatrixf	fv:3f800000,00000000,00000000,00000000,00000000,3f800000,00000000,00000000,00000000,00000000,3f800000,00000000,00000000,00000000,00000000,3f800000	0
0.72	glMultiTexCoord2f	33985	f:3e800000	f:3f400000
0.73	glNormalPointer	5126	12	B:float:0:100:100:heap:e5f245ccae8b552c9e34190f9fe811941021d740df1820df6f8e31d8670f50ed
0.74	glNormalPointer	5126	40	o:16
0.75	glOrtho	d:0000000000000000	d:4087e80000000000	d:0000000000000000	d:407f700000000000	d:bff0000000000000	d:3ff0000000000000
0.76	glPixelStorei	3317	1
0.77	glPixelZoom	f:3f800000	f:bf800000
0.78	glPointParameterfARB	33062	f:3f800000
0.79	glPointParameterfvARB	33065	fv:3f800000,00000000,3a03126f	0
0.80	glPolygonMode	1032	6914
0.81	glPushAttrib	8192
0.82	glPopAttrib
0.83	glPushMatrix
0.84	glPopMatrix
0.85	glProgramLocalParameter4fARB	34336	65	f:3ba3d70a	f:00000000	f:00000000	f:3f800000
0.86	glProgramLocalParameter4fvARB	34336	1	B:float:4:12:12:direct:52f23bf36fec01e27456eb93154a523c736b7ae84add2a6ed5d31d48d68606bb:000090400000b0400000d0400000f040
0.87	glProgramLocalParameter4fvARB	34336	66	fv:3e4ccccd,3e99999a,3ecccccd,3f800000	0
0.88	glProgramStringARB	34336	34933	300	S:280:b2d5f3b1a5fe879ceec5586c029bcad75c32d5cda521ea3d265f96b356ba5d76
0.89	glRasterPos2i	0	0
0.90	glRotatef	f:43340000	f:3f800000	f:00000000	f:00000000
0.91	glScalef	f:3f800000	f:bf800000	f:3f800000
0.92	glScissor	0	0	0	0
0.93	glShadeModel	7425
0.94	glTexCoordPointer	2	5126	8	B:float:0:2:2:direct:efde6f1eea3d119bf25d4a0e2ce188572e80986e14d85c3f2a9528fa66f8731f:3f800000c0000000
0.95	glTexCoordPointer	2	5126	36	o:28
0.96	glTexEnvf	8960	34163	f:40000000
0.97	glTexEnvfv	8960	8705	fv:3e4ccccd,3e99999a,3ecccccd,3f800000	0
0.98	glTexEnvi	8960	8704	34160
0.99	glTexGenfv	8192	9474	fv:3e4ccccd,3e99999a,3ecccccd,3f800000	0
0.100	glTexGenfv	8193	9473	fv:00000000,00000000,!2	0
0.101	glTexGeni	8194	9472	34065
0.102	glTexImage1D	3552	0	6408	2	0	6408	5121	B:byte:0:8:8:heap:51b92f3acb24be164d60b77e1b0e0c3fae5e8b134a1ab6ac62de8585336cdb0b:01020304fffefdfc
0.103	glTexImage3D	32879	0	6410	1	1	0	0	6410	5121	B:byte:4:4:4:heap:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855:
0.104	glTexParameteri	3553	10241	9729
0.105	glTranslatef	f:3fc00000	f:c0200000	f:00000000
0.106	glVertexPointer	2	5122	4	B:short:0:4:4:heap:5682c88515f22e29f16b229201683e671b1b6766da43336a66d374dbae7b563c:0100ffffff7f0080
0.107	glVertexPointer	3	5126	36	o:0
0.108	glViewport	0	0	765	503
0.109	glBufferDataARB	34962	16	B:byte:0:16:16:direct:a8faed6abbf35c12a4b26e40f6feb19d736d90045c83b9f9a31f638d323e6811:00112233445566778899aabbccddeeff	35044
0.110	glBufferSubDataARB	34962	4	8	B:int:1:3:5:heap:0c40fc912bea3d01b4dbad07de4c8cf177ac0c424bc11d622d2239c0e5988986:0200000003000000
0.d0	glDeleteTextures	1	iv:#T1	1
0.d1	glDeleteLists	#L1	2
0.d2	glDeleteBuffersARB	1	iv:#B1	0
0.111	GLDrawable.swapBuffers	@D1
1.0	glClear	16384
1.1	glGenTextures	0	iv:	2	!> GLException
1.2	~mark	teardown
1.3	GLContext.release	@C1
1.4	GLContext.destroy	@C1
1.5	GLDrawable.setRealized	@D1	F
```

<!-- golden:end -->

## Appendix B. Fallback profile JSON

<!-- profile:begin -->

```text
{
  "format": "rs530-caps-profile-v1",
  "name": "fallback-gl21",
  "strings": {
    "7936": "RS530 Virtual GL",
    "7937": "RS530 NullGL fallback profile",
    "7938": "2.1.2 RS530 Virtual GL",
    "7939": "GL_ARB_multitexture GL_ARB_texture_env_combine GL_ARB_vertex_buffer_object GL_ARB_multisample GL_ARB_texture_cube_map GL_ARB_vertex_program GL_EXT_texture3D GL_ARB_point_parameters GL_ARB_point_sprite"
  },
  "integers": {
    "3312": [0],
    "3313": [0],
    "3314": [0],
    "3315": [0],
    "3316": [0],
    "3317": [4],
    "3328": [0],
    "3329": [0],
    "3330": [0],
    "3331": [0],
    "3332": [0],
    "3333": [4],
    "3379": [8192],
    "34018": [4],
    "34929": [8],
    "34930": [16]
  },
  "floats": {
    "33063": ["44ffe000"]
  },
  "missingEntryPoints": []
}
```

<!-- profile:end -->

## Appendix C. TS-only slip trace

Java’s typed method parameters cannot hold the values in these calls. `GlTraceWriter` recorded this TypeScript trace over `NullGLDrawableFactory(FALLBACK_CAPS_PROFILE)` with the meta entries `source=ts` and `profile=fallback-gl21`.

It pins the three most common slips (§14), each recorded right after the correct call it stands in for, so that the slip column is the only difference between the two records:

- `0.7`: a fractional int, `glEnable(1.5)`, where the port is missing a `| 0`;
- `0.9`: an inexact float, `glColor4f(0.1, …)`, where the port is missing a `Math.fround`;
- `0.11`: an out-of-range byte, `glColor3ub(255, …)`, where the port is missing a sign extension.

<!-- slips:begin -->

```
#GLTrace v1
#! source=ts
#! profile=fallback-gl21
0.0	GLDrawableFactory.getGLDrawable	@F1	@O1	K:T:F:T:24:0:8:8:8:0:0:0:0:0:F:2	null	=> @D1
0.1	GLDrawable.setRealized	@D1	T
0.2	GLDrawable.createContext	@D1	null	=> @C1
0.3	GLContext.makeCurrent	@C1	=> 2
0.4	GLContext.getGL	@C1	=> @G1
0.5	~gl	@G1
0.6	glEnable	1
0.7	glEnable	i?:1.5
0.8	glColor4f	f:3dcccccd	f:00000000	f:00000000	f:3f800000
0.9	glColor4f	f?:3fb999999999999a	f:00000000	f:00000000	f:3f800000
0.10	glColor3ub	-1	0	0
0.11	glColor3ub	b?:255	0	0
0.12	GLContext.release	@C1
0.13	GLContext.destroy	@C1
0.14	GLDrawable.setRealized	@D1	F
```

<!-- slips:end -->
