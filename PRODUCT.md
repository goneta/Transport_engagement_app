# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

The primary users are donneurs d’ordre and transporteurs. The app also has chauffeur and administrator roles; administrators manage accounts and permissions.

## Product Purpose

The product helps transport parties create and sign transport commitment documents quickly. Users can also share and manage the documents.

## Positioning

Not yet confirmed. The repository supports document generation and management for transport engagements; no differentiated market position has been established.

## Operating Context

The web app supports French and English. Commitment documents capture parties, container type, origin and destination, vehicle details, payment amounts, date, and optional driver details. Users can create documents, share them with a carrier or driver, and record signatures. The interface also exposes account and permission management, document requests, and filters. The intended operating geography and legal scope are unconfirmed.

## Capabilities and Constraints

- Existing stack: Node.js, Express, and SQLite, with a static HTML frontend.
- Roles in the current implementation: admin, donneur d’ordre, transporteur, and chauffeur.
- The document generator supports Word and PDF downloads, printing, and browser voice input.
- Currency labels use FCFA. The generated agreement text references container transport from Abidjan and T1 renewal costs; the intended operating geography and legal scope are unconfirmed.
- The app is bilingual in French and English.
- Authentication, permissions, document sharing, and signatures are implemented in the current codebase.

## Evidence on Hand

- Existing product and workflow evidence is in `README.md`, `server.js`, `public/index.html`, and `public/generator.html`.
- The repository contains a logo at `public/logo.png`.
- No confirmed customer counts, testimonials, performance claims, or external endorsements were found. Future work must not invent them.

## Product Principles

These principles reflect the confirmed product goal and current workflows:

1. Keep the commitment details together in one document workflow.
2. Make each party’s role and signing responsibility clear.
3. Preserve access boundaries through role-based permissions and sharing.
4. Support the languages and document formats already present in the product.
