---
title: "Stop Writing Static Classes in TypeScript"
description: "Learn why static classes can be problematic in TypeScript and discover better alternatives for writing cleaner, more maintainable code."
date: 2025-12-18
---

*Everything in this post applies equally to JavaScript and TypeScript. The module system works the same way in both. I'm using TypeScript for the examples because that's what most Node.js backends use today.*

After eight years of writing TypeScript backends, I've seen this pattern hundreds of times. A developer with Java or C# experience joins the team, and within a week, we have files like this:

```typescript
// services/RateCalculator.ts
export class RateCalculator {
  private static readonly BASE_MULTIPLIER = 1.15;

  public static calculateRate(amount: number, tier: string): number {
    const tierMultiplier = RateCalculator.getTierMultiplier(tier);
    return amount * tierMultiplier * RateCalculator.BASE_MULTIPLIER;
  }

  private static getTierMultiplier(tier: string): number {
    const multipliers: Record<string, number> = {
      bronze: 1.0,
      silver: 0.95,
      gold: 0.85,
    };
    return multipliers[tier] ?? 1.0;
  }
}
```

And the call site looks like this:

```typescript
const rate = RateCalculator.calculateRate(100, 'gold');
```

This code works. It's readable. The author clearly knows what encapsulation means—they've hidden the helper method and the constant behind `private static`. In Java, this would be perfectly reasonable.

In JavaScript, it's unnecessary complexity.

## I Used to Write Code Like This

I came from C# before switching to Node.js full-time around 2017. For the first two years, I wrote static utility classes everywhere. `StringHelper`, `DateUtils`, `ValidationService`—all static, all the time.

It took me longer than I'd like to admit to realize I was solving a problem that TypeScript doesn't have.

## The Module *Is* the Encapsulation

In Java and C#, the file is just a container. The class is the unit of encapsulation. You need `private` and `public` keywords because everything inside a class is visible to everything else in the same file by default.

TypeScript modules work differently. The module boundary is the encapsulation boundary. Anything you don't export is private. Anything you export is your public API.

Here's the same functionality, written idiomatically:

```typescript
// services/rate-calculator.ts
const BASE_MULTIPLIER = 1.15;

const getTierMultiplier = (tier: string): number => {
  const multipliers: Record<string, number> = {
    bronze: 1.0,
    silver: 0.95,
    gold: 0.85,
  };
  return multipliers[tier] ?? 1.0;
};

export const calculateRate = (amount: number, tier: string): number => {
  const tierMultiplier = getTierMultiplier(tier);
  return amount * tierMultiplier * BASE_MULTIPLIER;
};
```

Call site:

```typescript
import { calculateRate } from './services/rate-calculator';

const rate = calculateRate(100, 'gold');
```

The `BASE_MULTIPLIER` constant and `getTierMultiplier` function are private—not because of an access modifier, but because they're not exported. That's how TypeScript works. The module system gives you encapsulation for free.

## What You Actually Get From the Class Version

Let's be honest about what the static class adds:

1. **A namespace.** You call `RateCalculator.calculateRate()` instead of `calculateRate()`.
2. **Ceremony.** More syntax, more indentation, more keywords.
3. **Familiarity.** It looks like the Java or C# code you've written before.

That's it. There's no additional encapsulation. There's no runtime benefit. The transpiled JavaScript is roughly equivalent in both cases.

## Why the Module Version Is Better

### Simpler Tests

Testing a static class often means importing the whole class just to call one method:

```typescript
import { RateCalculator } from './RateCalculator';

describe('RateCalculator', () => {
  it('applies gold tier discount', () => {
    expect(RateCalculator.calculateRate(100, 'gold')).toBe(97.75);
  });
});
```

Testing a function is just testing a function:

```typescript
import { calculateRate } from './rate-calculator';

describe('calculateRate', () => {
  it('applies gold tier discount', () => {
    expect(calculateRate(100, 'gold')).toBe(97.75);
  });
});
```

The difference seems minor here, but it compounds. When you need to mock dependencies or test edge cases, working with plain functions is always simpler than working with class methods.

### Testing Private Helpers

