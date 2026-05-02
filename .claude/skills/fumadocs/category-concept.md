# Concept Page Template

Template for concept pages that explain what something is and why it exists (catalog, middleware, hooks, standard-schema).

---

## Section 1: Opening paragraph

**Heading level:** None — sits directly under the frontmatter.

**Content guidance:** Write 1-3 sentences answering "what is this?" and "why does Better-Notify have it?" No code. No assumed prior knowledge of the codebase. A reader who has never seen the project should understand the concept's purpose after this paragraph.

**Fumadocs component:** None.

**Skeleton:**

```mdx
---
title: [Concept Name]
description: [One-line summary for meta tags and search]
---

[Concept name] is [what it is]. Better-Notify uses it to [why it exists].
```

---

## Section 2: How it Works

**Heading level:** `## How it Works`

**Content guidance:** Describe runtime behavior, not implementation details. Walk the reader through what happens when the concept is active. If the concept involves a sequential flow, break it into named phases. If the concept is often confused with a similar one, add a comparison table showing the differences.

**Fumadocs component:** `Steps` and `Step` for sequential flows. Standard markdown table for comparisons.

**Skeleton (sequential flow):**

```mdx
## How it Works

<Steps>
<Step>
### [Phase name]

[What happens in this phase]
</Step>

<Step>
### [Phase name]

[What happens in this phase]
</Step>
</Steps>
```

**Skeleton (comparison table):**

```mdx
## How it Works

| | [Concept A] | [Concept B] |
| --- | --- | --- |
| Purpose | [what A does] | [what B does] |
| Can block execution? | Yes / No | Yes / No |
| Runs at | [when] | [when] |
```

---

## Section 3: Where It Fits

**Heading level:** `## Where It Fits`

**Content guidance:** Name the layers this concept touches in Better-Notify's six-layer architecture (Contracts, Sender, Transport, Middleware & Hooks, Queue & Worker, Webhook Router). Explain how the layers interact through this concept — don't just list them. Link to related concept pages so the reader can navigate the architecture.

**Fumadocs component:** `Cards` and `Card` for linking to related concept pages.

**Skeleton:**

```mdx
## Where It Fits

[Concept] operates at Layer N ([layer name]) and feeds into [other concept] at Layer M.

<Cards>
  <Card href="./related-concept" title="Related Concept">
    How this concept connects
  </Card>
</Cards>
```

---

## Section 4: Basic Usage

**Heading level:** `## Basic Usage`

**Content guidance:** One self-contained code example with imports. The reader should be able to copy the snippet and adapt it to their project. Keep it minimal — show the concept working, not every option. Use real package paths (`@betternotify/core/subpath`).

**Fumadocs component:** None — use a fenced TypeScript code block.

**Skeleton:**

````mdx
## Basic Usage

```ts
import { feature } from '@betternotify/core/subpath';

const result = feature({ ... });
```
````

---

## Section 5: Rules

**Heading level:** `## Rules`

**Content guidance:** List constraints that would surprise the reader or cause bugs if violated. Each rule gets its own `Callout`. Focus on things the type system does not catch, ordering requirements, or behaviors that differ from what other libraries do. Skip obvious rules the types already enforce.

**Fumadocs component:** `Callout` with `type="warn"` for each constraint.

**Skeleton:**

```mdx
## Rules

<Callout title="[Constraint name]" type="warn">
[What the constraint is and why it matters]
</Callout>

<Callout title="[Constraint name]" type="warn">
[What the constraint is and why it matters]
</Callout>
```
