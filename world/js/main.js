/*************************
 * SIMULATION PARAMETERS *
 *************************/

// Immutable parameters.
let days = 730;
// World initialization parameters.
let infectedMalePercents = [0.25];
let infectedFemalePercents = [0.25];
// Infection parameters.
let ciKillRates = [1.0];
let currentciKillRate = null;
let ciRescueRates = [1.0];
let currentciRescueRate = null;
let minFitnessModifiers = [-1.0];
let maxFitnessModifiers = [1.0];
let currentFitnessModifierRange = null;
let minInfectionDensities = [0.0];
let maxInfectionDensities = [1.0];
let currentInfectionDensityRange = null;
let repeatCount = 1;

// Maternal transmission rates *and* fitness modifiers are an emergent property of endosymbiont densities in host tissues.
// Density may be a factor that EXACERBATES positive OR negative fitness effects.
// Spectrum between:
//   parasitism                     <-->                     mutualism
//   fitness decrease               <-->              fitness increase
//   wol. fitness increase          <-->         wol. fitness decrease
//   high rep. manipulation         <-->         low rep. manipulation
//   short evolutionary time scale  <-->  long evolutionary time scale
// Fitness modifiers:
//   reproductive output (negative)
//   nutrition for host (longevity-boosting)
// Maybe a female should have to bite a human over land, THEN move to water to lay the eggs.

// Make JSON downloads toggleable (checkbox on main menu).

// Does a pair of infected individuals generally produce the same number of viable offspring as a pair of uninfected individuals?

