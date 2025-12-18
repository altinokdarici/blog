---
title: "If It Looks Like a Duck: Understanding TypeScript's Structural Typing"
description: "TypeScript uses structural typing—if it has the right shape, it works. Here's how this differs from Java and C#'s nominal typing and why it matters."
date: 2025-12-18
---

You've probably heard the phrase: "If it looks like a duck, swims like a duck, and quacks like a duck, then it probably is a duck."

This isn't just a saying. It's how TypeScript's type system works. And it's fundamentally different from what you're used to in Java or C#.

## Two Ways to Check Types

**Nominal typing** (Java, C#): "Show me your papers."

The compiler checks if a class explicitly declares that it implements an interface or extends a base class. The name and the declared relationship matter. Two classes with identical methods are not interchangeable unless they explicitly share a type relationship.

**Structural typing** (TypeScript): "Show me what you can do."

The compiler checks if an object has the right shape—the right properties and methods with the right signatures. The name doesn't matter. The declared relationships don't matter. If it has what's needed, it works.

TypeScript uses structural typing. It's duck typing with compile-time checks.

## The Same Code, Different Rules

Here's how nominal typing works in C#:

```csharp
// C#
public class User
{
    public string Id { get; set; }
    public string Name { get; set; }
}

public class Employee
{
    public string Id { get; set; }
    public string Name { get; set; }
}

void PrintUser(User user)
{
    Console.WriteLine(user.Name);
}

PrintUser(new User { Id = "1", Name = "Alice" });       // ✓ Works
PrintUser(new Employee { Id = "2", Name = "Bob" });     // ✗ Error!
```

`Employee` has the exact same properties. Identical structure. Doesn't matter. It's not a `User`, so the compiler rejects it. Papers, please.

Now the same scenario in TypeScript:

```typescript
interface User {
  id: string;
  name: string;
}

interface Employee {
  id: string;
  name: string;
}

const printUser = (user: User) => {
  console.log(user.name);
};

printUser({ id: '1', name: 'Alice' });                    // ✓ Works
printUser({ id: '2', name: 'Bob' } as Employee);          // ✓ Also works!
```

`Employee` and `User` are different types, but they have the same shape. TypeScript accepts both. It doesn't care about the name—it cares about the structure.

## Types Don't Exist at Runtime

Here's the thing that really separates TypeScript from Java and C#: **types are completely erased at runtime**.

When you compile TypeScript, all the interfaces, type annotations, and generics disappear. The JavaScript that runs in your browser or Node.js has no type information whatsoever.

```typescript
// What you write
interface User {
  id: string;
  name: string;
}

const getUser = (id: string): User => {
  return { id, name: 'Alice' };
};
```

```javascript
// What actually runs
const getUser = (id) => {
  return { id, name: 'Alice' };
};
```

The `User` interface? Gone. The `: string` annotation? Gone. The `: User` return type? Gone.

In Java, `instanceof IUserService` is a runtime check—the interface information exists in the compiled bytecode. In TypeScript, there's nothing to check against. The types exist only in your editor and during compilation.

## Types Define Shapes

This is the mental shift: in TypeScript, types and interfaces describe **shapes**, not identity.

A shape is just a set of properties and methods with their types. Anything that matches the shape is compatible—whether it's a class instance, a plain object, or something returned from an API.

```typescript
interface User {
  id: string;
  name: string;
  email: string;
}

// A class instance matches the shape
class UserModel {
  constructor(public id: string, public name: string, public email: string) {}
}
const user1: User = new UserModel('1', 'Alice', 'alice@example.com'); // ✓

// A plain object matches the shape
const user2: User = { id: '2', name: 'Bob', email: 'bob@example.com' }; // ✓

// JSON from an API matches the shape
const user3: User = await fetch('/api/user').then(r => r.json()); // ✓
```

TypeScript doesn't care where the object came from. It cares whether the object has `id`, `name`, and `email` with the right types. Shape over identity.

## When Interfaces Still Matter

Interfaces aren't useless in TypeScript—they just serve a different purpose. Use them when you have multiple implementations of the same contract:

```typescript
interface PaymentProcessor {
  charge(amount: number): Promise<PaymentResult>;
  refund(transactionId: string): Promise<RefundResult>;
}

class StripeProcessor implements PaymentProcessor {
  charge(amount: number): Promise<PaymentResult> { /* ... */ }
  refund(transactionId: string): Promise<RefundResult> { /* ... */ }
}

class PayPalProcessor implements PaymentProcessor {
  charge(amount: number): Promise<PaymentResult> { /* ... */ }
  refund(transactionId: string): Promise<RefundResult> { /* ... */ }
}

const processPayment = (processor: PaymentProcessor, amount: number) => {
  return processor.charge(amount);
};
```

Here, `PaymentProcessor` defines a shared shape. Both implementations conform to it. The `implements` keyword is optional—TypeScript would check the shape anyway—but it's useful for documentation and compile-time verification that you've implemented everything.

## Derive What You Need

Because types are shapes, you can derive new shapes from existing ones using TypeScript's utility types:

```typescript
class UserService {
  getUser(id: string): User { /* ... */ }
  updateUser(id: string, data: Partial<User>): User { /* ... */ }
  deleteUser(id: string): void { /* ... */ }
}

// Need all methods? Use the class directly
const adminPanel = (service: UserService) => { /* ... */ };

// Need just one method? Pick it
const sendEmail = (service: Pick<UserService, 'getUser'>) => { /* ... */ };

// Need a couple? Pick those
const userReport = (service: Pick<UserService, 'getUser' | 'updateUser'>) => { /* ... */ };
```

You're not creating new interfaces. You're deriving shapes from existing types. This is powerful because the implementation remains the single source of truth.

## The Mental Shift

In Java and C#, you think about types as identity. "What class is this? What interface does it implement? Show me the inheritance chain."

In TypeScript, you think about types as shapes. "What properties does this have? What methods can I call? Does it match what I need?"

Both approaches give you type safety. But structural typing is more flexible. You don't need to plan inheritance hierarchies upfront. You don't need parallel interface definitions for every class. You describe shapes, and TypeScript figures out what's compatible.

If it has `getUser`, it's a UserService. If it has `id`, `name`, and `email`, it's a User. Let the duck type.
