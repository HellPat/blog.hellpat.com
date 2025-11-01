# GitHub Copilot Instructions for Blog Posts

## Target Audience
Developers with practical experience in common development patterns (like CRUD operations) who are exploring new concepts and architectural approaches.

## Writing Guidelines

### Code Samples
- **Always use TypeScript** for all code examples
- Keep examples **minimal** - show only what's necessary to illustrate the concept
- Avoid complex abstractions or enterprise patterns unless specifically discussing them
- Use clear, descriptive variable and function names
- Include type annotations to make the code self-documenting

### Content Structure
- Start with familiar concepts before introducing new ones
- Use analogies and comparisons to help readers understand new concepts
- Build concepts incrementally - simple examples first, then more complex scenarios
- Avoid jargon without explanation; define terms when first used

### Code Example Best Practices

#### Minimal TypeScript Examples
```typescript
// ✅ Good: Minimal, focused example
interface User {
  id: string;
  email: string;
  createdAt: Date;
}

// ❌ Avoid: Over-engineered examples
class AbstractGenericRepositoryFactory<T extends object> {
  // Too complex for introductory content
}
```

#### Compare Approaches
When introducing new patterns or techniques, show how they differ from familiar approaches:

```typescript
// Traditional approach
function processOrder(orderId: string, items: Item[]): void {
  const total = items.reduce((sum, item) => sum + item.price, 0);
  database.orders.update({ id: orderId }, { total, status: 'processed' });
}

// Alternative approach with better separation
interface OrderProcessed {
  orderId: string;
  total: number;
  timestamp: Date;
}

function processOrder(orderId: string, items: Item[]): OrderProcessed {
  const total = calculateTotal(items);
  return {
    orderId,
    total,
    timestamp: new Date()
  };
}

function calculateTotal(items: Item[]): number {
  return items.reduce((sum, item) => sum + item.price, 0);
}
```

### Writing Style
- Use clear, concise language
- Prefer active voice
- Break down complex ideas into digestible chunks
- Use headings to organize content hierarchically
- Include practical, real-world scenarios

### Code Quality
- Ensure all code examples are syntactically correct TypeScript
- Use modern TypeScript features appropriately
- Include necessary imports for clarity
- Show complete, runnable examples when possible
- Add comments only when they add value beyond the code itself
