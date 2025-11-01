# Growing Marijuana with Event-Sourcing: Reconstituting the Aggregate (Part 2)

*← Back to [Part 1: Introduction](event-sourcing-introduction.md)*

## Reconstituting the Aggregate from Events

In Event-Sourcing, we reconstruct (reconstitute) the current state by replaying past events—just like reading Grandma’s notebook from Part 1 and tallying it up. The result of that replay is an **aggregate** (today’s state derived from yesterday’s events).

To keep things concrete, we’ll start simple and answer one question: how much water did each plant receive? That’s our first metric: **total water received**.

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

The story the events tell is unmistakable: myPlant received only 3 waterings in 2.5 months, while Grandma’s plant received 34 consistent waterings. The history explains the outcome.

Reconstitution is the heart of Event-Sourcing—and it’s intentionally mechanical. By applying each event in sequence, we rebuild aggregate state at any point in time. That purity makes debugging, auditing, and understanding changes straightforward, and it sets the stage for the next step: applying business rules to decide which events are allowed to happen.

---

*This is Part 2 of the Event-Sourcing Series. Continue to [Part 3: Business Logic in Aggregates](event-sourcing-business-logic.md)*
