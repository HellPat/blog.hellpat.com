type PlantEvent =
  | {
      type: "Seeded";
      plantId: string;
      occured_at: Date;
    }
  | { type: "Watered"; plantId: string; occured_at: Date }
  | { type: "Trimmed"; plantId: string; occured_at: Date }
  | { type: "Died"; plantId: string; occured_at: Date };

interface PlantState {
  id: string;
  isAlive: boolean;
  totalWaterings: number;
  totalTrimCount: number;
}

class PlantAggregate {
  state: PlantState = {
    id: "",
    isAlive: false,
    totalWaterings: 0,
    totalTrimCount: 0,
  };

  private uncommittedEvents: PlantEvent[] = [];

  private constructor(history: PlantEvent[]) {
    // Reconstitute current state from history
    for (const event of history) {
      this.apply(event);
    }
  }

  // Static constructor: Create a new plant
  static seed(plantId: string): PlantAggregate {
    const event: PlantEvent = {
      type: "Seeded",
      plantId: plantId,
      occured_at: new Date(),
    };

    const aggregate = new PlantAggregate([event]);
    return aggregate;
  }

  // Static constructor: Reconstitute from event history
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
        break;
      case "Trimmed":
        this.state.totalTrimCount += 1;
        break;
      case "Died":
        this.state.isAlive = false;
        break;
    }
  }

  private recordThat(event: PlantEvent): void {
    this.apply(event);
    this.uncommittedEvents.push(event);
  }

  // Command: Water the plant
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

  // Command: Trim the plant
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

  getUncommittedEvents(): PlantEvent[] {
    return [...this.uncommittedEvents];
  }
}
