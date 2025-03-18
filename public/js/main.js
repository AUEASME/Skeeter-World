/*************************
 * SIMULATION PARAMETERS *
 *************************/

let killRate = 0.5;
let rescueRate = 1.0;

/********************
 * HELPER FUNCTIONS *
 ********************/

let mockConsole = document.getElementById("mock__console");

function logAndMockConsole(text) {
  console.log(text);

  // Create a new paragraph element.
  let p = document.createElement("p");
  // Set the text content of the paragraph element to the text passed in.
  p.textContent = `[${new Date().toLocaleTimeString()}] ${text}`;
  // Append the paragraph element to the mock console.
  mockConsole.appendChild(p);
  // If there are more than 32 children in the mock console, remove the first one.
  while (mockConsole.children.length > 24) {
    mockConsole.removeChild(mockConsole.children[0]);
  }
}

function lockAndKeyMatch(
  firstArray = [0, 0, 0, 0],
  secondArray = [0, 0, 0, 0]
) {
  // Ensure the strings are the same length.
  if (firstArray.length !== secondArray.length) {
    return 0;
  }

  // Return a value between 0 and 1, where 0 means the strings are completely different and 1 means they are identical.
  let matches = 0;
  for (let i = 0; i < firstArray.length; i++) {
    if (firstArray[i] === secondArray[i]) {
      matches++;
    }
  }
  return matches / firstArray.length;
}

