+++
title = "Growing Marijuana with Event-Sourcing"
slug = "events-in-event-sourcing"
date = 2025-11-01
authors = ["Patrick Heller"]
+++

CRUD databases store only current state, overwriting history with each update. This makes it impossible to answer "how did we get here?" Event-Sourcing solves this by storing every state change as an immutable event. Learn the fundamental difference between storing snapshots versus storing a complete event log, and why event streams enable debugging and insights that CRUD cannot provide.

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

{{ file_contents(path="content/blog/event-sourced-marijuana/01-events/plantEvent.ts", language="typescript") }}

<div class="grid grid-cols-2 gap-4">
    <figure>
        <figcaption>myPlant.ts (sporadic care)</figcaption>
        {{ file_contents(path="content/blog/event-sourced-marijuana/01-events/myPlant.ts", language="typescript") }}
    </figure>
    <figure>
        <figcaption>grandmasPlant.ts (consistent care)</figcaption>
        {{ file_contents(path="content/blog/event-sourced-marijuana/01-events/grandmasPlant.ts", language="typescript") }}
    </figure>
</div>

**The Insight**: Now we can answer the question! myPlant was only watered twice in the first 19 days before it died from neglect. Grandma's plant was watered daily and trimmed twice per week. The events tell the complete story of *how* we got to the current state - my laziness led to the plant's death, while Grandma's consistent care kept her plant thriving.

## Summary

Event-Sourcing provides a fundamentally different approach to managing state:

- **CRUD** stores only the current state → fast to query, but loses history
- **Event-Sourcing** stores all events → complete audit trail, can answer "how did we get here?"

We've seen how storing events (Seeded, Watered, Trimmed, Died) allows us to:
1. Answer questions that CRUD cannot (like "Why did myPlant die?")
2. Understand the complete history of our plants
3. Derive insights that would be impossible with just a snapshot
4. **Consistent care matters**: Daily watering and regular trimming lead to healthy growth, while neglect leads to death



---

*This is Part 1 of the Event-Sourcing Series. Continue to [Part 2: Reconstituting the Aggregate](event-sourcing-reconstitution.md)*
