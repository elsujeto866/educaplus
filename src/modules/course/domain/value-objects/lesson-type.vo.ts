/**
 * LessonType — discriminant for Class-Table-Inheritance lesson content.
 *
 * 'video' → companion row in lesson_video_assets
 * 'text'  → companion row in lesson_text_contents
 *
 * Pure TS — zero imports.
 */
export type LessonType = 'video' | 'text';

const VALID: ReadonlySet<string> = new Set<LessonType>(['video', 'text']);

/**
 * Validates and narrows a raw string to LessonType.
 * Throws when the value is not a member of the closed set.
 */
export function parseLessonType(value: string): LessonType {
  if (!VALID.has(value)) {
    throw new Error(`Invalid lesson type "${value}": must be "video" or "text"`);
  }
  return value as LessonType;
}