/**
 * TO-DO FOR PUBLISHING:
 * 0. DONE: Need to implement blood-drinking — a mosquito shouldn't be able to stay over water forever. Before it reproduces, it needs to drink blood on land.
 * 1. DONE: Re-implement lock-and-key mechanism for compatibility between different Wolbachia strains.
 * 2. Implement some form of migration logging, so we can determine if different regions of fixation have unique properties.
 *    i. Maybe it would be easier to group similar Wolbachia strains into species, and track species proportion.
 *    ii. But what would be the cutoff for species differentiation?
 *    iii. It's a high-dimensional space, so we could just log ALL the properties of each Wolbachia strain in the population at each time step. But that's a LOT of data.
 *    iv. Is [this](https://www.nature.com/articles/s41467-021-26752-4) what Nick meant by gravity model for mobility?
 * 3. "Stretch goal": Implement a toxic amino acid analogue that is present in some cells of the world, and a corresponding transporter that can be either adaptive or deleterious depending on the presence of the analogue. This would allow us to explore the toxin-first route of TA system evolution.
 *    i. A Wolbachia can have an... INTRINSIC fitness benefit to the host, or a contextual benefit to the host (transporting amino acids in a nitrogen-limiting environment), or both.
 *    ii. Same with fitness detriment/selfishness.
 *    iii. We would expect functional fitness benefits to decrease after a TA system evolved, since there's an intrinsic cost in helping the host.
 */

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
    /*************
     * NEW STUFF *
     *************/

    // Generate two random four-bit strings to represent toxin and antitoxin.
    this.toxin = [0, 0, 0, 0];
    for (let i = 0; i < 4; i++) {
      this.toxin[i] = Math.round(Math.random());
    }
    this.antitoxin = [0, 0, 0, 0];
    for (let i = 0; i < 4; i++) {
      this.antitoxin[i] = Math.round(Math.random());
    }

    // For environmental stuff.
    this.transporterEfficiency = Math.random(); // Efficiency of amino acid transporter, from 0.0 to 1.0. Note that this can be harmful OR helpful.
    this.environmentalResistance = Math.random(); // Resistance to environmental toxins, from 0.0 to 1.0. Note that this is EXCLUSIVELY helpful.

    /*************
     * OLD STUFF *
     *************/

    // Wolbachia are defined by a scalar value, currentFitnessModifierRange[0] (probably -1.0) to currentFitnessModifierRange[1] (probably 1.0).
    // this.parasitismMutualismFactor = Math.random() * 2 - 1; // Random value between -1.0 and 1.0.
    this.parasitismMutualismFactor =
      Math.random() *
        (currentFitnessModifierRange[1] - currentFitnessModifierRange[0]) +
      currentFitnessModifierRange[0];
    // Infection density primarily controls the maternal transmission rate of the infection.
    // This is a value between 0.0 and 1.0, first calculated as a random value between minInfectionDensity and maxInfectionDensity.
    this.infectionDensity =
      Math.random() *
        (currentInfectionDensityRange[1] - currentInfectionDensityRange[0]) +
      currentInfectionDensityRange[0];
    // Wolbachia has genes that hijack the cytoskeleton to make maternal transmission happen.
    // This can influence the maternal transmission rate along with infection density.
    // Bill Sullivan studies this.
    this.maternalTransmissionRate = Math.random();
    // If parasite, increase density and maternal transmission rate to increase chance of spreading, at the cost of host fitness.
    if (this.parasitismMutualismFactor < 0) {
      this.infectionDensity = Math.max(
        1.0,
        this.infectionDensity + Math.abs(this.parasitismMutualismFactor) * 0.5,
      );
      this.maternalTransmissionRate = Math.max(
        1.0,
        this.maternalTransmissionRate +
          Math.abs(this.parasitismMutualismFactor) * 0.5,
      );
    }
    // Set ciKillRate and ciRescueRate to the current values.
    this.ciKillRate = currentciKillRate || ciKillRates[0];
    this.ciRescueRate = currentciRescueRate || ciRescueRates[0];
  }

  matchLockAndKey(otherWolbachia) {
    // Calculate Hamming distance between toxin of this and antitoxin of other.
    let similarity = 0;
    for (let i = 0; i < this.toxin.length; i++) {
      if (this.toxin[i] === otherWolbachia.antitoxin[i]) {
        similarity++;
      }
    }
    return similarity / this.toxin.length; // Return a value between 0.0 and 1.0.
  }

  binaryFission() {
    // Create a structured clone of this Wolbachia to represent the inherited infection in the child.
    let clone = structuredClone(this);

    // 1/100 chance to mutate the toxin or antitoxin.
    if (Math.random() < 0.01) {
      if (Math.random() < 0.5) {
        // Mutate toxin by increasing or decreasing by 1 (wrapping around).
        clone.toxin = (this.toxin + (Math.random() < 0.5 ? -1 : 1) + 16) % 16;
      } else {
        // Mutate antitoxin by increasing or decreasing by 1 (wrapping around).
        clone.antitoxin =
          (this.antitoxin + (Math.random() < 0.5 ? -1 : 1) + 16) % 16;
      }
    }

    // 1/100 chance to mutate the parasitismMutualismFactor.
    if (Math.random() < 0.01) {
      clone.parasitismMutualismFactor +=
        (Math.random() < 0.5 ? -1 : 1) * Math.random() * 0.05;
      // Clamp the value to the range [-1.0, 1.0].
      clone.parasitismMutualismFactor = Math.max(
        -1.0,
        Math.min(1.0, clone.parasitismMutualismFactor),
      );
    }

    // 1/100 chance to mutate the infection density by up to 0.01 in either direction.
    if (Math.random() < 0.01) {
      clone.infectionDensity +=
        (Math.random() < 0.5 ? -1 : 1) * Math.random() * 0.01;
      // Clamp the value to the range [0.0, 1.0].
      clone.infectionDensity = Math.max(
        0.0,
        Math.min(1.0, clone.infectionDensity),
      );
    }

    // 1/100 chance to mutate the maternalTransmissionRate by up to 0.05 in either direction.
    if (Math.random() < 0.01) {
      clone.maternalTransmissionRate +=
        (Math.random() < 0.5 ? -1 : 1) * Math.random() * 0.05;
      // Clamp the value to the range [0.0, 1.0].
      clone.maternalTransmissionRate = Math.max(
        0.0,
        Math.min(1.0, clone.maternalTransmissionRate),
      );
    }

    // 1/100 chance to mutate the ciKillRate by up to 0.05 in either direction.
    if (Math.random() < 0.01) {
      clone.ciKillRate += (Math.random() < 0.5 ? -1 : 1) * Math.random() * 0.05;
      // Clamp the value to the range [0.0, 1.0].
      clone.ciKillRate = Math.max(0.0, Math.min(1.0, clone.ciKillRate));
    }

    // 1/100 chance to mutate the ciRescueRate by up to 0.05 in either direction.
    if (Math.random() < 0.01) {
      clone.ciRescueRate +=
        (Math.random() < 0.5 ? -1 : 1) * Math.random() * 0.05;
      // Clamp the value to the range [0.0, 1.0].
      clone.ciRescueRate = Math.max(0.0, Math.min(1.0, clone.ciRescueRate));
    }

    return clone;
  }
}

/**************************************
 * MOSQUITO CLASS, METHODS, AND SETUP *
 **************************************/

