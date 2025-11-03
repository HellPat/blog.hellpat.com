+++
title = "Aggregates: enforcing business rules"
slug = "aggregates-in-event-sourcing"
date = 2025-11-01T12:00:00Z
authors = ["Patrick Heller"]
+++

Reconstitution rebuilds state, but doesn't prevent invalid operations. Learn how aggregates enforce business rules to keep your system consistent.

<!-- more -->

# Growing Marijuana with Event‑Sourcing — Aggregates

## The problem with pure reconstitution

After learning about reconstitution, I was excited to replay Grandma's successful care routine. I loaded her events and started experimenting:

```typescript
const myNewPlant: PlantEvent[] = [
  { type: "Seeded", plantId: "myNewPlant", occured_at: new Date("2025-11-01T10:00:00") },
  { type: "Watered", plantId: "myNewPlant", occured_at: new Date("2025-11-02T08:30:00") },
  { type: "Watered", plantId: "myNewPlant", occured_at: new Date("2025-11-03T08:30:00") },
];

console.log(reconstitute(myNewPlant));
// { id: "myNewPlant", isAlive: true, totalWaterings: 2, totalTrimCount: 0 }
```

Great! But then I got curious. What if I tried something invalid?

```typescript
const invalidSequence: PlantEvent[] = [
  { type: "Seeded", plantId: "testPlant", occured_at: new Date("2025-11-01T10:00:00") },
  { type: "Died", plantId: "testPlant", occured_at: new Date("2025-11-15T14:00:00") },
  { type: "Watered", plantId: "testPlant", occured_at: new Date("2025-11-16T08:30:00") }, // ⚠️ Watering a dead plant!
];

console.log(reconstitute(invalidSequence));
// { id: "testPlant", isAlive: false, totalWaterings: 1, totalTrimCount: 0 }
```

Wait... I just "watered" a dead plant, and the reconstitution function happily processed it. The state now says `isAlive: false` but `totalWaterings: 1`.

**This is wrong.** You can't water a dead plant. The reconstitution function doesn't validate—it just mechanically applies events.

## The real problem

The issue is clear: **it doesn't make sense to water a dead plant.**

Reconstitution blindly replays events—it trusts that the event stream is valid. But when I'm **trying to water a plant right now**, I need something that checks: "Is this plant even alive?"

That's where aggregates come in.

## Enter the aggregate

An aggregate wraps our reconstitution logic and adds validation. Before performing an action like watering, it checks if that action makes sense given the current state.

Let me build a `PlantAggregate`:

{{ file_contents(path="content/blog/event-sourced-marijuana/03-aggregates/plantAggregate.ts", language="typescript") }}

## How it works

Let's trace through what happens:

```typescript
// Start with history of a dead plant
const aggregate = PlantAggregate.reconstitute([
  { type: "Seeded", plantId: "plant1", occured_at: new Date("2025-11-01T10:00:00") },
  { type: "Died", plantId: "plant1", occured_at: new Date("2025-11-15T14:00:00") },
]);

console.log(aggregate.state);
// { id: "plant1", isAlive: false, totalWaterings: 0, totalTrimCount: 0 }

// Try to water (INVALID - plant is dead)
aggregate.water();
// ❌ Error: "Cannot water a dead plant"
```

And with a living plant:

```typescript
// Start with a living plant
const aggregate = PlantAggregate.seed("plant2");

// Try to water (valid - plant is alive)
aggregate.water();
console.log(aggregate.state);
// { id: "plant2", isAlive: true, totalWaterings: 1, totalTrimCount: 0 }

// Try to trim (valid - plant is alive)
aggregate.trim();
console.log(aggregate.state);
// { id: "plant2", isAlive: true, totalWaterings: 1, totalTrimCount: 1 }

// Get uncommitted events
console.log(aggregate.getUncommittedEvents());
// [
//   { type: "Seeded", plantId: "plant2", occured_at: Date(...) },
//   { type: "Watered", plantId: "plant2", occured_at: Date(...) },
//   { type: "Trimmed", plantId: "plant2", occured_at: Date(...) }
// ]
```

## Business rules as guard conditions

The aggregate enforces **business rules** through simple checks:

- **Rule:** A plant must be alive to be watered
- **Rule:** A plant must be alive to be trimmed

These rules make sense in the domain. You wouldn't water a dead plant in real life, and you can't trim one either.

## Separating concerns

The separation is clean:

```typescript
// ✅ Reconstitution: trust history, no validation
function reconstitute(events: PlantEvent[]): PlantState {
  // Pure state computation
  // No business rules
  // Fast and deterministic
}

// ✅ Aggregate: validate before acting
class PlantAggregate {
  constructor(history: PlantEvent[]) {
    this.state = reconstitute(history); // Uses reconstitution internally
  }

  water(): PlantEvent {
    // Business rules checked HERE
    if (!this.state.isAlive) {
      throw new Error("Cannot water a dead plant");
    }
    return { type: "Watered", plantId: this.state.id, occured_at: new Date() };
  }
}
```

**Reconstitution** trusts the event stream.
**Aggregates** validate before allowing actions.

## Why this matters

Without aggregates protecting our event stream, we could end up with nonsensical data:

```typescript
// ⚠️ Nothing validates this
const events: PlantEvent[] = [
  { type: "Seeded", plantId: "test", occured_at: new Date() },
  { type: "Died", plantId: "test", occured_at: new Date() },
  { type: "Watered", plantId: "test", occured_at: new Date() }, // Impossible!
  { type: "Trimmed", plantId: "test", occured_at: new Date() }, // Also impossible!
];
```

With aggregates, we catch these problems:

```typescript
// ✅ Aggregate prevents invalid operations
const aggregate = PlantAggregate.reconstitute([
  { type: "Seeded", plantId: "test", occured_at: new Date() },
  { type: "Died", plantId: "test", occured_at: new Date() },
]);

aggregate.water(); // ❌ Error: "Cannot water a dead plant"
aggregate.trim();  // ❌ Error: "Cannot trim a dead plant"
```

## Summary

Aggregates add validation to reconstitution:

1. **Reconstitution** rebuilds state from history without validation
2. **Aggregates** check if an action makes sense before allowing it
3. **Business rules** are enforced through guard conditions (if statements)
4. **Invalid operations** are rejected before they can create nonsensical events

In Part 1, we learned that events answer "How did we get here?"
In Part 2, we learned that reconstitution answers "What was the state at any point?"
In Part 3, we learned that aggregates answer "Can I do this action right now?"

**Next:** We've seen how to reconstitute state and validate actions, but in real systems plants need more than just `isAlive`. They track last watering time, health scores, and can die from neglect. In the next part, we'll expand our aggregate to handle more realistic plant care tracking.

---

**Further reading:**
- [Aggregates in Event Sourcing](https://event-sourcing.patchlevel.io/latest/aggregate/) - Patchlevel documentation on aggregate patterns
- [Event Sourcing Core Concepts](https://railseventstore.org/docs/core-concepts/event-sourcing) - RailsEventStore guide to event sourcing fundamentals
