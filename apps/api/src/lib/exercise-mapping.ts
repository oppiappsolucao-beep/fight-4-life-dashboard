import { ExerciseBodyRegion } from "@prisma/client";

export interface ExerciseSeedItem {
  slug: string;
  name: string;
  muscleGroup: string;
  equipment?: string | null;
  instructions: string;
  imageUrl?: string | null;
  gifUrl?: string | null;
  phases: string[];
  bodyRegion: keyof typeof ExerciseBodyRegion;
}

export interface ExerciseDbApiItem {
  exerciseId: string;
  name: string;
  gifUrl?: string | null;
  bodyParts?: string[];
  equipments?: string[];
  targetMuscles?: string[];
  secondaryMuscles?: string[];
  instructions?: string[];
}

const MUSCLE_PT: Record<string, string> = {
  pectorals: "Peito",
  chest: "Peito",
  lats: "Costas",
  "upper back": "Costas",
  traps: "Costas",
  spine: "Costas",
  delts: "Ombros",
  deltoids: "Ombros",
  shoulders: "Ombros",
  biceps: "Bíceps",
  triceps: "Tríceps",
  forearms: "Antebraço",
  abs: "Core",
  "serratus anterior": "Core",
  quads: "Pernas",
  quadriceps: "Pernas",
  hamstrings: "Posterior",
  glutes: "Glúteos",
  calves: "Panturrilha",
  adductors: "Pernas",
  abductors: "Pernas",
  "hip flexors": "Pernas",
  "cardiovascular system": "Cardio",
  cardio: "Cardio",
};

const EQUIPMENT_PT: Record<string, string> = {
  "body weight": "Peso corporal",
  barbell: "Barra",
  dumbbell: "Halteres",
  cable: "Cabo",
  band: "Elástico",
  "resistance band": "Elástico",
  kettlebell: "Kettlebell",
  machine: "Máquina",
  "leverage machine": "Máquina",
  "smith machine": "Smith",
  "sled machine": "Sled",
  assisted: "Assistido",
  medicineball: "Medicine ball",
  "medicine ball": "Medicine ball",
  "stability ball": "Bola suíça",
  "ez barbell": "Barra W",
  "olympic barbell": "Barra olímpica",
  roller: "Rolo",
  rope: "Corda",
  tire: "Pneu",
  trapbar: "Trap bar",
  "trap bar": "Trap bar",
  weighted: "Com peso",
  bosu: "BOSU",
  wheel: "Roda abdominal",
  "stationary bike": "Bike",
  elliptical: "Elíptico",
  "stepmill machine": "Escada",
  "skierg machine": "SkiErg",
};

const BODY_PART_REGION: Record<string, keyof typeof ExerciseBodyRegion> = {
  chest: "SUPERIOR",
  back: "SUPERIOR",
  shoulders: "SUPERIOR",
  "upper arms": "SUPERIOR",
  "lower arms": "SUPERIOR",
  neck: "SUPERIOR",
  "upper legs": "INFERIOR",
  "lower legs": "INFERIOR",
  waist: "SUPERIOR",
  cardio: "CARDIO",
};

function titleCaseName(value: string): string {
  return value
    .trim()
    .split(/\s+/)
    .map((word) => {
      if (!word) return word;
      if (word.length <= 2 && word === word.toLowerCase()) return word;
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");
}

function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function mapMuscleGroup(item: ExerciseDbApiItem): string {
  const target = (item.targetMuscles?.[0] ?? item.bodyParts?.[0] ?? "").toLowerCase();
  if (MUSCLE_PT[target]) return MUSCLE_PT[target];

  const body = (item.bodyParts?.[0] ?? "").toLowerCase();
  if (body === "chest") return "Peito";
  if (body === "back") return "Costas";
  if (body === "shoulders") return "Ombros";
  if (body === "upper arms") {
    if (target.includes("tricep")) return "Tríceps";
    return "Bíceps";
  }
  if (body === "lower arms") return "Antebraço";
  if (body === "upper legs") {
    if (target.includes("hamstring")) return "Posterior";
    if (target.includes("glute")) return "Glúteos";
    return "Pernas";
  }
  if (body === "lower legs") return "Panturrilha";
  if (body === "waist") return "Core";
  if (body === "cardio") return "Cardio";
  return "Geral";
}

function mapEquipment(item: ExerciseDbApiItem): string | null {
  const raw = (item.equipments?.[0] ?? "").toLowerCase().trim();
  if (!raw) return null;
  return EQUIPMENT_PT[raw] ?? titleCaseName(raw);
}

function mapBodyRegion(item: ExerciseDbApiItem): keyof typeof ExerciseBodyRegion {
  const body = (item.bodyParts?.[0] ?? "").toLowerCase();
  if (BODY_PART_REGION[body]) return BODY_PART_REGION[body];

  const muscle = mapMuscleGroup(item);
  if (muscle === "Cardio") return "CARDIO";
  if (["Pernas", "Posterior", "Glúteos", "Panturrilha"].includes(muscle)) return "INFERIOR";
  if (["Peito", "Costas", "Ombros", "Bíceps", "Tríceps", "Antebraço", "Core"].includes(muscle)) {
    return "SUPERIOR";
  }
  return "GERAL";
}

function mapPhases(bodyRegion: keyof typeof ExerciseBodyRegion): string[] {
  if (bodyRegion === "CARDIO") return ["INICIO", "MEIO", "FIM"];
  if (bodyRegion === "AQUECIMENTO") return ["INICIO"];
  if (bodyRegion === "ALONGAMENTO") return ["FIM"];
  return ["MEIO"];
}

function cleanInstructions(instructions: string[] | undefined): string {
  if (!instructions?.length) {
    return "Execute o movimento com controle, mantendo boa postura e amplitude completa.";
  }

  return instructions
    .map((step) => step.replace(/^Step:\s*\d+\s*/i, "").trim())
    .filter(Boolean)
    .join(" ");
}

export function mapExerciseDbItem(item: ExerciseDbApiItem): ExerciseSeedItem {
  const bodyRegion = mapBodyRegion(item);
  const id = item.exerciseId?.trim() || slugify(item.name);
  return {
    slug: `edb-${slugify(id)}`,
    name: titleCaseName(item.name),
    muscleGroup: mapMuscleGroup(item),
    equipment: mapEquipment(item),
    instructions: cleanInstructions(item.instructions),
    imageUrl: item.gifUrl ?? null,
    gifUrl: item.gifUrl ?? null,
    phases: mapPhases(bodyRegion),
    bodyRegion,
  };
}