Here's where the module approach really shines. With the static class, `getTierMultiplier` is `private static`. You can't test it directly. Your only options are:

1. Test it indirectly through `calculateRate` (brittle, verbose)
2. Make it `public` (leaks implementation details to consumers)
3. Use reflection hacks (please don't)

With modules, you have a third path: **package-internal exports**.

Move the helper to its own file:

```typescript
// services/rate/get-tier-multiplier.ts
export const getTierMultiplier = (tier: string): number => {
  const multipliers: Record<string, number> = {
    bronze: 1.0,
    silver: 0.95,
    gold: 0.85,
  };
  return multipliers[tier] ?? 1.0;
};
```

```typescript
// services/rate/calculate-rate.ts
import { getTierMultiplier } from './get-tier-multiplier';

const BASE_MULTIPLIER = 1.15;

export const calculateRate = (amount: number, tier: string): number => {
  return amount * getTierMultiplier(tier) * BASE_MULTIPLIER;
};
```

Now control what's public through your barrel file:

```typescript
// services/rate/index.ts
export { calculateRate } from './calculate-rate';
// getTierMultiplier is intentionally not exported here
```

External consumers see only `calculateRate`:

```typescript
import { calculateRate } from './services/rate';
// getTierMultiplier is not accessible here
```

But inside your package, you can test the helper directly:

```typescript
// services/rate/get-tier-multiplier.test.ts
import { getTierMultiplier } from './get-tier-multiplier';

describe('getTierMultiplier', () => {
  it('returns 1.0 for unknown tiers', () => {
    expect(getTierMultiplier('platinum')).toBe(1.0);
  });

  it('returns correct multiplier for gold', () => {
    expect(getTierMultiplier('gold')).toBe(0.85);
  });
});
```

This is similar to C#'s `internal` access modifier or Java's package-private visibility—except you control it through module structure rather than keywords. The function is exported from its own file (testable), but not re-exported from the package index (not part of the public API).

You get full test coverage without polluting your public interface.

### Easier Composition

Functions compose naturally:

```typescript
import { calculateRate } from './rate-calculator';
import { applyTax } from './tax';
import { formatCurrency } from './format';

const getDisplayPrice = (amount: number, tier: string): string =>
  formatCurrency(applyTax(calculateRate(amount, tier)));
```

With static classes, you end up with this:

```typescript
const price = TaxService.applyTax(RateCalculator.calculateRate(amount, tier));
const display = FormatService.formatCurrency(price);
```

Same logic, more noise.

### Smaller Files

Static utility classes tend to grow. `StringUtils` starts with two methods and ends up with thirty. The module pattern encourages smaller, focused files because there's no container waiting to collect "related" functions.

Want a function for kebab-case conversion? Put it in `kebab-case.ts`. Don't add it to `StringUtils` just because it involves strings.

## When Classes Make Sense

Classes are useful when you have:

- **Instance state.** A database connection pool. A cache with TTL. A rate limiter tracking request counts.
- **Polymorphism.** Different payment processors that implement a common interface.
- **Lifecycle.** Something that needs to be initialized, configured, and eventually cleaned up.

If your class has no constructor, no instance methods, and no instance properties—if everything is `static`—you don't need a class.

## The Barrel File Pattern

If you want a namespace-like grouping without classes, use a barrel file:

```typescript
// services/rate/index.ts
export { calculateRate } from './calculate-rate';
export { estimateRate } from './estimate-rate';
export { getRateHistory } from './get-rate-history';
```

Consumers get a clean import:

```typescript
import { calculateRate, estimateRate } from './services/rate';
```

You get small, focused files internally. Everyone wins.

## Breaking the Habit

If you're coming from Java or C#, here's the mental shift: in TypeScript, think in modules, not classes. The file is your encapsulation boundary. Export what's public. Keep the rest private by not exporting it.

You don't need `private static` to hide implementation details. You just don't export them.

This isn't about TypeScript being "better" than Java or C#. Different languages have different idioms. The module system is TypeScript's answer to encapsulation, and it works well once you stop fighting it.

Write functions. Export the ones that matter. Keep your files small.
