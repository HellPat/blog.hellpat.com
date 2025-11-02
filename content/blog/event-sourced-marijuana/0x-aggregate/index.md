+++
title = "Growing Marijuana with Event-Sourcing: Aggregates & Business Logic"
draft = true
+++

# Growing Marijuana with Event-Sourcing: Aggregates & Business Logic

*← Back to [Part 1: Introduction](event-sourcing-introduction.md)*

## Reconstituting the Aggregate from Events

In Event-Sourcing, we reconstruct (reconstitute) the current state by replaying past events—just like reading Grandma's notebook from Part 1 and tallying it up. The result of that replay is an **aggregate** (today's state derived from yesterday's events).

To keep things concrete, we'll start simple and answer one question: how much water did each plant receive? That's our first metric: **total water received**.

```typescript
type PlantEvent =
  | { type: "Seeded"; plantId: string; ownerId: string; timestamp: DateTimeImmutable }
  | { type: "Watered"; plantId: string; timestamp: DateTimeImmutable }
  | { type: "Trimmed"; plantId: string; timestamp: DateTimeImmutable }
  | { type: "Harvested"; plantId: string; timestamp: DateTimeImmutable };

interface PlantAggregate {
  id: string;
  ownerId: string;
  totalWaterReceived: number;
}

function reconstitutePlant(events: PlantEvent[]): PlantAggregate {
  // Start with an empty state
  const aggregate: PlantAggregate = {
    id: "",
    ownerId: "",
    totalWaterReceived: 0
  };

  // Replay each event to rebuild the state
  for (const event of events) {
    switch (event.type) {
      case "Seeded":
        aggregate.id = event.plantId;
        aggregate.ownerId = event.ownerId;
        break;

      case "Watered":
        aggregate.totalWaterReceived += 1;
        break;
    }
  }

  return aggregate;
}

// Reconstitute both plants
const myPlantState = reconstitutePlant(myPlantEvents);
const grandmasPlantState = reconstitutePlant(grandmasPlantEvents);

console.log("myPlant:", JSON.stringify(myPlantState, null, 2));
// {
//   "id": "plant-1",
//   "ownerId": "me",
//   "totalWaterReceived": 3
// }

console.log("Grandma's plant:", JSON.stringify(grandmasPlantState, null, 2));
// {
//   "id": "plant-2",
//   "ownerId": "grandma",
//   "totalWaterReceived": 34
// }
```

The story the events tell is unmistakable: myPlant received only 3 waterings in 2.5 months, while Grandma's plant received 34 consistent waterings. The history explains the outcome.

## Extending the Aggregate: More State, More Questions

Now let's answer more questions: Is the plant alive? How many buds does it have? Can we harvest it?

We'll extend our aggregate to track additional state:

```diff
 type PlantEvent =
   | { type: "Seeded"; plantId: string; ownerId: string; timestamp: DateTimeImmutable }
   | { type: "Watered"; plantId: string; timestamp: DateTimeImmutable }
   | { type: "Trimmed"; plantId: string; timestamp: DateTimeImmutable }
-  | { type: "Harvested"; plantId: string; timestamp: DateTimeImmutable };
+  | { type: "Observed"; plantId: string; heightCm: number; budCount: number; condition: "healthy" | "unhealthy" | "dying"; timestamp: DateTimeImmutable }
+  | { type: "Harvested"; plantId: string; budCount: number; timestamp: DateTimeImmutable }
+  | { type: "Died"; plantId: string; timestamp: DateTimeImmutable };

 interface PlantAggregate {
   id: string;
   ownerId: string;
+  isAlive: boolean;
+  isHarvested: boolean;
+  buds: number;
+  heightCm: number;
+  condition: "healthy" | "unhealthy" | "dying" | "not_yet_grown";
   totalWaterReceived: number;
 }
```

Now our reconstitution function handles more events:

```typescript
function reconstitutePlant(events: PlantEvent[]): PlantAggregate {
  const aggregate: PlantAggregate = {
    id: "",
    ownerId: "",
    isAlive: false,
    isHarvested: false,
    buds: 0,
    heightCm: 0,
    condition: "not_yet_grown",
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
        break;

      case "Trimmed":
        // Trimming doesn't change tracked state
        break;

      case "Observed":
        aggregate.heightCm = event.heightCm;
        aggregate.buds = event.budCount;
        aggregate.condition = event.condition;
        break;

      case "Harvested":
        aggregate.isHarvested = true;
        aggregate.buds = 0;
        break;

      case "Died":
        aggregate.isAlive = false;
        break;
    }
  }

  return aggregate;
}
```

> [!WARNING]
> **Reconstitution is Pure State Rebuilding**
>
> Notice that the `reconstitutePlant` function contains **no business logic or validation**. It simply applies events to rebuild state.
>
> - ❌ No checks for invalid operations
> - ❌ No validation rules
> - ❌ No error throwing
>
> This is intentional! Reconstitution must be **deterministic and repeatable**. Events that are already in the stream have already been validated when they were created. Reconstitution just replays history as it happened.
>
> Business logic belongs in the **command handlers**, not in reconstitution.

