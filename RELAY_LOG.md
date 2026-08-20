# Relay Log

Tracks cross-branch "relay" merges — where work from one platform branch
(app/android/ios) is ported into another (most often into `web`). Recorded here
so the app/web version pairing at each relay point doesn't need to be re-derived
from git history each time.

Each entry: the relay commit, the branch it landed on, that branch's version at
the commit, and the `app` branch's version as of the same time.

## Entries

| Date (UTC+3) | Relay commit | Landed on | Branch version | app version | Summary |
|---|---|---|---|---|---|
| 2026-08-20 03:33:50 | [`8a39610`](https://github.com/Juice-WRLD-API/Unreleased/commit/8a39610c30a28c29f955b1c18111fdf68427ad44) | web | 2.0.6 | 2.0.10 | Add Channels feature, relay app/android admin+editor+docs+news+stats+settings work, fix mobile Settings full-page render |
| 2026-08-20 03:32:51 | [`3fc57d9`](https://github.com/Juice-WRLD-API/Unreleased/commit/3fc57d905e4ec03033608242a18b7cc7ae9f9415) | web | 2.0.5 | 2.0.10 | Add era covers, EQ volume boost, queue search; relay from android |
| 2026-08-19 18:48:51 | [`a4ef317`](https://github.com/Juice-WRLD-API/Unreleased/commit/a4ef317b83185a50f5dc46511721a9aa714a1b0d) | claude/fervent-boyd-70a994 | 2.0.5 | 2.0.7 | Add era covers, EQ volume boost, queue search; relay from android |

## How to add a new entry

```bash
# find relay commits not yet logged
git log --all --oneline -i --grep="relay"

# version on the branch the relay commit landed on
git show <commit>:package.json | grep version

# app version as of the same timestamp
ts=$(git show -s --format=%ci <commit>)
app_commit=$(git rev-list -1 --before="$ts" app)
git show "$app_commit:package.json" | grep version
```
