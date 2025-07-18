import * as webpack from 'webpack';
const Dotenv = require('dotenv-webpack');

export default {
  plugins: [
    new Dotenv()
  ]
} as webpack.Configuration;