class Insect {
  constructor(dad, mom) {
    // this.sex can be 0 (female) or 1 (male).
    this.sex = Math.round(Math.random());
    // Female insects mate only once, storing sperm for their entire lives in specialized organs called spermathecae.
    this.mate = null;
    // this.strains is an array that stores unique Wolbachia infections.
    this.strains = null;
    // If the mother is infected, the child has a chance to inherit the infection.
    if (mom && mom.strains !== null) {
      // Get the infection density of the mother to determine the chance of inheriting the infection.
      let infectionDensity = mom.strains.infectionDensity;
      // Chance of inheriting the infection is proportional to the infection density.
      if (Math.random() < infectionDensity) {
        this.strains = mom.strains.binaryFission();
      }
    }

    // Generate a random fitness value from 0 to 1.
    this.fitness = Math.random();
    // Position is set by outside code.
    this.mapLocation = { x: 0, y: 0 };
    // If this mosquito is the child of two other insects, override the random values.
    if (dad && mom) {
      this.fitness = (dad.fitness + mom.fitness) / 2;
      this.mapLocation = mom.mapLocation;
    }

    if (this.strains !== null) {
      this.fitness +=
        this.strains.parasitismMutualismFactor * this.strains.infectionDensity;
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
    // Mosquitoes need blood meals to reproduce.
    this.blood = 0;

    // Keep track of how many children survived per reproductive event.
    this.breedingSuccesses = 0.0;
  }

  ageUp() {
    this.age++;
    if (this.age > 14 && this.breedingCooldown > 0) {
      this.breedingCooldown--;
    }
    // Male insects live for about eighteen days, and fourteen of those are spend growing, so for each subsequent day, they have a 1/4 chance of dying.
    // Longevity can be influenced by the fitness effect of a Wolbachia infection, however.
    // A fitness modifier of -1.0 decreases survival odds to 0.125, while a fitness modifier of 1.0 increases survival odds to 0.375.
    let survivalOdds = 0.25 + this.strains?.parasitismMutualismFactor / 2;
    if (this.sex === 1 && this.age > 14 && Math.random() < survivalOdds) {
      // Kill self.
      let currentCell = this.mapLocation;
      world.map[currentCell.y][currentCell.x].insects = world.map[
        currentCell.y
      ][currentCell.x].insects.filter((m) => m !== this);
      return;
    }

    // Females, on the other hand, live about 40 days after reaching maturity, so... they have a 1/40 chance of dying each day.
    // Longevity can be influenced by the fitness effect of a Wolbachia infection, however.
    survivalOdds = 0.025 + this.strains?.parasitismMutualismFactor / 40;
    if (this.sex === 0 && this.age > 14 && Math.random() < survivalOdds) {
      // Kill self.
      let currentCell = this.mapLocation;
      world.map[currentCell.y][currentCell.x].insects = world.map[
        currentCell.y
      ][currentCell.x].insects.filter((m) => m !== this);
      return;
    }
  }

  introduceInfection() {
    if (this.strains === null) {
      this.strains = new Wolbachia();
      return;
    }
  }

  canTraverseCell(x, y) {
    let terrainType = world.map[y][x].terrainType;
    if (terrainType === "mountain") {
      return Math.random() < 0.25;
    }
    return true;
  }

  moveToCell(x, y, originalPosition) {
    // Staying put should not require a traversal check.
    if (x === originalPosition.x && y === originalPosition.y) {
      this.mapLocation = { x, y };
      return true;
    }

    if (!this.canTraverseCell(x, y)) {
      return false;
    }

    world.map[originalPosition.y][originalPosition.x].insects = world.map[
      originalPosition.y
    ][originalPosition.x].insects.filter((m) => m !== this);
    world.map[y][x].insects.push(this);
    this.mapLocation = { x, y };
    return true;
  }

  migrate() {
    let originalPosition = { x: this.mapLocation.x, y: this.mapLocation.y };

    // If we still need blood, make sure we're over land.
    if (this.breedingCooldown < 1 && this.blood < 1) {
      // If we're in a water cell, move to the nearest land cell.
      if (
        world.map[this.mapLocation.y][this.mapLocation.x].terrainType ===
        "water"
      ) {
        // Find the nearest land cell.
        let nearestLandCells = [];
        let nearestLandDistance = world.width + world.height; // Max possible distance in the world.
        for (let y = 0; y < world.height; y++) {
          for (let x = 0; x < world.width; x++) {
            if (world.map[y][x].terrainType !== "water") {
              let distance =
                Math.abs(this.mapLocation.x - x) +
                Math.abs(this.mapLocation.y - y);
              if (distance <= nearestLandDistance) {
                // If new record, reset choices array.
                if (distance < nearestLandDistance) {
                  nearestLandCells = [];
                }
                nearestLandDistance = distance;
                nearestLandCells.push({ x, y });
              }
            }
          }
        }
        // Move towards the nearest land cell.
        if (nearestLandCells.length > 0) {
          let nearestLandCell =
            nearestLandCells[
              Math.floor(Math.random() * nearestLandCells.length)
            ];
          let dx = nearestLandCell.x - this.mapLocation.x;
          let dy = nearestLandCell.y - this.mapLocation.y;
          let nextX = this.mapLocation.x;
          let nextY = this.mapLocation.y;
          if (Math.abs(dx) > Math.abs(dy)) {
            if (dx > 0) {
              nextX++;
            } else {
              nextX--;
            }
          } else {
            if (dy > 0) {
              nextY++;
            } else {
              nextY--;
            }
          }
          if (this.moveToCell(nextX, nextY, originalPosition)) {
            return;
          }
        }
      } else {
        // We're already on land, so we can "drink blood" and increase our blood level.
        this.blood = 1;
      }
    }

    // If breeding cooldown is 0, and we're not in a water cell, migrate in the direction of the nearest water cell.
    if (
      this.breedingCooldown < 1 &&
      this.blood > 0 &&
      world.map[this.mapLocation.y][this.mapLocation.x].terrainType !== "water"
    ) {
      // Find the nearest water cell.
      let nearestWaterCells = [];
      let nearestWaterDistance = world.width + world.height; // Max possible distance in the world.
      for (let y = 0; y < world.height; y++) {
        for (let x = 0; x < world.width; x++) {
          if (world.map[y][x].terrainType === "water") {
            let distance =
              Math.abs(this.mapLocation.x - x) +
              Math.abs(this.mapLocation.y - y);
            if (distance <= nearestWaterDistance) {
              if (distance < nearestWaterDistance) {
                nearestWaterCells = [];
              }

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
        let dx = nearestWaterCell.x - this.mapLocation.x;
        let dy = nearestWaterCell.y - this.mapLocation.y;
        let nextX = this.mapLocation.x;
        let nextY = this.mapLocation.y;
        if (Math.abs(dx) > Math.abs(dy)) {
          if (dx > 0) {
            nextX++;
          } else {
            nextX--;
          }
        } else {
          if (dy > 0) {
            nextY++;
          } else {
            nextY--;
          }
        }

        if (this.moveToCell(nextX, nextY, originalPosition)) {
          return;
        }
      }
    }

    // Check if any neighboring cell has fewer insects. If it does, move there.
    let currentCell = this.mapLocation;
    let currentPopulation =
      world.map[currentCell.y][currentCell.x].insects.length;
    let bestCells = [];
    let bestPopulation = currentPopulation;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        let y = currentCell.y + dy;
        let x = currentCell.x + dx;
        if (y >= 0 && y < world.height && x >= 0 && x < world.width) {
          let population = world.map[y][x].insects.length;
          if (population <= bestPopulation) {
            if (population < bestPopulation) {
              bestCells = [];
            }

            bestPopulation = population;
            bestCells.push({ x, y });
          }
        }
      }
    }
    if (bestCells.length > 0) {
      let newCell = bestCells[Math.floor(Math.random() * bestCells.length)];
      if (this.moveToCell(newCell.x, newCell.y, originalPosition)) {
        return;
      }
    }

    // If not breeding, migrate randomly to a neighboring cell.
    if (this.breedingCooldown > 0) {
      let currentCell = this.mapLocation;
      let neighbors = [];
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          let y = currentCell.y + dy;
          let x = currentCell.x + dx;
          if (y >= 0 && y < world.height && x >= 0 && x < world.width) {
            neighbors.push({ x, y });
          }
        }
      }
      if (neighbors.length > 0) {
        let newCell = neighbors[Math.floor(Math.random() * neighbors.length)];
        if (this.moveToCell(newCell.x, newCell.y, originalPosition)) {
          return;
        }
      }
    }
  }

