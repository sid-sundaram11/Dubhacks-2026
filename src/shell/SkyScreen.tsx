import { useEffect, useMemo, useReducer, useRef, useState, type ComponentRef } from "react";
import { AccessibilityInfo, Keyboard, KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { createAnalytics } from "../domain/analytics";
import { appReducer, initialAppState } from "./appReducer";
import { ActionBar } from "../components/ActionBar";
import { ConstellationCard } from "../components/ConstellationCard";
import { GenerationPanel } from "../components/GenerationPanel";
import { ControlButton } from "../components/ControlButton";
import { palette, serif } from "../theme";
import { StarDetails } from "../components/StarDetails";
import { loadBundledCatalog } from "../features/catalog/catalogLoader";
import { displayName } from "../features/catalog/displayName";
import { revealedSegments } from "../features/constellation/animation";
import { selectCandidates } from "../features/constellation/candidateSelection";
import { createConstellation } from "../features/constellation/createConstellation";
import { requestDrawing } from "../features/generation/generationClient";
import { sharePng } from "../features/share/exportPng";
import { SkyView, type SkyViewHandle } from "../features/starfield/SkyView";

const analytics = createAnalytics();
const HYG_URL = "https://github.com/astronexus/HYG-Database";

export function SkyScreen() {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const [compactSky, setCompactSky] = useState(false);
  const pendingPromptRef = useRef<string | null>(null);
  const dockHeight = Math.min(360, (height - insets.top - insets.bottom) * 0.44);
  const stars = useMemo(() => loadBundledCatalog(), []);
  const byId = useMemo(() => new Map(stars.map((star) => [star.id, star])), [stars]);
  const [state, dispatch] = useReducer(appReducer, initialAppState);
  const [shareMessage, setShareMessage] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const [reveal, setReveal] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);
  const skyRef = useRef<SkyViewHandle>(null);
  const dockRef = useRef<ComponentRef<typeof ScrollView>>(null);

  useEffect(() => {
    dockRef.current?.scrollTo({ y: 0, animated: false });
  }, [state.constellation?.id, state.selectedStarId]);

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

  const generate = (prompt: string) => {
    const trimmed = prompt.trim();
    if (!trimmed || state.skyLocked) return;
    dispatch({ type: "set_prompt", prompt: trimmed });
    const projected = skyRef.current?.getProjected() ?? [];
    const size = skyRef.current?.getSize() ?? { width: 1, height: 1 };
    const candidates = selectCandidates(projected, size.width, size.height);
    dispatch({ type: "generation_started" });
    analytics.track({ name: "generation_started", at: Date.now() });
    void createConstellation({
      prompt: trimmed,
      candidates,
      request: requestDrawing,
    }).then((result) => {
      if (result.kind === "zoom-out") {
        dispatch({ type: "generation_needs_zoom" });
        return;
      }
      if (result.resetSky) skyRef.current?.reset();
      if (result.offline) analytics.track({ name: "generation_fallback_used", at: Date.now() });
      else analytics.track({ name: "generation_completed", at: Date.now() });
      dispatch({ type: "generation_finished", constellation: result.constellation, offline: result.offline });
    });
  };

  const generateRef = useRef(generate);
  generateRef.current = generate;
  useEffect(() => {
    let frame = 0;
    const subscription = Keyboard.addListener("keyboardDidHide", () => {
      const prompt = pendingPromptRef.current;
      pendingPromptRef.current = null;
      if (prompt != null) frame = requestAnimationFrame(() => generateRef.current(prompt));
    });
    return () => {
      subscription.remove();
      cancelAnimationFrame(frame);
    };
  }, []);

  const submitGeneration = (prompt: string) => {
    if (state.skyLocked || !prompt.trim()) return;
    // Capture candidate positions only after the sky returns to its full viewport.
    if (Keyboard.isVisible()) {
      pendingPromptRef.current = prompt;
      Keyboard.dismiss();
    } else {
      generate(prompt);
    }
  };

  const selected = state.selectedStarId != null ? byId.get(state.selectedStarId) : undefined;
  const revealValue = state.edited || state.constellation?.source === "manual" ? (state.constellation?.segments.length ?? 0) : reveal;

  const share = async () => {
    if (!state.constellation || sharing) return;
    setSharing(true);
    setShareMessage(null);
    try {
      const uri = await skyRef.current?.capturePng({
        name: state.constellation.name,
        story: state.constellation.story,
        attribution: "Stars from the HYG Database v4.2. Made with Constellations.",
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
    <KeyboardAvoidingView
      style={[styles.screen, { paddingTop: insets.top }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.header}>
        <Text style={styles.eyebrow}>A LITTLE WONDER, ABOVE US</Text>
        <Text accessibilityRole="header" style={styles.title}>Constellations</Text>
      </View>
      <View style={styles.sky} onLayout={(event) => setCompactSky(event.nativeEvent.layout.height < 190)}>
        <SkyView
          ref={skyRef}
          stars={stars}
          segments={state.constellation?.segments ?? []}
          reveal={revealValue}
          selectedStarId={state.selectedStarId}
          interactionEnabled={!state.skyLocked}
          onSelectStar={(id) => {
            const before = state.constellation?.segments.length ?? 0;
            dispatch({ type: "select_star", id });
            if (state.mode === "manual" && state.pathStarId != null && state.pathStarId !== id) {
              analytics.track({ name: "manual_segment_added", at: Date.now(), detail: { before } });
            }
          }}
        />
        <View style={[styles.navigation, compactSky && styles.compactNavigation]}>
          <ControlButton label="Zoom in" symbol="+" disabled={state.skyLocked} onPress={() => skyRef.current?.zoomBy(-8)} />
          <ControlButton label="Zoom out" symbol="−" disabled={state.skyLocked} onPress={() => skyRef.current?.zoomBy(8)} />
          <ControlButton label="Reset view" symbol="↺" disabled={state.skyLocked} onPress={() => skyRef.current?.reset()} />
        </View>
        <View pointerEvents="none" style={styles.skyCaption}>
          <Text style={styles.skyHint}>{state.mode === "manual" ? "Tap two stars to draw a line" : "Drag to explore  ·  Pinch to zoom"}</Text>
        </View>
      </View>
      <View style={[styles.dock, { height: dockHeight, paddingBottom: Math.max(insets.bottom, 12) }]}>
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
          {state.constellation ? (
            <ConstellationCard
              name={state.constellation.name}
              story={state.constellation.story}
              source={state.constellation.source}
              edited={state.edited}
            />
          ) : null}
          <GenerationPanel
            prompt={state.prompt}
            running={state.generationStatus === "running"}
            onPromptChange={(prompt) => {
              setShareMessage(null);
              dispatch({ type: "set_prompt", prompt });
            }}
            onGenerate={submitGeneration}
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
              onToggleManual={() => dispatch({ type: "toggle_manual" })}
              onClear={() => dispatch({ type: "request_clear" })}
              onConfirmClear={() => dispatch({ type: "confirm_clear" })}
              onCancelClear={() => dispatch({ type: "cancel_clear" })}
              onRegenerate={() => submitGeneration(state.prompt || "Dragon")}
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
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.sky },
  header: { paddingHorizontal: 24, paddingTop: 14, paddingBottom: 20, gap: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: palette.border },
  eyebrow: { fontFamily: serif, color: palette.muted, fontSize: 10, letterSpacing: 2.4 },
  title: { fontFamily: serif, color: palette.text, fontSize: 38, letterSpacing: -1 },
  sky: { flex: 1, minHeight: 100, overflow: "hidden" },
  navigation: { position: "absolute", top: 16, right: 16, gap: 8 },
  compactNavigation: { flexDirection: "row" },
  skyCaption: { position: "absolute", left: 16, right: 16, bottom: 12, alignItems: "center" },
  skyHint: { fontFamily: serif, color: palette.muted, fontSize: 13, backgroundColor: palette.sky, paddingHorizontal: 10, paddingVertical: 4 },
  dock: { flexShrink: 1, backgroundColor: palette.surface, borderTopWidth: 1, borderTopColor: palette.border },
  dockScroll: { flexGrow: 0, flexShrink: 1 },
  dockContent: { paddingHorizontal: 20, paddingTop: 20, gap: 16, width: "100%", maxWidth: 680, alignSelf: "center" },
  tools: { borderTopWidth: StyleSheet.hairlineWidth, borderColor: palette.border, paddingTop: 14 },
  live: { fontFamily: serif, color: palette.accent, fontSize: 15, lineHeight: 21 },
  attributionLink: { minHeight: 44, alignItems: "center", justifyContent: "center" },
  attribution: { fontFamily: serif, color: palette.muted, fontSize: 12 },
});
