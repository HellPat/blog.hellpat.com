# Event-Sourcing: A Different Way to Model State

Event-Sourcing is an architectural pattern where we store the history of state changes as a sequence of events, rather than just storing the current state. Let's explore this concept using a relatable example: growing marijuana plants.

## The Scenario

I have a marijuana plant. My grandma has another marijuana plant. Mine is starving and struggling to grow, while the one my grandma tends to is flourishing. Why? Let's see how Event-Sourcing can help us understand the difference.

### Grandma's Secret: Consistent Care

Grandma's plant is thriving because she follows a disciplined routine:
- She waters it every 3 days without fail
- She trims the plant regularly to promote healthy growth
- She keeps detailed mental notes of what she's done
- She adjusts her care based on the plant's response to previous actions

In essence, grandma is naturally doing Event-Sourcing - she remembers the history of care and uses that to inform her decisions. My plant, on the other hand, suffers from my forgetfulness and inconsistent attention.

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

## Projections: Optimizing Reads from Events

As we saw earlier, reconstituting the current state by replaying all events works great... until you have thousands or millions of events. Imagine if grandma had to replay 10 years of plant care events every time she wanted to check if her plant needs watering today!

**Projections** solve this problem. A projection is a read-optimized view built from the event stream. Instead of replaying events every time, we maintain pre-computed views that get updated as new events arrive.

### The Problem with Pure Event Replay

Let's say we need to answer common questions about our plants:

```typescript
// Question 1: What's the current health of my plant?
// Without projections: Replay ALL events
const myPlant = reconstitutePlant(myPlantEvents); // Could be slow with many events
console.log(myPlant.health);

// Question 2: Which plants need watering today?
// Without projections: Replay events for ALL plants
const allPlants = [myPlantEvents, grandmasPlantEvents, /* ... thousands more ... */];
const needsWatering = allPlants
  .map(events => reconstitutePlant(events))
  .filter(plant => {
    const daysSinceWatering = (Date.now() - plant.lastWatered.getTime()) / (1000 * 60 * 60 * 24);
    return daysSinceWatering > 3;
  });
// This could take seconds or minutes with large datasets!
```

### What Are Projections?

A projection is like a materialized view in a database - it's a denormalized representation of data that's optimized for specific queries. In Event-Sourcing:

1. **Events are the source of truth** (immutable, append-only)
2. **Projections are derived views** (can be rebuilt from events)
3. **Projections can be thrown away and rebuilt** anytime

Think of it like this: Events are the recipe and ingredients, projections are the finished meal. You can always recreate the meal from the recipe, but it's faster to just have the meal ready.

### Simple In-Memory Projection: Current Plant State

Let's build a simple projection that maintains the current state of all plants:

```typescript
// Projection: Current state of all plants
class PlantStateProjection {
  private plants: Map<string, PlantAggregate> = new Map();

  // Apply an event to update the projection
  apply(event: PlantEvent): void {
    const plantId = event.plantId;
    
    // Get current state or initialize new plant
    let plant = this.plants.get(plantId);
    
    if (!plant && event.type === "Seeded") {
      plant = {
        id: plantId,
        ownerId: event.ownerId,
        height: 5,
        health: 100,
        lastWatered: null,
        trimCount: 0,
        isHarvested: false,
        wateringHistory: []
      };
      this.plants.set(plantId, plant);
      return;
    }

    if (!plant) return; // Plant doesn't exist yet

    // Update the plant based on event type
    switch (event.type) {
      case "Watered":
        plant.lastWatered = event.timestamp;
        plant.wateringHistory.push(event.timestamp);
        plant.health = Math.min(100, plant.health + 10);
        plant.height += 2;
        break;

      case "Trimmed":
        plant.trimCount++;
        plant.health = Math.min(100, plant.health + 5);
        break;

      case "Harvested":
        plant.isHarvested = true;
        break;
    }
  }

  // Query methods - these are FAST because state is pre-computed
  getPlant(plantId: string): PlantAggregate | undefined {
    return this.plants.get(plantId);
  }

  getAllPlants(): PlantAggregate[] {
    return Array.from(this.plants.values());
  }

  getPlantsNeedingWater(): PlantAggregate[] {
    const now = Date.now();
    return this.getAllPlants().filter(plant => {
      if (!plant.lastWatered || plant.isHarvested) return false;
      const daysSinceWatering = (now - plant.lastWatered.getTime()) / (1000 * 60 * 60 * 24);
      return daysSinceWatering > 3;
    });
  }

  getHealthyPlants(): PlantAggregate[] {
    return this.getAllPlants().filter(plant => plant.health > 70);
  }
}
```

