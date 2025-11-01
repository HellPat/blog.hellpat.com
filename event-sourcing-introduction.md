# Growing Marijuana with Event-Sourcing (Part 1)

*Part 1 of the Event-Sourcing Series*

## The Story of My Plant

Three months ago, I planted a marijuana seed in a small pot. I named it "Lucky" and placed it near the window. The first week was exciting—I watered it daily, watched the first leaves sprout, and even took photos to track its growth.

Then life got busy. Work deadlines piled up, I traveled for a week, forgot a few times... you know how it goes. I still watered Lucky when I remembered, but the intervals became irregular. Two weeks would pass, then I'd water it twice in one week, then another long gap.

Today, I checked on Lucky. The leaves are yellowing, the stem is thin, and it's barely 15cm tall. Something went wrong, but I can't quite remember what. Did I water it enough? When was the last time I watered it? I honestly can't recall the details.

## CRUD: The Traditional Approach

In a traditional CRUD database, I track Lucky like this:

| id | ownerId | height | health | lastWatered | trimCount |
|----|---------|--------|--------|-------------|-----------|
| plant-1 | me | 15 | 30 | 2023-10-15 | 0 |

When I water Lucky, I update the row:

| id | ownerId | height | health | lastWatered | trimCount |
|----|---------|--------|--------|-------------|-----------|
| plant-1 | me | 15 | 35 | 2023-10-30 | 0 |

The old values are gone. Overwritten.

### The Question CRUD Cannot Answer

**Why is Lucky unhealthy?**

I can see Lucky is in poor condition, but I cannot answer:
- Was it watered consistently or sporadically?
- How many times was it watered in total?
- Were there long gaps between watering sessions?
- Did the health ever improve and then decline again?

With CRUD, I only have a snapshot of Lucky's current state. The history is gone—overwritten with each update. I can't debug the problem because I don't know *how* Lucky got to this state.

## My Grandma Did Better

Then I visited my grandma. She also grows a marijuana plant—same strain, planted on the same day as Lucky. But her plant is magnificent: 45cm tall, lush green leaves, vibrant and healthy.

"How do you do it, Grandma?" I asked.

She smiled and pulled out a small notebook. "I keep track of everything," she said. "Every time I water it, trim it, or do anything—I write it down with the date."

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

**But WHY does this make a difference?**

Looking at her notebook, I could immediately see the pattern: consistent watering every 2-3 days. My CRUD database couldn't tell me that. It only showed me the *last* time I watered Lucky, not the *pattern* of care.

Grandma's notebook is Event-Sourcing—tracking every event that happens, not just the current state.

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

The magic of Event-Sourcing is that we can reconstruct (reconstitute) the current state by replaying all events. This reconstructed state is called an **aggregate**.

Let's focus on one key metric: **total water received**.

```typescript
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
//   "totalWaterReceived": 20
// }
```

**The answer is clear**: Lucky only received 3 waterings in 2.5 months, while Grandma's plant received 20. The events tell the complete story.

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

*This is Part 1 of the Event-Sourcing Series. Stay tuned for Part 2 on Projections!*
