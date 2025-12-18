---
title: "The Shared Instance That Leaked User Data"
description: "A subtle Node.js bug where module-scoped instances holding request-scoped state can leak data between users due to the single-threaded event loop."
date: 2025-12-18
---

*Everything in this post applies equally to JavaScript and TypeScript. I'm using TypeScript for the examples because that's what most Node.js backends use today. The examples use Fastify, but the same problem exists in Express, Koa, Hapi, and any other Node.js framework—they all run on the same single-threaded event loop.*

This is a bug I've seen in production more than once. It's subtle, hard to reproduce locally, and can leak data between users. The root cause is always the same: a module-scoped instance holding request-scoped state.

## The Setup

A developer creates an `OrderManager` class to handle order operations. They instantiate it once at module load time—a common pattern when you want to share a service across your application:

```typescript
// services/OrderManager.ts
export class OrderManager {
  private userId: string | null = null;
  private userTier: string | null = null;

  public setContext(userId: string, userTier: string): void {
    this.userId = userId;
    this.userTier = userTier;
  }

  public async getOrders(): Promise<Order[]> {
    // Uses this.userId to fetch orders
    return await db.orders.findMany({ where: { userId: this.userId } });
  }

  public async createOrder(items: CartItem[]): Promise<Order> {
    // Uses this.userId and this.userTier for discounts
    const discount = this.userTier === 'gold' ? 0.15 : 0;
    return await db.orders.create({
      data: { userId: this.userId, items, discount },
    });
  }
}
```

In the Fastify app, the developer creates one instance when the server starts:

```typescript
// app.ts
import Fastify from 'fastify';
import { OrderManager } from './services/OrderManager';

const fastify = Fastify({ logger: true });

// Created once when the module loads, shared across all requests
const orderManager = new OrderManager();

fastify.get('/orders', async (request, reply) => {
  orderManager.setContext(request.user.id, request.user.tier);
  const orders = await orderManager.getOrders();
  return orders;
});

fastify.post('/orders', async (request, reply) => {
  orderManager.setContext(request.user.id, request.user.tier);
  const order = await orderManager.createOrder(request.body.items);
  return order;
});

fastify.listen({ port: 3000 });
```

Here's what happens at startup:

1. Node.js loads `app.ts`
2. `const orderManager = new OrderManager()` executes exactly once
3. That single instance lives in memory for the lifetime of the process
4. Every incoming request uses the same `orderManager` object

This looks reasonable. Each request sets the user context before doing work. In a synchronous, single-threaded-per-request world, this would be fine.

Node.js is not that world.

## The Bug

Node.js runs on a single thread with an event loop. When an `await` yields control, another request can start executing. Here's what happens when two requests overlap:

```
Timeline:
─────────────────────────────────────────────────────────────────────►

Request A (User 123, gold tier):
  │ setContext(123, 'gold')
  │ await db.orders.findMany(...)  ← yields to event loop
  │                                                    │ returns orders for... User 456?

Request B (User 456, bronze tier):
            │ setContext(456, 'bronze')  ← overwrites shared instance state
            │ await db.orders.create(...)
            │                            │ returns
```

Request A calls `setContext` with User 123, then hits an `await`. While the database query is in flight, Request B arrives and calls `setContext` with User 456. The shared instance now holds User 456's context.

When Request A's database query completes and the code continues, `this.userId` is `456`, not `123`. If there's any subsequent operation in Request A that reads from the shared instance, it uses the wrong user's data.

The result: User 123 might see User 456's orders, or worse, create an order attributed to User 456.

## Why This Doesn't Happen in Java or C#

In traditional Java (Spring) or C# (ASP.NET) applications, each HTTP request typically runs on its own thread. Thread-local storage isolates state between concurrent requests. Even if you have a singleton service, you can use `ThreadLocal<T>` or `HttpContext.Current` to store request-scoped data safely.

```csharp
// C# - Each thread has its own copy of _currentUserId
public class OrderManager
{
    private static readonly ThreadLocal<string> _currentUserId = new();

    public void SetContext(string userId)
    {
        _currentUserId.Value = userId;  // Thread-isolated
    }
}
```

Node.js doesn't have this luxury. There's one thread, one event loop, and your shared instance is truly shared across all concurrent requests.

Yes, Node.js has `AsyncLocalStorage` which provides similar isolation for async contexts. But if you're reaching for `AsyncLocalStorage` to fix a shared instance that holds request state, you're solving the wrong problem. The shared instance shouldn't hold that state in the first place.

## The Fix: Stop Using Classes for Services

The solution is straightforward: don't store request-scoped state in shared instances. But let's go further—**classes themselves increase the risk of this bug**.

When you write a class, you create a container for state. Instance properties are an invitation to store something. Setters like `setContext()` or `setUser()` feel natural in a class. The object-oriented instinct is to encapsulate data alongside behavior.

In Node.js, that instinct will burn you.

