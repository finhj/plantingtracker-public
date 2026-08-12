import './VersionBadge.css';

/*
 * Displays the app version and the git commit SHA of the running build.
 *
 * Both values are injected at build time by vite.config.js:
 *   __APP_VERSION__ comes from the "version" field in package.json
 *   __BUILD_SHA__   comes from Vercel's VERCEL_GIT_COMMIT_SHA env var,
 *                   or the string "local" when built outside Vercel.
 *
 * The SHA is here so a stale deployment is visible at a glance: compare
 * what the page shows against the latest commit in GitHub. If they differ,
 * the deploy did not go through and there is no bug to chase.
 */
export default function VersionBadge() {
  return (
    <span className="version-badge">
      <span className="sr-only">Version </span>
      v{__APP_VERSION__}
      <span className="version-badge__sep" aria-hidden="true">·</span>
      <span className="sr-only">build </span>
      {__BUILD_SHA__}
    </span>
  );
}
