import { isJavaRuntimeException } from '#/util/JavaException';
import { releaseReferences } from '#/util/StaticReferences';
import WrappedException from '#/util/WrappedException';
import type GlBuffer from '#/gl/GlBuffer';
import type ByteBuffer from '#/util/nio/ByteBuffer';
import { loadClient, loadLocalisedText, loadMinimenu } from '#/util/GamepackClasses';

// HD ql. A vertex or index stream in td.
export default class GlModelStream {
    // HD ql.a(I)V
    static releaseHdStatics(guard: number): void {
        try {
            const LocalisedText = loadLocalisedText();
            releaseReferences(LocalisedText, 'germanChateffect5');
            const Client = loadClient();
            releaseReferences(Client, 'wm2Command');
            const Minimenu = loadMinimenu();
            releaseReferences(Minimenu, 'hidden');
            if (guard !== -17148) {
                Client.stockTransmitCycle = 54;
            }
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'ql.C(' + guard + ')');
        }
    }

    offset = 0; // ql.a
    valid = false; // ql.b
    vbo: GlBuffer | null = null; // ql.e
    buffer: ByteBuffer | null = null; // ql.f
    stride = 0; // ql.m
}
