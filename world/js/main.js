/*************************
 * SIMULATION PARAMETERS *
 *************************/

// Immutable parameters.
let duration = 730;
// World initialization parameters.
let infectedMaleCounts = [0.25];
let infectedFemaleCounts = [0.25];
let waterRatios = [0.0625, 0.125, 0.25];
let currentWaterRatio = null;
// Infection parameters.
let killRates = [1.0];
let currentKillRate = null;
let rescueRates = [1.0];
let currentRescueRate = null;
let minFitnessModifiers = [-1.0];
let maxFitnessModifiers = [1.0];
let currentFitnessModifierRange = null;
let minInfectionDensities = [0.0];
let maxInfectionDensities = [1.0];
let currentInfectionDensityRange = null;
let repeatCount = 1;

// Maternal transmission rates *and* fitness modifiers are an emergent property of endosymbiont densitites in host tissues.
// Density may be a factor that EXACERBATES positive OR negative fitness effects.
// Spectrum between:
//   parasitism                    <-->                    mutualism
//   fitness decrease              <-->             fitness increase
//   wol. fitness increase         <-->        wol. fitness decrease
//   high rep. manipulation        <-->        low rep. manipulation
//   short evolutionary time scale <--> long evolutionary time scale
// Fitness modifiers:
//   reproductive output (negative)
//   nutrition for host (longevity-boosting)
// Maybe a female should have to bite a human over land, THEN move to water to lay the eggs.

