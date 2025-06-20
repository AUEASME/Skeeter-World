/*************************
 * SIMULATION PARAMETERS *
 *************************/

// Immutable parameters.
let duration = 730;
// Initial infection parameters.
let infectedMaleCounts = [0.25];
let infectedFemaleCounts = [0.25];
let killRates = [1.0];
let rescueRates = [1.0];
// New parameters.
let waterRatios = [0.0625, 0.125, 0.25];
let minMaternalTransmissionRates = [0.333, 0.666, 1.0];
let maxMaternalTransmissionRates = [1.0];
let minFitnessModifiers = [0.0, 0.333, 0.666];
let maxFitnessModifiers = [1.333, 1.666, 2.0];
let repeatCount = 1;

// TO IMPLEMENT:
// toxin mutation rate
// antitoxin mutation rate
// toxin/antitoxin length
// female bite rate (maybe static?)
/*
 * Good params for presentation:
 * 2056 in each population.
 * 1/1 rates.
 * 10 years (3652 days).
 */

// Make JSON downloads toggleable (checkbox on main menu).
// There's gotta be something wrong with distance calculation or migration somewhere, as reproduction seems to prefer the upper left corner of the map.
// And why are water cells themselves often empty?
// When allowed to run for decades, we get:
// 1. 60% infection, fixated
// 2. *Lone* water cells seem to often be empty, but the *surrounding* cells, even of contiguous water, are often full of infected mosquitoes.
// 3. Reproduction seems to prefer the upper left corner of the map, stagnating at full capacity, while the rest of the map fluctuates more (notably, at a much lower infection rate).
// 4. Reproductive success TANKS, at just 0.5% after a few months.
// Reproductive success seems to fixate at a much higher value (around 60%) if the infection is mostly eradicated...
// If we increase the prevalence of water to 50%, we get much more clearly defined infected vs. uninfected populations, with the uninfected population dominating the wet cells. Reproductive success also plummets to almost zero.

/********************
 * HELPER FUNCTIONS *
 ********************/

let mockConsole = document.getElementById("mock__console");

function logAndMockConsole(text) {
  // Create a new paragraph element.
  let p = document.createElement("p");
  // Set the text content of the paragraph element to the text passed in.
  p.textContent = `[${new Date().toLocaleTimeString()}] ${text}`;
  // Append the paragraph element to the mock console.
  mockConsole.appendChild(p);
  // If there are more than 24 children in the mock console, remove the first one.
  while (mockConsole.children.length > 24) {
    mockConsole.removeChild(mockConsole.children[0]);
  }
}

/*********************
 * WOLBACHIA CLASSES *
 *********************/

/**
 * ANTITOXIN-FIRST STRATEGY:
 * In an "anti-toxin first" scenario, as this paper proposes, a TA system can evolve when the A gene provides some *environmental* advantage to the host, such as resistance to a toxin produced by a competitor.
 * The T gene is then "recruited" to extend the local advantage of the partner A gene.
 * TOXIN-FIRST STRATEGY:
 * A "toxin-first" route may also be possible, if we assume the toxin is *not* harmful in all contexts. Some compounds may be toxic in some environments, but beneficial in others.
 * "…conditionally expressed proteins that transport nitrogenous compounds when preferred sources of nitrogen are limiting can be both adaptive and either deleterious or lethal depending on the environment.
 * "In a nitrogen-limiting environment in which amino acids may be prevalent, an amino acid transporter is adaptive. However, in the same environment with toxic amino acid analogues, expression of the transporter may be deleterious or lethal.
 * "Similarly, transporters can suppress the effects of mutations in biosynthetic pathways, being adaptive when the essential metabolite cannot be made,
 * "but deleterious when a toxic analogue is also present. In both cases, toxicity is an environment-dependent side-effect of an otherwise adaptive trait."
 */

class Wolbachia {
  constructor(fitnessModifier = 0.0) {
    // Fitness modifier is a value between -1 and 1 that modifies the fitness of the host mosquito.
    // A value of 0 means no change, a value of -1 means the host mosquito is twice as likely to die, and a value of 1 means the host mosquito is twice as likely to survive.
    this.fitnessModifier = fitnessModifier;
  }
}

