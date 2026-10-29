# Connections and launch acceptance

## Public members' connection

The public MCP uses Streamable HTTP at the deployed public Worker's `/mcp` URL and requires no authentication. The site displays only configured endpoint URLs; an absent URL means deployment is pending.

### ChatGPT

Plugins → Add custom MCP server → paste the public URL, select no authentication and install. [Official OpenAI guide](https://developers.openai.com/api/docs/guides/custom-mcp-server).

### Claude

Customize → Connectors → Add custom connector → paste the public URL and enable it for your chat. [Official Claude guide](https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp).

### Gemini

Settings → Connected Apps → Custom apps → paste the public URL, where available. [Official Google guide](https://support.google.com/gemini/answer/17209137?hl=en).

As checked on 29 October 2026, Google requires a US personal account, age 18+, with Keep Activity on for Gemini web custom apps. Work/school accounts are excluded. This is not a confirmed option for UK members. Gemini CLI supports remote Streamable HTTP independently:

```sh
gemini mcp add --transport http ucl-ai-society https://PUBLIC_HOST/mcp
```

See the [official Gemini CLI guide](https://geminicli.com/docs/tools/mcp-server/). Gemini is additional documented setup, with no completed product-compatibility claim.

### One prompt after setup

“Connect to the public UCL AI Society MCP at PUBLIC_MCP_URL and answer my society questions using its cited sources.”

An assistant with configuration tools may complete setup from that prompt. Browser apps may require adding or approving the connection first. Once installed, select the society app with `@` when needed. A prompt alone does not grant installation permissions.

Both services must be able to reach the endpoint from their cloud infrastructure. Loopback development verifies the SDK, not those products. Do not put a privileged editor URL into a public member onboarding shortcut.

## Maintainers' connection

Add the deployed **Admin Worker's** `/mcp` endpoint as a separate connector called **UCL AI Society Editor**, selecting OAuth. The client discovers the separate OAuth Worker for sign-in. Sign in with an explicitly approved GitHub account. GitHub sign-in establishes identity; a current service role separately controls access.

Use editor tools to inspect source gaps, create/revise a draft and prepare a candidate. Open the returned review URL, sign in, examine the exact candidate and approve from the browser when ready. Bearer tokens do not authorise browser publication. Refreshing an import does not publish it.

If using a client-issued editor access token for CLI diagnostics, set `KNOWLEDGE_EDITOR_ACCESS_TOKEN` in the local process environment and run:

```sh
pnpm run doctor --editor-url https://EDITOR_HOST/mcp
```

This only initialises and lists tools; it does not retrieve draft bodies or call write tools. Do not paste tokens into command arguments, issue reports, screenshots or the public website build. The diagnostic intentionally does not store OAuth credentials or perform an interactive sign-in.

## Optional WebMCP

`/connect/` progressively registers public search, resource fetch, learning-path and event tools when `document.modelContext.registerTool` is available. It uses the same public HTTP API and omits credentials. Unsupported or changed browser APIs cannot break the connection page. No editor tools are registered.

Enable the browser's local testing flag or an appropriate origin trial when testing; this is experimental browser functionality. See [Chrome's current WebMCP guide](https://developer.chrome.com/docs/ai/webmcp) and [imperative API](https://developer.chrome.com/docs/ai/webmcp/imperative-api). No browser support is needed for remote MCP.

## Acceptance record

Start with a reviewed staging release. Record actual observations below for each client, rather than treating a successful HTTP check as a successful product connection.

| Check | Expected evidence |
| --- | --- |
| Public connection | ChatGPT and Claude both discover the five public tools without sign-in |
| FAQ | A membership or involvement answer cites a retrieved society source and release |
| Tutorial | Search finds a relevant notebook; fetch returns actual ordered cells with locators |
| Dates | Archived tutorials remain archived; expired records are not reported as upcoming |
| Gaps | Unavailable slides/recordings are described as links or unavailable, not as imported text |
| Update | A maintainer prepares a factual correction; only browser approval activates the immutable candidate |
| Refresh | Both clients retrieve the new release in subsequent calls; pinned old-release fetch remains consistent |
| Revocation | Removing the maintainer role rejects the next privileged request using the existing token |
| Restrictions | Public connection cannot discover editor tools or retrieve draft IDs |
| Recovery | Concurrent approval and interrupted publication preserve one complete active release |

Initial status: **not yet verified against deployed ChatGPT or Claude connections**. Add dated results, endpoint hostnames and release IDs after running the checks. Do not record credentials or full member prompts.
