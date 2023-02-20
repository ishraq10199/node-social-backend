const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const validator = require("validator");
const User = require("../models/user");
const Post = require("../models/post");

const { clearImage } = require("../utils/file");

const JWT_SECRET_KEY = "cc5j10jhEbuiP2Rs+KLNt9jCrLol4BTiZelPyUGT794=";

const POSTS_PER_PAGE = 2;

module.exports = {
  createUser: async function ({ userInput }, req) {
    const errors = [];

    if (!validator.isEmail(userInput.email)) {
      errors.push({
        message: "E-mail is invalid.",
      });
    }

    if (!validator.isLength(userInput.password, { min: 5 })) {
      errors.push({
        message: "Password too short!",
      });
    }

    if (errors.length > 0) {
      const error = new Error("Invalid input.");
      error.data = errors;
      error.code = 422;
      throw error;
    }

    const existingUser = await User.findOne({ email: userInput.email });
    if (existingUser) {
      const error = new Error("User exists already");
      throw error;
    }

    const hashedPassword = await bcrypt.hash(userInput.password, 12);
    const user = new User({
      email: userInput.email,
      name: userInput.name,
      password: hashedPassword,
    });
    const createdUser = await user.save();

    return { ...createdUser._doc, _id: createdUser._id.toString() };
  },

  login: async function ({ email, password }, req) {
    const user = await User.findOne({ email: email });
    if (!user) {
      const error = new Error("User not found");
      error.code = 401;
      throw error;
    }
    const isEqual = await bcrypt.compare(password, user.password);
    if (!isEqual) {
      const error = new Error("Password is incorrect");
      error.code = 401;
      throw error;
    }
    const token = jwt.sign(
      {
        userId: user._id.toString(),
        email: user.email,
      },
      JWT_SECRET_KEY,
      { expiresIn: "1h" }
    );

    return { token: token, userId: user._id.toString() };
  },

  createPost: async function ({ postInput }, req) {
    if (!req.isAuth) {
      const error = new Error("Not authenticated");
      error.code = 401;
      throw error;
    }

    const errors = [];
    if (
      validator.isEmpty(postInput.title) ||
      !validator.isLength(postInput.title, { min: 5 })
    ) {
      errors.push({
        message: "Title is invalid.",
      });
    }

    if (
      validator.isEmpty(postInput.content) ||
      !validator.isLength(postInput.content, { min: 5 })
    ) {
      errors.push({
        message: "Content is invalid.",
      });
    }

    if (errors.length > 0) {
      const error = new Error("Invalid input.");
      error.data = errors;
      error.code = 422;
      throw error;
    }

    const user = await User.findById(req.userId);
    if (!user) {
      const error = new Error("Invalid user.");
      error.data = errors;
      error.code = 401;
      throw error;
    }

    const post = new Post({
      ...postInput,
      creator: user,
    });

    const createdPost = await post.save();

    user.posts.push(createdPost);

    await user.save();

    return {
      ...createdPost._doc,
      _id: createdPost._id.toString(),
      createdAt: createdPost.createdAt.toISOString(),
      updatedAt: createdPost.updatedAt.toISOString(),
    };
  },
  posts: async function ({ page }, req) {
    if (!req.isAuth) {
      const error = new Error("Not authenticated");
      error.code = 401;
      throw error;
    }

    if (!page) {
      page = 1;
    }

    const totalPosts = await Post.find().countDocuments();
    const posts = await Post.find()
      .skip((page - 1) * POSTS_PER_PAGE)
      .limit(POSTS_PER_PAGE)
      .sort({ createdAt: -1 })
      .populate("creator");

    return {
      posts: posts.map((p) => {
        return {
          ...p._doc,
          _id: p._id.toString(),
          createdAt: p.createdAt.toISOString(),
          updatedAt: p.updatedAt.toISOString(),
        };
      }),
      totalPosts: totalPosts,
    };
  },

  post: async function ({ id }, req) {
    if (!req.isAuth) {
      const error = new Error("Not authenticated");
      error.code = 401;
      throw error;
    }

    const post = await Post.findById(id).populate("creator");

    if (!post) {
      const error = new Error("Post not found!");
      error.code = 404;
      throw error;
    }

    return {
      ...post._doc,
      _id: post._id.toString(),
      createdAt: post.createdAt.toISOString(),
      updatedAt: post.updatedAt.toISOString(),
    };
  },

  updatePost: async function ({ postUpdateInput }, req) {
    if (!req.isAuth) {
      const error = new Error("Not authenticated");
      error.code = 401;
      throw error;
    }

    const post = await Post.findById(postUpdateInput.id).populate("creator");

    if (!post) {
      const error = new Error("Post not found!");
      error.code = 404;
      throw error;
    }

    if (post.creator._id.toString() !== req.userId) {
      const error = new Error("Unauthorized!");
      error.code = 403;
      throw error;
    }

    const errors = [];
    if (
      validator.isEmpty(postUpdateInput.title) ||
      !validator.isLength(postUpdateInput.title, { min: 5 })
    ) {
      errors.push({
        message: "Title is invalid.",
      });
    }

    if (
      validator.isEmpty(postUpdateInput.content) ||
      !validator.isLength(postUpdateInput.content, { min: 5 })
    ) {
      errors.push({
        message: "Content is invalid.",
      });
    }

    if (errors.length > 0) {
      const error = new Error("Invalid input.");
      error.data = errors;
      error.code = 422;
      throw error;
    }

    post.title = postUpdateInput.title;
    post.content = postUpdateInput.content;
    if (postUpdateInput.imageUrl !== "undefined") {
      post.imageUrl = postUpdateInput.imageUrl;
    }
    const updatedPost = await post.save();

    return {
      ...updatedPost._doc,
      _id: updatedPost._id.toString(),
      createdAt: updatedPost.createdAt.toISOString(),
      updatedAt: updatedPost.updatedAt.toISOString(),
    };
  },
  deletePost: async function ({ id }, req) {
    if (!req.isAuth) {
      const error = new Error("Not authenticated");
      error.code = 401;
      throw error;
    }

    try {
      const post = await Post.findById(id);

      if (!post) {
        const error = new Error("Post not found!");
        error.code = 404;
        throw error;
      }

      if (post.creator.toString() !== req.userId) {
        const error = new Error("Unauthorized!");
        error.code = 403;
        throw error;
      }

      clearImage(post.imageUrl);

      await Post.findByIdAndDelete(id);

      const user = await User.findById(req.userId);

      user.posts.pull(id);

      await user.save();

      return true;
    } catch (err) {
      return false;
    }
  },
  user: async function (args, req) {
    if (!req.isAuth) {
      const error = new Error("Not authenticated");
      error.code = 401;
      throw error;
    }

    const user = await User.findById(req.userId);

    if (!user) {
      const error = new Error("User not found!");
      error.code = 404;
      throw error;
    }

    return { ...user._doc, _id: user._id.toString() };
  },

  updateStatus: async function ({ status }, req) {
    if (!req.isAuth) {
      const error = new Error("Not authenticated");
      error.code = 401;
      throw error;
    }

    const user = await User.findById(req.userId);

    if (!user) {
      const error = new Error("User not found!");
      error.code = 404;
      throw error;
    }

    user.status = status;
    await user.save();

    return { ...user._doc, _id: user._id.toString() };
  },
};
