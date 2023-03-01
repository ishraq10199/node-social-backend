const path = require("path");
const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const corsMiddleware = require("./middleware/cors");
const multer = require("multer");
const { randomUUID } = require("crypto");
const auth = require("./middleware/auth");
const { graphqlHTTP } = require("express-graphql");
const graphqlSchema = require("./graphql/schema");
const graphqlResolver = require("./graphql/resolvers");
const { clearImage } = require("./utils/file");
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

app.use(auth);

app.put("/post-image", (req, res, next) => {
  if (!req.isAuth) {
    throw new Error("Not authenticated.");
  }
  if (!req.file) {
    return res.status(200).json({ message: "No file provided." });
  }
  if (req.body.oldPath) {
    clearImage(req.body.oldPath);
  }
  const windowsCorrectedFilePath = req.file.path.replace("\\", "/");

  return res
    .status(201)
    .json({ message: "File stored", filePath: windowsCorrectedFilePath });
});

app.use(
  "/graphql",
  graphqlHTTP({
    schema: graphqlSchema,
    rootValue: graphqlResolver,
    graphiql: true,
    customFormatErrorFn(err) {
      if (!err.originalError) {
        return err;
      }
      const data = err.originalError.data;
      const message = err.message || "An error occured.";
      const code = err.originalError.code || 500;

      return { message: message, status: code, data: data };
    },
  })
);

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
    `mongodb+srv://${process.env.MONGO_USERNAME}:${process.env.MONGO_PASSWORD}@${process.env.MONGO_CLUSTER}/${process.env.MONGO_DATABASE}`
  )
  .then(() => {
    app.listen(8888);
  })
  .catch((err) => {
    console.log(err);
  });