## The Problem: Invalid Operations

After months of careful tending, Grandma's plant is finally ready for harvest. But what happens if someone tries to harvest a plant that's already been harvested? Or worse, tries to harvest a plant that never even sprouted?

In traditional CRUD systems, we'd check the current state before updating:

```typescript
function harvestPlant(plantId: string): void {
  const plant = database.getPlant(plantId);

  if (!plant.isAlive) {
    throw new Error("Cannot harvest a dead plant");
  }

  if (plant.buds === 0) {
    throw new Error("Cannot harvest a plant with no buds");
  }

  plant.isHarvested = true;
  database.updatePlant(plant);
}
```

In Event‑Sourcing, we enforce business rules before we create events—not while reconstituting. Aggregates only apply events; command handlers decide whether new events are allowed.

## Enforcing Business Rules

Now we can validate operations before adding new events:

```typescript
function harvestPlant(events: PlantEvent[], timestamp: DateTimeImmutable): PlantEvent[] {
  // First, reconstitute the current state
  const aggregate = reconstitutePlant(events);

  // Validate the business rules
  if (!aggregate.isAlive) {
    throw new Error("Cannot harvest a dead plant");
  }

  if (aggregate.isHarvested) {
    throw new Error("Cannot harvest plant twice");
  }

  if (aggregate.buds === 0) {
    throw new Error("Cannot harvest plant with no buds");
  }

  // Create and append the new event
  const harvestEvent: PlantEvent = {
    type: "Harvested",
    plantId: aggregate.id,
    budCount: aggregate.buds,
    timestamp
  };

  return [...events, harvestEvent];
}
```

## The Story Continues

Let's see this in action with myPlant's short, sad story:

```typescript
// myPlant's unfortunate journey
const myPlantEvents: PlantEvent[] = [
  { type: "Seeded", plantId: "plant-1", ownerId: "me", timestamp: new DateTimeImmutable("2023-08-01T10:00:00") },
  { type: "Watered", plantId: "plant-1", timestamp: new DateTimeImmutable("2023-08-05T14:30:00") },
  { type: "Watered", plantId: "plant-1", timestamp: new DateTimeImmutable("2023-08-20T11:15:00") },
  { type: "Died", plantId: "plant-1", timestamp: new DateTimeImmutable("2023-09-01T09:00:00") }
];

// Try to harvest myPlant
try {
  harvestPlant(myPlantEvents, new DateTimeImmutable("2023-10-30T14:00:00"));
} catch (error) {
  console.log(error.message); // "Cannot harvest a dead plant"
}
```

myPlant died from neglect. The aggregate's rules act like a bouncer at the door: no "Harvested" event gets in if the plant is dead.

Meanwhile, Grandma's plant thrived:

```typescript
// Grandma's successful journey (abbreviated for clarity)
const grandmasEvents: PlantEvent[] = [
  { type: "Seeded", plantId: "plant-2", ownerId: "grandma", timestamp: new DateTimeImmutable("2023-08-01T10:00:00") },
  // ... many consistent waterings ...
  { type: "Observed", plantId: "plant-2", heightCm: 45, budCount: 12, condition: "healthy", timestamp: new DateTimeImmutable("2023-10-20T10:00:00") },
  { type: "Trimmed", plantId: "plant-2", timestamp: new DateTimeImmutable("2023-10-20T10:15:00") },
  { type: "Watered", plantId: "plant-2", timestamp: new DateTimeImmutable("2023-10-28T07:30:00") }
];

// Grandma can harvest!
const updatedEvents = harvestPlant(grandmasEvents, new DateTimeImmutable("2023-10-30T14:00:00"));

const finalState = reconstitutePlant(updatedEvents);
console.log(finalState);
// {
//   id: "plant-2",
//   ownerId: "grandma",
//   isAlive: true,
//   isHarvested: true,
//   buds: 0,
//   heightCm: 45,
//   condition: "healthy",
//   totalWaterReceived: 34
// }
```

## Key Takeaways

Event-Sourcing aggregates work in two steps:

1. **Reconstitution** (pure, deterministic): Replay events to rebuild current state
2. **Command handling** (validates): Check business rules, then create new events

This separation ensures:
- **Consistency**: Invalid state transitions are prevented
- **Auditability**: Every valid operation is recorded
- **Determinism**: Reconstitution always produces the same result
- **Clarity**: Business rules are explicit and testable

The aggregate becomes the guardian of your domain rules, ensuring that only valid events enter your system.

---

*This is Part 2 of the Event-Sourcing Series. Continue to [Part 3: Time is Business Critical](event-sourcing-time-is-business-critical.md)*

*← Back to [Part 1: Introduction](event-sourcing-introduction.md)*
