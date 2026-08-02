# Anyhunt Product Purpose

## Why Anyhunt exists

People care about topics that evolve continuously, but useful information is scattered across websites, feeds, newsletters, and search results. Keeping up requires repeated searching, filtering, and reading, while most collected material is redundant or low value.

Anyhunt exists to turn a topic into a dependable stream of useful understanding.

## Product promise

The user states what they want to keep up with. Anyhunt continuously discovers relevant sources, collects new material, removes repetition, ranks what matters, and delivers a concise recurring digest with links to the original evidence.

The product should help users understand what changed and why it matters without requiring them to monitor every source themselves.

## Core loop

```text
Topic
  -> discover and collect sources
  -> normalize and deduplicate new material
  -> rank for relevance, quality, and freshness
  -> compose a focused digest
  -> deliver to the reader inbox
  -> learn from user feedback and refine the next edition
```

Every major product capability must strengthen this loop. A capability that cannot be explained as part of this loop should not become a top-level Anyhunt product.

## User experience principles

1. **Signal over volume.** Fewer useful items are better than a comprehensive stream of noise.
2. **Conclusions first, evidence always available.** Each edition starts with a readable brief and preserves direct links to its sources.
3. **Recurring by default.** Anyhunt is for staying informed over time, not merely answering a one-off search query.
4. **Simple without being opaque.** A topic should be enough to start; scheduling, sources, and filtering remain understandable and controllable.
5. **Respect attention.** Digests should be predictable, non-repetitive, and easy to pause, refine, or leave.
6. **Data minimization.** Persist only what the product needs to operate, explain results, and improve future editions.

## Product surfaces

- **Reader:** create and manage topic subscriptions, explore public topics, read editions, and provide feedback.
- **Digest service:** schedule collection, acquire material, deduplicate, rank, summarize, compose, and deliver editions.
- **Admin:** operate topics, reports, queues, model configuration, billing, and product health.

Search, scraping, feed parsing, crawling, and browser automation are internal acquisition mechanisms. They do not define separate product lines.

## Product boundaries

Anyhunt is not a general-purpose developer platform, personal knowledge store, generic agent runtime, workflow builder, or shared backend for another product.

Anyhunt owns its accounts, tokens, billing, data, and deployments. External products may integrate through an explicit HTTP contract, but they do not import Anyhunt workspace packages or share its persistence layer.

## Success criteria

Anyhunt succeeds when a user can:

1. create a useful recurring subscription from a topic with minimal setup;
2. receive editions on a predictable schedule;
3. quickly understand the important changes before opening source links;
4. avoid repeatedly seeing the same material;
5. control sources, cadence, relevance, and subscription state;
6. trust that summaries are grounded in identifiable original sources.

Product health is measured by sustained useful subscriptions, edition readership, saves and positive feedback, low repetition, reliable delivery, and low unsubscribe or mute rates caused by noise.

## Evolution guardrails

1. Prefer improving the core loop over adding another product surface.
2. Keep acquisition capabilities internal unless a future business decision explicitly establishes a separate product.
3. Add a new domain model only when the existing Topic, Source, Subscription, Run, Edition, Item, and Feedback concepts cannot express the requirement cleanly.
4. Keep default workflows short; advanced controls should not burden first use.
5. Treat this document as the product-purpose fact source. Implementation details belong in nearby code contracts, not in a second product strategy document.
