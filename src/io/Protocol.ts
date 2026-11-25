import MapSpotAnim from '#/dash3d/MapSpotAnim';
import MapSpotAnimNode from '#/dash3d/MapSpotAnimNode';
import SeqType from '#/config/SeqType';
import SpotType from '#/config/SpotType';
import LocChange from '#/dash3d/LocChange';
import LocShape from '#/dash3d/LocShape';
import SceneCutover from '#/scene/SceneCutover';
import Minimenu from '#/ui/Minimenu';
import ClientVarCache from '#/util/ClientVarCache';
import HintArrow from '#/client/HintArrow';
import WorldMap from '#/ui/WorldMap';
import { ClientScript } from '#/script/ClientScript';
import ScriptRunner from '#/script/ScriptRunner';
import HookReq from '#/script/HookReq';
import IfType, { type Hook } from '#/ui/IfType';
import ClientNpc from '#/dash3d/ClientNpc';
import FriendChatChannel from '#/client/FriendChatChannel';
import OrbitCamera from '#/client/OrbitCamera';
import CinematicCamera from '#/client/CinematicCamera';
import GameShell from '#/client/GameShell';
import StockPlayerOffer from '#/client/StockPlayerOffer';
import Signlink from '#/util/Signlink';
import ReflectionCheck from './ReflectionCheck';
import { intDivide } from '#/util/IntUtils';
import ObjType from '#/config/ObjType';
import ServerActiveProperties from '#/ui/ServerActiveProperties';
import SubInterface from '#/ui/SubInterface';
import DelayedStateChange from '#/ui/DelayedStateChange';
import InterfaceList from '#/ui/InterfaceList';
import ClientInvCache from '#/client/ClientInvCache';
import ChatHistory from '#/game/ChatHistory';
import JagString, { fromLiteral, toJsString } from '#/datastruct/JagString';
import FriendChatUser from '#/client/FriendChatUser';
import LocalisedText from '#/ui/LocalisedText';
import CookieStatics from '#/util/CookieStatics';
import PixfontGeneric from '#/graphics/PixfontGeneric';
import QuickChatPhraseTypeList from '#/config/QuickChatPhraseTypeList';
import WordPack from './WordPack';
import ReceivePlayerPositions from '#/client/ReceivePlayerPositions';
import Client from '#/client/Client';
import { glJar } from '#/client/ClientVariant';
import { clientErrorHost, JavaError, reportClientError } from '#/util/ClientError';
import { isJavaRuntimeException } from '#/util/JavaException';
import WrappedException from '#/util/WrappedException';
import { arrayAtB64, arrayAtI32, arrayAtObj, arrayAtU8, arrayPutB64, arrayPutI32, arrayPutObj, arrayPutU8, requireNonNull } from '#/util/JavaArray';
import { byteAt } from './JavaByteArray';
import { SocketIoError, type Js5Stream } from './SocketPlatform';
import SuperPacket from './SuperPacket';

export default class Protocol {
    static oldSocket: Js5Stream | null = null; // mf.m:Lse;
    static readonly tradeReqSuffix = fromLiteral(':tradereq:'); // va.S:Lid;
    static readonly chalReqTag = fromLiteral(':chalreq:'); // th.b:Lid;
    static readonly assistReqSuffix = fromLiteral(':assistreq:'); // vf.W:Lid;
    static readonly clanTag = fromLiteral(':clan:'); // nh.V:Lid;
    static readonly tradeTag = fromLiteral(':trade:'); // mh.j:Lid;
    static readonly assistRequestSuffix = fromLiteral(':assist:'); // ib.Y:Lid;
    static readonly duelStakeTag = fromLiteral(':duelstake:'); // qe.eb:Lid;
    static readonly duelFriendTag = fromLiteral(':duelfriend:'); // ah.o:Lid;
    static readonly clanRequestSuffix = fromLiteral(':clanreq:'); // ie.w:Lid;
    static readonly allyReqSuffix = fromLiteral(':allyreq:'); // ed.o:Lid;
    static inPacket = new SuperPacket(5000); // hd.b:Lbe;
    static packetSize = 0; // af.I:I
    static idleReads = 0; // ia.q:I
    // rg.i:[I
    static serverPacketSizes = Int32Array.of(
        -1,
        0,
        8,
        0,
        2,
        0,
        0,
        0,
        0,
        12,
        0,
        1,
        0,
        3,
        7,
        0,
        15,
        6,
        0,
        0,
        4,
        7,
        -2,
        -1,
        2,
        0,
        2,
        8,
        0,
        0,
        0,
        0,
        -2,
        5,
        0,
        0,
        8,
        3,
        6,
        0,
        0,
        0,
        -1,
        0,
        -1,
        0,
        0,
        6,
        -2,
        0,
        12,
        0,
        0,
        0,
        -1,
        -2,
        10,
        0,
        0,
        0,
        3,
        0,
        -1,
        0,
        0,
        5,
        6,
        0,
        0,
        8,
        -1,
        -1,
        0,
        8,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        -1,
        0,
        0,
        6,
        2,
        0,
        0,
        0,
        0,
        1,
        0,
        0,
        0,
        0,
        0,
        0,
        5,
        0,
        0,
        0,
        0,
        5,
        0,
        0,
        -2,
        0,
        0,
        0,
        0,
        0,
        12,
        2,
        0,
        -2,
        -2,
        20,
        0,
        0,
        10,
        0,
        15,
        0,
        -1,
        0,
        8,
        -2,
        0,
        0,
        0,
        8,
        0,
        12,
        0,
        0,
        7,
        0,
        0,
        0,
        0,
        0,
        -1,
        -1,
        0,
        4,
        5,
        0,
        0,
        0,
        6,
        0,
        0,
        0,
        0,
        8,
        9,
        0,
        0,
        0,
        2,
        -1,
        0,
        -2,
        0,
        4,
        14,
        0,
        0,
        0,
        24,
        0,
        -2,
        5,
        0,
        0,
        0,
        10,
        0,
        0,
        4,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        6,
        0,
        0,
        0,
        2,
        1,
        0,
        0,
        2,
        -1,
        1,
        0,
        0,
        0,
        0,
        14,
        0,
        0,
        0,
        0,
        10,
        5,
        0,
        0,
        0,
        0,
        0,
        -2,
        0,
        0,
        9,
        0,
        0,
        8,
        0,
        0,
        0,
        0,
        -2,
        6,
        0,
        0,
        0,
        -2,
        0,
        3,
        0,
        1,
        7,
        0,
        0,
        0,
        0,
        3,
        0,
        0,
        0,
        0,
        0,
        0,
        -1,
        0,
        0,
        0,
        0,
        0,
        3,
        0,
        0
    );
    static packetType = 0; // o.Y:I
    static lastPacketType0 = 0; // fk.X:I
    static ptype1 = 0; // la.W:I
    static ptype2 = 0; // jh.q:I
    static zoneUpdateX = 0; // dg.C:I
    static zoneBaseZ = 0; // ha.a:I
    static sequenceAckPending = false; // qc.Z:Z