function evaluateToxinStatus(dad, mom) {
  // Fill in the dad.toxin and mom.antitoxin arrays based on their respective infections.
  // For each Wolbachia in the dad, for each gene in the genome, if the gene is a toxin, add it to the dad's toxins.
  // For each Wolbachia in the dad, for each gene in the plasmids, if the gene is a toxin, add it to the dad's toxins.
  if (dad.infected.length > 0 && dad.toxins === null) {
    dad.toxins = [];
    for (let i = 0; i < dad.infected.length; i++) {
      // If undefined, skip.
      if (dad.infected[i] === undefined) {
        continue;
      }
      for (let j = 0; j < dad.infected[i].genome.length; j++) {
        if (dad.infected[i].genome[j].type === 0) {
          dad.toxins.push(dad.infected[i].genome[j]);
        }
      }
      for (let j = 0; j < dad.infected[i].plasmids.length; j++) {
        if (dad.infected[i].plasmids[j].type === 0) {
          dad.toxins.push(dad.infected[i].plasmids[j]);
        }
      }
    }
  } else if (dad.toxins === null) {
    dad.toxins = [];
  }
  // For each Wolbachia in the mom, for each gene in the genome, if the gene is an antitoxin, add it to the mom's antitoxins.
  // For each Wolbachia in the mom, for each gene in the plasmids, if the gene is an antitoxin, add it to the mom's antitoxins.
  if (mom.infected.length > 0 && mom.antitoxins === null) {
    mom.antitoxins = [];
    for (let i = 0; i < mom.infected.length; i++) {
      // If undefined, skip.
      if (mom.infected[i] === undefined) {
        continue;
      }
      for (let j = 0; j < mom.infected[i].genome.length; j++) {
        if (mom.infected[i].genome[j].type === 1) {
          mom.antitoxins.push(mom.infected[i].genome[j]);
        }
      }
      for (let j = 0; j < mom.infected[i].plasmids.length; j++) {
        if (mom.infected[i].plasmids[j].type === 1) {
          mom.antitoxins.push(mom.infected[i].plasmids[j]);
        }
      }
    }
  } else if (mom.antitoxins === null) {
    mom.antitoxins = [];
  }

  // Okay, first off, for each toxin, we need to see if we have an EXACT MATCH antitoxin.
  // If so, they cancel each other out, and are removed.
  // Chance of neutralization is determined by the rescue rate.
  let dadToxins = dad.toxins;
  let momAntitoxins = mom.antitoxins;
  for (let toxin of dadToxins) {
    for (let antitoxin of momAntitoxins) {
      if (toxin.chemical === antitoxin.chemical) {
        if (Math.random() < rescueRate) {
          dadToxins = dadToxins.filter((t) => t !== toxin);
          momAntitoxins = momAntitoxins.filter((a) => a !== antitoxin);
        }
      }
    }
  }

  // For each remaining toxin, find the closest antitoxin match, and have a [LOCK AND KEY MATCH * RESCUE RATE] chance of neutralizing it.
  for (let toxin of dadToxins) {
    let bestMatch = 0;
    let bestAntitoxin = null;
    for (let antitoxin of momAntitoxins) {
      let match = lockAndKeyMatch(toxin.chemical, antitoxin.chemical);
      if (match > bestMatch) {
        bestMatch = match;
        bestAntitoxin = antitoxin;
      }
    }
    if (Math.random() < bestMatch * rescueRate) {
      dadToxins = dadToxins.filter((t) => t !== toxin);
      momAntitoxins = momAntitoxins.filter((a) => a !== bestAntitoxin);
    }
  }

  // If any toxins are left... the mosquito has a... reduced chance of reproducing.
  // How do we calculate that value? Should it be user-determined? Kill rate?
  // If the kill rate is .5, each toxin remaining has a 50% chance of killing... each offspring.
  // So if there are 3 toxins, the mosquito has a 12.5% chance of successfully reproducing.
  // Or rather, each offspring has a 12.5% chance of surviving.
  let reproductiveSuccess = Math.pow(1 - killRate, dad.toxins.length);

  // Clear the toxins and antitoxins arrays.
  dad.toxins = [];
  mom.antitoxins = [];

  return reproductiveSuccess;
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

class Gene {
  constructor() {
    // Randomly choose a type (0 for toxin, 1 for antitoxin).
    this.type = Math.round(Math.random());

    // Set the chemical to a random binary string of length 4.
    this.chemical = [0, 0, 0, 0];
    for (let i = 0; i < 4; i++) {
      // Flip a coin. If heads, set the ith character to 1.
      if (Math.random() < 0.5) {
        this.chemical[i] = 1;
      }
    }
  }
}

class Wolbachia {
  constructor(random = false) {
    // The genome is mostly IMMUTABLE — once a gene is added to it, it cannot be removed.
    // The genome is copied from the parent when the bacteria reproduces.
    this.genome = [];
    // If random is true, generate a random genome.
    if (random === true) {
      for (let i = 0; i < 2; i++) {
        this.genome.push(new Gene());
      }
    }

    // Plasmids are mutable — they can be lost during reproduction.
    this.plasmids = [];
    // If random is true, generate a random number of plasmids.
    if (random) {
      for (let i = 0; i < 5; i++) {
        this.plasmids.push(new Gene());
      }
    }
  }

  wol_reproduce(num_offspring) {
    // When the bacteria reproduces, the plasmids are split between the two daughter cells.
    // Of course, most bacteria only have about ten plasmids each, so when the mosquitoes reproduce... most Wolbachia would be left with no plasmids.
    // So we'll somehow need to simulate plasmid reproduction...
    // Okay, so reproduce() should take a number as an argument, that being the number of mosquitoes being produced.
    // Then it realistically simulates the cell divisions of Wolbachia to cover all the mosquito offspring.

    let offspring = [];

    for (let i = 0; i < num_offspring; i++) {
      let newWolbachia = new Wolbachia();

      // Copy the genome.
      newWolbachia.genome = this.genome.slice();

      // Copy the plasmids.
      newWolbachia.plasmids = this.plasmids.slice();

      // Randomly remove half the plasmids.
      newWolbachia.plasmids = newWolbachia.plasmids.filter(
        () => Math.random() > 0.5
      );

      // If no plasmids are left, randomly add one from the parent.
      if (newWolbachia.plasmids.length === 0) {
        newWolbachia.plasmids.push(
          structuredClone(
            this.plasmids[Math.floor(Math.random() * this.plasmids.length)]
          )
        );
      }

      // Randomly duplicate plasmids from the child until we're back to the original number.
      while (newWolbachia.plasmids.length < this.plasmids.length) {
        let randomPlasmid = structuredClone(
          newWolbachia.plasmids[
            Math.floor(Math.random() * newWolbachia.plasmids.length)
          ]
        );
        newWolbachia.plasmids.push(randomPlasmid);
      }

      offspring.push(newWolbachia);
    }

    return offspring;
  }

  conjugate(mate) {
    // Choose a random plasmid.
    let randomPlasmid =
      this.plasmids[Math.floor(Math.random() * this.plasmids.length)];

    // Duplicate that plasmid into the plasmid array of the mate.
    mate.plasmids.push(structuredClone(randomPlasmid));
  }

  integrate() {
    // Choose a random plasmid.
    let randomPlasmid =
      this.plasmids[Math.floor(Math.random() * this.plasmids.length)];

    // Move it from the plasmid array to the genome array.
    this.genome.push(structuredClone(randomPlasmid));
    this.plasmids = this.plasmids.filter((p) => p !== randomPlasmid);
  }
}

/**************************************
 * MOSQUITO CLASS, METHODS, AND SETUP *
 **************************************/

class Mosquito {
  constructor(infected, dad, mom) {
    // this.sex can be 0 (female) or 1 (male).
    this.sex = Math.round(Math.random());
    // this.infected can be 0 (not infected) or an array of Wolbachia objects (infected).
    this.infected = [];
    // If infected is an array, make a structured clone of all the Wolbachia in the array.
    if (infected) {
      this.infected = infected;
    }

    // Generate a random fitness value.
    this.fitness = Math.random();

    // Position is set by outside code.
    this.position = { x: 0, y: 0 };

    // If this mosquito is the child of two other mosquitoes, override the random values.
    if (dad && mom) {
      this.fitness = (dad.fitness + mom.fitness) / 2;
      this.position = mom.position;
    }

    // Birthplace is IMMUTABLE — it is set when the mosquito is created and never changes.
    this.birthplace = this.position;

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

    // Wolbachia produces toxins and antidotes.
    // So each mosquito has a concentration of toxins and antidotes produced each day.
    // The proportion of those determines reproductive success.
    this.toxins = null;
    this.antitoxins = null;

    // Keep track of how many children survived per reproductive event.
    this.successes = [];
    this.toxinsAtReproduction = [];
    this.antitoxinsAtReproduction = [];
  }

  evaluateFitness() {
    console.log("Working on it.");
    // Antitoxins in females should increase fitness.
    // Toxins in males... should NOT affect fitness?
  }

  ageUp() {
    this.age++;
    if (this.sex === 1 && this.age > 18) {
      // Kill self.
      let currentCell = this.position;
      world.map[currentCell.y][currentCell.x] = world.map[currentCell.y][
        currentCell.x
      ].filter((m) => m !== this);
    }

    if (this.sex === 0 && this.age > 54) {
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
    } else {
      this.sex = 0;
    }
  }

  changeInfectionStatus() {
    if (this.infected.length === 0) {
      this.infected = [new Wolbachia(true)];
    } else {
      this.infected = [];
    }
  }

  migrate() {
    // Check if any neighboring cell has fewer mosquitoes. If it does, move there.
    let currentCell = this.position;
    let currentPopulation = world.map[currentCell.y][currentCell.x].length;
    let bestCell = currentCell;
    let bestPopulation = currentPopulation;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        let y = currentCell.y + dy;
        let x = currentCell.x + dx;
        if (y >= 0 && y < world.height && x >= 0 && x < world.width) {
          let population = world.map[y][x].length;
          if (population < bestPopulation) {
            bestCell = { x, y };
            bestPopulation = population;
          }
        }
      }
    }
    if (bestCell !== currentCell) {
      world.map[currentCell.y][currentCell.x] = world.map[currentCell.y][
        currentCell.x
      ].filter((m) => m !== this);
      world.map[bestCell.y][bestCell.x].push(this);
      this.position = bestCell;
      return;
    }

    // Check if any neighboring cell has lower average fitness. If it does, move there.
    let currentFitness =
      world.map[currentCell.y][currentCell.x].reduce(
        (acc, m) => acc + m.fitness,
        0
      ) / currentPopulation;
    let bestFitness = currentFitness;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        let y = currentCell.y + dy;
        let x = currentCell.x + dx;
        if (y >= 0 && y < world.height && x >= 0 && x < world.width) {
          let fitness =
            world.map[y][x].reduce((acc, m) => acc + m.fitness, 0) /
            world.map[y][x].length;
          if (fitness < bestFitness) {
            bestCell = { x, y };
            bestFitness = fitness;
          }
        }
      }
    }
    if (bestCell !== currentCell) {
      world.map[currentCell.y][currentCell.x] = world.map[currentCell.y][
        currentCell.x
      ].filter((m) => m !== this);
      world.map[bestCell.y][bestCell.x].push(this);
      this.position = bestCell;
      return;
    }
  }

  reproduce(mate) {
    // Ensure we're an adult.
    // "Mosquitoes begin breeding about 28 hours after they reach adulthood."
    if (this.age < 14) {
      return;
    }

    // Ensure we haven't reproduced too recently.
    if (this.breedingCooldown > 0) {
      this.breedingCooldown--;
      return;
    }

    this.breedingCooldown = 4;

    let currentCell = this.position;
    // If both parents are infected, the child has a mom.infection.rescueRate chance of surviving, in which case it inherits one of the parents' infections.
    // If the dad is infected but the mom is not, the child has a dad.infection.killRate chance of immediately dying, otherwise it inherits the dad's infection.
    // If the mom is infected but the dad is not, the child survives, but inherits the mom's infection.
    // If neither parent is infected, the child survives no matter what.
    // Child fitness is the average of the parents' fitness.
    let dad = mate,
      mom = this;
    let numberOfEggs = Math.floor(Math.random() * 100);
    let toxinStatus = evaluateToxinStatus(dad, mom);
    let successCount = 0;

    for (let i = 0; i < numberOfEggs; i++) {
      // If the father is infected, we need to determine if the sperm survives.
      // Need to match the toxins in the dad with the antitoxins in the mom and determine if the sperm survives.
      if (
        (dad.infected.length !== 0 && Math.random() < toxinStatus) ||
        dad.infected.length === 0
      ) {
        // Sperm survives.
        // Paternal infections AREN'T passed on in nature, according to Turelli '94, so we don't need to do a mixed infection.
        let child = new Mosquito(mom.infected, dad, mom);
        world.map[currentCell.y][currentCell.x].push(child);
        child.position = currentCell;
        successCount++;
      }
    }

    this.successes.push(successCount);
    mate.successes.push(successCount);
    this.toxinsAtReproduction.push(this.toxins);
    mate.toxinsAtReproduction.push(mate.toxins);
    this.antitoxinsAtReproduction.push(this.antitoxins);
    mate.antitoxinsAtReproduction.push(mate.antitoxins);
  }
}

