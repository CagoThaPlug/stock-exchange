import yahooFinance, { ExtendedCookieJar } from 'yahoo-finance2';

// Create a process-wide cookie jar so crumbs/cookies persist between requests
const cookieJar = new ExtendedCookieJar();

// Minimal no-op logger to silence library notices and warnings
const silentLogger = {
  info: () => {},
  warn: () => {},
  error: () => {},
  debug: () => {},
};

// Apply global config once
// Note: this module should only be imported server-side
try {
  // setGlobalConfig is available on the default export
  // Types guarantee presence; runtime environments may vary but try/catch guards safety
  // @ts-ignore - setGlobalConfig is on the default export in Node builds
  yahooFinance.setGlobalConfig({ cookieJar, logger: silentLogger });
  // Suppress recurring survey notice (and other notices if needed)
  // @ts-ignore - suppressNotices is on the default export in Node builds
  yahooFinance.suppressNotices(['yahooSurvey']);
} catch {
  // Swallow config errors silently; fall back to defaults
}

export default yahooFinance;


