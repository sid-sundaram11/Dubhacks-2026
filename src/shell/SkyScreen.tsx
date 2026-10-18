import { BottomSheet, Host, RNHostView } from "@expo/ui";
import { WelcomeScreen } from "../components/WelcomeScreen";
import { GlobeMenuButton } from "../components/GlobeMenuButton";
import { MotionToggle } from "../components/MotionToggle";
import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ComponentRef,
} from "react";
import {
  AccessibilityInfo,
  BackHandler,
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { createAnalytics } from "../domain/analytics";
import type { PipelineStageImages } from "../domain/generation";
import { INITIAL_FOV } from "../domain/constants";
import { appReducer, initialAppState } from "./appReducer";
import { ActionBar } from "../components/ActionBar";
import { ConstellationCard } from "../components/ConstellationCard";
import { GenerationPanel } from "../components/GenerationPanel";
import { GenerationProbePanel } from "../components/GenerationProbePanel";
import { ControlButton } from "../components/ControlButton";
import { palette, serif } from "../theme";
import { StarDetails } from "../components/StarDetails";
import { loadBundledCatalog } from "../features/catalog/catalogLoader";
import { displayName } from "../features/catalog/displayName";
import { revealedSegments } from "../features/constellation/animation";
import { selectMinZoomCandidates } from "../features/constellation/candidateSelection";
import { createConstellation } from "../features/constellation/createConstellation";
import { requestDrawing } from "../features/generation/generationClient";
import {
  pickSubjectPhoto,
  type PickedSubject,
} from "../features/generation/pickSubjectPhoto";
import { sharePng } from "../features/share/exportPng";
import { SkyView, type SkyViewHandle } from "../features/starfield/SkyView";
import { RoomPanel } from "../components/RoomPanel";
import { roomConstellationToCustom } from "../features/rooms/roomMapper";
import { initialRoomState, roomReducer } from "../features/rooms/roomReducer";
import { useRoom } from "../features/rooms/useRoom";

const analytics = createAnalytics();
const HYG_URL = "https://github.com/astronexus/HYG-Database";

const BOTTOM_STAGE_IMAGES: { key: keyof PipelineStageImages; label: string }[] =
  [
    { key: "found", label: "1 Found" },
    { key: "mask", label: "2 Mask" },
    { key: "skeleton", label: "3 Skeleton" },
    { key: "nodes", label: "4 Nodes" },
  ];

export function SkyScreen() {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const [started, setStarted] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [motionEnabled, setMotionEnabled] = useState(false);
  const [motionMessage, setMotionMessage] = useState<string | null>(null);
  const [showLabels, setShowLabels] = useState(false);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [joiningFromWelcome, setJoiningFromWelcome] = useState(false);
  const [photo, setPhoto] = useState<PickedSubject | null>(null);
  const dockHeight = Math.max(260, height * 0.72 - insets.bottom);
  const stars = useMemo(() => loadBundledCatalog(), []);
  const byId = useMemo(
    () => new Map(stars.map((star) => [star.id, star])),
    [stars],
  );
  const [state, dispatch] = useReducer(appReducer, initialAppState);
  const [roomState, roomDispatch] = useReducer(roomReducer, initialRoomState);
  const [shareMessage, setShareMessage] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const [reveal, setReveal] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [showSubject, setShowSubject] = useState(false);
  const skyRef = useRef<SkyViewHandle>(null);
  const dockRef = useRef<ComponentRef<typeof ScrollView>>(null);

  const onPublishFailed = useCallback(
    (message: string) => dispatch({ type: "set_status", message }),
    [],
  );

  const room = useRoom({
    restoreSession: false,
    roomState,
    dispatch: roomDispatch,
    getFallbackAim: () =>
      skyRef.current?.getAim() ?? {
        quaternion: [0, 0, 0, 1],
        fov: INITIAL_FOV,
      },
    onPublishFailed,
  });

  useEffect(() => {
    if (roomState.status === "connected" && joiningFromWelcome) {
      setStarted(true);
      setMenuOpen(false);
      setJoiningFromWelcome(false);
    }
  }, [roomState.status, joiningFromWelcome]);

  useEffect(() => {
    const back = BackHandler.addEventListener("hardwareBackPress", () => {
      if (menuOpen) {
        setMenuOpen(false);
        return true;
      }
      if (started) {
        setMenuOpen(true);
        return true;
      }
      return false;
    });
    return () => back.remove();
  }, [menuOpen, started]);

  const changeMotion = (enabled: boolean) => {
    setMotionMessage(null);
    setMotionEnabled(enabled);
  };
  const motionFailed = useCallback((message: string) => {
    setMotionEnabled(false);
    setMotionMessage(message);
    setMenuOpen(true);
  }, []);

  useEffect(() => {
    dockRef.current?.scrollTo({ y: 0, animated: false });
  }, [state.constellation?.id, state.selectedStarId]);

  useEffect(() => {
    setShowSubject(false);
  }, [state.constellation?.id]);

  useEffect(() => {
    analytics.track({ name: "app_opened", at: Date.now() });
    void AccessibilityInfo.isReduceMotionEnabled().then(setReducedMotion);
    const subscription = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setReducedMotion,
    );
    return () => subscription.remove();
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
      const next = revealedSegments(
        Date.now() - started,
        constellation.segments.length,
        false,
      );
      setReveal(next);
      if (next < constellation.segments.length)
        frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [reducedMotion, state.constellation, state.edited]);

  const generate = () => {
    if (!photo || state.skyLocked) return;
    const projected = skyRef.current?.getProjected() ?? [];
    const size = skyRef.current?.getSize() ?? { width: 1, height: 1 };
    const fov = skyRef.current?.getFov() ?? INITIAL_FOV;
    const candidates = selectMinZoomCandidates(
      projected,
      size.width,
      size.height,
      fov,
    );
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
      setMenuOpen(false);
    });
  };

  const choosePhoto = () => {
    if (state.skyLocked) return;
    void pickSubjectPhoto().then((result) => {
      if (result === "denied") {
        dispatch({
          type: "set_status",
          message: "Photo library access is needed to choose a subject.",
        });
        return;
      }
      if (result === "canceled") return;
      setShareMessage(null);
      setPhoto(result);
    });
  };

  const savedSubject =
    state.sessionConstellations.find(
      (item) => item.constellation.id === state.constellation?.id,
    )?.subjectPng ?? null;
  const subjectUri = savedSubject
    ? `data:image/png;base64,${savedSubject}`
    : null;
  const selected =
    state.selectedStarId != null ? byId.get(state.selectedStarId) : undefined;
  const revealValue =
    state.edited || state.constellation?.source === "manual"
      ? (state.constellation?.segments.length ?? 0)
      : reveal;

  const share = async () => {
    if (!state.constellation || sharing) return;
    setSharing(true);
    setShareMessage(null);
    try {
      const uri = await skyRef.current?.capturePng({
        name: state.constellation.name,
        story: state.constellation.story,
        attribution:
          "Stars from the HYG Database v4.2. Made with Constellations.",
      });
      if (!uri) throw new Error("Snapshot unavailable");
      analytics.track({ name: "share_exported", at: Date.now() });
      if (!(await sharePng(uri)))
        setShareMessage("Sharing isn’t available on this device.");
    } catch {
      setShareMessage("Couldn’t share this sky. Please try again.");
    } finally {
      setSharing(false);
    }
  };

  return (
    <View style={styles.screen}>
      <View style={styles.sky}>
        <SkyView
          ref={skyRef}
          stars={stars}
          segments={state.constellation?.segments ?? []}
          reveal={revealValue}
          selectedStarId={state.selectedStarId}
          interactionEnabled={started && !state.skyLocked && !menuOpen}
          motionEnabled={started && motionEnabled}
          showLabels={started && showLabels}
          onMotionError={motionFailed}
          subjectUri={subjectUri}
          subjectVisible={showSubject && subjectUri != null}
          onToggleSubject={() => {
            if (!subjectUri) return;
            setShowSubject((visible) => !visible);
          }}
          onSelectStar={(id) => {
            const before = state.constellation?.segments.length ?? 0;
            dispatch({ type: "select_star", id });
            if (state.mode !== "manual") setMenuOpen(true);
            if (
              state.mode === "manual" &&
              state.pathStarId != null &&
              state.pathStarId !== id
            ) {
              analytics.track({
                name: "manual_segment_added",
                at: Date.now(),
                detail: { before },
              });
            }
          }}
        />
      </View>
      {!started ? (
        <WelcomeScreen
          roomCode={roomState.joinDraftCode}
          onRoomCodeChange={(code) => {
            room.setJoinDraft(code);
            room.clearRoomError();
          }}
          onJoin={() => {
            setJoiningFromWelcome(true);
            void room.joinRoom(roomState.joinDraftCode);
          }}
          onSolo={() => {
            setJoiningFromWelcome(false);
            setStarted(true);
            setMenuOpen(false);
          }}
          busy={["authenticating", "creating", "joining"].includes(
            roomState.status,
          )}
          error={
            roomState.retryableError ??
            (joiningFromWelcome && roomState.status === "unconfigured"
              ? "Rooms are unavailable right now. You can still explore Solo."
              : null)
          }
          motionEnabled={motionEnabled}
          onMotionChange={changeMotion}
        />
      ) : (
        <GlobeMenuButton
          onPress={() => setMenuOpen(true)}
          reducedMotion={reducedMotion}
          bottom={Math.max(insets.bottom, 16)}
        />
      )}
      <Host
        colorScheme="dark"
        style={styles.sheetHost}
        pointerEvents="box-none"
      >
        <BottomSheet
          isPresented={started && menuOpen}
          onDismiss={() => setMenuOpen(false)}
          snapPoints={[{ fraction: 0.8 }]}
          containerColor={palette.surface}
          contentPadding={0}
        >
          <RNHostView matchContents={{ vertical: true }}>
            <View style={[styles.dock, { height: dockHeight }]}>
              <ScrollView
                ref={dockRef}
                style={styles.dockScroll}
                contentContainerStyle={styles.dockContent}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                <View style={styles.menuHeader}>
                  <Text accessibilityRole="header" style={styles.menuTitle}>
                    Your sky
                  </Text>
                  <ControlButton
                    label="Close menu"
                    symbol="×"
                    onPress={() => setMenuOpen(false)}
                  />
                </View>
                <View style={styles.menuControls}>
                  <MotionToggle
                    enabled={motionEnabled}
                    onChange={changeMotion}
                    disabled={state.skyLocked}
                  />
                  <ControlButton
                    label={showLabels ? "Hide star names" : "Star names"}
                    selected={showLabels}
                    onPress={() => setShowLabels((value) => !value)}
                  />
                </View>
                {motionMessage ? (
                  <Text accessibilityLiveRegion="polite" style={styles.live}>
                    {motionMessage}
                  </Text>
                ) : null}
                <Text style={styles.menuHint}>
                  {state.mode === "manual"
                    ? "Tap stars to connect them. Open the globe to finish drawing."
                    : motionEnabled
                      ? "Turn your phone to explore. Pinch to zoom."
                      : "Drag to explore. Pinch to zoom."}
                </Text>
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
                {state.constellation ? (
                  <ConstellationCard
                    name={state.constellation.name}
                    story={state.constellation.story}
                    source={state.constellation.source}
                    edited={state.edited}
                  />
                ) : null}
                {roomState.status === "connected" &&
                roomState.constellations.length > 0 ? (
                  <View style={styles.session}>
                    <Text style={styles.sessionLabel}>In this room</Text>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.sessionRow}
                    >
                      {roomState.constellations.map((item) => {
                        const active =
                          roomState.selectedSharedId === item.sharedId;
                        const mine = item.ownerUid === roomState.uid;
                        return (
                          <Pressable
                            key={item.sharedId}
                            accessibilityRole="button"
                            accessibilityState={{ selected: active }}
                            onPress={() => {
                              room.selectShared(item.sharedId);
                              dispatch({
                                type: "select_room_constellation",
                                constellation: roomConstellationToCustom(item),
                              });
                              skyRef.current?.focusAim(item.aim);
                              setShowSubject(false);
                              setMenuOpen(false);
                            }}
                            style={[
                              styles.sessionChip,
                              active && styles.sessionChipActive,
                            ]}
                          >
                            <Text style={styles.sessionChipText}>
                              {item.name}
                              {mine ? " · Mine" : ` · ${item.ownerLabel}`}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </ScrollView>
                  </View>
                ) : null}
                {state.sessionConstellations.length > 0 ? (
                  <View style={styles.session}>
                    <Text style={styles.sessionLabel}>This session</Text>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.sessionRow}
                    >
                      {state.sessionConstellations.map((item) => {
                        const active =
                          item.constellation.id === state.constellation?.id;
                        return (
                          <Pressable
                            key={item.constellation.id}
                            accessibilityRole="button"
                            accessibilityState={{ selected: active }}
                            onPress={() => {
                              room.selectShared(null);
                              dispatch({
                                type: "recall_constellation",
                                id: item.constellation.id,
                              });
                              setMenuOpen(false);
                            }}
                            style={[
                              styles.sessionChip,
                              active && styles.sessionChipActive,
                            ]}
                          >
                            <Text style={styles.sessionChipText}>
                              {item.constellation.name}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </ScrollView>
                  </View>
                ) : null}
                <RoomPanel
                  room={roomState}
                  busy={roomState.status === "authenticating"}
                  onCreate={() => {
                    setJoiningFromWelcome(false);
                    void room.createRoom();
                  }}
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
                  onSubjectPromptChange={(prompt) =>
                    dispatch({ type: "set_prompt", prompt })
                  }
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
                    onUndo={() => dispatch({ type: "undo" })}
                    onToggleManual={() => {
                      dispatch({ type: "toggle_manual" });
                      setMenuOpen(false);
                    }}
                    onClear={() => dispatch({ type: "request_clear" })}
                    onConfirmClear={() => dispatch({ type: "confirm_clear" })}
                    onCancelClear={() => dispatch({ type: "cancel_clear" })}
                    onRegenerate={() => {
                      if (!photo) {
                        dispatch({
                          type: "set_status",
                          message: "Choose a photo to draw a constellation.",
                        });
                        return;
                      }
                      generate();
                    }}
                    onShare={() => void share()}
                  />
                </View>
                {shareMessage ||
                sharing ||
                state.statusMessage !== initialAppState.statusMessage ? (
                  <Text
                    selectable
                    accessibilityLiveRegion="polite"
                    style={styles.live}
                  >
                    {shareMessage ??
                      (sharing ? "Preparing your sky…" : state.statusMessage)}
                  </Text>
                ) : null}
                <View style={styles.menuControls}>
                  <ControlButton
                    label="Zoom in"
                    symbol="+"
                    disabled={state.skyLocked}
                    onPress={() => skyRef.current?.zoomBy(-8)}
                  />
                  <ControlButton
                    label="Zoom out"
                    symbol="−"
                    disabled={state.skyLocked}
                    onPress={() => skyRef.current?.zoomBy(8)}
                  />
                  <ControlButton
                    label="Recenter"
                    disabled={state.skyLocked}
                    onPress={() => skyRef.current?.reset()}
                  />
                  <ControlButton
                    label="Home"
                    disabled={state.skyLocked}
                    onPress={() => {
                      void room.leaveRoom().then(() => {
                        setStarted(false);
                        setMenuOpen(false);
                        setJoiningFromWelcome(false);
                      });
                    }}
                  />
                </View>
                {state.generationProbe ? (
                  <ControlButton
                    label={
                      showDiagnostics
                        ? "Hide generation details"
                        : "Generation details"
                    }
                    onPress={() => setShowDiagnostics((value) => !value)}
                  />
                ) : null}
                {showDiagnostics && state.generationProbe ? (
                  <GenerationProbePanel probe={state.generationProbe} />
                ) : null}
                <Pressable
                  accessibilityRole="link"
                  accessibilityLabel="HYG Database attribution"
                  onPress={() => void Linking.openURL(HYG_URL)}
                  style={styles.attributionLink}
                >
                  <Text style={styles.attribution}>
                    Mapped with the HYG star catalog
                  </Text>
                </Pressable>
                {showDiagnostics && state.generationProbe ? (
                  <View
                    style={[
                      styles.stageBar,
                      { paddingBottom: Math.max(insets.bottom, 8) },
                    ]}
                  >
                    {BOTTOM_STAGE_IMAGES.map(({ key, label }) => (
                      <View key={key} style={styles.stageCell}>
                        <Image
                          accessibilityIgnoresInvertColors
                          accessibilityLabel={label}
                          source={{
                            uri: `data:image/png;base64,${state.generationProbe!.stages[key]}`,
                          }}
                          style={styles.stageThumb}
                        />
                        <Text style={styles.stageCaption}>{label}</Text>
                      </View>
                    ))}
                  </View>
                ) : null}
              </ScrollView>
            </View>
          </RNHostView>
        </BottomSheet>
      </Host>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.sky },
  sky: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0 },
  sheetHost: { position: "absolute", width: 0, height: 0 },
  menuHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  menuTitle: { fontFamily: serif, color: palette.text, fontSize: 32 },
  menuControls: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 10,
  },
  menuHint: { color: palette.secondary, fontSize: 13, lineHeight: 19 },
  dock: {
    width: "100%",
    backgroundColor: palette.surface,
    borderTopWidth: 1,
    borderTopColor: palette.border,
  },
  dockScroll: { flex: 1 },
  dockContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 32,
    gap: 20,
    width: "100%",
    maxWidth: 680,
    alignSelf: "center",
  },
  tools: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: palette.border,
    paddingTop: 14,
  },
  live: {
    fontFamily: serif,
    color: palette.accent,
    fontSize: 15,
    lineHeight: 21,
  },
  session: { gap: 8 },
  sessionLabel: {
    fontFamily: serif,
    color: palette.muted,
    fontSize: 12,
    letterSpacing: 1.2,
  },
  sessionRow: { gap: 8 },
  sessionChip: {
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.raised,
  },
  sessionChipActive: { borderColor: palette.accent },
  sessionChipText: { fontFamily: serif, color: palette.text, fontSize: 15 },
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
  stageCaption: {
    fontFamily: serif,
    color: palette.secondary,
    fontSize: 11,
    textAlign: "center",
  },
  attributionLink: {
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  attribution: { fontFamily: serif, color: palette.muted, fontSize: 12 },
});