/**************************************
 * MOSQUITO CLASS, METHODS, AND SETUP *
 **************************************/

class Mosquito {
  constructor(dad, mom) {
    // this.sex can be 0 (female) or 1 (male).
    this.sex = Math.round(Math.random());
    // this.infected is a boolean that indicates whether the mosquito is infected with Wolbachia.
    this.infected = null;

    // Generate a random fitness value from 0 to 1.
    this.fitness = Math.random();

    // Position is set by outside code.
    this.position = { x: 0, y: 0 };

    // If this mosquito is the child of two other mosquitoes, override the random values.
    if (dad && mom) {
      this.fitness = (dad.fitness + mom.fitness) / 2;
      this.position = mom.position;
    }

    /**
     * Mosquito life cycle:
     * 1. Egg stage: approximately 2-3 days.
     * 2. Larval stage: approximately 4-10 days.
     * 3. Pupal stage: approximately 2-3 days.
     * 4. Adult stage: 6-7 days (male), ~6 weeks (female).
     */
    this.age = 0;
    // "but a single female mosquito may produce up to 10 broods throughout her life."
    this.breedingCooldown = 0;

    // Keep track of how many children survived per reproductive event.
    this.successes = 0.0;
  }

  ageUp() {
    this.age++;
    if (this.age > 14 && this.breedingCooldown > 0) {
      this.breedingCooldown--;
    }
    // Male mosquitoes live for about eighteen days, and fourteen of those are spend growing, so for each subsequent day, they have a 1/4 chance of dying.
    // Actually no, see below.
    if (this.sex === 1 && this.age > 14 && Math.random() < 0.25) {
      // Kill self.
      let currentCell = this.position;
      world.map[currentCell.y][currentCell.x] = world.map[currentCell.y][
        currentCell.x
      ].filter((m) => m !== this);
      return;
    }

    // Females, on the other hand, live about 40 days after reaching maturity, so... they have a 1/40 chance of dying each day.
    // Actually no that shouldn't be how that works, it should be a distribution CENTERED around 40.
    if (this.sex === 0 && this.age > 14 && Math.random() < 0.025) {
      // Kill self.
      let currentCell = this.position;
      world.map[currentCell.y][currentCell.x] = world.map[currentCell.y][
        currentCell.x
      ].filter((m) => m !== this);
      return;
    }
  }

  changeSex() {
    if (this.sex === 0) {
      this.sex = 1;
      return;
    }

    this.sex = 0;
  }

  changeInfectionStatus() {
    if (this.infected === null) {
      this.infected = new Wolbachia(
        Math.random() * (maxFitnessModifiers[0] - minFitnessModifiers[0]) +
          minFitnessModifiers[0]
      );
      return;
    }

    this.infected = null;
  }

