/** Next.js server start hook: network defaults before the first outbound call (Meta, R2, Neon). */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  const { ensureNetworkDefaults } = await import('./server/net');
  ensureNetworkDefaults();
}
