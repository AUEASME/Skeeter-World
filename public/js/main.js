/********************
 * HELPER FUNCTIONS *
 ********************/

function logAndMockConsole(text) {
  console.log(text);

  // Get #mock__console div.
  let mockConsole = document.getElementById("mock__console");
  // Create a new paragraph element.
  let p = document.createElement("p");
  // Set the text content of the paragraph element to the text passed in.
  let currentTime = new Date().toLocaleTimeString();
  p.textContent = `[${currentTime}] ${text}`;
  // Append the paragraph element to the mock console.
  mockConsole.appendChild(p);
  // If there are more than 32 children in the mock console, remove the first one.
  while (mockConsole.children.length > 32) {
    mockConsole.removeChild(mockConsole.children[0]);
  }

  // Scroll the mock console to the bottom.
  mockConsole.scrollTop = mockConsole.scrollHeight;
}

/*******************
 * WOLBACHIA CLASS *
 *******************/

class Wolbachia {
  constructor(killRate, rescueRate, symbioteRate, selfMutationRate) {
    if (killRate === undefined) {
      this.killRate = Math.random();
    } else {
      this.killRate = killRate;
    }

    if (rescueRate === undefined) {
      this.rescueRate = Math.random();
    } else {
      this.rescueRate = rescueRate;
    }

    if (symbioteRate === undefined) {
      this.symbioteRate = 0.5 + Math.random();
    } else {
      this.symbioteRate = 1.0 + symbioteRate;
    }

    if (selfMutationRate === undefined) {
      this.selfMutationRate = Math.random();
    } else {
      this.selfMutationRate = selfMutationRate;
    }
  }
}

/**************************************
 * MOSQUITO CLASS, METHODS, AND SETUP *
 **************************************/

class Mosquito {
  constructor(infected, dad_fitness, mom_fitness) {
    // this.sex can be 0 (female) or 1 (male).
    this.sex = Math.round(Math.random());
    // this.infected can be 0 (not infected) or 1 (infected).
    if (infected === undefined || infected === 0) {
      this.infected = 0;
    } else {
      // Make a copy of the Wolbachia object passed in.
      this.infected = new Wolbachia(
        infected.killRate,
        infected.rescueRate,
        infected.symbioteRate,
        infected.selfMutationRate
      );

      if (infected.selfMutationRate < Math.random()) {
        // Modulate killRate by .01 in either direction.
        this.infected.killRate += Math.random() * 0.02 - 0.01;
        // Modulate rescueRate by .01 in either direction.
        this.infected.rescueRate += Math.random() * 0.02 - 0.01;
        // Modulate symbioteRate by .01 in either direction.
        this.infected.symbioteRate += Math.random() * 0.02 - 0.01;
      }
    }
    // this.fitness is the average of the fitness of the parents.
    this.fitness = Math.random();
    if (dad_fitness && mom_fitness) {
      this.fitness = (dad_fitness + mom_fitness) / 2;
    }
    if (this.infected !== 0) {
      this.fitness = this.infected.symbioteRate;
    }
    this.position = { x: 0, y: 0 };
  }

  changeSex() {
    if (this.sex === 0) {
      this.sex = 1;
    } else {
      this.sex = 0;
    }
  }

  changeInfectionStatus(killRate, rescueRate, symbioteRate, selfMutationRate) {
    if (this.infected === 0) {
      this.infected = new Wolbachia(
        killRate,
        rescueRate,
        symbioteRate,
        selfMutationRate
      );
    } else {
      this.infected = 0;
    }
  }

  getCurrentPosition() {
    // Search the map for the cell containing this mosquito.
    return this.position;
  }