  migrate() {
    // If breeding cooldown is 0, and we're not in a water cell, migrate in the direction of the nearest water cell.
    if (
      this.breedingCooldown < 1 &&
      world.water_map[this.position.y][this.position.x] === 0
    ) {
      // Find the nearest water cell.
      let nearestWaterCells = [];
      let nearestWaterDistance = Infinity;
      for (let y = 0; y < world.height; y++) {
        for (let x = 0; x < world.width; x++) {
          if (world.water_map[y][x] === 1) {
            let distance =
              Math.abs(this.position.x - x) + Math.abs(this.position.y - y);
            if (distance <= nearestWaterDistance) {
              nearestWaterDistance = distance;
              nearestWaterCells.push({ x, y });
            }
          }
        }
      }

      // Move towards the nearest water cell.
      if (nearestWaterCells.length > 0) {
        let nearestWaterCell =
          nearestWaterCells[
            Math.floor(Math.random() * nearestWaterCells.length)
          ];
        let dx = nearestWaterCell.x - this.position.x;
        let dy = nearestWaterCell.y - this.position.y;
        if (Math.abs(dx) > Math.abs(dy)) {
          if (dx > 0) {
            this.position.x++;
          } else {
            this.position.x--;
          }
        } else {
          if (dy > 0) {
            this.position.y++;
          } else {
            this.position.y--;
          }
        }
      }

      // If we moved, remove ourselves from the old cell and add ourselves to the new cell.
      let currentCell = this.position;
      let newCell = { x: this.position.x, y: this.position.y };
      if (currentCell.x !== newCell.x || currentCell.y !== newCell.y) {
        world.map[currentCell.y][currentCell.x] = world.map[currentCell.y][
          currentCell.x
        ].filter((m) => m !== this);
        world.map[newCell.y][newCell.x].push(this);
      }

      this.position = newCell;
      return;
    }

    // Check if any neighboring cell has fewer mosquitoes. If it does, move there.
    let currentCell = this.position;
    let currentPopulation = world.map[currentCell.y][currentCell.x].length;
    let bestCell = null;
    let bestPopulation = currentPopulation;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        let y = currentCell.y + dy;
        let x = currentCell.x + dx;
        if (y >= 0 && y < world.height && x >= 0 && x < world.width) {
          let population = world.map[y][x].length;
          if (population < bestPopulation) {
            bestCell = { x, y };
          }
        }
      }
    }
    if (bestCell) {
      world.map[currentCell.y][currentCell.x] = world.map[currentCell.y][
        currentCell.x
      ].filter((m) => m !== this);
      world.map[bestCell.y][bestCell.x].push(this);
      this.position = bestCell;
      return;
    }
  }

  reproduce(mate) {
    // Reset breeding cooldown.
    this.breedingCooldown = 4;

    let currentCell = this.position;
    // If both parents are infected, the child has a rescueRate chance of surviving, in which case it inherits one of the parents' infections.
    // If the dad is infected but the mom is not, the child has a killRate chance of immediately dying, otherwise it inherits the dad's infection.
    // If the mom is infected but the dad is not, the child survives, but inherits the mom's infection.
    // If neither parent is infected, the child survives no matter what.
    // Child fitness is the average of the parents' fitness.
    let dad = mate,
      mom = this;
    let numberOfEggs = 100;
    if (dad.infected !== null && mom.infected !== null) {
      numberOfEggs = Math.floor(
        numberOfEggs *
          rescueRates *
          ((dad.infected.fitnessModifier + mom.infected.fitnessModifier) / 2)
      );
    } else if (dad.infected !== null && mom.infected === null) {
      numberOfEggs = Math.floor(
        numberOfEggs * (1 - killRates) * dad.infected.fitnessModifier
      );
    }

    for (let i = 0; i < numberOfEggs; i++) {
      let child = new Mosquito(dad, mom);
      if (mom.infected !== null) {
        child.infected = new Wolbachia(mom.infected.fitnessModifier);
        // Extremely slim chance to mutate the fitness modifier, up to 5% in either direction towards the min or max fitness modifier.
        if (Math.random() < 0.05) {
          // Choose a new value between [mom.infected.fitnessModifier - 0.05, mom.infected.fitnessModifier + 0.05], clamped to the min and max fitness modifiers.
          child.infected.fitnessModifier = Math.max(
            minFitnessModifiers[0],
            Math.min(
              maxFitnessModifiers[maxFitnessModifiers.length - 1],
              mom.infected.fitnessModifier +
                (Math.random() < 0.5 ? -0.05 : 0.05)
            )
          );
        }
      }
      world.map[currentCell.y][currentCell.x].push(child);
      child.position = currentCell;
    }

    this.successes = numberOfEggs;
    mate.successes = numberOfEggs;
    this.fitness = (this.fitness + this.successes) / 2;
    mate.fitness = (mate.fitness + mate.successes) / 2;
  }
}

/***********************************
 * WORLD CLASS, METHODS, AND SETUP *
 ***********************************/

class World {
  constructor(width, height, water_ratio = 0.125) {
    // 1. Generate an empty map of the given width and height.
    this.width = width;
    this.height = height;
    this.map = new Array(height)
      .fill(0)
      .map(() => new Array(width).fill(0).map(() => []));
    // 2. Generate another empty map, this time for water.
    this.water_map = new Array(this.height)
      .fill(0)
      .map(() => new Array(this.width).fill(0));
    this.setWaterCells(water_ratio);
    // 3. Set up history.
    this.traceUninfected = {
      x: [],
      y: [],
      name: "Uninfected",
      type: "scatter",
      mode: "lines",
      marker: { color: "red" },
    };
    this.traceInfected = {
      x: [],
      y: [],
      name: "Infected",
      type: "scatter",
      mode: "lines",
      marker: { color: "blue" },
    };
    this.traceReproduction = {
      x: [],
      y: [],
      name: "Reproductive Success Rate",
      type: "scatter",
      mode: "lines",
      marker: { color: "RebeccaPurple" },
    };
  }

