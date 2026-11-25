#include "zlib.h"

/* Inflater(true) keeps one inflate_state and, when needed, a 32 KiB window. */
static union {
    unsigned long long alignment;
    unsigned char bytes[48 * 1024];
} arena;
static unsigned used;
static z_stream stream;
extern unsigned char __heap_base;

static voidpf alloc_state(voidpf opaque, unsigned items, unsigned size) {
    (void)opaque;
    unsigned at = (used + 7u) & ~7u;
    if (size != 0 && items > (sizeof arena.bytes - at) / size) return Z_NULL;
    used = at + items * size;
    return arena.bytes + at;
}

static void free_state(voidpf opaque, voidpf address) {
    (void)opaque;
    (void)address;
}

int init(void) {
    stream.zalloc = alloc_state;
    stream.zfree = free_state;
    return inflateInit2(&stream, -MAX_WBITS);
}

unsigned char *staging(void) {
    return &__heap_base;
}

int inflate_raw(const unsigned char *src, unsigned src_len, unsigned char *dst, unsigned dst_len) {
    stream.next_in = src;
    stream.avail_in = src_len;
    stream.next_out = dst;
    stream.avail_out = dst_len;
    return inflate(&stream, Z_PARTIAL_FLUSH);
}

unsigned written(void) {
    return stream.total_out;
}

void reset(void) {
    inflateReset(&stream);
}
