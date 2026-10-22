// Supported video output formats (dependency-free metadata). Platform-named size
// presets — several legitimately share a canvas size (e.g. Reel/TikTok/Mobile are
// all 1080×1920 9:16); that is real, not a fake duplicate. `fps` and
// `defaultDuration` seed the timeline document the VideoEditor builds in a later
// checkpoint. No Fabric import here, so plain UI can use it freely.

export const VIDEO_FORMATS = {
  "yt-video": { label: "YouTube Video", short: "YouTube", width: 1920, height: 1080, aspect: "16:9", fps: 30, defaultDuration: 10 },
  "landscape": { label: "Landscape Video", short: "Landscape", width: 1920, height: 1080, aspect: "16:9", fps: 30, defaultDuration: 10 },
  "fb-video": { label: "Facebook Video", short: "Facebook", width: 1280, height: 720, aspect: "16:9", fps: 30, defaultDuration: 10 },
  "ig-reel": { label: "Instagram Reel", short: "Reel", width: 1080, height: 1920, aspect: "9:16", fps: 30, defaultDuration: 15 },
  "tiktok": { label: "TikTok Video", short: "TikTok", width: 1080, height: 1920, aspect: "9:16", fps: 30, defaultDuration: 15 },
  "mobile": { label: "Mobile Video", short: "Mobile", width: 1080, height: 1920, aspect: "9:16", fps: 30, defaultDuration: 15 },
  "square": { label: "Square Video", short: "Square", width: 1080, height: 1080, aspect: "1:1", fps: 30, defaultDuration: 10 },
};

// Category chips shown on the discovery page. A chip is only rendered if the
// catalog actually has a starter tagged with it (enforced in the gallery), so a
// filter never returns nothing. `null` formats = Popular (all).
export const VIDEO_CATEGORIES = [
  { id: "popular", label: "Popular" },
  { id: "youtube", label: "YouTube" },
  { id: "instagram-reels", label: "Instagram Reels" },
  { id: "tiktok", label: "TikTok" },
  { id: "facebook", label: "Facebook" },
  { id: "business", label: "Business" },
  { id: "education", label: "Education" },
  { id: "ads", label: "Ads" },
  { id: "intros", label: "Intros" },
];
