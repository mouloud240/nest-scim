import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitepress';

const base = process.env.DOCS_BASE ?? '/nest-scim/';
const websiteRoot = fileURLToPath(new URL('../', import.meta.url));

export default defineConfig({
  base,
  title: 'Nest SCIM',
  description: 'SCIM 2.0 provisioning for NestJS. The protocol is handled; your app owns its data.',
  cleanUrls: true,
  lastUpdated: true,
  vite: {
    resolve: { alias: { '@': websiteRoot } },
  },
  head: [
    ['meta', { name: 'theme-color', content: '#ffffff' }],
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:title', content: 'Nest SCIM — SCIM 2.0 for NestJS' }],
    [
      'meta',
      {
        property: 'og:description',
        content: 'The SCIM protocol, built for NestJS. You bring storage and mapping.',
      },
    ],
    ['link', { rel: 'icon', type: 'image/svg+xml', href: `${base}favicon.svg` }],
  ],
  themeConfig: {
    logo: '/mark.svg',
    siteTitle: 'Nest SCIM',
    nav: [
      { text: 'Guide', link: '/guide/getting-started' },
      { text: 'Reference', link: '/reference/module-options' },
      { text: 'Recipes', link: '/recipes/okta' },
      {
        text: 'GitHub',
        link: 'https://github.com/mouloud240/nest-scim',
        target: '_blank',
        rel: 'noreferrer',
      },
    ],
    sidebar: [
      {
        text: 'Guides',
        collapsed: true,
        items: [
          {
            text: 'Start here',
            collapsed: true,
            items: [
              { text: 'Getting started', link: '/guide/getting-started' },
              { text: 'Architecture', link: '/guide/architecture' },
            ],
          },
          {
            text: 'User provisioning',
            collapsed: true,
            items: [
              { text: 'Users and mapping', link: '/guide/users' },
              { text: 'PATCH', link: '/guide/patch' },
              { text: 'Filtering', link: '/guide/filtering' },
              { text: 'Pagination', link: '/guide/pagination' },
            ],
          },
          {
            text: 'Operations',
            collapsed: true,
            items: [
              { text: 'Authentication', link: '/guide/authentication' },
              { text: 'Errors', link: '/guide/errors' },
            ],
          },
        ],
      },
      {
        text: 'API reference',
        collapsed: true,
        items: [
          {
            text: 'Module',
            collapsed: true,
            items: [
              { text: 'Module options', link: '/reference/module-options' },
              { text: 'Endpoints', link: '/reference/endpoints' },
            ],
          },
          {
            text: 'Contracts',
            collapsed: true,
            items: [
              { text: 'SPI contracts', link: '/reference/spi' },
              { text: 'DomainFilter', link: '/reference/domain-filter' },
            ],
          },
          { text: 'Errors', link: '/reference/errors' },
        ],
      },
      {
        text: 'Recipes',
        collapsed: true,
        items: [
          {
            text: 'Identity providers',
            collapsed: true,
            items: [
              { text: 'Okta', link: '/recipes/okta' },
              { text: 'Microsoft Entra ID', link: '/recipes/entra-id' },
            ],
          },
          {
            text: 'Storage',
            collapsed: true,
            items: [{ text: 'Translate filters for your store', link: '/recipes/store-filtering' }],
          },
        ],
      },
      {
        text: 'Project',
        collapsed: true,
        items: [{ text: 'Status and scope', link: '/project/status' }],
      },
    ],
    search: { provider: 'local' },
    editLink: {
      pattern: 'https://github.com/mouloud240/nest-scim/edit/master/website/:path',
      text: 'Edit this page on GitHub',
    },
    socialLinks: [{ icon: 'github', link: 'https://github.com/mouloud240/nest-scim' }],
    footer: {
      message: 'SCIM 2.0 for NestJS. Built around RFC 7643 and RFC 7644.',
      copyright: 'License and release details are in the repository.',
    },
    outline: { level: [2, 3] },
  },
});
