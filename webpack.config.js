
const path = require("path");
const CopyPlugin = require("copy-webpack-plugin");
 
module.exports = {
    mode: "development",
    entry: './src/main.js',
    output: {
        path: path.join(__dirname, 'dist'),
        filename: 'bundle.js'
    },
    module: {
      rules: [
        {
          exclude: /node_modules/,
          test: /\.js$/,
          use: [
            'ify-loader'
            ]
        }
      ]
    },
    resolve: {
        extensions: [".tsx", ".ts", ".js"]
    },  
    plugins: [
        new CopyPlugin({ patterns: [{ from: "static" }] })
    ],
    // devtool: "inline-source-map"
};

