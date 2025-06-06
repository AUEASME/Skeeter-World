/*************************
 * SIMULATION PARAMETERS *
 *************************/

let infectedMaleCount = [0.25];
let infectedFemaleCount = [0.25];
let killRate = [1.0];
let rescueRate = [1.0];
let duration = [730];
let repeatCount = 1;
let minImperfectTransmissionRate = 0.0;
let maxImperfectTransmissionRate = 1.0;

// TO IMPLEMENT:
// toxin mutation rate
// antitoxin mutation rate
// toxin/antitoxin length
// female bite rate (maybe static?)
// Change number to infect at outset to a PERCENTAGE.
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

/**************************************
 * MOSQUITO CLASS, METHODS, AND SETUP *
 **************************************/

class Mosquito {
  constructor(dad, mom) {
    // this.sex can be 0 (female) or 1 (male).
    this.sex = Math.round(Math.random());
    // this.infected is a boolean that indicates whether the mosquito is infected with Wolbachia.
    this.infected = false;

    // Generate a random fitness value from 0 to 1.
    this.fitness = Math.random();
    // Generate a random rate for maternal transmission of Wolbachia.
    this.imperfectTransmissionRate =
      Math.random() *
        (maxImperfectTransmissionRate - minImperfectTransmissionRate) +
      minImperfectTransmissionRate;

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
    }

