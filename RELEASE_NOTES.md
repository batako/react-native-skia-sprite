<!--
- Release note template instructions:
-   - Replace the placeholder bullets with actual issues/commits for the tag you are publishing.
-   - Prefer linking to issues (e.g. [#123](https://github.com/...)) when they exist; otherwise link to commits.
-   - Keep the section headers intact so automation can fill them consistently.
-   - Remove any empty section before publishing if there are no entries.
-->

## 🌟 Highlights
- Headless editor toolkit: `useSpriteEditor`, `SpriteEditUtils`, and a template system make it easy to build fully custom sprite editors without shipping UI opinions.
- Documentation overhaul: English/Japanese editor API guides plus README updates explain how to adopt the new tooling end-to-end.

## ✨ Features
- [`f8bc978`](https://github.com/batako/react-native-skia-sprite-animator/commit/f8bc978502b48a0a2d5aa4c8063d4e488f251f33) Added editor modules (`useSpriteEditor`, `SpriteEditUtils`, template exports), README updates, and comprehensive tests.
- [`443a8cf`](https://github.com/batako/react-native-skia-sprite-animator/commit/443a8cf356631e4bee46eabad9e41598fcf40d5a) Shipped the Japanese editor API reference to keep docs bilingual.
- [`44e3228`](https://github.com/batako/react-native-skia-sprite-animator/commit/44e3228d2e9dc7b2fdd849862e929c27550e0d06) Renamed the English editor API guide to “Editor API Reference” for consistency.

## 🐞 Bug Fixes
- _No issue tickets were closed in this release._

## 🔧 Refactors
- [`c93dcf0`](https://github.com/batako/react-native-skia-sprite-animator/commit/c93dcf0c06e2bad684b1fcf9deae768f5b307631) Documented all editor-facing types/helpers and tightened lint coverage.
- [`9911789`](https://github.com/batako/react-native-skia-sprite-animator/commit/99117892a379b38ae52d23d2d7df93a3022763c3) Added the initial GitHub release workflow with automated tests.
- [`b295d2a`](https://github.com/batako/react-native-skia-sprite-animator/commit/b295d2a58a6de7dd9f3220778ec16e9e238476e0) Switched the workflow to source release notes from `RELEASE_NOTES.md`.
- [`d8ab1c2`](https://github.com/batako/react-native-skia-sprite-animator/commit/d8ab1c2ea676b94b0416a552516887d1033841c8) Templatized the release notes file for repeatable output.
- [`ed5987c`](https://github.com/batako/react-native-skia-sprite-animator/commit/ed5987c615fc76773082a8dfb07befa670a2bc42) Commented out template content so the file always reflects the current release only.

## 📜 Full Changelog
- https://github.com/batako/react-native-skia-sprite-animator/compare/v0.2.0...v0.3.0
