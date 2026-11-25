import { isJavaRuntimeException } from '#/util/JavaException';
import { releaseReferences } from '#/util/StaticReferences';
import WrappedException from '#/util/WrappedException';
import type Js5Index from './Js5Index';
import { loadClient, loadMaterialManager, loadMinimenu, loadWorld } from '#/util/GamepackClasses';

export default abstract class Js5ResourceProvider {
    // HD v.a(I)V
    static releaseJs5ResourceProviderStatics(guard: number): void {
        try {
            const Client = loadClient();
            releaseReferences(Client, 'js5MasterIndex', 'urlAffidPart');
            const MaterialManager = loadMaterialManager();
            releaseReferences(MaterialManager, 'underwaterColour');
            releaseReferences(Client, 'clientDropCommand');
            const Minimenu = loadMinimenu();
            releaseReferences(Minimenu, 'highlightComponent');
            if (guard !== 1) {
                const world = loadWorld();
                world.hasTypecode(-83, 44, -77, 121n);
            }
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'v.R(' + guard + ')');
        }
    }

    // ud.<init>()V
    constructor() {}

    // ud.a(II)[B
    abstract group(mode: number, group: number): Uint8Array | null;

    // ud.b(II)V
    abstract prefetchGroup(group: number): void;

    // ud.b(I)Ldb;
    abstract index(): Js5Index | null;

    // ud.c(II)I
    abstract GetGroupLoadPercentage(group: number): number;
}
