/**
 * Bundled CHANGELOG.md text (Vite `?raw` import), shared by the post-update
 * "What's new" popup and the on-demand Settings entry so both read the exact
 * same release notes without re-importing the file in multiple places.
 */
import changelogMarkdown from "../../../CHANGELOG.md?raw";

export { changelogMarkdown };
