/**
 * Patches the iOS Podfile post_install hook so fmt builds under Xcode 26+.
 * @see https://github.com/expo/expo/issues/44229
 */
const { withDangerousMod } = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

const MARKER = "# @generated begin withXcode26FmtFix";
const FMT_FIX = `
    ${MARKER}
    installer.pods_project.targets.each do |target|
      if target.name == 'fmt'
        target.build_configurations.each do |config|
          config.build_settings['CLANG_CXX_LANGUAGE_STANDARD'] = 'c++17'
        end
      end
    end

    fmt_base = File.join(installer.sandbox.root, 'fmt', 'include', 'fmt', 'base.h')
    if File.exist?(fmt_base)
      content = File.read(fmt_base)
      unless content.include?('Xcode 26 workaround')
        patched = content.gsub(
          /^(#elif defined\\(__cpp_consteval\\)\\n#  define FMT_USE_CONSTEVAL) 1/m,
          "// Xcode 26 workaround: disable consteval\\n\\\\1 0"
        )
        if patched != content
          File.chmod(0644, fmt_base)
          File.write(fmt_base, patched)
        end
      end
    end
    # @generated end withXcode26FmtFix
`;

/**
 * @param {import('@expo/config-types').ExpoConfig} config
 */
function withXcode26FmtFix(config) {
  return withDangerousMod(config, [
    "ios",
    async (modConfig) => {
      const podfilePath = path.join(modConfig.modRequest.platformProjectRoot, "Podfile");
      let contents = fs.readFileSync(podfilePath, "utf8");

      if (contents.includes(MARKER)) {
        return modConfig;
      }

      const anchor = "    react_native_post_install(";
      const anchorIndex = contents.indexOf(anchor);
      if (anchorIndex === -1) {
        throw new Error("[withXcode26FmtFix] Could not find react_native_post_install in Podfile");
      }

      const closingIndex = contents.indexOf("    )", anchorIndex);
      if (closingIndex === -1) {
        throw new Error("[withXcode26FmtFix] Could not find react_native_post_install closing paren");
      }

      const insertAt = closingIndex + "    )".length;
      contents =
        contents.slice(0, insertAt) + "\n" + FMT_FIX + contents.slice(insertAt);
      fs.writeFileSync(podfilePath, contents);

      return modConfig;
    },
  ]);
}

module.exports = withXcode26FmtFix;
