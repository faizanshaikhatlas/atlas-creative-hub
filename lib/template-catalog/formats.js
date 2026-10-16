// Shared, dependency-free metadata for the template catalog: output formats,
// the 10 themes, and the Fabric serialization property list. Kept separate so
// both the (browser-only) render/create code and plain UI code can import it
// without pulling in Fabric.

/** Output formats. `projectType` maps to an existing SIZE_PRESETS id, or 'custom'. */
export const FORMATS = {
  "yt-thumbnail": { label: "YouTube Thumbnail", short: "YT Thumbnail", width: 1280, height: 720, projectType: "youtube-thumbnail" },
  "yt-banner": { label: "YouTube Banner", short: "YT Banner", width: 2560, height: 1440, projectType: "youtube-banner" },
  "ig-post": { label: "Instagram Post", short: "IG Post", width: 1080, height: 1080, projectType: "instagram-post" },
  "ig-story": { label: "Instagram Story", short: "IG Story", width: 1080, height: 1920, projectType: "instagram-story" },
  "fb-post": { label: "Facebook Post", short: "FB Post", width: 1200, height: 630, projectType: "facebook-post" },
  "presentation": { label: "Presentation 16:9", short: "Slide", width: 1920, height: 1080, projectType: "presentation" },
  "poster": { label: "Poster", short: "Poster", width: 1080, height: 1350, projectType: "custom" },
  "twitter-post": { label: "X / Twitter Post", short: "X Post", width: 1600, height: 900, projectType: "twitter-post" },
};

/** The 10 themes with their identity (used for filter chips + card badges). */
export const THEMES = [
  { id: "luxury", name: "Luxury & Premium", tagline: "Black, gold, elegant serif", swatch: ["#0a0a0a", "#d4af37", "#f5e6c8"] },
  { id: "minimal", name: "Minimal & Modern", tagline: "Whitespace, clean type", swatch: ["#ffffff", "#111827", "#e5e7eb"] },
  { id: "youtube", name: "Bold & Viral YouTube", tagline: "High contrast, big headlines", swatch: ["#111111", "#ff0033", "#ffde59"] },
  { id: "creative", name: "Creative & Artistic", tagline: "Gradients, geometric, editorial", swatch: ["#7c3aed", "#ec4899", "#22d3ee"] },
  { id: "corporate", name: "Corporate & Business", tagline: "Professional, navy, precise", swatch: ["#0f3d6e", "#2563eb", "#e2e8f0"] },
  { id: "education", name: "Education & University", tagline: "Admissions, courses, campus", swatch: ["#1e40af", "#f59e0b", "#ffffff"] },
  { id: "social", name: "Social & Influencer", tagline: "Posts, stories, creators", swatch: ["#ff6b9d", "#feca57", "#ffffff"] },
  { id: "nature", name: "Nature & Organic", tagline: "Earthy, botanical, wellness", swatch: ["#3f6212", "#65a30d", "#e7e5d8"] },
  { id: "food", name: "Food & Lifestyle", tagline: "Restaurants, menus, cafes", swatch: ["#7c2d12", "#c2410c", "#fff7ed"] },
  { id: "tech", name: "Technology & Future", tagline: "AI, neon, product launches", swatch: ["#0b1020", "#22d3ee", "#7c3aed"] },
];

export const THEME_BY_ID = Object.fromEntries(THEMES.map((t) => [t.id, t]));

/** Extra props serialized with each object so names/lock state survive toJSON. */
export const SERIALIZE_PROPS = [
  "id", "name", "selectable", "evented",
  "lockMovementX", "lockMovementY", "lockScalingX", "lockScalingY",
  "lockRotation", "hasControls", "fillType", "gradient",
];
