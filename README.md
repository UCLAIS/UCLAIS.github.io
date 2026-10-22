# Website

Welcome to the UCL AI Society website repo! Have a look at what we do: https://uclai.co.uk 🎉

## Installation

```
$ yarn
```

## Local Development

```
$ yarn start
```

This command starts a local development server and opens up a browser window. Most changes are reflected live without having to restart the server.

## Adding/Modifying content

If you would like to modify or add some content, please do so through a Pull Request. [Here](https://github.com/UCLAIS/UCLAIS.github.io/pull/5) is an example of a past pull request, which introduced a simple update to the website - have a look at the "Files changed" section.

The following instruction gives an example of how to edit a simple document page (e.g. one like [this](https://uclai.co.uk/our-initiatives/Nexus-Labs/)):

1. First, clone this repository (e.g. with `git clone`).
2. Make sure you have [node.js](https://nodejs.org/en/download/current) and [yarn](https://classic.yarnpkg.com/lang/en/docs/install) installed.
3. Create new branch for your change - e.g. `nexus-labs-fix-typo`.
4. In the project's directory in Terminal type `yarn` to install necessary node modules.
5. In another terminal window, type `yarn start`. This command will run a local development server in your browser - you will be able to make changes to the website and view them automatically updated!
6. Create/Open a desired file (e.g. `our-initatives/nexus-labs.md`) and introduce necessary changes. We use Markdown for all documents and blog posts - using it is very intuitive!
7. Commit your changes and push your branch to GitHub.
8. Create a pull request and ask one of the Dev Team members to review it (@Willmish, @wonjunlee33, @robbiebmorris, @TheRootOf3). We will make sure that everything works!
9. Once your change got LGTM, you can merge it and the website will be automatically updated! Cool, huh?

## Build

```
$ yarn build
```

This command generates static content into the `build` directory and can be served using any static contents hosting service.

## Deployment

This GitHub repository contains CD workflows, that will **automatically run** a test build for every pull request to `main`, and will perform actual deployment on every push to `main`.

## About

This website is built using [Docusaurus 2](https://docusaurus.io/), a modern static website generator.

## Image assets

Photographs and graphics are served as static files from this repository. Keep the
originals, then run `python3 scripts/optimise-images.py` with Pillow installed to
regenerate the small WebP portraits, article images and homepage logo. Commit the
generated files; visitors and production builds do not need an image service.
Committee thumbnails are sized for up to three times their displayed resolution.
The original Jeremy Lo Ying Ping author photograph was copied from
<https://jezz.me/img/jeremy_lo_ying_ping.jpg>.
Luma's live calendar and its event images remain hosted by Luma.

## Redesign preview on GitHub Pages

The redesign is published separately at <https://uclai.co.uk/preview/website-redesign/>.
Build it with `yarn build:preview`. The preview is public and marked `noindex`.
`scripts/stage-preview.mjs` copies that build into an existing `gh-pages` checkout,
only replacing `preview/website-redesign/` and verifying all other files stay unchanged.
Commit and push that directory on `gh-pages` to update the test URL.
A production deployment from `main` can remove this temporary preview directory.
