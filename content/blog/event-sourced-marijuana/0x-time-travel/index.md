+++
title = "Growing Marijuana with Event-Sourcing: Time Travel"
draft = true
+++

# Growing Marijuana with Event-Sourcing: Time Travel

*← Back to [Part 4: Projections](event-sourcing-projections.md)*

## The Tax Audit

On August 15th, 2020, I told the tax authorities I had 47 plants in my greenhouse. Today they’re auditing me, and they want proof.

I look at my current database:

```typescript
// Current state: December 2023
const currentPlants = database.getAllPlants();
console.log(currentPlants.length); // 1,000 plants

// But what about August 15th, 2020?
// With CRUD, only the current state is stored—the history is gone
```

With a traditional CRUD system, I'm stuck. The data from 2020 has been overwritten thousands of times. I have no way to prove what my operation looked like on that specific date.

**With CRUD, I can’t prove it. With Event‑Sourcing, I can.**

## The Magic of Event-Sourcing: Time Travel

Fortunately, I’ve been using Event‑Sourcing. Every event is still in the store:

```typescript
type PlantEvent =
  | { type: "Seeded"; plantId: string; ownerId: string; timestamp: DateTimeImmutable }
  | { type: "Watered"; plantId: string; timestamp: DateTimeImmutable }
  | { type: "DayStarted"; plantId: string; timestamp: DateTimeImmutable }
  | { type: "Observed"; plantId: string; heightCm: number; budCount: number; condition: "healthy" | "unhealthy" | "dying"; timestamp: DateTimeImmutable }
  | { type: "Harvested"; plantId: string; budCount: number; timestamp: DateTimeImmutable }
  | { type: "Died"; plantId: string; timestamp: DateTimeImmutable };
```

Every event has a timestamp. This means I can replay history **up to any point in time**.

## Time Travel: Replaying Events Up to a Date

Here's how I prove I had 47 plants on August 15th, 2020:

```typescript
function getStateAtPointInTime(
  allEvents: PlantEvent[],
  targetDate: DateTimeImmutable
): Map<string, PlantAggregate> {
  // Filter events that happened before or on target date
  const eventsUntilDate = allEvents.filter(
    event => event.timestamp <= targetDate
  );

  // Group events by plant
  const eventsByPlant = new Map<string, PlantEvent[]>();
  for (const event of eventsUntilDate) {
    if (!eventsByPlant.has(event.plantId)) {
      eventsByPlant.set(event.plantId, []);
    }
    eventsByPlant.get(event.plantId)!.push(event);
  }

  // Sort each plant's events to ensure deterministic replay, then reconstitute
  for (const events of eventsByPlant.values()) {
    events.sort((a, b) => a.timestamp.compare(b.timestamp));
  }
  const plantsAtDate = new Map<string, PlantAggregate>();
  for (const [plantId, events] of eventsByPlant) {
    const plant = reconstitutePlant(events);
    if (plant.isAlive) {
      plantsAtDate.set(plantId, plant);
    }
  }

  return plantsAtDate;
}

// Time travel to August 15th, 2020
const targetDate = new DateTimeImmutable("2020-08-15T23:59:59");
const plantsOnAugust15th = getStateAtPointInTime(allEvents, targetDate);

console.log(`Plants on August 15th, 2020: ${plantsOnAugust15th.size}`);
// 47

// Generate the audit report
for (const [plantId, plant] of plantsOnAugust15th) {
  console.log(`- ${plantId}: ${plant.heightCm}cm, ${plant.buds} buds, ${plant.condition}`);
}
```

**I have proof.** The event stream doesn't lie.

## Time Travel for Debugging

Time travel isn't just for audits. It's invaluable for debugging.

Grandma called me in September 2023: "Plant-42 died and I don't know why!"

Let me rewind time to see what happened:

