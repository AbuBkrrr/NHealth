Moved duplicate n-health/ tree into n-health-archive/ for safe archival.

This branch (cleanup/remove-duplicate-nhealth) was created to preserve the nested copy while removing duplicate package manifests that caused confusion.

What I did in this commit:
- Created n-health-archive/ and preserved the duplicate backend package.json content as n-health-archive/backend-package.json.
- Replaced the duplicate package.json files inside the nested copies with a small archived marker noting where the full content was preserved.

Why: many automated tools, CI, and deploy platforms can pick the wrong project root when there are duplicate project trees. This is a reversible, reviewable change so you can inspect before merging.

If you want the full nested tree removed instead of archived, merge this PR and I can follow up with a permanent deletion.

Branch: cleanup/remove-duplicate-nhealth
