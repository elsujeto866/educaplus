/**
 * Single source of truth for Clerk's visual theming.
 * Mirrors the cyberpunk tokens declared in `globals.css` (`@theme`).
 * Values are hardcoded hex because CSS custom properties are not
 * readable at SSR JS evaluation time.
 *
 * Passed once to `ClerkProvider`; every Clerk component (SignIn, SignUp,
 * CreateOrganization, etc.) inherits it automatically.
 *
 * Untyped on purpose: `@clerk/types` is not a direct dependency in this
 * project (it ships bundled inside `@clerk/nextjs`/`@clerk/react`'s own
 * `.d.ts` output), so importing it by name is unreliable across versions.
 * `ClerkProvider`'s `appearance` prop is structurally typed — this object
 * satisfies it without an explicit annotation.
 */
export const clerkAppearance = {
  variables: {
    colorPrimary: '#39ff14',
    colorPrimaryForeground: '#0a0e0f',
    colorBackground: '#111618',
    colorForeground: '#d1d5db',
    colorMutedForeground: '#6b7280',
    colorInput: '#1a2024',
    colorInputForeground: '#d1d5db',
    colorNeutral: '#d1d5db',
    colorBorder: '#1f2d32',
    colorDanger: '#ff2d55',
    colorRing: '#39ff14',
    borderRadius: '0.375rem',
  },
};
