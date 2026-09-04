# Archive duplicate n-health tree and remove duplicated backend package.json files

This PR archives an accidentally duplicated copy of the `n-health/` tree and removes duplicate `backend/package.json` files from the nested copies. The canonical project folders remain at the repository root: `backend/`, `admin-web/`, and `mobile/`.

What changed in this branch (cleanup/remove-duplicate-nhealth):
- Added `n-health-archive/` containing the full preserved contents of the nested `n-health/` copy. In particular the duplicated `backend/package.json` was saved as `n-health-archive/backend-package.json`.
- Replaced `n-health/backend/package.json` and `n-health/n-health/backend/package.json` with archived marker files pointing to the preserved content.
- Added `ARCHIVE_NOTICE.md` explaining why the archive exists and how to restore if needed.

Why archive instead of delete
- This is reversible and safe. It preserves history and allows manual review before permanent deletion.

Next steps
- Review the archived copy in `n-health-archive/` and confirm there are no unique changes to keep.
- If everything looks good, create a follow-up PR to permanently delete the `n-health/` duplicate tree.

Maintainers: @AbuBkrrr
