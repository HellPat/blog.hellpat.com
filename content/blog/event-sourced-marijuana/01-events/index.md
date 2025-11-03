+++
title = "Growing Marijuana with Event-Sourcing"
slug = "events-in-event-sourcing"
date = 2025-11-01T10:00:00Z
authors = ["Patrick Heller"]
+++

CRUD stores only current state, losing history. Event‑Sourcing records every change as an immutable event, enabling you to answer "How did we get here?"

<!-- more -->

# Growing Marijuana with Event‑Sourcing — Introduction

## The story of `myPlant`

Three months ago I planted a marijuana seed in a small pot. I named it `myPlant` and put it near the window. The first week was exciting — I watered it daily, watched the first leaves sprout, and took photos to track its growth.

Then life got busy. Work deadlines piled up, I traveled for a week, and I forgot a few times — you know how it goes. I still watered `myPlant` when I remembered, but the intervals became irregular: two weeks would pass, then I’d water it twice in one week, then another long gap.

<div id="plant-status" class="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-8 lg:w-[calc(100vw-4rem)] lg:max-w-[120rem] lg:relative lg:left-1/2 lg:-translate-x-1/2 lg:px-8">
<div class="lg:p-6 lg:flex lg:flex-col lg:items-end">


<figure class="lg:max-w-md">
    {{ resize_image(path="content/blog/event-sourced-marijuana/01-events/myPlant.png", width=200, height=500, op="fit") }}
    <figcaption class="text-base text-current">
        Today I checked on `myPlant`. The leaves are yellowing, the stem is thin, barely 15 cm tall. Something went wrong, but I can't remember what. Did I water it enough? I honestly can't recall.
    </figcaption>
</figure>



</div>
<div class="lg:p-6 lg:flex lg:flex-col lg:items-start">


<figure class="lg:max-w-md">
    {{ resize_image(path="content/blog/event-sourced-marijuana/01-events/grandmasPlant.png", width=200, height=500, op="fit") }}
    <figcaption class="text-base text-current">
        Meanwhile, Grandma's plant — same day, same strain — stands at 45 cm with lush green leaves. While I'm trying to remember *if* I watered mine, hers looks ready for a photoshoot.
    </figcaption>
</figure>

</div>
</div>

## CRUD: the traditional approach

<div id="crud-comparison" class="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-8 lg:w-[calc(100vw-4rem)] lg:max-w-[120rem] lg:relative lg:left-1/2 lg:-translate-x-1/2 lg:px-8">
<div class="lg:p-6 lg:flex lg:flex-col lg:items-end">

```
| id            | height | health | lastWatered         | trimCount |
|---------------|--------|--------|---------------------|-----------|
| myPlant       | 15     | 30     | 2023-10-15T14:30:00 | 0         |
```

</div>
<div class="lg:p-6 lg:flex lg:flex-col lg:items-start">


```
| id            | height | health | lastWatered         | trimCount |
|---------------|--------|--------|---------------------|-----------|
| grandmasPlant | 45     | 95     | 2023-10-30T08:45:00 | 12        |
```

</div>
</div>

Both plants are stored as simple rows in a CRUD database, showing only their current state.

### The question CRUD cannot answer

**Why is `myPlant` unhealthy while Grandma's plant thrives?**

I can see `myPlant` is in poor condition, but I cannot answer:
- Was it watered consistently or sporadically?
- How many times was it watered in total?
- Were there long gaps between watering sessions?
- Did the health ever improve and then decline again?

With CRUD, I only have a snapshot of `myPlant`’s current state. The history is gone—overwritten with each update. I can’t debug the problem because I don’t know *how* `myPlant` got to this state.

## Grandma's secret

"How do you do it, Grandma?" I asked.

She smiled and pulled out a small notebook. "I keep track of everything," she said. "Every time I water it, trim it, or do anything — I write it down with the date"

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

**But why does this make a difference?**

Looking at her notebook I could immediately see the pattern: consistent watering every 2–3 days. My CRUD snapshot couldn’t tell me that. It only showed the *last* time I watered `myPlant`, not the *pattern* of care.

Grandma’s notebook is Event‑Sourcing — tracking every event that happened, not just the current state.

## Event‑Sourcing: storing the full history

With Event‑Sourcing, instead of storing only the current state, we store every event that happened:

{{ file_contents(path="content/blog/event-sourced-marijuana/01-events/plantEvent.ts", language="typescript") }}

<div id="event-comparison" class="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-8 lg:w-[calc(100vw-4rem)] lg:max-w-[120rem] lg:relative lg:left-1/2 lg:-translate-x-1/2 lg:px-8">
    <figure class="lg:p-6">
        <figcaption>myPlant.ts (sporadic care)</figcaption>
        {{ file_contents(path="content/blog/event-sourced-marijuana/01-events/myPlant.ts", language="typescript") }}
    </figure>
    <figure class="lg:p-6">
        <figcaption>grandmasPlant.ts (consistent care)</figcaption>
        {{ file_contents(path="content/blog/event-sourced-marijuana/01-events/grandmasPlant.ts", language="typescript") }}
    </figure>
</div>

**The insight:** now we can answer the question. `myPlant` was watered only twice in the first 19 days before it died from neglect; Grandma’s plant was watered regularly and trimmed twice per week. The events tell the complete story of *how* we got to the current state — my neglect led to death, while consistent care produced healthy growth.

## Summary

Event‑Sourcing provides a fundamentally different approach to managing state:

- **CRUD** stores only the current state → loses history
- **Event‑Sourcing** stores all events → a complete audit trail; can answer “How did we get here?”

Storing events (Seeded, Watered, Trimmed, Died) lets us:
1. Answer questions that CRUD cannot (for example, "Why did `myPlant` die?")
2. Understand the complete history of our plants
3. Derive insights that would be impossible with just a snapshot
4. **Consistent care matters:** daily watering and regular trimming lead to healthy growth; neglect leads to death

---

**Further reading:**
- Martin Fowler's foundational article on [Event Sourcing](https://martinfowler.com/eaaDev/EventSourcing.html) provides a comprehensive introduction to the pattern and its applications.
- Shawn McCool's [CQRS and Event Sourcing course](https://www.youtube.com/playlist?list=PLQuwqoolg4aI6v1GvtRg3NgT0PBBHVqii) - I bought this course back in 2018, but luckily it's now available for free on YouTube.