    // Females, on the other hand, live about 40 days after reaching maturity, so... they have a 1/40 chance of dying each day.
    // Actually no that shouldn't be how that works, it should be a distribution CENTERED around 40.
    if (this.sex === 0 && this.age > 14 && Math.random() < 0.025) {
      // Kill self.
      let currentCell = this.position;
      world.map[currentCell.y][currentCell.x] = world.map[currentCell.y][
        currentCell.x
      ].filter((m) => m !== this);
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
    if (this.infected === false) {
      this.infected = true;
      return;
    }

    this.infected = false;
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
    let numberOfEggs = Math.floor(Math.random() * 100) + 1;
    if (dad.infected === true && mom.infected === true) {
      numberOfEggs = Math.floor(numberOfEggs * rescueRate);
    } else if (dad.infected === true && mom.infected === false) {
      numberOfEggs = Math.floor(numberOfEggs * (1 - killRate));
    }

    for (let i = 0; i < numberOfEggs; i++) {
      let child = new Mosquito();
      if (Math.random() < mom.imperfectTransmissionRate && mom.infected === true) {
        child.infected = true;
      }
      world.map[currentCell.y][currentCell.x].push(child);
      child.imperfectTransmissionRate =
        (dad.imperfectTransmissionRate + mom.imperfectTransmissionRate) / 2;
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
  constructor(width, height) {
    // Generate an empty map of the given width and height.
    this.width = width;
    this.height = height;
    this.map = new Array(height)
      .fill(0)
      .map(() => new Array(width).fill(0).map(() => []));
    // 2. Generate another empty map, this time for water.
    this.water_map = new Array(height)
      .fill(0)
      .map(() => new Array(width).fill(0));
    // 3. Fill the map with random water cells.
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (Math.random() < 0.048) {
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
        if (mosquito.infected === false) {
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
  // selected.sort((a, b) => b.fitness - a.fitness);

  // Return the most fit male.
  return selected[0];
}

/********************
 * GLOBAL VARIABLES *
 ********************/

// Create world.
let world = new World(16, 16);
let carryingCapacity = 96;

// Populate world.
let allMosquitoes = [];

// Set up logging.
let generation = 0;
let trace1 = {
  x: [],
  y: [],
  name: "Uninfected",
  type: "scatter",
  mode: "lines",
  marker: { color: "red" },
};
let trace2 = {
  x: [],
  y: [],
  name: "Infected",
  type: "scatter",
  mode: "lines",
  marker: { color: "blue" },
};
let trace3 = {
  x: [],
  y: [],
  name: "Reproductive Success Rate",
  type: "scatter",
  mode: "lines",
  marker: { color: "RebeccaPurple" },
};

function updatePlot(generation) {
  // Update infection plot.
  let uninfectedCount = allMosquitoes.filter(
    (m) => m.infected === false
  ).length;
  let infectedCount = allMosquitoes.filter(
    (m) => m.infected === true
  ).length;

  trace1.x.push(generation);
  trace1.y.push(uninfectedCount);
  trace2.x.push(generation);
  trace2.y.push(infectedCount);

  let layout = {
    title: "Mosquito Infection Status",
    xaxis: { title: "Day" },
    yaxis: { title: "Mosquito Count" },
    barmode: "stack",
  };

  Plotly.newPlot("plot", [trace1, trace2], layout);

  trace3.x.push(generation);
  trace3.y.push(
    // Get the average reproductive success odds of all mosquitoes.
    allMosquitoes.reduce((acc, m) => acc + m.successes, 0) /
      allMosquitoes.length
  );

  let layout2 = {
    title: "Reproductive Success Rate Over Time",
    xaxis: { title: "Day" },
    yaxis: { title: "Average Reproductive Success Rate" },
  };

  Plotly.newPlot("reproductive_success_plot", [trace3], layout2);
}

function updateWorld() {
  logAndMockConsole(
    `Day ${generation + 1}: There are currently ${allMosquitoes.length.toLocaleString("en")} mosquitoes, ${allMosquitoes
      .filter((m) => m.infected === true)
      .length.toLocaleString("en")} of whom are infected by Wolbachia.`
  );

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
  updatePlot(generation + 1);
  generation += 1;
}

function shouldStopSimulation() {
  // Check if infection has been eradicated.
  let infectedMosquitoes = allMosquitoes.filter((m) => m.infected === true);
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

function resetWorld() {
  // Reset all global variables.
  world = new World(16, 16);
  carryingCapacity = 96;
  allMosquitoes = [];
  generation = 0;
  trace1 = {
    x: [],
    y: [],
    name: "Uninfected",
    type: "scatter",
    mode: "lines",
    marker: { color: "red" },
  };
  trace2 = {
    x: [],
    y: [],
    name: "Infected",
    type: "scatter",
    mode: "lines",
    marker: { color: "blue" },
  };
  trace3 = {
    x: [],
    y: [],
    name: "Reproductive Success Odds",
    type: "scatter",
    mode: "lines",
    marker: { color: "RebeccaPurple" },
  };
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
    infectedMaleCount = infectedMaleCountInDocument;
    // Convert to float.
    infectedMaleCount = infectedMaleCount.map((c) => parseFloat(c));
  }
  for (let i = 0; i < infectedMaleCount.length; i++) {
    if (infectedMaleCount[i] < 0 || infectedMaleCount[i] > 1) {
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
    infectedFemaleCount = infectedFemaleCountInDocument;
    // Convert to float.
    infectedFemaleCount = infectedFemaleCount.map((c) => parseFloat(c));
  }
  for (let i = 0; i < infectedFemaleCount.length; i++) {
    if (infectedFemaleCount[i] < 0 || infectedFemaleCount[i] > 1) {
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
    killRate = killRateInDocument;
    // Convert to float.
    killRate = killRate.map((r) => parseFloat(r));
  }
  for (let i = 0; i < killRate.length; i++) {
    if (killRate[i] < 0 || killRate[i] > 1) {
      alert("Kill rate must be between 0 and 1.");
      return;
    }
  }

  let rescueRateInDocument = document
    .getElementById("rescue__rate")
    .value.split(",");
  if (rescueRateInDocument.length > 0 && rescueRateInDocument[0] !== "") {
    rescueRate = rescueRateInDocument;
    // Convert to float.
    rescueRate = rescueRate.map((r) => parseFloat(r));
  }
  for (let i = 0; i < rescueRate.length; i++) {
    if (rescueRate[i] < 0 || rescueRate[i] > 1) {
      alert("Rescue rate must be between 0 and 1.");
      return;
    }
  }

  let durationInDocument = document.getElementById("duration").value.split(",");
  if (durationInDocument.length > 0 && durationInDocument[0] !== "") {
    duration = durationInDocument;
    // Convert to integer.
    duration = duration.map((d) => parseInt(d));
  }
  for (let i = 0; i < duration.length; i++) {
    if (duration[i] < 0) {
      alert("Duration cannot be less than zero.");
      return;
    }
  }

  repeatCount = document.getElementById("repeats").value || 3;
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
  for (let h = 0; h < repeatCount; h++) {
    for (let i = 0; i < infectedMaleCount.length; i++) {
      for (let j = 0; j < infectedFemaleCount.length; j++) {
        for (let k = 0; k < killRate.length; k++) {
          for (let l = 0; l < rescueRate.length; l++) {
            for (let m = 0; m < duration.length; m++) {
              let experiment = new Experiment();
              experiment.infectedMalesAtStart = infectedMaleCount[i];
              experiment.infectedFemalesAtStart = infectedFemaleCount[j];
              experiment.killRate = killRate[k];
              experiment.rescueRate = rescueRate[l];
              experiment.maxDays = duration[m];
              experiments.push(experiment);
            }
          }
        }
      }
    }
  }

  // Run each experiment.
  for (let experiment of experiments) {
    // Set up the world.
    world.populate();

    let allMosquitoes = [];
    for (let y = 0; y < world.height; y++) {
      for (let x = 0; x < world.width; x++) {
        allMosquitoes = allMosquitoes.concat(world.map[y][x]);
      }
    }
    // Infect the specified number of males and females.
    let allMales = allMosquitoes.filter(
      (m) => m.sex === 1 && m.infected === false
    );
    let allFemales = allMosquitoes.filter(
      (m) => m.sex === 0 && m.infected === false
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

    killRate = experiment.killRate;
    rescueRate = experiment.rescueRate;
    renderWorld();

    // Run the simulation.
    while (!shouldStopSimulation() && generation < experiment.maxDays) {
      // Update the experiment data.
      experiment.infectionRatio.push(
        allMosquitoes.filter((m) => m.infected === true).length /
          allMosquitoes.length
      );
      experiment.reproductiveSuccessOverTime.push(
        // Get the average reproductive success of all mosquitoes.
        allMosquitoes.reduce((acc, m) => acc + m.successes, 0) /
          allMosquitoes.length
      );
      // Update the world.
      updateWorld();
      // Sleep for a quarter of a second.
      // This allows the browser time to handle user requests, such as scrolling, which get laggy if the simulation never takes a break.
      await new Promise((r) => setTimeout(r, 250));
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
    this.maxDays = 730;
    // Run data.
    this.infectionRatio = [];
    this.reproductiveSuccessOverTime = [];
  }

  outputData() {
    let allData = {
      startTime: this.startTime,
      infectedMalesAtStart: this.infectedMalesAtStart,
      infectedFemalesAtStart: this.infectedFemalesAtStart,
      killRate: this.killRate,
      rescueRate: this.rescueRate,
      simulationLength: generation,
      infectionRatio: this.infectionRatio,
      reproductiveSuccessOverTime: this.reproductiveSuccessOverTime,
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
