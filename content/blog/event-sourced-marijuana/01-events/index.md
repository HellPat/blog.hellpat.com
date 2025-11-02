+++
title = "Growing Marijuana with Event-Sourcing"
slug = "events-in-event-sourcing"
date = 2025-11-01
authors = ["Patrick Heller"]
+++

CRUD databases store only current state, overwriting history with each update. This makes it impossible to answer "how did we get here?" Event-Sourcing solves this by storing every state change as an immutable event. Learn how my Grandma introduced Event Sourcing to me.

<!-- more -->

# Growing Marijuana with Event-Sourcing: Introduction

## The Story of My Plant

Three months ago, I planted a marijuana seed in a small pot. I named it "myPlant" and placed it near the window. The first week was exciting — I watered it daily, watched the first leaves sprout, and even took photos to track its growth.

Then life got busy. Work deadlines piled up, I traveled for a week, forgot a few times... you know how it goes. I still watered myPlant when I remembered, but the intervals became irregular. Two weeks would pass, then I'd water it twice in one week, then another long gap.

Today, I checked on myPlant. The leaves are yellowing, the stem is thin, and it's barely 15cm tall. Something went wrong, but I can't quite remember what. Did I water it enough? When was the last time I watered it? I honestly can't recall the details.

<!-- more -->

## CRUD: The Traditional Approach

In a traditional CRUD database, I track myPlant like this:

```
| id | ownerId | height | health | lastWatered | trimCount |
|----|---------|--------|--------|-------------|-----------|
| plant-1 | me | 15 | 30 | 2023-10-15T14:30:00 | 0         |
```

When I water myPlant, I update the row:

```
| id | ownerId | height | health | lastWatered | trimCount |
|----|---------|--------|--------|-------------|-----------|
| plant-1 | me | 15 | 35 | 2023-10-30T09:15:00 | 0         |
```

The old values are gone. Overwritten.

### The Question CRUD Cannot Answer

**Why is myPlant unhealthy?**

I can see myPlant is in poor condition, but I cannot answer:
- Was it watered consistently or sporadically?
- How many times was it watered in total?
- Were there long gaps between watering sessions?
- Did the health ever improve and then decline again?

With CRUD, I only have a snapshot of myPlant's current state. The history is gone—overwritten with each update. I can't debug the problem because I don't know *how* myPlant got to this state.

## My Grandma Did Better

Then I visited my grandma. She also grows a marijuana plant—same strain, planted on the same day as myPlant. But her plant is magnificent: 45cm tall, lush green leaves, vibrant and healthy.

"How do you do it, Grandma?" I asked.

She smiled and pulled out a small notebook. "I keep track of everything," she said. "Every time I water it, trim it, or do anything—I write it down with the date—of course using a `DateTimeImmutable`."

Her notebook looked like this:

```
2023-08-01T10:00:00: Seeded
2023-08-03T08:30:00: Watered
2023-08-06T09:15:00: Watered
2023-08-09T07:45:00: Watered
2023-08-12T08:00:00: Watered
2023-08-15T09:30:00: Watered, Trimmed
2023-08-18T08:15:00: Watered
...
2023-10-28T07:30:00: Watered
2023-10-30T08:45:00: Watered
```

**But WHY does this make a difference?**

Looking at her notebook, I could immediately see the pattern: consistent watering every 2-3 days. My CRUD database couldn't tell me that. It only showed me the *last* time I watered myPlant, not the *pattern* of care.

Grandma's notebook is Event-Sourcing—tracking every event that happens, not just the current state.

## Event-Sourcing: Storing the Full History

With Event-Sourcing, instead of storing just the current state, we store every event that happened:

