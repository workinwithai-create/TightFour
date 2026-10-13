# TightFour

Four-bar tight pocket desk for bedroom producers and AI-music finishers.

Suno and loop DAWs leave the four bars dragging on roots and full kit hits. After hours of looping the producer abandons the track because it never locks. Session players add soft ghost notes on the snare, nylon chops on the ands, and a locked upright so the pocket breathes and the loop finally finishes.

TightFour seats live chairs on that decision: drag vs tight, then exports the WAV and MIDI that drop on bar 1 of a DAW.

Live samples only — FluidR3 acoustic grand, upright bass, nylon guitar, trumpet, violin, and acoustic kit from the PreEight bank pinned to commit `d58301e4a494555f411a2afbc448b724136eee76`.

No oscillators. Audio never leaves the tab.

## Distinct from yesterday and the rest of the line

| Tool | Job |
| --- | --- |
| TagFour | Four-bar last-line tag after the money chorus |
| ModEight | Last-chorus key change |
| LiftTwo | Two bars of climb into the hook |
| PreEight | Eight bars before the hook |
| AfterHook | Eight bars after the hook |
| EndEight | Last eight bars of the record |
| LastHook | Last chorus is the money chorus |
| WalkBass | Four bars that walk the bass |
| RollFour | Four-bar snare-roll and tom-fill |
| GhostEight | Eight-bar ghost-note kit |
| **TightFour** | Four bars that lock the pocket with ghosts and chops so the loop finishes |

Yesterday's ship was RollFour / WalkBass. TightFour is the missing lock on the pocket you already have.

## Pricing recommendation

One-time **$19** on Lemon Squeezy. Mirror on Gumroad.

This is a finite desk, not a cloud meter. Do not subscribe. Forge Pass stays for the cloud tools.

The shipped app is free (MIT). No license gate. A priced build would need a Lemon Squeezy key check.

## Samples

Pinned commit SHAs only.

* PreEight bank @d58301e4a494555f411a2afbc448b724136eee76

Never @main or @gh-pages.

## Export

Default bounce is 48 kHz, 24-bit stereo.

At 92 BPM and 8 bars the loop file is exactly 1,001,739 samples (`Math.round(8 * 4 * 60 / 92 * 48000)`), first downbeat at sample 0.

The offline render reuses the already-loaded ArrayBuffers.

Peak ≤ −1 dBFS. Filenames: `tightfour-recipe-92bpm-Aminor.wav` and matching `.mid`.

## License

MIT. workinwithai-create.
