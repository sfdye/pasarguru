// iOS App Store state via the `asc` CLI (https://github.com/rorkariyam/App-Store-Connect-CLI — brew install asc).
// The iOS store workflow moved here from fastlane/deliver; fastlane still owns Google Play
// (see `fastlane/`).
//
//   npm run metadata:ios            # push everything (same command as before, asc-backed)
//   npm run metadata:ios:dry-run    # read-only plan of what push would change
//   npm run metadata:pull:ios       # re-sync metadata text after ASC dashboard edits
//
// Auth comes from store/ios/asc-api-key.json (gitignored), exported as the env credential set
// ASC_KEY_ID / ASC_ISSUER_ID / ASC_PRIVATE_KEY — the same key deliver used. No `asc auth login`.
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const BUNDLE_ID = 'com.sfdye.pasarguru';
const METADATA_DIR = 'store/ios/metadata';
const SCREENSHOTS_DIR = 'store/ios/screenshots';
const CREDS_PATH = 'store/ios/asc-api-key.json';
const REVIEW_NOTES_PATH = 'store/ios/review-notes.md';
const COPYRIGHT_PATH = 'store/ios/copyright.txt';

const CATEGORIES = { primary: 'LIFESTYLE', secondary: 'FOOD_AND_DRINK' };

// A version accepts metadata edits only in this state (see the note on `asc categories set`).
const EDITABLE_STATE = 'PREPARE_FOR_SUBMISSION';

const SCREENSHOT_DEVICES = [
  { dir: 'iphone', deviceType: 'IPHONE_65' },
  { dir: 'ipad', deviceType: 'IPAD_PRO_3GEN_129' },
];

const die = (msg) => {
  console.error(`store-ios: ${msg}`);
  process.exit(1);
};
const log = (msg) => console.log(`store-ios: ${msg}`);

const dryRun = process.argv.includes('--dry-run');
const onlyFlag = process.argv.find((a) => a.startsWith('--only='));
const only = onlyFlag ? onlyFlag.split('=')[1].split(',') : null;
const want = (step) => !only || only.includes(step);

if (!existsSync(CREDS_PATH)) {
  die(`${CREDS_PATH} not found — it is gitignored; see AGENTS.md for how to recreate it from ~/.appstoreconnect`);
}

const creds = JSON.parse(readFileSync(CREDS_PATH, 'utf8'));
const env = {
  ...process.env,
  ASC_KEY_ID: creds.key_id,
  ASC_ISSUER_ID: creds.issuer_id,
  ASC_PRIVATE_KEY: creds.key,
  ASC_TELEMETRY_DISABLED: '1',
};

