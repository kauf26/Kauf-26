/**
 * Expo config plugin — writes Apple Privacy Manifest (PrivacyInfo.xcprivacy) into the iOS app target.
 * Declares camera/photo library usage and OAuth credentials sent to our server (no tracking).
 */
const fs = require("fs");
const path = require("path");
const { withXcodeProject } = require("@expo/config-plugins");
const {
  addResourceFileToGroup,
  getProjectName,
} = require("@expo/config-plugins/build/ios/utils/Xcodeproj");

const PRIVACY_MANIFEST = {
  NSPrivacyTracking: false,
  NSPrivacyTrackingDomains: [],
  NSPrivacyCollectedDataTypes: [
    {
      NSPrivacyCollectedDataType: "NSPrivacyCollectedDataTypePhotosorVideos",
      NSPrivacyCollectedDataTypeLinked: false,
      NSPrivacyCollectedDataTypeTracking: false,
      NSPrivacyCollectedDataTypePurposes: [
        "NSPrivacyCollectedDataTypePurposeAppFunctionality",
      ],
    },
    {
      NSPrivacyCollectedDataType: "NSPrivacyCollectedDataTypeUserID",
      NSPrivacyCollectedDataTypeLinked: true,
      NSPrivacyCollectedDataTypeTracking: false,
      NSPrivacyCollectedDataTypePurposes: [
        "NSPrivacyCollectedDataTypePurposeAppFunctionality",
      ],
    },
  ],
  NSPrivacyAccessedAPITypes: [
    {
      NSPrivacyAccessedAPIType: "NSPrivacyAccessedAPICategoryUserDefaults",
      NSPrivacyAccessedAPITypeReasons: ["CA92.1"],
    },
    {
      NSPrivacyAccessedAPIType: "NSPrivacyAccessedAPICategoryFileTimestamp",
      NSPrivacyAccessedAPITypeReasons: ["C617.1"],
    },
  ],
};

function buildPrivacyPlist(manifest) {
  const lines = ['<?xml version="1.0" encoding="UTF-8"?>', '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">', '<plist version="1.0">', "<dict>"];

  lines.push("  <key>NSPrivacyTracking</key>");
  lines.push(`  <${manifest.NSPrivacyTracking ? "true" : "false"}/>`);

  lines.push("  <key>NSPrivacyTrackingDomains</key>");
  lines.push("  <array/>");

  lines.push("  <key>NSPrivacyCollectedDataTypes</key>");
  lines.push("  <array>");
  for (const item of manifest.NSPrivacyCollectedDataTypes) {
    lines.push("    <dict>");
    lines.push("      <key>NSPrivacyCollectedDataType</key>");
    lines.push(`      <string>${item.NSPrivacyCollectedDataType}</string>`);
    lines.push("      <key>NSPrivacyCollectedDataTypeLinked</key>");
    lines.push(`      <${item.NSPrivacyCollectedDataTypeLinked ? "true" : "false"}/>`);
    lines.push("      <key>NSPrivacyCollectedDataTypeTracking</key>");
    lines.push(`      <${item.NSPrivacyCollectedDataTypeTracking ? "true" : "false"}/>`);
    lines.push("      <key>NSPrivacyCollectedDataTypePurposes</key>");
    lines.push("      <array>");
    for (const purpose of item.NSPrivacyCollectedDataTypePurposes) {
      lines.push(`        <string>${purpose}</string>`);
    }
    lines.push("      </array>");
    lines.push("    </dict>");
  }
  lines.push("  </array>");

  lines.push("  <key>NSPrivacyAccessedAPITypes</key>");
  lines.push("  <array>");
  for (const item of manifest.NSPrivacyAccessedAPITypes) {
    lines.push("    <dict>");
    lines.push("      <key>NSPrivacyAccessedAPIType</key>");
    lines.push(`      <string>${item.NSPrivacyAccessedAPIType}</string>`);
    lines.push("      <key>NSPrivacyAccessedAPITypeReasons</key>");
    lines.push("      <array>");
    for (const reason of item.NSPrivacyAccessedAPITypeReasons) {
      lines.push(`        <string>${reason}</string>`);
    }
    lines.push("      </array>");
    lines.push("    </dict>");
  }
  lines.push("  </array>");

  lines.push("</dict>", "</plist>", "");
  return lines.join("\n");
}

/**
 * @param {import('@expo/config-types').ExpoConfig} config
 */
function withPrivacyManifest(config) {
  return withXcodeProject(config, (modConfig) => {
    const { projectRoot, platformProjectRoot } = modConfig.modRequest;
    const projectName = getProjectName(projectRoot);
    const privacyFilePath = path.join(
      platformProjectRoot,
      projectName,
      "PrivacyInfo.xcprivacy"
    );
    const relativePath = path.join(projectName, "PrivacyInfo.xcprivacy");

    fs.mkdirSync(path.dirname(privacyFilePath), { recursive: true });
    fs.writeFileSync(privacyFilePath, buildPrivacyPlist(PRIVACY_MANIFEST), "utf8");

    if (!modConfig.modResults.hasFile(relativePath)) {
      modConfig.modResults = addResourceFileToGroup({
        filepath: relativePath,
        groupName: projectName,
        project: modConfig.modResults,
        isBuildFile: true,
        verbose: true,
      });
    }

    return modConfig;
  });
}

module.exports = withPrivacyManifest;
