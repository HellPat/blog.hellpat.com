# Growing Marijuana with Event-Sourcing: Projections (Part 5)

*← Back to [Part 4: Time is Business Critical](event-sourcing-time-is-business-critical.md)*

## The Performance Problem

I now have 50 plants. Every morning, I want to check: **"Which plants need watering today?"**

With what we've learned so far, I'd do this:

```typescript
// Get all plant IDs
const allPlantIds = await eventStore.getAllPlantIds(); // 50 plants

// Reconstitute each plant
const plantsNeedingWater = [];
for (const plantId of allPlantIds) {
  const events = await eventStore.getEvents(plantId); // 100-200 events per plant
  const plant = reconstitutePlant(events);
  
  if (plant.isAlive && plant.daysSinceWatering >= 3) {
    plantsNeedingWater.push(plant);
  }
}

console.log(`${plantsNeedingWater.length} plants need watering`);
```

**The Problem**: I'm replaying **5,000-10,000 events every single morning** just to see which plants need water.

As my operation grows to 200 plants, this becomes unbearably slow. I need a better solution.

## The Solution: Pre-Calculate with Projections

Instead of reconstituting every time I query, what if I kept the current state of each plant already calculated?

A **projection** is a read-optimized view built from your event stream. It's like a materialized view in a database—you update it as events come in, then queries are instant.

```typescript
interface PlantWateringProjection {
  plantId: string;
  ownerId: string;
  isAlive: boolean;
  daysSinceWatering: number;
}
```

## Building the Projection

The projection maintains state by handling each event:

```typescript
class PlantsNeedingWaterProjection {
  private plants: Map<string, PlantWateringProjection> = new Map();
  
  // Apply an event to update the projection
  apply(event: PlantEvent): void {
    const plantId = event.plantId;
    
    // Get current state or create empty
    let plant = this.plants.get(plantId);
    if (!plant) {
      plant = {
        plantId,
        ownerId: "",
        isAlive: false,
        daysSinceWatering: 0
      };
    }
    
    // Update state based on event
    switch (event.type) {
      case "Seeded":
        plant.ownerId = event.ownerId;
        plant.isAlive = true;
        plant.daysSinceWatering = 0;
        break;
        
      case "Watered":
        plant.daysSinceWatering = 0;
        break;
        
      case "DayStarted":
        plant.daysSinceWatering += 1;
        break;
        
      case "Died":
        plant.isAlive = false;
        break;
    }
    
    this.plants.set(plantId, plant);
  }
  
  // Query the projection - instant!
  getPlantsNeedingWater(): PlantWateringProjection[] {
    return Array.from(this.plants.values())
      .filter(plant => plant.isAlive && plant.daysSinceWatering >= 3);
  }
  
  getPlant(plantId: string): PlantWateringProjection | undefined {
    return this.plants.get(plantId);
  }
}
```

## Initializing the Projection

When the system starts, replay all historical events to build the projection:

```typescript
async function buildProjection(eventStore: EventStore): Promise<PlantsNeedingWaterProjection> {
  const projection = new PlantsNeedingWaterProjection();
  
  // Get all events from all plants
  const allEvents = await eventStore.getAllEvents();
  
  // Replay each event to build current state
  for (const event of allEvents) {
    projection.apply(event);
  }
  
  console.log(`✓ Projection built from ${allEvents.length} events`);
  return projection;
}
```

## Keeping the Projection Up-to-Date

The projection needs to stay synchronized with the event store. We use a long-running worker that continuously processes new events:

```typescript
async function projectionWorker(
  eventStore: EventStore,
  projection: PlantsNeedingWaterProjection
): Promise<void> {
  console.log("Starting projection worker...");
  
  while (true) {
    // Get new events since last processed
    const newEvents = await eventStore.getNewEventsSince(projection.lastProcessedEventId);
    
    // Apply each event to the projection
    for (const event of newEvents) {
      projection.apply(event);
    }
    
    // Wait a bit before checking for more events
    await sleep(100); // Check every 100ms
  }
}
```