let allMosquitoes = [];

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
    // From left to right, top to bottom, fill map with four-digit binary numbers.
    // 1. Generate an array of all possible four-digit binary numbers.
    let binaryNumbers = [];
    for (let i = 0; i < width; i++) {
      binaryNumbers.push(i.toString(2).padStart(4, "0"));
    }
    // 2. Generate another empty map.
    this.binary_map = new Array(height)
      .fill(0)
      .map(() => new Array(width).fill(0));
    // 3. For each row, shuffle the array of binary numbers and assign them to the map.
    for (let y = 0; y < height; y++) {
      let shuffled = [...binaryNumbers];
      for (let x = 0; x < width; x++) {
        let index = Math.floor(Math.random() * shuffled.length);
        this.binary_map[y][x] = shuffled[index];
        shuffled.splice(index, 1);
      }
    }
  }

  populate() {
    // Add up to twenty mosquitoes to each cell.
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        let numberOfMosquitoes = Math.floor(Math.random() * 20);
        for (let i = 0; i < numberOfMosquitoes; i++) {
          let mosquito = new Mosquito();
          this.map[y][x].push(mosquito);
          mosquito.birthplace = mosquito.position = { x, y };
          allMosquitoes.push(mosquito);
        }
      }
    }
  }

  infectMale() {
    // Find a random male and infect him.
    let males = allMosquitoes.filter(
      (m) => m.sex === 1 && m.infected.length === 0
    );

    if (males.length === 0) {
      // Select a random mosquito and change its sex.
      let randomMosquito =
        allMosquitoes[Math.floor(Math.random() * allMosquitoes.length)];
      randomMosquito.changeSex();
      males = allMosquitoes.filter((m) => m.sex === 1);
    }

    let randomMosquito = males[Math.floor(Math.random() * males.length)];
    randomMosquito.changeInfectionStatus();
  }

  infectFemale() {
    // Find a random female and infect her.
    let females = allMosquitoes.filter(
      (m) => m.sex === 0 && m.infected.length === 0
    );

    if (females.length === 0) {
      // Select a random mosquito and change its sex.
      let randomMosquito =
        allMosquitoes[Math.floor(Math.random() * allMosquitoes.length)];
      randomMosquito.changeSex();
      females = allMosquitoes.filter((m) => m.sex === 0);
    }

    let randomMosquito = females[Math.floor(Math.random() * females.length)];
    randomMosquito.changeInfectionStatus();
  }

  getAverageToxinCountInMales() {
    // Get all males in the world.
    const males = allMosquitoes.filter(
      (m) => m.sex === 1 && m.infected.length > 0
    );

    // Get all unique toxins produced inside that male.
    let lengths = [];
    for (let i = 0; i < males.length; i++) {
      let toxins = new Set();
      for (let j = 0; j < males[i].infected.length; j++) {
        // If undefined, skip.
        if (males[i].infected[j] === undefined) {
          continue;
        }
        for (let k = 0; k < males[i].infected[j].genome.length; k++) {
          if (males[i].infected[j].genome[k].type === 0) {
            toxins.add(males[i].infected[j].genome[k].chemical);
          }
        }
        for (let k = 0; k < males[i].infected[j].plasmids.length; k++) {
          if (males[i].infected[j].plasmids[k].type === 0) {
            toxins.add(males[i].infected[j].plasmids[k].chemical);
          }
        }
      }
      lengths.push(toxins.size);
    }

    // Return the average number of unique toxins.
    return lengths.reduce((acc, l) => acc + l, 0) / lengths.length;
  }

  getAverageAntitoxinCountInFemales() {
    // Get all females in the world.
    const females = allMosquitoes.filter(
      (m) => m.sex === 0 && m.infected.length > 0
    );

    // Get all unique antitoxins produced inside each male.
    let lengths = [];
    for (let i = 0; i < females.length; i++) {
      let antitoxins = new Set();
      for (let j = 0; j < females[i].infected.length; j++) {
        // If undefined, skip.
        if (females[i].infected[j] === undefined) {
          continue;
        }
        for (let k = 0; k < females[i].infected[j].genome.length; k++) {
          if (females[i].infected[j].genome[k].type === 0) {
            antitoxins.add(females[i].infected[j].genome[k].chemical);
          }
        }
        for (let k = 0; k < females[i].infected[j].plasmids.length; k++) {
          if (females[i].infected[j].plasmids[k].type === 0) {
            antitoxins.add(females[i].infected[j].plasmids[k].chemical);
          }
        }
      }
      lengths.push(antitoxins.size);
    }

    // Return the average number of unique antitoxins.
    return lengths.reduce((acc, l) => acc + l, 0) / lengths.length;
  }
}

