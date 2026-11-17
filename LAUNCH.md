# Launching the site

Fuego publishes itself to GitHub Pages as a project site at
<https://danfirsten.github.io/acatenango/>. Everything is in place except one
setting that only the repository owner can change.

## Turn on GitHub Pages

1. On a free GitHub plan, Pages only works for public repositories, so first
   make the repository public: **Settings**, **General**, **Danger Zone**,
   **Change visibility**, **Make public**. (A paid plan can publish from a
   private repository, but the site itself is public either way.)
2. Go to **Settings**, **Pages**.
3. Under **Build and deployment**, set **Source** to **GitHub Actions**. Do not
   pick "Deploy from a branch": the site needs a build step.
4. Go to **Actions**, **Publish to GitHub Pages**, **Run workflow** to publish
   straight away, or wait for the next push or bulletin.

The first run takes a few minutes. The address appears on the run's summary
and on the Pages settings page.

## What publishes it

`.github/workflows/pages.yml` builds the static export with the base path
`/acatenango` and deploys it. It runs:

- on every push to the default branch, such as a merged pull request;
- after every successful run of **Collect Fuego bulletin** that committed a new
  bulletin (the collector's own pushes cannot start a push workflow);
- by hand, from the Actions tab.

While Pages is off, or set to deploy from a branch, the workflow does not fail.
It skips the build and leaves a notice on the run saying why.

## Building it yourself

The base path comes from `PAGES_BASE_PATH`, which is empty unless set, so the
site builds for the root by default.

```
npm run build                                  # for /, as on localhost
PAGES_BASE_PATH=/acatenango npm run build      # as GitHub Pages serves it
npm run test:e2e                               # builds for /acatenango and tests it from a subfolder, online and offline
```

`SITE_URL` sets the absolute address used for the social card and defaults to
the Pages address above. A custom domain is out of scope.

## Go-public checklist

Re-checked on 17 November 2026, after the ink and paper restyle (#39). First
checked for the hardening pass (#13). Each line is either done in the
repository or is a click only the owner can make.

| Check | Status |
|---|---|
| History secret scan | Clean. A fresh `git clone --mirror` (every branch and pull request ref: 54 refs, 298 commits) was scanned with gitleaks 8.24.3 over all of history, and every commit's tree was searched for secret-looking file names (`.env`, keys, certificates, `.npmrc`), token shapes (AWS, GitHub, Anthropic, OpenAI, Slack, Google, JWT, private keys) and key, secret, token or password assignments. Nothing found. |
| Licence | Done. The code is MIT (`LICENSE`); the README says the bulletin text belongs to INSIVUMEH and is not covered by it. |
| README | Done. It names the live address, says plainly that this is an unofficial archive and not a warning service, and points to INSIVUMEH and CONRED. |
| Look | Done. The ink and paper restyle has landed, and a design review on `/`, `/es/` and the 404 at 390, 768 and 1440 wide, on paper and in ink, found nothing left blocking (#39). |
| Social cards | Done. `public/og.png` and `public/og-es.png` are taken from the new first screen in each language (`npm run og`). The title no longer says "live". |
| Pages workflow | Done. `pages.yml` builds under `/acatenango` and deploys; until Pages is on it skips with a notice. |
| Collector | Done. `collect.yml` runs on its schedule twice a day and commits each bulletin. |
| Stored records | Done. Every record in `data/bulletins` is at the current parser version, and a unit test keeps it so. |
| Page tests | Done. `npm run test:e2e` covers the subfolder build online and offline, both languages, the phone layout, the first screen, replaying a day, motion and reduced motion, accessibility (axe, on paper and in ink), the keyboard, and missing days never shown as zero. |
| Security review | Done, nothing blocking. Fixed: the collector's write token is used only to push, downloads time out and have a size limit, `BULLETIN_URL` must be an https address on insivumeh.gob.gt, CI's token is read-only, the offline cache ignores query strings. Filed as #32: pin actions by SHA, remove the unused pdfjs path. `npm audit --omit=dev` finds nothing (re-run for #39); the high findings in the full audit are lint tooling only and are not in the site. |
| Repository public | Not yet: the owner's click, below. |
| Pages on | Not yet: the owner's click, below. |

### What Dan clicks

1. **Settings**, **General**, **Danger Zone**, **Change visibility**, **Make
   public**, and confirm.
2. **Settings**, **Pages**, **Build and deployment**, **Source**: **GitHub
   Actions**.
3. **Actions**, **Publish to GitHub Pages**, **Run workflow**, **Run
   workflow**. When it is green, open <https://danfirsten.github.io/acatenango/>.
4. Once public, also worth turning on (free for public repositories):
   **Settings**, **Code security**, **Secret Protection** and **Push
   protection**, and **Dependabot alerts**.
5. **Settings**, **Actions**, **General**, **Approval for running fork pull
   request workflows from contributors**: **Require approval for all external
   contributors**.
