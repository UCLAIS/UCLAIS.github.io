// @ts-check
// Note: type annotations allow type checking and IDEs autocompletion

const lightCodeTheme = require('prism-react-renderer/themes/github')
const darkCodeTheme = require('prism-react-renderer/themes/dracula')

const math = require('remark-math')
const katex = require('rehype-katex')
const preview = require('./scripts/preview-config.cjs')
const isPreview = process.env.SOCIETY_PREVIEW === 'true'
const siteBaseUrl = isPreview ? preview.baseUrl : '/'

const defaultSsrTemplate = require('@docusaurus/core/lib/webpack/templates/ssr.html.template').default

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: 'UCL Artificial Intelligence Society',
  tagline: "The home of UCL's AI community",
  favicon: 'img/design/society-light-128.webp',
  customFields: {
    knowledge: {
      publicMcpUrl: process.env.KNOWLEDGE_PUBLIC_MCP_URL || '',
      editorMcpUrl: process.env.KNOWLEDGE_EDITOR_MCP_URL || '',
      publicApiUrl: process.env.KNOWLEDGE_PUBLIC_API_URL || '',
    },
  },
  // Preserve the stock 2.x template and defer its external hydration scripts.
  ssrTemplate: defaultSsrTemplate.replace('<script src=', '<script defer src='),

  // Set the production url of your site here
  url: 'https://uclai.co.uk',
  // Set the /<baseUrl>/ pathname under which your site is served
  // For GitHub pages deployment, it is often '/<projectName>/'
  baseUrl: siteBaseUrl,
  noIndex: isPreview,

  // GitHub pages deployment config.
  // If you aren't using GitHub pages, you don't need these.
  organizationName: 'UCLAIS', // Usually your GitHub org/user name.
  projectName: 'UCLAIS.github.io', // Usually your repo name.
  deploymentBranch: 'gh-pages',
  trailingSlash: true,

  onBrokenLinks: 'throw',
  onBrokenMarkdownLinks: 'warn',

  plugins: ['docusaurus-plugin-sass'],

  // Even if you don't use internalization, you can use this field to set useful
  // metadata like html lang. For example, if your site is Chinese, you may want
  // to replace "en" with "zh-Hans".
  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  presets: [
    [
      'classic',
      /** @type {import('@docusaurus/preset-classic').Options} */
      ({
        ...(isPreview ? { sitemap: false } : {}),
        docs: {
          sidebarPath: require.resolve('./sidebars.js'),
          remarkPlugins: [math],
          rehypePlugins: [katex],
          path: 'our-initiatives',
          routeBasePath: 'our-initiatives',
        },
        blog: {
          showReadingTime: true,
        },
        theme: {
          customCss: require.resolve('./src/css/custom.css'),
        },
      }),
    ],
  ],

  stylesheets: [
    {
      href: `${siteBaseUrl}vendor/katex/katex.min.css`,
      type: 'text/css',
      integrity:
        'sha384-odtC+0UGzzFL/6PNoE8rX/SPcQDXBJ+uRepguP4QkPCm2LBxH3FA3y+fKSiJ+AmM',
      crossorigin: 'anonymous',
    },
  ],

  themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    ({
      // image: 'img/docusaurus-social-card.jpg',
      colorMode: {
        defaultMode: 'light',
        disableSwitch: false,
        respectPrefersColorScheme: false,
      },
      navbar: {
        title: 'UCL AI Society',
        logo: {
          alt: 'UCL AI Society Logo',
          src: 'img/design/society-light-128.webp',
          srcDark: 'img/design/society-dark-128.webp',
          width: 42,
          height: 42,
        },
        items: [
          { to: '/', label: 'Home', position: 'left', exact: true },
          { to: '/about-us', label: 'About Us', position: 'left' },
          {
            to: '/our-initiatives',
            position: 'left',
            label: 'Our Initiatives',
            activeBaseRegex: `^${siteBaseUrl}our-initiatives(?:/(?!opportunities(?:/|$))|$)`,
          },
          { to: '/our-initiatives/opportunities/', label: 'Opportunities', position: 'left' },
          { to: '/connect/', label: 'Connect your AI', position: 'left' },
          { to: '/blog', label: 'Blog', position: 'left' },
        ],
      },
      footer: {
        style: 'light',
        links: [
          {
            title: 'Our Initiatives',
            items: [
              {
                label: 'Tutorial archive',
                to: '/our-initiatives/tutorials',
              },
              {
                label: 'Nexus Labs',
                to: '/our-initiatives/Nexus-Labs/',
              },
              {
                label: 'AgentVerse',
                href: 'https://agentverse.uclai.co.uk/',
              },
              {
                label: 'Opportunities',
                to: '/our-initiatives/opportunities/',
              },
              {
                label: 'Journal Club archive',
                to: '/our-initiatives/journal-club',
              },
            ],
          },
          {
            title: 'Community',
            items: [
              {
                label: 'WhatsApp',
                href: 'https://chat.whatsapp.com/I2B5ZCng7Id8k5iuaJvHtt',
              },
              {
                label: 'Events calendar',
                href: 'https://luma.com/UCLAISociety',
              },
              {
                label: 'Instagram',
                href: 'https://www.instagram.com/uclaisociety/',
              },
              {
                label: 'LinkedIn',
                href: 'https://www.linkedin.com/company/ucl-artificial-intelligence-society/',
              },
            ],
          },
          {
            title: 'More',
            items: [
              {
                label: 'Connect your AI',
                to: '/connect/',
              },
              {
                label: 'Blog',
                to: '/blog',
              },
              {
                label: 'GitHub',
                href: 'https://github.com/UCLAIS',
              },
            ],
          },
        ],
        copyright: `Copyright © ${new Date().getFullYear()} UCL Artificial Intelligence Society`,
      },
      prism: {
        theme: lightCodeTheme,
        darkTheme: darkCodeTheme,
      },
    }),
}

module.exports = config
