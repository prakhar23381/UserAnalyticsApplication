/** Device bucket from the viewport width in CSS px. Never trusted from the client. */
export function deviceFor(viewportWidth) {
  if (viewportWidth < 768) return 'mobile';
  if (viewportWidth < 1024) return 'tablet';
  return 'desktop';
}
