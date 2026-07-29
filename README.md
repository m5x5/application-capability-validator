# Application Capability validator

A browser-based validator for [Application Capability](https://dokieli.github.io/application-capability/)
documents. Paste a page's HTML, a capability document directly, or fetch a URL, and validate it
against a real [SHACL](https://www.w3.org/TR/shacl/) shape for the vocabulary.

Try it: https://github.com/m5x5/application-capability-validator

## Features

- Discover an Application Capability document from a page's HTML (`<link>` discovery) or fetch one directly
- Paste HTML, paste JSON-LD, or fetch a URL to validate
- SHACL validation against the Application Capability shapes, with per-issue reporting
- Inspect the raw JSON-LD document and referenced shapes in a code panel

## Getting started

```bash
npm install
npm run dev
```

Other scripts:

```bash
npm run build    # production build
npm run preview  # preview the production build
npm run lint     # oxlint
```

## Tech stack

- [React](https://react.dev) + [Vite](https://vitejs.dev)
- [shacl-engine](https://github.com/rdf-ext/shacl-engine) and [n3](https://github.com/rdfjs/N3.js) for RDF/SHACL processing
- [jsonld](https://github.com/digitalbazaar/jsonld.js) for JSON-LD expansion
- [Tailwind CSS](https://tailwindcss.com) for styling
