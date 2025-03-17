import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app
  .use(express.static(path.join(__dirname, "public")))
  .set("views", path.join(__dirname, "views"))
  .set("view engine", "ejs");

app.get("/", (req, res) => {
  res.render("index", { title: "Skeeter World" });
});
app.get("/experiments", (req, res) => {
  res.render("experiments", { title: "Experiments" });
});
app.get("/readme", (req, res) => {
  res.render("readme", { title: "Readme" });
});
app.get("/about", (req, res) => {
  res.render("about", { title: "About" });
});

app.listen(3000, () => {
  console.log("Skeeter World is running at http://localhost:3000/.");
});
