fastlane documentation
----

# Installation

Make sure you have the latest version of the Xcode command line tools installed:

```sh
xcode-select --install
```

For _fastlane_ installation instructions, see [Installing _fastlane_](https://docs.fastlane.tools/#installing-fastlane)

# Available Actions

## iOS

### ios prebuild

```sh
[bundle exec] fastlane ios prebuild
```

Generate native ios/ project from Expo (required before gym)

### ios build

```sh
[bundle exec] fastlane ios build
```

Build App Store IPA with gym (regenerates ios/ if bundle ID is stale)

### ios upload_metadata

```sh
[bundle exec] fastlane ios upload_metadata
```

Upload metadata and screenshots only (no binary)

### ios submit_eas_ipa

```sh
[bundle exec] fastlane ios submit_eas_ipa
```

Submit an IPA built by EAS (or downloaded from expo.dev)

### ios eas_production

```sh
[bundle exec] fastlane ios eas_production
```

Recommended: build on EAS (handles code signing in the cloud). Run credentials setup first in Terminal.

### ios deploy

```sh
[bundle exec] fastlane ios deploy
```

Full deploy: gym build + deliver (local signing required — prefer eas_production)

### ios beta_upload

```sh
[bundle exec] fastlane ios beta_upload
```

Build + upload binary and metadata without submitting for review

----

This README.md is auto-generated and will be re-generated every time [_fastlane_](https://fastlane.tools) is run.

More information about _fastlane_ can be found on [fastlane.tools](https://fastlane.tools).

The documentation of _fastlane_ can be found on [docs.fastlane.tools](https://docs.fastlane.tools).
