// @ts-check
// Note: type annotations allow type checking and IDEs autocompletion

const lightCodeTheme = require('prism-react-renderer/themes/github')
const darkCodeTheme = require('prism-react-renderer/themes/dracula')

const math = require('remark-math')
const katex = require('rehype-katex')

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: 'UCL Artificial Intelligence Society',
  tagline: "The home of UCL's AI community",
  favicon: 'img/logo.png',

  // Set the production url of your site here
  url: 'https://uclaisociety.co.uk',
  // Set the /<baseUrl>/ pathname under which your site is served
  // For GitHub pages deployment, it is often '/<projectName>/'
  baseUrl: '/',

  // GitHub pages deployment config.
  // If you aren't using GitHub pages, you don't need these.
  organizationName: 'UCLAIS', // Usually your GitHub org/user name.
  projectName: 'UCLAIS.github.io', // Usually your repo name.

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
        docs: {
          sidebarPath: require.resolve('./sidebars.js'),
          remarkPlugins: [math],
          rehypePlugins: [katex],
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

  headTags: [
    {
      tagName: 'link',
      attributes: {
        rel: 'preconnect',
        href: 'https://fonts.googleapis.com',
      },
    },
    {
      tagName: 'link',
      attributes: {
        rel: 'preconnect',
        href: 'https://fonts.gstatic.com',
      },
    },
    {
      tagName: 'link',
      attributes: {
        rel: 'stylesheet',
        href: 'https://fonts.googleapis.com/css2?family=Bebas+Neue&display=swap',
      },
    },
  ],

  stylesheets: [
    {
      href: 'https://cdn.jsdelivr.net/npm/katex@0.13.24/dist/katex.min.css',
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
        disableSwitch: true,
        respectPrefersColorScheme: false,
      },
      navbar: {
        title: 'UCL AI Society',
        style: 'dark',
        logo: {
          alt: 'UCL AI Society Logo',
          src: 'img/logo_light.svg',
        },
        items: [
          { to: '/about-us', label: 'About Us', position: 'left' },
          { to: '/blog', label: 'Blog', position: 'left' },
          {
            type: 'docSidebar',
            sidebarId: 'docsSidebar',
            position: 'left',
            label: 'Docs',
          },

          {
            href: 'https://doxaai.com/',
            label: 'DOXA',
            position: 'right',
          },
          {
            href: 'https://climatehack.ai/',
            label: 'ClimateHack.AI',
            position: 'right',
          },
        ],
      },
      footer: {
        style: 'dark',
        links: [
          {
            title: 'Docs',
            items: [
              {
                label: 'Tutorial Series',
                to: '/docs/tutorials',
              },
              {
                label: 'Journal Club',
                to: '/docs/journal-club',
              },
            ],
          },
          {
            title: 'Community',
            items: [
              {
                label: 'Discord',
                href: 'https://discord.gg/KSUZuQx?ltclid=3f704b3b-9044-415a-a2d7-e41007214187',
              },
              {
                label: 'Facebook',
                href: 'https://www.facebook.com/AISoc.ucl/',
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
                label: 'Blog',
                to: '/blog',
              },
              {
                label: 'GitHub',
                href: 'https://github.com/facebook/docusaurus',
              },
              {
                label: 'DOXA',
                href: 'https://doxaai.com/',
              },
              {
                label: 'ClimateHack.AI',
                href: 'https://climatehack.ai/',
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
