type PlantEvent =
  | { type: "Seeded"; plantId: string; occured_at: Date }
  | { type: "Watered"; plantId: string; occured_at: Date }
  | { type: "Trimmed"; plantId: string; occured_at: Date }
  | { type: "Died"; plantId: string; occured_at: Date }
  | { type: "DayStarted"; date: Date };

interface PlantState {
  id: string;
  isAlive: boolean;
  totalWaterings: number;
  totalTrimCount: number;
  daysSinceLastWatering: number;
}

class PlantAggregate {
  state: PlantState = {
    id: "",
    isAlive: false,
    totalWaterings: 0,
    totalTrimCount: 0,
    daysSinceLastWatering: 0,
  };

  private uncommittedEvents: PlantEvent[] = [];

  private constructor(history: PlantEvent[]) {
    for (const event of history) {
      this.apply(event);
    }
  }

  static seed(plantId: string): PlantAggregate {
    const event: PlantEvent = {
      type: "Seeded",
      plantId: plantId,
      occured_at: new Date(),
    };

    const aggregate = new PlantAggregate([event]);
    return aggregate;
  }

  static reconstitute(history: PlantEvent[]): PlantAggregate {
    return new PlantAggregate(history);
  }

  private apply(event: PlantEvent): void {
    switch (event.type) {
      case "Seeded":
        this.state.id = event.plantId;
        this.state.isAlive = true;
        break;
      case "Watered":
        this.state.totalWaterings += 1;
        this.state.daysSinceLastWatering = 0;
        break;
      case "Trimmed":
        this.state.totalTrimCount += 1;
        break;
      case "Died":
        this.state.isAlive = false;
        break;
      case "DayStarted":
        this.state.daysSinceLastWatering += 1;
        break;
    }
  }

  private recordThat(event: PlantEvent): void {
    this.apply(event);
    this.uncommittedEvents.push(event);
  }

  water(): void {
    if (!this.state.isAlive) {
      throw new Error("Cannot water a dead plant");
    }

    const event: PlantEvent = {
      type: "Watered",
      plantId: this.state.id,
      occured_at: new Date(),
    };

    this.recordThat(event);
  }

  trim(): void {
    if (!this.state.isAlive) {
      throw new Error("Cannot trim a dead plant");
    }

    const event: PlantEvent = {
      type: "Trimmed",
      plantId: this.state.id,
      occured_at: new Date(),
    };

    this.recordThat(event);
  }

  newDay(date: Date = new Date()): void {
    const event: PlantEvent = {
      type: "DayStarted",
      date: date,
    };

    // The date will be serialized and stored permanently in the event store
    this.recordThat(event);
  }

  needsAttention(): boolean {
    if (!this.state.isAlive) {
      return false;
    }

    if (this.state.totalWaterings === 0) {
      return true; // Never been watered - needs attention!
    }

    return this.state.daysSinceLastWatering > 2;
  }

  getUncommittedEvents(): PlantEvent[] {
    return [...this.uncommittedEvents];
  }
}
