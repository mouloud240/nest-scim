<script setup lang="ts">
import { ref } from 'vue';
import { withBase } from 'vitepress';

const copied = ref(false);
const copyStatus = ref('');
let copiedTimer: ReturnType<typeof setTimeout> | undefined;

async function copyInstall(): Promise<void> {
  try {
    await navigator.clipboard.writeText('npm install @nest-scim/core');
  } catch {
    const field = document.createElement('textarea');
    field.value = 'npm install @nest-scim/core';
    field.setAttribute('readonly', '');
    field.style.position = 'fixed';
    field.style.opacity = '0';
    document.body.append(field);
    field.select();
    const succeeded = document.execCommand('copy');
    field.remove();
    if (!succeeded) {
      copyStatus.value = 'Copy failed. Select the install command and copy it manually.';
      return;
    }
  }

  copied.value = true;
  copyStatus.value = 'Install command copied to clipboard.';
  if (copiedTimer) clearTimeout(copiedTimer);
  copiedTimer = setTimeout(() => {
    copied.value = false;
    copyStatus.value = '';
  }, 1800);
}

const capabilities = [
  {
    title: 'Protocol, already handled',
    body: 'Users CRUD, discovery, RFC 7644 PATCH, list responses, and SCIM errors.',
    ref: 'RFC 7644',
  },
  {
    title: 'Your storage stays yours',
    body: 'Map your domain model once. Translate filter trees into your database dialect.',
    ref: 'TWO CONTRACTS',
  },
  {
    title: 'Built for real provisioning',
    body: 'Pagination limits, uniqueness checks, media types, and response metadata included.',
    ref: 'SCIM 2.0',
  },
];

const endpoints = [
  ['GET', '/Users', 'List users · filter · pagination'],
  ['POST', '/Users', 'Create a user'],
  ['GET', '/Users/{id}', 'Read one user'],
  ['PUT', '/Users/{id}', 'Replace a user'],
  ['PATCH', '/Users/{id}', 'Apply ordered operations'],
  ['DELETE', '/Users/{id}', 'Remove a user'],
  ['GET', '/ServiceProviderConfig', 'Advertise provider capabilities'],
  ['GET', '/Schemas', 'Publish the User schema'],
];
</script>

<template>
  <div class="landing-shell">
    <a class="skip-link" href="#main">Skip to content</a>
    <header class="landing-header">
      <a class="brand-lockup" :href="withBase('/')" aria-label="Nest SCIM home">
        <img :src="withBase('/mark.svg')" alt="" width="34" height="34" />
        <span>Nest <strong>SCIM</strong></span>
      </a>
      <nav class="landing-nav" aria-label="Main navigation">
        <a :href="withBase('/guide/getting-started')">Docs</a>
        <a :href="withBase('/reference/endpoints')">API reference</a>
        <a :href="withBase('/recipes/okta')">Identity providers</a>
        <a
          class="github-link"
          href="https://github.com/mouloud240/nest-scim"
          target="_blank"
          rel="noreferrer"
        >
          GitHub <span aria-hidden="true">↗</span>
        </a>
      </nav>
    </header>

    <main id="main">
      <section class="hero-section">
        <div class="hero-copy">
          <p class="hero-status"><span class="status-dot"></span> SCIM 2.0 · NESTJS · TYPESCRIPT</p>
          <h1>Provision users.<br /><span>Skip the protocol plumbing.</span></h1>
          <p class="hero-lede">
            Make your NestJS app a SCIM service. The library owns the endpoints and RFC behavior;
            your app owns its users, storage, and mapping.
          </p>
          <div class="hero-actions">
            <a class="button button-primary" :href="withBase('/guide/getting-started')"
              >Read the guide <span aria-hidden="true">→</span></a
            >
            <a
              class="button button-secondary"
              href="https://github.com/mouloud240/nest-scim"
              target="_blank"
              rel="noreferrer"
              >View source</a
            >
          </div>
          <div class="install-control">
            <code><span class="install-prefix">$</span> npm install @nest-scim/core</code>
            <button
              type="button"
              class="copy-button"
              :aria-label="copied ? 'Install command copied' : 'Copy install command'"
              :title="copied ? 'Install command copied' : 'Copy install command'"
              @click="copyInstall"
            >
              <svg v-if="!copied" viewBox="0 0 20 20" aria-hidden="true">
                <rect x="7" y="7" width="9" height="10" rx="1.5" />
                <path
                  d="M13 7V4.5A1.5 1.5 0 0 0 11.5 3h-7A1.5 1.5 0 0 0 3 4.5v8A1.5 1.5 0 0 0 4.5 14H7"
                />
              </svg>
              <svg v-else viewBox="0 0 20 20" aria-hidden="true"><path d="m4 10 4 4 8-8" /></svg>
            </button>
            <span class="sr-only" aria-live="polite">{{ copyStatus }}</span>
          </div>
          <p class="install-note">Install from npm · bring your own persistence and auth</p>
          <div class="hero-badges">
            <a
              href="https://www.npmjs.com/package/@nest-scim/core"
              target="_blank"
              rel="noreferrer"
            >
              <img
                src="https://img.shields.io/npm/v/@nest-scim/core?color=006ac5&amp;logo=npm&amp;logoColor=white"
                alt="npm version"
                height="20"
              />
            </a>
            <a
              href="https://www.npmjs.com/package/@nest-scim/core"
              target="_blank"
              rel="noreferrer"
            >
              <img
                src="https://img.shields.io/npm/dm/@nest-scim/core?color=006ac5&amp;logo=npm&amp;logoColor=white"
                alt="npm downloads per month"
                height="20"
              />
            </a>
          </div>
        </div>

        <figure class="protocol-console" aria-labelledby="console-caption">
          <figcaption id="console-caption" class="console-topbar">
            <span class="console-live"><i></i> REQUEST FLOW</span>
            <span>POST /scim/v2/Users</span>
            <span class="console-status">201 Created</span>
          </figcaption>
          <div class="console-body">
            <div class="console-label">
              <span>IDENTITY PROVIDER</span><span class="console-rule"></span>
            </div>
            <pre class="console-request"><code><b>POST</b> /scim/v2/Users
