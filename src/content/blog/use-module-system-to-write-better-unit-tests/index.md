---
title: "Use the Module System to Write Better Unit Tests"
description: "JavaScript's module system provides dependency injection for free. Learn how to write simpler, more testable code without IoC containers or constructor injection."
date: 2025-12-18
---

*Everything in this post applies equally to JavaScript and TypeScript. I'm using TypeScript for the examples.*

If you're coming from Java or C#, you've been trained to believe that testable code requires dependency injection. You create interfaces, wire up IoC containers, and inject dependencies through constructors. It's so ingrained that you probably can't imagine writing testable code any other way.

Here's the thing: JavaScript's module system gives you the same benefits with a fraction of the complexity.

## The Java/C# Way

Let's say you're building an order service that needs to charge a payment and send a confirmation email. In Java or C#, testable code looks something like this:

```typescript
// interfaces/IPaymentGateway.ts
export interface IPaymentGateway {
  charge(userId: string, amount: number): Promise<PaymentResult>;
}

// interfaces/IEmailService.ts
export interface IEmailService {
  sendOrderConfirmation(userId: string, orderId: string): Promise<void>;
}

// services/OrderService.ts
export class OrderService {
  constructor(
    private readonly paymentGateway: IPaymentGateway,
    private readonly emailService: IEmailService,
    private readonly orderRepository: IOrderRepository
  ) {}

  async createOrder(userId: string, items: CartItem[]): Promise<Order> {
    const total = this.calculateTotal(items);

    const paymentResult = await this.paymentGateway.charge(userId, total);
    if (!paymentResult.success) {
      throw new PaymentFailedError(paymentResult.error);
    }

    const order = await this.orderRepository.save({
      userId,
      items,
      total,
      paymentId: paymentResult.transactionId,
    });

    await this.emailService.sendOrderConfirmation(userId, order.id);

    return order;
  }

  private calculateTotal(items: CartItem[]): number {
    return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  }
}
```

Now you need to test it. You create mocks for each interface:

```typescript
// tests/OrderService.test.ts
import { OrderService } from '../services/OrderService';
import { IPaymentGateway } from '../interfaces/IPaymentGateway';
import { IEmailService } from '../interfaces/IEmailService';
import { IOrderRepository } from '../interfaces/IOrderRepository';

describe('OrderService', () => {
  let orderService: OrderService;
  let mockPaymentGateway: jest.Mocked<IPaymentGateway>;
  let mockEmailService: jest.Mocked<IEmailService>;
  let mockOrderRepository: jest.Mocked<IOrderRepository>;

  beforeEach(() => {
    mockPaymentGateway = {
      charge: jest.fn(),
    };
    mockEmailService = {
      sendOrderConfirmation: jest.fn(),
    };
    mockOrderRepository = {
      save: jest.fn(),
      findById: jest.fn(),
      findByUserId: jest.fn(),
    };

    orderService = new OrderService(
      mockPaymentGateway,
      mockEmailService,
      mockOrderRepository
    );
  });

  it('should create an order when payment succeeds', async () => {
    mockPaymentGateway.charge.mockResolvedValue({
      success: true,
      transactionId: 'txn_123',
    });
    mockOrderRepository.save.mockResolvedValue({
      id: 'order_456',
      userId: 'user_789',
      items: [{ productId: 'prod_1', price: 100, quantity: 2 }],
      total: 200,
      paymentId: 'txn_123',
    });
    mockEmailService.sendOrderConfirmation.mockResolvedValue(undefined);

    const result = await orderService.createOrder('user_789', [
      { productId: 'prod_1', price: 100, quantity: 2 },
    ]);

    expect(mockPaymentGateway.charge).toHaveBeenCalledWith('user_789', 200);
    expect(mockOrderRepository.save).toHaveBeenCalled();
    expect(mockEmailService.sendOrderConfirmation).toHaveBeenCalledWith(
      'user_789',
      'order_456'
    );
    expect(result.id).toBe('order_456');
  });
});
```

This works. But look at what you needed:

- Three interface definitions
- A class with constructor injection
- Manual mock creation for each interface
- Instantiation of the class with all its dependencies in every test file

And this is a simple example. In a real application, you'd have an IoC container (InversifyJS, tsyringe, etc.) to manage all this wiring. More configuration, more ceremony, more indirection.

## The JavaScript Way

Now let's write the same functionality using plain functions and module imports:

```typescript
// services/payment-gateway.ts
export const charge = async (
  userId: string,
  amount: number
): Promise<PaymentResult> => {
  // Real implementation that calls Stripe/PayPal/etc.
  const response = await fetch('https://api.stripe.com/charges', {
    method: 'POST',
    body: JSON.stringify({ userId, amount }),
  });
  return response.json();
};
```