// Create world.
let world = new World(16, 16);
let carryingCapacity = 96;

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
        if (mosquito.infected.length === 0) {
          green -= 255 / carryingCapacity;
          blue -= 255 / carryingCapacity;
        } else {
          green -= 255 / carryingCapacity;
          red -= 255 / carryingCapacity;
        }
      }
      context.fillStyle = `rgb(${red}, ${green}, ${blue})`;
      context.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
    }
  }
}

/************************
 * SIMULATION FUNCTIONS *
 ************************/
let simulationIntervalID;

function mosquitoDay(population) {
  // Sort mosquitoes by fitness (lowest first).
  console.log("Sorting mosquitoes by fitness…");
  population.sort((a, b) => a.fitness - b.fitness);

  // Make a 2D grid for all the males in the map.
  let males = new Array(world.height)
    .fill(0)
    .map(() => new Array(world.width).fill(0).map(() => []));

  // Assign each male to their cell.
  console.log("Fetching males…");
  for (let mosquito of population) {
    if (mosquito.sex === 1) {
      let currentCell = mosquito.position;
      males[currentCell.y][currentCell.x].push(mosquito);
    }
  }

  console.log("Migrating and breeding mosquitoes…");
  for (let mosquito of population) {
    // Migrate and reproduce.
    mosquito.migrate();
    let currentCell = mosquito.position;

    // If mosquito is female, reproduce.
    if (mosquito.sex === 0) {
      let eligibleMales = males[currentCell.y][currentCell.x];
      if (eligibleMales.length > 0) {
        // Get the male with the highest fitness.
        eligibleMales.sort((a, b) => b.fitness - a.fitness);
        mosquito.reproduce(eligibleMales[0]);
      }
    }

    // Age mosquito.
    mosquito.ageUp();
  }

  for (let mosquito of population) {
    mosquito.toxins = null;
    mosquito.antitoxins = null;
  }
}

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
  marker: { color: "HotPink" },
};