// Make JSON downloads toggleable (checkbox on main menu).
// Add simulation speed tracking -- why do simulations with less infected mosquitoes seem to run slower?

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
  constructor() {
    // Wolbachia are defined by a scalar value, currentFitnessModifierRange[0] (probably -1.0) to currentFitnessModifierRange[1] (probably 1.0).
    // this.parasitismMutualismFactor = Math.random() * 2 - 1; // Random value between -1.0 and 1.0.
    this.parasitismMutualismFactor =
      Math.random() *
        (currentFitnessModifierRange[1] - currentFitnessModifierRange[0]) +
      currentFitnessModifierRange[0];
    console.log("PM stats:");
    console.log(this.parasitismMutualismFactor);
    // Infection density primarily controls the maternal transmission rate of the infection.
    // This is a value between 0.0 and 1.0, first calculated as a random value between minInfectionDensity and maxInfectionDensity.
    this.infectionDensity =
      Math.random() *
        (currentInfectionDensityRange[1] - currentInfectionDensityRange[0]) +
      currentInfectionDensityRange[0];
    // If parasite, increase density.
    if (this.parasitismMutualismFactor < 0) {
      this.infectionDensity = Math.min(
        1.0,
        this.infectionDensity + Math.abs(this.parasitismMutualismFactor) * 0.5
      );
    }
    console.log(this.infectionDensity);
    console.log(this.parasitismMutualismFactor * this.infectionDensity);
    // Set killRate and rescueRate to the current values.
    this.killRate = currentKillRate || killRates[0];
    this.rescueRate = currentRescueRate || rescueRates[0];
  }

  clone() {
    // Create a new Wolbachia with the same parasitismMutualismFactor.
    let clone = new Wolbachia();
    clone.parasitismMutualismFactor = this.parasitismMutualismFactor;

    // 1/20 chance to mutate the parasitismMutualismFactor.
    if (Math.random() < 0.05) {
      clone.parasitismMutualismFactor +=
        (Math.random() < 0.5 ? -1 : 1) * Math.random() * 0.05;
      // Clamp the value to the range [-1.0, 1.0].
      clone.parasitismMutualismFactor = Math.max(
        -1.0,
        Math.min(1.0, clone.parasitismMutualismFactor)
      );
    }

    // 1/20 chance to mutate the infection density by up to 0.05 in either direction.
    if (Math.random() < 0.05) {
      clone.infectionDensity +=
        (Math.random() < 0.5 ? -1 : 1) * Math.random() * 0.05;
      // Clamp the value to the range [0.0, 1.0].
      clone.infectionDensity = Math.max(
        0.0,
        Math.min(1.0, clone.infectionDensity)
      );
    }

    // 1/20 chance to mutate the killRate by up to 0.05 in either direction.
    if (Math.random() < 0.05) {
      clone.killRate += (Math.random() < 0.5 ? -1 : 1) * Math.random() * 0.05;
      // Clamp the value to the range [0.0, 1.0].
      clone.killRate = Math.max(0.0, Math.min(1.0, clone.killRate));
    }

    // 1/20 chance to mutate the rescueRate by up to 0.05 in either direction.
    if (Math.random() < 0.05) {
      clone.rescueRate += (Math.random() < 0.5 ? -1 : 1) * Math.random() * 0.05;
      // Clamp the value to the range [0.0, 1.0].
      clone.rescueRate = Math.max(0.0, Math.min(1.0, clone.rescueRate));
    }

    return clone;
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
    // If the mother is infected, the child has a chance to inherit the infection.
    if (mom && mom.infected !== null) {
      // Get the infection density of the mother to determine the chance of inheriting the infection.
      let infectionDensity = mom.infected.infectionDensity;
      // Chance of inheriting the infection is proportional to the infection density.
      if (Math.random() < infectionDensity) {
        this.infected = mom.infected.clone();
      }
    }

    // Generate a random fitness value from 0 to 1.
    this.fitness = Math.random();
    // Position is set by outside code.
    this.position = { x: 0, y: 0 };
    // If this mosquito is the child of two other mosquitoes, override the random values.
    if (dad && mom) {
      this.fitness = (dad.fitness + mom.fitness) / 2;
      this.position = mom.position;
    }

    if (this.infected !== null) {
      this.fitness +=
        this.infected.parasitismMutualismFactor *
        this.infected.infectionDensity;
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
    // Longevity can be influenced by the fitness effect of a Wolbachia infection, however.
    // A fitness modifier of -1.0 decreases survival odds to 0.125, while a fitness modifier of 1.0 increases survival odds to 0.375.
    let survivalOdds = 0.25 + this.infected?.parasitismMutualismFactor / 2;
    if (this.sex === 1 && this.age > 14 && Math.random() < survivalOdds) {
      // Kill self.
      let currentCell = this.position;
      world.map[currentCell.y][currentCell.x] = world.map[currentCell.y][
        currentCell.x
      ].filter((m) => m !== this);
      return;
    }

    // Females, on the other hand, live about 40 days after reaching maturity, so... they have a 1/40 chance of dying each day.
    // Longevity can be influenced by the fitness effect of a Wolbachia infection, however.
    survivalOdds = 0.025 + this.infected?.parasitismMutualismFactor / 40;
    if (this.sex === 0 && this.age > 14 && Math.random() < survivalOdds) {
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
      this.infected = new Wolbachia();
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
    let numberOfEggs = Math.round(100 * mom.fitness);
    if (dad.infected !== null && mom.infected !== null) {
      numberOfEggs = Math.floor(numberOfEggs * mom.infected.rescueRate);
    } else if (dad.infected !== null && mom.infected === null) {
      numberOfEggs = Math.floor(numberOfEggs * (1 - dad.infected.killRate));
    }

    for (let i = 0; i < numberOfEggs; i++) {
      let child = new Mosquito(dad, mom);
      if (mom.infected !== null) {
        // Use the mother's infection density to determine the chance of inheriting the infection.
        if (Math.random() < mom.infected.infectionDensity) {
          child.infected = mom.infected.clone();
        }
      }
      world.map[currentCell.y][currentCell.x].push(child);
      child.position = currentCell;
    }

    this.successes = numberOfEggs;
    mate.successes = numberOfEggs;
    this.fitness = (this.fitness + this.successes / 100) / 2;
    mate.fitness = (mate.fitness + mate.successes / 100) / 2;
  }
}

/***********************************
 * WORLD CLASS, METHODS, AND SETUP *
 ***********************************/

class World {
  constructor(width, height, waterRatio = 0.125) {
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
    this.setWaterCells(waterRatio);
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
        if (mosquito.infected === null) {
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
    return true;
  }

  // Check if all mosquitoes are infected.
  if (infectedMosquitoes.length === allMosquitoes.length) {
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
  // Get infected__males (0.0 to 1.0).
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

  // Get infected females (0.0 to 1.0).
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

  // Get water__percent (0.0 to 1.0).
  let waterRatioInDocument = document
    .getElementById("water__percent")
    .value.split(",");
  if (waterRatioInDocument.length > 0 && waterRatioInDocument[0] !== "") {
    waterRatios = waterRatioInDocument;
    // Convert to float.
    waterRatios = waterRatios.map((r) => parseFloat(r));
  }
  for (let i = 0; i < waterRatios.length; i++) {
    if (waterRatios[i] < 0 || waterRatios[i] > 1) {
      alert("Water ratio must be between 0 and 1.");
      return;
    }
  }

  // Get kill__rate (0.0 to 1.0).
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

  // Get rescue__rate (0.0 to 1.0).
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

  // Get maximum__fitness__detriment (-1.0 to 0.0).
  let minFitnessModifierInDocument = document
    .getElementById("maximum__fitness__detriment")
    .value.split(",");
  if (
    minFitnessModifierInDocument.length > 0 &&
    minFitnessModifierInDocument[0] !== ""
  ) {
    minFitnessModifiers = minFitnessModifierInDocument;
    // Convert to float.
    minFitnessModifiers = minFitnessModifiers.map((r) => parseFloat(r));
  }
  for (let i = 0; i < minFitnessModifiers.length; i++) {
    if (minFitnessModifiers[i] < -1.0 || minFitnessModifiers[i] > 0.0) {
      alert("Minimum fitness modifier must be between -1.0 and 0.0.");
      return;
    }
  }

  // Get maximum__fitness__benefit (0.0 to 1.0).
  let maxFitnessModifierInDocument = document
    .getElementById("maximum__fitness__benefit")
    .value.split(",");
  if (
    maxFitnessModifierInDocument.length > 0 &&
    maxFitnessModifierInDocument[0] !== ""
  ) {
    maxFitnessModifiers = maxFitnessModifierInDocument;
    // Convert to float.
    maxFitnessModifiers = maxFitnessModifiers.map((r) => parseFloat(r));
  }
  for (let i = 0; i < maxFitnessModifiers.length; i++) {
    if (maxFitnessModifiers[i] < 0.0 || maxFitnessModifiers[i] > 1.0) {
      alert("Maximum fitness modifier must be between 0.0 and 1.0.");
      return;
    }
  }

  // Get minimum__infection__density (0.0 to 1.0).
  let minInfectionDensityInDocument = document
    .getElementById("minimum__infection__density")
    .value.split(",");
  if (
    minInfectionDensityInDocument.length > 0 &&
    minInfectionDensityInDocument[0] !== ""
  ) {
    minInfectionDensities = minInfectionDensityInDocument;
    // Convert to float.
    minInfectionDensities = minInfectionDensities.map((r) => parseFloat(r));
  }
  for (let i = 0; i < minInfectionDensities.length; i++) {
    if (minInfectionDensities[i] < 0.0 || minInfectionDensities[i] > 1.0) {
      alert("Minimum infection density must be between 0.0 and 1.0.");
      return;
    }
  }

  // Get maximum__infection__density (0.0 to 1.0).
  let maxInfectionDensityInDocument = document
    .getElementById("maximum__infection__density")
    .value.split(",");
  if (
    maxInfectionDensityInDocument.length > 0 &&
    maxInfectionDensityInDocument[0] !== ""
  ) {
    maxInfectionDensities = maxInfectionDensityInDocument;
    // Convert to float.
    maxInfectionDensities = maxInfectionDensities.map((r) => parseFloat(r));
  }
  for (let i = 0; i < maxInfectionDensities.length; i++) {
    if (maxInfectionDensities[i] < 0.0 || maxInfectionDensities[i] > 1.0) {
      alert("Maximum infection density must be between 0.0 and 1.0.");
      return;
    }
  }

  // Get repeats (1 to 100).
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
        for (let waterRatio of waterRatios) {
          for (let killRate of killRates) {
            for (let rescueRate of rescueRates) {
              for (let minFitnessModifier of minFitnessModifiers) {
                for (let maxFitnessModifier of maxFitnessModifiers) {
                  for (let minInfectionDensity of minInfectionDensities) {
                    for (let maxInfectionDensity of maxInfectionDensities) {
                      // Create a new experiment.
                      let experiment = new Experiment();
                      experiment.infectedMalesAtStart = infectedMaleCount;
                      experiment.infectedFemalesAtStart = infectedFemaleCount;
                      experiment.waterRatio = waterRatio;
                      experiment.killRate = killRate;
                      experiment.rescueRate = rescueRate;
                      experiment.minFitnessModifier = minFitnessModifier;
                      experiment.maxFitnessModifier = maxFitnessModifier;
                      experiment.minInfectionDensity = minInfectionDensity;
                      experiment.maxInfectionDensity = maxInfectionDensity;

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

    // Set up simulation parameters.
    currentKillRate = experiment.killRate;
    currentRescueRate = experiment.rescueRate;
    currentFitnessModifierRange = [
      experiment.minFitnessModifier,
      experiment.maxFitnessModifier,
    ];
    currentInfectionDensityRange = [
      experiment.minInfectionDensity,
      experiment.maxInfectionDensity,
    ];
    renderWorld();

    // Infect the specified number of males and females.
    let allMales = allMosquitoes.filter(
      (m) => m.sex === 1 && m.infected === null
    );
    let allFemales = allMosquitoes.filter(
      (m) => m.sex === 0 && m.infected === null
    );
    allMales.forEach((male) => {
      if (Math.random() < experiment.infectedMalesAtStart) {
        male.changeInfectionStatus();
        male.fitness +=
          male.infected.parasitismMutualismFactor *
          male.infected.infectionDensity;
      }
    });
    allFemales.forEach((female) => {
      if (Math.random() < experiment.infectedFemalesAtStart) {
        female.changeInfectionStatus();
        female.fitness +=
          female.infected.parasitismMutualismFactor *
          female.infected.infectionDensity;
      }
    });

    // Run the simulation.
    while (!shouldStopSimulation() && generation < duration) {
      allMosquitoes = [];
      for (let y = 0; y < world.height; y++) {
        for (let x = 0; x < world.width; x++) {
          allMosquitoes = allMosquitoes.concat(world.map[y][x]);
        }
      }
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
        // Get the average fitness modification of all infected mosquitoes.
        allMosquitoes
          .filter((m) => m.infected !== null)
          .reduce(
            (acc, m) =>
              acc +
              m.infected.parasitismMutualismFactor *
                m.infected.infectionDensity,
            0
          ) / allMosquitoes.filter((m) => m.infected !== null).length
      );
      experiment.averageParasitismMutualismOverTime.push(
        // Get the average parasitism/mutualism factor of all infected mosquitoes.
        allMosquitoes
          .filter((m) => m.infected !== null)
          .reduce((acc, m) => acc + m.infected.parasitismMutualismFactor, 0) /
          allMosquitoes.filter((m) => m.infected !== null).length
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
    this.waterRatio = 0.125;
    // Infection data.
    this.killRate = 1.0;
    this.rescueRate = 1.0;
    this.maxFitnessDetriment = -1.0;
    this.maxFitnessBenefit = 1.0;
    this.minInfectionDensity = 0.0;
    this.maxInfectionDensity = 1.0;
    // Run data.
    this.infectionRatio = [];
    this.reproductiveSuccessOverTime = [];
    this.averageParasitismMutualismOverTime = [];
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
      averageParasitismMutualismOverTime:
        this.averageParasitismMutualismOverTime,
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
