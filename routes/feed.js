const express = require("express");
const { body } = require("express-validator");
const isAuth = require("../middleware/is-auth");
const router = express.Router();

const feedController = require("../controllers/feed");

router.get("/posts/:postId", isAuth, feedController.getPostById);

router.get("/posts", isAuth, feedController.getPosts);
router.post(
  "/posts",
  isAuth,
  [
    body("title").trim().isLength({ min: 5 }),
    body("content").trim().isLength({ min: 5 }),
  ],
  feedController.createPost
);

router.put(
  "/posts/:postId",
  isAuth,
  [
    body("title").trim().isLength({ min: 5 }),
    body("content").trim().isLength({ min: 5 }),
  ],
  feedController.updatePost
);

router.delete("/posts/:postId", isAuth, feedController.deletePost);

module.exports = router;
