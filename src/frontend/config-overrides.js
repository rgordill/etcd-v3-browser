const MonacoWebpackPlugin = require('monaco-editor-webpack-plugin');

module.exports = function override(config) {
  config.module.rules.push({
    test: /\.m?js$/,
    resolve: {
      fullySpecified: false,
    },
  });

  config.plugins.push(
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
  );

  return config;
};
