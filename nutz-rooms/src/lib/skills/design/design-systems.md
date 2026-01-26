---
name: Design Systems
slug: design/design-systems
description: Help founders build consistent UI components
triggers:
  - design system
  - components
  - ui kit
  - component library
  - style guide
---

# Design Systems

## WHEN U NEED ONE

not at MVP stage.

need a design system when:
- team > 3 people
- multiple products
- inconsistent UI becoming problem
- designers + devs miscommunicating

## CORE COMPONENTS

### Atoms
- buttons
- inputs
- labels
- icons

### Molecules
- form fields (label + input + error)
- cards
- list items

### Organisms
- navigation
- forms
- data tables
- modals

## START WITH THESE

minimum viable design system:
```
1. Colors (primary, secondary, neutral, semantic)
2. Typography (3-4 sizes, 2 weights)
3. Spacing (4, 8, 16, 24, 32, 48)
4. Button (primary, secondary, ghost)
5. Input (text, select, checkbox)
6. Card
7. Modal
```

that's it. add more when needed.

## TAILWIND APPROACH

```typescript
// tailwind.config.ts
theme: {
  colors: {
    primary: '#6366f1',
    secondary: '#8b5cf6',
    // ...
  },
  spacing: {
    '1': '4px',
    '2': '8px',
    '3': '12px',
    '4': '16px',
    // ...
  }
}
```

use consistently:
```tsx
<button className="bg-primary text-white px-4 py-2 rounded">
  Click
</button>
```

## COMPONENT LIBRARY

use existing:
- **shadcn/ui** (copy-paste, customizable)
- **Radix** (unstyled, accessible)
- **Chakra** (styled, opinionated)

don't build from scratch.

## DOCUMENTATION

when team grows:
- component catalog (Storybook)
- usage guidelines
- do/don't examples

## COMMON MISTAKES

- building too early
- over-engineering
- not using existing libraries
- inconsistent naming
- no dark mode consideration

## KEEP IT SIMPLE

design system should:
- make building faster
- make UI consistent
- reduce decisions

if it slows u down, it's too complex.
