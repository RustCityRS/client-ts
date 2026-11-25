// Some 530 modules initialize static fields at module evaluation. Java reaches these owners
// synchronously at their first field access or invocation, including guarded shutdown branches.
// Keeping the deferred imports here also breaks ES module cycles without yielding a game tick.

export function loadAreaSoundManager(): typeof import('#/sound/AreaSoundManager').default {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- SD tk stays deferred until its caller reaches it (he.f(I)V in HardReferenceNode.releaseHardReferenceNodeStatics).
    return (require('#/sound/AreaSoundManager') as typeof import('#/sound/AreaSoundManager')).default;
}

export function loadBrowserControl(): typeof import('./BrowserControl').default {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- SD w stays deferred until its caller reaches it (al.a(I)V in Js5MasterIndex.releaseHdStatics).
    return (require('./BrowserControl') as typeof import('./BrowserControl')).default;
}

export function loadByteArrayPool(): typeof import('#/io/ByteArrayPool').default {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- ByteArrayPool stays deferred until its caller reaches it (bb.b(I)V in BZip2State.releaseHdStatics).
    return (require('#/io/ByteArrayPool') as typeof import('#/io/ByteArrayPool')).default;
}

export function loadChatHistory(): typeof import('#/game/ChatHistory').default {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- ChatHistory stays deferred until its caller reaches it (th.a(I)V in ModelSource.releaseModelSourceStatics).
    return (require('#/game/ChatHistory') as typeof import('#/game/ChatHistory')).default;
}

export function loadClient(): typeof import('#/client/Client').default {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- SD client stays deferred until its caller reaches it (bb.b(I)V in BZip2State.releaseHdStatics).
    return (require('#/client/Client') as typeof import('#/client/Client')).default;
}

export function loadClientBuild(): typeof import('#/client/ClientBuild').default {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- ClientBuild stays deferred until its caller reaches it (bb.b(I)V in BZip2State.releaseHdStatics).
    return (require('#/client/ClientBuild') as typeof import('#/client/ClientBuild')).default;
}

export function loadClientKeyboardListener(): typeof import('#/client/ClientKeyboardListener').default {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- SD vb stays deferred until its caller reaches it (bg.b(Z)V in Js5RemoteLoader.releaseJs5RemoteLoaderStatics).
    return (require('#/client/ClientKeyboardListener') as typeof import('#/client/ClientKeyboardListener')).default;
}

export function loadClientPlayer(): typeof import('#/dash3d/ClientPlayer').default {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- SD pb stays deferred until its caller reaches it (ke.h(I)V in TextureOpPolarDistortion.releaseTextureOpPolarDistortionStatics).
    return (require('#/dash3d/ClientPlayer') as typeof import('#/dash3d/ClientPlayer')).default;
}

export function loadComponentDrag(): typeof import('#/ui/ComponentDrag').default {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- SD fl stays deferred until its caller reaches it (u.a(B)V in ByteArrayCopier.releaseHdStatics).
    return (require('#/ui/ComponentDrag') as typeof import('#/ui/ComponentDrag')).default;
}

export function loadCookieStatics(): typeof import('./CookieStatics').default {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- SD gi stays deferred until its caller reaches it (u.a(B)V in ByteArrayCopier.releaseHdStatics).
    return (require('./CookieStatics') as typeof import('./CookieStatics')).default;
}

export function loadCursorType(): typeof import('#/config/CursorType').default {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- SD dl stays deferred until its caller reaches it (ge.a(Z)V in DataFile.releaseHdStatics).
    return (require('#/config/CursorType') as typeof import('#/config/CursorType')).default;
}

export function loadDelayedStateChange(): typeof import('#/ui/DelayedStateChange').default {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- SD ce stays deferred until its caller reaches it (ve.a(I)V in Js5.releaseHdStatics).
    return (require('#/ui/DelayedStateChange') as typeof import('#/ui/DelayedStateChange')).default;
}

