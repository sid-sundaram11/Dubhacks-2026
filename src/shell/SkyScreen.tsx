import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import { AccessibilityInfo, Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { createAnalytics } from "../domain/analytics";
import { appReducer, initialAppState } from "./appReducer";
import { ActionBar } from "../components/ActionBar";
import { ConstellationCard } from "../components/ConstellationCard";
import { GenerationPanel } from "../components/GenerationPanel";
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
  const stars = useMemo(() => loadBundledCatalog(), []);
  const byId = useMemo(() => new Map(stars.map((star) => [star.id, star])), [stars]);
  const [state, dispatch] = useReducer(appReducer, initialAppState);
  const [reveal, setReveal] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);
  const skyRef = useRef<SkyViewHandle>(null);

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

  const selected = state.selectedStarId != null ? byId.get(state.selectedStarId) : undefined;
  const revealValue = state.edited || state.constellation?.source === "manual" ? (state.constellation?.segments.length ?? 0) : reveal;

  return (
    <View style={styles.screen}>
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
      <View pointerEvents="box-none" style={[styles.overlay, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 8 }]}>
        <View pointerEvents="none">
          <Text style={styles.title}>AI Constellation Creator</Text>
          <Text style={styles.subtitle}>A window into the fixed stars. Drag to look, pinch to zoom.</Text>
        </View>
        <Text accessibilityLiveRegion="polite" style={styles.live}>
          {state.statusMessage}
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
        <View pointerEvents="none" style={styles.spacer} />
        {state.constellation ? (
          <ConstellationCard
            name={state.constellation.name}
            story={state.constellation.story}
            source={state.constellation.source}
            edited={state.edited}
          />
        ) : null}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.actions}>
          <ActionBar
            canUndo={(state.constellation?.segments.length ?? 0) > 0}
            canClear={(state.constellation?.segments.length ?? 0) > 0}
            manualMode={state.mode === "manual"}
            confirmClear={state.confirmClear}
            hasConstellation={state.constellation != null}
            onUndo={() => dispatch({ type: "undo" })}
            onToggleManual={() => dispatch({ type: "toggle_manual" })}
            onClear={() => dispatch({ type: "request_clear" })}
            onConfirmClear={() => dispatch({ type: "confirm_clear" })}
            onCancelClear={() => dispatch({ type: "cancel_clear" })}
            onRegenerate={() => generate(state.prompt || "Dragon")}
            onShare={() => {
              const constellation = state.constellation;
              if (!constellation) return;
              void skyRef.current
                ?.capturePng({
                  name: constellation.name,
                  story: constellation.story,
                  attribution: "Stars from the HYG Database v4.2. Made with AI Constellation Creator.",
                })
                .then(async (uri) => {
                  if (!uri) return;
                  analytics.track({ name: "share_exported", at: Date.now() });
                  await sharePng(uri);
                });
            }}
            onZoomIn={() => skyRef.current?.zoomBy(-8)}
            onZoomOut={() => skyRef.current?.zoomBy(8)}
            onReset={() => skyRef.current?.reset()}
          />
        </ScrollView>
        <GenerationPanel
          prompt={state.prompt}
          running={state.generationStatus === "running"}
          onPromptChange={(prompt) => dispatch({ type: "set_prompt", prompt })}
          onGenerate={generate}
        />
        <Pressable accessibilityRole="link" accessibilityLabel="HYG Database attribution" onPress={() => void Linking.openURL(HYG_URL)}>
          <Text style={styles.attribution}>Stars from the HYG Database v4.2</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#070814" },
  overlay: { ...StyleSheet.absoluteFill, paddingHorizontal: 12, gap: 8 },
  title: { color: "#f7f3ea", fontSize: 22, fontWeight: "700" },
  subtitle: { color: "#c9d2e4", fontSize: 13 },
  live: { color: "#f0c27a", minHeight: 18 },
  spacer: { flex: 1 },
  actions: { alignItems: "center" },
  attribution: { color: "#9aa6bf", fontSize: 12, textDecorationLine: "underline" },
});