Content-Type: application/scim+json

{
  "userName": "jensen@example.com",
  "displayName": "Babs Jensen",
  "active": true
}</code></pre>
            <div class="console-transfer">
              <span>SCIM MODULE</span><span class="transfer-line"></span
              ><span class="transfer-check">✓</span>
            </div>
            <div class="console-response">
              <div><span class="response-code">201</span><span>resource created</span></div>
              <code>Location: /scim/v2/Users/42</code>
              <code>Content-Type: application/scim+json</code>
            </div>
            <div class="console-label console-store-label">
              <span>YOUR USER SERVICE</span><span class="console-rule"></span>
            </div>
            <div class="store-call">
              <span class="store-method">create(user)</span><span>→</span
              ><span class="store-result">id: "42"</span>
            </div>
          </div>
          <div class="console-foot"><span>PROTOCOL CONTRACT</span><span>RFC 7644 §3.3</span></div>
        </figure>
      </section>

      <section class="capability-section" aria-label="What the library handles">
        <div class="section-heading">
          <p class="section-index">THE DIVISION OF WORK</p>
          <h2>One protocol. Two contracts.<br />Your domain stays in control.</h2>
        </div>
        <div class="capability-list">
          <article v-for="(item, index) in capabilities" :key="item.title" class="capability-row">
            <span class="capability-index">0{{ index + 1 }}</span>
            <div class="capability-copy">
              <h3>{{ item.title }}</h3>
              <p>{{ item.body }}</p>
            </div>
            <span class="capability-ref">{{ item.ref }}</span>
            <span class="capability-arrow" aria-hidden="true">↗</span>
          </article>
        </div>
      </section>

      <section class="integration-section">
        <div class="integration-copy">
          <p class="section-index">SMALL INTEGRATION SURFACE</p>
          <h2>Wire your service.<br />Map your model.</h2>
          <p>
            Register your persistence service and mapper once. The module mounts the SCIM routes and
            delegates each request through your existing Nest dependency graph.
          </p>
          <a class="text-link" :href="withBase('/guide/getting-started')"
            >Set up the module <span aria-hidden="true">→</span></a
          >
        </div>
        <div class="code-panel">
          <div class="code-panel-bar">
            <span>app.module.ts</span><span class="code-language">TYPESCRIPT</span>
          </div>
          <pre><code><span class="code-purple">import</span> { ScimModule } <span class="code-purple">from</span> <span class="code-string">'@nest-scim/core'</span>;

