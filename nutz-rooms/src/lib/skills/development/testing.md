---
name: Testing Strategy
slug: development/testing
description: Help founders implement effective testing
triggers:
  - testing
  - tests
  - unit tests
  - integration tests
  - test coverage
  - tdd
  - qa
---

# Testing Strategy

## THE STARTUP REALITY

perfect test coverage = never ship.
no tests = constant fires.

find the middle.

## TESTING PYRAMID

```
        /\
       /  \  E2E (few)
      /----\
     /      \ Integration (some)
    /--------\
   /          \ Unit (many)
  /------------\
```

- **Unit**: fast, isolated, many
- **Integration**: medium, test connections
- **E2E**: slow, test full flow, few

## WHAT TO TEST

### Always test:
- payment flows
- auth flows
- core business logic
- data transformations

### Don't bother:
- UI layout
- third-party integrations
- simple CRUD
- obvious code

## UNIT TEST EXAMPLE

```typescript
// function to test
function calculateDiscount(price: number, percent: number): number {
  return price * (1 - percent / 100);
}

// test
test('calculateDiscount applies percentage', () => {
  expect(calculateDiscount(100, 20)).toBe(80);
  expect(calculateDiscount(50, 10)).toBe(45);
});
```

## INTEGRATION TEST EXAMPLE

```typescript
test('user can create order', async () => {
  const user = await createTestUser();
  const order = await createOrder(user.id, { items: [{ sku: '123', qty: 1 }] });

  expect(order.status).toBe('pending');
  expect(order.user_id).toBe(user.id);
});
```

## WHEN TO WRITE TESTS

1. **Before fixing bugs**: write test that fails, then fix
2. **For complex logic**: anything with multiple paths
3. **Before refactoring**: ensure behavior doesn't change
4. **Not for MVPs**: ship first, test critical paths after

## TESTING TOOLS

- Jest / Vitest (unit)
- Playwright / Cypress (E2E)
- Testing Library (React)
- Supertest (API)

## COMMON MISTAKES

- testing implementation not behavior
- too many mocks
- flaky tests (fail randomly)
- slow test suite
- 100% coverage goal (waste of time)

## CI PIPELINE

run tests on every PR:
```yaml
# .github/workflows/test.yml
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - run: npm install
      - run: npm test
```
