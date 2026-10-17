export type AnalyticsEventName =
  | "app_opened"
  | "generation_started"
  | "generation_completed"
  | "generation_fallback_used"
  | "manual_segment_added"
  | "share_exported";

export interface AnalyticsEvent {
  name: AnalyticsEventName;
  at: number;
  detail?: Record<string, string | number | boolean>;
}

export interface AnalyticsSink {
  track(event: AnalyticsEvent): void;
}

export function createAnalytics(): AnalyticsSink & { events: AnalyticsEvent[] } {
  const events: AnalyticsEvent[] = [];
  return {
    events,
    track(event) {
      events.push(event);
      if (typeof __DEV__ !== "undefined" && __DEV__) {
        console.info("[analytics]", event.name);
      }
    },
  };
}

declare const __DEV__: boolean | undefined;
