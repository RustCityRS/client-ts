import { intDivide, intRemainder } from '#/util/IntUtils';
import { isJavaRuntimeException } from '#/util/JavaException';
import { releaseReferences } from '#/util/StaticReferences';
import WrappedException from '#/util/WrappedException';
import type Js5 from '#/cache/Js5';
import { glJar } from '#/client/ClientVariant';
import LRUHashCache from '#/datastruct/LRUHashCache';
import PacketT from '#/io/PacketT';
import { requireNonNull } from '#/util/JavaArray';
import { loadClient, loadLocalisedText, loadLocType } from '#/util/GamepackClasses';

export default class FluType {
    // HD ni.a(B)V
    static releaseHdStatics(guard: number): void {
        try {
            const LocalisedText = loadLocalisedText();
            releaseReferences(LocalisedText, 'englishLoadedInputHandler', 'loadedInputHandler');
            intRemainder(86, intDivide((49 - guard) | 0, 48));
            const Client = loadClient();
            releaseReferences(Client, 'objConfigArchive');
            const LocType = loadLocType();
            releaseReferences(LocType, 'modelResult');
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'ni.A(' + guard + ')');
        }
    }

    // SD aj.ec:Lal;, HD oj.x:Lve;
    static m_pConfigClient: Js5 | null = null;
    // SD vj.h:Lve;, HD gj.p:Ln;
    static readonly m_list = new LRUHashCache<FluType>(64);

    // SD qg.a(Lal;I)V, HD hc.a(Lve;I)V
    static Init(archive: Js5 | null): void {
        FluType.m_pConfigClient = archive;
    }

    // SD ij.a(BI)Lrj;, HD qc.a(ZI)Lni;
    static List(id: number): FluType {
        let type = FluType.m_list.Find(BigInt(id));
        if (type !== null) {
            if (!(type instanceof FluType)) throw new TypeError('ClassCastException: not a FluType');
            return type;
        }
        const bytes = requireNonNull(FluType.m_pConfigClient).GetFile(id, 1);
        type = new FluType();
        if (bytes !== null) type.Decode(new PacketT(bytes), id);
        FluType.m_list.Put(BigInt(id), type);
        return type;
    }

    // SD hd.a(Z)V, HD sd.f(B)V
    static removeSoft(): void {
        FluType.m_list.removeSoft();
    }
    // SD cl.a(IZ)V, HD fk.b(IB)V
    static clean(age: number): void {
        FluType.m_list.Clean(age);
    }
    // SD lf.c(I)V, HD ed.c(I)V
    static clear(): void {
        FluType.m_list.Reset();
    }

    // SD rj.d:I, HD ni.d:I
    saturation = 0;
    // SD rj.e:I, HD ni.i:I
    weightedHue = 0;
    // SD rj.m:I, HD ni.u:I
    chroma = 0;
    // SD rj.o:I, HD ni.r:I
    lightness = 0;
    // SD rj.q:I, HD ni.m:I
    m_materialID: number;
    // SD rj.r:I, HD ni.b:I
    private rgb: number;
    // HD ni.o:I and ni.l:Z. NXT FloorUnderlayType calls the shadow flag field_68.
    declare m_textureScale: number;
    declare field_68: boolean;

    // SD rj.<init>()V, HD ni.<init>()V
    constructor() {
        this.rgb = 0;
        this.m_materialID = -1;
        if (glJar) {
            this.m_textureScale = 128;
            this.field_68 = true;
        }
    }

    // SD rj.a(IB)V, HD ni.a(IB)V
    private GetHsl(rgb: number): void {
        if (glJar) {
            const red = ((rgb >> 16) & 255) / 256;
            const green = ((rgb >> 8) & 255) / 256;
            let min = red;
            const blue = (rgb & 255) / 256;
            if (green < min) min = green;
            if (blue < min) min = blue;
            let max = red;
            let hue = 0;
            if (green > max) max = green;
            if (blue > max) max = blue;
            let sat = 0;
            const light = (max + min) / 2;
            if (min !== max) {
                if (light < 0.5) sat = (max - min) / (max + min);
                if (max === red) hue = (-blue + green) / (-min + max);
                else if (green === max) hue = (blue - red) / (max - min) + 2;
                else if (blue === max) hue = 4 + (-green + red) / (-min + max);
                if (light >= 0.5) sat = (max - min) / (-min + (2 - max));
            }
            this.chroma = (light > 0.5 ? sat * (-light + 1) * 512 : sat * light * 512) | 0;
            if (this.chroma < 1) this.chroma = 1;
            this.saturation = (sat * 256) | 0;
            this.lightness = (256 * light) | 0;
            if (this.lightness < 0) this.lightness = 0;
            else if (this.lightness > 255) this.lightness = 255;
            this.weightedHue = (this.chroma * (hue / 6)) | 0;
            if (this.saturation < 0) this.saturation = 0;
            else if (this.saturation > 255) this.saturation = 255;
            return;
        }
        const red = ((rgb >> 16) & 255) / 256;
        const green = ((rgb & 65357) >> 8) / 256;
        const blue = (rgb & 255) / 256;
        let max = red;
        let min = red;
        if (green > red) max = green;
        if (red > green) min = green;
        let hue = 0;
        if (max < blue) max = blue;
        let sat = 0;
        if (min > blue) min = blue;
        const light = (max + min) / 2;
        this.lightness = (256 * light) | 0;
        if (this.lightness < 0) this.lightness = 0;
        else if (this.lightness > 255) this.lightness = 255;
        if (max !== min) {
            if (light < 0.5) sat = (-min + max) / (min + max);
            if (max === red) hue = (green - blue) / (max - min);
            else if (max === green) hue = (-red + blue) / (max - min) + 2;
            else if (max === blue) hue = (red - green) / (-min + max) + 4;
            if (light >= 0.5) sat = (-min + max) / (-min + -max + 2);
        }
        this.saturation = (sat * 256) | 0;
        hue /= 6;
        if (this.saturation < 0) this.saturation = 0;
        else if (this.saturation > 255) this.saturation = 255;
        if (light > 0.5) this.chroma = (512 * (1 - light) * sat) | 0;
        else this.chroma = (light * sat * 512) | 0;
        if (this.chroma < 1) this.chroma = 1;
        this.weightedHue = (this.chroma * hue) | 0;
    }

    // SD rj.a(IILgd;I)V, HD ni.a(BILwa;I)V
    private DecodeType(_id: number, opcode: number, packet: PacketT): void {
        if (opcode === 1) {
            this.rgb = packet.g3();
            this.GetHsl(this.rgb);
        } else if (opcode === 2) {
            this.m_materialID = packet.g2();
            if (this.m_materialID === 65535) this.m_materialID = -1;
        } else if (opcode === 3) {
            if (glJar) this.m_textureScale = packet.g2();
            else packet.g2();
        } else if (opcode === 4 && glJar) this.field_68 = false;
    }

    // SD rj.a(BLgd;I)V, HD ni.a(ILwa;I)V
    Decode(packet: PacketT, id: number): void {
        for (let opcode = packet.g1(); opcode !== 0; opcode = packet.g1()) this.DecodeType(id, opcode, packet);
    }
}