export function loadEnumType(): typeof import('#/config/EnumType').default {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- SD lg stays deferred until its caller reaches it (lj.c(I)V in MillisTimer.releaseMillisTimerStatics).
    return (require('#/config/EnumType') as typeof import('#/config/EnumType')).default;
}

export function loadEnvironment(): typeof import('#/dash3d/Environment').default {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- HD li stays deferred until its caller reaches it (ui.a(IIZIII)V in Client.drawScene).
    return (require('#/dash3d/Environment') as typeof import('#/dash3d/Environment')).default;
}

export function loadFonts(): typeof import('#/graphics/Fonts').default {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- Fonts stays deferred until its caller reaches it (bh.b(I)V in MapSpotAnim.releaseMapSpotAnimStatics).
    return (require('#/graphics/Fonts') as typeof import('#/graphics/Fonts')).default;
}

export function loadGameShell(): typeof import('#/client/GameShell').default {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- SD p stays deferred until its caller reaches it (lj.c(I)V in MillisTimer.releaseMillisTimerStatics).
    return (require('#/client/GameShell') as typeof import('#/client/GameShell')).default;
}

export function loadGameWorld(): typeof import('#/io/GameWorld').default {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- SD qk stays deferred until its caller reaches it (ii.a(I)V in Js5Index.releaseHdStatics).
    return (require('#/io/GameWorld') as typeof import('#/io/GameWorld')).default;
}

export function loadGlAlphaSprite(): typeof import('#/gl/GlAlphaSprite').default {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- HD el stays deferred until its caller reaches it (aj.c(ZI)Lvc; in IfType.GetGraphic).
    return (require('#/gl/GlAlphaSprite') as typeof import('#/gl/GlAlphaSprite')).default;
}

