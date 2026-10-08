"use client";

import { HeliosMainVideoView } from "@reactor-models/helios";

// The live Helios stream. `<HeliosMainVideoView>` is a pre-bound
// `<ReactorView track="main_video">` from the typed SDK. It stays mounted
// and fades in once generation starts, so the title screen underneath
// shows until there is a picture.
export function Video({ visible }: { visible: boolean }) {
  return (
    <div
      data-live-video
      className={`absolute inset-0 transition-opacity duration-700 ${
        visible ? "opacity-100" : "opacity-0"
      }`}
    >
      <HeliosMainVideoView className="h-full w-full" videoObjectFit="cover" />
    </div>
  );
}
