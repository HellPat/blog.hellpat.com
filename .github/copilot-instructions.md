# GitHub Copilot Instructions for Blog Posts

## Target Audience
Developers who are familiar with CRUD operations but new to event sourcing.

## Writing Guidelines

### Code Samples
- **Always use TypeScript** for all code examples
- Keep examples **minimal** - show only what's necessary to illustrate the concept
- Avoid complex abstractions or enterprise patterns unless specifically discussing them
- Use clear, descriptive variable and function names
- Include type annotations to make the code self-documenting

### Content Structure
- Start with familiar CRUD concepts before introducing event sourcing equivalents
- Use analogies and comparisons to help readers understand new concepts
- Build concepts incrementally - simple examples first, then more complex scenarios
- Avoid jargon without explanation; define terms when first used

### Code Example Best Practices

#### Minimal TypeScript Examples
```typescript
// ✅ Good: Minimal, focused example
interface UserCreatedEvent {
  userId: string;
  email: string;
  timestamp: Date;
}

// ❌ Avoid: Over-engineered examples
class AbstractEventSourcingRepositoryFactory<T extends BaseEntity> {
  // Too complex for introductory content
}
```

#### Show CRUD vs Event Sourcing
```typescript
// Traditional CRUD approach
function updateUser(userId: string, email: string): void {
  database.users.update({ id: userId }, { email });
}

// Event sourcing approach
function updateUserEmail(userId: string, email: string): void {
  const event: UserEmailChangedEvent = {
    userId,
    email,
    timestamp: new Date()
  };
  eventStore.append(event);
}
```

### Event Sourcing Concepts to Cover
- Events as first-class citizens
- Immutability of events
- Event store vs traditional database
- Event replay and projections
- Aggregate patterns (when ready for intermediate content)
- Event versioning and schema evolution (for advanced topics)

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
