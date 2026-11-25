import { isJavaRuntimeException } from '#/util/JavaException';
import { releaseReferences } from '#/util/StaticReferences';
import WrappedException from '#/util/WrappedException';
import type PacketT from '#/io/PacketT';
import Pix8 from '#/graphics/Pix8';
import SpriteLoader from '#/graphics/SpriteLoader';
import { requireNonNull } from '#/util/JavaArray';
import MSITypeList from './MSITypeList';
import LocalisedTextClass from '#/ui/LocalisedText';
import MaterialManagerClass from '#/gl/material/MaterialManager';
import { loadPlayerModel, loadWorldMap } from '#/util/GamepackClasses';

export default class MSIType {
    // HD aa.a(I)V
    static releaseHdStatics(guard: number): void {
        try {
            const LocalisedText = LocalisedTextClass;
            releaseReferences(LocalisedText, 'defaultChatcol9');
            const PlayerModel = loadPlayerModel();
            releaseReferences(PlayerModel, 'recolourSourcesAlt');
            if (guard !== -27401) {
                const WorldMap = loadWorldMap();
                WorldMap.baseZ = 93;
            }
            releaseReferences(LocalisedText, 'englishChatcol9');
            const MaterialManager = MaterialManagerClass;
            releaseReferences(MaterialManager, 'materials');
            releaseReferences(LocalisedText, 'chatcol9');
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'aa.G(' + guard + ')');
        }
    }

    // da.a:I
    m_tint = 0;
    // da.j:Z
    m_resize: boolean;
    // da.l:I
    m_spriteID = 0;

    // da.<init>()V
    constructor() {
        this.m_resize = false;
    }

    // da.a(IB)Lch; MSIType::GetSprite.
    GetSprite(rotation: number): Pix8 | null {
        let sprite = MSITypeList.spriteCache.Find(BigInt(this.m_spriteID | (rotation << 16)));
        if (sprite !== null) {
            if (!(sprite instanceof Pix8)) throw new TypeError('ClassCastException: expected Pix8');
            return sprite;
        }
        requireNonNull(MSITypeList.spritesArchive).RequestDownload2(this.m_spriteID, true);
        sprite = SpriteLoader.loadIndexedSprite(this.m_spriteID, MSITypeList.spritesArchive, 0);
        if (sprite !== null) {
            sprite.rgbAdjust(MSITypeList.redDelta, MSITypeList.greenDelta, MSITypeList.blueDelta);
            sprite.cropH = sprite.height;
            sprite.cropW = sprite.width;
            for (let i = 0; i < rotation; i++) sprite.rotateClockwise();
            MSITypeList.spriteCache.Put(BigInt(this.m_spriteID | (rotation << 16)), sprite);
        }
        return sprite;
    }

    // da.a(Lgd;BI)V
    Decode(packet: PacketT, id: number): void {
        for (let opcode = packet.g1(); opcode !== 0; opcode = packet.g1()) this.DecodeType(id, packet, opcode);
    }

    // da.a(IILgd;I)V
    private DecodeType(_id: number, packet: PacketT, opcode: number): void {
        if (opcode === 1) this.m_spriteID = packet.g2();
        else if (opcode === 2) this.m_tint = packet.g3();
        else if (opcode === 3) this.m_resize = true;
        else if (opcode === 4) this.m_spriteID = -1;
    }
}
