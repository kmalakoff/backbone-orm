# Contributing to BackboneORM

## Branches

`support/0.x` maintains the original v1 implementation at package version 0.7.14, based on tag `0.7.14` plus the existing local repository setup. `master` is the v2 TypeScript migration integration line. The migration remains in progress; a checkpoint or merge is not release or full parity acceptance.

Apply fixes to the support line individually by cherry-pick. Do not merge v2 changes into it. Documentation uses the separate `gh-pages` line.

Support releases must use the `support-0` npm dist-tag. The shared publish guard rejects a missing or different tag on `support/0.x`. Existing validation and lifecycle commands remain in place. Publishing, version changes and tags belong to the maintainer.