### Using the Projection

Now let's see how we use this projection in practice:

```typescript
// Build the projection from events
const plantStateProjection = new PlantStateProjection();

// Apply all events for my plant
myPlantEvents.forEach(event => plantStateProjection.apply(event));

// Apply all events for grandma's plant
grandmasPlantEvents.forEach(event => plantStateProjection.apply(event));

// Now queries are instant!
console.log("My plant health:", plantStateProjection.getPlant("plant-1")?.health);
// Output: 30 (instant - no replay needed!)

console.log("Grandma's plant health:", plantStateProjection.getPlant("plant-2")?.health);
// Output: 95 (instant!)

console.log("Plants needing water:", 
  plantStateProjection.getPlantsNeedingWater().map(p => p.id)
);
// Output: ["plant-1"] (instant!)

console.log("Healthy plants:", 
  plantStateProjection.getHealthyPlants().map(p => ({ id: p.id, health: p.health }))
);
// Output: [{ id: "plant-2", health: 95 }] (instant!)
```

### Multiple Projections for Different Purposes

The beauty of projections is that you can have multiple views of the same events. Let's create a statistics projection:

```typescript
// Projection: Plant care statistics
class PlantStatisticsProjection {
  private stats: Map<string, {
    totalWaterings: number;
    totalTrimmings: number;
    averageDaysBetweenWatering: number;
    lastWateringDate: Date | null;
  }> = new Map();

  apply(event: PlantEvent): void {
    const plantId = event.plantId;
    let stat = this.stats.get(plantId);

    if (!stat) {
      stat = {
        totalWaterings: 0,
        totalTrimmings: 0,
        averageDaysBetweenWatering: 0,
        lastWateringDate: null
      };
      this.stats.set(plantId, stat);
    }

    switch (event.type) {
      case "Watered":
        stat.totalWaterings++;
        
        // Calculate average days between watering
        if (stat.lastWateringDate) {
          const daysBetween = (event.timestamp.getTime() - stat.lastWateringDate.getTime()) 
            / (1000 * 60 * 60 * 24);
          stat.averageDaysBetweenWatering = 
            (stat.averageDaysBetweenWatering * (stat.totalWaterings - 2) + daysBetween) 
            / (stat.totalWaterings - 1);
        }
        
        stat.lastWateringDate = event.timestamp;
        break;

      case "Trimmed":
        stat.totalTrimmings++;
        break;
    }
  }

  getStats(plantId: string) {
    return this.stats.get(plantId);
  }

  getMostWateredPlants(limit: number = 5) {
    return Array.from(this.stats.entries())
      .sort((a, b) => b[1].totalWaterings - a[1].totalWaterings)
      .slice(0, limit)
      .map(([plantId, stats]) => ({ plantId, ...stats }));
  }
}

// Build the statistics projection
const statsProjection = new PlantStatisticsProjection();
myPlantEvents.forEach(event => statsProjection.apply(event));
grandmasPlantEvents.forEach(event => statsProjection.apply(event));

console.log("My plant stats:", statsProjection.getStats("plant-1"));
// { totalWaterings: 3, totalTrimmings: 0, averageDaysBetweenWatering: 35.5, ... }

console.log("Grandma's plant stats:", statsProjection.getStats("plant-2"));
// { totalWaterings: 30+, totalTrimmings: 3, averageDaysBetweenWatering: 3, ... }

console.log("Most watered plants:", statsProjection.getMostWateredPlants(2));
// [{ plantId: "plant-2", totalWaterings: 30, ... }, { plantId: "plant-1", totalWaterings: 3, ... }]
```

### Alert Projection: Monitoring Plant Health

We can even create projections that trigger alerts:

