# n-health-archive

This directory preserves the original contents of the nested `n-health/` copy that existed in the repository root before this cleanup.

Why this archive exists
- A duplicate `n-health/` tree was found at the repo root, including a copy of the `backend/` project and other documentation files. To avoid accidental deletion, the duplicate was preserved here for review.

What to review
- The canonical project folders remain at the repo root and are the active ones: `backend/`, `admin-web/`, and `mobile/`.
- The duplicate backend package.json copies have been saved to `n-health-archive/backend-package.json` for inspection.

If you confirm there are no unique changes in the archived copy, we can permanently remove `n-health/` from the main branch in a follow-up PR.
