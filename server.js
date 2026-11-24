require("dotenv").config();

const express = require("express");
const path = require("path");

const connectDB = require("./config/db");
const routes = require("./routes");
const donationController = require("./controllers/donationController");
const { errorHandler, notFoundHandler } = require("./middleware/errorHandler");

const app = express();
const PORT = process.env.PORT || 3000;

// ---------- View engine ----------
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// ---------- Global middleware ----------
// CORS: allow all origins (no restriction) — frontend on any port can talk
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, PATCH, DELETE, OPTIONS"
  );
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }

  next();
});

// Webhook must receive raw body BEFORE express.json()
app.post(
  "/donations/webhook",
  express.raw({ type: "application/json" }),
  donationController.webhook
);

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));
app.use("/downloads", express.static(path.join(__dirname, "downloads")));

// ---------- Routes ----------
app.get("/", (req, res) => {
  res.render("home");
});


app.use(routes);

// ---------- 404 + error handling ----------
app.use(notFoundHandler);
app.use(errorHandler);

// ---------- Start ----------
connectDB()
  .then(() => {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch(error => {
    console.error("Database connection failed:", error);
  });