```typescript
// Projection: Plant alerts
class PlantAlertsProjection {
  private alerts: Array<{
    plantId: string;
    alertType: "NEEDS_WATER" | "UNHEALTHY" | "NEVER_TRIMMED";
    severity: "LOW" | "MEDIUM" | "HIGH";
    message: string;
    timestamp: Date;
  }> = [];

  private plantStates: Map<string, {
    lastWatered: Date | null;
    health: number;
    trimCount: number;
    daysSinceSeeded: number;
  }> = new Map();

  apply(event: PlantEvent): void {
    const plantId = event.plantId;
    let state = this.plantStates.get(plantId);

    if (!state && event.type === "Seeded") {
      state = {
        lastWatered: null,
        health: 100,
        trimCount: 0,
        daysSinceSeeded: 0
      };
      this.plantStates.set(plantId, state);
      return;
    }

    if (!state) return;

    // Update state
    switch (event.type) {
      case "Watered":
        state.lastWatered = event.timestamp;
        state.health = Math.min(100, state.health + 10);
        break;
      case "Trimmed":
        state.trimCount++;
        state.health = Math.min(100, state.health + 5);
        break;
    }

    // Check for alert conditions
    const now = Date.now();
    
    // Alert: Needs water
    if (state.lastWatered) {
      const daysSinceWatering = (now - state.lastWatered.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceWatering > 5) {
        this.alerts.push({
          plantId,
          alertType: "NEEDS_WATER",
          severity: "HIGH",
          message: `Plant ${plantId} hasn't been watered in ${Math.floor(daysSinceWatering)} days!`,
          timestamp: new Date()
        });
      }
    }

    // Alert: Unhealthy
    if (state.health < 50) {
      this.alerts.push({
        plantId,
        alertType: "UNHEALTHY",
        severity: "MEDIUM",
        message: `Plant ${plantId} health is low: ${state.health}%`,
        timestamp: new Date()
      });
    }

    // Alert: Never trimmed
    state.daysSinceSeeded++;
    if (state.daysSinceSeeded > 30 && state.trimCount === 0) {
      this.alerts.push({
        plantId,
        alertType: "NEVER_TRIMMED",
        severity: "LOW",
        message: `Plant ${plantId} has never been trimmed after ${state.daysSinceSeeded} days`,
        timestamp: new Date()
      });
    }
  }

  getAlerts(plantId?: string) {
    if (plantId) {
      return this.alerts.filter(a => a.plantId === plantId);
    }
    return this.alerts;
  }

  getHighSeverityAlerts() {
    return this.alerts.filter(a => a.severity === "HIGH");
  }
}

// Build alerts projection
const alertsProjection = new PlantAlertsProjection();
myPlantEvents.forEach(event => alertsProjection.apply(event));
grandmasPlantEvents.forEach(event => alertsProjection.apply(event));

console.log("All alerts:", alertsProjection.getAlerts());
// Shows alerts for plants needing attention

console.log("High severity alerts:", alertsProjection.getHighSeverityAlerts());
// [{ plantId: "plant-1", alertType: "NEEDS_WATER", severity: "HIGH", ... }]
```

### Key Characteristics of Projections

1. **Eventually Consistent**: Projections might be slightly behind the event stream, which is usually acceptable
2. **Rebuildable**: You can delete a projection and rebuild it from events at any time
3. **Specialized**: Each projection is optimized for specific queries
4. **Independent**: Multiple projections can coexist without affecting each other
5. **Fast**: Queries against projections are instant (no event replay needed)

### When to Use Projections

**Use projections when:**
- You have frequent reads of the same data
- Query performance matters
- You need different views of the same data
- You have complex aggregations or calculations

**Don't use projections when:**
- You have very few events (reconstitution is fast enough)
- Absolute real-time consistency is required (though projections can be near-real-time)
- Storage is extremely limited

### Projections vs. Aggregates

It's important to understand the difference:

- **Aggregate**: The reconstituted state from replaying events for a single entity (e.g., one plant)
- **Projection**: A pre-computed, maintained view that can span multiple entities and be optimized for specific queries

Think of it this way:
- Grandma's plant aggregate = the current state of her one plant
- Grandma's garden projection = an optimized view of all her plants, updated as she cares for them

## Summary

We've now covered the complete Event-Sourcing picture:

1. **Events**: The immutable source of truth (Seeded, Watered, Trimmed, Harvested)
2. **Aggregates**: Current state reconstituted by replaying events
3. **Projections**: Pre-computed, optimized views for fast queries

**The Event-Sourcing Flow:**
```
Events (Source of Truth)
    ↓
    → Reconstitute → Aggregate (single entity state)
    ↓
    → Apply to → Projections (optimized read views)
                    ↓
                    → Current State Projection
                    → Statistics Projection
                    → Alerts Projection
                    → ... any view you need
```

Grandma's plant thrives because she implicitly follows this pattern:
- She remembers the history (events)
- She knows the current state (aggregate)
- She has mental shortcuts for common checks (projections)

By combining events, aggregates, and projections, Event-Sourcing gives us:
- Complete audit trail and history
- Ability to reconstruct state at any point in time
- Fast queries through projections
- Multiple specialized views of the same data
- The flexibility to add new views without changing existing code

This makes Event-Sourcing particularly powerful for domains where understanding "how we got here" is as important as knowing "where we are now."

---

*Now you have a complete understanding of Event-Sourcing fundamentals! The event stream captures history, aggregates represent current state, and projections enable fast queries. This architecture is the foundation for building scalable, auditable, and flexible systems.*