    // rg.a(B)Z. Client::TcpIn, projects/osclient/client_network.cpp.
    static async TcpIn(): Promise<boolean> {
        try {
            if (Client.stream === null) return false;
            let available = Client.stream.GetAvailable(124);
            if (available === 0) return false;
            if (Protocol.packetType === -1) {
                available = (available - 1) | 0;
                await Client.stream.Read(Protocol.inPacket.m_data, 0, 1);
                Protocol.inPacket.m_pos = 0;
                Protocol.packetType = Protocol.inPacket.g1Enc();
                Protocol.packetSize = arrayAtI32(Protocol.serverPacketSizes, Protocol.packetType);
            }
            if (Protocol.packetSize === -1) {
                if (available <= 0) return false;
                await Client.stream.Read(Protocol.inPacket.m_data, 0, 1);
                Protocol.packetSize = byteAt(Protocol.inPacket.m_data, 0);
                available = (available - 1) | 0;
            }
            if (Protocol.packetSize === -2) {
                if (available <= 1) return false;
                available = (available - 2) | 0;
                await Client.stream.Read(Protocol.inPacket.m_data, 0, 2);
                Protocol.inPacket.m_pos = 0;
                Protocol.packetSize = Protocol.inPacket.g2();
            }
            if (Protocol.packetSize > available) return false;
            Protocol.inPacket.m_pos = 0;
            await Client.stream.Read(Protocol.inPacket.m_data, 0, Protocol.packetSize);
            Protocol.ptype2 = Protocol.ptype1;
            Protocol.idleReads = 0;
            Protocol.ptype1 = Protocol.lastPacketType0;
            Protocol.lastPacketType0 = Protocol.packetType;

            if (Protocol.packetType === 65) {
                const verify = Protocol.inPacket.g2_alt1(),
                    value = Protocol.inPacket.g1_alt2(),
                    id = Protocol.inPacket.g2_alt3();
                if (Protocol.setVerifyId(verify)) DelayedStateChange.serverVarc(value, id);
                Protocol.packetType = -1;
                return true;
            }
            if (Protocol.packetType === 70) {
                const message = Protocol.inPacket.gStringNoConversion();
                if (message.endsWith(Protocol.tradeReqSuffix)) {
                    const name = message.substring(0, message.indexOf(CookieStatics.timeSeparator));
                    const key = name.toBase37();
                    let ignored = false;
                    for (let i = 0; i < Client.ignoreCount; i++) {
                        if (arrayAtB64(Client.ignoreName37, i) === key) {
                            ignored = true;
                            break;
                        }
                    }
                    if (!ignored && Client.withinTutorialIsland === 0) Client.AddChat(LocalisedText.tradeRequest, name, 4);
                } else if (message.endsWith(Protocol.chalReqTag)) {
                    const name = message.substring(0, message.indexOf(CookieStatics.timeSeparator));
                    const key = name.toBase37();
                    let ignored = false;
                    for (let i = 0; i < Client.ignoreCount; i++) {
                        if (arrayAtB64(Client.ignoreName37, i) === key) {
                            ignored = true;
                            break;
                        }
                    }
                    if (!ignored && Client.withinTutorialIsland === 0) {
                        const text = message.substring((message.indexOf(CookieStatics.timeSeparator) + 1) | 0, (message.getLength() - 9) | 0);
                        Client.AddChat(text, name, 8);
                    }
                } else if (message.endsWith(Protocol.assistReqSuffix)) {
                    const name = message.substring(0, message.indexOf(CookieStatics.timeSeparator));
                    const key = name.toBase37();
                    let ignored = false;
                    for (let i = 0; i < Client.ignoreCount; i++) {
                        if (arrayAtB64(Client.ignoreName37, i) === key) {
                            ignored = true;
                            break;
                        }
                    }
                    if (!ignored && Client.withinTutorialIsland === 0) Client.AddChat(JagString.empty, name, 10);
                } else if (message.endsWith(Protocol.clanTag)) {
                    const text = message.substring(0, message.indexOf(Protocol.clanTag));
                    Client.AddChat(text, JagString.empty, 11);
                } else if (message.endsWith(Protocol.tradeTag)) {
                    const text = message.substring(0, message.indexOf(Protocol.tradeTag));
                    if (Client.withinTutorialIsland === 0) Client.AddChat(text, JagString.empty, 12);
                } else if (message.endsWith(Protocol.assistRequestSuffix)) {
                    const text = message.substring(0, message.indexOf(Protocol.assistRequestSuffix));
                    if (Client.withinTutorialIsland === 0) Client.AddChat(text, JagString.empty, 13);
                } else if (message.endsWith(Protocol.duelStakeTag)) {
                    const name = message.substring(0, message.indexOf(CookieStatics.timeSeparator));
                    const key = name.toBase37();
                    let ignored = false;
                    for (let i = 0; i < Client.ignoreCount; i++) {
                        if (arrayAtB64(Client.ignoreName37, i) === key) {
                            ignored = true;
                            break;
                        }
                    }
                    if (!ignored && Client.withinTutorialIsland === 0) Client.AddChat(JagString.empty, name, 14);
                } else if (message.endsWith(Protocol.duelFriendTag)) {
                    const name = message.substring(0, message.indexOf(CookieStatics.timeSeparator));
                    const key = name.toBase37();
                    let ignored = false;
                    for (let i = 0; i < Client.ignoreCount; i++) {
                        if (arrayAtB64(Client.ignoreName37, i) === key) {
                            ignored = true;
                            break;
                        }
                    }
                    if (!ignored && Client.withinTutorialIsland === 0) Client.AddChat(JagString.empty, name, 15);
                } else if (message.endsWith(Protocol.clanRequestSuffix)) {
                    const name = message.substring(0, message.indexOf(CookieStatics.timeSeparator));
                    const key = name.toBase37();
                    let ignored = false;
                    for (let i = 0; i < Client.ignoreCount; i++) {
                        if (arrayAtB64(Client.ignoreName37, i) === key) {
                            ignored = true;
                            break;
                        }
                    }
                    if (!ignored && Client.withinTutorialIsland === 0) Client.AddChat(JagString.empty, name, 16);
                } else if (message.endsWith(Protocol.allyReqSuffix)) {
                    const name = message.substring(0, message.indexOf(CookieStatics.timeSeparator));
                    const key = name.toBase37();
                    let ignored = false;
                    for (let i = 0; i < Client.ignoreCount; i++) {
                        if (arrayAtB64(Client.ignoreName37, i) === key) {
                            ignored = true;
                            break;
                        }
                    }
                    if (!ignored && Client.withinTutorialIsland === 0) {
                        const text = message.substring((message.indexOf(CookieStatics.timeSeparator) + 1) | 0, (message.getLength() - 9) | 0);
                        Client.AddChat(text, name, 21);
                    }
                } else {
                    Client.AddChat(message, JagString.empty, 0);
                }
                Protocol.packetType = -1;
                return true;
            }
            if (Protocol.packetType === 55) {
                Client.clanTransmitCycle = Client.transmitCycle;
                const owner = Protocol.inPacket.g8();
                if (owner === 0n) {
                    FriendChatChannel.ownerName = null;
                    FriendChatChannel.members = null;
                    FriendChatChannel.channelName = null;
                    Protocol.packetType = -1;
                    FriendChatChannel.memberCount = 0;
                    return true;
                }
                const clanId = Protocol.inPacket.g8();
                FriendChatChannel.channelName = JagString.fromBase37(clanId);
                FriendChatChannel.ownerName = JagString.fromBase37(owner);
                FriendChatChannel.minKick = Protocol.inPacket.g1s();
                const count = Protocol.inPacket.g1();
                if (count === 255) {
                    Protocol.packetType = -1;
                    return true;
                }
                FriendChatChannel.memberCount = count;
                const members = new Array<FriendChatUser | null>(100).fill(null);
                for (let i = 0; i < FriendChatChannel.memberCount; i++) {
                    const member = new FriendChatUser();
                    arrayPutObj(members, i, member);
                    member.key = Protocol.inPacket.g8();
                    member.name = JagString.fromBase37(member.key);
                    member.world = Protocol.inPacket.g2();
                    member.rank = Protocol.inPacket.g1s();
                    member.worldName = Protocol.inPacket.gStringNoConversion();
                    if (member.key === clientErrorHost.username) FriendChatChannel.selfRank = member.rank;
                }
                for (let limit = FriendChatChannel.memberCount; limit > 0;) {
                    limit--;
                    let sorted = true;
                    for (let i = 0; i < limit; i++) {
                        const first = requireNonNull(arrayAtObj(members, i));
                        const second = requireNonNull(arrayAtObj(members, i + 1));
                        if (requireNonNull(first.name).compare(requireNonNull(second.name)) > 0) {
                            arrayPutObj(members, i, second);
                            sorted = false;
                            arrayPutObj(members, i + 1, first);
                        }
                    }
                    if (sorted) break;
                }
                Protocol.packetType = -1;
                FriendChatChannel.members = members;
                return true;
            }
            if (Protocol.packetType === 105) {
                const componentId = Protocol.inPacket.g4();
                let inventory = Protocol.inPacket.g2();
                if (componentId < -70000) inventory += 32768;
                const component = componentId < 0 ? null : IfType.Get(componentId);
                if (component !== null) {
                    for (let slot = 0; slot < requireNonNull(component.itemIds).length; slot++) {
                        arrayPutI32(component.itemIds, slot, 0);
                        arrayPutI32(component.itemCounts, slot, 0);
                    }
                }
                ClientInvCache.Blank(inventory);
                const size = Protocol.inPacket.g2();
                for (let slot = 0; slot < size; slot++) {
                    let count = Protocol.inPacket.g1_alt3();
                    if (count === 255) count = Protocol.inPacket.g4();
                    const obj = Protocol.inPacket.g2();
                    if (component !== null && slot < requireNonNull(component.itemIds).length) {
                        arrayPutI32(component.itemIds, slot, obj);
                        arrayPutI32(component.itemCounts, slot, count);
                    }
                    ClientInvCache.Set(obj - 1, inventory, count, slot);
                }
                if (component !== null) Client.ComponentUpdated(component);
                Client.LegacyUpdated();
                const ring = Client.changedInvs,
                    index = Client.invTransmitCount;
                Client.invTransmitCount = (index + 1) | 0;
                arrayPutI32(ring, index & 31, inventory & 32767);
                Protocol.packetType = -1;
                return true;
            }
            if (Protocol.packetType === 187) {
                const yaw = Protocol.inPacket.g2_alt1();
                const verify = Protocol.inPacket.g2();
                const pitch = Protocol.inPacket.g2();
                if (Protocol.setVerifyId(verify)) {
                    OrbitCamera.followYaw = yaw;
                    OrbitCamera.followPitch = pitch;
                    if (OrbitCamera.mode === 2) {
                        OrbitCamera.yaw = OrbitCamera.followYaw;
                        OrbitCamera.pitch = OrbitCamera.followPitch;
                    }
                    OrbitCamera.clamp(-117);
                }
                Protocol.packetType = -1;
                return true;
            }
            if (Protocol.packetType === 4) {
                let song = Protocol.inPacket.g2_alt3();
                if (song === 65535) song = -1;
                Client.PlaySong(song);
                Protocol.packetType = -1;
                return true;
            }
            if (Protocol.packetType === 208) {
                const delay = Protocol.inPacket.ig3();
                let song = Protocol.inPacket.g2_alt1();
                if (song === 65535) song = -1;
                Client.PlayJingle(song, delay);
                Protocol.packetType = -1;
                return true;
            }
            if (Protocol.packetType === 114) {
                ReflectionCheck.decode(GameShell.signlink, Protocol.inPacket);
                Protocol.packetType = -1;
                return true;
            }
            if (Protocol.packetType === 0) {
                const sender = Protocol.inPacket.g8();
                const world = BigInt(Protocol.inPacket.g2());
                const sequence = BigInt(Protocol.inPacket.g3());
                const rights = Protocol.inPacket.g1();
                const messageId = (world << 32n) + sequence;
                let suppressed = false;
                for (let i = 0; i < 100; i++) {
                    if (messageId === arrayAtB64(Client.privateMessageIds, i)) {
                        suppressed = true;
                        break;
                    }
                }
                if (!suppressed && rights <= 1) {
                    if ((Client.underage && !Client.parentalChatConsent) || Client.mapQuickChat) {
                        suppressed = true;
                    } else {
                        for (let i = 0; i < Client.ignoreCount; i++) {
                            if (arrayAtB64(Client.ignoreName37, i) === sender) {
                                suppressed = true;
                                break;
                            }
                        }
                    }
                }
                if (!suppressed && Client.withinTutorialIsland === 0) {
                    arrayPutB64(Client.privateMessageIds, Client.privateMessageCount, messageId);
                    Client.privateMessageCount = ((Client.privateMessageCount + 1) | 0) % 100;
                    const text = PixfontGeneric.escape(WordPack.read(Protocol.inPacket).sentenceCase());
                    if (rights === 2 || rights === 3) {
                        Client.AddChat(text, JagString.join([Client.modCrownTag, requireNonNull(JagString.fromBase37(sender)).formatName(0)]), 7);
                    } else if (rights === 1) {
                        Client.AddChat(text, JagString.join([Client.modIconTag, requireNonNull(JagString.fromBase37(sender)).formatName(0)]), 7);
                    } else {
                        Client.AddChat(text, requireNonNull(JagString.fromBase37(sender)).formatName(0), 3);
                    }
                }
                Protocol.packetType = -1;
                return true;
            }
            if (Protocol.packetType === 73) {
                let model = Protocol.inPacket.g2_alt2();
                const id = Protocol.inPacket.g4_alt1(glJar ? -105 : 4),
                    verify = Protocol.inPacket.g2_alt1();
                if (model === 65535) model = -1;
                if (Protocol.setVerifyId(verify)) DelayedStateChange.serverModel(2, model, -1, id);
                Protocol.packetType = -1;
                return true;
            }
            if (Protocol.packetType === 164) {
                const address = Protocol.inPacket.g4_alt2();
                Client.dnsRequest = requireNonNull(GameShell.signlink).reverseDns(address);
                Protocol.packetType = -1;
                return true;
            }
            if (Protocol.packetType === 27) {
                const verify = Protocol.inPacket.g2();
                const axis = Protocol.inPacket.g1();
                const offset = Protocol.inPacket.g1();
                const amplitude = Protocol.inPacket.g1();
                const frequency = Protocol.inPacket.g1();
                const phase = Protocol.inPacket.g2();
                if (Protocol.setVerifyId(verify)) {
                    arrayPutObj(OrbitCamera.shake, axis, true);
                    arrayPutI32(OrbitCamera.shakeRandom, axis, offset);
                    arrayPutI32(OrbitCamera.shakeAmplitude, axis, amplitude);
                    arrayPutI32(OrbitCamera.shakeFrequency, axis, frequency);
                    arrayPutI32(OrbitCamera.shakePhase, axis, phase);
                }
                Protocol.packetType = -1;
                return true;
            }
            if (Protocol.packetType === 84) {
                const value = Protocol.inPacket.g4_alt1(glJar ? -79 : 4),
                    id = Protocol.inPacket.g2_alt3();
                ClientVarCache.setBitServer(value, id);
                Protocol.packetType = -1;
                return true;
            }
            if (Protocol.packetType === 13) {
                const x = Protocol.inPacket.g1_alt3();
                const flags = Protocol.inPacket.g1_alt1();
                const z = Protocol.inPacket.g1();
                Client.playerLevel = flags >> 1;
                requireNonNull(Client.localPlayer).move((flags & 1) === 1, z, x);
                Protocol.packetType = -1;
                return true;
            }
            if (Protocol.packetType === 145) {
                const group = Protocol.inPacket.g2_alt3(),
                    type = Protocol.inPacket.g1_alt1(),
                    verify = Protocol.inPacket.g2_alt3();
                if (Protocol.setVerifyId(verify)) {
                    if (type === 2) WorldMap.reload(25);
                    InterfaceList.top = group;
                    Client.IfAnimReset(group);
                    Client.InterfaceCalculateSizeAndPosAll(false);
                    const hooks = ScriptRunner.OnLoad(InterfaceList.top);
                    if (hooks instanceof Promise) await hooks;
                    InterfaceList.redrawAll();
                    Client.activeClient?.ui?.refreshView();
                }
                Protocol.packetType = -1;
                return true;
            }
            if (Protocol.packetType === 209) {
                if (InterfaceList.top !== -1) {
                    const hooks = Client.RunHookImmediate(InterfaceList.top, 0);
                    if (hooks instanceof Promise) await hooks;
                }
                Protocol.packetType = -1;
                return true;
            }
            if (Protocol.packetType === 192) {
                Client.minimapState = Protocol.inPacket.g1();
                Protocol.packetType = -1;
                return true;
            }
            if (Protocol.packetType === 85) {
                Client.rebootTimer = Protocol.inPacket.g2() * 30;
                Protocol.packetType = -1;
                InterfaceList.miscTransmitAt = Client.transmitCycle;
                return true;
            }
            if (Protocol.packetType === 154) {
                const verify = Protocol.inPacket.g2();
                const x = Protocol.inPacket.g1();
                const z = Protocol.inPacket.g1();
                const height = Protocol.inPacket.g2();
                const step = Protocol.inPacket.g1();
                const factor = Protocol.inPacket.g1();
                if (Protocol.setVerifyId(verify)) CinematicCamera.MoveTo(factor, x, height, step, z, true);
                Protocol.packetType = -1;
                return true;
            }
            if (Protocol.packetType === 37) {
                const value = Protocol.inPacket.g1_alt1(),
                    id = Protocol.inPacket.g2_alt1();
                ClientVarCache.setBitServer(value, id);
                Protocol.packetType = -1;
                return true;
            }
            if (Protocol.packetType === 44) {
                let cursor = Protocol.inPacket.g2_alt3();
                const priority = Protocol.inPacket.g1();
                if (cursor === 65535) cursor = -1;
                const slot = Protocol.inPacket.g1();
                let label: JagString | null = Protocol.inPacket.gStringNoConversion();
                if (slot >= 1 && slot <= 8) {
                    if (label.equalsIgnoreCase(JagString.nullString)) label = null;
                    arrayPutObj(Minimenu.playerOption, slot - 1, label);
                    arrayPutI32(Minimenu.playerCursor, slot - 1, cursor);
                    arrayPutObj(Minimenu.playerSecondary, slot - 1, priority === 0);
                }
                Protocol.packetType = -1;
                return true;
            }
            if (Protocol.packetType === 66) {
                const verify = Protocol.inPacket.g2_alt3(),
                    id = Protocol.inPacket.g4_alt2();
                if (Protocol.setVerifyId(verify)) {
                    let head = 0;
                    if (requireNonNull(Client.localPlayer).appearance !== null) head = requireNonNull(requireNonNull(Client.localPlayer).appearance).getHeadId();
                    DelayedStateChange.serverModel(3, head, -1, id);
                }
                Protocol.packetType = -1;
                return true;
            }
            if (Protocol.packetType === 144) {
                const id = Protocol.inPacket.g4_alt3();
                const component = requireNonNull(IfType.Get(id));
                for (let slot = 0; slot < requireNonNull(component.itemIds).length; slot++) {
                    arrayPutI32(component.itemIds, slot, -1);
                    arrayPutI32(component.itemIds, slot, 0);
                }
                Client.ComponentUpdated(component);
                Protocol.packetType = -1;
                return true;
            }
            if (Protocol.packetType === 197) {
                Client.friendState = Protocol.inPacket.g1();
                Client.friendListTransmitCycle = Client.transmitCycle;
                Protocol.packetType = -1;
                return true;
            }
            if (Protocol.packetType === 112) {
                Protocol.zoneUpdateX = Protocol.inPacket.g1();
                Protocol.zoneBaseZ = Protocol.inPacket.g1_alt2();
                for (let x = Protocol.zoneUpdateX; x < ((Protocol.zoneUpdateX + 8) | 0); x++) {
                    for (let z = Protocol.zoneBaseZ; z < ((Protocol.zoneBaseZ + 8) | 0); z++) {
                        const column = arrayAtObj(arrayAtObj(Client.groundObj, Client.playerLevel), x);
                        if (arrayAtObj(column, z) !== null) {
                            arrayPutObj(column, z, null);
                            Client.ShowObject(z, x, undefined, 51);
                        }
                    }
                }
                for (let change = Client.locChanges.head(); change !== null; change = Client.locChanges.next()) {
                    if (change.x >= Protocol.zoneUpdateX && change.x < ((Protocol.zoneUpdateX + 8) | 0) && change.z >= Protocol.zoneBaseZ && change.z < ((Protocol.zoneBaseZ + 8) | 0) && Client.playerLevel === change.plane) {
                        change.remaining = 0;
                    }
                }
                Protocol.packetType = -1;
                return true;
            }
            if (Protocol.packetType === 142) {
                CookieStatics.setCookie(Protocol.inPacket.gStringNoConversion());
                Protocol.packetType = -1;
                return true;
            }
            if (Protocol.packetType === 226) {
                const value = Protocol.inPacket.g4(),
                    id = Protocol.inPacket.g2_alt2();
                ClientVarCache.setServer(id, value);
                Protocol.packetType = -1;
                return true;
            }
            if (Protocol.packetType === 123) {
                const id = Protocol.inPacket.g2_alt1(),
                    verify = Protocol.inPacket.g2_alt2(),
                    text = Protocol.inPacket.gStringNoConversion();
                if (Protocol.setVerifyId(verify)) DelayedStateChange.serverVarcString(text, id);
                Protocol.packetType = -1;
                return true;
            }
            if (Protocol.packetType === 217) {
                const header = Protocol.inPacket.g1(),
                    slot = header >> 6;
                const arrow = new HintArrow();
                arrow.type = header & 63;
                arrow.icon = Protocol.inPacket.g1();
                if (arrow.icon >= 0 && arrow.icon < requireNonNull(Client.hintHeadicons).length) {
                    if (arrow.type === 1 || arrow.type === 10) {
                        arrow.actor = Protocol.inPacket.g2();
                        const packet = Protocol.inPacket;
                        packet.m_pos = (packet.m_pos + 3) | 0;
                    } else if (arrow.type >= 2 && arrow.type <= 6) {
                        if (arrow.type === 2) {
                            arrow.offsetX = 64;
                            arrow.offsetZ = 64;
                        }
                        if (arrow.type === 3) {
                            arrow.offsetZ = 64;
                            arrow.offsetX = 0;
                        }
                        if (arrow.type === 4) {
                            arrow.offsetX = 128;
                            arrow.offsetZ = 64;
                        }
                        if (arrow.type === 5) {
                            arrow.offsetZ = 0;
                            arrow.offsetX = 64;
                        }
                        if (arrow.type === 6) {
                            arrow.offsetZ = 128;
                            arrow.offsetX = 64;
                        }
                        arrow.type = 2;
                        arrow.x = Protocol.inPacket.g2();
                        arrow.z = Protocol.inPacket.g2();
                        arrow.height = Protocol.inPacket.g1();
                    }
                    arrow.model = Protocol.inPacket.g2();
                    if (arrow.model === 65535) arrow.model = -1;
                    arrayPutObj(Client.hintArrows, slot, arrow);
                }
                Protocol.packetType = -1;
                return true;
            }
            if (Protocol.packetType === 230) {
                Protocol.zoneBaseZ = Protocol.inPacket.g1_alt1(107);
                Protocol.zoneUpdateX = Protocol.inPacket.g1_alt3(128);
                while (Protocol.inPacket.m_pos < Protocol.packetSize) {
                    Protocol.packetType = Protocol.inPacket.g1();
                    Client.ZonePacket(-82);
                }
                Protocol.packetType = -1;
                return true;
            }
            if (Protocol.packetType === 56) {
                const delay = Protocol.inPacket.g2();
                const height = Protocol.inPacket.g2_alt1();
                const target = Protocol.inPacket.g4_alt2();
                let spot = Protocol.inPacket.g2_alt3();
                update: {
                    if (target >> 30 === 0) {
                        if (target >> 29 === 0) {
                            if (target >> 28 === 0) break update;
                            const index = target & 65535;
                            const player = index === Client.localPid ? Client.localPlayer : arrayAtObj(Client.players, index);
                            if (player === null) break update;
                            if (spot === 65535) spot = -1;
                            if (spot !== -1 && player.spotanim !== -1 && SeqType.List(SpotType.List(spot).seq).m_priority < SeqType.List(SpotType.List(player.spotanim).seq).m_priority) break update;
                            player.spotanim = spot;
                            player.spotFrame = 0;
                            player.spotNext = 1;
                            player.spotHeight = height;
                            if (player.spotanim === 65535) player.spotanim = -1;
                            player.spotCycle = 0;
                            player.spotStart = (delay + Client.loopCycle) | 0;
                            if (player.spotStart > Client.loopCycle) player.spotFrame = -1;
                            if (player.spotanim === -1 || Client.loopCycle !== player.spotStart) break update;
                            const seq = SpotType.List(player.spotanim).seq;
                            if (seq === -1) break update;
                            const type = SeqType.List(seq);
                            if (type !== null && type.frames !== null) Client.TriggerSeqSound(type, player.z, player.x, player === Client.localPlayer, 0);
                        } else {
                            const npc = arrayAtObj(Client.npcs, target & 65535);
                            if (npc === null) break update;
                            if (spot === 65535) spot = -1;
                            if (spot !== -1 && npc.spotanim !== -1 && SeqType.List(SpotType.List(spot).seq).m_priority < SeqType.List(SpotType.List(npc.spotanim).seq).m_priority) break update;
                            npc.spotCycle = 0;
                            npc.spotStart = (delay + Client.loopCycle) | 0;
                            npc.spotHeight = height;
                            npc.spotanim = spot;
                            npc.spotNext = 1;
                            npc.spotFrame = 0;
                            if (Client.loopCycle < npc.spotStart) npc.spotFrame = -1;
                            if (npc.spotanim === -1 || Client.loopCycle !== npc.spotStart) break update;
                            const seq = SpotType.List(npc.spotanim).seq;
                            if (seq === -1) break update;
                            const type = SeqType.List(seq);
                            if (type !== null && type.frames !== null) Client.TriggerSeqSound(type, npc.z, npc.x, false, 0);
                        }
                    } else {
                        const plane = (target & 884772131) >> 28;
                        let x = (((target >> 14) & 16383) - Client.mapBuildBaseX) | 0;
                        let z = ((target & 16383) - Client.mapBuildBaseZ) | 0;
                        if (x >= 0 && z >= 0 && x < 104 && z < 104) {
                            z = 64 + 128 * z;
                            x = 128 * x + 64;
                            const animation = new MapSpotAnim(spot, plane, x, z, (Client.GetAvH(x, z, plane, -97) - height) | 0, delay, Client.loopCycle);
                            MapSpotAnim.active.push_back(new MapSpotAnimNode(animation));
                        }
                    }
                }
                Protocol.packetType = -1;
                return true;
            }
            if (
                Protocol.packetType === 104 ||
                Protocol.packetType === 121 ||
                Protocol.packetType === 97 ||
                Protocol.packetType === 14 ||
                Protocol.packetType === 202 ||
                Protocol.packetType === 135 ||
                Protocol.packetType === 17 ||
                Protocol.packetType === 16 ||
                Protocol.packetType === 240 ||
                Protocol.packetType === 33 ||
                Protocol.packetType === 20 ||
                Protocol.packetType === 195 ||
                Protocol.packetType === 179
            ) {
                Client.ZonePacket();
                Protocol.packetType = -1;
                return true;
            }
            if (Protocol.packetType === 38) {
                Client.LegacyUpdated();
                const current = Protocol.inPacket.g1_alt1(),
                    xp = Protocol.inPacket.g4_alt2(),
                    stat = Protocol.inPacket.g1();
                arrayPutI32(Client.statXP, stat, xp);
                arrayPutI32(Client.statEffectiveLevel, stat, current);
                arrayPutI32(Client.statBaseLevel, stat, 1);
                for (let i = 0; i < 98; i++) {
                    if (arrayAtI32(Client.levelExperience, i) <= xp) arrayPutI32(Client.statBaseLevel, stat, i + 2);
                }
                const ring = Client.statUpdates,
                    index = Client.changedStatCount;
                Client.changedStatCount = (index + 1) | 0;
                arrayPutI32(ring, index & 31, stat);
                Protocol.packetType = -1;
                return true;
            }
            if (Protocol.packetType === 128) {
                for (let id = 0; id < ClientVarCache.m_var.length; id++) {
                    if (arrayAtI32(ClientVarCache.m_var, id) !== arrayAtI32(ClientVarCache.m_varServ, id)) {
                        arrayPutI32(ClientVarCache.m_var, id, arrayAtI32(ClientVarCache.m_varServ, id));
                        Client.ClientVar(id);
                        const ring = Client.varpUpdates,
                            index = Client.varpTransmitCount;
                        Client.varpTransmitCount = (index + 1) | 0;
                        arrayPutI32(ring, index & 31, id);
                    }
                }
                Protocol.packetType = -1;
                return true;
            }
            if (Protocol.packetType === 141) {
                const sender = Protocol.inPacket.g8();
                const phrase = Protocol.inPacket.g2();
                const text = QuickChatPhraseTypeList.GetQuickChatPhraseType(phrase).GetText(Protocol.inPacket);
                ChatHistory.AddChat(phrase, text, null, 19, requireNonNull(JagString.fromBase37(sender)).formatName(0));
                Protocol.packetType = -1;
                return true;
            }
            if (Protocol.packetType === 36) {
                const id = Protocol.inPacket.g4_alt3(),
                    sequence = Protocol.inPacket.g2s_alt1(),
                    verify = Protocol.inPacket.g2_alt2();
                if (Protocol.setVerifyId(verify)) DelayedStateChange.serverAnimation(sequence, id);
                Protocol.packetType = -1;
                return true;
            }
            if (Protocol.packetType === 131) {
                for (let i = 0; i < Client.players.length; i++) {
                    if (arrayAtObj(Client.players, i) !== null) requireNonNull(arrayAtObj(Client.players, i)).seq = -1;
                }
                for (let i = 0; i < Client.npcs.length; i++) {
                    if (arrayAtObj(Client.npcs, i) !== null) requireNonNull(arrayAtObj(Client.npcs, i)).seq = -1;
                }
                Protocol.packetType = -1;
                return true;
            }
            if (Protocol.packetType === 24) {
                const verify = Protocol.inPacket.g2();
                if (Protocol.setVerifyId(verify)) OrbitCamera.reset();
                Protocol.packetType = -1;
                return true;
            }
            if (Protocol.packetType === 42) {
                const bytes = new Uint8Array(Protocol.packetSize);
                Protocol.inPacket.gArrayBufferEncrypted(bytes, 0, Protocol.packetSize);
                const address = JagString.fromBytes(bytes, 0, Protocol.packetSize);
                if (GameShell.frame === null && (Signlink.platform === 3 || !requireNonNull(Signlink.osNameLower).startsWith('win') || Client.haveIe6)) {
                    GameShell.openUrl(true, address);
                } else {
                    Client.pendingUrl = address;
                    Client.urlNewWindow = true;
                    Client.openUrlRequest = requireNonNull(GameShell.signlink).openUrlExternally(toJsString(address));
                }
                Protocol.packetType = -1;
                return true;
            }
            if (Protocol.packetType === 176) {
                const source = Protocol.inPacket.g4_alt2(),
                    verify = Protocol.inPacket.g2_alt2(),
                    dest = Protocol.inPacket.g4_alt2();
                if (Protocol.setVerifyId(verify)) {
                    const moved = InterfaceList.subInterfaces.get(BigInt(source));
                    if (moved !== null && !(moved instanceof SubInterface)) throw new TypeError('ClassCastException: not a SubInterface');
                    const previous = InterfaceList.subInterfaces.get(BigInt(dest));
                    if (previous !== null && !(previous instanceof SubInterface)) throw new TypeError('ClassCastException: not a SubInterface');
                    if (previous !== null) {
                        const closed = Client.CloseSubinterface(previous, moved === null || previous.group !== moved.group);
                        if (closed instanceof Promise) await closed;
                    }
                    if (moved !== null) {
                        moved.Unlink();
                        InterfaceList.subInterfaces.put(moved, BigInt(dest));
                    }
                    const from = IfType.Get(source);
                    if (from !== null) Client.ComponentUpdated(from);
                    const to = IfType.Get(dest);
                    if (to !== null) {
                        Client.ComponentUpdated(to);
                        Client.InterfaceCalculateSizeAndPosSubcomponents(true, to);
                    }
                    if (InterfaceList.top !== -1) {
                        const hooks = Client.RunHookImmediate(InterfaceList.top, 1);
                        if (hooks instanceof Promise) await hooks;
                    }
                    Client.activeClient?.ui?.refreshView();
                }
                Protocol.packetType = -1;
                return true;
            }
            if (Protocol.packetType === 214) {
                Client.RebuildPacket(true);
                Protocol.packetType = -1;
                return true;
            }
            if (Protocol.packetType === 225) {
                ReceivePlayerPositions.GetPlayerInfo();
                Protocol.packetType = -1;
                return true;
            }
            if (Protocol.packetType === 153) {
                Protocol.packetType = -1;
                Client.destinationX = 0;
                return true;
            }
            if (Protocol.packetType === 71) {
                const sender = Protocol.inPacket.g8();
                const text = PixfontGeneric.escape(WordPack.read(Protocol.inPacket).sentenceCase());
                Client.AddChat(text, requireNonNull(JagString.fromBase37(sender)).formatName(0), 6);
                Protocol.packetType = -1;
                return true;
            }
            if (Protocol.packetType === 54) {
                const sender = Protocol.inPacket.g8();
                Protocol.inPacket.g1s();
                const clan = Protocol.inPacket.g8();
                const world = BigInt(Protocol.inPacket.g2());
                const sequence = BigInt(Protocol.inPacket.g3());
                const rights = Protocol.inPacket.g1();
                const messageId = (world << 32n) + sequence;
                let suppressed = false;
                for (let i = 0; i < 100; i++) {
                    if (messageId === arrayAtB64(Client.privateMessageIds, i)) {
                        suppressed = true;
                        break;
                    }
                }
                if (!suppressed && rights <= 1) {
                    if ((Client.underage && !Client.parentalChatConsent) || Client.mapQuickChat) {
                        suppressed = true;
                    } else {
                        for (let i = 0; i < Client.ignoreCount; i++) {
                            if (arrayAtB64(Client.ignoreName37, i) === sender) {
                                suppressed = true;
                                break;
                            }
                        }
                    }
                }
                if (!suppressed && Client.withinTutorialIsland === 0) {
                    arrayPutB64(Client.privateMessageIds, Client.privateMessageCount, messageId);
                    Client.privateMessageCount = ((Client.privateMessageCount + 1) | 0) % 100;
                    const text = PixfontGeneric.escape(WordPack.read(Protocol.inPacket).sentenceCase());
                    if (rights === 2 || rights === 3) {
                        Client.AddChat2(JagString.join([Client.modCrownTag, requireNonNull(JagString.fromBase37(sender)).formatName(0)]), text, requireNonNull(JagString.fromBase37(clan)).formatName(0), 9);
                    } else if (rights === 1) {
                        Client.AddChat2(JagString.join([Client.modIconTag, requireNonNull(JagString.fromBase37(sender)).formatName(0)]), text, requireNonNull(JagString.fromBase37(clan)).formatName(0), 9);
                    } else {
                        Client.AddChat2(requireNonNull(JagString.fromBase37(sender)).formatName(0), text, requireNonNull(JagString.fromBase37(clan)).formatName(0), 9);
                    }
                }
                Protocol.packetType = -1;
                return true;
            }
            if (Protocol.packetType === 234) {
                Client.LegacyUpdated();
                Client.runenergy = Protocol.inPacket.g1();
                Protocol.packetType = -1;
                InterfaceList.miscTransmitAt = Client.transmitCycle;
                return true;
            }
            if (Protocol.packetType === 126) {
                Client.ignoreCount = (Protocol.packetSize / 8) | 0;
                for (let i = 0; i < Client.ignoreCount; i++) {
                    arrayPutB64(Client.ignoreName37, i, Protocol.inPacket.g8());
                    arrayPutObj(Client.ignoreNames, i, JagString.fromBase37(arrayAtB64(Client.ignoreName37, i)));
                }
                Client.friendListTransmitCycle = Client.transmitCycle;
                Protocol.packetType = -1;
                return true;
            }
            if (Protocol.packetType === 155) {
                const type = Protocol.inPacket.g1(),
                    parent = Protocol.inPacket.g4_alt3(),
                    verify = Protocol.inPacket.g2_alt2(),
                    group = Protocol.inPacket.g2();
                if (Protocol.setVerifyId(verify)) {
                    const previous = InterfaceList.subInterfaces.get(BigInt(parent));
                    if (previous !== null && !(previous instanceof SubInterface)) throw new TypeError('ClassCastException: not a SubInterface');
                    if (previous !== null) {
                        const closed = Client.CloseSubinterface(previous, group !== previous.group);
                        if (closed instanceof Promise) await closed;
                    }
                    const opened = Client.OpenSubinterface(parent, group, type);
                    if (opened instanceof Promise) await opened;
                }
                Protocol.packetType = -1;
                return true;
            }
            if (Protocol.packetType === 89) {
                ClientVarCache.reset();
                Client.LegacyUpdated();
                Client.varpTransmitCount = (Client.varpTransmitCount + 32) | 0;
                Protocol.packetType = -1;
                return true;
            }
            if (Protocol.packetType === 232) {
                Client.chatPublicMode = Protocol.inPacket.g1();
                Client.chatPrivateMode = Protocol.inPacket.g1();
                Client.chatTradeMode = Protocol.inPacket.g1();
                Protocol.packetType = -1;
                return true;
            }
            if (Protocol.packetType === 160) {
                Minimenu.walkHere = Protocol.packetSize === 0 ? LocalisedText.walkHere : Protocol.inPacket.gStringNoConversion();
                Protocol.packetType = -1;
                return true;
            }
            if (Protocol.packetType === 132) {
                const x = Protocol.inPacket.g2(),
                    verify = Protocol.inPacket.g2_alt2(),
                    zoom = Protocol.inPacket.g2_alt3(),
                    y = Protocol.inPacket.g2_alt3(),
                    id = Protocol.inPacket.g4();
                if (Protocol.setVerifyId(verify)) DelayedStateChange.serverAngles(id, x, y, zoom);
                Protocol.packetType = -1;
                return true;
            }
            if (Protocol.packetType === 69) {
                const verify = Protocol.inPacket.g2_alt3(),
                    value = Protocol.inPacket.g4(),
                    id = Protocol.inPacket.g2_alt2();
                if (Protocol.setVerifyId(verify)) DelayedStateChange.serverVarc(value, id);
                Protocol.packetType = -1;
                return true;
            }
            if (Protocol.packetType === 220) {
                const id = Protocol.inPacket.g4_alt3(),
                    y = Protocol.inPacket.g2_alt1(),
                    verify = Protocol.inPacket.g2();
                if (Protocol.setVerifyId(verify)) DelayedStateChange.serverScroll(y, id);
                Protocol.packetType = -1;
                return true;
            }
            if (Protocol.packetType === 162) {
                Client.RebuildPacket(false);
                Protocol.packetType = -1;
                return true;
            }
            if (Protocol.packetType === 171) {
                const id = Protocol.inPacket.g4_alt3(),
                    text = Protocol.inPacket.gStringNoConversion(),
                    verify = Protocol.inPacket.g2_alt2();
                if (Protocol.setVerifyId(verify)) DelayedStateChange.serverText(id, text);
                Protocol.packetType = -1;
                return true;
            }
            if (Protocol.packetType === 102) {
                const id = Protocol.inPacket.g2_alt1();
                const delay = Protocol.inPacket.g1_alt3();
                const sequence = Protocol.inPacket.g2();
                const npc = arrayAtObj(Client.npcs, id);
                if (npc !== null) ClientNpc.setPrimarySeq(delay, sequence, npc);
                Protocol.packetType = -1;
                return true;
            }
            if (Protocol.packetType === 207) {
                const id = Protocol.inPacket.g4_alt3(),
                    verify = Protocol.inPacket.g2_alt2(),
                    high = Protocol.inPacket.g2(),
                    low = Protocol.inPacket.g2_alt2();
                if (Protocol.setVerifyId(verify)) DelayedStateChange.serverComponentInt(id, 13, ((high << 16) + low) | 0);
                Protocol.packetType = -1;
                return true;
            }
            if (Protocol.packetType === 50) {
                const scale = Protocol.inPacket.g4(),
                    id = Protocol.inPacket.g4_alt3();
                let item = Protocol.inPacket.g2_alt3();
                if (item === 65535) item = -1;
                if (Protocol.setVerifyId(Protocol.inPacket.g2_alt1())) {
                    const component = requireNonNull(IfType.Get(id));
                    if (!component.if3) {
                        if (item === -1) {
                            Protocol.packetType = -1;
                            component.modelType = 0;
                            return true;
                        }
                        const obj = ObjType.List(item);
                        component.modelXAngle = obj.xAngle2d;
                        component.modelId = item;
                        component.modelType = 4;
                        component.modelYAngle = obj.yAngle2d;
                        component.modelZoom = intDivide(Math.imul(obj.zoom2d, 100), scale);
                        Client.ComponentUpdated(component);
                    } else {
                        DelayedStateChange.serverObj(item, scale, id);
                        const obj = ObjType.List(item);
                        DelayedStateChange.serverAngles(id, obj.xAngle2d, obj.yAngle2d, obj.zoom2d, glJar ? -128 : undefined);
                        DelayedStateChange.serverOffsets(obj.zAngle2d, id, obj.yOffset2d, obj.xOffset2d);
                    }
                }
                Protocol.packetType = -1;
                return true;
            }
            if (Protocol.packetType === 115) {
                const verify = Protocol.inPacket.g2(),
                    signature = Protocol.inPacket.gStringNoConversion();
                const args: Hook = new Array(signature.getLength() + 1);
                for (let i = signature.getLength() - 1; i >= 0; i--) {
                    args[i + 1] = signature.charAt(i) === 115 ? Protocol.inPacket.gStringNoConversion() : Protocol.inPacket.g4();
                }
                args[0] = Protocol.inPacket.g4();
                if (Protocol.setVerifyId(verify)) {
                    const event = new HookReq();
                    event.args = args;
                    const runner = Client.activeClient?.ui?.runner ?? new ScriptRunner(ClientScript.Get);
                    const hooks = runner.run(event);
                    if (hooks instanceof Promise) await hooks;
                }
                Protocol.packetType = -1;
                return true;
            }
            if (Protocol.packetType === 81) {
                const sender = Protocol.inPacket.g8();
                Protocol.inPacket.g1s();
                const clan = Protocol.inPacket.g8();
                const world = BigInt(Protocol.inPacket.g2());
                const sequence = BigInt(Protocol.inPacket.g3());
                const rights = Protocol.inPacket.g1();
                const phrase = Protocol.inPacket.g2();
                const messageId = (world << 32n) + sequence;
                let suppressed = false;
                for (let i = 0; i < 100; i++) {
                    if (messageId === arrayAtB64(Client.privateMessageIds, i)) {
                        suppressed = true;
                        break;
                    }
                }
                if (!suppressed && rights <= 1) {
                    for (let i = 0; i < Client.ignoreCount; i++) {
                        if (arrayAtB64(Client.ignoreName37, i) === sender) {
                            suppressed = true;
                            break;
                        }
                    }
                }
                if (!suppressed && Client.withinTutorialIsland === 0) {
                    arrayPutB64(Client.privateMessageIds, Client.privateMessageCount, messageId);
                    Client.privateMessageCount = ((Client.privateMessageCount + 1) | 0) % 100;
                    const text = QuickChatPhraseTypeList.GetQuickChatPhraseType(phrase).GetText(Protocol.inPacket);
                    if (rights === 2 || rights === 3) {
                        ChatHistory.AddChat(phrase, text, requireNonNull(JagString.fromBase37(clan)).formatName(0), 20, JagString.join([Client.modCrownTag, requireNonNull(JagString.fromBase37(sender)).formatName(0)]));
                    } else if (rights === 1) {
                        ChatHistory.AddChat(phrase, text, requireNonNull(JagString.fromBase37(clan)).formatName(0), 20, JagString.join([Client.modIconTag, requireNonNull(JagString.fromBase37(sender)).formatName(0)]));
                    } else {
                        ChatHistory.AddChat(phrase, text, requireNonNull(JagString.fromBase37(clan)).formatName(0), 20, requireNonNull(JagString.fromBase37(sender)).formatName(0));
                    }
                }
                Protocol.packetType = -1;
                return true;
            }
            if (Protocol.packetType === 165) {
                const verify = Protocol.inPacket.g2_alt1();
                let last = Protocol.inPacket.g2_alt1();
                const id = Protocol.inPacket.g4();
                if (last === 65535) last = -1;
                let first = Protocol.inPacket.g2_alt2();
                const mask = Protocol.inPacket.g4_alt2();
                if (first === 65535) first = -1;
                if (Protocol.setVerifyId(verify)) {
                    for (let child = first; child <= last; child++) {
                        const key = BigInt.asIntN(64, (BigInt(id) << 32n) + BigInt(child));
                        const previous = Client.serverActiveProperties.get(key);
                        if (previous !== null && !(previous instanceof ServerActiveProperties)) throw new TypeError('ClassCastException: not a ServerActiveProperties');
                        let properties: ServerActiveProperties;
                        if (previous === null) {
                            const param = child === -1 ? requireNonNull(IfType.Get(id)).properties.targetParam : -1;
                            properties = new ServerActiveProperties(mask, param);
                        } else {
                            properties = new ServerActiveProperties(mask, previous.targetParam);
                            previous.Unlink();
                        }
                        Client.serverActiveProperties.put(properties, key);
                    }
                }
                Protocol.packetType = -1;
                return true;
            }
            if (Protocol.packetType === 86) {
                const logout = Client.Logout();
                if (logout instanceof Promise) await logout;
                Protocol.packetType = -1;
                return false;
            }
            if (Protocol.packetType === 111) {
                const verify = Protocol.inPacket.g2_alt2(),
                    id = Protocol.inPacket.g4_alt3(),
                    third = Protocol.inPacket.g2_alt3(),
                    first = Protocol.inPacket.g2_alt1(),
                    second = Protocol.inPacket.g2_alt3();
                if (Protocol.setVerifyId(verify)) DelayedStateChange.serverModel(7, (first << 16) | second, third, id);
                Protocol.packetType = -1;
                return true;
            }
            if (Protocol.packetType === 62) {
                let id = Protocol.inPacket.g8();
                let flag = true;
                if (id < 0n) {
                    flag = false;
                    id &= 0x7fffffffffffffffn;
                }
                const world = Protocol.inPacket.g2();
                const rank = Protocol.inPacket.g1();
                let worldName = JagString.empty;
                if (world > 0) worldName = Protocol.inPacket.gStringNoConversion();
                let name: JagString | null = requireNonNull(JagString.fromBase37(id)).formatName(0);
                for (let i = 0; i < Client.friendCount; i++) {
                    if (arrayAtB64(Client.friendName37, i) === id) {
                        if (arrayAtI32(Client.friendWorld, i) !== world) {
                            arrayPutI32(Client.friendWorld, i, world);
                            if (world > 0) Client.AddChat(JagString.join([name, LocalisedText.loggedIn]), JagString.empty, 5);
                            if (world === 0) Client.AddChat(JagString.join([name, LocalisedText.loggedOut]), JagString.empty, 5);
                        }
                        arrayPutObj(Client.friendWorldName, i, worldName);
                        arrayPutI32(Client.friendRank, i, rank);
                        arrayPutU8(Client.friendSameGame, i, Number(flag));
                        name = null;
                        break;
                    }
                }
                if (name !== null && Client.friendCount < 200) {
                    arrayPutB64(Client.friendName37, Client.friendCount, id);
                    arrayPutObj(Client.friendUsername, Client.friendCount, name);
                    arrayPutI32(Client.friendWorld, Client.friendCount, world);
                    arrayPutObj(Client.friendWorldName, Client.friendCount, worldName);
                    arrayPutI32(Client.friendRank, Client.friendCount, rank);
                    arrayPutU8(Client.friendSameGame, Client.friendCount, Number(flag));
                    Client.friendCount = (Client.friendCount + 1) | 0;
                }
                let limit = Client.friendCount;
                Client.friendListTransmitCycle = Client.transmitCycle;
                while (limit > 0) {
                    limit--;
                    let sorted = true;
                    for (let i = 0; i < limit; i++) {
                        const next = i + 1;
                        if ((Client.selectedWorldId === arrayAtI32(Client.friendWorld, i) || arrayAtI32(Client.friendWorld, next) !== Client.selectedWorldId) && (arrayAtI32(Client.friendWorld, i) !== 0 || arrayAtI32(Client.friendWorld, next) === 0))
                            continue;
                        sorted = false;
                        const previousWorld = arrayAtI32(Client.friendWorld, i);
                        arrayPutI32(Client.friendWorld, i, arrayAtI32(Client.friendWorld, next));
                        arrayPutI32(Client.friendWorld, next, previousWorld);
                        const previousWorldName = arrayAtObj(Client.friendWorldName, i);
                        arrayPutObj(Client.friendWorldName, i, arrayAtObj(Client.friendWorldName, next));
                        arrayPutObj(Client.friendWorldName, next, previousWorldName);
                        const previousName = arrayAtObj(Client.friendUsername, i);
                        arrayPutObj(Client.friendUsername, i, arrayAtObj(Client.friendUsername, next));
                        arrayPutObj(Client.friendUsername, next, previousName);
                        const previousId = arrayAtB64(Client.friendName37, i);
                        arrayPutB64(Client.friendName37, i, arrayAtB64(Client.friendName37, next));
                        arrayPutB64(Client.friendName37, next, previousId);
                        const previousRank = arrayAtI32(Client.friendRank, i);
                        arrayPutI32(Client.friendRank, i, arrayAtI32(Client.friendRank, next));
                        arrayPutI32(Client.friendRank, next, previousRank);
                        const previousFlag = arrayAtU8(Client.friendSameGame, i);
                        arrayPutU8(Client.friendSameGame, i, arrayAtU8(Client.friendSameGame, next));
                        arrayPutU8(Client.friendSameGame, next, previousFlag);
                    }
                    if (sorted) break;
                }
                Protocol.packetType = -1;
                return true;
            }
            if (Protocol.packetType === 159) {
                Client.LegacyUpdated();
                Client.runWeight = Protocol.inPacket.g2s();
                Protocol.packetType = -1;
                InterfaceList.miscTransmitAt = Client.transmitCycle;
                return true;
            }
            if (Protocol.packetType === 21) {
                const hide = Protocol.inPacket.g1_alt2(),
                    verify = Protocol.inPacket.g2(),
                    id = Protocol.inPacket.g4_alt1(glJar ? -66 : 4);
                if (Protocol.setVerifyId(verify)) DelayedStateChange.serverHidden(hide, id);
                Protocol.packetType = -1;
                return true;
            }
            if (Protocol.packetType === 149) {
                const verify = Protocol.inPacket.g2(),
                    parent = Protocol.inPacket.g4();
                if (Protocol.setVerifyId(verify)) {
                    const sub = InterfaceList.subInterfaces.get(BigInt(parent));
                    if (sub !== null && !(sub instanceof SubInterface)) throw new TypeError('ClassCastException: not a SubInterface');
                    if (sub !== null) {
                        const closed = Client.CloseSubinterface(sub, true);
                        if (closed instanceof Promise) await closed;
                    }
                    if (InterfaceList.pressedContinue !== null) {
                        Client.ComponentUpdated(InterfaceList.pressedContinue);
                        InterfaceList.pressedContinue = null;
                    }
                }
                Protocol.packetType = -1;
                return true;
            }
            if (Protocol.packetType === 196) {
                let id = Protocol.inPacket.g8();
                const world = Protocol.inPacket.g2();
                const rank = Protocol.inPacket.g1s();
                if (id < 0n) {
                    if (FriendChatChannel.memberCount === 0) {
                        Protocol.packetType = -1;
                        return true;
                    }
                    id &= 0x7fffffffffffffffn;
                    let i = 0;
                    for (; i < FriendChatChannel.memberCount; i++) {
                        const member = requireNonNull(arrayAtObj(FriendChatChannel.members, i));
                        if (member.key === id && member.world === world) break;
                    }
                    if (i < FriendChatChannel.memberCount) {
                        for (; i < ((FriendChatChannel.memberCount - 1) | 0); i++) arrayPutObj(FriendChatChannel.members, i, arrayAtObj(FriendChatChannel.members, i + 1));
                        FriendChatChannel.memberCount = (FriendChatChannel.memberCount - 1) | 0;
                        arrayPutObj(FriendChatChannel.members, FriendChatChannel.memberCount, null);
                    }
                } else {
                    const worldName = Protocol.inPacket.gStringNoConversion();
                    const member = new FriendChatUser();
                    member.key = id;
                    member.name = JagString.fromBase37(member.key);
                    member.worldName = worldName;
                    member.world = world;
                    member.rank = rank;
                    let i = (FriendChatChannel.memberCount - 1) | 0;
                    for (; i >= 0; i--) {
                        const other = requireNonNull(arrayAtObj(FriendChatChannel.members, i));
                        const order = requireNonNull(other.name).compare(requireNonNull(member.name));
                        if (order === 0) {
                            other.world = world;
                            other.rank = rank;
                            other.worldName = worldName;
                            Client.clanTransmitCycle = Client.transmitCycle;
                            Protocol.packetType = -1;
                            if (clientErrorHost.username === id) FriendChatChannel.selfRank = rank;
                            return true;
                        }
                        if (order < 0) break;
                    }
                    if (requireNonNull(FriendChatChannel.members).length <= FriendChatChannel.memberCount) {
                        Protocol.packetType = -1;
                        return true;
                    }
                    for (let j = (FriendChatChannel.memberCount - 1) | 0; j > i; j--) arrayPutObj(FriendChatChannel.members, j + 1, arrayAtObj(FriendChatChannel.members, j));
                    if (FriendChatChannel.memberCount === 0) FriendChatChannel.members = new Array(100).fill(null);
                    arrayPutObj(FriendChatChannel.members, i + 1, member);
                    if (clientErrorHost.username === id) FriendChatChannel.selfRank = rank;
                    FriendChatChannel.memberCount = (FriendChatChannel.memberCount + 1) | 0;
                }
                Client.clanTransmitCycle = Client.transmitCycle;
                Protocol.packetType = -1;
                return true;
            }
            if (Protocol.packetType === 26) {
                Protocol.zoneUpdateX = Protocol.inPacket.g1_alt2();
                Protocol.zoneBaseZ = Protocol.inPacket.g1();
                Protocol.packetType = -1;
                return true;
            }
            if (Protocol.packetType === 119) {
                const verify = Protocol.inPacket.g2_alt2(),
                    id = Protocol.inPacket.g4_alt1(glJar ? -48 : 4),
                    x = Protocol.inPacket.g2s(),
                    y = Protocol.inPacket.g2s_alt2();
                if (Protocol.setVerifyId(verify)) DelayedStateChange.serverPosition(x, id, y);
                Protocol.packetType = -1;
                return true;
            }
            if (Protocol.packetType === 247) {
                const sender = Protocol.inPacket.g8();
                const world = BigInt(Protocol.inPacket.g2());
                const sequence = BigInt(Protocol.inPacket.g3());
                const messageId = sequence + (world << 32n);
                const rights = Protocol.inPacket.g1();
                const phrase = Protocol.inPacket.g2();
                let suppressed = false;
                for (let i = 0; i < 100; i++) {
                    if (messageId === arrayAtB64(Client.privateMessageIds, i)) {
                        suppressed = true;
                        break;
                    }
                }
                if (!suppressed && rights <= 1) {
                    for (let i = 0; i < Client.ignoreCount; i++) {
                        if (arrayAtB64(Client.ignoreName37, i) === sender) {
                            suppressed = true;
                            break;
                        }
                    }
                }
                if (!suppressed && Client.withinTutorialIsland === 0) {
                    arrayPutB64(Client.privateMessageIds, Client.privateMessageCount, messageId);
                    Client.privateMessageCount = ((Client.privateMessageCount + 1) | 0) % 100;
                    const text = QuickChatPhraseTypeList.GetQuickChatPhraseType(phrase).GetText(Protocol.inPacket);
                    if (rights === 2) {
                        ChatHistory.AddChat(phrase, text, null, 18, JagString.join([Client.modCrownTag, requireNonNull(JagString.fromBase37(sender)).formatName(0)]));
                    } else if (rights === 1) {
                        ChatHistory.AddChat(phrase, text, null, 18, JagString.join([Client.modIconTag, requireNonNull(JagString.fromBase37(sender)).formatName(0)]));
                    } else {
                        ChatHistory.AddChat(phrase, text, null, 18, requireNonNull(JagString.fromBase37(sender)).formatName(0));
                    }
                }
                Protocol.packetType = -1;
                return true;
            }
            if (Protocol.packetType === 116) {
                const slot = Protocol.inPacket.g1();
                if (Protocol.inPacket.g1() !== 0) {
                    const packet = Protocol.inPacket;
                    packet.m_pos = (packet.m_pos - 1) | 0;
                    arrayPutObj(Client.grandExchangeOffers, slot, new StockPlayerOffer(Protocol.inPacket));
                } else {
                    arrayPutObj(Client.grandExchangeOffers, slot, new StockPlayerOffer());
                }
                Protocol.packetType = -1;
                Client.stockTransmitCycle = Client.transmitCycle;
                return true;
            }
            if (Protocol.packetType === 32) {
                Client.GetNPCPos();
                Protocol.packetType = -1;
                return true;
            }
            if (Protocol.packetType === 169) {
                Client.updateUid(24, Protocol.inPacket);
                Protocol.packetType = -1;
                return true;
            }
            if (Protocol.packetType === 191) {
                const inventory = Protocol.inPacket.g2_alt1();
                ClientInvCache.Delete(inventory);
                const ring = Client.changedInvs,
                    index = Client.invTransmitCount;
                Client.invTransmitCount = (index + 1) | 0;
                arrayPutI32(ring, index & 31, inventory & 32767);
                Protocol.packetType = -1;
                return true;
            }
            if (Protocol.packetType === 48) {
                const verify = Protocol.inPacket.g2(),
                    text = Protocol.inPacket.gStringNoConversion(),
                    id = Protocol.inPacket.g2_alt3();
                if (Protocol.setVerifyId(verify)) DelayedStateChange.serverVarcString(text, id);
                Protocol.packetType = -1;
                return true;
            }
            if (Protocol.packetType === 60) {
                const id = Protocol.inPacket.g2_alt2(),
                    value = Protocol.inPacket.g1s_alt2();
                ClientVarCache.setServer(id, value);
                Protocol.packetType = -1;
                return true;
            }
            if (Protocol.packetType === 235) {
                const info = Protocol.inPacket.g1_alt3(glJar ? true : 128);
                const angle = info & 3,
                    shape = info >> 2;
                const layer = arrayAtI32(LocShape.shapeToLayer, shape);
                let seq = Protocol.inPacket.g2(glJar ? 1 : -2386);
                const pos = Protocol.inPacket.g4(glJar ? -502942936 : 125);
                const plane = (pos >> 28) & 3;
                if (seq === 65535) seq = -1;
                let x = (pos >> 14) & 16383,
                    z = pos & 16383;
                if (glJar) {
                    z = (z - Client.mapBuildBaseZ) | 0;
                    x = (x - Client.mapBuildBaseX) | 0;
                } else {
                    x = (x - Client.mapBuildBaseX) | 0;
                    z = (z - Client.mapBuildBaseZ) | 0;
                }
                if (SceneCutover.active) {
                    if (glJar) Client.attachLocAnim(x, angle, seq, z, shape, plane, layer, 110);
                    else Client.attachLocAnim(x, angle, seq, z, shape, plane, layer);
                } else if (x >= 0 && z >= 0 && x < 103 && z < 103) {
                    requireNonNull(LocChange.scene).animateLoc?.(plane, x, z, layer, shape, angle, seq);
                }
                Protocol.packetType = -1;
                return true;
            }
            if (Protocol.packetType === 22) {
                const componentId = Protocol.inPacket.g4();
                let inventory = Protocol.inPacket.g2();
                const component = componentId < 0 ? null : IfType.Get(componentId);
                if (componentId < -70000) inventory += 32768;
                while (Protocol.inPacket.m_pos < Protocol.packetSize) {
                    const slot = Protocol.inPacket.gSmart1or2();
                    let count = 0;
                    const obj = Protocol.inPacket.g2();
                    if (obj !== 0) {
                        count = Protocol.inPacket.g1();
                        if (count === 255) count = Protocol.inPacket.g4();
                    }
                    if (component !== null && slot >= 0 && slot < requireNonNull(component.itemIds).length) {
                        arrayPutI32(component.itemIds, slot, obj);
                        arrayPutI32(component.itemCounts, slot, count);
                    }
                    ClientInvCache.Set(obj - 1, inventory, count, slot);
                }
                if (component !== null) Client.ComponentUpdated(component);
                Client.LegacyUpdated();
                const ring = Client.changedInvs,
                    index = Client.invTransmitCount;
                Client.invTransmitCount = (index + 1) | 0;
                arrayPutI32(ring, index & 31, inventory & 32767);
                Protocol.packetType = -1;
                return true;
            }
            if (Protocol.packetType === 125) {
                const verify = Protocol.inPacket.g2();
                const x = Protocol.inPacket.g1();
                const z = Protocol.inPacket.g1();
                const height = Protocol.inPacket.g2();
                const step = Protocol.inPacket.g1();
                const factor = Protocol.inPacket.g1();
                if (Protocol.setVerifyId(verify)) CinematicCamera.LookAt(step, height, x, factor, z);
                Protocol.packetType = -1;
                return true;
            }
            if (Protocol.packetType === 130) {
                const id = Protocol.inPacket.g4_alt1(glJar ? -104 : 4),
                    verify = Protocol.inPacket.g2_alt3();
                let model = Protocol.inPacket.g2_alt2();
                if (model === 65535) model = -1;
                if (Protocol.setVerifyId(verify)) DelayedStateChange.serverModel(1, model, -1, id);
                Protocol.packetType = -1;
                return true;
            }
            if (Protocol.packetType === 2) {
                const id = Protocol.inPacket.g4_alt2(),
                    verify = Protocol.inPacket.g2_alt2(),
                    colour = Protocol.inPacket.g2_alt3();
                if (Protocol.setVerifyId(verify)) DelayedStateChange.serverColour(6, id, colour);
                Protocol.packetType = -1;
                return true;
            }
            if (Protocol.packetType === 172) {
                let id = Protocol.inPacket.g2();
                if (id === 65535) id = -1;
                const loops = Protocol.inPacket.g1();
                const delay = Protocol.inPacket.g2();
                Client.PlaySynth(id, loops, delay);
                Protocol.packetType = -1;
                return true;
            }
            if (Protocol.packetType === 9) {
                const param = Protocol.inPacket.g2_alt3(),
                    id = Protocol.inPacket.g4_alt1(glJar ? -101 : 4),
                    verify = Protocol.inPacket.g2_alt2();
                let last = Protocol.inPacket.g2_alt1(),
                    first = Protocol.inPacket.g2_alt2();
                if (last === 65535) last = -1;
                if (first === 65535) first = -1;
                if (Protocol.setVerifyId(verify)) {
                    for (let child = first; child <= last; child++) {
                        const key = BigInt.asIntN(64, (BigInt(id) << 32n) + BigInt(child));
                        const previous = Client.serverActiveProperties.get(key);
                        if (previous !== null && !(previous instanceof ServerActiveProperties)) throw new TypeError('ClassCastException: not a ServerActiveProperties');
                        let properties: ServerActiveProperties;
                        if (previous === null) {
                            const mask = child === -1 ? requireNonNull(IfType.Get(id)).properties.events : 0;
                            properties = new ServerActiveProperties(mask, param);
                        } else {
                            properties = new ServerActiveProperties(previous.events, param);
                            previous.Unlink();
                        }
                        Client.serverActiveProperties.put(properties, key);
                    }
                }
                Protocol.packetType = -1;
                return true;
            }
            void reportClientError(null, 'T1 - ' + Protocol.packetType + ',' + Protocol.ptype1 + ',' + Protocol.ptype2 + ' - ' + Protocol.packetSize);
            const logout = Client.Logout();
            if (logout instanceof Promise) await logout;
            return true;
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, glJar ? 'ac.C(-83)' : 'rg.D(57)');
        }
    }

    // e.b(I)Z
    static async tryReadPacket(): Promise<boolean> {
        try {
            return await Protocol.TcpIn();
        } catch (error) {
            if (error instanceof SocketIoError) {
                const lost = Client.LostCon();
                if (lost instanceof Promise) await lost;
                return true;
            }
            if (error instanceof JavaError || !(error instanceof Error)) throw error;
            const self = requireNonNull(Client.localPlayer);
            let message =
                'T2 - ' +
                Protocol.packetType +
                ',' +
                Protocol.ptype1 +
                ',' +
                Protocol.ptype2 +
                ' - ' +
                Protocol.packetSize +
                ',' +
                ((Client.mapBuildBaseX + arrayAtI32(self.pathX, 0)) | 0) +
                ',' +
                ((arrayAtI32(self.pathZ, 0) + Client.mapBuildBaseZ) | 0) +
                ' - ';
            for (let i = 0; i < Protocol.packetSize && i < 50; i++) {
                message += ((byteAt(Protocol.inPacket.m_data, i) << 24) >> 24) + ',';
            }
            void reportClientError(error, message);
            const logout = Client.Logout();
            if (logout instanceof Promise) await logout;
            return true;
        }
    }

    // sk.b(IB)Z
    static setVerifyId(id: number): boolean {
        Protocol.sequenceAckPending = true;
        Client.verifyId = (id + 1) & 65535;
        return true;
    }
}
