# Event-Sourcing: A Different Way to Model State

Event-Sourcing is an architectural pattern where we store the history of state changes as a sequence of events, rather than just storing the current state. Let's explore this concept using a relatable example: growing marijuana plants.

## The Scenario

I have a marijuana plant. My grandma has another marijuana plant. Mine is starving and struggling to grow, while the one my grandma tends to is flourishing. Why? Let's see how Event-Sourcing can help us understand the difference.

## CRUD: The Traditional Approach

In a traditional CRUD (Create, Read, Update, Delete) system, we only store the current state:

```typescript
interface Plant {
  id: string;
  ownerId: string;
  height: number;
  health: number;
  lastWatered: Date;
  trimCount: number;
  isHarvested: boolean;
}

class PlantRepository {
  async update(plant: Plant): Promise<void> {
    // Just overwrite the current state
    await database.save(plant);
  }
}
```

With CRUD, if we look at our plants right now:

```typescript
const myPlant: Plant = {
  id: "plant-1",
  ownerId: "me",
  height: 15,
  health: 30, // Poor health!
  lastWatered: new Date("2023-10-15"),
  trimCount: 0,
  isHarvested: false
};

const grandmasPlant: Plant = {
  id: "plant-2",
  ownerId: "grandma",
  height: 45,
  health: 95, // Excellent health!
  lastWatered: new Date("2023-10-30"),
  trimCount: 3,
  isHarvested: false
};
```

**The Problem**: We can see my plant is unhealthy, but we don't know *why*. We've lost all the history. Was it watered regularly? Was it ever trimmed? We can't tell because we only have the current snapshot.

## Event-Sourcing: Storing the Full History

With Event-Sourcing, instead of storing just the current state, we store every event that happened to our plants:

```typescript
type PlantEvent = 
  | { type: "Seeded"; plantId: string; ownerId: string; timestamp: Date }
  | { type: "Watered"; plantId: string; timestamp: Date }
  | { type: "Trimmed"; plantId: string; timestamp: Date }
  | { type: "Harvested"; plantId: string; timestamp: Date };

// My plant's event history
const myPlantEvents: PlantEvent[] = [
  { type: "Seeded", plantId: "plant-1", ownerId: "me", timestamp: new Date("2023-08-01") },
  { type: "Watered", plantId: "plant-1", timestamp: new Date("2023-08-05") },
  { type: "Watered", plantId: "plant-1", timestamp: new Date("2023-08-20") },
  // Long gap - no watering!
  { type: "Watered", plantId: "plant-1", timestamp: new Date("2023-10-15") }
];

// Grandma's plant event history
const grandmasPlantEvents: PlantEvent[] = [
  { type: "Seeded", plantId: "plant-2", ownerId: "grandma", timestamp: new Date("2023-08-01") },
  { type: "Watered", plantId: "plant-2", timestamp: new Date("2023-08-03") },
  { type: "Watered", plantId: "plant-2", timestamp: new Date("2023-08-06") },
  { type: "Watered", plantId: "plant-2", timestamp: new Date("2023-08-09") },
  { type: "Trimmed", plantId: "plant-2", timestamp: new Date("2023-08-15") },
  { type: "Watered", plantId: "plant-2", timestamp: new Date("2023-08-12") },
  { type: "Watered", plantId: "plant-2", timestamp: new Date("2023-08-15") },
  { type: "Watered", plantId: "plant-2", timestamp: new Date("2023-08-18") },
  { type: "Trimmed", plantId: "plant-2", timestamp: new Date("2023-09-01") },
  { type: "Watered", plantId: "plant-2", timestamp: new Date("2023-08-21") },
  // ... regular watering continues ...
  { type: "Watered", plantId: "plant-2", timestamp: new Date("2023-10-28") },
  { type: "Trimmed", plantId: "plant-2", timestamp: new Date("2023-10-20") },
  { type: "Watered", plantId: "plant-2", timestamp: new Date("2023-10-30") }
];
```

**The Insight**: Now we can see the problem! My plant was only watered 3 times in 2.5 months with huge gaps, while grandma's plant was watered consistently every few days and trimmed regularly. The events tell the complete story.

## Reconstituting the Aggregate from Events

The magic of Event-Sourcing is that we can reconstruct (reconstitute) the current state of our plant by replaying all its events. This reconstructed state is called an **aggregate**.