Plain functions don't have this problem. A function has no instance. There's nowhere to accidentally stash request-scoped data. Every input comes through parameters, every output goes through the return value. There's no hidden state to leak between requests.

```typescript
// services/order-service.ts
export const getOrders = async (userId: string): Promise<Order[]> => {
  return await db.orders.findMany({ where: { userId } });
};

export const createOrder = async (
  userId: string,
  userTier: string,
  items: CartItem[]
): Promise<Order> => {
  const discount = userTier === 'gold' ? 0.15 : 0;
  return await db.orders.create({
    data: { userId, items, discount },
  });
};
```

```typescript
// app.ts
import Fastify from 'fastify';
import { getOrders, createOrder } from './services/order-service';

const fastify = Fastify({ logger: true });

fastify.get('/orders', async (request, reply) => {
  return await getOrders(request.user.id);
});

fastify.post('/orders', async (request, reply) => {
  return await createOrder(request.user.id, request.user.tier, request.body.items);
});

fastify.listen({ port: 3000 });
```

No class. No instance. No shared state. Each function call is completely independent. Two requests can interleave all they want—they can't corrupt each other's data because there's nothing to corrupt.

This isn't just about avoiding bugs. Plain functions are:

- **Easier to test.** No instantiation, no mocking constructors, just call the function.
- **Easier to compose.** Functions compose naturally; classes require awkward wiring.
- **Easier to tree-shake.** Bundlers can eliminate unused functions; they can't eliminate unused methods from an imported class.
- **Harder to misuse.** You can't accidentally add a `this.userId` property to a plain function.

The class-based service layer is a pattern borrowed from Java and C#, where it makes sense. In TypeScript, it's often unnecessary complexity that increases your surface area for bugs like this one.

## "But I Need to Share the User Context Across Many Functions"

If you have deeply nested calls that all need user context, you have options.

**Option 1: Pass a context object**

```typescript
interface RequestContext {
  userId: string;
  userTier: string;
}

export const getOrders = async (ctx: RequestContext): Promise<Order[]> => {
  return await db.orders.findMany({ where: { userId: ctx.userId } });
};

export const getOrderWithDetails = async (
  ctx: RequestContext,
  orderId: string
): Promise<OrderWithDetails> => {
  const order = await getOrderById(orderId);
  const canViewDetails = await checkPermissions(ctx, order);
  // ...
};
```

**Option 2: Create a request-scoped instance**

If you genuinely need a class with methods that share state, create a new instance per request:

```typescript
// services/OrderService.ts
export class OrderService {
  constructor(
    private readonly userId: string,
    private readonly userTier: string
  ) {}

  async getOrders(): Promise<Order[]> {
    return await db.orders.findMany({ where: { userId: this.userId } });
  }

  async createOrder(items: CartItem[]): Promise<Order> {
    const discount = this.userTier === 'gold' ? 0.15 : 0;
    return await db.orders.create({
      data: { userId: this.userId, items, discount },
    });
  }
}
```

```typescript
// app.ts
import Fastify from 'fastify';
import { OrderService } from './services/OrderService';

const fastify = Fastify({ logger: true });

fastify.get('/orders', async (request, reply) => {
  const service = new OrderService(request.user.id, request.user.tier);
  return await service.getOrders();
});

fastify.post('/orders', async (request, reply) => {
  const service = new OrderService(request.user.id, request.user.tier);
  return await service.createOrder(request.body.items);
});

fastify.listen({ port: 3000 });
```

Each request creates its own instance. No shared state. Problem solved.

## When Shared Instances Are Fine

Shared instances aren't inherently evil. They work well for truly global, stateless, or connection-based resources:

- **Database connection pools.** The pool itself is shared; individual connections are checked out per-query.
- **Configuration objects.** Loaded once at startup, read-only thereafter.
- **Caches.** Shared cache is usually intentional—you want all requests to benefit from cached data.

The rule is simple: if your shared instance holds mutable state that varies per request, you have a bug waiting to happen.

## How to Spot This in Code Review

Watch for these patterns:

```typescript
// 🚩 Red flag: module-level instance with setter methods
const manager = new OrderManager();

// Later, in request handlers:
manager.setUser(userId);
manager.setTenant(tenantId);
manager.setRequestId(requestId);

// 🚩 Red flag: instance properties that sound request-specific
private currentUser: User;
private requestContext: Context;
private activeTransaction: Transaction;

// 🚩 Red flag: "initialize" or "setup" methods called per-request
orderManager.initialize(request);
```

If you see a shared instance being "configured" at the start of each request, that's the bug. The configuration will leak between requests.

## The Mental Model

In Java and C#, you think: "One thread per request. Thread-local state is safe."

In Node.js, you think: "One thread for everything. Shared state is shared across all requests."

Once you internalize this, the solution is obvious: don't share request-scoped state. Pass it explicitly, or create request-scoped instances. The code is clearer, easier to test, and impossible to corrupt through request interleaving.

Shared instances have their place. Holding user context isn't it.