  reproduce(mate) {
    if (!mate) {
      return;
    }

    // Reset breeding cooldown.
    this.breedingCooldown = 4;

    let currentCell = this.mapLocation;
    // If both parents are infected, the child has a ciRescueRate chance of surviving, in which case it inherits mother's infections.
    // If the dad is infected but the mom is not, the child has a ciKillRate chance of immediately dying.
    // If the mom is infected but the dad is not, the child survives, but inherits the mom's infection.
    // If neither parent is infected, the child survives no matter what.
    // Child fitness is the average of the parents' fitness.
    let dad = mate,
      mom = this;

    let numberOfEggs = Math.round(100 * mom.fitness);
    if (dad.strains !== null && mom.strains !== null) {
      numberOfEggs = Math.max(
        Math.floor(
          numberOfEggs *
            (1.0 - dad.strains.ciKillRate * mom.strains.ciRescueRate) *
            // Is this right? If the kill rate is only 50%, then the mom only NEEDS to rescue 50%, so with a 50% rescue rate, the child should have a 75% chance of surviving (50% chance of being killed, then 50% chance of being rescued from that).
            mom.strains.matchLockAndKey(dad.strains),
          // But if 50% of the children don't even need saving, we'd only need to do the matching for half...
        ),
        0,
      );
    } else if (dad.strains !== null && mom.strains === null) {
      numberOfEggs = Math.max(
        Math.floor(numberOfEggs * (1 - dad.strains.ciKillRate)),
        0,
      );
    }

    for (let i = 0; i < numberOfEggs; i++) {
      let child = new Insect(dad, mom);
      if (mom.strains !== null) {
        // Use the mother's infection density to determine the chance of inheriting the infection.
        if (
          Math.random() <
          mom.strains.infectionDensity * mom.strains.maternalTransmissionRate
        ) {
          child.strains = mom.strains.binaryFission();
        }
      }
      world.map[currentCell.y][currentCell.x].insects.push(child);
      child.mapLocation = currentCell;
    }

    this.breedingSuccesses = numberOfEggs;
    mate.breedingSuccesses = numberOfEggs;
    // Need to update this to not incorporate potentially negative fitness values.
    this.fitness = (this.fitness + this.breedingSuccesses / 100) / 2;
    mate.fitness = (mate.fitness + mate.breedingSuccesses / 100) / 2;
  }
}