```typescript
// services/email-service.ts
export const sendOrderConfirmation = async (
  userId: string,
  orderId: string
): Promise<void> => {
  // Real implementation that sends email
  await fetch('https://api.sendgrid.com/mail', {
    method: 'POST',
    body: JSON.stringify({ userId, orderId, template: 'order-confirmation' }),
  });
};
```

```typescript
// repositories/order-repository.ts
export const save = async (order: Omit<Order, 'id'>): Promise<Order> => {
  // Real implementation that saves to database
  return await db.orders.create({ data: order });
};
```

```typescript
// services/order-service.ts
import * as paymentGateway from './payment-gateway';
import * as emailService from './email-service';
import * as orderRepository from '../repositories/order-repository';

const calculateTotal = (items: CartItem[]): number => {
  return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
};

export const createOrder = async (
  userId: string,
  items: CartItem[]
): Promise<Order> => {
  const total = calculateTotal(items);

  const paymentResult = await paymentGateway.charge(userId, total);
  if (!paymentResult.success) {
    throw new PaymentFailedError(paymentResult.error);
  }

  const order = await orderRepository.save({
    userId,
    items,
    total,
    paymentId: paymentResult.transactionId,
  });

  await emailService.sendOrderConfirmation(userId, order.id);

  return order;
};
```

Now the test:

```typescript
// tests/order-service.test.ts
import { createOrder } from '../services/order-service';
import * as paymentGateway from '../services/payment-gateway';
import * as emailService from '../services/email-service';
import * as orderRepository from '../repositories/order-repository';

jest.mock('../services/payment-gateway');
jest.mock('../services/email-service');
jest.mock('../repositories/order-repository');

describe('createOrder', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should create an order when payment succeeds', async () => {
    jest.mocked(paymentGateway.charge).mockResolvedValue({
      success: true,
      transactionId: 'txn_123',
    });
    jest.mocked(orderRepository.save).mockResolvedValue({
      id: 'order_456',
      userId: 'user_789',
      items: [{ productId: 'prod_1', price: 100, quantity: 2 }],
      total: 200,
      paymentId: 'txn_123',
    });
    jest.mocked(emailService.sendOrderConfirmation).mockResolvedValue(undefined);

    const result = await createOrder('user_789', [
      { productId: 'prod_1', price: 100, quantity: 2 },
    ]);

    expect(paymentGateway.charge).toHaveBeenCalledWith('user_789', 200);
    expect(orderRepository.save).toHaveBeenCalled();
    expect(emailService.sendOrderConfirmation).toHaveBeenCalledWith(
      'user_789',
      'order_456'
    );
    expect(result.id).toBe('order_456');
  });
});
```

## What Changed?

The test logic is nearly identical. The assertions are the same. But look at what disappeared:

- **No interfaces.** The module exports *are* the contract. TypeScript infers the types.
- **No class.** Just a function that does the work.
- **No constructor injection.** Dependencies are imported, not injected.
- **No manual mock wiring.** `jest.mock()` replaces the entire module automatically.
- **No IoC container.** The module system *is* your dependency management.

## How Module Mocking Works

When you call `jest.mock('../services/payment-gateway')`, Jest intercepts every import of that module and replaces it with an auto-generated mock. Every exported function becomes a `jest.fn()`.

This works because JavaScript modules are singletons. When `order-service.ts` imports `payment-gateway.ts`, it gets a reference to the module's exports. When your test mocks that module, it's replacing those same exports. The code under test automatically uses the mocked version.

This is the key insight: **the module system is already doing dependency injection**. Every `import` statement is an injection point. You don't need a framework to manage it.

## The Deeper Point

Dependency injection in Java and C# exists to solve a problem: how do you replace dependencies in a language where imports are static and final?

JavaScript doesn't have that problem. Modules are mutable at the language level. Test frameworks can intercept and replace them. The runtime itself is more flexible.

When you bring IoC containers and constructor injection to JavaScript, you're importing a solution to a problem you don't have. You're adding complexity that the language doesn't require.

## When Classes Still Make Sense

I'm not saying never use classes. They're appropriate when you have:

- **Genuine instance state.** A database connection pool, a WebSocket manager, a stateful cache.
- **Multiple instances with different configurations.** Two payment gateways with different API keys.
- **Polymorphism.** Different implementations selected at runtime based on type.

But for stateless service layers—which is most of what we write—plain functions and module imports are simpler, easier to test, and just as flexible.

## The Pattern

Here's the approach I use now:

1. **Write plain functions.** No classes unless you need instance state.
2. **Import dependencies directly.** No constructor injection.
3. **Mock at the module level.** Use `jest.mock()` or your framework's equivalent.
4. **Pass dependencies as arguments** only when you genuinely need runtime flexibility.

It's less ceremony, fewer files, and tests that are easier to write and understand. The module system gives you testability for free—you just have to stop fighting it.