  migrate() {
    // Check if any neighboring cell has fewer mosquitoes. If it does, move there.
    let currentCell = this.getCurrentPosition();
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
    let currentCell = this.getCurrentPosition();
    // If both parents are infected, the child has a mom.infection.rescueRate chance of surviving, in which case it inherits one of the parents' infections.
    // If the dad is infected but the mom is not, the child has a dad.infection.killRate chance of immediately dying, otherwise it inherits the dad's infection.
    // If the mom is infected but the dad is not, the child survives, but inherits the mom's infection.
    // If neither parent is infected, the child survives no matter what.
    // Child fitness is the average of the parents' fitness.
    let dad = mate,
      mom = this;
    // If both parents are infected…
    if (dad.infected !== 0 && mom.infected !== 0) {
      if (Math.random() < mom.infected.rescueRate) {
        // Flip a coin to decide which parent's infection to inherit.
        let coin = Math.random();
        let childInfection;
        if (coin < 0.5) {
          childInfection = dad.infected;
        } else {
          childInfection = mom.infected;
        }
        let child = new Mosquito(childInfection, dad.fitness, mom.fitness);
        world.map[currentCell.y][currentCell.x].push(child);
        child.position = currentCell;
        allMosquitoes.push(child);
      }
    }
    // If the dad is infected but the mom is not…
    else if (dad.infected !== 0 && mom.infected === 0) {
      if (Math.random() < dad.infected.killRate) {
        return;
      }
      let child = new Mosquito(dad.infected, dad.fitness, mom.fitness);
      world.map[currentCell.y][currentCell.x].push(child);
      child.position = currentCell;
      allMosquitoes.push(child);
      return;
    }
    // If the mom is infected but the dad is not…
    else if (dad.infected === 0 && mom.infected !== 0) {
      let child = new Mosquito(mom.infected, dad.fitness, mom.fitness);
      world.map[currentCell.y][currentCell.x].push(child);
      child.position = currentCell;
      allMosquitoes.push(child);
      return;
    } else {
      // If neither parent is infected…
      let child = new Mosquito(0, dad.fitness, mom.fitness);
      world.map[currentCell.y][currentCell.x].push(child);
      child.position = currentCell;
      allMosquitoes.push(child);
    }
  }
}

let allMosquitoes = [];

/***********************************
 * WORLD CLASS, METHODS, AND SETUP *
 ***********************************/

class World {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.map = new Array(height)
      .fill(0)
      .map(() => new Array(width).fill(0).map(() => []));
  }

  populate() {
    // Add up to twenty mosquitoes to each cell.
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        let numberOfMosquitoes = Math.floor(Math.random() * 20);
        for (let i = 0; i < numberOfMosquitoes; i++) {
          let mosquito = new Mosquito();
          this.map[y][x].push(mosquito);
          mosquito.position = { x, y };
          allMosquitoes.push(mosquito);
        }
      }
    }
  }

  infectMale(killRate, rescueRate, symbioteRate, mutationRate) {
    // Find a random male and infect him.
    let males = allMosquitoes.filter((m) => m.sex === 1 && m.infected === 0);

    if (males.length === 0) {
      // Select a random mosquito and change its sex.
      let randomMosquito =
        allMosquitoes[Math.floor(Math.random() * allMosquitoes.length)];
      randomMosquito.changeSex();
      males = allMosquitoes.filter((m) => m.sex === 1);
    }

    let randomMosquito = males[Math.floor(Math.random() * males.length)];
    randomMosquito.changeInfectionStatus(
      killRate,
      rescueRate,
      symbioteRate,
      mutationRate
    );
  }

  infectFemale(killRate, rescueRate, symbioteRate, mutationRate) {
    // Find a random female and infect her.
    let females = allMosquitoes.filter((m) => m.sex === 0 && m.infected === 0);

    if (females.length === 0) {
      // Select a random mosquito and change its sex.
      let randomMosquito =
        allMosquitoes[Math.floor(Math.random() * allMosquitoes.length)];
      randomMosquito.changeSex();
      females = allMosquitoes.filter((m) => m.sex === 0);
    }

    let randomMosquito = females[Math.floor(Math.random() * females.length)];
    randomMosquito.changeInfectionStatus(
      killRate,
      rescueRate,
      symbioteRate,
      mutationRate
    );
  }
}

// Create world.
let world = new World(12, 12);
let carryingCapacity = 64;

