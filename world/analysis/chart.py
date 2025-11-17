import glob
import json
import matplotlib.pyplot as plt

# Get the list of all files in the current directory.
files = glob.glob("experiment_*.json")

# Read the data from all files.
data = []
for file in files:
    with open(file) as f:
        data.append(json.load(f))

# Create a 2D scatter plot charting killRate vs. rescueRate vs. max(infectionRatio), with the infectionRatio determining the size of the points.
fig = plt.figure()

x = []
y = []
s = []
colors = []
max_size = 0
for experiment in data:
    if max(experiment["infectionRatio"]) < 0.125:
        continue
    x.append(experiment["killRate"])
    y.append(experiment["rescueRate"])
    s.append(max(experiment["infectionRatio"]))
    max_size = max(max_size, max(experiment["infectionRatio"]))

for experiment in data:
    if max(experiment["infectionRatio"]) < 0.125:
        continue
    if max(experiment["infectionRatio"]) > (max_size / 2):
        colors.append("red")
    elif max(experiment["infectionRatio"]) > (max_size / 4):
        colors.append("orange")
    elif max(experiment["infectionRatio"]) > (max_size / 8):
        colors.append("gold")
    else:
        colors.append("limegreen")

plt.scatter(x, y, s=[1000 * (size / max_size) for size in s], alpha=0.5, c=colors)

plt.xlabel("Kill Rate")
plt.ylabel("Rescue Rate")
plt.title("Kill Rate vs. Rescue Rate vs. Max Infection Ratio")

plt.show()
