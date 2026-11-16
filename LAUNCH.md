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