```typescript
type PlantEvent =
  | { type: "Seeded"; plantId: string; ownerId: string; timestamp: DateTimeImmutable }
  | { type: "Watered"; plantId: string; timestamp: DateTimeImmutable }
  | { type: "Trimmed"; plantId: string; timestamp: DateTimeImmutable }
  | { type: "Harvested"; plantId: string; weightGrams: number; timestamp: DateTimeImmutable };

// myPlant's event history (my sporadic care)
const myPlantEvents: PlantEvent[] = [
  { type: "Seeded", plantId: "plant-1", ownerId: "me", timestamp: new DateTimeImmutable("2023-08-01T10:00:00") },
  { type: "Watered", plantId: "plant-1", timestamp: new DateTimeImmutable("2023-08-05T14:30:00") },
  { type: "Watered", plantId: "plant-1", timestamp: new DateTimeImmutable("2023-08-20T11:15:00") },
  { type: "Watered", plantId: "plant-1", timestamp: new DateTimeImmutable("2023-10-15T09:00:00") }
];

// Grandma's plant event history (consistent care)
const grandmasPlantEvents: PlantEvent[] = [
  { type: "Seeded", plantId: "plant-2", ownerId: "grandma", timestamp: new DateTimeImmutable("2023-08-01T10:00:00") },
  { type: "Watered", plantId: "plant-2", timestamp: new DateTimeImmutable("2023-08-03T08:30:00") },
  { type: "Watered", plantId: "plant-2", timestamp: new DateTimeImmutable("2023-08-06T09:15:00") },
  { type: "Watered", plantId: "plant-2", timestamp: new DateTimeImmutable("2023-08-09T07:45:00") },
  { type: "Watered", plantId: "plant-2", timestamp: new DateTimeImmutable("2023-08-12T08:00:00") },
  { type: "Watered", plantId: "plant-2", timestamp: new DateTimeImmutable("2023-08-15T09:30:00") },
  { type: "Trimmed", plantId: "plant-2", timestamp: new DateTimeImmutable("2023-08-15T09:30:00") },
  { type: "Watered", plantId: "plant-2", timestamp: new DateTimeImmutable("2023-08-18T08:15:00") },
  { type: "Watered", plantId: "plant-2", timestamp: new DateTimeImmutable("2023-08-21T07:50:00") },
  { type: "Watered", plantId: "plant-2", timestamp: new DateTimeImmutable("2023-08-24T08:30:00") },
  { type: "Watered", plantId: "plant-2", timestamp: new DateTimeImmutable("2023-08-27T09:00:00") },
  { type: "Watered", plantId: "plant-2", timestamp: new DateTimeImmutable("2023-08-30T08:45:00") },
  { type: "Trimmed", plantId: "plant-2", timestamp: new DateTimeImmutable("2023-09-01T10:15:00") },
  { type: "Watered", plantId: "plant-2", timestamp: new DateTimeImmutable("2023-09-02T08:20:00") },
  { type: "Watered", plantId: "plant-2", timestamp: new DateTimeImmutable("2023-09-05T09:10:00") },
  { type: "Watered", plantId: "plant-2", timestamp: new DateTimeImmutable("2023-09-08T08:00:00") },
  { type: "Watered", plantId: "plant-2", timestamp: new DateTimeImmutable("2023-09-11T08:30:00") },
  { type: "Watered", plantId: "plant-2", timestamp: new DateTimeImmutable("2023-09-14T09:00:00") },
  { type: "Watered", plantId: "plant-2", timestamp: new DateTimeImmutable("2023-09-17T08:15:00") },
  { type: "Watered", plantId: "plant-2", timestamp: new DateTimeImmutable("2023-09-20T07:45:00") },
  { type: "Watered", plantId: "plant-2", timestamp: new DateTimeImmutable("2023-09-23T08:30:00") },
  { type: "Watered", plantId: "plant-2", timestamp: new DateTimeImmutable("2023-09-26T09:15:00") },
  { type: "Watered", plantId: "plant-2", timestamp: new DateTimeImmutable("2023-09-29T08:00:00") },
  { type: "Watered", plantId: "plant-2", timestamp: new DateTimeImmutable("2023-10-02T08:45:00") },
  { type: "Watered", plantId: "plant-2", timestamp: new DateTimeImmutable("2023-10-05T09:30:00") },
  { type: "Watered", plantId: "plant-2", timestamp: new DateTimeImmutable("2023-10-08T08:15:00") },
  { type: "Watered", plantId: "plant-2", timestamp: new DateTimeImmutable("2023-10-11T07:50:00") },
  { type: "Watered", plantId: "plant-2", timestamp: new DateTimeImmutable("2023-10-14T08:30:00") },
  { type: "Watered", plantId: "plant-2", timestamp: new DateTimeImmutable("2023-10-17T09:00:00") },
  { type: "Trimmed", plantId: "plant-2", timestamp: new DateTimeImmutable("2023-10-20T10:00:00") },
  { type: "Watered", plantId: "plant-2", timestamp: new DateTimeImmutable("2023-10-20T10:15:00") },
  { type: "Watered", plantId: "plant-2", timestamp: new DateTimeImmutable("2023-10-23T08:20:00") },
  { type: "Watered", plantId: "plant-2", timestamp: new DateTimeImmutable("2023-10-26T08:45:00") },
  { type: "Watered", plantId: "plant-2", timestamp: new DateTimeImmutable("2023-10-28T07:30:00") },
  { type: "Watered", plantId: "plant-2", timestamp: new DateTimeImmutable("2023-10-30T08:45:00") }
];
```

**The Insight**: Now we can answer the question! myPlant was only watered 3 times in 2.5 months with huge gaps between waterings. Grandma's plant was watered consistently every 2-3 days and trimmed regularly. The events tell the complete story of *how* we got to the current state.

## Summary

Event-Sourcing provides a fundamentally different approach to managing state:

- **CRUD** stores only the current state → fast to query, but loses history
- **Event-Sourcing** stores all events → complete audit trail, can answer "how did we get here?"

We've seen how storing events (Seeded, Watered, Trimmed, Harvested) allows us to:
1. Answer questions that CRUD cannot (like "Why is myPlant unhealthy?")
2. Understand the complete history of our plants
3. Derive insights that would be impossible with just a snapshot
4. **Watering helps**: Consistent watering every 2-3 days leads to healthy growth



---

*This is Part 1 of the Event-Sourcing Series. Continue to [Part 2: Reconstituting the Aggregate](event-sourcing-reconstitution.md)*
