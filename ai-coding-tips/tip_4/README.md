# The Planning Difference in AI Coding

## Code Comparison: Vibe vs Planned

**Without Planning:** `organize_downloads_vibed.py` (137 lines)
**With Planning:** `downloads_organizer_planned.py` (57 lines)

## AI Assumptions in Vibe Version

The AI over-engineered with these assumptions:

- **10 file categories** instead of requested 4 (.pdf, .jpg, .mp4, .zip)
- **Complex logging system** with file outputs and timestamps
- **Interactive CLI** with dry-run mode and user confirmations
- **Error handling** for duplicate files with auto-renaming
- **Cross-platform** Downloads folder detection
- **Extensible architecture** with type hints and modular functions

## Planned Version Adherence

The AI strictly followed the plan:

- ✅ **Exact 4 file types** (.pdf, .jpg, .jpeg, .mp4, .zip)
- ✅ **4 folders only** (Documents, Images, Videos, Archives)
- ✅ **Skip existing files** in target folders
- ✅ **Print summary** of moved files
- ✅ **Single file** with minimal dependencies
- ✅ **50 lines** of clean, focused code

## Key Takeaway

**Vibe coding** = AI fills gaps with assumptions
**Spec driven coding** = AI executes exactly what's specified

Planning saves 60% of code and controls feature creep.
