# Growing Marijuana with Event-Sourcing: Business Logic in Aggregates (Part 3)

*← Back to [Part 2: Reconstituting the Aggregate](event-sourcing-reconstitution.md)*

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

But in Event-Sourcing, we enforce business rules *before* creating events, not when applying them to the aggregate.

## Business Logic in the Aggregate

Let's extend our aggregate to track more state and enforce business rules:

```typescript
type PlantEvent =
  | { type: "Seeded"; plantId: string; ownerId: string; timestamp: DateTimeImmutable }
  | { type: "Watered"; plantId: string; timestamp: DateTimeImmutable }
  | { type: "Trimmed"; plantId: string; timestamp: DateTimeImmutable }
  | { type: "Observed"; plantId: string; heightCm: number; budCount: number; condition: "healthy" | "unhealthy" | "dying"; timestamp: DateTimeImmutable }
  | { type: "Harvested"; plantId: string; budCount: number; timestamp: DateTimeImmutable }
  | { type: "Died"; plantId: string; timestamp: DateTimeImmutable };
</parameter>

interface PlantAggregate {
  id: string;
  ownerId: string;
  isAlive: boolean;
  isHarvested: boolean;
  buds: number;
  heightCm: number;
  condition: "healthy" | "unhealthy" | "dying" | "not_yet_grown";
  totalWaterReceived: number;
}

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
> Business logic belongs in the **command handlers** (like `harvestPlant`), not in reconstitution.

```typescript
```

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

Let's see this in action with Lucky's sad story:

```typescript
// Lucky's unfortunate journey
const luckyEvents: PlantEvent[] = [
  { type: "Seeded", plantId: "plant-1", ownerId: "me", timestamp: new DateTimeImmutable("2023-08-01T10:00:00") },
  { type: "Watered", plantId: "plant-1", timestamp: new DateTimeImmutable("2023-08-05T14:30:00") },
  { type: "Watered", plantId: "plant-1", timestamp: new DateTimeImmutable("2023-08-20T11:15:00") },
  { type: "Died", plantId: "plant-1", timestamp: new DateTimeImmutable("2023-09-01T09:00:00") }
];

// Try to harvest Lucky
try {
  harvestPlant(luckyEvents, new DateTimeImmutable("2023-10-30T14:00:00"));
} catch (error) {
  console.log(error.message); // "Cannot harvest plant: conditions not met"
}
```

Lucky died from neglect. The business logic prevents us from harvesting a dead plant.

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

Event-Sourcing aggregates encapsulate business logic by:

1. **Reconstituting current state** from the event stream
2. **Validating business rules** against that state
3. **Only appending valid events** to the stream

This approach ensures:
- **Consistency**: Invalid state transitions are prevented
- **Auditability**: Every valid operation is recorded
- **Clarity**: Business rules are explicit and testable

The aggregate becomes the guardian of your domain rules, ensuring that only valid events enter your system.

---

*This is Part 3 of the Event-Sourcing Series. Continue to [Part 4: Time is Business Critical](event-sourcing-time-is-business-critical.md)*

*← Back to [Part 1: Introduction](event-sourcing-introduction.md) | [Part 2: Reconstituting the Aggregate](event-sourcing-reconstitution.md)*
