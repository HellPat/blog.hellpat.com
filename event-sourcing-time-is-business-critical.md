# Growing Marijuana with Event-Sourcing: Time is Business Critical (Part 3)

*← Back to [Part 2: Aggregates & Business Logic](event-sourcing-aggregates.md)*

## The Problem: When Did I Last Water My Plants?

After seeing Grandma's success, I've expanded my operation. I now have 20 plants at various stages of growth. Every morning, I need to know: **"Which plants need watering today?"**

My rule is simple: water every plant that hasn't been watered in 3 days—too early wastes resources, too late hurts yield.

But here's the question: **How do I know how many days have passed?**

## The Naive Approach: Calculate from Timestamps

My first instinct is to look at the `Watered` event timestamps and calculate the difference:

```typescript
function needsWatering(events: PlantEvent[]): boolean {
  const lastWatered = events
    .filter(e => e.type === "Watered")
    .map(e => e.timestamp)
    .sort()
    .pop();

  if (!lastWatered) return true;

  const now = new Date();
  const daysSince = Math.floor((now.getTime() - lastWatered.getTime()) / (1000 * 60 * 60 * 24));

  return daysSince >= 3;
}
```

This works for a demo, but in production it has serious problems with determinism, testing, and auditability.

## Why This Approach Fails

### Problem 1: Non-Deterministic Behavior

```typescript
// Today is 2023-08-10
const plant = reconstitutePlant(events);
console.log(needsWatering(events)); // false (2 days since watering)

// Tomorrow is 2023-08-11
const plant = reconstitutePlant(events); // Same events!
console.log(needsWatering(events)); // true (3 days since watering)
```

**The same event stream produces different results depending on when you replay it.** This breaks a fundamental principle of Event-Sourcing: reconstitution should be deterministic.

### Problem 2: Untestable

How do you write a test for "3 days have passed" without waiting 3 actual days or mocking the system clock?

```typescript
test("plant needs watering after 3 days", () => {
  const events = [
    { type: "Seeded", plantId: "test-1", ownerId: "me", timestamp: new DateTimeImmutable("2023-08-01") },
    { type: "Watered", plantId: "test-1", timestamp: new DateTimeImmutable("2023-08-01") }
  ];

  // How do I test this without waiting 3 days or mocking Date.now()?
  expect(needsWatering(events)).toBe(true);
});
```

### Problem 3: Not Part of the Event Stream

The passage of time is **business critical** for my plant operation, but it's not recorded in my events. If I replay my event stream in a year, I have no record of when days actually passed.

## The Solution: Time as a Business Event

The key insight: **If time is business critical, make it an explicit event.**

```typescript
type PlantEvent =
  | { type: "Seeded"; plantId: string; ownerId: string; timestamp: DateTimeImmutable }
  | { type: "Watered"; plantId: string; timestamp: DateTimeImmutable }
  | { type: "DayStarted"; plantId: string; timestamp: DateTimeImmutable }
  | { type: "Observed"; plantId: string; heightCm: number; budCount: number; condition: "healthy" | "unhealthy" | "dying"; timestamp: DateTimeImmutable }
  | { type: "Harvested"; plantId: string; budCount: number; timestamp: DateTimeImmutable }
  | { type: "Died"; plantId: string; timestamp: DateTimeImmutable };
```

Now I can track time explicitly in my aggregate:

```typescript
interface PlantAggregate {
  id: string;
  ownerId: string;
  isAlive: boolean;
  daysSinceWatering: number; // Business-critical metric!
  totalWaterReceived: number;
  // ... other fields
}

function reconstitutePlant(events: PlantEvent[]): PlantAggregate {
  const aggregate: PlantAggregate = {
    id: "",
    ownerId: "",
    isAlive: false,
    daysSinceWatering: 0,
    totalWaterReceived: 0
  };

  for (const event of events) {
    switch (event.type) {
      case "Seeded":
        aggregate.id = event.plantId;
        aggregate.ownerId = event.ownerId;
        aggregate.isAlive = true;
        break;

      case "Watered":
        aggregate.totalWaterReceived += 1;
        aggregate.daysSinceWatering = 0; // Reset!
        break;

      case "DayStarted":
        aggregate.daysSinceWatering += 1; // Increment!
        break;

      case "Died":
        aggregate.isAlive = false;
        break;
    }
  }

  return aggregate;
}
```

## Making Days Pass: The Cron Job

To make time pass, I set up a cron job that fires a `DayStarted` event for every plant once per day:

```typescript
// cron: 0 0 * * * (runs at midnight every day)
async function fireDayStartedEvents(eventStore: EventStore): Promise<void> {
  const allPlantIds = await eventStore.getAllPlantIds();

  for (const plantId of allPlantIds) {
    const event: PlantEvent = {
      type: "DayStarted",
      plantId,
      timestamp: new DateTimeImmutable()
    };

    await eventStore.append(plantId, event);
  }

  console.log(`✓ Day started for ${allPlantIds.length} plants`);
}
```