/***********************************
 * WORLD CLASS, METHODS, AND SETUP *
 ***********************************/

class MapCell {
  constructor() {
    this.location = { x: 0, y: 0 }; // Set by outside code.
    this.terrainType = "grass"; // grass, water, or mountain.
    // A nitrogen-limiting environment severely impacts cellular metabolism, forcing organisms to conserve nitrogen by reducing the overall synthesis of nitrogen-rich amino acids, lowering protein production, and initiating the degradation of existing proteins to recycle nitrogen for essential functions.
    // Source: https://pmc.ncbi.nlm.nih.gov/articles/PMC2686650/
    this.nitrogenInEnvironment = Math.random(); // Amount of nitrogen in the environment, from 0.0 to 1.0.
    // Amino acid transporters can be adaptive in nitrogen-limiting environments, but they can also be deleterious if they import toxic amino acid analogues. So, the ratio of amino acids to toxic analogues in the environment can influence the fitness effect of an amino acid transporter in a nitrogen-poor cell.
    this.aminoAcidsToAnaloguesRatio = Math.random(); // Ratio of amino acids to toxic analogues in this cell, from 0.0 to 1.0. 1.0 means all amino acids, 0.0 means all toxic analogues.
    this.insects = []; // Array of insects currently in this cell.
    this.gravity =
      this.nitrogenInEnvironment *
      this.aminoAcidsToAnaloguesRatio *
      (this.terrainType === "mountain" ? 0.5 : 1.0);
    // Nitrogen in environment times amino acid to analogue ratio times 0.5 if mountain, from 0.0 to 1.0. This is a measure of how attractive this cell is to insects, and can influence migration patterns.
  }
}

