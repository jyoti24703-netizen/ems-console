import React, { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { API_BASE_URL } from "../../config/api";

const API_BASE = `${API_BASE_URL}`;

const resolveRecordingUrl = (rawUrl) => {
  if (!rawUrl) return "";
  if (rawUrl.startsWith("http://") || rawUrl.startsWith("https://")) return rawUrl;
  return `${API_BASE}${rawUrl.startsWith("/") ? rawUrl : `/${rawUrl}`}`;
};

const MeetingRecordingPlayer = () => {
  const [searchParams] = useSearchParams();
  const rawSrc = searchParams.get("src") || "";
  const fileName = searchParams.get("name") || "meeting-recording.mp4";
  const mime = searchParams.get("mime") || "video/mp4";
  const src = resolveRecordingUrl(rawSrc);
  const [videoError, setVideoError] = useState("");
  const [videoMeta, setVideoMeta] = useState({ width: 0, height: 0 });

  if (!src) {
    return (
      <div className="min-h-screen bg-gray-950 text-gray-200 flex items-center justify-center">
        Recording source is missing.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      <div className="px-4 py-3 border-b border-gray-800 bg-gray-950/90">
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm text-gray-300 truncate">{fileName}</p>
          <a
            href={src}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-blue-300 hover:underline whitespace-nowrap"
          >
            Open original file
          </a>
        </div>
      </div>
      <div className="flex-1 flex items-center justify-center p-2">
        <video
          controls
          autoPlay
          playsInline
          className="w-full h-full max-h-screen object-contain bg-black"
          onLoadedMetadata={(e) => {
            setVideoMeta({
              width: e.currentTarget.videoWidth || 0,
              height: e.currentTarget.videoHeight || 0
            });
            setVideoError("");
          }}
          onError={() => {
            setVideoError("Video playback failed in browser. Open original file in a new tab.");
          }}
        >
          <source src={src} type={mime} />
          Your browser could not play this video.
        </video>
      </div>
      {(videoError || (videoMeta.width === 0 && videoMeta.height === 0)) && (
        <div className="px-4 py-3 border-t border-gray-800 bg-gray-950 text-xs text-amber-300">
          {videoError || "No video track detected yet. If audio plays but screen is black, file may be audio-only or codec unsupported."}
        </div>
      )}
    </div>
  );
};

export default MeetingRecordingPlayer;
