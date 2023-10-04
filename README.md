# Website

Welcome to the UCL AI Society website repo! Have a look at what we do: http://uclaisociety.co.uk 🎉

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

The following instruction gives an example of how to edit a simple document page (e.g. one like [this](https://uclaisociety.co.uk/our-initiatives/nexus-labs/)):

1. First, clone this repository (e.g. with `git clone`).
2. Make sure you have [node.js](https://nodejs.org/en/download/current) and [yarn](https://classic.yarnpkg.com/lang/en/docs/install) installed.
3. Create new branch for your change - e.g. `nexus-labs-fix-typo`.
4. In the project's directory in Terminal type `yarn` to install necessary node modules.
5. In another terminal window, type `yarn start`. This command will run a local development server in your browser - you will be able to make changes to the website and view them automatically updated!
6. Create/Open a desired file (e.g. `our-initatives/nexus-labs.md`) and introduce necessary changes. We use Markdown for all documents and blog posts - using it is very intuitive!
7. Commit your changes and push your branch to GitHub.
8. Create a pull request and ask one the Dev Team members to review it!
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
