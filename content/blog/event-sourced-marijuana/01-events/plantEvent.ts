type PlantEvent =
  | {
      type: "Seeded";
      plantId: string;
      occured_at: Date;
    }
  | { type: "Watered"; plantId: string; occured_at: Date }
  | { type: "Trimmed"; plantId: string; occured_at: Date }
  | { type: "Died"; plantId: string; occured_at: Date };