> [!NOTE]
> **Scheduling Flexibility**
>
> It doesn't matter if the cron job runs at 00:00:00 or 00:00:23 or even 00:05:00. What matters is that a `DayStarted` event is fired once per day. The exact timing is not business critical—only the fact that a new day has begun.
>
> This decouples your domain logic from infrastructure and aligns with business outcomes: one explicit event per day is enough for audits, SLAs, and projections—no wall‑clock coupling.

## A Real Event Stream

Let's see how this looks in practice:

```typescript
const myPlantEvents: PlantEvent[] = [
  { type: "Seeded", plantId: "plant-1", ownerId: "me", timestamp: new DateTimeImmutable("2023-08-01T10:00:00") },
  { type: "Watered", plantId: "plant-1", timestamp: new DateTimeImmutable("2023-08-01T10:15:00") },

  // Midnight - new day starts
  { type: "DayStarted", plantId: "plant-1", timestamp: new DateTimeImmutable("2023-08-02T00:00:00") },

  // Midnight - new day starts
  { type: "DayStarted", plantId: "plant-1", timestamp: new DateTimeImmutable("2023-08-03T00:00:00") },

  // Midnight - new day starts
  { type: "DayStarted", plantId: "plant-1", timestamp: new DateTimeImmutable("2023-08-04T00:00:00") },

  // Morning check - 3 days have passed!
];

const plant = reconstitutePlant(myPlantEvents);
console.log(plant.daysSinceWatering); // 3
console.log(plant.daysSinceWatering >= 3); // true - needs watering!

// I water the plant
myPlantEvents.push({
  type: "Watered",
  plantId: "plant-1",
  timestamp: new DateTimeImmutable("2023-08-04T09:00:00")
});

const updatedPlant = reconstitutePlant(myPlantEvents);
console.log(updatedPlant.daysSinceWatering); // 0 - reset!
```

## Why This Is Better for the Business

### ✅ Deterministic

```typescript
// Replay in 2023
const plant1 = reconstitutePlant(myPlantEvents);
console.log(plant1.daysSinceWatering); // 3

// Replay in 2025 - same result!
const plant2 = reconstitutePlant(myPlantEvents);
console.log(plant2.daysSinceWatering); // 3
```

The same event stream **always** produces the same result.

### ✅ Testable

```typescript
test("plant needs watering after 3 days", () => {
  const events = [
    { type: "Seeded", plantId: "test-1", ownerId: "me", timestamp: new DateTimeImmutable() },
    { type: "Watered", plantId: "test-1", timestamp: new DateTimeImmutable() },
    { type: "DayStarted", plantId: "test-1", timestamp: new DateTimeImmutable() },
    { type: "DayStarted", plantId: "test-1", timestamp: new DateTimeImmutable() },
    { type: "DayStarted", plantId: "test-1", timestamp: new DateTimeImmutable() }
  ];

  const plant = reconstitutePlant(events);
  expect(plant.daysSinceWatering).toBe(3);
});
```

No mocking, no waiting, just add events.

### ✅ Auditable

The event stream now contains a complete record of when time passed:

```typescript
// I can see exactly when each day started
console.log(myPlantEvents.filter(e => e.type === "DayStarted"));
// [
//   { type: "DayStarted", timestamp: "2023-08-02T00:00:00" },
//   { type: "DayStarted", timestamp: "2023-08-03T00:00:00" },
//   { type: "DayStarted", timestamp: "2023-08-04T00:00:00" }
// ]
```

### ✅ Domain Purity

My aggregate doesn't need to know about system clocks, time zones, or `Date.now()`. It just responds to events:

```typescript
case "DayStarted":
  aggregate.daysSinceWatering += 1;
  break;
```

Clean. Simple. Testable.

## The Core Principle: Time is Business Critical

The lesson here isn't just about Event-Sourcing—it's about recognizing what's business critical:

- **Is the passage of time important to your business logic?**
- **Do you make decisions based on how much time has passed?**
- **Would you need to audit when time-based events occurred?**

If the answer is yes, **make time an explicit part of your domain model.**

In my plant operation:
- 🌱 Days since watering determines plant health
- 🌱 Days since seeding determines growth stage
- 🌱 Days until harvest determines planning

Time isn't just infrastructure—it's a **first-class domain concept**.

## Key Takeaways

1. **Time as an Event**: If time matters to your business, model it explicitly
2. **Deterministic Behavior**: Event streams should replay the same way regardless of when you replay them
3. **Testability**: Time-based logic becomes trivial to test with explicit time events
4. **Auditability**: Your event stream records when time passed, not just business actions
5. **Domain Purity**: Aggregates stay pure—no dependency on system clocks

