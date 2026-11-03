# Release Process — youtube-personal-feed

## Tag naming convention

Use a version tag **without** the leading `v` prefix (e.g. `0.1.6`, not `v0.1.6`).

The publish workflow (`publish.yml`) strips an optional leading `v` from the tag name and compares it to `package.json`'s version:

```bash
TAG="${GITHUB_REF_NAME#v}"
PKG_VERSION="$(node -p "require('./package.json').version")"
if [ "$TAG" != "$PKG_VERSION" ]; then
  echo "Release tag ($GITHUB_REF_NAME) does not match package.json version ($PKG_VERSION)"
  exit 1
fi
```

Using a bare `0.1.6` tag keeps the tag name identical to the package version and avoids any ambiguity.

## Steps for a release

1. Bump `version` in `package.json` (e.g. `0.1.5` → `0.1.6`).
2. Run `npm install` so `package-lock.json` reflects the same version — the lock file must match `package.json` before committing.
3. Commit the version bump: `git commit -m "chore: release 0.1.6"`.
4. Create the tag without `v`: `git tag 0.1.6 && git push origin 0.1.6`.
5. Create a GitHub release with tag `0.1.6` (not `v0.1.6`). The publish workflow triggers automatically on release publication.
6. The workflow runs `npm ci`, lint, typecheck, build, then `npm publish --provenance --access public`.

## Verification before releasing

- `npm run format` — Biome formatting
- `npm run lint` — Biome linting
- `npm run typecheck` — TypeScript type checking
- `npm run build` — Compiles `src/` → `dist/`
- `npm run test` — Unit tests
- `npm run smoke` — Live API smoke test (if credentials present)
- `npm pack --dry-run` — Verify package metadata/binaries
