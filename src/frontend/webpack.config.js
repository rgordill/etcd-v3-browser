/* eslint-env node */

const path = require('path');
const webpack = require('webpack');
const TerserPlugin = require('terser-webpack-plugin');
const MonacoWebpackPlugin = require('monaco-editor-webpack-plugin');
const { ConsoleRemotePlugin } = require('@openshift-console/dynamic-plugin-sdk-webpack');

const isProd = process.env.NODE_ENV === 'production';

const config = {
  mode: isProd ? 'production' : 'development',
  // No regular entry points needed. All plugin related scripts are generated via ConsoleRemotePlugin.
  entry: {},
  context: path.resolve(__dirname, 'src'),
  output: {
    path: path.resolve(__dirname, 'dist-plugin'),
    filename: isProd ? '[name]-bundle-[hash].min.js' : '[name]-bundle.js',
    chunkFilename: isProd ? '[name]-chunk-[chunkhash].min.js' : '[name]-chunk.js',
  },
  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.jsx'],
  },
  module: {
    rules: [
      {
        test: /\.(jsx?|tsx?)$/,
        exclude: /\/node_modules\//,
        use: [
          {
            loader: 'ts-loader',
            options: {
              configFile: path.resolve(__dirname, 'tsconfig.json'),
              transpileOnly: true,
            },
          },
        ],
      },
      {
        test: /\.(css)$/,
        exclude: /node_modules\/monaco-editor/,
        use: ['style-loader', 'css-loader'],
      },
      {
        test: /\.css$/,
        include: path.resolve(__dirname, 'node_modules/monaco-editor'),
        use: ['style-loader', 'css-loader'],
      },
      {
        test: /\.(png|jpg|jpeg|gif|svg|woff2?|ttf|eot|otf)(\?.*$|$)/,
        type: 'asset/resource',
        generator: {
          filename: isProd ? 'assets/[contenthash][ext]' : 'assets/[name][ext]',
        },
      },
      {
        test: /\.(m?js)$/,
        resolve: {
          fullySpecified: false,
        },
      },
    ],
  },
  plugins: [
    new MonacoWebpackPlugin({
      languages: ['yaml', 'json', 'plaintext'],
      globalAPI: true,
      customLanguages: [
        {
          label: 'yaml',
          entry: 'monaco-yaml',
          worker: {
            id: 'monaco-yaml/yamlWorker',
            entry: 'monaco-yaml/yaml.worker',
          },
        },
      ],
    }),
    new ConsoleRemotePlugin({
      validateSharedModules: false,
      validateExtensionSchema: false,
      validateExtensionIntegrity: false,
    }),
    new webpack.DefinePlugin({
      'process.env.PUBLIC_URL': JSON.stringify(''),
      'process.env.REACT_APP_API_URL': JSON.stringify(''),
    }),
  ],
  devtool: isProd ? false : 'source-map',
  optimization: {
    chunkIds: isProd ? 'deterministic' : 'named',
    minimize: isProd,
    minimizer: isProd
      ? [
          new TerserPlugin({
            terserOptions: {
              // Avoid mangle collisions between the App component binding and
              // useState setter locals (e.g. both renamed to "Ve"), which causes
              // "Cannot access 'Ve' before initialization" at runtime.
              keep_fnames: true,
              mangle: {
                keep_fnames: true,
              },
            },
          }),
        ]
      : [],
  },
};

module.exports = config;