<span class="code-purple">@Module</span>({
  imports: [
    ScimModule.<span class="code-blue">forRoot</span>({
      basePath: <span class="code-string">'/scim/v2'</span>,
      userService: <span class="code-yellow">UserService</span>,
      userMapper: <span class="code-yellow">UserMapper</span>,
      auth: [<span class="code-yellow">ScimBearerGuard</span>],
    }),
  ],
})
<span class="code-purple">export class</span> <span class="code-yellow">AppModule</span> {}</code></pre>
          <div class="code-panel-foot">
            <span class="code-check">✓</span> Service + mapper are your only required contracts
          </div>
        </div>
      </section>

      <section class="filter-section">
        <div class="filter-heading">
          <div>
            <p class="section-index">FILTERING THAT RESPECTS YOUR STORE</p>
            <h2>Parse once. Query in your dialect.</h2>
          </div>
          <a class="text-link" :href="withBase('/guide/filtering')"
            >How filtering works <span aria-hidden="true">→</span></a
          >
        </div>
        <div class="filter-flow" aria-label="Filter compilation flow">
          <div class="flow-step">
            <span class="flow-label">WIRE FILTER</span><code>userName eq "jensen@example.com"</code>
          </div>
          <span class="flow-arrow" aria-hidden="true">→</span>
          <div class="flow-step">
            <span class="flow-label">DOMAIN TREE</span><code><b>eq</b> · login · value</code>
          </div>
          <span class="flow-arrow" aria-hidden="true">→</span>
          <div class="flow-step">
            <span class="flow-label">YOUR STORE</span><code>WHERE login = ?</code>
          </div>
        </div>
        <p class="filter-note">
          The library never loads every row to filter in memory. Your service receives a typed
          <code>DomainFilter</code> and returns a filter-scoped total.
        </p>
      </section>

      <section class="endpoint-section">
        <div class="endpoint-intro">
          <p class="section-index">THE ROUTES YOU GET</p>
          <h2>A complete User<br />provisioning surface.</h2>
          <p>
            Mounted under the base path you choose. Discovery is available before an identity
            provider authenticates.
          </p>
          <a class="text-link" :href="withBase('/reference/endpoints')"
            >Endpoint reference <span aria-hidden="true">→</span></a
          >
        </div>
        <div class="endpoint-table-wrap">
          <table class="endpoint-table">
            <thead>
              <tr>
                <th scope="col">METHOD</th>
                <th scope="col">PATH</th>
                <th scope="col">OPERATION</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in endpoints" :key="row[0] + row[1]">
                <td>
                  <code>{{ row[0] }}</code>
                </td>
                <td>
                  <code>{{ row[1] }}</code>
                </td>
                <td>{{ row[2] }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section class="closing-section">
        <div class="closing-copy">
          <p class="section-index">READY TO CONNECT AN IDENTITY PROVIDER?</p>
          <h2>Start with the guide.<br />Ship the protocol, not the plumbing.</h2>
        </div>
        <div class="closing-actions">
          <a class="button button-light" :href="withBase('/guide/getting-started')"
            >Get started <span aria-hidden="true">→</span></a
          ><a class="closing-secondary" :href="withBase('/recipes/entra-id')"
            >Entra ID setup <span aria-hidden="true">↗</span></a
          >
        </div>
        <div class="closing-meta">
          <span>SCIM 2.0 · RFC 7643 / 7644</span><span>NESTJS 10 &amp; 11 · NODE 20+</span>
        </div>
      </section>
    </main>

    <footer class="landing-footer">
      <a class="brand-lockup footer-brand" :href="withBase('/')"
        ><img :src="withBase('/mark.svg')" alt="" width="30" height="30" /><span
          >Nest <strong>SCIM</strong></span
        ></a
      >
      <p>Built for the systems that provision your users.</p>
      <div>
        <a :href="withBase('/project/status')">Project status</a
        ><a href="https://www.npmjs.com/package/@nest-scim/core" target="_blank" rel="noreferrer"
          >npm ↗</a
        ><a href="https://github.com/mouloud240/nest-scim" target="_blank" rel="noreferrer"
          >GitHub ↗</a
        >
      </div>
    </footer>
  </div>
</template>
