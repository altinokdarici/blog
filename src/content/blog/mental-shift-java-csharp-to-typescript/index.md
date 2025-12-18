---
title: "The Mental Shift: Java and C# to TypeScript"
description: "The syntax may look familiar, but idiomatic TypeScript is fundamentally different from Java and C#. Here's the mental shift required to write TypeScript that fits the language."
date: 2025-12-18
---

I spent years writing C# before switching to TypeScript full-time. The syntax felt familiar—classes, interfaces, generics, async/await. I assumed I could write TypeScript the same way I wrote C#, just with different file extensions.

I was wrong. It took me longer than I'd like to admit to realize that idiomatic TypeScript looks nothing like idiomatic C# or Java.

This post is for developers making the same transition. It's not about syntax differences or language features. It's about the mental shift required to write TypeScript that actually fits the language and runtime.

## The Familiar Trap

TypeScript's syntax is deliberately familiar to Java and C# developers. You can write classes, use access modifiers, define interfaces, and structure your code exactly like you would in an enterprise Java application.

The problem is that just because you *can* doesn't mean you *should*.

When I first switched, I wrote code like this:

```typescript
export class StringUtils {
  public static isEmpty(value: string): boolean {
    return value === null || value === undefined || value.trim() === '';
  }

  public static capitalize(value: string): string {
    return value.charAt(0).toUpperCase() + value.slice(1);
  }
}
```

This is perfectly valid TypeScript. It's also a direct translation of how you'd write this in Java or C#. And it completely ignores how JavaScript actually works.

## Different Language, Different Idioms

Christian Gonzalez wrote about this exact pattern in his 2017 article [Thinking in TypeScript](https://medium.com/web-on-the-edge/thinking-in-typescript-cb7f8a6434c0), based on his experience onboarding C# and Java developers to the Office Online team at Microsoft. It was one of the pieces that helped me realize I was fighting the language instead of working with it.

The core insight: **TypeScript has first-class functions. Java and C# (traditionally) don't.**

In Java, a function can't exist outside a class. The class is the fundamental unit of code organization. If you want a utility function, you wrap it in a utility class. This isn't a choice—it's a language constraint.

In TypeScript, functions are values. They can exist at module scope. They can be passed around, composed, and exported directly. The module is the unit of encapsulation, not the class.

## The Patterns That Don't Translate

### Static Utility Classes

I've written about this in detail in [Stop Writing Static Classes in TypeScript](/stop-writing-static-classes-in-typescript). The short version: a class with only static methods is just a namespace with extra syntax. In TypeScript, you don't need it.

```typescript
// Java/C# pattern - unnecessary in TypeScript
export class StringUtils {
  public static isEmpty(value: string): boolean { /* ... */ }
}

// Idiomatic TypeScript
export const isEmpty = (value: string): boolean => { /* ... */ };
```

The module boundary gives you encapsulation. Non-exported functions are private. Exported functions are your public API. You don't need `private static` to hide implementation details—you just don't export them.

### Shared Service Instances

In Java and C#, you might create a service class and share one instance across your application. The thread-per-request model means each request has isolated state, even if the service is shared.

Node.js runs on a single thread with an event loop. A shared instance is truly shared across all concurrent requests. If that instance holds mutable state, you have a race condition waiting to happen.

I covered this in detail in [The Shared Instance That Leaked User Data](/shared-instance-that-leaked-user-data). The pattern that's safe in Spring or ASP.NET becomes a data leak in Express or Fastify.

### Class-Based Service Layers

In enterprise Java and C#, you build layers of services: `UserService`, `OrderService`, `PaymentService`. Each is a class with dependencies injected through the constructor. This works well in those ecosystems.

In TypeScript, this pattern often creates unnecessary complexity. Classes are containers for state—and in a service layer, you often don't have meaningful state. You have functions that take inputs and produce outputs.

```typescript
// Enterprise Java pattern
class OrderService {
  constructor(private db: Database, private paymentService: PaymentService) {}

  async createOrder(userId: string, items: CartItem[]): Promise<Order> {
    // ...
  }
}

// Idiomatic TypeScript
export const createOrder = async (
  db: Database,
  userId: string,
  items: CartItem[]
): Promise<Order> => {
  // ...
};
```

The function version is simpler, easier to test, and impossible to misuse with hidden state. There's no `this` to accidentally mutate, no instance properties to corrupt between requests.

### IoC Containers and Dependency Injection

In Java and C#, you need IoC containers to make code testable. You define interfaces, wire up dependency injection, and mock through constructor injection. It's the only way to swap implementations for testing.

JavaScript's module system already does this for you. Every `import` is an injection point. Test frameworks like Jest can mock entire modules with a single line. No interfaces required, no container configuration, no constructor wiring.

```typescript
// In your test file
jest.mock('../services/payment-gateway');
```

That's it. The module system *is* your IoC container. I wrote about this in detail in [Use the Module System to Write Better Unit Tests](/use-module-system-to-write-better-unit-tests)—if you're still reaching for InversifyJS or tsyringe, you're solving a problem that JavaScript doesn't have.

## Why This Matters

Writing Java-style TypeScript isn't just about aesthetics. It creates real problems:

**Testing becomes harder.** You need to instantiate classes, mock constructors, and deal with instance state. Plain functions are trivially testable—call them with inputs, assert on outputs.

**Bugs hide in shared state.** Every class instance is a potential container for state that leaks between requests. Plain functions can't hold state at all.

**Code becomes harder to compose.** Functions compose naturally through pipes and chains. Classes require awkward wiring through constructors and dependency injection.

**You fight the runtime.** JavaScript's module system, bundler optimizations, and tree-shaking all work better with plain functions than with classes.

## What to Keep

Not everything from Java/C# should be thrown out. Some patterns translate well:

**Interfaces for contracts.** TypeScript interfaces are excellent for defining shapes and contracts. Use them liberally.

**Classes for actual state.** If you have something that genuinely holds state—a connection pool, a cache, a rate limiter—a class makes sense. The key word is *instance* state that varies between instances.

**Generics.** TypeScript's generics are powerful and worth using. The syntax is familiar if you're coming from C# or Java.

**async/await.** This works almost identically across all three languages. No mental shift needed.

## The Shift

The mental shift comes down to this:

**In Java/C#, you think in objects.** Classes are the building blocks. State and behavior live together. Encapsulation happens at the class level.

**In TypeScript, you think in functions and modules.** Functions are the building blocks. State is explicit—either passed in or returned out. Encapsulation happens at the module level.

Once you internalize this, you'll stop reaching for classes by default. You'll write plain functions, compose them together, and only introduce classes when you genuinely need instance state.

The syntax may look similar, but idiomatic TypeScript and idiomatic Java are fundamentally different. The sooner you embrace that, the better your code will be.

## Further Reading

- [Stop Writing Static Classes in TypeScript](/stop-writing-static-classes-in-typescript) — Why utility classes are unnecessary in TypeScript
- [The Shared Instance That Leaked User Data](/shared-instance-that-leaked-user-data) — How Node.js's single-threaded model breaks Java/C# patterns
- [Use the Module System to Write Better Unit Tests](/use-module-system-to-write-better-unit-tests) — Why you don't need IoC containers in TypeScript
- [Thinking in TypeScript](https://medium.com/web-on-the-edge/thinking-in-typescript-cb7f8a6434c0) by Christian Gonzalez — The article that helped me understand this shift