const asc = (args) => execFileSync('asc', args, { env, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
const ascJson = (args) => JSON.parse(asc([...args, '--output', 'json']));

const appJson = JSON.parse(readFileSync('app.json', 'utf8'));
const version = appJson.expo.version;
const readTrimmed = (path) => readFileSync(path, 'utf8').replace(/\n$/, '');

const resolveAppId = () => {
  const apps = ascJson(['apps', 'list']).data;
  const app = apps.find((a) => a.attributes.bundleId === BUNDLE_ID);
  if (!app) die(`no App Store Connect app with bundle id ${BUNDLE_ID} is visible to this API key`);
  return app.id;
};

const findVersion = (app) => {
  const list = ascJson(['versions', 'list', '--app', app, '--version', version]).data;
  const found = list.find((v) => v.attributes.versionString === version && v.attributes.platform === 'IOS');
  if (!found) return null;
  return {
    id: found.id,
    state: found.attributes.appStoreState,
    copyright: found.attributes.copyright,
    editable: found.attributes.appStoreState === EDITABLE_STATE,
  };
};

// ─── push steps ───────────────────────────────────────────────────────────

const ensureVersion = (app) => {
  let ref = findVersion(app);
  const copyright = readTrimmed(COPYRIGHT_PATH);
  if (!ref) {
    if (dryRun) {
      log(`[version] would create version ${version} (copyright "${copyright}")`);
      return { ref: null, editable: true };
    }
    asc(['versions', 'create', '--app', app, '--version', version, '--platform', 'IOS', '--copyright', copyright]);
    log(`[version] created version ${version}`);
    ref = findVersion(app);
    if (!ref) die(`version ${version} still missing after create — check App Store Connect`);
  }
  return { ref, editable: ref.editable };
};

const syncCopyright = (app, ref) => {
  if (!ref) return;
  const copyright = readTrimmed(COPYRIGHT_PATH);
  if (ref.copyright === copyright) {
    log(`[copyright] up to date ("${copyright}")`);
    return;
  }
  if (dryRun) {
    log(`[copyright] would update "${ref.copyright}" → "${copyright}"`);
    return;
  }
  asc(['versions', 'update', '--version-id', ref.id, '--copyright', copyright, '--confirm']);
  log(`[copyright] updated "${ref.copyright}" → "${copyright}"`);
};

const pushMetadata = (app, editable) => {
  if (!editable) {
    log(`[metadata] version ${version} is ${'not editable'} — skipped (applies at the next release)`);
    return;
  }
  const args = ['metadata', 'push', '--app', app, '--version', version, '--dir', METADATA_DIR];
  if (dryRun) args.push('--dry-run');
  asc(args);
  log(`[metadata] ${dryRun ? 'planned (dry run above)' : 'pushed'} text from ${METADATA_DIR}`);
};

const pushScreenshots = (app, editable) => {
  if (!editable) {
    log('[screenshots] version not editable — skipped (applies at the next release)');
    return;
  }
  const locales = readdirSync(SCREENSHOTS_DIR).filter((d) => !d.startsWith('.'));
  for (const { dir, deviceType } of SCREENSHOT_DEVICES) {
    const empty = locales.every((l) => {
      const p = join(SCREENSHOTS_DIR, l, dir);
      return !existsSync(p) || readdirSync(p).length === 0;
    });
    if (empty) continue;
    const args = [
      'screenshots', 'upload',
      '--app', app, '--version', version,
      '--path', SCREENSHOTS_DIR,
      '--device-type', deviceType,
      '--replace', '--confirm',
    ];
    if (dryRun) args.push('--dry-run');
    asc(args);
    log(`[screenshots] ${dryRun ? 'planned (dry run above)' : 'uploaded'} → ${deviceType}`);
  }
};

const pushCategories = (app, editable) => {
  if (!editable) {
    log('[categories] version not editable — skipped (applies at the next release)');
    return;
  }
  const currentPrimary = ascJson(['apps', 'info', 'relationships', 'primary-category', '--app', app]).data?.id;
  const currentSecondary = ascJson(['apps', 'info', 'relationships', 'secondary-category', '--app', app]).data?.id;
  if (currentPrimary === CATEGORIES.primary && currentSecondary === CATEGORIES.secondary) {
    log(`[categories] up to date (${CATEGORIES.primary} / ${CATEGORIES.secondary})`);
    return;
  }
  if (dryRun) {
    log(`[categories] would set ${currentPrimary} → ${CATEGORIES.primary}, ${currentSecondary} → ${CATEGORIES.secondary}`);
    return;
  }
  asc(['categories', 'set', '--app', app, '--primary', CATEGORIES.primary, '--secondary', CATEGORIES.secondary]);
  log(`[categories] set ${CATEGORIES.primary} / ${CATEGORIES.secondary}`);
};

const pushReviewNotes = (ref) => {
  if (!ref) return;
  if (!ref.editable) {
    log('[review] version not editable — skipped (applies at the next release)');
    return;
  }
  const detail = ascJson(['review', 'details-for-version', '--version-id', ref.id]);
  if (!detail.data) {
    log('[review] no review detail on this version — create it once in App Store Connect (contact info is deliberately manual), then re-run');
    return;
  }
  const notes = readTrimmed(REVIEW_NOTES_PATH);
  if (detail.data.attributes.notes === notes) {
    log('[review] notes up to date');
    return;
  }
  if (dryRun) {
    log('[review] would update review notes');
    return;
  }
  asc(['review', 'details-update', '--id', detail.data.id, '--notes', notes]);
  log('[review] notes updated');
};

// ─── commands ─────────────────────────────────────────────────────────────

const cmd = process.argv[2];
if (!cmd || !['push', 'pull'].includes(cmd)) {
  die('usage: node scripts/store-ios.mjs <push|pull> [--dry-run] [--only=step,…]');
}

const appId = resolveAppId();
log(`app ${BUNDLE_ID} (${appId}), version ${version}${dryRun ? ' — DRY RUN' : ''}`);

if (cmd === 'pull') {
  asc(['metadata', 'pull', '--app', appId, '--version', version, '--dir', METADATA_DIR, '--force']);
  log(`pulled metadata text into ${METADATA_DIR}`);
} else {
  const { ref, editable } = ensureVersion(appId);
  if (want('copyright')) syncCopyright(appId, ref);
  if (want('metadata')) pushMetadata(appId, editable);
  if (want('screenshots')) pushScreenshots(appId, editable);
  if (want('categories')) pushCategories(appId, editable);
  if (want('review')) pushReviewNotes(ref);
  log(dryRun ? 'dry run complete — nothing written' : 'push complete');
}