  setWaterCells(waterRatio) {
    // Set the water cells to the given ratio.
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        if (Math.random() < waterRatio) {
          this.water_map[y][x] = 1;
        } else {
          this.water_map[y][x] = 0;
        }
      }
    }
  }

  populate() {
    // Add mosquitoes to each cell of the map.
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        for (let i = 0; i < carryingCapacity; i++) {
          let mosquito = new Mosquito();
          mosquito.age = Math.floor(Math.random() * 14);
          mosquito.breedingCooldown = Math.floor(Math.random() * 4);
          this.map[y][x].push(mosquito);
          allMosquitoes.push(mosquito);
        }
      }
    }
  }
}

function renderWorld() {
  // Get the canvas element.
  let canvas = document.getElementById("world");
  let context = canvas.getContext("2d");
  let cellSize = 12;
  canvas.width = world.width * cellSize;
  canvas.height = world.height * cellSize;
  // Canvas should be white by default.
  // For each uninfected mosquito in each cell, add 1 to the red channel.
  // For each infected mosquito in each cell, add 1 to the blue channel.
  for (let y = 0; y < world.height; y++) {
    for (let x = 0; x < world.width; x++) {
      let cell = world.map[y][x];
      let red = 255;
      let green = 255;
      let blue = 255;
      for (let mosquito of cell) {
        if (mosquito.infected !== null) {
          green -= 255 / carryingCapacity;
          blue -= 255 / carryingCapacity;
        } else {
          green -= 255 / carryingCapacity;
          red -= 255 / carryingCapacity;
        }
      }
      context.fillStyle = `rgb(${red}, ${green}, ${blue})`;
      context.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
      // Add a black border around each cell.
      context.strokeStyle = "rgba(0, 0, 0, 0.125)";
      context.strokeRect(x * cellSize, y * cellSize, cellSize, cellSize);
    }
  }
}

/************************
 * SIMULATION FUNCTIONS *
 ************************/

function mosquitoDay(population) {
  // Make a 2D grid for all the males in the map.
  let males = new Array(world.height)
    .fill(0)
    .map(() => new Array(world.width).fill(0).map(() => []));

  // Assign each male to their cell.
  for (let mosquito of population) {
    if (mosquito.sex === 1) {
      let currentCell = mosquito.position;
      males[currentCell.y][currentCell.x].push(mosquito);
    }
  }

  for (let mosquito of population) {
    // Migrate and reproduce.
    mosquito.migrate();
    let currentCell = mosquito.position;

    // If mosquito is female, reproduce.
    if (
      mosquito.sex === 0 &&
      mosquito.breedingCooldown < 1 &&
      mosquito.age > 14 &&
      world.water_map[currentCell.y][currentCell.x] === 1
    ) {
      let eligibleMales = males[currentCell.y][currentCell.x].filter(
        (m) => m.age > 14
      );
      if (eligibleMales.length > 0) {
        // Get a random mate.
        let mate = kTournamentWithReplacement(eligibleMales, 3);
        mosquito.reproduce(mate);
      }
    }

    // Age mosquito.
    mosquito.ageUp();
  }
}

function kTournamentWithReplacement(eligibleMales, k = 3) {
  // Select k males at random.
  let selected = [];
  for (let i = 0; i < k; i++) {
    let randomIndex = Math.floor(Math.random() * eligibleMales.length);
    selected.push(eligibleMales[randomIndex]);
  }

  // Sort the males by fitness (highest first).
  selected.sort((a, b) => b.fitness - a.fitness);

  // Return the most fit male.
  return selected[0];
}

/********************
 * GLOBAL VARIABLES *
 ********************/

// Create world.
let world = new World(16, 16, 0.125);
let carryingCapacity = 96;

// Populate world.
let allMosquitoes = [];

// Set up logging.
let generation = 0;