function renderWorld() {
  // Get the canvas element.
  let canvas = document.getElementById("world");
  let context = canvas.getContext("2d");
  let cellSize = 24;
  canvas.width = world.width * cellSize;
  canvas.height = world.height * cellSize;
  // Canvas should be white by default.
  // For each mosquito in each cell, add 1 to the red channel.
  // Also add 1 to the blue channel if the mosquito is infected.
  for (let y = 0; y < world.height; y++) {
    for (let x = 0; x < world.width; x++) {
      let cell = world.map[y][x];
      let red = 255;
      let green = 255;
      let blue = 255;
      for (let mosquito of cell) {
        // Make the cell more red for each mosquito, and more blue if the mosquito is infected.
        green -= 255 / carryingCapacity;
        if (mosquito.infected === 0) {
          blue -= 255 / carryingCapacity;
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

function migrateAll(population) {
  logAndMockConsole("Starting migration phase…");
  // Sort mosquitoes by fitness (lowest first).
  population.sort((a, b) => a.fitness - b.fitness);
  // Migrate and reproduce.
  for (let mosquito of population) {
    mosquito.migrate();
  }
  logAndMockConsole("Migration phase complete.");
}

function reproduceAll(population) {
  logAndMockConsole("Starting reproduction phase…");
  let eligibleMales = population.filter((m) => m.sex === 1);
  let eligibleFemales = population.filter((m) => m.sex === 0);
  while (eligibleFemales.length > 0) {
    let mom = eligibleFemales.pop();
    // Get all mosquitoes in eligibleMales that are in the same cell as mosquito.
    let mates = [];
    for (let male of eligibleMales) {
      if (
        male.position.x === mom.position.x &&
        male.position.y === mom.position.y
      ) {
        mates.push(male);
      }
    }
    if (mates.length > 0) {
      // Get the male with the highest fitness.
      mates.sort((a, b) => b.fitness - a.fitness);
      let dad = mates[0];
      mom.reproduce(dad);
    }
  }
  delete eligibleMales;
  delete eligibleFemales;
  logAndMockConsole("Reproduction phase complete.");
}

function updateWorld() {
  logAndMockConsole(
    `There are currently ${allMosquitoes.length} mosquitoes, ${
      allMosquitoes.filter((m) => m.infected !== 0).length
    } of whom are infected by Wolbachia.`
  );

  // Migration phase.
  migrateAll(allMosquitoes);

  // Reproduction phase.
  reproduceAll(allMosquitoes);

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

  if (shouldStopSimulation()) {
    logAndMockConsole("Simulation has ended.");

    // Stop the simulation.
    clearInterval(simulationIntervalID);
  }
}

function shouldStopSimulation() {
  // Check if infection has been eradicated.
  let infectedMosquitoes = allMosquitoes.filter((m) => m.infected !== 0);
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

function startSimulation(event) {
  // Prevent default form submission.
  event.preventDefault();

  let formCapacity = document.getElementById("capacity").value || 64;
  if (formCapacity < 1) {
    alert("Carrying capacity must be at least 1.");
    return;
  } else if (formCapacity !== carryingCapacity) {
    carryingCapacity = formCapacity;
  }

  let infectedMaleCount = document.getElementById("infected__males").value || 0;
  if (infectedMaleCount < 0) {
    alert("Infected male count cannot be less than zero.");
    return;
  }
  let infectedFemaleCount =
    document.getElementById("infected__females").value || 10;
  if (infectedFemaleCount < 1) {
    alert(
      "At least one female needs to be infected, or this simulation is pointless."
    );
    return;
  }

  let killRate = document.getElementById("kill__rate").value || undefined;
  if (killRate > 1 || killRate < 0) {
    alert("Kill rate must be between 0 and 1.");
    return;
  }
  let rescueRate = document.getElementById("rescue__rate").value || undefined;
  if (rescueRate > 1 || rescueRate < 0) {
    alert("Rescue rate must be between 0 and 1.");
    return;
  }
  let symbioteRate =
    document.getElementById("symbiote__rate").value || undefined;
  if (symbioteRate > 1 || symbioteRate < -1) {
    alert("Symbiote rate must be between -1 and 1.");
    return;
  } else {
    // Divide by 2 so that the rate is between -0.5 and 0.5.
    symbioteRate /= 2;
  }
  let mutationRate =
    document.getElementById("mutation__rate").value || undefined;
  if (mutationRate > 1 || mutationRate < 0) {
    alert("Mutation rate must be between 0 and 1.");
    return;
  }
  // Delete form.
  let form = document.getElementById("start__params");
  form.remove();

  // Show mock console.
  let mockConsole = document.getElementById("mock__console");
  mockConsole.style.display = "flex";
  // Show world.
  let worldCanvas = document.getElementById("world");
  worldCanvas.style.display = "block";

  world.populate();
  for (let i = 0; i < infectedMaleCount; i++) {
    world.infectMale(killRate, rescueRate, symbioteRate, mutationRate);
  }
  for (let i = 0; i < infectedFemaleCount; i++) {
    world.infectFemale(killRate, rescueRate, symbioteRate, mutationRate);
  }

  renderWorld();
  // Once per second, update the world.
  simulationIntervalID = setInterval(updateWorld, 1000);
}
