# Prefix transplant note (2026-08-24)

This directory continues the 119-document prefix of t-b2-31b-gembed2-r2-a49ce7b73b1e.
The original runId is unrecoverable: it was computed against a dirty-figure git diff whose
working-tree content was later overwritten (figure regeneration), and runId = config + git
state. The run-card diff between the two ids shows ONLY git.sha/git.diffHash differ — config,
prompts, and pipeline code are identical — so the prefix is valid under the new id. The
continuation resumes via the standard skip-existing-artifacts mechanism.
