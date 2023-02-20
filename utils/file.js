const path = require("path");
const fs = require("fs");

exports.clearImage = (filePath) => {
  filePath = path.join(require.main.path, filePath);
  fs.unlink(filePath, (err) => {
    console.log(err);
  });
};