```typescript
// Get all events for plant-42
const plant42Events = allEvents.filter(e => e.plantId === "plant-42");

// Time travel week by week to see the progression
const dates = [
  new DateTimeImmutable("2023-09-01"),
  new DateTimeImmutable("2023-09-08"),
  new DateTimeImmutable("2023-09-15"),
  new DateTimeImmutable("2023-09-22"),
  new DateTimeImmutable("2023-09-29")
];

for (const date of dates) {
  const eventsUntilDate = plant42Events.filter(e => e.timestamp <= date);
  const plant = reconstitutePlant(eventsUntilDate);

  console.log(`${date.toString()}:`);
  console.log(`  - Alive: ${plant.isAlive}`);
  console.log(`  - Days since watering: ${plant.daysSinceWatering}`);
  console.log(`  - Condition: ${plant.condition}`);
  console.log(`  - Height: ${plant.heightCm}cm`);
  console.log();
}

// Output:
// 2023-09-01:
//   - Alive: true
//   - Days since watering: 2
//   - Condition: healthy
//   - Height: 35cm
//
// 2023-09-08:
//   - Alive: true
//   - Days since watering: 5
//   - Condition: unhealthy
//   - Height: 35cm
//
// 2023-09-15:
//   - Alive: true
//   - Days since watering: 12
//   - Condition: dying
//   - Height: 34cm
//
// 2023-09-22:
//   - Alive: false
//   - Days since watering: 19
//   - Condition: dying
//   - Height: 34cm
```

**Aha!** Grandma forgot to water it. From September 8th onwards, the watering gaps grew longer and longer until the plant died on September 22nd.

With CRUD, I'd have no idea. With Event-Sourcing, I can rewind time and see exactly what happened.

## Projections Through Time

I can also rebuild projections at any point in time:

```typescript
function buildProjectionAtPointInTime(
  allEvents: PlantEvent[],
  targetDate: DateTimeImmutable
): LivingPlantsProjection {
  const projection = new LivingPlantsProjection();

  // Replay only events up to target date
  const eventsUntilDate = allEvents
    .filter(event => event.timestamp <= targetDate)
    .sort((a, b) => a.timestamp.compare(b.timestamp));

  for (const event of eventsUntilDate) {
    projection.apply(event);
  }

  return projection;
}

// What did my "living plants" projection look like on August 15th, 2020?
const projection2020 = buildProjectionAtPointInTime(
  allEvents,
  new DateTimeImmutable("2020-08-15T23:59:59")
);

console.log(projection2020.getLivingPlantIds());
// ["plant-1", "plant-2", ..., "plant-47"] - exactly 47 plants
```

This is powerful: any projection can be reconstructed at any point in history.

## The Business Value of Time Travel

Time travel through event replay provides immense business value:

### 📊 **Auditing & Compliance**
- Prove your state at any historical point
- Tax audits, regulatory compliance, legal disputes
- Immutable audit trail

### 🐛 **Debugging & Support**
- Reproduce bugs by replaying to the moment they occurred
- See exactly how the system evolved over time
- No "I can't reproduce it" excuses

### 📈 **Historical Analysis**
- How many plants did we have each month for the past 3 years?
- What was our average harvest per plant in 2021?
- When did we start seeing more dead plants?

### 🔄 **What-If Scenarios**
- Replay events with different business rules
- Test how a new algorithm would have performed historically
- Validate changes before deploying them

## The Cost of Time Travel

Time travel is not free:

```typescript
// For 10 million events, filtering and replaying takes time
const plantsAtDate = getStateAtPointInTime(allEvents, targetDate); // Filter + replay thousands of aggregates
```

**Optimizations:**
1. **Event Store Snapshots**: Store aggregate snapshots periodically, then only replay events since the snapshot
2. **Indexed Timestamps**: Index events by timestamp for faster filtering
3. **Cached Historical States**: Pre-compute and cache states for commonly queried dates
4. **Parallel Replay**: Reconstitute multiple aggregates in parallel

But even without optimizations, the ability to time travel is worth it.

## Key Takeaways

Event-Sourcing enables time travel by:

1. **Storing Every Event**: Complete history is preserved with timestamps
2. **Filtering by Time**: Select only events up to a target date
3. **Replaying History**: Reconstitute state as it was at any point in time
4. **Deterministic Results**: Same events always produce the same state

**Use Cases:**
- ✅ Auditing and compliance
- ✅ Debugging production issues
- ✅ Historical analysis and reporting
- ✅ What-if scenario testing

**Trade-offs:**
- ⚠️ Performance cost for large event streams
- ⚠️ Storage costs for complete history
- ⚠️ Complexity in handling schema changes over time

Time travel is one of the most powerful features of Event-Sourcing. Your event store becomes a time machine for your business.

---

*This is Part 5 of the Event-Sourcing Series.*

*← Back to [Part 1: Introduction](event-sourcing-introduction.md) | [Part 2: Aggregates & Business Logic](event-sourcing-aggregates.md) | [Part 3: Time is Business Critical](event-sourcing-time-is-business-critical.md) | [Part 4: Projections](event-sourcing-projections.md)*
