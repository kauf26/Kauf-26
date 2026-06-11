/**
 * Xcode 16+ Swift fix: TARGET_IPHONE_SIMULATOR macro unavailable in Swift.
 * Safe to re-run (idempotent).
 */
const fs = require('fs');
const path = require('path');

const target = path.join(
  __dirname,
  '..',
  'node_modules',
  'expo-dev-menu',
  'ios',
  'DevMenuViewController.swift'
);

if (!fs.existsSync(target)) {
  process.exit(0);
}

const original = fs.readFileSync(target, 'utf8');
const broken = 'let isSimulator = TARGET_IPHONE_SIMULATOR > 0';
const fixed = `#if targetEnvironment(simulator)
    let isSimulator = true
    #else
    let isSimulator = false
    #endif`;

if (original.includes(broken)) {
  fs.writeFileSync(target, original.replace(broken, fixed));
  console.log('[patch-expo-dev-menu] Patched DevMenuViewController.swift for Xcode 16+');
}
