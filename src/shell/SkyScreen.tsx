import { useCallback, useEffect, useMemo, useReducer, useRef, useState, type ComponentRef } from "react";
import { AccessibilityInfo, Image, Linking, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { createAnalytics } from "../domain/analytics";
import type { PipelineStageImages } from "../domain/generation";
import { INITIAL_FOV } from "../domain/constants";
import { appReducer, initialAppState } from "./appReducer";
import { ActionBar } from "../components/ActionBar";
import { GenerationPanel } from "../components/GenerationPanel";
import { ControlButton } from "../components/ControlButton";
import { palette, rounded } from "../theme";
import { StarDetails } from "../components/StarDetails";
import { loadBundledCatalog } from "../features/catalog/catalogLoader";
import { displayName } from "../features/catalog/displayName";
import { revealedSegments } from "../features/constellation/animation";
import { selectMinZoomCandidates } from "../features/constellation/candidateSelection";
import { createConstellation } from "../features/constellation/createConstellation";
import { sessionSky } from "../features/constellation/sessionSky";
import { requestDrawing } from "../features/generation/generationClient";
import { pickSubjectPhoto, type PickedSubject } from "../features/generation/pickSubjectPhoto";
import { sharePng } from "../features/share/exportPng";
import { SkyView, type SkyViewHandle } from "../features/starfield/SkyView";
import { RoomPanel } from "../components/RoomPanel";
import { roomConstellationToCustom } from "../features/rooms/roomMapper";
import { initialRoomState, roomReducer } from "../features/rooms/roomReducer";
import { useRoom } from "../features/rooms/useRoom";

const analytics = createAnalytics();
const HYG_URL = "https://github.com/astronexus/HYG-Database";

function addedDate(value: number | Date | null | undefined): string | null {
  if (value == null) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

const BOTTOM_STAGE_IMAGES: { key: keyof PipelineStageImages; label: string }[] = [
  { key: "found", label: "1 Found" },
  { key: "mask", label: "2 Mask" },
  { key: "skeleton", label: "3 Skeleton" },
  { key: "nodes", label: "4 Nodes" },
];

export function SkyScreen() {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const [compactSky, setCompactSky] = useState(false);
  const [dockCollapsed, setDockCollapsed] = useState(false);
  const [photo, setPhoto] = useState<PickedSubject | null>(null);
  const dockHeight = Math.min(360, (height - insets.top - insets.bottom) * 0.44);
  const stars = useMemo(() => loadBundledCatalog(), []);
  const byId = useMemo(() => new Map(stars.map((star) => [star.id, star])), [stars]);
  const [state, dispatch] = useReducer(appReducer, initialAppState);
  const [roomState, roomDispatch] = useReducer(roomReducer, initialRoomState);
  const [shareMessage, setShareMessage] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const [reveal, setReveal] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [showSubject, setShowSubject] = useState(false);
  const skyRef = useRef<SkyViewHandle>(null);
  const dockRef = useRef<ComponentRef<typeof ScrollView>>(null);
  const dockGesture = useMemo(
    () => Gesture.Pan().minDistance(12).runOnJS(true).onEnd((event) => {
      if (event.translationY > 45 || event.velocityY > 600) setDockCollapsed(true);
      if (event.translationY < -45 || event.velocityY < -600) setDockCollapsed(false);
    }),
    [],
  );

  const onPublishFailed = useCallback(
    (message: string) => dispatch({ type: "set_status", message }),
    [],
  );

  const room = useRoom({
    roomState,
    dispatch: roomDispatch,
    getFallbackAim: () => skyRef.current?.getAim() ?? { quaternion: [0, 0, 0, 1], fov: INITIAL_FOV },
    onPublishFailed,
  });

  useEffect(() => {
    dockRef.current?.scrollTo({ y: 0, animated: false });
  }, [state.constellation?.id, state.selectedStarId]);

  useEffect(() => {
    setShowSubject(false);
  }, [state.constellation?.id]);

  useEffect(() => {
    analytics.track({ name: "app_opened", at: Date.now() });
    void AccessibilityInfo.isReduceMotionEnabled().then(setReducedMotion);
  }, []);

  useEffect(() => {
    const constellation = state.constellation;
    if (!constellation || constellation.source === "manual" || state.edited) {
      setReveal(constellation?.segments.length ?? 0);
      return;
    }
    if (reducedMotion) {
      setReveal(constellation.segments.length);
      return;
    }
    const started = Date.now();
    let frame = 0;
    const tick = () => {
      const next = revealedSegments(Date.now() - started, constellation.segments.length, false);
      setReveal(next);
      if (next < constellation.segments.length) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [reducedMotion, state.constellation, state.edited]);

  const generate = () => {
    if (!photo || state.skyLocked) return;
    const projected = skyRef.current?.getProjected() ?? [];
    const size = skyRef.current?.getSize() ?? { width: 1, height: 1 };
    const fov = skyRef.current?.getFov() ?? INITIAL_FOV;
    const candidates = selectMinZoomCandidates(projected, size.width, size.height, fov);
    dispatch({ type: "generation_started" });
    analytics.track({ name: "generation_started", at: Date.now() });
    void createConstellation({
      image: photo.image,
      prompt: state.prompt,
      candidates,
      viewportWidth: size.width,
      viewportHeight: size.height,
      fov,
      request: requestDrawing,
    }).then((result) => {
      if (result.kind === "zoom-out") {
        dispatch({ type: "generation_needs_zoom" });
        return;
      }
      if (result.kind === "unreachable") {
        dispatch({ type: "generation_unreachable" });
        return;
      }
      if (result.kind === "segmentation-unavailable") {
        dispatch({ type: "generation_segmentation_unavailable" });
        return;
      }
      if (result.kind === "segmentation-model-unavailable") {
        dispatch({ type: "generation_segmentation_model_unavailable" });
        return;
      }
      if (result.kind === "segmentation-out-of-memory") {
        dispatch({ type: "generation_segmentation_out_of_memory" });
        return;
      }
      if (result.kind === "no-subject") {
        dispatch({ type: "generation_no_subject" });
        return;
      }
      if (result.kind === "timeout") {
        dispatch({ type: "generation_timeout" });
        return;
      }
      if (result.kind === "failed") {
        dispatch({ type: "generation_failed" });
        return;
      }
      analytics.track({ name: "generation_completed", at: Date.now() });
      dispatch({
        type: "generation_finished",
        constellation: result.constellation,
        at: Date.now(),
        inputPhotoUri: photo.previewUri,
        generationProbe: result.stageImages
          ? {
              stages: result.stageImages,
              client: result.clientTrace,
              ...(result.serverDebug ? { server: result.serverDebug } : {}),
            }
          : null,
      });
      const aim = skyRef.current?.getAim();
      if (aim) void room.publishConstellation(result.constellation, aim);
    }).catch(() => {
      dispatch({ type: "generation_failed" });
    });
  };

  const choosePhoto = () => {
    if (state.skyLocked) return;
    void pickSubjectPhoto().then((result) => {
      if (result === "denied") {
        dispatch({ type: "set_status", message: "Photo library access is needed to choose a subject." });
        return;
      }
      if (result === "canceled") return;
      setShareMessage(null);
      setPhoto(result);
    });
  };

  const savedSubject = state.sessionConstellations.find((item) => item.constellation.id === state.constellation?.id)?.subjectPng ?? null;
  const subjectUri = savedSubject ? `data:image/png;base64,${savedSubject}` : null;
  const selected = state.selectedStarId != null ? byId.get(state.selectedStarId) : undefined;
  const revealValue = state.edited || state.constellation?.source === "manual" ? (state.constellation?.segments.length ?? 0) : reveal;
  const sky = useMemo(
    () => sessionSky(state.sessionConstellations.map((item) => item.constellation), state.constellation),
    [state.constellation, state.sessionConstellations],
  );
  const skyReveal = state.constellation ? sky.settledCount + revealValue : sky.settledCount;

  const share = async () => {
    if (!state.constellation || sharing) return;
    setSharing(true);
    setShareMessage(null);
    try {
      const uri = await skyRef.current?.capturePng({
        name: state.constellation.name,
        story: state.constellation.story,
        attribution: "Stars from the HYG Database v4.2. Made with Orbit.",
      });
      if (!uri) throw new Error("Snapshot unavailable");
      analytics.track({ name: "share_exported", at: Date.now() });
      if (!(await sharePng(uri))) setShareMessage("Sharing isn’t available on this device.");
    } catch {
      setShareMessage("Couldn’t share this sky. Please try again.");
    } finally {
      setSharing(false);
    }
  };

  return (
    <View style={styles.screen}>
      {!dockCollapsed ? <View style={[styles.header, { paddingTop: insets.top + 14 }]}>
        <Text accessibilityRole="header" style={styles.title}>Orbit</Text>
      </View> : null}
      <View style={styles.sky} onLayout={(event) => setCompactSky(event.nativeEvent.layout.height < 190)}>
        <SkyView
          ref={skyRef}
          stars={stars}
          segments={sky.segments}
          reveal={skyReveal}
          overlaySegments={state.constellation?.segments ?? []}
          overlayReveal={revealValue}
          selectedStarId={state.selectedStarId}
          interactionEnabled={!state.skyLocked}
          subjectUri={subjectUri}
          subjectVisible={showSubject && subjectUri != null}
          onToggleSubject={() => {
            if (!subjectUri) return;
            setShowSubject((visible) => !visible);
          }}
          onSelectStar={(id) => {
            const before = state.constellation?.segments.length ?? 0;
            dispatch({ type: "select_star", id, at: Date.now() });
            if (state.mode === "manual" && state.pathStarId != null && state.pathStarId !== id) {
              analytics.track({ name: "manual_segment_added", at: Date.now(), detail: { before } });
            }
          }}
        />
        <View style={[styles.navigation, compactSky && styles.compactNavigation, dockCollapsed && { top: insets.top + 16 }]}>
          <ControlButton label="Zoom in" symbol="+" disabled={state.skyLocked} onPress={() => skyRef.current?.zoomBy(-8)} />
          <ControlButton label="Zoom out" symbol="−" disabled={state.skyLocked} onPress={() => skyRef.current?.zoomBy(8)} />
          <ControlButton label="Reset view" symbol="↺" disabled={state.skyLocked} onPress={() => skyRef.current?.reset()} />
        </View>
        {!dockCollapsed ? <View pointerEvents="none" style={styles.skyCaption}>
          <Text style={styles.skyHint}>{state.mode === "manual" ? "Tap two stars to draw a line" : "Drag to explore  ·  Pinch to zoom"}</Text>
        </View> : null}
      </View>
      <View style={[styles.dock, { height: dockCollapsed ? 52 + insets.bottom : dockHeight, paddingBottom: dockCollapsed ? insets.bottom : state.generationProbe ? 8 : Math.max(insets.bottom, 12) }]}>
        <GestureDetector gesture={dockGesture}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={dockCollapsed ? "Show Orbit controls" : "Hide controls to see the full star map"}
            onPress={() => setDockCollapsed((collapsed) => !collapsed)}
            style={styles.dockHandle}
          >
            <View style={styles.dockGrip} />
            <Text style={styles.dockHandleText}>{dockCollapsed ? "Swipe up for controls" : "Swipe down for full sky"}</Text>
          </Pressable>
        </GestureDetector>
        {!dockCollapsed ? (
        <ScrollView
          ref={dockRef}
          style={styles.dockScroll}
          contentContainerStyle={styles.dockContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {selected ? (
            <StarDetails
              id={selected.id}
              name={displayName(selected)}
              magnitude={selected.magnitude}
              constellation={selected.constellation}
              designation={selected.designation}
              onClose={() => dispatch({ type: "clear_selection" })}
            />
          ) : null}
          {roomState.status === "connected" && roomState.constellations.length > 0 ? (
            <View style={styles.session}>
              <Text style={styles.sessionLabel}>In this room</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sessionRow}>
                {roomState.constellations.map((item) => {
                  const active = roomState.selectedSharedId === item.sharedId;
                  const mine = item.ownerUid === roomState.uid;
                  const date = addedDate(item.createdAt);
                  return (
                    <Pressable
                      key={item.sharedId}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      onPress={() => {
                        room.selectShared(item.sharedId);
                        dispatch({ type: "select_room_constellation", constellation: roomConstellationToCustom(item) });
                        skyRef.current?.focusAim(item.aim);
                        setShowSubject(false);
                      }}
                      style={[styles.sessionChip, active && styles.sessionChipActive]}
                    >
                      <Text style={styles.sessionChipText}>
                        {item.name}
                        {mine ? " · Mine" : ` · ${item.ownerLabel}`}
                      </Text>
                      {active && date ? (
                        <Text style={styles.sessionChipDate}>Added {date}</Text>
                      ) : null}
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          ) : null}
          {state.sessionConstellations.length > 0 ? (
            <View style={styles.session}>
              <Text style={styles.sessionLabel}>This session</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sessionRow}>
                {state.sessionConstellations.map((item) => {
                  const active = roomState.selectedSharedId == null && item.constellation.id === state.constellation?.id;
                  const date = addedDate(item.addedAt);
                  return (
                    <Pressable
                      key={item.constellation.id}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      onPress={() => {
                        room.selectShared(null);
                        dispatch({ type: "recall_constellation", id: item.constellation.id });
                      }}
                      style={[styles.sessionChip, active && styles.sessionChipActive]}
                    >
                      <Text style={styles.sessionChipText}>{item.constellation.name}</Text>
                      {active && date ? <Text style={styles.sessionChipDate}>Added {date}</Text> : null}
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          ) : null}
          <RoomPanel
            room={roomState}
            busy={roomState.status === "authenticating"}
            onCreate={() => void room.createRoom()}
            onJoin={(code) => void room.joinRoom(code)}
            onLeave={() => void room.leaveRoom()}
            onDraftChange={room.setJoinDraft}
            onClearError={room.clearRoomError}
            onRetryPublish={() => void room.retryPublish()}
          />
          <GenerationPanel
            imageUri={photo?.previewUri ?? null}
            subjectPrompt={state.prompt}
            running={state.generationStatus === "running"}
            onSubjectPromptChange={(prompt) => dispatch({ type: "set_prompt", prompt })}
            onPick={choosePhoto}
            onGenerate={generate}
          />
          <View style={styles.tools}>
            <ActionBar
              canUndo={(state.constellation?.segments.length ?? 0) > 0}
              canClear={(state.constellation?.segments.length ?? 0) > 0}
              manualMode={state.mode === "manual"}
              confirmClear={state.confirmClear}
              hasConstellation={state.constellation != null}
              disabled={state.skyLocked || sharing}
              onUndo={() => dispatch({ type: "undo", at: Date.now() })}
              onToggleManual={() => dispatch({ type: "toggle_manual" })}
              onClear={() => dispatch({ type: "request_clear" })}
              onConfirmClear={() => dispatch({ type: "confirm_clear" })}
              onCancelClear={() => dispatch({ type: "cancel_clear" })}
              onRegenerate={() => {
                if (!photo) {
                  dispatch({ type: "set_status", message: "Choose a photo to draw a constellation." });
                  return;
                }
                generate();
              }}
              onShare={() => void share()}
            />
          </View>
          {shareMessage || sharing || state.statusMessage !== initialAppState.statusMessage ? (
            <Text selectable accessibilityLiveRegion="polite" style={styles.live}>
              {shareMessage ?? (sharing ? "Preparing your sky…" : state.statusMessage)}
            </Text>
          ) : null}
          <Pressable accessibilityRole="link" accessibilityLabel="HYG Database attribution" onPress={() => void Linking.openURL(HYG_URL)} style={styles.attributionLink}>
            <Text style={styles.attribution}>Mapped with the HYG star catalog</Text>
          </Pressable>
        </ScrollView>
        ) : null}
      </View>
      {state.generationProbe && !dockCollapsed ? (
        <View style={[styles.stageBar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
          {BOTTOM_STAGE_IMAGES.map(({ key, label }) => (
            <View key={key} style={styles.stageCell}>
              <Image
                accessibilityIgnoresInvertColors
                accessibilityLabel={label}
                source={{ uri: `data:image/png;base64,${state.generationProbe!.stages[key]}` }}
                style={styles.stageThumb}
              />
              <Text style={styles.stageCaption}>{label}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.sky },
  header: { paddingHorizontal: 24, paddingBottom: 20, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: palette.border },
  title: { fontFamily: rounded, color: palette.text, fontSize: 38, letterSpacing: -1 },
  sky: { flex: 1, minHeight: 100, overflow: "hidden" },
  navigation: { position: "absolute", top: 16, right: 16, gap: 8 },
  compactNavigation: { flexDirection: "row" },
  skyCaption: { position: "absolute", left: 16, right: 16, bottom: 12, alignItems: "center" },
  skyHint: { fontFamily: rounded, color: palette.muted, fontSize: 13, backgroundColor: palette.sky, paddingHorizontal: 10, paddingVertical: 4 },
  dock: { flexShrink: 1, backgroundColor: palette.surface, borderTopWidth: 1, borderTopColor: palette.border },
  dockHandle: { minHeight: 48, alignItems: "center", justifyContent: "center", gap: 6 },
  dockGrip: { width: 38, height: 4, borderRadius: 2, backgroundColor: palette.muted },
  dockHandleText: { fontFamily: rounded, color: palette.secondary, fontSize: 12 },
  dockScroll: { flexGrow: 0, flexShrink: 1 },
  dockContent: { paddingHorizontal: 20, paddingTop: 20, gap: 16, width: "100%", maxWidth: 680, alignSelf: "center" },
  tools: { borderTopWidth: StyleSheet.hairlineWidth, borderColor: palette.border, paddingTop: 14 },
  live: { fontFamily: rounded, color: palette.accent, fontSize: 15, lineHeight: 21 },
  session: { gap: 8 },
  sessionLabel: { fontFamily: rounded, color: palette.muted, fontSize: 12, letterSpacing: 1.2 },
  sessionRow: { gap: 8 },
  sessionChip: { minHeight: 44, justifyContent: "center", paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.raised },
  sessionChipActive: { borderColor: palette.accent },
  sessionChipText: { fontFamily: rounded, color: palette.text, fontSize: 15 },
  sessionChipDate: { fontFamily: rounded, color: palette.secondary, fontSize: 12, marginTop: 3 },
  stageBar: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 8,
    backgroundColor: palette.surface,
    borderTopWidth: 1,
    borderTopColor: palette.border,
  },
  stageCell: { flex: 1, gap: 4 },
  stageThumb: {
    width: "100%",
    aspectRatio: 1,
    borderRadius: 4,
    backgroundColor: palette.raised,
    borderColor: palette.border,
    borderWidth: 1,
  },
  stageCaption: { fontFamily: rounded, color: palette.secondary, fontSize: 11, textAlign: "center" },
  attributionLink: { minHeight: 44, alignItems: "center", justifyContent: "center" },
  attribution: { fontFamily: rounded, color: palette.muted, fontSize: 12 },
});
