# Event-Sourcing: A Different Way to Model State

## The Story of My Plant

Three months ago, I planted a marijuana seed in a small pot. I named it "Lucky" and placed it near the window. The first week was exciting—I watered it daily, watched the first leaves sprout, and even took photos to track its growth.

Then life got busy. Work deadlines piled up, I traveled for a week, forgot a few times... you know how it goes. I still watered Lucky when I remembered, but the intervals became irregular. Two weeks would pass, then I'd water it twice in one week, then another long gap.

Today, I checked on Lucky. The leaves are yellowing, the stem is thin, and it's barely 15cm tall. Something went wrong, but I can't quite remember what. Did I water it enough? When was the last time I watered it? I honestly can't recall the details.

## CRUD: The Traditional Approach

Let's model Lucky in our plant tracking application using CRUD (Create, Read, Update, Delete):

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

Every time I water Lucky, I update the record:

```typescript
const lucky: Plant = {
  id: "plant-1",
  ownerId: "me",
  height: 15,
  health: 30,
  lastWatered: new Date("2023-10-15"),
  trimCount: 0,
  isHarvested: false
};

// When I water Lucky
await plantRepository.update({
  ...lucky,
  lastWatered: new Date(),
  health: 35
});
```

Looking at Lucky's current state, I can see:
- Health: 30 (not great)
- Height: 15cm (stunted growth)
- Last watered: October 15th
- Never been trimmed

### The Question CRUD Cannot Answer

**Why is Lucky unhealthy?**

I can see Lucky is in poor condition, but I cannot answer:
- Was it watered consistently or sporadically?
- How many times was it watered in total?
- Were there long gaps between watering sessions?
- Did the health ever improve and then decline again?

With CRUD, I only have a snapshot of Lucky's current state. The history is gone—overwritten with each update. I can't debug the problem because I don't know *how* Lucky got to this state.

## Enter: Event-Sourcing

Then I visited my grandma. She also grows a marijuana plant—same strain, planted on the same day as Lucky. But her plant is magnificent: 45cm tall, lush green leaves, vibrant and healthy.

"How do you do it, Grandma?" I asked.

She pulled out a small notebook. "I keep track of everything," she said. "Every time I water it, trim it, or do anything—I write it down with the date."

Her notebook looked like this:

```
Aug 1: Seeded
Aug 3: Watered
Aug 6: Watered
Aug 9: Watered
Aug 12: Watered
Aug 15: Watered, Trimmed
Aug 18: Watered
...
Oct 28: Watered
Oct 30: Watered
```

This is Event-Sourcing! Instead of just tracking the current state, grandma records every event that happens. Let's model this in code.

## Event-Sourcing: Storing the Full History

With Event-Sourcing, instead of storing just the current state, we store every event that happened:

```typescript
type PlantEvent = 
  | { type: "Seeded"; plantId: string; ownerId: string; timestamp: Date }
  | { type: "Watered"; plantId: string; timestamp: Date }
  | { type: "Trimmed"; plantId: string; timestamp: Date }
  | { type: "Harvested"; plantId: string; timestamp: Date };

// Lucky's event history (my sporadic care)
const luckyEvents: PlantEvent[] = [
  { type: "Seeded", plantId: "plant-1", ownerId: "me", timestamp: new Date("2023-08-01") },
  { type: "Watered", plantId: "plant-1", timestamp: new Date("2023-08-05") },
  { type: "Watered", plantId: "plant-1", timestamp: new Date("2023-08-20") },
  // Long gap - I forgot!
  { type: "Watered", plantId: "plant-1", timestamp: new Date("2023-10-15") }
];

// Grandma's plant event history (consistent care)
const grandmasPlantEvents: PlantEvent[] = [
  { type: "Seeded", plantId: "plant-2", ownerId: "grandma", timestamp: new Date("2023-08-01") },
  { type: "Watered", plantId: "plant-2", timestamp: new Date("2023-08-03") },
  { type: "Watered", plantId: "plant-2", timestamp: new Date("2023-08-06") },
  { type: "Watered", plantId: "plant-2", timestamp: new Date("2023-08-09") },
  { type: "Watered", plantId: "plant-2", timestamp: new Date("2023-08-12") },
  { type: "Watered", plantId: "plant-2", timestamp: new Date("2023-08-15") },
  { type: "Trimmed", plantId: "plant-2", timestamp: new Date("2023-08-15") },
  { type: "Watered", plantId: "plant-2", timestamp: new Date("2023-08-18") },
  { type: "Watered", plantId: "plant-2", timestamp: new Date("2023-08-21") },
  { type: "Trimmed", plantId: "plant-2", timestamp: new Date("2023-09-01") },
  // ... regular watering continues ...
  { type: "Trimmed", plantId: "plant-2", timestamp: new Date("2023-10-20") },
  { type: "Watered", plantId: "plant-2", timestamp: new Date("2023-10-28") },
  { type: "Watered", plantId: "plant-2", timestamp: new Date("2023-10-30") }
];
```

**The Insight**: Now we can answer the question! Lucky was only watered 3 times in 2.5 months with huge gaps between waterings. Grandma's plant was watered every 3 days and trimmed regularly. The events tell the complete story of *how* we got to the current state.

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
const luckyState = reconstitutePlant(luckyEvents);
const grandmasPlantState = reconstitutePlant(grandmasPlantEvents);

console.log("Lucky:", luckyState);
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

console.log("Lucky's watering frequency:", calculateWateringFrequency(luckyEvents));
// 0.04 waterings/day (once every 25 days)

console.log("Grandma's watering frequency:", calculateWateringFrequency(grandmasPlantEvents));
// 0.33 waterings/day (once every 3 days)
```

## Summary

Event-Sourcing provides a fundamentally different approach to managing state:

- **CRUD** stores only the current state → fast to query, but loses history
- **Event-Sourcing** stores all events → complete audit trail, can answer "how did we get here?"

We've seen how storing events (Seeded, Watered, Trimmed, Harvested) allows us to:
1. Answer questions that CRUD cannot (like "Why is Lucky unhealthy?")
2. Understand the complete history of our plants
3. Reconstitute the current state by replaying events
4. Derive insights that would be impossible with just a snapshot

The reconstitution process is the heart of Event-Sourcing. By applying each event in sequence, we can rebuild the aggregate state at any point in time. This makes debugging, auditing, and understanding state changes much more powerful.

## What's Next: Projections

But what if reconstituting from thousands of events becomes slow? What if we need different views of the same data for different purposes? That's where **Projections** come in.

In the next chapter, we'll explore how projections let us create optimized, read-specific models from our event stream, giving us the best of both worlds: the complete history of Event-Sourcing with the query performance of traditional databases.

---

*This is the first part of a series on Event-Sourcing. Stay tuned for the next chapter on Projections!*
