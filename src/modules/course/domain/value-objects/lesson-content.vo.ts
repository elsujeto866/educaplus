/**
 * LessonContent value object — polymorphic content payload for a lesson.
 *
 * Discriminated union matching the CTI schema:
 *   'video' → lesson_video_assets companion row
 *   'text'  → lesson_text_contents companion row (body stored as JSONB)
 *
 * JSONValue covers arbitrary TipTap / Slate rich-text editor output without
 * constraining the schema to a specific editor format at the domain layer.
 *
 * Pure TS — zero imports.
 */

// ---------------------------------------------------------------------------
// JSON primitive type
// ---------------------------------------------------------------------------

export type JSONValue =
  | string
  | number
  | boolean
  | null
  | JSONValue[]
  | { [key: string]: JSONValue };

// ---------------------------------------------------------------------------
// Content variants
// ---------------------------------------------------------------------------

export interface VideoContent {
  readonly type: 'video';
  /** Cloudflare Stream UID — null until the video upload pipeline processes the asset. */
  readonly cloudflareUid: string | null;
  readonly durationSeconds: number | null;
  readonly thumbnailUrl: string | null;
}

export interface TextContent {
  readonly type: 'text';
  /** Rich-text body stored as JSONB — opaque at the domain layer. */
  readonly body: JSONValue;
}

// ---------------------------------------------------------------------------
// Discriminated union
// ---------------------------------------------------------------------------

export type LessonContent = VideoContent | TextContent;