export function loadGlLighting(): typeof import('#/gl/GlLighting').default {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- HD mk stays deferred until its caller reaches it (qc.a(IIIII[[[B[I[I[I[I[IIBII)V in world.draw).
    return (require('#/gl/GlLighting') as typeof import('#/gl/GlLighting')).default;
}

export function loadGlModel(): typeof import('#/dash3d/GlModel').default {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- HD td stays deferred until its caller reaches it (lb.a(Z)V in Client.reloadWindowResources).
    return (require('#/dash3d/GlModel') as typeof import('#/dash3d/GlModel')).default;
}

export function loadGlRaster(): typeof import('#/gl/GlRaster').default {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- HD dj stays deferred until its caller reaches it (vj.a(IIIIIII)V in Client.GdmEntityOverlays).
    return (require('#/gl/GlRaster') as typeof import('#/gl/GlRaster')).default;
}

export function loadGlRenderer(): typeof import('#/gl/GlRenderer').default {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- HD tf stays deferred until its caller reaches it (nl.a(ZBLid;)V in GameShell.openUrl).
    return (require('#/gl/GlRenderer') as typeof import('#/gl/GlRenderer')).default;
}

export function loadGlSolidTexture(): typeof import('#/gl/GlSolidTexture').default {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- HD sd stays deferred until its caller reaches it (client.c(I)V in Client.releaseHdStatics).
    return (require('#/gl/GlSolidTexture') as typeof import('#/gl/GlSolidTexture')).default;
}

export function loadGlSprite(): typeof import('#/gl/GlSprite').default {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- HD cf stays deferred until its caller reaches it (lf.a(I[Laj;IIIIIIZI)V in Client.DrawLayer).
    return (require('#/gl/GlSprite') as typeof import('#/gl/GlSprite')).default;
}

export function loadIfType(): typeof import('#/ui/IfType').default {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- SD aj stays deferred until its caller reaches it (nd.c(B)V in ColourImageCache.releaseHdStatics).
    return (require('#/ui/IfType') as typeof import('#/ui/IfType')).default;
}

export function loadInterfaceList(): typeof import('#/ui/InterfaceList').default {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- InterfaceList stays deferred until its caller reaches it (wl.a(I)V in FloType.releaseHdStatics).
    return (require('#/ui/InterfaceList') as typeof import('#/ui/InterfaceList')).default;
}

export function loadInvType(): typeof import('#/config/InvType').default {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- SD pj stays deferred until its caller reaches it (ha.b(I)V in Js5Compression.releaseHdStatics).
    return (require('#/config/InvType') as typeof import('#/config/InvType')).default;
}

export function loadJagString(): typeof import('#/datastruct/JagString').default {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- SD id stays deferred until its caller reaches it (pa.f(B)V in ClientObjNode.releaseClientObjNodeStatics).
    return (require('#/datastruct/JagString') as typeof import('#/datastruct/JagString')).default;
}

export function loadJavaError(): typeof import('./ClientError').JavaError {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- ClientError stays deferred until its caller reaches it (id.a(Ljava/applet/Applet;B)Ljava/lang/Object; in JagString.callScript).
    return (require('./ClientError') as typeof import('./ClientError')).JavaError;
}

export function loadLocalisedText(): typeof import('#/ui/LocalisedText').default {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- SD aa stays deferred until its caller reaches it (u.a(B)V in ByteArrayCopier.releaseHdStatics).
    return (require('#/ui/LocalisedText') as typeof import('#/ui/LocalisedText')).default;
}

export function loadLocType(): typeof import('#/config/LocType').default {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- SD jb stays deferred until its caller reaches it (jg.a(B)V in IntHashTable.releaseHdStatics).
    return (require('#/config/LocType') as typeof import('#/config/LocType')).default;
}

export function loadLogin(): typeof import('#/io/Login').default {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- Login stays deferred until its caller reaches it (um.i(I)V in TextureOpColourGradient.releaseTextureOpColourGradientStatics).
    return (require('#/io/Login') as typeof import('#/io/Login')).default;
}

export function loadMaterialManager(): typeof import('#/gl/material/MaterialManager').default {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- MaterialManager stays deferred until its caller reaches it (v.a(I)V in Js5ResourceProvider.releaseJs5ResourceProviderStatics).
    return (require('#/gl/material/MaterialManager') as typeof import('#/gl/material/MaterialManager')).default;
}

export function loadMinimapBuilder(): typeof import('#/dash3d/MinimapBuilder').default {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- SD ph stays deferred until its caller reaches it (ha.b(I)V in Js5Compression.releaseHdStatics).
    return (require('#/dash3d/MinimapBuilder') as typeof import('#/dash3d/MinimapBuilder')).default;
}

export function loadMinimenu(): typeof import('#/ui/Minimenu').default {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- Minimenu stays deferred until its caller reaches it (v.a(I)V in Js5ResourceProvider.releaseJs5ResourceProviderStatics).
    return (require('#/ui/Minimenu') as typeof import('#/ui/Minimenu')).default;
}

export function loadModelLitImpl(): typeof import('#/dash3d/ModelLitImpl').default {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- SD fc stays deferred until its caller reaches it (he.a(IIIIZZI)V in GameShell.applyWindowMode).
    return (require('#/dash3d/ModelLitImpl') as typeof import('#/dash3d/ModelLitImpl')).default;
}

export function loadMSITypeList(): typeof import('#/config/MSITypeList').default {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- SD kh stays deferred until its caller reaches it (uf.a(I)V in ClientKeyboardListener.releaseHdStatics).
    return (require('#/config/MSITypeList') as typeof import('#/config/MSITypeList')).default;
}

export function loadNpcType(): typeof import('#/config/NpcType').default {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- SD ja stays deferred until its caller reaches it (eh.a(B)V in VarpType.releaseHdStatics).
    return (require('#/config/NpcType') as typeof import('#/config/NpcType')).default;
}

export function loadObjType(): typeof import('#/config/ObjType').default {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- SD kl stays deferred until its caller reaches it (kl.c(I)V in FriendChatUser.releaseFriendChatUserStatics).
    return (require('#/config/ObjType') as typeof import('#/config/ObjType')).default;
}

export function loadOrbitCamera(): typeof import('#/client/OrbitCamera').default {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- SD hj stays deferred until its caller reaches it (qg.a(Z)V in TextureOpVerticalGradient.releaseTextureOpVerticalGradientStatics).
    return (require('#/client/OrbitCamera') as typeof import('#/client/OrbitCamera')).default;
}

export function loadPlayerModel(): typeof import('#/dash3d/PlayerModel').default {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- SD cl stays deferred until its caller reaches it (qe.c(I)V in ClientInvCache.releaseClientInvCacheStatics).
    return (require('#/dash3d/PlayerModel') as typeof import('#/dash3d/PlayerModel')).default;
}

export function loadPointLightManager(): typeof import('#/gl/PointLightManager').default {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- HD jf stays deferred until its caller reaches it (qc.a(IIIII[[[B[I[I[I[I[IIBII)V in world.draw).
    return (require('#/gl/PointLightManager') as typeof import('#/gl/PointLightManager')).default;
}

export function loadPreferences(): typeof import('#/ui/Preferences').default {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- Preferences stays deferred until its caller reaches it (he.a(IIIIZZI)V in GameShell.applyWindowMode).
    return (require('#/ui/Preferences') as typeof import('#/ui/Preferences')).default;
}

export function loadProceduralTexture(): typeof import('#/dash3d/ProceduralTexture').default {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- SD jd stays deferred until its caller reaches it (i.q(I)V in SuperPacket.releaseSuperPacketStatics).
    return (require('#/dash3d/ProceduralTexture') as typeof import('#/dash3d/ProceduralTexture')).default;
}

export function loadProtocol(): typeof import('#/io/Protocol').default {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- SD rg stays deferred until its caller reaches it (eg.a(I)V in SpotType.releaseHdStatics).
    return (require('#/io/Protocol') as typeof import('#/io/Protocol')).default;
}

export function loadQuickChatCatTypeList(): typeof import('#/config/QuickChatCatTypeList').default {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- QuickChatCatTypeList stays deferred until its caller reaches it (fm.h(I)V in TextureOpColour.releaseTextureOpColourStatics).
    return (require('#/config/QuickChatCatTypeList') as typeof import('#/config/QuickChatCatTypeList')).default;
}

export function loadQuickChatPhraseType(): typeof import('#/config/QuickChatPhraseType').default {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- SD pe stays deferred until its caller reaches it (rc.a(I)V in GameShell.releaseGameShellStatics).
    return (require('#/config/QuickChatPhraseType') as typeof import('#/config/QuickChatPhraseType')).default;
}

export function loadQuickChatPhraseTypeList(): typeof import('#/config/QuickChatPhraseTypeList').default {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- QuickChatPhraseTypeList stays deferred until its caller reaches it (ud.e(I)V in ClientProjNode.releaseClientProjNodeStatics).
    return (require('#/config/QuickChatPhraseTypeList') as typeof import('#/config/QuickChatPhraseTypeList')).default;
}

export function loadReflectionCheck(): typeof import('#/io/ReflectionCheck').default {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- SD qj stays deferred until its caller reaches it (qi.d(B)V in MonochromeImageCacheEntry.releaseMonochromeImageCacheEntryStatics).
    return (require('#/io/ReflectionCheck') as typeof import('#/io/ReflectionCheck')).default;
}

export function loadRoofModeStatics(): typeof import('#/dash3d/RoofModeStatics').default {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- SD ia stays deferred until its caller reaches it (ge.a(Z)V in DataFile.releaseHdStatics).
    return (require('#/dash3d/RoofModeStatics') as typeof import('#/dash3d/RoofModeStatics')).default;
}

export function loadRouteFinding(): typeof import('#/movement/RouteFinding').default {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- RouteFinding stays deferred until its caller reaches it (nd.c(B)V in ColourImageCache.releaseHdStatics).
    return (require('#/movement/RouteFinding') as typeof import('#/movement/RouteFinding')).default;
}

export function loadScriptRunner(): typeof import('#/script/ScriptRunner').default {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- ScriptRunner stays deferred until its caller reaches it (sg.a(I)V in StockPlayerOffer.releaseHdStatics).
    return (require('#/script/ScriptRunner') as typeof import('#/script/ScriptRunner')).default;
}

export function loadSpotType(): typeof import('#/config/SpotType').default {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- SD li stays deferred until its caller reaches it (ke.h(I)V in TextureOpPolarDistortion.releaseTextureOpPolarDistortionStatics).
    return (require('#/config/SpotType') as typeof import('#/config/SpotType')).default;
}

export function loadSpriteLoader(): typeof import('#/graphics/SpriteLoader').default {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- SpriteLoader stays deferred until its caller reaches it (wl.a(I)V in FloType.releaseHdStatics).
    return (require('#/graphics/SpriteLoader') as typeof import('#/graphics/SpriteLoader')).default;
}

export function loadStructType(): typeof import('#/config/StructType').default {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- SD af stays deferred until its caller reaches it (bm.a(B)V in GroundDecor.releaseHdStatics).
    return (require('#/config/StructType') as typeof import('#/config/StructType')).default;
}

export function loadTerrainBuilder(): typeof import('#/dash3d/TerrainBuilder').default {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- TerrainBuilder stays deferred until its caller reaches it (ec.a(I)V in Sprite.releaseHdStatics).
    return (require('#/dash3d/TerrainBuilder') as typeof import('#/dash3d/TerrainBuilder')).default;
}

export function loadTextureCache(): typeof import('#/dash3d/TextureCache').default {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- SD kg stays deferred until its caller reaches it (he.a(IIIIZZI)V in GameShell.applyWindowMode).
    return (require('#/dash3d/TextureCache') as typeof import('#/dash3d/TextureCache')).default;
}

export function loadTitleFlames(): typeof import('#/title/TitleFlames').default {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- TitleFlames stays deferred until its caller reaches it (bb.b(I)V in BZip2State.releaseHdStatics).
    return (require('#/title/TitleFlames') as typeof import('#/title/TitleFlames')).default;
}

export function loadTitleScreen(): typeof import('#/title/TitleScreen').default {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- TitleScreen stays deferred until its caller reaches it (he.a(IIIIZZI)V in GameShell.applyWindowMode).
    return (require('#/title/TitleScreen') as typeof import('#/title/TitleScreen')).default;
}

export function loadTone(): typeof import('#/sound/Tone').default {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- The gamepack initializes its synthesis buffers on first active use of fj/pj.
    return (require('#/sound/Tone') as typeof import('#/sound/Tone')).default;
}

export function loadVarpType(): typeof import('#/config/VarpType').default {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- SD bb stays deferred until its caller reaches it (sm.a(B)V in LocEntity.releaseHdStatics).
    return (require('#/config/VarpType') as typeof import('#/config/VarpType')).default;
}

export function loadWorld(): typeof import('#/dash3d/world').default {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- world stays deferred until its caller reaches it (ha.b(I)V in Js5Compression.releaseHdStatics).
    return (require('#/dash3d/world') as typeof import('#/dash3d/world')).default;
}

export function loadWorldList(): typeof import('#/io/WorldList').default {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- WorldList stays deferred until its caller reaches it (nd.c(B)V in ColourImageCache.releaseHdStatics).
    return (require('#/io/WorldList') as typeof import('#/io/WorldList')).default;
}

export function loadWorldMap(): typeof import('#/ui/WorldMap').default {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- WorldMap stays deferred until its caller reaches it (rc.a(I)V in GameShell.releaseGameShellStatics).
    return (require('#/ui/WorldMap') as typeof import('#/ui/WorldMap')).default;
}

export function loadWorldMapLabels(): typeof import('#/ui/WorldMapLabels').default {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- SD kc stays deferred until its caller reaches it (e.d(B)V in ClientPlayer.releaseClientPlayerStatics).
    return (require('#/ui/WorldMapLabels') as typeof import('#/ui/WorldMapLabels')).default;
}