Making time explicit transforms it from a testing headache into a clear, auditable part of your domain.

## The Pablo Escobar Problem: Billions of Events

My operation has grown. Over the years, I've cultivated **billions of plants**. Each plant has its full event history stored in my event store—seeded, watered, observed, harvested, died. That's billions of events.

But here's the thing: **this year I only have 1,000 living plants.**

The cost hits me every morning when my cron job runs:

```typescript
// cron: 0 0 * * * (runs at midnight every day)
async function fireDayStartedEvents(eventStore: EventStore): Promise<void> {
  const allPlantIds = await eventStore.getAllPlantIds(); // Returns BILLIONS of IDs!

  for (const plantId of allPlantIds) {
    const event: PlantEvent = {
      type: "DayStarted",
      plantId,
      timestamp: new DateTimeImmutable()
    };

    await eventStore.append(plantId, event);
  }
}
```

**Why am I firing `DayStarted` events for billions of dead plants?**

- Plant from 2015 that died 8 years ago? Getting a `DayStarted` event.
- Plant from 2019 that was harvested? Getting a `DayStarted` event.
- Plant from last week that's long gone? Getting a `DayStarted` event.

This is **wasteful**. The passage of time only matters for **living plants**—the ones I can still influence.

## The Solution: A Living Plants Projection

Instead of firing events for every plant that ever existed, I maintain a projection of **only the living plants**:

```typescript
interface LivingPlant {
  plantId: string;
  ownerId: string;
  daysSinceWatering: number;
  seededAt: DateTimeImmutable;
}

class LivingPlantsProjection {
  private livingPlants: Map<string, LivingPlant> = new Map();

  apply(event: PlantEvent): void {
    const plantId = event.plantId;

    switch (event.type) {
      case "Seeded":
        // New living plant!
        this.livingPlants.set(plantId, {
          plantId,
          ownerId: event.ownerId,
          daysSinceWatering: 0,
          seededAt: event.timestamp
        });
        break;

      case "Watered":
        const plant = this.livingPlants.get(plantId);
        if (plant) {
          plant.daysSinceWatering = 0;
        }
        break;

      case "DayStarted":
        const livingPlant = this.livingPlants.get(plantId);
        if (livingPlant) {
          livingPlant.daysSinceWatering += 1;
        }
        break;

      case "Harvested":
      case "Died":
        // Remove from living plants!
        this.livingPlants.delete(plantId);
        break;
    }
  }

  getLivingPlantIds(): string[] {
    return Array.from(this.livingPlants.keys());
  }

  getLivingPlant(plantId: string): LivingPlant | undefined {
    return this.livingPlants.get(plantId);
  }
}
```

## Optimized Cron Job

Now my cron job only targets **living plants**:

```typescript
// cron: 0 0 * * * (runs at midnight every day)
async function fireDayStartedEvents(
  eventStore: EventStore,
  livingPlantsProjection: LivingPlantsProjection
): Promise<void> {
  const livingPlantIds = livingPlantsProjection.getLivingPlantIds(); // Only 1,000 IDs!

  for (const plantId of livingPlantIds) {
    const event: PlantEvent = {
      type: "DayStarted",
      plantId,
      timestamp: new DateTimeImmutable()
    };

    await eventStore.append(plantId, event);
  }

  console.log(`✓ Day started for ${livingPlantIds.length} living plants`);
}
```

**Before**: Billions of events fired daily
**After**: 1,000 events fired daily

The projection filters out all the noise. Only plants that matter to my domain—the living ones—get time events.

## Why This Matters

This isn't just about performance. It's about **domain relevance**:

- **Dead plants don't care about time**: A plant harvested in 2019 doesn't need to know that today started
- **Historical data stays intact**: All past events remain in the event store for auditing
- **Current operations stay fast**: Only relevant plants get processed
- **Projections filter reality**: Not everything in your event store is relevant to every operation

The projection becomes a **domain filter**—it maintains only the state that matters for current business operations.

## Key Insight

When you have years of historical data, **not all of it is relevant to current operations**.

Projections let you:
1. Keep complete history in the event store (billions of events)
2. Maintain only relevant state in projections (thousands of records)
3. Operate on what matters (living plants, not dead ones)

The event store is your **complete audit trail**. Projections are your **operational views**.

## Further Reading

This pattern of modeling the passage of time in event-sourced systems is explored in depth by Mathias Verraes:
[Patterns for Decoupling in Distributed Systems: Passage of Time Event](https://verraes.net/2019/05/patterns-for-decoupling-distsys-passage-of-time-event/)

---

*This is Part 3 of the Event-Sourcing Series. Continue to [Part 4: Projections](event-sourcing-projections.md)*

*← Back to [Part 1: Introduction](event-sourcing-introduction.md) | [Part 2: Aggregates & Business Logic](event-sourcing-aggregates.md)*
