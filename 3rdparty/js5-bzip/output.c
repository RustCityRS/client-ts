/* Access the upstream non-randomised RLE/BWT routine in its own translation unit.
 * The gamepack omits stream CRCs. Its bit reader, Huffman tables, MTF and Java
 * block array remain owned by rd / oc, including every untouched table tail. */
#include "bzlib_private.h"
#undef BZ_UPDATE_CRC
#define BZ_UPDATE_CRC(crc,ch) ((void)0)
/* The scratch copy contains the decoded prefix. A damaged chain can legally
 * reach an older Java table tail. Retry that case on the original table. */
static UInt32 readable;
#undef BZ_GET_FAST_C
#define BZ_GET_FAST_C(ch) do {                \
    if (c_tPos >= readable) return True;      \
    c_tPos = c_tt[c_tPos];                    \
    ch = (UChar)(c_tPos & 0xff);              \
    c_tPos >>= 8;                             \
} while (0)
#include "bzlib.c"

static unsigned words[6];
extern unsigned char __heap_base;
unsigned char *staging(void) { return &__heap_base; }
unsigned *output_state(void) { return words; }

int write_output(UInt32 *table, char *out, unsigned space, int previous, int repeat,
                 int used, int first, unsigned position, int block_length) {
    static DState s;
    static bz_stream stream;
    s.blockRandomised = False;
    s.blockSize100k = 1;
    readable = (unsigned)block_length;
    s.tt = table;
    s.tPos = position;
    s.k0 = (UChar)first;
    s.nblock_used = used;
    s.save_nblock = block_length;
    s.state_out_len = repeat;
    s.state_out_ch = (UChar)previous;
    s.strm = &stream;
    stream.next_out = out;
    stream.avail_out = space;
    if (unRLE_obuf_to_output_FAST(&s)) return 0;
    /* Java's signed right shift would retain the sign of a damaged table word. */
    if (s.tPos > 0x7fffffU) return 0;
    words[0] = s.state_out_ch;
    words[1] = s.state_out_len;
    words[2] = s.nblock_used;
    words[3] = s.k0;
    words[4] = s.tPos;
    words[5] = space - stream.avail_out;
    return 1;
}
