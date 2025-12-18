---
title: "How JavaScript Modules Actually Work"
description: "Understanding how JavaScript's module cache works will change how you think about dependency management—and why IoC containers are often unnecessary."
date: 2025-12-18
---

*Everything in this post applies equally to JavaScript and TypeScript. I'm using TypeScript for examples.*

When you write `import { something } from './module'`, what actually happens? Understanding this will change how you think about dependency management—and why IoC containers are often unnecessary in JavaScript.

## Modules Execute Once

The first time a module is imported, JavaScript:

1. Loads the file
2. Executes all top-level code
3. Caches the exports

Every subsequent import gets the **cached exports**. The module code never runs again.

```typescript
// counter.ts
console.log('Module loaded!');

let count = 0;

export const increment = () => ++count;
export const getCount = () => count;
```

```typescript
// a.ts
import { increment } from './counter';  // Logs: "Module loaded!"
increment();
```

```typescript
// b.ts
import { getCount } from './counter';   // No log - already cached
console.log(getCount());                 // Logs: 1
```

The `console.log('Module loaded!')` runs exactly once, when `a.ts` first imports the module. When `b.ts` imports it, JavaScript returns the cached exports. Both files share the same `count` variable.

## The Module Cache Is Global

This isn't per-file caching. It's per-process. Every file in your application that imports `./counter` gets the exact same object reference.

```typescript
// database.ts
import { createPool } from 'mysql2/promise';

console.log('Creating database pool...');

export const pool = createPool({
  host: 'localhost',
  user: 'root',
  database: 'myapp',
  connectionLimit: 10,
});
```

No matter how many files import `pool`, the connection pool is created exactly once. The first import triggers `createPool()`. Every other import reuses the cached instance.

## Top-Level Code Runs at Import Time

This is crucial: any code at the top level of a module executes when the module is first imported.

```typescript
// config.ts
console.log('Loading config...');

export const config = {
  apiUrl: process.env.API_URL || 'http://localhost:3000',
  debug: process.env.DEBUG === 'true',
};

console.log('Config loaded:', config.apiUrl);
```

Both `console.log` statements run the moment any file imports from `config.ts`. This is why you can initialize database connections, read environment variables, or set up global state at the top level—it only happens once.

## This Is Dependency Injection

Here's the insight: **the module cache is a singleton container**.

In Java or C#, you'd use an IoC container to manage singletons:

```csharp
// C# with dependency injection
services.AddSingleton<IDatabasePool, MySqlPool>();
services.AddSingleton<IConfig, AppConfig>();

// Later, resolve from container
var pool = container.Resolve<IDatabasePool>();
```

In JavaScript, the module system does this automatically:

```typescript
// database.ts
export const pool = createPool({ /* ... */ });

// config.ts
export const config = { /* ... */ };

// any-file.ts
import { pool } from './database';   // Always the same instance
import { config } from './config';   // Always the same instance
```

No container. No registration. No resolution. The module cache **is** your IoC container. Every export is effectively a singleton scoped to the process lifetime.

## When Modules Load

Modules load in dependency order. If `a.ts` imports `b.ts`, and `b.ts` imports `c.ts`, the execution order is:

1. `c.ts` top-level code runs
2. `b.ts` top-level code runs
3. `a.ts` top-level code runs

The deepest dependencies initialize first. By the time your code runs, everything it imports is already initialized.

```typescript
// logger.ts
console.log('1: Logger initializing');
export const log = (msg: string) => console.log(msg);

// database.ts
import { log } from './logger';
console.log('2: Database initializing');
log('Database ready');
export const query = (sql: string) => { /* ... */ };

// app.ts
import { query } from './database';
console.log('3: App starting');
```

Output:
```
1: Logger initializing
2: Database initializing
Database ready
3: App starting
```

## Lazy Initialization

If you don't want code to run at import time, wrap it in a function:

```typescript
// database.ts
import { createPool, Pool } from 'mysql2/promise';

let pool: Pool | null = null;

export const getPool = () => {
  if (!pool) {
    console.log('Creating pool on first use...');
    pool = createPool({ /* ... */ });
  }
  return pool;
};
```

Now the pool is created on first call to `getPool()`, not at import time. But it's still cached—subsequent calls return the same instance.

## The Mental Model

Think of each module file as a singleton factory that runs once:

- Top-level code = initialization logic
- Exports = the singleton instances (or factories)
- Module cache = the IoC container

You don't need to wire up dependencies manually. You don't need a container to manage lifetimes. The module system handles it.

This is why [IoC containers are often unnecessary](/use-module-system-to-write-better-unit-tests) in JavaScript. The language already has a built-in mechanism for managing singletons and dependencies. Use it.

## The Dark Side: Shared State

There's a catch. Because modules are cached and shared, any mutable state at the module level is shared across your entire application.

```typescript
// order-manager.ts
let currentUserId: string | null = null;

export const setUser = (userId: string) => {
  currentUserId = userId;
};

export const createOrder = async (items: CartItem[]) => {
  return await db.orders.create({ userId: currentUserId, items });
};
```

This looks harmless. But in a Node.js server handling concurrent requests, `currentUserId` is shared across all of them. Request A sets the user, hits an `await`, Request B sets a different user, and now Request A creates an order for the wrong person.

I wrote about this in detail in [The Shared Instance That Leaked User Data](/shared-instance-that-leaked-user-data). The same caching behavior that makes modules great for singletons makes them dangerous for request-scoped state.

The rule: **module-level state should be either immutable or truly global** (like a connection pool or configuration). Never store per-request data in module scope.

## Write Idiomatic Code

The module system is powerful, but it rewards idiomatic code:

- **Pure functions** over stateful services—no hidden state to leak
- **Explicit parameters** over module-level variables—dependencies are visible
- **Immutable exports** over mutable singletons—no surprise side effects

When you fight the module system by storing request state in module scope, you get subtle bugs. When you work with it by writing stateless functions and passing data explicitly, you get simple, testable code that behaves predictably.

The module cache is your friend. Just don't put mutable request state in it.
