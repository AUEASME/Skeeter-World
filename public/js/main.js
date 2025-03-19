/*************************
 * SIMULATION PARAMETERS *
 *************************/

let infectedMaleCount = [16];
let infectedFemaleCount = [32];
let killRate = [1.0];
let rescueRate = [1.0];
let duration = [730];
let repeatCount = 3;

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
  // If there are more than 32 children in the mock console, remove the first one.
  while (mockConsole.children.length > 24) {
    mockConsole.removeChild(mockConsole.children[0]);
  }
}

function lockAndKeyMatch(firstArray = [0, 0, 0], secondArray = [0, 0, 0]) {
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
  if (dad.infection.length > 0 && dad.toxins === null) {
    dad.toxins = [];
    for (let i = 0; i < dad.infection.length; i++) {
      // If undefined, skip.
      if (dad.infection[i] === undefined) {
        continue;
      }
      for (let j = 0; j < dad.infection[i].genome.length; j++) {
        if (dad.infection[i].genome[j].type === 0) {
          dad.toxins.push(dad.infection[i].genome[j]);
        }
      }
      for (let j = 0; j < dad.infection[i].plasmids.length; j++) {
        if (dad.infection[i].plasmids[j].type === 0) {
          dad.toxins.push(dad.infection[i].plasmids[j]);
        }
      }
    }
  } else if (dad.infection.length === 0) {
    dad.toxins = [];
  }
  // For each Wolbachia in the mom, for each gene in the genome, if the gene is an antitoxin, add it to the mom's antitoxins.
  // For each Wolbachia in the mom, for each gene in the plasmids, if the gene is an antitoxin, add it to the mom's antitoxins.
  if (mom.infection.length > 0 && mom.antitoxins === null) {
    mom.antitoxins = [];
    for (let i = 0; i < mom.infection.length; i++) {
      // If undefined, skip.
      if (mom.infection[i] === undefined) {
        continue;
      }
      for (let j = 0; j < mom.infection[i].genome.length; j++) {
        if (mom.infection[i].genome[j].type === 1) {
          mom.antitoxins.push(mom.infection[i].genome[j]);
        }
      }
      for (let j = 0; j < mom.infection[i].plasmids.length; j++) {
        if (mom.infection[i].plasmids[j].type === 1) {
          mom.antitoxins.push(mom.infection[i].plasmids[j]);
        }
      }
    }
  } else if (mom.infection.length === 0) {
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
  let reproductiveSuccessOdds = Math.pow(1 - killRate, dad.toxins.length);

  // Clear the toxins and antitoxins arrays.
  dad.toxins = null;
  mom.antitoxins = null;

  return reproductiveSuccessOdds;
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

    // Set the chemical to a random binary string of length 3.
    this.chemical = [0, 0, 0];
    for (let i = 0; i < 3; i++) {
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
      // Generate a random number of genes between 1 and 3.
      let numGenes = Math.floor(Math.random() * 3) + 1;

      for (let i = 0; i < numGenes; i++) {
        this.genome.push(new Gene());
      }
    }

    // Plasmids are mutable — they can be lost during reproduction.
    this.plasmids = [];
    // If random is true, generate a random number of plasmids.
    if (random) {
      // Generate a random int between 1 and 5.
      let numPlasmids = Math.floor(Math.random() * 5) + 1;

      for (let i = 0; i < numPlasmids; i++) {
        this.plasmids.push(new Gene());
      }
    }
  }

  wol_reproduce() {
    // When the bacteria reproduces, the plasmids are split between the two daughter cells.
    // Of course, most bacteria only have about ten plasmids each, so when the mosquitoes reproduce... most Wolbachia would be left with no plasmids.
    // So we'll somehow need to simulate plasmid reproduction...
    // Okay, so reproduce() should take a number as an argument, that being the number of mosquitoes being produced.
    // Then it realistically simulates the cell divisions of Wolbachia to cover all the mosquito offspring.
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

    // Small chance to add or remove a gene (minimum of one gene must be present).
    if (Math.random() < 0.001) {
      if (Math.random() < 0.5 && newWolbachia.genome.length > 1) {
        newWolbachia.genome.pop();
      } else {
        newWolbachia.genome.push(new Gene());
      }
    }

    // Small chance to add or remove a plasmid.
    if (Math.random() < 0.001) {
      if (Math.random() < 0.5 && newWolbachia.plasmids.length > 1) {
        newWolbachia.plasmids.pop();
      } else {
        newWolbachia.plasmids.push(new Gene());
      }
    }

    // Small chance to integrate a plasmid into the genome.
    if (Math.random() < 0.0001) {
      newWolbachia.integrate();
    }

    return newWolbachia;
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
  constructor(maternalInfection, dad, mom) {
    // this.sex can be 0 (female) or 1 (male).
    this.sex = Math.round(Math.random());
    // this.infection is a (potentially empty) array of Wolbachia.
    this.infection = [];
    // If an infection is passed in, duplicate it for this mosquito.
    if (maternalInfection !== undefined && maternalInfection.length > 0) {
      for (let i = 0; i < maternalInfection.length; i++) {
        this.infection.push(maternalInfection[i].wol_reproduce());
      }

      // Extremely slim chance for a Wolbachia to duplicate or be lost.
      if (Math.random() < 0.001) {
        // Randomly choose a Wolbachia from the infection.
        let randomWolbachia =
          this.infection[Math.floor(Math.random() * this.infection.length)];
        // Either make a copy of the Wolbachia or remove it.
        if (Math.random() < 0.5) {
          this.infection.push(randomWolbachia.wol_reproduce());
        } else {
          this.infection = this.infection.filter((w) => w !== randomWolbachia);
        }
      }

      // Extremely slim chance for one conjugation event.
      if (Math.random() < 0.001 && this.infection.length > 1) {
        // Randomly choose a Wolbachia from the infection.
        let randomWolbachia =
          this.infection[Math.floor(Math.random() * this.infection.length)];
        // Conjugate with a random Wolbachia from the infection.
        randomWolbachia.conjugate(
          this.infection[Math.floor(Math.random() * this.infection.length)]
        );
      }
    }

    // Generate a random fitness value.
    this.fitness = 0.0;

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
    this.successes = 0;
  }

  ageUp() {
    this.age++;
    // Male mosquitoes live for about eighteen days, and fourteen of those are spend growing, so for each subsequent day, they have a 1/4 chance of dying.
    if (this.sex === 1 && this.age > 14 && Math.random() < 0.25) {
      // Kill self.
      let currentCell = this.position;
      world.map[currentCell.y][currentCell.x] = world.map[currentCell.y][
        currentCell.x
      ].filter((m) => m !== this);
    }

    // Females, on the other hand, live about 40 days after reaching maturity, so... they have a 1/40 chance of dying each day.
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
    } else {
      this.sex = 0;
    }
  }

  changeInfectionStatus() {
    if (this.infection.length === 0) {
      this.infection = [new Wolbachia(true)];
    } else {
      this.infection = [];
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
    let numberOfEggs = Math.floor(Math.random() * 100) + 1;
    let toxinStatus = evaluateToxinStatus(dad, mom);
    let successCount = 0;

    for (let i = 0; i < numberOfEggs; i++) {
      // If the father is infected, we need to determine if the sperm survives.
      // Need to match the toxins in the dad with the antitoxins in the mom and determine if the sperm survives.
      if (
        (dad.infection.length !== 0 && Math.random() < toxinStatus) ||
        dad.infection.length === 0
      ) {
        // Sperm survives.
        // Paternal infections AREN'T passed on in nature, according to Turelli '94, so we don't need to do a mixed infection.
        let child = new Mosquito(mom.infection, dad, mom);
        world.map[currentCell.y][currentCell.x].push(child);
        child.position = currentCell;
        successCount++;
      }
    }

    this.successes = successCount / numberOfEggs;
    mate.successes = successCount / numberOfEggs;
    this.fitness = (this.fitness + successCount / numberOfEggs) / 2;
    mate.fitness = (mate.fitness + successCount / numberOfEggs) / 2;
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
      (m) => m.sex === 1 && m.infection.length === 0
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
      (m) => m.sex === 0 && m.infection.length === 0
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
      (m) => m.sex === 1 && m.infection.length > 0
    );

    // Get all unique toxins produced inside that male.
    let lengths = [];
    for (let i = 0; i < males.length; i++) {
      let toxins = new Set();
      for (let j = 0; j < males[i].infection.length; j++) {
        // If undefined, skip.
        if (males[i].infection[j] === undefined) {
          continue;
        }
        for (let k = 0; k < males[i].infection[j].genome.length; k++) {
          if (males[i].infection[j].genome[k].type === 0) {
            toxins.add(males[i].infection[j].genome[k].chemical);
          }
        }
        for (let k = 0; k < males[i].infection[j].plasmids.length; k++) {
          if (males[i].infection[j].plasmids[k].type === 0) {
            toxins.add(males[i].infection[j].plasmids[k].chemical);
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
      (m) => m.sex === 0 && m.infection.length > 0
    );

    // Get all unique antitoxins produced inside each male.
    let lengths = [];
    for (let i = 0; i < females.length; i++) {
      let antitoxins = new Set();
      for (let j = 0; j < females[i].infection.length; j++) {
        // If undefined, skip.
        if (females[i].infection[j] === undefined) {
          continue;
        }
        for (let k = 0; k < females[i].infection[j].genome.length; k++) {
          if (females[i].infection[j].genome[k].type === 0) {
            antitoxins.add(females[i].infection[j].genome[k].chemical);
          }
        }
        for (let k = 0; k < females[i].infection[j].plasmids.length; k++) {
          if (females[i].infection[j].plasmids[k].type === 0) {
            antitoxins.add(females[i].infection[j].plasmids[k].chemical);
          }
        }
      }
      lengths.push(antitoxins.size);
    }

    // Return the average number of unique antitoxins.
    return lengths.reduce((acc, l) => acc + l, 0) / lengths.length;
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
        if (mosquito.infection.length === 0) {
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

function mosquitoDay(population) {
  // Sort mosquitoes by fitness (lowest first).
  // population.sort((a, b) => a.fitness - b.fitness);

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
      mosquito.breedingCooldown === 0 &&
      mosquito.age > 14
    ) {
      let eligibleMales = males[currentCell.y][currentCell.x].filter(
        (m) => m.age > 14
      );
      if (eligibleMales.length > 0) {
        let mate = kTournamentWithReplacement(eligibleMales);
        mosquito.reproduce(mate);
      }
    }

    // Age mosquito.
    mosquito.ageUp();
  }
}

function kTournamentWithReplacement(eligibleMales, k = 3) {
  // Select three males at random.
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
  // Update infection plot.
  let uninfectedCount = allMosquitoes.filter(
    (m) => m.infection.length === 0
  ).length;
  let infectedCount = allMosquitoes.filter(
    (m) => m.infection.length !== 0
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
      allMosquitoes.filter((m) => m.infection.length !== 0).length
    } of whom are infected by Wolbachia.`
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

  logAndMockConsole(`Day ${generation + 1} has ended.`);

  // Update the plot.
  updatePlot(generation + 1);
  generation += 1;
}

function shouldStopSimulation() {
  // Check if infection has been eradicated.
  let infectedMosquitoes = allMosquitoes.filter((m) => m.infection.length > 0);
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
    marker: { color: "HotPink" },
  };
  trace3 = {
    x: [],
    y: [],
    name: "Average Toxin Count in Each Male",
    type: "scatter",
    mode: "lines",
    marker: { color: "blue" },
  };
  trace4 = {
    x: [],
    y: [],
    name: "Average Antitoxin Count in Each Female",
    type: "scatter",
    mode: "lines",
    marker: { color: "green" },
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
    // Convert to integer.
    infectedMaleCount = infectedMaleCount.map((c) => parseInt(c));
  }
  for (let i = 0; i < infectedMaleCount.length; i++) {
    if (infectedMaleCount[i] < 0) {
      alert("Infected male count cannot be less than zero.");
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
    // Convert to integer.
    infectedFemaleCount = infectedFemaleCount.map((c) => parseInt(c));
  }
  for (let i = 0; i < infectedFemaleCount.length; i++) {
    if (infectedFemaleCount[i] < 0) {
      alert("Infected male count cannot be less than zero.");
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
    for (let i = 0; i < experiment.infectedMalesAtStart; i++) {
      world.infectMale();
    }
    for (let i = 0; i < experiment.infectedFemalesAtStart; i++) {
      world.infectFemale();
    }
    killRate = experiment.killRate;
    rescueRate = experiment.rescueRate;
    renderWorld();

    // Run the simulation.
    while (!shouldStopSimulation() && generation < experiment.maxDays) {
      // Update the experiment data.
      experiment.infectionRatio.push(
        allMosquitoes.filter((m) => m.infection.length !== 0).length /
          allMosquitoes.length
      );
      experiment.averageToxinCountInMales.push(
        world.getAverageToxinCountInMales()
      );
      experiment.averageAntitoxinCountInFemales.push(
        world.getAverageAntitoxinCountInFemales()
      );
      experiment.reproductiveSuccessOverTime.push(
        // Get the average reproductive success of all mosquitoes.
        allMosquitoes.reduce((acc, m) => acc + m.successes, 0) /
          allMosquitoes.length
      );
      // Update the world.
      updateWorld();
      // Sleep for a quarter of a second.
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
    this.infectedMalesAtStart = 16;
    this.infectedFemalesAtStart = 32;
    this.toxinAntitoxinLength = 3;
    this.killRate = 1;
    this.rescueRate = 1;
    this.maxDays = 730;
    // Run data.
    this.infectionRatio = [];
    this.averageToxinCountInMales = [];
    this.averageAntitoxinCountInFemales = [];
    this.reproductiveSuccessOverTime = [];
  }

  outputData() {
    let allData = {
      startTime: this.startTime,
      infectedMalesAtStart: this.infectedMalesAtStart,
      infectedFemalesAtStart: this.infectedFemalesAtStart,
      toxinAntitoxinLength: this.toxinAntitoxinLength,
      killRate: this.killRate,
      rescueRate: this.rescueRate,
      simulationLength: generation,
      infectionRatio: this.infectionRatio,
      averageToxinCountInMales: this.averageToxinCountInMales,
      averageAntitoxinCountInFemales: this.averageAntitoxinCountInFemales,
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
