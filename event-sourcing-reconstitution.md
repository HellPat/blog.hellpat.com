# Growing Marijuana with Event-Sourcing: Reconstituting the Aggregate (Part 2)

*← Back to [Part 1: Introduction](event-sourcing-introduction.md)*

## Reconstituting the Aggregate from Events

The magic of Event-Sourcing is that we can reconstruct (reconstitute) the current state by replaying all events. This reconstructed state is called an **aggregate**.

Let's focus on one key metric: **total water received**.

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
const luckyState = reconstitutePlant(luckyEvents);
const grandmasPlantState = reconstitutePlant(grandmasPlantEvents);

console.log("Lucky:", JSON.stringify(luckyState, null, 2));
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

**The answer is clear**: Lucky only received 3 waterings in 2.5 months, while Grandma's plant received 34 consistent waterings. The events tell the complete story.

The reconstitution process is the heart of Event-Sourcing. By applying each event in sequence, we can rebuild the aggregate state at any point in time. This makes debugging, auditing, and understanding state changes much more powerful.

## What's Next: Projections

But what if reconstituting from thousands of events becomes slow? What if we need different views of the same data for different purposes? That's where **Projections** come in.

In the next chapter, we'll explore how projections let us create optimized, read-specific models from our event stream, giving us the best of both worlds: the complete history of Event-Sourcing with the query performance of traditional databases.

---

*This is Part 2 of the Event-Sourcing Series. Stay tuned for Part 3 on Projections!*
