import type JagString from '#/datastruct/JagString';

interface QuickChatCommandDecoder {
    // tc.a(BJI[I)Lid;
    decodeValue(value: bigint, command: number, params: Int32Array): JagString | null;
}

export type { QuickChatCommandDecoder as default };