class World {
  constructor(width, height, terrainPixels = null) {
    // 0. Get the worldPixels matrix from localStorage.
    let storedPixels = localStorage.getItem("worldPixels");

    // 1. Generate a matrix of MapCell objects to represent the world.
    this.width = width;
    this.height = height;
    this.map = new Array(height)
      .fill(0)
      .map(() => new Array(width).fill(0).map(() => new MapCell()));

    // 2. Set the location of each cell in the map.
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        this.map[y][x].location = { x, y };
      }
    }

    // 3. Update the terrain type of each cell from provided terrain or localStorage.
    let worldPixels = terrainPixels;
    if (worldPixels === null && storedPixels) {
      worldPixels = JSON.parse(storedPixels);
    }

    if (worldPixels) {
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          let terrain = worldPixels?.[y]?.[x];
          if (
            terrain !== "grass" &&
            terrain !== "water" &&
            terrain !== "mountain"
          ) {
            terrain = "grass";
          }
          this.map[y][x].terrainType = terrain;
          this.map[y][x].gravity =
            this.map[y][x].nitrogenInEnvironment *
            this.map[y][x].aminoAcidsToAnaloguesRatio *
            (terrain === "mountain" ? 0.5 : 1.0);
        }
      }
    } else {
      alert(
        "No world pixels found in localStorage. Please generate a world first.",
      );
    }

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

  populate() {
    // Add insects to each cell of the map.
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        for (let i = 0; i < carryingCapacity; i++) {
          let insect = new Insect();
          insect.age = Math.floor(Math.random() * 14);
          insect.breedingCooldown = Math.floor(Math.random() * 4);
          insect.mapLocation = { x: x, y: y };
          this.map[y][x].insects.push(insect);
          // Also add to global list of insects.
          allInsects.push(insect);
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
      let cell = world.map[y][x].insects;
      let red = 255;
      let green = 255;
      let blue = 255;
      for (let insect of cell) {
        if (insect.strains === null) {
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

function insectDay(population) {
  // Make a 2D grid for all the males in the map.
  let males = new Array(world.height)
    .fill(0)
    .map(() => new Array(world.width).fill(0).map(() => []));

  // Assign each male to their cell.
  for (let insect of population) {
    if (insect.sex === 1) {
      let currentCell = insect.mapLocation;
      males[currentCell.y][currentCell.x].push(insect);
    }
  }

  // Randomly shuffle the population array to avoid location-based biases.
  for (let i = population.length - 1; i > 0; i--) {
    let j = Math.floor(Math.random() * (i + 1));
    [population[i], population[j]] = [population[j], population[i]];
  }

  for (let insect of population) {
    // Migrate and reproduce.
    insect.migrate();
    let currentCell = insect.mapLocation;

    // If mosquito is female, reproduce.
    if (
      insect.sex === 0 &&
      insect.breedingCooldown < 1 &&
      insect.age > 14 &&
      world.map[currentCell.y][currentCell.x].terrainType === "water"
    ) {
      let eligibleMales = males[currentCell.y][currentCell.x].filter(
        (m) => m.age > 14,
      );
      if (eligibleMales.length > 0) {
        // Get a random mate.
        let mate = kTournamentWithReplacement(eligibleMales, 3);
        if (mate) {
          insect.reproduce(mate);
        }
      }
    }

    // Age mosquito.
    insect.ageUp();
  }
}

function kTournamentWithReplacement(eligibleMales, k = 3) {
  // Ignore malformed candidates so tournament selection always returns
  // a real insect object or null.
  let validMales = eligibleMales.filter(
    (m) => m !== undefined && m !== null && Number.isFinite(m.fitness),
  );
  if (validMales.length === 0) {
    return null;
  }

  // Select k males at random.
  let selected = [];
  for (let i = 0; i < k; i++) {
    let randomIndex = Math.floor(Math.random() * validMales.length);
    selected.push(validMales[randomIndex]);
  }

  // Sort the males by fitness (highest first).
  selected.sort((a, b) => b.fitness - a.fitness);

  // If there are multiple males with the same highest fitness, randomly select one of them.
  let topFitness = selected[0].fitness;
  let topMales = selected.filter((m) => m.fitness === topFitness);
  if (topMales.length === 0) {
    return selected[0] || null;
  }
  return topMales[Math.floor(Math.random() * topMales.length)];
}

/********************
 * GLOBAL VARIABLES *
 ********************/

// Create world.
let world = new World(36, 36);
let carryingCapacity = 64;

// Populate world.
let allInsects = [];

// Set up logging.
let currentDay = 0;

function updatePlots(currentDay) {
  // Update infection plot.
  let uninfectedCount = allInsects.filter((m) => m.strains === null).length;
  let infectedCount = allInsects.filter((m) => m.strains !== null).length;

  world.traceUninfected.x.push(currentDay);
  world.traceUninfected.y.push(uninfectedCount);
  world.traceInfected.x.push(currentDay);
  world.traceInfected.y.push(infectedCount);

  let layout = {
    title: "Insect Infection Status",
    xaxis: { title: "Day" },
    yaxis: { title: "Insect Count" },
    barmode: "stack",
  };

  Plotly.newPlot("plot", [world.traceUninfected, world.traceInfected], layout);

  world.traceReproduction.x.push(currentDay);
  // Get all insects that have a successes property greater than zero.
  let reproducingInsects = allInsects.filter((m) => m.breedingSuccesses > 0);
  let averageSuccessRate = 0;
  if (reproducingInsects.length > 0) {
    averageSuccessRate =
      reproducingInsects.reduce((sum, m) => sum + m.breedingSuccesses, 0) /
      reproducingInsects.length;
  }
  world.traceReproduction.y.push(averageSuccessRate);

  let layout2 = {
    title: "Reproductive Success Rate Over Time",
    xaxis: { title: "Day" },
    yaxis: { title: "Average Reproductive Success Rate" },
  };

  Plotly.newPlot(
    "reproductive_success_plot",
    [world.traceReproduction],
    layout2,
  );
}

function updateWorld(population) {
  // Insects do their thing.
  insectDay(population);

  // Population control: kill off insects to meet carrying capacity.
  population = [];
  for (let y = 0; y < world.height; y++) {
    for (let x = 0; x < world.width; x++) {
      // Sort insects by fitness.
      world.map[y][x].insects.sort((a, b) => a.fitness - b.fitness);
      // Keep the top carryingCapacity insects.
      world.map[y][x].insects = world.map[y][x].insects.slice(
        0,
        carryingCapacity,
      );
      // Add them to the global list.
      population = population.concat(world.map[y][x].insects);
    }
  }

  renderWorld();

  // Update the plots.
  updatePlots(currentDay + 1);
  currentDay += 1;

  return population;
}

function shouldStopSimulation() {
  // Check if infection has been eradicated.
  let infectedInsects = allInsects.filter((m) => m.strains !== null);
  if (infectedInsects.length === 0) {
    return true;
  }

  // Check if all insects are infected.
  if (infectedInsects.length === allInsects.length) {
    return true;
  }
}

function resetWorld() {
  // Reset all global variables.
  world = new World(36, 36);
  currentDay = 0;
  allInsects = [];
}

function rearrangePage() {
  // Delete form.
  let form = document.getElementById("start__params");
  form.remove();
  let customCan = document.getElementById("can");
  customCan.remove();
  let terrainSelect = document.getElementById("terrain__select");
  terrainSelect.remove();

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
      if (world.map[y][x].terrainType === "grass") {
        // Color land cells green.
        waterContext.fillStyle = "ForestGreen";
      } else if (world.map[y][x].terrainType === "mountain") {
        // Color mountain cells gray.
        waterContext.fillStyle = "SaddleBrown";
      } else {
        // Color water cells blue.
        waterContext.fillStyle = "DarkTurquoise";
      }
      waterContext.fillRect(x * 12, y * 12, 12, 12);
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
  let infectedMalePercentInDocument = document
    .getElementById("infected__males")
    .value.split(",");
  if (
    infectedMalePercentInDocument.length > 0 &&
    infectedMalePercentInDocument[0] !== ""
  ) {
    infectedMalePercents = infectedMalePercentInDocument;
    // Convert to float.
    infectedMalePercents = infectedMalePercents.map((c) => parseFloat(c));
  }
  for (let i = 0; i < infectedMalePercents.length; i++) {
    if (infectedMalePercents[i] < 0 || infectedMalePercents[i] > 1) {
      alert(
        "Infected male count cannot be less than zero or greater than one.",
      );
      return;
    }
  }

  // Get infected females (0.0 to 1.0).
  let infectedFemalePercentInDocument = document
    .getElementById("infected__females")
    .value.split(",");
  if (
    infectedFemalePercentInDocument.length > 0 &&
    infectedFemalePercentInDocument[0] !== ""
  ) {
    infectedFemalePercents = infectedFemalePercentInDocument;
    // Convert to float.
    infectedFemalePercents = infectedFemalePercents.map((c) => parseFloat(c));
  }
  for (let i = 0; i < infectedFemalePercents.length; i++) {
    if (infectedFemalePercents[i] < 0 || infectedFemalePercents[i] > 1) {
      alert(
        "Infected male count cannot be less than zero or greater than one.",
      );
      return;
    }
  }

  // Get ci__kill__rate (0.0 to 1.0).
  let ciKillRateInDocument = document
    .getElementById("ci__kill__rate")
    .value.split(",");
  if (ciKillRateInDocument.length > 0 && ciKillRateInDocument[0] !== "") {
    ciKillRates = ciKillRateInDocument;
    // Convert to float.
    ciKillRates = ciKillRates.map((r) => parseFloat(r));
  }
  for (let i = 0; i < ciKillRates.length; i++) {
    if (ciKillRates[i] < 0 || ciKillRates[i] > 1) {
      alert("Kill rate must be between 0 and 1.");
      return;
    }
  }

  // Get ci__rescue__rate (0.0 to 1.0).
  let ciRescueRateInDocument = document
    .getElementById("ci__rescue__rate")
    .value.split(",");
  if (ciRescueRateInDocument.length > 0 && ciRescueRateInDocument[0] !== "") {
    ciRescueRates = ciRescueRateInDocument;
    // Convert to float.
    ciRescueRates = ciRescueRates.map((r) => parseFloat(r));
  }
  for (let i = 0; i < ciRescueRates.length; i++) {
    if (ciRescueRates[i] < 0 || ciRescueRates[i] > 1) {
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

class Experiment {
  constructor() {
    // Start data.
    this.startTime = new Date();
    this.strainsMalesAtStart = 0.25;
    this.strainsFemalesAtStart = 0.25;
    // Infection data.
    this.ciKillRate = 1.0;
    this.ciRescueRate = 1.0;
    this.maxFitnessDetriment = -1.0;
    this.maxFitnessBenefit = 1.0;
    this.minInfectionDensity = 0.0;
    this.maxInfectionDensity = 1.0;
    // Run data.
    this.infectionRatio = [];
    this.reproductiveSuccessOverTime = [];
    this.averageParasitismMutualismOverTime = [];
    this.averageFitnessModificationOverTime = [];
    this.maternalTransmissionRateOverTime = [];
  }

  outputData() {
    let allData = {
      // Start data.
      startTime: this.startTime,
      infectedMalesAtStart: this.strainsMalesAtStart,
      infectedFemalesAtStart: this.strainsFemalesAtStart,
      ciKillRate: this.ciKillRate,
      ciRescueRate: this.ciRescueRate,
      // New data.
      minMaternalTransmissionRate: this.minMaternalTransmissionRate,
      maxMaternalTransmissionRate: this.maxMaternalTransmissionRate,
      minFitnessModifier: this.minFitnessModifier,
      maxFitnessModifier: this.maxFitnessModifier,
      // Run data.
      simulationLength: currentDay,
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
    console.log("Experiment data downloaded.");
    // Log finish time.
    console.log(`Finish time: ${new Date().toLocaleString()}`);
  }
}

async function runExperiments(event) {
  // Digest input values.
  getInputValues(event);

  // Keep one immutable terrain map for every experiment in the queue.
  // Read directly from localStorage so the latest map-editor changes are used.
  let fixedTerrainMap = null;
  let storedPixels = localStorage.getItem("worldPixels");
  if (storedPixels) {
    try {
      let parsedPixels = JSON.parse(storedPixels);
      if (
        Array.isArray(parsedPixels) &&
        parsedPixels.length === world.height &&
        parsedPixels.every(
          (row) => Array.isArray(row) && row.length === world.width,
        )
      ) {
        fixedTerrainMap = parsedPixels.map((row) =>
          row.map((terrain) =>
            terrain === "grass" || terrain === "water" || terrain === "mountain"
              ? terrain
              : "grass",
          ),
        );
      }
    } catch (e) {
      console.warn("Could not parse worldPixels from localStorage.", e);
    }
  }

  if (!fixedTerrainMap) {
    fixedTerrainMap = world.map.map((row) =>
      row.map((cell) => cell.terrainType),
    );
  }

  // Ensure the displayed terrain map uses the same fixed map as the simulation.
  world = new World(36, 36, fixedTerrainMap);
  rearrangePage();

  // Create an experiment object for each combination of parameters.
  let experiments = [];
  for (let r = 0; r < repeatCount; r++) {
    for (let infectedMalePercent of infectedMalePercents) {
      for (let infectedFemalePercent of infectedFemalePercents) {
        for (let ciKillRate of ciKillRates) {
          for (let ciRescueRate of ciRescueRates) {
            for (let minFitnessModifier of minFitnessModifiers) {
              for (let maxFitnessModifier of maxFitnessModifiers) {
                for (let minInfectionDensity of minInfectionDensities) {
                  for (let maxInfectionDensity of maxInfectionDensities) {
                    // Create a new experiment.
                    let experiment = new Experiment();
                    experiment.strainsMalesAtStart = infectedMalePercent;
                    experiment.strainsFemalesAtStart = infectedFemalePercent;
                    experiment.ciKillRate = ciKillRate;
                    experiment.ciRescueRate = ciRescueRate;
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

  // Run each experiment.
  for (let experiment of experiments) {
    console.log("Starting new experiment...");
    // Log start time.
    console.log(`Start time: ${new Date().toLocaleString()}`);
    // Set up the world.
    world = new World(36, 36, fixedTerrainMap);
    currentDay = 0;
    allInsects = [];
    world.populate();

    allInsects = [];
    for (let y = 0; y < world.height; y++) {
      for (let x = 0; x < world.width; x++) {
        allInsects = allInsects.concat(world.map[y][x].insects);
      }
    }

    // Set up simulation parameters.
    currentciKillRate = experiment.ciKillRate;
    currentciRescueRate = experiment.ciRescueRate;
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
    let allMales = allInsects.filter((m) => m.sex === 1 && m.strains === null);
    let allFemales = allInsects.filter(
      (m) => m.sex === 0 && m.strains === null,
    );
    allMales.forEach((male) => {
      if (Math.random() < experiment.strainsMalesAtStart) {
        male.introduceInfection();
        male.fitness +=
          male.strains.parasitismMutualismFactor *
          male.strains.infectionDensity;
      }
    });
    allFemales.forEach((female) => {
      if (Math.random() < experiment.strainsFemalesAtStart) {
        female.introduceInfection();
        female.fitness +=
          female.strains.parasitismMutualismFactor *
          female.strains.infectionDensity;
      }
    });

    // Run the simulation.
    while (!shouldStopSimulation() && currentDay < days) {
      allInsects = [];
      for (let y = 0; y < world.height; y++) {
        for (let x = 0; x < world.width; x++) {
          allInsects = allInsects.concat(world.map[y][x].insects);
        }
      }
      // Update the experiment data.
      experiment.infectionRatio.push(
        allInsects.filter((m) => m.strains !== null).length / allInsects.length,
      );
      // Get all insects that have a successes property greater than zero.
      let reproducingInsects = allInsects.filter(
        (m) => m.breedingSuccesses > 0,
      );
      let averageSuccessRate = 0;
      if (reproducingInsects.length > 0) {
        averageSuccessRate =
          reproducingInsects.reduce((sum, m) => sum + m.breedingSuccesses, 0) /
          reproducingInsects.length;
      }
      experiment.reproductiveSuccessOverTime.push(averageSuccessRate);
      // Get the average fitness modification of all infected insects.
      experiment.averageFitnessModificationOverTime.push(
        allInsects
          .filter((m) => m.strains !== null)
          .reduce(
            (acc, m) =>
              acc +
              m.strains.parasitismMutualismFactor * m.strains.infectionDensity,
            0,
          ) / allInsects.filter((m) => m.strains !== null).length,
      );
      experiment.averageParasitismMutualismOverTime.push(
        // Get the average parasitism/mutualism factor of all infected insects.
        allInsects
          .filter((m) => m.strains !== null)
          .reduce((acc, m) => acc + m.strains.parasitismMutualismFactor, 0) /
          allInsects.filter((m) => m.strains !== null).length,
      );
      experiment.maternalTransmissionRateOverTime.push(
        // Get the average maternal transmission skill of all infected insects.
        allInsects
          .filter((m) => m.strains !== null)
          .reduce((acc, m) => acc + m.maternalTransmissionRate, 0) /
          allInsects.filter((m) => m.strains !== null).length,
      );
      // Update the world.
      allInsects = updateWorld(allInsects);
      // Sleep for a fifth of a second.
      // This allows the browser time to handle user requests, such as scrolling, which get laggy if the simulation never takes a break.
      await new Promise((r) => setTimeout(r, 100));
    }

    // Once the simulation is complete, output the data.
    experiment.outputData();
  }

  // Reload the page.
  window.location.reload();
}
