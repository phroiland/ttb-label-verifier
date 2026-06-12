# Test Label Suite

Synthetic labels covering each compliance outcome, generated programmatically (PIL). Use these to verify the app end-to-end in under two minutes — no need to source or generate your own labels.

## Standard application data

Unless a test case says otherwise, enter this application data:

| Field | Value |
|---|---|
| Brand name | `OLD TOM DISTILLERY` |
| Class/type | `Kentucky Straight Bourbon Whiskey` |
| Alcohol content | `45% Alc./Vol. (90 Proof)` |
| Net contents | `750 mL` |
| Producer/bottler | `Old Tom Distillery, Lawrenceburg, Kentucky, USA` |
| Country of origin | `USA` |
| Beverage type | Distilled spirits |

## Test matrix

| # | File | What's on the label | Expected outcome |
|---|---|---|---|
| 1 | `01-pass-clean.png` | Everything correct, exact statutory warning | ✅ **Approved** — all checks pass; warning diff shows exact match |
| 2 | `02-fail-titlecase-warning.png` | Warning wording correct but prefix is "Government Warning:" in title case | ❌ **Rejected** — deterministic check fails on prefix capitalization (the exact violation Jenny described catching by hand) |
| 3 | `03-fail-modified-warning.png` | Warning says "should not consume" instead of "should not drink", "may impair" instead of "impairs" | ❌ **Rejected** — diff view highlights exactly which words deviate |
| 4 | `04-fail-missing-warning.png` | No warning statement at all | ❌ **Rejected** — warning reported missing |
| 5 | `05-warn-brand-case.png` | Brand printed as "Old Tom's Distillery" | ⚠️ **Review needed** — brand name case/punctuation difference flagged as warning, not hard failure (Dave's "STONE'S THROW" scenario) |
| 6 | `06-gin-silver-thistle.png` | Correct gin label (Silver Thistle, 42%, 700 mL) — enter ABV as `40%` in the application | ❌ **Rejected** — numerical ABV mismatch. Enter `42% Alc./Vol.` instead for a clean pass |
| 7 | `07-unreadable-blurry.png` | Same as #1 but heavily blurred | 🔍 **Image unreadable** — app declines to guess and asks for a better photo (Jenny's bad-image scenario) |

For test 6, the application data is: brand `Silver Thistle Distilling Co.`, class/type `London Dry Gin`, net contents `700 mL`, origin `England`.

## Why synthetic labels

Generated labels give deterministic, legible text with known ground truth — every deviation is intentional and documented. Real COLA labels from [TTB's public registry](https://ttbonline.gov/colasonline) work too and were used in exploratory testing, but can't be redistributed in this repo with the same confidence about expected outcomes.

## Batch CSV sample

`application-data.csv` in this folder is a working per-label data file for batch mode: upload all seven labels plus this CSV on the Batch tab, and each label gets its own correct application data (including the gin's different brand/ABV/size). Expected batch outcome: 2 approved, 1 review needed, 3 rejected, 1 unreadable.
