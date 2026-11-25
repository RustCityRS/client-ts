import { isJavaRuntimeException } from '#/util/JavaException';
import { releaseReferences } from '#/util/StaticReferences';
import WrappedException from '#/util/WrappedException';
import { glJar } from '#/client/ClientVariant';
import type ModelSource from './ModelSource';
import type Pix8 from '#/graphics/Pix8';
import { loadClient, loadLocalisedText, loadNpcType, loadRoofModeStatics, loadVarpType, loadWorld } from '#/util/GamepackClasses';

// wj in the revision 530 SD gamepack: the result holder the two LocType model getters return (LocType.GetModel,
// jb.a([[IIIIZB[[ILch;IIZ)Lwj;, and LocType.GetTempModel, jb.a(IIIIII[[IIZIBLch;[[ILek;)Lwj;). Both getters write the
// chosen ModelSource (a lit ModelLitImpl, a raw ModelUnlit kept for normal sharing, or null) into the one shared
// instance LocType.modelResult (g.j) and return it, so a caller must read model before the next getter call.
// NXT has no holder class: LocType::GetModel/GetTempModel return the shared_ptr<ModelSource> directly.
//
// The obfuscator left the instance side clean (one field, the default constructor). wj's seven statics and two static
// methods are unrelated residue placed elsewhere by the member map (the ::gc/::fpsoff/::tween command strings, the
// combat colour tag and the p12 font on Client, the loading-bar font on GameShell, the instanced terrain builder on
// ClientBuild, the wj.b invocation counter, and the wj.a(B)V unload artifact).
export default class LocEntity {
    // HD sm.a(B)V
    static releaseHdStatics(guard: number): void {
        try {
            const NpcType = loadNpcType();
            releaseReferences(NpcType, 'clientPalette');
            const VarpType = loadVarpType();
            releaseReferences(VarpType, 'm_recentUse');
            const Client = loadClient();
            releaseReferences(Client, 'dnsRequest');
            if (guard > -33) {
                const RoofModeStatics = loadRoofModeStatics();
                RoofModeStatics.allocRoofBounds(-10, 68);
            }
            const LocalisedText = loadLocalisedText();
            releaseReferences(LocalisedText, 'conlost');
            const world = loadWorld();
            releaseReferences(world, 'tileCameraClearance');
            releaseReferences(LocalisedText, 'englishConlost');
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'sm.A(' + guard + ')');
        }
    }

    // wj.e:Lug;
    model: ModelSource | null = null;

    // HD sm.a:Lek;. The terrain shadow sprite, cached with a static hardware model.
    declare shadow: Pix8 | null;

    // wj.<init>()V
    constructor() {
        if (glJar) this.shadow = null;
    }
}
