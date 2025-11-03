+++
title = "Time as a business event"
slug = "time-as-business-event"
date = 2025-11-02T13:00:00Z
authors = ["Patrick Heller"]
+++

Time isn't just a timestamp—it's a business event. Learn how treating the passage of time as an event enables elegant business rules like "plants need attention after 2 days without water."

<!-- more -->

# Growing Marijuana with Event‑Sourcing — Time as a Business Event

## The problem with checking time

After building our aggregate with validation, I felt confident. My plants couldn't be watered when dead, and invalid operations were caught. But then I realized something important: **plants need attention when they haven't been watered in a while.**

My first instinct was to add a check in the aggregate:

```typescript
needsAttention(): boolean {
  const now = new Date();
  const daysSinceWatering = (now.getTime() - this.state.lastWatered.getTime()) / (1000 * 60 * 60 * 24);
  return daysSinceWatering > 2;
}
```

This works, but there's a subtle problem: **`new Date()` makes this non-deterministic.** If I call `needsAttention()` now, I get one answer. If I call it tomorrow, I get a different answer—even with the exact same event history.

This breaks a fundamental property of event sourcing: **given the same events, we should always get the same state.**

## Why we can't just compare dates

You might think: "Why not compare `lastWatered` directly with `occured_at` from the events?"

```typescript
// ❌ This doesn't work!
needsAttention(): boolean {
  const lastEvent = this.events[this.events.length - 1];
  const daysSince = (lastEvent.occured_at.getTime() - this.state.lastWatered.getTime()) / (1000 * 60 * 60 * 24);
  return daysSince > 2;
}
```

The problem is: **events record when actions happened, not when time passed.**

Consider this sequence:

```typescript
// It's November 1st: I plant a seed and water it
const plantHistory: PlantEvent[] = [
  { type: "Seeded", plantId: "plant1", occured_at: new Date("2025-11-01T10:00:00") },
  { type: "Watered", plantId: "plant1", occured_at: new Date("2025-11-01T11:00:00") },
  // ... then 5 days pass with no actions ...
];

// Now it's November 6th - let's check on the plant
const plantToday = PlantAggregate.reconstitute(plantHistory);
```

When we reconstitute this plant on November 6th, how does the aggregate know 5 days have passed? **There are no events recording the passage of time.** The last event is from November 1st, but that doesn't tell the aggregate what "today" is.

We face two bad options:

1. **Use `new Date()`** — Non-deterministic. Replaying the same events gives different results.
2. **Use the last event's timestamp** — Wrong. It tells us when the last action happened, not what day it is now.

Neither option works because **the passage of time isn't recorded in our events.**

## Why time matters

In the real world, many business rules depend on time:

- **"A plant needs attention if it hasn't been watered in 2 days"**
- "An invoice is overdue after 30 days"
- "A subscription renews monthly"
- "Interest accrues daily"

These rules aren't triggered by user actions—they're triggered by **the passage of time itself.**

## Time as an event

What if we treated time as just another event? Instead of asking "What time is it now?", we record when each day passes:

```typescript
type PlantEvent =
  | { type: "Seeded"; plantId: string; occured_at: Date }
  | { type: "Watered"; plantId: string; occured_at: Date }
  | { type: "Trimmed"; plantId: string; occured_at: Date }
  | { type: "Died"; plantId: string; occured_at: Date }
  | { type: "DayStarted"; date: Date }; // 🌟 Time as an event
```

The `DayStarted` event doesn't describe an action on a plant—it describes **the passage of time.**

## Tracking when plants need attention

Instead of storing dates, let's track a simple counter:

```typescript
interface PlantState {
  id: string;
  isAlive: boolean;
  totalWaterings: number;
  totalTrimCount: number;
  daysSinceLastWatering: number; // 🌟 Simple counter
}
```

Every time a `DayStarted` event occurs, we increment the counter. Every time a `Watered` event occurs, we reset it to zero.

Now our aggregate can process `DayStarted` events:

```typescript
class PlantAggregate {
  // ...
  
  private apply(event: PlantEvent): void {
    switch (event.type) {
      // ...
      case "DayStarted":
        this.state.daysSinceLastWatering += 1;
        break;
    }
  }

  newDay(date: Date = new Date()): void {
    const event: PlantEvent = {
      type: "DayStarted",
      date: date,
    };

    // The date will be serialized and stored permanently in the event store
    this.recordThat(event);
  }
  
  // ...
}
```

## How needsAttention() works

The magic is that `needsAttention()` no longer depends on `new Date()`—it only looks at the recorded state:

```typescript
needsAttention(): boolean {
  // Dead plants don't need attention
  if (!this.state.isAlive) {
    return false;
  }
  
  // Never been watered? Definitely needs attention!
  if (this.state.totalWaterings === 0) {
    return true;
  }
  
  // Check if it's been more than 2 days since last watering
  return this.state.daysSinceLastWatering > 2;
}
```

This is **deterministic**: given the same events, `needsAttention()` always returns the same result.

Notice the separate conditions:
1. **Dead plants** return `false` - they're beyond help
2. **Never watered plants** return `true` - they need immediate attention
3. **Recently watered plants** are checked against the 2-day threshold

The beauty of this approach: **no date math, no timestamps, just a simple counter.**

## Why this approach works

By treating time as an event, we get several benefits:

### 1. **Deterministic behavior**

Replaying the same events always produces the same result:

```typescript
// A complete history including time passage
const completeHistory: PlantEvent[] = [
  { type: "Seeded", plantId: "plant1", occured_at: new Date("2025-11-01T10:00:00") },
  { type: "DayStarted", date: new Date("2025-11-01") },
  { type: "Watered", plantId: "plant1", occured_at: new Date("2025-11-01T11:00:00") },
  { type: "DayStarted", date: new Date("2025-11-02") },
  { type: "DayStarted", date: new Date("2025-11-03") },
  { type: "DayStarted", date: new Date("2025-11-04") },
];

// Replay on any date - always get the same answer
const plantState = PlantAggregate.reconstitute(completeHistory);
console.log(plantState.needsAttention()); 
// Always returns true, whether we run this on Nov 4th, Dec 1st, or next year
```

### 2. **Testable time-based logic**

Testing becomes trivial—no need to mock `Date.now()` or wait for time to pass:

```typescript
test("plant needs attention after 3 days without water", () => {
  const plant = PlantAggregate.seed("test");
  expect(plant.needsAttention()).toBe(true); // Never watered
  
  plant.newDay();
  plant.water();
  expect(plant.needsAttention()).toBe(false); // Just watered
  
  plant.newDay();
  plant.newDay();
  plant.newDay();
  
  expect(plant.needsAttention()).toBe(true); // 3 days without water
});
```

### 3. **Explicit audit trail**

The event log shows exactly when days passed:

```typescript
[
  { type: "Seeded", plantId: "plant1", occured_at: "2025-11-01T10:00:00" },
  { type: "DayStarted", date: "2025-11-01" },
  { type: "Watered", plantId: "plant1", occured_at: "2025-11-01T11:00:00" },
  { type: "DayStarted", date: "2025-11-02" },
  { type: "DayStarted", date: "2025-11-03" },
  { type: "DayStarted", date: "2025-11-04" },
]
```

Looking at this log, it's clear that 3 days passed without watering.

## How DayStarted events are generated

In practice, a scheduler (like a cron job) generates `DayStarted` events for each plant:

```typescript
// Runs at midnight every day
function midnightScheduler() {
  for (const plant of allPlants()) {
    plant.newDay();
    eventStore.save(plant);
  }
}
```

The scheduler loops through all plants, records that a new day has started, and saves the event. This ensures every plant's event stream includes the passage of time.

Note that cron jobs aren't perfectly precise—they might run a few seconds or even minutes late. But for our business rules (checking if plants need attention after days without water), this delay is completely acceptable.

The scheduler doesn't know about watering rules or business logic. It just announces: **"A new day has started."** All the domain logic—deciding whether plants need attention—lives in the aggregate.

## Business rules driven by time

Now we can build sophisticated rules that react to time. For example, automatically water plants that need attention:

```typescript
class PlantAggregate {
  // ...
  
  newDay(date: Date = new Date()): void {
    const event: PlantEvent = {
      type: "DayStarted",
      date: date,
    };

    // The date will be serialized and stored permanently in the event store
    this.recordThat(event);
    
    // Business rule: automatically water if needed
    if (this.needsAttention()) {
      this.water();
    }
  }
  
  // ...
}
```

With this approach, the passage of time can trigger domain actions. When a new day starts, the aggregate checks if it needs attention and automatically waters itself. The business logic is encapsulated right where it belongs—inside the aggregate.

## Complete implementation

{{ file_contents(path="content/blog/event-sourced-marijuana/04-time-events/plantAggregate.ts", language="typescript") }}

---

**Further reading:** This pattern is inspired by Mathias Verraes' article on [Passage of Time Event](https://verraes.net/2019/05/patterns-for-decoupling-distsys-passage-of-time-event/), which explores how treating time as a domain event enables elegant decoupling in distributed systems.
