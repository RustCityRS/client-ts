import type JagString from '#/datastruct/JagString';
import type FriendChatUser from './FriendChatUser';

// The 530 full and single-user updates both run in rg.a(B)Z. The channel
// stores match social::FriendChatChannel in projects/osclient/social/FriendChatChannel.h.
export default class FriendChatChannel {
    static members: (FriendChatUser | null)[] | null = null; // jl.b:[Lrf;
    static memberCount = 0; // uh.N:I
    static channelName: JagString | null = null; // dk.P:Lid;
    static ownerName: JagString | null = null; // hg.g:Lid;
    static selfRank = 0; // ve.r:B
    static minKick = 0; // mh.g:B
}