let trace3 = {
  x: [],
  y: [],
  name: "Average Toxin Count in Each Male",
  type: "scatter",
  mode: "lines",
  marker: { color: "blue" },
};

let trace4 = {
  x: [],
  y: [],
  name: "Average Antitoxin Count in Each Female",
  type: "scatter",
  mode: "lines",
  marker: { color: "green" },
};

function updatePlot(generation) {
  console.log("Updating plot…");

  // Update infection plot.
  let uninfectedCount = allMosquitoes.filter(
    (m) => m.infected.length === 0
  ).length;
  let infectedCount = allMosquitoes.filter(
    (m) => m.infected.length !== 0
  ).length;

  trace1.x.push(generation);
  trace1.y.push(uninfectedCount);
  trace2.x.push(generation);
  trace2.y.push(infectedCount);

  let layout = {
    title: "Mosquito Infection Status",
    xaxis: {
      title: "Generation",
    },
    yaxis: {
      title: "Mosquito Count",
    },
    barmode: "stack",
  };

  Plotly.newPlot("plot", [trace1, trace2], layout);

  // Update toxin plot.
  let averageToxinCountInMales = world.getAverageToxinCountInMales();

  trace3.x.push(generation);
  trace3.y.push(averageToxinCountInMales);

  let layout2 = {
    title: "Average Toxin Count in Male Mosquitoes",
    xaxis: {
      title: "Generation",
    },
    yaxis: {
      title: "Average Toxin Count",
    },
  };

  Plotly.newPlot("toxin__plot", [trace3], layout2);

  // Update antitoxin plot.
  let averageAntitoxinCountInFemales =
    world.getAverageAntitoxinCountInFemales();

  trace4.x.push(generation);
  trace4.y.push(averageAntitoxinCountInFemales);

  let layout3 = {
    title: "Average Antitoxin Count in Female Mosquitoes",
    xaxis: {
      title: "Generation",
    },
    yaxis: {
      title: "Average Antitoxin Count",
    },
  };

  Plotly.newPlot("antitoxin__plot", [trace4], layout3);
}