function updatePlots(generation) {
  // Update infection plot.
  let uninfectedCount = allMosquitoes.filter((m) => m.infected === null).length;
  let infectedCount = allMosquitoes.filter((m) => m.infected !== null).length;

  world.traceUninfected.x.push(generation);
  world.traceUninfected.y.push(uninfectedCount);
  world.traceInfected.x.push(generation);
  world.traceInfected.y.push(infectedCount);

  let layout = {
    title: "Mosquito Infection Status",
    xaxis: { title: "Day" },
    yaxis: { title: "Mosquito Count" },
    barmode: "stack",
  };

  Plotly.newPlot("plot", [world.traceUninfected, world.traceInfected], layout);

  world.traceReproduction.x.push(generation);
  world.traceReproduction.y.push(
    // Get the average reproductive success odds of all mosquitoes.
    allMosquitoes.reduce((acc, m) => acc + m.successes, 0) /
      allMosquitoes.length
  );

  let layout2 = {
    title: "Reproductive Success Rate Over Time",
    xaxis: { title: "Day" },
    yaxis: { title: "Average Reproductive Success Rate" },
  };

  Plotly.newPlot(
    "reproductive_success_plot",
    [world.traceReproduction],
    layout2
  );
}

function updateWorld() {
  logAndMockConsole(`Day ${generation + 1}.`);

  // Mosquitoes do their thing.
  mosquitoDay(allMosquitoes);

  // Population control: kill of mosquitoes to meet carrying capacity.
  allMosquitoes = [];
  for (let y = 0; y < world.height; y++) {
    for (let x = 0; x < world.width; x++) {
      // Sort mosquitoes by fitness.
      world.map[y][x].sort((a, b) => a.fitness - b.fitness);
      // Keep the top carryingCapacity mosquitoes.
      world.map[y][x] = world.map[y][x].slice(0, carryingCapacity);
      // Add them to the global list.
      allMosquitoes = allMosquitoes.concat(world.map[y][x]);
    }
  }

  renderWorld();

  // Update the plots.
  updatePlots(generation + 1);
  generation += 1;
}

function shouldStopSimulation() {
  // Check if infection has been eradicated.
  let infectedMosquitoes = allMosquitoes.filter((m) => m.infected !== null);
  if (infectedMosquitoes.length === 0) {
    logAndMockConsole("Infection has been eradicated.");
    return true;
  }

  // Check if all mosquitoes are infected.
  if (infectedMosquitoes.length === allMosquitoes.length) {
    logAndMockConsole("All mosquitoes are infected.");
    return true;
  }
}

function resetWorld(waterRatio = 0.125) {
  // Reset all global variables.
  world = new World(16, 16, waterRatio);
  carryingCapacity = 96;
  allMosquitoes = [];
  generation = 0;
}

function rearrangePage() {
  // Delete form.
  let form = document.getElementById("start__params");
  form.remove();

  // Show mock console.
  mockConsole.style.display = "flex";
  // Show plot.
  let plot = document.getElementById("plot");
  plot.style.display = "block";
  let toxinPlot = document.getElementById("reproductive_success_plot");
  toxinPlot.style.display = "block";
  // Show world.
  let worldCanvas = document.getElementById("world");
  worldCanvas.style.display = "block";
  // Show water map.
  let waterCanvas = document.getElementById("water");
  waterCanvas.style.display = "block";
  // Fill water map.
  let waterContext = waterCanvas.getContext("2d");
  waterCanvas.width = world.width * 12;
  waterCanvas.height = world.height * 12;
  for (let y = 0; y < world.height; y++) {
    for (let x = 0; x < world.width; x++) {
      let cell = world.water_map[y][x];
      let color = cell === 1 ? "CornflowerBlue" : "ForestGreen";
      waterContext.fillStyle = color;
      waterContext.fillRect(x * 12, y * 12, 12, 12);
      // Add a black border around each cell.
      waterContext.strokeStyle = "rgba(0, 0, 0, 0.125)";
      waterContext.strokeRect(x * 12, y * 12, 12, 12);
    }
  }
  // Show keys.
  let key = document.getElementsByClassName("key");
  for (let i = 0; i < key.length; i++) {
    key[i].style.display = "flex";
  }
}