The worker runs in the background, continuously updating the projection as new events arrive. Your application code just writes events:

```typescript
async function waterPlant(plantId: string, eventStore: EventStore): Promise<void> {
  const event: PlantEvent = {
    type: "Watered",
    plantId,
    timestamp: new DateTimeImmutable()
  };
  
  // Just store the event - the worker will pick it up
  await eventStore.append(plantId, event);
}
```

## Using the Projection

Now my morning check is instant:

```typescript
// Before: 5,000-10,000 events replayed
// After: Simple array filter on in-memory data
const needsWater = projection.getPlantsNeedingWater();

console.log(`${needsWater.length} plants need watering today:`);
for (const plant of needsWater) {
  console.log(`  - ${plant.plantId}: ${plant.daysSinceWatering} days since watering`);
}
```

No reconstitution. No event replay. **Instant results.**

## Example in Action

Let's see how the projection updates:

```typescript
const projection = new PlantsNeedingWaterProjection();

// Initial seeding
projection.apply({ type: "Seeded", plantId: "plant-1", ownerId: "me", timestamp: new DateTimeImmutable() });
projection.apply({ type: "Watered", plantId: "plant-1", timestamp: new DateTimeImmutable() });

console.log(projection.getPlantsNeedingWater()); // [] - just watered

// Days pass
projection.apply({ type: "DayStarted", plantId: "plant-1", timestamp: new DateTimeImmutable() });
projection.apply({ type: "DayStarted", plantId: "plant-1", timestamp: new DateTimeImmutable() });
projection.apply({ type: "DayStarted", plantId: "plant-1", timestamp: new DateTimeImmutable() });

console.log(projection.getPlantsNeedingWater()); 
// [{ plantId: "plant-1", daysSinceWatering: 3, isAlive: true, ownerId: "me" }]

// Water it
projection.apply({ type: "Watered", plantId: "plant-1", timestamp: new DateTimeImmutable() });

console.log(projection.getPlantsNeedingWater()); // [] - watered again
```

## Projections are Disposable

The beautiful thing about projections: **they're completely disposable**.

If your projection gets corrupted or you change its structure, just rebuild it:

```typescript
async function rebuildProjection(eventStore: EventStore): Promise<PlantsNeedingWaterProjection> {
  console.log("Rebuilding projection from event store...");
  
  const projection = new PlantsNeedingWaterProjection();
  const allEvents = await eventStore.getAllEvents();
  
  for (const event of allEvents) {
    projection.apply(event);
  }
  
  console.log(`✓ Projection rebuilt from ${allEvents.length} events`);
  return projection;
}
```

The event store is the source of truth. Projections are just optimized views.

## Key Takeaways

Projections solve the performance problem of Event-Sourcing:

1. **Write**: Events are appended to the event store (source of truth)
2. **Project**: Events are applied to projections (read-optimized views)
3. **Read**: Queries hit the projection (instant, no reconstitution needed)
4. **Rebuild**: Projections can be rebuilt from events at any time

**Benefits**:
- ✅ Fast queries independent of event count
- ✅ Optimized for specific use cases
- ✅ Completely disposable and rebuildable
- ✅ Multiple projections can serve different needs

**Trade-offs**:
- ⚠️ Additional memory/storage for projections
- ⚠️ Must keep projections synchronized with events
- ⚠️ Eventual consistency (very brief lag when processing events)

Projections give you the best of both worlds: the complete audit trail of Event-Sourcing with the query performance of traditional databases.

---

*This is Part 5 of the Event-Sourcing Series. Continue to [Part 6: Time Travel](event-sourcing-time-travel.md)*

*← Back to [Part 1: Introduction](event-sourcing-introduction.md) | [Part 2: Reconstituting the Aggregate](event-sourcing-reconstitution.md) | [Part 3: Business Logic in Aggregates](event-sourcing-business-logic.md) | [Part 4: Time is Business Critical](event-sourcing-time-is-business-critical.md)*