```typescript
interface PlantAggregate {
  id: string;
  ownerId: string;
  height: number;
  health: number;
  lastWatered: Date | null;
  trimCount: number;
  isHarvested: boolean;
  wateringHistory: Date[];
}

function reconstitutePlant(events: PlantEvent[]): PlantAggregate {
  // Start with an empty state
  const aggregate: PlantAggregate = {
    id: "",
    ownerId: "",
    height: 0,
    health: 100,
    lastWatered: null,
    trimCount: 0,
    isHarvested: false,
    wateringHistory: []
  };

  // Replay each event to rebuild the state
  for (const event of events) {
    switch (event.type) {
      case "Seeded":
        aggregate.id = event.plantId;
        aggregate.ownerId = event.ownerId;
        aggregate.height = 5; // Starts at 5cm
        break;

      case "Watered":
        aggregate.lastWatered = event.timestamp;
        aggregate.wateringHistory.push(event.timestamp);
        // Each watering adds health and height
        aggregate.health = Math.min(100, aggregate.health + 10);
        aggregate.height += 2;
        break;

      case "Trimmed":
        aggregate.trimCount++;
        // Trimming improves health
        aggregate.health = Math.min(100, aggregate.health + 5);
        break;

      case "Harvested":
        aggregate.isHarvested = true;
        break;
    }

    // Simulate health decay over time
    if (event.type !== "Seeded" && aggregate.lastWatered) {
      const daysSinceWater = Math.floor(
        (event.timestamp.getTime() - aggregate.lastWatered.getTime()) / (1000 * 60 * 60 * 24)
      );
      if (daysSinceWater > 3) {
        aggregate.health = Math.max(0, aggregate.health - (daysSinceWater * 2));
      }
    }
  }

  return aggregate;
}

// Reconstitute both plants
const myPlantState = reconstitutePlant(myPlantEvents);
const grandmasPlantState = reconstitutePlant(grandmasPlantEvents);

console.log("My plant:", myPlantState);
// { id: "plant-1", health: 30, height: 15, trimCount: 0, ... }

console.log("Grandma's plant:", grandmasPlantState);
// { id: "plant-2", health: 95, height: 45, trimCount: 3, ... }
```

### Key Benefits of Reconstitution

1. **Audit Trail**: We know exactly what happened and when
2. **Debugging**: We can replay events to understand why the state is what it is
3. **Time Travel**: We can reconstitute the state at any point in time
4. **Multiple Views**: We can create different aggregates from the same events

```typescript
// Example: Calculate average watering frequency
function calculateWateringFrequency(events: PlantEvent[]): number {
  const waterings = events
    .filter(e => e.type === "Watered")
    .map(e => e.timestamp);
  
  if (waterings.length < 2) return 0;
  
  const totalDays = (waterings[waterings.length - 1].getTime() - waterings[0].getTime()) 
    / (1000 * 60 * 60 * 24);
  
  return waterings.length / totalDays;
}

console.log("My watering frequency:", calculateWateringFrequency(myPlantEvents));
// 0.04 waterings/day (once every 25 days)

console.log("Grandma's watering frequency:", calculateWateringFrequency(grandmasPlantEvents));
// 0.33 waterings/day (once every 3 days)
```

## Summary

Event-Sourcing provides a fundamentally different approach to managing state:

- **CRUD** stores only the current state → fast to query, but loses history
- **Event-Sourcing** stores all events → complete audit trail, can answer "how did we get here?"

We've seen how storing events (Seeded, Watered, Trimmed, Harvested) allows us to:
1. Understand the complete history of our plants
2. Reconstitute the current state by replaying events
3. Derive insights that would be impossible with just a snapshot

The reconstitution process is the heart of Event-Sourcing. By applying each event in sequence, we can rebuild the aggregate state at any point in time. This makes debugging, auditing, and understanding state changes much more powerful.

## What's Next: Projections

But what if reconstituting from thousands of events becomes slow? What if we need different views of the same data for different purposes? That's where **Projections** come in.

In the next chapter, we'll explore how projections let us create optimized, read-specific models from our event stream, giving us the best of both worlds: the complete history of Event-Sourcing with the query performance of traditional databases.

---

*This is the first part of a series on Event-Sourcing. Stay tuned for the next chapter on Projections!*