function updateWorld() {
  logAndMockConsole(`Beginning day ${generation + 1}…`);

  logAndMockConsole(
    `There are currently ${allMosquitoes.length} mosquitoes, ${
      allMosquitoes.filter((m) => m.infected.length !== 0).length
    } of whom are infected by Wolbachia.`
  );

  // Migration phase.
  mosquitoDay(allMosquitoes);

  // Population control: sort mosquitoes by fitness and preserve only the best in each cell.
  allMosquitoes = [];
  for (let y = 0; y < world.height; y++) {
    for (let x = 0; x < world.width; x++) {
      world.map[y][x].sort((a, b) => b.fitness - a.fitness);
      world.map[y][x] = world.map[y][x].slice(0, carryingCapacity);
      allMosquitoes = allMosquitoes.concat(world.map[y][x]);
    }
  }

  renderWorld();

  logAndMockConsole(`Day ${generation + 1} has ended.`);

  // Update the plot.
  updatePlot(generation + 1);
  generation += 1;

  if (shouldStopSimulation()) {
    stopSimulation();
  }
}

function shouldStopSimulation() {
  // Check if infection has been eradicated.
  let infectedMosquitoes = allMosquitoes.filter((m) => m.infected.length > 0);
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

function stopSimulation() {
  logAndMockConsole("Simulation has been stopped.");
  clearInterval(simulationIntervalID);

  // Change the button to a "Resume" button.
  let stopButton = document.getElementById("stop");
  stopButton.textContent = "Resume Simulation";
  stopButton.onclick = resumeSimulation;
}

function resumeSimulation() {
  logAndMockConsole("Simulation has been resumed.");
  simulationIntervalID = setInterval(updateWorld, 1000);

  // Change the button back to a "Stop" button.
  let stopButton = document.getElementById("stop");
  stopButton.textContent = "Stop Simulation";
  stopButton.onclick = stopSimulation;
}

function startSimulation(event) {
  // Prevent default form submission.
  event.preventDefault();

  // Get initial infection parameters.
  let infectedMaleCount =
    document.getElementById("infected__males").value || 16;
  if (infectedMaleCount < 0) {
    alert("Infected male count cannot be less than zero.");
    return;
  }
  let infectedFemaleCount =
    document.getElementById("infected__females").value || 32;
  if (infectedFemaleCount < 1) {
    alert(
      "At least one female needs to be infected, or this simulation is pointless."
    );
    return;
  }
  killRate = document.getElementById("kill__rate").value || 0.5;
  if (killRate < 0 || killRate > 1) {
    alert("Kill rate must be between 0 and 1.");
    return;
  }
  rescueRate = document.getElementById("rescue__rate").value || 1;
  if (rescueRate < 0 || rescueRate > 1) {
    alert("Rescue rate must be between 0 and 1.");
    return;
  }

  // Delete form.
  let form = document.getElementById("start__params");
  form.remove();

  // Show mock console.
  mockConsole.style.display = "flex";
  // Show stop button.
  let stopButton = document.getElementById("stop");
  stopButton.style.display = "block";
  // Show plot.
  let plot = document.getElementById("plot");
  plot.style.display = "block";
  let toxinPlot = document.getElementById("toxin__plot");
  toxinPlot.style.display = "block";
  let antitoxinPlot = document.getElementById("antitoxin__plot");
  antitoxinPlot.style.display = "block";
  // Show world.
  let worldCanvas = document.getElementById("world");
  worldCanvas.style.display = "block";
  // Show key.
  let key = document.getElementById("key");
  key.style.display = "flex";

  // Set up the world.
  world.populate();
  for (let i = 0; i < infectedMaleCount; i++) {
    world.infectMale();
  }
  for (let i = 0; i < infectedFemaleCount; i++) {
    world.infectFemale();
  }
  renderWorld();

  // Once per second, update the world.
  simulationIntervalID = setInterval(updateWorld, 1000);
}
