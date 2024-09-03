# 8/8/2024 Meeting

Sterilization of the sperm of insects -- run by a two-gene system, one is a toxin, the other is an antidote.

- Uninfected male and females will not be infected.
- Uninfected male and infected females will produce fertile, infected children.
- Infected male and uninfected female will produce unviable children (they die).
- If male and female are both infected, the antidote fixes the infected male's sperm, and the embryos survive.

Wolbachia-infected females have an advantage, but Wolbachia _wants_ to infect everyone.

How did the CI system evolve in the first place? If an infected male joins a new population, its genes will just die out, and Wolbachia with it. Threshold of where Wolbachia becomes advantageous for the reproducing individuals. When does CI kick in? Can we model this with an EA?

When the population is 98-100% fixated, there's no advantage to sterilizing sperm anymore. No more selective pressure. Genes start to collapse, and CI rates _should_ go down, resulting in an oscillating pattern?

EA would model a population of insects. Parameters:

- Infected or not infected individuals
- CI induction rates: sperm kill rate of 50% vs kill rate of 99%?
- Rescue rates: antidote might not always work!
- Migration rates (if simulating geography)
- Population of Wolbachia within each insect
  - Unique operon for toxin and antidote
  - Toxin 1, efficiency of 99%, etc.
  - Toxins and antidotes evolve
  - Fitness benefit of Wolbachia itself -- some strains are mutualistic! Can be negative, 0, or positive.
  - Kill rate, rescue rate, binding rate.
  - Make a little genome, discretely model multiple toxins/genes.
- Random mating choice or not?

Is geography important? Set up a grid system for a simulation. Each grid square has a population of insects. Watch how infection spreads. Maybe geographical factors create situations that select for CI. Maybe there are ecological barriers?

Which parameters dictate periodicity?

Is there an intron component? Could genes be inactive? Induction rate is the kill ratio. Efficiency of enzyme. Rescue rate is judged by quality of binding between toxin and antidote (could be an EASME project there, and make that a parameter). Well, bacteria don't do introns.

When the antidote is bound, it's being "held inactive." Target degradation of the antidote. How did the genes organize themselves in the first place? Chicken/egg paradox. You don't want to kill your host! System requires to things to evolve simultaneously.

**Make it was a sexual thing? Maybe two bacteria merged?** Was the antidote originally an antidote to something _external?_

**Question:** What are the conditions that cause CI to establish from 0 to the threshold (at which CI becomes advantageous), and then the max? And what are the conditions that cause CI to spread geographically?

Algebraic model suggests selective regimen for CI never increases CI rates inside the insect? When at the max rate, do we go up or down? If CI keeps spreading, algebraic model is *in*valid.

This is a complicated "seeded" system. Wolbachia has its own fitness and a fitness effect on the _insect_. Competitive co-evolution, maybe?

**Web GUI!**

How many wolbachia per insect? Each Wolbachia has a small genome that's trying to assemble some combination of toxins and antidotes. Don't bother with protein sequences, though. Each gene just has an array of values.

Bacteria have epigenetics! Methylation levels and... some other level. This would be at the gene level. Methylation shuts genes off, and promoter mutations can increase expression. Most promoters are like dimmers -- not just on or off. Maybe rescue is just more antidote than toxin?

Brandon... Cooper? Famous evolutionist. "Inherited" CI evolution stuff. Also consider Joe from the other CI paper. More of a pathogenesis guy.

What is the _simplest_ experiment we could do to get started? Maybe... **How does the periodicity develop after the threshold is reached?** Just model the grid system and the insects, along with whether they're infected. Pretend all Wolbachia have 100% induction and rescue. Can we replicate population fixation? Maybe just one grid box. How many insects do you need in _one_ grid box to get periodicity? What gets to a stable state, what gets to periodicty, etc.? Grid makes it a diffusion EA with delays and such.

Eventually reconnect to EASME by mapping actual gene system to population models. If they don't match up, find the source of the difference.

# My Thoughts

Fitness determines mean number of children (per unit of blood?). Fitness also determines share of local blood supply each step. Some blood is consumed each step?

For mate selection: rank all by fitness, then each unpaired female chooses the best male.

Weight neighboring grid areas to define a direction for potential movement. Use difference between these and present grid to determine if we should move. Fitness could determine "accuracy" (standard deviation allowance).

Blood in an area is a limited resource. Water is also a percentage for each area that modulates offspring survival (fitness × water = survival chance). Adult and baby survival are calculated separately, and babies take a generation to grow up.

https://eperezcosano.github.io/hex-grid/
https://www.redblobgames.com/grids/hexagons/
