const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const feedRoutes = require("./routes/feed");
const authRoutes = require("./routes/auth");
const io = require("./socket");
const corsMiddleware = require("./middleware/cors");
const path = require("path");
const multer = require("multer");
const { randomUUID } = require("crypto");
const app = express();

const fileStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "images");
  },
  filename: (req, file, cb) => {
    cb(null, randomUUID() + "-" + file.originalname);
  },
});

const fileFilter = (req, file, cb) => {
  const acceptedMimetypes = ["image/png", "image/jpg", "image/jpeg"];
  if (
    acceptedMimetypes.findIndex((mimetype) => mimetype === file.mimetype) >= 0
  ) {
    cb(null, true);
  } else {
    cb(null, false);
  }
};

app.use(bodyParser.json());
app.use(
  multer({ storage: fileStorage, fileFilter: fileFilter }).single("image")
);
app.use("/images", express.static(path.join(__dirname, "images")));

// --- SET CORS HEADERS --- //
app.use(corsMiddleware);

app.use("/feed", feedRoutes);
app.use("/auth", authRoutes);

app.use((error, req, res, next) => {
  console.log(error);
  const status = error.statusCode;
  const message = error.message;
  res.status(status).json({
    message: message,
  });
});

mongoose.set("strictQuery", true);

mongoose
  .connect(
    "mongodb+srv://mongotest:mongotest@cluster0.oxhsijr.mongodb.net/test2"
  )
  .then(() => {
    const server = app.listen(8888);
    const io_connection = io.init(server);
    io_connection.on("connection", (socket) => {
      console.log("Client connected");
    });
  })
  .catch((err) => {
    console.log(err);
  });