function getInputValues(event) {
  // Prevent default form submission.
  event.preventDefault();

  // Get initial infection parameters and split on commas.
  let infectedMaleCountInDocument = document
    .getElementById("infected__males")
    .value.split(",");
  if (
    infectedMaleCountInDocument.length > 0 &&
    infectedMaleCountInDocument[0] !== ""
  ) {
    infectedMaleCounts = infectedMaleCountInDocument;
    // Convert to float.
    infectedMaleCounts = infectedMaleCounts.map((c) => parseFloat(c));
  }
  for (let i = 0; i < infectedMaleCounts.length; i++) {
    if (infectedMaleCounts[i] < 0 || infectedMaleCounts[i] > 1) {
      alert(
        "Infected male count cannot be less than zero or greater than one."
      );
      return;
    }
  }

  let infectedFemaleCountInDocument = document
    .getElementById("infected__females")
    .value.split(",");
  if (
    infectedFemaleCountInDocument.length > 0 &&
    infectedFemaleCountInDocument[0] !== ""
  ) {
    infectedFemaleCounts = infectedFemaleCountInDocument;
    // Convert to float.
    infectedFemaleCounts = infectedFemaleCounts.map((c) => parseFloat(c));
  }
  for (let i = 0; i < infectedFemaleCounts.length; i++) {
    if (infectedFemaleCounts[i] < 0 || infectedFemaleCounts[i] > 1) {
      alert(
        "Infected male count cannot be less than zero or greater than one."
      );
      return;
    }
  }

  let killRateInDocument = document
    .getElementById("kill__rate")
    .value.split(",");
  if (killRateInDocument.length > 0 && killRateInDocument[0] !== "") {
    killRates = killRateInDocument;
    // Convert to float.
    killRates = killRates.map((r) => parseFloat(r));
  }
  for (let i = 0; i < killRates.length; i++) {
    if (killRates[i] < 0 || killRates[i] > 1) {
      alert("Kill rate must be between 0 and 1.");
      return;
    }
  }

  let rescueRateInDocument = document
    .getElementById("rescue__rate")
    .value.split(",");
  if (rescueRateInDocument.length > 0 && rescueRateInDocument[0] !== "") {
    rescueRates = rescueRateInDocument;
    // Convert to float.
    rescueRates = rescueRates.map((r) => parseFloat(r));
  }
  for (let i = 0; i < rescueRates.length; i++) {
    if (rescueRates[i] < 0 || rescueRates[i] > 1) {
      alert("Rescue rate must be between 0 and 1.");
      return;
    }
  }

  repeatCount = document.getElementById("repeats").value || 1;
  if (repeatCount < 1) {
    alert("Repeat count must be at least 1.");
    return;
  } else if (repeatCount > 100) {
    alert("Repeat count must be less than 100.");
    return;
  }
}

