# Imported reference runs — the extraction parity gate

Two runs carried over unchanged from the development repository where the pipeline was
originally built, kept under the old timestamped naming convention. They are NOT paper
experiments and back no claim in the paper; every reportable arm lives in
`../experiments/`.

Their purpose is verification of the code extraction: after the pipeline and scorer were
extracted into this repository, these fixed artifacts were re-scored here and the resulting
metrics matched the development repository's output exactly. Together with a live dev-slice
arm re-run, this is the evidence that the extracted code is equivalent to the code that
produced the early development results.

- `2026-08-23-1241-skos-v8-gem37-*` — flash judge, v8 decoupled, numeric document order
- `2026-08-23-1241-skos-v8-gem37-rev-*` — the same configuration, reversed order

Note the run cards' `input.path` values still point into the development environment —
deliberately untouched, since rewriting any byte would defeat the purpose of a parity
artifact.
