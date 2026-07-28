/**
 * Tradução EN → PT-BR para nomes e instruções de exercícios (musculação).
 */

function collapseSpaces(value: string): string {
  return value.replace(/\s+/g, " ").replace(/\s+,/g, ",").trim();
}

function titleCasePt(value: string): string {
  const small = new Set(["de", "da", "do", "das", "dos", "e", "com", "no", "na", "em", "para", "a", "o", "ao", "à", "no", "na"]);
  return value
    .split(" ")
    .filter(Boolean)
    .map((word, index) => {
      const lower = word.toLowerCase();
      if (index > 0 && small.has(lower)) return lower;
      if (/^\d/.test(word)) return word;
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(" ");
}

/** Frases compostas (ordem: mais específicas primeiro). */
const NAME_PHRASES: Array<[RegExp, string]> = [
  [/assisted hanging knee raise/gi, "elevação de joelhos na barra (assistida)"],
  [/upward facing dog/gi, "cachorro olhando para cima"],
  [/downward facing dog/gi, "cachorro olhando para baixo"],
  [/cable cross[- ]?over variation/gi, "cruzamento de cabos (variação)"],
  [/cable cross[- ]?over/gi, "cruzamento de cabos"],
  [/barbell bench press/gi, "supino reto com barra"],
  [/incline barbell bench press/gi, "supino inclinado com barra"],
  [/decline barbell bench press/gi, "supino declinado com barra"],
  [/dumbbell bench press/gi, "supino reto com halteres"],
  [/incline dumbbell (bench )?press/gi, "supino inclinado com halteres"],
  [/decline dumbbell (bench )?press/gi, "supino declinado com halteres"],
  [/close[- ]grip (barbell )?bench press/gi, "supino pegada fechada"],
  [/dumbbell flye?s?/gi, "crucifixo com halteres"],
  [/incline dumbbell flye?s?/gi, "crucifixo inclinado com halteres"],
  [/push[- ]?up inside leg kick/gi, "flexão com chute lateral"],
  [/push[- ]?ups?/gi, "flexão de braço"],
  [/pull[- ]?ups?/gi, "barra fixa"],
  [/chin[- ]?ups?/gi, "barra fixa supinada"],
  [/lat(eral)? pulldown/gi, "puxada alta"],
  [/seated cable row/gi, "remada sentada no cabo"],
  [/bent[- ]over (barbell )?row/gi, "remada curvada"],
  [/one[- ]arm dumbbell row/gi, "remada unilateral com halter"],
  [/dumbbell row/gi, "remada com halter"],
  [/barbell row/gi, "remada com barra"],
  [/t[- ]?bar row/gi, "remada cavalinho"],
  [/romanian deadlift/gi, "levantamento terra romeno"],
  [/sumo deadlift/gi, "levantamento terra sumô"],
  [/deadlift/gi, "levantamento terra"],
  [/front squat/gi, "agachamento frontal"],
  [/goblet squat/gi, "agachamento goblet"],
  [/back squat/gi, "agachamento livre"],
  [/bulgarian split squat/gi, "afundo búlgaro"],
  [/split squat/gi, "afundo estático"],
  [/leg press/gi, "leg press"],
  [/leg extension/gi, "cadeira extensora"],
  [/lying leg curl/gi, "mesa flexora"],
  [/seated leg curl/gi, "cadeira flexora"],
  [/leg curl/gi, "flexora"],
  [/standing calf raise/gi, "elevação de panturrilha em pé"],
  [/seated calf raise/gi, "elevação de panturrilha sentado"],
  [/calf raise/gi, "elevação de panturrilha"],
  [/military press/gi, "desenvolvimento militar"],
  [/shoulder press/gi, "desenvolvimento"],
  [/arnold press/gi, "desenvolvimento arnold"],
  [/lateral raise/gi, "elevação lateral"],
  [/front raise/gi, "elevação frontal"],
  [/rear delt (flye?|raise)/gi, "elevação posterior de ombro"],
  [/face pull/gi, "face pull"],
  [/barbell curl/gi, "rosca direta com barra"],
  [/dumbbell curl/gi, "rosca direta com halteres"],
  [/hammer curl/gi, "rosca martelo"],
  [/preacher curl/gi, "rosca scott"],
  [/concentration curl/gi, "rosca concentrada"],
  [/reverse curl/gi, "rosca inversa"],
  [/triceps pushdown/gi, "tríceps pulley"],
  [/overhead (triceps )?extension/gi, "tríceps francês"],
  [/skull crusher/gi, "tríceps testa"],
  [/bench dip/gi, "tríceps banco"],
  [/triceps dip/gi, "paralelas (tríceps)"],
  [/hip thrust/gi, "elevação de quadril"],
  [/glute bridge/gi, "ponte de glúteo"],
  [/walking lunge/gi, "afundo caminhando"],
  [/reverse lunge/gi, "afundo reverso"],
  [/lunges?/gi, "afundo"],
  [/russian twist/gi, "rotação russa"],
  [/hanging leg raise/gi, "elevação de pernas na barra"],
  [/hanging knee raise/gi, "elevação de joelhos na barra"],
  [/mountain climber/gi, "escalador"],
  [/jumping jack/gi, "polichinelo"],
  [/jump rope/gi, "pular corda"],
  [/battle ropes?/gi, "corda naval"],
  [/farmers? (walk|carry)/gi, "caminhada do fazendeiro"],
  [/plank/gi, "prancha"],
  [/crunch/gi, "abdominal crunch"],
  [/sit[- ]?ups?/gi, "abdominal"],
  [/burpee/gi, "burpee"],
  [/impossible dips?/gi, "paralelas avançadas"],
  [/dips?/gi, "paralelas"],
  [/shrug/gi, "encolhimento de ombros"],
  [/good morning/gi, "bom dia"],
  [/hyperextension/gi, "hiperextensão"],
  [/back extension/gi, "extensão lombar"],
  [/chest press/gi, "supino na máquina"],
  [/pec deck/gi, "pec deck"],
  [/butterfly/gi, "crucifixo máquina"],
  [/hack squat/gi, "agachamento hack"],
  [/bear crawl/gi, "caminhada do urso"],
  [/isometric wipers/gi, "limpadores isométricos"],
  [/smith /gi, "smith "],
];

const NAME_WORDS: Array<[RegExp, string]> = [
  [/\bbarbell\b/gi, "barra"],
  [/\bdumbbells?\b/gi, "halteres"],
  [/\bkettlebells?\b/gi, "kettlebell"],
  [/\bcable\b/gi, "cabo"],
  [/\bresistance band\b/gi, "elástico"],
  [/\bbands?\b/gi, "elástico"],
  [/\bmachine\b/gi, "máquina"],
  [/\blever(age)?\b/gi, "alavanca"],
  [/\bsmith\b/gi, "smith"],
  [/\bsled\b/gi, "sled"],
  [/\bweighted\b/gi, "com peso"],
  [/\bassisted\b/gi, "assistido"],
  [/\bbody ?weight\b/gi, "peso corporal"],
  [/\bseated\b/gi, "sentado"],
  [/\bstanding\b/gi, "em pé"],
  [/\blying\b/gi, "deitado"],
  [/\bprone\b/gi, "de bruços"],
  [/\bsupine\b/gi, "supino"],
  [/\bincline\b/gi, "inclinado"],
  [/\bdecline\b/gi, "declinado"],
  [/\bflat\b/gi, "reto"],
  [/\boverhead\b/gi, "acima da cabeça"],
  [/\bone[- ]arm\b/gi, "unilateral"],
  [/\bsingle[- ]arm\b/gi, "unilateral"],
  [/\bone[- ]leg\b/gi, "unilateral"],
  [/\bsingle[- ]leg\b/gi, "unilateral"],
  [/\balternating\b/gi, "alternado"],
  [/\breverse\b/gi, "invertido"],
  [/\binverse\b/gi, "invertida"],
  [/\binverted\b/gi, "invertida"],
  [/\bclose[- ]grip\b/gi, "pegada fechada"],
  [/\bwide[- ]grip\b/gi, "pegada aberta"],
  [/\bnarrow grip\b/gi, "pegada fechada"],
  [/\bneutral grip\b/gi, "pegada neutra"],
  [/\bunderhand\b/gi, "supinada"],
  [/\boverhand\b/gi, "pronada"],
  [/\bpulldown\b/gi, "puxada"],
  [/\bpushdown\b/gi, "extensão no pulley"],
  [/\bpress\b/gi, "press"],
  [/\brow\b/gi, "remada"],
  [/\bcurl\b/gi, "rosca"],
  [/\bextension\b/gi, "extensão"],
  [/\bflye?s?\b/gi, "crucifixo"],
  [/\braise\b/gi, "elevação"],
  [/\bsquat\b/gi, "agachamento"],
  [/\bdeadlift\b/gi, "levantamento terra"],
  [/\blunge\b/gi, "afundo"],
  [/\bstretch\b/gi, "alongamento"],
  [/\bmobility\b/gi, "mobilidade"],
  [/\bhanging\b/gi, "suspenso"],
  [/\bknee\b/gi, "joelho"],
  [/\bleg\b/gi, "perna"],
  [/\barm\b/gi, "braço"],
  [/\bhip\b/gi, "quadril"],
  [/\bchest\b/gi, "peito"],
  [/\bback\b/gi, "costas"],
  [/\bshoulder\b/gi, "ombro"],
  [/\bcalf\b/gi, "panturrilha"],
  [/\bfloor\b/gi, "no chão"],
  [/\brunners?\b/gi, "do corredor"],
  [/\bgentle style\b/gi, ""],
  [/\bextended style\b/gi, ""],
  [/\bvariation\b/gi, "variação"],
  [/\bclassic\b/gi, "clássico"],
  [/\bpro lat bar\b/gi, "barra dorsal"],
  [/\babduction\b/gi, "abdução"],
  [/\badduction\b/gi, "adução"],
  [/\bsissy\b/gi, "sissy"],
  [/\bupright\b/gi, "alta"],
  [/\bbowling motion\b/gi, ""],
  [/\bbiceps?\b/gi, "bíceps"],
  [/\bstability\b/gi, "estabilidade"],
  [/\bbent knee\b/gi, "joelho flexionado"],
  [/\bbent\b/gi, "curvado"],
  [/\bjump\b/gi, "com salto"],
  [/\broller\b/gi, "rolo"],
  [/\blat\b/gi, "dorsal"],
  [/\bmale\b/gi, ""],
  [/\bfemale\b/gi, ""],
  [/\bisometric\b/gi, "isométrico"],
  [/\bwipers?\b/gi, "limpadores"],
  [/\bwith\b/gi, "com"],
  [/\band\b/gi, "e"],
  [/\bon\b/gi, "no"],
  [/\bof\b/gi, "de"],
  [/\bthe\b/gi, ""],
  [/\ba\b/gi, ""],
  [/\ban\b/gi, ""],
];

const INSTRUCTION_PHRASES: Array<[RegExp, string]> = [
  [/Step:\s*\d+\s*/gi, ""],
  [/Lie (flat )?on (a |the )?bench/gi, "Deite-se em um banco"],
  [/Lie face down/gi, "Deite-se de bruços"],
  [/Lie on your back/gi, "Deite-se de costas"],
  [/Sit on (a |the )?bench/gi, "Sente-se em um banco"],
  [/Stand (up )?straight/gi, "Fique em pé ereto"],
  [/Stand with your feet shoulder-width apart/gi, "Fique em pé com os pés na largura dos ombros"],
  [/Stand with your feet/gi, "Fique em pé com os pés"],
  [/Keep your back straight/gi, "Mantenha as costas retas"],
  [/Keep your core engaged/gi, "Mantenha o core ativado"],
  [/Engage your core/gi, "Ative o core"],
  [/Bend your knees/gi, "Flexione os joelhos"],
  [/Bend your elbows/gi, "Flexione os cotovelos"],
  [/Straighten your arms/gi, "Estenda os braços"],
  [/Fully extend(ing)? your arms/gi, "Estenda completamente os braços"],
  [/Lower the (barbell|weight|dumbbells?)/gi, "Abaixe a carga"],
  [/Raise the (barbell|weight|dumbbells?)/gi, "Eleve a carga"],
  [/Push the (barbell|weight) (back )?up/gi, "Empurre a carga para cima"],
  [/Press the (barbell|weight|dumbbells?) (overhead|up)/gi, "Pressione a carga para cima"],
  [/Pause for a moment/gi, "Faça uma pausa breve"],
  [/Hold (this|the) (position|contracted position) for a (brief pause|few seconds|few breaths)/gi, "Segure a posição por alguns segundos"],
  [/Repeat for the desired number of repetitions\.?/gi, "Repita pelo número desejado de repetições."],
  [/Return to the starting position/gi, "Retorne à posição inicial"],
  [/Slowly lower/gi, "Abaixe lentamente"],
  [/Slowly return/gi, "Retorne lentamente"],
  [/Exhale/gi, "Expire"],
  [/Inhale/gi, "Inspire"],
  [/shoulder-width apart/gi, "na largura dos ombros"],
  [/hip-width apart/gi, "na largura do quadril"],
  [/feet flat on the (ground|floor)/gi, "pés firmes no chão"],
  [/to the starting position/gi, "até a posição inicial"],
  [/starting position/gi, "posição inicial"],
  [/desired number of repetitions/gi, "número desejado de repetições"],
];

export function translateExerciseName(name: string): string {
  let result = name.trim();
  if (!result) return result;

  for (const [pattern, replacement] of NAME_PHRASES) {
    result = result.replace(pattern, replacement);
  }
  for (const [pattern, replacement] of NAME_WORDS) {
    result = result.replace(pattern, replacement);
  }

  result = collapseSpaces(result)
    .replace(/\s+\/\s+/g, " / ")
    .replace(/\(\s+/g, "(")
    .replace(/\s+\)/g, ")")
    .replace(/\s{2,}/g, " ");

  return titleCasePt(result);
}

export function translateExerciseInstructions(instructions: string): string {
  let result = instructions.trim();
  if (!result) {
    return "Execute o movimento com controle, boa postura e amplitude completa.";
  }

  for (const [pattern, replacement] of INSTRUCTION_PHRASES) {
    result = result.replace(pattern, replacement);
  }

  const extras: Array<[RegExp, string]> = [
    [/\bbench\b/gi, "banco"],
    [/\bbarbell\b/gi, "barra"],
    [/\bdumbbells?\b/gi, "halteres"],
    [/\bcable\b/gi, "cabo"],
    [/\bmachine\b/gi, "máquina"],
    [/\bhandles?\b/gi, "pegadas"],
    [/\belbows?\b/gi, "cotovelos"],
    [/\bknees?\b/gi, "joelhos"],
    [/\bshoulders?\b/gi, "ombros"],
    [/\bhips?\b/gi, "quadril"],
    [/\bchest\b/gi, "peito"],
    [/\bback\b/gi, "costas"],
    [/\bcore\b/gi, "core"],
    [/\bglutes?\b/gi, "glúteos"],
    [/\brepetitions?\b/gi, "repetições"],
    [/\byour\b/gi, ""],
    [/\bthe\b/gi, ""],
    [/\band\b/gi, "e"],
    [/\bwith\b/gi, "com"],
    [/\bfrom\b/gi, "de"],
    [/\binto\b/gi, "em"],
    [/\buntil\b/gi, "até"],
    [/\bthen\b/gi, "então"],
    [/\bwhile\b/gi, "enquanto"],
    [/\bkeeping\b/gi, "mantendo"],
  ];

  for (const [pattern, replacement] of extras) {
    result = result.replace(pattern, replacement);
  }

  result = collapseSpaces(result);
  // Se ainda ficou muito em inglês, usa instrução padrão clara.
  if (/\b(lie|stand|sit|hold|lower|raise|push|pull|repeat)\b/i.test(result)) {
    return "Execute o movimento conforme a demonstração do GIF, com controle, boa postura e amplitude completa.";
  }
  if (!/[.!?]$/.test(result)) result = `${result}.`;
  return result.charAt(0).toUpperCase() + result.slice(1);
}

export function translateExerciseSeed<T extends { name: string; instructions: string }>(item: T): T {
  return {
    ...item,
    name: translateExerciseName(item.name),
    instructions: translateExerciseInstructions(item.instructions),
  };
}