async function startExperiment(event) {
  getInputValues(event);
  rearrangePage();

  // Create an experiment object for each combination of parameters.
  let experiments = [];
  for (let r = 0; r < repeatCount; r++) {
    for (let infectedMaleCount of infectedMaleCounts) {
      for (let infectedFemaleCount of infectedFemaleCounts) {
        for (let killRate of killRates) {
          for (let rescueRate of rescueRates) {
            for (let waterRatio of waterRatios) {
              for (let minMaternalTransRate of minMaternalTransmissionRates) {
                for (let maxMaternalTransRate of maxMaternalTransmissionRates) {
                  for (let minFitnessModifier of minFitnessModifiers) {
                    for (let maxFitnessModifier of maxFitnessModifiers) {
                      let experiment = new Experiment();
                      experiment.infectedMalesAtStart = infectedMaleCount;
                      experiment.infectedFemalesAtStart = infectedFemaleCount;
                      experiment.killRate = killRate;
                      experiment.rescueRate = rescueRate;
                      experiment.waterRatio = waterRatio;
                      experiment.minMaternalTransmissionRate =
                        minMaternalTransRate;
                      experiment.maxMaternalTransmissionRate =
                        maxMaternalTransRate;
                      experiment.minFitnessModifier = minFitnessModifier;
                      experiment.maxFitnessModifier = maxFitnessModifier;
                      experiments.push(experiment);
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }

  // Run each experiment.
  for (let experiment of experiments) {
    // Set up the world.
    world.setWaterCells(experiment.waterRatio);
    world.populate();

    let allMosquitoes = [];
    for (let y = 0; y < world.height; y++) {
      for (let x = 0; x < world.width; x++) {
        allMosquitoes = allMosquitoes.concat(world.map[y][x]);
      }
    }
    // Infect the specified number of males and females.
    let allMales = allMosquitoes.filter(
      (m) => m.sex === 1 && m.infected !== null
    );
    let allFemales = allMosquitoes.filter(
      (m) => m.sex === 0 && m.infected !== null
    );
    allMales.forEach((male) => {
      if (Math.random() < experiment.infectedMalesAtStart) {
        male.changeInfectionStatus();
      }
    });
    allFemales.forEach((female) => {
      if (Math.random() < experiment.infectedFemalesAtStart) {
        female.changeInfectionStatus();
      }
    });

    killRates = experiment.killRate;
    rescueRates = experiment.rescueRate;
    minMaternalTransmissionRates = experiment.minMaternalTransmissionRate;
    maxMaternalTransmissionRates = experiment.maxMaternalTransmissionRate;
    minFitnessModifiers = experiment.minFitnessModifier;
    maxFitnessModifiers = experiment.maxFitnessModifier;
    renderWorld();

    // Run the simulation.
    while (!shouldStopSimulation() && generation < duration) {
      // Update the experiment data.
      experiment.infectionRatio.push(
        allMosquitoes.filter((m) => m.infected !== null).length /
          allMosquitoes.length
      );
      experiment.reproductiveSuccessOverTime.push(
        // Get the average reproductive success of all mosquitoes.
        allMosquitoes.reduce((acc, m) => acc + m.successes, 0) /
          allMosquitoes.length
      );
      experiment.averageFitnessModificationOverTime.push(
        // Get the average fitness modification of all mosquitoes.
        allMosquitoes.reduce(
          (acc, m) => acc + m.infected?.fitnessModifier || 0,
          0
        ) / allMosquitoes.length
      );
      // Update the world.
      updateWorld();
      // Sleep for a fifth of a second.
      // This allows the browser time to handle user requests, such as scrolling, which get laggy if the simulation never takes a break.
      await new Promise((r) => setTimeout(r, 200));
    }

    // Once the simulation is complete, output the data.
    experiment.outputData();

    // Reset the world.
    resetWorld();
  }
}

class Experiment {
  constructor() {
    // Start data.
    this.startTime = new Date();
    this.infectedMalesAtStart = 0.25;
    this.infectedFemalesAtStart = 0.25;
    this.killRate = 1;
    this.rescueRate = 1;
    // New data.
    this.waterRatio = 0.125;
    this.minMaternalTransmissionRate = 0.5;
    this.maxMaternalTransmissionRate = 0.75;
    this.minFitnessModifier = -1.0;
    this.maxFitnessModifier = 1.0;
    // Run data.
    this.infectionRatio = [];
    this.reproductiveSuccessOverTime = [];
    this.averageFitnessModificationOverTime = [];
  }

  outputData() {
    let allData = {
      // Start data.
      startTime: this.startTime,
      infectedMalesAtStart: this.infectedMalesAtStart,
      infectedFemalesAtStart: this.infectedFemalesAtStart,
      killRate: this.killRate,
      rescueRate: this.rescueRate,
      // New data.
      waterRatio: this.waterRatio,
      minMaternalTransmissionRate: this.minMaternalTransmissionRate,
      maxMaternalTransmissionRate: this.maxMaternalTransmissionRate,
      minFitnessModifier: this.minFitnessModifier,
      maxFitnessModifier: this.maxFitnessModifier,
      // Run data.
      simulationLength: generation,
      infectionRatio: this.infectionRatio,
      reproductiveSuccessOverTime: this.reproductiveSuccessOverTime,
      averageFitnessModificationOverTime:
        this.averageFitnessModificationOverTime,
    };

    // Download the data for the user as a JSON file.
    let data =
      "text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(allData));
    let a = document.createElement("a");
    a.href = "data:" + data;
    let currentTime = new Date().toISOString();
    a.download = `experiment_${currentTime}.json`;
    a.innerHTML = "Download JSON";
    a.click();
    // Remove the anchor element.
    a.remove();
  }
}
